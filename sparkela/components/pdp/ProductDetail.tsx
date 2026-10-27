import type { ShipLabelEntry } from "@/lib/dates";
import type { BadgeId, CatalogProduct, FaqItem, Product, Stack, VerifiedClaim } from "@/lib/types";
import { defaultVariant, isStackEligible } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Container } from "@/components/ui/Container";

import { BuyBox } from "./BuyBox";
import { CompleteTheLook } from "./CompleteTheLook";
import { DeliveryEstimate } from "./DeliveryEstimate";
import { ProductAccordions } from "./ProductAccordions";
import { ProductFaq } from "./ProductFaq";
import { ProductGallery } from "./ProductGallery";
import { ProductInfo } from "./ProductInfo";
import { defaultStackName, productTrail } from "./productLinks";
import { ProductReviews } from "./ProductReviews";
import { ProductSpecs } from "./ProductSpecs";
import { StatementMeter } from "./StatementMeter";
import { TrustRow } from "./TrustRow";

/**
 * The product page below the chrome (docs/PLAN.md §13.9, §14.2; brief §6 "Productpagina"; decision 41: the order of
 * CORVANE, so the buy button stands high). Everything comes in as props from lib/shop-data.ts (the page fetches it);
 * this component fetches nothing and is synchronous, so the H1, the price and the buy box are in the static HTML
 * (never inside Suspense).
 *
 * 1. Breadcrumbs: Home › {collection of the type} › {product}.
 * 2. Grid: one column on phones (the gallery to the screen edges), two equal columns from md, 11fr / 9fr from lg with a
 *    gap of 56 px (80 from xl); from md both columns stick under the header, so the shorter one stays in view.
 * 3. Left: ProductGallery.
 * 4. Right: ProductInfo · BuyBox (variant → stack → gift wrap → button, with DeliveryEstimate and TrustRow under the
 *    button) · ProductSpecs · StatementMeter · ProductAccordions, each block under a hairline.
 * 5. Full width: CompleteTheLook (2 to 4 products), ProductReviews (nothing without real reviews), ProductFaq.
 * 6. StickyAddToCart below lg (inside BuyBox).
 *
 * The gift card (plan §14.2): amount tiles, no stack picker, no gift wrap, no delivery estimate but TrustRow
 * variant="giftcard" (secure payment and "Direct in je mail"), and the accordions Zo werkt het, Voorwaarden and
 * Productveiligheid.
 */

export interface ProductDetailProps {
  product: Product;
  /** getProductBadges(handle): without "limited" and "early-access" (DropStatusLabel shows those). */
  badges: BadgeId[];
  /** The visible stacks that hold this product (getVisibleStacks, filtered by the page). */
  stacks: Array<{ stack: Stack; products: CatalogProduct[] }>;
  stackOptions: { candidates: CatalogProduct[]; defaultPicks: [string, string] | null };
  lookProducts: CatalogProduct[];
  faq: FaqItem[];
  /** getVerifiedClaims(product) (lib/claims.ts): [] at launch. */
  claims: VerifiedClaim[];
  /** getShipSchedule() for the delivery estimate. */
  schedule: ShipLabelEntry[];
}

/** From md both columns stick under the header (plan §14.2 step 2); a column taller than the screen just scrolls. */
const STICKY = "md:sticky md:top-[calc(var(--header-hoogte)+24px)] md:self-start";

/** Hairline and rhythm between the blocks of the buy column. */
const BLOCK = "mt-10 border-t border-rand pt-8";

export function ProductDetail({ product, badges, stacks, stackOptions, lookProducts, faq, claims, schedule }: ProductDetailProps) {
  const giftCard = product.isGiftCard;
  const meter = product.metafields.statementMeter;
  const handle = product.handle;
  const stackName = defaultStackName(handle, stackOptions.defaultPicks, stackOptions.candidates, stacks);

  return (
    <>
      <Container className="pt-2 pb-12 md:pt-4 md:pb-16 lg:pb-20">
        <Breadcrumbs items={productTrail(product)} className="mb-2 md:mb-4" />

        <div className="grid grid-cols-1 gap-y-8 md:grid-cols-2 md:gap-x-8 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:gap-x-14 xl:gap-x-20">
          <div className={cn("-mx-5 md:mx-0", STICKY)}>
            <ProductGallery images={product.images} title={product.title} placeholderKinds={giftCard ? ["packshot"] : undefined} />
          </div>

          <div className={STICKY}>
            <ProductInfo product={product} badges={badges} />

            <BuyBox
              product={product}
              stackCandidates={stackOptions.candidates}
              defaultStack={stackOptions.defaultPicks}
              stackName={stackName}
              className="mt-8 border-t border-rand pt-8"
            >
              {giftCard ? null : <DeliveryEstimate schedule={schedule} />}
              <TrustRow variant={giftCard ? "giftcard" : "product"} className="pt-2" />
            </BuyBox>

            {giftCard ? null : (
              <ProductSpecs product={product} claims={claims} variantId={defaultVariant(product).id} className={BLOCK} />
            )}
            {meter ? <StatementMeter value={meter} className="mt-8 border-t border-rand pt-8" /> : null}
            <ProductAccordions product={product} className="mt-10" />
          </div>
        </div>
      </Container>

      <CompleteTheLook
        products={lookProducts}
        stackHint={isStackEligible(product.type)}
        variant={giftCard ? "giftcard" : "look"}
        headingId={`pdp-look-${handle}`}
      />
      <ProductReviews handle={handle} headingId={`pdp-reviews-${handle}`} />
      <ProductFaq items={faq} headingId={`pdp-faq-${handle}`} />
    </>
  );
}
