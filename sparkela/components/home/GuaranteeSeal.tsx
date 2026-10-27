import { cn } from "@/lib/cn";

/**
 * The round guarantee badge (docs/PLAN.md §14.1 sections 3 and 15a: "garantiebadge (rond, bot-wit rand)"; CORVANE's
 * seal in GuaranteeBlock): the number of months large in Unbounded, the unit and an optional short line under it, in
 * a circle with a bot-wit edge. Only for donker and coloured surfaces (bot-wit text).
 *
 * The circle is drawn for the eye only: screen readers get `label` (the full sentence, "6 maanden garantie op
 * verkleuring") once, so the number and the words are never read in pieces. `decorative` hides it entirely where the
 * same words are already on the page (the heading of GuaranteeBlock). Server component.
 */

export interface GuaranteeSealProps {
  value: string;
  unit: string;
  /** Small line under the unit ("garantie op verkleuring"). */
  text?: string;
  /** What screen readers hear; required unless `decorative`. */
  label?: string;
  decorative?: boolean;
  /** "sm" 112 px (hero on phones), "md" 128 px (hero from lg, guarantee block). */
  size?: "sm" | "md";
  className?: string;
}

export function GuaranteeSeal({
  value,
  unit,
  text,
  label,
  decorative = false,
  size = "md",
  className,
}: GuaranteeSealProps) {
  return (
    <p
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-full border border-bot-wit/70 text-center text-bot-wit",
        size === "sm" ? "size-28" : "size-32",
        className,
      )}
      {...(decorative ? { "aria-hidden": true } : {})}
    >
      {!decorative && label ? <span className="sr-only">{label}</span> : null}
      <span aria-hidden="true" className="flex flex-col items-center">
        <span
          className={cn(
            "tabular font-display leading-none font-extrabold",
            size === "sm" ? "text-[2rem]" : "text-[2.5rem]",
          )}
        >
          {value}
        </span>
        <span className="label-caps mt-1.5">{unit}</span>
        {text ? (
          <span
            className={cn(
              "mt-1 max-w-[6.5rem] text-[0.6875rem] leading-tight font-medium",
              size === "sm" && "max-w-[5.5rem]",
            )}
          >
            {text}
          </span>
        ) : null}
      </span>
    </p>
  );
}
