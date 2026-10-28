import { EARLY_ACCESS_HOURS } from "@/content/drops";
import { stackDiscount, welcomeCode } from "@/content/offers";

/**
 * Collection copy (docs/PLAN.md §5.1, §13.8, §13.12, §14.3, §14.6 to §14.10): the collection page (banner, filters,
 * count, empty states, styling tile), the search page, the drop pages, the stacks page and the gift card page. Facet
 * labels come from sharedCopy.vocab (decision 125), generic labels from sharedCopy.ui. Created in wave 3a with the
 * texts the plan already named; D3 owns this file in wave 7-9 (type and value together).
 *
 * Amounts, percentages and times are never typed again: the stack discount comes from content/offers.ts, the early
 * access hours from content/drops.ts, prices and dates arrive as formatted strings (lib/money.ts, lib/dates.ts).
 */

/** A link with its visible label. */
export interface CopyLink {
  label: string;
  href: string;
}

export interface CollectionCopy {
  /** Eyebrow of the collection banner. */
  eyebrow: string;
  filters: {
    /** Title of the filter sheet (phones and tablets). */
    title: string;
    /** Accessible name of the filter area. */
    label: string;
    /** The button that opens the sheet: "Filters", or "Filters (2)" with active filters. */
    open: (activeCount: number) => string;
    /** From lg, the button that opens the sheet for the facets beside the chip row: "Meer filters (1)". */
    more: (activeCount: number) => string;
    clear: string;
    /** The sheet's reset button. */
    clearAll: string;
    /** The sheet's close button: "Toon 12 sieraden". */
    show: (n: number) => string;
    /** Accessible name of the row of active filters under the bar (phones and tablets). */
    activeLabel: string;
    groups: { type: string; vibe: string; moment: string; price: string };
  };
  /** Live region with the number of products (plan §18.3 point 14). */
  count: (n: number) => string;
  /** Filters leave nothing. */
  empty: { title: string; text: string };
  /** A collection without listable products (no filter involved). */
  emptyCollection: { title: string; text: string; cta: CopyLink };
  /** The collection "limited" while no drop is publicly live. */
  emptyLimited: { title: string; text: string; cta: CopyLink };
  stylingTile: { eyebrow: string };
  search: {
    title: string;
    intro: string;
    metaDescription: string;
    label: string;
    placeholder: string;
    submit: string;
    clear: string;
    /** Heading above the results. */
    resultsTitle: (query: string) => string;
    resultsLabel: string;
    count: (n: number) => string;
    none: (query: string) => string;
    noneHint: string;
    /** No jewellery, but a page matches (QA round 2): heading and the line above the page links. */
    noneProducts: (query: string) => string;
    noneProductsHint: string;
    /** Live region when only pages match. */
    pagesCount: (n: number) => string;
    suggestionsTitle: string;
    suggestionsLabel: string;
    /** Pages next to the collections (what the product search cannot find: gift cards, stacks, the finder). */
    suggestionPages: Array<{ label: string; href: string }>;
    /** The tile that closes the result grid. */
    more: { title: string; text: string; links: Array<{ label: string; href: string }> };
  };
  stacks: {
    title: string;
    intro: string;
    metaDescription: string;
    /** H2 above the grid of stacks. */
    listTitle: string;
    listIntro: string;
    /** No stack can be shown right now. */
    empty: string;
    add: string;
    adding: string;
    added: string;
    /** Accessible name of the button; starts with its visible text (WCAG 2.5.3). */
    addLabel: (stackName: string) => string;
    addedLabel: (stackName: string) => string;
    /** Select label per piece with more than one variant: "Kleur van Noor dikke ringetjes". */
    variantLabel: (title: string) => string;
    /** Why the button is unavailable. */
    soldOut: (title: string) => string;
    piecesLabel: string;
    totalLabel: string;
    /** After the stack price: "in plaats van €59,85". Plain text, never a struck-through price (brief §2.5). */
    insteadOf: (subtotal: string) => string;
    finder: { title: string; text: string; cta: CopyLink };
    faqTitle: string;
  };
  giftCards: {
    title: string;
    intro: string;
    metaDescription: string;
    chooseTitle: string;
    /** Name of one amount tile: "Cadeaukaart van €25". */
    tileTitle: (amount: string) => string;
    tileText: string;
    add: string;
    adding: string;
    added: string;
    addLabel: (amount: string) => string;
    addedLabel: (amount: string) => string;
    soldOut: string;
    soldOutLabel: (amount: string) => string;
    /** No gift card in the catalog (yet). */
    unavailable: string;
    howTitle: string;
    how: Array<{ title: string; text: string }>;
    productLink: CopyLink;
    faqTitle: string;
    crossTitle: string;
    crossIntro: string;
  };
  drop: {
    /** Eyebrow of the drop hero. */
    eyebrow: string;
    /** Visible word before the running countdown to the start ("Over 2d 5u"). */
    startsIn: string;
    /** Visible word before the running countdown to the end ("Nog 34d 11u"). */
    endsIn: string;
    /** After the start: "Loopt t/m 31 december" (endLabel = formatEndLabel(endsAt)). */
    runsUntil: (endLabel: string) => string;
    /** EarlyAccessNote (plan §12.5); startLabel = formatStartLabel(startsAt). */
    earlyAccess: (startLabel: string) => string;
    ended: string;
    endedText: string;
    productsTitle: string;
    gridLabel: (dropName: string) => string;
    /** A drop without products yet; startLabel = formatStartLabel(startsAt). */
    empty: (startLabel: string) => string;
    stackTitle: string;
    stackIntro: string;
    /** The hero's button to the product grid. */
    viewPieces: string;
  };
  teaser: {
    eyebrow: string;
    /** "Live op vrijdag 5 februari om 19.00 uur". */
    startsOn: (startLabel: string) => string;
    formTitle: string;
    formText: string;
    metaDescription: (dropName: string) => string;
  };
}

