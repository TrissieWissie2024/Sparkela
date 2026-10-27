import type { DropSlug } from "@/lib/types";

/**
 * Early access for Club members (docs/PLAN.md §11.5, decision 20). The Club mail links to
 * `https://sparkela.nl/drops/<slug>?toegang=<token>`; proxy.ts checks the token, sets the cookie `sparkela_ea_<slug>`
 * (= the token, until the drop's endsAt) and redirects without the parameter. The cookie opens the drop page and the
 * product pages of that drop 24 hours before the public start, also during the prelaunch; /api/cart checks the same
 * cookie (cart gate, §7.4).
 *
 * Token = the first 22 characters of base64url(HMAC-SHA256(EARLY_ACCESS_SECRET, "ea:" + slug)): one token per drop
 * for every Club member. A leaked token gives at most 24 hours of early access to one drop, which is acceptable.
 * Without a secret (missing or shorter than 32 characters) early access never works: fail closed.
 *
 * Pure Web Crypto and only type imports, so proxy.ts, /api/cart, Vitest and scripts/early-access-link.mjs (plain
 * Node with type stripping) all use this one implementation.
 */

/** Query parameter of the early-access link. */
export const EARLY_ACCESS_PARAM = "toegang";

/** Prefix of the per-drop cookie: sparkela_ea_<slug>. */
export const EARLY_ACCESS_COOKIE_PREFIX = "sparkela_ea_";

/** Length of the token (22 base64url characters, 132 bits). */
export const EARLY_ACCESS_TOKEN_LENGTH = 22;

const encoder = new TextEncoder();

/** Cookie name for a drop: "sparkela_ea_holiday-sparkle". */
export function earlyAccessCookieName(slug: DropSlug | string): string {
  return `${EARLY_ACCESS_COOKIE_PREFIX}${slug}`;
}

function base64url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The token of a drop: stable per slug and secret, different for every other slug or secret. */
export async function earlyAccessToken(slug: DropSlug | string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`ea:${slug}`));
  return base64url(signature).slice(0, EARLY_ACCESS_TOKEN_LENGTH);
}

/** Constant-time comparison (same loop as lib/preview.ts timingSafeEqualString; kept here so this file has no imports). */
function equalInConstantTime(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/**
 * True when `value` (the cookie, or the `?toegang=` parameter) is the token of this drop. False without a secret or a
 * value (fail closed).
 */
export async function isValidEarlyAccess(
  slug: DropSlug | string,
  value: string | null | undefined,
  secret: string | null,
): Promise<boolean> {
  if (!secret || !value) return false;
  return equalInConstantTime(value, await earlyAccessToken(slug, secret));
}

/**
 * The link for the Club mail: `${siteUrl}/drops/<slug>?toegang=<token>`. `siteUrl` is the origin without a trailing
 * slash (lib/env.ts getEnv().siteUrl). Used by `npm run early-access-link -- <slug>` (scripts/early-access-link.mjs).
 * The secret and the origin are arguments, so this module needs no runtime import (plan §11.5 had one argument).
 */
export async function earlyAccessLink(slug: DropSlug | string, secret: string, siteUrl: string): Promise<string> {
  const token = await earlyAccessToken(slug, secret);
  const origin = siteUrl.replace(/\/+$/, "");
  return `${origin}/drops/${encodeURIComponent(slug)}?${EARLY_ACCESS_PARAM}=${token}`;
}
