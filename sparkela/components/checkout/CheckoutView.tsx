"use client";

import { Info } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";

import type { Cart, CheckoutState } from "@/lib/types";
import { cn } from "@/lib/cn";
import { pagesCopy } from "@/content/copy/pages";
import { Spark } from "@/components/brand/Spark";
import { useCart } from "@/components/cart/useCart";
import { PageHeader } from "@/components/pages/PageHeader";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

import { CheckoutForm } from "./CheckoutForm";
import { CheckoutPlaced } from "./CheckoutPlaced";
import {
  EMPTY_CHECKOUT_VALUES,
  INITIAL_CHECKOUT_STATE,
  emptyCart,
  newDemoOrderRef,
  placedOrderFrom,
  toPlaced,
  toPlacing,
  type CheckoutValues,
  type PlacedOrder,
} from "./demoOrder";
import { OrderSummary } from "./OrderSummary";

/**
 * The local demo checkout (docs/PLAN.md §13.13, §14.18; brief §7: "een checkout-stub met besteloverzicht,
 * kortingscodeveld en de melding 'Demo-checkout: er wordt niet betaald'"). Port of CORVANE
 * components/checkout/CheckoutView.tsx on Sparkela's cart. Only with COMMERCE_PROVIDER=local; with Shopify the page
 * shows ShopifyCheckoutNote instead. Everything comes from useCart(); nothing is sent anywhere.
 *
 * - The notice "Demo-checkout: er wordt niet betaald" at the top (role="note") and again by the button.
 * - CheckoutState (plan §6.10): `review` shows the order overview (OrderSummary: read-only lines, gift wrap, gift message,
 *   discount code field, CartTotals) and the details form (CheckoutForm). "Bestelling plaatsen (demo)" checks the
 *   fields, goes to `placing` (the overview stays frozen on screen), empties the cart through the cart actions
 *   (gift wrap, codes, message, lines) and ends in `placed` with a DEMO-XXXXXX reference (CheckoutPlaced), focus on
 *   its heading. No payment, no network call besides the local cart.
 * - Before the cart has loaded from storage: a quiet placeholder under the notice. An empty cart: a short empty state
 *   with links to the shop. Both sit in the same minimum height, so the footer does not move when the cart is empty.
 * - DOM order: overview first, then the form, so phones read what you order before where it goes; from lg the form sits
 *   left and the overview right (sticky under the header).
 *
 * `initial` sets the start state (CheckoutView.test.tsx renders `placed` with an empty cart); the page passes nothing.
 * It renders the page header too (QA round 1). The intro "Controleer je bestelling en vul je gegevens in." only shows
 * with a filled cart, under the demo notice (QA round 2): not while loading, not above an empty cart, not after placing.
 */

export interface CheckoutViewProps {
  initial?: { state: CheckoutState; order: PlacedOrder | null };
}

