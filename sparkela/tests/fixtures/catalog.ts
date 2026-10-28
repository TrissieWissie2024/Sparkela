/**
 * Catalog fixtures for logic tests (docs/PLAN.md §3.1, decision 95): factories for Product and CatalogProduct, plus
 * the pieces used by the worked pricing examples (§8.4) as fixed values (handle, type, price, variant ids, stock
 * from §5.4). Tests of lib/pricing.ts, lib/catalog.ts and components use these instead of content/products.ts or
 * toCatalogProduct(), so they never wait for the content or the catalog layer.
 *
 * Plain data, synchronous, no server-only imports. Badges are not derived here: pass `badges` explicitly when a
 * test needs them (deriveBadges() in lib/catalog.ts owns the rules).
 */

import { money } from "@/lib/money";
import type {
  BadgeId,
  CatalogProduct,
  Cents,
  DropSlug,
  IsoDateTime,
  Moment,
  Product,
  ProductImage,
  ProductMetafields,
  ProductOption,
  ProductTags,
  ProductType,
  SelectedOption,
  SwatchId,
  Variant,
  Vibe,
} from "@/lib/types";

/** Variant ids of the local provider: "local:<handle>:<n>", n counting from 1 in table order (§6.3). */
export function localVariantId(handle: string, n: number): string {
  return `local:${handle}:${n}`;
}

/** Product ids of the fixtures: "local:<handle>". */
export function localProductId(handle: string): string {
  return `local:${handle}`;
}

/** publishedAt of every piece (§5.4), and of the pieces tagged "nieuw". */
export const PUBLISHED_AT: IsoDateTime = "2026-11-20T12:00:00+01:00";
export const PUBLISHED_AT_NIEUW: IsoDateTime = "2026-11-25T12:00:00+01:00";

export interface VariantSpec {
  title: string;
  price: Cents;
  compareAtPrice?: Cents | null;
  /** Default 10. null = not tracked (gift cards). */
  quantityAvailable?: number | null;
  /** Default: quantityAvailable is null or above 0. */
  availableForSale?: boolean;
  sku?: string | null;
  /** Default localVariantId(handle, position). */
  id?: string;
  image?: ProductImage | null;
}

export interface ProductSpec {
  id?: string;
  /** Default "test-product". */
  handle?: string;
  /** Default: the handle with spaces. */
  title?: string;
  description?: string;
  /** Default "oorbellen". */
  type?: ProductType | null;
  vibes?: Vibe[];
  moments?: Moment[];
  drops?: DropSlug[];
  nieuw?: boolean;
  /** Default true for cadeauverpakking. */
  verborgen?: boolean;
  piercing?: boolean;
  /** Extra raw tags, appended after the derived ones. */
  extraTags?: string[];
  /**
   * Option name for the variants ("Kleur", "Maat", "Bedrag"). Default: none for a single "Standaard" variant,
   * otherwise "Maat" for rings, "Bedrag" for the gift card and "Kleur" for the rest.
   */
  optionName?: string | null;
  /**
   * Default: one "Goud" variant at `price` (1495); the gift card gets €15, €25 and €50; the gift wrap one
   * "Standaard" variant at 195 with stock 999.
   */
  variants?: VariantSpec[];
  /** Price of the default variant when `variants` is not given. */
  price?: Cents;
  metafields?: Partial<ProductMetafields>;
  images?: ProductImage[];
  publishedAt?: IsoDateTime;
  featuredRank?: number;
  /** Default true for type cadeaukaart. */
  isGiftCard?: boolean;
  seo?: Product["seo"];
}

export interface CatalogProductSpec extends ProductSpec {
  /** Default []. */
  badges?: BadgeId[];
  /** Default: not a gift card, not the gift wrap and not hidden. */
  listable?: boolean;
}

const EMPTY_METAFIELDS: ProductMetafields = {
  specRegel: null,
  materiaal: null,
  afmetingen: null,
  gewicht: null,
  sluiting: null,
  verzorging: null,
  statementMeter: null,
  nikkelvrij: null,
  gpsrFabrikant: null,
  gpsrVerantwoordelijkeEu: null,
  gpsrWaarschuwingen: null,
  laagstePrijs30d: null,
  bestseller: false,
  lindesFavoriet: false,
};

function defaultVariants(type: ProductType | null, price: Cents | undefined): VariantSpec[] {
  if (type === "cadeaukaart") {
    return [
      { title: "€15", price: 1500, quantityAvailable: null },
      { title: "€25", price: 2500, quantityAvailable: null },
      { title: "€50", price: 5000, quantityAvailable: null },
    ];
  }
  if (type === "cadeauverpakking") return [{ title: "Standaard", price: price ?? 195, quantityAvailable: 999 }];
  return [{ title: "Goud", price: price ?? 1495 }];
}

