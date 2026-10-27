"use client";

import { usePathname } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { SubscribeResult } from "@/lib/types";
import { FINE_POINTER_QUERY } from "@/lib/hooks/useMediaQuery";
import { useSubscribed } from "@/lib/subscription";
import { pagesCopy } from "@/content/copy/pages";
import { site } from "@/content/site";
import { useCart } from "@/components/cart/useCart";
import { SubscribeForm } from "@/components/forms/SubscribeForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

import { RewardCode } from "./RewardCode";
import { SparkCards } from "./SparkCards";
import { SparkPill } from "./SparkPill";
import {
  bodyBlocksPill,
  canShowPill,
  isBlockedPath,
  isDialogOpen,
  isEditingField,
  markShown,
  useConsentOpen,
} from "./state";

/**
 * The email popup: the pill "Kies je spark" and its modal (docs/PLAN.md §13.11, §13.11.1, decisions 37, 92 and 118;
 * brief §2.8, §6 block 6). Port of CORVANE components/email/EmailCapture.tsx, turned around: the pill appears on its
 * own and the modal only opens from the pill. Mounted once, by EmailCaptureLoader in ShopChrome, after the page settled.
 *
 * Pill (rules 1 to 3, 6):
 * - Appears 8 s after the page started loading (performance.now()) or on desktop exit intent (a fine pointer leaving
 *   the top of the window), whichever comes first. Only when canShowPill(now): popup on, storage works, no sign-up,
 *   last-shown missing or older than 7 days. At that moment also: no dialog or drawer open, no consent banner, no
 *   sticky add-to-cart bar in view, the visitor is not typing, and not on /checkout or /wachtlijst. If one of those
 *   holds, it tries again every second until it can.
 * - markShown(Date.now()) as it appears (an effect, never render), so it shows at most once per 7 days. If that write
 *   fails, it does not appear.
 * - Then it stays for the visit, across client navigations: hidden on /checkout and /wachtlijst, hidden while the
 *   consent banner is open, above the sticky bar on product pages (--onderbalk). Its × hides it for this visit and
 *   stores nothing more (last-shown is already there). After a sign-up it never shows again.
 * - While it shows, <html> gets a scroll-padding-bottom that clears it (WCAG 2.4.11, plan §4.8), handed back on hide
 *   unless the consent banner or the sticky bar wrote their own value in the meantime ("sparkela:sticky-atc"). It also
 *   sets --pill-ruimte on <html> (the pill's height and offset above a sticky bar): the footer adds it as bottom
 *   padding, so at the end of the page the pill sits on empty footer instead of over the wordmark (QA round 1).
 *
 * Modal (rules 4 and 5, components/ui/Modal: focus trap, Esc, focus back to the pill):
 * - Title "Kies je spark.", the promise "Elke kaart geeft 10% op je eerste bestelling." and its conditions before the
 *   cards. Three face-down cards (SparkCards); after a choice the email field with the consent checkbox and the privacy
 *   link (SubscribeForm source="popup"). "Nee, bedankt" closes it; there is no confirm-shaming copy.
 * - After a sign-up: RewardCode. SubscribeForm itself calls markSubscribed() and fires sign_up (rule 5), so the popup
 *   does neither.
 * - Anchored at the top (Modal anchor="top"), so it grows downwards when the form appears instead of re-centring.
 */

type Step = "cards" | "code";

/** How often a blocked pill tries again (a dialog was open, the visitor was typing). */
const RETRY_MS = 1000;

/** Space kept clear above the pill when the browser scrolls a focused element into view. */
const FOCUS_CLEARANCE_PX = 16;

/** CSS variable on <html> with the room the footer keeps free under its content while the pill shows. */
const PILL_SPACE_VAR = "--pill-ruimte";

/** Window event of StickyAddToCart (7-9/D2) after it changed body padding or scroll-padding (decision 194). */
const STICKY_ATC_EVENT = "sparkela:sticky-atc";

