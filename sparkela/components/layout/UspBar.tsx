"use client";

import { ChevronRight, Clock, Pause, Play, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type FocusEvent } from "react";

import { cn } from "@/lib/cn";
import { DESKTOP_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { chromeCopy } from "@/content/copy/chrome";

/**
 * The USP line of the announcement bar (docs/PLAN.md §12.3 rule 4, §4.7, decision 59; brief §6 block 1): three lines
 * that are true on every day of the year (site.usps, built from config).
 *
 * - Below lg: one line at a time, rotating every 4 s. It pauses on hover and while focus is inside, and the pause
 *   button (fixed label, state in aria-pressed) stops it for good (WCAG 2.2.2). The new line fades in, only with
 *   motion allowed. With prefers-reduced-motion it does not rotate at all: the first line stays and a "Volgende"
 *   button shows the next one (decision 59). Screen readers get all lines as a list; the rotating line is aria-hidden.
 * - From lg: all three side by side with thin dividers, no rotation.
 *
 * On the server and during hydration it renders the first line (and the full desktop row), so the static HTML is
 * right; rotation starts in an effect. A hidden copy (another segment of the bar's TimeSwitch) does not rotate.
 * Port of CORVANE components/layout/promo/UspBar.tsx.
 */

const ROTATE_MS = 4000;

/** Icons in the order of site.usps: free shipping, same-day dispatch, the discolouration guarantee. */
const ICONS: LucideIcon[] = [Truck, Clock, ShieldCheck];

function UspIcon({ index, className }: { index: number; className?: string }) {
  const Icon = ICONS[index] ?? ShieldCheck;
  return <Icon aria-hidden="true" className={cn("size-3.5 shrink-0 text-tekst-2-op-donker", className)} strokeWidth={1.75} />;
}

export function UspBar({ usps }: { usps: string[] }) {
  const desktop = useMediaQuery(DESKTOP_QUERY, false);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY, false);
  const many = usps.length > 1;
  const canRotate = many && !desktop && !reducedMotion;

  /** Number of steps so far; the visible line is step % usps.length. */
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const running = canRotate && !paused && !hovered && !focused;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      // A segment of the bar that is not shown (display: none) has no offset parent: it does not rotate.
      if (rootRef.current?.offsetParent === null) return;
      setStep((current) => current + 1);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [running]);

  if (usps.length === 0) return null;
  const index = step % usps.length;

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  };

  return (
    <>
      {/* Below lg: one line, rotating. */}
      <div
        ref={rootRef}
        className="relative flex w-full items-center justify-center px-9 lg:hidden"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
      >
        <ul aria-label={chromeCopy.promo.uspListLabel} className="sr-only">
          {usps.map((usp) => (
            <li key={usp}>{usp}</li>
          ))}
        </ul>
        <p
          key={step}
          aria-hidden="true"
          className={cn(
            "flex min-w-0 items-center justify-center gap-2 text-center text-balance",
            step > 0 && "motion-safe:animate-[sparkela-fade-in_480ms_ease-out]",
          )}
        >
          <UspIcon index={index} />
          <span>{usps[index]}</span>
        </p>
        {many ? (
          reducedMotion ? (
            <button
              type="button"
              aria-label={chromeCopy.promo.nextUsp}
              onClick={() => setStep((current) => current + 1)}
              className="absolute top-1/2 right-0 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-tekst-2-op-donker before:absolute before:-inset-1.5 before:content-[''] hover:bg-bot-wit/10 hover:text-tekst-op-donker"
            >
              <ChevronRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
            </button>
          ) : (
            <button
              type="button"
              aria-label={chromeCopy.promo.pauseUsps}
              aria-pressed={paused}
              onClick={() => setPaused((value) => !value)}
              className="absolute top-1/2 right-0 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-tekst-2-op-donker before:absolute before:-inset-1.5 before:content-[''] hover:bg-bot-wit/10 hover:text-tekst-op-donker"
            >
              {paused ? (
                <Play aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
              ) : (
                <Pause aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
              )}
            </button>
          )
        ) : null}
      </div>

      {/* From lg: all of them, side by side. */}
      <ul className="hidden w-full items-center justify-center lg:flex">
        {usps.map((usp, i) => (
          <li key={usp} className="flex items-center whitespace-nowrap">
            {i > 0 ? <span aria-hidden="true" className="mx-6 h-3 w-px bg-rand-op-donker xl:mx-8" /> : null}
            <span className="flex items-center gap-2">
              <UspIcon index={i} />
              {usp}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
