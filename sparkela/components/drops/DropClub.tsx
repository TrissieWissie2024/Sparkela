import { useId } from "react";

import type { Drop } from "@/lib/types";
import { cn } from "@/lib/cn";
import { collectionCopy } from "@/content/copy/collection";
import { SubscribeForm } from "@/components/forms/SubscribeForm";
import { TimeGate } from "@/components/time/TimeGate";

/**
 * The close of a drop page (docs/PLAN.md §9.5, §14.6): a TimeGate on endsAt, exact in an open tab.
 * - While the drop runs: nothing. The footer right below holds the Club sign-up ("Als eerste bij elke drop"), and a
 *   separate Club line here repeated it in the same words (fix 7-9).
 * - From endsAt: "Deze drop is voorbij. In de Club hoor je als eerste van de volgende." with the Club sign-up
 *   (SubscribeForm source="club"), because then the sign-up is what the page is for. It carries data-eigen-club, so
 *   the footer then leaves out its own Club block (app/globals.css); while the variant is hidden the marker does not
 *   count.
 * Both variants are in the static HTML; the hidden one is out of the accessibility tree. Server component.
 */
export function DropClub({ drop, className }: { drop: Drop; className?: string }) {
  const endedId = useId();
  const copy = collectionCopy.drop;

  return (
    <TimeGate
      at={drop.endsAt}
      before={null}
      after={
        <section
          aria-labelledby={endedId}
          data-eigen-club
          className={cn(
            "grid gap-8 rounded-kaart bg-vlak px-6 py-8 md:px-10 md:py-12 lg:grid-cols-2 lg:items-center lg:gap-14",
            className,
          )}
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
