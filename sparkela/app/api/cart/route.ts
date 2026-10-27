import { NextResponse, type NextRequest } from "next/server";

import { serverNow } from "@/lib/clock";
import type { GateContext } from "@/lib/commerce/cart-gate";
import {
  CART_COOKIE,
  CART_COOKIE_MAX_AGE,
  CART_RATE_LIMIT,
  isCartId,
  isShopifyCartEnabled,
  parseCartRequest,
  readCart,
  runCartRequest,
  type CartOutcome,
  type CartRequestContext,
} from "@/lib/commerce/shopify/cart";
import { ShopifyError, ShopifyNotConfiguredError } from "@/lib/commerce/shopify/config";
import type { CartErrorCode, CartResult } from "@/lib/commerce/types";
import { CART_DEADLINE_MS } from "@/lib/deadline";
import { earlyAccessCookieName, isValidEarlyAccess } from "@/lib/early-access";
import { readSecret } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/forms/rate-limit";
import { hasValidPreview, PREVIEW_COOKIE } from "@/lib/preview";
import type { DropSlug } from "@/lib/types";
import { drops } from "@/content/drops";
import { site } from "@/content/site";

/**
 * /api/cart (docs/PLAN.md §7.4, §15.6, §15.7; decisions 71, 87): the Shopify cart of this visitor. Only with
 * COMMERCE_PROVIDER=shopify; with the local provider every request answers "not-configured" (503).
 *
 * - GET: the cart from the httpOnly cookie sparkela_cart (null without one; a cart that no longer exists clears the
 *   cookie). POST: one CartRequest (§7.1), validated (400 "invalid" otherwise), then lib/commerce/shopify/cart.ts.
 * - The add gate (cart-gate.ts) gets the time from serverNow() (the test clock works here) and the cookies
 *   sparkela_preview and sparkela_ea_<slug>, checked with lib/preview.ts and lib/early-access.ts.
 * - 60 requests per minute per IP (429 "rate-limited").
 * - Every answer is a CartResult with `Cache-Control: private, no-store`. Status: 200 ok; 400 invalid; 409 for a
 *   refusal that keeps the cart (unavailable, quantity-capped, not-yet-available); 429; 502 upstream; 503
 *   not-configured. The adapter reads the body whatever the status.
 * - Logs carry a fixed code, never a cart id, IP or personal data.
 * Reading cookies and the body makes both handlers dynamic (ƒ); no segment config is needed or allowed.
 */

const STATUS: Record<CartErrorCode, number> = {
  invalid: 400,
  "rate-limited": 429,
  "not-configured": 503,
  upstream: 502,
  network: 502,
  unavailable: 409,
  "not-yet-available": 409,
  "quantity-capped": 409,
  "code-invalid": 409,
  empty: 409,
};

/** Largest POST body read (10 lines with attributes stay far below this). */
const MAX_BODY_CHARS = 20_000;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const IP = /^[0-9A-Fa-f:.]{3,45}$/;

function failure(error: CartErrorCode): CartOutcome {
  return { result: { ok: false, error, cart: null } };
}

/** The visitor's IP for Shopify-Storefront-Buyer-IP: the first x-forwarded-for address (Vercel), or x-real-ip. */
function buyerIpOf(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip")?.trim() || "";
  return IP.test(candidate) ? candidate : null;
}

/** Secure cookies everywhere except plain http on localhost (as proxy.ts does for the preview cookie). */
function isSecure(request: NextRequest): boolean {
  return !(request.nextUrl.protocol === "http:" && LOCAL_HOSTS.has(request.nextUrl.hostname));
}

async function gateContext(request: NextRequest, now: number): Promise<GateContext> {
  const hasPreview = await hasValidPreview(request.cookies.get(PREVIEW_COOKIE)?.value, readSecret("PRELAUNCH_BYPASS_TOKEN"));
  const secret = readSecret("EARLY_ACCESS_SECRET");
  const earlyAccessSlugs: DropSlug[] = [];
  for (const drop of drops) {
    const cookie = request.cookies.get(earlyAccessCookieName(drop.slug))?.value;
    if (cookie && (await isValidEarlyAccess(drop.slug, cookie, secret))) earlyAccessSlugs.push(drop.slug);
  }
  return { now, hasPreview, earlyAccessSlugs, drops, launchAt: site.launchAt };
}

function respond(request: NextRequest, outcome: CartOutcome, extraHeaders?: Record<string, string>): NextResponse<CartResult> {
  const status = outcome.result.ok ? 200 : STATUS[outcome.result.error];
  const response = NextResponse.json(outcome.result, {
    status,
    headers: { "Cache-Control": "private, no-store", ...extraHeaders },
  });
  if (outcome.cookie !== undefined) {
    response.cookies.set(CART_COOKIE, outcome.cookie ?? "", {
      httpOnly: true,
      secure: isSecure(request),
      sameSite: "lax",
      path: "/",
      maxAge: outcome.cookie === null ? 0 : CART_COOKIE_MAX_AGE,
    });
  }
  return response;
}

function logCode(error: unknown): string {
  if (error instanceof ShopifyNotConfiguredError) return "cart-not-configured";
  if (error instanceof ShopifyError) return `cart-shopify-${error.code}`;
  return "cart-unknown-error";
}

async function handle(
  request: NextRequest,
  run: (ctx: CartRequestContext) => Promise<CartOutcome>,
): Promise<NextResponse<CartResult>> {
  // One budget for the whole request, below the browser's 10 s time-out (lib/deadline.ts, decision 198).
  const deadline = Date.now() + CART_DEADLINE_MS;
  // The rate limit reads the request headers first, so GET is never prerendered, also with the local provider (ƒ).
  const limit = rateLimit(clientKey(request, "cart"), CART_RATE_LIMIT);
  if (!limit.ok) {
    return respond(request, failure("rate-limited"), { "Retry-After": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))) });
  }
  if (!isShopifyCartEnabled()) return respond(request, failure("not-configured"));

  const rawCookie = request.cookies.get(CART_COOKIE)?.value ?? null;
  const cartId = isCartId(rawCookie) ? rawCookie : null;
  const now = serverNow();
  const ctx: CartRequestContext = {
    cartId,
    buyerIp: buyerIpOf(request),
    now,
    gate: () => gateContext(request, now),
    deadline,
  };

  let outcome: CartOutcome;
  try {
    outcome = await run(ctx);
  } catch (error) {
    console.error(logCode(error));
    outcome = failure(error instanceof ShopifyNotConfiguredError ? "not-configured" : "upstream");
  }
  // A cookie that is not a cart id is cleared.
  if (rawCookie !== null && cartId === null && outcome.cookie === undefined) outcome = { ...outcome, cookie: null };
  return respond(request, outcome);
}

async function readBody(request: NextRequest): Promise<unknown> {
  try {
    const raw = await request.text();
    if (raw.length === 0 || raw.length > MAX_BODY_CHARS) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<CartResult>> {
  return handle(request, readCart);
}

export async function POST(request: NextRequest): Promise<NextResponse<CartResult>> {
  return handle(request, async (ctx) => {
    const cartRequest = parseCartRequest(await readBody(request));
    return cartRequest ? runCartRequest(cartRequest, ctx) : failure("invalid");
  });
}
