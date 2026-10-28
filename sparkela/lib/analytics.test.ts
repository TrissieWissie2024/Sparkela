import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { money } from "@/lib/money";
import type { CartLine, DiscountCodeState } from "@/lib/types";
import { bo, cadeaukaart, lola, variantOf } from "@/tests/fixtures/catalog";

type AnalyticsModule = typeof import("./analytics");

/** A Map-backed localStorage; `broken` makes every call throw (private mode, blocked site data). */
function fakeStorage(broken = false) {
  const data = new Map<string, string>();
  const fail = () => {
    throw new Error("storage blocked");
  };
  return {
    data,
    getItem: (key: string) => (broken ? fail() : (data.get(key) ?? null)),
    setItem: (key: string, value: string) => (broken ? fail() : void data.set(key, value)),
    removeItem: (key: string) => (broken ? fail() : void data.delete(key)),
  };
}

interface FakeWindow {
  dataLayer?: unknown[];
  localStorage: ReturnType<typeof fakeStorage>;
  location: { hostname: string };
  listeners: Map<string, Set<(event: unknown) => void>>;
  addEventListener: (type: string, listener: (event: unknown) => void) => void;
  removeEventListener: (type: string, listener: (event: unknown) => void) => void;
}

function fakeWindow(storage = fakeStorage()): FakeWindow {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  return {
    localStorage: storage,
    location: { hostname: "www.sparkela.nl" },
    listeners,
    addEventListener: (type, listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(listener);
    },
    removeEventListener: (type, listener) => listeners.get(type)?.delete(listener),
  };
}

/** A fresh copy of the module (its consent state and Consent Mode flags are module-level). */
async function load(): Promise<AnalyticsModule> {
  vi.resetModules();
  return import("./analytics");
}

interface LineSpec {
  handle: string;
  title: string;
  unit: number;
  quantity: number;
  /** Line total after discounts, in cents. Default unit × quantity. */
  lineTotal?: number;
}

