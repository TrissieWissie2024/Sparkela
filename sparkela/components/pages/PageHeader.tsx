import { Fragment } from "react";

import type { Crumb } from "@/lib/types";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * Head of an ordinary page (plan §13.2, §14.7 to §14.17): optional breadcrumbs, then eyebrow, the page's H1 (kop-1)
 * and an intro, in the page container. The page renders its content below it; pages never render their own <main>
 * (ShopChrome does). Server component.
 */

export interface PageHeaderProps {
  eyebrow?: string;
  /** The page's only H1. */
  title: string;
  intro?: string;
  /** For example [{ label: sharedCopy.ui.home, href: "/" }, { label: "Stacks" }]: the last crumb is the page. */
  breadcrumbs?: Crumb[];
  /** Every sentence of the title on its own line ("Als eerste bij elke drop." / "Plus 10% …"), as in the Hero. */
  sentenceLines?: boolean;
}

export function PageHeader({ eyebrow, title, intro, breadcrumbs, sentenceLines = false }: PageHeaderProps) {
  const hasCrumbs = breadcrumbs !== undefined && breadcrumbs.length > 0;
  return (
    <Container as="header" className={hasCrumbs ? "pt-2 pb-10 md:pt-4 md:pb-14" : "pt-10 pb-10 md:pt-14 md:pb-14"}>
      {hasCrumbs ? <Breadcrumbs items={breadcrumbs} className="mb-4 md:mb-6" /> : null}
      <SectionHeading level={1} eyebrow={eyebrow} title={sentenceLines ? <SentenceLines text={title} /> : title} intro={intro} />
    </Container>
  );
}

/** The title split after each full stop, one block per sentence (the text itself is unchanged). */
function SentenceLines({ text }: { text: string }) {
  const sentences = text.split(/(?<=\.)\s+/).filter((sentence) => sentence.length > 0);
  return sentences.map((sentence, index) => (
    <Fragment key={index}>
      {index > 0 ? " " : null}
      <span className="block">{sentence}</span>
    </Fragment>
  ));
}
