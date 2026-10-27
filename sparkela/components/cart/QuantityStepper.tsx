"use client";

import { Minus, Plus } from "lucide-react";

import { MAX_LINE_QUANTITY } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { cartCopy } from "@/content/copy/cart";

/**
 * − / value / + for a quantity (docs/PLAN.md §13.7). The buttons at the limits get aria-disabled instead of
 * disabled, so they keep focus (a disabled button drops focus to <body> and breaks the drawer's focus trap, CORVANE
 * D34) and a screen reader still reads them as unavailable. Labels "Minder {naam}" and "Meer {naam}"; the value is
 * plain text, the cart's live region announces the change. The outline is --rand-invoer (3:1, WCAG 1.4.11) and an
 * outline in forced colors. Port of CORVANE components/cart/QuantityStepper.tsx.
 */

export interface QuantityStepperProps {
  value: number;
  /** Called with the next value, already clamped to min … max. */
  onChange(next: number): void;
  /** Name of the item in the accessible labels ("Meer Lola chunky hoops"). */
  itemName: string;
  /** Default 1. */
  min?: number;
  /** Default MAX_LINE_QUANTITY (99). */
  max?: number;
  /** Id of a visible line that explains the limit; the "+" button points to it while it is at the limit. */
  maxHintId?: string;
  size?: "sm" | "md";
  className?: string;
}

/** sm draws 36 px buttons; a ::before 4 px wider on every side makes each target 44 × 44 px. */
const sizes = {
  sm: {
    box: "h-9",
    button: "relative size-9 before:absolute before:-inset-1 before:rounded-full before:content-['']",
    value: "min-w-7 text-sm",
    icon: "size-3.5",
  },
  md: { box: "h-11", button: "size-11", value: "min-w-9 text-[0.9375rem]", icon: "size-4" },
} as const;

export function QuantityStepper({
  value,
  onChange,
  itemName,
  min = 1,
  max = MAX_LINE_QUANTITY,
  maxHintId,
  size = "sm",
  className,
}: QuantityStepperProps) {
  const s = sizes[size];
  const atMin = value <= min;
  const atMax = value >= max;
  const labels = cartCopy.line.quantity;

  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) onChange(next);
  };

  const buttonClass = (disabled: boolean) =>
    cn(
      "inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150",
      s.button,
      disabled ? "cursor-not-allowed text-tekst-gedempt" : "text-tekst hover:bg-tekst/5 active:bg-tekst/10",
    );

  return (
    <div
      role="group"
      aria-label={labels.label(itemName)}
      className={cn(
        "inline-flex items-center rounded-full bg-kaart ring-1 ring-rand-invoer ring-inset forced-colors:outline-1 forced-colors:-outline-offset-1",
        s.box,
        className,
      )}
    >
      <button
        type="button"
        aria-label={labels.decrease(itemName)}
        aria-disabled={atMin || undefined}
        onClick={() => {
          if (!atMin) step(-1);
        }}
        className={buttonClass(atMin)}
      >
        <Minus aria-hidden="true" className={s.icon} strokeWidth={2} />
      </button>
      <span className={cn("tabular text-center font-semibold text-tekst", s.value)}>{value}</span>
      <button
        type="button"
        aria-label={labels.increase(itemName)}
        aria-disabled={atMax || undefined}
        aria-describedby={atMax && maxHintId ? maxHintId : undefined}
        onClick={() => {
          if (!atMax) step(1);
        }}
        className={buttonClass(atMax)}
      >
        <Plus aria-hidden="true" className={s.icon} strokeWidth={2} />
      </button>
    </div>
  );
}
