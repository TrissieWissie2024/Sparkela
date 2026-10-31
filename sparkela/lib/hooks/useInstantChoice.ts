"use client";

import { startTransition, useState } from "react";

/**
 * A choice that shows at once while its consequences render later (QA round 5, INP): the picker keeps its own copy of
 * the value, set urgently on a tap, and calls `commit` inside a transition, so the tapped tile paints in the same frame
 * and the rest of the page (buy box, price, gallery, specs, sticky bar) follows in an interruptible render. When the
 * value changes from outside (a reset, another component), the copy follows it; `key` says when two values are the
 * same (an object rebuilt on every render of the parent is not a change).
 */
export function useInstantChoice<T>(
  value: T,
  commit: (next: T) => void,
  key: (item: T) => unknown = (item) => item,
): [T, (next: T) => void] {
  const [shown, setShown] = useState(value);
  const [outside, setOutside] = useState(value);
  if (!Object.is(key(value), key(outside))) {
    setOutside(value);
    setShown(value);
  }
  const choose = (next: T) => {
    setShown(next);
    startTransition(() => commit(next));
  };
  return [shown, choose];
}
