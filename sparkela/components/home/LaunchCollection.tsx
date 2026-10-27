import { useId, type ReactNode } from "react";

import type { CatalogProduct } from "@/lib/types";
import { cn } from "@/lib/cn";
import { home } from "@/content/home";
import { StylingTile } from "@/components/collection/StylingTile";
import { ProductCard } from "@/components/product/ProductCard";
import { Container } from "@/components/ui/Container";

import { HomeProductTabs } from "./HomeProductTabs";
import { LAUNCH_CARD_SIZES, launchTabs, poolHandles } from "./launchTabs";

/**
 * "De lanceringscollectie" (docs/PLAN.md §13.10, §14.1 section 5; brief §6 block 5; CORVANE ProductGridSection): eyebrow,
 * H2 and intro with the sort select, tabs Alles / Oorbellen / Armbanden / Kettingen / Ringen with at most eight
 * products each (featuredRank), two columns on phones and four on desktop, and a button to the collection of the open
 * tab ("Bekijk alles" → /collections/alle).
 *
 * A server component: the cards of the first tab ("Alles", the one in the static HTML) are rendered here and handed
 * to the client island (HomeProductTabs) as nodes, with only the sort fields of the products. The other tabs render
 * their cards in the browser from the client catalog when they open (integrator 10, decision 212): Radix only mounts
 * the open panel, so their server-rendered cards were never in the HTML, yet they made up about 50 KB of the page's
 * RSC payload. The cards are 2 columns wide on phones and 4 on desktop, hence their own `sizes`
 * (LAUNCH_CARD_SIZES). Renders nothing without products.
 */

export interface LaunchCollectionProps {
  /** The listable products (getShopProducts()). */
  products: CatalogProduct[];
  className?: string;
}


export function LaunchCollection({ products, className }: LaunchCollectionProps) {
  const headingId = useId();
  const copy = home.productGrid;
  const tabs = launchTabs(products, copy);
  if (tabs.length === 0) return null;

  // The sort fields of every piece in any tab's pool: another sort picks the tab's eight from the whole pool.
  const shown = poolHandles(tabs)
    .map((handle) => products.find((product) => product.handle === handle))
    .filter((product): product is CatalogProduct => product !== undefined);

  // Server-rendered cards for the first tab only; the others come from the client catalog (see above).
  const firstTab = new Set(tabs[0].handles);
  const cards: Record<string, ReactNode> = {};
  for (const product of shown) {
    if (firstTab.has(product.handle))
      cards[product.handle] = <ProductCard product={product} headingLevel={3} sizes={LAUNCH_CARD_SIZES} />;
  }
  const sortFields = shown.map(({ handle, featuredRank, priceRange, publishedAt, availableForSale }) => ({
    handle,
    featuredRank,
    priceRange,
    publishedAt,
    availableForSale,
  }));

  return (
    <section aria-labelledby={headingId} className={cn("bg-pagina text-tekst", className)}>
      <Container className="sectie">
        <HomeProductTabs
          tabs={tabs}
          products={sortFields}
          cards={cards}
          heading={{
            id: headingId,
            eyebrow: copy.eyebrow,
            // "lanceringscollectie" is one long word: a step smaller below 380 px, so it never overflows at 320 px.
            title: <span className="max-[379px]:text-[1.375rem]">{copy.title}</span>,
            intro: copy.intro,
          }}
          tile={
            <StylingTile title={copy.tile.title} text={copy.tile.text} image={copy.tile.image} href={copy.tile.href} />
          }
          tileByTab={Object.fromEntries(
            Object.entries(copy.tileByTab).map(([id, t]) => [
              id,
              <StylingTile key={id} title={t.title} text={t.text} image={t.image} href={t.href} />,
            ]),
          )}
        />
      </Container>
    </section>
  );
}
