import Link from "next/link";
import { Timer } from "lucide-react";

import type { Drop } from "@/lib/types";
import { formatCountdownSr, formatEndLabel, formatStartLabel } from "@/lib/dates";
import { dropPath } from "@/lib/seo";
import { chromeCopy } from "@/content/copy/chrome";
import { sharedCopy } from "@/content/copy/shared";
import { Countdown } from "@/components/time/Countdown";

import { campaignLinkClasses, PromoDivider, promoLinkClasses } from "./CampaignMessage";

/**
 * A drop in the announcement bar (docs/PLAN.md §12.3 rules 2 and 3):
 * - `upcoming` (startsAt within 7 days): "Nieuwe drop: {naam}." with a real countdown to the fixed `startsAt`, with
 *   the start labels (before mount and when paused "vrijdag 5 februari om 19.00 uur", for screen readers "Begint op
 *   …", never "t/m", decision 135), and the link "Club-leden zijn er 24 uur eerder bij" to /sparkela-club.
 * - `live` (from startsAt to the drop's fixed endsAt, QA round 5; brief §6 block 1): "Nu live: {naam}" with the link
 *   "Bekijk de drop" and a real countdown to endsAt with the end labels, the same as the home's drop banner ("Nog 30d
 *   11u"; before mount and when paused "t/m 31 december", for screen readers "Eindigt op …"). Laid out like
 *   CampaignMessage: below lg the message and link, then the timer, the pause button at the bar's right edge.
 * At startsAt the bar's TimeSwitch moves on to the live segment, at endsAt to the next one; the countdown's "Nu live"
 * only covers the moment in between. A server component without hooks, rendered as a TimeSwitch variant.
 */

export function DropMessage({ drop, state }: { drop: Drop; state: "upcoming" | "live" }) {
  if (state === "live") {
    return (
      <div className="relative flex w-full flex-col items-center justify-center text-center max-lg:px-10 lg:flex-row lg:gap-x-3">
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
          <span>{chromeCopy.promo.dropLive(drop.name)}</span>
          <Link href={dropPath(drop.slug)} className={campaignLinkClasses}>
            {chromeCopy.promo.dropLink}
          </Link>
        </p>
        <PromoDivider className="hidden lg:block" />
        <span className="inline-flex items-center gap-1.5">
          <Timer aria-hidden="true" className="size-3.5 shrink-0 text-tekst-2-op-donker" strokeWidth={1.75} />
          <Countdown
            target={drop.endsAt}
            srLabel={formatCountdownSr(drop.endsAt, "end")}
            fallbackLabel={formatEndLabel(drop.endsAt)}
            tone="op-donker"
            prefix={chromeCopy.promo.campaignEndsIn}
            pauseClassName="max-lg:absolute max-lg:top-1/2 max-lg:right-0 max-lg:-translate-y-1/2"
          />
        </span>
      </div>
    );
  }

  return (
    // Below lg the pause button sits at the bar's right edge, as in CampaignMessage (QA round 1).
    <div className="relative flex w-full flex-col items-center justify-center text-center max-lg:px-10 lg:flex-row lg:gap-x-3">
      <p className="flex flex-wrap items-center justify-center gap-x-2.5">
        <span>{chromeCopy.promo.dropUpcoming(drop.name)}</span>
        <span className="inline-flex items-center gap-1.5">
          <Timer aria-hidden="true" className="size-3.5 shrink-0 text-tekst-2-op-donker" strokeWidth={1.75} />
          <Countdown
            target={drop.startsAt}
            liveLabel={sharedCopy.countdown.live}
            srLabel={formatCountdownSr(drop.startsAt, "start")}
            fallbackLabel={formatStartLabel(drop.startsAt)}
            tone="op-donker"
            prefix={chromeCopy.promo.dropStartsIn}
            pauseClassName="max-lg:absolute max-lg:top-1/2 max-lg:right-0 max-lg:-translate-y-1/2"
          />
        </span>
      </p>
      <PromoDivider className="hidden lg:block" />
      <Link href="/sparkela-club" className={promoLinkClasses}>
        {chromeCopy.promo.earlyAccessLink}
      </Link>
    </div>
  );
}
