"use client";

import { shipScheduleBoundaries, type ShipLabelEntry } from "@/lib/dates";
import { sharedCopy } from "@/content/copy/shared";
import { TimeSwitch } from "@/components/time/TimeSwitch";

/**
 * The shipping day as text that switches by itself (docs/PLAN.md §10.5, §13.5, decision 178): a TimeSwitch over the
 * schedule that lib/shop-data.ts getShipSchedule() builds on the server for the next 14 days. Before the first paint
 * the inline script and in an open tab the browser pick the right entry, exact to the second, so "Vóór 16.00
 * besteld? Vandaag verstuurd." turns into "Nu besteld, maandag verstuurd." at 16.00. After the last entry the
 * always-true fallback from sharedCopy shows (the static page was not rebuilt for two weeks).
 *
 * Never a countdown to 16.00 (that would be a timer that resets every day, brief §2.4). A <span>, so it fits in a
 * sentence; give `className` a min-height where the text may wrap differently per variant.
 */

export type ShipLabelField = "barText" | "estimateText" | "dispatchLabel";

export interface ShipLabelProps {
  schedule: ShipLabelEntry[];
  field: ShipLabelField;
  className?: string;
}

/** The always-true text after the schedule (and for an empty schedule). */
export function shipLabelFallback(field: ShipLabelField): string {
  return field === "estimateText" ? sharedCopy.deliveryEstimate.fallback : sharedCopy.deliveryBar.fallback;
}

export function ShipLabel({ schedule, field, className }: ShipLabelProps) {
  const fallback = shipLabelFallback(field);
  if (schedule.length === 0) return <span className={className}>{fallback}</span>;
  return (
    <TimeSwitch
      as="span"
      boundaries={shipScheduleBoundaries(schedule)}
      variants={[...schedule.map((entry) => entry[field]), fallback]}
      className={className}
    />
  );
}