function line({ handle, title, unit, quantity, lineTotal }: LineSpec): CartLine {
  return {
    id: `local:${handle}`,
    merchandise: {
      variantId: `local:${handle}:1`,
      productId: `local:${handle}`,
      productHandle: handle,
      productTitle: title,
      variantTitle: "Goud",
      image: null,
      type: "oorbellen",
      isGiftCard: false,
      isGiftWrap: false,
      quantityAvailable: 10,
    },
    quantity,
    unitPrice: money(unit),
    subtotal: money(unit * quantity),
    discounts: [],
    total: money(lineTotal ?? unit * quantity),
    attributes: [],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("constants and amounts", () => {
  it("names the consent event with the sparkela prefix", async () => {
    const { OPEN_CONSENT_EVENT } = await load();
    expect(OPEN_CONSENT_EVENT).toBe("sparkela:open-consent");
  });

  it("converts integer cents to euros", async () => {
    const { centsToEuros } = await load();
    expect(centsToEuros(1495)).toBe(14.95);
    expect(centsToEuros(2995)).toBe(29.95);
    expect(centsToEuros(0)).toBe(0);
    expect(centsToEuros(5000)).toBe(50);
  });
});

describe("items and events", () => {
  it("builds an item with the variant title and the price in euros", async () => {
    const { productToItem } = await load();
    expect(productToItem(lola, variantOf(lola, "Zilver"), 2)).toEqual({
      item_id: "lola-chunky-hoops",
      item_name: "Lola chunky hoops",
      item_brand: "Sparkela",
      item_category: "oorbellen",
      item_variant: "Zilver",
      price: 19.95,
      quantity: 2,
    });
  });

  it("falls back to the lowest price without a variant, and has no item_variant then", async () => {
    const { productToItem } = await load();
    const item = productToItem(cadeaukaart, null, 1);
    expect(item.item_variant).toBeNull();
    expect(item.price).toBe(cadeaukaart.priceRange.min.cents / 100);
  });

  it("keeps a single colour variant as item_variant (the product has an option)", async () => {
    const { productToItem } = await load();
    expect(productToItem(bo, variantOf(bo), 1).item_variant).toBe("Goud");
  });

  it("drops item_variant for a product without options", async () => {
    const { productToItem } = await load();
    const plain = { ...bo, options: [] };
    expect(productToItem(plain, variantOf(bo), 1).item_variant).toBeNull();
  });

  it("builds view_item and add_to_cart with euro values", async () => {
    const { addToCartEvent, viewItemEvent } = await load();
    const view = viewItemEvent(lola, variantOf(lola, "Goud"));
    expect(view).toEqual({
      event: "view_item",
      ecommerce: { currency: "EUR", value: 19.95, items: [expect.objectContaining({ item_id: "lola-chunky-hoops", quantity: 1 })] },
    });
    const add = addToCartEvent(lola, variantOf(lola, "Goud"), 3);
    expect(add.event).toBe("add_to_cart");
    expect("ecommerce" in add && add.ecommerce.value).toBe(59.85);
  });

  it("maps cart lines and sends the value after discounts, with the applied code as coupon", async () => {
    const { beginCheckoutEvent, cartToItems } = await load();
    const lines = [
      line({ handle: "lola-chunky-hoops", title: "Lola chunky hoops", unit: 1995, quantity: 2, lineTotal: 3591 }),
      line({ handle: "bo-statement-druppels", title: "Bo grote druppels", unit: 2295, quantity: 1, lineTotal: 2066 }),
    ];
    const codes: DiscountCodeState[] = [
      { code: "OUDECODE", applicable: false, reason: "unknown" },
      { code: "WELKOM10", applicable: true, reason: "ok" },
    ];
    expect(cartToItems({ lines })).toEqual([
      expect.objectContaining({ item_id: "lola-chunky-hoops", item_variant: "Goud", price: 19.95, quantity: 2 }),
      expect.objectContaining({ item_id: "bo-statement-druppels", price: 22.95, quantity: 1 }),
    ]);
    const event = beginCheckoutEvent({ lines, discountCodes: codes });
    expect(event).toEqual({
      event: "begin_checkout",
      ecommerce: { currency: "EUR", value: 56.57, items: cartToItems({ lines }), coupon: "WELKOM10" },
    });
    const withoutCode = beginCheckoutEvent({ lines, discountCodes: [codes[0]] });
    expect("ecommerce" in withoutCode && "coupon" in withoutCode.ecommerce).toBe(false);
  });

  it("builds sign_up with the source as method", async () => {
    const { signUpEvent } = await load();
    expect(signUpEvent("wachtlijst")).toEqual({ event: "sign_up", method: "wachtlijst" });
  });
});

describe("track", () => {
  it("does nothing on the server", async () => {
    const { signUpEvent, track } = await load();
    expect(typeof window).toBe("undefined");
    expect(() => track(signUpEvent("popup"))).not.toThrow();
  });

  it("pushes onto window.dataLayer, also without consent, clearing the previous ecommerce object first", async () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    const { signUpEvent, track, viewItemEvent } = await load();
    track(viewItemEvent(lola, variantOf(lola, "Goud")));
    track(signUpEvent("footer"));
    expect(win.dataLayer).toEqual([
      { ecommerce: null },
      expect.objectContaining({ event: "view_item" }),
      { event: "sign_up", method: "footer" },
    ]);
  });

  it("never throws when the dataLayer is broken", async () => {
    vi.stubGlobal("window", {
      ...fakeWindow(),
      get dataLayer() {
        throw new Error("blocked");
      },
    });
    const { signUpEvent, track } = await load();
    expect(() => track(signUpEvent("club"))).not.toThrow();
  });
});

describe("decisions", () => {
  it("accepts only well-formed GTM container ids", async () => {
    const { isValidGtmId } = await load();
    expect(isValidGtmId("GTM-ABC123")).toBe(true);
    expect(isValidGtmId("GTM-AB12")).toBe(true);
    for (const id of ["", null, undefined, "GTM-", "GTM-abc123", "G-ABC123", "GTM-ABC", "GTM-ABCDEFGHIJKLM", "GTM-ABC123\"><script>"]) {
      expect(isValidGtmId(id)).toBe(false);
    }
  });

  it("loads the tag manager only when enabled, with a valid id and explicit consent", async () => {
    const { shouldLoadAnalytics } = await load();
    expect(shouldLoadAnalytics({ enabled: true, gtmId: "GTM-ABC123", consent: "granted" })).toBe(true);
    expect(shouldLoadAnalytics({ enabled: false, gtmId: "GTM-ABC123", consent: "granted" })).toBe(false);
    expect(shouldLoadAnalytics({ enabled: true, gtmId: null, consent: "granted" })).toBe(false);
    expect(shouldLoadAnalytics({ enabled: true, gtmId: "nope", consent: "granted" })).toBe(false);
    for (const consent of ["denied", null, undefined] as const) {
      expect(shouldLoadAnalytics({ enabled: true, gtmId: "GTM-ABC123", consent })).toBe(false);
    }
  });

  it("shows the banner only with analytics on, after storage was read, without a choice or when reopened", async () => {
    const { shouldShowConsentBanner } = await load();
    expect(shouldShowConsentBanner({ enabled: false, consent: null, reopened: true })).toBe(false);
    expect(shouldShowConsentBanner({ enabled: true, consent: undefined, reopened: true })).toBe(false);
    expect(shouldShowConsentBanner({ enabled: true, consent: null, reopened: false })).toBe(true);
    expect(shouldShowConsentBanner({ enabled: true, consent: "granted", reopened: false })).toBe(false);
    expect(shouldShowConsentBanner({ enabled: true, consent: "denied", reopened: false })).toBe(false);
    expect(shouldShowConsentBanner({ enabled: true, consent: "denied", reopened: true })).toBe(true);
  });

  it("encodes the container id in the script URL", async () => {
    const { gtmScriptUrl } = await load();
    expect(gtmScriptUrl("GTM-ABC123")).toBe("https://www.googletagmanager.com/gtm.js?id=GTM-ABC123");
  });
});

describe("consent store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T10:00:00+01:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is unknown on the server", async () => {
    const { getConsent, getServerConsent, setConsent, subscribeConsent } = await load();
    expect(getServerConsent()).toBeUndefined();
    expect(getConsent()).toBeNull();
    expect(() => setConsent("granted")).not.toThrow();
    expect(typeof subscribeConsent(() => {})).toBe("function");
  });

  it("stores the choice with a timestamp under sparkela:consent:v1 and notifies subscribers", async () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    const { getConsent, resetConsent, setConsent, subscribeConsent } = await load();
    const seen: Array<string | null> = [];
    const unsubscribe = subscribeConsent((value) => seen.push(value));
    expect(getConsent()).toBeNull();

    setConsent("granted");
    expect(JSON.parse(win.localStorage.data.get("sparkela:consent:v1") ?? "null")).toEqual({
      value: "granted",
      updatedAt: "2026-11-27T09:00:00.000Z",
    });
    expect(getConsent()).toBe("granted");

    resetConsent();
    expect(getConsent()).toBeNull();
    expect(seen).toEqual(["granted", null]);

    expect(win.listeners.get("storage")?.size).toBe(1);
    unsubscribe();
    expect(win.listeners.get("storage")?.size).toBe(0);
  });

  it("follows a change in another tab", async () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    const { subscribeConsent } = await load();
    const seen: Array<string | null> = [];
    subscribeConsent((value) => seen.push(value));
    win.localStorage.data.set("sparkela:consent:v1", JSON.stringify({ value: "denied", updatedAt: "x" }));
    win.listeners.get("storage")?.forEach((listener) => listener({ key: "sparkela:consent:v1" }));
    win.listeners.get("storage")?.forEach((listener) => listener({ key: "sparkela:cart:v1" }));
    expect(seen).toEqual(["denied"]);
  });

  it("reads a bare stored value and ignores garbage", async () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    const { getConsent } = await load();
    win.localStorage.data.set("sparkela:consent:v1", JSON.stringify("denied"));
    expect(getConsent()).toBe("denied");
    win.localStorage.data.set("sparkela:consent:v1", JSON.stringify({ value: "maybe" }));
    expect(getConsent()).toBeNull();
    win.localStorage.data.set("sparkela:consent:v1", "{not json");
    expect(getConsent()).toBeNull();
  });

  it("keeps the choice in memory for this page when storage is blocked", async () => {
    vi.stubGlobal("window", fakeWindow(fakeStorage(true)));
    const { getConsent, resetConsent, setConsent } = await load();
    setConsent("denied");
    expect(getConsent()).toBe("denied");
    resetConsent();
    expect(getConsent()).toBeNull();
  });
});

