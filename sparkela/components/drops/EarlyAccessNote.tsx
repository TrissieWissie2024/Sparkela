"use client";

import type { Drop } from "@/lib/types";
import { earlyAccessAt, formatStartLabel, toMs } from "@/lib/dates";
import { collectionCopy } from "@/content/copy/collection";
import { Spark } from "@/components/brand/Spark";
import { TimeSwitch } from "@/components/time/TimeSwitch";

/**
 * The early-access line on a drop page (docs/PLAN.md §12.5, §13.12, §14.6): "Jij bent er 24 uur eerder bij. Publiek
 * live op {formatStartLabel(startsAt)}." Only during early access, the 24 hours before the public start, when the
 * page is open to Club members with the link from their mail: a TimeSwitch on [earlyAccessAt, startsAt] with the
 * variants [nothing, note, nothing], so it appears and disappears exactly, also in an open tab. (The plan names a
 * TimeGate on startsAt; the extra boundary keeps the line away from a preview before early access.) The empty
 * variants have no height (`className`, for spacing, sits on the note's own wrapper). An info box (leisteen on --info-vlak, 7,53:1) with a decorative spark.
 */
export function EarlyAccessNote({ drop, className }: { drop: Drop; className?: string }) {
  const note = (
    <div className={className}>
      <p className="flex items-start gap-3 rounded-kaart bg-info-vlak px-5 py-4 font-medium text-info md:items-center md:px-6">
        <Spark className="mt-0.5 size-4 shrink-0 md:mt-0" />
        {collectionCopy.drop.earlyAccess(formatStartLabel(drop.startsAt))}
      </p>
    </div>
  );
  return (
    <TimeSwitch boundaries={[earlyAccessAt(drop), toMs(drop.startsAt)]} variants={[null, note, null]} />
  );
}
