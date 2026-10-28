import { formatMoneyShort } from "@/lib/money";
import type { IsoDateTime, MarketingBadgeId } from "@/lib/types";
import { EARLY_ACCESS_HOURS } from "@/content/drops";
import { welcomeCode } from "@/content/offers";
import { shipping } from "@/content/shipping";

/**
 * Site config (docs/PLAN.md §5.3): brand, launch moment, contact, company details (placeholders), socials,
 * payment methods, VAT texts, thresholds, badges, USPs, the consent sentence, the Club promise, the hygiene rule,
 * the email popup and analytics. Verbatim brief copy (plan §5.2) is checked by content/content-guard.test.ts.
 *
 * Amounts, times and percentages in copy are derived from content/shipping.ts and content/offers.ts, so text and
 * config never drift apart. launchAt and vat.switchAt are literals, never computed (tests read the source).
 */

export interface SocialLink {
  id: "instagram" | "tiktok" | "pinterest";
  label: string;
  href: string;
  /** false while the account is a placeholder: no sameAs in JSON-LD (plan §18.1). */
  confirmed: boolean;
}

export interface SiteConfig {
  name: string;
  description: string;
  taglines: [string, string, string];
  /** Language of each tagline, for lang= where it is rendered (WCAG 3.1.2; QA round 3): two are English. */
  taglineLangs: ["en" | "nl", "en" | "nl", "en" | "nl"];
  /** Shop opens; before this the proxy shows the waitlist (plan §11). Literal with offset. */
  launchAt: IsoDateTime;
  /** Placeholder until the mailbox exists (TODO-LAUNCH); also the fallback address of every form. */
  email: string;
  company: { legalName: string; tradeName: string; address: string; kvk: string; vatId: string };
  socials: SocialLink[];
  /** Neutral text badges in the footer and the drawer (decision 93); add "Klarna" only once it is on (decision 142). */
  paymentMethods: string[];
  /** The same methods for running text: common nouns in lower case ("met Bancontact, creditcard en Apple Pay"). */
  paymentMethodsInText: string[];
  /** VAT line by date (brief §4): `before` until switchAt, `after` from switchAt. Prices stay the same. */
  vat: { switchAt: IsoDateTime; before: string; after: string };
  /** "Laatste stuks" at a real stock of 1 to this number (brief §2.7). */
  lowStockThreshold: number;
  /** Marketing badges that are switched on (brief §2.7, decision 78). Status badges are always on. */
  badges: { enabled: readonly MarketingBadgeId[] };
  /** Sparkela's own promise, allowed everywhere (brief §2.6). */
  guarantee: { months: number; short: string };
  returnDays: number;
  /**
   * How soon a mail gets an answer, as it reads in a sentence ("1 werkdag"). An assumption of the plan (§14.15,
   * decision 216): Linde and Tristan confirm it in TODO-LAUNCH; contact page, FAQ card and terms follow this value.
   */
  responseTime: string;
  /** The rotating USP bar (brief §6, block 1). */
  usps: [string, string, string];
  /** Exact label of the unchecked consent checkbox at every sign-up field (brief §2.8). */
  consentText: string;
  privacyLink: { label: string; href: string };
  /** The withdrawal link on every page (brief §2.10): Footer and MiniFooter, to /herroepen. */
  withdrawalLinkLabel: string;
  /** Shown for earrings and piercings (needsHygieneSeal in lib/catalog.ts). */
  hygieneRule: string;
  club: { title: string; cta: string; benefits: [string, string, string] };
  emailCapture: {
    enabled: boolean;
    /** The pill shows after this long on the page (performance.now()), or on exit intent (plan §13.11.1). */
    delayMs: number;
    cooldownDays: number;
    pillLabel: string;
    title: string;
    intro: string;
    /** What every card reveals: the same, real reward for everyone, stated up front (brief §2.8, decision 92). */
    reveal: string;
  };
  /** Off by default; with it off neither the consent banner nor the loader is rendered (decision 68). */
  analytics: { enabled: boolean; gtmId: string | null };
  flags: {
    /** "Bestseller" badge and the "Bestsellers" carousel title only with real sales data (brief §2.7). */
    realSalesData: boolean;
    /** Review blocks render nothing until real reviews exist (brief §2.3). */
    showReviews: boolean;
    /**
     * PhotoStrip and VideoRow render nothing in production while none of their files is SUPPLIED (decision 127).
     * VERCEL_ENV is not inlined into client bundles: only server components may read this flag.
     */
    hideMissingOptionalMedia: boolean;
  };
}

const freeFrom = formatMoneyShort(shipping.countries[shipping.defaultCountry].freeFrom);
const cutoff = shipping.cutoff.label;
const reward = `${welcomeCode.percent}% op je eerste bestelling`;
const guaranteeMonths = 6;
const guaranteeShort = `${guaranteeMonths} maanden garantie op verkleuring`;

