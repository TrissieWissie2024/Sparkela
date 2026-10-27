import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { FaqItem } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Accordion } from "@/components/ui/Accordion";

/**
 * A list of questions from content/faq.ts as an accordion (docs/PLAN.md §13.12; brief §6 block 15; CORVANE
 * FaqSection.tsx): Radix Accordion type "multiple" (several answers open at once, arrow keys between the questions),
 * each answer with its optional link (FaqItem.link, for example "Hier de overeenkomst herroepen"). Used by /stacks,
 * /cadeaukaarten and the home's FaqSection; the caller gives the section its heading, so `headingLevel` is the level
 * of the questions. Leisteen links on light surfaces, bot-wit and underlined on donker ones (tone="donker", the
 * section sets data-vlak). Renders nothing without items. Server component around the client Accordion.
 */

export interface FaqListProps {
  items: readonly FaqItem[];
  /** Heading element around each question. Default 3. */
  headingLevel?: 2 | 3 | 4;
  tone?: "licht" | "donker";
  className?: string;
}

export function FaqList({ items, headingLevel = 3, tone = "licht", className }: FaqListProps) {
  if (items.length === 0) return null;
  const dark = tone === "donker";

  return (
    <Accordion
      type="multiple"
      headingLevel={headingLevel}
      tone={tone}
      className={className}
      items={items.map((item) => ({
        id: item.id,
        title: item.question,
        content: (
          <>
            <p>{item.answer}</p>
            {item.link ? (
              <Link
                href={item.link.href}
                className={cn(
                  "mt-3 inline-flex min-h-11 items-center gap-1.5 font-medium underline decoration-1 underline-offset-4 hover:decoration-2",
                  dark ? "text-tekst-op-donker" : "text-link hover:text-link-hover",
                )}
              >
                {item.link.label}
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
              </Link>
            ) : null}
          </>
        ),
      }))}
    />
  );
}
