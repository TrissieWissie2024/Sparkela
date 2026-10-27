"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";

import {
  getConsent,
  getServerConsent,
  OPEN_CONSENT_EVENT,
  setConsent,
  shouldShowConsentBanner,
  subscribeConsent,
  type ConsentSnapshot,
  type ConsentValue,
} from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { chromeCopy } from "@/content/copy/chrome";
import { site } from "@/content/site";
import { Button } from "@/components/ui/Button";

/**
 * The cookie consent banner (docs/PLAN.md §13.6, §18.2, §4.6, §4.8; brief §2.10).
 *
 * - Exists only with site.analytics.enabled; otherwise it renders nothing at all (ShopChrome does not even render it).
 *   It shows after hydration while there is no stored choice (shouldShowConsentBanner), and again when
 *   "Cookie-instellingen" dispatches OPEN_CONSENT_EVENT ("sparkela:open-consent").
 * - A non-modal card at the bottom (z-50, below the drawers): full width minus the gutter on phones, bottom left from
 *   sm. "Akkoord" and "Weigeren" have the same style and size; a short text with a link to /cookies. No focus trap
 *   and no backdrop: the page stays usable. It sits early in the DOM, so keyboard and screen reader users reach it
 *   first. Reopened from the footer it takes the focus on its heading; after a choice focus goes back to the opener
 *   (or to <main>) and a status line says what was saved. Escape closes a reopened banner when a choice exists.
 * - While open it sets data-consent-open on <body> (the Spark pill hides and the popup does not open by itself), gives
 *   <body> a bottom padding of the space it covers and <html> a scroll-padding-bottom, so a focused element is never
 *   scrolled in under it (WCAG 2.4.11). It shares those two properties with the sticky add-to-cart bar of the
 *   product page: the bar announces its own values with the window event STICKY_ATC_EVENT; the banner keeps them and
 *   hands them back on close (CORVANE D51.3, D52.4, D53.5).
 * Port of CORVANE components/consent/ConsentBanner.tsx.
 */

/** Window event of components/pdp/StickyAddToCart after it changed the body padding (a literal: no PDP code here). */
const STICKY_ATC_EVENT = "sparkela:sticky-atc";

/** Space kept clear above the banner when the browser scrolls a focused element into view. */
const FOCUS_CLEARANCE_PX = 16;

function restoreStyle(style: CSSStyleDeclaration, property: string, value: string): void {
  if (value) style.setProperty(property, value);
  else style.removeProperty(property);
}

export function ConsentBanner() {
  const enabled = site.analytics.enabled;
  const copy = chromeCopy.consent;
  const consent = useSyncExternalStore<ConsentSnapshot>(subscribeConsent, getConsent, getServerConsent);
  const [reopened, setReopened] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const visible = shouldShowConsentBanner({ enabled, consent, reopened });

  const panelRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  /** The control that opened the banner again, to return focus to it. */
  const openerRef = useRef<HTMLElement | null>(null);
  /** Set by "Cookie-instellingen" while the banner is closed: focus the heading once it shows. */
  const focusOnShowRef = useRef(false);

  const id = useId();
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;

  // "Cookie-instellingen" (CookieSettingsButton in the footer and on /cookies).
  useEffect(() => {
    if (!enabled) return;
    const open = () => {
      const active = document.activeElement;
      openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
      setAnnouncement("");
      setReopened(true);
      if (headingRef.current) headingRef.current.focus();
      else focusOnShowRef.current = true;
    };
    window.addEventListener(OPEN_CONSENT_EVENT, open);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, open);
  }, [enabled]);

  // While open: the body flag, room at the bottom, and focus when opened from "Cookie-instellingen".
  useEffect(() => {
    const panel = panelRef.current;
    if (!visible || !panel) return;
    const body = document.body;
    const root = document.documentElement;
    body.dataset.consentOpen = "true";

    // The sticky add-to-cart bar writes the same two properties. While the banner is open its (larger) values win;
    // the bar's latest values are kept and handed back on close.
    let theirs = { padding: body.style.paddingBottom, scrollPadding: root.style.scrollPaddingBottom };
    let covered = 0;
    const apply = () => {
      body.style.paddingBottom = `${covered}px`;
      root.style.scrollPaddingBottom = `${covered + FOCUS_CLEARANCE_PX}px`;
    };
    const measure = () => {
      // Height plus the bottom offset; layout values, so the entrance transition does not skew them.
      covered = Math.ceil(panel.offsetHeight + (Number.parseFloat(getComputedStyle(panel).bottom) || 0));
      apply();
    };
    const onStickyBar = () => {
      theirs = { padding: body.style.paddingBottom, scrollPadding: root.style.scrollPaddingBottom };
      apply();
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(panel);
    window.addEventListener("resize", measure);
    window.addEventListener(STICKY_ATC_EVENT, onStickyBar);

    if (focusOnShowRef.current) {
      focusOnShowRef.current = false;
      headingRef.current?.focus();
    }

    return () => {
      delete body.dataset.consentOpen;
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener(STICKY_ATC_EVENT, onStickyBar);
      restoreStyle(body.style, "padding-bottom", theirs.padding);
      restoreStyle(root.style, "scroll-padding-bottom", theirs.scrollPadding);
    };
  }, [visible]);

  if (!enabled) return null;

  /** Closes the banner; focus goes back to the opener, or to <main>, when it was inside. */
  function close(choice: ConsentValue | null) {
    const panel = panelRef.current;
    const focusWasInside = panel !== null && panel.contains(document.activeElement);
    const opener = openerRef.current;
    openerRef.current = null;
    focusOnShowRef.current = false;

    if (choice) {
      setConsent(choice);
      setAnnouncement(copy.saved[choice]);
    }
    setReopened(false);

    if (focusWasInside) {
      const target = opener?.isConnected ? opener : document.getElementById("main");
      target?.focus({ preventScroll: true });
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    // Only a reopened banner can be dismissed: a first visit needs an answer.
    if (event.key !== "Escape" || !reopened || !consent) return;
    event.preventDefault();
    close(null);
  }

  return (
    <>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {visible ? (
        <section
          ref={panelRef}
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          onKeyDown={onKeyDown}
          className={cn(
            "fixed z-50 print:hidden",
            "right-[calc(1rem+env(safe-area-inset-right,0px))] bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-[calc(1rem+env(safe-area-inset-left,0px))]",
            "sm:right-auto sm:w-[30rem] lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] lg:left-[calc(1.5rem+env(safe-area-inset-left,0px))]",
            "max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain",
            "rounded-kaart border border-rand bg-pagina p-5 text-tekst shadow-zwevend sm:p-6",
            "motion-safe:transition-[opacity,translate] motion-safe:duration-300 motion-safe:ease-out",
            "motion-safe:starting:translate-y-3 motion-safe:starting:opacity-0",
          )}
        >
          <h2 ref={headingRef} id={titleId} tabIndex={-1} className="kop-3 text-tekst">
            {copy.title}
          </h2>
          <p id={bodyId} className="tekst-klein mt-2 text-tekst-2">
            {copy.body}{" "}
            <Link href="/cookies" className="text-link underline underline-offset-4 hover:text-link-hover">
              {copy.linkLabel}
            </Link>
          </p>
          {reopened && consent ? <p className="tekst-klein mt-2 font-semibold text-tekst">{copy.current[consent]}</p> : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Button variant="outline" fullWidth onClick={() => close("granted")}>
              {copy.accept}
            </Button>
            <Button variant="outline" fullWidth onClick={() => close("denied")}>
              {copy.reject}
            </Button>
          </div>
        </section>
      ) : null}
    </>
  );
}
