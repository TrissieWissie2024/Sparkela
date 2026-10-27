import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CartResult } from "@/lib/commerce/types";
import { toMs } from "@/lib/dates";
import { cartProgress, priceCart } from "@/lib/pricing";
import type { Cart } from "@/lib/types";
import { cartCopy } from "@/content/copy/cart";
import { sharedCopy } from "@/content/copy/shared";
import { giftWrap } from "@/content/offers";
import { site } from "@/content/site";
import { CampaignCartNote, campaignNoteSchedule } from "@/components/cart/CampaignCartNote";
import { CartEmpty } from "@/components/cart/CartEmpty";
import { CartLineItem } from "@/components/cart/CartLineItem";
import { CartProgressBars } from "@/components/cart/CartProgressBars";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartTotals } from "@/components/cart/CartTotals";
import { CartUpsell, pickUpsell } from "@/components/cart/CartUpsell";
import { CheckoutButton } from "@/components/cart/CheckoutButton";
import { GiftWrapPrice, giftWrapPriceSchedule } from "@/components/cart/GiftWrapPrice";
import { GiftWrapToggle } from "@/components/cart/GiftWrapToggle";
import { QuantityStepper } from "@/components/cart/QuantityStepper";
import { CartActionsContext, CartStateContext, type CartContextValue } from "@/components/cart/useCart";
import { CatalogProvider, createCatalogValue } from "@/components/catalog/CatalogProvider";
import { QuickAdd, quickAddMode } from "@/components/product/QuickAdd";
import { ClockProvider } from "@/components/time/ClockProvider";
import { cadeaukaart, isa, jade, jet, lineOf, lola, nina, noor, pieceList, resolvePiece, sterKetting, tess } from "@/tests/fixtures/catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

/**
 * The cart UI of wave 4-6 (docs/PLAN.md §13.7, §19.1: components/cart/*.test.tsx, C3). Static markup only
 * (renderToStaticMarkup): CartProgressBars for 0 to 3 stack pieces, a line with a stack discount as its own row and
 * no <s>, the upsell that renders nothing before launchAt, QuickAdd in every state inside CartProvider and
 * CatalogProvider, and the totals with "Berekend bij afrekenen" for a Shopify cart.
 */

const PRELAUNCH = Date.parse("2026-11-20T12:00:00+01:00");
const DECEMBER = Date.parse("2026-12-02T12:00:00+01:00");

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

/** A local cart priced by lib/pricing.ts with the fixed pieces of tests/fixtures/catalog.ts. */
function cartOf(lines: Array<{ variantId: string; quantity: number }>, options: { now?: number; giftWrap?: boolean; code?: string } = {}): Cart {
  return priceCart({
    lines,
    resolve: resolvePiece,
    discountCode: options.code ?? null,
    giftWrap: options.giftWrap ?? false,
    note: "",
    now: options.now ?? TEST_NOW,
  });
}

/** A cart context with a fixed cart, for components that read useCart() (the real provider reads the cart after mount). */
function cartContext(cart: Cart | null, overrides: Partial<CartContextValue> = {}): CartContextValue {
  const answer = async (): Promise<CartResult> => ({ ok: true, cart });
  return {
    provider: cart?.provider ?? "local",
    cart,
    hydrated: true,
    pending: false,
    itemCount: cart?.itemCount ?? 0,
    isOpen: true,
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
    ...overrides,
  };
}

function withCart(cart: Cart | null, children: ReactNode, options: { now?: number; overrides?: Partial<CartContextValue> } = {}) {
  const value = cartContext(cart, options.overrides);
  return renderToStaticMarkup(
    <ClockProvider serverNow={options.now ?? TEST_NOW}>
      <CatalogProvider products={pieceList}>
        <CartActionsContext value={value}>
          <CartStateContext value={value}>{children}</CartStateContext>
        </CartActionsContext>
      </CatalogProvider>
    </ClockProvider>,
  );
}

