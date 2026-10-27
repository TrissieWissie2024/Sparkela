/**
 * Rows of the ring size guide (docs/PLAN.md §13.9 RingSizeGuide): the size is the inside diameter in millimetres
 * (Nina and Vera come in 16 to 19), the circumference is π × diameter, rounded to one decimal. Pure; the values come
 * from the product's own size option, so the table always matches the sizes that can be bought.
 */

export interface RingSizeRow {
  /** The option value as the product names it: "17". */
  size: string;
  /** "17,0". */
  diameter: string;
  /** "53,4". */
  circumference: string;
}

/** "16" or "16,5" or "16.5" → 16.5; null for anything that is not a size in millimetres. */
export function parseRingSize(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,2}(?:\.\d)?$/.test(normalized)) return null;
  const size = Number(normalized);
  return size >= 10 && size <= 30 ? size : null;
}

/** One decimal with a Dutch comma, without Intl (server and browser format the same). */
export function formatOneDecimal(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1).replace(".", ",");
}

/** Rows for the size values of a ring, in the order given; values that are not sizes are left out. */
export function ringSizeRows(values: readonly string[]): RingSizeRow[] {
  const rows: RingSizeRow[] = [];
  for (const value of values) {
    const size = parseRingSize(value);
    if (size === null) continue;
    rows.push({ size: value.trim(), diameter: formatOneDecimal(size), circumference: formatOneDecimal(Math.PI * size) });
  }
  return rows;
}
