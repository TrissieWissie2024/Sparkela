import "server-only";

import type { SubscribeRequest } from "@/lib/types";
import { attemptSignal, canRetry } from "@/lib/deadline";
import type { EnvSource } from "@/lib/env";
import { customerGid, customerIdFromGid } from "@/lib/forms/confirm-token";
import {
  getShopifyAdminConfig,
  ShopifyError,
  ShopifyNotConfiguredError,
  type ShopifyAdminConfig,
} from "@/lib/commerce/shopify/config";

/**
 * The only Admin API client (docs/PLAN.md §15.2, §15.3, §16.1, §16.2; decisions 74, 75, 76, 110, 132). Used by
 * /api/subscribe and /api/subscribe/confirm only; everything else talks to the Storefront API (client.ts).
 *
 * - getAdminToken(): SHOPIFY_ADMIN_ACCESS_TOKEN when set; otherwise the client credentials grant against
 *   https://{domain}/admin/oauth/access_token (form-encoded, never JSON). The token stays in this module's memory
 *   until `expires_in` minus 5 minutes.
 * - adminGraphql(): X-Shopify-Access-Token, an 8 s timeout, one retry after 500 ms on HTTP 429/5xx or GraphQL
 *   THROTTLED, one fresh token after a 401, and ACCESS_DENIED (or "not approved to access the Customer object") as
 *   ShopifyError("access-denied"), logged by the routes as "admin-pii-denied". With the route's deadline
 *   (lib/deadline.ts) every attempt, the token request included, stops at the deadline and a retry only starts when
 *   there is room for it (decision 198).
 * - The customer operations read no protected field we do not need: no `email`, no name, and not the deprecated
 *   Customer.email / Customer.emailMarketingConsent; consent comes from defaultEmailAddress.marketingState. The address
 *   is always a GraphQL variable, never text in a query (customerByIdentifier is an exact lookup, not search syntax).
 *
 * Schema checked for 2026-10 against the Shopify reference (search snippets; shopify.dev itself is not reachable from
 * the build container): customerByIdentifier(identifier: { emailAddress }), Customer.defaultEmailAddress.marketingState
 * (CustomerEmailAddressMarketingState), CustomerInput.emailMarketingConsent (CustomerEmailMarketingConsentInput with
 * marketingState, marketingOptInLevel, consentUpdatedAt) and customerEmailMarketingConsentUpdate. The live Admin test
 * (npm run test:shopify with SHOPIFY_LIVE_ADMIN=1, plan §11.9 step 3) confirms them on the real store.
 */

const TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 500;
/** Refresh a client-credentials token 5 minutes before Shopify says it expires. */
const TOKEN_MARGIN_MS = 5 * 60 * 1000;
/** Without expires_in, assume Shopify's documented lifetime of about 24 hours. */
const DEFAULT_TOKEN_LIFETIME_S = 24 * 60 * 60;

/* -------------------------------------------------------------------------- */
/* Token                                                                      */
/* -------------------------------------------------------------------------- */

