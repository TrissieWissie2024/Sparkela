import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { useMemo, useState, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogProduct, ProductImage, SortKey } from "@/lib/types";
import { CARD_BADGE_ORDER } from "@/lib/types";
import { sortProducts } from "@/lib/catalog";
import { money } from "@/lib/money";
import { cartCopy } from "@/content/copy/cart";
import { cardCopy } from "@/content/copy/product-card";
import { sharedCopy } from "@/content/copy/shared";
import { CartProvider } from "@/components/cart/CartProvider";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { NOT_FOUND_FAVORITES, NotFoundContent, NotFoundView } from "@/components/pages/NotFoundView";
import { ClockProvider } from "@/components/time/ClockProvider";
import { bo, cadeaukaart, isa, jade, jet, lola, makeCatalogProduct, mae, nina, noor, pieceList, tess } from "@/tests/fixtures/catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import { cardPrice, PRODUCT_CARD_SIZES, ProductCard } from "./ProductCard";
import { ProductCardSkeleton } from "./ProductCardSkeleton";
import { ProductGrid } from "./ProductGrid";
import { SORT_OPTIONS, SortSelect } from "./SortSelect";

/**
 * The product card, grid, sort control, skeleton and the 404 view (docs/PLAN.md §13.8, §13.13, §19.1, C4). Static
 * markup only (renderToStaticMarkup) inside the real CatalogProvider and CartProvider (QuickAdd needs them):
 * one badge in CARD_BADGE_ORDER, sold out, several variants, the gift card, "Vanaf" with several prices, a struck
 * price always with the lowest-price line, the name before the media in the DOM, the shared components inside a
 * client wrapper with hooks, the 404 with four favourites (also through the async wrapper with a mocked
 * lib/shop-data), and a static check of the import tree of ProductCard.tsx and ProductGrid.tsx.
 */

// next/image is replaced by a plain <img> that prints the props it got (the loader has its own test).
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; sizes?: string; preload?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} data-sizes={props.sizes} data-preload={String(Boolean(props.preload))} />
  ),
}));

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const shopData = vi.hoisted(() => ({ products: [] as CatalogProduct[] }));
vi.mock("@/lib/shop-data", () => ({
  getShopProducts: vi.fn(async () => shopData.products),
}));

const appRoot = fileURLToPath(new URL("../../", import.meta.url));

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

function render(children: ReactNode, products: CatalogProduct[] = pieceList): string {
  return renderToStaticMarkup(
    <ClockProvider serverNow={TEST_NOW}>
      <CatalogProvider products={products}>
        <CartProvider provider="local">{children}</CartProvider>
      </CatalogProvider>
    </ClockProvider>,
  );
}

