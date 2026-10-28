import { getDropPhase } from "@/lib/dates";
import { priceDisplay } from "@/lib/pricing";
import type {
  BadgeContext,
  BadgeId,
  CatalogProduct,
  CollectionRule,
  Drop,
  DropSlug,
  Facets,
  JewelryType,
  MarketingBadgeId,
  Moment,
  PriceBucket,
  Product,
  ProductTags,
  ProductType,
  SortKey,
  StackEligibleType,
  Variant,
  Vibe,
} from "@/lib/types";
import { CARD_BADGE_ORDER } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";
import { drops as allDrops, isDropSlug } from "@/content/drops";
import { stackDiscount } from "@/content/offers";
import { site } from "@/content/site";

/**
 * Pure catalog logic (docs/PLAN.md §7.2, brief §2.7 and §7): tags, badges, visibility, collection rules, filters,
 * sorting, search, the hygiene rule and the material text per variant. No clock, no React, no next/* imports: `now`
 * always comes in as an argument, so Vitest, proxy-free server code and client components (search, filters, cards)
 * can all use it.
 *
 * Only lib/shop-data.ts (and tests) turn a Product into a CatalogProduct, inside a cached scope that read the server
 * clock (decision 106). Pages and components never call toCatalogProduct, deriveBadges or badgeContextAt.
 */

/** Most units of one cart line (local cart, /api/cart validation). */
export const MAX_LINE_QUANTITY = 99;
/** Most lines in one cart. */
export const MAX_CART_LINES = 50;

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                  */
/* -------------------------------------------------------------------------- */

// Records keyed by the union make the lists below exhaustive: a new Vibe without an entry fails to compile.
const PRODUCT_TYPE_SET: Record<ProductType, true> = {
  oorbellen: true,
  armbanden: true,
  kettingen: true,
  ringen: true,
  cadeaukaart: true,
  cadeauverpakking: true,
};
const JEWELRY_TYPE_SET: Record<JewelryType, true> = { oorbellen: true, armbanden: true, kettingen: true, ringen: true };
const VIBE_SET: Record<Vibe, true> = {
  "chunky-en-bold": true,
  "clean-en-classy": true,
  "kleurrijk-en-speels": true,
  retro: true,
};
const MOMENT_SET: Record<Moment, true> = {
  festival: true,
  "date-night": true,
  "kantoor-maar-niet-saai": true,
  strand: true,
  feestdagen: true,
};
const PRICE_BUCKET_SET: Record<PriceBucket, true> = { "tot-15": true, "15-20": true, "20-25": true, "vanaf-25": true };
const SORT_KEY_SET: Record<SortKey, true> = {
  uitgelicht: true,
  "prijs-oplopend": true,
  "prijs-aflopend": true,
  nieuwste: true,
};

/** The jewellery types in display order (filters, tabs, navigation). */
export const JEWELRY_TYPES = Object.keys(JEWELRY_TYPE_SET) as JewelryType[];
/** The vibes in display order. */
export const VIBES = Object.keys(VIBE_SET) as Vibe[];
/** The moments in display order. */
export const MOMENTS = Object.keys(MOMENT_SET) as Moment[];
/** The price buckets from low to high. */
export const PRICE_BUCKETS = Object.keys(PRICE_BUCKET_SET) as PriceBucket[];
/** The sort keys in display order; the first is the default. */
export const SORT_KEYS = Object.keys(SORT_KEY_SET) as SortKey[];

export function isProductType(value: string): value is ProductType {
  return Object.hasOwn(PRODUCT_TYPE_SET, value);
}
export function isJewelryType(value: string): value is JewelryType {
  return Object.hasOwn(JEWELRY_TYPE_SET, value);
}
export function isVibe(value: string): value is Vibe {
  return Object.hasOwn(VIBE_SET, value);
}
export function isMoment(value: string): value is Moment {
  return Object.hasOwn(MOMENT_SET, value);
}
export function isPriceBucket(value: string): value is PriceBucket {
  return Object.hasOwn(PRICE_BUCKET_SET, value);
}
export function isSortKey(value: string): value is SortKey {
  return Object.hasOwn(SORT_KEY_SET, value);
}

