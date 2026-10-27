"use client";

import { CircleAlert } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";
import { normalizeDiscountCode } from "@/lib/pricing";
import { pagesCopy } from "@/content/copy/pages";
import { useCart } from "@/components/cart/useCart";
import { Button } from "@/components/ui/Button";

/**
 * The discount code field of the demo checkout (docs/PLAN.md §13.13, decision 69; brief §7: "kortingscodeveld"). The
 * drawer has none; here the visitor types a code and applies it with useCart().applyDiscountCode(). An empty field, an
 * unknown code or a failure shows its message under the field (aria-describedby, focus back to the field); an applied
 * code shows in the totals below (CartTotals) with "Verwijderen", and a polite line confirms it: in succes green only
 * when the code really counts; a code that does not count now (the stack discount is higher, only gift cards) gets a
 * neutral line, and the totals say why (QA round 1: no green "toegevoegd" above "telt niet mee").
 */
export function DiscountCodeField({ className }: { className?: string }) {
  const copy = pagesCopy.checkout.discount;
  const { applyDiscountCode, pending } = useCart();
  const id = useId();
  const inputId = `${id}-code`;
  const errorId = `${id}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ text: string; counts: boolean } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const wanted = normalizeDiscountCode(code);
    setAdded(null);
    if (!wanted) {
      setError(copy.empty);
      inputRef.current?.focus();
      return;
    }
    const result = await applyDiscountCode(wanted);
    if (!result.ok) {
      setError(result.error === "code-invalid" ? copy.invalid(wanted) : result.error === "invalid" ? copy.empty : copy.error);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setCode("");
    const state = result.cart?.discountCodes.find((entry) => entry.code === wanted);
    const counts = state?.applicable ?? true;
    setAdded({ text: counts ? copy.added(wanted) : copy.addedNotCounted(wanted), counts });
  }

  return (
    <form noValidate onSubmit={handleSubmit} className={className}>
      <label htmlFor={inputId} className="label-caps block text-tekst-2">
        {copy.label}
      </label>
      <div className="mt-2 flex gap-2">
        <input
          ref={inputRef}
          id={inputId}
          name="discountCode"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={64}
          placeholder={copy.placeholder}
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "h-12 w-full min-w-0 flex-1 rounded-full border bg-kaart px-5 text-base text-tekst uppercase md:text-[0.9375rem]",
            "transition-[border-color] duration-200 placeholder:text-tekst-gedempt placeholder:normal-case",
            error ? "border-fout" : "border-rand-invoer hover:border-tekst",
          )}
        />
        <Button type="submit" variant="outline" loading={pending} className="px-5">
          {copy.apply}
        </Button>
      </div>
      <p
        id={errorId}
        aria-live="polite"
        className={cn(
          "flex items-start gap-1.5 tekst-klein font-medium",
          error ? "mt-2 text-fout" : added ? (added.counts ? "mt-2 text-succes" : "mt-2 text-tekst-2") : "",
        )}
      >
        {error ? <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} /> : null}
        {error ?? added?.text}
      </p>
    </form>
  );
}
