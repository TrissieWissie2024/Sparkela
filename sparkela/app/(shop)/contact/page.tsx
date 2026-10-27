import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/seo";
import { formsCopy } from "@/content/copy/forms";
import { site } from "@/content/site";
import { ContactForm } from "@/components/forms/ContactForm";
import { PageHeader } from "@/components/pages/PageHeader";
import { Container } from "@/components/ui/Container";

/**
 * /contact (docs/PLAN.md §14.15): the e-mail address and the response time ("Binnen 1 werkdag antwoord"), the
 * ContactForm, the company details and links to the FAQ, shipping and withdrawal. Static, open during the prelaunch.
 */
const copy = formsCopy.contact;

export const metadata: Metadata = pageMetadata({ title: copy.title, description: copy.metaDescription, path: "/contact" });

const linkClass = "inline-flex min-h-11 items-center text-link underline underline-offset-4 hover:text-link-hover hover:decoration-2";

export default function ContactPage() {
  const { company } = site;
  return (
    <>
      <PageHeader title={copy.title} intro={copy.intro} />
      <Container className="grid gap-10 pb-16 md:pb-24 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
        <div className="min-w-0">
          <ContactForm />
        </div>
        <aside className="flex flex-col gap-8">
          <section aria-labelledby="contact-mail">
            <h2 id="contact-mail" className="kop-3 text-tekst">
              {copy.emailTitle}
            </h2>
            <p className="mt-2">
              <a href={`mailto:${site.email}`} className={`${linkClass} font-semibold`}>
                {site.email}
              </a>
            </p>
            <p className="tekst-klein text-tekst-2">{copy.responseTime}</p>
          </section>
          <section aria-labelledby="contact-bedrijf">
            <h2 id="contact-bedrijf" className="kop-3 text-tekst">
              {copy.companyTitle}
            </h2>
            <address className="mt-2 tekst-klein text-tekst-2 not-italic">
              {company.tradeName}
              <br />
              {company.legalName}
              <br />
              {company.address}
              <br />
              {formsCopy.miniFooter.kvk(company.kvk)}
              <br />
              {formsCopy.miniFooter.vatId(company.vatId)}
            </address>
          </section>
          <section aria-labelledby="contact-meer">
            <h2 id="contact-meer" className="kop-3 text-tekst">
              {copy.moreTitle}
            </h2>
            <ul className="mt-1">
              <li>
                <Link href="/veelgestelde-vragen" className={linkClass}>
                  {copy.faqLink}
                </Link>
              </li>
              <li>
                <Link href="/verzenden-en-retourneren" className={linkClass}>
                  {copy.shippingLink}
                </Link>
              </li>
              <li>
                <Link href="/herroepen" className={linkClass}>
                  {copy.withdrawalLink}
                </Link>
              </li>
            </ul>
          </section>
        </aside>
      </Container>
    </>
  );
}
