import { cn } from "@/lib/cn";

/**
 * A 4 px progress bar (plan §13.2, §4.11): the free-shipping bar in the cart, the 3-step stack milestone and the
 * steps of the Spark Finder. role="progressbar" with the label as its name; the visible text next to it ("Nog €0,10
 * tot gratis verzending") is the caller's.
 *
 * - Without `segments`: one bar, aria-valuenow 0 to 100.
 * - With `segments` (3 for the stack and the finder): that many blocks, the first round(value × segments) filled;
 *   aria-valuenow counts filled blocks out of `segments`.
 * Fill roest on a --rand track (about 5:1, WCAG 1.4.11). Forced colors: fill CanvasText, track GrayText.
 */

export interface ProgressBarProps {
  /** 0 to 1; clamped. */
  value: number;
  /** Accessible name ("Voortgang naar gratis verzending"). */
  label: string;
  segments?: number;
  /** "donker" on donker surfaces: bot-wit fill on a dark track. */
  tone?: "licht" | "donker";
  className?: string;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function ProgressBar({ value, label, segments, tone = "licht", className }: ProgressBarProps) {
  const ratio = clamp01(value);
  const dark = tone === "donker";
  const track = cn(dark ? "bg-rand-op-donker" : "bg-rand", "forced-colors:bg-[GrayText]");
  const fill = cn(dark ? "bg-bot-wit" : "bg-primair", "forced-color-adjust-none forced-colors:bg-[CanvasText]");

  if (segments !== undefined && segments > 0) {
    const count = Math.max(1, Math.round(segments));
    const filled = Math.round(ratio * count);
    return (
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={count}
        aria-valuenow={filled}
        className={cn("flex w-full gap-1", className)}
      >
        {Array.from({ length: count }, (_, index) => (
          <span key={index} className={cn("h-1 flex-1 rounded-full", index < filled ? fill : track)} />
        ))}
      </div>
    );
  }

  const percent = Math.round(ratio * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-1 w-full overflow-hidden rounded-full", track, className)}
    >
      <div
        className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out", fill)}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