/** The markup of each TimeSwitch variant wrapper: whether it is hidden and what it holds. */
function variantsOf(html: string): Array<{ hidden: boolean; inner: string }> {
  const out: Array<{ hidden: boolean; inner: string }> = [];
  const pattern = /<(div|span) data-ts="[^"]+-\d+"( hidden="")?>([\s\S]*?)<\/\1>(?=<(?:div|span) data-ts=|<script)/g;
  for (const match of html.matchAll(pattern)) out.push({ hidden: match[2] !== undefined, inner: match[3] });
  return out;
}

describe("CartProgressBars (plan §8.3)", () => {
  const render = (stackUnits: number, basis = 2000) =>
    renderToStaticMarkup(<CartProgressBars progress={cartProgress({ freeShippingBasis: basis, hasShippable: true, stackUnits })} />);

  it("0 stack pieces: only the shipping bar", () => {
    const html = render(0);
    expect(html).toContain(escape(sharedCopy.progress.remaining("€15,00")));
    expect(html).toContain(`aria-label="${cartCopy.progress.shippingMeter}"`);
    expect(html).not.toContain(cartCopy.progress.stackMeter);
    expect(html).not.toContain("stack-korting");
  });

  it("1 stack piece: two more needed, three segments with one filled", () => {
    const html = render(1);
    expect(html).toContain(sharedCopy.progress.stackTwo);
    expect(html).toMatch(new RegExp(`aria-label="${cartCopy.progress.stackMeter}" aria-valuemin="0" aria-valuemax="3" aria-valuenow="1"`));
  });

  it("2 stack pieces: one more needed, two of three segments filled", () => {
    const html = render(2);
    expect(html).toContain(sharedCopy.progress.stackOne);
    expect(html).toMatch(/aria-valuemax="3" aria-valuenow="2"/);
  });

  it("3 stack pieces: the milestone collapses to one line without a bar", () => {
    const html = render(3);
    expect(html).toContain(sharedCopy.progress.stackReached);
    expect(html).not.toContain(cartCopy.progress.stackMeter);
  });

  it("free shipping reached: one line with a check, no bar", () => {
    const html = render(0, 3500);
    expect(html).toContain(sharedCopy.progress.reached);
    expect(html).not.toContain('role="progressbar"');
  });

  it("gift cards only: the note that they come by mail, no bars", () => {
    const cart = cartOf([lineOf(cadeaukaart, "€50")]);
    const html = renderToStaticMarkup(<CartProgressBars progress={cart.progress} />);
    expect(html).toContain(sharedCopy.progress.giftCardsOnly);
    expect(html).not.toContain('role="progressbar"');
  });

  it("follows the worked examples: A is €0,10 short, C needs one more piece", () => {
    const a = cartOf([lineOf(noor, "Goud"), lineOf(nina, "17")]);
    expect(renderToStaticMarkup(<CartProgressBars progress={a.progress} />)).toContain(escape("Nog €0,10 tot gratis verzending"));
    const c = cartOf([lineOf(noor, "Goud"), lineOf(tess)]);
    expect(renderToStaticMarkup(<CartProgressBars progress={c.progress} />)).toContain(sharedCopy.progress.stackOne);
  });
});

