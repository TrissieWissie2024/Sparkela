import { cn } from "@/lib/cn";
import { pdpCopy } from "@/content/copy/pdp";

/**
 * The Statement-meter (docs/PLAN.md §13.9; brief §6: "subtiel ↔ chunky, gemarkeerd als indicatief"; port of CORVANE
 * IntensityMeters with one scale). Five segments from "Subtiel" to "Chunky", from the metafield statement_meter
 * (1 to 5). It compares a piece with the rest of the collection and is not a measurement, so the heading carries the
 * tag "Indicatief" and a short note says so.
 *
 * The bar is one image for screen readers: role="img" named "Statement-meter: 4 van 5, indicatief". Filled segments
 * in --tekst, empty ones as a 1 px --rand-invoer outline (3:1, WCAG 1.4.11), so "4 van 5" reads without colour;
 * forced colors get system colours. Server component.
 */

const STEPS = [1, 2, 3, 4, 5] as const;

export function StatementMeter({
  value,
  headingLevel = 2,
  className,
}: {
  value: 1 | 2 | 3 | 4 | 5;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const copy = pdpCopy.meter;
  const Heading = `h${headingLevel}` as const;

  return (
    <div className={className}>
      <Heading className="flex items-center gap-2.5">
        <span className="label-caps text-tekst-2">{copy.title}</span>
        <span className="sr-only">, </span>
        <span className="inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium text-tekst-2 ring-1 ring-rand-invoer ring-inset">
          {copy.indicative}
        </span>
      </Heading>

      <div role="img" aria-label={copy.name(value, STEPS.length)} className="mt-4 flex gap-1.5">
        {STEPS.map((step) => (
          <span
            key={step}
            className={cn(
              "h-2 flex-1 rounded-full forced-color-adjust-none",
              step <= value
                ? "bg-tekst forced-colors:bg-[CanvasText]"
                : "ring-1 ring-rand-invoer ring-inset forced-colors:ring-[GrayText]",
            )}
          />
        ))}
      </div>
      <div aria-hidden="true" className="mt-2 flex justify-between text-xs font-medium text-tekst-2">
        <span>{copy.start}</span>
        <span>{copy.end}</span>
      </div>

      <p className="tekst-klein mt-4 max-w-[34rem] text-tekst-2">{copy.note}</p>
    </div>
  );
}
