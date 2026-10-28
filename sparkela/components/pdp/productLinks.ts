import type { CatalogProduct, Crumb, FaqItem, JewelryType, Moment, Product, Stack, Vibe } from "@/lib/types";
import { isJewelryType } from "@/lib/catalog";
import { collectionPath } from "@/lib/paths";
import { collections } from "@/content/collections";
import { pdpCopy } from "@/content/copy/pdp";
import { sharedCopy } from "@/content/copy/shared";
import { stacks as allStacks } from "@/content/stacks";
import { FILTER_PARAMS } from "@/components/collection/filterParams";

/**
 * Pure helpers of the product page (docs/PLAN.md §13.9, §14.2): the breadcrumb trail, the chips for type, vibe and
 * moment, the product FAQ and the name of Linde's stack. No React and no next/* imports; tested in pdpModel.test.ts.
 */

/* -------------------------------------------------------------------------- */
/* Breadcrumbs                                                                 */
/* -------------------------------------------------------------------------- */

/** The collection of a jewellery type ("/collections/oorbellen"), or null when content/collections.ts has none. */
function typeCollection(type: JewelryType) {
  return collections.find((collection) => collection.rule.kind === "type" && collection.rule.type === type) ?? null;
}

/**
 * Home › {collection of the type} › {product} (plan §14.2 step 1). The gift card goes through /cadeaukaarten; a
 * product without a type collection gets Home › {product}. The last crumb has no href (the current page).
 */
export function productTrail(product: Pick<Product, "title" | "type" | "isGiftCard">): Crumb[] {
  const home: Crumb = { label: sharedCopy.ui.home, href: "/" };
  const current: Crumb = { label: product.title };
  if (product.isGiftCard) return [home, { ...pdpCopy.breadcrumbs.giftCards }, current];
  const collection = isJewelryType(product.type ?? "") ? typeCollection(product.type as JewelryType) : null;
  if (!collection) return [home, current];
  return [home, { label: collection.title, href: collectionPath(collection.handle) }, current];
}

/* -------------------------------------------------------------------------- */
/* Chips                                                                       */
/* -------------------------------------------------------------------------- */

export interface ProductChipLink {
  id: string;
  label: string;
  href: string;
}

/** The collection for a vibe or a moment, else the filter on "alle" (D3's URL format: ?vibe=retro). */
function facetHref(kind: "vibe" | "moment", value: Vibe | Moment): string {
  const match = collections.find((collection) =>
    kind === "vibe"
      ? collection.rule.kind === "vibe" && collection.rule.vibe === value
      : collection.rule.kind === "moment" && collection.rule.moment === value,
  );
  if (match) return collectionPath(match.handle);
  const param = kind === "vibe" ? FILTER_PARAMS.vibes : FILTER_PARAMS.moments;
  return `${collectionPath("alle")}?${param}=${encodeURIComponent(value)}`;
}

/**
 * Chips for type, vibe(s) and moment(s) (plan §13.9 ProductChips, brief §6), labelled with sharedCopy.vocab (one
 * vocabulary, decision 125): the type links to its collection, a vibe or moment to its collection when there is one
 * ("Clean en classy" → /collections/subtiel, "Festival" → /collections/festival), else to /collections/alle with that
 * filter set.
 */
export function productChipLinks(product: Pick<Product, "type" | "tags">): ProductChipLink[] {
  const links: ProductChipLink[] = [];
  const type = product.type;
  if (type && isJewelryType(type)) {
    const collection = typeCollection(type);
    links.push({
      id: `type-${type}`,
      label: sharedCopy.vocab.type[type],
      href: collection ? collectionPath(collection.handle) : `${collectionPath("alle")}?${FILTER_PARAMS.types}=${type}`,
    });
  }
  for (const vibe of product.tags.vibes) {
    links.push({ id: `vibe-${vibe}`, label: sharedCopy.vocab.vibe[vibe], href: facetHref("vibe", vibe) });
  }
  for (const moment of product.tags.moments) {
    links.push({ id: `moment-${moment}`, label: sharedCopy.vocab.moment[moment], href: facetHref("moment", moment) });
  }
  return links;
}

/* -------------------------------------------------------------------------- */
/* FAQ                                                                         */
/* -------------------------------------------------------------------------- */

/** FAQ items that fit the gift card (the onProduct questions are about jewellery and shipping). */
const GIFT_CARD_FAQ_IDS = ["cadeaukaart-gebruiken", "betalen", "welkomstcode"] as const;

/** The questions under a product (plan §14.2 step 5): the `onProduct` items; for the gift card its own short list. */
export function productFaqItems(product: Pick<Product, "isGiftCard">, items: readonly FaqItem[]): FaqItem[] {
  if (product.isGiftCard) {
    return GIFT_CARD_FAQ_IDS.map((id) => items.find((item) => item.id === id)).filter((item): item is FaqItem => !!item);
  }
  return items.filter((item) => item.onProduct);
}

/* -------------------------------------------------------------------------- */
/* Linde's stack                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The name of Linde's stack behind the stack picker's default picks (decision 129), for "Lindes stack: Goud en
 * gedurfd": a stack with this product whose other two pieces are the products of `defaultPicks` (variant ids, looked up
 * in the candidates). The visible stacks are tried first, then every stack in content/stacks.ts (so a drop's stack is
 * named during early access too). null when the picks are the fallback of §7.2 (the piece is in no stack).
 */
export function defaultStackName(
  handle: string,
  defaultPicks: readonly [string, string] | null,
  candidates: readonly Pick<CatalogProduct, "handle" | "variants">[],
  visible: ReadonlyArray<{ stack: Stack }> = [],
  all: readonly Stack[] = allStacks,
): string | null {
  if (!defaultPicks) return null;
  const handleOf = (variantId: string) =>
    candidates.find((candidate) => candidate.variants.some((variant) => variant.id === variantId))?.handle ?? null;
  const pickHandles = defaultPicks.map(handleOf);
  if (pickHandles.some((pick) => pick === null)) return null;
  const matches = (stack: Stack) => {
    if (!stack.productHandles.includes(handle)) return false;
    const others = stack.productHandles.filter((other) => other !== handle);
    return others.length === 2 && pickHandles.every((pick) => pick !== null && others.includes(pick));
  };
  return (visible.map((entry) => entry.stack).find(matches) ?? all.find(matches))?.name ?? null;
}
