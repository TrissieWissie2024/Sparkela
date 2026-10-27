import { formatMoneyRange, formatMoneyShort } from "@/lib/money";
import type { BadgeId, ImageKind, JewelryType, Moment, PriceBucket, SortKey, Vibe } from "@/lib/types";
import { stackDiscount } from "@/content/offers";
import { shipping } from "@/content/shipping";
import { moneyCopy, type MoneyCopy } from "@/content/copy/money";

/**
 * Shared copy (docs/PLAN.md §5.9): the texts lib/ returns (delivery bar, delivery estimate, progress, lowest
 * price, badges, countdown), generic UI labels, cart announcements, the one vocabulary for type, vibe, moment,
 * price and sorting (decision 125), the 404, the connecting words of the date labels and the local discount titles.
 * Keys from §5.2 and §5.9 are never renamed; owners only add keys.
 *
 * Templated copy is a function of already formatted strings. Times, amounts and percentages come from config
 * (content/shipping.ts, content/offers.ts), so copy and config cannot drift apart.
 */
export interface SharedCopy {
  deliveryBar: { today: string; later: (day: string) => string; fallback: string };
  deliveryEstimate: { today: string; later: (day: string) => string; fallback: string };
  progress: {
    remaining: (amount: string) => string;
    reached: string;
    giftCardsOnly: string;
    stackOne: string;
    stackTwo: string;
    stackReached: string;
    shopifyNote: string;
  };
  price: {
    from: (amount: string) => string;
    /** Visually hidden label before the struck price. */
    was: string;
    /** Visually hidden label before the current price, only next to a struck price ("Van €29,95, nu €24,95"). */
    now: string;
    lowest30d: (amount: string) => string;
    savings: (amount: string) => string;
  };
  badges: Record<BadgeId, string>;
  countdown: { pause: string; resume: string; live: string; days: string; hours: string };
  ui: {
    close: string;
    menu: string;
    search: string;
    previous: string;
    next: string;
    pause: string;
    play: string;
    loading: string;
    error: string;
    retry: string;
    required: string;
    optional: string;
    slideLabel: (n: number, total: number) => string;
    showImage: (n: number, total: number) => string;
    /** aria-roledescription of a carousel and of its slides. */
    carousel: string;
    slide: string;
    /** Name of the scrolling list inside a carousel; the region carries the carousel's own name (decision 188). */
    slides: string;
    breadcrumbs: string;
    skipLink: string;
    newWindow: string;
    photoPlaceholder: (label: string) => string;
    videoPlaceholder: (label: string) => string;
    /** First crumb of every breadcrumb trail (Breadcrumbs, PageHeader). */
    home: string;
    /** Kind of product photo, for placeholders and empty alt texts ("Lola chunky hoops, draagfoto"). */
    imageKinds: Record<ImageKind, string>;
    /** Alt text of a product photo without one in Shopify (plan §17.2): "{title}, {kind}". */
    imageAlt: (title: string, kind: string) => string;
    /** Accessible name of the Stars rating. Only rendered with real reviews (brief §2.3). */
    rating: (average: string, count: number) => string;
    /** Counter under a text field with a maximum length (TextField). */
    charactersLeft: (left: number) => string;
  };
  announce: {
    added: (title: string) => string;
    removed: (title: string) => string;
    updated: (title: string, quantity: number) => string;
    error: string;
  };
  vocab: {
    type: Record<JewelryType, string>;
    vibe: Record<Vibe, string>;
    moment: Record<Moment, string>;
    price: Record<PriceBucket, string>;
    sort: Record<SortKey, string>;
  };
  notFound: {
    title: string;
    text: string;
    shop: string;
    finder: string;
    search: string;
    favoritesTitle: string;
    /** Metadata title of an unknown product, NO_PRODUCTS_HANDLE and the gift wrap (lib/seo.ts, plan §14.2). */
    metaTitle: string;
  };
  /** Connecting words of the date labels in lib/dates.ts ("Begint op vrijdag 27 november om 00.00 uur"). */
  dates: {
    today: string;
    tomorrow: string;
    /** "00.00 uur": the Dutch time notation with a dot. */
    hours: string;
    at: string;
    midnight: string;
    startsOn: string;
    endsOn: string;
    /** "t/m 30 november": up to and including. */
    through: string;
    until: string;
  };
  /**
   * Titles of the local discount rows (lib/pricing.ts, DiscountApplication.title). `giftWrap` equals the title of the
   * automatic discount in Shopify (plan §16.5), so the drawer reads the same for both providers.
   */
  /** `other`: a Shopify discount without a title that is neither the stack, the gift wrap nor a code. */
  discounts: { stack: (percent: string) => string; giftWrap: string; other: string };
  /** The words of lib/money.ts ("€15 tot €50"); the same object as moneyCopy in content/copy/money.ts (decision 183). */
  money: MoneyCopy;
}

const cutoff = shipping.cutoff.label;
const transit = shipping.countries[shipping.defaultCountry].transitDays;
const transitText = `${transit.min} tot ${transit.max} werkdagen`;
const stackPercent = `${stackDiscount.percent}%`;

/** Lower bounds of the price buckets in cents (lib/catalog.ts buckets on priceRange.min, plan §7.2). */
const BUCKET_15 = 1500;
const BUCKET_20 = 2000;
const BUCKET_25 = 2500;

