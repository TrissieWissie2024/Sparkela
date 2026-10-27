import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";

import { clockLife, serverNow } from "@/lib/clock";
import { getDropPhase } from "@/lib/dates";
import { absoluteUrl, collectionPath, CONTENT_UPDATED, dropPath, NOINDEX_PATHS, productPath, STATIC_ROUTES } from "@/lib/seo";
import { getSitemapProducts } from "@/lib/shop-data";
import type { DropSlug } from "@/lib/types";
import { collections } from "@/content/collections";
import { drops } from "@/content/drops";

/**
 * /sitemap.xml (docs/PLAN.md §18.1, §2.4, brief §7), in this order: the indexable static pages (STATIC_ROUTES), every
 * collection in content/collections.ts, the drops whose public start has passed (phase "live" or "afgelopen"), and the
 * listable products at the server clock (getSitemapProducts). The same list as tests/fixtures/local-catalog.ts
 * localShopRoutes() (decision 140).
 *
 * Never in it: the noindex pages (/zoeken, /checkout, /account, /nieuwsbrief/bevestigen), /wachtlijst (canonical "/"),
 * a drop before its start (also not during early access), drop products before their drop starts, the gift wrap.
 * Those stay crawlable (robots.ts never disallows a noindex page, D53.4).
 *
 * lastModified is the fixed CONTENT_UPDATED: `new Date()` would make the route dynamic and claim a change on every
 * request (D53.4). No images, video or alternates (D54.3). Static: the time is only read inside 'use cache', so the
 * sitemap follows drop starts through clockLife, like the lists on the pages.
 */

/** The drops whose public start has passed at the server clock (plan §18.1). */
async function startedDrops(): Promise<DropSlug[]> {
  "use cache";
  const now = serverNow();
  cacheTag("klok");
  cacheLife(clockLife(now));
  return drops
    .filter((drop) => {
      const phase = getDropPhase(drop, now);
      return phase === "live" || phase === "afgelopen";
    })
    .map((drop) => drop.slug);
}

const NOINDEX: ReadonlySet<string> = new Set(NOINDEX_PATHS);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [dropSlugs, products] = await Promise.all([startedDrops(), getSitemapProducts()]);
  const paths = [
    ...STATIC_ROUTES,
    ...collections.map((collection) => collectionPath(collection.handle)),
    ...dropSlugs.map((slug) => dropPath(slug)),
    ...products.map((product) => productPath(product.handle)),
  ];
  return [...new Set(paths)]
    .filter((path) => !NOINDEX.has(path))
    .map((path) => ({ url: absoluteUrl(path), lastModified: CONTENT_UPDATED }));
}
