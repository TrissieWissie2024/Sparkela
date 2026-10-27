import { sharedCopy } from "@/content/copy/shared";

/**
 * First focusable element on every page (WCAG 2.4.1): jumps to <main id="main" tabIndex={-1}>, which ShopChrome
 * and the (kaal) layout render. Off screen until it gets keyboard focus, then a pill in the top-left corner above
 * the announcement bar and the header (z-70, plan §4.6). Port of CORVANE components/layout/SkipLink.tsx.
 */
export function SkipLink({ targetId = "main" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="fixed top-2 left-3 z-70 inline-flex min-h-11 -translate-y-[calc(100%+1rem)] items-center rounded-full border border-rand bg-kaart px-5 text-sm font-semibold text-tekst focus:translate-y-0 focus:shadow-zwevend motion-safe:transition-transform motion-safe:duration-200 print:hidden"
    >
      {sharedCopy.ui.skipLink}
    </a>
  );
}
