"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

import { phaseIndex, scheduleAt } from "@/lib/schedule";
import { InlineScript } from "@/components/ui/InlineScript";

import { useServerNow } from "./ClockProvider";
import { TIME_SWITCH_ATTRIBUTE, timeSwitchKey, timeSwitchScript } from "./timeSwitchScript";

/**
 * Shows one of several variants by time, exactly at the boundaries and without reading the clock during render
 * (plan §10.2 layer 3, §10.5; decision 23). Used for the promo bar, the VAT line, drop labels and banners, the
 * shipping day, the gift wrap price and the campaign note.
 *
 * 1. Every variant is rendered (on the server too, so variants may be server components passed as nodes) in its own
 *    wrapper with data-ts="{id}-{i}" and `hidden` on all but the server index; suppressHydrationWarning on each.
 * 2. An InlineScript right after them (timeSwitchScript) fixes `hidden` with Date.now() before the first paint.
 * 3. After hydration useSyncExternalStore picks the index from Date.now() in its snapshot; the subscription plans the
 *    next boundary with scheduleAt (never one long setTimeout, decision 108) and re-checks when the tab becomes
 *    visible again, so an open tab switches on time. A client-side navigation renders the right index at once.
 * 4. A layout effect keeps the `hidden` attributes equal to the index, also when the inline script and React's
 *    hydration snapshot disagreed (a boundary that passed between parsing and hydration).
 *
 * No Date.now() during render: only in the snapshot, the subscription and the script (the route stays static).
 * Give `className` a min-height that fits the tallest variant where a switch must not move the layout (plan §18.4).
 */

export interface TimeSwitchProps {
  /** Epoch ms, ascending. Variant i shows when boundaries[i-1] <= now < boundaries[i]. */
  boundaries: number[];
  /** Length must be boundaries.length + 1. Rendered on the server; may contain server components passed as nodes. */
  variants: ReactNode[];
  /** Index from the server clock, used for the static HTML. Default phaseIndex(boundaries, useServerNow()). */
  serverIndex?: number;
  as?: "div" | "span";
  /** Should reserve the height of the tallest variant (min-h) where a switch must not shift the layout. */
  className?: string;
}

function clampIndex(index: number, count: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(0, Math.trunc(index)), Math.max(0, count - 1));
}

/** Subscribes to every boundary after now, one at a time, plus the page becoming visible again. */
function subscribeToBoundaries(boundaries: number[], onChange: () => void): () => void {
  let cancel: (() => void) | null = null;

  const planNext = () => {
    cancel?.();
    cancel = null;
    const now = Date.now();
    let next = Infinity;
    for (const boundary of boundaries) {
      if (Number.isFinite(boundary) && boundary > now && boundary < next) next = boundary;
    }
    if (next === Infinity) return;
    cancel = scheduleAt(next, () => {
      cancel = null;
      onChange();
      planNext();
    });
  };

  // A laptop that slept past a boundary: timers may resume late, so check again when the page is shown.
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    onChange();
    planNext();
  };

  planNext();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    cancel?.();
    cancel = null;
    document.removeEventListener("visibilitychange", onVisible);
  };
}

export function TimeSwitch({ boundaries, variants, serverIndex, as = "div", className }: TimeSwitchProps) {
  const id = useId();
  const serverNow = useServerNow();
  const count = variants.length;

  const boundaryCount = boundaries.length;
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && count !== boundaryCount + 1) {
      console.warn(`TimeSwitch: ${count} variants for ${boundaryCount} boundaries; expected ${boundaryCount + 1}.`);
    }
  }, [count, boundaryCount]);

  const initial = clampIndex(serverIndex ?? phaseIndex(boundaries, serverNow), count);
  // A stable key, so a parent that passes a new array with the same boundaries does not resubscribe.
  const boundaryKey = boundaries.join(",");
  const subscribe = useCallback(
    (onChange: () => void) => subscribeToBoundaries(boundaryKey ? boundaryKey.split(",").map(Number) : [], onChange),
    [boundaryKey],
  );
  const getSnapshot = () => clampIndex(phaseIndex(boundaries, Date.now()), count);
  const getServerSnapshot = () => initial;
  const index = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const rootRef = useRef<HTMLElement | null>(null);
  const setRoot = useCallback((node: HTMLElement | null) => {
    rootRef.current = node;
  }, []);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    for (const child of Array.from(root.children)) {
      if (!(child instanceof HTMLElement)) continue;
      const key = child.getAttribute(TIME_SWITCH_ATTRIBUTE);
      if (key === null || !key.startsWith(`${id}-`)) continue;
      const hidden = key !== timeSwitchKey(id, index);
      if (child.hidden !== hidden) child.hidden = hidden;
    }
  }, [id, index]);

  const Tag = as;
  return (
    <Tag ref={setRoot} className={className}>
      {variants.map((variant, i) => (
        <Tag key={i} data-ts={timeSwitchKey(id, i)} hidden={i !== index} suppressHydrationWarning>
          {variant}
        </Tag>
      ))}
      <InlineScript html={timeSwitchScript(id, boundaries)} />
    </Tag>
  );
}
