"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * Reports the current pathname after mount and after every client navigation, for chrome that is rendered on the
 * server and must not read it during render (docs/PLAN.md §13.5): usePathname() suspends while the static shell of a
 * route with unknown params is prerendered (Next 16 with Cache Components), so it sits in its own
 * <Suspense fallback={null}>, like RouteFocus. Renders nothing; `onChange` must be stable (a state setter).
 */
export function PathnameWatcher({ onChange }: { onChange: (pathname: string | null) => void }) {
  return (
    <Suspense fallback={null}>
      <PathnameProbe onChange={onChange} />
    </Suspense>
  );
}

function PathnameProbe({ onChange }: { onChange: (pathname: string | null) => void }) {
  const pathname = usePathname();
  useEffect(() => {
    onChange(pathname ?? null);
  }, [pathname, onChange]);
  return null;
}