/* -------------------------------------------------------------------------- */
/* Tags                                                                        */
/* -------------------------------------------------------------------------- */

const PREFIXES = ["type", "vibe", "moment", "drop"] as const;
type TagPrefix = (typeof PREFIXES)[number];

function splitPrefixed(tag: string): { prefix: TagPrefix; value: string } | null {
  const colon = tag.indexOf(":");
  if (colon <= 0) return null;
  const prefix = tag.slice(0, colon).trim();
  if (!(PREFIXES as readonly string[]).includes(prefix)) return null;
  return { prefix: prefix as TagPrefix, value: tag.slice(colon + 1).trim() };
}

/**
 * Shopify tags (and the tags of content/products.ts) to ProductTags (plan §6.2): "type:oorbellen" → type,
 * "vibe:retro" → vibes, "moment:festival" → moments, "drop:holiday-sparkle" → drops, and the plain tags "nieuw",
 * "verborgen" and "piercing". Case and spaces do not matter. Unknown values of a known prefix are ignored and passed
 * to `onUnknown` (the Shopify mapper warns once per value in the build); other plain tags are kept in `raw` only.
 * `raw` holds every tag, lower-cased, trimmed and without duplicates. The first valid "type:" wins.
 */
export function parseTags(raw: readonly string[], onUnknown?: (tag: string) => void): ProductTags {
  const seen = new Set<string>();
  const tags: ProductTags = {
    type: null,
    vibes: [],
    moments: [],
    drops: [],
    nieuw: false,
    verborgen: false,
    piercing: false,
    raw: [],
  };

  for (const input of raw) {
    if (typeof input !== "string") continue;
    const tag = input.trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.raw.push(tag);

    if (tag === "nieuw") tags.nieuw = true;
    else if (tag === "verborgen") tags.verborgen = true;
    else if (tag === "piercing") tags.piercing = true;

    const prefixed = splitPrefixed(tag);
    if (!prefixed) continue;
    const { prefix, value } = prefixed;
    if (prefix === "type" && isProductType(value)) {
      tags.type ??= value;
    } else if (prefix === "vibe" && isVibe(value)) {
      if (!tags.vibes.includes(value)) tags.vibes.push(value);
    } else if (prefix === "moment" && isMoment(value)) {
      if (!tags.moments.includes(value)) tags.moments.push(value);
    } else if (prefix === "drop" && isDropSlug(value)) {
      if (!tags.drops.includes(value)) tags.drops.push(value);
    } else {
      onUnknown?.(tag);
    }
  }
  return tags;
}

/* -------------------------------------------------------------------------- */
/* Variants                                                                    */
/* -------------------------------------------------------------------------- */

/** The variant with this id, or null. */
export function findVariant(product: Pick<Product, "variants">, variantId: string): Variant | null {
  return product.variants.find((variant) => variant.id === variantId) ?? null;
}

/** The first variant that is for sale, else the first variant. Every product has at least one variant. */
export function defaultVariant(product: Pick<Product, "variants">): Variant {
  const variant = product.variants.find((candidate) => candidate.availableForSale) ?? product.variants[0];
  if (!variant) throw new Error("defaultVariant: the product has no variants");
  return variant;
}

/** Earrings and bracelets count for the stack discount (content/offers.ts stackDiscount.eligibleTypes). */
export function isStackEligible(type: ProductType | null): type is StackEligibleType {
  return type !== null && (stackDiscount.eligibleTypes as readonly ProductType[]).includes(type);
}

/** The hygiene rule applies to earrings and to anything tagged "piercing" (brief §2.10, decision 80). */
export function needsHygieneSeal(p: Pick<Product, "type" | "tags">): boolean {
  return p.type === "oorbellen" || p.tags.piercing;
}

