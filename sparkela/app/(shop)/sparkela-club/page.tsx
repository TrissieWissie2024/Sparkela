import type { Metadata } from "next";
import { Check } from "lucide-react";

import type { Drop } from "@/lib/types";
import { getZonedParts, MONTHS_NL, toMs } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";
import { getServerNow } from "@/lib/server-clock";
import { pagesCopy } from "@/content/copy/pages";
import { drops } from "@/content/drops";
import { site } from "@/content/site";
import { Spark } from "@/components/brand/Spark";
import { SubscribeForm } from "@/components/forms/SubscribeForm";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { sharedCopy } from "@/content/copy/shared";
import { PageHeader } from "@/components/pages/PageHeader";
import { Container } from "@/components/ui/Container";

/**
 * /sparkela-club (docs/PLAN.md §14.9, decision 63; brief §6): the Club is the newsletter. PageHeader with the H1
 * site.club.title ("Als eerste bij elke drop. Plus 10% op je eerste bestelling."), the three benefits (first at every
 * drop, 24 hours early access, 10% on the first order), SubscribeForm source="club" with "Ik doe mee" (the consent
 * checkbox and privacy link are part of the form), which mails you get and that you can always unsubscribe, and the
 * upcoming drops: name and month only, no timers, only drops whose public start lies in the future.
 *
 * Fix 7-9: the sign-up card comes right after the intro (on a phone the field is on the first screen), the benefits
 * follow; every section H2 is kop-2. The card carries data-eigen-club, so the footer leaves out its own Club block
 * (app/globals.css): the page never shows the same form twice.
 *
 * Static (○): "in the future" is decided with getServerNow() (cached; it refreshes right after a drop start, because
 * every startsAt is a time boundary of clockLife). After the launch the waitlist redirects here (§11.8).
 */
const copy = pagesCopy.club;

export const metadata: Metadata = pageMetadata({
  title: copy.metaTitle,
  description: copy.metaDescription,
  path: "/sparkela-club",
});

/** The drops whose public start is after `now`, earliest first. */
function upcomingDrops(now: number): Drop[] {
  return drops.filter((drop) => toMs(drop.startsAt) > now).sort((a, b) => toMs(a.startsAt) - toMs(b.startsAt));
}

/** "februari 2027" in Amsterdam time. */
function dropMonth(drop: Drop): string {
  const parts = getZonedParts(toMs(drop.startsAt));
  return copy.drops.month(MONTHS_NL[parts.month - 1], String(parts.year));
}

export default async function SparkelaClubPage() {
  const upcoming = upcomingDrops(await getServerNow());

  return (
    <>
      <PageHeader
        eyebrow={copy.eyebrow}
        title={site.club.title}
        sentenceLines
        intro={copy.intro}
        breadcrumbs={[{ label: sharedCopy.ui.home, href: "/" }, { label: copy.eyebrow }]}
      />

      <Container className="pb-16 md:pb-24">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start lg:gap-x-8">
          <div className="flex min-w-0 flex-col gap-10 lg:col-span-7">
            <section aria-labelledby="club-aanmelden" data-eigen-club className="rounded-kaart border border-rand bg-kaart p-6 md:p-8">
              <h2 id="club-aanmelden" className="kop-2 text-tekst">
                {copy.form.title}
              </h2>
              <p className="mt-2 text-tekst-2">{copy.form.text}</p>
              <SubscribeForm source="club" submitLabel={site.club.cta} layout="inline" className="mt-6" />
            </section>

            <section aria-labelledby="club-voordelen">
              <h2 id="club-voordelen" className="kop-2 text-tekst">
                {copy.benefitsTitle}
              </h2>
              <ul className="mt-5 border-t border-rand">
                {copy.benefits.map((benefit) => (
                  <li key={benefit.title} className="flex items-start gap-4 border-b border-rand py-4 md:py-5">
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-roest-100 text-roest"
                    >
                      <Spark className="size-4" />
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span className="kop-4 block text-tekst">{benefit.title}</span>
                      <span className="tekst-klein mt-0.5 block text-tekst-2">{benefit.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="lg:sticky lg:top-[calc(var(--header-hoogte)+1.5rem)] lg:col-span-5">
            <PhotoSlot
              assetKey="club.hero"
              label={copy.photoLabel}
              aspect="4:5"
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="rounded-kaart"
            />
          </div>
        </div>
      </Container>

      <div className="bg-vlak">
        <Container className="sectie-kort grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-x-8">
          <section aria-labelledby="club-mails" className="lg:col-span-5">
            <h2 id="club-mails" className="kop-2 text-tekst">
              {copy.mails.title}
            </h2>
            <ul className="mt-6 flex flex-col gap-3">
              {copy.mails.items.map((item) => (
                <li key={item} className="flex items-start gap-3 leading-relaxed text-tekst">
                  <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-olijf" strokeWidth={2.25} />
                  {item}
                </li>
              ))}
            </ul>
            <p className="tekst-klein mt-6 text-tekst-2">{copy.mails.unsubscribe}</p>
          </section>

          <section aria-labelledby="club-drops" className="lg:col-span-6 lg:col-start-7">
            <h2 id="club-drops" className="kop-2 text-tekst">
              {copy.drops.title}
            </h2>
            <p className="mt-3 max-w-[36rem] leading-relaxed text-tekst-2">{copy.drops.intro}</p>
            {upcoming.length > 0 ? (
              <ol aria-label={copy.drops.listLabel} className="mt-6 border-t border-rand-sterk">
                {upcoming.map((drop) => (
                  <li
                    key={drop.slug}
                    className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-4 border-b border-rand-sterk py-4 sm:grid-cols-[9rem_minmax(0,1fr)]"
                  >
                    <span className="label-caps tabular text-tekst-2">{dropMonth(drop)}</span>
                    <span className="min-w-0">
                      <span className="kop-4 block text-tekst">{drop.name}</span>
                      <span className="tekst-klein mt-0.5 block text-tekst-2">{drop.tagline}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-6 text-tekst">{copy.drops.empty}</p>
            )}
          </section>
        </Container>
      </div>
    </>
  );
}
