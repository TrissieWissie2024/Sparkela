import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";

import { cn } from "@/lib/cn";
import { pageMetadata } from "@/lib/seo";
import { pagesCopy } from "@/content/copy/pages";
import { site } from "@/content/site";
import { PageHeader } from "@/components/pages/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

/**
 * /account (docs/PLAN.md §2.2, §14.17, decision 53; brief §6: "Account (doorverwijzing naar de klantaccounts van
 * Shopify)"). Normally proxy.ts sends /account with a 307 to SHOPIFY_CUSTOMER_ACCOUNT_URL, so this page is the fallback
 * without that variable: H1 "Account", "Inloggen kan straks hier. Vragen over je bestelling? Mail ons.", a mail button
 * and links to contact and withdrawal (plus shipping and the FAQ). Deliberately no sign-in form: fields that do nothing
 * would be a pretence (as in CORVANE app/account/page.tsx). noindex; static (○), open during the prelaunch.
 */
const copy = pagesCopy.account;

export const metadata: Metadata = pageMetadata({
  title: copy.title,
  description: copy.metaDescription,
  path: "/account",
  noindex: true,
});

export default function AccountPage() {
  return (
    <>
      <PageHeader title={copy.title} intro={copy.text} />
      <Container className="pb-16 md:pb-24">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-x-8">
          <section aria-labelledby="account-hulp" className="rounded-kaart bg-vlak p-6 md:p-8 lg:col-span-5 lg:self-start">
            <h2 id="account-hulp" className="kop-3 text-tekst">
              {copy.help.title}
            </h2>
            <p className="mt-3 leading-relaxed text-tekst-2">{copy.help.text}</p>
            <a href={`mailto:${site.email}`} className={cn(buttonClasses({ variant: "outline" }), "mt-6")}>
              <Mail aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
              {copy.help.mailLabel}
            </a>
            <p className="tekst-klein mt-3 text-tekst-2">{site.email}</p>
          </section>

          <section aria-labelledby="account-links" className="lg:col-span-7 lg:col-start-6">
            <h2 id="account-links" className="kop-3 text-tekst">
              {copy.links.title}
            </h2>
            <ul className="mt-5 border-t border-rand">
              {copy.links.items.map((link) => (
                <li key={link.href} className="border-b border-rand">
                  <Link href={link.href} className="group flex min-h-11 items-center justify-between gap-6 py-5 text-tekst no-underline">
                    <span className="min-w-0">
                      <span className="kop-4 block underline-offset-4 group-hover:underline">{link.label}</span>
                      <span className="tekst-klein mt-1 block text-tekst-2">{link.description}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-rand-sterk transition-colors group-hover:border-tekst"
                    >
                      <ArrowRight className="size-[18px]" strokeWidth={1.75} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Container>
    </>
  );
}
