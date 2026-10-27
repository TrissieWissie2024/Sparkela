/**
 * The preview link (docs/PLAN.md §11.4, decision 19): `?preview=<PRELAUNCH_BYPASS_TOKEN>` lets Linde and Tristan see
 * the whole shop before the launch and every drop before its start. proxy.ts sets the cookie, proxy.ts and
 * /api/cart (cart gate, §7.4) check it.
 *
 * The cookie holds the hex SHA-256 of the token, never the token itself, and the token never stays in the URL after
 * the redirect. Comparisons run in constant time. Without a token (PRELAUNCH_BYPASS_TOKEN missing or shorter than 32
 * characters, lib/env.ts readSecret) preview never works: fail closed.
 *
 * Pure Web Crypto (crypto.subtle): no next/* and no node:* imports, so proxy.ts, route handlers and Vitest share it.
 */

/** httpOnly cookie with sha256(token) in hex. */
export const PREVIEW_COOKIE = "sparkela_preview";

/** Query parameter of the preview link. */
export const PREVIEW_PARAM = "preview";

/** 30 days, in seconds. */
export const PREVIEW_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Hex SHA-256 of the token (64 characters): the value of the preview cookie. */
export async function hashToken(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
}

/**
 * Constant-time comparison of two strings. The loop always runs over the longer input, so the time does not reveal
 * where the first difference is; a length difference makes the result false without an early exit.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** True when the cookie holds sha256(token). False without a token or a cookie (fail closed). */
export async function hasValidPreview(cookieValue: string | null | undefined, token: string | null): Promise<boolean> {
  if (!token || !cookieValue) return false;
  return timingSafeEqualString(cookieValue, await hashToken(token));
}

/**
 * True when the `?preview=` value equals the token. Both sides are hashed first, so the comparison always runs over
 * 64 characters, whatever the visitor typed.
 */
export async function isPreviewToken(given: string | null | undefined, token: string | null): Promise<boolean> {
  if (!token || !given) return false;
  const [a, b] = await Promise.all([hashToken(given), hashToken(token)]);
  return timingSafeEqualString(a, b);
}
