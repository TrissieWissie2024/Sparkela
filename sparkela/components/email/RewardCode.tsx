"use client";

import { Check, CircleAlert, Copy, ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { CartResult } from "@/lib/commerce/types";
import type { Cart, SubscribeResult } from "@/lib/types";
import { cn } from "@/lib/cn";
import { normalizeDiscountCode } from "@/lib/pricing";
import { cartCopy } from "@/content/copy/cart";
import { pagesCopy } from "@/content/copy/pages";
import { welcomeCode } from "@/content/offers";
import { useCart } from "@/components/cart/useCart";
import { Button } from "@/components/ui/Button";

/**
 * The last step of the popup (docs/PLAN.md §13.11, §13.11.1 rule 5, decisions 69 and 92). Port of CORVANE
 * components/email/RewardCode.tsx.
 *
 * - After the sign-up (`pending`, decision 199): "Check je mail om je aanmelding af te ronden.", then the code WELKOM10
 *   large, with "Kopieer code" and "Zet op mijn tas". The code works right away; Shopify checks "first order" itself.
 * - Copy uses navigator.clipboard in try/catch; when the clipboard is blocked the code is selected instead and a line
 *   says so (the code box is also select-all, so one tap selects it).
 * - "Zet op mijn tas" calls useCart().applyDiscountCode(code) (the drawer has no code field, decision 69) and reports in
 *   a polite live region: on the tas, on the tas while it is still empty, on the tas but the stack discount is higher
 *   (they do not combine), or the cart's own error text.
 * - Focus moves to this panel when it appears (the form that had focus is gone).
 */

export interface RewardCodeProps {
  status: SubscribeResult["status"];
  /** "Verder shoppen": closes the modal. */
  onDone(): void;
}

type CopyState = "idle" | "copied" | "failed";

/** What applying the code says, from the cart's answer (pure, for the tests). */
export function applyMessage(result: CartResult, code: string = welcomeCode.code): { ok: boolean; text: string } {
  const copy = pagesCopy.popup.reward;
  if (!result.ok) return { ok: false, text: cartCopy.errors[result.error] };
  const cart: Cart | null = result.cart;
  const state = cart?.discountCodes.find((entry) => normalizeDiscountCode(entry.code) === normalizeDiscountCode(code));
  if (state && !state.applicable && state.reason === "not-combinable") return { ok: true, text: copy.notCombined(code) };
  if (!cart || cart.lines.length === 0) return { ok: true, text: copy.appliedEmpty(code) };
  return { ok: true, text: copy.appliedMessage(code) };
}

export function RewardCode({ status, onDone }: RewardCodeProps) {
  const copy = pagesCopy.popup.reward;
  const code = welcomeCode.code;
  const { cart, pending, applyDiscountCode } = useCart();

  const rootRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLParagraphElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [applied, setApplied] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    return () => clearTimeout(copyTimer.current);
  }, []);

  const onCart = cart?.discountCodes.some((entry) => normalizeDiscountCode(entry.code) === normalizeDiscountCode(code)) ?? false;

  function selectCode() {
    const element = codeRef.current;
    const selection = window.getSelection();
    if (!element || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function handleCopy() {
    clearTimeout(copyTimer.current);
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      selectCode();
      setCopyState("failed");
      return;
    }
    setCopyState("copied");
    copyTimer.current = setTimeout(() => setCopyState("idle"), 3000);
  }

  async function handleApply() {
    if (pending) return;
    const result = await applyDiscountCode(code);
    setApplied(applyMessage(result, code));
  }

  const copyMessage = copyState === "copied" ? copy.copiedMessage(code) : copyState === "failed" ? copy.copyFailed : null;
  const showApplied = onCart && applied?.ok !== false;

  return (
    <div ref={rootRef} tabIndex={-1} className="outline-none">
      {status === "pending" ? <p className="text-[0.9375rem] leading-relaxed text-tekst">{copy.pending}</p> : null}

      <div className="mt-5 rounded-kaart border border-dashed border-rand-sterk bg-vlak px-5 py-6 text-center sm:py-7">
        <p className="label-caps text-tekst-2">{copy.codeLabel}</p>
        <p
          ref={codeRef}
          data-reward-code=""
          className="mt-3 font-display text-[1.75rem] leading-none font-extrabold tracking-[0.06em] text-tekst select-all sm:text-[2.25rem]"
        >
          {code}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <Button
          variant="outline"
          fullWidth
          onClick={handleCopy}
          iconStart={
            copyState === "copied" ? (
              <Check aria-hidden="true" className="size-4" strokeWidth={2.25} />
            ) : (
              <Copy aria-hidden="true" className="size-4" strokeWidth={2} />
            )
          }
          className="sm:flex-1"
        >
          {copyState === "copied" ? copy.copied : copy.copy}
        </Button>
        <Button
          variant="primair"
          fullWidth
          loading={pending}
          onClick={handleApply}
          iconStart={
            showApplied ? (
              <Check aria-hidden="true" className="size-4" strokeWidth={2.25} />
            ) : (
              <ShoppingBag aria-hidden="true" className="size-4" strokeWidth={2} />
            )
          }
          className="sm:flex-1"
        >
          {showApplied ? copy.applied : copy.apply}
        </Button>
      </div>

      {/* Live regions stay in the DOM; they take no space while empty. */}
      <p aria-live="polite" className={cn("flex items-start gap-2 text-sm leading-5 text-tekst", copyMessage && "mt-3")}>
        {copyState === "failed" ? <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0 text-tekst-2" strokeWidth={2.25} /> : null}
        {copyMessage}
      </p>
      <p aria-live="polite" className={cn("flex items-start gap-2 text-sm leading-5 font-medium text-tekst", applied && "mt-3")}>
        {applied ? (
          applied.ok ? (
            <Check aria-hidden="true" className="mt-px size-4 shrink-0 text-succes" strokeWidth={2.25} />
          ) : (
            <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0 text-fout" strokeWidth={2.25} />
          )
        ) : null}
        {applied?.text}
      </p>

      <div className="mt-5 flex justify-center">
        <Button variant="link" onClick={onDone}>
          {copy.continueShopping}
        </Button>
      </div>
    </div>
  );
}
