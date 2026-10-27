import { ArrowRight } from "lucide-react";
import { useId } from "react";

import type { Drop } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatStartLabel } from "@/lib/dates";
import { dropPath } from "@/lib/paths";
import { collectionCopy } from "@/content/copy/collection";
import { sharedCopy } from "@/content/copy/shared";
import { SubscribeForm } from "@/components/forms/SubscribeForm";
import { TimeGate } from "@/components/time/TimeGate";
import { buttonClasses } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Pill } from "@/components/ui/Pill";

import { DropCountdown } from "./DropCountdown";

/**
 * The teaser of a drop before access (docs/PLAN.md §9.5, §13.12, §14.6; decisions 21 and 63): the proxy rewrites
 * /drops/<slug> and the drop's product pages to /drops/<slug>/binnenkort until the visitor has early access or the
 * drop is public. On roest: "Binnenkort", the teaser title as the page's only H1, its line, "Live op {start}" and
 * the real countdown to startsAt. Next to it (below on phones) a white card with the Club sign-up (SubscribeForm
 * source="club"), because Club members get the early-access link; the card resets the focus ring to leisteen.
 *
 * At startsAt the countdown makes way (TimeGate) for "Nu live" and a link to the drop. It is a plain <a>, not
 * next/link: the URL is the same path the proxy rewrote, so a full request lets the proxy decide again (decision 136).
 * No drop photo: nothing of the drop is shown before its reveal. Server component.
 */

export interface DropTeaserProps {
  drop: Drop;
}

export function DropTeaser({ drop }: DropTeaserProps) {
  const headingId = useId();
  const copy = collectionCopy.teaser;
  const live = sharedCopy.countdown.live;

  return (
    <section aria-labelledby={headingId} data-vlak="roest" className="bg-roest text-bot-wit">
      <Container className="py-12 md:py-16 lg:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-6">
            <p className="label-caps text-bot-wit">{copy.eyebrow}</p>
            <h1 id={headingId} className="kop-1 mt-4 text-bot-wit">
              {drop.teaser.title}
            </h1>
            <p className="tekst-groot mt-4 max-w-[30rem] text-bot-wit">{drop.teaser.text}</p>
            <p className="mt-7 font-semibold text-bot-wit md:mt-8">{copy.startsOn(formatStartLabel(drop.startsAt))}</p>
            <TimeGate
              at={drop.startsAt}
              className="mt-3 min-h-11"
              before={<DropCountdown target={drop.startsAt} kind="start" liveLabel={live} />}
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
          <div className="lg:col-span-5 lg:col-start-8">
            {/* data-eigen-club: the footer leaves out its own Club form on this page (app/globals.css, fix 7-9). */}
            <div data-eigen-club className={cn("rounded-kaart bg-kaart p-6 text-tekst md:p-8", "[--ring:var(--focus)]")}>
              <h2 className="kop-3 text-tekst">{copy.formTitle}</h2>
              <p className="mt-2 text-tekst-2">{copy.formText}</p>
              <SubscribeForm source="club" className="mt-5" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