function defaultOptionName(type: ProductType | null, titles: string[]): string | null {
  if (titles.length === 1 && titles[0] === "Standaard") return null;
  if (type === "ringen") return "Maat";
  if (type === "cadeaukaart") return "Bedrag";
  return "Kleur";
}

function swatchFor(title: string): SwatchId | null {
  if (title === "Goud") return "goud";
  if (title === "Zilver") return "zilver";
  return null;
}

function buildTags(spec: ProductSpec, type: ProductType | null): ProductTags {
  const vibes = spec.vibes ?? [];
  const moments = spec.moments ?? [];
  const drops = spec.drops ?? [];
  const nieuw = spec.nieuw ?? false;
  const verborgen = spec.verborgen ?? type === "cadeauverpakking";
  const piercing = spec.piercing ?? false;
  const raw = [
    ...(type ? [`type:${type}`] : []),
    ...vibes.map((v) => `vibe:${v}`),
    ...moments.map((m) => `moment:${m}`),
    ...drops.map((d) => `drop:${d}`),
    ...(nieuw ? ["nieuw"] : []),
    ...(verborgen ? ["verborgen"] : []),
    ...(piercing ? ["piercing"] : []),
    ...(spec.extraTags ?? []).map((t) => t.trim().toLowerCase()),
  ];
  return { type, vibes, moments, drops, nieuw, verborgen, piercing, raw };
}

/** A complete, consistent Product (derived fields such as priceRange and totalQuantityAvailable are computed). */
export function makeProduct(spec: ProductSpec = {}): Product {
  const handle = spec.handle ?? "test-product";
  const type = spec.type === undefined ? "oorbellen" : spec.type;
  const variantSpecs = spec.variants ?? defaultVariants(type, spec.price);
  if (variantSpecs.length === 0) throw new Error(`makeProduct(${handle}): a product needs at least one variant`);

  const titles = variantSpecs.map((v) => v.title);
  const optionName = spec.optionName === undefined ? defaultOptionName(type, titles) : spec.optionName;
  const options: ProductOption[] = optionName ? [{ name: optionName, values: titles }] : [];

  const variants: Variant[] = variantSpecs.map((v, index) => {
    const quantityAvailable = v.quantityAvailable === undefined ? 10 : v.quantityAvailable;
    const selectedOptions: SelectedOption[] = optionName ? [{ name: optionName, value: v.title }] : [];
    return {
      id: v.id ?? localVariantId(handle, index + 1),
      title: v.title,
      sku: v.sku ?? null,
      availableForSale: v.availableForSale ?? (quantityAvailable === null || quantityAvailable > 0),
      quantityAvailable,
      price: money(v.price),
      compareAtPrice: v.compareAtPrice == null ? null : money(v.compareAtPrice),
      selectedOptions,
      swatch: swatchFor(v.title),
      image: v.image ?? null,
    };
  });

  const prices = variants.map((v) => v.price.cents);
  const quantities = variants.map((v) => v.quantityAvailable);
  const totalQuantityAvailable = quantities.some((q) => q === null)
    ? null
    : quantities.reduce<number>((sum, q) => sum + (q ?? 0), 0);

  return {
    id: spec.id ?? localProductId(handle),
    handle,
    title: spec.title ?? handle.replace(/-/g, " "),
    description: spec.description ?? "",
    type,
    tags: buildTags(spec, type),
    metafields: { ...EMPTY_METAFIELDS, ...spec.metafields },
    images: spec.images ?? [],
    variants,
    options,
    priceRange: { min: money(Math.min(...prices)), max: money(Math.max(...prices)) },
    availableForSale: variants.some((v) => v.availableForSale),
    totalQuantityAvailable,
    isGiftCard: spec.isGiftCard ?? type === "cadeaukaart",
    isGiftWrap: type === "cadeauverpakking",
    publishedAt: spec.publishedAt ?? (spec.nieuw ? PUBLISHED_AT_NIEUW : PUBLISHED_AT),
    featuredRank: spec.featuredRank ?? 1,
    seo: spec.seo ?? { title: null, description: null },
  };
}

/** The CatalogProduct view of a Product, as CatalogProvider and cards get it (badges are not derived). */
export function catalogFromProduct(product: Product, extra: { badges?: BadgeId[]; listable?: boolean } = {}): CatalogProduct {
  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    type: product.type,
    tags: product.tags,
    images: product.images,
    variants: product.variants,
    options: product.options,
    priceRange: product.priceRange,
    availableForSale: product.availableForSale,
    totalQuantityAvailable: product.totalQuantityAvailable,
    isGiftCard: product.isGiftCard,
    isGiftWrap: product.isGiftWrap,
    featuredRank: product.featuredRank,
    publishedAt: product.publishedAt,
    specRegel: product.metafields.specRegel,
    lindesFavoriet: product.metafields.lindesFavoriet,
    bestseller: product.metafields.bestseller,
    laagstePrijs30d: product.metafields.laagstePrijs30d,
    badges: extra.badges ?? [],
    listable: extra.listable ?? !(product.isGiftCard || product.isGiftWrap || product.tags.verborgen),
  };
}

