import { describe, expect, it } from "vitest";
import type { CollectionRule } from "@/lib/types";
import { assets } from "@/content/assets";
import { collections } from "@/content/collections";
import { products } from "@/content/products";

/**
 * content/collections.ts against plan §2.3: the fixed handles, titles and rules (Shopify gets the same automatic
 * collections, docs/METAFIELDS.md), text for every collection, image keys that exist, and local products for every
 * tag-based rule so no collection page starts empty. Rule evaluation itself lives in lib/catalog.ts (C2a).
 */

const PLAN: Array<[handle: string, title: string, rule: CollectionRule]> = [
  ["alle", "Alle sieraden", { kind: "all" }],
  ["nieuw", "Nieuw", { kind: "tag", tag: "nieuw" }],
  ["oorbellen", "Oorbellen", { kind: "type", type: "oorbellen" }],
  ["armbanden", "Armbanden", { kind: "type", type: "armbanden" }],
  ["kettingen", "Kettingen", { kind: "type", type: "kettingen" }],
  ["ringen", "Ringen", { kind: "type", type: "ringen" }],
  ["subtiel", "Subtiel en klassiek", { kind: "vibe", vibe: "clean-en-classy" }],
  ["limited", "Limited", { kind: "drop" }],
  ["festival", "Festival", { kind: "moment", moment: "festival" }],
  ["date-night", "Date night", { kind: "moment", moment: "date-night" }],
  ["kantoor-maar-niet-saai", "Kantoor maar niet saai", { kind: "moment", moment: "kantoor-maar-niet-saai" }],
  ["strand", "Strand", { kind: "moment", moment: "strand" }],
  ["feestdagen", "Feestdagen", { kind: "moment", moment: "feestdagen" }],
  ["onder-25", "Cadeaus onder €25", { kind: "maxPrice", cents: 2500 }],
];

/** Regular pieces: no gift card, no gift wrap, not hidden and not in a drop. */
const regular = products.filter(
  (product) => !product.isGiftCard && !product.tags.includes("verborgen") && !product.tags.some((tag) => tag.startsWith("drop:")),
);

function matchesWithoutClock(rule: CollectionRule): string[] {
  const has = (tag: string) => regular.filter((product) => product.tags.includes(tag)).map((product) => product.handle);
  switch (rule.kind) {
    case "all":
      return regular.map((product) => product.handle);
    case "tag":
      return has(rule.tag);
    case "type":
      return has(`type:${rule.type}`);
    case "vibe":
      return has(`vibe:${rule.vibe}`);
    case "moment":
      return has(`moment:${rule.moment}`);
    case "maxPrice":
      return regular.filter((p) => Math.min(...p.variants.map((v) => v.price)) < rule.cents).map((p) => p.handle);
    case "drop":
      return products.filter((product) => product.tags.some((tag) => tag.startsWith("drop:"))).map((product) => product.handle);
  }
}

describe("collections (plan §2.3)", () => {
  it("has the fixed handles, titles and rules, in order", () => {
    expect(collections.map((collection) => [collection.handle, collection.title, collection.rule])).toEqual(PLAN);
    expect(new Set(collections.map((collection) => collection.handle)).size).toBe(collections.length);
  });

  it("writes an intro and SEO texts for every collection", () => {
    for (const collection of collections) {
      expect(collection.handle).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(collection.intro.trim(), collection.handle).not.toBe("");
      expect(collection.seo.title.trim(), collection.handle).not.toBe("");
      expect(collection.seo.description.trim(), collection.handle).not.toBe("");
      expect(collection.seo.description.length, collection.handle).toBeLessThanOrEqual(160);
    }
  });

  it("gives every collection a styling tile, so no unfiltered grid ends in a ragged row (fix 7-9)", () => {
    for (const collection of collections) expect(collection.stylingTile, collection.handle).not.toBeNull();
  });

  it("only points to image slots that exist", () => {
    for (const collection of collections) {
      if (collection.bannerImage) expect(assets.images[collection.bannerImage], collection.handle).toBeDefined();
      if (collection.stylingTile) {
        expect(assets.images[collection.stylingTile.image], collection.handle).toBeDefined();
        expect(collection.stylingTile.afterIndex, collection.handle).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("has local pieces for every collection, so no collection starts empty", () => {
    for (const collection of collections) {
      expect(matchesWithoutClock(collection.rule).length, collection.handle).toBeGreaterThan(0);
    }
  });
});
