import { Timer } from "lucide-react";

import type { IsoDateTime } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatCountdownSr, formatEndLabel, formatStartLabel } from "@/lib/dates";
import { collectionCopy } from "@/content/copy/collection";
import { Countdown } from "@/components/time/Countdown";

/**
 * The countdown of a drop on a roest surface (docs/PLAN.md §10.6, §12.4, §13.12): a 44 px pill with a hairline in
 * bot-wit, a timer icon and the real Countdown to a fixed date from content/drops.ts (brief §2.4). `kind` picks the
 * labels, so a start never says "t/m" and an end never says "Begint op" (decision 135): to a start the running digits
 * read "Over 2d 5u" and the fixed label is formatStartLabel ("vrijdag 5 februari om 19.00 uur"); to an end "Nog 34d
 * 11u" and formatEndLabel ("t/m 31 december"). The screen reader label is formatCountdownSr. Callers put it inside a
 * TimeSwitch on the same target, so a cached page never keeps counting past it (decision 187).
 */

export interface DropCountdownProps {
  target: IsoDateTime;
  kind: "start" | "end";
  /** "Nu live" at the start; without it the countdown renders nothing at 0. */
  liveLabel?: string;
  className?: string;
}

export function DropCountdown({ target, kind, liveLabel, className }: DropCountdownProps) {
  const start = kind === "start";
  return (
    <span
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4 text-[0.9375rem] text-bot-wit ring-1 ring-bot-wit/50 ring-inset",
        className,
      )}
    >
      <Timer aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.5} />
      <Countdown
        target={target}
        liveLabel={liveLabel}
        srLabel={formatCountdownSr(target, kind)}
        fallbackLabel={start ? formatStartLabel(target) : formatEndLabel(target)}
        prefix={start ? collectionCopy.drop.startsIn : collectionCopy.drop.endsIn}
        tone="op-roest"
      />
    </span>
  );
}
