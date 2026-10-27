"use client";

import { CircleAlert, Info } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";

import type { CartNotice } from "@/lib/types";
import { cartCopy } from "@/content/copy/cart";
import { sharedCopy } from "@/content/copy/shared";
import { PaymentBadges } from "@/components/layout/PaymentBadges";
import { Sheet } from "@/components/ui/Sheet";
import { Spinner } from "@/components/ui/Spinner";

import { CampaignCartNote } from "./CampaignCartNote";
import { CartEmpty } from "./CartEmpty";
import { CartLineItem } from "./CartLineItem";
import { CartProgressBars } from "./CartProgressBars";
import { CartTotals } from "./CartTotals";
import { CartUpsell } from "./CartUpsell";
import { CheckoutButton } from "./CheckoutButton";
import { GiftMessageField } from "./GiftMessageField";
import { GiftWrapToggle } from "./GiftWrapToggle";
import { useCart } from "./useCart";

/**
 * The cart drawer (docs/PLAN.md §13.7, §14.4; brief §6 cart drawer; REFERENCE §2.11). A Sheet from the right (Radix
 * Dialog: focus trap, Escape and the overlay close it, focus returns to the element that opened it), full width on
 * phones and 432 px from md, controlled by useCart().isOpen. Title "Je tas" with the item count.
 *
 * Scrolling body, in this order: CartProgressBars · the lines · hairline · GiftWrapToggle · GiftMessageField ·
 * CampaignCartNote · hairline · CartUpsell ("Maak de look af") · PaymentBadges. Sticky footer: CartTotals ·
 * CheckoutButton. Empty: CartEmpty. Notices of the cart (a code that did not combine, a line that is no longer for
 * sale) and the last error sit above the lines.
 *
 * A cart of gift cards only (digital, nothing is packed) gets no gift message field and no launch-gift line: both
 * promise something in a parcel (QA round 1). A note left from removed jewellery is cleared then.
 *
 * It closes on navigation (also a link inside it, and the back button). After a removal focus stays in the list: on
 * the line that took its place, the one before it, or the heading of the empty state (WCAG 2.4.3).
 * Mounted lazily by CartDrawerLoader. Port of CORVANE components/cart/CartDrawer.tsx.
 */

export function noticeText(notice: CartNotice): string {
  switch (notice.kind) {
    case "code-not-combined":
      return cartCopy.notices.codeNotCombined(notice.code);
    case "code-invalid":
      return cartCopy.notices.codeInvalid(notice.code);
    case "line-removed":
      return cartCopy.notices.lineRemoved(notice.title);
    case "quantity-capped":
      return cartCopy.notices.quantityCapped(notice.title, notice.max);
    case "not-yet-available":
      return cartCopy.notices.notYetAvailable(notice.title);
  }
}

export function CartDrawer() {
  const { cart, hydrated, isOpen, setOpen, closeCart, removeLine, lastError, setNote } = useCart();
  const listRef = useRef<HTMLUListElement>(null);
  const emptyHeadingId = `${useId()}-empty`;

  // Close on navigation (links inside the drawer, the back button); the first render is not a change.
  const pathname = usePathname();
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    closeCart();
  }, [pathname, closeCart]);

  const lines = cart?.lines ?? [];
  const empty = hydrated && lines.length === 0;
  // The totals already say why a code does not count (CartTotals), so that notice is not repeated at the top.
  const notices = (cart?.notices ?? []).filter((notice) => notice.kind !== "code-not-combined");
  // Something to pack: a gift message and the launch gift only make sense then (same rule as gift wrap).
  const physical = cart?.giftWrap.available ?? false;
  const strayNote = hydrated && cart !== null && !physical && lines.length > 0 && cart.note !== "";

  useEffect(() => {
    if (strayNote) void setNote("");
  }, [strayNote, setNote]);

  const handleRemove = async (lineId: string) => {
    const index = lines.findIndex((line) => line.id === lineId);
    await removeLine(lineId);
    requestAnimationFrame(() => {
      const targets = listRef.current?.querySelectorAll<HTMLElement>("[data-cart-line-focus]");
      const target =
        targets && targets.length > 0
          ? targets[Math.min(Math.max(index, 0), targets.length - 1)]
          : document.getElementById(emptyHeadingId);
      target?.focus({ preventScroll: false });
    });
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={setOpen}
      side="right"
      size="md"
      title={cartCopy.title}
      headerExtra={
        hydrated && cart && cart.itemCount > 0 ? (
          <span className="tabular mt-1 text-sm text-tekst-2">{cartCopy.itemCount(cart.itemCount)}</span>
        ) : null
      }
      footer={
        hydrated && cart && !empty ? (
          <div className="flex flex-col gap-3">
            <CartTotals cart={cart} />
            <CheckoutButton />
          </div>
        ) : undefined
      }
      bodyClassName="flex flex-col"
    >
      <div className="flex min-h-full flex-1 flex-col">
        {!hydrated ? (
          <div className="flex flex-1 items-center justify-center py-10">
            <Spinner label={sharedCopy.ui.loading} />
          </div>
        ) : empty || !cart ? (
          <CartEmpty headingId={emptyHeadingId} onNavigate={closeCart} />
        ) : (
          <>
            <CartProgressBars progress={cart.progress} />

            {lastError || notices.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2">
                {lastError ? (
                  <li className="flex items-start gap-2.5 rounded-kaart bg-fout-vlak px-4 py-3 text-sm text-tekst">
                    <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0 text-fout" strokeWidth={2} />
                    {cartCopy.errors[lastError]}
                  </li>
                ) : null}
                {notices.map((notice, index) => (
                  <li
                    key={`${notice.kind}-${index}`}
                    className="flex items-start gap-2.5 rounded-kaart bg-info-vlak px-4 py-3 text-sm text-tekst"
                  >
                    <Info aria-hidden="true" className="mt-px size-4 shrink-0 text-info" strokeWidth={2} />
                    {noticeText(notice)}
                  </li>
                ))}
              </ul>
            ) : null}

            <ul ref={listRef} aria-label={cartCopy.linesLabel} className="divide-y divide-rand">
              {lines.map((line) => (
                <CartLineItem
                  key={line.id}
                  line={line}
                  onRemove={(id) => {
                    void handleRemove(id);
                  }}
                />
              ))}
            </ul>

            {physical ? (
              <div className="flex flex-col gap-1 border-t border-rand py-4">
                <GiftWrapToggle />
                <GiftMessageField />
                <CampaignCartNote className="mt-2" />
              </div>
            ) : null}

            <CartUpsell />

            {/* In the scrolling body, not the sticky footer, so the totals take less of a phone screen. */}
            <PaymentBadges tone="licht" size="sm" className="mt-auto justify-center pt-6" />
          </>
        )}
      </div>
    </Sheet>
  );
}
