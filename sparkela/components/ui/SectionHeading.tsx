import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Heading block of a section (plan §4.4): eyebrow (label-caps, 16 px below it), heading, intro (tekst-groot in
 * --tekst-2, 12 px below the heading). `level` picks the element and the size: 1 → kop-1 (the page's only H1),
 * 2 → kop-2, 3 → kop-3. An `action` (a link or a select) sits to the right of the heading from md and below it on
 * phones. Give the section aria-labelledby={id}. Port of CORVANE components/ui/SectionHeading.tsx.
 */

export interface SectionHeadingProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  level?: 1 | 2 | 3;
  align?: "left" | "center";
  /**
   * "donker" on donker, roest, olijf and leisteen surfaces: bot-wit heading, --tekst-2-op-donker eyebrow and intro.
   * The surface carries data-vlak; on roest, olijf and leisteen that turns --tekst-2-op-donker into bot-wit
   * (globals.css, decision 186), because only bot-wit is AA there.
   */
  tone?: "licht" | "donker";
  /** id on the heading, for aria-labelledby on the section. */
  id?: string;
  action?: ReactNode;
  className?: string;
}

const headingClasses: Record<1 | 2 | 3, string> = {
  1: "kop-1",
  2: "kop-2",
  3: "kop-3",
};

export function SectionHeading({
  eyebrow,
  title,
  intro,
  level = 2,
  align = "left",
  tone = "licht",
  id,
  action,
  className,
}: SectionHeadingProps) {
  const Heading = `h${level}` as const;
  const centered = align === "center";
  const dark = tone === "donker";
  const soft = dark ? "text-tekst-2-op-donker" : "text-tekst-2";

  const text = (
    <div className={cn("flex min-w-0 flex-col", centered && "items-center text-center")}>
      {eyebrow ? <p className={cn("label-caps mb-4", soft)}>{eyebrow}</p> : null}
      <Heading id={id} className={cn(headingClasses[level], dark ? "text-tekst-op-donker" : "text-tekst")}>
        {title}
      </Heading>
      {intro ? <div className={cn("tekst-groot mt-3 max-w-[36rem] text-pretty", soft)}>{intro}</div> : null}
    </div>
  );

  if (!action) return <div className={className}>{text}</div>;

  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        centered ? "items-center" : "md:flex-row md:items-end md:justify-between md:gap-10",
        className,
      )}
    >
      {text}
      <div className="shrink-0">{action}</div>
    </div>
  );
}
