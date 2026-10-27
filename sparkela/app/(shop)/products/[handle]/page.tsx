import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getVerifiedClaims } from "@/lib/claims";
import { breadcrumbJsonLd, productJsonLd, productMetadata, productPath } from "@/lib/seo";
import {
  getProductBadges,
  getRecommendedFor,
  getShipSchedule,
  getShopProduct,
  getShopProductsForParams,
  getStackOptionsFor,
  getVisibleStacks,
} from "@/lib/shop-data";
import { faq } from "@/content/faq";
import { NotFoundView } from "@/components/pages/NotFoundView";
import { ProductDetail } from "@/components/pdp/ProductDetail";
import { productFaqItems, productTrail } from "@/components/pdp/productLinks";
import { JsonLd } from "@/components/seo/JsonLd";

/**
 * /products/[handle] (docs/PLAN.md §14.2; brief §6 "Productpagina"). Static per product: `○ /products/<handle>` for
 * every product in the catalog (drop products in every phase too; the proxy gates those pages) plus the `◐` shell.
 * All data comes from the cached functions of lib/shop-data.ts; the page never builds CatalogProducts or badges
 * itself and never reads cookies, headers or searchParams.
 *
 * Known products render outside any <Suspense>: the H1, the price, the buy box and the JSON-LD (Product and
 * BreadcrumbList, no rating without real reviews) are in the static HTML (React would otherwise move a big boundary
 * out of line, digest A5; CORVANE D54.1). An unknown handle, NO_PRODUCTS_HANDLE and the gift wrap get the 404 pattern:
 * notFound() only inside <Suspense> with NotFoundView as the fallback, plus `ensureStatic` and `instant`, so even the
 * first request answers 404 with the whole layout (decision 133). `params` is read outside Suspense, so navigations
 * into this page wait for it (`instant = false`).
 */

export const ensureStatic = "navigation";
export const instant = false;

/** Products in "Maak de look af" (plan §14.2: 2 to 4). */
const LOOK_PRODUCTS = 4;

export async function generateStaticParams(): Promise<Array<{ handle: string }>> {
  // Every product except the gift wrap; an empty catalog gives the sentinel NO_PRODUCTS_HANDLE, never [].
  return getShopProductsForParams();
}

export async function generateMetadata({ params }: PageProps<"/products/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  // null (unknown handle, the sentinel) and the gift wrap: "Pagina niet gevonden" with noindex.
  return productMetadata(await getShopProduct(handle));
}

export default async function ProductPage({ params }: PageProps<"/products/[handle]">) {
  const { handle } = await params;
  const product = await getShopProduct(handle);
  if (!product || product.isGiftWrap) {
    return (
      <Suspense fallback={<NotFoundView />}>
        <Missing />
      </Suspense>
    );
  }

  const [badges, stackOptions, lookProducts, stacks, schedule] = await Promise.all([
    getProductBadges(handle),
    getStackOptionsFor(handle),
    getRecommendedFor(handle, LOOK_PRODUCTS),
    getVisibleStacks(),
    getShipSchedule(),
  ]);
  const trail = productTrail(product);

  return (
    <>
      <JsonLd
        data={[
          productJsonLd(product),
          breadcrumbJsonLd(trail.map((crumb) => ({ name: crumb.label, path: crumb.href ?? productPath(product.handle) }))),
        ]}
      />
      <ProductDetail
        product={product}
        badges={badges}
        stacks={stacks.filter((entry) => entry.stack.productHandles.includes(handle))}
        stackOptions={stackOptions}
        lookProducts={lookProducts}
        faq={productFaqItems(product, faq)}
        claims={getVerifiedClaims(product)}
        schedule={schedule}
      />
    </>
  );
}

/** Calls notFound() inside the Suspense boundary of the 404 pattern (plan §14.2, decision 133). */
async function Missing(): Promise<never> {
  notFound();
}
