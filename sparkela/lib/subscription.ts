"use client";

import { useSyncExternalStore } from "react";

import { readJson, storageKeys, writeJson } from "@/lib/storage";

/**
 * "This visitor has signed up" (docs/PLAN.md §13.6), on storageKeys.emailCaptureSubscribed through lib/storage.ts.
 * SubscribeForm calls markSubscribed() after every successful sign-up, whatever the source; the email popup reads
 * hasSubscribed() and useSubscribed() and never shows its pill again afterwards.
 *
 * When storage is blocked the sign-up still counts for the rest of this page session (in memory), so the popup does not
 * come back during the same visit. Client-safe: nothing here runs on the server except the `false` server snapshot.
 */

const listeners = new Set<() => void>();

/** In-memory fallback for this visit, for when storage refused the write. */
let subscribedThisVisit = false;

function notify(): void {
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent): void {
  if (event.key === null || event.key === storageKeys.emailCaptureSubscribed) notify();
}

/** Calls `listener` when the sign-up state changes, in this tab or another one. Returns an unsubscribe function. */
export function subscribeSubscribed(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/** True when the visitor signed up on this device (stored), or earlier during this visit. False on the server. */
export function hasSubscribed(): boolean {
  if (subscribedThisVisit) return true;
  const stored = readJson<unknown>(storageKeys.emailCaptureSubscribed);
  return stored !== null && stored !== false;
}

/** Records a successful sign-up and notifies every useSubscribed(). Call from an event handler or a form callback. */
export function markSubscribed(): void {
  subscribedThisVisit = true;
  writeJson(storageKeys.emailCaptureSubscribed, true);
  notify();
}

function getServerSnapshot(): boolean {
  return false;
}

/** Whether the visitor has signed up. False on the server and during hydration; follows other tabs. */
export function useSubscribed(): boolean {
  return useSyncExternalStore(subscribeSubscribed, hasSubscribed, getServerSnapshot);
}
