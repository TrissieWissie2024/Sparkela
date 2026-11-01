import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { homeFavorites } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { getShopProducts } from "@/lib/shop-data";
import { pagesCopy } from "@/content/copy/pages";
import { sharedCopy } from "@/content/copy/shared";
import { quiz } from "@/content/quiz";
import { SparkFinder } from "@/components/finder/SparkFinder";
import { IndexedPageHeader } from "@/components/pages/IndexedPageHeader";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * /spark-finder (docs/PLAN.md §14.5; brief §6 Spark Finder): PageHeader (H1 "Spark Finder", intro from quiz.intro),
 * SparkFinder variant="pagina" (the quiz on a white card with "Zo werkt het" beside it), then one line with a link to
 * /stacks, then Linde's favourites (QA round 6). Three questions, one per screen, then 3 to 6 products from the catalog's tags (client-side) and the optional
 * 10% email step. Fully keyboard operable. Static (○); the first question is in the HTML.
 */
const copy = pagesCopy.finder;

export const metadata: Metadata = pageMetadata({
  title: quiz.intro.title,
  description: copy.metaDescription,
  path: "/spark-finder",
});

/** How many favourites the page shows under the finder. */
const FAVORITES = 4;

export default async function SparkFinderPage() {
  const favorites = homeFavorites(await getShopProducts(), false).products.slice(0, FAVORITES);
  return (
    // data-eigen-club: the finder ends in its own 10% sign-up, so the footer leaves its Club block out and the email
    // pill stays away on the whole page, not only once the email step shows (QA round 6, brief §5 70/20/10).
    <div data-eigen-club="">
      <IndexedPageHeader
        eyebrow={copy.eyebrow}
        title={quiz.intro.title}
        intro={quiz.intro.text}
        breadcrumbs={[{ label: sharedCopy.ui.home, href: "/" }, { label: copy.breadcrumb }]}
        path="/spark-finder"
      />
      <SparkFinder variant="pagina" />
      <Container className="pb-16 md:pb-24">
        <div className="flex flex-col items-start gap-3 border-t border-rand pt-8 sm:flex-row sm:items-center sm:gap-5 md:pt-10">
          <p className="tekst-groot text-tekst">{copy.stacks.text}</p>
          <Button
            href={copy.stacks.link.href}
            variant="link"
            size="lg"
            iconEnd={<ArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
          >
            {copy.stacks.link.label}
          </Button>
        </div>
        {/* A light block before the footer (QA round 6: the page was more than half dark footer before the first
            answer). The same columns and whole rows as the favourites under a short collection. */}
        {favorites.length > 0 ? (
          <section aria-labelledby="finder-favorieten" className="mt-12 border-t border-rand pt-12 md:mt-16 md:pt-16">
            <SectionHeading id="finder-favorieten" level={2} title={copy.favorites.title} intro={copy.favorites.intro} />
            <ProductGrid products={favorites} label={copy.favorites.title} headingLevel={3} fullRows className="mt-8 md:mt-10" />
          </section>
        ) : null}
      </Container>
    </div>
  );
}