export function EmailCapture() {
  const copy = site.emailCapture;
  const popup = pagesCopy.popup;
  const pathname = usePathname();
  const { isOpen: cartOpen } = useCart();
  const subscribed = useSubscribed();
  const consentOpen = useConsentOpen();

  const [appeared, setAppeared] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("cards");
  const [chosen, setChosen] = useState<number | null>(null);
  const [result, setResult] = useState<SubscribeResult | null>(null);

  const pillRef = useRef<HTMLButtonElement>(null);
  /** The last scroll-padding-bottom the pill wrote, to recognise it when it comes back. */
  const lastPaddingRef = useRef("");

  const onBlockedPath = isBlockedPath(pathname);
  const showPill = copy.enabled && appeared && !dismissed && !subscribed && !onBlockedPath && !consentOpen;

  // Latest values for the timer and the exit-intent listener, without re-arming them.
  const blockedNow = useEffectEvent(
    () =>
      cartOpen ||
      isBlockedPath(window.location.pathname) ||
      bodyBlocksPill() ||
      isDialogOpen() ||
      isEditingField(),
  );

  // Rule 1: one timer (8 s from the start of the page load) and one exit-intent listener per page load.
  useEffect(() => {
    if (!site.emailCapture.enabled || !canShowPill(Date.now())) return;

    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const exitIntent = window.matchMedia(FINE_POINTER_QUERY).matches;

    function finish() {
      finished = true;
      clearTimeout(timer);
      document.removeEventListener("mouseout", onMouseOut);
    }

    function attempt(retry: boolean) {
      if (finished) return;
      if (blockedNow()) {
        if (retry) timer = setTimeout(() => attempt(true), RETRY_MS);
        return;
      }
      const now = Date.now();
      // Re-check (another tab may have shown it); the timestamp write doubles as the storage test.
      if (!canShowPill(now) || !markShown(now)) {
        finish();
        return;
      }
      finish();
      setAppeared(true);
    }

    function onMouseOut(event: MouseEvent) {
      if (event.relatedTarget === null && event.clientY <= 0) attempt(false);
    }

    // Counted from the start of the page load, not from this mount: the loader mounts this after the page settled.
    timer = setTimeout(() => attempt(true), Math.max(0, site.emailCapture.delayMs - performance.now()));
    if (exitIntent) document.addEventListener("mouseout", onMouseOut);
    return finish;
  }, []);

  // While the pill shows: keep focused elements clear of it (scroll-padding-bottom on <html>, plan §4.8).
  useEffect(() => {
    if (!showPill) return;
    const root = document.documentElement;
    const pill = pillRef.current?.closest<HTMLElement>("[data-spark-pill]") ?? null;
    if (!pill) return;
    const current = root.style.scrollPaddingBottom;
    // A value we left behind earlier (handed back to us by the consent banner) is not someone else's.
    let theirs = current === lastPaddingRef.current ? "" : current;
    let ours = "";
    const apply = () => {
      // Layout values (height plus the bottom offset, which includes --onderbalk), so the entrance motion does not skew them.
      const bottom = Number.parseFloat(getComputedStyle(pill).bottom) || 0;
      ours = `${Math.ceil(pill.offsetHeight + bottom + FOCUS_CLEARANCE_PX)}px`;
      lastPaddingRef.current = ours;
      root.style.scrollPaddingBottom = ours;
      // The sticky bar already pads <body> by its own height; the footer only needs room for the pill above it.
      const bar = Number.parseFloat(getComputedStyle(document.body).getPropertyValue("--onderbalk")) || 0;
      root.style.setProperty(PILL_SPACE_VAR, `${Math.ceil(pill.offsetHeight + bottom - bar + FOCUS_CLEARANCE_PX)}px`);
    };
    const onStickyBar = () => {
      // The bar wrote its own value: keep it for later and put ours (which clears bar and pill) back on top.
      if (root.style.scrollPaddingBottom !== ours) theirs = root.style.scrollPaddingBottom;
      requestAnimationFrame(apply);
    };
    apply();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    observer?.observe(pill);
    window.addEventListener("resize", apply);
    window.addEventListener(STICKY_ATC_EVENT, onStickyBar);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", apply);
      window.removeEventListener(STICKY_ATC_EVENT, onStickyBar);
      root.style.removeProperty(PILL_SPACE_VAR);
      // Hand the edge back only if nobody else wrote it since (the consent banner keeps its own value).
      if (root.style.scrollPaddingBottom === ours) {
        if (theirs) root.style.scrollPaddingBottom = theirs;
        else root.style.removeProperty("scroll-padding-bottom");
      }
    };
  }, [showPill]);

  if (!copy.enabled) return null;

  function openModal() {
    setStep(result ? "code" : "cards");
    setChosen(null);
    setOpen(true);
  }

  /** The × of the pill: hidden for this visit. Keyboard users stay in the page instead of the start of the document. */
  function hidePill() {
    setDismissed(true);
    document.getElementById("main")?.focus({ preventScroll: true });
  }

  function handleSignedUp(answer: SubscribeResult) {
    setResult(answer);
    setStep("code");
  }

  function close() {
    setOpen(false);
  }

  /** Focus goes back to the pill (Modal); after a sign-up the pill is gone, so it goes to <main> instead of the body. */
  function handleCloseAutoFocus(event: Event) {
    if (pillRef.current?.isConnected) return;
    event.preventDefault();
    document.getElementById("main")?.focus({ preventScroll: true });
  }

  const onCode = step === "code" && result !== null;

  return (
    <>
      {showPill ? <SparkPill onOpen={openModal} onDismiss={hidePill} openRef={pillRef} /> : null}

      <Modal
        open={open}
        onOpenChange={setOpen}
        size="md"
        anchor="top"
        descriptionInBody
        onCloseAutoFocus={handleCloseAutoFocus}
        title={onCode ? popup.reward.title : copy.title}
        description={
          onCode ? undefined : (
            <>
              <span className="block font-medium text-tekst">{copy.intro}</span>
              <span className="mt-1 block text-[0.8125rem]">{popup.conditions}</span>
            </>
          )
        }
      >
        {onCode ? (
          <RewardCode status={result.status} onDone={close} />
        ) : (
          <>
            <div className="rounded-kaart bg-vlak px-3 pt-3 pb-2 sm:px-4 sm:pt-4 sm:pb-3">
              <SparkCards chosen={chosen} onChoose={setChosen} />
            </div>

            {/* Once a card is turned the line is only announced: the caption "Jouw kaart" and the form say it. */}
            <p aria-live="polite" className={chosen === null ? "mt-4 text-[0.9375rem] leading-6 text-tekst" : "sr-only"}>
              {chosen === null ? popup.chooseHint : popup.chosenLine}
            </p>

            {chosen !== null ? <SubscribeForm source="popup" onSuccess={handleSignedUp} className="mt-4" /> : null}

            <div className="mt-4 flex justify-center">
              <Button variant="link" size="md" onClick={close}>
                {popup.dismiss}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
