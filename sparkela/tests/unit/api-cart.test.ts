import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/cart/route";
import { createShopifyCartAdapter } from "@/lib/commerce/cart/shopify-adapter";
import { resetCartMemo } from "@/lib/commerce/shopify/cart";
import type { CartByIdData, ShopifyCart } from "@/lib/commerce/shopify/mutations";
import { CartError, type CartResult } from "@/lib/commerce/types";
import { earlyAccessToken } from "@/lib/early-access";
import { resetRateLimits } from "@/lib/forms/rate-limit";
import { hashToken } from "@/lib/preview";
import { jsonResponse, shopifyData, shopifyFixture } from "@/tests/fixtures/shopify/load";

/**
 * app/api/cart/route.ts with lib/commerce/shopify/cart.ts and the Storefront API faked on the fixtures (docs/PLAN.md
 * §7.4, §15.6, §19.1): validation; the cookie set and read; VariantGate before every add (never the cached catalog);
 * an unknown variant → invalid; not-yet-available for a drop variant without the early-access cookie and ok with
 * it; a regular piece during the prelaunch → not-yet-available; the gift wrap goes with the last physical product;
 * `Cache-Control: private, no-store`. Plus lib/commerce/cart/shopify-adapter.ts talking to the route.
 */

const PREVIEW = "test-preview-token-0123456789abcdefghij";
const EA_SECRET = "test-early-access-secret-0123456789abcdef";
const TOKEN = "test-storefront-token-not-real-0123456789";
const ORIGIN = "https://sparkela.nl";

const PRELAUNCH = "2026-11-20T12:00:00+01:00";
const EARLY_ACCESS = "2026-11-26T12:00:00+01:00";
const LAUNCHED = "2026-11-27T12:00:00+01:00";

const NOOR_GOUD = "gid://shopify/ProductVariant/49012345600031";
const HOLIDAY_STER = "gid://shopify/ProductVariant/49012345600211";
const GIFT_WRAP = "gid://shopify/ProductVariant/49012345600251";
const UNKNOWN = "gid://shopify/ProductVariant/49099999999999";

const twoLines = (): ShopifyCart => cartOf("cart-two-lines");
const CART_ID = twoLines().id;

function cartOf(name: string): ShopifyCart {
  const cart = shopifyData<CartByIdData>(name).cart;
  if (!cart) throw new Error(`${name} has no cart`);
  return cart;
}

function payload(cart: ShopifyCart | null, extra: Record<string, unknown> = {}) {
  return { cart, userErrors: [], warnings: [], ...extra };
}

/* -------------------------------------------------------------------------- */
/* A fake Storefront API: answers per operation name, records every call      */
/* -------------------------------------------------------------------------- */

interface Call {
  operation: string;
  variables: Record<string, unknown>;
  headers: Record<string, string>;
}

type Handler = (variables: Record<string, unknown>) => unknown;

const GATE_NODES: Record<string, unknown> = {
  [NOOR_GOUD]: { id: NOOR_GOUD, product: { handle: "noor-dikke-ringetjes", tags: ["type:oorbellen", "nieuw"], isGiftCard: false } },
  [HOLIDAY_STER]: {
    id: HOLIDAY_STER,
    product: { handle: "holiday-ster-oorbellen", tags: ["drop:holiday-sparkle", "type:oorbellen"], isGiftCard: false },
  },
  [GIFT_WRAP]: { id: GIFT_WRAP, product: { handle: "cadeauverpakking", tags: ["type:cadeauverpakking", "verborgen"], isGiftCard: false } },
};

let calls: Call[] = [];
let handlers: Record<string, Handler> = {};

function defaultHandlers(): Record<string, Handler> {
  return {
    VariantGate: (variables) => ({ data: { nodes: (variables.ids as string[]).map((id) => GATE_NODES[id] ?? null) } }),
    CartById: () => ({ data: { cart: twoLines() } }),
    CartCreate: () => ({ data: { cartCreate: payload(twoLines()) } }),
    CartLinesAdd: () => ({ data: { cartLinesAdd: payload(twoLines()) } }),
    CartLinesUpdate: () => ({ data: { cartLinesUpdate: payload(twoLines()) } }),
    CartLinesRemove: () => ({ data: { cartLinesRemove: payload(cartOf("cart-empty")) } }),
    CartDiscountCodesUpdate: () => ({ data: { cartDiscountCodesUpdate: payload(cartOf("cart-welkom10")) } }),
    CartNoteUpdate: () => ({ data: { cartNoteUpdate: payload(twoLines()) } }),
    GiftWrapVariant: () => ({ data: { product: { variants: { nodes: [{ id: GIFT_WRAP, availableForSale: true }] } } } }),
  };
}

