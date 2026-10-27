import { readJson, removeStorage, storageKeys, writeJson } from "@/lib/storage";
import type {
  AnalyticsEvent,
  AnalyticsItem,
  Cart,
  Cents,
  ConsentValue,
  Product,
  SubscribeSource,
  Variant,
} from "@/lib/types";

/**
 * Analytics events and consent (docs/PLAN.md §13.6, §18.2). Client-safe: no server-only imports, and on the server
 * every function is a no-op (or returns the "unknown" answer).
 *
 * track() only pushes GA4-shaped objects onto window.dataLayer, an in-page array. Nothing leaves the browser from here
 * and this module never loads a script: components/consent/AnalyticsLoader inserts Google Tag Manager, and only when
 * shouldLoadAnalytics() says so (site.analytics.enabled, a valid container id and consent "granted"). Without a tag
 * manager the array just sits in the page, so track() may run before consent.
 *
 * Events and where they fire (plan §18.2):
 * - view_item: the product page (BuyBox), deferred with setTimeout(0) and cleared on cleanup.
 * - add_to_cart: CartProvider.addToCart after the cart answered.
 * - begin_checkout: checkout() in the cart.
 * - sign_up: SubscribeForm after every successful sign-up, `method` = the source. Nowhere else.
 *
 * Amounts: the domain works in integer cents; GA4 wants currency units. The conversion (cents / 100) happens only here,
 * in the builders below, so callers never do money maths for analytics.
 *
 * Consent: the visitor's choice lives in localStorage (storageKeys.consent, through lib/storage.ts);
 * components/consent/ConsentBanner asks for it. Consent Mode commands go onto the same dataLayer, so a tag manager that
 * loads later sees them in order.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/** Window event that reopens the consent banner (CookieSettingsButton dispatches it, ConsentBanner listens). */
export const OPEN_CONSENT_EVENT = "sparkela:open-consent";

const BRAND: AnalyticsItem["item_brand"] = "Sparkela";
const CURRENCY = "EUR" as const;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Integer cents to euros for GA4: 1495 → 14.95. */
export function centsToEuros(cents: Cents): number {
  return Math.round(cents) / 100;
}

/* -------------------------------------------------------------------------- */
/* Events                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Pushes one event onto window.dataLayer (created when missing). Ecommerce events are preceded by
 * { ecommerce: null }, which clears the previous ecommerce object (GA4 guidance). Does nothing on the server and never
 * throws: analytics must never break the shop.
 */
export function track(event: AnalyticsEvent): void {
  if (!isBrowser()) return;
  try {
    const dataLayer = (window.dataLayer ??= []);
    if ("ecommerce" in event) dataLayer.push({ ecommerce: null });
    dataLayer.push(event);
  } catch {
    // Analytics must never break the shop.
  }
}

/** The product fields an analytics item needs; a Product and a CatalogProduct both have them. */
export type AnalyticsProduct = Pick<Product, "handle" | "title" | "type" | "priceRange" | "options">;

/**
 * item_variant: the variant title ("Goud", "17", "€25"), or null for a product without options (one default variant,
 * as CartMerchandise.variantTitle).
 */
function variantName(product: AnalyticsProduct, variant: Variant | null): string | null {
  if (!variant || product.options.length === 0) return null;
  return variant.title;
}

/**
 * One GA4 item for a product (and the chosen variant, if any). Price: the variant's price, else the lowest price of
 * the product. Converted to euros here.
 */
export function productToItem(product: AnalyticsProduct, variant: Variant | null, quantity: number): AnalyticsItem {
  return {
    item_id: product.handle,
    item_name: product.title,
    item_brand: BRAND,
    item_category: product.type,
    item_variant: variantName(product, variant),
    price: centsToEuros(variant?.price.cents ?? product.priceRange.min.cents),
    quantity,
  };
}

/**
 * The GA4 items of a cart: one per line, at the line's unit price (before discounts). The gift wrap is not a line
 * (Cart.lines leaves it out) and is not sent.
 */
export function cartToItems(cart: Pick<Cart, "lines">): AnalyticsItem[] {
  return cart.lines.map((line) => ({
    item_id: line.merchandise.productHandle,
    item_name: line.merchandise.productTitle,
    item_brand: BRAND,
    item_category: line.merchandise.type,
    item_variant: line.merchandise.variantTitle,
    price: centsToEuros(line.unitPrice.cents),
    quantity: line.quantity,
  }));
}

/** view_item for a product page; value = the item's price. */
export function viewItemEvent(product: AnalyticsProduct, variant: Variant | null): AnalyticsEvent {
  const cents = variant?.price.cents ?? product.priceRange.min.cents;
  return {
    event: "view_item",
    ecommerce: { currency: CURRENCY, value: centsToEuros(cents), items: [productToItem(product, variant, 1)] },
  };
}

