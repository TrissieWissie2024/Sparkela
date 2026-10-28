import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { chromeCopy } from "@/content/copy/chrome";
import { sharedCopy } from "@/content/copy/shared";
import { footerNav, legalNav } from "@/content/navigation";
import { confirmedSocials as socials, site } from "@/content/site";
import { Logo } from "@/components/brand/Logo";
import { CookieSettingsButton } from "@/components/consent/ConsentSlots";
import { SubscribeForm } from "@/components/forms/SubscribeForm";
import { VatNotice } from "@/components/time/VatNotice";
import { Container } from "@/components/ui/Container";
import { SentenceLines } from "@/components/ui/SentenceLines";

import { CompanyDetails } from "./CompanyDetails";
import { PaymentBadges } from "./PaymentBadges";

/**
 * The site footer (docs/PLAN.md §2.5, §13.5; brief §6 block 16, §2.8, §2.10). A server component on donker with
 * data-vlak="donker" (bot-wit focus ring); SubscribeForm and CookieSettingsButton are its only client islands.
 *
 * Top to bottom:
 * 1. The Sparkela Club sign-up: site.club.title as heading, one line and SubscribeForm source="footer" (the exact
 *    consent sentence on an unchecked checkbox, the privacy link, double opt-in; the reward is in the title and in
 *    the line under the field). A page that shows its own Club sign-up marks it with data-eigen-club; app/globals.css
 *    then hides this block (and the hairline above the links), so the same form never shows twice in a row (fix 7-9).
 *    QA round 1 (brief §5, 70/20/10): no benefit checklist any more (title and form line say it), tighter padding,
 *    and a wordmark of at most 36rem, so the dark footer no longer fills most of a short page.
 * 2. Link columns Shop / Klantenservice / Sparkela / Juridisch (footerNav): 2 columns on phones, 4 from md. The
 *    Juridisch column gets "Cookie-instellingen" only while analytics is on.
 * 3. Payment methods as neutral text badges and the socials (open in a new window, ↗, rel="noopener"): only the
 *    confirmed ones (confirmedSocials, QA round 3), so no guessed handle is linked before the accounts exist.
 * 4. The company details (placeholders until TODO-LAUNCH), the VAT line by date, the withdrawal link
 *    <a href="/herroepen">Hier de overeenkomst herroepen</a> (exactly this label and target, on every page) and the
 *    copyright with the year as a literal from content.
 * 5. The wordmark, the container width on phones and at most 36rem from md (decorative: the name is in the copyright
 *    line). QA round 2: its free space is trimmed left and right (Logo trimInline), so its letters run from the
 *    column's edge like every other footer line and the tagline under it; the container gutter is the free space on
 *    the sides, as in the header and on /nieuwsbrief/bevestigen (decisions 161, 216n), and it keeps its free space
 *    above and below (brief §3).
 * Task pages (checkout, search, account, contact) mark themselves with data-compacte-footer: app/globals.css then shows only
 * the compact legal row (legalNav), the withdrawal link, the company details and the VAT line, like MiniFooter.
 * Hidden in print. Port of CORVANE components/layout/Footer.tsx.
 */

/** 44 px tall and at least 44 px wide targets; the lists have no gap, so 44 px is the rhythm. */
const linkClasses =
  "inline-flex min-h-11 min-w-11 items-center text-[0.9375rem] text-tekst-op-donker decoration-1 underline-offset-4 hover:underline";

