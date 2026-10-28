import { stackDiscount } from "@/content/offers";
import { EARLY_ACCESS_HOURS } from "@/content/drops";

/**
 * Chrome copy (docs/PLAN.md §5.1, §12.3, §13.5, §13.6): announcement bar, header, desktop nav, search dialog, mobile
 * menu, footer, payment badges and consent banner. Created in wave 3a; C3 owns this file in wave 4-6 and keeps type
 * and value together. The cookie table lives in content/legal.ts, the USPs in site.usps, the Club promise in
 * site.club and the generic labels (close, menu, search, next, new window) in sharedCopy.ui.
 */
export interface ChromeCopy {
  promo: {
    /** Accessible name of the announcement bar (a region landmark). */
    regionLabel: string;
    /** Drop starting within 7 days: "Nieuwe drop: {naam}." followed by the countdown to its start (plan §12.3 rule 2). */
    dropUpcoming: (name: string) => string;
    /** Link to /sparkela-club next to an upcoming drop. */
    earlyAccessLink: string;
    /** Before the running countdown to a campaign's end ("Nog 3d 11u"); not before the fixed "t/m" label. */
    campaignEndsIn: string;
    /** Before the running countdown to a drop's start ("Over 2d 5u"). */
    dropStartsIn: string;
    /** Drop live for less than 7 days (rule 3). */
    dropLive: (name: string) => string;
    /** Link to /drops/<slug> next to a live drop. */
    dropLink: string;
    /** Accessible name of the list with all USPs (the rotating line itself is hidden from screen readers). */
    uspListLabel: string;
    /** Pause button of the rotating USP line (WCAG 2.2.2); a fixed label, the state is in aria-pressed. */
    pauseUsps: string;
    /** With reduced motion the USP line does not rotate; this button shows the next one (decision 59). */
    nextUsp: string;
  };
  header: {
    /** Visible label of the cart button: "Tas" followed by the count "(2)". */
    cart: string;
    /** The count next to "Tas", in a fixed box. */
    cartCount: (count: number) => string;
    /** Accessible name of the cart button. */
    cartLabel: (count: number) => string;
    account: string;
    openMenu: string;
    /** Accessible name of the logo link. */
    home: string;
    /** Accessible name of the desktop nav and of the main links in the mobile menu. */
    mainNavLabel: string;
  };
  search: {
    title: string;
    /** Visible label of the search field. */
    label: string;
    placeholder: string;
    submit: string;
    clear: string;
    /** Accessible name of the result list. */
    resultsLabel: string;
    /** Live region while typing: "1 resultaat" / "6 resultaten". */
    count: (count: number) => string;
    none: (query: string) => string;
    noneHint: string;
    /** No jewellery, but a page matches (QA round 2). */
    noneProducts: (query: string) => string;
    /** Live region when only pages match. */
    pagesCount: (count: number) => string;
    /** Link to /zoeken?q= under the top results. */
    all: (count: number) => string;
    /** Quick links while the field is empty. */
    quickLinksTitle: string;
  };
  menu: {
    close: string;
    /** Accessible name of the service links under the hairline. */
    serviceLabel: string;
    /** Eyebrow of the featured card when a drop is publicly live. */
    featureDropEyebrow: string;
    /** Eyebrow of the featured card with one of Linde's stacks. */
    featureStackEyebrow: string;
    /** Line on the stack card: the stack discount, derived from content/offers.ts. */
    featureStackLine: string;
    /** The real price of the three pieces together, after the stack discount. */
    featureStackTotal: (total: string) => string;
    /** Accessible name of a current-page dot (only shape, never colour alone). */
    current: string;
  };
  footer: {
    /** Line under the Club title in the footer (what the form line under the field does not say already). */
    clubIntro: string;
    /** Accessible name of the compact footer's legal links (checkout, search, account). */
    compactNavLabel: string;
    /** Accessible name of the link columns. */
    navLabel: string;
    socialsLabel: string;
    companyLabel: string;
    kvk: (value: string) => string;
    vatId: (value: string) => string;
    /** Copyright with the year as a literal (never computed during render). */
    copyright: string;
  };
  payments: {
    /** Accessible name of the list of payment method badges. */
    label: string;
  };
  consent: {
    title: string;
    body: string;
    /** Link to /cookies at the end of the body. */
    linkLabel: string;
    accept: string;
    reject: string;
    /** Status line after a choice. */
    saved: { granted: string; denied: string };
    /** Shown when the banner is opened again from "Cookie-instellingen". */
    current: { granted: string; denied: string };
  };
}

