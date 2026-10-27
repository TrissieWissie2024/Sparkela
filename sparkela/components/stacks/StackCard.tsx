import Link from "next/link";

import type { CatalogProduct, Stack } from "@/lib/types";
import { defaultVariant } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { productPath } from "@/lib/paths";
import { priceDisplay, stackQuote } from "@/lib/pricing";
import { assets } from "@/content/assets";
import { collectionCopy } from "@/content/copy/collection";
import { sharedCopy } from "@/content/copy/shared";
import { ProductThumb } from "@/components/cart/ProductThumb";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { Price } from "@/components/ui/Price";

import { AddStackButton } from "./AddStackButton";

/**
 * One of Linde's stacks (docs/PLAN.md §13.12, §14.6, §14.7; brief §4 "Stacks"): photo 4:5, name, description, the
 * three pieces with their real price (Price, so a reduced price always comes with its lowest-30-days line, brief §2.5),
 * the stack price with the stack discount as plain text ("€50,88 in plaats van €59,85", stackQuote, never struck
 * through) and AddStackButton. The quote uses each piece's defaultVariant (the variant AddStackButton starts with).
 *
 * A white card with a thin border (as ProductCard) and a size container: from 40rem (a card that spans a whole row on a
 * tablet, or the single stack of a drop) the photo moves to the left and fills the height of the text beside it
 * (cropped from its 4:5), so a wide card never towers over the others. Gets `products` from getVisibleStacks() (or the drop's own products on
 * a drop page), in the order of the stack. Server component; the button is the only client island.
 */

export interface StackCardProps {
  stack: Stack;
  products: CatalogProduct[];
  /** Heading level of the stack name. Default 3 (under a section H2). */
  headingLevel?: 2 | 3;
  className?: string;
}

/** The quote of a stack at its default variants: subtotal, stack discount and total in cents (lib/pricing.ts). */
export function stackCardQuote(products: readonly CatalogProduct[]): ReturnType<typeof stackQuote> {
  return stackQuote(products.map((product) => ({ price: defaultVariant(product).price.cents, type: product.type })));
}

function isTriple(products: CatalogProduct[]): products is [CatalogProduct, CatalogProduct, CatalogProduct] {
  return products.length === 3;
}

export function StackCard({ stack, products, headingLevel = 3, className }: StackCardProps) {
  if (!isTriple(products)) return null;
  const Heading = `h${headingLevel}` as const;
  const quote = stackCardQuote(products);
  const image = assets.images[stack.image];
  const copy = collectionCopy.stacks;

  return (
    <article
      className={cn("@container flex h-full flex-col overflow-hidden rounded-kaart border border-rand bg-kaart text-tekst", className)}
    >
      <div className="flex h-full flex-col @min-[40rem]:grid @min-[40rem]:grid-cols-2 @min-[60rem]:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <div className="relative aspect-[4/5] w-full @min-[40rem]:aspect-auto @min-[40rem]:h-full @min-[40rem]:min-h-[24rem]">
          <PhotoSlot
            assetKey={stack.image}
            label={image?.label ?? stack.name}
            aspect="fill"
            sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
          />
        </div>
        <div className="flex flex-1 flex-col p-5 @min-[24rem]:p-6 @min-[40rem]:p-8 @min-[60rem]:p-10">
          <Heading className="kop-3 text-tekst">{stack.name}</Heading>
          <p className="mt-2 text-tekst-2">{stack.description}</p>

          <p className="label-caps mt-6 text-tekst-2">{copy.piecesLabel}</p>
          <ul role="list" className="mt-2 divide-y divide-rand border-y border-rand">
            {products.map((product) => {
              const variant = defaultVariant(product);
              return (
                <li key={product.handle} className="flex items-center gap-3 py-3">
                  <ProductThumb image={product.images[0] ?? null} title={product.title} sizes="48px" className="w-12" />
                  <Link
                    href={productPath(product.handle)}
                    className="min-w-0 flex-1 text-[0.9375rem] font-medium text-tekst decoration-1 underline-offset-4 hover:underline"
                  >
                    {product.title}
                  </Link>
                  <Price display={priceDisplay(variant, product.laagstePrijs30d)} size="sm" className="shrink-0 text-right" />
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex items-baseline justify-between gap-3">
            <span className="tekst-klein font-semibold text-tekst">{copy.totalLabel}</span>
            <span className="tabular text-xl font-semibold text-tekst">{formatMoney(quote.total)}</span>
          </div>
          {quote.discount > 0 ? (
            <p className="tabular tekst-klein mt-0.5 flex flex-col items-end text-right">
              <span className="text-tekst-2">{copy.insteadOf(formatMoney(quote.subtotal))}</span>
              <span className="font-medium text-succes">{sharedCopy.price.savings(formatMoney(quote.discount))}</span>
            </p>
          ) : null}

          <AddStackButton products={products} label={copy.add} stackName={stack.name} className="mt-auto pt-5" />
        </div>
      </div>
    </article>
  );
}
