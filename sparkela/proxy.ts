import { NextResponse, type NextRequest } from "next/server";

import { requestNow } from "@/lib/clock";
import { getDropPhase, isPrelaunch, toMs } from "@/lib/dates";
import { EARLY_ACCESS_PARAM, earlyAccessCookieName, isValidEarlyAccess } from "@/lib/early-access";
import { readEnv, readSecret } from "@/lib/env";
import { hashToken, hasValidPreview, isPreviewToken, PREVIEW_COOKIE, PREVIEW_COOKIE_MAX_AGE, PREVIEW_PARAM } from "@/lib/preview";
import type { Drop } from "@/lib/types";
import { collections } from "@/content/collections";
import { drops, isDropSlug } from "@/content/drops";
import { giftWrap } from "@/content/offers";

/**
 * Prelaunch, preview, early access and the drop gate (docs/PLAN.md §11, decisions 17 to 21, 53, 91, 136). Runs per
 * request, so every page stays static (○) and the shop never flashes before the waitlist (brief §6 Prelaunch, §7).
 *
 * Order (plan §11.2):
 * 1. ?preview=<PRELAUNCH_BYPASS_TOKEN>: cookie sparkela_preview = sha256(token), 307 to the same URL without it. A
 *    wrong token sets nothing and the gate decides.
 * 2. /drops/<slug>?toegang=<token>: a valid token sets sparkela_ea_<slug> (until the drop ends); valid or not, 307
 *    without the parameter.
 * 3. Metadata images and /account (to SHOPIFY_CUSTOMER_ACCOUNT_URL when set) pass. The image of a page the drop gate
 *    would rewrite (a hidden drop, or early access without the cookie, and no preview) is rewritten to the brand
 *    image /opengraph-image, so a product's OG image cannot show it before its page may (decision 201).
 * 4. A valid preview cookie skips 5 and 6.
 * 5. Drop gate, also after the launch, for /drops/<slug>, /drops/<slug>/binnenkort and the product pages of a drop:
 *    hidden, or early access without the cookie → rewrite to the teaser; early access with the cookie → open;
 *    the teaser in phase live or ended → 307 to the drop page.
 * 6. Before launchAt: the allowlist passes, everything else is rewritten to /wachtlijst (status 200).
 * 7. After the launch: /wachtlijst → 307 to /sparkela-club. A collection or drop slug that does not exist, and the
 *    gift wrap's product page, are rewritten to a path without a route, so they get the root 404 at once instead of
 *    the route's Suspense 404 pattern (which logs React error #419 in the browser; QA round 1, decision 216).
 *
 * Every response carries x-sparkela-gate: open | wachtlijst | preview | early-access | teaser. Secrets shorter than
 * 32 characters count as missing (fail closed). The time is requestNow(): the test header only with the test clock.
 */

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|sitemap.xml|robots.txt|brand/|images/|videos/|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|txt|xml|woff2?|mp4|webm)$).*)",
  ],
};

type Gate = "open" | "wachtlijst" | "preview" | "early-access" | "teaser";

const GATE_HEADER = "x-sparkela-gate";

/** Metadata images without an extension; without this they would get the waitlist HTML (digest E2). */
const META = /\/(opengraph-image|twitter-image|icon|apple-icon)(-[\w-]+)?$/;
/** The neutral brand image a gated metadata image is rewritten to. */
const BRAND_IMAGE = "/opengraph-image";

/** Open during the prelaunch (plan §11.3): the waitlist, the confirmation page and the legal and service pages. */
const PRELAUNCH_OPEN = new Set([
  "/wachtlijst",
  "/nieuwsbrief/bevestigen",
  "/algemene-voorwaarden",
  "/privacy",
  "/cookies",
  "/herroepen",
  "/contact",
  "/verzenden-en-retourneren",
]);

