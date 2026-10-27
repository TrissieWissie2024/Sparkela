import { isMoment } from "@/lib/catalog";
import type { AssetKey, NavGroup } from "@/lib/types";

/**
 * Small helpers of the header and the menus (docs/PLAN.md §2.5, §13.5). Pure and client-safe.
 */

/** Tailwind `xl` (80rem): the desktop header with the full nav starts here; below it the mobile header (decision 40). */
export const XL_QUERY = "(min-width: 80rem)";

/**
 * True when `href` is the current page: an exact match that ignores a trailing slash and the query, so
 * aria-current="page" only ever marks the page itself. Port of CORVANE components/layout/header/nav.ts.
 */
export function isCurrentPage(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  const normalize = (path: string) => path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return normalize(pathname) === normalize(href);
}

/**
 * The small moment photo next to each moment link in the Shop-per-moment panel (plan §2.5): href → asset key
 * "momenten.<moment>" (content/assets.ts). Links that are not a moment collection get no photo.
 */
export function momentImages(group: NavGroup): Partial<Record<string, AssetKey>> {
  const images: Partial<Record<string, AssetKey>> = {};
  for (const link of group.links) {
    const match = /^\/collections\/([^/?#]+)$/.exec(link.href);
    if (match && isMoment(match[1])) images[link.href] = `momenten.${match[1]}`;
  }
  return images;
}
