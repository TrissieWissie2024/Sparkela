import "server-only";

import { attemptSignal, canRetry } from "@/lib/deadline";
import type { EnvSource } from "@/lib/env";
import { getShopifyConfig, ShopifyError, type ShopifyConfig } from "@/lib/commerce/shopify/config";

/**
 * The Storefront API client (docs/PLAN.md §16.1, §16.2, §16.7; decision 132: the Admin client is admin.ts).
 *
 * - Plain fetch without Next cache options: caching lives in the 'use cache' functions of lib/commerce/index.ts and
 *   lib/shop-data.ts; /api/cart reads uncached on purpose.
 * - Private token (default): `Shopify-Storefront-Private-Token`, plus `Shopify-Storefront-Buyer-IP` when the caller
 *   passes the visitor's IP (cart requests from /api/cart), so Shopify's bot protection sees the buyer and not our
 *   server. Public token: `X-Shopify-Storefront-Access-Token`.
 * - AbortSignal.timeout(8000); one retry after 500 ms on HTTP 429/5xx or the GraphQL error THROTTLED. A 429 or
 *   THROTTLED means Shopify did not run the request, so that retry is always safe; a 5xx does not mean that, so
 *   non-idempotent mutations (cartCreate, cartLinesAdd) pass `retryOn5xx: false` and are never sent twice
 *   (decision 200). With `deadline` (lib/deadline.ts) every attempt stops there and a retry only starts with room left.
 * - Throws ShopifyNotConfiguredError without domain or token (the build fails, plan §7.7) and ShopifyError otherwise:
 *   "timeout", "network", "unauthorized" (401/403: wrong token or missing scope), "throttled", "http" or "graphql".
 *   Messages never contain the token.
 */

const TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 500;
/** GraphQL error messages are shortened in our errors (they end up in build logs). */
const MAX_MESSAGE_LENGTH = 200;

export interface StorefrontOptions {
  /** The visitor's IP for Shopify-Storefront-Buyer-IP (private token only). */
  buyerIp?: string;
  /** Tests and the live test: another environment than process.env. */
  env?: EnvSource;
  /** Retry once on HTTP 5xx (default true). False for mutations that must not run twice (cartCreate, cartLinesAdd). */
  retryOn5xx?: boolean;
  /** The route's deadline in epoch ms (lib/deadline.ts); without it each attempt only has its own 8 s time-out. */
  deadline?: number;
}

/** Request headers for the Storefront API (also used by tests/unit/shopify-live.test.ts). */
export function storefrontHeaders(config: ShopifyConfig, buyerIp?: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (config.tokenType === "public") {
    headers["X-Shopify-Storefront-Access-Token"] = config.storefrontToken;
  } else {
    headers["Shopify-Storefront-Private-Token"] = config.storefrontToken;
    if (buyerIp) headers["Shopify-Storefront-Buyer-IP"] = buyerIp;
  }
  return headers;
}

interface GraphqlError {
  message?: unknown;
  extensions?: { code?: unknown };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function graphqlErrors(body: unknown): GraphqlError[] {
  if (!isRecord(body) || !Array.isArray(body.errors)) return [];
  return body.errors.filter(isRecord) as GraphqlError[];
}

function isThrottled(errors: GraphqlError[]): boolean {
  return errors.some((error) => isRecord(error.extensions) && error.extensions.code === "THROTTLED");
}

function describe(errors: GraphqlError[]): string {
  const first = errors.find((error) => typeof error.message === "string")?.message;
  return typeof first === "string" ? first.slice(0, MAX_MESSAGE_LENGTH) : "unknown error";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One Storefront GraphQL request. `query` is always a constant from queries.ts or mutations.ts; every value goes in
 * `variables`. Returns the `data` object.
 */
export async function storefront<T>(query: string, variables?: Record<string, unknown>, opts: StorefrontOptions = {}): Promise<T> {
  const config = getShopifyConfig(opts.env);
  const headers = storefrontHeaders(config, opts.buyerIp);
  const body = JSON.stringify({ query, variables: variables ?? {} });
  const retryOn5xx = opts.retryOn5xx ?? true;
  let retried = false;

  for (;;) {
    const signal = attemptSignal(TIMEOUT_MS, opts.deadline);
    if (signal === null) throw new ShopifyError("timeout", "Storefront API request had no time left.");
    let response: Response;
    try {
      response = await fetch(config.storefrontUrl, { method: "POST", headers, body, signal });
    } catch (error) {
      throw new ShopifyError(isAbort(error) ? "timeout" : "network", "Storefront API request failed.");
    }

    if (response.status === 429 || response.status >= 500) {
      const retryable = response.status === 429 || retryOn5xx;
      if (!retried && retryable && canRetry(RETRY_DELAY_MS, opts.deadline)) {
        retried = true;
        await wait(RETRY_DELAY_MS);
        continue;
      }
      throw new ShopifyError(response.status === 429 ? "throttled" : "http", `Storefront API answered HTTP ${response.status}.`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new ShopifyError("unauthorized", `Storefront API answered HTTP ${response.status}: check the token and its scopes.`);
    }
    if (!response.ok) throw new ShopifyError("http", `Storefront API answered HTTP ${response.status}.`);

    const data: unknown = await response.json().catch(() => null);
    const errors = graphqlErrors(data);
    if (errors.length > 0) {
      if (isThrottled(errors)) {
        if (!retried && canRetry(RETRY_DELAY_MS, opts.deadline)) {
          retried = true;
          await wait(RETRY_DELAY_MS);
          continue;
        }
        throw new ShopifyError("throttled", "Storefront API stayed throttled after one retry.");
      }
      throw new ShopifyError("graphql", `Storefront API returned GraphQL errors: ${describe(errors)}`);
    }
    if (!isRecord(data) || !isRecord(data.data)) throw new ShopifyError("graphql", "Storefront API returned no data.");
    return data.data as T;
  }
}
