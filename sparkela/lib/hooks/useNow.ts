"use client";

import { useSyncExternalStore } from "react";

/**
 * Shared clocks, one per interval (port of CORVANE lib/hooks/useNow.ts). A clock starts when its first component
 * subscribes (in the browser, after commit) and stops when the last one leaves.
 *
 * Sparkela returns epoch milliseconds instead of a Date, because every time function in lib/ takes `now: number`.
 */
interface Clock {
  current: number | null;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | undefined;
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => number | null;
}

const clocks = new Map<number, Clock>();

function getClock(intervalMs: number): Clock {
  const existing = clocks.get(intervalMs);
  if (existing) return existing;

  const clock: Clock = {
    current: null,
    listeners: new Set(),
    timer: undefined,
    subscribe(onChange) {
      clock.listeners.add(onChange);
      if (clock.timer === undefined) {
        clock.current = Date.now();
        clock.timer = setInterval(() => {
          clock.current = Date.now();
          clock.listeners.forEach((listener) => listener());
        }, intervalMs);
        // Deliver the first value right away instead of waiting a full interval.
        queueMicrotask(() => clock.listeners.forEach((listener) => listener()));
      }
      return () => {
        clock.listeners.delete(onChange);
        if (clock.listeners.size === 0 && clock.timer !== undefined) {
          clearInterval(clock.timer);
          clock.timer = undefined;
          clock.current = null;
        }
      };
    },
    getSnapshot: () => clock.current,
  };

  clocks.set(intervalMs, clock);
  return clock;
}

const getServerSnapshot = () => null;

/**
 * Current time in epoch ms, but only after mount. Returns null on the server, during prerender and during
 * hydration, so time-dependent UI never causes a hydration mismatch or a Cache Components prerender error.
 * Ticks every `intervalMs` (default 1 s); components with the same interval share one timer.
 *
 * For a switch at a fixed boundary use TimeSwitch or scheduleAt (lib/schedule.ts), not a fast interval.
 */
export function useNow(intervalMs = 1000): number | null {
  const clock = getClock(intervalMs);
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot, getServerSnapshot);
}
