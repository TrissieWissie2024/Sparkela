import { Marked } from "marked";

import { cn } from "@/lib/cn";

/**
 * Markdown from content/legal/*.md as HTML (docs/PLAN.md §13.13), rendered on the server with `marked` (GFM). The
 * source is our own content (reviewed in git), never visitor input, so the HTML is used as is. The look is fixed here:
 * h2 as kop-3, h3 in semibold, paragraphs, lists and links (leisteen, underlined) at a readable measure. Plain <a>
 * links; internal links do not need next/link. Server component.
 */

const marked = new Marked({ gfm: true, breaks: false });

const PROSE = cn(
  "max-w-[42rem] text-base leading-relaxed text-tekst-2",
  "[&>*:first-child]:mt-0",
  "[&_h2]:kop-3 [&_h2]:mt-10 [&_h2]:text-tekst [&_h2]:break-after-avoid",
  "[&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-tekst [&_h3]:break-after-avoid",
  "[&_p]:mt-4",
  "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
  "[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5",
  "[&_strong]:font-semibold [&_strong]:text-tekst",
  "[&_a]:text-link [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-link-hover [&_a:hover]:decoration-2",
  "[&_hr]:my-8 [&_hr]:border-rand",
  "[&_blockquote]:mt-4 [&_blockquote]:border-l-2 [&_blockquote]:border-rand-sterk [&_blockquote]:pl-4",
  "print:text-tekst",
);

export function Markdown({ source, className }: { source: string; className?: string }) {
  const html = marked.parse(source, { async: false });
  return <div className={cn(PROSE, className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
