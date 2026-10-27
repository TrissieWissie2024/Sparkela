import type { Cents, Money } from "@/lib/types";
import { moneyCopy } from "@/content/copy/money";

/**
 * Money formatting and parsing (docs/PLAN.md §8.5). Pure and deterministic.
 *
 * No Intl on purpose: Node and browsers format "nl-NL" currency differently ("€ 14,95" with a no-break space,
 * "€ -2,50"), which would give hydration mismatches and does not match the brief ("€14,95", "€35").
 * Here: "€14,95", "€1.234,50", short "€35", negative "−€2,24" with a real minus sign (U+2212).
 *
 * Only lib/pricing.ts computes with amounts; this module only formats, parses and wraps them.
 */

const EURO = "€";
const MINUS = "−";

function toCents(value: Cents | Money): Cents {
  const amount = typeof value === "number" ? value : value.cents;
  if (!Number.isFinite(amount)) throw new RangeError(`Not a finite amount of cents: ${String(amount)}`);
  // Amounts are integer cents by contract; round defensively so a stray float never prints "€14,949999".
  return Math.round(amount);
}

/** "1234567" → "1.234.567" (Dutch thousands separator). */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function format(value: Cents | Money, short: boolean): string {
  const amount = toCents(value);
  const abs = Math.abs(amount);
  const euros = groupThousands(String(Math.floor(abs / 100)));
  const rest = abs % 100;
  const body = short && rest === 0 ? `${EURO}${euros}` : `${EURO}${euros},${String(rest).padStart(2, "0")}`;
  return amount < 0 ? `${MINUS}${body}` : body;
}

/** 1495 → "€14,95", 3500 → "€35,00", 0 → "€0,00", 123450 → "€1.234,50", -224 → "−€2,24". Accepts cents or Money. */
export function formatMoney(value: Cents | Money): string {
  return format(value, false);
}

/** Whole euros without decimals: 3500 → "€35"; anything else as formatMoney: 1495 → "€14,95". */
export function formatMoneyShort(value: Cents | Money): string {
  return format(value, true);
}

/**
 * 1500, 5000 → "€15 tot €50" (short form on both ends). Equal ends give a single amount. The joining word is copy
 * (sharedCopy.money.rangeJoiner, read from content/copy/money.ts to avoid an import cycle; decision 183).
 */
export function formatMoneyRange(min: Cents | Money, max: Cents | Money): string {
  const low = formatMoneyShort(min);
  const high = formatMoneyShort(max);
  return low === high ? low : `${low} ${moneyCopy.rangeJoiner} ${high}`;
}

const SHOPIFY_AMOUNT = /^(-?)(\d+)(?:\.(\d+))?$/;

/**
 * Shopify decimal amount → integer cents, by splitting the string (never parseFloat):
 * "14.95" → 1495, "14.9" → 1490, "14" → 1400, "1234.50" → 123450, "-2.24" → -224.
 * More than two decimals round half away from zero ("14.955" → 1496; Shopify sends at most two for EUR).
 * Throws a TypeError for anything that is not a plain decimal string, so callers (the Shopify mappers) can turn
 * a broken value into null with one warning.
 */
export function parseShopifyMoney(amount: string): Cents {
  const match = SHOPIFY_AMOUNT.exec(amount.trim());
  if (!match) throw new TypeError(`Not a Shopify money amount: "${amount}"`);
  const [, sign, whole, fraction = ""] = match;
  const twoDigits = (fraction + "00").slice(0, 2);
  const roundUp = fraction.length > 2 && fraction.charCodeAt(2) >= "5".charCodeAt(0);
  const magnitude = Number(whole) * 100 + Number(twoDigits) + (roundUp ? 1 : 0);
  if (!Number.isSafeInteger(magnitude)) throw new RangeError(`Shopify money amount out of range: "${amount}"`);
  return sign === "-" && magnitude !== 0 ? -magnitude : magnitude;
}

/**
 * Asserts an integer amount of cents and returns it, for literals and values that cross a boundary
 * (content, JSON, URL state): cents(1495) → 1495, cents(14.95) throws.
 */
export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Cents must be a safe integer, got ${String(value)}`);
  return value;
}

/** 1495 → { cents: 1495, currency: "EUR" }. */
export function money(value: Cents): Money {
  return { cents: cents(value), currency: "EUR" };
}
