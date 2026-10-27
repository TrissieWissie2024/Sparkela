"use client";

import { cn } from "@/lib/cn";
import { site } from "@/content/site";

import { TimeGate } from "./TimeGate";

/**
 * The VAT line (brief §4, plan §13.3, decision 138): "Prijzen inclusief 21% btw" until 31 December 2026, from
 * 1 January 2027 the small business scheme sentence. Switches by date through TimeGate at site.vat.switchAt, before
 * the first paint and in open tabs; prices stay the same. Used by MiniFooter (C1), Footer and CartTotals (C3) and
 * ProductInfo (D2). A block-level <span>, so it also fits inside a <p>.
 */
export function VatNotice({ className, tone = "licht" }: { className?: string; tone?: "licht" | "donker" }) {
  return (
    <TimeGate
      at={site.vat.switchAt}
      before={site.vat.before}
      after={site.vat.after}
      as="span"
      className={cn("tekst-klein block", tone === "donker" ? "text-tekst-2-op-donker" : "text-tekst-2", className)}
    />
  );
}