const GOLD_LAYER = " met goudlaag";
/** "met goudlaag", "met een goudlaag", "met een dikke goudlaag": everything that names the gold layer. */
const GOLD_LAYER_PATTERN = /\s*\bmet\s+(?:een\s+)?(?:\p{L}+\s+)?goudlaag\b/giu;
/** Words that already say the piece is gold plated. No `g` flag: test() must not keep a lastIndex between calls. */
const PLATING_WORDS = /goudlaag|verguld/iu;

/**
 * The material text of a variant (plan §5.4, decisions 81 and 185). `materiaal` is the product metafield:
 * - Goud: " met goudlaag" is added unless the text already names the gold layer or plating anywhere (a search over
 *   the whole text, not endsWith, so "Roestvrij staal met goudlaag; kralen: [...]" and "Roestvrij staal met een
 *   dikke goudlaag" stay as they are and never name the layer twice).
 * - Zilver: every mention of the gold layer is removed ("Roestvrij staal met goudlaag" → "Roestvrij staal"). If a
 *   plating word is still left after that, the text would be wrong for silver, so there is no material text (null)
 *   rather than a false spec (brief §2.6, fail closed).
 * - No variant or no swatch: the metafield as it is.
 */
export function materialForVariant(materiaal: string | null, variant: Pick<Variant, "swatch"> | null): string | null {
  if (materiaal === null) return null;
  const text = materiaal.trim();
  if (!text) return null;
  const swatch = variant?.swatch ?? null;
  if (swatch === "goud") return PLATING_WORDS.test(text) ? text : `${text}${GOLD_LAYER}`;
  if (swatch === "zilver") {
    const silver = text.replace(GOLD_LAYER_PATTERN, "").replace(/\s{2,}/g, " ").trim();
    return silver && !PLATING_WORDS.test(silver) ? silver : null;
  }
  return text;
}

/* -------------------------------------------------------------------------- */
/* Drops, visibility and badges                                                */
/* -------------------------------------------------------------------------- */

/**
 * The product with its drop membership complete: `tags.drops` becomes its drop:<slug> tags plus every drop whose
 * `productHandles` lists its handle, the same union the proxy and the cart gate use (fail closed, decision 200). So a
 * Shopify product that is in content/drops.ts but lacks its drop: tag is still hidden in lists, search, the sitemap and
 * the client catalog until its drop starts. lib/commerce/index.ts applies this to every product it hands out.
 */
export function withDropMembership<T extends Pick<Product, "handle" | "tags">>(product: T, drops: readonly Drop[]): T {
  const missing = drops
    .filter((drop) => drop.productHandles.includes(product.handle) && !product.tags.drops.includes(drop.slug))
    .map((drop) => drop.slug);
  if (missing.length === 0) return product;
  return { ...product, tags: { ...product.tags, drops: [...product.tags.drops, ...missing] } };
}

/**
 * Value and unit stay together in a spec line ("25 mm", "3,5 cm"): a no-break space between them (decision 201). The
 * separator " · " sticks to the segment before it (a no-break space in front), so a line can break after the dot but
 * never starts with one ("Verguld staal ·" / "30 mm", fix 7-9).
 */
export function keepUnitsTogether(text: string): string {
  return text
    .replace(/(\d)\s+(mm|cm|m|g|gr|ml|ct|karaat)(?![\p{L}\d])/giu, "$1\u00a0$2")
    .replace(/\s+·\s+/gu, "\u00a0· ");
}

function dropsOf(product: Pick<Product, "tags">, drops: readonly Drop[]): Drop[] {
  return product.tags.drops.map((slug) => drops.find((drop) => drop.slug === slug)).filter((drop): drop is Drop => !!drop);
}

/** True when one of the product's drops is publicly live at `now` (startsAt <= now < endsAt). */
export function isInLiveDrop(product: Pick<Product, "tags">, now: number, drops: readonly Drop[] = allDrops): boolean {
  return dropsOf(product, drops).some((drop) => getDropPhase(drop, now) === "live");
}

