"use client";

import { cn } from "@/lib/cn";
import { chromeCopy } from "@/content/copy/chrome";
import { useCart } from "@/components/cart/useCart";
import { buttonClasses } from "@/components/ui/Button";

/**
 * "Tas (n)" in the header (docs/PLAN.md §13.5; brief §6 block 2): opens the cart drawer. The count sits in a fixed box
 * with tabular figures next to the word, so nothing moves when it appears or changes. The box is 1.98em wide, three
 * times the digit 0 of Inter 600 (0.66em; "(9)" is 1.43em, "(99)" 2.08em); the plan's 4.5ch would reserve about 15 px
 * more than any count needs, and between 380 and 400 px the header has no room for that. In em, not `ch`: `ch`
 * follows the font that paints, the fallback's 0 is 14% narrower, and the box then grew when Inter swapped in, which
 * moved the centred desktop nav (integrator 10, decision 212). Before hydration (the server never
 * knows the cart) the box is empty but reserved; from the first cart read it shows "(n)", also "(0)". The accessible
 * name says the count in words ("Tas, 2 artikelen") and starts with the visible "Tas" (WCAG 2.5.3); aria-haspopup and
 * aria-expanded tell that it opens the drawer. Port of CORVANE components/layout/header/CartButton.tsx.
 */
export function CartButton() {
  const { itemCount, hydrated, isOpen, openCart } = useCart();
  const count = hydrated ? itemCount : 0;

  return (
    <button
      type="button"
      aria-label={chromeCopy.header.cartLabel(count)}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      onClick={openCart}
      className={cn(
        buttonClasses({ variant: "ghost", size: "sm" }),
        // A 44 px tall target (sm draws 36 px) and tighter padding, so it fits next to the logo at 320 px. Without
        // tailwind-merge the overrides need the important flag to win over the sm size classes.
        "h-11! px-1.5! text-[0.9375rem]!",
      )}
    >
      {/* One inline run, so the text reads "Tas (2)" (the space is real, not a flex gap). */}
      <span className="whitespace-nowrap">
        {chromeCopy.header.cart}{" "}
        <span aria-hidden="true" className="tabular inline-block min-w-[1.98em] text-left">
          {hydrated ? chromeCopy.header.cartCount(count) : null}
        </span>
      </span>
    </button>
  );
}
