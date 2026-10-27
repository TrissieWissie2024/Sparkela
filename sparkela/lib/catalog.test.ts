import { describe, expect, it, vi } from "vitest";

import {
  applyCollectionRule,
  availableFacets,
  badgeContextAt,
  cardBadge,
  defaultVariant,
  deriveBadges,
  filterProducts,
  findVariant,
  homeFavorites,
  isListable,
  isStackEligible,
  keepUnitsTogether,
  materialForVariant,
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  needsHygieneSeal,
  normalizeSearchText,
  parseTags,
  preStartDropOf,
  priceBucketOf,
  searchProducts,
  sortProducts,
  toCatalogProduct,
  withDropMembership,
} from "@/lib/catalog";
import { toMs } from "@/lib/dates";
import { money } from "@/lib/money";
import type { BadgeContext, BadgeId, CollectionRule, Drop, MarketingBadgeId, Product } from "@/lib/types";
import { CARD_BADGE_ORDER } from "@/lib/types";
import { drops } from "@/content/drops";
import { site } from "@/content/site";
import { makeCatalogProduct, makeProduct } from "@/tests/fixtures/catalog";

/**
 * lib/catalog.ts (plan §7.2, §19.1): tags, badges, visibility, collection rules, sorting, filters, price buckets,
 * search, the hygiene rule, the material per variant and the home favourites. Products come from
 * tests/fixtures/catalog.ts, never from content/products.ts.
 */

const at = (iso: string) => toMs(iso);
const TEST_NOW = at("2026-11-27T12:00:00+01:00");
const EARLY_ACCESS = at("2026-11-26T12:00:00+01:00");
const BEFORE_EARLY_ACCESS = at("2026-11-20T12:00:00+01:00");
const AFTER_HOLIDAY = at("2027-01-02T12:00:00+01:00");

const ALL_MARKETING: MarketingBadgeId[] = ["nieuw", "limited", "laatste-stuks", "sale", "bestseller"];

function ctxAt(now: number, overrides: Partial<BadgeContext> = {}): BadgeContext {
  return { now, drops, lowStockThreshold: 3, enabled: site.badges.enabled, realSalesData: false, ...overrides };
}

const holidayPiece = makeProduct({ handle: "holiday-ster-oorbellen", type: "oorbellen", drops: ["holiday-sparkle"] });

describe("parseTags", () => {
  it("parses type, vibe, moment, drop and the plain tags, case- and space-insensitive", () => {
    const tags = parseTags([" Type:Oorbellen ", "vibe:retro", "VIBE:chunky-en-bold", "moment: festival", "drop:holiday-sparkle", "Nieuw", "verborgen", "piercing"]);
    expect(tags).toEqual({
      type: "oorbellen",
      vibes: ["retro", "chunky-en-bold"],
      moments: ["festival"],
      drops: ["holiday-sparkle"],
      nieuw: true,
      verborgen: true,
      piercing: true,
      raw: ["type:oorbellen", "vibe:retro", "vibe:chunky-en-bold", "moment: festival", "drop:holiday-sparkle", "nieuw", "verborgen", "piercing"],
    });
  });

  it("ignores unknown values and reports them once", () => {
    const onUnknown = vi.fn();
    const tags = parseTags(["type:hangers", "vibe:boho", "moment:bruiloft", "drop:zomer-2030", "vibe:boho", "club", "quiz:vibe-retro"], onUnknown);
    expect(tags.type).toBeNull();
    expect(tags.vibes).toEqual([]);
    expect(tags.moments).toEqual([]);
    expect(tags.drops).toEqual([]);
    expect(tags.piercing).toBe(false);
    expect(onUnknown.mock.calls.map(([tag]) => tag)).toEqual(["type:hangers", "vibe:boho", "moment:bruiloft", "drop:zomer-2030"]);
    expect(tags.raw).toEqual(["type:hangers", "vibe:boho", "moment:bruiloft", "drop:zomer-2030", "club", "quiz:vibe-retro"]);
  });

  it("keeps the first valid type and drops duplicate values", () => {
    const tags = parseTags(["type:ringen", "type:oorbellen", "vibe:retro", "vibe:retro", ""]);
    expect(tags.type).toBe("ringen");
    expect(tags.vibes).toEqual(["retro"]);
  });

  it("sets piercing only for the plain tag (hygiene rule for piercings that are not earrings)", () => {
    expect(parseTags(["type:kettingen", "piercing"]).piercing).toBe(true);
    expect(parseTags(["type:kettingen", "piercing-look"]).piercing).toBe(false);
  });
});

