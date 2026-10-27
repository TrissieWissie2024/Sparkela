import Link from "next/link";

import { formsCopy } from "@/content/copy/forms";
import { legalNav } from "@/content/navigation";
import { site } from "@/content/site";
import { VatNotice } from "@/components/time/VatNotice";
import { Container } from "@/components/ui/Container";

/**
 * The footer of the (kaal) layout: the waitlist and the confirmation page (docs/PLAN.md §13.5, §14.20). The legal
 * links (legalNav, all open during the prelaunch), the withdrawal link exactly as in the shop footer
 * (<a href="/herroepen">{site.withdrawalLinkLabel}</a>, brief §2.10), the company details and the VAT line. Dark
 * (data-vlak="donker"), like the pages above it. Server component.
 */
export function MiniFooter() {
  const copy = formsCopy.miniFooter;
  const { company } = site;
  const link = "inline-flex min-h-11 items-center text-sm text-tekst-op-donker underline-offset-4 hover:underline";
  return (
    <footer data-vlak="donker" className="border-t border-rand-op-donker bg-donker text-tekst-op-donker print:hidden">
      <Container className="flex flex-col gap-4 py-8 md:py-10">
        <nav aria-label={copy.legalLabel}>
          <ul className="flex flex-wrap gap-x-6">
            {legalNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={link}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a href="/herroepen" className={`${link} font-semibold underline`}>
                {site.withdrawalLinkLabel}
              </a>
            </li>
          </ul>
        </nav>
        <div aria-label={copy.companyLabel} role="group" className="tekst-klein text-tekst-2-op-donker">
          <p>
            {company.tradeName} · {company.legalName} · {company.address}
          </p>
          <p>
            {copy.kvk(company.kvk)} · {copy.vatId(company.vatId)} · <a href={`mailto:${site.email}`} className="text-tekst-op-donker underline underline-offset-4 hover:decoration-2">{site.email}</a>
          </p>
        </div>
        <VatNotice tone="donker" />
      </Container>
    </footer>
  );
}
