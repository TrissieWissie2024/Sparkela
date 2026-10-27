import { ArrowRight } from "lucide-react";
import { useId } from "react";

import type { Drop } from "@/lib/types";
import { cn } from "@/lib/cn";
import { collectionCopy } from "@/content/copy/collection";
import { SubscribeForm } from "@/components/forms/SubscribeForm";
import { TimeGate } from "@/components/time/TimeGate";
import { Button } from "@/components/ui/Button";

/**
 * The close of a drop page (docs/PLAN.md §9.5, §14.6): a TimeGate on endsAt, exact in an open tab.
 * - While the drop runs: a short Club line with a link to /sparkela-club ("Als eerste bij de volgende drop"). The
 *   footer right below already holds the Club sign-up form, so the page does not repeat it.
 * - From endsAt: "Deze drop is voorbij. In de Club hoor je als eerste van de volgende." with the Club sign-up
 *   (SubscribeForm source="club"), because then the sign-up is what the page is for.
 * Both variants are in the static HTML; the hidden one is out of the accessibility tree. Server component.
 */
export function DropClub({ drop, className }: { drop: Drop; className?: string }) {
  const runningId = useId();
  const endedId = useId();
  const copy = collectionCopy.drop;

  return (
    <TimeGate
      at={drop.endsAt}
      className={className}
      before={
        <section
          aria-labelledby={runningId}
          className="flex flex-col items-start gap-5 rounded-kaart bg-vlak px-6 py-8 md:flex-row md:items-center md:justify-between md:gap-10 md:px-10"
        >
          <div className="max-w-[36rem]">
            <h2 id={runningId} className="kop-3 text-tekst">
              {copy.club.title}
            </h2>
            <p className="mt-2 text-tekst-2">{copy.club.text}</p>
          </div>
          <Button
            href={copy.club.cta.href}
            variant="outline"
            iconEnd={<ArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
          >
            {copy.club.cta.label}
          </Button>
        </section>
      }
      after={
        <section
          aria-labelledby={endedId}
          className={cn("grid gap-8 rounded-kaart bg-vlak px-6 py-8 md:px-10 md:py-12 lg:grid-cols-2 lg:items-center lg:gap-14")}
        >
          <div>
            <h2 id={endedId} className="kop-2 text-tekst">
              {copy.ended}
            </h2>
            <p className="tekst-groot mt-3 max-w-[30rem] text-tekst-2">{copy.endedText}</p>
          </div>
          <SubscribeForm source="club" />
        </section>
      }
    />
  );
}