describe("CartLineItem (decision 117, brief §2.5)", () => {
  // Example D of plan §8.4: Noor + Tess + Jet, stack discount 224 + 299 + 374.
  const cart = cartOf([lineOf(noor, "Goud"), lineOf(tess), lineOf(jet)]);
  const noorLine = cart.lines.find((line) => line.merchandise.productHandle === noor.handle);

  it("shows the stack discount as its own row and never a struck price", () => {
    expect(noorLine).toBeDefined();
    const html = withCart(cart, <CartLineItem line={noorLine!} onRemove={() => {}} />);
    expect(html).toContain(escape("Stack-korting −€2,24"));
    expect(html).toContain(escape(cartCopy.line.total("€12,71")));
    expect(html).toContain(escape("€14,95"));
    expect(html).not.toMatch(/<s[\s>]/);
    expect(html).not.toContain("line-through");
  });

  it("has a link to the product, the variant, a stepper with item names and a remove button", () => {
    const html = withCart(cart, <CartLineItem line={noorLine!} onRemove={() => {}} />);
    expect(html).toContain(`href="/products/${noor.handle}"`);
    expect(html).toContain("data-cart-line-focus");
    expect(html).toContain(">Goud<");
    expect(html).toContain(`aria-label="${cartCopy.line.quantity.decrease(noor.title)}"`);
    expect(html).toContain(`aria-label="${cartCopy.line.quantity.increase(noor.title)}"`);
    expect(html).toContain(`aria-label="${cartCopy.line.removeLabel(noor.title)}"`);
    // Quantity 1 is the minimum: the decrease button keeps focus with aria-disabled, never `disabled`.
    expect(html).toMatch(/aria-label="Minder Noor dikke ringetjes" aria-disabled="true"/);
    expect(html).not.toMatch(/<button[^>]* disabled=""/);
  });

  it("read-only lines (demo checkout) show the quantity without stepper or remove button", () => {
    const html = withCart(cart, <CartLineItem line={noorLine!} onRemove={() => {}} readOnly />);
    expect(html).toContain(cartCopy.line.quantityReadOnly(1));
    expect(html).not.toContain(cartCopy.line.remove);
  });

  it("a line without discount has no discount rows", () => {
    const single = cartOf([lineOf(nina, "17")]);
    const html = withCart(single, <CartLineItem line={single.lines[0]} onRemove={() => {}} />);
    expect(html).not.toContain(cartCopy.line.discountLabels.stack);
  });
});

describe("QuantityStepper", () => {
  it("disables the plus button at the maximum with aria-disabled", () => {
    const html = renderToStaticMarkup(<QuantityStepper value={3} max={3} onChange={() => {}} itemName="Bo" />);
    expect(html).toMatch(/aria-label="Meer Bo" aria-disabled="true"/);
    expect(html).toContain('role="group"');
    expect(html).toContain(`aria-label="${cartCopy.line.quantity.label("Bo")}"`);
  });
});

describe("CartTotals", () => {
  it("shows 'Berekend bij afrekenen' for a Shopify cart without an address (decision 34)", () => {
    const local = cartOf([lineOf(nina, "17")]);
    const shopifyCart: Cart = {
      ...local,
      provider: "shopify",
      totals: { ...local.totals, shipping: { kind: "at-checkout" }, total: local.totals.merchandise },
    };
    const html = withCart(shopifyCart, <CartTotals cart={shopifyCart} />);
    expect(html).toContain(cartCopy.totals.shippingAtCheckout);
    expect(html).toContain(cartCopy.totals.total);
    expect(html).toContain(escape("€19,95"));
  });

  it("adds up for example D: subtotal, stack discount, free shipping, total and the saving", () => {
    const cart = cartOf([lineOf(noor, "Goud"), lineOf(tess), lineOf(jet)]);
    const html = withCart(cart, <CartTotals cart={cart} />);
    expect(html).toContain("<dl");
    expect(html).toContain(escape("€59,85"));
    expect(html).toContain(escape("Stack-korting 15%"));
    expect(html).toContain(escape("−€8,97"));
    expect(html).toContain(cartCopy.totals.shippingFree);
    expect(html).toContain(escape("€50,88"));
    expect(html).toContain(escape(sharedCopy.price.savings("€8,97")));
    expect(html).toContain(escape(site.vat.before));
    expect(html).not.toMatch(/<s[\s>]/);
  });

  it("shows a code that does not combine with the stack discount, with the reason and a remove button", () => {
    const cart = cartOf([lineOf(noor, "Goud"), lineOf(tess), lineOf(jet)], { code: "WELKOM10" });
    const html = withCart(cart, <CartTotals cart={cart} />);
    expect(html).toContain(cartCopy.totals.code("WELKOM10"));
    expect(html).toContain(escape(cartCopy.totals.codeReasons["not-combinable"]));
    expect(html).toContain(`aria-label="${cartCopy.totals.removeCodeLabel("WELKOM10")}"`);
  });

  it("a gift-card-only cart: shipping by mail and no VAT line", () => {
    const cart = cartOf([lineOf(cadeaukaart, "€25")]);
    const html = withCart(cart, <CartTotals cart={cart} />);
    expect(html).toContain(cartCopy.totals.shippingNone);
    expect(html).not.toContain(escape(site.vat.before));
  });
});

