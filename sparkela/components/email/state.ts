"use client";

import { useSyncExternalStore } from "react";

import { readStorage, removeStorage, storageKeys, writeJson, writeStorage } from "@/lib/storage";
import { hasSubscribed } from "@/lib/subscription";
import { site } from "@/content/site";

/**
 * The rules of the email popup (docs/PLAN.md §13.11.1, decisions 37 and 118; brief §2.8, §6 block 6). Port of CORVANE
 * components/email/state.ts, rewritten for "the pill first": the pill appears after 8 s or on exit intent and is shown
 * at most once per 7 days; the modal only opens from the pill. Sign-up state comes from lib/subscription.ts (B1).
 *
 * Storage only through lib/storage.ts (try/catch): when storage does not accept a test write, the pill never shows,
 * because the 7-day cap could not be kept. Everything that reads the browser runs in effects, event handlers or
 * useSyncExternalStore snapshots (false on the server), so nothing here causes a hydration mismatch.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Written and removed again to test that storage works (a sparkela: key next to last-shown, never kept). */
export const STORAGE_TEST_KEY = `${storageKeys.emailCaptureLastShown}:test`;

/** Desktop exit intent only applies to a precise pointer (a mouse or trackpad). */
export const EXIT_INTENT_QUERY = "(pointer: fine)";

/** Pages without the pill: the demo checkout and the waitlist (plan §13.11.1 rule 2). */
const BLOCKED_PATHS = ["/checkout", "/wachtlijst"];

/** True on /checkout, /wachtlijst and anything under them. */
export function isBlockedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return BLOCKED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/* -------------------------------------------------------------------------- */
/* Cooldown and storage                                                        */
/* -------------------------------------------------------------------------- */

function toTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
    const date = Date.parse(value);
    return Number.isFinite(date) ? date : null;
  }
  return null;
}

/**
 * True when at least `days` days passed since the pill was last shown. A missing or unreadable value counts as "never
 * shown". A time in the future (a clock that moved back) counts as recent, so the cap is never skipped.
 */
export function isCooldownOver(lastShown: unknown, now: number, days: number = site.emailCapture.cooldownDays): boolean {
  const shownAt = toTimestamp(lastShown);
  if (shownAt === null) return true;
  if (shownAt > now) return false;
  return now - shownAt >= days * DAY_MS;
}

/** True when localStorage accepts a write right now (written and removed again). */
export function storageWorks(): boolean {
  if (!writeStorage(STORAGE_TEST_KEY, "1")) return false;
  removeStorage(STORAGE_TEST_KEY);
  return true;
}

/**
 * When the pill was last shown (epoch ms), or null. markShown() stores a JSON number; a plain ISO string written by
 * hand or by a test ("2100-01-01") counts too, so a far-future value reliably keeps the pill away.
 */
export function readLastShown(): number | null {
  const raw = readStorage(storageKeys.emailCaptureLastShown);
  if (raw === null) return null;
  try {
    return toTimestamp(JSON.parse(raw));
  } catch {
    return toTimestamp(raw);
  }
}

/**
 * May the pill appear now (plan §13.11.1 rule 2, the stored part): the popup is on, storage works (test write), the
 * visitor has not signed up (lib/subscription.ts) and the pill was never shown or at least cooldownDays ago. The page
 * conditions (dialogs, consent banner, sticky bar, typing, path) are checked by the caller at the moment itself.
 */
export function canShowPill(now: number): boolean {
  if (!site.emailCapture.enabled) return false;
  if (!storageWorks()) return false;
  if (hasSubscribed()) return false;
  return isCooldownOver(readLastShown(), now, site.emailCapture.cooldownDays);
}

/**
 * Stores the moment the pill appeared (rule 3): from then on it stays away for cooldownDays. Called in an effect or a
 * handler, never in render. False when storage refused the write; the pill then does not appear.
 */
export function markShown(now: number): boolean {
  return writeJson(storageKeys.emailCaptureLastShown, now);
}

/* -------------------------------------------------------------------------- */
/* Page state                                                                  */
/* -------------------------------------------------------------------------- */

/** True while the consent banner is open (it sets body[data-consent-open], C3). */
export function consentOpen(): boolean {
  return document.body.dataset.consentOpen === "true";
}

/**
 * Height of the product page's sticky add-to-cart bar while it is in view, from the custom property --onderbalk that
 * StickyAddToCart (7-9/D2) sets on <body>; 0 when it is not there (decision 118).
 */
export function stickyBarHeight(): number {
  const value = getComputedStyle(document.body).getPropertyValue("--onderbalk");
  const height = Number.parseFloat(value);
  return Number.isFinite(height) && height > 0 ? height : 0;
}

/**
 * True while something owns the bottom edge: an open consent banner or the sticky add-to-cart bar in view. The pill
 * does not appear then (rule 2); once it shows it hides while the banner is open and rides above the bar.
 */
export function bodyBlocksPill(): boolean {
  return consentOpen() || stickyBarHeight() > 0;
}

/** Height of the bottom band where the pill appears: its 46 px, the 24 px offset and room around it. */
const PILL_SPOT_HEIGHT_PX = 120;
/** Width of the bottom left corner the pill takes (it is about 190 px wide, more with large text). */
const PILL_SPOT_WIDTH_PX = 320;

/**
 * True while an element marked data-pill-vrij sits where the pill would appear (QA round 3): at 1440 × 900 the home's
 * delivery bar ends exactly at the fold, and the pill covered its first and most important line ("Vóór 16.00
 * besteld? Vandaag verstuurd."). The pill then waits until the visitor has scrolled it out of that corner.
 */
export function pillSpotTaken(): boolean {
  const bottom = window.innerHeight;
  const top = bottom - PILL_SPOT_HEIGHT_PX;
  for (const element of Array.from(document.querySelectorAll("[data-pill-vrij]"))) {
    const rect = element.getBoundingClientRect();
    if (rect.height > 0 && rect.top < bottom && rect.bottom > top && rect.left < PILL_SPOT_WIDTH_PX) return true;
  }
  return false;
}

/** True while the visitor is typing or choosing in a form field (the pill never interrupts that). */
export function isEditingField(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  if (active.isContentEditable) return true;
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return true;
  if (active instanceof HTMLInputElement) {
    return !["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "image"].includes(active.type);
  }
  return false;
}

/** True while any dialog (cart drawer, mobile menu, search, another modal) is open. */
export function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]') !== null;
}

function subscribeConsentFlag(listener: () => void): () => void {
  const observer = new MutationObserver(listener);
  observer.observe(document.body, { attributes: true, attributeFilter: ["data-consent-open"] });
  return () => observer.disconnect();
}

/** consentOpen(), kept live with a MutationObserver. False on the server. */
export function useConsentOpen(): boolean {
  return useSyncExternalStore(subscribeConsentFlag, consentOpen, () => false);
}