export function CheckoutView({ initial }: CheckoutViewProps = {}) {
  const actions = useCart();
  const { cart, hydrated } = actions;
  const [state, setState] = useState<CheckoutState>(initial?.state ?? INITIAL_CHECKOUT_STATE);
  const [order, setOrder] = useState<PlacedOrder | null>(initial?.order ?? null);
  const [values, setValues] = useState<CheckoutValues>(EMPTY_CHECKOUT_VALUES);
  /** The cart as it was when the visitor placed the order: shown while the real one empties. */
  const [frozen, setFrozen] = useState<Cart | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  async function place() {
    if (!cart || cart.lines.length === 0 || state.status !== "review") return;
    const orderRef = newDemoOrderRef();
    setFrozen(cart);
    setState(toPlacing);
    await emptyCart(cart, actions);
    setOrder(placedOrderFrom(cart, orderRef, values.email));
    setState((current) => toPlaced(current, orderRef));
    setFrozen(null);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0 });
      headingRef.current?.focus({ preventScroll: true });
    });
  }

  if (state.status === "placed" && order) {
    return (
      <CheckoutFrame>
        <DemoNotice />
        <div className="mt-8 md:mt-10">
          <CheckoutPlaced order={order} headingRef={headingRef} />
        </div>
      </CheckoutFrame>
    );
  }

  const shown = state.status === "placing" ? frozen : cart;

  // The notice stays put and the area below it keeps one minimum height in the loading and empty states, so the
  // footer does not jump up when the cart turns out empty (CLS; integrator 7-9). A filled cart is always taller.
  if (!hydrated && !shown) {
    return (
      <CheckoutFrame>
        <DemoNotice />
        <CheckoutLoading />
      </CheckoutFrame>
    );
  }

  if (!shown || shown.lines.length === 0) {
    return (
      <CheckoutFrame>
        <DemoNotice />
        <div className={STATE_MIN_HEIGHT}>
          <CheckoutEmpty />
        </div>
      </CheckoutFrame>
    );
  }

  return (
    <CheckoutFrame>
      <DemoNotice />
      {/* Only here, where there is something to check (QA round 2: not above "Je tas is leeg"). Below the notice, so
          the header is the same in every state and nothing shifts when the cart turns out empty or filled. */}
      <p className="mt-5 max-w-[40rem] text-tekst-2">{pagesCopy.checkout.intro}</p>
      <div className="mt-8 grid gap-10 md:mt-10 lg:grid-cols-12 lg:items-start lg:gap-x-8 xl:gap-x-12">
        <OrderSummary
          cart={shown}
          className="lg:sticky lg:top-[calc(var(--header-hoogte)+1.5rem)] lg:col-span-5 lg:col-start-8 lg:row-start-1"
        />
        <CheckoutForm
          values={values}
          onChange={setValues}
          needsAddress={shown.totals.shipping.kind !== "none"}
          total={shown.totals.total}
          placing={state.status === "placing"}
          onPlace={place}
          className="lg:col-span-7 lg:row-start-1"
        />
      </div>
    </CheckoutFrame>
  );
}

/** The page header (the same in every state) and the container around every state. */
function CheckoutFrame({ children }: { children: ReactNode }) {
  const copy = pagesCopy.checkout;
  return (
    <>
      <PageHeader title={copy.title} />
      <Container className="pb-16 md:pb-24">{children}</Container>
    </>
  );
}

/** "Demo-checkout: er wordt niet betaald" (brief §7), at the top of the checkout. */
export function DemoNotice({ className }: { className?: string }) {
  return (
    <p
      role="note"
      className={cn(
        "inline-flex max-w-full items-center gap-2.5 rounded-full bg-info-vlak px-4 py-2 text-sm leading-snug font-semibold text-info",
        className,
      )}
    >
      <Info aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.25} />
      {pagesCopy.checkout.demoNotice}
    </p>
  );
}

/** Loading and empty state share this minimum height (taller than the empty state at every width). */
const STATE_MIN_HEIGHT = "min-h-[28rem] md:min-h-[30rem]";

function CheckoutLoading() {
  return (
    <div className={STATE_MIN_HEIGHT}>
      <div aria-busy="true" className="mt-8 grid gap-10 md:mt-10 lg:grid-cols-12 lg:gap-x-8 xl:gap-x-12">
        <span className="sr-only">{pagesCopy.checkout.loading}</span>
        <div aria-hidden="true" className="h-[24rem] rounded-kaart bg-vlak lg:col-span-5 lg:col-start-8 lg:row-start-1" />
        <div aria-hidden="true" className="hidden h-[26rem] rounded-kaart bg-vlak/60 lg:col-span-7 lg:row-start-1 lg:block" />
      </div>
    </div>
  );
}

function CheckoutEmpty() {
  const copy = pagesCopy.checkout.empty;
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="mt-8 flex max-w-[40rem] flex-col items-start rounded-kaart border border-rand bg-kaart p-6 md:mt-10 md:p-10"
    >
      <div aria-hidden="true" className="flex items-end gap-2.5 text-roest">
        <Spark className="size-5" />
        <Spark className="size-8" />
        <Spark className="size-5" />
      </div>
      <h2 id={headingId} className="kop-2 mt-6 text-tekst">
        {copy.title}
      </h2>
      <p className="mt-3 leading-relaxed text-tekst-2">{copy.text}</p>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button href={copy.cta.href} variant="primair">
          {copy.cta.label}
        </Button>
        <Button href={copy.secondary.href} variant="link">
          {copy.secondary.label}
        </Button>
      </div>
    </section>
  );
}
