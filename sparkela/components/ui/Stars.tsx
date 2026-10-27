import type { RatingSummary } from "@/lib/types";
import { cn } from "@/lib/cn";
import { sharedCopy } from "@/content/copy/shared";

/**
 * Star rating from real reviews only (brief §2.3, plan §13.2). Pass getRatingSummary() from lib/reviews.ts: it is
 * null while content/reviews.ts is empty, and then this renders nothing. There is no empty state: no stars, no
 * "0 reviews", no placeholder. Port of CORVANE components/ui/Stars.tsx.
 */

export interface StarsProps {
  rating: RatingSummary | null;
  size?: "sm" | "md";
  /** Show "4,6 (12)" next to the stars. Default true. */
  showCount?: boolean;
  /**
   * "donker" on donker, roest, olijf and leisteen surfaces. The surface carries data-vlak; on roest, olijf and
   * leisteen that turns --tekst-2-op-donker (the count) into bot-wit (decision 186).
   */
  tone?: "licht" | "donker";
  className?: string;
}

const STAR_PATH =
  "M12 2.6l2.83 6.08 6.67.78-4.93 4.56 1.31 6.58L12 17.3l-5.88 3.3 1.31-6.58L2.5 9.46l6.67-.78L12 2.6z";

/** "4,6": one decimal with a Dutch comma, no Intl (server and browser format the same). */
export function formatAverage(average: number): string {
  return (Math.round(average * 10) / 10).toFixed(1).replace(".", ",");
}

function StarRow({ className }: { className: string }) {
  return (
    <span className={cn("flex gap-0.5", className)}>
      {[0, 1, 2, 3, 4].map((index) => (
        <svg key={index} viewBox="0 0 24 24" aria-hidden="true" className="size-[1em] shrink-0 fill-current">
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}

export function Stars({ rating, size = "sm", showCount = true, tone = "licht", className }: StarsProps) {
  if (!rating || !(rating.count > 0) || !Number.isFinite(rating.average)) return null;
  const average = Math.max(0, Math.min(5, rating.average));
  const percent = (average / 5) * 100;
  const dark = tone === "donker";
  const label = formatAverage(average);

  return (
    <span className={cn("inline-flex items-center gap-2", size === "sm" ? "text-[0.9375rem]" : "text-lg", className)}>
      <span role="img" aria-label={sharedCopy.ui.rating(label, rating.count)} className="relative inline-flex">
        <StarRow className={dark ? "text-rand-op-donker" : "text-rand"} />
        <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${percent}%` }}>
          <StarRow className={dark ? "text-bot-wit" : "text-tekst"} />
        </span>
      </span>
      {showCount ? (
        <span aria-hidden="true" className={cn("tabular text-sm", dark ? "text-tekst-2-op-donker" : "text-tekst-2")}>
          {label} ({rating.count})
        </span>
      ) : null}
    </span>
  );
}
