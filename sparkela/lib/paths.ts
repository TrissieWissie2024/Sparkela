/**
 * Site paths of products, collections and drops (docs/PLAN.md §18.1, decision 190). Client-safe: no env, no
 * next/* imports, so client components link with these instead of writing the path inline. lib/seo.ts re-exports them
 * for server code (it reads getEnv() on load, so client components cannot import it).
 */
export function productPath(handle: string): string {
  return `/products/${handle}`;
}

export function collectionPath(handle: string): string {
  return `/collections/${handle}`;
}

export function dropPath(slug: string): string {
  return `/drops/${slug}`;
}

/** The fragment that opens the ring size guide on a ring's product page (QA round 5: the size tiles link there). */
export const RING_GUIDE_HASH = "ringmaatgids";

/** A ring's product page with its size guide open: "/products/nina-chunky-ring#ringmaatgids". */
export function ringGuidePath(handle: string): string {
  return `${productPath(handle)}#${RING_GUIDE_HASH}`;
}

/** The account page: the proxy forwards it to Shopify's customer accounts once SHOPIFY_CUSTOMER_ACCOUNT_URL is set. */
export const ACCOUNT_PATH = "/account";

/**
 * Paths that leave the app, so a link to them is a plain <a> (a full page load) and never next/link (QA round 5).
 * next/link prefetches its target's RSC payload on every page view; /account answers with a cross-origin 307 to
 * Shopify, which the router follows into a CORS error and a console error, before any consent (brief §7, §2.10).
 */
export function needsFullPageLoad(href: string): boolean {
  return href === ACCOUNT_PATH;
}
