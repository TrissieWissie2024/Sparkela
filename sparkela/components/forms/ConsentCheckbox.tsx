"use client";

import { Check, CircleAlert } from "lucide-react";
import Link from "next/link";
import { useId, type RefObject } from "react";

import { cn } from "@/lib/cn";
import { site } from "@/content/site";

/**
 * The consent checkbox at every sign-up field (brief §2.8, docs/PLAN.md §13.13, §15.1): the exact sentence from
 * site.consentText as its label, never checked beforehand (the caller owns `checked` and starts with false), and
 * right under it the link to the privacy policy (site.privacyLink). The error sits under both and is linked with
 * aria-describedby; the box gets aria-invalid.
 *
 * The same look as components/ui/Checkbox (24 px box in a 44 px row, roest with a bot-wit check when ticked: shape and
 * colour, never colour alone), plus `tone="donker"` for the waitlist and the footer: bot-wit text, a white box with a
 * bot-wit edge when ticked (roest alone is 2,03:1 on donker), errors in bot-wit with an icon.
 */

export interface ConsentCheckboxProps {
  checked: boolean;
  onChange(checked: boolean): void;
  error?: string;
  tone?: "licht" | "donker";
  /** id of the <input>; default from useId(). */
  id?: string;
  /** For moving focus to the box after a failed submit. */
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}

export function ConsentCheckbox({ checked, onChange, error, tone = "licht", id, inputRef, className }: ConsentCheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const privacyId = `${inputId}-privacy`;
  const errorId = `${inputId}-error`;
  const dark = tone === "donker";

  return (
    <div className={className}>
      <label htmlFor={inputId} className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
        <span className="relative flex shrink-0">
          <input
            ref={inputRef}
            id={inputId}
            name="consent"
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            aria-required="true"
            aria-invalid={error ? true : undefined}
            aria-describedby={cn(error && errorId, privacyId)}
            className={cn(
              "peer m-0 size-6 cursor-pointer appearance-none rounded-md border bg-kaart transition-colors duration-200",
              "checked:bg-primair",
              dark ? "checked:border-bot-wit" : "checked:border-primair",
              error ? (dark ? "border-bot-wit" : "border-fout") : dark ? "border-kaart" : "border-rand-invoer hover:border-tekst",
            )}
          />
          <Check
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-auto size-4 text-primair-tekst opacity-0 peer-checked:opacity-100"
            strokeWidth={2.5}
          />
        </span>
        <span className={cn("pt-px text-[0.9375rem] leading-snug", dark ? "text-tekst-op-donker" : "text-tekst")}>
          {site.consentText}
        </span>
      </label>
      <p id={privacyId} className="pl-9 tekst-klein">
        <Link
          href={site.privacyLink.href}
          className={cn(
            "inline-flex min-h-11 items-center underline underline-offset-4 hover:decoration-2",
            dark ? "text-tekst-op-donker" : "text-link hover:text-link-hover",
          )}
        >
          {site.privacyLink.label}
        </Link>
      </p>
      {error ? (
        <p
          id={errorId}
          className={cn("mt-1.5 flex items-start gap-1.5 pl-9 tekst-klein font-medium", dark ? "text-tekst-op-donker" : "text-fout")}
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
