"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useId, useState, useSyncExternalStore } from "react";

import type { IsoDateTime } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useMediaQuery, REDUCED_MOTION_QUERY } from "@/lib/hooks/useMediaQuery";
import { useNow } from "@/lib/hooks/useNow";
import { formatCountdown, getCountdown, scheduleAt } from "@/lib/schedule";
import { sharedCopy } from "@/content/copy/shared";
import { InlineScript } from "@/components/ui/InlineScript";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";

import { COUNTDOWN_HIDE_ATTRIBUTE, countdownScript } from "./countdownScript";

/**
 * A real countdown to a fixed date from content/drops.ts or content/offers.ts (brief §2.4, plan §10.6). Never reset
 * per visitor or per day, never negative, never restarting.
 *
 * - Before mount the box shows `fallbackLabel` (formatEndLabel or formatStartLabel from lib/dates.ts); an inline script
 *   (countdownScript) writes the running digits into the same box before the first paint, and hydration keeps them
 *   (suppressHydrationWarning), so the hand-over is invisible.
 * - After mount it ticks every second through useNow(1000): "2d 5u" above a day, "05:12:09" in the last 24 hours, in
 *   tabular figures in a box of at least 8 characters, so the layout does not move as digits change. `prefix`
 *   ("Nog ") stands before the running digits only, so sighted users see what counts down; the fixed label has none. The digits are
 *   aria-hidden; screen readers get `srLabel` ("Eindigt op …") and no live region.
 * - A pause button with a fixed label ("Aftellen pauzeren") and aria-pressed (WCAG 2.2.2). Paused, the fixed label
 *   shows. With reduced motion there is no ticking and no button (motion-reduce:hidden): the fixed label shows.
 * - At the target (scheduleAt, so it also switches while paused): `liveLabel` ("Nu live"), or nothing without one.
 *   A static page visited after the target gets the same from the inline script before hydration (decision 187).
 *   An unparseable target renders nothing (fail closed). Without JavaScript at all the fixed label stays, so a
 *   countdown whose target can pass while the page is cached still sits inside a TimeSwitch on that target (§12.4).
 */

export interface CountdownProps {
  /** Fixed date from content/drops.ts or content/offers.ts, never computed. */
  target: IsoDateTime;
  /** "Nu live"; without it the countdown renders nothing at 0. */
  liveLabel?: string;
  /** formatCountdownSr(target, kind), for screen readers only. */
  srLabel: string;
  /** Fixed text before mount, when paused and with reduced motion: formatEndLabel(target) or formatStartLabel(target). */
  fallbackLabel: string;
  tone?: "op-donker" | "op-roest" | "licht";
  /** Default true; hidden with reduced motion (then the fixed label shows). */
  showPause?: boolean;
  /** Visible word before the running digits only ("Nog ", "Over "), never before the fixed label (decision 201). */
  prefix?: string;
  className?: string;
}

const tones: Record<NonNullable<CountdownProps["tone"]>, string> = {
  licht: "text-tekst",
  "op-donker": "text-tekst-op-donker",
  "op-roest": "text-bot-wit",
};

/** Marks the parts the inline script hides once the target has passed (screen-reader label, pause button). */
const hideAttribute = { [COUNTDOWN_HIDE_ATTRIBUTE]: "" };

/** While nothing ticks (paused, reduced motion) the shared clock only needs to wake up rarely. */
const IDLE_INTERVAL_MS = 60 * 60 * 1000;

const subscribeNothing = () => () => {};

/** True once `targetMs` has passed: false on the server and during hydration, then exact through scheduleAt. */
function useReached(targetMs: number): boolean {
  const valid = Number.isFinite(targetMs);
  const subscribe = useCallback(
    (onChange: () => void) => (targetMs > Date.now() ? scheduleAt(targetMs, onChange) : () => {}),
    [targetMs],
  );
  return useSyncExternalStore(
    valid ? subscribe : subscribeNothing,
    () => valid && Date.now() >= targetMs,
    () => false,
  );
}

export function Countdown({
  target,
  liveLabel,
  srLabel,
  fallbackLabel,
  tone = "licht",
  showPause = true,
  prefix = "",
  className,
}: CountdownProps) {
  const id = useId();
  const targetMs = Date.parse(target);
  const reached = useReached(targetMs);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const [paused, setPaused] = useState(false);
  const ticking = !paused && !reducedMotion;
  const now = useNow(ticking ? 1000 : IDLE_INTERVAL_MS);

  if (!Number.isFinite(targetMs)) return null;
  if (reached) {
    return liveLabel ? <span className={cn("font-semibold", tones[tone], className)}>{liveLabel}</span> : null;
  }

  const text =
    ticking && now !== null ? `${prefix}${formatCountdown(getCountdown(now, targetMs), sharedCopy.countdown)}` : fallbackLabel;

  return (
    <span id={id} suppressHydrationWarning className={cn("inline-flex items-center gap-1", tones[tone], className)}>
      <span data-countdown-text="" aria-hidden="true" suppressHydrationWarning className="tabular inline-block font-semibold"
        style={{ minWidth: `${8 + prefix.length}ch` }}>
        {text}
      </span>
      <VisuallyHidden {...hideAttribute} suppressHydrationWarning>
        {srLabel}
      </VisuallyHidden>
      {showPause ? (
        <button
          {...hideAttribute}
          suppressHydrationWarning
          type="button"
          aria-pressed={paused}
          aria-label={sharedCopy.countdown.pause}
          onClick={() => setPaused((value) => !value)}
          className={cn(
            "relative inline-flex size-8 shrink-0 items-center justify-center rounded-full text-inherit hover:bg-current/10",
            "before:absolute before:-inset-1.5 before:content-[''] motion-reduce:hidden",
          )}
        >
          {paused ? (
            <Play aria-hidden="true" className="size-4" strokeWidth={1.5} />
          ) : (
            <Pause aria-hidden="true" className="size-4" strokeWidth={1.5} />
          )}
        </button>
      ) : null}
      <InlineScript html={countdownScript(id, targetMs, sharedCopy.countdown, liveLabel ?? null, prefix)} />
    </span>
  );
}
