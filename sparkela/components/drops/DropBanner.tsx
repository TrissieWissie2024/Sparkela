import { ArrowRight } from "lucide-react";
import { useId } from "react";

import type { Drop } from "@/lib/types";
import { toMs } from "@/lib/dates";
import { dropPath } from "@/lib/paths";
import { assets } from "@/content/assets";
import { sharedCopy } from "@/content/copy/shared";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { TimeSwitch } from "@/components/time/TimeSwitch";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Pill } from "@/components/ui/Pill";

import { DropCountdown } from "./DropCountdown";

/**
 * The drop banner of the home (docs/PLAN.md §12.4, §14.1 section 7; brief §6 block 7 and §7; decisions 128 and 187):
 * a full-width roest band (data-vlak="roest": bot-wit focus ring and secondary text) with "Nu live" as an outline
 * pill, the drop's name as H2 (drop.banner.title), its short line, the real countdown to endsAt ("Nog 34d 11u", fixed
 * label "t/m 31 december") and a bot-wit button to the drop page. From lg the drop photo sits on the right (16:9).
 *
 * It only exists between startsAt and endsAt: a TimeSwitch with the boundaries [startsAt, endsAt] and the variants
 * [nothing, banner, nothing], so the server can render an upcoming drop hidden (getFeaturedDrop, 14 days ahead) and it
 * appears exactly at the start, also in an open tab, and disappears at the end. The empty variants have no height.
 * Server component; give it the `drop` from getFeaturedDrop().
 */

export interface DropBannerProps {
  drop: Drop;
  /** Heading level of the drop name. Default 2 (a section of the home). */
  headingLevel?: 2 | 3;
}

export function DropBanner({ drop, headingLevel = 2 }: DropBannerProps) {
  const headingId = useId();
  const Heading = `h${headingLevel}` as const;
  const label = assets.images[drop.image]?.label ?? drop.name;

  const banner = (
    <section aria-labelledby={headingId} data-vlak="roest" className="bg-roest text-bot-wit">
      <Container className="sectie-kort">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-6 xl:col-span-5">
            <Pill tone="outline-op-donker">{sharedCopy.countdown.live}</Pill>
            <Heading id={headingId} className="kop-1 mt-5 text-bot-wit md:mt-6">
              {drop.banner.title}
            </Heading>
            <p className="tekst-groot mt-3 max-w-[30rem] text-bot-wit md:mt-4">{drop.banner.text}</p>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-4 md:mt-8">
              <Button
                href={dropPath(drop.slug)}
                variant="op-roest"
                iconEnd={<ArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
              >
                {drop.banner.cta}
              </Button>
              <DropCountdown target={drop.endsAt} kind="end" />
            </div>
          </div>
          <div className="hidden lg:col-span-6 lg:block xl:col-span-7">
            <div className="relative aspect-video w-full overflow-hidden rounded-kaart">
              <PhotoSlot assetKey={drop.image} label={label} aspect="fill" tone="vlak" sizes="(min-width: 1280px) 680px, 50vw" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );

  return <TimeSwitch boundaries={[toMs(drop.startsAt), toMs(drop.endsAt)]} variants={[null, banner, null]} />;
}
