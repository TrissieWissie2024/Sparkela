import { formatMoney, formatMoneyShort } from "@/lib/money";
import { stackDiscount } from "@/content/offers";
import { shipping } from "@/content/shipping";
import { site } from "@/content/site";

/**
 * Product page copy (docs/PLAN.md §5.1, §13.9, §14.2): buy column, variants, ring size guide, stack picker, gift wrap,
 * add to cart and the sticky bar, delivery, trust row, specs, Statement-meter, claims, accordions, GPSR, care,
 * "Maak de look af", reviews and the FAQ block. Created in wave 3a with the keys the plan fixes; B4 wrote care.default
 * in 3b and D2 adds the rest in 7-9 (type and value together, in this file).
 *
 * Amounts, percentages, days and the cut-off come from config (content/offers.ts, content/shipping.ts,
 * content/site.ts), so the copy never drifts from what the cart and Shopify do. No claims here: a claim only reaches
 * the page through getVerifiedClaims() and claims.confirmed() (brief §2.6, decision 82).
 */

/** A link in copy. */
export interface PdpLink {
  label: string;
  href: string;
}

/** One row of the trust row: a bold title and a short line under it. */
export interface PdpTrustItem {
  id: "betalen" | "verzending" | "garantie" | "bedenktijd" | "mail";
  title: string;
  text: string;
  link?: PdpLink;
}

