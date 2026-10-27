/**
 * localStorage access that never throws (port of CORVANE lib/storage.ts). Storage can be unavailable
 * (private mode, blocked site data, the server, prerender); callers get null or false instead, and the site
 * keeps working without it. The only module that touches window.localStorage (AGENTS.md, plan §21.1).
 */

export function readStorage(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

/** Parsed JSON, or null when the key is missing, storage is unavailable or the value is not valid JSON. */
export function readJson<T>(key: string): T | null {
  const raw = readStorage(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** False when storage is unavailable or the value cannot be serialised (cycles, BigInt). */
export function writeJson(key: string, value: unknown): boolean {
  try {
    return writeStorage(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

/** Every storage key of the site, in one place: prefix "sparkela:" and a version where the shape can change. */
export const storageKeys = {
  /** Local provider cart: { v: 1, lines, discountCode, giftWrap, note } (plan §7.4). The Shopify cart id is a cookie. */
  cart: "sparkela:cart:v1",
  /** Epoch ms of the last time the email-capture pill was shown (7-day cooldown, plan §13.11.1). */
  emailCaptureLastShown: "sparkela:email-capture:last-shown",
  /** Set after any successful sign-up (lib/subscription.ts); the pill never shows again. */
  emailCaptureSubscribed: "sparkela:email-capture:subscribed",
  /** Analytics consent choice (lib/analytics.ts). */
  consent: "sparkela:consent:v1",
} as const;

export type StorageKey = (typeof storageKeys)[keyof typeof storageKeys];
