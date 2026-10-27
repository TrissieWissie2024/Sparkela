import { cn } from "@/lib/cn";
import { shipping } from "@/content/shipping";

/**
 * The Dutch flag as an inline SVG (plan §13.2), for "Verzonden vanuit Nederland" in the delivery bar. The stripes use
 * the flag tokens (--vlag-rood, --vlag-wit, --vlag-blauw), not brand colours, with a thin --rand edge so the white
 * stripe shows on a white card. Labelled with the country name from content/shipping.ts; pass `decorative` when the
 * name is written next to it. Port of CORVANE components/ui/Flag.tsx (NL only).
 */

export interface FlagProps {
  /** Accessible name. Default: the country label from content/shipping.ts ("Nederland"). */
  label?: string;
  /** Hide from screen readers (the country is written next to it). */
  decorative?: boolean;
  className?: string;
}

export function Flag({ label, decorative = false, className }: FlagProps) {
  const name = label ?? shipping.countries.NL.label;
  return (
    <svg
      viewBox="0 0 24 18"
      width="20"
      height="15"
      className={cn("inline-block shrink-0", className)}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": name })}
    >
      <rect width="24" height="6" className="fill-vlag-rood" />
      <rect y="6" width="24" height="6" className="fill-vlag-wit" />
      <rect y="12" width="24" height="6" className="fill-vlag-blauw" />
      <rect x="0.5" y="0.5" width="23" height="17" rx="1.5" fill="none" strokeWidth="1" className="stroke-rand" />
    </svg>
  );
}