/** add_to_cart for what was really added; value = unit price × quantity. */
export function addToCartEvent(product: AnalyticsProduct, variant: Variant | null, quantity: number): AnalyticsEvent {
  const cents = (variant?.price.cents ?? product.priceRange.min.cents) * quantity;
  return {
    event: "add_to_cart",
    ecommerce: { currency: CURRENCY, value: centsToEuros(cents), items: [productToItem(product, variant, quantity)] },
  };
}

/**
 * begin_checkout for a cart. Value: the sum of the line totals after line discounts (stack discount, code), without
 * shipping. Coupon: the applied discount code, if any.
 */
export function beginCheckoutEvent(cart: Pick<Cart, "lines" | "discountCodes">): AnalyticsEvent {
  const cents = cart.lines.reduce((sum, line) => sum + line.total.cents, 0);
  const coupon = cart.discountCodes.find((code) => code.applicable)?.code;
  return {
    event: "begin_checkout",
    ecommerce: {
      currency: CURRENCY,
      value: centsToEuros(cents),
      items: cartToItems(cart),
      ...(coupon ? { coupon } : {}),
    },
  };
}

/** sign_up after a successful sign-up; method = where it happened. */
export function signUpEvent(source: SubscribeSource): AnalyticsEvent {
  return { event: "sign_up", method: source };
}

/* -------------------------------------------------------------------------- */
/* Consent                                                                     */
/* -------------------------------------------------------------------------- */

export type { ConsentValue };

/**
 * Consent as a component sees it: `undefined` until the browser has read storage (server render and hydration),
 * `null` while the visitor has not chosen, otherwise the choice.
 */
export type ConsentSnapshot = ConsentValue | null | undefined;

interface StoredConsent {
  value: ConsentValue;
  /** ISO timestamp of the choice. */
  updatedAt: string;
}

type ConsentListener = (value: ConsentValue | null) => void;

const consentListeners = new Set<ConsentListener>();

/**
 * A choice that storage could not keep (private mode, blocked storage). It holds for the rest of this page session, so
 * the banner does not stay open after a click; the next full page load asks again.
 */
let unsavedConsent: ConsentValue | null = null;

function isConsentValue(value: unknown): value is ConsentValue {
  return value === "granted" || value === "denied";
}

/** The stored analytics consent, or null when the visitor has not chosen (or on the server). */
export function getConsent(): ConsentValue | null {
  if (!isBrowser()) return null;
  const stored = readJson<unknown>(storageKeys.consent);
  if (isConsentValue(stored)) return stored;
  if (typeof stored === "object" && stored !== null && isConsentValue((stored as StoredConsent).value)) {
    return (stored as StoredConsent).value;
  }
  return unsavedConsent;
}

/** Server snapshot for useSyncExternalStore: storage is unknown before hydration. */
export function getServerConsent(): ConsentSnapshot {
  return undefined;
}

function notifyConsent(): void {
  const value = getConsent();
  consentListeners.forEach((listener) => listener(value));
}

/** Stores the visitor's choice and notifies subscribers. Call from an event handler (it reads the clock). */
export function setConsent(value: ConsentValue): void {
  if (!isBrowser() || !isConsentValue(value)) return;
  const record: StoredConsent = { value, updatedAt: new Date().toISOString() };
  unsavedConsent = writeJson(storageKeys.consent, record) ? null : value;
  notifyConsent();
}

/** Forgets the choice (the banner asks again) and notifies subscribers. */
export function resetConsent(): void {
  if (!isBrowser()) return;
  removeStorage(storageKeys.consent);
  unsavedConsent = null;
  notifyConsent();
}

function onStorage(event: StorageEvent): void {
  if (event.key === null || event.key === storageKeys.consent) notifyConsent();
}

/**
 * Calls `listener` whenever consent changes, in this tab or another one. Returns an unsubscribe function. Fits
 * useSyncExternalStore directly: useSyncExternalStore<ConsentSnapshot>(subscribeConsent, getConsent, getServerConsent).
 */