export interface PdpCopy {
  claims: {
    /** A verified claim (lib/claims.ts getVerifiedClaims), never "getest" (decision 82). */
    confirmed: (label: string) => string;
  };
  gpsr: {
    /** Shown when a GPSR metafield is empty (plan §6.4). */
    missing: string;
    /** Product safety line of the gift card (decision 116). */
    digital: string;
  };
  care: {
    /** Fallback of the care accordion and the verzorging field of the local products (plan §5.4). */
    default: string;
  };
  stack: {
    /** Option label in the stack picker: "Lola chunky hoops, Zilver · €19,95" (decision 129). */
    option: (title: string, variantLabel: string | null, price: string) => string;
    /** Legend of the two tiles. */
    legend: string;
    /** Tile 1. */
    single: string;
    /** Under "Los": only this piece. */
    singleText: (title: string) => string;
    /** Tile 2, verbatim from the brief: "Stack van 3 (−15%)" (percent from content/offers.ts). */
    stackTitle: string;
    /** Under the stack tile: what the stack is. */
    stackText: string;
    /** Heading of the panel with the three pieces. */
    yourStack: string;
    /** One line on how the stack works, above the two selects. */
    intro: string;
    /** "Stuk 1", "Stuk 2", "Stuk 3". */
    piece: (n: number) => string;
    /** After piece 1: it is the piece of this page (chosen above). */
    thisPiece: string;
    /** Under the selects while the picks are Linde's stack: "Lindes stack: Goud en gedurfd". */
    lindesStack: (name: string) => string;
    /** Button that puts Linde's picks back. */
    resetToLinde: string;
    /** Same, while the stack has no name (the fallback picks). */
    resetToDefault: string;
    /** The total of the three pieces before the discount: "Los samen €59,85". */
    piecesTotal: (amount: string) => string;
  };
  breadcrumbs: {
    /** Crumb 2 when the product has no collection of its type (the gift card): the gift card page. */
    giftCards: PdpLink;
  };
  sections: {
    /** Visually hidden h2 of the buy column (plan §14.2). */
    buy: string;
    /** Visually hidden h2 of the delivery card. */
    delivery: string;
    /** Visually hidden h2 of the trust row. */
    trust: string;
    /** Visually hidden h2 above the accordions. */
    details: string;
    /** The same heading on the gift card's page (QA round 1: "stuk" is a piece of jewellery). */
    detailsGiftCard: string;
  };
  gallery: {
    /** Accessible name of the gallery. */
    label: (title: string) => string;
    /** Polite status after a swipe or a thumbnail: "Afbeelding 2 van 5". */
    status: (n: number, total: number) => string;
    /** Button on the large image that opens the zoom. */
    zoom: string;
    /** Title of the zoom dialog (visually hidden): "Lola chunky hoops, vergroot". */
    zoomTitle: (title: string) => string;
    /** Under the zoomed photo. */
    zoomHint: string;
  };
  variant: {
    /** Group label per kind of option. */
    labels: { kleur: string; maat: string; bedrag: string; overig: string };
    /** Added to the name of a sold-out variant (visible and read). */
    soldOut: string;
    /** Low stock (1 to site.lowStockThreshold): "Nog 2". */
    lowStock: (count: number) => string;
    /** Opens the ring size guide. */
    sizeGuide: string;
    /** A ring without a chosen size (no size is preselected): the add asks for one. */
    chooseSize: string;
    /** Under the gift card amounts. */
    giftCardNote: string;
  };
  sizeGuide: {
    title: string;
    intro: string;
    /** Caption of the size table. */
    caption: string;
    columns: { size: string; diameter: string; circumference: string };
    /** "16,0 mm". */
    millimetres: (value: string) => string;
    measureTitle: string;
    steps: [string, string, string, string];
    ringTitle: string;
    ringText: string;
    /** Verbatim from plan §13.9. */
    tip: string;
  };
  giftWrap: {
    label: string;
    description: string;
    /** The gift wrap is already in the cart (one per order, QA round 2): the tick shows on and says so. */
    alreadyOn: string;
  };
  addToCart: {
    /** "In je tas · €19,95" (the price follows, after an aria-hidden dot). */
    label: string;
    /** Stack mode: "Voeg de stack toe · €50,88". */
    stack: string;
    /** Between label and price; aria-hidden. */
    separator: string;
    /** While the cart answers. */
    adding: string;
    /** The product, or the chosen variant, cannot be bought. */
    soldOut: string;
    /** Why the button is not available: the chosen variant is sold out. */
    variantSoldOut: (variant: string) => string;
    /** Under the button when adding failed. */
    errors: { notYetAvailable: string; unavailable: string; quantityCapped: string; generic: string };
  };
  stickyBar: {
    /** Name of the bar region. */
    label: string;
    /** The bar's button, short so title, choice and button fit one row on a phone: "In tas · €52,58". */
    add: string;
    /** Summary part in stack mode. */
    stack: string;
    /** Summary part with gift wrap. */
    giftWrap: string;
  };
  delivery: {
    /** Second line of the delivery card, next to the flag. */
    carrier: string;
    /** Instead of the delivery card when nothing of the piece is for sale (QA round 2: no dispatch promise). */
    soldOut: string;
    /** The link under it: to the piece's type collection ("Bekijk alle armbanden"), or all jewellery. */
    soldOutLink: (typeLabel: string | null) => string;
  };
  trust: {
    items: PdpTrustItem[];
    /** The gift card: secure payment and "Direct in je mail". */
    giftCardItems: PdpTrustItem[];
  };
  specs: {
    title: string;
    materiaal: string;
    afmeting: string;
    gewicht: string;
    sluiting: string;
    /** Term of the verified claims row; each value is claims.confirmed(label). */
    claims: string;
  };
  meter: {
    title: string;
    /** The tag next to the title: the meter is Linde's estimate, not a measurement. */
    indicative: string;
    start: string;
    end: string;
    /** role="img" name: "Statement-meter: 4 van 5, indicatief". */
    name: (value: number, max: number) => string;
    /** Accessible name of the meter heading, one string ("Statement-meter, indicatief"). */
    headingName: string;
    note: string;
  };
  chips: {
    /** Accessible name of the chip list. */
    label: string;
  };
  accordions: {
    details: {
      title: string;
      /** Term of the material row; with two colours one row per colour, named by the colour. */
      material: string;
      sku: string;
    };
    care: { title: string };
    guarantee: { title: string; text: string; link: PdpLink };
    shipping: { title: string; items: string[]; link: PdpLink };
    safety: {
      title: string;
      manufacturer: string;
      responsible: string;
      identification: string;
      /** "SPK-001-GOUD, SPK-001-ZILVER (lola-chunky-hoops)". */
      identificationValue: (codes: string, handle: string) => string;
      warnings: string;
      /** Gift card: the seller's details under pdp.gpsr.digital (decision 116). */
      seller: string;
    };
    giftCard: {
      how: { title: string; steps: [string, string, string] };
      terms: { title: string; items: string[]; link: PdpLink };
    };
  };
  look: {
    eyebrow: string;
    /** Verbatim from the brief (§6): "Maak de look af". */
    title: string;
    intro: string;
    /** Earrings and bracelets: the stack discount is one piece away. */
    stackIntro: string;
    link: PdpLink;
    listLabel: string;
    /** On the gift card page the block offers a piece to choose yourself instead. */
    giftCardTitle: string;
    giftCardIntro: string;
  };
  reviews: {
    title: string;
    listLabel: string;
    /** "Sanne, geverifieerde koper". */
    verifiedBuyer: string;
  };
  faq: {
    eyebrow: string;
    title: string;
    allLink: PdpLink;
    /** "Iets anders?" before the contact link. */
    other: string;
    contact: PdpLink;
  };
}

