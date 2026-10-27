import { cn } from "@/lib/cn";
import { chromeCopy } from "@/content/copy/chrome";
import { site } from "@/content/site";

/**
 * The accepted payment methods (site.paymentMethods) as small neutral text badges (docs/PLAN.md §13.5, decision 93):
 * no payment brand logos, colours or marks, so there are no logo files and no usage rules to keep up with. The
 * footer (tone "donker") and the cart drawer (tone "licht", size "sm") use it.
 *
 * A list with an accessible name. No hooks, so it renders in server and client components alike. Port of CORVANE
 * components/layout/PaymentIcons.tsx in Sparkela tokens.
 */

export interface PaymentBadgesProps {
  /** The surface the badges sit on: "licht" (pagina, vlak, kaart) or "donker" (footer). */
  tone?: "licht" | "donker";
  /** "sm" fits every method on one line in the 350 px body of the drawer on a phone. */
  size?: "sm" | "md";
  className?: string;
}

const tones = {
  licht: "bg-kaart text-tekst-2 ring-rand",
  donker: "bg-bot-wit/5 text-tekst-2-op-donker ring-rand-op-donker",
} as const;

const sizes = {
  sm: { list: "gap-1", item: "h-[22px] px-1.5 text-[0.6875rem]" },
  md: { list: "gap-1.5", item: "h-6 px-2 text-xs" },
} as const;

export function PaymentBadges({ tone = "licht", size = "md", className }: PaymentBadgesProps) {
  return (
    // role="list" keeps the list semantics in Safari, which drops them with list-style: none.
    <ul role="list" aria-label={chromeCopy.payments.label} className={cn("flex flex-wrap", sizes[size].list, className)}>
      {site.paymentMethods.map((method) => (
        <li
          key={method}
          className={cn(
            "inline-flex items-center rounded-md leading-none font-semibold whitespace-nowrap ring-1 ring-inset",
            "forced-colors:border forced-colors:border-[CanvasText]",
            sizes[size].item,
            tones[tone],
          )}
        >
          {method}
        </li>
      ))}
    </ul>
  );
}
