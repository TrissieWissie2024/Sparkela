import Link from "next/link";
import { Timer } from "lucide-react";

import type { Campaign } from "@/lib/types";
import { formatCountdownSr, formatEndLabel } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { chromeCopy } from "@/content/copy/chrome";
import { Countdown } from "@/components/time/Countdown";

/**
 * A running campaign in the announcement bar (docs/PLAN.md §12.3 rule 1, §10.6; brief §2.4): the message, a real
 * countdown to the campaign's fixed `endsAt` (only with `showTimer`) and its link. The countdown counts to the end, so
 * it gets the end labels: before mount and when paused "t/m 30 november", for screen readers "Eindigt op maandag
 * 30 november om middernacht". It never resets; at the end the bar's TimeSwitch shows the next segment.
 *
 * Below lg two lines: the short message with the link, then the timer (its 32 px pause button overlaps the line
 * box by a negative margin, so the bar stays 48 px; with reduced motion there is no button and no negative margin, so
 * the fixed end label does not overlap the first line); from lg one line with the full message and thin dividers.
 * Screen readers get the full message once (the short one is aria-hidden). Text wraps rather than clips
 * (WCAG 1.4.12). A server component without hooks: the bar renders it as a TimeSwitch variant.
 * Port of CORVANE components/layout/promo/CampaignMessage.tsx.
 */

/** The bar's text links: a 44 px touch target centred on the 16 px line, whatever the line height (decision 201). */
export const promoLinkClasses =
  "relative font-semibold text-tekst-op-donker underline underline-offset-4 decoration-1 hover:decoration-2 " +
  "before:absolute before:-inset-x-1 before:top-1/2 before:h-[44px] before:-translate-y-1/2 before:content-['']";

export function PromoDivider({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("h-3 w-px shrink-0 bg-rand-op-donker", className)} />;
}

export function CampaignMessage({ campaign }: { campaign: Campaign }) {
  const { promo } = campaign;
  const link =
    promo.href && promo.linkLabel ? (
      <Link href={promo.href} className={promoLinkClasses}>
        {promo.linkLabel}
      </Link>
    ) : null;
  const timer = campaign.showTimer ? (
    <span className="-my-1.5 inline-flex items-center gap-1.5 motion-reduce:my-0 lg:my-0">
      <Timer aria-hidden="true" className="size-3.5 shrink-0 text-tekst-2-op-donker" strokeWidth={1.75} />
      <Countdown
        target={campaign.endsAt}
        srLabel={formatCountdownSr(campaign.endsAt, "end")}
        fallbackLabel={formatEndLabel(campaign.endsAt)}
        tone="op-donker"
        prefix={chromeCopy.promo.campaignEndsIn}
      />
    </span>
  ) : null;

  return (
    <div className="flex w-full flex-col items-center justify-center text-center lg:flex-row lg:gap-x-3">
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
        <span aria-hidden="true" className="lg:hidden">
          {promo.short}
        </span>
        <span className="sr-only lg:not-sr-only">{promo.message}</span>
        {link}
      </p>
      {timer ? (
        <>
          <PromoDivider className="hidden lg:block" />
          {timer}
        </>
      ) : null}
    </div>
  );
}
