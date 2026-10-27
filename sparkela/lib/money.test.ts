import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { cents, formatMoney, formatMoneyRange, formatMoneyShort, money, parseShopifyMoney } from "@/lib/money";
import { sharedCopy } from "@/content/copy/shared";

const MINUS = "−";

describe("formatMoney (§8.5)", () => {
  it.each([
    [1495, "€14,95"],
    [3500, "€35,00"],
    [0, "€0,00"],
    [123450, "€1.234,50"],
    [-224, `${MINUS}€2,24`],
  ])("%i → %s", (input, expected) => {
    expect(formatMoney(input)).toBe(expected);
  });

  it("uses a real minus sign (U+2212), never a hyphen", () => {
    const text = formatMoney(-897);
    expect(text).toBe("−€8,97");
    expect(text.codePointAt(0)).toBe(0x2212);
    expect(text).not.toContain("-");
  });

  it("pads cents and groups thousands with dots", () => {
    expect(formatMoney(5)).toBe("€0,05");
    expect(formatMoney(10)).toBe("€0,10");
    expect(formatMoney(100000)).toBe("€1.000,00");
    expect(formatMoney(123456789)).toBe("€1.234.567,89");
    expect(formatMoney(-100000)).toBe(`${MINUS}€1.000,00`);
  });

  it("accepts Money as well as cents", () => {
    expect(formatMoney({ cents: 2495, currency: "EUR" })).toBe("€24,95");
    expect(formatMoney(money(195))).toBe("€1,95");
  });

  it("never prints spaces, so server and browser render the same text", () => {
    for (const value of [0, 1, 99, 1495, 3500, 123450, -224, -100000]) {
      expect(formatMoney(value)).not.toMatch(/\s/);
      expect(formatMoneyShort(value)).not.toMatch(/\s/);
    }
  });

  it("does not print a negative zero", () => {
    expect(formatMoney(-0)).toBe("€0,00");
  });

  it("rejects non-finite amounts", () => {
    expect(() => formatMoney(Number.NaN)).toThrow(RangeError);
    expect(() => formatMoney(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("formatMoneyShort (§8.5)", () => {
  it.each([
    [3500, "€35"],
    [1495, "€14,95"],
    [0, "€0"],
    [1500, "€15"],
    [100000, "€1.000"],
    [-3500, `${MINUS}€35`],
    [-224, `${MINUS}€2,24`],
  ])("%i → %s", (input, expected) => {
    expect(formatMoneyShort(input)).toBe(expected);
  });
});

describe("formatMoneyRange (§8.5)", () => {
  it("1500, 5000 → €15 tot €50", () => {
    expect(formatMoneyRange(1500, 5000)).toBe("€15 tot €50");
  });

  it("keeps decimals where an end has cents", () => {
    expect(formatMoneyRange(1295, 2995)).toBe("€12,95 tot €29,95");
  });

  it("gives one amount when both ends are equal", () => {
    expect(formatMoneyRange(1495, 1495)).toBe("€14,95");
    expect(formatMoneyRange(money(2500), money(2500))).toBe("€25");
  });

  it("takes the joining word from copy (sharedCopy.money, decision 183)", () => {
    expect(formatMoneyRange(1500, 5000)).toBe(`€15 ${sharedCopy.money.rangeJoiner} €50`);
  });
});

describe("parseShopifyMoney (§8.5)", () => {
  it.each([
    ["14.95", 1495],
    ["14.9", 1490],
    ["14", 1400],
    ["1234.50", 123450],
    ["0.0", 0],
    ["0.05", 5],
    ["  24.95 ", 2495],
    ["-2.24", -224],
  ])("%s → %i", (input, expected) => {
    expect(parseShopifyMoney(input)).toBe(expected);
  });

  it("is exact where float math is not", () => {
    // parseFloat("0.29") * 100 === 28.999999999999996; the string split never goes through floats.
    expect(parseShopifyMoney("0.29")).toBe(29);
    expect(parseShopifyMoney("1.15")).toBe(115);
    expect(parseShopifyMoney("4.35")).toBe(435);
    expect(parseShopifyMoney("19.99")).toBe(1999);
  });

  it("rounds a third decimal half away from zero", () => {
    expect(parseShopifyMoney("14.950")).toBe(1495);
    expect(parseShopifyMoney("14.954")).toBe(1495);
    expect(parseShopifyMoney("14.955")).toBe(1496);
    expect(parseShopifyMoney("-14.955")).toBe(-1496);
  });

  it("does not return a negative zero", () => {
    expect(Object.is(parseShopifyMoney("-0.00"), 0)).toBe(true);
  });

  it.each(["", "abc", "14,95", "€14.95", "1e3", "14.", ".95", "--1", "14.95.1", "NaN"])(
    "throws a TypeError for %j",
    (input) => {
      expect(() => parseShopifyMoney(input)).toThrow(TypeError);
    },
  );
});

describe("money and cents", () => {
  it("money(1495) → { cents: 1495, currency: EUR }", () => {
    expect(money(1495)).toEqual({ cents: 1495, currency: "EUR" });
  });

  it("cents() passes integers and rejects floats", () => {
    expect(cents(1495)).toBe(1495);
    expect(cents(-224)).toBe(-224);
    expect(() => cents(14.95)).toThrow(RangeError);
    expect(() => cents(Number.NaN)).toThrow(RangeError);
    expect(() => money(19.5)).toThrow(RangeError);
  });
});

describe("module rules", () => {
  it("does not depend on Intl or float parsing (§8.5)", () => {
    const source = readFileSync(fileURLToPath(new URL("./money.ts", import.meta.url)), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bIntl\b|toLocaleString|parseFloat|toFixed/);
  });
});