describe("Consent Mode", () => {
  it("pushes the defaults once, then an update only when the choice changes", async () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", { cookie: "" });
    const { initConsentMode, syncConsentMode } = await load();
    initConsentMode();
    initConsentMode();
    syncConsentMode(null);
    syncConsentMode("granted");
    syncConsentMode("granted");
    const commands = (win.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));
    expect(commands).toEqual([
      ["consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" }],
      ["consent", "update", { analytics_storage: "granted" }],
    ]);
    // Consent Mode commands are Arguments objects, as the official snippet pushes them.
    expect(Array.isArray(win.dataLayer?.[0])).toBe(false);
  });

  it("removes the Google Analytics cookies when consent is withdrawn", async () => {
    vi.stubGlobal("window", fakeWindow());
    const written: string[] = [];
    vi.stubGlobal("document", {
      get cookie() {
        return "_ga=GA1.1.1; _ga_ABC=GS1; _gid=x; sparkela_cart=keep; _gat=1";
      },
      set cookie(value: string) {
        written.push(value);
      },
    });
    const { syncConsentMode } = await load();
    syncConsentMode("granted");
    syncConsentMode("denied");
    const cleared = new Set(written.map((cookie) => cookie.split("=")[0]));
    expect([...cleared].sort()).toEqual(["_ga", "_ga_ABC", "_gat", "_gid"]);
    expect(written.some((cookie) => cookie.includes("domain=.sparkela.nl"))).toBe(true);
    expect(written.every((cookie) => cookie.includes("expires=Thu, 01 Jan 1970"))).toBe(true);
  });

  it("pushes the gtm.js start event once", async () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    const { startTagManager } = await load();
    startTagManager();
    startTagManager();
    expect(win.dataLayer).toEqual([{ "gtm.start": expect.any(Number), event: "gtm.js" }]);
  });
});
