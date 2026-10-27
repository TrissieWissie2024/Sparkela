import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CartResult } from "@/lib/commerce/types";
import { priceCart } from "@/lib/pricing";
import type { Cart } from "@/lib/types";
import { cartCopy } from "@/content/copy/cart";
import { pagesCopy } from "@/content/copy/pages";
import { welcomeCode } from "@/content/offers";
import { site } from "@/content/site";
import { CartActionsContext, CartStateContext, type CartContextValue } from "@/components/cart/useCart";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { lineOf, lola, noor, pieceList, resolvePiece, tess } from "@/tests/fixtures/catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import { EmailCapture } from "./EmailCapture";
import { applyMessage, RewardCode } from "./RewardCode";
import { CARD_COUNT, SparkCards } from "./SparkCards";
import { SparkPill } from "./SparkPill";

/**
 * The popup components (docs/PLAN.md §13.11, decision 92; brief §2.8) as static markup: three face-down cards that hold
 * no text until turned, every card revealing the same WELKOM10 reward, the pill with its accessible names, the code step
 * after a sign-up, and what "Zet op mijn tas" reports. Nothing shows on the first render (the pill waits 8 s).
 */

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

function cartContext(cart: Cart | null): CartContextValue {
  const answer = async (): Promise<CartResult> => ({ ok: true, cart });
  return {
    provider: "local",
    cart,
    hydrated: true,
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
    lastError: null,
  };
}

function render(node: ReactNode, cart: Cart | null = null): string {
  const value = cartContext(cart);
  return renderToStaticMarkup(
    <CatalogProvider products={pieceList}>
      <CartActionsContext value={value}>
        <CartStateContext value={value}>{node}</CartStateContext>
      </CartActionsContext>
    </CatalogProvider>,
  );
}

function cartOf(lines: Array<{ variantId: string; quantity: number }>, code: string | null = null): Cart {
  return priceCart({ lines, resolve: resolvePiece, discountCode: code, giftWrap: false, note: "", now: TEST_NOW });
}

describe("SparkCards (decision 92)", () => {
  it("three face-down buttons that hold no reward text yet", () => {
    const html = render(<SparkCards chosen={null} onChoose={() => {}} />);
    expect(html.match(/<button/g)).toHaveLength(CARD_COUNT);
    for (let n = 1; n <= CARD_COUNT; n += 1) expect(html).toContain(`aria-label="${pagesCopy.popup.card(n, CARD_COUNT)}"`);
    expect(html).not.toContain(welcomeCode.code);
    expect(html).not.toContain("aria-disabled");
    expect(html).toContain(`role="group" aria-label="${pagesCopy.popup.cardsLabel}"`);
  });

  it("after a choice every card shows the same reward; the chosen one keeps focus, the others leave the tab order", () => {
    const html = render(<SparkCards chosen={1} onChoose={() => {}} />);
    const reveal = escape(site.emailCapture.reveal);
    expect(html.match(new RegExp(`>${welcomeCode.code}<`, "g"))).toHaveLength(CARD_COUNT);
    expect(html).toContain(`aria-label="${escape(pagesCopy.popup.cardChosen(2, CARD_COUNT, site.emailCapture.reveal))}"`);
    expect(html).toContain(`aria-label="${escape(pagesCopy.popup.cardRevealed(1, CARD_COUNT, site.emailCapture.reveal))}"`);
    expect(html).toContain(reveal);
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(CARD_COUNT);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(CARD_COUNT - 1);
    expect(html).toContain(pagesCopy.popup.yourCard);
    expect(html.match(new RegExp(pagesCopy.popup.sameReward, "g"))).toHaveLength(CARD_COUNT - 1);
  });

  it("states the same, real reward from config", () => {
    expect(site.emailCapture.reveal).toContain(welcomeCode.code);
    expect(pagesCopy.popup.cardFace.value).toBe(welcomeCode.code);
    expect(pagesCopy.popup.cardFace.line).toContain(`${welcomeCode.percent}%`);
  });
});

describe("SparkPill", () => {
  const html = render(<SparkPill onOpen={() => {}} onDismiss={() => {}} />);

  it('says "Kies je spark", what it offers, and opens a dialog', () => {
    expect(html).toContain(site.emailCapture.pillLabel);
    expect(html).toContain(escape(pagesCopy.popup.pillSuffix));
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it("has a close button of 44 px with its own name, sits bottom left on z-45 and rides above the sticky bar", () => {
    expect(html).toContain(`aria-label="${pagesCopy.popup.pillDismiss}"`);
    expect(html).toContain("size-11");
    expect(html).toContain("z-45");
    expect(html).toContain("--onderbalk");
  });
});

describe("RewardCode", () => {
  it("after the sign-up: check your mail, the code, copy and apply", () => {
    const html = render(<RewardCode status="pending" onDone={() => {}} />);
    expect(html).toContain(pagesCopy.popup.reward.pending);
    expect(html).toContain(`>${welcomeCode.code}<`);
    expect(html).toContain(pagesCopy.popup.reward.copy);
    expect(html).toContain(pagesCopy.popup.reward.apply);
    expect(html).toContain(pagesCopy.popup.reward.continueShopping);
  });

  it("shows the code as on the tas once the cart holds it", () => {
    const cart = cartOf([lineOf(lola)], welcomeCode.code);
    const html = render(<RewardCode status="pending" onDone={() => {}} />, cart);
    expect(html).toContain(pagesCopy.popup.reward.applied);
  });

  it("reports what applying did", () => {
    const code = welcomeCode.code;
    expect(applyMessage({ ok: true, cart: cartOf([lineOf(lola)], code) })).toEqual({
      ok: true,
      text: pagesCopy.popup.reward.appliedMessage(code),
    });
    expect(applyMessage({ ok: true, cart: cartOf([], code) })).toEqual({ ok: true, text: pagesCopy.popup.reward.appliedEmpty(code) });
    expect(applyMessage({ ok: true, cart: null })).toEqual({ ok: true, text: pagesCopy.popup.reward.appliedEmpty(code) });
    // Three stack pieces: the stack discount is higher than the code, so the code does not count now.
    const stack = cartOf([lineOf(lola), lineOf(noor), lineOf(tess)], code);
    expect(applyMessage({ ok: true, cart: stack }).text).toBe(pagesCopy.popup.reward.notCombined(code));
    expect(applyMessage({ ok: false, error: "network", cart: null })).toEqual({ ok: false, text: cartCopy.errors.network });
  });
});

describe("EmailCapture", () => {
  it("renders nothing visible on the first render: the pill waits 8 s and the modal only opens from it", () => {
    const html = render(<EmailCapture />);
    expect(html).not.toContain(site.emailCapture.pillLabel);
    expect(html).not.toContain(site.emailCapture.title);
  });
});
