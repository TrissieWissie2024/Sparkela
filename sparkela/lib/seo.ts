import type { Metadata } from "next";

import { getEnv } from "@/lib/env";
import { productPath } from "@/lib/paths";
import { getRatingSummary, getReviews } from "@/lib/reviews";
import type { Cents, JewelryType, Product, Variant } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";
import { shipping } from "@/content/shipping";
import { confirmedSocials, site } from "@/content/site";

/**
 * SEO helpers (docs/PLAN.md §18.1, brief §7): page metadata, route constants and JSON-LD. Pure functions on content
 * and config, server-side only (metadata exports, app/sitemap.ts, app/robots.ts, components/seo/JsonLd.tsx):
 * getEnv() throws in a browser, so a client component that imports this module fails loudly.
 *
 * Open Graph in Next 16 is replaced, not merged: a page that sets `openGraph` drops the root's siteName, locale and
 * type. pageMetadata() therefore always returns the full object with an image (CORVANE D53.1). Title and
 * description stay out of `openGraph`: Next fills og:title and og:description from the page's own title and
 * description (resolve-metadata inheritFromMetadata), and twitter from openGraph.
 *
 * JSON-LD never contains aggregateRating or reviews without real, shown reviews (brief §2.3): productJsonLd() reads
 * getRatingSummary(), which is null while content/reviews.ts is empty or site.flags.showReviews is off.
 */

/* -------------------------------------------------------------------------- */
/* URLs and routes                                                             */
/* -------------------------------------------------------------------------- */

/** The site origin (metadataBase): NEXT_PUBLIC_SITE_URL ?? "https://sparkela.nl". */
export const siteUrl: URL = new URL(getEnv().siteUrl);

export const OG_LOCALE = "nl_NL";

/** Language of the site in JSON-LD. */
const IN_LANGUAGE = "nl";

/** Fixed last-modified date of the sitemap. A literal: `new Date()` would make the route dynamic (CORVANE D53.4). */
export const CONTENT_UPDATED = "2026-11-20";

/** Pages with robots noindex. They stay crawlable (never Disallow in robots.txt, D53.4) and are not in the sitemap. */
export const NOINDEX_PATHS = ["/zoeken", "/checkout", "/account"] as const;

/**
 * Indexable static pages, in sitemap order (plan §2.2). Collections (/collections/<handle>), products and drops are
 * added by the sitemap and tests/fixtures/local-catalog.ts. Not here: the noindex pages, /wachtlijst (canonical "/",
 * 307 to /sparkela-club after the launch) and /nieuwsbrief/bevestigen (noindex).
 */
export const STATIC_ROUTES: string[] = [
  "/",
  "/stacks",
  "/cadeaukaarten",
  "/sparkela-club",
  "/spark-finder",
  "/over-sparkela",
  "/veelgestelde-vragen",
  "/verzenden-en-retourneren",
  "/herroepen",
  "/contact",
  "/algemene-voorwaarden",
  "/privacy",
  "/cookies",
];

/** Absolute URL of a site path: "/privacy" → "https://sparkela.nl/privacy". Absolute URLs pass through. */
export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl).toString();
}

// The path helpers live in the client-safe lib/paths.ts (decision 190); re-exported here for server code.
export { collectionPath, dropPath, productPath } from "@/lib/paths";

/* -------------------------------------------------------------------------- */
/* Metadata                                                                    */
/* -------------------------------------------------------------------------- */

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_TYPE = "image/png";

/** The brand image (app/opengraph-image.tsx), used by every page without an image of its own. */
export const BRAND_OG_IMAGE_PATH = "/opengraph-image";

/** Alt text of the brand image: "Sparkela: Sieraden met een spark" (from content, no new copy). */
export const BRAND_OG_ALT = `${site.name}: ${site.taglines[2]}`;

/** Title of the metadata of an unknown product, NO_PRODUCTS_HANDLE and the gift wrap (plan §14.2). */
export const NOT_FOUND_TITLE = sharedCopy.notFound.metaTitle;

/** Open Graph fields every page shares; pageMetadata() repeats them because a page's openGraph replaces the root's. */
export const baseOpenGraph = { siteName: site.name, locale: OG_LOCALE, type: "website" } as const;

type OgImageDescriptor = { url: string; alt: string; width?: number; height?: number; type?: string };

function isOwnOgRoute(path: string): boolean {
  return /\/opengraph-image(?:-[\w-]+)?$/.test(path.split("?")[0]);
}

