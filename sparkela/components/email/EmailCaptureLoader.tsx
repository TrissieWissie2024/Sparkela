"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { useAfterLoad } from "@/lib/hooks/useAfterLoad";
import { useLatch } from "@/lib/hooks/useLatch";
import { site } from "@/content/site";

import { isBlockedPath } from "./state";

/** The pill, the modal (Radix Dialog), the cards, the form and the code in a chunk of their own (plan §18.4). */
const EmailCapture = dynamic(() => import("@/components/email/EmailCapture").then((module) => module.EmailCapture), {
  ssr: false,
});

/**
 * Mounts the email popup (components/email/EmailCapture, docs/PLAN.md §13.11) once the page has settled (useAfterLoad:
 * loaded and idle, or the first interaction). Renders nothing on the server, during prerender and before that, and
 * nothing at all when site.emailCapture.enabled is off. It never loads on /checkout or /wachtlijst; once loaded on
 * another page it stays mounted (useLatch), so a pill that appeared survives a visit to the checkout (EmailCapture hides
 * it there) instead of being lost with its state. The pill only appears 8 s after
 * the page started loading (counted with performance.now()), so mounting later changes nothing for visitors; its
 * JavaScript just stays out of the first load. Rendered once, by ShopChrome after the Footer (integrator 7-9), inside
 * CartProvider. Port of CORVANE components/email/EmailCaptureLoader.tsx.
 *
 * usePathname sits in its own Suspense boundary: in a shared layout it suspends while the static shell of a route with
 * unknown params is built (Next 16 with Cache Components).
 */
export function EmailCaptureLoader() {
  if (!site.emailCapture.enabled) return null;
  return (
    <Suspense fallback={null}>
      <EmailCaptureGate />
    </Suspense>
  );
}

function EmailCaptureGate() {
  const settled = useAfterLoad();
  const pathname = usePathname();
  const mounted = useLatch(settled && !isBlockedPath(pathname));
  return mounted ? <EmailCapture /> : null;
}
