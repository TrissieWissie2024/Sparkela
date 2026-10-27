import type { Metadata } from "next";

import { homeFavorites } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { getReviews } from "@/lib/reviews";
import { organizationJsonLd, pageMetadata, websiteJsonLd } from "@/lib/seo";
import { getFeaturedDrop, getShipSchedule, getShopProducts } from "@/lib/shop-data";
import { faq } from "@/content/faq";
import { home } from "@/content/home";
import { site } from "@/content/site";
import { DropBanner } from "@/components/drops/DropBanner";
import { SparkFinder } from "@/components/finder/SparkFinder";
import { AboutLindeTeaser } from "@/components/home/AboutLindeTeaser";
import { DeliveryBar } from "@/components/home/DeliveryBar";
import { FaqSection } from "@/components/home/FaqSection";
import { FavoritesCarousel } from "@/components/home/FavoritesCarousel";
import { GuaranteeBlock } from "@/components/home/GuaranteeBlock";
import { Hero } from "@/components/home/Hero";
import { LaunchCollection } from "@/components/home/LaunchCollection";
import { MomentTiles } from "@/components/home/MomentTiles";
import { PhotoStrip, photoStripVisible } from "@/components/home/PhotoStrip";
import { ReviewsCarousel } from "@/components/home/ReviewsCarousel";
import { StatementVsSubtle } from "@/components/home/StatementVsSubtle";
import { VideoRow, videoRowVisible } from "@/components/home/VideoRow";
import { HowToStack } from "@/components/sections/HowToStack";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container } from "@/components/ui/Container";

/**
 * The home (docs/PLAN.md §14.1; brief §6 blocks 3 to 15). The promo bar, header, footer, cart drawer and the "Kies je
 * spark" pill come from ShopChrome (app/(shop)/layout.tsx); pages never render their own <main>.
 *
 * Fully static (`○`): the data comes from the cached lib/shop-data.ts (getShopProducts, getFeaturedDrop,
 * getShipSchedule) and content/; everything that switches by time (shipping day, drop banner, countdown) is a
 * TimeSwitch or Countdown with an inline script, and only the sort and tabs, the carousels and the quiz are client
 * islands. Every section is synchronous and gets its data as props, so the order test renders `await HomePage()`.
 *
 * Order and surfaces (plan §14.1): 3 hero (donker, the H1) · 4 delivery bar (rand onder) · 5 De lanceringscollectie ·
 * 7 drop banner (roest, only while a drop is live) · 8 Zo stack je (hairline above, hidden right under the banner) ·
 * 9 favourites (vlak) · 10 Statement of subtiel? · 11 Shop per moment (hairline) · 12 Spark Finder (donker) · 13
 * reviews (none at launch) and the video row · 14 photo strip (hairline after another pagina section) · 15a guarantee
 * (olijf panel) · 15b FAQ · 15c Over Linde (hairline). Organization and WebSite JSON-LD (§14.1) outside any Suspense.
 */

export const metadata: Metadata = pageMetadata({
  title: { absolute: `${site.name} | ${home.meta.title}` },
  description: home.meta.description,
  path: "/",
});

/**
 * The hairline above "Zo stack je", hidden while the drop banner right above it shows (a hairline against a coloured
 * band is noise). The banner's TimeSwitch keeps its visible variant (the <section>) in an element without `hidden`, so
 * this selector follows it before the first paint and at every boundary, without JavaScript of its own: "a later
 * sibling of the drop wrapper whose banner shows" contains the section with the hairline.
 */
const STACK_HAIRLINE =
  "border-t border-rand [[data-home-drop]:has([data-ts]:not([hidden])>section)~*_&]:border-t-transparent";

export default async function HomePage() {
  const [products, featured, schedule] = await Promise.all([getShopProducts(), getFeaturedDrop(), getShipSchedule()]);
  const favorites = homeFavorites(products, site.flags.realSalesData);
  const reviews = getReviews();
  const reviewsShown = site.flags.showReviews && reviews.length > 0;
  const videosShown = videoRowVisible(home.videos);
  const stripShown = photoStripVisible(home.photoStrip, products);
  const homeFaq = faq.filter((item) => item.onHome);

  return (
    <>
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
      <Hero content={home.hero} />
      <DeliveryBar schedule={schedule} />
      <LaunchCollection products={products} />
      {featured ? (
        <div data-home-drop="">
          <DropBanner drop={featured.drop} />
        </div>
      ) : null}
      <Container>
        <HowToStack content={home.howToStack} className={cn("sectie", STACK_HAIRLINE)} />
      </Container>
      <FavoritesCarousel products={favorites.products} useSalesTitle={favorites.useSalesTitle} />
      <StatementVsSubtle content={home.statementVsSubtle} />
      <MomentTiles content={home.moments} divider />
      <SparkFinder variant="blok" />
      <ReviewsCarousel reviews={reviews} variant="home" />
      <VideoRow content={home.videos} divider={reviewsShown} />
      <PhotoStrip content={home.photoStrip} products={products} divider={reviewsShown || videosShown} />
      <GuaranteeBlock content={home.guarantee} flushTop={reviewsShown || videosShown || stripShown} />
      <FaqSection items={homeFaq} content={home.faq} />
      <AboutLindeTeaser content={home.aboutLinde} divider />
    </>
  );
}
