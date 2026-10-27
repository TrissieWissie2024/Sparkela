import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  adminErrorLogCode,
  adminGraphql,
  AdminUserError,
  confirmSubscriber,
  CONSENT_UPDATE_MUTATION,
  CUSTOMER_BY_EMAIL_QUERY,
  CUSTOMER_BY_ID_QUERY,
  CUSTOMER_CREATE_MUTATION,
  getAdminToken,
  newsletterTags,
  resetAdminTokenCache,
  TAGS_ADD_MUTATION,
  upsertPendingSubscriber,
} from "@/lib/commerce/shopify/admin";
import { ShopifyError } from "@/lib/commerce/shopify/config";

const fixtureDir = join(process.cwd(), "tests/fixtures/shopify");
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixtureDir, `${name}.json`), "utf8")) as unknown;
}

const ENV = {
  SHOPIFY_STORE_DOMAIN: "sparkela-test.myshopify.com",
  SHOPIFY_ADMIN_CLIENT_ID: "test-client-id",
  SHOPIFY_ADMIN_CLIENT_SECRET: "test-client-secret-0123456789",
};
const TOKEN_URL = "https://sparkela-test.myshopify.com/admin/oauth/access_token";
const ADMIN_URL = "https://sparkela-test.myshopify.com/admin/api/2026-10/graphql.json";
const NOW = Date.parse("2026-11-20T12:00:00+01:00");
const EMAIL = "linde+test@example.com";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const fetchMock = vi.fn<typeof fetch>();

interface Call {
  url: string;
  init: RequestInit;
}
function calls(): Call[] {
  return fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), init: init ?? {} }));
}
function graphqlCalls(): Array<{ query: string; variables: Record<string, unknown>; token: string | null }> {
  return calls()
    .filter((call) => call.url === ADMIN_URL)
    .map((call) => {
      const body = JSON.parse(String(call.init.body)) as { query: string; variables: Record<string, unknown> };
      return { ...body, token: new Headers(call.init.headers).get("X-Shopify-Access-Token") };
    });
}

/** Routes by URL and by the operation name in the query. */
function respond(routes: { token?: () => Response; graphql: Array<(query: string) => Response | null> }) {
  let index = 0;
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === TOKEN_URL) return (routes.token ?? (() => json(fixture("admin-token"))))();
    const { query } = JSON.parse(String(init?.body)) as { query: string };
    const handler = routes.graphql[Math.min(index, routes.graphql.length - 1)];
    index += 1;
    const response = handler(query);
    if (!response) throw new Error(`unexpected query ${query}`);
    return response;
  });
}

