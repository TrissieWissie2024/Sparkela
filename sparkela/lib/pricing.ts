import { formatMoney, money } from "@/lib/money";
import type {
  Cart,
  CartLine,
  CartNotice,
  CartProgress,
  CatalogProduct,
  Cents,
  DiscountApplication,
  DiscountCodeState,
  DiscountSource,
  GiftWrapOffer,
  Money,
  PriceDisplay,
  ProductType,
  ShippingQuote,
  StackDiscountOffer,
  Variant,
  WelcomeCodeOffer,
} from "@/lib/types";
import { isGiftWrapFree, toMs } from "@/lib/dates";
import { sharedCopy } from "@/content/copy/shared";
import { giftWrap as defaultGiftWrap, stackDiscount, welcomeCode } from "@/content/offers";
import { shipping as defaultShipping } from "@/content/shipping";

/**
 * Pricing logic (docs/PLAN.md §8, brief §4 and §7). Pure: no clock, no React, no next/*; `now` always comes in as an
 * argument and every function takes an optional `config` for tests (default: content/offers.ts and
 * content/shipping.ts).
 *
 * - Integer cents only. The one place that divides is percentOf(): half up, integers, never `cents * 0.85`.
 * - With the "local" provider priceCart() builds the whole Cart. With "shopify" the site never computes amounts:
 *   it only derives the progress texts from the Shopify amounts (progressFromShopifyCart, progressTexts).
 *
 * Mirrors the Shopify set-up of §16.6 (decision 104): the stack discount (15% per eligible line from 3 earrings or
 * bracelets) and the December gift wrap are automatic product discounts; WELKOM10 is an order discount after the
 * product discounts and never on gift cards. Stack and WELKOM10 do not combine: the higher one applies, the stack
 * discount on a tie (decision 30). The free-shipping basis is the subtotal after discounts without gift cards, so
 * it is never above Shopify's (decision 90).
 */

export interface PricingConfig {
  stack: StackDiscountOffer;
  welcome: WelcomeCodeOffer;
  giftWrap: GiftWrapOffer;
  /** NL from content/shipping.ts. */
  shipping: { rate: Cents; freeFrom: Cents };
}

const nl = defaultShipping.countries[defaultShipping.defaultCountry];

export const defaultPricingConfig: PricingConfig = {
  stack: stackDiscount,
  welcome: welcomeCode,
  giftWrap: defaultGiftWrap,
  shipping: { rate: nl.rate.cents, freeFrom: nl.freeFrom.cents },
};

/** Line id of the local cart: "local:<variantId>" (plan §6.10, decision 145). */
export function localLineId(variantId: string): string {
  return `local:${variantId}`;
}

/** Variant id of the gift wrap in the local catalog: "local:cadeauverpakking:1" (decision 145). */
export function localGiftWrapVariantId(config: PricingConfig = defaultPricingConfig): string {
  return `local:${config.giftWrap.productHandle}:1`;
}

/** Most units of one line (plan §7.2 MAX_LINE_QUANTITY). */
const MAX_QUANTITY = 99;
/** Gift message length (plan §6.10). */
const MAX_NOTE_LENGTH = 200;

/**
 * Titles of the discount rows in the totals (DiscountApplication.title, types §6.10: "Stack-korting 15%",
 * "WELKOM10"). The words come from sharedCopy.discounts. The gift wrap title equals the title of the automatic
 * discount in Shopify (plan §16.5), so the drawer reads the same for both providers.
 */
export const DISCOUNT_TITLES = {
  stack: (percent: number) => sharedCopy.discounts.stack(`${percent}%`),
  giftWrap: sharedCopy.discounts.giftWrap,
  other: sharedCopy.discounts.other,
} as const;

/* -------------------------------------------------------------------------- */
/* Small helpers                                                               */
/* -------------------------------------------------------------------------- */