describe("deriveBadges", () => {
  const stocked = (quantity: number | null) =>
    makeProduct({ handle: `stock-${String(quantity)}`, variants: [{ title: "Goud", price: 1495, quantityAvailable: quantity }] });

  it("shows Laatste stuks at a real stock of 1 to 3, not at 4 or 0, never for untracked stock", () => {
    const ctx = ctxAt(TEST_NOW);
    expect(deriveBadges(stocked(3), ctx)).toContain("laatste-stuks");
    expect(deriveBadges(stocked(1), ctx)).toContain("laatste-stuks");
    expect(deriveBadges(stocked(4), ctx)).not.toContain("laatste-stuks");
    expect(deriveBadges(stocked(0), ctx)).not.toContain("laatste-stuks");
    expect(deriveBadges(stocked(0), ctx)).toContain("uitverkocht");
    expect(deriveBadges(stocked(null), ctx)).not.toContain("laatste-stuks");
  });

  it("shows Limited only while the drop is publicly live", () => {
    expect(deriveBadges(holidayPiece, ctxAt(BEFORE_EARLY_ACCESS))).not.toContain("limited");
    expect(deriveBadges(holidayPiece, ctxAt(EARLY_ACCESS))).not.toContain("limited");
    expect(deriveBadges(holidayPiece, ctxAt(EARLY_ACCESS))).toContain("early-access");
    expect(deriveBadges(holidayPiece, ctxAt(TEST_NOW))).toContain("limited");
    expect(deriveBadges(holidayPiece, ctxAt(TEST_NOW))).not.toContain("early-access");
    expect(deriveBadges(holidayPiece, ctxAt(AFTER_HOLIDAY))).not.toContain("limited");
  });

  it("never shows Bestseller without real sales data, also when it is enabled", () => {
    const marked = makeProduct({ handle: "marked", metafields: { bestseller: true } });
    expect(deriveBadges(marked, ctxAt(TEST_NOW, { enabled: ALL_MARKETING }))).not.toContain("bestseller");
    expect(deriveBadges(marked, ctxAt(TEST_NOW, { enabled: ALL_MARKETING, realSalesData: true }))).toContain("bestseller");
    expect(deriveBadges(marked, ctxAt(TEST_NOW, { enabled: ["nieuw"], realSalesData: true }))).not.toContain("bestseller");
  });

  it("never returns a marketing badge outside `enabled`", () => {
    const everything = makeProduct({
      handle: "everything",
      nieuw: true,
      drops: ["holiday-sparkle"],
      variants: [{ title: "Goud", price: 1495, compareAtPrice: 1995, quantityAvailable: 2 }],
      metafields: { bestseller: true, laagstePrijs30d: money(1495) },
    });
    const all = deriveBadges(everything, ctxAt(TEST_NOW, { enabled: ALL_MARKETING, realSalesData: true }));
    expect(all).toEqual(["laatste-stuks", "limited", "sale", "nieuw", "bestseller"]);
    for (const id of ALL_MARKETING) {
      const without = ALL_MARKETING.filter((other) => other !== id);
      expect(deriveBadges(everything, ctxAt(TEST_NOW, { enabled: without, realSalesData: true }))).not.toContain(id);
    }
    expect(deriveBadges(everything, ctxAt(TEST_NOW, { enabled: [], realSalesData: true }))).toEqual(["op-voorraad"]);
  });

  it("shows Sale only with a compare-at price above the price and the lowest price of 30 days", () => {
    const withoutLowest = makeProduct({ handle: "a", variants: [{ title: "Goud", price: 1495, compareAtPrice: 1995 }] });
    const withLowest = makeProduct({
      handle: "b",
      variants: [{ title: "Goud", price: 1495, compareAtPrice: 1995 }],
      metafields: { laagstePrijs30d: money(1495) },
    });
    const ctx = ctxAt(TEST_NOW, { enabled: ALL_MARKETING });
    expect(deriveBadges(withoutLowest, ctx)).not.toContain("sale");
    expect(deriveBadges(withLowest, ctx)).toContain("sale");
  });

  it("gives Op voorraad for a product that is for sale without Laatste stuks", () => {
    const ctx = ctxAt(TEST_NOW);
    expect(deriveBadges(stocked(10), ctx)).toEqual(["op-voorraad"]);
    expect(deriveBadges(stocked(2), ctx)).toEqual(["laatste-stuks"]);
    expect(deriveBadges(stocked(0), ctx)).toEqual(["uitverkocht"]);
  });

  it("uses the launch config through badgeContextAt", () => {
    const ctx = badgeContextAt(TEST_NOW);
    expect(ctx).toMatchObject({ now: TEST_NOW, lowStockThreshold: site.lowStockThreshold, realSalesData: false });
    expect([...ctx.enabled].sort()).toEqual(["laatste-stuks", "limited", "nieuw"]);
    expect(ctx.drops).toBe(drops);
  });
});

