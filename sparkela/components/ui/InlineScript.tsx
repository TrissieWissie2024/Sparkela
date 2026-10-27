"use client";

/**
 * A small inline script that runs while the browser parses the HTML, before the first paint
 * (node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md). Use it only to correct what
 * the static HTML shows (which TimeSwitch variant is visible, the digits of a countdown); never to render content.
 *
 * Server-rendered it is `text/javascript` and runs on a full page load. On a client-side navigation React renders it
 * as `text/plain`, so it neither runs (scripts inserted by React never do) nor triggers React's script warning; the
 * client component renders the right state itself then. suppressHydrationWarning covers the type difference.
 * A client component, so `typeof window` is evaluated in the browser. Port of CORVANE components/ui/InlineScript.tsx.
 *
 * The html must be trusted, generated code (timeSwitchScript, countdownScript), never user input.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
