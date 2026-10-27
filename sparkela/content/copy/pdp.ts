/**
 * Product page copy (docs/PLAN.md §5.1, §13.9): buy column, variants, ring size guide, stack picker, trust row,
 * specs, claims, accordions, GPSR and care. Created in wave 3a with the keys the plan already fixes; B4 owns
 * care.default in 3b and D2 adds the rest of the product page in 7-9 (type and value together, in this file).
 */
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
  };
}

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
  },
};