describe("cardBadge", () => {
  it("picks the first badge in CARD_BADGE_ORDER", () => {
    expect(cardBadge(["nieuw", "uitverkocht"])).toBe("uitverkocht");
    expect(cardBadge(["nieuw", "laatste-stuks", "limited"])).toBe("laatste-stuks");
    expect(cardBadge(["sale", "limited"])).toBe("limited");
    expect(cardBadge(["bestseller", "sale"])).toBe("sale");
    expect(cardBadge(["bestseller", "nieuw"])).toBe("nieuw");
    expect(cardBadge(["bestseller"])).toBe("bestseller");
  });

  it("ignores the status badges that cards never show", () => {
    expect(cardBadge(["op-voorraad", "early-access"])).toBeNull();
    expect(cardBadge([])).toBeNull();
    const reversed = [...CARD_BADGE_ORDER].reverse() as BadgeId[];
    expect(cardBadge(reversed)).toBe(CARD_BADGE_ORDER[0]);
  });
});

describe("isListable", () => {
  it("hides the gift wrap, the gift card and hidden products", () => {
    expect(isListable(makeProduct({ handle: "cadeauverpakking", type: "cadeauverpakking" }), TEST_NOW, drops)).toBe(false);
    expect(isListable(makeProduct({ handle: "cadeaukaart", type: "cadeaukaart" }), TEST_NOW, drops)).toBe(false);
    expect(isListable(makeProduct({ handle: "x", verborgen: true }), TEST_NOW, drops)).toBe(false);
    expect(isListable(makeProduct({ handle: "y" }), TEST_NOW, drops)).toBe(true);
  });

  it("lists a drop product only while its drop is publicly live", () => {
    expect(isListable(holidayPiece, BEFORE_EARLY_ACCESS, drops)).toBe(false);
    expect(isListable(holidayPiece, EARLY_ACCESS, drops)).toBe(false);
    expect(isListable(holidayPiece, at("2026-11-26T23:59:59+01:00"), drops)).toBe(false);
    expect(isListable(holidayPiece, at("2026-11-27T00:00:00+01:00"), drops)).toBe(true);
    expect(isListable(holidayPiece, AFTER_HOLIDAY, drops)).toBe(false);
  });

  it("fails closed for a drop slug without a drop", () => {
    expect(isListable(holidayPiece, TEST_NOW, [])).toBe(false);
  });

  it("keeps sold-out products listable (decision 42)", () => {
    const soldOut = makeProduct({ handle: "sold-out", variants: [{ title: "Goud", price: 1495, quantityAvailable: 0 }] });
    expect(isListable(soldOut, TEST_NOW, drops)).toBe(true);
  });
});

