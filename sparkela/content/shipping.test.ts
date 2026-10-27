import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import { sharedCopy } from "@/content/copy/shared";
import { shipping } from "@/content/shipping";
import { site } from "@/content/site";

/**
 * content/shipping.ts against brief §4 and plan §9.3. The holiday list is recomputed from the calendar rules here
 * (Easter with the anonymous Gregorian algorithm), so a typo in a date fails the build instead of shipping on a
 * holiday. lib/holidays.test.ts (B3) checks the same list against lib/holidays.ts; this test does not import it, so
 * the data has its own check that does not depend on the logic under test.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const CLOCK_CALL = /\bDate\s*\.\s*now\s*\(|\bnew\s+Date\s*\(/;
const source = readFileSync(fileURLToPath(new URL("./shipping.ts", import.meta.url)), "utf8");

const isoFromUtc = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(ms);

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return isoFromUtc(Date.UTC(year, month - 1, day) + days * DAY_MS);
}

/** ISO weekday, 1 = Monday ... 7 = Sunday. */
function isoWeekday(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  const daysSinceEpoch = Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
  // 1970-01-01 was a Thursday (ISO weekday 4).
  return ((((daysSinceEpoch + 3) % 7) + 7) % 7) + 1;
}

/** Easter Sunday (Gregorian), anonymous algorithm (Meeus/Jones/Butcher). */
function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Dispatch-closed days of one year (decision 54): New Year's Day, Easter (both days), King's Day (26 April when
 * 27 April is a Sunday), Ascension Day, Whitsun (both days), Christmas (both days). Good Friday, Christmas Eve and
 * New Year's Eve are working days; Liberation Day is only off in lustrum years (2025, 2030).
 */
function dutchHolidays(year: number): Array<{ date: string; name: string }> {
  const easter = easterSunday(year);
  const kingsDay = isoWeekday(`${year}-04-27`) === 7 ? `${year}-04-26` : `${year}-04-27`;
  const list = [
    { date: `${year}-01-01`, name: "Nieuwjaarsdag" },
    { date: easter, name: "Eerste paasdag" },
    { date: addDays(easter, 1), name: "Tweede paasdag" },
    { date: kingsDay, name: "Koningsdag" },
    { date: addDays(easter, 39), name: "Hemelvaartsdag" },
    { date: addDays(easter, 49), name: "Eerste pinksterdag" },
    { date: addDays(easter, 50), name: "Tweede pinksterdag" },
    { date: `${year}-12-25`, name: "Eerste kerstdag" },
    { date: `${year}-12-26`, name: "Tweede kerstdag" },
  ];
  if (year % 5 === 0) list.push({ date: `${year}-05-05`, name: "Bevrijdingsdag" });
  return list.sort((x, y) => x.date.localeCompare(y.date));
}

describe("calendar helpers of this test", () => {
  it("computes known Easter dates and weekdays", () => {
    expect([2024, 2025, 2026, 2027, 2028, 2030].map(easterSunday)).toEqual([
      "2024-03-31",
      "2025-04-20",
      "2026-04-05",
      "2027-03-28",
      "2028-04-16",
      "2030-04-21",
    ]);
    expect(isoWeekday("2026-11-27")).toBe(5);
    expect(isoWeekday("2026-11-29")).toBe(7);
    expect(isoWeekday("2026-11-30")).toBe(1);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("holidays (plan §9.3, decision 54)", () => {
  it("lists every dispatch-closed day of 2026 and 2027, plus New Year's Day 2028", () => {
    const expected = [...dutchHolidays(2026), ...dutchHolidays(2027), { date: "2028-01-01", name: "Nieuwjaarsdag" }];
    expect(shipping.holidays).toEqual(expected);
  });

  it("keeps the list sorted, unique and in YYYY-MM-DD", () => {
    const dates = shipping.holidays.map((holiday) => holiday.date);
    for (const date of dates) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(addDays(date, 0), date).toBe(date);
    }
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("ships on Good Friday, Liberation Day 2026 and 2027, Christmas Eve and New Year's Eve", () => {
    const closed = new Set(shipping.holidays.map((holiday) => holiday.date));
    for (const date of ["2026-04-03", "2026-05-05", "2026-12-24", "2026-12-31", "2027-03-26", "2027-05-05", "2027-12-24", "2027-12-31"]) {
      expect(closed.has(date), date).toBe(false);
    }
  });

  it("starts without extra closures", () => {
    expect(shipping.closedDays).toEqual([]);
  });
});

describe("shipping config (brief §4)", () => {
  const nl = shipping.countries.NL;

  it("ships with PostNL as a letterbox parcel from Amsterdam time, cut-off 16.00", () => {
    expect(shipping.timeZone).toBe("Europe/Amsterdam");
    expect(shipping.cutoff).toEqual({ hour: 16, minute: 0, label: "16.00" });
    expect(shipping.carrier).toBe("PostNL");
    expect(shipping.method).toBe("brievenbuspakje");
  });

  it("charges €3,95 in the Netherlands, free from €35, in 1 to 2 working days", () => {
    expect(shipping.defaultCountry).toBe("NL");
    expect(nl).toEqual({
      code: "NL",
      enabled: true,
      label: "Nederland",
      rate: { cents: 395, currency: "EUR" },
      freeFrom: { cents: 3500, currency: "EUR" },
      transitDays: { min: 1, max: 2 },
    });
    expect(formatMoney(nl.rate)).toBe("€3,95");
    expect(formatMoneyShort(nl.freeFrom)).toBe("€35");
  });

  it("has Belgium ready but switched off", () => {
    expect(shipping.countries.BE.code).toBe("BE");
    expect(shipping.countries.BE.enabled).toBe(false);
  });

  it("gives 14 days to return, the same as content/site.ts", () => {
    expect(shipping.returnDays).toBe(14);
    expect(site.returnDays).toBe(shipping.returnDays);
  });

  it("feeds the copy: USPs and delivery texts use the same amounts and times", () => {
    expect(site.usps[0]).toContain(formatMoneyShort(nl.freeFrom));
    expect(site.usps[1]).toContain(shipping.cutoff.label);
    expect(sharedCopy.deliveryBar.today).toContain(shipping.cutoff.label);
    expect(sharedCopy.deliveryEstimate.today).toContain(`${nl.transitDays.min} tot ${nl.transitDays.max} werkdagen`);
  });

  it("never reads the clock in content/shipping.ts", () => {
    expect(source).not.toMatch(CLOCK_CALL);
  });
});
