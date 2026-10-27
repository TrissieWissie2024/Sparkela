"use client";

import { useSyncExternalStore } from "react";

function subscribeNothing(): () => void {
  return () => {};
}

/**
 * False on the server, during prerender and during hydration; true afterwards (port of CORVANE useMounted).
 * Use it to show browser-only UI in a box that is already reserved, never to swap layouts (no CLS).
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}