describe("withDropMembership (decision 200)", () => {
  it("adds the drops whose productHandles list the product, also without its drop: tag (fail closed)", () => {
    const untagged = makeProduct({ handle: "holiday-ster-oorbellen" });
    expect(untagged.tags.drops).toEqual([]);
    const complete = withDropMembership(untagged, drops);
    expect(complete.tags.drops).toEqual(["holiday-sparkle"]);
    expect(isListable(complete, BEFORE_EARLY_ACCESS, drops)).toBe(false);
    expect(isListable(complete, at("2026-11-27T00:00:00+01:00"), drops)).toBe(true);
  });

  it("leaves other products and complete ones as they are (same object)", () => {
    const regular = makeProduct({ handle: "y" });
    expect(withDropMembership(regular, drops)).toBe(regular);
    expect(withDropMembership(holidayPiece, drops)).toBe(holidayPiece);
  });
});

describe("keepUnitsTogether (decision 201)", () => {
  it("puts a no-break space between a value and its unit, and nowhere else", () => {
    expect(keepUnitsTogether("Verguld staal met schelpje · 25 mm")).toBe("Verguld staal met schelpje\u00a0· 25\u00a0mm");
    expect(keepUnitsTogether("Ketting 45 cm, hanger 2,5 cm")).toBe("Ketting 45\u00a0cm, hanger 2,5\u00a0cm");
    expect(keepUnitsTogether("Set van 3 maten")).toBe("Set van 3 maten");
  });

  it("glues the separator to the segment before it, so no line starts with a dot (fix 7-9)", () => {
    expect(keepUnitsTogether("Verguld staal · 8 mm breed · zegel 10 mm")).toBe("Verguld staal\u00a0· 8\u00a0mm breed\u00a0· zegel 10\u00a0mm");
    expect(keepUnitsTogether("Verguld staal\u00a0· 30\u00a0mm")).toBe("Verguld staal\u00a0· 30\u00a0mm");
  });
});

describe("preStartDropOf", () => {
  it("names the drop before its public start, and nothing from the start on", () => {
    expect(preStartDropOf(holidayPiece, BEFORE_EARLY_ACCESS)).toBe("holiday-sparkle");
    expect(preStartDropOf(holidayPiece, EARLY_ACCESS)).toBe("holiday-sparkle");
    expect(preStartDropOf(holidayPiece, TEST_NOW)).toBeNull();
    expect(preStartDropOf(holidayPiece, AFTER_HOLIDAY)).toBeNull();
    expect(preStartDropOf(makeProduct({ handle: "plain" }), EARLY_ACCESS)).toBeNull();
  });
});

describe("toCatalogProduct", () => {
  it("keeps only the client fields and adds badges and listable", () => {
    const product = makeProduct({
      handle: "lola-chunky-hoops",
      nieuw: true,
      metafields: {
        specRegel: "Staal, goud of zilver · 30 mm",
        lindesFavoriet: true,
        gpsrFabrikant: "[Fabrikant, adres]",
        verzorging: "Droog bewaren.",
      },
    });
    const item = toCatalogProduct(product, ctxAt(TEST_NOW));
    // Value and unit never break apart (decision 201).
    expect(item.specRegel).toBe("Staal, goud of zilver\u00a0· 30\u00a0mm");
    expect(item.lindesFavoriet).toBe(true);
    expect(item.badges).toEqual(["nieuw", "op-voorraad"]);
    expect(item.listable).toBe(true);
    expect(item).not.toHaveProperty("metafields");
    expect(item).not.toHaveProperty("description");
    expect(JSON.stringify(item)).not.toContain("Fabrikant");
    expect(toCatalogProduct(holidayPiece, ctxAt(EARLY_ACCESS)).listable).toBe(false);
  });
});