/** Integer percentage of an amount, half up: Math.floor((cents * percent + 50) / 100). 1495 at 15% → 224. */
export function percentOf(cents: Cents, percent: number): Cents {
  return Math.floor((cents * percent + 50) / 100);
}

/** Trimmed and upper case: " welkom10 " → "WELKOM10". */
export function normalizeDiscountCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Checks a typed code. WELKOM10 has no end date (plan §12.2), so `now` does not change the answer today; it is part
 * of the signature for codes with a window (unused until then). "First order only" is enforced by Shopify (once per
 * customer).
 */
export function validateDiscountCode(
  code: string,
  now: number,
  config: PricingConfig = defaultPricingConfig,
): { ok: true; percent: number; code: string } | { ok: false; reason: "unknown" | "empty" } {
  const wanted = normalizeDiscountCode(code);
  if (!wanted) return { ok: false, reason: "empty" };
  if (wanted !== normalizeDiscountCode(config.welcome.code)) return { ok: false, reason: "unknown" };
  return { ok: true, percent: config.welcome.percent, code: config.welcome.code };
}

function isStackType(type: ProductType | null, config: PricingConfig): boolean {
  return type !== null && (config.stack.eligibleTypes as readonly ProductType[]).includes(type);
}

/**
 * Splits `total` over lines by weight: floored shares, the rest on the last line with a positive weight (plan §8.2
 * rule 4). A safety pass moves any share above its own weight to earlier lines with room, so no line ever gets more
 * discount than it is worth.
 */
function allocate(total: Cents, weights: Cents[]): Cents[] {
  const shares = weights.map(() => 0);
  const weightSum = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total <= 0 || weightSum <= 0) return shares;
  let last = -1;
  weights.forEach((w, index) => {
    if (w > 0) {
      shares[index] = Math.floor((total * w) / weightSum);
      last = index;
    }
  });
  shares[last] += total - shares.reduce((sum, share) => sum + share, 0);
  let excess = shares[last] - weights[last];
  for (let index = 0; excess > 0 && index < last; index += 1) {
    const room = Math.max(0, weights[index] - shares[index]);
    const moved = Math.min(room, excess);
    shares[index] += moved;
    shares[last] -= moved;
    excess -= moved;
  }
  return shares;
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Free-shipping and stack progress (plan §8.3). `freeShippingBasis` is the subtotal after discounts without gift
 * cards; `hasShippable` is false for an empty cart or gift cards only (no bar). `stack.needed` is only meaningful
 * while `stack.applies` (at least one earring or bracelet).
 */
export function cartProgress(input: {
  freeShippingBasis: Cents;
  hasShippable: boolean;
  stackUnits: number;
  config?: PricingConfig;
}): CartProgress {
  const config = input.config ?? defaultPricingConfig;
  const threshold = config.shipping.freeFrom;
  const basis = input.hasShippable ? Math.max(0, input.freeShippingBasis) : 0;
  const reached = input.hasShippable && basis >= threshold;
  const units = Math.max(0, Math.floor(input.stackUnits));
  const minUnits = config.stack.minUnits;
  return {
    freeShipping: {
      applies: input.hasShippable,
      threshold: money(threshold),
      remaining: money(input.hasShippable ? Math.max(0, threshold - basis) : 0),
      reached,
      ratio: input.hasShippable && threshold > 0 ? Math.min(1, basis / threshold) : 0,
    },
    stack: {
      applies: units > 0,
      units,
      needed: Math.min(2, Math.max(0, minUnits - units)) as 0 | 1 | 2,
      reached: units >= minUnits,
    },
  };
}

/**
 * Texts above the bars (sharedCopy.progress). Shipping: null without a shippable product (the bar is hidden; with
 * gift cards only the drawer shows sharedCopy.progress.giftCardsOnly), "Nog €X tot gratis verzending" or "Je
 * verzending is gratis". Stack: null without earrings or bracelets, "Nog 2 …", "Nog 1 …", "Je stack-korting van 15%
 * is binnen".
 */
