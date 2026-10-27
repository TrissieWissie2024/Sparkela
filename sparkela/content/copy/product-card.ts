/**
 * Product card and grid copy (docs/PLAN.md §5.1, §13.8): grid labels and card aria. Sort labels live in
 * sharedCopy.vocab.sort, badge texts in sharedCopy.badges, prices in sharedCopy.price. Created in wave 3a as a
 * skeleton; C4 owns this file in wave 4-6 and adds the rest (type and value together).
 */
export interface CardCopy {
  grid: {
    /** Accessible name of a product list. */
    label: string;
    empty: string;
  };
  card: {
    /** Accessible name of the stretched link on a card. */
    open: (title: string) => string;
  };
}

export const cardCopy: CardCopy = {
  grid: {
    label: "Producten",
    empty: "Hier staan nog geen sieraden.",
  },
  card: {
    open: (title) => `Bekijk ${title}`,
  },
};