describe("applyCollectionRule (every CollectionRule)", () => {
  const products: Product[] = [
    makeProduct({ handle: "chunky-oorbel", type: "oorbellen", vibes: ["chunky-en-bold"], moments: ["festival"], nieuw: true, price: 1995, featuredRank: 1 }),
    makeProduct({ handle: "klassieke-armband", type: "armbanden", vibes: ["clean-en-classy"], moments: ["strand"], price: 1495, featuredRank: 2 }),
    makeProduct({ handle: "dure-ketting", type: "kettingen", vibes: ["retro"], moments: ["date-night"], price: 2995, featuredRank: 3 }),
    makeProduct({ handle: "grens-ring", type: "ringen", vibes: ["retro"], moments: ["festival"], price: 2500, featuredRank: 4 }),
    makeProduct({ handle: "drop-oorbel", type: "oorbellen", vibes: ["chunky-en-bold"], moments: ["feestdagen"], drops: ["holiday-sparkle"], nieuw: true, price: 2495, featuredRank: 5 }),
    makeProduct({ handle: "cadeauverpakking", type: "cadeauverpakking", featuredRank: 6 }),
    makeProduct({ handle: "cadeaukaart", type: "cadeaukaart", featuredRank: 7 }),
  ];
  const handles = (rule: CollectionRule, now = TEST_NOW, list: Drop[] = drops) =>
    applyCollectionRule(products, rule, now, list).map((product) => product.handle);

  it("all: every listable product, never gift wrap or gift card", () => {
    expect(handles({ kind: "all" })).toEqual(["chunky-oorbel", "klassieke-armband", "dure-ketting", "grens-ring", "drop-oorbel"]);
    expect(handles({ kind: "all" }, EARLY_ACCESS)).toEqual(["chunky-oorbel", "klassieke-armband", "dure-ketting", "grens-ring"]);
  });

  it("type, vibe, moment and tag", () => {
    expect(handles({ kind: "type", type: "oorbellen" })).toEqual(["chunky-oorbel", "drop-oorbel"]);
    expect(handles({ kind: "type", type: "ringen" })).toEqual(["grens-ring"]);
    expect(handles({ kind: "vibe", vibe: "retro" })).toEqual(["dure-ketting", "grens-ring"]);
    expect(handles({ kind: "moment", moment: "festival" })).toEqual(["chunky-oorbel", "grens-ring"]);
    expect(handles({ kind: "tag", tag: "nieuw" })).toEqual(["chunky-oorbel", "drop-oorbel"]);
    expect(handles({ kind: "tag", tag: "nieuw" }, EARLY_ACCESS)).toEqual(["chunky-oorbel"]);
  });

  it("drop: only products of drops that are publicly live now", () => {
    expect(handles({ kind: "drop" })).toEqual(["drop-oorbel"]);
    expect(handles({ kind: "drop" }, EARLY_ACCESS)).toEqual([]);
    expect(handles({ kind: "drop" }, AFTER_HOLIDAY)).toEqual([]);
  });

  it("maxPrice: the lowest variant price strictly below the limit", () => {
    expect(handles({ kind: "maxPrice", cents: 2500 })).toEqual(["chunky-oorbel", "klassieke-armband", "drop-oorbel"]);
  });
});

describe("sortProducts", () => {
  const items = [
    makeCatalogProduct({ handle: "c", price: 1995, featuredRank: 3, publishedAt: "2026-11-20T12:00:00+01:00" }),
    makeCatalogProduct({ handle: "a", price: 1495, featuredRank: 1, publishedAt: "2026-11-25T12:00:00+01:00" }),
    makeCatalogProduct({
      handle: "uitverkocht",
      featuredRank: 0,
      publishedAt: "2026-11-10T12:00:00+01:00",
      variants: [{ title: "Goud", price: 1295, quantityAvailable: 0 }],
    }),
    makeCatalogProduct({ handle: "b", price: 1995, featuredRank: 2, publishedAt: "2026-11-25T12:00:00+01:00" }),
  ];
  const order = (key: Parameters<typeof sortProducts>[1]) => sortProducts(items, key).map((item) => item.handle);

  it("uitgelicht: featuredRank with sold-out products last", () => {
    expect(order("uitgelicht")).toEqual(["a", "b", "c", "uitverkocht"]);
  });

  it("prices on priceRange.min, equal prices by featuredRank", () => {
    expect(order("prijs-oplopend")).toEqual(["uitverkocht", "a", "b", "c"]);
    expect(order("prijs-aflopend")).toEqual(["b", "c", "a", "uitverkocht"]);
  });

  it("nieuwste: publishedAt descending, then featuredRank", () => {
    expect(order("nieuwste")).toEqual(["a", "b", "c", "uitverkocht"]);
  });

  it("puts sold-out products last only for uitgelicht (decision 42)", () => {
    const sameDay = [
      makeCatalogProduct({ handle: "later", featuredRank: 2 }),
      makeCatalogProduct({ handle: "op", featuredRank: 1, variants: [{ title: "Goud", price: 1495, quantityAvailable: 0 }] }),
    ];
    expect(sortProducts(sameDay, "uitgelicht").map((item) => item.handle)).toEqual(["later", "op"]);
    expect(sortProducts(sameDay, "nieuwste").map((item) => item.handle)).toEqual(["op", "later"]);
    expect(sortProducts(sameDay, "prijs-oplopend").map((item) => item.handle)).toEqual(["op", "later"]);
  });

  it("never mutates the input", () => {
    const before = items.map((item) => item.handle);
    sortProducts(items, "prijs-oplopend");
    expect(items.map((item) => item.handle)).toEqual(before);
  });
});

