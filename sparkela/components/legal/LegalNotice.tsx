import { Info } from "lucide-react";

import { cn } from "@/lib/cn";
import { legalReviewNotice, legalUi } from "@/content/legal";

/**
 * The review notice on top of every legal text (brief §6, docs/PLAN.md §13.13, §14.16): "TODO: laten controleren" on
 * an info surface, until a lawyer has checked the texts. It also prints, so a printed draft is never mistaken for the
 * final text. Server component.
 */
export function LegalNotice({ className }: { className?: string }) {
  return (
    <div
      role="note"
      aria-label={legalUi.noticeLabel}
      className={cn("flex items-start gap-2.5 rounded-kaart bg-info-vlak px-4 py-3 text-tekst", className)}
    >
      <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info" strokeWidth={1.5} />
      <p className="font-semibold">{legalReviewNotice}</p>
    </div>
  );
}
