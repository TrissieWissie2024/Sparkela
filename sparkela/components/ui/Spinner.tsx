import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/cn";

import { VisuallyHidden } from "./VisuallyHidden";

export interface SpinnerProps {
  /** What is loading, for screen readers ("Even laden", sharedCopy.ui.loading). */
  label: string;
  className?: string;
}

/**
 * A small turning icon with a screen reader text (plan §13.2). A status region, so the label is announced when the
 * spinner appears. It only turns with motion allowed; with reduced motion it stands still (plan §4.7).
 * Buttons have their own spinner (Button `loading`).
 */
export function Spinner({ label, className }: SpinnerProps) {
  return (
    <span role="status" className={cn("inline-flex items-center", className)}>
      <LoaderCircle aria-hidden="true" className="size-5 shrink-0 motion-safe:animate-spin" strokeWidth={1.5} />
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  );
}
