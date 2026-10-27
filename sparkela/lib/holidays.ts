import type { Holiday, IsoDate } from "@/lib/types";

/**
 * Dutch holidays on which dispatch is closed, computed from the calendar (docs/PLAN.md §9.3, decision 54).
 *
 * content/shipping.ts holds the holidays as literals (the single source for lib/dates.ts). This module recomputes
 * them from the rules, so lib/holidays.test.ts and content/shipping.test.ts catch a typo in that list. Pure: no
 * clock, no content imports, integer calendar arithmetic only.
 *
 * Policy (decision 54): New Year's Day, Easter (both days), King's Day (27 April, or 26 April when the 27th is a
 * Sunday), Ascension Day, Whitsun (both days) and Christmas (both days). Liberation Day (5 May) only in lustrum
 * years (2025, 2030, ...). Good Friday, Christmas Eve and New Year's Eve are working days.
 *
 * The names equal the names in content/shipping.ts; they are data for the comparison, not visible copy.
 */

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function isoDate(year: number, month: number, day: number): IsoDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Days since 1970-01-01 for a calendar date (proleptic Gregorian, no time zone involved). */
function dayNumber(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** ISO weekday of a calendar date: 1 = Monday ... 7 = Sunday. 1970-01-01 was a Thursday (4). */
function isoWeekday(year: number, month: number, day: number): number {
  return (((dayNumber(year, month, day) + 3) % 7) + 7) % 7 + 1;
}

/** Calendar date `days` after a date (negative goes back). Integer arithmetic (Hinnant's civil_from_days). */
function shift(year: number, month: number, day: number, days: number): IsoDate {
  let z = dayNumber(year, month, day) + days + 719_468;
  const era = Math.floor(z / 146_097);
  z -= era * 146_097;
  const yoe = Math.floor((z - Math.floor(z / 1_460) + Math.floor(z / 36_524) - Math.floor(z / 146_096)) / 365);
  const doy = z - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return isoDate(y, m, d);
}

/**
 * Easter Sunday of a Gregorian year (anonymous Gregorian algorithm, Meeus/Jones/Butcher).
 * easterSunday(2026) → "2026-04-05", easterSunday(2027) → "2027-03-28".
 */
export function easterSunday(year: number): IsoDate {
  if (!Number.isInteger(year) || year < 1583) throw new RangeError(`easterSunday: not a Gregorian year: ${year}`);
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
  return isoDate(year, month, day);
}

/** Liberation Day is a day off in lustrum years only (decision 54). */
export function isLustrumYear(year: number): boolean {
  return year % 5 === 0;
}

/** King's Day: 27 April, or Saturday 26 April when the 27th falls on a Sunday. */
export function kingsDay(year: number): IsoDate {
  return isoWeekday(year, 4, 27) === 7 ? isoDate(year, 4, 26) : isoDate(year, 4, 27);
}

/** Holiday names, as in content/shipping.ts. */
export const HOLIDAY_NAMES = {
  newYear: "Nieuwjaarsdag",
  easter: "Eerste paasdag",
  easterMonday: "Tweede paasdag",
  kingsDay: "Koningsdag",
  liberationDay: "Bevrijdingsdag",
  ascension: "Hemelvaartsdag",
  whitsun: "Eerste pinksterdag",
  whitMonday: "Tweede pinksterdag",
  christmas: "Eerste kerstdag",
  boxingDay: "Tweede kerstdag",
} as const;

/** Every dispatch-closing holiday of one year under the policy of decision 54, sorted by date. */
export function dutchHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const [ey, em, ed] = easter.split("-").map(Number);
  const list: Holiday[] = [
    { date: isoDate(year, 1, 1), name: HOLIDAY_NAMES.newYear },
    { date: easter, name: HOLIDAY_NAMES.easter },
    { date: shift(ey, em, ed, 1), name: HOLIDAY_NAMES.easterMonday },
    { date: kingsDay(year), name: HOLIDAY_NAMES.kingsDay },
    { date: shift(ey, em, ed, 39), name: HOLIDAY_NAMES.ascension },
    { date: shift(ey, em, ed, 49), name: HOLIDAY_NAMES.whitsun },
    { date: shift(ey, em, ed, 50), name: HOLIDAY_NAMES.whitMonday },
    { date: isoDate(year, 12, 25), name: HOLIDAY_NAMES.christmas },
    { date: isoDate(year, 12, 26), name: HOLIDAY_NAMES.boxingDay },
  ];
  if (isLustrumYear(year)) list.push({ date: isoDate(year, 5, 5), name: HOLIDAY_NAMES.liberationDay });
  // ISO dates sort as strings. Ascension (Easter + 39) can fall on 5 May; both stay in the list.
  return list.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}

/** dutchHolidays() for every year from `from` to `to` (inclusive), sorted by date. */
export function dutchHolidaysBetween(from: number, to: number): Holiday[] {
  const out: Holiday[] = [];
  for (let year = from; year <= to; year += 1) out.push(...dutchHolidays(year));
  return out;
}
