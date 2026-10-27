import { parseTags } from "@/lib/catalog";
import { ShopifyError } from "@/lib/commerce/shopify/config";
import type { ShopifyCart, ShopifyCartLine, ShopifyDiscountAllocation } from "@/lib/commerce/shopify/mutations";
import type {
  CatalogProductsData,
  MetafieldKey,
  PredictiveSearchData,
  ShopifyImage,
  ShopifyMetafield,
  ShopifyMoney,
  ShopifyProduct,
  ShopifyVariant,
} from "@/lib/commerce/shopify/queries";
import { METAFIELD_NAMESPACE } from "@/lib/commerce/shopify/queries";
import { isGiftWrapFree } from "@/lib/dates";
import { money, parseShopifyMoney } from "@/lib/money";
import { DISCOUNT_TITLES, defaultPricingConfig, progressFromShopifyCart } from "@/lib/pricing";
import type {
  Cart,
  CartLine,
  CartNotice,
  DiscountApplication,
  DiscountCodeState,
  DiscountSource,
  ImageKind,
  Money,
  Product,
  ProductImage,
  ProductMetafields,
  ProductOption,
  ProductType,
  SelectedOption,
  SwatchId,
  Variant,
} from "@/lib/types";

/**
 * Shopify → domain (docs/PLAN.md §16.5, §6.4). Pure: no fetch, no clock (`now` comes in), no next/* imports, so
 * Vitest runs it on the saved responses in tests/fixtures/shopify/.
 *
 * - Tags through parseTags (lib/catalog.ts). An unknown value of a known prefix ("vibe:boho") is ignored with one
 *   console.warn per value.
 * - Amounts through parseShopifyMoney. Every amount must be EUR, otherwise ShopifyError("graphql"): a wrong market
 *   in Shopify must fail the build, never show wrong prices.
 * - Metafields: an invalid value (statement_meter 7, broken money JSON) becomes null (or false for the two manual
 *   flags) with one console.warn, and never breaks the build.
 * - Carts: the gift wrap line goes to `giftWrap`, not `lines`; `giftWrap.free` is isGiftWrapFree(now) for the
 *   label only, the amount is Shopify's. Line discounts by source: the automatic discount titled "Stack-korting" →
 *   stack, "Cadeauverpakking december" → cadeauverpakking, a code → code, anything else → overig. Shipping is
 *   "at-checkout" (decision 34) or "none" without a physical product. Totals are Shopify's; progress comes from
 *   progressFromShopifyCart. Nothing here computes a price or a discount.
 */

/* -------------------------------------------------------------------------- */
/* Warnings                                                                   */
/* -------------------------------------------------------------------------- */

const warned = new Set<string>();

/** One console.warn per key and process (the build logs each problem once). */
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

