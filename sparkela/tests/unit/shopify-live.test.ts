import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { getShopifyProducts } from "@/lib/commerce/shopify/catalog";
import { storefront, storefrontHeaders } from "@/lib/commerce/shopify/client";
import { getShopifyConfig } from "@/lib/commerce/shopify/config";
import { mapCart } from "@/lib/commerce/shopify/mappers";
import {
  CART_BY_ID_QUERY,
  CART_CREATE_MUTATION,
  VARIANT_GATE_QUERY,
  type CartByIdData,
  type CartCreateData,
  type VariantGateData,
} from "@/lib/commerce/shopify/mutations";
import { CATALOG_PRODUCTS_QUERY, PREDICTIVE_SEARCH_QUERY, type PredictiveSearchData } from "@/lib/commerce/shopify/queries";
import { toMs } from "@/lib/dates";
import { drops } from "@/content/drops";

/**
 * `npm run test:shopify` (docs/PLAN.md §16.8, §11.9 step 3; decisions 98, 110, 114, 131): read-only checks against the
 * real store, with the keys from .env.local. Skipped unless SHOPIFY_LIVE_TEST=1, so `npm test` never needs a network.
 *
 * - CatalogProducts runs as the build runs it; the query cost is logged when Shopify reports it.
 * - Every handle of a drop that is not over yet should be in the collection "alle" (a warning otherwise, §7.7).
 * - The first photo of every product is .jpg, .jpeg or .png, and that URL with format=jpg answers image/jpeg (the
 *   OG images need it, §17.3); otherwise the test fails with the handle.
 * - The cart query of the site is valid for this API version (the discount fields of decision 51): one empty cart is
 *   created and read back (an unused cart expires by itself; no order, no customer).
 * - With SHOPIFY_LIVE_ADMIN=1 also the blocking Admin test: customerByIdentifier and customerCreate with the address
 *   test+<date>@sparkela.nl through the same code as /api/subscribe (consent PENDING, never SUBSCRIBED). Delete that
 *   test customer in Shopify afterwards.
 */

const LIVE = process.env.SHOPIFY_LIVE_TEST === "1";
const ADMIN = process.env.SHOPIFY_LIVE_ADMIN === "1";
const TIMEOUT = 120_000;

function loadLocalEnv(): void {
  const file = join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  try {
    process.loadEnvFile(file);
  } catch (error) {
    console.warn(`[shopify-live] .env.local could not be read: ${(error as Error).message}`);
  }
}

describe.skipIf(!LIVE)("Shopify live (SHOPIFY_LIVE_TEST=1)", () => {
  beforeAll(() => {
    loadLocalEnv();
  });

  it(
    "runs CatalogProducts and logs the query cost",
    async () => {
      const config = getShopifyConfig();
      const response = await fetch(config.storefrontUrl, {
        method: "POST",
        headers: storefrontHeaders(config),
        body: JSON.stringify({ query: CATALOG_PRODUCTS_QUERY, variables: { cursor: null } }),
        signal: AbortSignal.timeout(15_000),
      });
      expect(response.status, "Storefront API status").toBe(200);
      const body = (await response.json()) as { data?: unknown; errors?: unknown; extensions?: { cost?: unknown } };
      expect(body.errors, JSON.stringify(body.errors)).toBeUndefined();
      console.info(`[shopify-live] CatalogProducts cost: ${JSON.stringify(body.extensions?.cost ?? "not reported by the Storefront API")}`);
    },
    TIMEOUT,
  );

  it(
    "maps the whole catalog, with every running drop in alle and JPEG-convertible first photos",
    async () => {
      const now = Date.now();
      const products = await getShopifyProducts(now);
      console.info(`[shopify-live] ${products.length} products`);

      const handles = new Set(products.map((product) => product.handle));
      for (const drop of drops.filter((candidate) => now < toMs(candidate.endsAt))) {
        for (const handle of drop.productHandles) {
          if (!handles.has(handle)) console.warn(`[shopify-live] drop ${drop.slug}: "${handle}" is not in Shopify or not in "alle"`);
        }
      }

      const failures: string[] = [];
      for (const product of products) {
        const first = product.images[0];
        if (!first) continue;
        const url = new URL(first.url);
        if (!/\.(jpe?g|png)$/i.test(url.pathname)) {
          failures.push(`${product.handle}: the first photo is not .jpg, .jpeg or .png (${url.pathname.split("/").pop()})`);
          continue;
        }
        url.searchParams.set("format", "jpg");
        url.searchParams.set("width", "1200");
        const image = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        const type = image.headers.get("content-type") ?? "";
        await image.body?.cancel();
        if (!type.startsWith("image/jpeg")) failures.push(`${product.handle}: format=jpg answers "${type}"`);
      }
      expect(failures).toEqual([]);
    },
    TIMEOUT,
  );

  it(
    "accepts the cart query, VariantGate and PredictiveSearch of this API version",
    async () => {
      const created = await storefront<CartCreateData>(CART_CREATE_MUTATION, { input: { buyerIdentity: { countryCode: "NL" } } });
      expect(created.cartCreate?.userErrors ?? []).toEqual([]);
      const id = created.cartCreate?.cart?.id;
      expect(id).toMatch(/^gid:\/\/shopify\/Cart\//);
      const read = await storefront<CartByIdData>(CART_BY_ID_QUERY, { id });
      expect(read.cart).not.toBeNull();
      if (read.cart) expect(mapCart(read.cart, { giftWrapVariantId: null, now: Date.now() }).lines).toEqual([]);

      const gate = await storefront<VariantGateData>(VARIANT_GATE_QUERY, { ids: ["gid://shopify/ProductVariant/1"] });
      expect(gate.nodes).toEqual([null]);

      const search = await storefront<PredictiveSearchData>(PREDICTIVE_SEARCH_QUERY, { q: "oorbellen" });
      expect(search.predictiveSearch).not.toBeNull();
    },
    TIMEOUT,
  );

  it.skipIf(!ADMIN)(
    "Admin API: customerByIdentifier and customerCreate work on this plan (SHOPIFY_LIVE_ADMIN=1)",
    async () => {
      const { upsertPendingSubscriber } = await import("@/lib/commerce/shopify/admin");
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const email = `test+${date}@sparkela.nl`;
      const result = await upsertPendingSubscriber(email, ["sparkela-live-test"], Date.now());
      expect(["pending", "already-subscribed"]).toContain(result.status);
      console.info(`[shopify-live] Admin test ok: customer ${result.customerId} (${result.status}); delete ${email} in Shopify.`);
    },
    TIMEOUT,
  );
});