describe("filters, price buckets and facets", () => {
  const items = [
    makeCatalogProduct({ handle: "o1", type: "oorbellen", vibes: ["chunky-en-bold"], moments: ["festival"], price: 1495 }),
    makeCatalogProduct({ handle: "o2", type: "oorbellen", vibes: ["retro"], moments: ["strand"], price: 1995 }),
    makeCatalogProduct({ handle: "a1", type: "armbanden", vibes: ["chunky-en-bold", "retro"], moments: ["festival"], price: 2495 }),
    makeCatalogProduct({ handle: "k1", type: "kettingen", vibes: ["clean-en-classy"], moments: ["date-night"], price: 2995 }),
  ];
  const handles = (f: Parameters<typeof filterProducts>[1]) => filterProducts(items, f).map((item) => item.handle);

  it("buckets on the lowest price: below 1500, 1500 to 1999, 2000 to 2499, from 2500", () => {
    expect(priceBucketOf(1499)).toBe("tot-15");
    expect(priceBucketOf(1500)).toBe("15-20");
    expect(priceBucketOf(1999)).toBe("15-20");
    expect(priceBucketOf(2000)).toBe("20-25");
    expect(priceBucketOf(2499)).toBe("20-25");
    expect(priceBucketOf(2500)).toBe("vanaf-25");
  });

  it("ANDs between facets and ORs within a facet", () => {
    expect(handles({})).toEqual(["o1", "o2", "a1", "k1"]);
    expect(handles({ types: [], vibes: [] })).toEqual(["o1", "o2", "a1", "k1"]);
    expect(handles({ types: ["oorbellen", "armbanden"] })).toEqual(["o1", "o2", "a1"]);
    expect(handles({ types: ["oorbellen"], vibes: ["retro"] })).toEqual(["o2"]);
    expect(handles({ vibes: ["retro", "clean-en-classy"] })).toEqual(["o2", "a1", "k1"]);
    expect(handles({ moments: ["festival"], price: ["tot-15", "20-25"] })).toEqual(["o1", "a1"]);
    expect(handles({ types: ["ringen"] })).toEqual([]);
  });

  it("lists only the facet values that occur, in display order", () => {
    expect(availableFacets(items)).toEqual({
      types: ["oorbellen", "armbanden", "kettingen"],
      vibes: ["chunky-en-bold", "clean-en-classy", "retro"],
      moments: ["festival", "date-night", "strand"],
      price: ["tot-15", "15-20", "20-25", "vanaf-25"],
    });
    expect(availableFacets([])).toEqual({ types: [], vibes: [], moments: [], price: [] });
  });
});

