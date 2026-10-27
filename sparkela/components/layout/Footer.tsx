import { ArrowUpRight, Check } from "lucide-react";
import Link from "next/link";

import { chromeCopy } from "@/content/copy/chrome";
import { sharedCopy } from "@/content/copy/shared";
import { footerNav } from "@/content/navigation";
import { site } from "@/content/site";
import { Logo } from "@/components/brand/Logo";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";
import { SubscribeForm } from "@/components/forms/SubscribeForm";
import { VatNotice } from "@/components/time/VatNotice";
import { Container } from "@/components/ui/Container";

import { PaymentBadges } from "./PaymentBadges";

/**
 * The site footer (docs/PLAN.md §2.5, §13.5; brief §6 block 16, §2.8, §2.10). A server component on donker with
 * data-vlak="donker" (bot-wit focus ring); SubscribeForm and CookieSettingsButton are its only client islands.
 *
 * Top to bottom:
 * 1. The Sparkela Club sign-up: site.club.title as heading, a line, the three benefits and SubscribeForm
 *    source="footer" (the exact consent sentence on an unchecked checkbox, the privacy link, double opt-in). A page
 *    that shows its own Club sign-up marks it with data-eigen-club; app/globals.css then hides this block (and the
 *    hairline above the links), so the same form never shows twice in a row (fix 7-9).
 * 2. Link columns Shop / Klantenservice / Sparkela / Juridisch (footerNav): 2 columns on phones, 4 from md. The
 *    Juridisch column gets "Cookie-instellingen" only while analytics is on.
 * 3. Payment methods as neutral text badges and the socials (open in a new window, ↗, rel="noopener").
 * 4. The company details (placeholders until TODO-LAUNCH), the VAT line by date, the withdrawal link
 *    <a href="/herroepen">Hier de overeenkomst herroepen</a> (exactly this label and target, on every page) and the
 *    copyright with the year as a literal from content.
 * 5. The wordmark across the container width (decorative: the name is in the copyright line).
 * Hidden in print. Port of CORVANE components/layout/Footer.tsx.
 */

/** 44 px tall and at least 44 px wide targets; the lists have no gap, so 44 px is the rhythm. */
const linkClasses =
  "inline-flex min-h-11 min-w-11 items-center text-[0.9375rem] text-tekst-op-donker decoration-1 underline-offset-4 hover:underline";

export function Footer() {
  const { company } = site;
  const copy = chromeCopy.footer;

  return (
    <footer data-vlak="donker" className="bg-donker text-tekst-op-donker print:hidden">
      <Container>
        <div
          data-footer-club
          className="grid grid-cols-1 gap-8 pt-16 pb-14 md:pt-24 md:pb-20 lg:grid-cols-12 lg:items-start lg:gap-x-8"
        >
          <div className="lg:col-span-5">
            <h2 className="kop-2 text-tekst-op-donker">
              {site.club.title}
            </h2>
            <p className="mt-3 max-w-[30rem] text-tekst-2-op-donker md:mt-4">{copy.clubIntro}</p>
            <ul className="mt-5 flex flex-col gap-2">
              {site.club.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-[0.9375rem]">
                  <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-tekst-2-op-donker" strokeWidth={2} />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
          <SubscribeForm source="footer" tone="donker" layout="inline" className="lg:col-span-6 lg:col-start-7 lg:pt-2" />
        </div>

        <nav
          data-footer-nav
          aria-label={copy.navLabel}
          className="grid grid-cols-2 gap-x-6 gap-y-10 border-t border-rand-op-donker py-12 md:grid-cols-4 md:gap-x-8 md:py-16"
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

        <div className="flex flex-col gap-8 border-t border-rand-op-donker pt-10 md:flex-row md:items-center md:justify-between">
          <PaymentBadges tone="donker" />
          <ul aria-label={copy.socialsLabel} className="flex flex-wrap items-center gap-x-7">
            {site.socials.map((social) => (
              <li key={social.id}>
                <a href={social.href} target="_blank" rel="noopener" className={linkClasses}>
                  {social.label}
                  <ArrowUpRight aria-hidden="true" className="ml-1 size-4 text-tekst-2-op-donker" strokeWidth={1.75} />
                  <span className="sr-only"> {sharedCopy.ui.newWindow}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex flex-col gap-6 tekst-klein text-tekst-2-op-donker md:mt-10 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div>
            <h2 className="sr-only">{copy.companyLabel}</h2>
            <address className="flex flex-col not-italic">
              <span>
                {company.tradeName} · {company.legalName}
              </span>
              <span>{company.address}</span>
              <span>
                {copy.kvk(company.kvk)} · {copy.vatId(company.vatId)}
              </span>
              <span>
                <a href={`mailto:${site.email}`} className="text-tekst-op-donker underline underline-offset-4 hover:decoration-2">
                  {site.email}
                </a>
              </span>
            </address>
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

        {/* The logo carries its own free space (decision 161), so the padding around it stays small. */}
        <div aria-hidden="true" className="pt-8 pb-2 md:pt-12 md:pb-4">
          <Logo variant="op-donker" width={600} className="h-auto w-full" />
        </div>
      </Container>
    </footer>
  );
}
