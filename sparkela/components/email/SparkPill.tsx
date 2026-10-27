"use client";

import { X } from "lucide-react";
import type { RefObject } from "react";

import { cn } from "@/lib/cn";
import { pagesCopy } from "@/content/copy/pages";
import { site } from "@/content/site";
import { Spark } from "@/components/brand/Spark";

/**
 * The floating pill "Kies je spark" (docs/PLAN.md §13.11, §13.11.1, §4.6; brief §6 block 6). Port of the pill in CORVANE
 * components/email/EmailCapture.tsx.
 *
 * - Fixed bottom left, 16 px from the edges on phones and 24 px from lg, clear of the safe area, z-45 (under the
 *   consent banner and dialogs). A light pill with a hairline and the floating shadow: two tiny face-down cards with a
 *   spark, the label in 13 px semibold, a divider and a 44 px close button.
 * - Rides above the product page's sticky add-to-cart bar: StickyAddToCart sets --onderbalk on <body> (decision 118),
 *   and the bottom offset adds it, so the two never overlap.
 * - The open button says what it offers to screen readers ("Kies je spark, 10% op je eerste bestelling"; the name
 *   starts with the visible label) and has aria-haspopup="dialog". Never wider than the screen: the label wraps.
 * - Comes in with a fade and a small rise (sparkela-modal-in), only with motion allowed.
 */

export interface SparkPillProps {
  onOpen(): void;
  onDismiss(): void;
  /** The button that opens the modal (focus can return to it). */
  openRef?: RefObject<HTMLButtonElement | null>;
  className?: string;
}

/** Two small cards, the front one face down with the spark: the cards of the modal in miniature. */
function PillCards() {
  return (
    <span aria-hidden="true" className="relative block h-7 w-7 shrink-0">
      <span className="absolute top-[4px] left-[1px] h-[20px] w-[15px] -rotate-[14deg] rounded-[3px] border border-rand-sterk bg-vlak" />
      <span className="absolute top-[2px] right-[2px] flex h-[22px] w-[16px] rotate-[6deg] items-center justify-center rounded-[3px] bg-donker text-roest-300">
        <Spark className="size-[11px]" />
      </span>
    </span>
  );
}

export function SparkPill({ onOpen, onDismiss, openRef, className }: SparkPillProps) {
  const copy = pagesCopy.popup;
  return (
    <div
      data-spark-pill=""
      className={cn(
        "fixed z-45 print:hidden",
        "bottom-[calc(var(--onderbalk,0px)+1rem+env(safe-area-inset-bottom,0px))] left-[calc(1rem+env(safe-area-inset-left,0px))]",
        "lg:bottom-[calc(var(--onderbalk,0px)+1.5rem+env(safe-area-inset-bottom,0px))] lg:left-[calc(1.5rem+env(safe-area-inset-left,0px))]",
        // Never wider than the screen (large text): the label wraps and the close button stays in view.
        "max-w-[calc(100vw-2rem)] lg:max-w-[calc(100vw-3rem)]",
        "motion-safe:animate-[sparkela-modal-in_320ms_cubic-bezier(0.32,0.72,0,1)_both]",
        className,
      )}
    >
      <div className="flex min-w-0 items-center rounded-full border border-rand bg-kaart text-tekst shadow-zwevend">
        <button
          ref={openRef}
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          // One string: "Kies je spark, 10% op je eerste bestelling" (an sr-only span added a space before the comma).
          aria-label={`${site.emailCapture.pillLabel}${copy.pillSuffix}`}
          className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-full py-1 pr-3.5 pl-2 text-left text-[0.8125rem] leading-tight font-semibold transition-colors hover:bg-current/5"
        >
          <PillCards />
          <span className="min-w-0">{site.emailCapture.pillLabel}</span>
        </button>
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-rand" />
        <button
          type="button"
          onClick={onDismiss}
          aria-label={copy.pillDismiss}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-tekst-2 transition-colors hover:bg-current/5 hover:text-tekst"
        >
          <X aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