interface CachedToken {
  /** Which store and client the token belongs to, so a changed configuration never reuses it. */
  key: string;
  token: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;
let inflight: { key: string; promise: Promise<string> } | null = null;

function requireAdminConfig(env: EnvSource): ShopifyAdminConfig {
  const config = getShopifyAdminConfig(env);
  if (config === null) {
    throw new ShopifyNotConfiguredError("The Admin API needs SHOPIFY_ADMIN_CLIENT_ID and SHOPIFY_ADMIN_CLIENT_SECRET.");
  }
  return config;
}

function cacheKey(config: ShopifyAdminConfig): string {
  return `${config.domain}|${config.clientId ?? ""}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function requestToken(config: ShopifyAdminConfig, deadline?: number): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId ?? "",
    client_secret: config.clientSecret ?? "",
  });
  const signal = attemptSignal(TIMEOUT_MS, deadline);
  if (signal === null) throw new ShopifyError("timeout", "Admin token request had no time left.");
  let response: Response;
  try {
    response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
      signal,
    });
  } catch (error) {
    throw new ShopifyError(isAbort(error) ? "timeout" : "network", "Admin token request failed.");
  }
  if (!response.ok) {
    const code = response.status === 400 || response.status === 401 || response.status === 403 ? "unauthorized" : "http";
    throw new ShopifyError(code, `Admin token request answered HTTP ${response.status}.`);
  }
  const data: unknown = await response.json().catch(() => null);
  if (!isRecord(data) || typeof data.access_token !== "string" || data.access_token === "") {
    throw new ShopifyError("http", "Admin token response has no access_token.");
  }
  const lifetime = typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : DEFAULT_TOKEN_LIFETIME_S;
  cached = { key: cacheKey(config), token: data.access_token, expiresAt: Date.now() + lifetime * 1000 - TOKEN_MARGIN_MS };
  return data.access_token;
}

/**
 * The Admin access token (plan §15.2, decision 75). With SHOPIFY_ADMIN_ACCESS_TOKEN that value; otherwise a client
 * credentials token, cached until 5 minutes before it expires. Concurrent callers share one request.
 * `options.fresh` drops the cached token first (after a 401); `options.deadline` bounds a new token request.
 */
export async function getAdminToken(
  options: { fresh?: boolean; deadline?: number } = {},
  env: EnvSource = process.env,
): Promise<string> {
  const config = requireAdminConfig(env);
  if (config.accessTokenOverride !== null) return config.accessTokenOverride;
  const key = cacheKey(config);
  if (options.fresh && cached?.key === key) cached = null;
  if (cached && cached.key === key && Date.now() < cached.expiresAt) return cached.token;
  if (inflight && inflight.key === key) return inflight.promise;
  const promise = requestToken(config, options.deadline).finally(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  inflight = { key, promise };
  return promise;
}

/** Tests only: forget the cached token. */
export function resetAdminTokenCache(): void {
  cached = null;
  inflight = null;
}

/* -------------------------------------------------------------------------- */
/* GraphQL                                                                    */
/* -------------------------------------------------------------------------- */

interface GraphqlError {
  message?: unknown;
  extensions?: { code?: unknown };
}

const PII_DENIED = /not approved to access the Customer object/i;

function graphqlErrors(data: unknown): GraphqlError[] {
  if (!isRecord(data) || !Array.isArray(data.errors)) return [];
  return data.errors.filter(isRecord) as GraphqlError[];
}

function hasCode(errors: GraphqlError[], code: string): boolean {
  return errors.some((error) => isRecord(error.extensions) && error.extensions.code === code);
}

function isAccessDenied(errors: GraphqlError[]): boolean {
  return hasCode(errors, "ACCESS_DENIED") || errors.some((error) => typeof error.message === "string" && PII_DENIED.test(error.message));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One Admin GraphQL request (plan §16.2). Variables carry every value; the query text is always a constant.
 * Throws ShopifyError: "timeout", "network", "unauthorized" (401 twice, or with the fixed override token), "throttled"
 * (429/THROTTLED after the retry), "http" (other status), "access-denied" (ACCESS_DENIED or protected customer data)
 * or "graphql" (any other error). Error messages carry no personal data. `deadline` is the route's (lib/deadline.ts).
 */
export async function adminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
  env: EnvSource = process.env,
  deadline?: number,
): Promise<T> {
  const config = requireAdminConfig(env);
  let token = await getAdminToken({ deadline }, env);
  let refreshed = false;
  let retried = false;

  for (;;) {
    const signal = attemptSignal(TIMEOUT_MS, deadline);
    if (signal === null) throw new ShopifyError("timeout", "Admin API request had no time left.");
    let response: Response;
    try {
      response = await fetch(config.adminUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query, variables: variables ?? {} }),
        signal,
      });
    } catch (error) {
      throw new ShopifyError(isAbort(error) ? "timeout" : "network", "Admin API request failed.");
    }

    if (response.status === 401) {
      if (refreshed || config.accessTokenOverride !== null) throw new ShopifyError("unauthorized", "Admin API answered 401.");
      refreshed = true;
      token = await getAdminToken({ fresh: true, deadline }, env);
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      if (!retried && canRetry(RETRY_DELAY_MS, deadline)) {
        retried = true;
        await wait(RETRY_DELAY_MS);
        continue;
      }
      throw new ShopifyError(response.status === 429 ? "throttled" : "http", `Admin API answered HTTP ${response.status}.`);
    }
    if (!response.ok) throw new ShopifyError("http", `Admin API answered HTTP ${response.status}.`);

    const data: unknown = await response.json().catch(() => null);
    const errors = graphqlErrors(data);
    if (errors.length > 0) {
      if (isAccessDenied(errors)) throw new ShopifyError("access-denied", "Admin API denied access to customer data.");
      if (hasCode(errors, "THROTTLED")) {
        if (!retried && canRetry(RETRY_DELAY_MS, deadline)) {
          retried = true;
          await wait(RETRY_DELAY_MS);
          continue;
        }
        throw new ShopifyError("throttled", "Admin API stayed throttled after one retry.");
      }
      throw new ShopifyError("graphql", "Admin API returned GraphQL errors.");
    }
    if (!isRecord(data) || !isRecord(data.data)) throw new ShopifyError("graphql", "Admin API returned no data.");
    return data.data as T;
  }
}

/* -------------------------------------------------------------------------- */
/* Queries and mutations (constants: values only ever go in as variables)     */
/* -------------------------------------------------------------------------- */

export const CUSTOMER_BY_EMAIL_QUERY = /* GraphQL */ `
  query CustomerByEmail($identifier: CustomerIdentifierInput!) {
    customerByIdentifier(identifier: $identifier) {
      id
      tags
      defaultEmailAddress { marketingState }
    }
  }
`;

export const CUSTOMER_BY_ID_QUERY = /* GraphQL */ `
  query CustomerById($id: ID!) {
    customer(id: $id) {
      id
      defaultEmailAddress { marketingState }
    }
  }
`;

export const CUSTOMER_CREATE_MUTATION = /* GraphQL */ `
  mutation CustomerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }
`;

export const TAGS_ADD_MUTATION = /* GraphQL */ `
  mutation TagsAdd($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      node { id }
      userErrors { field message }
    }
  }
