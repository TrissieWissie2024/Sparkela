import { storageKeys } from "@/lib/storage";
import type { IsoDate } from "@/lib/types";

/**
 * Legal pages (docs/PLAN.md §5.1, §14.13 to §14.16): the index of content/legal/*.md, the review notice every legal
 * page starts with, and the cookie table of /cookies. The Markdown files themselves come in wave 4-6 (C1); every one
 * starts with legalReviewNotice (content guard). updatedAt is a literal, never computed.
 */

export type LegalSlug = "algemene-voorwaarden" | "privacy" | "cookies" | "verzenden-en-retourneren" | "herroepen";

export interface LegalPageMeta {
  slug: LegalSlug;
  title: string;
  /** Path of the Markdown source, relative to the app root. */
  file: `content/legal/${LegalSlug}.md`;
  /** "Laatst bijgewerkt" on the page. */
  updatedAt: IsoDate;
}

/** The first line of every legal text until a lawyer has checked it (brief §6). */
export const legalReviewNotice = "TODO: laten controleren";

/** Placeholder date until C1 writes the texts; update with every change to a legal text. */
const UPDATED_AT: IsoDate = "2026-10-27";

export const legalPages: LegalPageMeta[] = [
  { slug: "algemene-voorwaarden", title: "Algemene voorwaarden", file: "content/legal/algemene-voorwaarden.md", updatedAt: UPDATED_AT },
  { slug: "privacy", title: "Privacybeleid", file: "content/legal/privacy.md", updatedAt: UPDATED_AT },
  { slug: "cookies", title: "Cookies", file: "content/legal/cookies.md", updatedAt: UPDATED_AT },
  { slug: "verzenden-en-retourneren", title: "Verzenden en retourneren", file: "content/legal/verzenden-en-retourneren.md", updatedAt: UPDATED_AT },
  { slug: "herroepen", title: "Herroepen", file: "content/legal/herroepen.md", updatedAt: UPDATED_AT },
];

export interface CookieRow {
  name: string;
  purpose: string;
  duration: string;
  when: string;
}

export interface CookieTable {
  caption: string;
  columns: { name: string; purpose: string; duration: string; when: string };
  rows: CookieRow[];
  /** Label of CookieSettingsButton (which renders nothing while analytics is off, decision 138). */
  settingsLabel: "Cookie-instellingen";
}

const always = "Altijd, nodig om de site te laten werken";

/**
 * Every cookie and storage key the site uses (plan §14.16, §18.2). Functional storage needs no consent;
 * Google Tag Manager and its cookies only load after consent, and only when analytics is switched on.
 */
export const cookieTable: CookieTable = {
  caption: "Cookies en opslag op sparkela.nl",
  columns: { name: "Naam", purpose: "Waarvoor", duration: "Hoe lang", when: "Wanneer" },
  rows: [
    { name: "sparkela_cart", purpose: "Onthoudt je winkelwagen in onze Shopify-winkel.", duration: "10 dagen", when: always },
    { name: "sparkela_preview", purpose: "Geeft het team toegang tot de shop vóór de lancering.", duration: "30 dagen", when: "Alleen via de preview-link van het team" },
    { name: "sparkela_ea_<drop>", purpose: "Geeft Club-leden early access tot een drop.", duration: "Tot het einde van de drop", when: "Alleen via de early-access-link uit de Club-mail" },
    { name: storageKeys.cart, purpose: "Onthoudt je winkelwagen op dit apparaat (opslag in je browser).", duration: "Tot je hem wist", when: always },
    { name: storageKeys.emailCaptureLastShown, purpose: "Onthoudt wanneer je de aanmeldpill zag, zodat hij niet steeds terugkomt.", duration: "Tot je hem wist", when: always },
    { name: storageKeys.emailCaptureSubscribed, purpose: "Onthoudt dat je je al hebt aangemeld.", duration: "Tot je hem wist", when: always },
    { name: storageKeys.consent, purpose: "Onthoudt je keuze voor cookies.", duration: "Tot je hem wist", when: always },
    { name: "_ga, _ga_<id>", purpose: "Statistieken over het gebruik van de site (Google Analytics via Google Tag Manager).", duration: "Tot 2 jaar", when: "Alleen na je toestemming" },
  ],
  settingsLabel: "Cookie-instellingen",
};