/** Payment methods as badges (decision 93); add "Klarna" only once it is on (decision 142). */
const PAYMENT_METHODS = ["iDEAL | Wero", "Bancontact", "Creditcard", "Apple Pay"];

/** Not a brand name: the badge says "Creditcard", a sentence "creditcard" (QA round 1). */
const COMMON_NOUN_METHODS = new Set(["Creditcard"]);

export const site: SiteConfig = {
  name: "Sparkela",
  description: "Chunky sieraden met een spark. Statement oorbellen en armbanden, gestyled door Linde.",
  taglines: ["Spark your outfit", "Made to spark", "Sieraden met een spark"],
  taglineLangs: ["en", "en", "nl"],
  launchAt: "2026-11-27T00:00:00+01:00",
  email: "hallo@sparkela.nl",
  company: {
    legalName: "[Naam vof]",
    tradeName: "Sparkela",
    address: "[Straat en huisnummer], [Postcode] [Plaats]",
    kvk: "[KvK-nummer]",
    vatId: "[Btw-id]",
  },
  socials: [
    { id: "instagram", label: "Instagram", href: "https://www.instagram.com/sparkela.nl", confirmed: false },
    { id: "tiktok", label: "TikTok", href: "https://www.tiktok.com/@sparkela.nl", confirmed: false },
    { id: "pinterest", label: "Pinterest", href: "https://www.pinterest.com/sparkelanl", confirmed: false },
  ],
  paymentMethods: PAYMENT_METHODS,
  paymentMethodsInText: PAYMENT_METHODS.map((method) => (COMMON_NOUN_METHODS.has(method) ? method.toLowerCase() : method)),
  vat: {
    switchAt: "2027-01-01T00:00:00+01:00",
    before: "Prijzen inclusief 21% btw",
    after: "Sparkela maakt gebruik van de kleineondernemersregeling; er wordt geen btw berekend.",
  },
  lowStockThreshold: 3,
  badges: { enabled: ["nieuw", "limited", "laatste-stuks"] },
  guarantee: { months: guaranteeMonths, short: guaranteeShort },
  returnDays: shipping.returnDays,
  responseTime: "1 werkdag",
  usps: [`Gratis verzending vanaf ${freeFrom}`, `Vóór ${cutoff} besteld, vandaag verstuurd`, guaranteeShort],
  consentText:
    "Ja, ik wil de nieuwsbrief van Sparkela. Ben je jonger dan 16? Vraag dan eerst toestemming aan je ouder.",
  privacyLink: { label: "Lees ons privacybeleid", href: "/privacy" },
  withdrawalLinkLabel: "Hier de overeenkomst herroepen",
  hygieneRule: "Om hygiënische redenen kun je oorbellen alleen retourneren met ongebroken hygiënezegel.",
  club: {
    title: `Als eerste bij elke drop. Plus ${reward}.`,
    cta: "Ik doe mee",
    benefits: [
      "Als eerste horen wanneer er een nieuwe drop komt",
      `Early access: ${EARLY_ACCESS_HOURS} uur eerder shoppen bij elke drop`,
      `${welcomeCode.percent}% korting op je eerste bestelling`,
    ],
  },
  emailCapture: {
    enabled: true,
    delayMs: 8000,
    cooldownDays: 7,
    pillLabel: "Kies je spark",
    title: "Kies je spark.",
    intro: `Elke kaart geeft ${reward}.`,
    reveal: `${welcomeCode.code} · ${reward}`,
  },
  analytics: {
    enabled: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true",
    gtmId: process.env.NEXT_PUBLIC_GTM_ID || null,
  },
  flags: {
    realSalesData: false,
    showReviews: false,
    hideMissingOptionalMedia: process.env.VERCEL_ENV === "production",
  },
};

/**
 * The socials that are really Sparkela's (confirmed: true). Only these are linked, in the footer, on the waitlist and
 * in JSON-LD: an unconfirmed handle may be empty or someone else's (QA round 3). TODO-LAUNCH: create the accounts and
 * set confirmed: true.
 */
export const confirmedSocials: readonly SocialLink[] = site.socials.filter((social) => social.confirmed);

// Fail fast at load, so a broken config never reaches a build (as in CORVANE).
if (!welcomeCode.code.trim()) {
  throw new Error("content/offers.ts: welcomeCode.code is empty; the popup, Club and finder promise it.");
}
if (Number.isNaN(Date.parse(site.launchAt))) {
  throw new Error(`content/site.ts: launchAt "${site.launchAt}" is not a valid ISO date-time with offset.`);
}
