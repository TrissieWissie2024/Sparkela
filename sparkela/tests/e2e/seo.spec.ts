import { expect, PRODUCT_ROUTES, productTitle, test } from "./fixtures";

/**
 * What crawlers and clients without JavaScript get (docs/PLAN.md §19.2, §14.2, §18.1; decision 47):
 * - every product page of SHOP_ROUTES has its product as the only visible H1 and JSON-LD Product with an offer and the
 *   brand Sparkela, in the static HTML (H1, price and JSON-LD sit outside Suspense);
 * - unknown handles answer 404 with noindex on the very first request (the 404 pattern with ensureStatic, plan
 *   §14.2), for browsers and for HTML-limited bots alike, never a soft 404.
 */

const BINGBOT = "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)";

interface JsonLdNode {
  "@type"?: string | string[];
  name?: string;
  brand?: { name?: string };
  offers?: unknown;
  "@graph"?: JsonLdNode[];
}

function productNodes(scripts: string[]): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  for (const text of scripts) {
    const parsed = JSON.parse(text) as JsonLdNode | JsonLdNode[];
    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      for (const item of node["@graph"] ?? [node]) {
        const type = item["@type"];
        if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) nodes.push(item);
      }
    }
  }
  return nodes;
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false, clockAt: null });

  test("every product page has one visible H1 and JSON-LD Product", async ({ page }) => {
    test.slow(); // All product pages in one test.
    expect(PRODUCT_ROUTES.length).toBeGreaterThan(20);

    for (const path of PRODUCT_ROUTES) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      const handle = path.replace("/products/", "");

      const h1 = page.locator("h1");
      await expect(h1, path).toHaveCount(1);
      await expect(h1, path).toBeVisible();
      await expect(h1, path).toHaveText(productTitle(handle));
      await expect(page.getByText("Deze pagina bestaat niet (meer)"), path).toHaveCount(0);

      const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
      const products = productNodes(scripts);
      expect(products, `${path}: JSON-LD Product`).toHaveLength(1);
      expect(products[0].name, path).toBe(productTitle(handle));
      expect(products[0].brand?.name, path).toBe("Sparkela");
      expect(products[0].offers, `${path}: offers`).toBeTruthy();
      expect(JSON.stringify(products[0]), `${path}: no rating without real reviews`).not.toContain("aggregateRating");
    }
  });
});

test.describe("unknown URLs", () => {
  // The same answer for every viewport; one project is enough.
  test.skip(({ isMobile }) => isMobile, "Server responses do not depend on the viewport.");

  test("an unknown product is a 404 with noindex for browsers and HTML-limited bots", async ({ request }) => {
    for (const userAgent of [undefined, BINGBOT]) {
      const headers = userAgent ? { "user-agent": userAgent } : undefined;
      const response = await request.get(`/products/bestaat-niet-${Date.now()}`, { headers });
      expect(response.status(), userAgent ?? "browser").toBe(404);
      const html = await response.text();
      expect(html, userAgent ?? "browser").toMatch(/<meta name="robots" content="noindex[^"]*"\/>/);
      expect(html).toContain("Deze pagina bestaat niet (meer)");
    }
  });

  /** The same kind of URL with a segment no earlier request can have warmed up. */
  function fresh(path: string): string {
    const suffix = `-${Date.now().toString(36)}`;
    return path.endsWith("/binnenkort") ? path.replace("/binnenkort", `${suffix}/binnenkort`) : `${path}${suffix}`;
  }

  for (const path of ["/products/zzz", "/collections/zzz", "/drops/iets", "/drops/iets/binnenkort"]) {
    test(`${path} answers 404 on the first request`, async ({ request }) => {
      for (const url of [fresh(path), path]) {
        const response = await request.get(url, { maxRedirects: 0 });
        expect(response.status(), url).toBe(404);
        expect(await response.text(), url).toMatch(/<meta name="robots" content="noindex[^"]*"\/>/);
      }
    });
  }
});