/**
 * The drop this product belongs to while that drop has not publicly started (phase "verborgen" or "early-access"
 * at `now`), else null. Before the public start the product page builds its stack picker and "Maak de look af"
 * from the same drop only (decision 107). A slug without a drop in `drops` is ignored.
 */
export function preStartDropOf(product: Pick<Product, "tags">, now: number, drops: readonly Drop[] = allDrops): DropSlug | null {
  const drop = dropsOf(product, drops).find((candidate) => {
    const phase = getDropPhase(candidate, now);
    return phase === "verborgen" || phase === "early-access";
  });
  return drop?.slug ?? null;
}

/**
 * May the product appear in lists (collections, search, home, sitemap) at `now`? Never hidden products (the gift
 * wrap), gift cards or the gift wrap; a product with a drop tag only while one of its drops is publicly live (fail
 * closed: a drop slug without a drop never counts as live). Sold-out products stay listable (decision 42).
 */
export function isListable(product: Product | CatalogProduct, now: number, drops: readonly Drop[]): boolean {
  if (product.tags.verborgen || product.isGiftCard || product.isGiftWrap) return false;
  if (product.tags.drops.length === 0) return true;
  return isInLiveDrop(product, now, drops);
}

/**
 * Every badge that applies (plan §6.5, brief §2.7). A marketing badge only when it is in ctx.enabled AND its rule
 * holds; status badges always. Order: CARD_BADGE_ORDER first, then "early-access" and "op-voorraad".
 * - uitverkocht: not for sale.
 * - laatste-stuks: a real stock from 1 to lowStockThreshold (null = not tracked: never).
 * - limited: a drop tag whose drop is publicly live.
 * - sale: priceDisplay() of the default variant shows a struck price (needs laagste_prijs_30d, §8.6).
 * - nieuw: the manual tag "nieuw".
 * - bestseller: the manual metafield, and only with real sales data.
 * - early-access: a drop tag whose drop is in its early-access phase (only the drop page shows it).
 * - op-voorraad: for sale and no "Laatste stuks" badge (only the product page shows it).
 */
export function deriveBadges(product: Product, ctx: BadgeContext): BadgeId[] {
  const enabled = (id: MarketingBadgeId) => ctx.enabled.includes(id);
  const phases = dropsOf(product, ctx.drops).map((drop) => getDropPhase(drop, ctx.now));
  const total = product.totalQuantityAvailable;
  const variant = product.variants.length > 0 ? defaultVariant(product) : null;

  const applies: Record<BadgeId, boolean> = {
    uitverkocht: !product.availableForSale,
    "laatste-stuks":
      enabled("laatste-stuks") && product.availableForSale && total !== null && total > 0 && total <= ctx.lowStockThreshold,
    limited: enabled("limited") && phases.includes("live"),
    sale: enabled("sale") && variant !== null && priceDisplay(variant, product.metafields.laagstePrijs30d).showCompareAt,
    nieuw: enabled("nieuw") && product.tags.nieuw,
    bestseller: enabled("bestseller") && ctx.realSalesData && product.metafields.bestseller,
    "early-access": phases.includes("early-access"),
    "op-voorraad": false,
  };
  applies["op-voorraad"] = product.availableForSale && !applies["laatste-stuks"];

  const order: BadgeId[] = [...CARD_BADGE_ORDER, "early-access", "op-voorraad"];
  return order.filter((id) => applies[id]);
}

/** The one badge a card shows: the first of CARD_BADGE_ORDER in `badges`, or null. */
export function cardBadge(badges: readonly BadgeId[]): BadgeId | null {
  return CARD_BADGE_ORDER.find((id) => badges.includes(id)) ?? null;
}