describe("searchProducts", () => {
  const items = [
    makeCatalogProduct({ handle: "lola", title: "Lola chunky hoops", type: "oorbellen", vibes: ["chunky-en-bold"], moments: ["date-night"], featuredRank: 1 }),
    makeCatalogProduct({ handle: "tess", title: "Tess schakelarmband", type: "armbanden", vibes: ["chunky-en-bold"], moments: ["kantoor-maar-niet-saai"], featuredRank: 8 }),
    makeCatalogProduct({ handle: "eenhoorn", title: "Één hoornring", type: "ringen", vibes: ["kleurrijk-en-speels"], featuredRank: 30 }),
    makeCatalogProduct({ handle: "hoops", title: "Hoops", type: "oorbellen", featuredRank: 40 }),
  ];
  const handles = (query: string) => searchProducts(items, query).map((item) => item.handle);

  it("finds on title, type, vibe and moment (slugs and labels)", () => {
    expect(handles("lola")).toEqual(["lola"]);
    expect(handles("armband")).toEqual(["tess"]);
    expect(handles("oorbellen")).toEqual(["lola", "hoops"]);
    expect(handles("Chunky en bold")).toEqual(["lola", "tess"]);
    expect(handles("date night")).toEqual(["lola"]);
    expect(handles("kantoor")).toEqual(["tess"]);
  });

  it("ignores case and diacritics", () => {
    expect(handles("EEN")).toEqual(["eenhoorn"]);
    expect(handles("één")).toEqual(["eenhoorn"]);
    expect(normalizeSearchText("  Date-Night,  Één! ")).toBe("date night een");
  });

  it("needs every word and ranks the best title match first", () => {
    expect(handles("chunky hoops")).toEqual(["lola"]);
    expect(handles("hoops")).toEqual(["hoops", "lola"]);
    expect(handles("lola armband")).toEqual([]);
  });

  it("finds colours, the spec line, the drop name and synonyms (QA round 1)", () => {
    const more = [
      makeCatalogProduct({ handle: "duo", title: "Duo hoops", type: "oorbellen", variants: [{ title: "Goud", price: 1495 }, { title: "Zilver", price: 1495 }], metafields: { specRegel: "Staal, goud- of zilverkleurig · 30 mm" }, featuredRank: 1 }),
      makeCatalogProduct({ handle: "ster", title: "Ster oorbellen", type: "oorbellen", moments: ["feestdagen"], drops: ["holiday-sparkle"], metafields: { specRegel: "Verguld staal · 35 mm" }, featuredRank: 2 }),
    ];
    const found = (query: string) => searchProducts(more, query).map((item) => item.handle);
    expect(found("zilver")).toEqual(["duo"]);
    expect(found("goud")).toEqual(["duo", "ster"]);
    expect(found("staal")).toEqual(["duo", "ster"]);
    expect(found("holiday")).toEqual(["ster"]);
    expect(found("kerst")).toEqual(["ster"]);
  });

  it("finds nothing for an empty query", () => {
    expect(handles("")).toEqual([]);
    expect(handles("   ")).toEqual([]);
    expect(handles("!!!")).toEqual([]);
  });
});

describe("variants and rules per product", () => {
  const ring = makeProduct({
    handle: "ring",
    type: "ringen",
    variants: [
      { title: "16", price: 1995, quantityAvailable: 0 },
      { title: "17", price: 1995, quantityAvailable: 4 },
    ],
  });

  it("findVariant and defaultVariant (first available, else first)", () => {
    expect(findVariant(ring, "local:ring:2")?.title).toBe("17");
    expect(findVariant(ring, "local:ring:9")).toBeNull();
    expect(defaultVariant(ring).title).toBe("17");
    const soldOut = makeProduct({ handle: "x", variants: [{ title: "Goud", price: 1495, quantityAvailable: 0 }] });
    expect(defaultVariant(soldOut).title).toBe("Goud");
    expect(() => defaultVariant({ variants: [] })).toThrow();
  });

  it("isStackEligible: earrings and bracelets only", () => {
    expect(isStackEligible("oorbellen")).toBe(true);
    expect(isStackEligible("armbanden")).toBe(true);
    expect(isStackEligible("kettingen")).toBe(false);
    expect(isStackEligible("cadeaukaart")).toBe(false);
    expect(isStackEligible(null)).toBe(false);
  });

  it("needsHygieneSeal: earrings yes, a necklace no, a necklace tagged piercing yes", () => {
    expect(needsHygieneSeal(makeProduct({ type: "oorbellen" }))).toBe(true);
    expect(needsHygieneSeal(makeProduct({ type: "kettingen" }))).toBe(false);
    expect(needsHygieneSeal(makeProduct({ type: "kettingen", piercing: true }))).toBe(true);
    expect(needsHygieneSeal(makeProduct({ type: "ringen", piercing: true }))).toBe(true);
  });

  it("the limits of a cart", () => {
    expect(MAX_LINE_QUANTITY).toBe(99);
    expect(MAX_CART_LINES).toBe(50);
  });
});