export function subscribeConsent(listener: ConsentListener): () => void {
  if (!isBrowser()) return () => {};
  if (consentListeners.size === 0) window.addEventListener("storage", onStorage);
  consentListeners.add(listener);
  return () => {
    consentListeners.delete(listener);
    if (consentListeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/* -------------------------------------------------------------------------- */
/* Decisions (pure)                                                            */
/* -------------------------------------------------------------------------- */

/** A Google Tag Manager container id: "GTM-" and 4 to 12 upper-case letters or digits. */
const GTM_ID = /^GTM-[A-Z0-9]{4,12}$/;

/** True for a well-formed container id. Anything else never reaches a script URL. */
export function isValidGtmId(id: string | null | undefined): id is string {
  return typeof id === "string" && GTM_ID.test(id);
}

export interface AnalyticsLoadInput {
  /** site.analytics.enabled */
  enabled: boolean;
  /** site.analytics.gtmId */
  gtmId: string | null;
  consent: ConsentSnapshot;
}

/**
 * Whether the tag manager may load: analytics switched on, a valid container id and an explicit "granted". Unknown
 * (undefined), no choice (null) and "denied" all mean no.
 */
export function shouldLoadAnalytics({ enabled, gtmId, consent }: AnalyticsLoadInput): boolean {
  return enabled === true && isValidGtmId(gtmId) && consent === "granted";
}

export interface ConsentBannerInput {
  /** site.analytics.enabled */
  enabled: boolean;
  consent: ConsentSnapshot;
  /** The visitor asked for it again (CookieSettingsButton, OPEN_CONSENT_EVENT). */
  reopened: boolean;
}

/**
 * Whether the consent banner shows: only with analytics switched on, never before storage was read (no flash for
 * visitors who already chose), then while there is no choice or after a reopen.
 */
export function shouldShowConsentBanner({ enabled, consent, reopened }: ConsentBannerInput): boolean {
  if (!enabled || consent === undefined) return false;
  return consent === null || reopened;
}

/** The Google Tag Manager script URL. Only call with an id that passed isValidGtmId(). */
export function gtmScriptUrl(id: string): string {
  return `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
}

/* -------------------------------------------------------------------------- */
/* Consent Mode and tag manager start                                          */
/* -------------------------------------------------------------------------- */

/*
 * Called by components/consent/AnalyticsLoader, only when analytics is switched on with a valid container id. All of
 * it is pushes onto the local dataLayer; nothing is sent until the tag manager script itself loads. Order: defaults
 * (all denied), then an update for analytics_storage, then the gtm.js start event, then the script.
 */

const consentMode: { initialized: boolean; analytics: ConsentValue; started: boolean } = {
  initialized: false,
  analytics: "denied",
  started: false,
};

/**
 * Google's gtag() helper. Consent Mode commands only count as an Arguments object (not an array), exactly as the
 * official snippet pushes them.
 */
const gtag: (...args: unknown[]) => void = function gtag() {
  try {
    // eslint-disable-next-line prefer-rest-params
    (window.dataLayer ??= []).push(arguments);
  } catch {
    // Analytics must never break the shop.
  }
};

/** Consent Mode defaults, once per page: everything denied. The shop never asks for advertising consent. */
export function initConsentMode(): void {
  if (!isBrowser() || consentMode.initialized) return;
  consentMode.initialized = true;
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
}

/**
 * Brings analytics_storage in line with the visitor's choice (no choice counts as denied). Pushes an update only when
 * the state changes. When consent is withdrawn after it was granted, the Google Analytics cookies are removed as well.
 */
export function syncConsentMode(consent: ConsentValue | null): void {
  if (!isBrowser()) return;
  initConsentMode();
  const next: ConsentValue = consent === "granted" ? "granted" : "denied";
  if (next === consentMode.analytics) return;
  consentMode.analytics = next;
  gtag("consent", "update", { analytics_storage: next });
  if (next === "denied") clearAnalyticsCookies();
}

/** The "gtm.js" start event the tag manager expects before its script runs. Once per page; call from an effect. */
export function startTagManager(): void {
  if (!isBrowser() || consentMode.started) return;
  consentMode.started = true;
  try {
    (window.dataLayer ??= []).push({ "gtm.start": Date.now(), event: "gtm.js" });
  } catch {
    // Analytics must never break the shop.
  }
}

/** First-party cookies Google Analytics sets: _ga, _ga_<id>, _gid, _gat, _gat_<id>. */
const ANALYTICS_COOKIE = /^(_ga|_gid|_gat)(_|$)/;

/**
 * Expires the Google Analytics cookies on this host and its parent domains. Only touches what a tag manager left
 * behind; the shop's own functional cookies (cart, preview, early access) are not analytics cookies.
 */
export function clearAnalyticsCookies(): void {
  if (!isBrowser()) return;
  try {
    const labels = window.location.hostname.split(".");
    const domains = [""];
    for (let index = 0; index < labels.length - 1; index += 1) {
      domains.push(`; domain=.${labels.slice(index).join(".")}`);
    }
    for (const entry of document.cookie.split(";")) {
      const name = entry.split("=")[0]?.trim() ?? "";
      if (!ANALYTICS_COOKIE.test(name)) continue;
      for (const domain of domains) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
      }
    }
  } catch {
    // Cookies can be blocked; there is nothing to clear then.
  }
}
