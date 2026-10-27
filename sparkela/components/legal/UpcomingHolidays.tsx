import { DAYS_NL, isoWeekdayOf, MONTHS_NL } from "@/lib/dates";
import type { IsoDate } from "@/lib/types";
import { legalUi } from "@/content/legal";
import { shipping } from "@/content/shipping";
import { site } from "@/content/site";

/**
 * The holidays on which nothing ships (docs/PLAN.md §13.13, §14.13), on /verzenden-en-retourneren: the holidays from
 * the launch day (site.launchAt) to the end of the year after, from content/shipping.ts, by year (QA round 1: the 2026
 * days before the shop opened read as stale). No clock: the list is the same for every visitor and stays correct in
 * a cached page. Server component.
 */

/** "2026-12-25" → "vrijdag 25 december". */
function holidayLabel(isoDate: IsoDate): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${DAYS_NL[isoWeekdayOf(isoDate) - 1]} ${day} ${MONTHS_NL[month - 1]}`;
}

export function UpcomingHolidays() {
  const launchDay = site.launchAt.slice(0, 10);
  const first = Number(launchDay.slice(0, 4));
  const years = [first, first + 1].map(String);
  return (
    <div className="mt-6 grid max-w-[42rem] gap-8 sm:grid-cols-2">
      {years.map((year) => {
        const days = shipping.holidays.filter((holiday) => holiday.date.startsWith(`${year}-`) && holiday.date >= launchDay);
        if (days.length === 0) return null;
        return (
          <section key={year} aria-label={legalUi.holidaysYear(year)}>
            <h3 className="tabular font-semibold text-tekst">{year}</h3>
            <ul className="mt-2 divide-y divide-rand">
              {days.map((holiday) => (
                <li key={holiday.date} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
                  <time dateTime={holiday.date} className="tabular text-tekst">
                    {holidayLabel(holiday.date)}
                  </time>
                  <span className="tekst-klein text-tekst-2">{holiday.name}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
