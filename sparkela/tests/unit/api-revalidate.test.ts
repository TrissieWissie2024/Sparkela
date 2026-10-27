import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/revalidate/route";
import { shopifyFixtureText } from "@/tests/fixtures/shopify/load";

/**
 * app/api/revalidate/route.ts (docs/PLAN.md §7.6, §19.1): 401 for a wrong or missing HMAC (never 500); 503 without a
 * secret; revalidateTag per the table of §7.6 (products/update: product:x with { expire: 0 }, products and
 * collections with "max"; stock "max"; collections { expire: 0 }); the manual bearer path.
 */

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag, cacheLife: vi.fn(), cacheTag: vi.fn() }));

const WEBHOOK_SECRET = "test-webhook-secret-not-real-0123456789";
const REVALIDATE_SECRET = "test-revalidate-secret-0123456789abcdef";
const URL_REVALIDATE = "https://sparkela.nl/api/revalidate";

function sign(body: string, secret = WEBHOOK_SECRET): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

function webhook(topic: string, body: string, hmac: string | null = sign(body)): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json", "x-shopify-topic": topic, "x-shopify-shop-domain": "sparkela.myshopify.com" });
  if (hmac !== null) headers.set("x-shopify-hmac-sha256", hmac);
  return POST(new Request(URL_REVALIDATE, { method: "POST", headers, body }));
}

function manual(body: unknown, authorization: string | null = `Bearer ${REVALIDATE_SECRET}`): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization !== null) headers.set("authorization", authorization);
  return POST(new Request(URL_REVALIDATE, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));
}

beforeEach(() => {
  vi.stubEnv("SHOPIFY_WEBHOOK_SECRET", WEBHOOK_SECRET);
  vi.stubEnv("REVALIDATE_SECRET", REVALIDATE_SECRET);
  revalidateTag.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Shopify webhooks", () => {
  it("products/update: product:<handle> with { expire: 0 }, products and collections with max", async () => {
    const response = await webhook("products/update", shopifyFixtureText("webhook-products-update"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, tags: ["product:lola-chunky-hoops", "products", "collections"] });
    expect(revalidateTag.mock.calls).toEqual([
      ["product:lola-chunky-hoops", { expire: 0 }],
      ["products", "max"],
      ["collections", "max"],
    ]);
  });

  it("inventory_levels/update: products with max", async () => {
    await webhook("inventory_levels/update", shopifyFixtureText("webhook-inventory-levels-update"));
    expect(revalidateTag.mock.calls).toEqual([["products", "max"]]);
  });

  it("collections/update: collections and products with { expire: 0 }", async () => {
    await webhook("collections/update", shopifyFixtureText("webhook-collections-update"));
    expect(revalidateTag.mock.calls).toEqual([
      ["collections", { expire: 0 }],
      ["products", { expire: 0 }],
    ]);
  });

  it("an unknown topic: 200 without tags", async () => {
    const response = await webhook("orders/create", "{}");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, tags: [] });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("401 for a wrong, missing, truncated or nonsense HMAC, never 500", async () => {
    const body = shopifyFixtureText("webhook-products-update");
    for (const hmac of [null, "", sign(body).slice(0, 10), sign(body, "another-secret-0123456789abcdef"), "%%%", sign(`${body}\n`)]) {
      const response = await webhook("products/update", body, hmac);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ ok: false });
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("checks the signature before parsing: a broken body with a valid HMAC still answers 200", async () => {
    const response = await webhook("products/update", "{not json");
    expect(response.status).toBe(200);
    expect(revalidateTag.mock.calls.map(([tag]) => tag)).toEqual(["products", "collections"]);
  });

  it("503 without SHOPIFY_WEBHOOK_SECRET", async () => {
    vi.stubEnv("SHOPIFY_WEBHOOK_SECRET", "");
    const body = shopifyFixtureText("webhook-products-update");
    expect((await webhook("products/update", body)).status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe("manual revalidation", () => {
  it("revalidates the named tags with { expire: 0 }", async () => {
    const response = await manual({ tags: ["klok", "products"] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, tags: ["klok", "products"] });
    expect(revalidateTag.mock.calls).toEqual([
      ["klok", { expire: 0 }],
      ["products", { expire: 0 }],
    ]);
  });

  it("401 for a wrong token, 400 for another body, 503 without a (long enough) secret", async () => {
    expect((await manual({ tags: ["klok"] }, "Bearer wrong-token")).status).toBe(401);
    expect((await manual({ tags: ["klok"] }, "Basic abc")).status).toBe(401);
    expect((await manual({ tags: ["everything"] })).status).toBe(400);
    expect((await manual("not json")).status).toBe(400);
    vi.stubEnv("REVALIDATE_SECRET", "too-short");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect((await manual({ tags: ["klok"] })).status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("without any header it is treated as a webhook: 401", async () => {
    const response = await POST(new Request(URL_REVALIDATE, { method: "POST", body: '{"tags":["klok"]}' }));
    expect(response.status).toBe(401);
  });
});
