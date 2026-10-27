"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";

/**
 * The cached server clock for client components (plan §10.3 and §10.5). ShopChrome and the (kaal) layout render
 * <ClockProvider serverNow={await getServerNow()}>; TimeSwitch reads it for the variant in the static HTML. It is the
 * time the page was rendered, not the time now: the inline script and the browser correct it before the first paint.
 */

const ClockContext = createContext<number | null>(null);

export function ClockProvider({ serverNow, children }: { serverNow: number; children: ReactNode }) {
  return <ClockContext value={serverNow}>{children}</ClockContext>;
}

let warned = false;

function warnMissingProvider(): void {
  if (warned) return;
  warned = true;
  console.warn("useServerNow(): no <ClockProvider> above this component; TimeSwitch falls back to its first variant.");
}

/**
 * The server clock in epoch ms. Without a provider it returns 0, so every TimeSwitch starts at its earliest variant
 * (index 0), and development logs one warning.
 */
export function useServerNow(): number {
  const value = useContext(ClockContext);
  const missing = value === null;
  useEffect(() => {
    if (missing && process.env.NODE_ENV !== "production") warnMissingProvider();
  }, [missing]);
  return value ?? 0;
}