describe("materialForVariant (decisions 81 and 185)", () => {
  const goud = { swatch: "goud" as const };
  const zilver = { swatch: "zilver" as const };
  const materials = [
    "Roestvrij staal",
    "Roestvrij staal met goudlaag",
    "Roestvrij staal met goudlaag; kralen: [materiaal van de leverancier invullen]",
    "Roestvrij staal met een dikke goudlaag",
  ];

  it("Zilver never mentions the gold layer", () => {
    for (const materiaal of materials) {
      const text = materialForVariant(materiaal, zilver);
      expect(text === null || !/goudlaag|verguld/i.test(text), `${materiaal} → ${String(text)}`).toBe(true);
    }
    expect(materialForVariant("Roestvrij staal", zilver)).toBe("Roestvrij staal");
    expect(materialForVariant("Roestvrij staal met goudlaag", zilver)).toBe("Roestvrij staal");
    expect(materialForVariant(materials[2], zilver)).toBe("Roestvrij staal; kralen: [materiaal van de leverancier invullen]");
    expect(materialForVariant("Verguld staal", zilver)).toBeNull();
  });

  it("Goud always names the gold layer, once", () => {
    expect(materialForVariant("Roestvrij staal", goud)).toBe("Roestvrij staal met goudlaag");
    expect(materialForVariant("Roestvrij staal met goudlaag", goud)).toBe("Roestvrij staal met goudlaag");
    expect(materialForVariant(materials[2], goud)).toBe(materials[2]);
    expect(materialForVariant("Roestvrij staal met een dikke goudlaag", goud)).toBe("Roestvrij staal met een dikke goudlaag");
    expect(materialForVariant("Verguld staal", goud)).toBe("Verguld staal");
    for (const materiaal of materials) {
      const text = materialForVariant(materiaal, goud) ?? "";
      expect(text.match(/goudlaag/g)?.length, materiaal).toBe(1);
    }
  });

  it("no swatch or no variant: the metafield as it is; no metafield: null", () => {
    expect(materialForVariant("Roestvrij staal met goudlaag", null)).toBe("Roestvrij staal met goudlaag");
    expect(materialForVariant("Roestvrij staal", { swatch: null })).toBe("Roestvrij staal");
    expect(materialForVariant(null, goud)).toBeNull();
    expect(materialForVariant("   ", goud)).toBeNull();
  });
});

describe("homeFavorites (decision 79)", () => {
  const items = [
    makeCatalogProduct({ handle: "fav-2", featuredRank: 5, metafields: { lindesFavoriet: true } }),
    makeCatalogProduct({ handle: "best", featuredRank: 3, metafields: { bestseller: true } }),
    makeCatalogProduct({ handle: "fav-1", featuredRank: 1, metafields: { lindesFavoriet: true } }),
    makeCatalogProduct({ handle: "hidden-fav", featuredRank: 2, metafields: { lindesFavoriet: true }, listable: false }),
    makeCatalogProduct({ handle: "plain", featuredRank: 4 }),
  ];

  it("without real sales data: only Linde's favourites, never under the sales title", () => {
    const result = homeFavorites(items, false);
    expect(result.useSalesTitle).toBe(false);
    expect(result.products.map((item) => item.handle)).toEqual(["fav-1", "fav-2"]);
  });

  it("with real sales data: only bestseller products under the sales title", () => {
    const result = homeFavorites(items, true);
    expect(result.useSalesTitle).toBe(true);
    expect(result.products.map((item) => item.handle)).toEqual(["best"]);
  });

  it("with real sales data but nothing marked: Linde's favourites under their own title", () => {
    const result = homeFavorites(items.filter((item) => !item.bestseller), true);
    expect(result.useSalesTitle).toBe(false);
    expect(result.products.map((item) => item.handle)).toEqual(["fav-1", "fav-2"]);
  });
});
