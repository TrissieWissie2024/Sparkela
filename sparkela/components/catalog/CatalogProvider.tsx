"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { sortProducts } from "@/lib/catalog";
import type { CatalogProduct, Variant } from "@/lib/types";
import { giftCards, giftWrap } from "@/content/offers";

/**
 * Product data for client components (docs/PLAN.md §7.3, port of CORVANE components/catalog/CatalogProvider.tsx).
 * ShopChrome fills it once with `await getCatalogProducts()` (lib/shop-data.ts); client components read it with
 * useCatalog() and never import content/products.ts or lib/commerce.
 *
 * `products` holds the listable entries only, so no list ever shows the gift wrap, the gift card or a drop product
 * before its public start. The lookups cover every entry, including drop products in early access (listable: false):
 * the local cart, CartAnnouncer and analytics find their variants (decision 107).
 */

export interface CatalogValue {
  /** Entries with listable === true, sorted "uitgelicht". */
  products: CatalogProduct[];
  /** Over every entry (incl. listable: false). */
  byHandle(handle: string): CatalogProduct | null;
  /** Idem: also drop variants in early access. */
  byVariantId(variantId: string): { product: CatalogProduct; variant: Variant } | null;
  /** Handle "cadeauverpakking". */
  giftWrap: CatalogProduct | null;
  /** Handle "cadeaukaart". */
  giftCard: CatalogProduct | null;
  /**
   * What search looks through: `products` plus the gift card (QA round 2: "cadeaukaart" must find it), never the gift
   * wrap or a drop product before its public start.
   */
  searchable: CatalogProduct[];
}

/** The context value for a list of catalog entries (exported for tests and for providers outside React). */
export function createCatalogValue(entries: readonly CatalogProduct[]): CatalogValue {
  const handles = new Map<string, CatalogProduct>();
  const variants = new Map<string, { product: CatalogProduct; variant: Variant }>();
  for (const product of entries) {
    if (!handles.has(product.handle)) handles.set(product.handle, product);
    for (const variant of product.variants) {
      if (!variants.has(variant.id)) variants.set(variant.id, { product, variant });
    }
  }
  const byHandle = (handle: string) => handles.get(handle) ?? null;
  const products = sortProducts(
    entries.filter((product) => product.listable),
    "uitgelicht",
  );
  const giftCard = byHandle(giftCards.productHandle);
  return {
    products,
    byHandle,
    byVariantId: (variantId) => variants.get(variantId) ?? null,
    giftWrap: byHandle(giftWrap.productHandle),
    giftCard,
    searchable: giftCard && !giftCard.tags.verborgen ? [...products, giftCard] : products,
  };
}

const CatalogContext = createContext<CatalogValue | null>(null);

export function CatalogProvider({ products, children }: { products: CatalogProduct[]; children: ReactNode }) {
  const value = useMemo(() => createCatalogValue(products), [products]);
  return <CatalogContext value={value}>{children}</CatalogContext>;
}

/** The client catalog. Throws outside <CatalogProvider> (ShopChrome renders it around every shop page). */
export function useCatalog(): CatalogValue {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("useCatalog() must be used inside <CatalogProvider>.");
  return value;
}
