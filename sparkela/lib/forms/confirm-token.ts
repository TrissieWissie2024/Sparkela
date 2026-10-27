import { readSecret } from "@/lib/env";

/**
 * The token of the double opt-in link (docs/PLAN.md §15.2 step 5, §15.3, decisions 74 and 110):
 * `base64url(JSON { c, t, g? })` + "." + `base64url(HMAC-SHA256(NEWSLETTER_CONFIRM_SECRET, payload))`, where `c` is
 * the numeric part of the Shopify customer GID, `t` the creation time in epoch ms and `g` the sign-up's tags ("club",
 * "bron:…", "quiz:…") for an existing customer: those are only added after the double opt-in (decision 199). Valid for
 * 7 days.
 *
 * The token holds a customer id, never an e-mail address: the link ends up in server logs, browser history and (with
 * analytics) page_location, and ConfirmSubscription removes it from the address bar right after reading it.
 * Web Crypto only (HMAC-SHA256 via crypto.subtle) and a constant-time comparison of the signature.
 */

export const CONFIRM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Tokens from the future beyond this (clock skew between instances) are invalid. */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const CUSTOMER_GID_PREFIX = "gid://shopify/Customer/";
const NUMERIC_ID = /^\d{1,20}$/;

export type ConfirmTokenResult = { customerId: string; tags: string[] } | "invalid" | "expired";

/** The tags a token may carry: what newsletterTags() (lib/commerce/shopify/admin.ts) makes, nothing else. */
const TOKEN_TAG = /^(?:club|bron:[a-z-]{1,20}|quiz:(?:vibe|moment|type)-[a-z0-9-]{1,40})$/;
const MAX_TOKEN_TAGS = 5;

function isTokenTags(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_TOKEN_TAGS &&
    value.every((tag) => typeof tag === "string" && TOKEN_TAG.test(tag))
  );
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toBase64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

function equalInConstantTime(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function requireSecret(secret: string | undefined): string {
  const value = secret ?? readSecret("NEWSLETTER_CONFIRM_SECRET");
  if (!value) throw new Error("NEWSLETTER_CONFIRM_SECRET is missing or shorter than 32 characters.");
  return value;
}

/** "gid://shopify/Customer/7001" → "7001"; null for anything else. */
export function customerIdFromGid(gid: string): string | null {
  if (!gid.startsWith(CUSTOMER_GID_PREFIX)) return null;
  const id = gid.slice(CUSTOMER_GID_PREFIX.length);
  return NUMERIC_ID.test(id) ? id : null;
}

/** "7001" → "gid://shopify/Customer/7001". */
export function customerGid(customerId: string): string {
  return `${CUSTOMER_GID_PREFIX}${customerId}`;
}

/**
 * A signed token for the confirmation link. `customerId` is the numeric id (or the full GID). `secret` defaults to
 * NEWSLETTER_CONFIRM_SECRET; the route checks it first and answers "not-configured" without it. `tags` are added to
 * the customer on confirmation (an existing customer's tags are never changed before the double opt-in).
 */
export async function createConfirmToken(
  customerId: string,
  now: number,
  secret?: string,
  tags: readonly string[] = [],
): Promise<string> {
  const id = customerIdFromGid(customerId) ?? customerId;
  if (!NUMERIC_ID.test(id)) throw new Error("createConfirmToken needs a numeric Shopify customer id.");
  if (!isTokenTags([...tags])) throw new Error("createConfirmToken only carries newsletter tags.");
  const content = tags.length > 0 ? { c: id, t: now, g: [...tags] } : { c: id, t: now };
  const payload = toBase64url(encoder.encode(JSON.stringify(content)));
  return `${payload}.${await sign(payload, requireSecret(secret))}`;
}

/**
 * Checks the signature first (constant time), then the content and the age. A forged, malformed or foreign token is
 * "invalid"; a genuine token older than 7 days is "expired".
 */
export async function verifyConfirmToken(token: string, now: number, secret?: string): Promise<ConfirmTokenResult> {
  const key = requireSecret(secret);
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return "invalid";
  const [payload, signature] = parts;
  if (!equalInConstantTime(signature, await sign(payload, key))) return "invalid";

  const bytes = fromBase64url(payload);
  if (bytes === null) return "invalid";
  let data: unknown;
  try {
    data = JSON.parse(decoder.decode(bytes)) as unknown;
  } catch {
    return "invalid";
  }
  if (typeof data !== "object" || data === null) return "invalid";
  const { c, t, g } = data as { c?: unknown; t?: unknown; g?: unknown };
  if (typeof c !== "string" || !NUMERIC_ID.test(c) || typeof t !== "number" || !Number.isFinite(t)) return "invalid";
  if (g !== undefined && !isTokenTags(g)) return "invalid";
  if (t > now + MAX_CLOCK_SKEW_MS) return "invalid";
  if (now - t > CONFIRM_TOKEN_TTL_MS) return "expired";
  return { customerId: c, tags: g ?? [] };
}

/** Hex SHA-256 of a value: the Idempotency-Key of the confirmation mail is `subscribe-<sha256(token)>` (decision 111). */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