const nl = shipping.countries[shipping.defaultCountry];
const freeFrom = formatMoneyShort(nl.freeFrom);
const rate = formatMoney(nl.rate);
const stackPercent = `${stackDiscount.percent}%`;
const returnDays = site.returnDays;
const months = site.guarantee.months;
const [firstPayment = "", ...otherPayments] = site.paymentMethodsInText;
const otherPaymentList =
  otherPayments.length > 1
    ? `${otherPayments.slice(0, -1).join(", ")} en ${otherPayments[otherPayments.length - 1]}`
    : (otherPayments[0] ?? "");

const securePayment: PdpTrustItem = {
  id: "betalen",
  title: `Veilig betalen met ${firstPayment}`,
  text: otherPaymentList ? `Of met ${otherPaymentList}.` : "In onze beveiligde checkout.",
};

export const pdpCopy: PdpCopy = {
  claims: {
    confirmed: (label) => `${label} (bevestigd door de leverancier)`,
  },
  gpsr: {
    missing: "Deze gegevens vullen we nog aan. Heb je een vraag over dit product? Mail ons gerust.",
    digital: "Digitaal product van Sparkela, geen fysiek product.",
  },
  care: {
    default:
      "Doe je sieraden af bij zwemmen, sporten en douchen, en smeer bodylotion of make-up op voordat je ze omdoet. Bewaar ze droog in het zakje, los van elkaar, en veeg ze af met een zachte doek.",
  },
  stack: {
    option: (title, variantLabel, price) => `${title}${variantLabel ? `, ${variantLabel}` : ""} · ${price}`,
    legend: "Los of als stack",
    single: "Los",
    singleText: (title) => `Alleen ${title}`,
    stackTitle: `Stack van 3 (−${stackPercent})`,
    stackText: "Met twee andere oorbellen of armbanden",
    yourStack: "Jouw stack",
    intro: `Kies twee andere oorbellen of armbanden. Bij 3 stuks gaat er ${stackPercent} af in je tas.`,
    piece: (n) => `Stuk ${n}`,
    thisPiece: "dit stuk",
    lindesStack: (name) => `Lindes stack: ${name}`,
    resetToLinde: "Terug naar Lindes stack",
    resetToDefault: "Terug naar de standaardkeuze",
    piecesTotal: (amount) => `Los samen ${amount}`,
  },
  breadcrumbs: {
    giftCards: { label: "Cadeaukaarten", href: "/cadeaukaarten" },
  },
  sections: {
    buy: "Kopen",
    delivery: "Levering",
    trust: "Bestellen bij Sparkela",
    details: "Meer over dit stuk",
    detailsGiftCard: "Meer over de cadeaukaart",
  },
  gallery: {
    label: (title) => `Foto's van ${title}`,
    status: (n, total) => `Afbeelding ${n} van ${total}`,
    zoom: "Foto vergroten",
    zoomTitle: (title) => `${title}, vergroot`,
    zoomHint: "Sleep of knijp om rond te kijken.",
  },
  variant: {
    labels: { kleur: "Kleur", maat: "Maat", bedrag: "Bedrag", overig: "Uitvoering" },
    soldOut: "uitverkocht",
    lowStock: (count) => `Nog ${count}`,
    sizeGuide: "Welke maat heb ik?",
    chooseSize: "Kies eerst je maat.",
    giftCardNote: "Jij kiest het bedrag, de ander kiest zelf een spark.",
  },
  sizeGuide: {
    title: "Ringmaatgids",
    intro: "De maat van een ring is de binnendiameter in millimeters. Zo vind je die van jou.",
    caption: "Ringmaten met binnendiameter en omtrek",
    columns: { size: "Maat", diameter: "Binnendiameter", circumference: "Omtrek" },
    millimetres: (value) => `${value} mm`,
    measureTitle: "Meten met een touwtje",
    steps: [
      "Leg een touwtje of een strookje papier om je vinger, op de plek waar de ring komt.",
      "Zet een streepje waar de uiteinden elkaar raken. Niet te strak: de ring moet over je knokkel.",
      "Leg het touwtje langs een liniaal en meet tot het streepje. Dat is je omtrek.",
      "Zoek in de tabel de omtrek die het dichtst in de buurt komt. Daar staat je maat.",
    ],
    ringTitle: "Heb je al een ring die past?",
    ringText: "Meet de binnenkant van rand tot rand, recht door het midden. Dat is je binnendiameter.",
    tip: "Zit je tussen twee maten in? Kies dan de grotere.",
  },
  giftWrap: {
    label: "Cadeauverpakking",
    description: "Feestelijk ingepakt, klaar om te geven. Je ziet het vinkje terug in je tas.",
    alreadyOn: "Staat al aan voor je bestelling. Eén verpakking per bestelling.",
  },
  addToCart: {
    label: "In je tas",
    stack: "Voeg de stack toe",
    separator: "·",
    adding: "Bezig met toevoegen",
    soldOut: "Uitverkocht",
    variantSoldOut: (variant) => `${variant} is uitverkocht. Kies een andere uitvoering.`,
    errors: {
      notYetAvailable: "Dit stuk kun je nog niet bestellen. Kijk snel nog eens.",
      unavailable: "Dit stuk is net uitverkocht. Kies een andere uitvoering of kijk bij de rest.",
      quantityCapped: "Meer hebben we er nu niet. De rest staat in je tas.",
      generic: "Dat lukte niet. Probeer het opnieuw.",
    },
  },
  stickyBar: {
    label: "Snel in je tas",
    add: "In tas",
    stack: "Stack van 3",
    giftWrap: "Met cadeauverpakking",
  },
  delivery: {
    carrier: `Verstuurd met ${shipping.carrier} vanuit ${nl.label}`,
    soldOut: "Deze is nu op. Misschien vind je een andere spark die je net zo mooi vindt.",
    soldOutLink: (typeLabel) => (typeLabel ? `Bekijk alle ${typeLabel.toLowerCase()}` : "Bekijk alle sieraden"),
  },
  trust: {
    items: [
      securePayment,
      {
        id: "verzending",
        title: `Gratis verzending vanaf ${freeFrom}`,
        text: `Daaronder betaal je ${rate}. ${shipping.carrier} bezorgt in je brievenbus.`,
      },
      {
        id: "garantie",
        title: `${months} maanden garantie`,
        text: `Verkleurd binnen ${months} maanden? Dan sturen we je een nieuwe.`,
      },
      {
        id: "bedenktijd",
        title: `${returnDays} dagen bedenktijd`,
        text: "Toch niet jouw spark? Laat het ons binnen die tijd weten.",
        link: { label: "Zo werkt retourneren", href: "/verzenden-en-retourneren" },
      },
    ],
    giftCardItems: [
      securePayment,
      {
        id: "mail",
        title: "Direct in je mail",
        text: "Na het afrekenen staat de cadeaukaart in je inbox. Geen verzendkosten.",
      },
    ],
  },
  specs: {
    title: "Specificaties",
    materiaal: "Materiaal",
    afmeting: "Afmeting",
    gewicht: "Gewicht",
    sluiting: "Sluiting",
    claims: "Bevestigd",
  },
  meter: {
    title: "Statement-meter",
    indicative: "Indicatief",
    start: "Subtiel",
    end: "Chunky",
    name: (value, max) => `Statement-meter: ${value} van ${max}, indicatief`,
    headingName: "Statement-meter, indicatief",
    note: "Lindes eigen inschatting, vergeleken met de rest van de collectie. Geen meting: hoe groot iets oogt, hangt ook af van je outfit.",
  },
  chips: {
    label: "Shop verder in",
  },
  accordions: {
    details: {
      title: "Details en materiaal",
      material: "Materiaal",
      sku: "Artikelnummer",
    },
    care: { title: "Verzorging" },
    guarantee: {
      title: "Garantie",
      text: `Op elk sieraad krijg je ${months} maanden garantie op verkleuring. Is je sieraad in die tijd toch verkleurd? Wat balen! Mail ons een foto en je bestelnummer, dan sturen we je een nieuwe.`,
      link: { label: "Neem contact op", href: "/contact" },
    },
    shipping: {
      title: "Verzenden en retourneren",
      items: [
        `Op werkdagen vóór ${shipping.cutoff.label} besteld, dezelfde dag verstuurd met ${shipping.carrier}.`,
        `Verzenden kost ${rate}. Vanaf ${freeFrom} verzenden we gratis.`,
        `Je hebt ${returnDays} dagen bedenktijd. Bedenk je je, laat het ons dan binnen die tijd weten. Daarna heb je nog ${returnDays} dagen om het terug te sturen.`,
      ],
      link: { label: "Alles over verzenden en retourneren", href: "/verzenden-en-retourneren" },
    },
    safety: {
      title: "Productveiligheid",
      manufacturer: "Fabrikant",
      responsible: "Verantwoordelijke in de EU",
      identification: "Productidentificatie",
      identificationValue: (codes, handle) => `${codes} (${handle})`,
      warnings: "Waarschuwingen",
      seller: "Verkoper",
    },
    giftCard: {
      how: {
        title: "Zo werkt het",
        steps: [
          "Kies een bedrag en reken af.",
          "De cadeaukaart komt direct in je mail, als code.",
          "Stuur hem door of print hem uit. De ander kiest zelf een spark.",
        ],
      },
      terms: {
        title: "Voorwaarden",
        items: [
          "Een digitale cadeaukaart krijg je per e-mail. Je betaalt geen verzendkosten.",
          "Te besteden in de webshop van Sparkela. Wat je niet in één keer gebruikt, blijft op de kaart staan.",
          `Cadeaukaarten tellen niet mee voor gratis verzending of de stack-korting van ${stackPercent}.`,
        ],
        link: { label: "Lees de algemene voorwaarden", href: "/algemene-voorwaarden" },
      },
    },
  },
  look: {
    eyebrow: "Stylen",
    title: "Maak de look af",
    intro: "Stukken die Linde hier graag bij draagt.",
    stackIntro: `Stukken die Linde hier graag bij draagt. Met 3 oorbellen of armbanden krijg je ${stackPercent} stack-korting.`,
    link: { label: "Bekijk Lindes stacks", href: "/stacks" },
    listLabel: "Producten die hierbij passen",
    giftCardTitle: "Of kies zelf een spark",
    giftCardIntro: "Lindes favorieten, klaar om in te pakken.",
  },
  reviews: {
    title: "Reviews",
    listLabel: "Reviews van dit stuk",
    verifiedBuyer: "geverifieerde koper",
  },
  faq: {
    eyebrow: "Vragen",
    title: "Goed om te weten",
    allLink: { label: "Alle vragen", href: "/veelgestelde-vragen" },
    other: "Iets anders?",
    contact: { label: "Neem contact op", href: "/contact" },
  },
};
