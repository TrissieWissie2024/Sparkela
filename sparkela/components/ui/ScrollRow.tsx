"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";
import { REDUCED_MOTION_QUERY } from "@/lib/hooks/useMediaQuery";
import { sharedCopy } from "@/content/copy/shared";

import { Button } from "./Button";

/**
 * A list that scrolls sideways with scroll snap (plan §13.2, §18.3 rule 7): the favourites, the cart upsell, the
 * reviews carousel. Give each <li> a width and `snap-start`; the list is a flex row with no visible scrollbar.
 *
 * - role="list" stays explicit, because Safari drops list semantics with list-style: none.
 * - It takes keyboard focus (tabIndex 0) only while it really overflows, so keyboard users can scroll it with the
 *   arrow keys where it scrolls and it is not an empty Tab stop where it does not (CORVANE D43.7). A ResizeObserver
 *   re-checks on every size change. Before hydration the list is focusable, which is right for the phone layout.
 * - "Vorige" and "Volgende" buttons scroll by most of a view. From md they float over the row's edges (no reserved
 *   space, so showing them never shifts the layout), and only once the row is measured to overflow. At an end the
 *   button stays focusable with aria-disabled. With `controls="always"` (Carousel) phones get them too, in a reserved
 *   row under the list, right-aligned (QA round 1, decision 216c): over a phone-width card they covered the photo.
 * - A small vertical padding keeps the focus rings of the items inside the scroll box, which would clip them.
 * Port of CORVANE components/ui/ScrollRow.tsx, plus the buttons.
 */

export type ScrollRowProps = ComponentPropsWithoutRef<"ul"> & {
  /** Accessible name of the list; what a screen reader announces when it takes focus. */
  label: string;
  /** Where the previous and next buttons show: from md (default), always, or never. */
  controls?: "md" | "always" | "none";
  /** Classes of the wrapper around the list and its buttons. */
  wrapperClassName?: string;
};

interface ScrollState {
  /** null until measured after hydration. */
  overflows: boolean | null;
  atStart: boolean;
  atEnd: boolean;
}

const INITIAL: ScrollState = { overflows: null, atStart: true, atEnd: false };

/** 1 px of slack for sub-pixel rounding. */
const SLACK = 1;

function measure(element: HTMLElement): ScrollState {
  const max = element.scrollWidth - element.clientWidth;
  return {
    overflows: max > SLACK,
    atStart: element.scrollLeft <= SLACK,
    atEnd: element.scrollLeft >= max - SLACK,
  };
}

function sameState(a: ScrollState, b: ScrollState): boolean {
  return a.overflows === b.overflows && a.atStart === b.atStart && a.atEnd === b.atEnd;
}

export function ScrollRow({ label, controls = "md", wrapperClassName, className, children, ...rest }: ScrollRowProps) {
  const ref = useRef<HTMLUListElement>(null);
  const [state, setState] = useState<ScrollState>(INITIAL);

  const update = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const next = measure(element);
    setState((current) => (sameState(current, next) ? current : next));
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    update();
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, [update]);

  const scrollByView = (direction: -1 | 1) => {
    const element = ref.current;
    if (!element) return;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
    element.scrollBy({ left: direction * Math.max(element.clientWidth * 0.85, 1), behavior: reduced ? "auto" : "smooth" });
  };

  const showControls = controls !== "none" && state.overflows === true;
  /** The buttons are transparent outline buttons; this wrapper gives them a white face (and a floating shadow). */
  const face = "pointer-events-auto rounded-full bg-kaart";

  const previous = (
    <Button
      variant="outline"
      size="sm"
      iconOnly
      aria-label={sharedCopy.ui.previous}
      aria-disabled={state.atStart || undefined}
      onClick={() => (state.atStart ? undefined : scrollByView(-1))}
    >
      <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={1.5} />
    </Button>
  );
  const next = (
    <Button
      variant="outline"
      size="sm"
      iconOnly
      aria-label={sharedCopy.ui.next}
      aria-disabled={state.atEnd || undefined}
      onClick={() => (state.atEnd ? undefined : scrollByView(1))}
    >
      <ChevronRight aria-hidden="true" className="size-5" strokeWidth={1.5} />
    </Button>
  );

  return (
    <div className={cn("relative", wrapperClassName)}>
      <ul
        ref={ref}
        role="list"
        aria-label={label}
        tabIndex={state.overflows === false ? undefined : 0}
        className={cn(
          "no-scrollbar -my-1 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain py-1 focus-visible:-outline-offset-2",
          className,
        )}
        {...rest}
      >
        {children}
      </ul>
      {controls === "always" ? (
        // Phones: a row under the list, reserved from the first paint so the buttons never shift the layout.
        <div className="mt-4 flex min-h-11 items-center justify-end gap-2 md:hidden">
          {showControls ? (
            <>
              <span className={face}>{previous}</span>
              <span className={face}>{next}</span>
            </>
          ) : null}
        </div>
      ) : null}
      {showControls ? (
        <>
          <span className="pointer-events-none absolute inset-y-0 left-2 z-10 hidden items-center md:flex">
            <span className={cn(face, "shadow-zwevend")}>{previous}</span>
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-2 z-10 hidden items-center md:flex">
            <span className={cn(face, "shadow-zwevend")}>{next}</span>
          </span>
        </>
      ) : null}
    </div>
  );
}
