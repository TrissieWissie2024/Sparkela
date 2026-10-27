"use client";

import { Fragment, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useMounted } from "@/lib/hooks/useMounted";
import { pdpCopy } from "@/content/copy/pdp";
import { Button } from "@/components/ui/Button";

import { AddToCartLabel } from "./AddToCart";

/**
 * The sticky buy bar on phones and tablets (docs/PLAN.md §13.9, §4.6, §4.8; brief §6: "een sticky balk op mobiel zodra
 * de knop uit beeld is"). Port of CORVANE components/pdp/StickyAddToCart.tsx (D46, D52.4, D53.5). Below lg only.
 *
 * - Shows once the main button (`targetRef`) has scrolled out of view above the viewport (under the sticky header
 *   counts as out of view), through an IntersectionObserver whose area runs from the header line down past the end of
 *   any page, so a jump straight past the button (End, an anchor, scroll restored on reload) is caught too. Hidden
 *   while the main button is visible or still below the fold, so never at the top of the page.
 * - Fixed to the bottom, z-40 (above the header at 30, below the Spark pill at 45, the consent banner at 50 and the
 *   drawers at 60), with the safe area as padding. Slides in only with motion allowed. While hidden it is `invisible`
 *   and `inert`: never focusable, never read.
 * - Rendered into <body> through a portal after mount: the buy column is `position: sticky` from md, which makes it a
 *   stacking context, and inside it z-40 would only count within the column (on tablets the cards of "Maak de look
 *   af" painted over the bar). It is not in the static HTML; it only matters once the visitor scrolls, so nothing
 *   shifts.
 * - While visible it owns the bottom edge: <body> gets data-sticky-atc, a bottom padding of the bar's height (the end
 *   of the footer can always scroll clear of it) and --onderbalk (the bar's height: the Spark pill rides above it and
 *   does not appear by itself, decision 118); <html> gets a scroll-padding-bottom of the height plus a margin, so a
 *   focused element is scrolled in above the bar, never under it (WCAG 2.4.11). After every change it dispatches the
 *   window event "sparkela:sticky-atc" (ConsentBanner and the Spark pill keep their own values on top, decision 194).
 *   All of it is removed when the bar hides or unmounts, also when Activity hides the route; several bars at once (a
 *   hidden previous product page) are counted, so one hiding never clears another.
 */

/** Window event after the bar changed body padding, --onderbalk or scroll-padding (ConsentBanner and EmailCapture listen). */
export const STICKY_ATC_EVENT = "sparkela:sticky-atc";

export interface StickyAtcEventDetail {
  visible: boolean;
  height: number;
}

/** Space kept clear above the bar when the browser scrolls a focused element into view. */
const FOCUS_CLEARANCE_PX = 12;

/** Heights of the bars that are visible right now, by registration. */
const visibleBars = new Map<symbol, number>();

function syncBody(): void {
  const body = document.body;
  const root = document.documentElement;
  const visible = visibleBars.size > 0;
  const height = visible ? Math.max(...visibleBars.values()) : 0;
  if (visible) {
    body.dataset.stickyAtc = "true";
    body.style.paddingBottom = `${height}px`;
    body.style.setProperty("--onderbalk", `${height}px`);
    root.style.scrollPaddingBottom = `${height + FOCUS_CLEARANCE_PX}px`;
  } else {
    delete body.dataset.stickyAtc;
    body.style.removeProperty("padding-bottom");
    body.style.removeProperty("--onderbalk");
    root.style.removeProperty("scroll-padding-bottom");
  }
  window.dispatchEvent(new CustomEvent<StickyAtcEventDetail>(STICKY_ATC_EVENT, { detail: { visible, height } }));
}

/** Marks one bar as visible and keeps the body values equal to its height (the summary may wrap). Returns the cleanup. */
function registerVisibleBar(bar: HTMLElement): () => void {
  const key = Symbol("sticky-atc");
  visibleBars.set(key, bar.offsetHeight);
  syncBody();
  const resize =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          if (!visibleBars.has(key) || visibleBars.get(key) === bar.offsetHeight) return;
          visibleBars.set(key, bar.offsetHeight);
          syncBody();
        });
  resize?.observe(bar);
  return () => {
    resize?.disconnect();
    visibleBars.delete(key);
    syncBody();
  };
}

function headerHeight(): number {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-hoogte"));
  return Number.isFinite(value) ? value : 64;
}

export interface StickyAddToCartProps {
  /** The main button. */
  targetRef: RefObject<HTMLButtonElement | null>;
  /** The product name. */
  title: string;
  /** The choice in short: "Goud", or ["Goud", "Stack van 3"]; parts are joined with a dot and never break inside. */
  summary: string | readonly string[];
  /** The formatted total on the button. */
  price: string;
  onAdd(): void;
  /** The button label. Default pdpCopy.stickyBar.add ("In tas"): short, so the bar keeps one row on a phone. */
  label?: string;
  /** Sold out: the bar never shows (there is nothing to add). */
  disabled?: boolean;
}

export function StickyAddToCart({ targetRef, title, summary, price, onAdd, label, disabled = false }: StickyAddToCartProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [passed, setPassed] = useState(false);
  const mounted = useMounted();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const visible = passed && !isDesktop && !disabled;
  const parts = (typeof summary === "string" ? [summary] : summary).filter(Boolean);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const top = headerHeight();
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        const viewTop = entry.rootBounds?.top ?? top;
        setPassed(!entry.isIntersecting && entry.boundingClientRect.bottom <= viewTop + 1);
      },
      { rootMargin: `-${top}px 0px 100000px 0px`, threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetRef]);

  useEffect(() => {
    const bar = barRef.current;
    if (!visible || !mounted || !bar) return;
    return registerVisibleBar(bar);
  }, [visible, mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={barRef}
      role="region"
      aria-label={pdpCopy.stickyBar.label}
      inert={!visible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-rand bg-pagina shadow-[0_-8px_24px_color-mix(in_srgb,var(--inkt)_6%,transparent)] lg:hidden print:hidden",
        "motion-safe:transition-[translate,visibility] motion-safe:duration-300 motion-safe:ease-out",
        visible ? "visible translate-y-0" : "invisible translate-y-full",
      )}
    >
      {/* One row; with a large default font size it wraps: the text takes the full width, the button moves under it. */}
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-8">
        <div className="min-w-[4.5rem] flex-1">
          <p className="kop-4 leading-5 text-tekst">{title}</p>
          {parts.length > 0 ? (
            <p className="mt-0.5 text-xs leading-4 text-tekst-2">
              <span className="sr-only">{parts.join(", ")}</span>
              <span aria-hidden="true">
                {parts.map((part, index) => (
                  <Fragment key={`${index}-${part}`}>
                    {index > 0 ? ` ${pdpCopy.addToCart.separator} ` : null}
                    <span className="whitespace-nowrap">{part}</span>
                  </Fragment>
                ))}
              </span>
            </p>
          ) : null}
        </div>
        <Button variant="primair" size="md" onClick={onAdd} className="ml-auto px-5!">
          <AddToCartLabel label={label ?? pdpCopy.stickyBar.add} price={price} />
        </Button>
      </div>
    </div>,
    document.body,
  );
}