describe("CheckoutButton", () => {
  it("is the roest primary button 'Afrekenen', aria-disabled while the cart is empty", () => {
    const empty = withCart(cartOf([]), <CheckoutButton />);
    expect(empty).toContain(cartCopy.checkout);
    expect(empty).toContain("bg-primair");
    expect(empty).toContain('aria-disabled="true"');
    const full = withCart(cartOf([lineOf(jade)]), <CheckoutButton />);
    expect(full).not.toContain('aria-disabled="true"');
  });
});

describe("CartEmpty", () => {
  it("has the heading, the line, 'Shop nieuw' and 'Bekijk alles'", () => {
    const html = renderToStaticMarkup(<CartEmpty headingId="leeg" />);
    expect(html).toContain('id="leeg"');
    expect(html).toContain(cartCopy.empty.title);
    expect(html).toContain(`href="${cartCopy.empty.cta.href}"`);
    expect(html).toContain(cartCopy.empty.cta.label);
    expect(html).toContain(`href="${cartCopy.empty.secondary.href}"`);
  });
});

describe("Gift wrap (plan §10.5)", () => {
  it("prices: +€1,95 outside, 'Gratis in december' inside every free window", () => {
    const { boundaries, variants } = giftWrapPriceSchedule();
    expect(boundaries).toHaveLength(giftWrap.freeWindows.length * 2);
    expect(variants).toEqual(["+€1,95", cartCopy.giftWrap.free, "+€1,95", cartCopy.giftWrap.free, "+€1,95"]);
    expect(boundaries[0]).toBe(toMs("2026-12-01T00:00:00+01:00"));
  });

  it("GiftWrapPrice shows the free text in December", () => {
    const november = renderToStaticMarkup(
      <ClockProvider serverNow={TEST_NOW}>
        <GiftWrapPrice />
      </ClockProvider>,
    );
    expect(variantsOf(november).find((variant) => !variant.hidden)?.inner).toBe(escape("+€1,95"));
    const december = renderToStaticMarkup(
      <ClockProvider serverNow={DECEMBER}>
        <GiftWrapPrice />
      </ClockProvider>,
    );
    expect(variantsOf(december).find((variant) => !variant.hidden)?.inner).toBe(cartCopy.giftWrap.free);
  });

  it("GiftWrapToggle only shows with a physical product", () => {
    expect(withCart(cartOf([lineOf(jade)]), <GiftWrapToggle />)).toContain(cartCopy.giftWrap.label);
    expect(withCart(cartOf([lineOf(cadeaukaart, "€15")]), <GiftWrapToggle />)).toBe("");
  });
});

describe("CampaignCartNote (plan §12.2)", () => {
  it("shows the gift line during the launch gift window and nothing outside it", () => {
    const { boundaries, shown } = campaignNoteSchedule();
    expect(boundaries).toEqual([toMs("2026-11-27T00:00:00+01:00"), toMs("2026-12-01T00:00:00+01:00")]);
    expect(shown).toEqual([false, true, false]);

    const during = renderToStaticMarkup(
      <ClockProvider serverNow={TEST_NOW}>
        <CampaignCartNote />
      </ClockProvider>,
    );
    const visible = variantsOf(during).filter((variant) => !variant.hidden);
    expect(visible).toHaveLength(1);
    expect(visible[0].inner).toContain(cartCopy.campaignNote);

    const after = renderToStaticMarkup(
      <ClockProvider serverNow={DECEMBER}>
        <CampaignCartNote />
      </ClockProvider>,
    );
    expect(variantsOf(after).filter((variant) => !variant.hidden)[0].inner).toBe("");
  });
});

