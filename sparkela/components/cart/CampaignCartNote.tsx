"use client";

import { Gift } from "lucide-react";

import { toMs } from "@/lib/dates";
import { cartCopy } from "@/content/copy/cart";
import { campaigns } from "@/content/offers";
import { TimeSwitch } from "@/components/time/TimeSwitch";

/**
 * The launch gift line in the cart (docs/PLAN.md §10.5, §12.2, §13.7; brief §4): during a campaign window it says
 * "Bij deze bestelling zit een cadeautje van ons." Nothing is added to the cart (Campaign.inCart is always false);
 * Linde and Tristan put the gift in the parcel. A TimeSwitch over the fixed windows of content/offers.ts, so the line
 * appears and disappears exactly at their start and end; outside them it renders an empty, zero-height variant.
 */

/** Boundaries and visibility per segment: [hidden, shown, hidden, …] over the campaign windows, sorted. */
export function campaignNoteSchedule(): { boundaries: number[]; shown: boolean[] } {
  const windows = [...campaigns].sort((a, b) => toMs(a.startsAt) - toMs(b.startsAt));
  const boundaries: number[] = [];
  const shown: boolean[] = [false];
  for (const campaign of windows) {
    const start = toMs(campaign.startsAt);
    const end = toMs(campaign.endsAt);
    // Overlapping or touching windows: keep the boundaries ascending.
    if (boundaries.length > 0 && start <= boundaries[boundaries.length - 1]) {
      boundaries[boundaries.length - 1] = Math.max(boundaries[boundaries.length - 1], end);
      continue;
    }
    boundaries.push(start, end);
    shown.push(true, false);
  }
  return { boundaries, shown };
}

export function CampaignCartNote({ className }: { className?: string }) {
  const { boundaries, shown } = campaignNoteSchedule();
  if (boundaries.length === 0) return null;
  const note = (
    <p className="flex items-start gap-2.5 rounded-kaart bg-vlak px-4 py-3 text-sm leading-snug text-tekst">
      <Gift aria-hidden="true" className="mt-px size-4 shrink-0 text-tekst-2" strokeWidth={1.75} />
      {cartCopy.campaignNote}
    </p>
  );
  return (
    <TimeSwitch boundaries={boundaries} variants={shown.map((visible) => (visible ? note : null))} className={className} />
  );
}
