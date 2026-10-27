/**
 * Product card and grid copy (docs/PLAN.md §5.1, §13.8): grid labels, card aria and the sort control. Sort option
 * labels live in sharedCopy.vocab.sort, vibe labels in sharedCopy.vocab.vibe, badge texts in sharedCopy.badges and
 * prices in sharedCopy.price; quick add has its own copy in cartCopy.quickAdd (C3). Wave 3a wrote the skeleton,
 * C4 owns this file in wave 4-6 (type and value together).
 */
export interface CardCopy {
  grid: {
    /** Default accessible name of a product list (ProductGrid's `label`). */
    label: string;
    /** ProductGrid without products. Pages with their own empty state (filters, search, drops) check first. */
    empty: string;
  };
  card: {
    /** Screen reader text of the vibe chip on the photo: "Vibe: Chunky en bold". */
    vibe: (label: string) => string;
  };
  sort: {
    /** Visible label of SortSelect ("Sorteren [Uitgelicht]"). */
    label: string;
  };
}

export const cardCopy: CardCopy = {
  grid: {
    label: "Producten",
    empty: "Hier staan nog geen sieraden.",
  },
  card: {
    vibe: (label) => `Vibe: ${label}`,
  },
  sort: {
    label: "Sorteren",
  },
};
