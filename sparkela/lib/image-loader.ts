"use client";

/**
 * next/image loader for every <Image>, server components included (images.loaderFile in next.config.ts,
 * docs/PLAN.md §17.1). Vercel does no image transformations: Shopify's CDN scales product photos, and the site's own
 * photos come as width variants written at build time.
 *
 * - Shopify CDN (cdn.shopify.com, or a store's /cdn/shop/ path): sets ?width= and keeps every other parameter
 *   (such as v= for cache busting, or format=). Shopify has no quality parameter, so `quality` is ignored.
 * - Site photos and video posters (/images/…, /videos/…-poster.webp): the variant of lib/site-image-variants.mjs,
 *   /_img/<step>/images/…, the smallest step of the ladder at least as wide as asked (QA round 3: before, every
 *   device got the full master, and every `sizes` on a site photo changed nothing).
 * - Other local files (/brand/…) and other URLs: appends w=<width>, so next/image does not warn that the loader
 *   ignores the width.
 * - data: and blob: URLs are returned unchanged.
 *
 * `"use client"` is required: Next serialises the loader into client components (next.config images docs).
 */

import { hasSiteVariants, siteVariantPath } from "./site-image-variants.mjs";

interface LoaderInput {
  src: string;
  width: number;
  quality?: number;
}

function isShopifyCdn(url: URL): boolean {
  return url.hostname === "cdn.shopify.com" || url.pathname.startsWith("/cdn/shop/");
}

function withParam(src: string, name: string, value: string): string {
  const hashIndex = src.indexOf("#");
  const base = hashIndex === -1 ? src : src.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : src.slice(hashIndex);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${name}=${encodeURIComponent(value)}${hash}`;
}

export default function shopifyLoader({ src, width }: LoaderInput): string {
  const size = String(Math.max(1, Math.round(width)));

  if (/^(data|blob):/i.test(src)) return src;

  const isAbsolute = /^https?:\/\//i.test(src);
  const isProtocolRelative = src.startsWith("//");
  if (isAbsolute || isProtocolRelative) {
    let url: URL;
    try {
      url = new URL(isProtocolRelative ? `https:${src}` : src);
    } catch {
      return withParam(src, "w", size);
    }
    if (isShopifyCdn(url)) {
      url.searchParams.set("width", size);
      return url.toString();
    }
  }

  if (hasSiteVariants(src)) return siteVariantPath(src, Number(size));

  return withParam(src, "w", size);
}