export function progressTexts(p: CartProgress): { shipping: string | null; stack: string | null } {
  const shipping = !p.freeShipping.applies
    ? null
    : p.freeShipping.reached
      ? sharedCopy.progress.reached
      : sharedCopy.progress.remaining(formatMoney(p.freeShipping.remaining));
  let stack: string | null = null;
  if (p.stack.applies) {
    if (p.stack.reached) stack = sharedCopy.progress.stackReached;
    else stack = p.stack.needed === 1 ? sharedCopy.progress.stackOne : sharedCopy.progress.stackTwo;
  }
  return { shipping, stack };
}

/**
 * Progress for a Shopify cart, from Shopify's own amounts: basis = total − gift card lines − shipping (the gift wrap
 * is not in `lines` but is in the total, so it counts while it is not free). When a code applies and no stack
 * discount does, Shopify chose the code over the stack discount; the stack milestone is then hidden (applies false),
 * so the drawer never says the stack discount is in while it is not.
 */
export function progressFromShopifyCart(cart: Omit<Cart, "progress">, config: PricingConfig = defaultPricingConfig): CartProgress {
  const giftCards = cart.lines.filter((line) => line.merchandise.isGiftCard).reduce((sum, line) => sum + line.total.cents, 0);
  const shippingAmount = cart.totals.shipping.kind === "amount" ? cart.totals.shipping.amount.cents : 0;
  const basis = cart.totals.total.cents - giftCards - shippingAmount;
  const hasShippable = cart.lines.some((line) => !line.merchandise.isGiftCard && !line.merchandise.isGiftWrap);
  const stackUnits = cart.lines
    .filter((line) => isStackType(line.merchandise.type, config) && !line.merchandise.isGiftCard)
    .reduce((sum, line) => sum + line.quantity, 0);
  const progress = cartProgress({ freeShippingBasis: basis, hasShippable, stackUnits, config });
  const codeWon =
    progress.stack.reached &&
    cart.discounts.some((d) => d.source === "code" && d.amount.cents > 0) &&
    !cart.discounts.some((d) => d.source === "stack" && d.amount.cents > 0);
  return codeWon ? { ...progress, stack: { ...progress.stack, applies: false } } : progress;
}

/* -------------------------------------------------------------------------- */
/* Product page                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The stack tile on the product page and the stack cards (plan §13.9, §13.12): subtotal of the pieces, the stack
 * discount when at least minUnits pieces are earrings or bracelets (rounded per piece, as in the cart), and the total.
 * Noor 14,95 + Tess 19,95 + Jet 24,95 → subtotal 5985, discount 897, total 5088.
 */
export function stackQuote(
  pieces: Array<{ price: Cents; type: ProductType | null }>,
  config: PricingConfig = defaultPricingConfig,
): { subtotal: Cents; discount: Cents; total: Cents; eligibleUnits: number; active: boolean } {
  const subtotal = pieces.reduce((sum, piece) => sum + piece.price, 0);
  const eligible = pieces.filter((piece) => isStackType(piece.type, config));
  const active = eligible.length >= config.stack.minUnits;
  const discount = active ? eligible.reduce((sum, piece) => sum + percentOf(piece.price, config.stack.percent), 0) : 0;
  return { subtotal, discount, total: subtotal - discount, eligibleUnits: eligible.length, active };
}

/**
 * Struck price only when the compare-at price is above the price AND the lowest price of the 30 days before is
 * known (brief §2.5, plan §8.6). Fails closed: otherwise no compare-at and no lowest price, even when Shopify has a
 * compare-at price. `Price` always shows the lowest-price line when showCompareAt is true.
 */
