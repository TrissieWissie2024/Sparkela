import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";
import { cookieTable, legalUi } from "@/content/legal";
import { site } from "@/content/site";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";
import { LegalPage, legalPage } from "@/components/legal/LegalPage";

/**
 * /cookies (docs/PLAN.md §14.16, decision 138): the legal text plus the table of every cookie and storage key
 * (cookieTable in content/legal.ts) and the cookie settings button, which renders nothing while analytics is off.
 * Everything on this page is C1's; nothing waits for the consent banner. Static, open during the prelaunch.
 */
const page = legalPage("cookies");

export const metadata: Metadata = pageMetadata({ title: page.title, description: page.description, path: "/cookies" });

/** A table from the md breakpoint up; on phones the same rows as cards, so nothing scrolls sideways. */
function CookieTableView() {
  const { caption, columns, rows } = cookieTable;
  return (
    <div className="mt-6 max-w-[56rem]">
      <table className="hidden w-full border-collapse overflow-hidden rounded-kaart bg-kaart text-left tekst-klein ring-1 ring-rand md:table">
        <caption className="pb-3 text-left font-semibold text-tekst">{caption}</caption>
        <thead>
          <tr className="border-b border-rand text-tekst">
            <th scope="col" className="px-4 py-3 font-semibold">
              {columns.name}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {columns.purpose}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {columns.duration}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {columns.when}
            </th>
          </tr>
        </thead>
        <tbody className="text-tekst-2">
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-rand last:border-b-0">
              <th scope="row" className="px-4 py-3 align-top font-semibold break-all text-tekst">
                {row.name}
              </th>
              <td className="px-4 py-3 align-top">{row.purpose}</td>
              <td className="px-4 py-3 align-top">{row.duration}</td>
              <td className="px-4 py-3 align-top">{row.when}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="md:hidden">
        <p className="font-semibold text-tekst">{caption}</p>
        <ul className="mt-3 space-y-3">
          {rows.map((row) => (
            <li key={row.name} className="rounded-kaart border border-rand bg-kaart p-4 tekst-klein">
              <p className="font-semibold break-all text-tekst">{row.name}</p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-tekst-2">
                <dt className="font-semibold">{columns.purpose}</dt>
                <dd>{row.purpose}</dd>
                <dt className="font-semibold">{columns.duration}</dt>
                <dd>{row.duration}</dd>
                <dt className="font-semibold">{columns.when}</dt>
                <dd>{row.when}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function CookiesPage() {
  return (
    <LegalPage slug="cookies">
      <CookieTableView />
      {site.analytics.enabled ? (
        <div className="mt-6 max-w-[42rem]">
          <p className="text-tekst-2">{legalUi.cookieSettingsIntro}</p>
          <CookieSettingsButton className="mt-2" />
        </div>
      ) : null}
    </LegalPage>
  );
}
