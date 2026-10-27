import type { ReactNode } from "react";

import { promoSchedule, type PromoEntry, type PromoState } from "@/lib/dates";
import { getServerNow } from "@/lib/server-clock";
import { chromeCopy } from "@/content/copy/chrome";
import { site } from "@/content/site";
import { TimeSwitch } from "@/components/time/TimeSwitch";

import { CampaignMessage } from "./CampaignMessage";
import { DropMessage } from "./DropMessage";
import { UspBar } from "./UspBar";

/**
 * The announcement bar above the header (docs/PLAN.md §12.3, §10.5; brief §6 block 1): a running campaign with its
 * countdown, else a drop that starts within 7 days (countdown to the start), else a drop that has been live for less
 * than 7 days ("Nu live"), else the rotating USP line.
 *
 * The server renders every segment of promoSchedule(serverNow, 60 days) (lib/dates.ts, pure) and a TimeSwitch shows
 * the right one: before the first paint through its inline script, in an open tab exactly at every boundary. The
 * bar is in normal flow (it scrolls away; only the header sticks), on donker with data-vlak="donker" (bot-wit focus
 * ring), at least --promo-hoogte tall (48 px below lg, 40 px from lg); text may make it taller, never clipped
 * (WCAG 1.4.12). Hidden in print.
 *
 * AnnouncementBar is the thin async data wrapper; AnnouncementBarView is synchronous and takes the schedule as props
 * (tests render it with renderToStaticMarkup).
 */

/** How far ahead the bar's segments are rendered (plan §10.5). */
export const PROMO_SCHEDULE_DAYS = 60;

function segment(state: PromoState): ReactNode {
  switch (state.kind) {
    case "campaign":
      return <CampaignMessage campaign={state.campaign} />;
    case "drop-upcoming":
      return <DropMessage drop={state.drop} state="upcoming" />;
    case "drop-live":
      return <DropMessage drop={state.drop} state="live" />;
    case "usp":
      return <UspBar usps={site.usps} />;
  }
}

export function AnnouncementBarView({ entries }: { entries: PromoEntry[] }) {
  const variants = entries.map((entry) => (
    // Every variant fills the bar, so the visible one is centred whatever wrapper TimeSwitch puts around it.
    <div key={entry.from} className="mx-auto flex min-h-promo w-full max-w-[1240px] items-center px-4 py-1 md:px-8">{segment(entry.state)}</div>
  ));
  return (
    <section
      aria-label={chromeCopy.promo.regionLabel}
      data-vlak="donker"
      className="relative min-h-promo bg-donker text-xs leading-4 font-medium text-tekst-op-donker lg:text-[0.8125rem] print:hidden"
    >
      {variants.length > 0 ? (
        <TimeSwitch boundaries={entries.slice(1).map((entry) => entry.from)} variants={variants} serverIndex={0} />
      ) : null}
    </section>
  );
}

export async function AnnouncementBar() {
  const now = await getServerNow();
  return <AnnouncementBarView entries={promoSchedule(now, PROMO_SCHEDULE_DAYS)} />;
}