export const sharedCopy: SharedCopy = {
  deliveryBar: {
    today: `Vóór ${cutoff} besteld? Vandaag verstuurd.`,
    later: (day) => `Nu besteld, ${day} verstuurd.`,
    fallback: `Op werkdagen vóór ${cutoff} besteld, dezelfde dag verstuurd.`,
  },
  deliveryEstimate: {
    today: `Vóór ${cutoff} besteld, vandaag verstuurd. Meestal binnen ${transitText} in je brievenbus.`,
    later: (day) => `Nu besteld, ${day} verstuurd. Meestal binnen ${transitText} daarna in je brievenbus.`,
    fallback: `Op werkdagen vóór ${cutoff} besteld, dezelfde dag verstuurd. Meestal binnen ${transitText} in je brievenbus.`,
  },
  progress: {
    remaining: (amount) => `Nog ${amount} tot gratis verzending`,
    reached: "Je verzending is gratis",
    giftCardsOnly: "Cadeaukaarten komen per mail, zonder verzendkosten",
    stackOne: `Nog 1 armband of oorbel voor ${stackPercent} stack-korting`,
    stackTwo: `Nog 2 armbanden of oorbellen voor ${stackPercent} stack-korting`,
    stackReached: `Je stack-korting van ${stackPercent} is binnen`,
    shopifyNote: "Verzendkosten zie je bij het afrekenen.",
  },
  price: {
    from: (amount) => `Vanaf ${amount}`,
    was: "Van",
    now: "nu",
    lowest30d: (amount) => `Laagste prijs in de 30 dagen hiervoor: ${amount}`,
    savings: (amount) => `Je bespaart ${amount}`,
  },
  badges: {
    nieuw: "Nieuw",
    limited: "Limited",
    "laatste-stuks": "Laatste stuks",
    sale: "Sale",
    bestseller: "Bestseller",
    uitverkocht: "Uitverkocht",
    "early-access": "Early access",
    "op-voorraad": "Op voorraad",
  },
  countdown: {
    pause: "Aftellen pauzeren",
    resume: "Aftellen hervatten",
    live: "Nu live",
    days: "d",
    hours: "u",
  },
  ui: {
    close: "Sluiten",
    menu: "Menu",
    search: "Zoeken",
    previous: "Vorige",
    next: "Volgende",
    pause: "Pauzeren",
    play: "Afspelen",
    loading: "Even laden",
    error: "Er ging iets mis.",
    retry: "Probeer het opnieuw",
    required: "verplicht",
    optional: "optioneel",
    slideLabel: (n, total) => `${n} van ${total}`,
    showImage: (n, total) => `Toon afbeelding ${n} van ${total}`,
    carousel: "carrousel",
    slide: "dia",
    slides: "Dia's",
    breadcrumbs: "Kruimelpad",
    skipLink: "Naar de inhoud",
    newWindow: "(opent in nieuw venster)",
    photoPlaceholder: (label) => `FOTO: ${label}`,
    videoPlaceholder: (label) => `VIDEO: ${label}`,
    home: "Home",
    imageKinds: {
      packshot: "packshot",
      draagfoto: "draagfoto",
      detail: "detail",
      schaal: "schaalfoto",
      stack: "stackfoto",
      overig: "foto",
    },
    imageAlt: (title, kind) => `${title}, ${kind}`,
    rating: (average, count) => `Gemiddeld ${average} van 5 sterren (aantal beoordelingen: ${count})`,
    charactersLeft: (left) => (left === 1 ? "Nog 1 teken" : `Nog ${left} tekens`),
  },
  announce: {
    added: (title) => `Toegevoegd: ${title}`,
    removed: (title) => `Verwijderd: ${title}`,
    updated: (title, quantity) => `${title}: aantal ${quantity}`,
    error: "Dat lukte niet. Probeer het opnieuw.",
  },
  vocab: {
    type: {
      oorbellen: "Oorbellen",
      armbanden: "Armbanden",
      kettingen: "Kettingen",
      ringen: "Ringen",
    },
    vibe: {
      "chunky-en-bold": "Chunky en bold",
      "clean-en-classy": "Clean en classy",
      "kleurrijk-en-speels": "Kleurrijk en speels",
      retro: "Retro",
    },
    moment: {
      festival: "Festival",
      "date-night": "Date night",
      "kantoor-maar-niet-saai": "Kantoor maar niet saai",
      strand: "Strand",
      feestdagen: "Feestdagen",
    },
    price: {
      "tot-15": `Tot ${formatMoneyShort(BUCKET_15)}`,
      "15-20": formatMoneyRange(BUCKET_15, BUCKET_20),
      "20-25": formatMoneyRange(BUCKET_20, BUCKET_25),
      "vanaf-25": `Vanaf ${formatMoneyShort(BUCKET_25)}`,
    },
    sort: {
      uitgelicht: "Uitgelicht",
      "prijs-oplopend": "Prijs laag naar hoog",
      "prijs-aflopend": "Prijs hoog naar laag",
      nieuwste: "Nieuwste",
    },
  },
  notFound: {
    title: "Deze pagina bestaat niet (meer)",
    text: "Misschien vind je hier wat je zocht.",
    shop: "Naar de shop",
    finder: "Spark Finder",
    search: "Zoeken",
    favoritesTitle: "Lindes favorieten",
    metaTitle: "Pagina niet gevonden",
  },
  dates: {
    today: "vandaag",
    tomorrow: "morgen",
    hours: "uur",
    at: "om",
    midnight: "middernacht",
    startsOn: "Begint op",
    endsOn: "Eindigt op",
    through: "t/m",
    until: "tot",
  },
  discounts: {
    stack: (percent) => `Stack-korting ${percent}`,
    giftWrap: "Cadeauverpakking december",
    other: "Korting",
  },
  money: moneyCopy,
};
