import { Search } from "lucide-react";
import { useId } from "react";

import type { CatalogProduct } from "@/lib/types";
import { homeFavorites } from "@/lib/catalog";
import { getShopProducts } from "@/lib/shop-data";
import { sharedCopy } from "@/content/copy/shared";
import { Spark } from "@/components/brand/Spark";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * The one 404 view (docs/PLAN.md §13.13, §14.19, decisions 124 and 139): the content of app/not-found.tsx (inside
 * ShopChrome), of app/(shop)/not-found.tsx, and the fallback of the 404 pattern on the product, collection and drop
 * routes (`<Suspense fallback={<NotFoundView />}><Missing /></Suspense>`). Server only: it reads lib/shop-data.ts.
 *
 * NotFoundView is the thin async wrapper (Linde's favourites from the cached catalog); NotFoundContent is the
 * synchronous view that the tests render. Copy from sharedCopy.notFound: the page's only H1, a line, buttons to the
 * shop and the Spark Finder, a link to search, and up to four of Linde's favourites as cards. Always Linde's picks
 * under their own title, never as bestsellers (homeFavorites with realSalesData false). Pages render no <main>.
 */

/** How many favourites the 404 shows. */
export const NOT_FOUND_FAVORITES = 4;

/** Thin data wrapper: Linde's favourites from the cached catalog, then NotFoundContent. */
export async function NotFoundView() {
  const favorites = homeFavorites(await getShopProducts(), false).products.slice(0, NOT_FOUND_FAVORITES);
  return <NotFoundContent favorites={favorites} />;
}

export interface NotFoundContentProps {
  /** Linde's favourites, at most NOT_FOUND_FAVORITES; none hides the block. */
  favorites: readonly CatalogProduct[];
}

/** The 404 itself: synchronous, data as props (decision 139). */
export function NotFoundContent({ favorites }: NotFoundContentProps) {
  const copy = sharedCopy.notFound;
  const favoritesId = useId();

  return (
    <>
      <Container className="sectie-kort flex flex-col items-start">
        <Spark className="size-10 text-roest md:size-12" />
        <SectionHeading level={1} title={copy.title} intro={copy.text} className="mt-8 md:mt-10" />
        <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-4 md:mt-10">
          <Button href="/collections/alle" variant="primair">
            {copy.shop}
          </Button>
          <Button href="/spark-finder" variant="outline">
            {copy.finder}
          </Button>
          <Button
            href="/zoeken"
            variant="link"
            iconStart={<Search aria-hidden="true" className="size-5" strokeWidth={1.5} />}
            className="sm:ml-2"
          >
            {copy.search}
          </Button>
        </div>
      </Container>

      {favorites.length > 0 ? (
        <Container as="section" aria-labelledby={favoritesId}>
          {/* Two sections on the same surface: a hairline over the container width (plan §4.4). */}
          <div className="sectie-kort border-t border-rand">
            <SectionHeading id={favoritesId} level={2} title={copy.favoritesTitle} />
            <ProductGrid
              products={favorites}
              label={copy.favoritesTitle}
              headingLevel={3}
              columns={favorites.length === NOT_FOUND_FAVORITES ? "2-4" : "2-3-4"}
              className="mt-8 md:mt-10"
            />
          </div>
        </Container>
      ) : null}
    </>
  );
}
