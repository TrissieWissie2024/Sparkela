"use client";

import { Check, CircleAlert } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A native checkbox (plan §13.2): a 24 px box with a --rand-invoer border (3:1, WCAG 1.4.11) inside a label row of
 * at least 44 px, so the box and its text are one touch target. Checked is roest with a bot-wit check mark: shape
 * and colour, never colour alone. Never checked by default: the caller owns `checked` (brief §2.8: the consent box
 * starts unchecked). The native control keeps its own focus ring (plan §4.8) and works without JavaScript styling.
 *
 * `description` sits under the label and `error` under both; the input points to them with aria-describedby, and
 * `error` sets aria-invalid. `required` sets aria-required; forms use noValidate and show their own messages.
 */

export interface CheckboxProps {
  /** id of the <input>; default from useId(). */
  id?: string;
  name?: string;
  checked: boolean;
  onChange(checked: boolean): void;
  label: ReactNode;
  description?: ReactNode;
  required?: boolean;
  error?: string;
  className?: string;
}

export function Checkbox({ id, name, checked, onChange, label, description, required, error, className }: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : null;
  const errorId = error ? `${inputId}-error` : null;
  const describedBy = [errorId, descriptionId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={inputId} className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
        <span className="relative flex shrink-0">
          <input
            id={inputId}
            name={name}
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "peer m-0 size-6 cursor-pointer appearance-none rounded-md border bg-kaart transition-colors duration-200",
              "checked:border-primair checked:bg-primair",
              error ? "border-fout" : "border-rand-invoer hover:border-tekst",
            )}
          />
          <Check
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-auto size-4 text-primair-tekst opacity-0 peer-checked:opacity-100"
            strokeWidth={2.5}
          />
        </span>
        <span className="pt-px text-[0.9375rem] leading-snug text-tekst">{label}</span>
      </label>
      {description ? (
        <div id={descriptionId ?? undefined} className="tekst-klein pl-9 text-pretty text-tekst-2">
          {description}
        </div>
      ) : null}
      {error ? (
        <p id={errorId ?? undefined} className="mt-1.5 flex items-start gap-1.5 pl-9 tekst-klein font-medium text-fout">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