export function priceDisplay(variant: Pick<Variant, "price" | "compareAtPrice">, laagstePrijs30d: Money | null): PriceDisplay {
  const compareAt = variant.compareAtPrice;
  const showCompareAt = compareAt !== null && compareAt.cents > variant.price.cents && laagstePrijs30d !== null;
  return {
    price: variant.price,
    compareAt: showCompareAt ? compareAt : null,
    lowest30d: showCompareAt ? laagstePrijs30d : null,
    showCompareAt,
  };
}

/**
 * The next instant after `now` at which priceCart() can give a different answer for the same cart: the start or
 * end of a free gift wrap window. The local cart re-prices there with scheduleAt() (plan §7.4). Null after the last.
 */
export function nextPricingBoundary(now: number, config: PricingConfig = defaultPricingConfig): number | null {
  let next: number | null = null;
  for (const w of config.giftWrap.freeWindows) {
    for (const at of [toMs(w.startsAt), toMs(w.endsAt)]) {
      if (at > now && (next === null || at < next)) next = at;
    }
  }
  return next;
}

/* -------------------------------------------------------------------------- */
/* Cart                                                                        */
/* -------------------------------------------------------------------------- */


export interface PriceCartInput {
  lines: Array<{ variantId: string; quantity: number }>;
  resolve: (variantId: string) => { product: CatalogProduct; variant: Variant } | null;
  discountCode: string | null;
  giftWrap: boolean;
  note: string;
  now: number;
  config?: PricingConfig;
}

/** A priced line before it becomes a CartLine; the gift wrap is a draft without product and variant. */
interface Draft {
  type: ProductType | null;
  isGiftCard: boolean;
  quantity: number;
  subtotal: Cents;
  discounts: Array<{ source: DiscountSource; amount: Cents }>;
}

interface LineDraft extends Draft {
  product: CatalogProduct;
  variant: Variant;
}

function discountOf(draft: Draft): Cents {
  return draft.discounts.reduce((sum, d) => sum + d.amount, 0);
}

function cutNote(note: string): string {
  const chars = Array.from(note);
  return chars.length > MAX_NOTE_LENGTH ? chars.slice(0, MAX_NOTE_LENGTH).join("") : note;
}

/** Variant title for the cart: null for a product without options (one default variant). */
function variantTitleOf(product: CatalogProduct, variant: Variant): string | null {
  return product.options.length === 0 || variant.title === "Default Title" ? null : variant.title;
}

/**
 * Prices a local cart (plan §8.2). Rules:
 * 1. Lines: duplicate variants merge; a quantity below 1 drops the line; unknown variants and variants that are no
 *    longer for sale drop out (notice line-removed; its title is "" when the product is unknown); the gift wrap
 *    never comes in as a plain line (it is the `giftWrap` flag); the quantity is capped at 99 and at the known stock
 *    (notice quantity-capped). `giftWrap: true` adds one gift wrap line when there is a physical product (not a gift
 *    card); it is reported through `cart.giftWrap`, not in `lines`.
 * 2. Merchandise = sum of unit price × quantity of every line, gift wrap and gift cards included.
 * 3. Stack: from 3 earrings or bracelets (units; gift cards and gift wrap never count) every eligible line gets
 *    percentOf(line subtotal, 15), rounded per line.
 * 4. WELKOM10: 10% of every line except gift cards, after the free gift wrap, split over the lines pro rata
 *    (floored, the rest on the last line).
 * 5. Stack and code do not combine: the higher applies, the stack discount on a tie. The code stays stored with
 *    applicable false ("not-combinable") and the cart gets notice code-not-combined. When the code is higher, the
 *    stack milestone is hidden (progress.stack.applies false).
 * 6. Gift wrap is free in December (a discount equal to its price, source "cadeauverpakking"); it combines with both.
 * 7. Free-shipping basis = subtotal minus discounts of every line except gift cards.
 * 8. Shipping: none without a physical product, free from €35, else €3,95.
 * 9. Total = merchandise − discounts + shipping; savings = discounts (free shipping is not a saving).
 */
