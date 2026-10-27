import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import {
  availableFacets,
  badgeContextAt,
  defaultVariant,
  isStackEligible,
  preStartDropOf,
  sortProducts,
  toCatalogProduct,
} from "@/lib/catalog";
import { clockLife, serverNow } from "@/lib/clock";
import { getCollection, getProduct, getProducts } from "@/lib/commerce";
import { buildShipSchedule, getDropPhase, toMs, type ShipLabelEntry } from "@/lib/dates";
import type { BadgeId, CatalogProduct, Drop, DropPhase, DropSlug, Product, ShopCollection, Stack } from "@/lib/types";
import { drops } from "@/content/drops";
import { giftWrap } from "@/content/offers";
import { stacks } from "@/content/stacks";

/**
 * The only place pages and server components get product data (docs/PLAN.md §7.2, §7.3, decisions 106 and 107).
 * Server-only. Every function is 'use cache' and reads the time inside its cached scope with serverNow(); the
 * entries carry the tags "catalog", "products" and "klok" and cacheLife(clockLife(now)), so lists follow drop
 * starts and other time boundaries within about a minute (§10.2, layer 2). getShopCollection and
 * getCatalogProducts are also tagged "collections". Arguments are bounded keys only (handle, slug, limit), never
 * `now`, which would become part of the cache key.
 *
 * Only this module turns Products into CatalogProducts (toCatalogProduct with badgeContextAt(serverNow())); every
 * list for cards is CatalogProduct[] with `badges` and `listable`. What gives access (prelaunch, early access) is
 * the proxy's job (layer 1); what visibly switches at a boundary is the browser's (layer 3).
 */

/** Sentinel handle for generateStaticParams when the catalog is empty (never []); getShopProduct gives null → 404. */
export const NO_PRODUCTS_HANDLE = "__geen-producten__";

/** getFeaturedDrop(): an upcoming drop is prerendered (hidden) this many days before its public start (§12.4). */
export const FEATURED_DROP_WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reads the server clock inside the caller's cached scope and sets the clock-dependent cache settings. Must be
 * called first in every 'use cache' function below.
 */
function clockScope(...extraTags: string[]): number {
  const now = serverNow();
  cacheTag("catalog", "products", "klok", ...extraTags);
  cacheLife(clockLife(now));
  return now;
}

/** Every product as a CatalogProduct at `now` (badges and listable at the server clock). */
async function catalogAt(now: number): Promise<CatalogProduct[]> {
  const ctx = badgeContextAt(now);
  return (await getProducts()).map((product) => toCatalogProduct(product, ctx));
}

function findDrop(slug: DropSlug): Drop | null {
  return drops.find((drop) => drop.slug === slug) ?? null;
}

function byStart(a: Drop, b: Drop): number {
  return toMs(a.startsAt) - toMs(b.startsAt);
}

/**
 * May the client catalog hold this product at `now`? Everything except products whose every drop is still hidden
 * (phase "verborgen"): before early access a drop product must not even be in the page payload.
 */
function inClientCatalog(product: CatalogProduct, now: number): boolean {
  if (product.tags.drops.length === 0) return true;
  return product.tags.drops.some((slug) => {
    const drop = findDrop(slug);
    return drop !== null && getDropPhase(drop, now) !== "verborgen";
  });
}

/* -------------------------------------------------------------------------- */
/* Lists and products                                                          */
/* -------------------------------------------------------------------------- */

/** The listable products, sorted "uitgelicht" (sold out last), with badges. */
export async function getShopProducts(): Promise<CatalogProduct[]> {
  "use cache";
  const now = clockScope();
  return sortProducts(
    (await catalogAt(now)).filter((product) => product.listable),
    "uitgelicht",
  );
}

/** Any product by handle, also drop products before their start (the proxy gates those pages), or null. */
export async function getShopProduct(handle: string): Promise<Product | null> {
  "use cache";
  clockScope();
  return getProduct(handle);
}

/**
 * The labels of the product page (ProductInfo): deriveBadges incl. "op-voorraad", WITHOUT "limited" and
 * "early-access" (DropStatusLabel shows those, exact to the second; decision 134). [] for an unknown handle.
 */
export async function getProductBadges(handle: string): Promise<BadgeId[]> {
  "use cache";
  const now = clockScope();
  const product = await getProduct(handle);
  if (!product) return [];
  return toCatalogProduct(product, badgeContextAt(now)).badges.filter((id) => id !== "limited" && id !== "early-access");
}

