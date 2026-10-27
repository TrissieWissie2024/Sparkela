"use client";

import type { Drop } from "@/lib/types";
import { earlyAccessAt, toMs } from "@/lib/dates";
import { StatusLabel } from "@/components/ui/StatusLabel";
import { TimeSwitch } from "@/components/time/TimeSwitch";

/**
 * The drop label on the product page (docs/PLAN.md §10.5, §13.9; decision 134): "Early access" during the 24 hours
 * before the public start, "Limited" while the drop is live, nothing before early access and after the end. The only
 * place the product page says "Limited" or "Early access" (getProductBadges leaves both out), and a TimeSwitch over
 * the drop's literal dates, so it switches exactly on the second, before the first paint and in an open tab.
 * Each variant is a 24 px StatusLabel; the empty ones take no room (the label row keeps its own min-height).
 */
export function DropStatusLabel({ drop }: { drop: Drop }) {
  return (
    <TimeSwitch
      as="span"
      className="contents"
      boundaries={[earlyAccessAt(drop), toMs(drop.startsAt), toMs(drop.endsAt)]}
      variants={[null, <StatusLabel key="early" id="early-access" size="pdp" />, <StatusLabel key="limited" id="limited" size="pdp" />, null]}
    />
  );
}