/** makeProduct() plus catalogFromProduct(). */
export function makeCatalogProduct(spec: CatalogProductSpec = {}): CatalogProduct {
  const { badges, listable, ...productSpec } = spec;
  return catalogFromProduct(makeProduct(productSpec), { badges, listable });
}

/* -------------------------------------------------------------------------- */
/* Pieces of §8.4 (values from the product table in §5.4)                     */
/* -------------------------------------------------------------------------- */

/** Lola chunky hoops, earrings, €19,95, Goud and Zilver (25 / 12). */
export const lola = makeCatalogProduct({
  handle: "lola-chunky-hoops",
  title: "Lola chunky hoops",
  type: "oorbellen",
  vibes: ["chunky-en-bold", "retro"],
  moments: ["festival", "date-night"],
  nieuw: true,
  variants: [
    { title: "Goud", price: 1995, quantityAvailable: 25 },
    { title: "Zilver", price: 1995, quantityAvailable: 12 },
  ],
  metafields: { lindesFavoriet: true },
  featuredRank: 1,
});

/** Bo grote druppels, earrings, €22,95, stock 3 (low stock). */
export const bo = makeCatalogProduct({
  handle: "bo-statement-druppels",
  title: "Bo grote druppels",
  type: "oorbellen",
  vibes: ["chunky-en-bold"],
  moments: ["date-night", "feestdagen"],
  nieuw: true,
  variants: [{ title: "Goud", price: 2295, quantityAvailable: 3 }],
  featuredRank: 2,
});

/** Noor dikke ringetjes, earrings, €14,95, Goud and Zilver (30 / 30). */
export const noor = makeCatalogProduct({
  handle: "noor-dikke-ringetjes",
  title: "Noor dikke ringetjes",
  type: "oorbellen",
  vibes: ["chunky-en-bold"],
  moments: ["kantoor-maar-niet-saai"],
  nieuw: true,
  variants: [
    { title: "Goud", price: 1495, quantityAvailable: 30 },
    { title: "Zilver", price: 1495, quantityAvailable: 30 },
  ],
  featuredRank: 5,
});

/** Jet vonkoorbellen, earrings, €24,95. */
export const jet = makeCatalogProduct({
  handle: "jet-vonk-oorbellen",
  title: "Jet vonkoorbellen",
  type: "oorbellen",
  vibes: ["chunky-en-bold"],
  moments: ["feestdagen", "date-night"],
  nieuw: true,
  variants: [{ title: "Goud", price: 2495, quantityAvailable: 15 }],
  metafields: { lindesFavoriet: true },
  featuredRank: 6,
});

/** Sam schelpoorbellen, earrings, €15,95. */
export const sam = makeCatalogProduct({
  handle: "sam-schelp-oorbellen",
  title: "Sam schelpoorbellen",
  type: "oorbellen",
  vibes: ["kleurrijk-en-speels"],
  moments: ["strand", "festival"],
  variants: [{ title: "Goud", price: 1595, quantityAvailable: 22 }],
  featuredRank: 7,
});

/** Tess schakelarmband, bracelet, €19,95. */
export const tess = makeCatalogProduct({
  handle: "tess-schakelarmband",
  title: "Tess schakelarmband",
  type: "armbanden",
  vibes: ["chunky-en-bold"],
  moments: ["kantoor-maar-niet-saai", "date-night"],
  nieuw: true,
  variants: [{ title: "Goud", price: 1995, quantityAvailable: 25 }],
  metafields: { lindesFavoriet: true },
  featuredRank: 8,
});

/** Lieke kralenarmband, bracelet, €13,95. */
export const lieke = makeCatalogProduct({
  handle: "lieke-kralenarmband",
  title: "Lieke kralenarmband",
  type: "armbanden",
  vibes: ["kleurrijk-en-speels"],
  moments: ["strand", "festival"],
  variants: [{ title: "Goud", price: 1395, quantityAvailable: 40 }],
  featuredRank: 10,
});

/** Isa dubbele schakel, bracelet, €26,95, sold out. */
export const isa = makeCatalogProduct({
  handle: "isa-dubbele-schakel",
  title: "Isa dubbele schakel",
  type: "armbanden",
  vibes: ["chunky-en-bold"],
  moments: ["feestdagen"],
  variants: [{ title: "Goud", price: 2695, quantityAvailable: 0 }],
  featuredRank: 11,
});

