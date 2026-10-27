import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, useId } from "react";

import type { CatalogProduct, Drop } from "@/lib/types";
import { formatStartLabel } from "@/lib/dates";
import { dropPath, NOT_FOUND_TITLE, pageMetadata } from "@/lib/seo";
import { getDropData } from "@/lib/shop-data";
import { collectionCopy } from "@/content/copy/collection";
import { drops, isDropSlug } from "@/content/drops";
import { stacks } from "@/content/stacks";
import { DropClub } from "@/components/drops/DropClub";
import { DropHero } from "@/components/drops/DropHero";
import { EarlyAccessNote } from "@/components/drops/EarlyAccessNote";
import { NotFoundView } from "@/components/pages/NotFoundView";
import { ProductGrid } from "@/components/product/ProductGrid";
import { StackGrid } from "@/components/stacks/StackGrid";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * /drops/[slug] (docs/PLAN.md §9.5, §12, §14.6; brief §6 and §7 "Drops"). The page itself is static and open in every
 * phase; who sees it is the proxy's job: before early access everyone gets the teaser (/drops/[slug]/binnenkort),
 * during the 24 hours of early access only Club members with the signed link (or the preview), from the public start
 * everyone. What switches at the boundaries switches in the browser, exactly (TimeSwitch, decision 23):
 *
 * DropHero (the H1, the countdown to the start that jumps to "Nu live", the photo) · EarlyAccessNote (only during
 * early access) · "De drop": every product of the drop from getDropData (also before the public start, so early
 * access can buy; "Limited" on the cards once the drop is live) or "De stukken zie je hier vanaf …" · the drop's own
 * stack (content/stacks.ts with this dropSlug, built from the drop's products so it works in early access too) ·
 * DropClub (a Club line while it runs; "Deze drop is voorbij" with the Club sign-up from endsAt).
 *
 * An unknown slug gets the 404 pattern (isDropSlug narrows the param; decisions 103 and 133).
 */

export const ensureStatic = "navigation";
export const instant = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return drops.map((drop) => ({ slug: drop.slug }));
}

export async function generateMetadata({ params }: PageProps<"/drops/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const drop = isDropSlug(slug) ? drops.find((candidate) => candidate.slug === slug) : undefined;
  if (!drop) return { title: NOT_FOUND_TITLE, robots: { index: false, follow: true } };
  const path = dropPath(drop.slug);
  return pageMetadata({ title: drop.seo.title, description: drop.seo.description, path, image: `${path}/opengraph-image` });
}

export default async function DropPage({ params }: PageProps<"/drops/[slug]">) {
  const { slug } = await params;
  const data = isDropSlug(slug) ? await getDropData(slug) : null;
  if (!data) {
    return (
      <Suspense fallback={<NotFoundView />}>
        <Missing />
      </Suspense>
    );
  }
  return <DropContent drop={data.drop} products={data.products} />;
}

function DropContent({ drop, products }: { drop: Drop; products: CatalogProduct[] }) {
  const productsId = useId();
  const stackId = useId();
  const copy = collectionCopy.drop;

  // The drop's own stack, from the drop's products (in any phase), so "Voeg de stack toe" also works in early access.
  const stack = stacks.find((candidate) => candidate.dropSlug === drop.slug) ?? null;
  const stackProducts = stack
    ? stack.productHandles
        .map((handle) => products.find((product) => product.handle === handle))
        .filter((product): product is CatalogProduct => product !== undefined)
    : [];

  return (
    <>
      <DropHero drop={drop} productsHref={products.length > 0 ? `#${productsId}` : undefined} />
      <Container className="pb-16 md:pb-24">
        <EarlyAccessNote drop={drop} className="pt-8 md:pt-10" />

        <section aria-labelledby={productsId} className="pt-12 md:pt-16 lg:pt-20 [&_h2]:scroll-mt-[calc(var(--header-hoogte)+2rem)]">
          <SectionHeading id={productsId} level={2} title={copy.productsTitle} intro={drop.description} />
          {products.length > 0 ? (
            <ProductGrid
              products={products}
              label={copy.gridLabel(drop.name)}
              headingLevel={3}
              columns={products.length === 4 ? "2-4" : "2-3-4"}
              className="mt-8 md:mt-12"
            />
          ) : (
            <p className="mt-8 rounded-kaart bg-vlak px-6 py-8 text-tekst-2 md:mt-12 md:px-10">{copy.empty(formatStartLabel(drop.startsAt))}</p>
          )}
        </section>

        {stack && stackProducts.length === 3 ? (
          <section aria-labelledby={stackId} className="mt-16 border-t border-rand pt-16 md:mt-24 md:pt-24">
            <SectionHeading id={stackId} level={2} title={copy.stackTitle} intro={copy.stackIntro} />
            <StackGrid items={[{ stack, products: stackProducts }]} label={copy.stackTitle} className="mt-8 md:mt-12" />
          </section>
        ) : null}

        <DropClub drop={drop} className="mt-16 md:mt-24" />
      </Container>
    </>
  );
}

/** Calls notFound() inside the Suspense boundary of the 404 pattern (plan §14.6, decision 133). */
async function Missing(): Promise<never> {
  notFound();
}
