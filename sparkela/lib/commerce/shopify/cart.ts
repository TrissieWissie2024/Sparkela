import "server-only";

import { MAX_LINE_QUANTITY, parseTags } from "@/lib/catalog";
import { canAddToCart, gateItemFor, type GateContext, type GateItem } from "@/lib/commerce/cart-gate";
import { storefront } from "@/lib/commerce/shopify/client";
import { mapCart, productTypeOf } from "@/lib/commerce/shopify/mappers";
import {
  CART_BY_ID_QUERY,
  CART_CREATE_MUTATION,
  CART_DISCOUNT_CODES_UPDATE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_REMOVE_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_NOTE_UPDATE_MUTATION,
  VARIANT_GATE_QUERY,
  type CartByIdData,
  type CartCreateData,
  type CartDiscountCodesUpdateData,
  type CartLinesAddData,
  type CartLinesRemoveData,
  type CartLinesUpdateData,
  type CartNoteUpdateData,
  type ShopifyCart,
  type ShopifyCartLine,
  type ShopifyCartPayload,
  type ShopifyCartUserError,
  type ShopifyCartWarning,
  type ShopifyGateVariant,
  type VariantGateData,
} from "@/lib/commerce/shopify/mutations";
import { GIFT_WRAP_VARIANT_QUERY, type GiftWrapVariantData } from "@/lib/commerce/shopify/queries";
import type { CartErrorCode, CartRequest, CartResult } from "@/lib/commerce/types";
import type { EnvSource } from "@/lib/env";
import type { Cart, CartLineInput, CartNotice } from "@/lib/types";
import { giftWrap } from "@/content/offers";

/**
 * Cart operations for /api/cart with the Shopify provider (docs/PLAN.md §7.4, §15.6, §16.4; decisions 71, 87, 107).
 * Server-only: the route handler reads the cookies and the clock and calls these; the browser only ever talks to
 * /api/cart (lib/commerce/cart/shopify-adapter.ts).
 *
 * - Every request is uncached and carries the buyer's IP (Shopify-Storefront-Buyer-IP).
 * - add: first the fresh VariantGate query (never the cached catalog, decision 87); an unknown variant or the gift
 *   wrap → "invalid"; then canAddToCart() (cart-gate.ts) → "not-yet-available"; only then cartLinesAdd, or cartCreate
 *   with the lines (buyerIdentity NL) when there is no cart yet.
 * - giftWrap: adds the gift wrap variant (quantity 1) or removes its line; only with a physical product in the cart.
 * - update / remove: afterwards, without physical products the gift wrap goes too (and its quantity stays 1).
 * - discount: cartDiscountCodesUpdate with the full list, trimmed and upper case. A code that does not apply is
 *   still `ok: true`, with discountCodes[].applicable false (the drawer shows cartCopy.discount.notApplicable).
 * - note: cartNoteUpdate, HTML tags stripped, at most 200 characters.
 * - A cart that no longer exists (expired, checked out) clears the cookie; the next add starts a new cart.
 * - userErrors → "quantity-capped" (MAXIMUM_EXCEEDED), "unavailable" (stock) or "invalid", with the current cart;
 *   MERCHANDISE_NOT_ENOUGH_STOCK → "quantity-capped" with a notice. MERCHANDISE_OUT_OF_STOCK: Shopify ran the mutation
 *   and left the sold-out line in the cart (warnings since 2024-10), so its line (the warning's `target`) is removed
 *   with cartLinesRemove and the cart gets a `line-removed` notice; the answer is ok, or "unavailable" when nothing
 *   the visitor asked for in this add is left (decision 200).
 * - cartCreate and cartLinesAdd are never retried after a 5xx (they are not idempotent); the whole request has the
 *   route's deadline (decision 198).
 * Shopify failures throw (ShopifyError, ShopifyNotConfiguredError); the route answers "upstream" or "not-configured".
 */

/** httpOnly cookie with the cart GID (decision 71). */
export const CART_COOKIE = "sparkela_cart";
/** 10 days: the lifetime of a Shopify cart. */
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 10;
/** 60 requests per minute per IP (plan §7.4). */
export const CART_RATE_LIMIT = { limit: 60, windowMs: 60 * 1000 } as const;

export const MAX_LINES_PER_REQUEST = 10;
export const MAX_DISCOUNT_CODES = 5;
export const MAX_NOTE_LENGTH = 200;
const MAX_ATTRIBUTES = 10;