/** `text` as a literal inside a RegExp. */
function re(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

/** The text of every StatusLabel (label-caps pill) in the markup. */
function statusLabels(html: string): string[] {
  return [...html.matchAll(/<span class="label-caps inline-flex[^"]*">([^<]*)<\/span>/g)].map((match) => match[1] ?? "");
}

function photo(url: string, kind: ProductImage["kind"], alt = ""): ProductImage {
  return { url, alt, width: 1600, height: 2000, kind };
}

/* -------------------------------------------------------------------------- */
/* ProductCard                                                                 */
/* -------------------------------------------------------------------------- */

describe("ProductCard: badge", () => {
  it("shows exactly one badge, the first of CARD_BADGE_ORDER", () => {
    const product: CatalogProduct = { ...bo, badges: ["nieuw", "limited", "laatste-stuks"] };
    const html = render(<ProductCard product={product} />);
    expect(statusLabels(html)).toEqual([sharedCopy.badges["laatste-stuks"]]);
    expect(html).not.toContain(`>${sharedCopy.badges.nieuw}<`);
    expect(html).not.toContain(`>${sharedCopy.badges.limited}<`);
  });

  it("follows CARD_BADGE_ORDER for every pair of badges", () => {
    for (const [index, first] of CARD_BADGE_ORDER.entries()) {
      for (const later of CARD_BADGE_ORDER.slice(index + 1)) {
        const html = render(<ProductCard product={{ ...jade, badges: [later, first] }} />);
        expect(statusLabels(html), `${first} before ${later}`).toEqual([sharedCopy.badges[first]]);
      }
    }
  });

  it("shows no badge without badges, and never a status the card does not carry (early access, op voorraad)", () => {
    expect(statusLabels(render(<ProductCard product={{ ...jade, badges: [] }} />))).toEqual([]);
    expect(statusLabels(render(<ProductCard product={{ ...jade, badges: ["early-access", "op-voorraad"] }} />))).toEqual([]);
  });

  it("never labels Linde's favourites or invents social proof", () => {
    const html = render(<ProductCard product={{ ...lola, badges: [] }} />);
    expect(lola.lindesFavoriet).toBe(true);
    expect(html.toLowerCase()).not.toContain("favoriet");
    expect(html).not.toContain(sharedCopy.badges.bestseller);
    expect(html).not.toContain('role="img" aria-label="Gemiddeld');
  });
});

describe("ProductCard: availability and variants", () => {
  it("sold out: the Uitverkocht label and an aria-disabled quick add that keeps focus", () => {
    const html = render(<ProductCard product={{ ...isa, badges: ["uitverkocht", "nieuw"] }} />);
    expect(statusLabels(html)).toEqual([sharedCopy.badges.uitverkocht]);
    expect(html).toContain(`aria-label="${escape(cartCopy.quickAdd.soldOutLabel(isa.title))}"`);
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/<button[^>]* disabled=""/);
  });

  it("one variant: 'In tas' adds directly", () => {
    const html = render(<ProductCard product={jade} />);
    expect(html).toContain(`aria-label="${escape(cartCopy.quickAdd.addLabel(jade.title))}"`);
    expect(html).not.toContain("aria-expanded");
  });

  it("several variants: 'Kies' with a closed choice list", () => {
    const html = render(<ProductCard product={noor} />);
    expect(html).toContain(`aria-label="${escape(cartCopy.quickAdd.chooseLabel(noor.title))}"`);
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="dialog"');
  });

  it("the gift card: 'Vanaf €15' and the link 'Kies bedrag' to its product page", () => {
    const html = render(<ProductCard product={cadeaukaart} />);
    expect(html).toContain(sharedCopy.price.from("€15"));
    expect(html).toContain(escape(cartCopy.quickAdd.chooseAmount));
    expect(count(html, `href="/products/${cadeaukaart.handle}"`)).toBe(2);
  });
});

describe("ProductCard: price", () => {
  it("one price: the price itself, no 'Vanaf'", () => {
    const html = render(<ProductCard product={jade} />);
    expect(html).toContain("€12,95");
    expect(html).not.toContain(sharedCopy.price.from("€12,95"));
  });

  it("several prices: 'Vanaf' with the cheapest variant, also when the first variant is dearer", () => {
    const product = makeCatalogProduct({
      handle: "test-twee-prijzen",
      title: "Test twee prijzen",
      variants: [
        { title: "Goud", price: 2495 },
        { title: "Zilver", price: 1995 },
      ],
    });
    const { display, from } = cardPrice(product);
    expect(from).toBe(true);
    expect(display.price.cents).toBe(1995);
    expect(render(<ProductCard product={product} />)).toContain(sharedCopy.price.from("€19,95"));
  });

  it("several prices with a sold-out cheapest variant still start at the lowest price", () => {
    const product = makeCatalogProduct({
      handle: "test-uitverkochte-goedkoopste",
      variants: [
        { title: "16", price: 1795, quantityAvailable: 0 },
        { title: "17", price: 1995 },
      ],
      type: "ringen",
    });
    expect(cardPrice(product).display.price.cents).toBe(1795);
  });

  it("a previous price is struck through only with the lowest price of the 30 days before, and then always with it", () => {
    const withLowest = makeCatalogProduct({
      handle: "test-sale",
      title: "Test sale",
      variants: [{ title: "Goud", price: 1995, compareAtPrice: 2495 }],
      metafields: { laagstePrijs30d: money(1995) },
      badges: ["sale"],
    });
    const html = render(<ProductCard product={withLowest} />);
    expect(html).toContain("<s ");
    expect(html).toContain("€24,95");
    expect(html).toContain(sharedCopy.price.lowest30d("€19,95"));
    expect(statusLabels(html)).toEqual([sharedCopy.badges.sale]);

    const fromPrice = makeCatalogProduct({
      handle: "test-sale-vanaf",
      variants: [
        { title: "Goud", price: 1995, compareAtPrice: 2495 },
        { title: "Zilver", price: 2195, compareAtPrice: 2495 },
      ],
      metafields: { laagstePrijs30d: money(1995) },
    });
    const fromHtml = render(<ProductCard product={fromPrice} />);
    expect(fromHtml).toContain("<s ");
    expect(fromHtml).toContain(sharedCopy.price.from("€19,95"));
    expect(fromHtml).toContain(sharedCopy.price.lowest30d("€19,95"));
  });

  it("no lowest price of 30 days: never a struck-through price (fail closed)", () => {
    const withoutLowest = makeCatalogProduct({
      handle: "test-geen-laagste",
      variants: [{ title: "Goud", price: 1995, compareAtPrice: 2495 }],
    });
    const html = render(<ProductCard product={withoutLowest} />);
    expect(html).not.toMatch(/<s[ >]/);
    expect(html).not.toContain("€24,95");
    expect(html).not.toContain(sharedCopy.price.lowest30d("€19,95"));
  });
});

describe("ProductCard: content and structure", () => {
  const product = makeCatalogProduct({
    handle: "test-foto",
    title: "Test foto",
    vibes: ["kleurrijk-en-speels", "retro"],
    variants: [{ title: "Goud", price: 1495 }],
    images: [photo("https://cdn.shopify.com/s/files/1/test-foto-1.jpg", "packshot", "Packshot"), photo("https://cdn.shopify.com/s/files/1/test-foto-2.jpg", "draagfoto")],
    metafields: { specRegel: "Verguld staal · 20 mm" },
  });

  it("puts the name first in the DOM, as a stretched link to the product page", () => {
    const html = render(<ProductCard product={product} />);
    const heading = html.indexOf("<h3");
    const media = html.indexOf("<img");
    expect(heading).toBeGreaterThan(-1);
    expect(heading).toBeLessThan(media);
    expect(html).toMatch(/<h3 class="kop-4 order-2[^"]*"><a [^>]*href="\/products\/test-foto"[^>]*>Test foto<\/a><\/h3>/);
    expect(html).toContain("after:absolute after:inset-0");
  });

  it("also puts the name before a placeholder photo", () => {
    const html = render(<ProductCard product={jade} />);
    expect(html.indexOf("<h3")).toBeGreaterThan(-1);
    expect(html.indexOf('role="img"')).toBeGreaterThan(html.indexOf("<h3"));
  });

  it("honours headingLevel", () => {
    const html = render(<ProductCard product={jade} headingLevel={2} />);
    expect(html).toContain("<h2");
    expect(html).not.toContain("<h3");
  });

  it("a white card with a thin border and a 4:5 photo", () => {
    const html = render(<ProductCard product={product} />);
    expect(html).toMatch(/<article class="[^"]*rounded-kaart border border-rand bg-kaart/);
    expect(html).toContain("aspect-[4/5]");
  });

  it("shows the spec line, and nothing without the metafield", () => {
    const html = render(<ProductCard product={product} />);
    // Screen readers get the line as written; the visual parts carry the separator in a ::before (QA round 1).
    expect(html).toContain('<span class="sr-only">Verguld staal · 20 mm</span>');
    expect(html).toMatch(/before:content-\[&#x27;·&#x27;\][^>]*>Verguld staal<\/span>/);
    expect(html).toMatch(/before:content-\[&#x27;·&#x27;\][^>]*>20 mm<\/span>/);
    expect(render(<ProductCard product={jade} />)).not.toContain("tekst-klein mt-1");
  });

  it("shows the first vibe as a chip, with its label from sharedCopy.vocab.vibe", () => {
    const html = render(<ProductCard product={product} />);
    expect(html).toContain(`>${sharedCopy.vocab.vibe["kleurrijk-en-speels"]}</span>`);
    expect(html).toContain(cardCopy.card.vibe(sharedCopy.vocab.vibe["kleurrijk-en-speels"]));
    expect(html).not.toContain(sharedCopy.vocab.vibe.retro);
    expect(render(<ProductCard product={cadeaukaart} />)).not.toContain(cardCopy.card.vibe(""));
  });

  it("crossfades to the second photo only from lg, hidden from screen readers; the first photo with sizes and preload", () => {
    const html = render(<ProductCard product={product} preload />);
    expect(html).toContain('src="https://cdn.shopify.com/s/files/1/test-foto-1.jpg" alt="Packshot"');
    expect(html).toMatch(
      /<div aria-hidden="true" class="absolute inset-0 hidden opacity-0 lg:block lg:group-hover\/kaart:opacity-100[^"]*">.*?test-foto-2\.jpg/,
    );
    expect(html).toContain(`data-sizes="${PRODUCT_CARD_SIZES}" data-preload="true"`);
    // Only the first photo is preloaded.
    expect(count(html, 'data-preload="true"')).toBe(1);
    const single = render(<ProductCard product={{ ...product, images: product.images.slice(0, 1) }} />);
    expect(single).not.toContain("lg:block");
  });

  it("is a synchronous function", () => {
    expect(ProductCard.constructor.name).toBe("Function");
    expect(ProductGrid.constructor.name).toBe("Function");
  });
});

/* -------------------------------------------------------------------------- */
/* ProductGrid, SortSelect, skeleton                                           */
/* -------------------------------------------------------------------------- */

describe("ProductGrid", () => {
  const withPhotos = [lola, noor, jet, tess, nina].map((product, index) => ({
    ...product,
    images: [photo(`https://cdn.shopify.com/s/files/1/${product.handle}.jpg`, "packshot")],
    featuredRank: index + 1,
  }));

  it("renders a named list with one card per product, in the given order", () => {
    const html = render(<ProductGrid products={withPhotos} label={cardCopy.grid.label} />);
    expect(html).toMatch(new RegExp(`<ul role="list" aria-label="${re(cardCopy.grid.label)}" class="grid grid-cols-2`));
    expect(html.match(/<li[ >]/g)).toHaveLength(5);
    expect(count(html, "<article")).toBe(5);
    const positions = withPhotos.map((product) => html.indexOf(`href="/products/${product.handle}"`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("preloads only the first priorityCount photos", () => {
    const html = render(<ProductGrid products={withPhotos} label={cardCopy.grid.label} priorityCount={2} />);
    expect(count(html, 'data-preload="true"')).toBe(2);
    expect(count(html, 'data-preload="false"')).toBe(3);
  });

  it("2 / 3 / 4 columns by default, 2 / 4 for a list of four", () => {
    const standard = render(<ProductGrid products={withPhotos} label="x" />);
    expect(standard).toContain("md:grid-cols-3");
    expect(standard).toContain("xl:grid-cols-4");
    const four = render(<ProductGrid products={withPhotos.slice(0, 4)} label="x" columns="2-4" />);
    expect(four).toContain("md:grid-cols-4");
    expect(four).not.toContain("md:grid-cols-3");
  });

  it("passes headingLevel to the cards", () => {
    const html = render(<ProductGrid products={withPhotos.slice(0, 2)} label="x" headingLevel={2} />);
    expect(count(html, "<h2")).toBe(2);
  });

  it("says cardCopy.grid.empty without products", () => {
    const html = render(<ProductGrid products={[]} label="x" />);
    expect(html).toContain(cardCopy.grid.empty);
    expect(html).not.toContain("<ul");
  });
});

describe("SortSelect", () => {
  it("offers the four sort keys with the labels of sharedCopy.vocab.sort", () => {
    expect(SORT_OPTIONS.map((option) => option.label)).toEqual([
      sharedCopy.vocab.sort.uitgelicht,
      sharedCopy.vocab.sort["prijs-oplopend"],
      sharedCopy.vocab.sort["prijs-aflopend"],
      sharedCopy.vocab.sort.nieuwste,
    ]);
    const html = renderToStaticMarkup(<SortSelect value="nieuwste" onChange={() => {}} id="sorteren" />);
    expect(html).toContain(`<label for="sorteren"`);
    expect(html).toContain(`>${cardCopy.sort.label}</label>`);
    expect(html).toContain('<option value="nieuwste" selected="">');
    expect(count(html, "<option")).toBe(4);
  });

  it("takes another label, also for screen readers only", () => {
    const html = renderToStaticMarkup(<SortSelect value="uitgelicht" onChange={() => {}} label="Sorteer de collectie" hideLabel />);
    expect(html).toContain('class="sr-only"');
    expect(html).toContain("Sorteer de collectie");
  });
});

describe("ProductCardSkeleton", () => {
  it("has the card frame and is hidden from screen readers", () => {
    const html = renderToStaticMarkup(<ProductCardSkeleton />);
    expect(html).toMatch(/^<div aria-hidden="true" class="@container flex h-full flex-col rounded-kaart border border-rand bg-kaart"/);
    expect(html).toContain("aspect-[4/5]");
    expect(html).not.toContain("animate-");
  });
});

/** A client component with hooks around the shared components, as the Spark Finder and search use them. */
function ClientShelf({ products }: { products: CatalogProduct[] }) {
  const [sort, setSort] = useState<SortKey>("prijs-oplopend");
  const sorted = useMemo(() => sortProducts(products, sort), [products, sort]);
  const [first] = sorted;
  return (
    <div>
      <SortSelect value={sort} onChange={setSort} />
      <ProductGrid products={sorted} label={cardCopy.grid.label} />
      {first ? <ProductCard product={first} headingLevel={2} /> : null}
    </div>
  );
}

describe("shared components inside a client wrapper (plan §13.8, decision 112)", () => {
  it("ProductCard and ProductGrid render inside a component with hooks", () => {
    const products = [jet, mae, lola];
    const html = render(<ClientShelf products={products} />);
    expect(count(html, "<article")).toBe(4);
    // Sorted by price, low to high: Mae (€12,95), Lola (€19,95), Jet (€24,95).
    const order = [mae, lola, jet].map((product) => html.indexOf(`>${product.title}</a>`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain('<option value="prijs-oplopend" selected="">');
  });
});

/* -------------------------------------------------------------------------- */
/* 404                                                                         */
/* -------------------------------------------------------------------------- */

describe("NotFoundContent", () => {
  const favorites = [lola, jet, tess, nina];

  it("shows sharedCopy.notFound as the page's only H1, with the shop, the Spark Finder and search", () => {
    const html = render(<NotFoundContent favorites={favorites} />);
    expect(count(html, "<h1")).toBe(1);
    expect(html).toMatch(new RegExp(`<h1[^>]*>${re(escape(sharedCopy.notFound.title))}</h1>`));
    expect(html).toContain(sharedCopy.notFound.text);
    expect(html).toMatch(new RegExp(`href="/collections/alle"[^>]*>${re(sharedCopy.notFound.shop)}<`));
    expect(html).toMatch(new RegExp(`href="/spark-finder"[^>]*>${re(sharedCopy.notFound.finder)}<`));
    expect(html).toMatch(new RegExp(`href="/zoeken"[^>]*>.*?${re(sharedCopy.notFound.search)}<`));
  });

  it("shows four favourites as product cards under Linde's title", () => {
    const html = render(<NotFoundContent favorites={favorites} />);
    expect(html).toMatch(new RegExp(`<h2[^>]*>${re(escape(sharedCopy.notFound.favoritesTitle))}</h2>`));
    expect(count(html, "<article")).toBe(NOT_FOUND_FAVORITES);
    for (const product of favorites) expect(html).toContain(`href="/products/${product.handle}"`);
    expect(count(html, "<h3")).toBe(NOT_FOUND_FAVORITES);
    expect(html).toContain("md:grid-cols-4");
  });

  it("leaves the favourites out when there are none", () => {
    const html = render(<NotFoundContent favorites={[]} />);
    expect(html).not.toContain(sharedCopy.notFound.favoritesTitle);
    expect(html).not.toContain("<article");
    expect(html).not.toContain(cardCopy.grid.empty);
  });
});

describe("NotFoundView (async wrapper, mocked lib/shop-data)", () => {
  beforeEach(() => {
    shopData.products = [];
  });

  it("renders Linde's first four favourites by featuredRank", async () => {
    shopData.products = [...pieceList].reverse();
    const html = render(await NotFoundView());
    expect(html).toContain(escape(sharedCopy.notFound.title));
    expect(count(html, "<article")).toBe(NOT_FOUND_FAVORITES);
    const expected = [lola, jet, tess, nina];
    const positions = expected.map((product) => html.indexOf(`href="/products/${product.handle}"`));
    expect(positions.every((position) => position > -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    // Mae is a favourite too, but the fifth.
    expect(html).not.toContain(`href="/products/${mae.handle}"`);
  });

  it("only takes listable favourites, never bestsellers instead of Linde's picks", async () => {
    shopData.products = [
      { ...lola, listable: false },
      { ...jade, bestseller: true },
      ...pieceList.filter((product) => product.handle !== lola.handle && product.handle !== jade.handle),
    ];
    const html = render(await NotFoundView());
    expect(html).not.toContain(`href="/products/${lola.handle}"`);
    expect(html).not.toContain(`href="/products/${jade.handle}"`);
    expect(html).toContain(`href="/products/${mae.handle}"`);
  });

  it("renders the 404 without favourites on an empty catalog", async () => {
    const html = render(await NotFoundView());
    expect(html).toContain(escape(sharedCopy.notFound.title));
    expect(html).not.toContain("<article");
  });
});

/* -------------------------------------------------------------------------- */
/* Static import check (plan §13.8, §19.1)                                     */
/* -------------------------------------------------------------------------- */

/** Bare modules a shared component may never reach. */
const FORBIDDEN_MODULES = new Set(["server-only", "next/cache"]);
/** Project files a shared component may never reach. */
const FORBIDDEN_FILES = ["lib/shop-data.ts", "lib/commerce/index.ts", "lib/commerce/local.ts", "lib/server-clock.ts"].map((file) =>
  join(appRoot, file),
);
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js"];

/** A project import resolved to its file; null for a package. */
function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(appRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  else return null;
  const candidates = [base, ...EXTENSIONS.map((ext) => base + ext), ...EXTENSIONS.map((ext) => join(base, `index${ext}`))];
  const found = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  if (!found) throw new Error(`Cannot resolve "${specifier}" from ${relative(appRoot, from)}`);
  return found;
}

/** Every module (packages and project files) reachable from `entry`, each with the chain that led there. */
function importTree(entry: string): Map<string, string[]> {
  const seen = new Map<string, string[]>([[entry, [relative(appRoot, entry)]]]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    const chain = seen.get(file) ?? [];
    // TypeScript's own scanner: imports, re-exports and dynamic imports, never text in comments.
    const { importedFiles } = ts.preProcessFile(readFileSync(file, "utf8"), true, true);
    for (const { fileName: specifier } of importedFiles) {
      const target = resolveImport(file, specifier);
      const key = target ?? specifier;
      if (seen.has(key)) continue;
      seen.set(key, [...chain, target ? relative(appRoot, target) : specifier]);
      if (target) queue.push(target);
    }
  }
  return seen;
}

describe("static import check: ProductCard and ProductGrid stay shared (plan §13.8)", () => {
  for (const name of ["ProductCard.tsx", "ProductGrid.tsx"]) {
    it(`${name} reaches no server-only module`, () => {
      const entry = join(appRoot, "components/product", name);
      const tree = importTree(entry);
      const offending = [...tree.entries()]
        .filter(([module]) => FORBIDDEN_MODULES.has(module) || FORBIDDEN_FILES.includes(module))
        .map(([, chain]) => chain.join(" → "));
      expect(offending).toEqual([]);
      // The walk really followed the tree (QuickAdd, Price, lib/catalog.ts).
      expect(tree.has(join(appRoot, "components/product/QuickAdd.tsx"))).toBe(true);
      expect(tree.has(join(appRoot, "lib/catalog.ts"))).toBe(true);
    });

    it(`${name} exports no async component`, () => {
      const source = readFileSync(join(appRoot, "components/product", name), "utf8");
      expect(source).not.toMatch(/\basync\s+function\b/);
      expect(source).not.toMatch(/=\s*async\s*\(/);
    });
  }

  it("the check itself finds a server-only module (NotFoundView reads lib/shop-data.ts)", () => {
    const tree = importTree(join(appRoot, "components/pages/NotFoundView.tsx"));
    expect(tree.has(join(appRoot, "lib/shop-data.ts"))).toBe(true);
  });
});
