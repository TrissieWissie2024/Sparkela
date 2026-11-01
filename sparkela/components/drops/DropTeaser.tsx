import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import type { Drop } from "@/lib/types";
import { formatDayMonth, formatStartLabel } from "@/lib/dates";
import { dropPath } from "@/lib/paths";
import { collectionCopy } from "@/content/copy/collection";
import { sharedCopy } from "@/content/copy/shared";
import { site } from "@/content/site";
import { SubscribeForm } from "@/components/forms/SubscribeForm";
import { ClubBenefits } from "@/components/sections/ClubBenefits";
import { TimeGate } from "@/components/time/TimeGate";
import { buttonClasses } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Pill } from "@/components/ui/Pill";

import { DropCountdown } from "./DropCountdown";

/**
 * The teaser of a drop before access (docs/PLAN.md §9.5, §13.12, §14.6; decisions 21 and 63): the proxy rewrites
 * /drops/<slug> and the drop's product pages to /drops/<slug>/binnenkort until the visitor has early access or the
 * drop is public.
 *
 * QA round 3 (brief §5, about 70/20/10): the page had the shape of a roest wall with the full dark footer under it
 * (about 13% light at 1440). Now it has the shape of the live drop page:
 * 1. A roest band (data-vlak="roest", about as high as DropHero): "Binnenkort", the teaser title as the page's only
 *    H1, its line, and on the right (below on phones) "Live op {start}" with the real countdown to startsAt.
 * 2. On --pagina: a white card with the Club sign-up (SubscribeForm source="club"), because Club members get the
 *    early-access link, and next to it the three Club benefits (ClubBenefits, as on /sparkela-club). The card carries
 *    data-eigen-club, so the footer leaves out its own Club block.
 * 3. A quiet row "Alvast rondkijken?" with pill links into the shop (Nieuw, stacks, Spark Finder); before the launch
 *    "De shop opent op 27 november." with a link to the waitlist instead (QA round 6).
 * The page is single-purpose, like contact: it marks itself data-compacte-footer (app/globals.css).
 *
 * At startsAt the countdown makes way (TimeGate) for "Nu live" and a link to the drop. It is a plain <a>, not
 * next/link: the URL is the same path the proxy rewrote, so a full request lets the proxy decide again (decision 136).
 * No drop photo: nothing of the drop is shown before its reveal. Server component.
 */

export interface DropTeaserProps {
  drop: Drop;
  /** The server clock (getServerNow): a start in another calendar year gets its year (QA round 3). */
  now?: number;
}

export function DropTeaser({ drop, now }: DropTeaserProps) {
  const headingId = useId();
  const formId = useId();
  const benefitsId = useId();
  const meanwhileId = useId();
  const copy = collectionCopy.teaser;
  const live = sharedCopy.countdown.live;
  // "27 november" never breaks between day and month.
  const launchDay = formatDayMonth(site.launchAt).replace(/ /g, "\u00a0");

  return (
    <>
      {/* Single-purpose landing page: the footer shows only its compact rows (app/globals.css). */}
      <div data-compacte-footer="" hidden />

      <section aria-labelledby={headingId} data-vlak="roest" className="bg-roest text-bot-wit">
        <Container className="pt-10 pb-12 md:pt-14 md:pb-16 lg:py-20">
          <div className="grid gap-8 md:gap-10 lg:grid-cols-12 lg:items-end lg:gap-12">
            <div className="lg:col-span-7">
              <p className="label-caps text-bot-wit">{copy.eyebrow}</p>
              <h1 id={headingId} className="kop-1 mt-4 text-bot-wit">
                {drop.teaser.title}
              </h1>
              <p className="tekst-groot mt-4 max-w-[30rem] text-bot-wit">{drop.teaser.text}</p>
            </div>
            <div className="lg:col-span-5 lg:col-start-8">
              <p className="font-semibold text-bot-wit">{copy.startsOn(formatStartLabel(drop.startsAt, now))}</p>
              {/* With reduced motion the countdown is the fixed start label, the same date as the line above: left out. */}
              <TimeGate
                at={drop.startsAt}
                className="mt-3 min-h-11 motion-reduce:mt-0 motion-reduce:min-h-0"
                before={
                  <DropCountdown target={drop.startsAt} kind="start" liveLabel={live} now={now} className="motion-reduce:hidden" />
                }
                after={
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <Pill tone="outline-op-donker">{live}</Pill>
                    <a href={dropPath(drop.slug)} className={buttonClasses({ variant: "op-roest" })}>
                      {drop.banner.cta}
                      <ArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
                    </a>
                  </span>
                }
              />
            </div>
          </div>
        </Container>
      </section>

      <Container className="sectie-kort">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start lg:gap-x-8">
          {/* data-eigen-club: the page has its own Club form (app/globals.css, fix 7-9). */}
          <section
            aria-labelledby={formId}
            data-eigen-club
            className="rounded-kaart border border-rand bg-kaart p-6 md:p-8 lg:col-span-7"
          >
            <SubscribeForm
              source="club"
              heading={{ id: formId, title: copy.formTitle, text: copy.formText }}
              submitLabel={site.club.cta}
              layout="inline"
              className="mt-6"
            />
          </section>

          <ClubBenefits headingId={benefitsId} className="lg:col-span-5" />
        </div>

        {/* Below lg the benefits' last hairline is right above: no second line 48 px under it (QA round 5). Before the
            launch the shop is closed, so instead of "Alvast rondkijken?" (three links that all ended on the waitlist)
            the row says when it opens (QA round 6). */}
        <TimeGate
          at={site.launchAt}
          className="mt-12 md:mt-16 lg:border-t lg:border-rand lg:pt-8"
          before={
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <p className="font-semibold text-tekst">{copy.beforeLaunch.text(launchDay)}</p>
              <Link href={copy.beforeLaunch.link.href} className={buttonClasses({ variant: "outline", size: "sm" })}>
                {copy.beforeLaunch.link.label}
              </Link>
            </div>
          }
          after={
            <nav aria-labelledby={meanwhileId}>
              <h2 id={meanwhileId} className="kop-3 text-tekst">
                {copy.meanwhile.title}
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {copy.meanwhile.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={buttonClasses({ variant: "outline", size: "sm" })}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          }
        />
      </Container>
    </>
  );
}