describe("CartUpsell (plan §13.7, decision 107)", () => {
  const catalog = createCatalogValue(pieceList);

  it("picks a third stack piece first when two are in the cart, then other types with the same vibe", () => {
    const cart = cartOf([lineOf(noor, "Goud"), lineOf(tess)]);
    const picks = pickUpsell(catalog.products, cart, catalog.byHandle);
    expect(picks.map((product) => product.handle)).toEqual([lola.handle, nina.handle, sterKetting.handle]);
    expect(picks.every((product) => product.availableForSale)).toBe(true);
  });

  it("never picks what is in the cart, sold-out pieces, the gift card or the gift wrap", () => {
    const cart = cartOf([lineOf(jade)]);
    const picks = pickUpsell(catalog.products, cart, catalog.byHandle, 10);
    const handles = picks.map((product) => product.handle);
    expect(handles).not.toContain(jade.handle);
    expect(handles).not.toContain(isa.handle);
    expect(handles).not.toContain("cadeaukaart");
    expect(handles).not.toContain("cadeauverpakking");
    expect(picks.length).toBeLessThanOrEqual(10);
    expect(pickUpsell(catalog.products, cartOf([]), catalog.byHandle)).toEqual([]);
  });

  it("renders nothing before launchAt", () => {
    const cart = cartOf([lineOf(noor, "Goud"), lineOf(tess)]);
    const html = withCart(cart, <CartUpsell />, { now: PRELAUNCH });
    const variants = variantsOf(html);
    expect(variants).toHaveLength(2);
    expect(variants[0]).toEqual({ hidden: false, inner: "" });
    expect(variants[1].hidden).toBe(true);
    expect(PRELAUNCH).toBeLessThan(toMs(site.launchAt));
  });

  it("after launchAt shows 'Maak de look af' with QuickAdd per product", () => {
    const cart = cartOf([lineOf(noor, "Goud"), lineOf(tess)]);
    const html = withCart(cart, <CartUpsell />);
    const visible = variantsOf(html).find((variant) => !variant.hidden);
    expect(visible?.inner).toContain(cartCopy.upsell.title);
    expect(visible?.inner).toContain(lola.title);
    expect(visible?.inner).toContain(`aria-label="${cartCopy.upsell.listLabel}"`);
    expect(visible?.inner).toContain(escape(cartCopy.quickAdd.chooseLabel(lola.title)));
  });
});

describe("QuickAdd inside CartProvider and CatalogProvider (plan §13.8)", () => {
  const render = (children: ReactNode) =>
    renderToStaticMarkup(
      <ClockProvider serverNow={TEST_NOW}>
        <CatalogProvider products={pieceList}>
          <CartProvider provider="local">{children}</CartProvider>
        </CatalogProvider>
      </ClockProvider>,
    );

  it("one variant: 'In tas' in roest, adds directly", () => {
    expect(quickAddMode(jade)).toBe("single");
    const html = render(<QuickAdd product={jade} />);
    expect(html).toContain(`aria-label="${cartCopy.quickAdd.addLabel(jade.title)}"`);
    expect(html).toContain(`>${cartCopy.quickAdd.add}<`);
    expect(html).toContain("bg-primair");
    expect(html).not.toContain("aria-expanded");
  });

  it("several variants: 'Kies' opens a choice list (closed in the static HTML)", () => {
    expect(quickAddMode(noor)).toBe("choose");
    const html = render(<QuickAdd product={noor} />);
    expect(html).toContain(`aria-label="${escape(cartCopy.quickAdd.chooseLabel(noor.title))}"`);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(`>${cartCopy.quickAdd.choose}<`);
    expect(html).not.toContain('role="dialog"');
  });

  it("the gift card: a link 'Kies bedrag' to its product page", () => {
    expect(quickAddMode(cadeaukaart)).toBe("gift-card");
    const html = render(<QuickAdd product={cadeaukaart} />);
    expect(html).toContain(`href="/products/${cadeaukaart.handle}"`);
    expect(html).toContain(cartCopy.quickAdd.chooseAmount);
  });

  it("sold out: 'Uitverkocht', aria-disabled and still focusable", () => {
    expect(quickAddMode(isa)).toBe("sold-out");
    const html = render(<QuickAdd product={isa} />);
    expect(html).toContain(cartCopy.quickAdd.soldOut);
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/<button[^>]* disabled=""/);
    expect(html).not.toContain("bg-primair");
  });
});
