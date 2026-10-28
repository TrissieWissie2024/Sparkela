import { phaseIndex } from "@/lib/schedule";
import type {
  Campaign,
  Drop,
  DropPhase,
  GiftWrapOffer,
  IsoDate,
  IsoDateTime,
  ShippingConfig,
  TimeWindow,
} from "@/lib/types";
import { sharedCopy, type SharedCopy } from "@/content/copy/shared";
import { drops as allDrops, EARLY_ACCESS_HOURS } from "@/content/drops";
import { campaigns as allCampaigns, giftWrap as defaultGiftWrap } from "@/content/offers";
import { shipping as defaultShipping } from "@/content/shipping";
import { site } from "@/content/site";

// CountdownParts, getCountdown, formatCountdown and phaseIndex live in lib/schedule.ts (wave 3a, decision 137).
export { type CountdownParts, getCountdown, formatCountdown, phaseIndex } from "@/lib/schedule";

/**
 * Date logic (docs/PLAN.md §9, brief §7). Pure: every function takes `now` (epoch milliseconds) as an argument;
 * there is no clock call in this module. Everything is computed in Europe/Amsterdam, so it is correct across the
 * daylight saving changes (16.00 is 15:00Z in winter and 14:00Z in summer).
 *
 * Port of CORVANE lib/delivery.ts and lib/campaign.ts: wall-clock parts via Intl formatToParts (en-US, h23),
 * calendar arithmetic on ISO dates with integers, and weekday and month names from fixed Dutch arrays, so the
 * server and every browser produce exactly the same text (no locale formatting).
 *
 * Client-safe (no next/* and no server-only imports): TimeSwitch content, Countdown labels and the local cart use
 * it in the browser; proxy.ts, lib/clock.ts and lib/shop-data.ts use it on the server.
 */

/** The warehouse time zone. Every date in the shop is a date in Amsterdam. */
export const TIME_ZONE = "Europe/Amsterdam";

/** ISO weekday order: index 0 is Monday (isoWeekday 1). */
export const DAYS_NL = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"] as const;
export const MONTHS_NL = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
] as const;

/**
 * The connecting words of the date labels below ("vandaag", "Begint op", "t/m"). They live in sharedCopy.dates (the
 * texts lib/ returns are copy, AGENTS.md); this alias keeps the export of wave 3b.
 */
export const DATE_WORDS_NL: SharedCopy["dates"] = sharedCopy.dates;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

/** A date-time with an explicit offset ("2026-11-27T00:00:00+01:00" or "...Z"). Without one, Date.parse would use
 * the time zone of the machine, which differs between a laptop and Vercel. */
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Epoch milliseconds of a content literal or a number. Throws on a string that is not an ISO date-time with an
 * offset, and on a non-finite number: content is static and tested (content/drops.test.ts, offers.test.ts), so a
 * throw here means a broken literal, never a visitor's input.
 */
export function toMs(value: IsoDateTime | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError(`toMs: not a finite time: ${String(value)}`);
    return value;
  }
  const match = ISO_DATE_TIME.exec(value);
  const ms = match && isRealDateTime(match) ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(ms)) throw new RangeError(`toMs: not an ISO date-time with an offset: "${value}"`);
  return ms;
}

/**
 * True when the fields of an ISO_DATE_TIME match exist on the calendar and the clock. Date.parse alone would roll an
 * impossible literal over to another instant ("2026-02-30" becomes 2 March, "T24:00" the next day), and plan §9.1
 * says toMs throws on such a literal instead.
 */
function isRealDateTime(match: RegExpExecArray): boolean {
  const [year, month, day, hour, minute] = [1, 2, 3, 4, 5].map((index) => Number(match[index]));
  const second = Number(match[6] ?? "0");
  const offsetHour = Number(match[7] ?? "0");
  const offsetMinute = Number(match[8] ?? "0");
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month) &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59
  );
}

