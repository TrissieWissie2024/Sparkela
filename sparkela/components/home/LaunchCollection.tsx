import { useId, type ReactNode } from "react";

import type { CatalogProduct } from "@/lib/types";
import { cn } from "@/lib/cn";
import { home } from "@/content/home";
import { StylingTile } from "@/components/collection/StylingTile";
import { ProductCard } from "@/components/product/ProductCard";
import { Container } from "@/components/ui/Container";

import { HomeProductTabs } from "./HomeProductTabs";
import { launchTabs, tabHandles } from "./launchTabs";

/**
 * "De lanceringscollectie" (docs/PLAN.md §13.10, §14.1 section 5; brief §6 block 5; CORVANE ProductGridSection): eyebrow,
 * H2 and intro with the sort select, tabs Alles / Oorbellen / Armbanden / Kettingen / Ringen with at most eight
 * products each (featuredRank), two columns on phones and four on desktop, and a button to the collection of the open
 * tab ("Bekijk alles" → /collections/alle).
 *
 * A server component: every card is rendered here once and handed to the client island (HomeProductTabs) as a node,
 * with only the sort fields of the products, so the card code and the full product data stay out of the payload.
 * The cards are 2 columns wide on phones and 4 on desktop, hence their own `sizes`. Renders nothing without products.
 */

export interface LaunchCollectionProps {
  /** The listable products (getShopProducts()). */
  products: CatalogProduct[];
  className?: string;
}

/** next/image sizes of a card in this grid: half the screen below lg, a quarter of the 1240 px frame from lg. */
const CARD_SIZES = "(min-width: 1280px) 290px, (min-width: 1024px) 25vw, 50vw";

export function LaunchCollection({ products, className }: LaunchCollectionProps) {
  const headingId = useId();
  const copy = home.productGrid;
  const tabs = launchTabs(products, copy);
  if (tabs.length === 0) return null;

  const handles = tabHandles(tabs);
  const shown = handles
    .map((handle) => products.find((product) => product.handle === handle))
    .filter((product): product is CatalogProduct => product !== undefined);

  const cards: Record<string, ReactNode> = {};
  for (const product of shown)
    cards[product.handle] = <ProductCard product={product} headingLevel={3} sizes={CARD_SIZES} />;
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
        />
      </Container>
    </section>
  );
}
