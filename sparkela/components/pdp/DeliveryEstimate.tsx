import { ArrowRight, Package } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { JewelryType, ProductType } from "@/lib/types";
import type { ShipLabelEntry } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { collectionPath } from "@/lib/paths";
import { pdpCopy } from "@/content/copy/pdp";
import { sharedCopy } from "@/content/copy/shared";
import { ShipLabel } from "@/components/layout/ShipLabel";
import { Flag } from "@/components/ui/Flag";

/**
 * The delivery estimate under the buy button (docs/PLAN.md §13.9, §10.5; brief §6: "Vóór 16.00 besteld, vandaag
 * verstuurd. Meestal binnen 1 tot 2 werkdagen in je brievenbus."; port of CORVANE DeliveryEstimate without the NL/BE
 * switch). A white card with a hairline: the estimate as text that switches by itself (ShipLabel, a TimeSwitch over
 * getShipSchedule(): exact at 16.00 and at midnight, before the first paint and in an open tab, then the always-true
 * fallback), and a line with the Dutch flag about PostNL. Fixed text only, never a countdown to the cut-off (a timer
 * that resets every day, brief §2.4).
 *
 * Renders as a server component (no state of its own; ShipLabel is the client island), so it can sit in the server
 * tree under the buy box. The gift card has none: its TrustRow says "Direct in je mail" (plan §14.2).
 */

export function DeliveryEstimate({ schedule, className }: { schedule: ShipLabelEntry[]; className?: string }) {
  return (
    <Panel className={className}>
      <h2 className="sr-only">{pdpCopy.sections.delivery}</h2>
      <Line icon={<Package aria-hidden="true" className="size-[18px]" strokeWidth={1.5} />} strong>
        <ShipLabel schedule={schedule} field="estimateText" />
      </Line>
      <Line icon={<Flag decorative />}>{pdpCopy.delivery.carrier}</Line>
    </Panel>
  );
}

/**
 * Instead of the delivery card when nothing of the piece is for sale (QA round 2): "Vóór 16.00 besteld, vandaag
 * verstuurd" under a disabled "Uitverkocht" read as a mistake. A short line and a link to the piece's type collection.
 */
export function SoldOutNote({ type, className }: { type: ProductType | null; className?: string }) {
  const jewelry = type !== null && type in sharedCopy.vocab.type ? (type as JewelryType) : null;
  const label = jewelry ? sharedCopy.vocab.type[jewelry] : null;
  return (
    <Panel className={className}>
      <p className="text-sm leading-5 text-tekst-2">{pdpCopy.delivery.soldOut}</p>
      <Link
        href={collectionPath(jewelry ?? "alle")}
        className="group inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-link underline decoration-1 underline-offset-4 hover:text-link-hover hover:decoration-2"
      >
        {pdpCopy.delivery.soldOutLink(label)}
        <ArrowRight aria-hidden="true" className="size-4 motion-safe:transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
      </Link>
    </Panel>
  );
}

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-kaart border border-rand bg-kaart px-4 py-4 md:px-5", className)}>
      {children}
    </div>
  );
}

function Line({ icon, strong = false, children }: { icon: ReactNode; strong?: boolean; children: ReactNode }) {
  return (
    <p className={cn("flex items-start gap-3 text-sm leading-5", strong ? "font-semibold text-tekst" : "text-tekst-2")}>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-tekst">{icon}</span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}
