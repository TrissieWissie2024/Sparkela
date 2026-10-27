import type { JewelryType, Moment, PriceBucket, Vibe } from "@/lib/types";
import { collectionCopy } from "@/content/copy/collection";
import { sharedCopy } from "@/content/copy/shared";

import type { FacetKey } from "./filterParams";

/**
 * Visible labels of the filter facets (decision 125: one vocabulary). Group names from collectionCopy.filters.groups
 * ("Soort", "Vibe", "Moment", "Prijs"), values from sharedCopy.vocab, the same words as the card's vibe chip, the
 * product page chips, the navigation and the Spark Finder.
 */

export const FACET_GROUP_LABELS: Record<FacetKey, string> = {
  types: collectionCopy.filters.groups.type,
  vibes: collectionCopy.filters.groups.vibe,
  moments: collectionCopy.filters.groups.moment,
  price: collectionCopy.filters.groups.price,
};

/** The label of one facet value; the value itself when it is unknown (never happens with parsed state). */
export function facetValueLabel(key: FacetKey, value: string): string {
  const { vocab } = sharedCopy;
  switch (key) {
    case "types":
      return vocab.type[value as JewelryType] ?? value;
    case "vibes":
      return vocab.vibe[value as Vibe] ?? value;
    case "moments":
      return vocab.moment[value as Moment] ?? value;
    case "price":
      return vocab.price[value as PriceBucket] ?? value;
  }
}
