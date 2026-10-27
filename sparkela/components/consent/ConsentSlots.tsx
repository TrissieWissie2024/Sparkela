"use client";

import dynamic from "next/dynamic";

/**
 * The consent components behind a dynamic import (QA round 1, decision 216): ShopChrome and Footer only render them
 * with site.analytics.enabled, but a static import put ConsentBanner, AnalyticsLoader, CookieSettingsButton and
 * next/script (about 4.5 kB gzip) in the shared chunk of every page anyway (plan §18.2: "geen code in de bundel").
 * Through next/dynamic they live in chunks that only load when analytics is on and the component renders.
 */
export const ConsentBanner = dynamic(() => import("./ConsentBanner").then((module) => module.ConsentBanner));
export const AnalyticsLoader = dynamic(() => import("./AnalyticsLoader").then((module) => module.AnalyticsLoader));
export const CookieSettingsButton = dynamic(() =>
  import("./CookieSettingsButton").then((module) => module.CookieSettingsButton),
);
