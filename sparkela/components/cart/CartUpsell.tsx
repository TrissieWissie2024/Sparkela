"use client";

import Link from "next/link";
import { useRef } from "react";

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

import { ProductThumb } from "./ProductThumb";
import { useCart } from "./useCart";

/**
 * "Maak de look af" in the cart drawer (docs/PLAN.md §13.7, §14.4, decision 107; brief §6 cart drawer): up to three
 * products from the visible catalog (useCatalog().products) that are for sale and not in the cart yet, each with
 * QuickAdd. With two earrings or bracelets in the cart, first one more of those (the third piece unlocks the stack
 * discount); then pieces that share a vibe with the cart but are another type; then pieces with a shared vibe; then
 * Linde's favourites; then the rest by featuredRank. The picks are a vertical list of compact rows (photo, name,
 * price, QuickAdd), so every pick is in view without a sideways scroll a mouse wheel cannot reach (QA round 1,
 * decision 216b; the drawer body scrolls). The name is a stretched link over the whole row (a 44 px target and more);
 * QuickAdd sits above it, and its choice list opens in the flow on a row of its own.
 * After an add the row disappears (the piece is in the cart now): focus moves to the next row's button, or to the
 * list's heading, instead of falling back to the drawer.
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

/** QuickAdd in a row: right of the name; with its choice list open it takes a line of its own. */
const UPSELL_QUICK_ADD = cn(
  "ml-auto shrink-0",
  "has-[[role=dialog]]:flex has-[[role=dialog]]:basis-full has-[[role=dialog]]:flex-col has-[[role=dialog]]:items-end",
  "[&>[role=dialog]]:self-stretch",
);

function UpsellCard({ product, onAdded }: { product: CatalogProduct; onAdded: () => void }) {
  const multiplePrices = product.priceRange.min.cents !== product.priceRange.max.cents;
  return (
    <li>
      <article className="relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-kaart border border-rand bg-kaart p-3">
        <ProductThumb image={product.images[0] ?? null} title={product.title} sizes="56px" className="w-14 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h4 className="text-sm leading-snug font-semibold text-tekst">
            <Link
              href={productPath(product.handle)}
              className={cn(
                "decoration-1 underline-offset-4 hover:underline",
                // Stretched link: the whole row is the target; the ring goes around the row.
                "after:absolute after:inset-0 after:rounded-kaart after:content-['']",
                "focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2",
                "focus-visible:after:outline-solid focus-visible:after:[outline-color:var(--ring)]",
              )}
            >
              {product.title}
            </Link>
          </h4>
          <Price display={priceDisplay(defaultVariant(product), product.laagstePrijs30d)} size="sm" from={multiplePrices} className="mt-0.5" />
        </div>
        <QuickAdd product={product} size="sm" source="upsell" onAdded={onAdded} className={UPSELL_QUICK_ADD} />
      </article>
    </li>
  );
}

function UpsellRow({ max }: { max: number }) {
  const { products, byHandle } = useCatalog();
  const { cart } = useCart();
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const picks = pickUpsell(products, cart, byHandle, max);
  if (picks.length === 0) return null;
  const lines = cart?.lines ?? [];
  const giftCardsOnly = lines.length > 0 && lines.every((line) => line.merchandise.isGiftCard);
  const title = giftCardsOnly ? cartCopy.upsell.giftCardTitle : cartCopy.upsell.title;

  /** After an add the row unmounts with its focused button: put focus on the next row's button or the heading. */
  const keepFocus = () => {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      const lost = active === null || active === document.body || active.getAttribute("role") === "dialog" || !active.isConnected;
      if (!lost) return;
      const next = sectionRef.current?.querySelector<HTMLButtonElement>("li button");
      (next ?? headingRef.current)?.focus();
    });
  };

  return (
    <section ref={sectionRef} aria-label={title} className="border-t border-rand pt-6 pb-2">
      <h3 ref={headingRef} tabIndex={-1} className="label-caps text-tekst-2">
        {title}
      </h3>
      <ul role="list" aria-label={cartCopy.upsell.listLabel} className="mt-3 flex flex-col gap-2.5">
        {picks.map((product) => (
          <UpsellCard key={product.handle} product={product} onAdded={keepFocus} />
        ))}
      </ul>
    </section>
  );
}

export function CartUpsell({ max = UPSELL_MAX }: { max?: number }) {
  return <TimeGate at={site.launchAt} before={null} after={<UpsellRow max={max} />} />;
}