export const chromeCopy: ChromeCopy = {
  promo: {
    regionLabel: "Aankondigingen",
    dropUpcoming: (name) => `Nieuwe drop: ${name}.`,
    earlyAccessLink: `Club-leden zijn er ${EARLY_ACCESS_HOURS} uur eerder bij`,
    campaignEndsIn: "Nog ",
    dropStartsIn: "Over ",
    dropLive: (name) => `Nu live: ${name}`,
    dropLink: "Bekijk de drop",
    uspListLabel: "Waarom Sparkela",
    pauseUsps: "Wisselen pauzeren",
    nextUsp: "Volgende voordeel",
  },
  header: {
    cart: "Tas",
    cartCount: (count) => `(${count})`,
    cartLabel: (count) => (count === 1 ? "Tas, 1 artikel" : `Tas, ${count} artikelen`),
    account: "Account",
    openMenu: "Menu openen",
    home: "Sparkela, naar de homepage",
    mainNavLabel: "Hoofdmenu",
  },
  search: {
    title: "Zoeken",
    label: "Waar ben je naar op zoek?",
    placeholder: "Bijvoorbeeld hoops of festival",
    submit: "Zoeken",
    clear: "Zoekveld leegmaken",
    resultsLabel: "Zoekresultaten",
    count: (count) => (count === 1 ? "1 resultaat" : `${count} resultaten`),
    none: (query) => `Niets gevonden voor “${query}”`,
    noneHint: "Probeer een ander woord, zoals oorbellen, armband of date night.",
    noneProducts: (query) => `Geen sieraden voor “${query}”`,
    pagesCount: (count) => (count === 1 ? "1 pagina gevonden" : `${count} pagina's gevonden`),
    all: (count) => (count === 1 ? "Bekijk het resultaat" : `Bekijk alle ${count} resultaten`),
    quickLinksTitle: "Snel naar",
  },
  menu: {
    close: "Menu sluiten",
    serviceLabel: "Service en meer",
    featureDropEyebrow: "Nu live",
    featureStackEyebrow: "Stack van Linde",
    featureStackLine: `Drie stuks met ${stackDiscount.percent}% stack-korting`,
    featureStackTotal: (total) => `Samen ${total}`,
    current: "huidige pagina",
  },
  footer: {
    clubIntro: `Stylingtips van Linde en ${EARLY_ACCESS_HOURS} uur eerder shoppen bij elke drop.`,
    navLabel: "Meer van Sparkela",
    compactNavLabel: "Juridisch en service",
    socialsLabel: "Volg Sparkela",
    companyLabel: "Bedrijfsgegevens",
    kvk: (value) => `KvK ${value}`,
    vatId: (value) => `Btw-id ${value}`,
    copyright: "© 2026 Sparkela",
  },
  payments: {
    label: "Betaalmethoden",
  },
  consent: {
    title: "Mogen we meten?",
    body:
      "Met je akkoord gebruiken we Google Analytics om te zien hoe de shop gebruikt wordt, zodat we hem beter kunnen maken. " +
      "Zonder akkoord gebruiken we alleen wat nodig is om je tas te bewaren.",
    linkLabel: "Lees meer over cookies",
    accept: "Akkoord",
    reject: "Weigeren",
    saved: {
      granted: "Je keuze is bewaard: we meten mee.",
      denied: "Je keuze is bewaard: we meten niets.",
    },
    current: {
      granted: "Nu staat meten aan.",
      denied: "Nu staat meten uit.",
    },
  },
};