beforeEach(() => {
  resetAdminTokenCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("getAdminToken (client credentials, plan §15.2)", () => {
  it("posts the client credentials form-encoded and caches the token until expires_in minus 5 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    fetchMock.mockImplementation(async () => json(fixture("admin-token")));

    expect(await getAdminToken({}, ENV)).toBe("test-admin-access-token-0123456789abcdef");
    const [call] = calls();
    expect(call.url).toBe(TOKEN_URL);
    expect(call.init.method).toBe("POST");
    expect(new Headers(call.init.headers).get("Content-Type")).toBe("application/x-www-form-urlencoded");
    expect(call.init.body).toBe(
      "grant_type=client_credentials&client_id=test-client-id&client_secret=test-client-secret-0123456789",
    );

    // Cached: no second request until 5 minutes before expires_in (86399 s).
    vi.setSystemTime(NOW + (86399 - 301) * 1000);
    await getAdminToken({}, ENV);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(NOW + (86399 - 299) * 1000);
    await getAdminToken({}, ENV);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses SHOPIFY_ADMIN_ACCESS_TOKEN without a token request", async () => {
    const env = { SHOPIFY_STORE_DOMAIN: ENV.SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN: "shpat_test_override" };
    expect(await getAdminToken({}, env)).toBe("shpat_test_override");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails as unauthorized when Shopify refuses the credentials, and shares one request between callers", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "invalid_client" }, 401));
    await expect(getAdminToken({}, ENV)).rejects.toMatchObject({ code: "unauthorized" });

    fetchMock.mockImplementation(async () => json(fixture("admin-token")));
    const [a, b] = await Promise.all([getAdminToken({}, ENV), getAdminToken({}, ENV)]);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws without an Admin configuration", async () => {
    await expect(getAdminToken({}, { SHOPIFY_STORE_DOMAIN: ENV.SHOPIFY_STORE_DOMAIN })).rejects.toThrow(/not configured/);
  });
});

describe("adminGraphql (plan §16.2)", () => {
  it("sends the token header, the query and the variables, with a timeout", async () => {
    respond({ graphql: [() => json(fixture("admin-customer-by-id-null"))] });
    const data = await adminGraphql<{ customer: null }>(CUSTOMER_BY_ID_QUERY, { id: "gid://shopify/Customer/1" }, ENV);
    expect(data).toEqual({ customer: null });
    const [call] = graphqlCalls();
    expect(call.token).toBe("test-admin-access-token-0123456789abcdef");
    expect(call.variables).toEqual({ id: "gid://shopify/Customer/1" });
    const init = calls().find((entry) => entry.url === ADMIN_URL)?.init;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("retries once after HTTP 429 and once after GraphQL THROTTLED, then gives up", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    respond({ graphql: [() => json({ errors: "Throttled" }, 429), () => json(fixture("admin-customer-by-id-null"))] });
    const first = adminGraphql(CUSTOMER_BY_ID_QUERY, { id: "gid://shopify/Customer/1" }, ENV);
    await vi.advanceTimersByTimeAsync(500);
    await expect(first).resolves.toEqual({ customer: null });

    resetAdminTokenCache();
    fetchMock.mockReset();
    const throttled = { errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] };
    respond({ graphql: [() => json(throttled), () => json(throttled)] });
    const second = adminGraphql(CUSTOMER_BY_ID_QUERY, { id: "gid://shopify/Customer/1" }, ENV);
    const outcome = expect(second).rejects.toMatchObject({ code: "throttled" });
    await vi.advanceTimersByTimeAsync(500);
    await outcome;
    expect(graphqlCalls()).toHaveLength(2);
  });

  it("fetches a new token once after a 401 and repeats the request", async () => {
    let tokens = 0;
    respond({
      token: () => {
        tokens += 1;
        return json({ access_token: `test-token-${tokens}`, expires_in: 86399 });
      },
      graphql: [() => json(fixture("admin-unauthorized"), 401), () => json(fixture("admin-customer-by-id-null"))],
    });
    await expect(adminGraphql(CUSTOMER_BY_ID_QUERY, { id: "gid://shopify/Customer/1" }, ENV)).resolves.toEqual({
      customer: null,
    });
    expect(tokens).toBe(2);
    expect(graphqlCalls().map((call) => call.token)).toEqual(["test-token-1", "test-token-2"]);
  });

  it("gives up after a second 401", async () => {
    respond({ graphql: [() => json(fixture("admin-unauthorized"), 401)] });
    await expect(adminGraphql(CUSTOMER_BY_ID_QUERY, {}, ENV)).rejects.toMatchObject({ code: "unauthorized" });
    expect(graphqlCalls()).toHaveLength(2);
  });

  it("maps ACCESS_DENIED (protected customer data) to ShopifyError access-denied, logged as admin-pii-denied", async () => {
    respond({ graphql: [() => json(fixture("admin-access-denied"))] });
    const error = await adminGraphql(CUSTOMER_BY_EMAIL_QUERY, { identifier: { emailAddress: EMAIL } }, ENV).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ShopifyError);
    expect((error as ShopifyError).code).toBe("access-denied");
    expect(adminErrorLogCode(error)).toBe("admin-pii-denied");
    expect(String((error as Error).message)).not.toContain(EMAIL);
  });

  it("maps other GraphQL errors, HTTP errors and timeouts", async () => {
    respond({ graphql: [() => json({ errors: [{ message: "Field does not exist" }] })] });
    await expect(adminGraphql(CUSTOMER_BY_ID_QUERY, {}, ENV)).rejects.toMatchObject({ code: "graphql" });

    respond({ graphql: [() => json({}, 404)] });
    await expect(adminGraphql(CUSTOMER_BY_ID_QUERY, {}, ENV)).rejects.toMatchObject({ code: "http" });

    fetchMock.mockImplementation(async (input) => {
      if (String(input) === TOKEN_URL) return json(fixture("admin-token"));
      throw Object.assign(new Error("The operation timed out."), { name: "TimeoutError" });
    });
    await expect(adminGraphql(CUSTOMER_BY_ID_QUERY, {}, ENV)).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("the route's deadline (decision 198)", () => {
  it("sends nothing once the deadline has passed", async () => {
    respond({ graphql: [() => json(fixture("admin-customer-by-id-null"))] });
    await expect(adminGraphql(CUSTOMER_BY_ID_QUERY, {}, ENV, Date.now() - 1)).rejects.toMatchObject({ code: "timeout" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not retry a 503 when the retry would not fit before the deadline", async () => {
    respond({ graphql: [() => json({}, 503), () => json(fixture("admin-customer-by-id-null"))] });
    // Warm the token so only GraphQL calls count.
    await getAdminToken({}, ENV);
    await expect(adminGraphql(CUSTOMER_BY_ID_QUERY, {}, ENV, Date.now() + 1_200)).rejects.toMatchObject({ code: "http" });
    expect(graphqlCalls()).toHaveLength(1);
  });

  it("still retries a 503 with time to spare", async () => {
    respond({ graphql: [() => json({}, 503), () => json(fixture("admin-customer-by-id-null"))] });
    await expect(adminGraphql(CUSTOMER_BY_ID_QUERY, {}, ENV, Date.now() + 10_000)).resolves.toEqual({ customer: null });
    expect(graphqlCalls()).toHaveLength(2);
  });
});

describe("the customer queries (plan §15.2, decision 110)", () => {
  it("never select email, a name or the deprecated emailMarketingConsent field", () => {
    for (const query of [CUSTOMER_BY_EMAIL_QUERY, CUSTOMER_BY_ID_QUERY, CUSTOMER_CREATE_MUTATION, TAGS_ADD_MUTATION, CONSENT_UPDATE_MUTATION]) {
      const selection = query.replace(/\([^)]*\)/g, "");
      expect(selection).not.toMatch(/\bemail\b/);
      expect(selection).not.toMatch(/firstName|lastName|displayName|\bphone\b/);
      expect(selection).not.toMatch(/emailMarketingConsent\s*\{/);
    }
    expect(CUSTOMER_BY_EMAIL_QUERY).toContain("defaultEmailAddress { marketingState }");
    expect(CUSTOMER_BY_EMAIL_QUERY).toContain("customerByIdentifier(identifier: $identifier)");
  });
});

describe("upsertPendingSubscriber (plan §15.2 step 4)", () => {
  const tags = newsletterTags({ source: "finder", quiz: { vibe: "retro", moment: "strand", type: "verras-me" } });

  it("builds the tags from source and quiz", () => {
    expect(tags).toEqual(["club", "bron:finder", "quiz:vibe-retro", "quiz:moment-strand", "quiz:type-verras-me"]);
    expect(newsletterTags({ source: "wachtlijst" })).toEqual(["club", "bron:wachtlijst"]);
  });

  it("creates a new customer on PENDING / CONFIRMED_OPT_IN, with the address only as a variable", async () => {
    respond({
      graphql: [
        (query) => (query.includes("CustomerByEmail") ? json(fixture("admin-customer-by-identifier-null")) : null),
        (query) => (query.includes("CustomerCreate") ? json(fixture("admin-customer-create")) : null),
      ],
    });
    await expect(upsertPendingSubscriber(EMAIL, tags, NOW, ENV)).resolves.toEqual({
      status: "pending",
      customerId: "7003",
      tagsOnConfirm: [],
    });

    const [lookup, create] = graphqlCalls();
    expect(lookup.variables).toEqual({ identifier: { emailAddress: EMAIL } });
    for (const call of graphqlCalls()) expect(call.query).not.toContain(EMAIL);
    expect(create.variables).toEqual({
      input: {
        email: EMAIL,
        tags,
        emailMarketingConsent: {
          marketingState: "PENDING",
          marketingOptInLevel: "CONFIRMED_OPT_IN",
          consentUpdatedAt: new Date(NOW).toISOString(),
        },
      },
    });
  });

  it("sets an existing customer to PENDING and keeps its tags for the confirmation (no tagsAdd before opt-in)", async () => {
    respond({
      graphql: [
        (query) => (query.includes("CustomerByEmail") ? json(fixture("admin-customer-by-identifier-pending")) : null),
        (query) => (query.includes("CustomerEmailMarketingConsentUpdate") ? json(fixture("admin-consent-update")) : null),
      ],
    });
    await expect(upsertPendingSubscriber(EMAIL, tags, NOW, ENV)).resolves.toEqual({
      status: "pending",
      customerId: "7001",
      tagsOnConfirm: tags,
    });
    const [, consentCall] = graphqlCalls();
    expect(consentCall.variables).toMatchObject({
      input: { customerId: "gid://shopify/Customer/7001", emailMarketingConsent: { marketingState: "PENDING" } },
    });
    expect(graphqlCalls().map((call) => call.query)).not.toContainEqual(expect.stringContaining("TagsAdd"));
  });

  it("changes nothing for an existing SUBSCRIBED member: no tags, no consent mutation", async () => {
    respond({
      graphql: [(query) => (query.includes("CustomerByEmail") ? json(fixture("admin-customer-by-identifier-subscribed")) : null)],
    });
    await expect(upsertPendingSubscriber(EMAIL, tags, NOW, ENV)).resolves.toEqual({
      status: "already-subscribed",
      customerId: "7002",
      tagsOnConfirm: [],
    });
    expect(graphqlCalls()).toHaveLength(1);
  });

  it("fails with AdminUserError on userErrors", async () => {
    respond({
      graphql: [
        (query) => (query.includes("CustomerByEmail") ? json(fixture("admin-customer-by-identifier-null")) : null),
        (query) => (query.includes("CustomerCreate") ? json(fixture("admin-user-errors")) : null),
      ],
    });
    const error = await upsertPendingSubscriber(EMAIL, tags, NOW, ENV).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AdminUserError);
    expect(adminErrorLogCode(error)).toBe("admin-user-errors");
  });
});

describe("confirmSubscriber (plan §15.3 step 3)", () => {
  it("sets SUBSCRIBED / CONFIRMED_OPT_IN for a pending customer", async () => {
    respond({
      graphql: [
        (query) => (query.includes("CustomerById") ? json(fixture("admin-customer-by-id-pending")) : null),
        (query) => (query.includes("CustomerEmailMarketingConsentUpdate") ? json(fixture("admin-consent-update")) : null),
      ],
    });
    await expect(confirmSubscriber("7001", NOW, ENV)).resolves.toBe("confirmed");
    const [lookup, update] = graphqlCalls();
    expect(lookup.variables).toEqual({ id: "gid://shopify/Customer/7001" });
    expect(update.variables).toEqual({
      input: {
        customerId: "gid://shopify/Customer/7001",
        emailMarketingConsent: {
          marketingState: "SUBSCRIBED",
          marketingOptInLevel: "CONFIRMED_OPT_IN",
          consentUpdatedAt: new Date(NOW).toISOString(),
        },
      },
    });
  });

  it("adds the token's tags before the consent update", async () => {
    respond({
      graphql: [
        (query) => (query.includes("CustomerById") ? json(fixture("admin-customer-by-id-pending")) : null),
        (query) => (query.includes("TagsAdd") ? json(fixture("admin-tags-add")) : null),
        (query) => (query.includes("CustomerEmailMarketingConsentUpdate") ? json(fixture("admin-consent-update")) : null),
      ],
    });
    await expect(confirmSubscriber("7001", NOW, ENV, { tags: ["club", "bron:finder"] })).resolves.toBe("confirmed");
    const [, tagCall, update] = graphqlCalls();
    expect(tagCall.variables).toEqual({ id: "gid://shopify/Customer/7001", tags: ["club", "bron:finder"] });
    expect(update.query).toContain("CustomerEmailMarketingConsentUpdate");
  });

  it("answers stale for a customer that is no longer PENDING (unsubscribed after an old link), without a mutation", async () => {
    for (const state of ["UNSUBSCRIBED", "NOT_SUBSCRIBED", "REDACTED", "INVALID", null]) {
      fetchMock.mockReset();
      respond({
        graphql: [
          () => json({ data: { customer: { id: "gid://shopify/Customer/7001", defaultEmailAddress: state === null ? null : { marketingState: state } } } }),
        ],
      });
      await expect(confirmSubscriber("7001", NOW, ENV, { tags: ["club"] }), String(state)).resolves.toBe("stale");
      expect(graphqlCalls()).toHaveLength(1);
    }
  });

  it("answers already-confirmed without a mutation, and not-found for an unknown customer", async () => {
    respond({ graphql: [() => json(fixture("admin-customer-by-id-subscribed"))] });
    await expect(confirmSubscriber("7002", NOW, ENV)).resolves.toBe("already-confirmed");
    expect(graphqlCalls()).toHaveLength(1);

    fetchMock.mockReset();
    respond({ graphql: [() => json(fixture("admin-customer-by-id-null"))] });
    await expect(confirmSubscriber("9999", NOW, ENV)).resolves.toBe("not-found");
  });
});
