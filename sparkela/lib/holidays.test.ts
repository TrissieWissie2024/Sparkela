import { describe, expect, it } from "vitest";

import { dutchHolidays, dutchHolidaysBetween, easterSunday, isLustrumYear, kingsDay } from "@/lib/holidays";
import { shipping } from "@/content/shipping";

describe("easterSunday", () => {
  it("gives Easter 2024 to 2030 (checked against published calendars)", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(easterSunday(2028)).toBe("2028-04-16");
    expect(easterSunday(2029)).toBe("2029-04-01");
    expect(easterSunday(2030)).toBe("2030-04-21");
  });

  it("handles the extremes of the Easter window", () => {
    expect(easterSunday(2008)).toBe("2008-03-23");
    expect(easterSunday(2011)).toBe("2011-04-24");
    expect(easterSunday(2038)).toBe("2038-04-25");
    expect(easterSunday(2285)).toBe("2285-03-22");
  });

  it("rejects years outside the Gregorian calendar", () => {
    expect(() => easterSunday(1500)).toThrow();
    expect(() => easterSunday(2026.5)).toThrow();
  });
});

describe("holiday rules (decision 54)", () => {
  it("moves King's Day to Saturday 26 April when the 27th is a Sunday", () => {
    expect(kingsDay(2026)).toBe("2026-04-27");
    expect(kingsDay(2027)).toBe("2027-04-27");
    expect(kingsDay(2025)).toBe("2025-04-26"); // 27 April 2025 was a Sunday
    expect(kingsDay(2031)).toBe("2031-04-26"); // 27 April 2031 is a Sunday
  });

  it("has Liberation Day only in lustrum years", () => {
    expect(isLustrumYear(2025)).toBe(true);
    expect(isLustrumYear(2026)).toBe(false);
    expect(isLustrumYear(2030)).toBe(true);
    expect(dutchHolidays(2026).map((h) => h.date)).not.toContain("2026-05-05");
    expect(dutchHolidays(2030)).toContainEqual({ date: "2030-05-05", name: "Bevrijdingsdag" });
  });

  it("derives Ascension and Whitsun from Easter", () => {
    expect(dutchHolidays(2026)).toEqual([
      { date: "2026-01-01", name: "Nieuwjaarsdag" },
      { date: "2026-04-05", name: "Eerste paasdag" },
      { date: "2026-04-06", name: "Tweede paasdag" },
      { date: "2026-04-27", name: "Koningsdag" },
      { date: "2026-05-14", name: "Hemelvaartsdag" },
      { date: "2026-05-24", name: "Eerste pinksterdag" },
      { date: "2026-05-25", name: "Tweede pinksterdag" },
      { date: "2026-12-25", name: "Eerste kerstdag" },
      { date: "2026-12-26", name: "Tweede kerstdag" },
    ]);
  });

  it("never closes on Good Friday, Christmas Eve or New Year's Eve", () => {
    const dates = dutchHolidaysBetween(2026, 2028).map((h) => h.date);
    expect(dates).not.toContain("2027-03-26"); // Good Friday 2027
    expect(dates).not.toContain("2026-12-24");
    expect(dates).not.toContain("2026-12-31");
  });
});

describe("content/shipping.ts holidays", () => {
  it("equal the computed holidays over the range of the list, names included", () => {
    const listed = [...shipping.holidays].sort((a, b) => (a.date < b.date ? -1 : 1));
    const first = listed[0].date;
    const last = listed[listed.length - 1].date;
    const computed = dutchHolidaysBetween(Number(first.slice(0, 4)), Number(last.slice(0, 4))).filter(
      (h) => h.date >= first && h.date <= last,
    );
    expect(listed).toEqual(computed);
  });

  it("cover every year in which the shop takes orders before 2028", () => {
    const years = new Set(shipping.holidays.map((h) => h.date.slice(0, 4)));
    expect([...years]).toEqual(["2026", "2027", "2028"]);
  });
});
