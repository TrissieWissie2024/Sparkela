import { Search } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import type { CatalogProduct } from "@/lib/types";
import { homeFavorites } from "@/lib/catalog";
import { getShopProducts } from "@/lib/shop-data";
import { sharedCopy } from "@/content/copy/shared";
import { footerNav } from "@/content/navigation";
import { Spark } from "@/components/brand/Spark";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * The one 404 view (docs/PLAN.md §13.13, §14.19, decisions 124 and 139): the content of app/(shop)/not-found.tsx and
 * the fallback of the 404 pattern on the product, collection and drop routes; the root 404 (app/not-found.tsx) renders
 * NotFoundContent without favourites in the bare shape (QA round 6) (`<Suspense fallback={<NotFoundView />}><Missing /></Suspense>`). Server only: it reads lib/shop-data.ts.
 *
 * NotFoundView is the thin async wrapper (Linde's favourites from the cached catalog); NotFoundContent is the
 * synchronous view that the tests render. Copy from sharedCopy.notFound: the page's only H1, a line, buttons to the
 * shop and the Spark Finder, a link to search, and up to four of Linde's favourites as cards. Always Linde's picks
 * under their own title, never as bestsellers (homeFavorites with realSalesData false). Pages render no <main>.
 */

/** The footer's Shop column: the collections, the stacks and the gift cards. */
const shopLinks = footerNav[0]?.links ?? [];

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
  /**
   * The root 404 (app/not-found.tsx, QA round 6): the logo above already carries the brand, so no spark mark, and
   * without a header menu the shop's collections follow as pill links (the footer's Shop column).
   */
  bare?: boolean;
}

/** The 404 itself: synchronous, data as props (decision 139). */
export function NotFoundContent({ favorites, bare = false }: NotFoundContentProps) {
  const copy = sharedCopy.notFound;
  const favoritesId = useId();
  const browseId = useId();

  return (
    <>
      {/* A dead end, like the task pages: the footer shows only its compact rows (app/globals.css; QA round 6, brief §5
          70/20/10: the 404 was half dark footer). */}
      <div data-compacte-footer="" hidden />
      <Container className="sectie-kort flex flex-col items-start">
        {bare ? null : <Spark className="size-10 text-roest md:size-12" />}
        <SectionHeading level={1} title={copy.title} intro={copy.text} className={bare ? undefined : "mt-8 md:mt-10"} />
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

      {bare ? (
        <Container as="nav" aria-labelledby={browseId}>
          <div className="sectie-kort border-t border-rand">
            <h2 id={browseId} className="label-caps text-tekst-2">
              {copy.browseTitle}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {shopLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={buttonClasses({ variant: "outline", size: "sm" })}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      ) : null}

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
