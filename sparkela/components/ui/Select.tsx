"use client";

import { ChevronDown } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/cn";

/**
 * A native <select> in a 44 px pill (plan §13.2): sorting on collections (SortSelect), the stack picker on the
 * product page, a colour per stack piece. Native, so the phone shows its own picker and keyboard behaviour is the
 * browser's. The border is --rand-invoer (3:1, WCAG 1.4.11), the label is always there: visible by default, or for
 * screen readers only with `hideLabel`. 16 px text on phones, so iOS does not zoom in.
 *
 * `layout`: "stack" puts the label above the field (forms), "inline" next to it (a toolbar: "Sorteren [Uitgelicht]").
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
  className?: string;
  selectClassName?: string;
}

export function Select({
  id,
  name,
  label,
  hideLabel = false,
  layout = "stack",
  value,
  options,
  onChange,
  className,
  selectClassName,
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const inline = layout === "inline";

  return (
    <div className={cn("flex", inline ? "items-center gap-2" : "flex-col gap-1.5", className)}>
      <label
        htmlFor={selectId}
        className={cn(hideLabel ? "sr-only" : "tekst-klein font-semibold text-tekst", inline && !hideLabel && "whitespace-nowrap")}
      >
        {label}
      </label>
      <div className="relative min-w-0">
        <select
          id={selectId}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-11 w-full min-w-0 cursor-pointer appearance-none rounded-full border border-rand-invoer bg-kaart pr-11 pl-4",
            "text-base text-tekst transition-[border-color,box-shadow] duration-200 hover:border-tekst md:text-[0.9375rem]",
            selectClassName,
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 size-[18px] -translate-y-1/2 text-tekst"
          strokeWidth={1.5}
        />
      </div>
    </div>
  );
}
