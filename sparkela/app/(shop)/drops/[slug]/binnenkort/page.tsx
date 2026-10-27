import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { dropPath, NOT_FOUND_TITLE, pageMetadata } from "@/lib/seo";
import { collectionCopy } from "@/content/copy/collection";
import { drops, isDropSlug } from "@/content/drops";
import { DropTeaser } from "@/components/drops/DropTeaser";
import { NotFoundView } from "@/components/pages/NotFoundView";

/**
 * /drops/[slug]/binnenkort (docs/PLAN.md §2.2, §9.5, §14.6; decision 21): the teaser of a drop before access. Never
 * linked; the proxy rewrites /drops/<slug> and the drop's product pages to it while the visitor has no access yet.
 * DropTeaser: the teaser title as H1, the start, the real countdown and the Club sign-up. noindex, canonical
 * /drops/<slug>. Static per slug; an unknown slug gets the 404 pattern with `ensureStatic` and `instant`, so even the
 * first request is a 404 (decision 133).
 */

export const ensureStatic = "navigation";
export const instant = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return drops.map((drop) => ({ slug: drop.slug }));
}

export async function generateMetadata({ params }: PageProps<"/drops/[slug]/binnenkort">): Promise<Metadata> {
  const { slug } = await params;
  const drop = isDropSlug(slug) ? drops.find((candidate) => candidate.slug === slug) : undefined;
  if (!drop) return { title: NOT_FOUND_TITLE, robots: { index: false, follow: true } };
  const canonical = dropPath(drop.slug);
  return pageMetadata({
    title: drop.teaser.title,
    description: collectionCopy.teaser.metaDescription(drop.name),
    path: `${canonical}/binnenkort`,
    canonical,
    noindex: true,
  });
}

export default async function DropTeaserPage({ params }: PageProps<"/drops/[slug]/binnenkort">) {
  const { slug } = await params;
  const drop = isDropSlug(slug) ? drops.find((candidate) => candidate.slug === slug) : undefined;
  if (!drop) {
    return (
      <Suspense fallback={<NotFoundView />}>
        <Missing />
      </Suspense>
    );
  }
  return <DropTeaser drop={drop} />;
}

/** Calls notFound() inside the Suspense boundary of the 404 pattern (decision 133). */
async function Missing(): Promise<never> {
  notFound();
}
