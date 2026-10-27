"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { cartCopy } from "@/content/copy/cart";
import { TextField } from "@/components/ui/TextField";

import { useCart } from "./useCart";

/**
 * The gift message in the cart drawer (docs/PLAN.md §7.4, §13.7; brief §6 cart drawer): a button "Cadeauboodschap
 * toevoegen" (aria-expanded) that opens a text field of at most 200 characters with a counter. Typing is saved as the
 * cart note, debounced by 600 ms (here, not in the provider); closing the drawer (unmount) saves a pending change at
 * once. A note that already exists keeps the field open. Changes from elsewhere (another tab) show up while the
 * visitor is not typing.
 */

export const GIFT_MESSAGE_MAX = 200;
export const GIFT_MESSAGE_DEBOUNCE_MS = 600;

export function GiftMessageField() {
  const { cart, setNote } = useCart();
  const saved = cart?.note ?? "";
  const id = useId();
  const panelId = `${id}-panel`;
  const fieldId = `${id}-field`;

  const [expanded, setExpanded] = useState(saved.length > 0);
  const [value, setValue] = useState(saved);
  const [dirty, setDirty] = useState(false);

  // Follow the stored note while nothing is being typed (another tab, a reload of the cart).
  const [lastSaved, setLastSaved] = useState(saved);
  if (saved !== lastSaved) {
    setLastSaved(saved);
    if (!dirty) setValue(saved);
  }

  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setNoteRef = useRef(setNote);
  useEffect(() => {
    setNoteRef.current = setNote;
  }, [setNote]);

  const flush = () => {
    clearTimeout(timerRef.current);
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next !== null) void setNoteRef.current(next).finally(() => setDirty(false));
  };

  // Save a pending change when the drawer closes.
  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next !== null) void setNoteRef.current(next);
    },
    [],
  );

  const onChange = (next: string) => {
    const capped = Array.from(next).slice(0, GIFT_MESSAGE_MAX).join("");
    setValue(capped);
    setDirty(true);
    pendingRef.current = capped;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, GIFT_MESSAGE_DEBOUNCE_MS);
  };

  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
        className="group flex min-h-11 w-full items-center justify-between gap-4 text-left text-[0.9375rem] font-semibold text-tekst"
      >
        {cartCopy.giftMessage.toggle}
        <ChevronDown
          aria-hidden="true"
          className={cn("size-5 shrink-0 motion-safe:transition-transform motion-safe:duration-200", expanded && "rotate-180")}
          strokeWidth={1.5}
        />
      </button>
      <div id={panelId} hidden={!expanded} className="pt-1 pb-2">
        <TextField
          id={fieldId}
          name="note"
          label={cartCopy.giftMessage.label}
          hint={cartCopy.giftMessage.hint}
          multiline
          rows={3}
          maxLength={GIFT_MESSAGE_MAX}
          value={value}
          onChange={onChange}
          onBlur={flush}
        />
      </div>
    </div>
  );
}
