import { EARLY_ACCESS_HOURS } from "@/content/drops";

/**
 * Collection copy (docs/PLAN.md §5.1, §13.12, §14.3, §14.6 to §14.10): filters, count, empty state, search page,
 * drop, stacks and gift card pages. Facet labels come from sharedCopy.vocab. Created in wave 3a with the texts the
 * plan already names; D3 owns this file in wave 7-9 and adds the rest (type and value together).
 */
export interface CollectionCopy {
  filters: {
    title: string;
    clear: string;
    groups: { type: string; vibe: string; moment: string; price: string };
  };
  /** Live region with the number of products (plan §18.3 point 14). */
  count: (n: number) => string;
  empty: { title: string; text: string };
  search: { title: string; label: string };
  stacks: {
    title: string;
    add: string;
    /** Select label per piece with more than one variant: "Kleur van Noor dikke ringetjes". */
    variantLabel: (title: string) => string;
  };
  giftCards: { title: string; intro: string; add: string };
  drop: {
    /** EarlyAccessNote (plan §12.5); startLabel = formatStartLabel(startsAt). */
    earlyAccess: (startLabel: string) => string;
    ended: string;
  };
}

export const collectionCopy: CollectionCopy = {
  filters: {
    title: "Filteren",
    clear: "Wis filters",
    groups: { type: "Soort", vibe: "Vibe", moment: "Moment", price: "Prijs" },
  },
  count: (n) => (n === 1 ? "1 sieraad" : `${n} sieraden`),
  empty: {
    title: "Geen sieraden gevonden",
    text: "Probeer een ander filter, of bekijk alle sieraden.",
  },
  search: { title: "Zoeken", label: "Zoek in de shop" },
  stacks: {
    title: "Stacks van Linde",
    add: "Voeg de stack toe",
    variantLabel: (title) => `Kleur van ${title}`,
  },
  giftCards: {
    title: "Cadeaukaarten",
    intro: "Digitaal, direct in je mail, geen verzendkosten",
    add: "In tas",
  },
  drop: {
    earlyAccess: (startLabel) => `Jij bent er ${EARLY_ACCESS_HOURS} uur eerder bij. Publiek live op ${startLabel}.`,
    ended: "Deze drop is voorbij",
  },
};