/** Days in a month of the proleptic Gregorian calendar (month 1 to 12). */
function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseIsoDate(isoDate: IsoDate): { year: number; month: number; day: number } {
  const match = ISO_DATE.exec(isoDate);
  if (!match) throw new RangeError(`Not an ISO date (YYYY-MM-DD): "${isoDate}"`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/* -------------------------------------------------------------------------- */
/* Calendar arithmetic on ISO dates (integers only, no Date objects)            */
/* -------------------------------------------------------------------------- */

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/** Days since 1970-01-01 for a calendar date. */
function toDayNumber(isoDate: IsoDate): number {
  const { year, month, day } = parseIsoDate(isoDate);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** Calendar date of a day number (Hinnant's civil_from_days). */
function fromDayNumber(dayNumber: number): IsoDate {
  let z = dayNumber + 719_468;
  const era = Math.floor(z / 146_097);
  z -= era * 146_097;
  const yoe = Math.floor((z - Math.floor(z / 1_460) + Math.floor(z / 36_524) - Math.floor(z / 146_096)) / 365);
  const doy = z - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Calendar arithmetic: addCalendarDays("2026-12-31", 1) → "2027-01-01". */
export function addCalendarDays(isoDate: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(isoDate) + days);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** ISO weekday of a calendar date: 1 = Monday ... 7 = Sunday (1970-01-01 was a Thursday). */
export function isoWeekdayOf(isoDate: IsoDate): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  return ((((toDayNumber(isoDate) + 3) % 7) + 7) % 7 + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/* -------------------------------------------------------------------------- */
/* Time zone                                                                   */
/* -------------------------------------------------------------------------- */

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  isoWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  isoDate: IsoDate;
}

let formatter: Intl.DateTimeFormat | null = null;

function amsterdamFormatter(): Intl.DateTimeFormat {
  formatter ??= new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return formatter;
}

/** Wall-clock parts of an instant in Amsterdam. */
export function getZonedParts(now: number): ZonedParts {
  const values: Record<string, number> = {};
  for (const part of amsterdamFormatter().formatToParts(toMs(now))) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  const { year, month, day } = values;
  const isoDate = `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
  return {
    year,
    month,
    day,
    // Some engines report midnight as 24 even with h23.
    hour: values.hour === 24 ? 0 : values.hour,
    minute: values.minute,
    second: values.second,
    isoWeekday: isoWeekdayOf(isoDate),
    isoDate,
  };
}

/** Offset of Amsterdam from UTC at an instant, in milliseconds (+3600000 in winter, +7200000 in summer). */
function offsetAt(instant: number): number {
  const p = getZonedParts(instant);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant of a wall-clock time on a date in Amsterdam, correct across daylight saving:
 * zonedTimeToInstant("2027-03-30", 16, 0) is 14:00Z, zonedTimeToInstant("2026-11-27", 16, 0) is 15:00Z.
 */
export function zonedTimeToInstant(isoDate: IsoDate, hour: number, minute: number): number {
  const { year, month, day } = parseIsoDate(isoDate);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = wallAsUtc - offsetAt(wallAsUtc);
  return wallAsUtc - offsetAt(firstGuess);
}

/** Local midnight (00:00 in Amsterdam) at the start of a date. */
function startOfDay(isoDate: IsoDate): number {
  return zonedTimeToInstant(isoDate, 0, 0);
}

/* -------------------------------------------------------------------------- */
/* Dispatch                                                                    */
/* -------------------------------------------------------------------------- */

/** Dispatch runs on this date: Monday to Friday, not in shipping.holidays and not in shipping.closedDays. */
export function isWorkingDay(isoDate: IsoDate, cfg: ShippingConfig = defaultShipping): boolean {
  if (isoWeekdayOf(isoDate) > 5) return false;
  return !cfg.holidays.some((h) => h.date === isoDate) && !cfg.closedDays.some((h) => h.date === isoDate);
}

/** The first working day strictly after `isoDate`. */
export function nextWorkingDay(isoDate: IsoDate, cfg: ShippingConfig = defaultShipping): IsoDate {
  let candidate = addCalendarDays(isoDate, 1);
  // Bounded, so a broken config (every day closed) can never loop forever.
  for (let step = 0; step < 366 && !isWorkingDay(candidate, cfg); step += 1) {
    candidate = addCalendarDays(candidate, 1);
  }
  return candidate;
}

export interface DispatchInfo {
  /** The date (Amsterdam) an order placed at `now` leaves the warehouse. */
  dispatchDate: IsoDate;
  shipsToday: boolean;
  /** Today's cut-off instant while an order still ships today, else null. */
  cutoffAt: number | null;
}

/**
 * When an order placed at `now` ships: today when today is a working day and the local time is before the cut-off
 * (16.00, exclusive: 15:59:59 ships today, 16:00:00 does not), otherwise the next working day.
 */
export function getDispatchInfo(now: number, cfg: ShippingConfig = defaultShipping): DispatchInfo {
  const local = getZonedParts(now);
  const minutes = local.hour * 60 + local.minute;
  const cutoff = cfg.cutoff.hour * 60 + cfg.cutoff.minute;
  const shipsToday = isWorkingDay(local.isoDate, cfg) && minutes < cutoff;
  return {
    dispatchDate: shipsToday ? local.isoDate : nextWorkingDay(local.isoDate, cfg),
    shipsToday,
    cutoffAt: shipsToday ? zonedTimeToInstant(local.isoDate, cfg.cutoff.hour, cfg.cutoff.minute) : null,
  };
}

function weekdayName(isoDate: IsoDate): string {
  return DAYS_NL[isoWeekdayOf(isoDate) - 1];
}

function dayMonth(isoDate: IsoDate): string {
  const { month, day } = parseIsoDate(isoDate);
  return `${day} ${MONTHS_NL[month - 1]}`;
}

/**
 * The dispatch day as seen from `now`: "vandaag", "morgen" (also on a Sunday before a Monday), the weekday within
 * the next 6 days ("maandag"), else the weekday with the date ("maandag 4 januari").
 */
export function dispatchDayLabel(dispatchDate: IsoDate, now: number): string {
  const diff = daysBetween(getZonedParts(now).isoDate, dispatchDate);
  if (diff === 0) return DATE_WORDS_NL.today;
  if (diff === 1) return DATE_WORDS_NL.tomorrow;
  if (diff > 1 && diff <= 6) return weekdayName(dispatchDate);
  return `${weekdayName(dispatchDate)} ${dayMonth(dispatchDate)}`;
}

/** Delivery bar: "Vóór 16.00 besteld? Vandaag verstuurd." or "Nu besteld, maandag verstuurd." Never a countdown. */
export function deliveryBarText(now: number, cfg: ShippingConfig = defaultShipping): string {
  const info = getDispatchInfo(now, cfg);
  return info.shipsToday
    ? sharedCopy.deliveryBar.today
    : sharedCopy.deliveryBar.later(dispatchDayLabel(info.dispatchDate, now));
}

/** Product page estimate: sharedCopy.deliveryEstimate.today or .later(label). */
export function deliveryEstimateText(now: number, cfg: ShippingConfig = defaultShipping): string {
  const info = getDispatchInfo(now, cfg);
  return info.shipsToday
    ? sharedCopy.deliveryEstimate.today
    : sharedCopy.deliveryEstimate.later(dispatchDayLabel(info.dispatchDate, now));
}

/** One segment of the ship label: valid from `from` until the `from` of the next entry. */
export interface ShipLabelEntry {
  from: number;
  shipsToday: boolean;
  dispatchLabel: string;
  barText: string;
  estimateText: string;
}

/** Days covered by getShipSchedule() (lib/shop-data.ts) and assumed by shipScheduleBoundaries(). */
export const SHIP_SCHEDULE_DAYS = 14;

function shipEntryAt(at: number, cfg: ShippingConfig): ShipLabelEntry {
  const info = getDispatchInfo(at, cfg);
  const dispatchLabel = dispatchDayLabel(info.dispatchDate, at);
  return {
    from: at,
    shipsToday: info.shipsToday,
    dispatchLabel,
    barText: info.shipsToday ? sharedCopy.deliveryBar.today : sharedCopy.deliveryBar.later(dispatchLabel),
    estimateText: info.shipsToday
      ? sharedCopy.deliveryEstimate.today
      : sharedCopy.deliveryEstimate.later(dispatchLabel),
  };
}

function sameShipLabel(a: ShipLabelEntry, b: ShipLabelEntry): boolean {
  return (
    a.shipsToday === b.shipsToday &&
    a.dispatchLabel === b.dispatchLabel &&
    a.barText === b.barText &&
    a.estimateText === b.estimateText
  );
}

/**
 * The ship label from `from` for `days` days: one entry at `from`, then one at every moment the text changes
 * (a working day's cut-off, or a local midnight that turns "maandag" into "morgen"). The server builds this inside
 * a cached scope; ShipLabel (a TimeSwitch) shows the right entry in the browser, exact to the second.
 * Every entry stays true at least until the next entry's `from`, and the last one until `from + days`.
 */
export function buildShipSchedule(
  from: number,
  days: number = SHIP_SCHEDULE_DAYS,
  cfg: ShippingConfig = defaultShipping,
): ShipLabelEntry[] {
  const start = toMs(from);
  const end = start + days * DAY_MS;
  const entries: ShipLabelEntry[] = [shipEntryAt(start, cfg)];
  const firstDate = getZonedParts(start).isoDate;

  const candidates: number[] = [];
  for (let i = 0; i <= days + 1; i += 1) {
    const date = addCalendarDays(firstDate, i);
    candidates.push(startOfDay(date));
    if (isWorkingDay(date, cfg)) candidates.push(zonedTimeToInstant(date, cfg.cutoff.hour, cfg.cutoff.minute));
  }
  candidates.sort((a, b) => a - b);

  for (const at of candidates) {
    if (at <= start || at >= end) continue;
    const entry = shipEntryAt(at, cfg);
    if (!sameShipLabel(entry, entries[entries.length - 1])) entries.push(entry);
  }
  return entries;
}

/**
 * TimeSwitch boundaries for a ship schedule: the `from` of every entry after the first, plus the end of the window
 * (`schedule[0].from + days`). Use variants `[...schedule.map((e) => e[field]), fallback]`, so after the window the
 * always-true sharedCopy fallback shows (plan §10.5).
 */
export function shipScheduleBoundaries(schedule: ShipLabelEntry[], days: number = SHIP_SCHEDULE_DAYS): number[] {
  if (schedule.length === 0) return [];
  return [...schedule.slice(1).map((entry) => entry.from), schedule[0].from + days * DAY_MS];
}

/* -------------------------------------------------------------------------- */
/* VAT, prelaunch, windows, gift wrap                                          */
/* -------------------------------------------------------------------------- */

/** site.vat.before until 2027-01-01 00:00 (Amsterdam), site.vat.after from then on. Prices stay the same. */
export function vatText(now: number): string {
  return now < toMs(site.vat.switchAt) ? site.vat.before : site.vat.after;
}

/** Before the shop opens (site.launchAt): the proxy shows the waitlist. */
export function isPrelaunch(now: number, launchAt: IsoDateTime = site.launchAt): boolean {
  return now < toMs(launchAt);
}

/** startsAt <= now < endsAt (end exclusive). */
export function isInWindow(w: TimeWindow, now: number): boolean {
  return toMs(w.startsAt) <= now && now < toMs(w.endsAt);
}

/** Gift wrap is free in its windows (1 to 31 December). */
export function isGiftWrapFree(now: number, offer: GiftWrapOffer = defaultGiftWrap): boolean {
  return offer.freeWindows.some((w) => isInWindow(w, now));
}

/* -------------------------------------------------------------------------- */
/* Drops and campaigns                                                         */
/* -------------------------------------------------------------------------- */

/** Club members get in EARLY_ACCESS_HOURS (24) before the public start. */
export function earlyAccessAt(drop: Pick<Drop, "startsAt">): number {
  return toMs(drop.startsAt) - EARLY_ACCESS_HOURS * HOUR_MS;
}

/** verborgen → early-access (24 h before startsAt) → live (startsAt) → afgelopen (endsAt, exclusive). Plan §9.5. */
export function getDropPhase(drop: Pick<Drop, "startsAt" | "endsAt">, now: number): DropPhase {
  if (now < earlyAccessAt(drop)) return "verborgen";
  if (now < toMs(drop.startsAt)) return "early-access";
  if (now < toMs(drop.endsAt)) return "live";
  return "afgelopen";
}

function byStart<T extends { startsAt: IsoDateTime }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => toMs(a.startsAt) - toMs(b.startsAt));
}

/** The running campaign at `now` (startsAt <= now < endsAt), the earliest started first; null when none runs. */
export function getActiveCampaign(now: number, campaigns: readonly Campaign[] = allCampaigns): Campaign | null {
  return byStart(campaigns).find((campaign) => isInWindow(campaign, now)) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */

function clock(parts: Pick<ZonedParts, "hour" | "minute">): string {
  return `${pad(parts.hour)}.${pad(parts.minute)}`;
}

function isMidnight(parts: ZonedParts): boolean {
  return parts.hour === 0 && parts.minute === 0 && parts.second === 0;
}

/**
 * "26 november", or "26 november 2027" when `now` is given and falls in another calendar year (Amsterdam): a start a
 * year ahead without its year reads as a date in the past (QA round 3, the Spark Friday teaser on launch day).
 */
function startDay(parts: ZonedParts, now?: number): string {
  const day = dayMonth(parts.isoDate);
  return now !== undefined && getZonedParts(now).year !== parts.year ? `${day} ${parts.year}` : day;
}

/**
 * Screen reader text of a countdown, which never says "t/m" for a start (decision 135):
 * start "Begint op vrijdag 27 november om 00.00 uur"; end "Eindigt op maandag 30 november om middernacht" for an
 * end at 00.00 (the last day that is still included), else "Eindigt op zondag 28 februari om 23.59 uur". With `now`, a
 * start in another calendar year gets its year (formatStartLabel).
 */
export function formatCountdownSr(target: IsoDateTime, kind: "start" | "end", now?: number): string {
  const ms = toMs(target);
  const parts = getZonedParts(ms);
  if (kind === "start") {
    return `${DATE_WORDS_NL.startsOn} ${weekdayName(parts.isoDate)} ${startDay(parts, now)} ${DATE_WORDS_NL.at} ${clock(parts)} ${DATE_WORDS_NL.hours}`;
  }
  if (isMidnight(parts)) {
    const lastDay = addCalendarDays(parts.isoDate, -1);
    return `${DATE_WORDS_NL.endsOn} ${weekdayName(lastDay)} ${dayMonth(lastDay)} ${DATE_WORDS_NL.at} ${DATE_WORDS_NL.midnight}`;
  }
  return `${DATE_WORDS_NL.endsOn} ${weekdayName(parts.isoDate)} ${dayMonth(parts.isoDate)} ${DATE_WORDS_NL.at} ${clock(parts)} ${DATE_WORDS_NL.hours}`;
}

/**
 * Fixed end label (Countdown fallback before mount, promo bar): an exclusive end at 00.00 shows the last included
 * day, "t/m 30 november"; any other time "tot 28 februari 23.59 uur".
 */
export function formatEndLabel(endsAt: IsoDateTime): string {
  const parts = getZonedParts(toMs(endsAt));
  if (isMidnight(parts)) return `${DATE_WORDS_NL.through} ${dayMonth(addCalendarDays(parts.isoDate, -1))}`;
  return `${DATE_WORDS_NL.until} ${dayMonth(parts.isoDate)} ${clock(parts)} ${DATE_WORDS_NL.hours}`;
}

/**
 * Fixed start label: "vrijdag 5 februari om 19.00 uur". With `now` (the server clock), a start in another calendar
 * year gets its year: "vrijdag 26 november 2027 om 00.00 uur" (QA round 3).
 */
export function formatStartLabel(startsAt: IsoDateTime, now?: number): string {
  const parts = getZonedParts(toMs(startsAt));
  return `${weekdayName(parts.isoDate)} ${startDay(parts, now)} ${DATE_WORDS_NL.at} ${clock(parts)} ${DATE_WORDS_NL.hours}`;
}

/** Date and time of an instant: "26 november 2026 om 14.03 uur" (withdrawal receipts). */
export function formatDateTimeNl(now: number): string {
  const parts = getZonedParts(now);
  return `${dayMonth(parts.isoDate)} ${parts.year} ${DATE_WORDS_NL.at} ${clock(parts)} ${DATE_WORDS_NL.hours}`;
}

/** Day and month in Amsterdam: "27 november". */
export function formatDayMonth(value: IsoDateTime | number): string {
  return dayMonth(getZonedParts(toMs(value)).isoDate);
}

/* -------------------------------------------------------------------------- */
/* Announcement bar                                                            */
/* -------------------------------------------------------------------------- */

export type PromoState =
  | { kind: "campaign"; campaign: Campaign; target: IsoDateTime | null }
  | { kind: "drop-upcoming"; drop: Drop; target: IsoDateTime }
  | { kind: "drop-live"; drop: Drop; target: null }
  | { kind: "usp" };

/** A drop whose startsAt is at most this many days away is announced ("Nieuwe drop: …"). */
export const PROMO_UPCOMING_DAYS = 7;
/** A drop is "Nu live" in the bar for this many days after startsAt. */
export const PROMO_LIVE_DAYS = 7;

interface PromoInput {
  campaigns: readonly Campaign[];
  drops: readonly Drop[];
}

const defaultPromoInput: PromoInput = { campaigns: allCampaigns, drops: allDrops };

/**
 * What the announcement bar shows at `now` (plan §12.3), in this order: a running campaign (timer to endsAt when
 * showTimer); a drop starting within PROMO_UPCOMING_DAYS (timer to startsAt; the earliest start first); a drop that
 * has been live for less than PROMO_LIVE_DAYS (the first started, for overlapping drops); else the USP bar.
 */
export function getPromoState(now: number, input: PromoInput = defaultPromoInput): PromoState {
  const campaign = getActiveCampaign(now, input.campaigns);
  if (campaign) return { kind: "campaign", campaign, target: campaign.showTimer ? campaign.endsAt : null };

  const ordered = byStart(input.drops);
  const upcoming = ordered.find((drop) => {
    const start = toMs(drop.startsAt);
    return start - PROMO_UPCOMING_DAYS * DAY_MS <= now && now < start;
  });
  if (upcoming) return { kind: "drop-upcoming", drop: upcoming, target: upcoming.startsAt };

  const live = ordered.find((drop) => {
    const start = toMs(drop.startsAt);
    return start <= now && now < Math.min(start + PROMO_LIVE_DAYS * DAY_MS, toMs(drop.endsAt));
  });
  if (live) return { kind: "drop-live", drop: live, target: null };

  return { kind: "usp" };
}

export interface PromoEntry {
  from: number;
  state: PromoState;
}

function promoKey(state: PromoState): string {
  switch (state.kind) {
    case "campaign":
      return `campaign:${state.campaign.id}:${state.target ?? ""}`;
    case "drop-upcoming":
      return `drop-upcoming:${state.drop.slug}:${state.target}`;
    case "drop-live":
      return `drop-live:${state.drop.slug}`;
    case "usp":
      return "usp";
  }
}

/** Every instant at which getPromoState can change for this input. */
function promoBoundaries(input: PromoInput): number[] {
  const out: number[] = [];
  for (const campaign of input.campaigns) out.push(toMs(campaign.startsAt), toMs(campaign.endsAt));
  for (const drop of input.drops) {
    const start = toMs(drop.startsAt);
    out.push(start - PROMO_UPCOMING_DAYS * DAY_MS, start, start + PROMO_LIVE_DAYS * DAY_MS, toMs(drop.endsAt));
  }
  return out;
}

/**
 * One entry at `from`, then one at every change of getPromoState within `days` days (incl. PROMO_* offsets).
 * Sorted, never empty. AnnouncementBar renders one segment per entry inside a TimeSwitch (plan §10.5).
 */
export function promoSchedule(from: number, days: number, input: PromoInput = defaultPromoInput): PromoEntry[] {
  const start = toMs(from);
  const end = start + days * DAY_MS;
  const entries: PromoEntry[] = [{ from: start, state: getPromoState(start, input) }];
  const boundaries = [...new Set(promoBoundaries(input))].filter((b) => b > start && b < end).sort((a, b) => a - b);
  for (const at of boundaries) {
    const state = getPromoState(at, input);
    if (promoKey(state) !== promoKey(entries[entries.length - 1].state)) entries.push({ from: at, state });
  }
  return entries;
}

/* -------------------------------------------------------------------------- */
/* Boundaries for the server clock                                             */
/* -------------------------------------------------------------------------- */

let cachedBoundaries: number[] | null = null;

/**
 * Every instant at which something time-based changes for the server (sorted, unique): launchAt, vat.switchAt,
 * every campaign start and end, every drop's earlyAccessAt, startsAt and endsAt plus the PROMO_* offsets, and the
 * gift wrap windows. lib/clock.ts clockLife() shortens the cache life towards the next one.
 */
export function timeBoundaries(): number[] {
  if (cachedBoundaries) return cachedBoundaries;
  const out: number[] = [toMs(site.launchAt), toMs(site.vat.switchAt)];
  for (const campaign of allCampaigns) out.push(toMs(campaign.startsAt), toMs(campaign.endsAt));
  for (const drop of allDrops) {
    const start = toMs(drop.startsAt);
    out.push(
      earlyAccessAt(drop),
      start,
      toMs(drop.endsAt),
      start - PROMO_UPCOMING_DAYS * DAY_MS,
      start + PROMO_LIVE_DAYS * DAY_MS,
    );
  }
  for (const w of defaultGiftWrap.freeWindows) out.push(toMs(w.startsAt), toMs(w.endsAt));
  cachedBoundaries = [...new Set(out)].sort((a, b) => a - b);
  return cachedBoundaries;
}

/** The first boundary strictly after `now`, or null after the last one. */
export function nextBoundary(now: number): number | null {
  const boundaries = timeBoundaries();
  const index = phaseIndex(boundaries, now);
  return index < boundaries.length ? boundaries[index] : null;
}
