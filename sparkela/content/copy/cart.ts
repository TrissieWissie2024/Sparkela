/**
 * Cart copy (docs/PLAN.md §5.1, §13.7): drawer, lines, totals, gift wrap, gift message, upsell, notices, errors,
 * empty state, campaign line and quick add. Created in wave 3a with the texts the plan already names; C3 owns this
 * file in wave 4-6 and adds the rest (type and value together). Progress texts live in sharedCopy.progress and
 * cart announcements in sharedCopy.announce.
 */
export interface CartCopy {
  /** Title of the cart drawer (the e2e locator looks for the dialog "Je tas"). */
  title: string;
  checkout: string;
  /** During a campaign window, instead of a product in the cart (brief §4, plan §12.2). */
  campaignNote: string;
  line: {
    /** A discount on a line is its own row, never a struck price (decision 117): "Stack-korting −€2,24". */
    discount: (label: string, amount: string) => string;
    remove: string;
  };
  discount: {
    notApplicable: string;
  };
  errors: {
    network: string;
    upstream: string;
  };
}

export const cartCopy: CartCopy = {
  title: "Je tas",
  checkout: "Afrekenen",
  campaignNote: "Bij deze bestelling zit een cadeautje van ons.",
  line: {
    discount: (label, amount) => `${label} ${amount}`,
    remove: "Verwijderen",
  },
  discount: {
    notApplicable: "Deze code werkt niet voor wat er nu in je tas zit.",
  },
  errors: {
    network: "Geen verbinding. Check je internet en probeer het opnieuw.",
    upstream: "Je tas bijwerken lukt nu even niet. Probeer het opnieuw.",
  },
};