const DROP_PATH = /^\/drops\/([^/]+)(\/binnenkort)?\/?$/;
const COLLECTION_PATH = /^\/collections\/([^/]+)\/?$/;
const COLLECTION_HANDLES = new Set(collections.map((collection) => collection.handle));
/** A path without a route: the static root 404 (app/not-found.tsx) answers it. */
const NOT_FOUND_PATH = "/niet-gevonden";
const PRODUCT_PATH = /^\/products\/([^/]+)\/?$/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function tag<T extends NextResponse>(response: T, gate: Gate): T {
  response.headers.set(GATE_HEADER, gate);
  return response;
}

function next(gate: Gate): NextResponse {
  return tag(NextResponse.next(), gate);
}

function redirect(url: URL, gate: Gate): NextResponse {
  return tag(NextResponse.redirect(url, 307), gate);
}

function rewrite(request: NextRequest, pathname: string, gate: Gate): NextResponse {
  return tag(NextResponse.rewrite(new URL(pathname, request.url)), gate);
}

/** Secure cookies everywhere except plain http on localhost (plan §11.4). */
function isSecure(url: URL): boolean {
  return !(url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
}

function withoutParam(request: NextRequest, name: string): URL {
  const url = request.nextUrl.clone();
  url.searchParams.delete(name);
  return url;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

interface DropMatch {
  drop: Drop;
  /** The request is the teaser itself (/drops/<slug>/binnenkort). */
  teaser: boolean;
}

/** The drop behind a drop path or a product page of a drop; null for every other path. */
function dropFor(pathname: string): DropMatch | null {
  const dropPath = DROP_PATH.exec(pathname);
  if (dropPath) {
    const slug = safeDecode(dropPath[1]);
    if (!isDropSlug(slug)) return null;
    const drop = drops.find((candidate) => candidate.slug === slug);
    return drop ? { drop, teaser: Boolean(dropPath[2]) } : null;
  }
  const productPath = PRODUCT_PATH.exec(pathname);
  if (productPath) {
    const handle = safeDecode(productPath[1]);
    const drop = drops.find((candidate) => candidate.productHandles.includes(handle));
    return drop ? { drop, teaser: false } : null;
  }
  return null;
}

/** True while the drop's pages are closed to this request: phase "verborgen", or early access without a valid cookie. */
async function isDropLocked(drop: Drop, request: NextRequest, now: number, earlyAccessSecret: string | null): Promise<boolean> {
  const phase = getDropPhase(drop, now);
  if (phase === "verborgen") return true;
  if (phase !== "early-access") return false;
  const cookie = request.cookies.get(earlyAccessCookieName(drop.slug))?.value;
  return !(await isValidEarlyAccess(drop.slug, cookie, earlyAccessSecret));
}

/** True when the request holds a valid early-access cookie for a drop that is in its early-access phase now. */
async function hasEarlyAccessNow(request: NextRequest, now: number, earlyAccessSecret: string | null): Promise<boolean> {
  for (const drop of drops) {
    if (getDropPhase(drop, now) !== "early-access") continue;
    const cookie = request.cookies.get(earlyAccessCookieName(drop.slug))?.value;
    if (await isValidEarlyAccess(drop.slug, cookie, earlyAccessSecret)) return true;
  }
  return false;
}

/** A collection or drop that does not exist, or the gift wrap's product page: known 404s without a page render. */
function isKnownMissing(pathname: string): boolean {
  const collection = COLLECTION_PATH.exec(pathname);
  if (collection) return !COLLECTION_HANDLES.has(safeDecode(collection[1]));
  const drop = DROP_PATH.exec(pathname);
  if (drop) return !isDropSlug(safeDecode(drop[1]));
  const product = PRODUCT_PATH.exec(pathname);
  return product !== null && safeDecode(product[1]) === giftWrap.productHandle;
}

/** Only an absolute https URL counts as the account address. */
function accountUrl(): URL | null {
  const value = readEnv(process.env, "SHOPIFY_CUSTOMER_ACCOUNT_URL");
  if (value === null) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const now = requestNow(request);
  const { pathname, searchParams } = request.nextUrl;
  const previewToken = readSecret("PRELAUNCH_BYPASS_TOKEN");
  const earlyAccessSecret = readSecret("EARLY_ACCESS_SECRET");

  // 1. Preview link.
  const givenPreview = searchParams.get(PREVIEW_PARAM);
  if (givenPreview !== null && (await isPreviewToken(givenPreview, previewToken))) {
    const response = redirect(withoutParam(request, PREVIEW_PARAM), "preview");
    response.cookies.set(PREVIEW_COOKIE, await hashToken(previewToken as string), {
      httpOnly: true,
      secure: isSecure(request.nextUrl),
      sameSite: "lax",
      path: "/",
      maxAge: PREVIEW_COOKIE_MAX_AGE,
    });
    return response;
  }

  // 2. Early-access link.
  const givenAccess = searchParams.get(EARLY_ACCESS_PARAM);
  const dropPath = DROP_PATH.exec(pathname);
  if (givenAccess !== null && dropPath && !dropPath[2]) {
    const slug = safeDecode(dropPath[1]);
    const drop = isDropSlug(slug) ? drops.find((candidate) => candidate.slug === slug) : undefined;
    const endsAt = drop ? toMs(drop.endsAt) : 0;
    const valid = drop !== undefined && endsAt > now && (await isValidEarlyAccess(slug, givenAccess, earlyAccessSecret));
    const response = redirect(withoutParam(request, EARLY_ACCESS_PARAM), valid ? "early-access" : "open");
    if (valid) {
      response.cookies.set(earlyAccessCookieName(slug), givenAccess, {
        httpOnly: true,
        secure: isSecure(request.nextUrl),
        sameSite: "lax",
        path: "/",
        expires: new Date(endsAt),
      });
    }
    return response;
  }

  // 3. Metadata images (gated like their page) and /account.
  const meta = META.exec(pathname);
  if (meta) {
    const page = dropFor(pathname.slice(0, meta.index) || "/");
    if (
      page &&
      !page.teaser &&
      (await isDropLocked(page.drop, request, now, earlyAccessSecret)) &&
      !(await hasValidPreview(request.cookies.get(PREVIEW_COOKIE)?.value, previewToken))
    ) {
      return rewrite(request, BRAND_IMAGE, "teaser");
    }
    return next("open");
  }
  if (pathname === "/account") {
    const target = accountUrl();
    return target ? redirect(target, "open") : next("open");
  }

  const prelaunch = isPrelaunch(now);

  // 4. Preview skips the drop gate and the prelaunch.
  if (await hasValidPreview(request.cookies.get(PREVIEW_COOKIE)?.value, previewToken)) {
    if (!prelaunch && pathname === "/wachtlijst") return redirect(new URL("/sparkela-club", request.url), "preview");
    return next("preview");
  }

  // 5. Drop gate.
  const match = dropFor(pathname);
  if (match) {
    const { drop, teaser } = match;
    const teaserPath = `/drops/${drop.slug}/binnenkort`;
    const phase = getDropPhase(drop, now);
    if (phase === "verborgen" || phase === "early-access") {
      if (!(await isDropLocked(drop, request, now, earlyAccessSecret))) return next(teaser ? "teaser" : "early-access");
      return teaser ? next("teaser") : rewrite(request, teaserPath, "teaser");
    }
    if (teaser) return redirect(new URL(`/drops/${drop.slug}`, request.url), "open");
  }

  // 6. Prelaunch. The demo checkout is open to a visitor with early access to a drop in its early-access phase, so
  // the local early-access flow ends in the checkout instead of the waitlist (QA round 1; Shopify's checkout is
  // external and never passes here). /checkout is noindex, and the cart gate still refuses ordinary products.
  if (prelaunch) {
    if (PRELAUNCH_OPEN.has(pathname)) return next("open");
    if (pathname === "/checkout" && (await hasEarlyAccessNow(request, now, earlyAccessSecret))) return next("early-access");
    return rewrite(request, "/wachtlijst", "wachtlijst");
  }

  // 7. After the launch.
  if (pathname === "/wachtlijst") return redirect(new URL("/sparkela-club", request.url), "open");
  if (isKnownMissing(pathname)) return rewrite(request, NOT_FOUND_PATH, "open");
  return next("open");
}