const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/\d+$/;
const LINE_GID = /^gid:\/\/shopify\/CartLine\/\S{1,400}$/;
const CART_GID = /^gid:\/\/shopify\/Cart\/[A-Za-z0-9_-]{1,200}(\?key=[A-Za-z0-9_-]{1,200})?$/;
const DISCOUNT_CODE = /^[A-Za-z0-9_-]{1,40}$/;

/** True when the server runs the Shopify provider (COMMERCE_PROVIDER=shopify). /api/cart answers "not-configured" otherwise. */
export function isShopifyCartEnabled(env: EnvSource = process.env): boolean {
  return env.COMMERCE_PROVIDER?.trim().toLowerCase() === "shopify";
}

/** A cookie value that looks like a Shopify cart GID; anything else is ignored (and the route clears it). */
export function isCartId(value: string | null | undefined): value is string {
  return typeof value === "string" && CART_GID.test(value);
}

/* -------------------------------------------------------------------------- */
/* Request validation (plan §15.6)                                            */
/* -------------------------------------------------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQuantity(value: unknown, min: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= MAX_LINE_QUANTITY;
}

function listOf(value: unknown, min: number, max: number): unknown[] | null {
  return Array.isArray(value) && value.length >= min && value.length <= max ? value : null;
}

function parseAttributes(value: unknown): CartLineInput["attributes"] | null {
  if (value === undefined) return undefined;
  const list = listOf(value, 0, MAX_ATTRIBUTES);
  if (!list) return null;
  const attributes: NonNullable<CartLineInput["attributes"]> = [];
  for (const entry of list) {
    if (!isRecord(entry) || typeof entry.key !== "string" || typeof entry.value !== "string") return null;
    if (entry.key.length < 1 || entry.key.length > 100 || entry.value.length > 500) return null;
    attributes.push({ key: entry.key, value: entry.value });
  }
  return attributes;
}

/**
 * The body of POST /api/cart as a CartRequest, or null (→ 400 invalid): `op` known; 1 to 10 lines per request;
 * variant ids `gid://shopify/ProductVariant/<n>`; quantity an integer 1 to 99 (update: 0 to 99, 0 removes); line
 * ids `gid://shopify/CartLine/…`; at most 5 codes of [A-Za-z0-9_-]{1,40}; a note of at most 200 characters.
 */
export function parseCartRequest(body: unknown): CartRequest | null {
  if (!isRecord(body)) return null;
  switch (body.op) {
    case "add": {
      const list = listOf(body.lines, 1, MAX_LINES_PER_REQUEST);
      if (!list) return null;
      const lines: CartLineInput[] = [];
      for (const entry of list) {
        if (!isRecord(entry) || typeof entry.variantId !== "string" || !VARIANT_GID.test(entry.variantId)) return null;
        if (!isQuantity(entry.quantity, 1)) return null;
        const attributes = parseAttributes(entry.attributes);
        if (attributes === null) return null;
        lines.push({ variantId: entry.variantId, quantity: entry.quantity, ...(attributes?.length ? { attributes } : {}) });
      }
      return { op: "add", lines };
    }
    case "update": {
      const list = listOf(body.lines, 1, MAX_LINES_PER_REQUEST);
      if (!list) return null;
      const lines: Array<{ lineId: string; quantity: number }> = [];
      for (const entry of list) {
        if (!isRecord(entry) || typeof entry.lineId !== "string" || !LINE_GID.test(entry.lineId)) return null;
        if (!isQuantity(entry.quantity, 0)) return null;
        lines.push({ lineId: entry.lineId, quantity: entry.quantity });
      }
      return { op: "update", lines };
    }
    case "remove": {
      const list = listOf(body.lineIds, 1, MAX_LINES_PER_REQUEST);
      if (!list || !list.every((id): id is string => typeof id === "string" && LINE_GID.test(id))) return null;
      return { op: "remove", lineIds: [...new Set(list)] };
    }
    case "discount": {
      const list = listOf(body.codes, 0, MAX_DISCOUNT_CODES);
      if (!list || !list.every((code): code is string => typeof code === "string" && DISCOUNT_CODE.test(code.trim()))) return null;
      return { op: "discount", codes: [...new Set(list.map((code) => code.trim().toUpperCase()))] };
    }
    case "giftWrap":
      return typeof body.enabled === "boolean" ? { op: "giftWrap", enabled: body.enabled } : null;
    case "note":
      return typeof body.note === "string" && Array.from(body.note).length <= MAX_NOTE_LENGTH ? { op: "note", note: body.note } : null;
    default:
      return null;
  }
}

