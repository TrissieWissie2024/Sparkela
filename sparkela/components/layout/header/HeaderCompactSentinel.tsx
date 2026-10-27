"use client";

import { useEffect, useRef } from "react";

/**
 * "Compacter bij scrollen" (docs/PLAN.md §13.5, decision 40; brief §6 block 2): a 1 px sentinel right above the sticky
 * header, at the place where the header starts to stick. While the sentinel is in view the header is in its normal
 * state; once it has scrolled out of view (the header is stuck at the top) an IntersectionObserver sets
 * data-compact="true" on the header. The header then draws its logo a little smaller within the same fixed height,
 * so nothing below it moves (no CLS).
 *
 * The sentinel takes no room (1 px with a −1 px margin) and is hidden from assistive tech. It must be rendered
 * directly before the <header data-site-header>; without IntersectionObserver the header simply stays as it is.
 */
export function HeaderCompactSentinel() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = ref.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const sibling = sentinel.nextElementSibling;
    const header =
      sibling instanceof HTMLElement && sibling.hasAttribute("data-site-header")
        ? sibling
        : document.querySelector<HTMLElement>("[data-site-header]");
    if (!header) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      // Only "scrolled past the top" counts; a sentinel below the fold (a short window, zoom) is not compact.
      const compact = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      if (compact) header.dataset.compact = "true";
      else delete header.dataset.compact;
    });
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      delete header.dataset.compact;
    };
  }, []);

  return <div ref={ref} aria-hidden="true" className="pointer-events-none -mb-px h-px print:hidden" />;
}
