import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";
import { formsCopy } from "@/content/copy/forms";
import { pagesCopy } from "@/content/copy/pages";
import { sharedCopy } from "@/content/copy/shared";
import { site } from "@/content/site";
import { WithdrawalForm } from "@/components/forms/WithdrawalForm";
import { LegalNotice } from "@/components/legal/LegalNotice";
import { legalPage, legalSource } from "@/components/legal/LegalPage";
import { Markdown } from "@/components/legal/Markdown";
import { PageHeader } from "@/components/pages/PageHeader";
import { Container } from "@/components/ui/Container";

/**
 * /herroepen (brief §6 Herroepen, §2.10; docs/PLAN.md §14.14): the target of "Hier de overeenkomst herroepen" on every
 * page. The H1 "Herroepen", a short explanation (14 days, the hygiene rule), the WithdrawalForm with its one button
 * "Herroeping bevestigen" (the receipt appears in the same card), and below it the model withdrawal form from
 * content/legal/herroepen.md as text. Static, open during the prelaunch (early-access buyers order before the launch).
 */
const copy = formsCopy.withdrawal;
const model = legalPage("herroepen");

export const metadata: Metadata = pageMetadata({ title: copy.title, description: copy.metaDescription, path: "/herroepen" });

export default function WithdrawalPage() {
  return (
    <>
      <PageHeader
        eyebrow={pagesCopy.pageEyebrows.service}
        title={copy.title}
        intro={copy.intro(String(site.returnDays))}
        breadcrumbs={[{ label: sharedCopy.ui.home, href: "/" }, { label: copy.title }]}
      />
      <Container className="pb-16 md:pb-24">
        <div className="max-w-[48rem]">
          <section aria-labelledby="herroepen-hygiene" className="rounded-kaart bg-vlak px-5 py-4">
            <h2 id="herroepen-hygiene" className="font-semibold text-tekst">
              {copy.hygieneTitle}
            </h2>
            <p className="mt-1 text-tekst-2">{site.hygieneRule}</p>
          </section>
          <div className="mt-8">
            <WithdrawalForm />
          </div>
        </div>
        <section aria-labelledby="herroepen-model" className="mt-14 border-t border-rand pt-10 md:mt-20">
          <h2 id="herroepen-model" className="kop-2 text-tekst">
            {model.title}
          </h2>
          <LegalNotice className="mt-6 max-w-[42rem]" />
          <Markdown source={legalSource("herroepen")} className="mt-6" />
        </section>
      </Container>
    </>
  );
}
