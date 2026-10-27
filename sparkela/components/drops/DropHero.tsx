import { ArrowDown } from "lucide-react";
import { useId } from "react";

import type { Drop } from "@/lib/types";
import { formatEndLabel, toMs } from "@/lib/dates";
import { assets } from "@/content/assets";
import { collectionCopy } from "@/content/copy/collection";
import { sharedCopy } from "@/content/copy/shared";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { TimeSwitch } from "@/components/time/TimeSwitch";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Pill } from "@/components/ui/Pill";

import { DropCountdown } from "./DropCountdown";

/**
 * The head of a drop page (docs/PLAN.md §13.12, §14.6; brief §7: "springt de aftelklok op 'Nu live'"): a roest band
 * (data-vlak="roest") with the eyebrow "Drop", the drop's name as the page's only H1, its tagline, the status, a
 * bot-wit "Bekijk de stukken" button to the product grid (`productsHref`, when the page has products) and the drop
 * photo (PhotoSlot 16:9 at every width, so the products come close to the fold on a phone; preloaded, it is the LCP
 * image). The placeholder is the light vlak surface (brief §5), never a dark slab on roest (fix 7-9).
 *
 * The status is a TimeSwitch on [startsAt, endsAt], so it is exact in an open tab and a cached page never counts past
 * its target (decision 187):
 * - before the start: the real Countdown to startsAt ("Over 0d 12u", fixed label "vrijdag 27 november om 00.00 uur")
 *   with liveLabel "Nu live";
 * - live: the pill "Nu live" and "Loopt t/m 31 december" (formatEndLabel; no second timer);
 * - after the end: "Deze drop is voorbij".
 * Server component.
 */

export interface DropHeroProps {
  drop: Drop;
  /** id for the H1 (aria-labelledby); default from useId. */
  headingId?: string;
  /** "#<id>" of the product grid; renders the "Bekijk de stukken" button. */
  productsHref?: string;
}

export function DropHero({ drop, headingId, productsHref }: DropHeroProps) {
  const generatedId = useId();
  const id = headingId ?? generatedId;
  const live = sharedCopy.countdown.live;
  const label = assets.images[drop.image]?.label ?? drop.name;

  return (
    <section aria-labelledby={id} data-vlak="roest" className="bg-roest text-bot-wit">
      <Container className="pt-10 pb-12 md:pt-14 md:pb-16 lg:py-20">
        <div className="grid items-center gap-8 md:gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <p className="label-caps text-bot-wit">{collectionCopy.drop.eyebrow}</p>
            <h1 id={id} className="kop-1 mt-4 text-bot-wit">
              {drop.name}
            </h1>
            <p className="tekst-groot mt-4 max-w-[30rem] text-bot-wit">{drop.tagline}</p>
            <TimeSwitch
              boundaries={[toMs(drop.startsAt), toMs(drop.endsAt)]}
              className="mt-7 min-h-11 md:mt-8"
              variants={[
                <DropCountdown key="countdown" target={drop.startsAt} kind="start" liveLabel={live} />,
                <span key="live" className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2">
                  <Pill tone="outline-op-donker">{live}</Pill>
                  <span className="text-[0.9375rem] font-medium">{collectionCopy.drop.runsUntil(formatEndLabel(drop.endsAt))}</span>
                </span>,
                <p key="ended" className="flex min-h-11 items-center font-semibold">
                  {collectionCopy.drop.ended}
                </p>,
              ]}
            />
            {productsHref ? (
              <Button
                href={productsHref}
                variant="op-roest"
                className="mt-6 md:mt-7"
                iconEnd={<ArrowDown aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
              >
                {collectionCopy.drop.viewPieces}
              </Button>
            ) : null}
          </div>
          <div className="lg:col-span-7">
            <div className="relative aspect-video w-full overflow-hidden rounded-kaart">
              <PhotoSlot
                assetKey={drop.image}
                label={label}
                aspect="fill"
                tone="vlak"
                preload
                sizes="(min-width: 1280px) 690px, (min-width: 1024px) 58vw, 100vw"
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
