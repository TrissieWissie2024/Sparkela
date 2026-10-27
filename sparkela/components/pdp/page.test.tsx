import { isValidElement, Suspense, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CatalogProduct, Product } from "@/lib/types";
import { badgeContextAt, defaultVariant, toCatalogProduct } from "@/lib/catalog";
import { buildLocalProducts } from "@/lib/commerce/local-data";
import { buildShipSchedule } from "@/lib/dates";
import { pdpCopy } from "@/content/copy/pdp";
import { site } from "@/content/site";
import { stacks } from "@/content/stacks";
import { CartProvider } from "@/components/cart/CartProvider";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { NotFoundView } from "@/components/pages/NotFoundView";
import { ClockProvider } from "@/components/time/ClockProvider";
import { localCatalogProducts } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import ProductsLayout from "@/app/(shop)/products/layout";
import ProductPage, {
  ensureStatic,
  generateMetadata,
  generateStaticParams,
  instant,
} from "@/app/(shop)/products/[handle]/page";

/**
 * /products/[handle] (docs/PLAN.md §14.2, §19.1) with a mocked lib/shop-data (the local catalog at TEST_NOW): static
 * per product with the 404 pattern (ensureStatic "navigation", instant false, notFound() inside Suspense with
 * NotFoundView as the fallback, also for the gift wrap), metadata, one H1, JSON-LD outside Suspense, the order of the
 * buy column, the gift card variant and the products layout.
 */

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const products = buildLocalProducts();
const catalog = localCatalogProducts(TEST_NOW);

function find(handle: string): Product | null {
  return products.find((product) => product.handle === handle) ?? null;
}

function card(handle: string): CatalogProduct {
  const found = catalog.find((product) => product.handle === handle);
  if (!found) throw new Error(`no catalog product ${handle}`);
  return found;
}

vi.mock("@/lib/shop-data", () => ({
  NO_PRODUCTS_HANDLE: "__geen-producten__",
  getShopProduct: vi.fn(async (handle: string) => find(handle)),
  getShopProductsForParams: vi.fn(async () =>
    products.filter((product) => product.handle !== "cadeauverpakking").map((product) => ({ handle: product.handle })),
  ),
  getProductBadges: vi.fn(async (handle: string) => {
    const product = find(handle);
    if (!product) return [];
    return toCatalogProduct(product, badgeContextAt(TEST_NOW)).badges.filter((id) => id !== "limited" && id !== "early-access");
  }),
  getStackOptionsFor: vi.fn(async (handle: string) => {
    const candidates = catalog
      .filter(
        (product) =>
          product.handle !== handle &&
          product.listable &&
          product.availableForSale &&
          (product.type === "oorbellen" || product.type === "armbanden"),
      )
      .sort((a, b) => a.featuredRank - b.featuredRank);
    if (handle === "lola-chunky-hoops") {
      return {
        candidates,
        defaultPicks: [defaultVariant(card("tess-schakelarmband")).id, defaultVariant(card("roos-brede-bangle")).id],
      };
    }
    return { candidates, defaultPicks: null };
  }),
  getRecommendedFor: vi.fn(async (handle: string) =>
    catalog.filter((product) => product.listable && product.handle !== handle && product.availableForSale).slice(0, 4),
  ),
  getVisibleStacks: vi.fn(async () =>
    stacks
      .filter((stack) => !stack.dropSlug)
      .map((stack) => ({ stack, products: stack.productHandles.map((handle) => card(handle)) })),
  ),
  getShipSchedule: vi.fn(async () => buildShipSchedule(TEST_NOW)),
  getShopProducts: vi.fn(async () => catalog.filter((product) => product.listable)),
}));

function render(children: ReactNode): string {
  return renderToStaticMarkup(
    <ClockProvider serverNow={TEST_NOW}>
      <CatalogProvider products={catalog}>
        <CartProvider provider="local">
          <ProductsLayout>{children}</ProductsLayout>
        </CartProvider>
      </CatalogProvider>
    </ClockProvider>,
  );
}

function props(handle: string) {
  return { params: Promise.resolve({ handle }), searchParams: Promise.resolve({}) };
}

function expectNotFoundPattern(element: ReactNode) {
  expect(isValidElement(element)).toBe(true);
  const suspense = element as ReactElement<{ fallback: ReactElement; children: ReactElement }>;
  expect(suspense.type).toBe(Suspense);
  expect(suspense.props.fallback.type).toBe(NotFoundView);
}

describe("/products/[handle]", () => {
  it("is static per product with the 404 pattern for unknown handles and the gift wrap", async () => {
    expect(ensureStatic).toBe("navigation");
    expect(instant).toBe(false);
    const params = await generateStaticParams();
    expect(params).toContainEqual({ handle: "lola-chunky-hoops" });
    expect(params).toContainEqual({ handle: "holiday-ster-oorbellen" });
    expect(params).not.toContainEqual({ handle: "cadeauverpakking" });
    expectNotFoundPattern(await ProductPage(props("zzz")));
    expectNotFoundPattern(await ProductPage(props("cadeauverpakking")));
    expect(await generateMetadata(props("zzz"))).toMatchObject({ robots: { index: false } });
    expect(await generateMetadata(props("cadeauverpakking"))).toMatchObject({ robots: { index: false } });
  });

  it("has metadata with the canonical and the product's own OG image", async () => {
    const meta = await generateMetadata(props("lola-chunky-hoops"));
    expect(meta.alternates?.canonical).toBe("/products/lola-chunky-hoops");
    expect(JSON.stringify(meta.openGraph)).toContain("/products/lola-chunky-hoops/opengraph-image");
  });

  it("renders one H1, the JSON-LD, the breadcrumbs and the blocks in the order of the plan", async () => {
    const element = await ProductPage(props("lola-chunky-hoops"));
    expect(isValidElement(element) && (element as ReactElement).type === Suspense).toBe(false);
    const html = render(element);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain('"@type":"Product"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('aria-label="Kruimelpad"');
    expect(html).toContain('href="/collections/oorbellen"');

    const order = [
      'aria-roledescription="carrousel"',
      "<h1",
      `>${pdpCopy.sections.buy}</h2>`,
      "Stack van 3",
      pdpCopy.giftWrap.label,
      pdpCopy.addToCart.label,
      pdpCopy.delivery.carrier,
      "Veilig betalen met",
      `>${pdpCopy.specs.title}</h2>`,
      pdpCopy.meter.title,
      "Details en materiaal",
      pdpCopy.look.title,
      pdpCopy.faq.title,
    ];
    const positions = order.map((needle) => html.indexOf(needle));
    for (const [index, position] of positions.entries()) expect(position, order[index]).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain(site.vat.before);
  });

  it("renders the gift card with amount tiles, mail delivery and its own accordions", async () => {
    const html = render(await ProductPage(props("cadeaukaart")));
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain(">€25<");
    expect(html).toContain("Direct in je mail");
    expect(html).not.toContain(pdpCopy.delivery.carrier);
    expect(html).toContain("Zo werkt het");
    expect(html).toContain("Productveiligheid");
    expect(html).not.toContain(pdpCopy.giftWrap.label);
    expect(html).not.toContain("Stack van 3");
    expect(html).toContain('href="/cadeaukaarten"');
  });
});