/** Nina chunky ring, €19,95, sizes 16 to 19 (8 / 8 / 8 / 2). */
export const nina = makeCatalogProduct({
  handle: "nina-chunky-ring",
  title: "Nina chunky ring",
  type: "ringen",
  vibes: ["chunky-en-bold"],
  moments: ["festival", "date-night"],
  nieuw: true,
  variants: [
    { title: "16", price: 1995, quantityAvailable: 8 },
    { title: "17", price: 1995, quantityAvailable: 8 },
    { title: "18", price: 1995, quantityAvailable: 8 },
    { title: "19", price: 1995, quantityAvailable: 2 },
  ],
  metafields: { lindesFavoriet: true },
  featuredRank: 15,
});

/** Mae mini hoops, earrings, €12,95, Goud and Zilver (30 / 30). */
export const mae = makeCatalogProduct({
  handle: "mae-mini-hoops",
  title: "Mae mini hoops",
  type: "oorbellen",
  vibes: ["clean-en-classy"],
  moments: ["kantoor-maar-niet-saai"],
  variants: [
    { title: "Goud", price: 1295, quantityAvailable: 30 },
    { title: "Zilver", price: 1295, quantityAvailable: 30 },
  ],
  metafields: { lindesFavoriet: true },
  featuredRank: 17,
});

/** Jade stipjes, earrings, €12,95, one variant (quick add without a picker). */
export const jade = makeCatalogProduct({
  handle: "jade-stipjes",
  title: "Jade stipjes",
  type: "oorbellen",
  vibes: ["clean-en-classy"],
  moments: ["kantoor-maar-niet-saai", "strand"],
  variants: [{ title: "Goud", price: 1295, quantityAvailable: 35 }],
  featuredRank: 20,
});

/** Sterketting, necklace of the Holiday Sparkle drop, €29,95. Not stack-eligible. */
export const sterKetting = makeCatalogProduct({
  handle: "holiday-ster-ketting",
  title: "Sterketting",
  type: "kettingen",
  vibes: ["chunky-en-bold"],
  moments: ["feestdagen"],
  drops: ["holiday-sparkle"],
  variants: [{ title: "Goud", price: 2995, quantityAvailable: 15 }],
  featuredRank: 24,
});

/** Gift wrap: hidden product, €1,95, one "Standaard" variant, stock 999. Only ever added through giftWrap. */
export const cadeauverpakking = makeCatalogProduct({
  handle: "cadeauverpakking",
  title: "Cadeauverpakking",
  type: "cadeauverpakking",
  featuredRank: 25,
});

/** Gift card: €15, €25 and €50, untracked stock. Never counts for shipping, stack or WELKOM10. */
export const cadeaukaart = makeCatalogProduct({
  handle: "cadeaukaart",
  title: "Cadeaukaart",
  type: "cadeaukaart",
  featuredRank: 26,
});

/** Every fixed piece, by short name. */
export const pieces = {
  lola,
  bo,
  noor,
  jet,
  sam,
  tess,
  lieke,
  isa,
  nina,
  mae,
  jade,
  sterKetting,
  cadeauverpakking,
  cadeaukaart,
} as const;

/** The fixed pieces in featuredRank order. */
export const pieceList: CatalogProduct[] = Object.values(pieces).sort((a, b) => a.featuredRank - b.featuredRank);

/** A resolver as PriceCartInput.resolve expects: variant id → product and variant, or null when unknown. */
export function makeResolver(
  products: CatalogProduct[],
): (variantId: string) => { product: CatalogProduct; variant: Variant } | null {
  const index = new Map<string, { product: CatalogProduct; variant: Variant }>();
  for (const product of products) {
    for (const variant of product.variants) index.set(variant.id, { product, variant });
  }
  return (variantId) => index.get(variantId) ?? null;
}

/** Resolver over every fixed piece. */
export const resolvePiece = makeResolver(pieceList);

/** The variant of a product with this title ("Goud", "17", "€25"), or the first one. Throws when the title is unknown. */
export function variantOf(product: Pick<CatalogProduct, "handle" | "variants">, title?: string): Variant {
  const variant = title === undefined ? product.variants[0] : product.variants.find((v) => v.title === title);
  if (!variant) throw new Error(`Fixture ${product.handle} has no variant "${title ?? "(first)"}"`);
  return variant;
}

/** A cart input line for a piece: variantOf(product, title) with a quantity (default 1). */
export function lineOf(
  product: Pick<CatalogProduct, "handle" | "variants">,
  title?: string,
  quantity = 1,
): { variantId: string; quantity: number } {
  return { variantId: variantOf(product, title).id, quantity };
}