/** HTML tags and stray angle brackets out, at most 200 characters (the gift message on the order). */
export function cleanNote(note: string): string {
  const text = note.replace(/<[^>]*>/g, "").replace(/[<>]/g, "");
  return Array.from(text).slice(0, MAX_NOTE_LENGTH).join("");
}

/* -------------------------------------------------------------------------- */
/* Shopify errors and warnings → CartErrorCode                                */
/* -------------------------------------------------------------------------- */

const STOCK_WORDS = /stock|sold out|unavailable|not available|uitverkocht/i;

/** userErrors: MAXIMUM_EXCEEDED → quantity-capped; a stock problem → unavailable; anything else → invalid. */
export function cartErrorFromUserErrors(errors: readonly ShopifyCartUserError[]): CartErrorCode {
  const codes = errors.map((error) => error.code ?? "");
  if (codes.includes("MAXIMUM_EXCEEDED")) return "quantity-capped";
  if (codes.some((code) => /STOCK|UNAVAILABLE|NOT_AVAILABLE/.test(code)) || errors.some((error) => STOCK_WORDS.test(error.message))) {
    return "unavailable";
  }
  return "invalid";
}

/** Stock warnings → an error code plus the notices for the drawer; other warnings (discounts, delivery) → null. */
export function cartErrorFromWarnings(
  warnings: readonly ShopifyCartWarning[],
  cart: Cart,
): { error: CartErrorCode; notices: CartNotice[] } | null {
  const notices: CartNotice[] = [];
  let error: CartErrorCode | null = null;
  for (const warning of warnings) {
    if (warning.code === "MERCHANDISE_OUT_OF_STOCK") {
      error = "unavailable";
    } else if (warning.code === "MERCHANDISE_NOT_ENOUGH_STOCK") {
      error ??= "quantity-capped";
      const line = cart.lines.find((candidate) => candidate.id === warning.target);
      if (line) notices.push({ kind: "quantity-capped", title: line.merchandise.productTitle, max: line.quantity });
    }
  }
  return error ? { error, notices } : null;
}

/* -------------------------------------------------------------------------- */
/* Operations                                                                 */
/* -------------------------------------------------------------------------- */

export interface CartRequestContext {
  /** The GID from the cookie, already checked with isCartId(); null without a (valid) cookie. */
  cartId: string | null;
  /** The visitor's IP for Shopify-Storefront-Buyer-IP, or null. */
  buyerIp: string | null;
  /** serverNow() of this request (the test clock works here too). */
  now: number;
  /** The gate context from the cookies (preview, early access); only add needs it. */
  gate: () => Promise<GateContext>;
  env?: EnvSource;
  /** The route's deadline in epoch ms (lib/deadline.ts, CART_DEADLINE_MS); Date.now() based, never the test clock. */
  deadline?: number;
}

export interface CartOutcome {
  result: CartResult;
  /** A new cart id to store in the cookie; null clears the cookie; undefined leaves it. */
  cookie?: string | null;
}

const GIFT_WRAP_TTL_MS = 10 * 60 * 1000;
let giftWrapMemo: { variant: { id: string; available: boolean } | null; expiresAt: number } | null = null;

/** Tests only: forget the gift wrap variant. */
export function resetCartMemo(): void {
  giftWrapMemo = null;
}

function ok(cart: Cart | null): CartOutcome {
  return { result: { ok: true, cart } };
}

function fail(error: CartErrorCode, cart: Cart | null = null): CartOutcome {
  return { result: { ok: false, error, cart } };
}

function isGateVariant(node: VariantGateData["nodes"][number]): node is ShopifyGateVariant {
  return node !== null && typeof (node as Partial<ShopifyGateVariant>).id === "string" && isRecord((node as Partial<ShopifyGateVariant>).product);
}

function isGiftWrapProduct(product: { handle: string; tags: readonly string[]; isGiftCard: boolean }): boolean {
  return product.handle === giftWrap.productHandle || productTypeOf(product.tags, product.isGiftCard) === "cadeauverpakking";
}