/** The badge context at `now` from content (site.lowStockThreshold, site.badges.enabled, site.flags, drops). */
export function badgeContextAt(now: number): BadgeContext {
  return {
    now,
    drops: allDrops,
    lowStockThreshold: site.lowStockThreshold,
    enabled: site.badges.enabled,
    realSalesData: site.flags.realSalesData,
  };
}

/**
 * The client view of a product (plan §6.3): no GPSR, care text or long fields; badges and listable at ctx.now.
 * Only lib/shop-data.ts and tests call this.
 */
export function toCatalogProduct(p: Product, ctx: BadgeContext): CatalogProduct {
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    type: p.type,
    tags: p.tags,
    images: p.images,
    variants: p.variants,
    options: p.options,
    priceRange: p.priceRange,
    availableForSale: p.availableForSale,
    totalQuantityAvailable: p.totalQuantityAvailable,
    isGiftCard: p.isGiftCard,
    isGiftWrap: p.isGiftWrap,
    featuredRank: p.featuredRank,
    publishedAt: p.publishedAt,
    specRegel: p.metafields.specRegel === null ? null : keepUnitsTogether(p.metafields.specRegel),
    lindesFavoriet: p.metafields.lindesFavoriet,
    bestseller: p.metafields.bestseller,
    laagstePrijs30d: p.metafields.laagstePrijs30d,
    badges: deriveBadges(p, ctx),
    listable: isListable(p, ctx.now, ctx.drops),
  };
}

/* -------------------------------------------------------------------------- */
/* Collections                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The products of a collection rule (plan §2.3), in input order. Only listable products count, so no rule ever
 * shows the gift wrap, the gift card or a drop before its public start; `{ kind: "drop" }` keeps the products of the
 * drops that are publicly live now.
 */
export function applyCollectionRule(products: Product[], rule: CollectionRule, now: number, drops: Drop[]): Product[] {
  const listable = products.filter((product) => isListable(product, now, drops));
  switch (rule.kind) {
    case "all":
      return listable;
    case "type":
      return listable.filter((product) => product.type === rule.type);
    case "vibe":
      return listable.filter((product) => product.tags.vibes.includes(rule.vibe));
    case "moment":
      return listable.filter((product) => product.tags.moments.includes(rule.moment));
    case "tag":
      return listable.filter((product) => product.tags.nieuw);
    case "drop":
      return listable.filter((product) => isInLiveDrop(product, now, drops));
    case "maxPrice":
      return listable.filter((product) => product.priceRange.min.cents < rule.cents);
  }
}

/* -------------------------------------------------------------------------- */
/* Sorting, filters and facets                                                 */
/* -------------------------------------------------------------------------- */

type Sortable = Pick<Product, "featuredRank" | "priceRange" | "publishedAt" | "availableForSale">;

function byRank(a: Sortable, b: Sortable): number {
  return a.featuredRank - b.featuredRank;
}

