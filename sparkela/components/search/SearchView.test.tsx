import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { collectionCopy } from "@/content/copy/collection";
import { CartProvider } from "@/components/cart/CartProvider";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { ClockProvider } from "@/components/time/ClockProvider";
import { localCatalogProducts } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import { SearchFallback, SearchView } from "./SearchView";

/**
 * The search page (docs/PLAN.md §13.12, §14.10, D3): `?q=` from useSearchParams (mocked), results as the shared
 * ProductGrid over the visible client catalog (never the gift card, gift wrap or a drop before its start), the
 * collections as a starting point when the field is empty or nothing matches, and the no-JS fallback form.
 */

const navigation = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

const catalog = localCatalogProducts(TEST_NOW);

function render(children: ReactNode, query = ""): string {
  navigation.query = query;
  return renderToStaticMarkup(
    <ClockProvider serverNow={TEST_NOW}>
      <CatalogProvider products={catalog}>
        <CartProvider provider="local">{children}</CartProvider>
      </CatalogProvider>
    </ClockProvider>,
  );
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

describe("SearchView", () => {
  it("shows the results of ?q= as product cards, with the count", () => {
    const html = render(<SearchView />, "q=lola");
    expect(html).toContain('value="lola"');
    expect(html).toContain(escape(collectionCopy.search.resultsTitle("lola")));
    expect(html).toContain('href="/products/lola-chunky-hoops"');
    expect(html).toContain(`aria-label="${collectionCopy.search.resultsLabel}"`);
    expect(html).toContain(collectionCopy.search.count(1));
    expect(html).toContain('role="search"');
  });

  it("finds by vibe and moment words too, but never the gift card or the gift wrap", () => {
    const html = render(<SearchView />, "q=feestdagen");
    expect(html).toContain('href="/products/jet-vonk-oorbellen"');
    expect(html).not.toContain('href="/products/cadeaukaart"');
    expect(html).not.toContain('href="/products/cadeauverpakking"');
  });

  it("offers the collections when the field is empty or nothing matches", () => {
    const empty = render(<SearchView />);
    expect(empty).toContain(collectionCopy.search.suggestionsTitle);
    expect(empty).toContain('href="/collections/oorbellen"');
    expect(empty).not.toContain('href="/collections/limited"');
    const none = render(<SearchView />, "q=xyzzy");
    expect(none).toContain(escape(collectionCopy.search.none("xyzzy")));
    expect(none).toContain('href="/collections/alle"');
  });

  it("has a fallback that works without JavaScript: a GET form to /zoeken", () => {
    const html = render(<SearchFallback />);
    expect(html).toContain('action="/zoeken"');
    expect(html).toContain('method="get"');
    expect(html).toContain('name="q"');
    expect(html).toContain("[[data-search-query]_&amp;]:invisible");
  });
});