/** A collection page: its definition, the listable products of its rule (sorted "uitgelicht") and the facets that occur. */
export async function getShopCollection(handle: string): Promise<ShopCollection | null> {
  "use cache";
  const now = clockScope("collections");
  const collection = await getCollection(handle, now);
  if (!collection) return null;
  const { products, ...definition } = collection;
  const ctx = badgeContextAt(now);
  const items = sortProducts(
    products.map((product) => toCatalogProduct(product, ctx)),
    "uitgelicht",
  );
  return { definition, products: items, facets: availableFacets(items) };
}

/**
 * What CatalogProvider gets (plan §7.3, decision 107): every listable product, the drop products in early access and
 * after their drop ended (listable: false: in no list, but the cart, CartAnnouncer and analytics find their
 * variants), the gift wrap and the gift card. Drop products before early access are left out entirely.
 * By featuredRank.
 */
export async function getCatalogProducts(): Promise<CatalogProduct[]> {
  "use cache";
  const now = clockScope("collections");
  return (await catalogAt(now)).filter((product) => inClientCatalog(product, now));
}

/* -------------------------------------------------------------------------- */
/* Drops and stacks                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The drop for the home banner (§12.4): the drop that is publicly live at the server clock (the earliest started
 * when several are), else the next drop whose startsAt lies within FEATURED_DROP_WINDOW_DAYS. DropBanner keeps an
 * upcoming drop hidden until startsAt. null when there is neither.
 */
export async function getFeaturedDrop(): Promise<{ drop: Drop; phase: DropPhase } | null> {
  "use cache";
  const now = clockScope();
  const sorted = [...drops].sort(byStart);
  const live = sorted.find((drop) => getDropPhase(drop, now) === "live");
  if (live) return { drop: live, phase: "live" };
  const upcoming = sorted.find((drop) => {
    const startsIn = toMs(drop.startsAt) - now;
    return startsIn > 0 && startsIn <= FEATURED_DROP_WINDOW_DAYS * DAY_MS;
  });
  return upcoming ? { drop: upcoming, phase: getDropPhase(upcoming, now) } : null;
}

/**
 * A drop page: the drop, its phase at the server clock and every product of the drop in any phase (the proxy gates
 * the page). Products in the order of drop.productHandles, then any other product tagged drop:<slug>.
 */
