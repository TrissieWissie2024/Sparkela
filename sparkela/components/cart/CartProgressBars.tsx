import { Check, Layers, Mail, Truck } from "lucide-react";
import type { ReactNode } from "react";

import type { CartProgress } from "@/lib/types";
import { cn } from "@/lib/cn";
import { progressTexts } from "@/lib/pricing";
import { cartCopy } from "@/content/copy/cart";
import { sharedCopy } from "@/content/copy/shared";
import { stackDiscount } from "@/content/offers";
import { ProgressBar } from "@/components/ui/ProgressBar";

/**
 * The two milestones at the top of the cart drawer (docs/PLAN.md §8.3, §13.7; brief §6 cart drawer): a bar towards
 * free shipping ("Nog €0,10 tot gratis verzending") and three segments towards the stack discount ("Nog 1 armband of
 * oorbel voor 15% stack-korting"). The texts come from progressTexts() (lib/pricing.ts), so they say exactly what
 * the pricing rules do; a reached milestone swaps its icon for a check mark and keeps its bar, full. Gift cards count
 * for neither: with gift cards only the block is one line that they come by mail. With Shopify the progress comes from
 * progressFromShopifyCart (Shopify's own amounts).
 *
 * The block keeps its height while the shopper taps "+" or "−" on a line below it (QA afsluitende controle): a reached
 * milestone used to drop its bar and the stack text goes from two lines ("Nog 2 armbanden of oorbellen …") to one,
 * so the stepper jumped 33 px under the finger and the next taps hit the line instead of "+". So both rows always
 * have their bar, and the stack text keeps room for two lines, with the text on its bar.
 *
 * No hooks, so it renders on the server and in the drawer alike. Port of CORVANE components/cart/ShippingProgress.tsx.
 */

function Status({ icon, done, children }: { icon: ReactNode; done: boolean; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 text-sm leading-snug text-tekst">
      <span
        aria-hidden="true"
        className={cn("mt-px inline-flex size-[18px] shrink-0 items-center justify-center", done ? "text-succes" : "text-tekst-2")}
      >
        {done ? <Check className="size-4" strokeWidth={2.25} /> : icon}
      </span>
      <span className="min-w-0 text-balance">{children}</span>
    </p>
  );
}

export function CartProgressBars({ progress, className }: { progress: CartProgress; className?: string }) {
  const texts = progressTexts(progress);
  const { freeShipping, stack } = progress;
  const frame = cn("border-b border-rand pb-5", className);

  if (!freeShipping.applies) {
    return (
      <section aria-label={cartCopy.progress.label} className={frame}>
        <Status icon={<Mail className="size-4" strokeWidth={1.75} />} done={false}>
          {sharedCopy.progress.giftCardsOnly}
        </Status>
      </section>
    );
  }

  // One segment per piece up to the stack threshold (3, content/offers.ts).
  const steps = Math.max(1, stackDiscount.minUnits);
  const filled = Math.min(stack.units, steps);

  return (
    <section aria-label={cartCopy.progress.label} className={cn("space-y-4", frame)}>
      {texts.shipping ? (
        <div>
          <Status icon={<Truck className="size-4" strokeWidth={1.75} />} done={freeShipping.reached}>
            {texts.shipping}
          </Status>
          <ProgressBar
            value={freeShipping.reached ? 1 : freeShipping.ratio}
            label={cartCopy.progress.shippingMeter}
            className="mt-2.5"
          />
        </div>
      ) : null}

      {texts.stack ? (
        <div>
          {/* Room for the longest text (two lines), the text at the bottom on its bar (see above). */}
          <div className="flex min-h-[2lh] flex-col justify-end text-sm leading-snug">
            <Status icon={<Layers className="size-4" strokeWidth={1.75} />} done={stack.reached}>
              {texts.stack}
            </Status>
          </div>
          <ProgressBar value={filled / steps} segments={steps} label={cartCopy.progress.stackMeter} className="mt-2.5" />
        </div>
      ) : null}
    </section>
  );
}
