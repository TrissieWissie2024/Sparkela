import { applyCollectionRule } from "@/lib/catalog";
import type { Collection, CollectionDefinition, Drop, Product } from "@/lib/types";
import { collections as allCollections } from "@/content/collections";
import { drops as allDrops } from "@/content/drops";

/**
 * Collections from rules (docs/PLAN.md §2.3, §7.2, decisions 26 and 84). Membership follows the product tags, the
 * same for both providers, so lib/commerce/index.ts implements getCollection() once on top of this module. Pure:
 * no server-only and no next/* imports; `now` comes in as an argument.
 */

/** The definition in content/collections.ts with this handle, or null (unknown handle → 404 pattern). */
export function findCollectionDefinition(
  handle: string,
  definitions: readonly CollectionDefinition[] = allCollections,
): CollectionDefinition | null {
  return definitions.find((definition) => definition.handle === handle) ?? null;
}

/**
 * A collection at `now`: the definition plus the listable products that match its rule, in the order of `products`
 * (getProducts() is sorted by featuredRank). A drop product only counts while its drop is publicly live.
 */
export function buildCollection(
  definition: CollectionDefinition,
  products: Product[],
  now: number,
  drops: Drop[] = allDrops,
): Collection {
  return { ...definition, products: applyCollectionRule(products, definition.rule, now, drops) };
}
