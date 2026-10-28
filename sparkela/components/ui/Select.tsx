"use client";

import { ChevronDown } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A native <select> in a 44 px pill (plan §13.2): sorting on collections (SortSelect), the stack picker on the
 * product page, a colour per stack piece. Native, so the phone shows its own picker and keyboard behaviour is the
 * browser's. The border is --rand-invoer (3:1, WCAG 1.4.11), the label is always there: visible by default, or for
 * screen readers only with `hideLabel`. 16 px text on phones, so iOS does not zoom in.
 *
 * `layout`: "stack" puts the label above the field (forms), "inline" next to it (a toolbar: "Sorteren [Uitgelicht]").
 *
 * `display` (QA round 4, the stack picker): a closed native select shows its option on one line and clips the end, so
 * a long "Noor dikke ringetjes, Goud · €14,95" read "€14,9" on a phone. With `display` the field shows that node
 * instead (it may wrap; the field grows and its corners stay round), and the real select lies invisibly over it: it
 * keeps the focus, the label, the value that screen readers read and the native picker with the full option labels.
 * The field draws the focus ring and hover border for it. `labelAside` sits at the end of the label row (stack
 * layout, aria-hidden: the select's value already says it), e.g. the piece price.
 */

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  /** id of the <select>; default from useId(). */
  id?: string;
  name?: string;
  label: string;
  hideLabel?: boolean;
  layout?: "stack" | "inline";
  value: string;
  options: SelectOption[];
  onChange(value: string): void;
  /** What the closed field shows instead of the chosen option's one-line label (may wrap). */
  display?: ReactNode;
  /** Visual extra at the end of the label row (stack layout), hidden from screen readers. */
  labelAside?: ReactNode;
  className?: string;
  selectClassName?: string;
}

const FIELD =
  "border border-rand-invoer bg-kaart pr-11 pl-4 text-base text-tekst transition-[border-color,box-shadow] duration-200 md:text-[0.9375rem]";

export function Select({
  id,
  name,
  label,
  hideLabel = false,
  layout = "stack",
  value,
  options,
  onChange,
  display,
  labelAside,
  className,
  selectClassName,
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const inline = layout === "inline";
  const overlay = display !== undefined;

  const labelNode = (
    <label
      htmlFor={selectId}
      className={cn(hideLabel ? "sr-only" : "tekst-klein font-semibold text-tekst", inline && !hideLabel && "whitespace-nowrap")}
    >
      {label}
    </label>
  );

  return (
    <div className={cn("flex", inline ? "items-center gap-2" : "flex-col gap-1.5", className)}>
      {labelAside !== undefined && !inline ? (
        <div className="flex items-baseline justify-between gap-3">
          {labelNode}
          <span aria-hidden="true" className="shrink-0">
            {labelAside}
          </span>
        </div>
      ) : (
        labelNode
      )}
      <div className="relative min-w-0">
        <select
          id={selectId}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            overlay
              ? "peer absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
              : cn("h-11 w-full min-w-0 cursor-pointer appearance-none hover:border-tekst", FIELD, "rounded-full"),
            selectClassName,
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {overlay ? (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none flex min-h-11 items-center rounded-[1.375rem] py-2 leading-6",
              FIELD,
              "peer-hover:border-tekst peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--ring) peer-focus-visible:outline-solid",
            )}
          >
            <span className="min-w-0 text-pretty">{display}</span>
          </div>
        ) : null}
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 size-[18px] -translate-y-1/2 text-tekst"
          strokeWidth={1.5}
        />
      </div>
    </div>
  );
}
