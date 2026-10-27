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
 * the pricing rules do; a reached milestone collapses to one line with a check mark. Gift cards count for neither:
 * with gift cards only the block is one line that they come by mail. With Shopify the progress comes from
 * progressFromShopifyCart (Shopify's own amounts).
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
        freeShipping.reached ? (
          <Status icon={null} done>
            {texts.shipping}
          </Status>
        ) : (
          <div>
            <Status icon={<Truck className="size-4" strokeWidth={1.75} />} done={false}>
              {texts.shipping}
            </Status>
            <ProgressBar value={freeShipping.ratio} label={cartCopy.progress.shippingMeter} className="mt-2.5" />
          </div>
        )
      ) : null}

      {texts.stack ? (
        stack.reached ? (
          <Status icon={null} done>
            {texts.stack}
          </Status>
        ) : (
          <div>
            <Status icon={<Layers className="size-4" strokeWidth={1.75} />} done={false}>
              {texts.stack}
            </Status>
            <ProgressBar value={filled / steps} segments={steps} label={cartCopy.progress.stackMeter} className="mt-2.5" />
          </div>
        )
      ) : null}
    </section>
  );
}
