"use client";

import { useState } from "react";

/**
 * Once `value` has been true, stays true (port of CORVANE useLatch, D53.7). For a lazily mounted island that must
 * stay mounted after it was needed once, for example to play its closing animation and return focus:
 * `const mounted = useLatch(afterLoad || isOpen)`.
 */
export function useLatch(value: boolean): boolean {
  const [latched, setLatched] = useState(value);
  // Adjusting state while rendering (React's "storing information from previous renders" pattern).
  if (value && !latched) setLatched(true);
  return latched || value;
}
