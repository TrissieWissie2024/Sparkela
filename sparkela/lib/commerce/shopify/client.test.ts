import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { storefront } from "@/lib/commerce/shopify/client";
import { ShopifyError, ShopifyNotConfiguredError } from "@/lib/commerce/shopify/config";
import { jsonResponse, shopifyFixture } from "@/tests/fixtures/shopify/load";

/**
 * lib/commerce/shopify/client.ts (docs/PLAN.md §16.1, §16.2): headers per token type, Buyer IP, one retry after
 * 429/5xx/THROTTLED, timeout and network errors, GraphQL errors, and no token in any error message.
 */

const TOKEN = "test-storefront-token-not-real-0123456789";
const URL_2026_10 = "https://sparkela-test.myshopify.com/api/2026-10/graphql.json";
const QUERY = "query Test { shop { name } }";

const fetchMock = vi.fn<typeof fetch>();

function requestOf(call = 0): { url: string; init: RequestInit; headers: Record<string, string>; body: unknown } {
  const [url, init = {}] = fetchMock.mock.calls[call];
  return {
    url: String(url),
    init,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(String(init.body)) as unknown,
  };
}

async function failure(promise: Promise<unknown>): Promise<ShopifyError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ShopifyError);
    expect((error as Error).message).not.toContain(TOKEN);
    return error as ShopifyError;
  }
  throw new Error("expected a ShopifyError");
}

beforeEach(() => {
  vi.stubEnv("SHOPIFY_STORE_DOMAIN", "https://Sparkela-Test.myshopify.com/");
  vi.stubEnv("SHOPIFY_STOREFRONT_ACCESS_TOKEN", TOKEN);
  vi.stubEnv("SHOPIFY_STOREFRONT_TOKEN_TYPE", "");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("storefront", () => {
  it("posts the query and variables with the private token and the buyer IP, and returns data", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { shop: { name: "Sparkela" } } }));
    await expect(storefront(QUERY, { handle: "x" }, { buyerIp: "203.0.113.7" })).resolves.toEqual({ shop: { name: "Sparkela" } });
    const { url, init, headers, body } = requestOf();
    expect(url).toBe(URL_2026_10);
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(headers["Shopify-Storefront-Private-Token"]).toBe(TOKEN);
    expect(headers["Shopify-Storefront-Buyer-IP"]).toBe("203.0.113.7");
    expect(headers["X-Shopify-Storefront-Access-Token"]).toBeUndefined();
    expect(body).toEqual({ query: QUERY, variables: { handle: "x" } });
  });

  it("uses the public header for a public token, without the buyer IP", async () => {
    vi.stubEnv("SHOPIFY_STOREFRONT_TOKEN_TYPE", "public");
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: {} }));
    await storefront(QUERY, undefined, { buyerIp: "203.0.113.7" });
    const { headers, body } = requestOf();
    expect(headers["X-Shopify-Storefront-Access-Token"]).toBe(TOKEN);
    expect(headers["Shopify-Storefront-Private-Token"]).toBeUndefined();
    expect(headers["Shopify-Storefront-Buyer-IP"]).toBeUndefined();
    expect(body).toEqual({ query: QUERY, variables: {} });
  });

  it("retries once after 429, 500 ms later", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(new Response("", { status: 429 })).mockResolvedValueOnce(jsonResponse({ data: { ok: 1 } }));
    const result = storefront(QUERY);
    await vi.advanceTimersByTimeAsync(499);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries THROTTLED once and then gives up", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => jsonResponse(shopifyFixture("error-throttled")));
    const result = failure(storefront(QUERY));
    await vi.advanceTimersByTimeAsync(500);
    expect((await result).code).toBe("throttled");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after a second 5xx", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => new Response("oops", { status: 502 }));
    const result = failure(storefront(QUERY));
    await vi.advanceTimersByTimeAsync(500);
    expect((await result).code).toBe("http");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never retries a 5xx with retryOn5xx false (a mutation that must not run twice), but still a 429 (decision 200)", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 503 }));
    expect((await failure(storefront(QUERY, undefined, { retryOn5xx: false }))).code).toBe("http");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(new Response("", { status: 429 })).mockResolvedValueOnce(jsonResponse({ data: { ok: 1 } }));
    const result = storefront(QUERY, undefined, { retryOn5xx: false });
    await vi.advanceTimersByTimeAsync(500);
    await expect(result).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps to the route's deadline: nothing after it, no retry without room (decision 198)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { ok: 1 } }));
    expect((await failure(storefront(QUERY, undefined, { deadline: Date.now() - 1 }))).code).toBe("timeout");
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(new Response("", { status: 429 }));
    expect((await failure(storefront(QUERY, undefined, { deadline: Date.now() + 1_200 }))).code).toBe("throttled");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a wrong token", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 401 }));
    expect((await failure(storefront(QUERY))).code).toBe("unauthorized");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("turns GraphQL errors into ShopifyError(graphql), with Shopify's message", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ errors: [{ message: "Field 'x' doesn't exist on type 'Shop'", extensions: { code: "undefinedField" } }] }));
    const error = await failure(storefront(QUERY));
    expect(error.code).toBe("graphql");
    expect(error.message).toContain("doesn't exist");
  });

  it("refuses an answer without data", async () => {
    fetchMock.mockResolvedValue(new Response("<html>maintenance</html>", { status: 200 }));
    expect((await failure(storefront(QUERY))).code).toBe("graphql");
  });

  it("reports a time-out and a network failure", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"));
    expect((await failure(storefront(QUERY))).code).toBe("timeout");
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await failure(storefront(QUERY))).code).toBe("network");
  });

  it("throws ShopifyNotConfiguredError without a token, before any request", async () => {
    vi.stubEnv("SHOPIFY_STOREFRONT_ACCESS_TOKEN", "");
    await expect(storefront(QUERY)).rejects.toBeInstanceOf(ShopifyNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