export function priceCart(input: PriceCartInput): Cart {
  const config = input.config ?? defaultPricingConfig;
  const notices: CartNotice[] = [];

  // Rule 1: lines.
  const requested = new Map<string, number>();
  for (const line of input.lines) {
    if (!line || typeof line.variantId !== "string" || !Number.isFinite(line.quantity)) continue;
    const quantity = Math.floor(line.quantity);
    if (quantity < 1) continue;
    requested.set(line.variantId, (requested.get(line.variantId) ?? 0) + quantity);
  }

  const drafts: LineDraft[] = [];
  for (const [variantId, wanted] of requested) {
    const resolved = input.resolve(variantId);
    if (!resolved) {
      notices.push({ kind: "line-removed", title: "" });
      continue;
    }
    const { product, variant } = resolved;
    if (product.isGiftWrap) continue;
    if (!variant.availableForSale) {
      notices.push({ kind: "line-removed", title: product.title });
      continue;
    }
    const stock = variant.quantityAvailable;
    const max = stock !== null && stock > 0 ? Math.min(MAX_QUANTITY, stock) : MAX_QUANTITY;
    const quantity = Math.min(wanted, max);
    if (quantity < wanted) notices.push({ kind: "quantity-capped", title: product.title, max });
    drafts.push({
      product,
      variant,
      type: product.type,
      isGiftCard: product.isGiftCard,
      quantity,
      subtotal: variant.price.cents * quantity,
      discounts: [],
    });
  }

  const hasPhysical = drafts.some((d) => !d.product.isGiftCard);
  const giftWrapSelected = input.giftWrap && hasPhysical;
  const giftWrapFree = isGiftWrapFree(input.now, config.giftWrap);
  const wrap: Draft | null = giftWrapSelected
    ? { type: "cadeauverpakking", isGiftCard: false, quantity: 1, subtotal: config.giftWrap.price.cents, discounts: [] }
    : null;
  const all: Draft[] = wrap ? [...drafts, wrap] : drafts;

  // Rule 6: free gift wrap in December.
  if (wrap && giftWrapFree) wrap.discounts.push({ source: "cadeauverpakking", amount: wrap.subtotal });

  // Rule 3: stack discount per eligible line (computed here, applied after rule 5).
  const stackLines = drafts.filter((d) => !d.isGiftCard && isStackType(d.type, config));
  const stackUnits = stackLines.reduce((sum, d) => sum + d.quantity, 0);
  const stackReached = stackUnits >= config.stack.minUnits;
  const stackAmounts = stackLines.map((d) => (stackReached ? percentOf(d.subtotal, config.stack.percent) : 0));
  const stackTotal = stackAmounts.reduce((sum, amount) => sum + amount, 0);

  // Rule 4: what WELKOM10 gives, on everything except gift cards, after the free gift wrap.
  const codeLines = all.filter((d) => !d.isGiftCard && !(d.type !== null && config.welcome.excludedTypes.includes(d.type)));
  const codeWeights = codeLines.map((d) => d.subtotal - discountOf(d));
  const codeBase = codeWeights.reduce((sum, w) => sum + w, 0);

  // Rule 5: one of the two.
  const typed = input.discountCode ? normalizeDiscountCode(input.discountCode) : "";
  const discountCodes: DiscountCodeState[] = [];
  let code: { code: string; amount: Cents } | null = null;
  if (typed) {
    const validation = validateDiscountCode(typed, input.now, config);
    if (!validation.ok) {
      discountCodes.push({ code: typed, applicable: false, reason: "unknown" });
      notices.push({ kind: "code-invalid", code: typed });
    } else {
      const amount = percentOf(codeBase, validation.percent);
      if (amount <= 0) {
        discountCodes.push({ code: validation.code, applicable: false, reason: "not-eligible" });
      } else if (amount > stackTotal) {
        code = { code: validation.code, amount };
        discountCodes.push({ code: validation.code, applicable: true, reason: "ok" });
      } else {
        discountCodes.push({ code: validation.code, applicable: false, reason: "not-combinable" });
        notices.push({ kind: "code-not-combined", code: validation.code });
      }
    }
  }

  const stackApplied = stackTotal > 0 && code === null;
  if (stackApplied) {
    stackLines.forEach((d, index) => {
      if (stackAmounts[index] > 0) d.discounts.push({ source: "stack", amount: stackAmounts[index] });
    });
  }
  if (code) {
    allocate(code.amount, codeWeights).forEach((share, index) => {
      if (share > 0) codeLines[index].discounts.push({ source: "code", amount: share });
    });
  }

  // Rules 2, 7, 8 and 9.
  const merchandise = all.reduce((sum, d) => sum + d.subtotal, 0);
  const discounts = all.reduce((sum, d) => sum + discountOf(d), 0);
  const freeShippingBasis = all.filter((d) => !d.isGiftCard).reduce((sum, d) => sum + d.subtotal - discountOf(d), 0);
  let shippingQuote: ShippingQuote = { kind: "none" };
  let shippingAmount = 0;
  if (hasPhysical && freeShippingBasis >= config.shipping.freeFrom) {
    shippingQuote = { kind: "free" };
  } else if (hasPhysical) {
    shippingAmount = config.shipping.rate;
    shippingQuote = { kind: "amount", amount: money(shippingAmount) };
  }

  const applications: DiscountApplication[] = [];
  if (stackApplied) {
    applications.push({
      source: "stack",
      kind: "automatic",
      title: DISCOUNT_TITLES.stack(config.stack.percent),
      code: null,
      amount: money(stackTotal),
    });
  }
  if (code) {
    applications.push({ source: "code", kind: "code", title: code.code, code: code.code, amount: money(code.amount) });
  }
  if (wrap && giftWrapFree) {
    applications.push({
      source: "cadeauverpakking",
      kind: "automatic",
      title: DISCOUNT_TITLES.giftWrap,
      code: null,
      amount: money(wrap.subtotal),
    });
  }

  const lines: CartLine[] = drafts.map((d) => ({
    id: localLineId(d.variant.id),
    merchandise: {
      variantId: d.variant.id,
      productId: d.product.id,
      productHandle: d.product.handle,
      productTitle: d.product.title,
      variantTitle: variantTitleOf(d.product, d.variant),
      image: d.variant.image ?? d.product.images[0] ?? null,
      type: d.product.type,
      isGiftCard: d.product.isGiftCard,
      isGiftWrap: false,
      quantityAvailable: d.variant.quantityAvailable,
    },
    quantity: d.quantity,
    unitPrice: d.variant.price,
    subtotal: money(d.subtotal),
    discounts: d.discounts.map((x) => ({ source: x.source, amount: money(x.amount) })),
    total: money(d.subtotal - discountOf(d)),
    attributes: [],
  }));

  const progress = cartProgress({ freeShippingBasis, hasShippable: hasPhysical, stackUnits, config });
  const stackHidden = stackReached && code !== null;

  return {
    id: "local",
    provider: "local",
    lines,
    itemCount: drafts.reduce((sum, d) => sum + d.quantity, 0),
    discountCodes,
    discounts: applications,
    totals: {
      merchandise: money(merchandise),
      discounts: money(discounts),
      freeShippingBasis: money(freeShippingBasis),
      shipping: shippingQuote,
      total: money(merchandise - discounts + shippingAmount),
      savings: money(discounts),
    },
    progress: stackHidden ? { ...progress, stack: { ...progress.stack, applies: false } } : progress,
    giftWrap: {
      selected: giftWrapSelected,
      free: giftWrapFree,
      price: config.giftWrap.price,
      lineId: wrap ? localLineId(localGiftWrapVariantId(config)) : null,
      available: hasPhysical,
    },
    note: cutNote(typeof input.note === "string" ? input.note : ""),
    checkoutUrl: "/checkout",
    notices,
  };
}
