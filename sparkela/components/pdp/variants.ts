import type { Product, Variant } from "@/lib/types";
import { defaultVariant, findVariant } from "@/lib/catalog";
import { site } from "@/content/site";

/**
 * Variant helpers of the product page (docs/PLAN.md §13.9). Pure and client-safe (no next/* imports), shared by
 * BuyBox, VariantPicker, ProductSpecs and the tests.
 */

/** How the variants are picked: colour swatches, ring sizes, gift card amounts, or plain tiles. */
export type VariantKind = "kleur" | "maat" | "bedrag" | "overig";

/**
 * The picker for a product: the gift card gets amount tiles, a product with a swatch ("Goud", "Zilver") gets colour
 * swatches, a ring gets size tiles with the size guide, anything else plain tiles with the variant title.
 */
export function variantKind(product: Pick<Product, "isGiftCard" | "type" | "variants">): VariantKind {
  if (product.isGiftCard) return "bedrag";
  if (product.variants.some((variant) => variant.swatch !== null)) return "kleur";
  if (product.type === "ringen") return "maat";
  return "overig";
}

/** The chosen variant: the stored id when the product has it, else defaultVariant() (the first one for sale). */
export function resolveVariant(product: Pick<Product, "variants">, variantId: string | undefined): Variant {
  return (variantId ? findVariant(product, variantId) : null) ?? defaultVariant(product);
}

/** "Nog 2": a real stock from 1 to site.lowStockThreshold (brief §2.7); null otherwise (also when not tracked). */
export function lowStockCount(
  variant: Pick<Variant, "availableForSale" | "quantityAvailable">,
  threshold: number = site.lowStockThreshold,
): number | null {
  const count = variant.quantityAvailable;
  if (!variant.availableForSale || count === null || count < 1 || count > threshold) return null;
  return count;
}

/** The article numbers of a product, in variant order and without duplicates ("SPK-001-GOUD, SPK-001-ZILVER"). */
export function productCodes(product: Pick<Product, "variants">): string[] {
  return [...new Set(product.variants.map((variant) => variant.sku).filter((sku): sku is string => !!sku))];
}

/** True when the product has more than one price (the gift card): the title block shows "Vanaf". */
export function hasSeveralPrices(product: Pick<Product, "variants">): boolean {
  return new Set(product.variants.map((variant) => variant.price.cents)).size > 1;
}

/** The cheapest variant (preferably one for sale), for "Vanaf €15". */
export function cheapestVariant(product: Pick<Product, "variants">): Variant {
  const lowest = Math.min(...product.variants.map((variant) => variant.price.cents));
  const cheapest = product.variants.filter((variant) => variant.price.cents === lowest);
  return cheapest.find((variant) => variant.availableForSale) ?? cheapest[0] ?? defaultVariant(product);
}
