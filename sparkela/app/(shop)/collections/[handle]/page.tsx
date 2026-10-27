import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { breadcrumbJsonLd, collectionPath, NOT_FOUND_TITLE, pageMetadata } from "@/lib/seo";
import { getShopCollection } from "@/lib/shop-data";
import { collections } from "@/content/collections";
import { sharedCopy } from "@/content/copy/shared";
import { CollectionBanner } from "@/components/collection/CollectionBanner";
import { CollectionEmpty } from "@/components/collection/CollectionEmpty";
import { COLLECTION_QUERY_SCRIPT } from "@/components/collection/collectionQueryScript";
import { CollectionView, CollectionViewFallback, type CollectionViewProps } from "@/components/collection/CollectionView";
import { visibleFacets } from "@/components/collection/filterParams";
import { StylingTile } from "@/components/collection/StylingTile";
import { NotFoundView } from "@/components/pages/NotFoundView";
import { ProductCard } from "@/components/product/ProductCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Container } from "@/components/ui/Container";
import { InlineScript } from "@/components/ui/InlineScript";

/**
 * /collections/[handle] (docs/PLAN.md §14.3; brief §6 "Collectie", also `alle`): breadcrumbs, the banner (eyebrow,
 * H1, intro, optional photo), the filter bar with type, vibe, moment and price, the sort select (uitgelicht, prijs,
 * nieuwste), the live count, the grid of the same product cards as everywhere, an optional styling tile, and the
 * empty states.
 *
 * Static per handle (`○ /collections/<handle>` plus the `◐` shell): the handles come from content/collections.ts,
 * the products from the cached getShopCollection (lib/shop-data.ts), and server searchParams are never read. The
 * cards are rendered here once and handed to the client CollectionView, which reads the URL with useSearchParams
 * inside <Suspense>; its fallback is the whole unfiltered grid, so crawlers and visitors without JavaScript get every
 * card, and the inline script keeps that fallback invisible on a deep link with a query (CORVANE D47, D50.9).
 *
 * An unknown handle gets the 404 pattern: notFound() only inside <Suspense> with NotFoundView as the fallback, and
 * `ensureStatic` plus `instant`, so the very first request already answers 404 with the full layout (decision 133).
 * H1 and JSON-LD stay outside Suspense.
 */

export const ensureStatic = "navigation";
export const instant = false;

/** How many card photos are preloaded above the fold (plan §17.1: up to 4 in a collection). */
const PRELOADED_CARDS = 4;

export function generateStaticParams(): Array<{ handle: string }> {
  return collections.map((collection) => ({ handle: collection.handle }));
}

export async function generateMetadata({ params }: PageProps<"/collections/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const definition = collections.find((collection) => collection.handle === handle);
  if (!definition) return { title: NOT_FOUND_TITLE, robots: { index: false, follow: true } };
  return pageMetadata({
    title: definition.seo.title,
    description: definition.seo.description,
    path: collectionPath(definition.handle),
  });
}

export default async function CollectionPage({ params }: PageProps<"/collections/[handle]">) {
  const { handle } = await params;
  const collection = await getShopCollection(handle);
  if (!collection) {
    return (
      <Suspense fallback={<NotFoundView />}>
        <Missing />
      </Suspense>
    );
  }

  const { definition, products, facets } = collection;
  const path = collectionPath(definition.handle);
  const home = sharedCopy.ui.home;

  const cards: Record<string, ReactNode> = Object.fromEntries(
    products.map((product, index) => [
      product.handle,
      // The page's H1 is the grid's title, so the card names are h2s (as in CORVANE).
      <ProductCard key={product.handle} product={product} headingLevel={2} preload={index < PRELOADED_CARDS} />,
    ]),
  );

  const tile = definition.stylingTile;
  const data: CollectionViewProps = {
    handle: definition.handle,
    products,
    cards,
    facets: visibleFacets(facets, definition.rule),
    stylingTile: tile ? <StylingTile title={tile.title} text={tile.text} image={tile.image} href={tile.href} /> : null,
    stylingTileAfter: tile ? tile.afterIndex : null,
    label: definition.title,
  };

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: home, path: "/" },
          { name: definition.title, path },
        ])}
      />
      <Container className="pt-2 pb-16 md:pt-4 md:pb-24">
        <Breadcrumbs items={[{ label: home, href: "/" }, { label: definition.title }]} className="mb-3 md:mb-4" />
        <CollectionBanner definition={definition} />
        {products.length > 0 ? (
          // Before the first paint, a deep link with a filter or sort marks this wrapper: the fallback stays invisible.
          <div suppressHydrationWarning className="mt-8 md:mt-10">
            <InlineScript html={COLLECTION_QUERY_SCRIPT} />
            <Suspense fallback={<CollectionViewFallback {...data} />}>
              <CollectionView {...data} />
            </Suspense>
          </div>
        ) : (
          <CollectionEmpty variant={definition.rule.kind === "drop" ? "limited" : "default"} className="mt-8 md:mt-10" />
        )}
      </Container>
    </>
  );
}

/** Calls notFound() inside the Suspense boundary of the 404 pattern (plan §14.2, decision 133). */
async function Missing(): Promise<never> {
  notFound();
}
