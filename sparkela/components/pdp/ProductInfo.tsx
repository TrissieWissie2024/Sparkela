import type { BadgeId, Product } from "@/lib/types";
import { defaultVariant, isJewelryType, keepUnitsTogether } from "@/lib/catalog";
import { priceDisplay } from "@/lib/pricing";
import { drops } from "@/content/drops";
import { sharedCopy } from "@/content/copy/shared";
import { VatNotice } from "@/components/time/VatNotice";
import { Price } from "@/components/ui/Price";
import { StatusLabel } from "@/components/ui/StatusLabel";

import { DropStatusLabel } from "./DropStatusLabel";
import { ProductChips } from "./ProductChips";
import { cheapestVariant, hasSeveralPrices } from "./variants";

/**
 * The title block of the product page (docs/PLAN.md §13.9, §14.2 step 4; brief §6; port of CORVANE ProductInfo):
 * - A row with the type as eyebrow (label caps) and the labels: the StatusLabels from getProductBadges (24 px; "Nieuw",
 *   "Laatste stuks", "Op voorraad", never "Limited" or "Early access", decision 134) and, for a drop product,
 *   DropStatusLabel, the one place "Limited" or "Early access" shows on the page, exact to the second.
 * - The product name as the page's only H1 (kop-1), the spec line under it (value and unit kept together, decision
 *   201), the price (Price lg; "Vanaf €15" when the variants differ in price, the struck price only with the lowest
 *   price of 30 days, brief §2.5) with the VAT line by date under it (VatNotice; not for the gift card, a voucher), the
 *   short styling text, and the chips for type, vibe and moment. The buy box below shows the exact price of the choice.
 * Server component; DropStatusLabel and VatNotice are client islands.
 */

export interface ProductInfoProps {
  product: Product;
  /** From getProductBadges (lib/shop-data.ts): without "limited" and "early-access". */
  badges: BadgeId[];
  className?: string;
}

export function ProductInfo({ product, badges, className }: ProductInfoProps) {
  const from = hasSeveralPrices(product);
  const variant = from ? cheapestVariant(product) : defaultVariant(product);
  const display = priceDisplay(variant, product.metafields.laagstePrijs30d);
  const productDrops = drops.filter((drop) => product.tags.drops.includes(drop.slug));
  const type = product.type;
  const eyebrow = type && isJewelryType(type) ? sharedCopy.vocab.type[type] : null;
  // Defence in depth: the page labels never repeat what DropStatusLabel shows. A digital gift card is never
  // "Op voorraad" (it is not stock).
  const labels = badges.filter(
    (id) => id !== "limited" && id !== "early-access" && !(product.isGiftCard && id === "op-voorraad"),
  );
  const specLine = product.metafields.specRegel ? keepUnitsTogether(product.metafields.specRegel) : null;

  return (
    <div className={className}>
      {/* The row keeps its height with or without labels, so a label that appears by date shifts nothing. */}
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {eyebrow ? <p className="label-caps text-tekst-2">{eyebrow}</p> : <span aria-hidden="true" />}
        <p className="flex flex-wrap items-center gap-1.5">
          {productDrops.map((drop) => (
            <DropStatusLabel key={drop.slug} drop={drop} />
          ))}
          {labels.map((id) => (
            <StatusLabel key={id} id={id} size="pdp" />
          ))}
        </p>
      </div>

      <h1 className="kop-1 mt-3 text-tekst md:mt-4">{product.title}</h1>
      {specLine ? <p className="mt-3 text-tekst-2 md:text-[1.0625rem]">{specLine}</p> : null}

      <div className="mt-5 flex flex-col gap-1">
        <Price display={display} size="lg" from={from} />
        {/* A gift card is a voucher: VAT is due on what it buys, so the VAT line of goods does not fit its price. */}
        {product.isGiftCard ? null : <VatNotice />}
      </div>

      {product.description ? (
        <p className="mt-5 max-w-[34rem] leading-relaxed text-tekst-2">{product.description}</p>
      ) : null}

      <ProductChips product={product} className="mt-6" />
    </div>
  );
}