function ogImage(image: string | undefined, alt: string): OgImageDescriptor {
  const url = image ?? BRAND_OG_IMAGE_PATH;
  // Our own OG routes are always 1200×630 PNG; another image (a Shopify photo) has its own size.
  if (!isOwnOgRoute(url)) return { url, alt };
  return { url, alt: image ? alt : BRAND_OG_ALT, ...OG_IMAGE_SIZE, type: OG_IMAGE_TYPE };
}

export interface PageMetadataInput {
  /** The root template adds " | Sparkela"; use { absolute } to skip it (home, waitlist). */
  title: string | { absolute: string };
  description: string;
  /** Path of the page, e.g. "/privacy". Also the canonical unless `canonical` is given. */
  path: string;
  /** Path or URL of the social image; default the brand image /opengraph-image. */
  image?: string;
  /** robots noindex (follow stays on). */
  noindex?: boolean;
  /** Canonical path when it differs from `path` (the waitlist and the drop teaser). */
  canonical?: string;
}

/** Metadata of one page: title, description, canonical, robots and always the full Open Graph object with an image. */
export function pageMetadata(input: PageMetadataInput): Metadata {
  const canonical = input.canonical ?? input.path;
  const titleText = typeof input.title === "string" ? input.title : input.title.absolute;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical },
    openGraph: { ...baseOpenGraph, url: canonical, images: [ogImage(input.image, titleText)] },
    ...(input.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/**
 * Metadata of a product page: product.seo (or title and styling text), canonical /products/<handle> and its own OG
 * image. null (unknown handle, NO_PRODUCTS_HANDLE) and the gift wrap get "Pagina niet gevonden" with noindex.
 */
export function productMetadata(product: Product | null): Metadata {
  if (!product || product.isGiftWrap) {
    return { title: NOT_FOUND_TITLE, robots: { index: false, follow: true } };
  }
  const path = productPath(product.handle);
  return pageMetadata({
    title: product.seo.title ?? product.title,
    description: product.seo.description ?? (product.description || site.description),
    path,
    image: `${path}/opengraph-image`,
  });
}

/* -------------------------------------------------------------------------- */
/* JSON-LD                                                                     */
/* -------------------------------------------------------------------------- */

const SCHEMA = "https://schema.org";

/** One JSON-LD object; every builder sets @context, so an array of nodes is valid as it is. */
export type JsonLdNode = { "@context": typeof SCHEMA; "@type": string } & Record<string, unknown>;

/**
 * JSON for a <script type="application/ld+json">: every "<" becomes <, so a "</script>" inside a value can
 * never close the element (plan §13.14).
 */
export function serializeJsonLd(data: object | object[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Schema.org decimal for integer cents (not for display; visible amounts go through lib/money.ts): 395 → "3.95". */
export function centsToDecimal(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const ORGANIZATION_ID = absoluteUrl("/#organization");
const WEBSITE_ID = absoluteUrl("/#website");

/** Social profiles for sameAs: only confirmed accounts (all are placeholders at launch). */
export function confirmedSocialProfiles(): string[] {
  return confirmedSocials.map((social) => social.href);
}

/** Sparkela as an Organization: name, url, logo, email; sameAs only for confirmed socials. */
export function organizationJsonLd(): JsonLdNode {
  const sameAs = confirmedSocialProfiles();
  return {
    "@context": SCHEMA,
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: site.name,
    url: absoluteUrl("/"),
    // public/brand/icon-512.png (monogram, scripts/build-logo.mjs); Google asks for at least 112×112.
    logo: { "@type": "ImageObject", url: absoluteUrl("/brand/icon-512.png"), width: 512, height: 512 },
    email: site.email,
    description: site.description,
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

/** The website, with a SearchAction to /zoeken?q={search_term_string}. */
export function websiteJsonLd(): JsonLdNode {
  return {
    "@context": SCHEMA,
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: site.name,
    url: absoluteUrl("/"),
    description: site.description,
    inLanguage: IN_LANGUAGE,
    publisher: { "@id": ORGANIZATION_ID },
    potentialAction: {
      "@type": "SearchAction",
      // Built as a string: new URL() would percent-encode the braces of the template.
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/zoeken")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** A BreadcrumbList with absolute URLs, the same trail as the visible Breadcrumbs. */
export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>): JsonLdNode {
  return {
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

const IN_STOCK = `${SCHEMA}/InStock`;
const OUT_OF_STOCK = `${SCHEMA}/OutOfStock`;
const NEW_CONDITION = `${SCHEMA}/NewCondition`;
const WORKING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => `${SCHEMA}/${day}`);

/**
 * Shipping of an offer at `priceCents`, per enabled country (NL at launch): €3,95, or 0 from €35; dispatch on
 * working days, handling 0 to 1 day (same day before 16.00), transit from content/shipping.ts.
 */
export function shippingDetailsJsonLd(priceCents: Cents): Array<Record<string, unknown>> {
  return Object.values(shipping.countries)
    .filter((country) => country.enabled)
    .map((country) => ({
      "@type": "OfferShippingDetails",
      shippingRate: {
        "@type": "MonetaryAmount",
        value: centsToDecimal(priceCents >= country.freeFrom.cents ? 0 : country.rate.cents),
        currency: country.rate.currency,
      },
      shippingDestination: { "@type": "DefinedRegion", addressCountry: country.code },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        businessDays: { "@type": "OpeningHoursSpecification", dayOfWeek: WORKING_DAYS },
        handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
        transitTime: {
          "@type": "QuantitativeValue",
          minValue: country.transitDays.min,
          maxValue: country.transitDays.max,
          unitCode: "DAY",
        },
      },
    }));
}

/** The statutory 14-day withdrawal period, by mail, for the enabled countries. No claim about return costs. */
export function returnPolicyJsonLd(): Record<string, unknown> {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: Object.values(shipping.countries)
      .filter((country) => country.enabled)
      .map((country) => country.code),
    returnPolicyCategory: `${SCHEMA}/MerchantReturnFiniteReturnWindow`,
    merchantReturnDays: shipping.returnDays,
    returnMethod: `${SCHEMA}/ReturnByMail`,
  };
}

function isJewelryType(type: Product["type"]): type is JewelryType {
  return type !== null && type in sharedCopy.vocab.type;
}

/** One Offer per variant: price, EUR, availability, url, and for physical products shipping and returns. */
function offerJsonLd(product: Product, variant: Variant, url: string): Record<string, unknown> {
  const physical = !product.isGiftCard && !product.isGiftWrap;
  return {
    "@type": "Offer",
    url,
    ...(variant.sku ? { sku: variant.sku } : {}),
    ...(product.options.length > 0 && variant.title !== "Default Title" ? { name: variant.title } : {}),
    price: centsToDecimal(variant.price.cents),
    priceCurrency: variant.price.currency,
    availability: variant.availableForSale ? IN_STOCK : OUT_OF_STOCK,
    itemCondition: NEW_CONDITION,
    seller: { "@type": "Organization", name: site.name },
    ...(physical
      ? { shippingDetails: shippingDetailsJsonLd(variant.price.cents), hasMerchantReturnPolicy: returnPolicyJsonLd() }
      : {}),
  };
}

/** Product images as absolute URLs (Shopify photos), else the product's own OG image. */
function productImages(product: Product): string[] {
  if (product.images.length > 0) return product.images.map((image) => absoluteUrl(image.url));
  return [absoluteUrl(`${productPath(product.handle)}/opengraph-image`)];
}

/** Most recent reviews in the Product node, when there are any. */
const MAX_REVIEWS = 10;

/**
 * The Product node (plan §18.1): brand Sparkela, sku, images, one offer per variant (price, EUR, availability, url,
 * shipping NL €3,95 or free from €35, the 14-day return policy). aggregateRating and review only with real, shown
 * reviews; never at launch.
 */
export function productJsonLd(product: Product): JsonLdNode {
  const url = absoluteUrl(productPath(product.handle));
  const rating = getRatingSummary(product.handle);
  const firstSku = product.variants.find((variant) => variant.sku)?.sku ?? null;
  return {
    "@context": SCHEMA,
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.title,
    ...(product.description ? { description: product.description } : {}),
    sku: firstSku ?? product.handle,
    url,
    image: productImages(product),
    brand: { "@type": "Brand", name: site.name },
    ...(isJewelryType(product.type) ? { category: sharedCopy.vocab.type[product.type] } : {}),
    offers: product.variants.map((variant) => offerJsonLd(product, variant, url)),
    ...(rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.average,
            reviewCount: rating.count,
            bestRating: 5,
            worstRating: 1,
          },
          review: getReviews(product.handle)
            .slice(0, MAX_REVIEWS)
            .map((review) => ({
              "@type": "Review",
              author: { "@type": "Person", name: review.firstName },
              datePublished: review.date,
              reviewBody: review.text,
              reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5, worstRating: 1 },
            })),
        }
      : {}),
  };
}