const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const { query, variables } = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
  const operation = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? "unknown";
  calls.push({ operation, variables, headers: init?.headers as Record<string, string> });
  const handler = handlers[operation];
  if (!handler) return jsonResponse({ errors: [{ message: `no fake for ${operation}` }] });
  const answer = handler(variables);
  return answer instanceof Response ? answer : jsonResponse(answer);
});

const operations = () => calls.map((call) => call.operation);
const callOf = (operation: string, index = 0) => calls.filter((call) => call.operation === operation)[index];

/* -------------------------------------------------------------------------- */
/* Requests                                                                   */
/* -------------------------------------------------------------------------- */

interface RequestOptions {
  cookies?: Record<string, string>;
  ip?: string;
  origin?: string;
}

function headersFor(options: RequestOptions, json: boolean): Headers {
  const headers = new Headers({ "x-forwarded-for": `${options.ip ?? "198.51.100.23"}, 10.0.0.1` });
  if (json) headers.set("content-type", "application/json");
  if (options.cookies) {
    headers.set(
      "cookie",
      Object.entries(options.cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
    );
  }
  return headers;
}

function get(options: RequestOptions = {}) {
  return GET(new NextRequest(`${options.origin ?? ORIGIN}/api/cart`, { headers: headersFor(options, false) }));
}

function post(body: unknown, options: RequestOptions = {}) {
  return POST(
    new NextRequest(`${options.origin ?? ORIGIN}/api/cart`, {
      method: "POST",
      headers: headersFor(options, true),
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

async function read(response: Response): Promise<CartResult> {
  return (await response.json()) as CartResult;
}

function setCookie(response: Response): string {
  return response.headers.getSetCookie().join("\n");
}

const withCart = { cookies: { sparkela_cart: CART_ID } };

function at(time: string): void {
  vi.stubEnv("SPARKELA_TEST_NOW", time);
}

beforeEach(() => {
  vi.stubEnv("COMMERCE_PROVIDER", "shopify");
  vi.stubEnv("SHOPIFY_STORE_DOMAIN", "sparkela-test.myshopify.com");
  vi.stubEnv("SHOPIFY_STOREFRONT_ACCESS_TOKEN", TOKEN);
  vi.stubEnv("SHOPIFY_STOREFRONT_TOKEN_TYPE", "private");
  vi.stubEnv("SPARKELA_TEST_CLOCK", "1");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("PRELAUNCH_BYPASS_TOKEN", PREVIEW);
  vi.stubEnv("EARLY_ACCESS_SECRET", EA_SECRET);
  at(LAUNCHED);
  calls = [];
  handlers = defaultHandlers();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  resetRateLimits();
  resetCartMemo();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe("provider and headers", () => {
  it("answers not-configured with the local provider, without calling Shopify", async () => {
    vi.stubEnv("COMMERCE_PROVIDER", "local");
    for (const response of [await get(withCart), await post({ op: "giftWrap", enabled: true }, withCart)]) {
      expect(response.status).toBe(503);
      expect(await read(response)).toEqual({ ok: false, error: "not-configured", cart: null });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("always answers with Cache-Control: private, no-store", async () => {
    for (const response of [await get(), await get(withCart), await post({ op: "nope" }), await post({ op: "note", note: "Hoi" }, withCart)]) {
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("content-type")).toContain("application/json");
    }
  });
});

describe("GET /api/cart", () => {
  it("is null without a cookie, without calling Shopify", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(await read(response)).toEqual({ ok: true, cart: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the cart of the cookie, uncached, with the buyer's IP", async () => {
    const response = await get(withCart);
    const result = await read(response);
    expect(result.ok).toBe(true);
    expect(result.cart?.lines).toHaveLength(2);
    expect(result.cart?.provider).toBe("shopify");
    expect(callOf("CartById").variables).toEqual({ id: CART_ID });
    expect(callOf("CartById").headers["Shopify-Storefront-Buyer-IP"]).toBe("198.51.100.23");
    expect(setCookie(response)).toBe("");
  });

  it("clears the cookie when Shopify no longer has the cart", async () => {
    handlers.CartById = () => ({ data: { cart: null } });
    const response = await get(withCart);
    expect(await read(response)).toEqual({ ok: true, cart: null });
    expect(setCookie(response)).toMatch(/sparkela_cart=;.*Max-Age=0/);
  });

  it("clears a cookie that is not a cart id, without calling Shopify", async () => {
    const response = await get({ cookies: { sparkela_cart: "<script>" } });
    expect(await read(response)).toEqual({ ok: true, cart: null });
    expect(setCookie(response)).toMatch(/sparkela_cart=;.*Max-Age=0/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers upstream (502) when Shopify fails, and logs only a code", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockImplementationOnce(async () => jsonResponse({ errors: [{ message: "Internal error" }] }));
    const response = await get(withCart);
    expect(response.status).toBe(502);
    expect(await read(response)).toEqual({ ok: false, error: "upstream", cart: null });
    expect(error).toHaveBeenCalledWith("cart-shopify-graphql");
  });
});

describe("POST validation (plan §15.6)", () => {
  const line = (variantId: string, quantity: number) => ({ variantId, quantity });
  const lineId = "gid://shopify/CartLine/0f3c2a6e-1b5d-4c8a-9e2f-7a1b3c5d7e91?cart=Z2Nw";
  const invalid: Array<[string, unknown]> = [
    ["not JSON", "{op:add"],
    ["no op", {}],
    ["unknown op", { op: "checkout" }],
    ["add without lines", { op: "add", lines: [] }],
    ["add with 11 lines", { op: "add", lines: Array.from({ length: 11 }, () => line(NOOR_GOUD, 1)) }],
    ["a local variant id", { op: "add", lines: [line("local:noor-dikke-ringetjes:1", 1)] }],
    ["a product id", { op: "add", lines: [line("gid://shopify/Product/9012345600003", 1)] }],
    ["quantity 0 on add", { op: "add", lines: [line(NOOR_GOUD, 0)] }],
    ["quantity 100", { op: "add", lines: [line(NOOR_GOUD, 100)] }],
    ["quantity 1.5", { op: "add", lines: [line(NOOR_GOUD, 1.5)] }],
    ["quantity as text", { op: "add", lines: [line(NOOR_GOUD, "1" as unknown as number)] }],
    ["update to -1", { op: "update", lines: [{ lineId, quantity: -1 }] }],
    ["update a variant id", { op: "update", lines: [{ lineId: NOOR_GOUD, quantity: 1 }] }],
    ["remove nothing", { op: "remove", lineIds: [] }],
    ["remove a bad id", { op: "remove", lineIds: ["gid://shopify/Cart/x"] }],
    ["6 codes", { op: "discount", codes: ["A", "B", "C", "D", "E", "F"] }],
    ["a code with a space inside", { op: "discount", codes: ["WEL KOM"] }],
    ["a code of 41 characters", { op: "discount", codes: ["A".repeat(41)] }],
    ["giftWrap as text", { op: "giftWrap", enabled: "true" }],
    ["a note of 201 characters", { op: "note", note: "x".repeat(201) }],
    ["a note that is no text", { op: "note", note: 5 }],
  ];

  it.each(invalid)("refuses %s with 400 invalid, without calling Shopify", async (_name, body) => {
    const response = await post(body, withCart);
    expect(response.status).toBe(400);
    expect(await read(response)).toEqual({ ok: false, error: "invalid", cart: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts update to 0 (remove) and a note of exactly 200 characters", async () => {
    expect((await post({ op: "update", lines: [{ lineId, quantity: 0 }] }, withCart)).status).toBe(200);
    expect((await post({ op: "note", note: "é".repeat(200) }, withCart)).status).toBe(200);
  });
});

describe("POST add", () => {
  it("runs VariantGate first, then creates the cart with the lines for NL and sets the cookie", async () => {
    const response = await post({ op: "add", lines: [{ variantId: NOOR_GOUD, quantity: 2 }] });
    expect(response.status).toBe(200);
    expect((await read(response)).ok).toBe(true);
    expect(operations()).toEqual(["VariantGate", "CartCreate"]);
    expect(callOf("VariantGate").variables).toEqual({ ids: [NOOR_GOUD] });
    expect(callOf("CartCreate").variables).toEqual({
      input: { lines: [{ merchandiseId: NOOR_GOUD, quantity: 2 }], buyerIdentity: { countryCode: "NL" } },
    });
    const cookie = setCookie(response);
    expect(cookie).toContain(`sparkela_cart=${encodeURIComponent(CART_ID)}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=864000/);
  });

  it("adds to the cart of the cookie, after a fresh VariantGate on every add", async () => {
    await post({ op: "add", lines: [{ variantId: NOOR_GOUD, quantity: 1 }] }, withCart);
    await post({ op: "add", lines: [{ variantId: NOOR_GOUD, quantity: 1, attributes: [{ key: "_bron", value: "stack" }] }] }, withCart);
    expect(operations()).toEqual(["VariantGate", "CartLinesAdd", "VariantGate", "CartLinesAdd"]);
    expect(callOf("CartLinesAdd", 1).variables).toEqual({
      cartId: CART_ID,
      lines: [{ merchandiseId: NOOR_GOUD, quantity: 1, attributes: [{ key: "_bron", value: "stack" }] }],
    });
  });

  it("refuses an unknown variant with invalid", async () => {
    const response = await post({ op: "add", lines: [{ variantId: UNKNOWN, quantity: 1 }] }, withCart);
    expect(response.status).toBe(400);
    expect(await read(response)).toEqual({ ok: false, error: "invalid", cart: null });
    expect(operations()).toEqual(["VariantGate"]);
  });

  it("refuses the gift wrap through add (only through giftWrap)", async () => {
    const response = await post({ op: "add", lines: [{ variantId: GIFT_WRAP, quantity: 1 }] }, withCart);
    expect(await read(response)).toEqual({ ok: false, error: "invalid", cart: null });
    expect(operations()).toEqual(["VariantGate"]);
  });

  it("refuses a drop variant in early access without the cookie, and adds it with the cookie", async () => {
    at(EARLY_ACCESS);
    const without = await post({ op: "add", lines: [{ variantId: HOLIDAY_STER, quantity: 1 }] });
    expect(without.status).toBe(409);
    expect(await read(without)).toEqual({ ok: false, error: "not-yet-available", cart: null });
    expect(operations()).toEqual(["VariantGate"]);

    const forged = await post({ op: "add", lines: [{ variantId: HOLIDAY_STER, quantity: 1 }] }, { cookies: { "sparkela_ea_holiday-sparkle": "nep-token-0123456789ab" } });
    expect((await read(forged)).ok).toBe(false);

    const token = await earlyAccessToken("holiday-sparkle", EA_SECRET);
    const allowed = await post({ op: "add", lines: [{ variantId: HOLIDAY_STER, quantity: 1 }] }, { cookies: { "sparkela_ea_holiday-sparkle": token } });
    expect(allowed.status).toBe(200);
    expect(operations().slice(-2)).toEqual(["VariantGate", "CartCreate"]);
  });

  it("refuses a regular piece during the prelaunch, also next to a drop piece with early access", async () => {
    at(PRELAUNCH);
    const regular = await post({ op: "add", lines: [{ variantId: NOOR_GOUD, quantity: 1 }] });
    expect(await read(regular)).toEqual({ ok: false, error: "not-yet-available", cart: null });

    at(EARLY_ACCESS);
    const token = await earlyAccessToken("holiday-sparkle", EA_SECRET);
    const mixed = await post(
      { op: "add", lines: [{ variantId: HOLIDAY_STER, quantity: 1 }, { variantId: NOOR_GOUD, quantity: 1 }] },
      { cookies: { "sparkela_ea_holiday-sparkle": token } },
    );
    expect(await read(mixed)).toEqual({ ok: false, error: "not-yet-available", cart: null });
    expect(operations()).not.toContain("CartCreate");
  });

  it("lets everything through with a valid preview cookie during the prelaunch", async () => {
    at(PRELAUNCH);
    const response = await post({ op: "add", lines: [{ variantId: NOOR_GOUD, quantity: 1 }] }, { cookies: { sparkela_preview: await hashToken(PREVIEW) } });
    expect(response.status).toBe(200);
    expect(operations()).toEqual(["VariantGate", "CartCreate"]);
  });

  it("allows a regular piece after the launch", async () => {
    const response = await post({ op: "add", lines: [{ variantId: NOOR_GOUD, quantity: 1 }] }, withCart);
    expect(response.status).toBe(200);
  });

  it("starts a new cart when the cart of the cookie no longer exists", async () => {
    handlers.CartLinesAdd = () => ({
      data: { cartLinesAdd: payload(null, { userErrors: [{ field: ["cartId"], message: "The specified cart does not exist.", code: "INVALID" }] }) },
    });
    handlers.CartById = () => ({ data: { cart: null } });
    const response = await post({ op: "add", lines: [{ variantId: NOOR_GOUD, quantity: 1 }] }, withCart);
    expect(response.status).toBe(200);
    expect(operations()).toEqual(["VariantGate", "CartLinesAdd", "CartById", "CartCreate"]);
    expect(setCookie(response)).toContain("sparkela_cart=");
  });

  it("maps userErrors to quantity-capped with the current cart", async () => {
    handlers.CartLinesAdd = () => shopifyFixture("cart-user-errors");
    const response = await post({ op: "add", lines: [{ variantId: NOOR_GOUD, quantity: 99 }] }, withCart);
    expect(response.status).toBe(409);
    const result = await read(response);
    expect(result).toMatchObject({ ok: false, error: "quantity-capped" });
    expect(result.cart?.lines).toHaveLength(2);
  });

  it("maps a stock warning to quantity-capped with a notice", async () => {
    handlers.CartLinesAdd = () => shopifyFixture("cart-warnings-stock");
    const result = await read(await post({ op: "add", lines: [{ variantId: NOOR_GOUD, quantity: 5 }] }, withCart));
    expect(result).toMatchObject({ ok: false, error: "quantity-capped" });
    expect(result.cart?.notices).toEqual([{ kind: "quantity-capped", title: "Bo grote druppels", max: 3 }]);
  });
});

describe("POST add: sold-out lines and no double adds (decision 200)", () => {
  const outOfStock = (lineIndex: number) => ({
    code: "MERCHANDISE_OUT_OF_STOCK",
    message: "The product is sold out.",
    target: twoLines().lines.nodes[lineIndex].id,
  });
  const withoutLine = (lineIndex: number): ShopifyCart => {
    const cart = twoLines();
    cart.lines.nodes = cart.lines.nodes.filter((_, index) => index !== lineIndex);
    return cart;
  };

  it("removes the sold-out line Shopify left in the cart, with a line-removed notice; unavailable when it was the only piece asked for", async () => {
    handlers.CartLinesAdd = () => ({ data: { cartLinesAdd: payload(twoLines(), { warnings: [outOfStock(0)] }) } });
    handlers.CartLinesRemove = () => ({ data: { cartLinesRemove: payload(withoutLine(0)) } });
    const response = await post({ op: "add", lines: [{ variantId: NOOR_GOUD, quantity: 1 }] }, withCart);
    const result = await read(response);
    expect(operations()).toEqual(["VariantGate", "CartLinesAdd", "CartLinesRemove"]);
    expect(callOf("CartLinesRemove").variables).toEqual({ cartId: CART_ID, lineIds: [twoLines().lines.nodes[0].id] });
    expect(result).toMatchObject({ ok: false, error: "unavailable" });
    expect(result.cart?.lines).toHaveLength(1);
    expect(result.cart?.notices).toContainEqual({ kind: "line-removed", title: "Noor dikke ringetjes" });
  });

  it("answers ok when what was asked for is in the cart and another line sold out", async () => {
    handlers.CartLinesAdd = () => ({ data: { cartLinesAdd: payload(twoLines(), { warnings: [outOfStock(1)] }) } });
    handlers.CartLinesRemove = () => ({ data: { cartLinesRemove: payload(withoutLine(1)) } });
    const result = await read(await post({ op: "add", lines: [{ variantId: NOOR_GOUD, quantity: 1 }] }, withCart));
    expect(result.ok).toBe(true);
    expect(result.cart?.lines.map((line) => line.merchandise.productTitle)).toEqual(["Noor dikke ringetjes"]);
    expect(result.cart?.notices).toContainEqual({ kind: "line-removed", title: "Nina chunky ring" });
  });

  it("never sends cartLinesAdd or cartCreate twice after a 5xx (Shopify may have run it)", async () => {
    handlers.CartLinesAdd = () => jsonResponse({}, 503);
    const added = await post({ op: "add", lines: [{ variantId: NOOR_GOUD, quantity: 1 }] }, withCart);
    expect(added.status).toBe(502);
    expect(operations()).toEqual(["VariantGate", "CartLinesAdd"]);

    calls = [];
    handlers.CartCreate = () => jsonResponse({}, 502);
    await post({ op: "add", lines: [{ variantId: NOOR_GOUD, quantity: 1 }] });
    expect(operations()).toEqual(["VariantGate", "CartCreate"]);
  });
});

describe("POST update, remove and the gift wrap rule", () => {
  const wrapOnly = (): ShopifyCart => {
    const cart = cartOf("cart-giftwrap-free");
    cart.lines.nodes = cart.lines.nodes.filter((node) => node.merchandise.product.handle === "cadeauverpakking");
    return cart;
  };

  it("removes the gift wrap when the last physical product goes", async () => {
    const before = cartOf("cart-giftwrap-free");
    const ketting = before.lines.nodes[0].id;
    const wrap = before.lines.nodes[1].id;
    let removes = 0;
    handlers.CartLinesRemove = () => {
      removes += 1;
      return { data: { cartLinesRemove: payload(removes === 1 ? wrapOnly() : cartOf("cart-empty")) } };
    };
    const response = await post({ op: "remove", lineIds: [ketting] }, withCart);
    const result = await read(response);
    expect(result.ok).toBe(true);
    expect(result.cart?.lines).toEqual([]);
    expect(result.cart?.giftWrap.selected).toBe(false);
    expect(operations()).toEqual(["CartLinesRemove", "CartLinesRemove"]);
    expect(callOf("CartLinesRemove", 0).variables).toEqual({ cartId: CART_ID, lineIds: [ketting] });
    expect(callOf("CartLinesRemove", 1).variables).toEqual({ cartId: CART_ID, lineIds: [wrap] });
  });

  it("removes the gift wrap too when the last physical product is updated to 0", async () => {
    handlers.CartLinesUpdate = () => ({ data: { cartLinesUpdate: payload(wrapOnly()) } });
    const lineId = cartOf("cart-giftwrap-free").lines.nodes[0].id;
    const result = await read(await post({ op: "update", lines: [{ lineId, quantity: 0 }] }, withCart));
    expect(result.ok).toBe(true);
    expect(operations()).toEqual(["CartLinesUpdate", "CartLinesRemove"]);
  });

  it("keeps the gift wrap at quantity 1", async () => {
    const tooMany = cartOf("cart-giftwrap-free");
    tooMany.lines.nodes[1].quantity = 3;
    handlers.CartLinesUpdate = (variables) => {
      const lines = variables.lines as Array<{ id: string; quantity: number }>;
      return { data: { cartLinesUpdate: payload(lines[0].quantity === 1 ? cartOf("cart-giftwrap-free") : tooMany) } };
    };
    const wrapLine = tooMany.lines.nodes[1].id;
    await post({ op: "update", lines: [{ lineId: wrapLine, quantity: 3 }] }, withCart);
    expect(operations()).toEqual(["CartLinesUpdate", "CartLinesUpdate"]);
    expect(callOf("CartLinesUpdate", 1).variables).toEqual({ cartId: CART_ID, lines: [{ id: wrapLine, quantity: 1 }] });
  });

  it("needs a cart for update and remove", async () => {
    const lineId = cartOf("cart-two-lines").lines.nodes[0].id;
    expect(await read(await post({ op: "update", lines: [{ lineId, quantity: 2 }] }))).toEqual({ ok: false, error: "invalid", cart: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST giftWrap", () => {
  it("adds the gift wrap variant (quantity 1) to a cart with a physical product", async () => {
    handlers.CartLinesAdd = () => ({ data: { cartLinesAdd: payload(cartOf("cart-giftwrap-free")) } });
    const result = await read(await post({ op: "giftWrap", enabled: true }, withCart));
    expect(result.ok).toBe(true);
    expect(result.cart?.giftWrap.selected).toBe(true);
    expect(operations()).toEqual(["CartById", "GiftWrapVariant", "CartLinesAdd"]);
    expect(callOf("CartLinesAdd").variables).toEqual({ cartId: CART_ID, lines: [{ merchandiseId: GIFT_WRAP, quantity: 1 }] });
  });

  it("refuses the gift wrap without a physical product", async () => {
    handlers.CartById = () => ({ data: { cart: cartOf("cart-giftcard-only") } });
    const response = await post({ op: "giftWrap", enabled: true }, withCart);
    expect(response.status).toBe(400);
    const result = await read(response);
    expect(result).toMatchObject({ ok: false, error: "invalid" });
    expect(result.cart?.lines).toHaveLength(1);
    expect(await read(await post({ op: "giftWrap", enabled: true }))).toEqual({ ok: false, error: "invalid", cart: null });
  });

  it("removes the gift wrap line when switched off", async () => {
    handlers.CartById = () => ({ data: { cart: cartOf("cart-giftwrap-free") } });
    handlers.CartLinesRemove = () => ({ data: { cartLinesRemove: payload(twoLines()) } });
    await post({ op: "giftWrap", enabled: false }, withCart);
    expect(operations()).toEqual(["CartById", "CartLinesRemove"]);
    expect(callOf("CartLinesRemove").variables).toEqual({ cartId: CART_ID, lineIds: [cartOf("cart-giftwrap-free").lines.nodes[1].id] });
  });

  it("does nothing when the gift wrap is already there, or already off", async () => {
    handlers.CartById = () => ({ data: { cart: cartOf("cart-giftwrap-free") } });
    expect((await read(await post({ op: "giftWrap", enabled: true }, withCart))).cart?.giftWrap.selected).toBe(true);
    handlers.CartById = () => ({ data: { cart: twoLines() } });
    expect((await read(await post({ op: "giftWrap", enabled: false }, withCart))).ok).toBe(true);
    expect(operations()).toEqual(["CartById", "CartById"]);
  });
});

describe("POST discount and note", () => {
  it("sends the full list of codes, trimmed and in upper case", async () => {
    const result = await read(await post({ op: "discount", codes: [" welkom10 ", "WELKOM10"] }, withCart));
    expect(callOf("CartDiscountCodesUpdate").variables).toEqual({ cartId: CART_ID, discountCodes: ["WELKOM10"] });
    expect(result.cart?.discountCodes).toEqual([{ code: "WELKOM10", applicable: true, reason: "ok" }]);
  });

  it("answers ok with applicable false when the code does not apply", async () => {
    handlers.CartDiscountCodesUpdate = () => ({ data: { cartDiscountCodesUpdate: payload(cartOf("cart-code-not-applicable")) } });
    const response = await post({ op: "discount", codes: ["WELKOM10"] }, withCart);
    expect(response.status).toBe(200);
    const result = await read(response);
    expect(result.ok).toBe(true);
    expect(result.cart?.discountCodes[0]).toMatchObject({ code: "WELKOM10", applicable: false });
  });

  it("creates a cart for a code before any product (the popup), and removes codes with []", async () => {
    const created = await post({ op: "discount", codes: ["WELKOM10"] });
    expect(callOf("CartCreate").variables).toEqual({ input: { discountCodes: ["WELKOM10"], buyerIdentity: { countryCode: "NL" } } });
    expect(setCookie(created)).toContain("sparkela_cart=");
    expect(await read(await post({ op: "discount", codes: [] }))).toEqual({ ok: true, cart: null });
    await post({ op: "discount", codes: [] }, withCart);
    expect(callOf("CartDiscountCodesUpdate").variables).toEqual({ cartId: CART_ID, discountCodes: [] });
  });

  it("strips HTML from the note", async () => {
    await post({ op: "note", note: "<b>Fijne</b> feestdagen <script>alert(1)</script>liefs" }, withCart);
    expect(callOf("CartNoteUpdate").variables).toEqual({ cartId: CART_ID, note: "Fijne feestdagen alert(1)liefs" });
  });
});

describe("rate limit (plan §15.7)", () => {
  it("allows 60 requests per minute per IP, then 429", async () => {
    for (let i = 0; i < 60; i += 1) expect((await get({ ip: "203.0.113.9" })).status).toBe(200);
    const limited = await get({ ip: "203.0.113.9" });
    expect(limited.status).toBe(429);
    expect(await read(limited)).toEqual({ ok: false, error: "rate-limited", cart: null });
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await get({ ip: "203.0.113.10" })).status).toBe(200);
  });
});

/* -------------------------------------------------------------------------- */
/* The browser adapter against the route                                      */
/* -------------------------------------------------------------------------- */

describe("createShopifyCartAdapter against /api/cart", () => {
  /** A browser: sends the cookies the route set, like `credentials: "same-origin"`. */
  function browser() {
    const jar = new Map<string, string>();
    const routeFetch = async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const options: RequestOptions = { cookies: Object.fromEntries(jar) };
      const response =
        (init?.method ?? "GET") === "POST" ? await post(String(init?.body), options) : await get(options);
      for (const cookie of response.headers.getSetCookie()) {
        const [pair] = cookie.split(";");
        const [name, value] = pair.split("=");
        // Kept as sent (URI-encoded), like a browser; the route decodes it.
        if (/Max-Age=0/i.test(cookie)) jar.delete(name);
        else jar.set(name, value);
      }
      return response;
    };
    return { jar, adapter: createShopifyCartAdapter({ fetch: routeFetch as typeof fetch }) };
  }

  it("reads, adds, applies a code and returns Shopify's checkout URL", async () => {
    const { jar, adapter } = browser();
    expect(await adapter.getCart()).toEqual({ ok: true, cart: null });
    await expect(adapter.getCheckoutUrl()).rejects.toEqual(new CartError("empty"));

    const added = await adapter.addToCart([{ variantId: NOOR_GOUD, quantity: 1 }]);
    expect(added.ok).toBe(true);
    expect(decodeURIComponent(jar.get("sparkela_cart") ?? "")).toBe(CART_ID);

    const applied = await adapter.applyDiscountCode(" welkom10 ");
    expect(applied.ok).toBe(true);
    expect(callOf("CartDiscountCodesUpdate").variables).toEqual({ cartId: CART_ID, discountCodes: ["WELKOM10"] });

    await adapter.removeDiscountCode("welkom10");
    expect(callOf("CartDiscountCodesUpdate", 1).variables).toEqual({ cartId: CART_ID, discountCodes: [] });

    expect(await adapter.getCheckoutUrl()).toMatch(/^https:\/\/sparkela\.myshopify\.com\/cart\/c\//);
  });

  it("answers code-invalid for a code that cannot exist, without a request", async () => {
    const { adapter } = browser();
    expect(await adapter.applyDiscountCode("WEL KOM!")).toEqual({ ok: false, error: "code-invalid", cart: null });
    expect(await adapter.applyDiscountCode("   ")).toEqual({ ok: false, error: "invalid", cart: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes a refusal of the route through", async () => {
    at(PRELAUNCH);
    const { adapter } = browser();
    expect(await adapter.addToCart([{ variantId: NOOR_GOUD, quantity: 1 }])).toEqual({ ok: false, error: "not-yet-available", cart: null });
  });

  it("cuts a long note to 200 characters before sending it", async () => {
    const { adapter } = browser();
    await adapter.setNote("a".repeat(250));
    expect(callOf("CartCreate").variables).toEqual({ input: { note: "a".repeat(200), buyerIdentity: { countryCode: "NL" } } });
  });

  it("resolves network for a failed request and upstream for an answer that is not a CartResult", async () => {
    const failing = createShopifyCartAdapter({ fetch: (async () => Promise.reject(new TypeError("Failed to fetch"))) as typeof fetch });
    expect(await failing.getCart()).toEqual({ ok: false, error: "network", cart: null });
    const html = createShopifyCartAdapter({ fetch: (async () => new Response("<html></html>", { status: 504 })) as typeof fetch });
    expect(await html.addToCart([{ variantId: NOOR_GOUD, quantity: 1 }])).toEqual({ ok: false, error: "upstream", cart: null });
    const odd = createShopifyCartAdapter({ fetch: (async () => jsonResponse({ ok: false, error: "teapot", cart: null })) as typeof fetch });
    expect(await odd.getCart()).toEqual({ ok: false, error: "upstream", cart: null });
  });

  it("sends GET without a body and POST as JSON to /api/cart, with a time-out", async () => {
    const spy = vi.fn(async () => jsonResponse({ ok: true, cart: null }));
    const adapter = createShopifyCartAdapter({ fetch: spy as unknown as typeof fetch });
    await adapter.getCart();
    await adapter.setGiftWrap(true);
    const [getUrl, getInit] = spy.mock.calls[0] as unknown as [string, RequestInit];
    const [postUrl, postInit] = spy.mock.calls[1] as unknown as [string, RequestInit];
    expect(getUrl).toBe("/api/cart");
    expect(getInit.method).toBe("GET");
    expect(getInit.body).toBeUndefined();
    expect(getInit.signal).toBeInstanceOf(AbortSignal);
    expect(postUrl).toBe("/api/cart");
    expect(postInit.method).toBe("POST");
    expect((postInit.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(JSON.parse(String(postInit.body))).toEqual({ op: "giftWrap", enabled: true });
  });
});
