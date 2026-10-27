import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";

import { OG_IMAGE_SIZE, OG_IMAGE_TYPE } from "@/lib/seo";
import { sharedCopy } from "@/content/copy/shared";
import { drops } from "@/content/drops";
import { site } from "@/content/site";
import { renderOgImage } from "@/components/seo/OgImage";

/**
 * /drops/<slug>/opengraph-image: the Open Graph image of a drop page (1200 × 630, docs/PLAN.md §17.3): "Limited", the
 * drop name and its tagline on --roest. No photo (decision 113) and no date, so it never goes stale.
 *
 * Outside the (shop) route group on purpose, like the product image: inside a group Next adds a hash suffix to the
 * URL, while the drop page names /drops/<slug>/opengraph-image in its metadata. Static for every drop in
 * content/drops.ts (only content, so cacheLife "max"); an unknown slug gives 404. Before a drop's early access the
 * proxy serves the brand image here instead (decision 201), so an upcoming drop never leaks through its preview.
 */

export const alt = site.name;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_TYPE;

export function generateStaticParams(): Array<{ slug: string }> {
  return drops.map((drop) => ({ slug: drop.slug }));
}

async function renderDropImage(slug: string): Promise<Uint8Array | null> {
  "use cache";
  cacheLife("max");
  const drop = drops.find((candidate) => candidate.slug === slug);
  if (!drop) return null;
  return renderOgImage({ kind: "drop", title: drop.name, eyebrow: sharedCopy.badges.limited, subtitle: drop.tagline });
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const png = await renderDropImage(slug);
  if (!png) notFound();
  return new Response(png as Uint8Array<ArrayBuffer>, { headers: { "Content-Type": contentType } });
}