/** The operations for one request. */
function session(ctx: CartRequestContext) {
  const options = { buyerIp: ctx.buyerIp ?? undefined, env: ctx.env, deadline: ctx.deadline };
  const request = <T>(query: string, variables: Record<string, unknown>) => storefront<T>(query, variables, options);
  /** cartCreate and cartLinesAdd: a 5xx may mean Shopify ran it, so no retry (the lines would be added twice). */
  const requestOnce = <T>(query: string, variables: Record<string, unknown>) =>
    storefront<T>(query, variables, { ...options, retryOn5xx: false });

  const map = (cart: ShopifyCart): Cart =>
    mapCart(cart, { giftWrapVariantId: giftWrapMemo?.variant?.id ?? null, now: ctx.now });

  const isWrapLine = (line: ShopifyCartLine): boolean =>
    (giftWrapMemo?.variant?.id !== undefined && line.merchandise?.id === giftWrapMemo.variant.id) ||
    (line.merchandise?.product !== undefined && isGiftWrapProduct(line.merchandise.product));

  async function fetchCart(id: string): Promise<ShopifyCart | null> {
    return (await request<CartByIdData>(CART_BY_ID_QUERY, { id })).cart;
  }

  async function giftWrapVariant(): Promise<{ id: string; available: boolean } | null> {
    const at = Date.now();
    if (giftWrapMemo && at < giftWrapMemo.expiresAt) return giftWrapMemo.variant;
    const data = await request<GiftWrapVariantData>(GIFT_WRAP_VARIANT_QUERY, { handle: giftWrap.productHandle });
    const node = data.product?.variants.nodes[0] ?? null;
    giftWrapMemo = { variant: node ? { id: node.id, available: node.availableForSale === true } : null, expiresAt: at + GIFT_WRAP_TTL_MS };
    return giftWrapMemo.variant;
  }

  /**
   * Removes the lines Shopify flagged MERCHANDISE_OUT_OF_STOCK (the warning's target), with a `line-removed` notice
   * per line. Returns the cart and warnings to use from here on; the original ones when there is nothing to remove or
   * the removal is refused.
   */
  async function removeOutOfStock(
    shopifyCart: ShopifyCart,
    warnings: readonly ShopifyCartWarning[],
  ): Promise<{ cart: ShopifyCart; warnings: ShopifyCartWarning[]; removed: ShopifyCartLine[] }> {
    const flagged = new Set(
      warnings
        .filter((warning) => warning.code === "MERCHANDISE_OUT_OF_STOCK" && typeof warning.target === "string")
        .map((warning) => warning.target as string),
    );
    const removed = shopifyCart.lines.nodes.filter((line) => flagged.has(line.id));
    if (removed.length === 0) return { cart: shopifyCart, warnings: [...warnings], removed: [] };
    const answer = (
      await request<CartLinesRemoveData>(CART_LINES_REMOVE_MUTATION, { cartId: shopifyCart.id, lineIds: removed.map((line) => line.id) })
    ).cartLinesRemove;
    if (!answer?.cart || answer.userErrors?.length) return { cart: shopifyCart, warnings: [...warnings], removed: [] };
    const handled = new Set(removed.map((line) => line.id));
    const rest = warnings.filter((warning) => !(warning.code === "MERCHANDISE_OUT_OF_STOCK" && handled.has(warning.target ?? "")));
    return { cart: answer.cart, warnings: [...rest, ...(answer.warnings ?? [])], removed };
  }

  /**
   * A mutation answer as a CartResult; `fallback` is shown when Shopify sends no cart. `requested` (add only): the
   * variant ids the visitor asked for; when every one of them was sold out and removed, the answer is "unavailable".
   */
  async function fromPayload(
    payload: ShopifyCartPayload | null | undefined,
    fallback: Cart | null,
    requested: readonly string[] = [],
  ): Promise<CartResult> {
    if (!payload) return { ok: false, error: "upstream", cart: fallback };
    if (payload.userErrors?.length) {
      return { ok: false, error: cartErrorFromUserErrors(payload.userErrors), cart: payload.cart ? map(payload.cart) : fallback };
    }
    if (!payload.cart) return { ok: false, error: "upstream", cart: fallback };

    const cleaned = await removeOutOfStock(payload.cart, payload.warnings ?? []);
    const mapped = map(cleaned.cart);
    const removedNotices: CartNotice[] = cleaned.removed.map((line) => ({
      kind: "line-removed",
      title: line.merchandise?.product?.title ?? "",
    }));
    const cart = removedNotices.length > 0 ? { ...mapped, notices: [...mapped.notices, ...removedNotices] } : mapped;

    const warned = cartErrorFromWarnings(cleaned.warnings, cart);
    if (warned) return { ok: false, error: warned.error, cart: { ...cart, notices: [...cart.notices, ...warned.notices] } };
    const removedVariants = new Set(cleaned.removed.map((line) => line.merchandise?.id));
    if (requested.length > 0 && requested.every((id) => removedVariants.has(id))) return { ok: false, error: "unavailable", cart };
    return { ok: true, cart };
  }

  /**
   * After a mutation on an existing cart. With a cart in the answer: that answer. Without one, the cart may be gone
   * (expired, checked out): then `whenGone` decides; otherwise the refusal with the current cart.
   */
  async function settle(
    cartId: string,
    payload: ShopifyCartPayload | null | undefined,
    whenGone: () => Promise<CartOutcome>,
    requested: readonly string[] = [],
  ): Promise<{ outcome: CartOutcome; cart: ShopifyCart | null }> {
    if (payload?.cart) return { outcome: { result: await fromPayload(payload, null, requested) }, cart: payload.cart };
    const existing = await fetchCart(cartId);
    if (existing) return { outcome: { result: await fromPayload(payload, map(existing), requested) }, cart: null };
    return { outcome: await whenGone(), cart: null };
  }

  async function create(input: Record<string, unknown>, requested: readonly string[] = []): Promise<CartOutcome> {
    const data = await requestOnce<CartCreateData>(CART_CREATE_MUTATION, { input: { ...input, buyerIdentity: { countryCode: "NL" } } });
    const payload = data.cartCreate;
    return { result: await fromPayload(payload, null, requested), ...(payload?.cart ? { cookie: payload.cart.id } : {}) };
  }

  const gone = (): Promise<CartOutcome> => Promise.resolve({ ...ok(null), cookie: null });

  /** Without physical products the gift wrap goes; with them it stays at quantity 1. Null when nothing changes. */
  async function tidyGiftWrap(cartId: string, cart: ShopifyCart): Promise<CartOutcome | null> {
    const lines = cart.lines.nodes.filter((line) => typeof line.merchandise?.id === "string");
    const wraps = lines.filter(isWrapLine);
    if (wraps.length === 0) return null;
    const hasPhysical = lines.some((line) => !isWrapLine(line) && line.merchandise.product.isGiftCard !== true);
    const surplus = hasPhysical ? wraps.slice(1) : wraps;
    const keep = hasPhysical ? wraps[0] : null;

    let latest: ShopifyCartPayload | null | undefined = null;
    if (surplus.length > 0) {
      latest = (await request<CartLinesRemoveData>(CART_LINES_REMOVE_MUTATION, { cartId, lineIds: surplus.map((line) => line.id) }))
        .cartLinesRemove;
    }
    if (keep && keep.quantity !== 1) {
      latest = (await request<CartLinesUpdateData>(CART_LINES_UPDATE_MUTATION, { cartId, lines: [{ id: keep.id, quantity: 1 }] }))
        .cartLinesUpdate;
    }
    return latest ? { result: await fromPayload(latest, map(cart)) } : null;
  }

  /** A result of update or remove, followed by the gift wrap rule. */
  async function withTidyGiftWrap(cartId: string, settled: { outcome: CartOutcome; cart: ShopifyCart | null }): Promise<CartOutcome> {
    if (!settled.cart || !settled.outcome.result.ok) return settled.outcome;
    return (await tidyGiftWrap(cartId, settled.cart)) ?? settled.outcome;
  }

  async function add(lines: CartLineInput[]): Promise<CartOutcome> {
    const ids = [...new Set(lines.map((line) => line.variantId))];
    const gate = await request<VariantGateData>(VARIANT_GATE_QUERY, { ids });
    const variants = new Map<string, ShopifyGateVariant>();
    for (const node of gate.nodes ?? []) if (isGateVariant(node)) variants.set(node.id, node);

    const gateContext = await ctx.gate();
    const items: GateItem[] = [];
    for (const id of ids) {
      const variant = variants.get(id);
      // Unknown variant, or the gift wrap (only through op "giftWrap").
      if (!variant || isGiftWrapProduct(variant.product)) return fail("invalid");
      items.push(gateItemFor(id, { handle: variant.product.handle, dropSlugs: parseTags(variant.product.tags).drops }, gateContext.drops));
    }
    if (!canAddToCart(items, gateContext).ok) return fail("not-yet-available");

    const input = lines.map((line) => ({
      merchandiseId: line.variantId,
      quantity: line.quantity,
      ...(line.attributes?.length ? { attributes: line.attributes } : {}),
    }));
    const cartId = ctx.cartId;
    if (!cartId) return create({ lines: input }, ids);
    const data = await requestOnce<CartLinesAddData>(CART_LINES_ADD_MUTATION, { cartId, lines: input });
    return (await settle(cartId, data.cartLinesAdd, () => create({ lines: input }, ids), ids)).outcome;
  }

  async function update(lines: Array<{ lineId: string; quantity: number }>): Promise<CartOutcome> {
    const cartId = ctx.cartId;
    if (!cartId) return fail("invalid");
    const data = await request<CartLinesUpdateData>(CART_LINES_UPDATE_MUTATION, {
      cartId,
      lines: lines.map((line) => ({ id: line.lineId, quantity: line.quantity })),
    });
    return withTidyGiftWrap(cartId, await settle(cartId, data.cartLinesUpdate, gone));
  }

  async function remove(lineIds: string[]): Promise<CartOutcome> {
    const cartId = ctx.cartId;
    if (!cartId) return fail("invalid");
    const data = await request<CartLinesRemoveData>(CART_LINES_REMOVE_MUTATION, { cartId, lineIds });
    return withTidyGiftWrap(cartId, await settle(cartId, data.cartLinesRemove, gone));
  }

  async function discount(codes: string[]): Promise<CartOutcome> {
    const cartId = ctx.cartId;
    const recreate = () => (codes.length > 0 ? create({ discountCodes: codes }) : gone());
    if (!cartId) return codes.length > 0 ? create({ discountCodes: codes }) : ok(null);
    const data = await request<CartDiscountCodesUpdateData>(CART_DISCOUNT_CODES_UPDATE_MUTATION, { cartId, discountCodes: codes });
    return (await settle(cartId, data.cartDiscountCodesUpdate, recreate)).outcome;
  }

  async function note(raw: string): Promise<CartOutcome> {
    const text = cleanNote(raw);
    const cartId = ctx.cartId;
    const recreate = () => (text ? create({ note: text }) : gone());
    if (!cartId) return text ? create({ note: text }) : ok(null);
    const data = await request<CartNoteUpdateData>(CART_NOTE_UPDATE_MUTATION, { cartId, note: text });
    return (await settle(cartId, data.cartNoteUpdate, recreate)).outcome;
  }

  async function setGiftWrap(enabled: boolean): Promise<CartOutcome> {
    const cartId = ctx.cartId;
    if (!cartId) return enabled ? fail("invalid") : ok(null);
    const current = await fetchCart(cartId);
    if (!current) return { ...(enabled ? fail("invalid") : ok(null)), cookie: null };
    const mapped = map(current);
    const wraps = current.lines.nodes.filter((line) => typeof line.merchandise?.id === "string" && isWrapLine(line));

    if (!enabled) {
      if (wraps.length === 0) return ok(mapped);
      const data = await request<CartLinesRemoveData>(CART_LINES_REMOVE_MUTATION, { cartId, lineIds: wraps.map((line) => line.id) });
      return { result: await fromPayload(data.cartLinesRemove, mapped) };
    }
    if (!mapped.giftWrap.available) return fail("invalid", mapped);
    if (wraps.length > 0) return (await tidyGiftWrap(cartId, current)) ?? ok(mapped);

    const variant = await giftWrapVariant();
    if (!variant || !variant.available) return fail("unavailable", mapped);
    const data = await requestOnce<CartLinesAddData>(CART_LINES_ADD_MUTATION, {
      cartId,
      lines: [{ merchandiseId: variant.id, quantity: 1 }],
    });
    return { result: await fromPayload(data.cartLinesAdd, mapped, [variant.id]) };
  }

  async function read(): Promise<CartOutcome> {
    if (!ctx.cartId) return ok(null);
    const cart = await fetchCart(ctx.cartId);
    return cart ? ok(map(cart)) : { ...ok(null), cookie: null };
  }

  return { add, update, remove, discount, note, setGiftWrap, read };
}

/** GET /api/cart: the current cart, or null without a cookie; a cart that no longer exists clears the cookie. */
export function readCart(ctx: CartRequestContext): Promise<CartOutcome> {
  return session(ctx).read();
}

/** POST /api/cart: one validated CartRequest. */
export function runCartRequest(request: CartRequest, ctx: CartRequestContext): Promise<CartOutcome> {
  const ops = session(ctx);
  switch (request.op) {
    case "add":
      return ops.add(request.lines);
    case "update":
      return ops.update(request.lines);
    case "remove":
      return ops.remove(request.lineIds);
    case "discount":
      return ops.discount(request.codes);
    case "giftWrap":
      return ops.setGiftWrap(request.enabled);
    case "note":
      return ops.note(request.note);
  }
}
