import { cacheLife } from "next/cache";

import { BRAND_OG_ALT, OG_IMAGE_SIZE, OG_IMAGE_TYPE } from "@/lib/seo";
import { home } from "@/content/home";
import { site } from "@/content/site";
import { renderOgImage } from "@/components/seo/OgImage";

/**
 * /opengraph-image: the brand image (1200 × 630, docs/PLAN.md §17.3), the default for every page without an image of
 * its own (lib/seo.ts BRAND_OG_IMAGE_PATH). The hero line, the subline and two promises on --donker; no photo.
 * The proxy lets metadata images through during the prelaunch, and rewrites the image of a page the drop gate keeps
 * closed to this one (plan §11.1, decision 201), so it must never show anything that is not public yet.
 *
 * Static: with Cache Components a route handler is only prerendered when its response is complete within one task,
 * and reading the fonts and rendering the PNG take longer. The PNG is therefore made in a 'use cache' function, which
 * the build waits for, and the handler only wraps the cached bytes (CORVANE D53.2).
 */

export const alt = BRAND_OG_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_TYPE;

async function renderBrandImage(): Promise<Uint8Array> {
  "use cache";
  cacheLife("max");
  return renderOgImage({
    kind: "merk",
    title: home.hero.title,
    subtitle: home.hero.subtitle,
    notes: [site.guarantee.short, site.usps[0]],
  });
}

export default async function Image() {
  const png = await renderBrandImage();
  return new Response(png as Uint8Array<ArrayBuffer>, { headers: { "Content-Type": contentType } });
}
