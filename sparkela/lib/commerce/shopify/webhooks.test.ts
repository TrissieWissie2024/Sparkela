import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { manualTags, tagsForWebhook, verifyBearer, verifyShopifyHmac } from "@/lib/commerce/shopify/webhooks";
import { shopifyFixture, shopifyFixtureText } from "@/tests/fixtures/shopify/load";

/**
 * lib/commerce/shopify/webhooks.ts (docs/PLAN.md §7.6, §19.1): HMAC good, wrong, missing, truncated and nonsense
 * base64 (all false, never an exception); the bearer check; topic → tags and profile per the table of §7.6.
 */

const SECRET = "test-webhook-secret-not-real-0123456789";
const raw = shopifyFixtureText("webhook-products-update");
const sign = (body: string, secret = SECRET) => createHmac("sha256", secret).update(body, "utf8").digest("base64");

describe("verifyShopifyHmac", () => {
  it("accepts the signature of the raw body", () => {
    expect(verifyShopifyHmac(raw, sign(raw), SECRET)).toBe(true);
    expect(verifyShopifyHmac(raw, ` ${sign(raw)} `, SECRET)).toBe(true);
  });

  it("refuses a signature of another body or with another secret", () => {
    expect(verifyShopifyHmac(raw, sign(`${raw} `), SECRET)).toBe(false);
    expect(verifyShopifyHmac(raw, sign(raw, "another-secret-0123456789abcdef"), SECRET)).toBe(false);
    // Re-serialised JSON is another body: the route must sign the raw text.
    expect(verifyShopifyHmac(JSON.stringify(JSON.parse(raw)), sign(raw), SECRET)).toBe(false);
  });

  it("is false, never an exception, for a missing, empty, truncated or nonsense header", () => {
    const good = sign(raw);
    for (const header of [null, "", good.slice(0, 20), good.slice(0, -2), "!!!not base64!!!", "AAAA", `${good}${good}`, "é€😀"]) {
      expect(() => verifyShopifyHmac(raw, header, SECRET)).not.toThrow();
      expect(verifyShopifyHmac(raw, header, SECRET)).toBe(false);
    }
  });

  it("is false with an empty secret", () => {
    expect(verifyShopifyHmac(raw, createHmac("sha256", "").update(raw).digest("base64"), "")).toBe(false);
  });
});

describe("verifyBearer", () => {
  const secret = "test-revalidate-secret-0123456789abcdef";

  it("accepts the right token, in any case of the scheme", () => {
    expect(verifyBearer(`Bearer ${secret}`, secret)).toBe(true);
    expect(verifyBearer(`bearer ${secret}`, secret)).toBe(true);
  });

  it("refuses a wrong, shorter, longer or missing token without throwing", () => {
    for (const header of [null, "", "Bearer", `Bearer ${secret.slice(0, -1)}`, `Bearer ${secret}x`, `Basic ${secret}`, `Bearer ${secret} extra`]) {
      expect(() => verifyBearer(header, secret)).not.toThrow();
      expect(verifyBearer(header, secret)).toBe(false);
    }
    expect(verifyBearer("Bearer ", "")).toBe(false);
  });
});

describe("tagsForWebhook", () => {
  it("products/update: the product page now, the lists softly (decision 130)", () => {
    expect(tagsForWebhook("products/update", shopifyFixture("webhook-products-update"))).toEqual([
      { tag: "product:lola-chunky-hoops", profile: { expire: 0 } },
      { tag: "products", profile: "max" },
      { tag: "collections", profile: "max" },
    ]);
  });

  it("products/update without a usable handle only refreshes the lists", () => {
    expect(tagsForWebhook("products/update", { id: 1 })).toEqual([
      { tag: "products", profile: "max" },
      { tag: "collections", profile: "max" },
    ]);
    expect(tagsForWebhook("products/update", { handle: "../../etc" }).map((entry) => entry.tag)).toEqual(["products", "collections"]);
  });

  it("inventory_levels/update: products with max (decision 85)", () => {
    expect(tagsForWebhook("inventory_levels/update", shopifyFixture("webhook-inventory-levels-update"))).toEqual([
      { tag: "products", profile: "max" },
    ]);
  });

  it("collections/*: collections and products with { expire: 0 }", () => {
    for (const topic of ["collections/create", "collections/update", "collections/delete"]) {
      expect(tagsForWebhook(topic, shopifyFixture("webhook-collections-update"))).toEqual([
        { tag: "collections", profile: { expire: 0 } },
        { tag: "products", profile: { expire: 0 } },
      ]);
    }
  });

  it("products/create and products/delete: products and collections with { expire: 0 }", () => {
    for (const topic of ["products/create", "products/delete", " PRODUCTS/DELETE "]) {
      expect(tagsForWebhook(topic, { id: 9012345600001 })).toEqual([
        { tag: "products", profile: { expire: 0 } },
        { tag: "collections", profile: { expire: 0 } },
      ]);
    }
  });

  it("an unknown topic gives no tags", () => {
    expect(tagsForWebhook("orders/create", {})).toEqual([]);
    expect(tagsForWebhook("", null)).toEqual([]);
  });
});

describe("manualTags", () => {
  it("accepts the known tags and product:<handle>, each with { expire: 0 }", () => {
    expect(manualTags({ tags: ["klok", "products", "product:lola-chunky-hoops", "klok"] })).toEqual([
      { tag: "klok", profile: { expire: 0 } },
      { tag: "products", profile: { expire: 0 } },
      { tag: "product:lola-chunky-hoops", profile: { expire: 0 } },
    ]);
  });

  it("refuses anything else as a whole", () => {
    for (const body of [null, [], {}, { tags: [] }, { tags: "klok" }, { tags: ["klok", "everything"] }, { tags: ["product:"] }, { tags: [1] }]) {
      expect(manualTags(body)).toBeNull();
    }
  });
});
