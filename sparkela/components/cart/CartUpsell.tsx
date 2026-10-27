"use client";

import Link from "next/link";

import type { Cart, CatalogProduct } from "@/lib/types";
import { defaultVariant, isStackEligible } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { priceDisplay } from "@/lib/pricing";
import { productPath } from "@/lib/paths";
import { cartCopy } from "@/content/copy/cart";
import { site } from "@/content/site";
import { useCatalog, type CatalogValue } from "@/components/catalog/CatalogProvider";
import { QuickAdd } from "@/components/product/QuickAdd";
import { TimeGate } from "@/components/time/TimeGate";
import { Price } from "@/components/ui/Price";
import { ScrollRow } from "@/components/ui/ScrollRow";

import { ProductThumb } from "./ProductThumb";
import { useCart } from "./useCart";

/**
 * "Maak de look af" in the cart drawer (docs/PLAN.md §13.7, §14.4, decision 107; brief §6 cart drawer): up to three
 * products from the visible catalog (useCatalog().products) that are for sale and not in the cart yet, each with
 * QuickAdd. With two earrings or bracelets in the cart, first one more of those (the third piece unlocks the stack
 * discount); then pieces that share a vibe with the cart but are another type; then pieces with a shared vibe; then
 * Linde's favourites; then the rest by featuredRank. One card spans the width; two or three scroll sideways in a
 * ScrollRow (CORVANE upsell row).
 *
 * Renders nothing before site.launchAt (TimeGate): during the prelaunch, early access on 26 November included, the
 * cart gate refuses ordinary products (§7.4).
 */

export const UPSELL_MAX = 3;

/** The picks for the upsell row, best first (pure; exported for tests). */
export function pickUpsell(
  products: readonly CatalogProduct[],
  cart: Pick<Cart, "lines" | "progress"> | null,
  byHandle: CatalogValue["byHandle"],
  max: number = UPSELL_MAX,
): CatalogProduct[] {
  if (!cart || cart.lines.length === 0 || max <= 0) return [];
  const inCart = new Set(cart.lines.map((line) => line.merchandise.productHandle));
  const cartProducts = cart.lines
    .map((line) => byHandle(line.merchandise.productHandle))
    .filter((product): product is CatalogProduct => product !== null);
  const vibes = new Set(cartProducts.flatMap((product) => product.tags.vibes));
  const types = new Set(cartProducts.map((product) => product.type));

  const pool = products
    .filter(
      (product) =>
        product.listable && product.availableForSale && !product.isGiftCard && !product.isGiftWrap && !inCart.has(product.handle),
    )
    .sort((a, b) => a.featuredRank - b.featuredRank);
  const sharesVibe = (product: CatalogProduct) => product.tags.vibes.some((vibe) => vibes.has(vibe));

  const picked: CatalogProduct[] = [];
  const take = (candidates: CatalogProduct[], limit = max) => {
    for (const candidate of candidates) {
      if (picked.length >= limit) return;
      if (!picked.includes(candidate)) picked.push(candidate);
    }
  };

  const { stack } = cart.progress;
  if (stack.applies && !stack.reached && stack.needed === 1) {
    const stackPieces = pool.filter((product) => isStackEligible(product.type));
    take([...stackPieces.filter(sharesVibe), ...stackPieces], 1);
  }
  take(pool.filter((product) => sharesVibe(product) && !types.has(product.type)));
  take(pool.filter(sharesVibe));
  take(pool.filter((product) => product.lindesFavoriet));
  take(pool);
  return picked.slice(0, max);
}

function UpsellCard({ product, wide }: { product: CatalogProduct; wide: boolean }) {
  const multiplePrices = product.priceRange.min.cents !== product.priceRange.max.cents;
  return (
    <li className={cn("flex shrink-0 snap-start", wide ? "w-full" : "w-[16.5rem]")}>
      <article className="relative flex w-full gap-3 rounded-kaart border border-rand bg-kaart p-3">
        <ProductThumb image={product.images[0] ?? null} title={product.title} sizes="64px" className="w-16 self-start" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h4 className="text-sm leading-snug font-semibold text-tekst">
            <Link href={productPath(product.handle)} className="decoration-1 underline-offset-4 hover:underline">
              {product.title}
            </Link>
          </h4>
          <Price display={priceDisplay(defaultVariant(product), product.laagstePrijs30d)} size="sm" from={multiplePrices} className="mt-1" />
          <div className="mt-auto pt-2">
            <QuickAdd product={product} size="sm" source="upsell" />
          </div>
        </div>
      </article>
    </li>
  );
}

function UpsellRow({ max }: { max: number }) {
  const { products, byHandle } = useCatalog();
  const { cart } = useCart();
  const picks = pickUpsell(products, cart, byHandle, max);
  if (picks.length === 0) return null;
  const wide = picks.length === 1;

  return (
    <section aria-label={cartCopy.upsell.title} className="border-t border-rand pt-6 pb-2">
      <h3 className="label-caps text-tekst-2">{cartCopy.upsell.title}</h3>
      <ScrollRow label={cartCopy.upsell.listLabel} controls="none" className="mt-3 gap-3" wrapperClassName="-mx-1 px-1">
        {picks.map((product) => (
          <UpsellCard key={product.handle} product={product} wide={wide} />
        ))}
      </ScrollRow>
    </section>
  );
}

export function CartUpsell({ max = UPSELL_MAX }: { max?: number }) {
  return <TimeGate at={site.launchAt} before={null} after={<UpsellRow max={max} />} />;
}
