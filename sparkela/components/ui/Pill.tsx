import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A rounded label (plan §13.2; brief §5: USP's as pills), for example the USP pills in the hero or "Nu live" on the
 * drop banner. Not a control: it has no hover or focus state. The name says the surface it sits on:
 * - `licht`: a light pill with a hairline, on donker, roest or vlak surfaces (and pagina).
 * - `donker`: a dark pill with bot-wit text, on light surfaces.
 * - `outline`: hairline only, on light surfaces.
 * - `outline-op-donker`: hairline only, on donker, roest, olijf and leisteen surfaces.
 * Port of CORVANE components/ui/Pill.tsx.
 */

export type PillTone = "licht" | "donker" | "outline" | "outline-op-donker";

export type PillSize = "sm" | "md";

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  size?: PillSize;
  /** Decorative icon before the label (mark it aria-hidden). */
  icon?: ReactNode;
  children: ReactNode;
}

const tones: Record<PillTone, string> = {
  licht: "bg-pagina text-tekst ring-1 ring-inset ring-rand",
  donker: "bg-donker text-tekst-op-donker",
  outline: "text-tekst ring-1 ring-inset ring-rand-sterk",
  "outline-op-donker": "text-bot-wit ring-1 ring-inset ring-bot-wit/50",
};

/** md is the USP pill of the plan: 32 px high, 13 px text. Text that does not fit wraps instead of being clipped. */
const sizes: Record<PillSize, string> = {
  sm: "min-h-7 gap-1.5 px-3 py-1 text-xs",
  md: "min-h-8 gap-2 px-3.5 py-1.5 text-[0.8125rem]",
};

export function Pill({ tone = "licht", size = "md", icon, className, children, ...rest }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-sans leading-tight font-medium forced-colors:border forced-colors:border-[CanvasText]",
        tones[tone],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {icon ? <span className="inline-flex shrink-0 [&>svg]:size-[1.15em]">{icon}</span> : null}
      {children}
    </span>
  );
}
