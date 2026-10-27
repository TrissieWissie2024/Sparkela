import { money } from "@/lib/money";
import type { ShippingConfig } from "@/lib/types";

/**
 * Shipping config (docs/PLAN.md §9.3, brief §4). The single source for rates, the free-shipping threshold,
 * the 16.00 cut-off and the days dispatch is closed. lib/dates.ts computes dispatch days from it; copy derives
 * amounts and times from it (content/site.ts, content/copy/shared.ts), so text and config never drift.
 *
 * Holidays (decision 54): New Year's Day, Easter (both days), King's Day, Ascension Day, Whitsun (both days)
 * and Christmas (both days). Good Friday is a working day; Liberation Day (5 May) is only off in lustrum
 * years (2025, 2030), so 2026 and 2027 ship as usual. Christmas Eve and New Year's Eve are normal working days.
 * content/shipping.test.ts recomputes this list with lib/holidays.ts, so a typo shows up.
 *
 * Belgium is ready but switched off (brief §4); its rates are placeholders (plan §22 point 18).
 */
export const shipping: ShippingConfig = {
  timeZone: "Europe/Amsterdam",
  cutoff: { hour: 16, minute: 0, label: "16.00" },
  carrier: "PostNL",
  method: "brievenbuspakje",
  countries: {
    NL: {
      code: "NL",
      enabled: true,
      label: "Nederland",
      rate: money(395),
      freeFrom: money(3500),
      transitDays: { min: 1, max: 2 },
    },
    BE: {
      code: "BE",
      enabled: false,
      label: "België",
      rate: money(595),
      freeFrom: money(5000),
      transitDays: { min: 2, max: 3 },
    },
  },
  defaultCountry: "NL",
  holidays: [
    { date: "2026-01-01", name: "Nieuwjaarsdag" },
    { date: "2026-04-05", name: "Eerste paasdag" },
    { date: "2026-04-06", name: "Tweede paasdag" },
    { date: "2026-04-27", name: "Koningsdag" },
    { date: "2026-05-14", name: "Hemelvaartsdag" },
    { date: "2026-05-24", name: "Eerste pinksterdag" },
    { date: "2026-05-25", name: "Tweede pinksterdag" },
    { date: "2026-12-25", name: "Eerste kerstdag" },
    { date: "2026-12-26", name: "Tweede kerstdag" },
    { date: "2027-01-01", name: "Nieuwjaarsdag" },
    { date: "2027-03-28", name: "Eerste paasdag" },
    { date: "2027-03-29", name: "Tweede paasdag" },
    { date: "2027-04-27", name: "Koningsdag" },
    { date: "2027-05-06", name: "Hemelvaartsdag" },
    { date: "2027-05-16", name: "Eerste pinksterdag" },
    { date: "2027-05-17", name: "Tweede pinksterdag" },
    { date: "2027-12-25", name: "Eerste kerstdag" },
    { date: "2027-12-26", name: "Tweede kerstdag" },
    { date: "2028-01-01", name: "Nieuwjaarsdag" },
  ],
  // Extra closures (for example a holiday break). Empty at launch.
  closedDays: [],
  returnDays: 14,
};
