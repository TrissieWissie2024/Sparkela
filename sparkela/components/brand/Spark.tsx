import { cn } from "@/lib/cn";

import { SPARK_PATH, SPARK_VIEWBOX } from "./logo-paths";

export interface SparkProps {
  /** Size and colour; fills with currentColor. Replaces the default "size-4". */
  className?: string;
  /** Accessible name. Without it the spark is decorative (aria-hidden). */
  title?: string;
}

/**
 * The upright four-point spark of the logo on its own (brief §3), for the popup cards, the pill and decoration. Never
 * sheared or rotated. The path is inline (it is small), so it also works where LogoDefs is not in the document.
 */
export function Spark({ className, title }: SparkProps) {
  return (
    <svg
      viewBox={SPARK_VIEWBOX}
      fill="currentColor"
      className={cn("shrink-0", className ?? "size-4")}
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true, focusable: false })}
    >
      <path d={SPARK_PATH} />
    </svg>
  );
}