`;

export const CONSENT_UPDATE_MUTATION = /* GraphQL */ `
  mutation CustomerEmailMarketingConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
    customerEmailMarketingConsentUpdate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }
`;

/** CustomerEmailAddressMarketingState: the values Shopify reads back. */
export type MarketingState = "SUBSCRIBED" | "PENDING" | "NOT_SUBSCRIBED" | "UNSUBSCRIBED" | "REDACTED" | "INVALID";

interface UserError {
  field?: string[] | null;
  message: string;
}

interface CustomerNode {
  id: string;
  tags?: string[];
  defaultEmailAddress: { marketingState: MarketingState | null } | null;
}

/** Shopify answered with userErrors: the request was understood but refused. Routes answer "upstream". */
export class AdminUserError extends Error {
  constructor(public readonly operation: string) {
    super(`Admin API refused ${operation}.`);
    this.name = "AdminUserError";
  }
}

function assertNoUserErrors(operation: string, userErrors: UserError[] | null | undefined): void {
  if (userErrors && userErrors.length > 0) throw new AdminUserError(operation);
}

function marketingStateOf(customer: CustomerNode): MarketingState | null {
  return customer.defaultEmailAddress?.marketingState ?? null;
}

/* -------------------------------------------------------------------------- */
/* Newsletter operations                                                      */
/* -------------------------------------------------------------------------- */

/** Tags of a sign-up (plan §15.2 step 3): club, bron:<source>, and with the quiz quiz:vibe-…, quiz:moment-…, quiz:type-…. */
export function newsletterTags(request: Pick<SubscribeRequest, "source" | "quiz">): string[] {
  const tags = ["club", `bron:${request.source}`];
  if (request.quiz) {
    tags.push(`quiz:vibe-${request.quiz.vibe}`, `quiz:moment-${request.quiz.moment}`, `quiz:type-${request.quiz.type}`);
  }
  return tags;
}

function pendingConsent(now: number) {
  return { marketingState: "PENDING", marketingOptInLevel: "CONFIRMED_OPT_IN", consentUpdatedAt: new Date(now).toISOString() };
}

export type SubscriberResult = {
  /** "pending": consent is PENDING and a confirmation link goes out; "already-subscribed": a member, nothing changed. */
  status: "pending" | "already-subscribed";
  customerId: string;
  /** Tags still to add on confirmation (an existing customer); a new customer got them at customerCreate. */
  tagsOnConfirm: string[];
};

/**
 * The Admin side of POST /api/subscribe (plan §15.2 step 4, decision 199), always double opt-in:
 * - no customer with this address: customerCreate with the tags and consent PENDING / CONFIRMED_OPT_IN (a new record
 *   that only this sign-up made);
 * - a SUBSCRIBED customer: "already-subscribed", nothing changed (no tags, no consent change);
 * - any other existing customer: consent to PENDING / CONFIRMED_OPT_IN, and the tags wait for the confirmation (they go
 *   into the signed token), so nobody can tag a stranger's customer record without the double opt-in.
 * Returns the numeric customer id for the confirmation token. Throws ShopifyError or AdminUserError.
 */
export async function upsertPendingSubscriber(
  email: string,
  tags: string[],
  now: number,
  env: EnvSource = process.env,
  deadline?: number,
): Promise<SubscriberResult> {
  const lookup = await adminGraphql<{ customerByIdentifier: CustomerNode | null }>(
    CUSTOMER_BY_EMAIL_QUERY,
    { identifier: { emailAddress: email } },
    env,
    deadline,
  );
  const existing = lookup.customerByIdentifier;

  if (existing === null) {
    const created = await adminGraphql<{
      customerCreate: { customer: { id: string } | null; userErrors: UserError[] } | null;
    }>(CUSTOMER_CREATE_MUTATION, { input: { email, tags, emailMarketingConsent: pendingConsent(now) } }, env, deadline);
    assertNoUserErrors("customerCreate", created.customerCreate?.userErrors);
    const id = created.customerCreate?.customer?.id ? customerIdFromGid(created.customerCreate.customer.id) : null;
    if (id === null) throw new AdminUserError("customerCreate");
    return { status: "pending", customerId: id, tagsOnConfirm: [] };
  }

  const id = customerIdFromGid(existing.id);
  if (id === null) throw new ShopifyError("graphql", "Admin API returned an unexpected customer id.");

  if (marketingStateOf(existing) === "SUBSCRIBED") return { status: "already-subscribed", customerId: id, tagsOnConfirm: [] };

  const updated = await adminGraphql<{ customerEmailMarketingConsentUpdate: { userErrors: UserError[] } | null }>(
    CONSENT_UPDATE_MUTATION,
    { input: { customerId: existing.id, emailMarketingConsent: pendingConsent(now) } },
    env,
    deadline,
  );
  assertNoUserErrors("customerEmailMarketingConsentUpdate", updated.customerEmailMarketingConsentUpdate?.userErrors);
  return { status: "pending", customerId: id, tagsOnConfirm: tags };
}

/** "stale": the customer is not PENDING (unsubscribed since, redacted, invalid): the link no longer counts. */
export type ConfirmSubscriberResult = "confirmed" | "already-confirmed" | "not-found" | "stale";

/**
 * The Admin side of POST /api/subscribe/confirm (plan §15.3 step 3, decision 199): the customer by id; none →
 * "not-found"; SUBSCRIBED → "already-confirmed"; PENDING → the token's tags (tagsAdd, when there are any) and consent
 * to SUBSCRIBED / CONFIRMED_OPT_IN at `now`; any other state → "stale". So an old link (tokens live 7 days and are not
 * single-use) never re-subscribes someone who unsubscribed after confirming: only a fresh sign-up sets PENDING again.
 */
export async function confirmSubscriber(
  customerId: string,
  now: number,
  env: EnvSource = process.env,
  options: { tags?: readonly string[]; deadline?: number } = {},
): Promise<ConfirmSubscriberResult> {
  const { tags = [], deadline } = options;
  const gid = customerGid(customerId);
  const found = await adminGraphql<{ customer: CustomerNode | null }>(CUSTOMER_BY_ID_QUERY, { id: gid }, env, deadline);
  if (found.customer === null) return "not-found";
  const state = marketingStateOf(found.customer);
  if (state === "SUBSCRIBED") return "already-confirmed";
  if (state !== "PENDING") return "stale";

  if (tags.length > 0) {
    const tagged = await adminGraphql<{ tagsAdd: { userErrors: UserError[] } | null }>(
      TAGS_ADD_MUTATION,
      { id: gid, tags: [...tags] },
      env,
      deadline,
    );
    assertNoUserErrors("tagsAdd", tagged.tagsAdd?.userErrors);
  }

  const updated = await adminGraphql<{ customerEmailMarketingConsentUpdate: { userErrors: UserError[] } | null }>(
    CONSENT_UPDATE_MUTATION,
    {
      input: {
        customerId: gid,
        emailMarketingConsent: {
          marketingState: "SUBSCRIBED",
          marketingOptInLevel: "CONFIRMED_OPT_IN",
          consentUpdatedAt: new Date(now).toISOString(),
        },
      },
    },
    env,
    deadline,
  );
  assertNoUserErrors("customerEmailMarketingConsentUpdate", updated.customerEmailMarketingConsentUpdate?.userErrors);
  return "confirmed";
}

/**
 * The log line for a failed Admin call: a fixed code, never personal data. "admin-pii-denied" tells Tristan in the
 * Vercel log that the app has no access to customer data (plan §11.9 step 3, decision 110).
 */
export function adminErrorLogCode(error: unknown): string {
  if (error instanceof ShopifyError) return error.code === "access-denied" ? "admin-pii-denied" : `admin-${error.code}`;
  if (error instanceof AdminUserError) return "admin-user-errors";
  if (error instanceof ShopifyNotConfiguredError) return "admin-not-configured";
  return "admin-unknown";
}
