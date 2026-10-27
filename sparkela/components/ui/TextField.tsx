"use client";

import { CircleAlert } from "lucide-react";
import { useId, type FocusEventHandler, type HTMLAttributes } from "react";

import { cn } from "@/lib/cn";
import { sharedCopy } from "@/content/copy/shared";

/**
 * A text field with its label above it (plan §13.2, §18.3 rule 9): the field is a white pill (a rounded box when
 * multiline) with a real --rand-invoer border (3:1, and visible in forced colors, CORVANE D35). The hint and the
 * error sit below it; the field points to them with aria-describedby and the error sets aria-invalid. A multiline
 * field with `maxLength` shows how many characters are left ("Nog 188 tekens"), also linked to the field.
 *
 * Validation is the form's job: forms use noValidate, check on submit and pass `error`. `required` sets the native
 * attribute and aria-required. 16 px text on phones, so iOS does not zoom in. Port of FormField in CORVANE
 * components/contact/ContactForm.tsx.
 */

export interface TextFieldProps {
  /** id of the control; default from useId(). Forms pass one to move focus to the first error. */
  id?: string;
  name?: string;
  label: string;
  type?: "text" | "email";
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  value: string;
  onChange(value: string): void;
  onBlur?: FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Show "(optioneel)" after the label. */
  markOptional?: boolean;
  multiline?: boolean;
  /** Rows of a multiline field. Default 5. */
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  className?: string;
}

export function TextField({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  inputMode,
  value,
  onChange,
  onBlur,
  error,
  hint,
  required = false,
  markOptional = false,
  multiline = false,
  rows = 5,
  maxLength,
  placeholder,
  className,
}: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : null;
  const errorId = error ? `${fieldId}-error` : null;
  const showCounter = multiline && maxLength !== undefined;
  const counterId = showCounter ? `${fieldId}-counter` : null;
  const describedBy = [errorId, hintId, counterId].filter(Boolean).join(" ") || undefined;

  const shared = {
    id: fieldId,
    name,
    value,
    required: required || undefined,
    "aria-required": required || undefined,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    maxLength,
    placeholder,
    onBlur,
  } as const;

  const control = cn(
    "w-full min-w-0 border bg-kaart text-base text-tekst transition-[border-color,box-shadow] duration-200 md:text-[0.9375rem]",
    "placeholder:text-tekst-gedempt",
    error ? "border-fout" : "border-rand-invoer hover:border-tekst",
  );

  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={fieldId} className="tekst-klein flex flex-wrap items-baseline gap-x-1.5 font-semibold text-tekst">
        <span>{label}</span>
        {markOptional && !required ? <span className="font-normal text-tekst-2">({sharedCopy.ui.optional})</span> : null}
      </label>
      <div className="mt-1.5">
        {multiline ? (
          <textarea
            {...shared}
            rows={rows}
            onChange={(event) => onChange(event.target.value)}
            className={cn(control, "min-h-32 resize-y rounded-kaart px-4 py-3 leading-relaxed")}
          />
        ) : (
          <input
            {...shared}
            type={type}
            autoComplete={autoComplete}
            inputMode={inputMode}
            onChange={(event) => onChange(event.target.value)}
            className={cn(control, "h-12 rounded-full px-5")}
          />
        )}
      </div>
      {hint || showCounter ? (
        <div className="mt-1.5 flex items-start justify-between gap-4">
          {hint ? (
            <p id={hintId ?? undefined} className="tekst-klein text-tekst-2">
              {hint}
            </p>
          ) : (
            <span />
          )}
          {showCounter && maxLength !== undefined ? (
            <p id={counterId ?? undefined} className="tekst-klein tabular shrink-0 text-tekst-2">
              {sharedCopy.ui.charactersLeft(Math.max(0, maxLength - value.length))}
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p id={errorId ?? undefined} className="mt-1.5 flex items-start gap-1.5 tekst-klein font-medium text-fout">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
