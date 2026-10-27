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
