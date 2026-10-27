import type { MetadataRoute } from "next";

import { brandColor } from "@/lib/brand-colors";
import { site } from "@/content/site";

/**
 * /manifest.webmanifest (docs/PLAN.md §2.4): name, colours and the monogram icons (scripts/build-logo.mjs), for "Zet op
 * beginscherm". Next links it from every page. The site opens in the normal browser (display "browser"): it is a shop,
 * not an app, and the checkout runs on Shopify's domain. The theme colour matches the viewport themeColor (--donker,
 * the announcement bar); the background is --pagina.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${site.name}: ${site.taglines[2]}`,
    short_name: site.name,
    description: site.description,
    lang: "nl",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "browser",
    background_color: brandColor("pagina"),
    theme_color: brandColor("donker"),
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