export async function getDropData(
  slug: DropSlug,
): Promise<{ drop: Drop; phase: DropPhase; products: CatalogProduct[] } | null> {
  "use cache";
  const now = clockScope();
  const drop = findDrop(slug);
  if (!drop) return null;
  const all = await catalogAt(now);
  const position = (handle: string) => {
    const index = drop.productHandles.indexOf(handle);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const products = all
    .filter((product) => drop.productHandles.includes(product.handle) || product.tags.drops.includes(slug))
    .sort((a, b) => position(a.handle) - position(b.handle) || a.featuredRank - b.featuredRank);
  return { drop, phase: getDropPhase(drop, now), products };
}

/**
 * Linde's stacks that can be shown now: a stack with a dropSlug only while that drop is publicly live, and only
 * when all three pieces exist and are listable. Products in the order of the stack.
 */
export async function getVisibleStacks(): Promise<Array<{ stack: Stack; products: CatalogProduct[] }>> {
  "use cache";
  const now = clockScope();
  const all = await catalogAt(now);
  const visible: Array<{ stack: Stack; products: CatalogProduct[] }> = [];
  for (const stack of stacks) {
    if (stack.dropSlug) {
      const drop = findDrop(stack.dropSlug);
      if (!drop || getDropPhase(drop, now) !== "live") continue;
    }
    const products = stack.productHandles.map((handle) => all.find((product) => product.handle === handle && product.listable));
    if (products.every((product): product is CatalogProduct => product !== undefined)) visible.push({ stack, products });
  }
  return visible;
}

/**
 * The products the page may pair with `product` (plan §7.2, decision 107): available, not the product itself, and
 * listable; for a drop product before its public start, the available pieces of that same drop instead (they are
 * not listable yet, and the prelaunch cart gate refuses anything else on 26 November). By featuredRank.
 */
function pairingPool(product: CatalogProduct, all: CatalogProduct[], now: number): { pool: CatalogProduct[]; preStartDrop: DropSlug | null } {
  const preStartDrop = preStartDropOf(product, now, drops);
  const pool = all
    .filter(
      (candidate) =>
        candidate.handle !== product.handle &&
        candidate.availableForSale &&
        (preStartDrop ? candidate.tags.drops.includes(preStartDrop) : candidate.listable),
    )
    .sort((a, b) => a.featuredRank - b.featuredRank);
  return { pool, preStartDrop };
}

/**
 * "Maak de look af" (plan §7.2): first the other pieces of a stack in content/stacks.ts with this product, then
 * products with a shared vibe and another type, then Linde's favourites. Only listable and available products
 * (before a drop's start: its own pieces), without the product itself and without duplicates. [] for an unknown handle.
 */
export async function getRecommendedFor(handle: string, limit: 2 | 3 | 4): Promise<CatalogProduct[]> {
  "use cache";
  const now = clockScope();
  const all = await catalogAt(now);
  const product = all.find((candidate) => candidate.handle === handle);
  if (!product) return [];
  const { pool } = pairingPool(product, all, now);

  const picked: CatalogProduct[] = [];
  const add = (candidate: CatalogProduct | undefined) => {
    if (candidate && picked.length < limit && !picked.includes(candidate)) picked.push(candidate);
  };
  for (const stack of stacks) {
    if (!stack.productHandles.includes(handle)) continue;
    for (const other of stack.productHandles) add(pool.find((candidate) => candidate.handle === other));
  }
  const vibes = product.tags.vibes;
  for (const candidate of pool) {
    if (candidate.type !== product.type && candidate.tags.vibes.some((vibe) => vibes.includes(vibe))) add(candidate);
  }
  for (const candidate of pool) if (candidate.lindesFavoriet) add(candidate);
  return picked;
}

/**
 * The stack picker of the product page (plan §7.2, decisions 107 and 129). `candidates`: the listable, available
 * earrings and bracelets except the product itself (before a drop's start: the available stack pieces of that drop).
 * `defaultPicks` are VARIANT ids (defaultVariant: the first available variant): the other two pieces of the first
 * stack with this product (before a drop's start: the stack of that drop) when both are candidates; otherwise the
 * two candidates with the lowest featuredRank of the other stack type (earring → bracelets, bracelet → earrings),
 * topped up with the own type. null only with fewer than two candidates. Unknown handle: no candidates.
 */
export async function getStackOptionsFor(
  handle: string,
): Promise<{ candidates: CatalogProduct[]; defaultPicks: [string, string] | null }> {
  "use cache";
  const now = clockScope();
  const all = await catalogAt(now);
  const product = all.find((candidate) => candidate.handle === handle);
  if (!product) return { candidates: [], defaultPicks: null };

  const { pool, preStartDrop } = pairingPool(product, all, now);
  const candidates = pool.filter((candidate) => isStackEligible(candidate.type));
  if (candidates.length < 2) return { candidates, defaultPicks: null };

  const pickOf = (pieces: CatalogProduct[]): [string, string] => [defaultVariant(pieces[0]).id, defaultVariant(pieces[1]).id];

  const stack = stacks.find(
    (candidate) => candidate.productHandles.includes(handle) && (!preStartDrop || candidate.dropSlug === preStartDrop),
  );
  if (stack) {
    const others = stack.productHandles
      .filter((other) => other !== handle)
      .map((other) => candidates.find((candidate) => candidate.handle === other));
    if (others.length === 2 && others.every((other): other is CatalogProduct => other !== undefined)) {
      return { candidates, defaultPicks: pickOf(others) };
    }
  }

  const otherType = product.type === "oorbellen" ? "armbanden" : product.type === "armbanden" ? "oorbellen" : null;
  const fallback = otherType ? candidates.filter((candidate) => candidate.type === otherType).slice(0, 2) : [];
  for (const candidate of candidates) {
    if (fallback.length >= 2) break;
    if (!fallback.includes(candidate)) fallback.push(candidate);
  }
  return { candidates, defaultPicks: pickOf(fallback) };
}

/* -------------------------------------------------------------------------- */
/* Shipping, sitemap and static params                                         */
/* -------------------------------------------------------------------------- */

/** The ship label for the next 14 days from the server clock (plan §10.5): ShipLabel shows the right entry. */
export async function getShipSchedule(): Promise<ShipLabelEntry[]> {
  "use cache";
  const now = serverNow();
  cacheTag("klok");
  cacheLife("hours");
  return buildShipSchedule(now);
}

/** The product pages in the sitemap: the listable products at the server clock, by featuredRank. */
export async function getSitemapProducts(): Promise<Array<{ handle: string }>> {
  "use cache";
  const now = clockScope();
  return (await catalogAt(now)).filter((product) => product.listable).map((product) => ({ handle: product.handle }));
}

/**
 * generateStaticParams of the product page: every product except the gift wrap (drop products in any phase too;
 * the proxy gates them). An empty catalog gives [{ handle: NO_PRODUCTS_HANDLE }], never [] (§7.7, §11.9).
 */
export async function getShopProductsForParams(): Promise<Array<{ handle: string }>> {
  "use cache";
  clockScope();
  const params = (await getProducts())
    .filter((product) => product.handle !== giftWrap.productHandle)
    .map((product) => ({ handle: product.handle }));
  return params.length > 0 ? params : [{ handle: NO_PRODUCTS_HANDLE }];
}
