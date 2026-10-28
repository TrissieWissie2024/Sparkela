import { formatMoney, formatMoneyShort } from "@/lib/money";
import { storageKeys } from "@/lib/storage";
import type { IsoDate } from "@/lib/types";
import { EARLY_ACCESS_HOURS } from "@/content/drops";
import { shipping } from "@/content/shipping";
import { site } from "@/content/site";

/**
 * Legal pages (docs/PLAN.md §5.1, §14.13 to §14.16): the index of content/legal/*.md, the review notice every legal
 * page starts with, the cookie table of /cookies, the labels of the legal UI (legalUi) and the values the Markdown
 * texts fill in (legalVariables). Every Markdown file starts with legalReviewNotice (content guard). updatedAt is a
 * literal, never computed.
 *
 * The Markdown texts never retype a company detail, an amount, a time or a number of days: they write
 * `{{verzendkosten}}`, `{{kvk}}` and so on, and components/legal/LegalPage.tsx fills them in from legalVariables, which
 * reads content/site.ts, content/shipping.ts and content/offers.ts (plan §21.2). An unknown name fails the build.
 */

export type LegalSlug = "algemene-voorwaarden" | "privacy" | "cookies" | "verzenden-en-retourneren" | "herroepen";

export interface LegalPageMeta {
  slug: LegalSlug;
  title: string;
  /** Meta description of the page. */
  description: string;
  /** Path of the Markdown source, relative to the app root. */
  file: `content/legal/${LegalSlug}.md`;
  /** "Laatst bijgewerkt" on the page. */
  updatedAt: IsoDate;
}

/** The first line of every legal text until a lawyer has checked it (brief §6). */
export const legalReviewNotice = "TODO: laten controleren";

/** Date of the first drafts (wave 4-6); update the page's updatedAt with every change to its text. */
const UPDATED_AT: IsoDate = "2026-10-27";

export const legalPages: LegalPageMeta[] = [
  {
    slug: "algemene-voorwaarden",
    title: "Algemene voorwaarden",
    description: "De afspraken als je bij Sparkela bestelt: aanbod, betalen, levering, bedenktijd, garantie en klachten.",
    file: "content/legal/algemene-voorwaarden.md",
    updatedAt: UPDATED_AT,
  },
  {
    slug: "privacy",
    title: "Privacybeleid",
    description: "Welke gegevens Sparkela gebruikt, waarvoor, hoe lang en welke rechten je hebt.",
    file: "content/legal/privacy.md",
    updatedAt: UPDATED_AT,
  },
  {
    slug: "cookies",
    title: "Cookies",
    description: "Welke cookies en opslag sparkela.nl gebruikt, waarvoor en hoe lang.",
    file: "content/legal/cookies.md",
    updatedAt: UPDATED_AT,
  },
  {
    slug: "verzenden-en-retourneren",
    title: "Verzenden en retourneren",
    description: "Verzendkosten, wanneer je bestelling komt, bedenktijd, de hygiëneregel en hoe je retourneert.",
    file: "content/legal/verzenden-en-retourneren.md",
    updatedAt: UPDATED_AT,
  },
  {
    slug: "herroepen",
    title: "Modelformulier voor herroeping",
    description: "Het modelformulier om je bestelling bij Sparkela te herroepen.",
    file: "content/legal/herroepen.md",
    updatedAt: UPDATED_AT,
  },
];

/** Labels of the legal pages (LegalPage, LegalNotice, UpcomingHolidays, /cookies). */
export interface LegalUi {
  /** "Laatst bijgewerkt: 27 oktober 2026"; the date comes formatted. */
  updated: (date: string) => string;
  /** Accessible name of the review notice banner. */
  noticeLabel: string;
  /** Accessible name of the holiday list of one year. */
  holidaysYear: (year: string) => string;
  cookieSettingsIntro: string;
  /** Accessible name of the links to the other legal pages under every legal text. */
  relatedLabel: string;
}

export const legalUi: LegalUi = {
  updated: (date) => `Laatst bijgewerkt: ${date}`,
  noticeLabel: "Concepttekst",
  holidaysYear: (year) => `Feestdagen in ${year} waarop we niet versturen`,
  cookieSettingsIntro: "Wil je je keuze voor statistiekcookies aanpassen? Dat kan hier.",
  relatedLabel: "Meer juridische informatie",
};

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
    { name: "sparkela_cart", purpose: "Onthoudt je tas in onze Shopify-winkel.", duration: "10 dagen", when: always },
    { name: "sparkela_preview", purpose: "Geeft het team toegang tot de shop vóór de lancering.", duration: "30 dagen", when: "Alleen via de preview-link van het team" },
    { name: "sparkela_ea_<drop>", purpose: "Geeft Club-leden early access tot een drop.", duration: "Tot het einde van de drop", when: "Alleen via de early-access-link uit de Club-mail" },
    { name: storageKeys.cart, purpose: "Onthoudt je tas op dit apparaat (opslag in je browser).", duration: "Tot je hem wist", when: always },
    { name: storageKeys.emailCaptureLastShown, purpose: "Onthoudt wanneer je de knop “Kies je spark” zag, zodat hij niet steeds terugkomt.", duration: "Tot je hem wist", when: always },
    { name: storageKeys.emailCaptureSubscribed, purpose: "Onthoudt dat je je al hebt aangemeld.", duration: "Tot je hem wist", when: always },
    { name: storageKeys.consent, purpose: "Onthoudt je keuze voor cookies.", duration: "Tot je hem wist", when: always },
    { name: "_ga, _ga_<id>", purpose: "Statistieken over het gebruik van de site (Google Analytics via Google Tag Manager).", duration: "Tot 2 jaar", when: "Alleen na je toestemming" },
  ],
  settingsLabel: "Cookie-instellingen",
};

const country = shipping.countries[shipping.defaultCountry];

/**
 * The values the Markdown texts fill in (`{{name}}`). Company details stay placeholders in content/site.ts until
 * Tristan fills them in (plan §22 point 11); the legal texts follow automatically.
 */
export const legalVariables: Readonly<Record<string, string>> = {
  handelsnaam: site.company.tradeName,
  bedrijfsnaam: site.company.legalName,
  adres: site.company.address,
  kvk: site.company.kvk,
  btwId: site.company.vatId,
  email: site.email,
  betaalmethoden: site.paymentMethodsInText.join(", "),
  vervoerder: shipping.carrier,
  verzendmethode: shipping.method,
  land: country.label,
  verzendkosten: formatMoney(country.rate),
  gratisVanaf: formatMoneyShort(country.freeFrom),
  cutoff: shipping.cutoff.label,
  levertijdMin: String(country.transitDays.min),
  levertijdMax: String(country.transitDays.max),
  retourDagen: String(site.returnDays),
  reactietijd: site.responseTime,
  garantieMaanden: String(site.guarantee.months),
  hygieneRegel: site.hygieneRule,
  herroepLink: site.withdrawalLinkLabel,
  vroegeToegangUren: String(EARLY_ACCESS_HOURS),
  cookieInstellingen: cookieTable.settingsLabel,
};
