import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  buildShipSchedule,
  DAYS_NL,
  daysBetween,
  deliveryBarText,
  deliveryEstimateText,
  dispatchDayLabel,
  earlyAccessAt,
  formatCountdownSr,
  formatDateTimeNl,
  formatDayMonth,
  formatEndLabel,
  formatStartLabel,
  getActiveCampaign,
  getDispatchInfo,
  getDropPhase,
  getPromoState,
  getZonedParts,
  isGiftWrapFree,
  isInWindow,
  isoWeekdayOf,
  isPrelaunch,
  isWorkingDay,
  MONTHS_NL,
  nextBoundary,
  nextWorkingDay,
  phaseIndex,
  PROMO_LIVE_DAYS,
  PROMO_UPCOMING_DAYS,
  promoSchedule,
  shipScheduleBoundaries,
  timeBoundaries,
  toMs,
  vatText,
  zonedTimeToInstant,
} from "@/lib/dates";
import type { Campaign, Drop, ShippingConfig } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";
import { drops } from "@/content/drops";
import { campaigns, giftWrap } from "@/content/offers";
import { shipping } from "@/content/shipping";
import { site } from "@/content/site";

/** Epoch ms of an ISO literal with offset. The expected values below are written out by hand, not derived. */
const at = (iso: string) => Date.parse(iso);

const holiday = drops.find((drop) => drop.slug === "holiday-sparkle") as Drop;
const loveClub = drops.find((drop) => drop.slug === "love-club") as Drop;
const launchGift = campaigns.find((campaign) => campaign.id === "lanceringscadeau") as Campaign;

const bar = sharedCopy.deliveryBar;
const estimate = sharedCopy.deliveryEstimate;

