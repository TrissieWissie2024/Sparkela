import { parseTags } from "@/lib/catalog";
import { money } from "@/lib/money";
import type {
  ImageKind,
  LocalProductInput,
  Product,
  ProductImage,
  ProductMetafields,
  SelectedOption,
  SwatchId,
  Variant,
} from "@/lib/types";
import { products as localProducts } from "@/content/products";

/**
 * The local catalog as domain products (docs/PLAN.md §7.2, decisions 140 and 145). Pure and synchronous, without
 * server-only or next/* imports, so the local provider (lib/commerce/local.ts), Vitest and Playwright
 * (tests/fixtures/local-catalog.ts) build exactly the same products.
 *
 * Ids are fixed: product "local:<handle>", variant "local:<handle>:<n>" with n from 1 in the order of `variants`
 * (the same as tests/fixtures/catalog.ts and the cart line ids of lib/pricing.ts). featuredRank is the position in
 * content/products.ts (1 to 26). This is the only module besides tests that imports content/products.ts.
 */

/** Product id of the local provider. */
export function localProductId(handle: string): string {
  return `local:${handle}`;
}

/** Variant id of the local provider; n counts from 1 in the order of the variants. */
export function localVariantId(handle: string, n: number): string {
  return `local:${handle}:${n}`;
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

/** Kind of a photo by its position (plan §6.3, decision 60): 1 packshot, 2 draagfoto, 3 detail, 4 schaal, 5 stack. */
const IMAGE_KINDS: readonly ImageKind[] = ["packshot", "draagfoto", "detail", "schaal", "stack"];

function imageKindAt(index: number): ImageKind {
  return IMAGE_KINDS[index] ?? "overig";
}

/** "Goud" and "Zilver" option values pick the swatch (plan §6.3); any other value has none. */
function swatchOf(options: readonly SelectedOption[]): SwatchId | null {
  for (const option of options) {
    const value = option.value.trim().toLowerCase();
    if (value === "goud") return "goud";
    if (value === "zilver") return "zilver";
  }
  return null;
}

function toVariant(input: LocalProductInput, index: number): Variant {
  const spec = input.variants[index];
  const quantityAvailable = spec.quantityAvailable;
  return {
    id: localVariantId(input.handle, index + 1),
    title: spec.title,
    sku: spec.sku ?? null,
    availableForSale: quantityAvailable === null || quantityAvailable > 0,
    quantityAvailable,
    price: money(spec.price),
    compareAtPrice: spec.compareAtPrice == null ? null : money(spec.compareAtPrice),
    selectedOptions: spec.selectedOptions.map((option) => ({ ...option })),
    swatch: swatchOf(spec.selectedOptions),
    image: null,
  };
}

/** One content entry as a domain product; `rank` is its featuredRank. */
export function toLocalProduct(input: LocalProductInput, rank: number): Product {
  if (input.variants.length === 0) throw new Error(`content/products.ts: "${input.handle}" has no variants`);
  const tags = parseTags(input.tags);
  const variants = input.variants.map((_, index) => toVariant(input, index));
  const prices = variants.map((variant) => variant.price.cents);
  const quantities = variants.map((variant) => variant.quantityAvailable);
  const images: ProductImage[] = (input.images ?? []).map((image, index) => ({ ...image, kind: imageKindAt(index) }));

  return {
    id: localProductId(input.handle),
    handle: input.handle,
    title: input.title,
    description: input.description,
    type: tags.type,
    tags,
    metafields: { ...EMPTY_METAFIELDS, ...input.metafields },
    images,
    variants,
    options: input.options.map((option) => ({ name: option.name, values: [...option.values] })),
    priceRange: { min: money(Math.min(...prices)), max: money(Math.max(...prices)) },
    availableForSale: variants.some((variant) => variant.availableForSale),
    totalQuantityAvailable: quantities.some((quantity) => quantity === null)
      ? null
      : quantities.reduce<number>((sum, quantity) => sum + (quantity ?? 0), 0),
    isGiftCard: input.isGiftCard === true,
    isGiftWrap: tags.type === "cadeauverpakking",
    publishedAt: input.publishedAt,
    featuredRank: rank,
    seo: { title: null, description: null },
  };
}

/** The 26 products of content/products.ts (24 pieces, the gift wrap and the gift card), by featuredRank. New objects on every call. */
export function buildLocalProducts(): Product[] {
  return localProducts.map((input, index) => toLocalProduct(input, index + 1));
}
