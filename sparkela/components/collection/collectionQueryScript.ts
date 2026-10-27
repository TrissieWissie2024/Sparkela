import { COLLECTION_QUERY_KEYS } from "./filterParams";

/**
 * Deep links with a query string (docs/PLAN.md §13.8 CollectionViewFallback, CORVANE D50.9). A page that renders a
 * client view with useSearchParams inside <Suspense> ships the unfiltered fallback in its static HTML. When the URL
 * has a filter, sort or search query, that fallback would paint first and then jump to the real state. This tiny
 * script, the first child of the wrapper around the boundary, runs while the HTML is parsed and marks the wrapper,
 * so CSS keeps the query-dependent part of the fallback invisible (its space stays: no layout shift) until the
 * client view replaces it and removes the mark (clearQueryMark).
 *
 * Generated code only, never user input: the attribute and the parameter names are constants.
 */

/** Marks the wrapper of the collection grid when the URL has ?type=, ?vibe=, ?moment=, ?prijs= or ?sort=. */
export const COLLECTION_QUERY_ATTRIBUTE = "data-collection-query";

/** Marks the wrapper of the search results when the URL has ?q=. */
export const SEARCH_QUERY_ATTRIBUTE = "data-search-query";

/**
 * Source of the inline script: sets `attribute` on the script's parent element when any of `keys` is in the URL
 * with a non-empty value. Wrapped in try/catch: a broken URL must never break the page.
 */
export function queryMarkScript(attribute: string, keys: readonly string[]): string {
  const names = JSON.stringify(keys);
  return `try{var q=new URLSearchParams(location.search),k=${names},w=document.currentScript&&document.currentScript.parentElement;if(w&&k.some(function(n){return(q.get(n)||"").trim()!==""}))w.setAttribute(${JSON.stringify(attribute)},"")}catch(e){}`;
}

export const COLLECTION_QUERY_SCRIPT = queryMarkScript(COLLECTION_QUERY_ATTRIBUTE, COLLECTION_QUERY_KEYS);

export const SEARCH_QUERY_SCRIPT = queryMarkScript(SEARCH_QUERY_ATTRIBUTE, ["q"]);

/** Removes the mark once the client view is on screen (call it in an effect). */
export function clearQueryMark(attribute: string): void {
  document.querySelectorAll(`[${attribute}]`).forEach((node) => node.removeAttribute(attribute));
}
