import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";

import { isJewelryType } from "@/lib/catalog";
import { OG_IMAGE_SIZE, OG_IMAGE_TYPE } from "@/lib/seo";
import { getShopProduct, getShopProductsForParams } from "@/lib/shop-data";
import { sharedCopy } from "@/content/copy/shared";
import { site } from "@/content/site";
import { loadOgPhoto, renderOgImage } from "@/components/seo/OgImage";

/**
 * /products/<handle>/opengraph-image: the Open Graph image of a product page (1200 × 630, docs/PLAN.md §17.3). Type,
 * name and spec line on --donker, with the first Shopify photo in a 4:5 panel when it is a JPEG or PNG original
 * (loadOgPhoto, decision 131); otherwise a roest panel with a spark. No price: a shared preview is cached by the
 * platforms for weeks, and a price there could outlive a price change (brief §2.5).
 *
 * Location: this file sits outside the (shop) route group on purpose. Next gives a metadata route inside a route group
 * a hash suffix (/products/<handle>/opengraph-image-<hash>, getMetadataRouteSuffix), while lib/seo.ts names the image
 * /products/<handle>/opengraph-image in og:image and as the JSON-LD fallback image. Out here the URL has no suffix, so
 * both resolve. The product page's own metadata (productMetadata) points here, with the product name as alt text.
 *
 * Static for every product the page prerenders (own generateStaticParams: the page's list does not count for this
 * route), rendered in a 'use cache' function tagged like the product (revalidated with it by the Shopify webhooks).
 * Unknown handles, the empty-catalog sentinel and the gift wrap give 404. The proxy rewrites the image of a drop
 * product whose page is still closed to the brand image (decision 201).
 */

export const alt = site.name;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_TYPE;

export async function generateStaticParams(): Promise<Array<{ handle: string }>> {
  return getShopProductsForParams();
}

async function renderProductImage(handle: string): Promise<Uint8Array | null> {
  "use cache";
  cacheLife("max");
  cacheTag("products", `product:${handle}`);
  const product = await getShopProduct(handle);
  if (!product || product.isGiftWrap) return null;
  const photo = await loadOgPhoto(product.images[0]?.url);
  return renderOgImage({
    kind: "product",
    title: product.title,
    eyebrow: product.type && isJewelryType(product.type) ? sharedCopy.vocab.type[product.type] : undefined,
    subtitle: product.metafields.specRegel ?? undefined,
    imageUrl: photo ?? undefined,
    // Sparkela's own promise may be stated everywhere (brief §2.6); the gift card gets the tagline instead.
    notes: [product.isGiftCard ? site.taglines[2] : site.guarantee.short],
  });
}

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const png = await renderProductImage(handle);
  if (!png) notFound();
  return new Response(png as Uint8Array<ArrayBuffer>, { headers: { "Content-Type": contentType } });
}