/** Tests only: forget which warnings were logged. */
export function resetMapperWarnings(): void {
  warned.clear();
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

const IMAGE_KINDS: readonly ImageKind[] = ["packshot", "draagfoto", "detail", "schaal", "stack"];

/** Kind of a product photo by position (plan §6.3): 0 packshot, 1 draagfoto, 2 detail, 3 schaal, 4 stack, else overig. */
export function imageKindForIndex(i: number): ImageKind {
  return (Number.isInteger(i) && i >= 0 ? IMAGE_KINDS[i] : undefined) ?? "overig";
}

/** A Shopify amount in EUR as Money; anything else (another currency, a broken amount) is ShopifyError("graphql"). */
export function moneyFromShopify(value: ShopifyMoney, what: string): Money {
  if (value?.currencyCode !== "EUR") {
    throw new ShopifyError("graphql", `Expected EUR for ${what}, got ${String(value?.currencyCode)}. Check the market of the store.`);
  }
  try {
    return money(parseShopifyMoney(String(value.amount)));
  } catch {
    throw new ShopifyError("graphql", `Unreadable amount for ${what}.`);
  }
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

/** Shopify's placeholder option of a product without options. */
const DEFAULT_OPTION_VALUE = "Default Title";

function mapImage(image: ShopifyImage, kind: ImageKind): ProductImage {
  return {
    url: image.url,
    alt: image.altText?.trim() ?? "",
    width: typeof image.width === "number" && image.width > 0 ? image.width : 0,
    height: typeof image.height === "number" && image.height > 0 ? image.height : 0,
    kind,
  };
}

function swatchOf(options: readonly SelectedOption[]): SwatchId | null {
  for (const option of options) {
    const value = option.value.trim().toLowerCase();
    if (value === "goud") return "goud";
    if (value === "zilver") return "zilver";
  }
  return null;
}

/** The product type from the tags; a Shopify gift card without a "type:" tag is still a gift card. */
export function productTypeOf(tags: readonly string[], isGiftCard: boolean): ProductType | null {
  return parseTags(tags).type ?? (isGiftCard ? "cadeaukaart" : null);
}

/* -------------------------------------------------------------------------- */
/* Metafields                                                                 */
/* -------------------------------------------------------------------------- */

const EMPTY_METAFIELDS: ProductMetafields = {
  specRegel: null,
  materiaal: null,
  afmetingen: null,
  gewicht: null,
  sluiting: null,
  verzorging: null,
  statementMeter: null,
  nikkelvrij: null,
  gpsrFabrikant: null,
  gpsrVerantwoordelijkeEu: null,
  gpsrWaarschuwingen: null,
  laagstePrijs30d: null,
  bestseller: false,
  lindesFavoriet: false,
};

function invalidMetafield(key: MetafieldKey, context: string | undefined): void {
  const where = context ? ` on "${context}"` : "";
  warnOnce(`metafield:${context ?? ""}:${key}`, `[shopify] Invalid value of metafield custom.${key}${where}; ignored.`);
}

function parseBoolean(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function parseMoneyJson(value: string): Money | null {
  try {
    const data: unknown = JSON.parse(value);
    if (typeof data !== "object" || data === null) return null;
    const record = data as Record<string, unknown>;
    const currency = record.currency_code ?? record.currencyCode;
    const amount = record.amount;
    if (currency !== "EUR" || (typeof amount !== "string" && typeof amount !== "number")) return null;
    const cents = parseShopifyMoney(String(amount));
    return cents > 0 ? money(cents) : null;
  } catch {
    return null;
  }
}

/**
 * Metafields of plan §6.4 by key (namespace "custom"). Missing → null (false for bestseller and lindes_favoriet).
 * Invalid → the same, with one console.warn per product and key. `context` (the product handle) only names the
 * product in that warning.
 */
export function mapMetafields(nodes: ReadonlyArray<ShopifyMetafield | null> | null | undefined, context?: string): ProductMetafields {
  const byKey = new Map<string, string>();
  for (const node of nodes ?? []) {
    if (node && node.namespace === METAFIELD_NAMESPACE && typeof node.value === "string") byKey.set(node.key, node.value);
  }
  const result: ProductMetafields = { ...EMPTY_METAFIELDS };
  const text = (key: MetafieldKey): string | null => nonEmpty(byKey.get(key));

  result.specRegel = text("spec_regel");
  result.materiaal = text("materiaal");
  result.afmetingen = text("afmetingen");
  result.gewicht = text("gewicht");
  result.sluiting = text("sluiting");
  result.verzorging = text("verzorging");
  result.gpsrFabrikant = text("gpsr_fabrikant");
  result.gpsrVerantwoordelijkeEu = text("gpsr_verantwoordelijke_eu");
  result.gpsrWaarschuwingen = text("gpsr_waarschuwingen");

  const meter = text("statement_meter");
  if (meter !== null) {
    const value = /^-?\d+$/.test(meter) ? Number(meter) : Number.NaN;
    if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) result.statementMeter = value;
    else invalidMetafield("statement_meter", context);
  }

  const booleans = [
    ["nikkelvrij", "nikkelvrij"],
    ["bestseller", "bestseller"],
    ["lindes_favoriet", "lindesFavoriet"],
  ] as const;
  for (const [key, field] of booleans) {
    const raw = text(key);
    if (raw === null) continue;
    const value = parseBoolean(raw);
    if (value === null) {
      invalidMetafield(key, context);
      continue;
    }
    if (field === "nikkelvrij") result.nikkelvrij = value;
    else result[field] = value;
  }

  const lowest = text("laagste_prijs_30d");
  if (lowest !== null) {
    result.laagstePrijs30d = parseMoneyJson(lowest);
    if (result.laagstePrijs30d === null) invalidMetafield("laagste_prijs_30d", context);
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

function mapOptions(node: ShopifyProduct): ProductOption[] {
  return (node.options ?? [])
    .map((option) => ({ name: option.name, values: (option.optionValues ?? []).map((value) => value.name) }))
    .filter((option) => !(option.values.length <= 1 && (option.values[0] ?? DEFAULT_OPTION_VALUE) === DEFAULT_OPTION_VALUE));
}

function mapVariant(variant: ShopifyVariant, handle: string, images: readonly ProductImage[]): Variant {
  const selectedOptions = (variant.selectedOptions ?? [])
    .filter((option) => option.value !== DEFAULT_OPTION_VALUE)
    .map((option) => ({ name: option.name, value: option.value }));
  const known = variant.image ? images.find((image) => image.url === variant.image?.url) : undefined;
  const quantity = variant.quantityAvailable;
  return {
    id: variant.id,
    title: variant.title,
    sku: nonEmpty(variant.sku),
    availableForSale: variant.availableForSale === true,
    quantityAvailable: typeof quantity === "number" && Number.isFinite(quantity) ? Math.max(0, Math.trunc(quantity)) : null,
    price: moneyFromShopify(variant.price, `the price of ${handle}`),
    compareAtPrice: variant.compareAtPrice ? moneyFromShopify(variant.compareAtPrice, `the compare-at price of ${handle}`) : null,
    selectedOptions,
    swatch: swatchOf(selectedOptions),
    image: variant.image ? mapImage(variant.image, known?.kind ?? "packshot") : null,
  };
}

/**
 * A Storefront product as a domain product. `featuredRank` is its position in the collection "alle" (1 = first);
 * products outside "alle" get a rank after the last listed product. Throws ShopifyError("graphql") for a product
 * without variants or with an amount that is not EUR.
 */
export function mapProduct(node: ShopifyProduct, featuredRank: number): Product {
  const tags = parseTags(node.tags ?? [], (tag) =>
    warnOnce(`tag:${tag}`, `[shopify] Unknown tag "${tag}" ignored (first seen on "${node.handle}").`),
  );
  const variantNodes = node.variants?.nodes ?? [];
  if (variantNodes.length === 0) throw new ShopifyError("graphql", `Product "${node.handle}" has no variants.`);

  const images = (node.images?.nodes ?? []).map((image, index) => mapImage(image, imageKindForIndex(index)));
  const variants = variantNodes.map((variant) => mapVariant(variant, node.handle, images));
  const quantities = variants.map((variant) => variant.quantityAvailable);
  const type = tags.type ?? (node.isGiftCard ? "cadeaukaart" : null);

  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    description: node.description ?? "",
    type,
    tags,
    metafields: mapMetafields(node.metafields, node.handle),
    images,
    variants,
    options: mapOptions(node),
    priceRange: {
      min: moneyFromShopify(node.priceRange.minVariantPrice, `the price range of ${node.handle}`),
      max: moneyFromShopify(node.priceRange.maxVariantPrice, `the price range of ${node.handle}`),
    },
    availableForSale: node.availableForSale === true,
    totalQuantityAvailable: quantities.some((quantity) => quantity === null)
      ? null
      : quantities.reduce<number>((sum, quantity) => sum + (quantity ?? 0), 0),
    isGiftCard: node.isGiftCard === true,
    isGiftWrap: type === "cadeauverpakking",
    publishedAt: node.publishedAt,
    featuredRank,
    seo: { title: nonEmpty(node.seo?.title), description: nonEmpty(node.seo?.description) },
  };
}

/**
 * One CatalogProducts page. `collection: null` (the collection "alle" does not exist yet, before the import) gives
 * no products and `missing: true`; the catalog provider warns once and the build still succeeds (plan §7.7).
 */
export function mapCatalogPage(
  data: CatalogProductsData,
  firstRank: number,
): { products: Product[]; hasNextPage: boolean; endCursor: string | null; missing: boolean } {
  const connection = data.collection?.products;
  if (!connection) return { products: [], hasNextPage: false, endCursor: null, missing: data.collection == null };
  return {
    products: connection.nodes.map((node, index) => mapProduct(node, firstRank + index)),
    hasNextPage: connection.pageInfo.hasNextPage === true,
    endCursor: connection.pageInfo.endCursor ?? null,
    missing: false,
  };
}

/** Handles of a PredictiveSearch answer, best match first, without duplicates. */
export function mapSearchHandles(data: PredictiveSearchData): string[] {
  const handles = (data.predictiveSearch?.products ?? []).map((product) => product.handle).filter((handle) => !!handle);
  return [...new Set(handles)];
}

/* -------------------------------------------------------------------------- */
/* Carts                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Exact titles of the automatic discounts in Shopify (plan §16.5, §16.6; docs/METAFIELDS.md). Configuration keys, not
 * visible copy. The gift wrap title is sharedCopy.discounts.giftWrap, which must equal Shopify's title (decision 180);
 * Shopify's stack title has no percentage ("Stack-korting"), a title that starts with it also counts.
 */
export const SHOPIFY_DISCOUNT_TITLES = { stack: "Stack-korting", giftWrap: DISCOUNT_TITLES.giftWrap } as const;

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

interface ClassifiedAllocation {
  source: DiscountSource;
  kind: "automatic" | "code";
  /** Code for "code", Shopify's title for "overig". */
  label: string;
  amount: Money;
}

/** Where a line allocation comes from: code → "code"; "Stack-korting…" → stack; "Cadeauverpakking december" → cadeauverpakking. */
export function discountSourceOf(allocation: Pick<ShopifyDiscountAllocation, "title" | "code">): DiscountSource {
  if (nonEmpty(allocation.code)) return "code";
  const title = normalizeTitle(allocation.title ?? "");
  if (title.startsWith(normalizeTitle(SHOPIFY_DISCOUNT_TITLES.stack))) return "stack";
  if (title === normalizeTitle(SHOPIFY_DISCOUNT_TITLES.giftWrap)) return "cadeauverpakking";
  return "overig";
}

function classify(allocation: ShopifyDiscountAllocation, what: string): ClassifiedAllocation {
  const source = discountSourceOf(allocation);
  const code = nonEmpty(allocation.code);
  return {
    source,
    kind: source === "code" ? "code" : "automatic",
    label: code ?? nonEmpty(allocation.title) ?? "",
    amount: moneyFromShopify(allocation.discountedAmount, what),
  };
}

interface ParsedLine {
  line: ShopifyCartLine;
  type: ProductType | null;
  isGiftCard: boolean;
  isGiftWrap: boolean;
  unitPrice: Money;
  subtotal: Money;
  allocations: ClassifiedAllocation[];
}

function isVariantLine(line: ShopifyCartLine): boolean {
  const merchandise = line?.merchandise as Partial<ShopifyCartLine["merchandise"]> | undefined;
  return typeof merchandise?.id === "string" && typeof merchandise.product?.handle === "string";
}

function sumCents(values: readonly Money[]): number {
  return values.reduce((sum, value) => sum + value.cents, 0);
}

function parseLine(line: ShopifyCartLine, giftWrapVariantId: string | null): ParsedLine {
  const { merchandise } = line;
  const isGiftCard = merchandise.product.isGiftCard === true;
  const type = productTypeOf(merchandise.product.tags ?? [], isGiftCard);
  const what = `cart line ${merchandise.product.handle}`;
  return {
    line,
    type,
    isGiftCard,
    isGiftWrap: (giftWrapVariantId !== null && merchandise.id === giftWrapVariantId) || type === "cadeauverpakking",
    unitPrice: moneyFromShopify(line.cost.amountPerQuantity, what),
    subtotal: moneyFromShopify(line.cost.subtotalAmount, what),
    allocations: (line.discountAllocations ?? [])
      .filter((allocation) => allocation.targetType !== "SHIPPING_LINE")
      .map((allocation) => classify(allocation, `a discount on ${what}`))
      .filter((allocation) => allocation.amount.cents > 0),
  };
}

/** Line discounts summed per source, in the order they first appear. */
function lineDiscounts(allocations: readonly ClassifiedAllocation[]): CartLine["discounts"] {
  const totals = new Map<DiscountSource, number>();
  for (const allocation of allocations) totals.set(allocation.source, (totals.get(allocation.source) ?? 0) + allocation.amount.cents);
  return [...totals].map(([source, cents]) => ({ source, amount: money(cents) }));
}

function toCartLine(parsed: ParsedLine): CartLine {
  const { line } = parsed;
  const discount = sumCents(parsed.allocations.map((allocation) => allocation.amount));
  const variantTitle = line.merchandise.title === DEFAULT_OPTION_VALUE ? null : nonEmpty(line.merchandise.title);
  return {
    id: line.id,
    merchandise: {
      variantId: line.merchandise.id,
      productId: line.merchandise.product.id,
      productHandle: line.merchandise.product.handle,
      productTitle: line.merchandise.product.title,
      variantTitle,
      image: line.merchandise.image ? mapImage(line.merchandise.image, "packshot") : null,
      type: parsed.type,
      isGiftCard: parsed.isGiftCard,
      isGiftWrap: false,
      quantityAvailable: typeof line.merchandise.quantityAvailable === "number" ? line.merchandise.quantityAvailable : null,
    },
    quantity: line.quantity,
    unitPrice: parsed.unitPrice,
    subtotal: parsed.subtotal,
    discounts: lineDiscounts(parsed.allocations),
    total: money(Math.max(0, parsed.subtotal.cents - discount)),
    attributes: (line.attributes ?? []).map((attribute) => ({ key: attribute.key, value: attribute.value ?? "" })),
  };
}

function applicationTitle(source: DiscountSource, label: string): string {
  if (source === "stack") return DISCOUNT_TITLES.stack(defaultPricingConfig.stack.percent);
  if (source === "cadeauverpakking") return DISCOUNT_TITLES.giftWrap;
  return label || DISCOUNT_TITLES.other;
}

/** Cart-level discounts: one entry per source (per code or title for code and overig), summed over every line. */
function applications(lines: readonly ParsedLine[]): DiscountApplication[] {
  const grouped = new Map<string, DiscountApplication>();
  for (const allocation of lines.flatMap((line) => line.allocations)) {
    const key = allocation.source === "code" || allocation.source === "overig" ? `${allocation.source}:${allocation.label}` : allocation.source;
    const existing = grouped.get(key);
    if (existing) {
      existing.amount = money(existing.amount.cents + allocation.amount.cents);
      continue;
    }
    grouped.set(key, {
      source: allocation.source,
      kind: allocation.kind,
      title: applicationTitle(allocation.source, allocation.label),
      code: allocation.source === "code" ? allocation.label : null,
      amount: allocation.amount,
    });
  }
  return [...grouped.values()];
}

/**
 * A Shopify cart as a domain Cart (provider "shopify"). The gift wrap line is reported through `giftWrap`, never in
 * `lines`. Every amount is Shopify's: merchandise = the line subtotals (gift wrap included), discounts = every line
 * allocation (also order discounts spread over the lines), total = cart.cost.totalAmount. The free-shipping basis is
 * that total without gift card lines (the same basis as progressFromShopifyCart). A code that does not apply while
 * the stack discount does gets reason "not-combinable" and the notice code-not-combined (Shopify picks the higher
 * discount, plan §16.6); without a stack discount Shopify gives no reason (null).
 */
export function mapCart(node: ShopifyCart, ctx: { giftWrapVariantId: string | null; now: number }): Cart {
  const parsed = (node.lines?.nodes ?? []).filter(isVariantLine).map((line) => parseLine(line, ctx.giftWrapVariantId));
  const regular = parsed.filter((line) => !line.isGiftWrap);
  const wrap = parsed.find((line) => line.isGiftWrap) ?? null;
  const lines = regular.map(toCartLine);

  const discounts = applications(parsed);
  const stackApplied = discounts.some((discount) => discount.source === "stack" && discount.amount.cents > 0);
  const discountCodes: DiscountCodeState[] = (node.discountCodes ?? []).map((code) => ({
    code: code.code,
    applicable: code.applicable === true,
    reason: code.applicable ? "ok" : stackApplied ? "not-combinable" : null,
  }));
  const notices: CartNotice[] = discountCodes
    .filter((code) => code.reason === "not-combinable")
    .map((code) => ({ kind: "code-not-combined", code: code.code }));

  const hasPhysical = regular.some((line) => !line.isGiftCard);
  const merchandise = sumCents(parsed.map((line) => line.subtotal));
  const discountTotal = sumCents(discounts.map((discount) => discount.amount));
  const total = moneyFromShopify(node.cost.totalAmount, "the cart total");
  const giftCards = sumCents(lines.filter((line) => line.merchandise.isGiftCard).map((line) => line.total));

  const base: Omit<Cart, "progress"> = {
    id: node.id,
    provider: "shopify",
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    discountCodes,
    discounts,
    totals: {
      merchandise: money(merchandise),
      discounts: money(discountTotal),
      freeShippingBasis: money(Math.max(0, total.cents - giftCards)),
      shipping: hasPhysical ? { kind: "at-checkout" } : { kind: "none" },
      total,
      savings: money(discountTotal),
    },
    giftWrap: {
      selected: wrap !== null,
      free: isGiftWrapFree(ctx.now),
      price: wrap ? wrap.unitPrice : defaultPricingConfig.giftWrap.price,
      lineId: wrap?.line.id ?? null,
      available: hasPhysical,
    },
    note: node.note ?? "",
    checkoutUrl: node.checkoutUrl,
    notices,
  };
  return { ...base, progress: progressFromShopifyCart(base) };
}
