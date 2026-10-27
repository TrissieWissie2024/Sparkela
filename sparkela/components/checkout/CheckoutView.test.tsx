import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createLocalCartAdapter } from "@/lib/commerce/cart/local-adapter";
import type { CartResult } from "@/lib/commerce/types";
import { formatMoney } from "@/lib/money";
import { priceCart } from "@/lib/pricing";
import type { Cart } from "@/lib/types";
import { cartCopy } from "@/content/copy/cart";
import { pagesCopy } from "@/content/copy/pages";
import { welcomeCode } from "@/content/offers";
import { CartActionsContext, CartStateContext, type CartContextValue } from "@/components/cart/useCart";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { ClockProvider } from "@/components/time/ClockProvider";
import { cadeaukaart, lineOf, lola, nina, pieceList, resolvePiece, tess } from "@/tests/fixtures/catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import { CheckoutView } from "./CheckoutView";
import {
  DEMO_REF_ALPHABET,
  EMPTY_CHECKOUT_VALUES,
  INITIAL_CHECKOUT_STATE,
  demoOrderRef,
  emptyCart,
  newDemoOrderRef,
  placedOrderFrom,
  toPlaced,
  toPlacing,
  validateCheckout,
  type CartClearer,
} from "./demoOrder";

/**
 * The local demo checkout (docs/PLAN.md §13.13, §14.18, §19.1): the notice "Demo-checkout: er wordt niet betaald" is
 * visible; `review` shows the order overview (read-only lines, discount code field, totals) and the form; `placed`
 * shows the DEMO- reference with an empty cart. Placing empties the cart: tested with the real local cart adapter.
 */

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

function cartOf(lines: Array<{ variantId: string; quantity: number }>, options: { code?: string; giftWrap?: boolean; note?: string } = {}): Cart {
  return priceCart({
    lines,
    resolve: resolvePiece,
    discountCode: options.code ?? null,
    giftWrap: options.giftWrap ?? false,
    note: options.note ?? "",
    now: TEST_NOW,
  });
}

function cartContext(cart: Cart | null, hydrated = true): CartContextValue {
  const answer = async (): Promise<CartResult> => ({ ok: true, cart });
  return {
    provider: "local",
    cart,
    hydrated,
    pending: false,
    itemCount: cart?.itemCount ?? 0,
    isOpen: false,
    openCart: () => {},
    closeCart: () => {},
    setOpen: () => {},
    addToCart: answer,
    updateQuantity: answer,
    removeLine: answer,
    applyDiscountCode: answer,
    removeDiscountCode: answer,
    setGiftWrap: answer,
    setNote: answer,
    checkout: async () => {},
    registerNavigation: () => {},
    lastError: null,
  };
}

function render(cart: Cart | null, element = <CheckoutView />, hydrated = true): string {
  const value = cartContext(cart, hydrated);
  return renderToStaticMarkup(
    <ClockProvider serverNow={TEST_NOW}>
      <CatalogProvider products={pieceList}>
        <CartActionsContext value={value}>
          <CartStateContext value={value}>{element}</CartStateContext>
        </CartActionsContext>
      </CatalogProvider>
    </ClockProvider>,
  );
}

const copy = pagesCopy.checkout;