const clubLink: CopyLink = { label: "Naar de Sparkela Club", href: "/sparkela-club" };

export const collectionCopy: CollectionCopy = {
  eyebrow: "Collectie",
  filters: {
    title: "Filteren",
    label: "Filters en sortering",
    open: (activeCount) => (activeCount > 0 ? `Filters (${activeCount})` : "Filters"),
    more: (activeCount) => (activeCount > 0 ? `Meer filters (${activeCount})` : "Meer filters"),
    clear: "Wis filters",
    clearAll: "Wis alles",
    show: (n) => (n === 1 ? "Toon 1 sieraad" : `Toon ${n} sieraden`),
    activeLabel: "Gekozen filters",
    groups: { type: "Soort", vibe: "Vibe", moment: "Moment", price: "Prijs" },
  },
  count: (n) => (n === 1 ? "1 sieraad" : `${n} sieraden`),
  empty: {
    title: "Geen sieraden gevonden",
    text: "Probeer een ander filter, of bekijk alle sieraden.",
  },
  emptyCollection: {
    title: "Hier staat nu even niets",
    text: "Kijk snel nog eens. Tot die tijd vind je genoeg spark in de rest van de shop.",
    cta: { label: "Bekijk alle sieraden", href: "/collections/alle" },
  },
  emptyLimited: {
    title: "Er is nu geen drop live",
    text: `In de Sparkela Club hoor je als eerste wanneer de volgende drop komt. Leden zijn er ${EARLY_ACCESS_HOURS} uur eerder bij.`,
    cta: clubLink,
  },
  stylingTile: { eyebrow: "Stylingtip" },
  search: {
    title: "Zoeken",
    intro: "Zoek op naam, soort, vibe of moment.",
    metaDescription: "Zoek in alle sieraden van Sparkela.",
    label: "Zoek in de shop",
    placeholder: "Bijvoorbeeld hoops of festival",
    submit: "Zoeken",
    clear: "Zoekveld leegmaken",
    resultsTitle: (query) => `Resultaten voor “${query}”`,
    resultsLabel: "Zoekresultaten",
    count: (n) => (n === 1 ? "1 resultaat" : `${n} resultaten`),
    none: (query) => `Niets gevonden voor “${query}”`,
    noneHint: "Check de spelling of probeer een ander woord. Of begin hieronder.",
    noneProducts: (query) => `Geen sieraden voor “${query}”`,
    noneProductsHint: "Misschien zoek je een van deze pagina's.",
    pagesCount: (n) => (n === 1 ? "1 pagina gevonden" : `${n} pagina's gevonden`),
    suggestionsTitle: "Waar wil je beginnen?",
    suggestionsLabel: "Collecties en pagina's",
    more: {
      title: "Niet gevonden wat je zocht?",
      text: "Laat de Spark Finder kiezen, of kijk alles rustig door.",
      links: [
        { label: "Naar de Spark Finder", href: "/spark-finder" },
        { label: "Alle sieraden", href: "/collections/alle" },
      ],
    },
    suggestionPages: [
      { label: "Cadeaukaarten", href: "/cadeaukaarten" },
      { label: "Stacks", href: "/stacks" },
      { label: "Spark Finder", href: "/spark-finder" },
    ],
  },
  stacks: {
    title: "Stacks van Linde",
    intro: `Drie stuks die Linde samen draagt, met één knop in je tas. De ${stackDiscount.percent}% stack-korting gaat er vanzelf af.`,
    metaDescription: `Kant-en-klare stacks van drie oorbellen en armbanden, gekozen door Linde. Met ${stackDiscount.percent}% stack-korting.`,
    listTitle: "Kies je stack",
    listIntro: "Liever een ander stuk erbij? Elke combinatie van drie oorbellen of armbanden krijgt dezelfde korting.",
    empty: "Er staan nu even geen stacks klaar. Kijk snel weer.",
    add: "Voeg de stack toe",
    adding: "Bezig met toevoegen",
    added: "Toegevoegd",
    addLabel: (stackName) => `Voeg de stack toe: ${stackName}`,
    addedLabel: (stackName) => `Toegevoegd: ${stackName}`,
    variantLabel: (title) => `Kleur van ${title}`,
    soldOut: (title) => `${title} is nu uitverkocht. Deze stack kan daarom even niet in je tas.`,
    piecesLabel: "In deze stack",
    totalLabel: "Samen",
    insteadOf: (subtotal) => `in plaats van ${subtotal}`,
    finder: {
      title: "Liever je eigen stack?",
      text: "Doe de Spark Finder. Drie vragen, en je ziet welke stukken bij jouw vibe passen.",
      cta: { label: "Naar de Spark Finder", href: "/spark-finder" },
    },
    faqTitle: "Goed om te weten",
  },
  giftCards: {
    title: "Cadeaukaarten",
    intro: "Twijfel je wat je moet geven? Met een cadeaukaart kiest de ander zelf een spark.",
    metaDescription: "Geef een digitale cadeaukaart van Sparkela: direct in je mail, zonder verzendkosten.",
    chooseTitle: "Kies een bedrag",
    tileTitle: (amount) => `Cadeaukaart van ${amount}`,
    tileText: "Digitaal, direct in je mail",
    add: "In tas",
    adding: "Bezig met toevoegen",
    added: "Toegevoegd",
    addLabel: (amount) => `In tas: cadeaukaart van ${amount}`,
    addedLabel: (amount) => `Toegevoegd: cadeaukaart van ${amount}`,
    soldOut: "Uitverkocht",
    soldOutLabel: (amount) => `Cadeaukaart van ${amount} is uitverkocht`,
    unavailable: "De cadeaukaarten zijn er zo weer. Kijk snel nog eens.",
    howTitle: "Zo werkt het",
    how: [
      { title: "Digitaal", text: "Geen kaartje dat kwijt kan raken: de cadeaukaart is een code." },
      { title: "Direct in je mail", text: "Na het afrekenen staat hij in je inbox. Doorsturen kan meteen." },
      { title: "Geen verzendkosten", text: "Er gaat niets met de post, dus je betaalt alleen het bedrag." },
    ],
    productLink: { label: "Meer over de cadeaukaart", href: "/products/cadeaukaart" },
    faqTitle: "Goed om te weten",
    crossTitle: "Liever zelf iets uitkiezen?",
    crossIntro: "Kleine cadeaus en kant-en-klare stacks, klaar om in te pakken.",
  },
  drop: {
    eyebrow: "Drop",
    startsIn: "Over ",
    endsIn: "Nog ",
    runsUntil: (endLabel) => `Loopt ${endLabel}`,
    earlyAccess: (startLabel) => `Jij bent er ${EARLY_ACCESS_HOURS} uur eerder bij. Publiek live op ${startLabel}.`,
    ended: "Deze drop is voorbij",
    endedText: `In de Club hoor je als eerste van de volgende drop. Plus ${welcomeCode.percent}% op je eerste bestelling.`,
    productsTitle: "De drop",
    gridLabel: (dropName) => `Stukken uit ${dropName}`,
    empty: (startLabel) => `De stukken zie je hier vanaf ${startLabel}.`,
    stackTitle: "Stack de drop",
    stackIntro: "Drie stukken uit de drop die Linde samen draagt.",
    viewPieces: "Bekijk de stukken",
  },
  teaser: {
    eyebrow: "Binnenkort",
    startsOn: (startLabel) => `Live op ${startLabel}`,
    formTitle: `Shop ${EARLY_ACCESS_HOURS} uur eerder`,
    formText: `Word lid van de Sparkela Club. Je krijgt bij elke drop een eigen link, plus ${welcomeCode.percent}% op je eerste bestelling.`,
    metaDescription: (dropName) => `${dropName} komt eraan. Club-leden zijn er ${EARLY_ACCESS_HOURS} uur eerder bij.`,
  },
};
