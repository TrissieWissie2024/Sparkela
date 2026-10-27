"use client";

import { Check } from "lucide-react";
import { useId, type RefObject } from "react";

import { formatMoney } from "@/lib/money";
import { cartCopy } from "@/content/copy/cart";
import { pagesCopy } from "@/content/copy/pages";
import { Button } from "@/components/ui/Button";

import type { PlacedOrder } from "./demoOrder";

/**
 * The confirmation of a demo order (docs/PLAN.md §13.13: "CheckoutState placed met DEMO-XXXXXX, cart leeg"). A white
 * card: a check in an olijf circle, the heading (focus lands here), the line that nothing was paid or sent, the demo
 * order reference, what was ordered (title, variant, quantity) with the total, where the confirmation would have gone,
 * and "Verder shoppen". The cart is already empty by now; this snapshot keeps the order in view.
 */
export function CheckoutPlaced({ order, headingRef }: { order: PlacedOrder; headingRef?: RefObject<HTMLHeadingElement | null> }) {
  const copy = pagesCopy.checkout.placed;
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="max-w-[40rem] rounded-kaart border border-rand bg-kaart p-6 md:p-10"
    >
      <div role="status">
        <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-olijf text-bot-wit">
          <Check className="size-5" strokeWidth={2.25} />
        </span>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="kop-2 mt-6 text-tekst outline-offset-4">
          {copy.title}
        </h2>
        <p className="tekst-groot mt-3 text-tekst-2">{copy.text}</p>
      </div>

      <dl className="mt-8 grid gap-x-6 gap-y-4 border-y border-rand py-5 sm:grid-cols-2">
        <div>
          <dt className="label-caps text-tekst-2">{copy.orderRef}</dt>
          <dd className="tabular mt-1.5 font-display text-xl font-extrabold tracking-[0.04em] text-tekst" data-order-ref="">
            {order.orderRef}
          </dd>
        </div>
        <div>
          <dt className="label-caps text-tekst-2">{copy.total}</dt>
          <dd className="mt-1.5 flex items-baseline gap-2">
            <span className="tabular text-xl font-semibold text-tekst">{formatMoney(order.total)}</span>
            <span className="tekst-klein text-tekst-2">{copy.items(order.itemCount)}</span>
          </dd>
        </div>
      </dl>

      {order.lines.length > 0 ? (
        <ul className="mt-5 space-y-1.5 text-[0.9375rem] text-tekst">
          {order.lines.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-4">
              <span className="min-w-0">
                {line.title}
                {line.variant ? <span className="text-tekst-2">, {line.variant}</span> : null}
              </span>
              <span className="tabular shrink-0 text-tekst-2">{cartCopy.line.quantityReadOnly(line.quantity)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {order.email ? <p className="mt-6 text-[0.9375rem] leading-relaxed text-tekst-2">{copy.emailNote(order.email)}</p> : null}

      <Button href={copy.cta.href} variant="primair" className="mt-8">
        {copy.cta.label}
      </Button>
    </section>
  );
}