describe("CheckoutView: review", () => {
  const cart = cartOf([lineOf(lola, "Zilver"), lineOf(tess, undefined, 2)], { giftWrap: true, note: "Fijne verjaardag" });
  const html = render(cart);

  it("shows the demo notice at the top and again by the button", () => {
    expect(html).toMatch(new RegExp(`role="note"[^>]*>.*?${copy.demoNotice}`));
    expect(html.match(new RegExp(copy.demoNotice, "g"))?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain(copy.formNote);
  });

  it("shows the order overview: read-only lines, gift wrap, gift message, discount field and totals", () => {
    expect(html).toContain(copy.summary.title);
    expect(html).toContain("Lola chunky hoops");
    expect(html).toContain("Zilver");
    expect(html).toContain(escape(cartCopy.line.quantityReadOnly(2)));
    expect(html).not.toContain(cartCopy.line.remove);
    expect(html).toContain(copy.summary.giftWrap);
    expect(html).toContain("Fijne verjaardag");
    expect(html).toContain(copy.discount.label);
    expect(html).toContain(copy.discount.apply);
    expect(html).toContain(cartCopy.totals.subtotal);
    expect(html).toContain(formatMoney(cart.totals.total));
  });

  it("has the contact and address fields with visible labels and the demo order button", () => {
    for (const label of [copy.contact.email, copy.address.firstName, copy.address.lastName, copy.address.street, copy.address.postalCode, copy.address.city]) {
      expect(html).toContain(`>${label}</span></label>`);
    }
    expect(html).toContain('autoComplete="shipping postal-code"');
    expect(html).toContain(copy.placeOrder);
    expect(html).not.toContain("DEMO-");
  });

  it("asks no address for gift cards only", () => {
    const giftCards = render(cartOf([lineOf(cadeaukaart, "€25")]));
    expect(giftCards).toContain(copy.address.giftCardsOnly);
    expect(giftCards).not.toContain(`>${copy.address.street}</span></label>`);
  });
});

describe("CheckoutView: other states", () => {
  it("shows a quiet placeholder before the cart has loaded", () => {
    const html = render(null, <CheckoutView />, false);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(copy.loading);
  });

  it("shows the empty state with the notice when the cart is empty", () => {
    const html = render(cartOf([]));
    expect(html).toContain(copy.empty.title);
    expect(html).toContain(copy.demoNotice);
    expect(html).not.toContain(copy.placeOrder);
  });

  it("placed: the DEMO- reference with an empty cart, never the empty state", () => {
    const before = cartOf([lineOf(nina, "17"), lineOf(lola)]);
    const order = placedOrderFrom(before, "DEMO-K7P2QX", " sanne@example.com ");
    const html = render(cartOf([]), <CheckoutView initial={{ state: { status: "placed", orderRef: order.orderRef }, order }} />);
    expect(html).toContain("DEMO-K7P2QX");
    expect(html).toContain(copy.placed.title);
    expect(html).toContain(copy.placed.text);
    expect(html).toContain(escape(copy.placed.emailNote("sanne@example.com")));
    expect(html).toContain(formatMoney(before.totals.total));
    expect(html).toContain("Nina chunky ring");
    expect(html).toContain(copy.demoNotice);
    expect(html).not.toContain(copy.empty.title);
    expect(html).not.toContain(copy.placeOrder);
  });
});

describe("demo order logic", () => {
  it("DEMO- plus six unambiguous characters", () => {
    expect(demoOrderRef([0, 1, 2, 3, 4, 5])).toBe("DEMO-ABCDEF");
    expect(demoOrderRef([255, 255, 255, 255, 255, 255])).toMatch(/^DEMO-[A-Z2-9]{6}$/);
    expect(DEMO_REF_ALPHABET).not.toMatch(/[01ILO]/);
    for (let index = 0; index < 20; index += 1) expect(newDemoOrderRef()).toMatch(/^DEMO-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
  });

  it("review → placing → placed, and nothing else", () => {
    const placing = toPlacing(INITIAL_CHECKOUT_STATE);
    expect(placing).toEqual({ status: "placing", orderRef: null });
    expect(toPlaced(placing, "DEMO-ABCDEF")).toEqual({ status: "placed", orderRef: "DEMO-ABCDEF" });
    expect(toPlaced(INITIAL_CHECKOUT_STATE, "DEMO-ABCDEF")).toBe(INITIAL_CHECKOUT_STATE);
    expect(toPlacing(placing)).toBe(placing);
  });

  it("checks the email and, when something is shipped, the address", () => {
    const empty = validateCheckout(EMPTY_CHECKOUT_VALUES, true);
    expect(Object.keys(empty).sort()).toEqual(["city", "email", "firstName", "lastName", "postalCode", "street"]);
    expect(Object.keys(validateCheckout(EMPTY_CHECKOUT_VALUES, false))).toEqual(["email"]);
    expect(validateCheckout({ ...EMPTY_CHECKOUT_VALUES, email: "geen-adres" }, false).email).toBe(copy.errors.email);
    const filled = { email: "sanne@example.com", firstName: "Sanne", lastName: "de Vries", street: "Dorpsstraat 1", postalCode: "1234 AB", city: "Utrecht" };
    expect(validateCheckout(filled, true)).toEqual({});
  });

  it("emptyCart turns gift wrap off, removes the code and the message, then every line", async () => {
    const calls: string[] = [];
    const ok = async (): Promise<CartResult> => ({ ok: true, cart: null });
    const actions: CartClearer = {
      removeLine: async (id) => (calls.push(`line:${id}`), ok()),
      removeDiscountCode: async (code) => (calls.push(`code:${code}`), ok()),
      setGiftWrap: async (enabled) => (calls.push(`wrap:${enabled}`), ok()),
      setNote: async (note) => (calls.push(`note:${note}`), ok()),
    };
    const cart = cartOf([lineOf(lola), lineOf(tess)], { code: welcomeCode.code, giftWrap: true, note: "Hoi" });
    expect(await emptyCart(cart, actions)).toBe(true);
    expect(calls).toEqual([
      "wrap:false",
      `code:${welcomeCode.code}`,
      "note:",
      ...cart.lines.map((line) => `line:${line.id}`),
    ]);
  });

  it("placing with the real local cart leaves it empty", async () => {
    const adapter = createLocalCartAdapter({ resolve: resolvePiece, now: () => TEST_NOW });
    await adapter.addToCart([lineOf(lola, "Goud"), lineOf(tess, undefined, 2)]);
    await adapter.applyDiscountCode(welcomeCode.code);
    await adapter.setGiftWrap(true);
    await adapter.setNote("Voor jou");
    const before = await adapter.getCart();
    if (!before.ok || !before.cart) throw new Error("no cart");
    expect(before.cart.lines).toHaveLength(2);

    const cleared = await emptyCart(before.cart, {
      removeLine: (id) => adapter.removeFromCart([id]),
      removeDiscountCode: (code) => adapter.removeDiscountCode(code),
      setGiftWrap: (enabled) => adapter.setGiftWrap(enabled),
      setNote: (note) => adapter.setNote(note),
    });
    expect(cleared).toBe(true);
    const after = await adapter.getCart();
    expect(after.ok && after.cart?.lines).toEqual([]);
    expect(after.ok && after.cart?.itemCount).toBe(0);
    expect(after.ok && after.cart?.giftWrap.selected).toBe(false);
    expect(after.ok && after.cart?.discountCodes).toEqual([]);
    expect(after.ok && after.cart?.note).toBe("");

    const order = placedOrderFrom(before.cart, demoOrderRef([1, 2, 3, 4, 5, 6]), "sanne@example.com");
    expect(order.orderRef).toMatch(/^DEMO-/);
    expect(order.itemCount).toBe(3);
    expect(order.total).toEqual(before.cart.totals.total);
  });
});
