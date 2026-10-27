"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A chip (plan §13.2): a 44 px pill.
 * - With `href`: a link chip, for example type, vibe and moment on the product page (ProductChips).
 * - Otherwise a toggle button with aria-pressed, for filters. The pressed state is never colour alone (plan §4.8,
 *   CORVANE D50.4): a 2 px border in --tekst plus a check mark, a different shape from the focus ring.
 * Borders of controls use --rand-invoer (3:1, WCAG 1.4.11). Port of the FilterChip in CORVANE CollectionView.tsx.
 */

export interface ChipProps {
  /** Toggle state; renders aria-pressed. Ignored for a link chip. */
  pressed?: boolean;
  onClick?: () => void;
  /** Renders a link chip instead of a toggle. */
  href?: string;
  children: ReactNode;
  /** Number of matching products, shown after the label. */
  count?: number;
  className?: string;
}

const base =
  "relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border bg-kaart px-4 text-sm font-medium " +
  "whitespace-nowrap text-tekst transition-[border-color,box-shadow] duration-200 ease-out";

export function Chip({ pressed, onClick, href, children, count, className }: ChipProps) {
  const label = (
    <>
      {children}
      {count !== undefined ? <span className="tabular font-normal text-tekst-2">{count}</span> : null}
    </>
  );

  if (href !== undefined) {
    return (
      <Link
        href={href}
        className={cn(base, "border-rand-invoer hover:shadow-[inset_0_0_0_1px_var(--tekst)] hover:border-tekst", className)}
      >
        {label}
      </Link>
    );
  }

  const isPressed = pressed === true;
  return (
    <button
      type="button"
      aria-pressed={isPressed}
      onClick={onClick}
      className={cn(
        base,
        isPressed
          ? "border-tekst shadow-[inset_0_0_0_1px_var(--tekst)]"
          : "border-rand-invoer hover:border-tekst",
        className,
      )}
    >
      {isPressed ? <Check aria-hidden="true" className="-ml-1 size-4 shrink-0" strokeWidth={2} /> : null}
      {label}
    </button>
  );
}