describe("toMs", () => {
  it("parses ISO literals with an offset and passes finite numbers through", () => {
    expect(toMs("2026-11-27T00:00:00+01:00")).toBe(Date.UTC(2026, 10, 26, 23, 0, 0));
    expect(toMs("2027-03-30T16:00:00+02:00")).toBe(Date.UTC(2027, 2, 30, 14, 0, 0));
    expect(toMs("2026-11-27T12:00:00Z")).toBe(Date.UTC(2026, 10, 27, 12, 0, 0));
    expect(toMs(1234)).toBe(1234);
  });

  it("throws on a literal without offset, a broken literal and a non-finite number", () => {
    expect(() => toMs("2026-11-27T00:00:00")).toThrow();
    expect(() => toMs("2026-11-27")).toThrow();
    expect(() => toMs("27 november 2026")).toThrow();
    expect(() => toMs("2026-13-45T00:00:00+01:00")).toThrow();
    // Shaped right but not on the calendar: Date.parse would roll these over to another instant.
    expect(() => toMs("2026-02-30T00:00:00+01:00")).toThrow();
    expect(() => toMs("2026-11-31T00:00:00+01:00")).toThrow();
    expect(() => toMs("2026-11-27T24:00:00+01:00")).toThrow();
    expect(() => toMs("2026-11-27T12:60:00+01:00")).toThrow();
    expect(() => toMs("2027-02-29T12:00:00+01:00")).toThrow();
    expect(toMs("2028-02-29T12:00:00+01:00")).toBe(Date.UTC(2028, 1, 29, 11, 0, 0));
    expect(() => toMs(Number.NaN)).toThrow();
    expect(() => toMs(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("calendar arithmetic", () => {
  it("adds days across months, years and leap days", () => {
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addCalendarDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addCalendarDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addCalendarDays("2026-11-27", 35)).toBe("2027-01-01");
    expect(addCalendarDays("2000-02-28", 1)).toBe("2000-02-29");
    expect(addCalendarDays("2100-02-28", 1)).toBe("2100-03-01");
    expect(daysBetween("2026-11-27", "2027-01-01")).toBe(35);
  });

  it("knows the weekdays (checked against a calendar)", () => {
    expect(isoWeekdayOf("2026-10-26")).toBe(1); // Monday, "vandaag" in the plan
    expect(isoWeekdayOf("2026-11-27")).toBe(5); // Friday, launch
    expect(isoWeekdayOf("2026-12-25")).toBe(5);
    expect(isoWeekdayOf("2026-12-26")).toBe(6);
    expect(isoWeekdayOf("2027-01-01")).toBe(5);
    expect(isoWeekdayOf("2027-03-28")).toBe(7); // Easter Sunday
    expect(isoWeekdayOf("2027-04-27")).toBe(2); // King's Day
    expect(isoWeekdayOf("1970-01-01")).toBe(4);
  });

  it("names days and months in Dutch", () => {
    expect(DAYS_NL[0]).toBe("maandag");
    expect(DAYS_NL[6]).toBe("zondag");
    expect(MONTHS_NL[10]).toBe("november");
  });
});

describe("getZonedParts and zonedTimeToInstant (Europe/Amsterdam)", () => {
  it("gives wall-clock parts in winter and summer time", () => {
    expect(getZonedParts(at("2026-11-27T15:59:00+01:00"))).toMatchObject({
      year: 2026,
      month: 11,
      day: 27,
      hour: 15,
      minute: 59,
      isoWeekday: 5,
      isoDate: "2026-11-27",
    });
    // 22:30Z on 26 November is already 27 November in Amsterdam.
    expect(getZonedParts(at("2026-11-26T23:30:00Z")).isoDate).toBe("2026-11-27");
    expect(getZonedParts(at("2027-07-01T12:00:00Z")).hour).toBe(14);
  });

  it("case 15: around the switch to summer time 2027-03-28 (01:59:59 then 03:00:00)", () => {
    expect(getZonedParts(at("2027-03-28T01:59:59+01:00"))).toMatchObject({ hour: 1, minute: 59, second: 59 });
    expect(getZonedParts(at("2027-03-28T03:00:00+02:00"))).toMatchObject({ hour: 3, minute: 0, second: 0 });
    // One second apart in real time.
    expect(at("2027-03-28T03:00:00+02:00") - at("2027-03-28T01:59:59+01:00")).toBe(1000);
  });

  it("puts the 16.00 cut-off at 15:00Z in winter and 14:00Z in summer", () => {
    expect(zonedTimeToInstant("2026-11-27", 16, 0)).toBe(Date.UTC(2026, 10, 27, 15, 0));
    expect(zonedTimeToInstant("2027-03-30", 16, 0)).toBe(Date.UTC(2027, 2, 30, 14, 0));
    expect(zonedTimeToInstant("2027-03-28", 0, 0)).toBe(Date.UTC(2027, 2, 27, 23, 0));
    expect(zonedTimeToInstant("2027-10-31", 16, 0)).toBe(Date.UTC(2027, 9, 31, 15, 0));
    expect(zonedTimeToInstant("2027-10-31", 0, 0)).toBe(Date.UTC(2027, 9, 30, 22, 0));
  });
});

describe("working days", () => {
  it("excludes weekends, holidays and closed days", () => {
    expect(isWorkingDay("2026-11-27")).toBe(true);
    expect(isWorkingDay("2026-11-28")).toBe(false);
    expect(isWorkingDay("2026-11-29")).toBe(false);
    expect(isWorkingDay("2026-12-24")).toBe(true); // Christmas Eve ships
    expect(isWorkingDay("2026-12-25")).toBe(false);
    expect(isWorkingDay("2026-12-31")).toBe(true); // New Year's Eve ships
    expect(isWorkingDay("2027-03-26")).toBe(true); // Good Friday ships (decision 54)
    expect(isWorkingDay("2027-05-05")).toBe(true); // Liberation Day 2027 is not a lustrum year
    const closed: ShippingConfig = { ...shipping, closedDays: [{ date: "2026-11-30", name: "Inventaris" }] };
    expect(isWorkingDay("2026-11-30", closed)).toBe(false);
    expect(nextWorkingDay("2026-11-27", closed)).toBe("2026-12-01");
  });

  it("finds the next working day strictly after a date", () => {
    expect(nextWorkingDay("2026-11-27")).toBe("2026-11-30");
    expect(nextWorkingDay("2026-12-24")).toBe("2026-12-28");
    expect(nextWorkingDay("2026-12-31")).toBe("2027-01-04");
  });
});

/** §9.4 cases 1 to 18: dispatch day, label and texts. */
describe("dispatch (plan §9.4, brief §7)", () => {
  const cases: Array<{ id: number; now: string; date: string; today: boolean; label: string }> = [
    { id: 1, now: "2026-11-27T15:59:00+01:00", date: "2026-11-27", today: true, label: "vandaag" },
    { id: 2, now: "2026-11-27T16:00:00+01:00", date: "2026-11-30", today: false, label: "maandag" },
    { id: 3, now: "2026-11-27T16:01:00+01:00", date: "2026-11-30", today: false, label: "maandag" },
    { id: 4, now: "2026-11-28T10:00:00+01:00", date: "2026-11-30", today: false, label: "maandag" },
    { id: 5, now: "2026-11-29T22:00:00+01:00", date: "2026-11-30", today: false, label: "morgen" },
    { id: 6, now: "2026-12-24T15:59:00+01:00", date: "2026-12-24", today: true, label: "vandaag" },
    { id: 7, now: "2026-12-24T16:01:00+01:00", date: "2026-12-28", today: false, label: "maandag" },
    { id: 8, now: "2026-12-25T12:00:00+01:00", date: "2026-12-28", today: false, label: "maandag" },
    { id: 9, now: "2026-12-26T12:00:00+01:00", date: "2026-12-28", today: false, label: "maandag" },
    { id: 10, now: "2026-12-31T16:01:00+01:00", date: "2027-01-04", today: false, label: "maandag" },
    { id: 12, now: "2027-03-26T16:30:00+01:00", date: "2027-03-30", today: false, label: "dinsdag" },
    { id: 13, now: "2027-03-30T15:59:00+02:00", date: "2027-03-30", today: true, label: "vandaag" },
    { id: 13, now: "2027-03-30T16:00:00+02:00", date: "2027-03-31", today: false, label: "morgen" },
    { id: 14, now: "2027-10-29T16:01:00+02:00", date: "2027-11-01", today: false, label: "maandag" },
    { id: 16, now: "2027-04-26T16:01:00+02:00", date: "2027-04-28", today: false, label: "woensdag" },
    { id: 17, now: "2027-05-05T10:00:00+02:00", date: "2027-05-05", today: true, label: "vandaag" },
    { id: 18, now: "2027-05-05T16:01:00+02:00", date: "2027-05-07", today: false, label: "vrijdag" },
  ];

  it.each(cases)("case $id: $now ships $date ($label)", ({ now, date, today, label }) => {
    const info = getDispatchInfo(at(now));
    expect(info.dispatchDate).toBe(date);
    expect(info.shipsToday).toBe(today);
    expect(dispatchDayLabel(info.dispatchDate, at(now))).toBe(label);
    expect(deliveryBarText(at(now))).toBe(today ? bar.today : bar.later(label));
    expect(deliveryEstimateText(at(now))).toBe(today ? estimate.today : estimate.later(label));
  });

  // Holiday and daylight-saving paths beyond the brief's cases: Koningsdag and Hemelvaart themselves, Pinksteren
  // 2027 (Monday 17 May closed) and the switch to winter time on Sunday 25 October 2026, before the launch.
  const moreCases: Array<{ now: string; date: string; today: boolean; label: string }> = [
    { now: "2027-04-27T10:00:00+02:00", date: "2027-04-28", today: false, label: "morgen" },
    { now: "2027-05-06T10:00:00+02:00", date: "2027-05-07", today: false, label: "morgen" },
    { now: "2027-05-14T16:01:00+02:00", date: "2027-05-18", today: false, label: "dinsdag" },
    { now: "2027-05-15T12:00:00+02:00", date: "2027-05-18", today: false, label: "dinsdag" },
    { now: "2027-05-16T12:00:00+02:00", date: "2027-05-18", today: false, label: "dinsdag" },
    { now: "2027-05-17T10:00:00+02:00", date: "2027-05-18", today: false, label: "morgen" },
    { now: "2026-10-23T16:01:00+02:00", date: "2026-10-26", today: false, label: "maandag" },
    { now: "2026-10-26T15:59:59+01:00", date: "2026-10-26", today: true, label: "vandaag" },
    { now: "2026-10-26T16:00:00+01:00", date: "2026-10-27", today: false, label: "morgen" },
  ];

  it.each(moreCases)("$now ships $date ($label)", ({ now, date, today, label }) => {
    const info = getDispatchInfo(at(now));
    expect(info.dispatchDate).toBe(date);
    expect(info.shipsToday).toBe(today);
    expect(dispatchDayLabel(info.dispatchDate, at(now))).toBe(label);
    expect(deliveryBarText(at(now))).toBe(today ? bar.today : bar.later(label));
  });

  it("uses the exact texts of the brief", () => {
    expect(deliveryBarText(at("2026-11-27T15:59:00+01:00"))).toBe("Vóór 16.00 besteld? Vandaag verstuurd.");
    expect(deliveryBarText(at("2026-11-27T16:00:00+01:00"))).toBe("Nu besteld, maandag verstuurd.");
    expect(deliveryEstimateText(at("2026-11-27T15:59:00+01:00"))).toBe(
      "Vóór 16.00 besteld, vandaag verstuurd. Meestal binnen 1 tot 2 werkdagen in je brievenbus.",
    );
    expect(deliveryEstimateText(at("2026-11-29T22:00:00+01:00"))).toBe(
      "Nu besteld, morgen verstuurd. Meestal binnen 1 tot 2 werkdagen daarna in je brievenbus.",
    );
  });

  it("treats 16.00 as exclusive to the second", () => {
    expect(getDispatchInfo(at("2026-11-27T15:59:59+01:00")).shipsToday).toBe(true);
    expect(getDispatchInfo(at("2026-11-27T16:00:00+01:00")).shipsToday).toBe(false);
    expect(getDispatchInfo(at("2027-03-30T15:59:59+02:00")).shipsToday).toBe(true);
    expect(getDispatchInfo(at("2027-03-30T13:59:59Z")).shipsToday).toBe(true);
    expect(getDispatchInfo(at("2027-03-30T14:00:00Z")).shipsToday).toBe(false);
  });

  it("returns the cut-off instant while an order still ships today", () => {
    expect(getDispatchInfo(at("2026-11-27T09:00:00+01:00")).cutoffAt).toBe(at("2026-11-27T16:00:00+01:00"));
    expect(getDispatchInfo(at("2027-03-30T09:00:00+02:00")).cutoffAt).toBe(at("2027-03-30T16:00:00+02:00"));
    expect(getDispatchInfo(at("2026-11-28T09:00:00+01:00")).cutoffAt).toBeNull();
  });

  it("labels a dispatch day more than 6 days away with its date", () => {
    const longBreak: ShippingConfig = {
      ...shipping,
      closedDays: ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31"].map((date) => ({ date, name: "Pauze" })),
    };
    const info = getDispatchInfo(at("2026-12-24T16:01:00+01:00"), longBreak);
    expect(info.dispatchDate).toBe("2027-01-04");
    expect(dispatchDayLabel(info.dispatchDate, at("2026-12-24T16:01:00+01:00"))).toBe("maandag 4 januari");
    expect(deliveryBarText(at("2026-12-24T16:01:00+01:00"), longBreak)).toBe("Nu besteld, maandag 4 januari verstuurd.");
  });
});

describe("buildShipSchedule", () => {
  it("case 27: from Thursday 24 December 09.00, an entry at every label change", () => {
    const schedule = buildShipSchedule(at("2026-12-24T09:00:00+01:00"));
    const head = schedule.slice(0, 5).map((entry) => ({ from: entry.from, label: entry.dispatchLabel }));
    expect(head).toEqual([
      { from: at("2026-12-24T09:00:00+01:00"), label: "vandaag" },
      { from: at("2026-12-24T16:00:00+01:00"), label: "maandag" },
      { from: at("2026-12-27T00:00:00+01:00"), label: "morgen" },
      { from: at("2026-12-28T00:00:00+01:00"), label: "vandaag" },
      { from: at("2026-12-28T16:00:00+01:00"), label: "morgen" },
    ]);
    expect(schedule[0]).toMatchObject({ shipsToday: true, barText: bar.today, estimateText: estimate.today });
    expect(schedule[1]).toMatchObject({ shipsToday: false, barText: bar.later("maandag"), estimateText: estimate.later("maandag") });
  });

  it("is sorted, starts at `from`, stays inside the window and agrees with the point functions", () => {
    const from = at("2026-11-26T11:17:00+01:00");
    const schedule = buildShipSchedule(from, 14);
    expect(schedule[0].from).toBe(from);
    for (let i = 1; i < schedule.length; i += 1) {
      expect(schedule[i].from).toBeGreaterThan(schedule[i - 1].from);
      expect(schedule[i].from).toBeLessThan(from + 14 * 86_400_000);
      expect(schedule[i].barText !== schedule[i - 1].barText || schedule[i].estimateText !== schedule[i - 1].estimateText).toBe(true);
    }
    // Sample every 15 minutes: the entry in force says exactly what deliveryBarText says.
    for (let t = from; t < from + 14 * 86_400_000; t += 15 * 60_000) {
      const entry = schedule[phaseIndex(schedule.map((e) => e.from), t) - 1];
      expect(entry.barText).toBe(deliveryBarText(t));
      expect(entry.estimateText).toBe(deliveryEstimateText(t));
    }
  });

  it("follows the daylight saving switch (cut-off at 16.00 local on both sides)", () => {
    const schedule = buildShipSchedule(at("2027-03-25T09:00:00+01:00"), 7);
    const changes = schedule.map((entry) => entry.from);
    expect(changes).toContain(at("2027-03-25T16:00:00+01:00"));
    expect(changes).toContain(at("2027-03-30T16:00:00+02:00"));
  });

  it("follows the switch to winter time on 25 October 2026", () => {
    const schedule = buildShipSchedule(at("2026-10-23T09:00:00+02:00"), 5);
    const head = schedule.slice(0, 5).map((entry) => ({ from: entry.from, label: entry.dispatchLabel }));
    expect(head).toEqual([
      { from: at("2026-10-23T09:00:00+02:00"), label: "vandaag" },
      { from: at("2026-10-23T16:00:00+02:00"), label: "maandag" },
      { from: at("2026-10-25T00:00:00+02:00"), label: "morgen" },
      { from: at("2026-10-26T00:00:00+01:00"), label: "vandaag" },
      { from: at("2026-10-26T16:00:00+01:00"), label: "morgen" },
    ]);
    expect(at("2026-10-26T16:00:00+01:00")).toBe(Date.UTC(2026, 9, 26, 15, 0, 0));
  });

  it("gives TimeSwitch boundaries that end with the window", () => {
    const schedule = buildShipSchedule(at("2026-12-24T09:00:00+01:00"));
    const boundaries = shipScheduleBoundaries(schedule);
    expect(boundaries).toHaveLength(schedule.length);
    expect(boundaries.slice(0, -1)).toEqual(schedule.slice(1).map((entry) => entry.from));
    expect(boundaries[boundaries.length - 1]).toBe(at("2026-12-24T09:00:00+01:00") + 14 * 86_400_000);
    expect(shipScheduleBoundaries([])).toEqual([]);
  });
});

describe("VAT, prelaunch, windows (cases 11, 19, 22)", () => {
  it("case 11: switches the VAT text at 2027-01-01 00.00", () => {
    expect(vatText(at("2026-12-31T23:59:59+01:00"))).toBe(site.vat.before);
    expect(vatText(at("2027-01-01T00:00:00+01:00"))).toBe(site.vat.after);
    expect(site.vat.before).toBe("Prijzen inclusief 21% btw");
  });

  it("case 19: prelaunch until the launch", () => {
    expect(isPrelaunch(at("2026-11-26T23:59:59+01:00"))).toBe(true);
    expect(isPrelaunch(at("2026-11-27T00:00:00+01:00"))).toBe(false);
    expect(isPrelaunch(at("2026-11-20T12:00:00+01:00"), "2026-11-20T12:00:00+01:00")).toBe(false);
  });

  it("treats windows as start-inclusive and end-exclusive", () => {
    const w = { startsAt: "2026-12-01T00:00:00+01:00", endsAt: "2027-01-01T00:00:00+01:00" };
    expect(isInWindow(w, at("2026-11-30T23:59:59+01:00"))).toBe(false);
    expect(isInWindow(w, at("2026-12-01T00:00:00+01:00"))).toBe(true);
    expect(isInWindow(w, at("2027-01-01T00:00:00+01:00"))).toBe(false);
  });

  it("case 22: gift wrap is free in December", () => {
    expect(isGiftWrapFree(at("2026-11-30T23:59:59+01:00"))).toBe(false);
    expect(isGiftWrapFree(at("2026-12-01T00:00:00+01:00"))).toBe(true);
    expect(isGiftWrapFree(at("2026-12-31T23:59:59+01:00"))).toBe(true);
    expect(isGiftWrapFree(at("2027-01-01T00:00:00+01:00"))).toBe(false);
    expect(isGiftWrapFree(at("2027-12-15T12:00:00+01:00"))).toBe(true);
    expect(isGiftWrapFree(at("2026-12-15T12:00:00+01:00"), { ...giftWrap, freeWindows: [] })).toBe(false);
  });
});

describe("drops (cases 20 and 21)", () => {
  it("opens early access 24 hours before the start", () => {
    expect(earlyAccessAt(holiday)).toBe(at("2026-11-26T00:00:00+01:00"));
    expect(earlyAccessAt(loveClub)).toBe(at("2027-02-04T19:00:00+01:00"));
  });

  it("case 20: Holiday Sparkle phases", () => {
    expect(getDropPhase(holiday, at("2026-11-25T23:59:59+01:00"))).toBe("verborgen");
    expect(getDropPhase(holiday, at("2026-11-26T00:00:00+01:00"))).toBe("early-access");
    expect(getDropPhase(holiday, at("2026-11-26T23:59:59+01:00"))).toBe("early-access");
    expect(getDropPhase(holiday, at("2026-11-27T00:00:00+01:00"))).toBe("live");
    expect(getDropPhase(holiday, at("2026-12-31T23:59:59+01:00"))).toBe("live");
    expect(getDropPhase(holiday, at("2027-01-01T00:00:00+01:00"))).toBe("afgelopen");
  });

  it("case 21: Love Club just before and after the start", () => {
    expect(getDropPhase(loveClub, at("2027-02-05T18:59:59+01:00"))).toBe("early-access");
    expect(getDropPhase(loveClub, at("2027-02-05T19:00:00+01:00"))).toBe("live");
    expect(getDropPhase(loveClub, at("2027-02-05T19:00:01+01:00"))).toBe("live");
  });
});

describe("campaigns and the announcement bar (cases 23 and 24)", () => {
  it("case 23: the launch gift runs 27 to 30 November", () => {
    expect(getActiveCampaign(at("2026-11-26T23:59:59+01:00"))).toBeNull();
    expect(getActiveCampaign(at("2026-11-27T00:00:00+01:00"))?.id).toBe("lanceringscadeau");
    expect(getActiveCampaign(at("2026-11-30T23:59:59+01:00"))?.id).toBe("lanceringscadeau");
    expect(getActiveCampaign(at("2026-12-01T00:00:00+01:00"))).toBeNull();
  });

  it("picks the earliest started of two running campaigns", () => {
    const later: Campaign = { ...launchGift, id: "later", startsAt: "2026-11-28T00:00:00+01:00" };
    expect(getActiveCampaign(at("2026-11-29T12:00:00+01:00"), [later, launchGift])?.id).toBe("lanceringscadeau");
  });

  it("case 24: campaign, drop live, USP bar, drop upcoming", () => {
    const campaign = getPromoState(at("2026-11-28T12:00:00+01:00"));
    expect(campaign).toMatchObject({ kind: "campaign", target: launchGift.endsAt });
    const live = getPromoState(at("2026-12-02T12:00:00+01:00"));
    expect(live.kind).toBe("drop-live");
    expect(live.kind === "drop-live" && live.drop.slug).toBe("holiday-sparkle");
    expect(getPromoState(at("2026-12-05T12:00:00+01:00"))).toEqual({ kind: "usp" });
    const upcoming = getPromoState(at("2027-01-31T12:00:00+01:00"));
    expect(upcoming).toMatchObject({ kind: "drop-upcoming", target: "2027-02-05T19:00:00+01:00" });
    expect(upcoming.kind === "drop-upcoming" && upcoming.drop.slug).toBe("love-club");
  });

  it("uses exact 7-day windows for upcoming and live drops", () => {
    const start = at(loveClub.startsAt);
    const week = 7 * 86_400_000;
    expect(PROMO_UPCOMING_DAYS).toBe(7);
    expect(PROMO_LIVE_DAYS).toBe(7);
    expect(getPromoState(start - week - 1000).kind).toBe("usp");
    expect(getPromoState(start - week).kind).toBe("drop-upcoming");
    expect(getPromoState(start - 1000).kind).toBe("drop-upcoming");
    expect(getPromoState(start).kind).toBe("drop-live");
    expect(getPromoState(start + week - 1000).kind).toBe("drop-live");
    expect(getPromoState(start + week).kind).toBe("usp");
  });

  it("has no timer for a campaign without showTimer", () => {
    const quiet = { ...launchGift, showTimer: false };
    expect(getPromoState(at("2026-11-28T12:00:00+01:00"), { campaigns: [quiet], drops })).toMatchObject({
      kind: "campaign",
      target: null,
    });
  });

  it("chooses the first started drop when two overlap", () => {
    const oranje = drops.find((drop) => drop.slug === "oranje-spark") as Drop;
    const mother = drops.find((drop) => drop.slug === "like-mother-like-daughter") as Drop;
    // 2 May 2027 12.00: Like Mother, Like Daughter started on 1 May; Oranje Spark has ended.
    const state = getPromoState(at("2027-05-02T12:00:00+02:00"), { campaigns: [], drops: [mother, oranje] });
    expect(state.kind === "drop-live" && state.drop.slug).toBe("like-mother-like-daughter");
    // 12 April: both drops are in their first 7 live days; the first started (Oranje Spark, 9 April) wins.
    const both = getPromoState(at("2027-04-12T12:00:00+02:00"), {
      campaigns: [],
      drops: [{ ...mother, startsAt: "2027-04-10T19:00:00+02:00" }, oranje],
    });
    expect(both.kind === "drop-live" && both.drop.slug).toBe("oranje-spark");
  });
});

describe("promoSchedule", () => {
  it("starts at `from`, is sorted and has an entry at every change", () => {
    const from = at("2026-11-20T12:00:00+01:00");
    const schedule = promoSchedule(from, 60);
    expect(schedule[0]).toMatchObject({ from });
    expect(schedule.map((entry) => entry.state.kind)).toEqual(["drop-upcoming", "campaign", "drop-live", "usp"]);
    expect(schedule.map((entry) => entry.from)).toEqual([
      from,
      at("2026-11-27T00:00:00+01:00"),
      at("2026-12-01T00:00:00+01:00"),
      at("2026-12-04T00:00:00+01:00"),
    ]);
    for (const entry of schedule) expect(getPromoState(entry.from)).toEqual(entry.state);
  });

  it("is never empty and repeats nothing", () => {
    const quiet = promoSchedule(at("2026-12-10T12:00:00+01:00"), 10);
    expect(quiet).toEqual([{ from: at("2026-12-10T12:00:00+01:00"), state: { kind: "usp" } }]);
    const year = promoSchedule(at("2026-11-20T12:00:00+01:00"), 400);
    for (let i = 1; i < year.length; i += 1) {
      expect(year[i].from).toBeGreaterThan(year[i - 1].from);
      expect(JSON.stringify(year[i].state)).not.toBe(JSON.stringify(year[i - 1].state));
    }
  });
});

describe("labels (cases 26, 29, 30)", () => {
  it("case 26: formatEndLabel at midnight shows the last included day", () => {
    expect(formatEndLabel("2026-12-01T00:00:00+01:00")).toBe("t/m 30 november");
    expect(formatEndLabel("2027-01-01T00:00:00+01:00")).toBe("t/m 31 december");
    expect(formatEndLabel("2027-02-28T23:59:00+01:00")).toBe("tot 28 februari 23.59 uur");
  });

  it("case 29: formatCountdownSr says Begint or Eindigt (decision 135)", () => {
    expect(formatCountdownSr("2026-11-27T00:00:00+01:00", "start")).toBe("Begint op vrijdag 27 november om 00.00 uur");
    expect(formatCountdownSr("2026-12-01T00:00:00+01:00", "end")).toBe("Eindigt op maandag 30 november om middernacht");
    expect(formatCountdownSr("2027-01-01T00:00:00+01:00", "end")).toBe("Eindigt op donderdag 31 december om middernacht");
    expect(formatCountdownSr("2027-02-05T19:00:00+01:00", "start")).toBe("Begint op vrijdag 5 februari om 19.00 uur");
    expect(formatCountdownSr("2027-02-28T23:59:00+01:00", "end")).toBe("Eindigt op zondag 28 februari om 23.59 uur");
  });

  it("case 30: formatStartLabel", () => {
    expect(formatStartLabel("2027-02-05T19:00:00+01:00")).toBe("vrijdag 5 februari om 19.00 uur");
    expect(formatStartLabel("2027-06-04T19:00:00+02:00")).toBe("vrijdag 4 juni om 19.00 uur");
    expect(formatStartLabel("2026-11-27T00:00:00+01:00")).toBe("vrijdag 27 november om 00.00 uur");
  });

  it("formats a receipt time and a day with month", () => {
    expect(formatDateTimeNl(at("2026-11-26T14:03:00+01:00"))).toBe("26 november 2026 om 14.03 uur");
    expect(formatDateTimeNl(at("2027-07-01T07:05:00Z"))).toBe("1 juli 2027 om 09.05 uur");
    expect(formatDayMonth(site.launchAt)).toBe("27 november");
    expect(formatDayMonth(at("2026-11-26T23:30:00Z"))).toBe("27 november");
  });
});

describe("server clock boundaries (case 28)", () => {
  it("timeBoundaries is sorted and unique and holds every content boundary", () => {
    const boundaries = timeBoundaries();
    for (let i = 1; i < boundaries.length; i += 1) expect(boundaries[i]).toBeGreaterThan(boundaries[i - 1]);
    const expected = [
      site.launchAt,
      site.vat.switchAt,
      ...campaigns.flatMap((c) => [c.startsAt, c.endsAt]),
      ...drops.flatMap((d) => [d.startsAt, d.endsAt]),
      ...giftWrap.freeWindows.flatMap((w) => [w.startsAt, w.endsAt]),
    ].map(at);
    for (const ms of expected) expect(boundaries).toContain(ms);
    for (const drop of drops) {
      expect(boundaries).toContain(earlyAccessAt(drop));
      expect(boundaries).toContain(at(drop.startsAt) - PROMO_UPCOMING_DAYS * 86_400_000);
      expect(boundaries).toContain(at(drop.startsAt) + PROMO_LIVE_DAYS * 86_400_000);
    }
  });

  it("case 28: the next boundary after 20 November 12.00 is early access for Holiday Sparkle", () => {
    expect(nextBoundary(at("2026-11-20T12:00:00+01:00"))).toBe(at("2026-11-26T00:00:00+01:00"));
    // On a boundary the next one is strictly later.
    expect(nextBoundary(at("2026-11-26T00:00:00+01:00"))).toBe(at("2026-11-27T00:00:00+01:00"));
    expect(nextBoundary(at("2030-01-01T00:00:00+01:00"))).toBeNull();
  });
});

describe("source", () => {
  it("never reads the clock itself", () => {
    const source = readFileSync(new URL("./dates.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/Date\.now\(|new Date\(|performance\.now\(/);
  });
});
