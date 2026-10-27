"use client";

import { Check, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { CatalogProduct, Variant } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatMoneyShort } from "@/lib/money";
import { collectionCopy } from "@/content/copy/collection";
import { Logo, logoLayout, type LogoVariant } from "@/components/brand/Logo";
import { useCartActions } from "@/components/cart/useCart";
import { Button } from "@/components/ui/Button";

/**
 * The amount tiles of /cadeaukaarten (docs/PLAN.md §13.12, §14.8; brief §4: digital gift cards of €15, €25 and €50).
 * Per variant of the gift card a tile: a card face with the wordmark and the amount (decorative, aria-hidden: the
 * tile's heading names it), "Digitaal, direct in je mail" and "In tas", which adds that variant
 * (addToCart([{ variantId, quantity: 1 }])), opens the drawer and says "Toegevoegd" for a moment. A variant that is
 * not for sale gets an aria-disabled "Uitverkocht" (it keeps focus). The faces use the brand surfaces with bot-wit on
 * top (olijf, roest, donker; brief §5), in the order of the variants. Gift cards never count for free shipping or the
 * stack discount (lib/pricing.ts, Shopify); that is the cart's business, not this component's.
 */

export interface GiftCardTilesProps {
  /** The gift card (handle "cadeaukaart") as lib/shop-data.ts delivers it. */
  product: CatalogProduct;
  /** Heading level of the tile names. Default 3. */
  headingLevel?: 2 | 3;
  className?: string;
}

/** How long a button says "Toegevoegd", in ms (a UI timer, not a time boundary). */
const ADDED_MS = 1800;

const FACES: Array<{ surface: string; logo: LogoVariant }> = [
  { surface: "bg-olijf", logo: "op-olijf" },
  { surface: "bg-roest", logo: "op-roest" },
  { surface: "bg-donker", logo: "op-donker" },
];

/** Width of the wordmark on a card face; its built-in clear space is pulled back so the letters align with the amount. */
const FACE_LOGO_WIDTH = 96;
const FACE_LOGO_INSET = logoLayout(FACE_LOGO_WIDTH).clearSpace;

export function GiftCardTiles({ product, headingLevel = 3, className }: GiftCardTilesProps) {
  const { addToCart } = useCartActions();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const Heading = `h${headingLevel}` as const;

  useEffect(() => () => clearTimeout(timer.current), []);

  const add = async (variant: Variant) => {
    if (addingId !== null || !variant.availableForSale) return;
    setAddingId(variant.id);
    try {
      const result = await addToCart([{ variantId: variant.id, quantity: 1 }], { open: true, source: "giftcard" });
      if (!result.ok) return;
      setAddedId(variant.id);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setAddedId(null), ADDED_MS);
    } finally {
      setAddingId(null);
    }
  };

  const copy = collectionCopy.giftCards;

  return (
    <ul role="list" className={cn("grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-6", className)}>
      {product.variants.map((variant, index) => {
        const amount = formatMoneyShort(variant.price);
        const face = FACES[index % FACES.length];
        const soldOut = !variant.availableForSale;
        const added = addedId === variant.id;
        return (
          <li key={variant.id} className="flex min-w-0 flex-col rounded-kaart border border-rand bg-kaart p-3 md:p-4">
            <div
              aria-hidden="true"
              className={cn(
                "relative flex aspect-[8/5] flex-col justify-between overflow-hidden rounded-[12px] p-4 text-bot-wit md:p-5",
                face?.surface,
              )}
            >
              <span className="block self-start" style={{ margin: -FACE_LOGO_INSET }}>
                <Logo variant={face?.logo} width={FACE_LOGO_WIDTH} />
              </span>
              <span className="font-display text-[2.5rem] leading-none font-extrabold tracking-[-0.02em] tabular md:text-[2.75rem]">
                {amount}
              </span>
            </div>
            <div className="flex flex-1 flex-col px-1 pt-4 pb-1">
              <Heading className="kop-4 text-tekst">{copy.tileTitle(amount)}</Heading>
              <p className="tekst-klein mt-1 text-tekst-2">{copy.tileText}</p>
              <div className="mt-auto pt-5">
                {soldOut ? (
                  <Button variant="outline" size="md" fullWidth aria-disabled aria-label={copy.soldOutLabel(amount)}>
                    {copy.soldOut}
                  </Button>
                ) : (
                  <Button
                    variant="primair"
                    size="md"
                    fullWidth
                    loading={addingId === variant.id}
                    loadingLabel={copy.adding}
                    aria-label={added ? copy.addedLabel(amount) : copy.addLabel(amount)}
                    iconStart={
                      added ? (
                        <Check aria-hidden="true" className="size-[18px]" strokeWidth={2} />
                      ) : (
                        <Plus aria-hidden="true" className="size-[18px]" strokeWidth={2} />
                      )
                    }
                    onClick={() => {
                      void add(variant);
                    }}
                  >
                    {added ? copy.added : copy.add}
                  </Button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
