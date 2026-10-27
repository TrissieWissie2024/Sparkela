import Link from "next/link";
import { Timer } from "lucide-react";

import type { Drop } from "@/lib/types";
import { formatCountdownSr, formatStartLabel } from "@/lib/dates";
import { dropPath } from "@/lib/seo";
import { chromeCopy } from "@/content/copy/chrome";
import { sharedCopy } from "@/content/copy/shared";
import { Countdown } from "@/components/time/Countdown";

import { PromoDivider, promoLinkClasses } from "./CampaignMessage";

/**
 * A drop in the announcement bar (docs/PLAN.md §12.3 rules 2 and 3):
 * - `upcoming` (startsAt within 7 days): "Nieuwe drop: {naam}." with a real countdown to the fixed `startsAt`, with
 *   the start labels (before mount and when paused "vrijdag 5 februari om 19.00 uur", for screen readers "Begint op
 *   …", never "t/m", decision 135), and the link "Club-leden zijn er 24 uur eerder bij" to /sparkela-club.
 * - `live` (first 7 days after startsAt): "Nu live: {naam}" with the link "Bekijk de drop". No timer.
 * At startsAt the bar's TimeSwitch moves on to the live segment; the countdown's "Nu live" only covers the moment in
 * between. A server component without hooks, rendered as a TimeSwitch variant.
 */

export function DropMessage({ drop, state }: { drop: Drop; state: "upcoming" | "live" }) {
  if (state === "live") {
    return (
      <p className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-center">
        <span>{chromeCopy.promo.dropLive(drop.name)}</span>
        <Link href={dropPath(drop.slug)} className={promoLinkClasses}>
          {chromeCopy.promo.dropLink}
        </Link>
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col items-center justify-center text-center lg:flex-row lg:gap-x-3">
      <p className="flex flex-wrap items-center justify-center gap-x-2.5">
        <span>{chromeCopy.promo.dropUpcoming(drop.name)}</span>
        <span className="-my-1.5 inline-flex items-center gap-1.5 motion-reduce:my-0 lg:my-0">
          <Timer aria-hidden="true" className="size-3.5 shrink-0 text-tekst-2-op-donker" strokeWidth={1.75} />
          <Countdown
            target={drop.startsAt}
            liveLabel={sharedCopy.countdown.live}
            srLabel={formatCountdownSr(drop.startsAt, "start")}
            fallbackLabel={formatStartLabel(drop.startsAt)}
            tone="op-donker"
            prefix={chromeCopy.promo.dropStartsIn}
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
