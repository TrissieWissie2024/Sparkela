"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

/**
 * Keeps keyboard focus on the page after a client-side navigation (WCAG 2.4.3, CORVANE D50.3).
 *
 * With Cache Components, React Activity keeps the previous route mounted but hidden. The link that started the
 * navigation loses its focus to <body>, while the browser's sequential focus starting point stays at that hidden
 * link, so the next Tab would skip the whole new page and land in the footer. After every pathname change (not on
 * the first render) this moves focus to <main id={targetId} tabIndex={-1}> when the focused element is <body> or no
 * longer rendered. Focus that is still visible (a header link, a control that placed it on purpose) is left alone.
 *
 * usePathname() suspends while the static shell of a route with unknown params is prerendered, so the hook sits
 * in its own <Suspense fallback={null}> (plan §13.5). Renders nothing. Mounted once in app/layout.tsx.
 * Port of CORVANE components/layout/RouteFocus.tsx.
 */
export function RouteFocus({ targetId = "main" }: { targetId?: string }) {
  return (
    <Suspense fallback={null}>
      <RouteFocusEffect targetId={targetId} />
    </Suspense>
  );
}

function RouteFocusEffect({ targetId }: { targetId: string }) {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (previous.current === null || previous.current === pathname) {
      previous.current = pathname;
      return;
    }
    previous.current = pathname;

    const active = document.activeElement;
    const lost =
      active === null ||
      active === document.body ||
      (active instanceof HTMLElement && typeof active.checkVisibility === "function" && !active.checkVisibility());
    if (!lost) return;
    document.getElementById(targetId)?.focus({ preventScroll: true });
  }, [pathname, targetId]);

  return null;
}
