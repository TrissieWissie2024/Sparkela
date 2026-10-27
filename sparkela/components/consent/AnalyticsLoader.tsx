"use client";

import Script from "next/script";
import { useLayoutEffect, useSyncExternalStore } from "react";

import {
  getConsent,
  getServerConsent,
  gtmScriptUrl,
  initConsentMode,
  isValidGtmId,
  shouldLoadAnalytics,
  startTagManager,
  subscribeConsent,
  syncConsentMode,
  type ConsentSnapshot,
} from "@/lib/analytics";
import { site } from "@/content/site";

/**
 * Loads Google Tag Manager, and only when shouldLoadAnalytics() allows it (docs/PLAN.md §13.6, §18.2; brief §2.10):
 * site.analytics.enabled, a valid site.analytics.gtmId and the visitor's "Akkoord". Renders nothing otherwise, so the
 * default build makes no third-party request at all; ShopChrome does not even render it with analytics off.
 *
 * - Consent comes from useSyncExternalStore (undefined on the server and during hydration), so the server HTML never
 *   holds the script or a preload for it, and a choice in the banner (or in another tab) works without a reload.
 * - Before anything can fire, the Consent Mode defaults (everything denied) go onto window.dataLayer, then an update
 *   for analytics_storage whenever the choice changes, then the "gtm.js" start event. This runs in a layout effect,
 *   which React runs before the passive effect in which next/script inserts the script, so the tag manager finds
 *   them in order.
 * - Withdrawing consent after GTM loaded pushes analytics_storage "denied" and removes the Google Analytics cookies
 *   (syncConsentMode). A loaded script cannot be unloaded; next/script does not insert it twice.
 * - No <noscript> iframe: it would load GTM without asking.
 * Port of CORVANE components/consent/AnalyticsLoader.tsx.
 */
export function AnalyticsLoader() {
  const { enabled, gtmId } = site.analytics;
  const configured = enabled && isValidGtmId(gtmId);
  const consent = useSyncExternalStore<ConsentSnapshot>(subscribeConsent, getConsent, getServerConsent);
  const load = shouldLoadAnalytics({ enabled, gtmId, consent });

  useLayoutEffect(() => {
    if (!configured) return;
    initConsentMode();
    if (consent === undefined) return;
    syncConsentMode(consent);
    if (load) startTagManager();
  }, [configured, consent, load]);

  if (!load || !isValidGtmId(gtmId)) return null;
  return <Script id="sparkela-gtm" src={gtmScriptUrl(gtmId)} strategy="afterInteractive" />;
}