export function Footer() {
  const copy = chromeCopy.footer;

  return (
    // --pill-ruimte: set by EmailCapture while the Spark pill shows, so the pill never covers the wordmark at the end.
    <footer data-vlak="donker" className="bg-donker pb-[var(--pill-ruimte,0px)] text-tekst-op-donker print:hidden">
      <Container>
        <div
          data-footer-club
          className="grid grid-cols-1 gap-6 pt-12 pb-12 md:gap-8 md:pt-20 md:pb-16 lg:grid-cols-12 lg:items-start lg:gap-x-8"
        >
          <div className="lg:col-span-5">
            {/* One sentence per line (QA round 2): never "Als eerste bij elke / drop. Plus 10% op / …". */}
            <h2 className="kop-2 text-tekst-op-donker">
              <SentenceLines text={site.club.title} />
            </h2>
            <p className="mt-3 max-w-[30rem] text-tekst-2-op-donker md:mt-4">{copy.clubIntro}</p>
          </div>
          <SubscribeForm source="footer" tone="donker" layout="inline" className="lg:col-span-6 lg:col-start-7 lg:pt-2" />
        </div>

        <nav
          data-footer-nav
          aria-label={copy.navLabel}
          className="grid grid-cols-2 gap-x-6 gap-y-8 border-t border-rand-op-donker py-10 md:grid-cols-4 md:gap-x-8 md:py-14"
        >
          {footerNav.map((column, index) => (
            <div key={column.title}>
              <h2 className="label-caps text-tekst-2-op-donker">{column.title}</h2>
              <ul className="mt-3 flex flex-col">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClasses}>
                      {link.label}
                    </Link>
                  </li>
                ))}
                {index === footerNav.length - 1 && site.analytics.enabled ? (
                  <li>
                    <CookieSettingsButton tone="donker" />
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </nav>

        {/* Shown instead of the link columns, the Club and the wordmark on task pages (data-compacte-footer). */}
        <nav data-footer-compact aria-label={copy.compactNavLabel} className="hidden pt-8">
          <ul className="flex flex-wrap gap-x-6">
            {legalNav.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClasses}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div
          data-footer-social
          className="flex flex-col gap-8 border-t border-rand-op-donker pt-10 md:flex-row md:items-center md:justify-between"
        >
          <PaymentBadges tone="donker" />
          {socials.length > 0 ? (
            <ul aria-label={copy.socialsLabel} className="flex flex-wrap items-center gap-x-7">
              {socials.map((social) => (
                <li key={social.id}>
                  <a href={social.href} target="_blank" rel="noopener" className={linkClasses}>
                    {social.label}
                    <ArrowUpRight aria-hidden="true" className="ml-1 size-4 text-tekst-2-op-donker" strokeWidth={1.75} />
                    <span className="sr-only"> {sharedCopy.ui.newWindow}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col gap-6 tekst-klein text-tekst-2-op-donker md:mt-10 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div>
            <h2 className="sr-only">{copy.companyLabel}</h2>
            <CompanyDetails />
            <VatNotice tone="donker" className="mt-3" />
          </div>

          <div className="flex flex-col gap-1 lg:items-end lg:text-right">
            {/* Exactly this label and target on every page (brief §2.10); a plain <a>, as in MiniFooter. */}
            <a
              href="/herroepen"
              className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-tekst-op-donker underline underline-offset-4 hover:decoration-2"
            >
              {site.withdrawalLinkLabel}
            </a>
            <p className="text-tekst-op-donker">{copy.copyright}</p>
          </div>
        </div>

        {/* The logo carries its own free space above and below (decision 161), so the padding around it stays small. */}
        {/* The lead tagline (site.taglines[0], brief §3) beside the wordmark: from md it fills the row's right side. */}
        <div
          data-footer-wordmark
          className="flex flex-col gap-1 pt-6 pb-6 md:flex-row md:items-center md:justify-between md:gap-8 md:pt-8 md:pb-4"
        >
          <div aria-hidden="true" className="w-full max-w-[36rem]">
            <Logo variant="op-donker" width={600} trimInline className="h-auto w-full" />
          </div>
          {/* English inside lang="nl": marked, so a Dutch voice does not read it as Dutch (WCAG 3.1.2, QA round 3). */}
          <p lang={site.taglineLangs[0]} className="label-caps text-tekst-2-op-donker">
            {site.taglines[0]}
          </p>
        </div>
        <div data-footer-compact className="hidden h-8" />
      </Container>
    </footer>
  );
}