function publishedMs(value: string): number {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * A sorted copy (plan §7.2): "uitgelicht" by featuredRank with sold-out products last (decision 42); "prijs-*" by
 * the lowest variant price, equal prices by featuredRank; "nieuwste" by publishedAt descending, then featuredRank.
 * The input is never mutated.
 */
export function sortProducts<T extends Sortable>(items: T[], key: SortKey): T[] {
  const sorted = [...items];
  switch (key) {
    case "prijs-oplopend":
      return sorted.sort((a, b) => a.priceRange.min.cents - b.priceRange.min.cents || byRank(a, b));
    case "prijs-aflopend":
      return sorted.sort((a, b) => b.priceRange.min.cents - a.priceRange.min.cents || byRank(a, b));
    case "nieuwste":
      return sorted.sort((a, b) => publishedMs(b.publishedAt) - publishedMs(a.publishedAt) || byRank(a, b));
    case "uitgelicht":
    default:
      return sorted.sort((a, b) => Number(!a.availableForSale) - Number(!b.availableForSale) || byRank(a, b));
  }
}

/** Upper bounds (exclusive) of the price buckets in cents, on priceRange.min (plan §7.2; same as sharedCopy.vocab.price). */
const BUCKET_UPPER: Record<Exclude<PriceBucket, "vanaf-25">, number> = { "tot-15": 1500, "15-20": 2000, "20-25": 2500 };

/** The price bucket of an amount: below 1500, 1500 to 1999, 2000 to 2499, from 2500. */
export function priceBucketOf(cents: number): PriceBucket {
  if (cents < BUCKET_UPPER["tot-15"]) return "tot-15";
  if (cents < BUCKET_UPPER["15-20"]) return "15-20";
  if (cents < BUCKET_UPPER["20-25"]) return "20-25";
  return "vanaf-25";
}

type Filterable = Pick<CatalogProduct, "type" | "tags" | "priceRange">;

function matchesAny<V>(selected: readonly V[] | undefined, values: readonly V[]): boolean {
  return !selected || selected.length === 0 || values.some((value) => selected.includes(value));
}

/**
 * Filters (plan §7.2): AND between facets, OR within a facet. A missing or empty facet does not filter. Prices on
 * priceRange.min. Order is kept.
 */
export function filterProducts<T extends Filterable>(items: T[], f: Partial<Facets>): T[] {
  return items.filter(
    (item) =>
      matchesAny<ProductType | null>(f.types, [item.type]) &&
      matchesAny(f.vibes, item.tags.vibes) &&
      matchesAny(f.moments, item.tags.moments) &&
      matchesAny(f.price, [priceBucketOf(item.priceRange.min.cents)]),
  );
}

/** The facet values that occur in `items` (only jewellery types), each list in display order. */
export function availableFacets(items: Filterable[]): Facets {
  const types = new Set<string>();
  const vibes = new Set<string>();
  const moments = new Set<string>();
  const price = new Set<string>();
  for (const item of items) {
    if (item.type) types.add(item.type);
    item.tags.vibes.forEach((vibe) => vibes.add(vibe));
    item.tags.moments.forEach((moment) => moments.add(moment));
    price.add(priceBucketOf(item.priceRange.min.cents));
  }
  return {
    types: JEWELRY_TYPES.filter((type) => types.has(type)),
    vibes: VIBES.filter((vibe) => vibes.has(vibe)),
    moments: MOMENTS.filter((moment) => moments.has(moment)),
    price: PRICE_BUCKETS.filter((bucket) => price.has(bucket)),
  };
}

/* -------------------------------------------------------------------------- */
/* Search                                                                      */
/* -------------------------------------------------------------------------- */

/** Longest query that is searched; the rest is ignored. */
const MAX_QUERY_LENGTH = 100;

/** Lower case, without diacritics and punctuation, single spaces: "Date-night Één" → "date night een". */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

type Searchable = Pick<CatalogProduct, "title" | "type" | "tags" | "featuredRank"> &
  Partial<Pick<CatalogProduct, "variants" | "specRegel">>;

function haystackOf(item: Searchable): string {
  const { type: typeLabels, vibe: vibeLabels, moment: momentLabels } = sharedCopy.vocab;
  const parts: string[] = [item.title];
  if (item.type) parts.push(item.type, item.type in typeLabels ? typeLabels[item.type as JewelryType] : "");
  for (const vibe of item.tags.vibes) parts.push(vibe, vibeLabels[vibe]);
  for (const moment of item.tags.moments) parts.push(moment, momentLabels[moment]);
  // QA round 1: the colours ("Goud", "Zilver"), the spec line ("Verguld staal · 45 mm") and the drop's name.
  for (const variant of item.variants ?? []) if (variant.swatch) parts.push(variant.title);
  if (item.specRegel) parts.push(item.specRegel);
  for (const slug of item.tags.drops) {
    const drop = allDrops.find((candidate) => candidate.slug === slug);
    if (drop) parts.push(drop.name);
  }
  const text = normalizeSearchText(parts.join(" "));
  const words = new Set(text.split(" "));
  // Words people type that the catalog says differently ("kerst" for feestdagen, "goud" for verguld).
  const extra = Object.entries(sharedCopy.searchSynonyms)
    .filter(([word]) => words.has(word))
    .map(([, synonyms]) => normalizeSearchText(synonyms));
  return extra.length > 0 ? `${text} ${extra.join(" ")}` : text;
}

/**
 * Search over title, type, vibe and moment (slugs and the labels of sharedCopy.vocab), the colour variants, the spec
 * line and the drop's name, plus sharedCopy.searchSynonyms (QA round 1), insensitive to case and diacritics (plan
 * §7.3). Every word of the query must occur. A query word that names a type (sharedCopy.searchTypeWords: "ring",
 * "oorbellen") keeps only that type (QA round 3). Best match first: the title equals the query, starts with it,
 * contains it as whole words, contains it inside a word ("ring" in "ringetjes"), contains every word; then the rest.
 * Ties by featuredRank. An empty query finds nothing. The caller passes the visible products (useCatalog().products);
 * this function does not filter visibility.
 */
export function searchProducts<T extends Searchable>(items: T[], query: string): T[] {
  const q = normalizeSearchText(query.slice(0, MAX_QUERY_LENGTH));
  if (!q) return [];
  const words = q.split(" ");
  const types = new Set(words.flatMap((word) => sharedCopy.searchTypeWords[word] ?? []));
  const scored: Array<{ item: T; score: number }> = [];
  for (const item of items) {
    if (types.size > 0 && !(types as Set<string | null>).has(item.type)) continue;
    const haystack = haystackOf(item);
    if (!words.every((word) => haystack.includes(word))) continue;
    const title = normalizeSearchText(item.title);
    const score =
      title === q
        ? 0
        : title.startsWith(q)
          ? 1
          : ` ${title} `.includes(` ${q} `)
            ? 2
            : title.includes(q)
              ? 3
              : words.every((word) => title.includes(word))
                ? 4
                : 5;
    scored.push({ item, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.item.featuredRank - b.item.featuredRank).map((entry) => entry.item);
}

/** Shortest query word that matches a keyword it is the start of ("verz" finds "verzenden"). */
const PAGE_PREFIX_MIN = 4;

/**
 * The pages whose keywords match the query (QA round 2; sharedCopy.searchPages): a query word of at least 3 letters
 * matches a keyword that it starts with ("retourneren" → "retour"), or, from PAGE_PREFIX_MIN letters, a keyword
 * that starts with it ("cade" → "cadeau"). In the order given; an empty query finds nothing.
 */
export function searchPages<T extends { keywords: string }>(pages: readonly T[], query: string): T[] {
  const words = normalizeSearchText(query.slice(0, MAX_QUERY_LENGTH))
    .split(" ")
    .filter((word) => word.length >= 3);
  if (words.length === 0) return [];
  return pages.filter((page) => {
    const keywords = normalizeSearchText(page.keywords).split(" ");
    return words.some((word) =>
      keywords.some((keyword) => word.startsWith(keyword) || (word.length >= PAGE_PREFIX_MIN && keyword.startsWith(word))),
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Home                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The favourites carousel of the home (plan §14.1 section 9, decisions 79 and 106). With real sales data: the
 * products with the manual metafield "bestseller", under the title "Bestsellers" (useSalesTitle). Otherwise, or
 * when no product is marked, Linde's favourites under their own title: Linde's picks never appear as bestsellers.
 * Only listable products, by featuredRank.
 */
export function homeFavorites(
  items: CatalogProduct[],
  realSalesData: boolean,
): { products: CatalogProduct[]; useSalesTitle: boolean } {
  const listable = [...items].filter((item) => item.listable).sort(byRank);
  if (realSalesData) {
    const bestsellers = listable.filter((item) => item.bestseller);
    if (bestsellers.length > 0) return { products: bestsellers, useSalesTitle: true };
  }
  return { products: listable.filter((item) => item.lindesFavoriet), useSalesTitle: false };
}
