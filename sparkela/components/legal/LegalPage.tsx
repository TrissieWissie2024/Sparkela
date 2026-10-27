import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { ReactNode } from "react";

import { MONTHS_NL } from "@/lib/dates";
import type { IsoDate } from "@/lib/types";
import { legalPages, legalReviewNotice, legalUi, legalVariables, type LegalPageMeta, type LegalSlug } from "@/content/legal";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/pages/PageHeader";

import { LegalNotice } from "./LegalNotice";
import { Markdown } from "./Markdown";

/**
 * A legal page (docs/PLAN.md §13.13, §14.13, §14.16; brief §6): PageHeader with the page's H1, the review notice
 * ("TODO: laten controleren"), the Markdown text from content/legal/<slug>.md and "Laatst bijgewerkt: {date}".
 *
 * The Markdown never retypes a company detail, an amount or a number of days: `{{name}}` is filled in from
 * legalVariables (content/legal.ts), and an unknown name fails the build. The first line of every file is the review
 * notice itself (content guard); LegalNotice shows it, so the text below starts after it. `children` (the holiday list,
 * the cookie table) go where the file has the marker `<!-- slot -->`, or after the text without one. Static: the files
 * are read while the page is prerendered. Server component.
 */

export const LEGAL_SLOT = "<!-- slot -->";

const VARIABLE = /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g;

/** Markdown-safe: a value never turns into a link, emphasis or HTML ("[Naam vof]" stays literal). */
function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_[\]<>]/g, (char) => `\\${char}`);
}

/** Fills `{{name}}` from `variables`; throws on a name that does not exist (a typo must fail the build). */
export function fillLegalTemplate(source: string, variables: Readonly<Record<string, string>> = legalVariables): string {
  return source.replace(VARIABLE, (_, name: string) => {
    const value = variables[name];
    if (value === undefined) throw new Error(`Unknown legal variable {{${name}}}; add it to legalVariables in content/legal.ts.`);
    return escapeMarkdown(value);
  });
}

export function legalPage(slug: LegalSlug): LegalPageMeta {
  const page = legalPages.find((entry) => entry.slug === slug);
  if (!page) throw new Error(`content/legal.ts has no page "${slug}".`);
  return page;
}

/** The Markdown of a legal page without its first line (the review notice), with the variables filled in. */
export function legalSource(slug: LegalSlug): string {
  // Statically scoped to content/legal, so the build traces only that folder (a fully dynamic path traces the whole
  // project into the server output). The pages revalidate, so the files must be there at runtime too.
  const raw = readFileSync(join(process.cwd(), "content", "legal", basename(legalPage(slug).file)), "utf8").replace(/^﻿/, "");
  const body = raw.startsWith(legalReviewNotice) ? raw.slice(legalReviewNotice.length) : raw;
  return fillLegalTemplate(body.trim());
}

/** "2026-10-27" → "27 oktober 2026". */
export function formatLegalDate(isoDate: IsoDate): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS_NL[month - 1]} ${year}`;
}

export interface LegalPageProps {
  slug: LegalSlug;
  children?: ReactNode;
}

/** "Laatst bijgewerkt: <time>27 oktober 2026</time>". */
function Updated({ isoDate }: { isoDate: IsoDate }) {
  const date = formatLegalDate(isoDate);
  const text = legalUi.updated(date);
  const at = text.indexOf(date);
  return (
    <p className="mt-4 tekst-klein text-tekst-2">
      {text.slice(0, at)}
      <time dateTime={isoDate}>{date}</time>
      {text.slice(at + date.length)}
    </p>
  );
}

export function LegalPage({ slug, children }: LegalPageProps) {
  const page = legalPage(slug);
  const [before, after] = legalSource(slug).split(LEGAL_SLOT);
  return (
    <>
      <PageHeader title={page.title} />
      <Container className="pb-16 md:pb-24">
        <LegalNotice className="max-w-[42rem]" />
        <Updated isoDate={page.updatedAt} />
        <div className="mt-8 md:mt-10">
          <Markdown source={before} />
          {children}
          {after ? <Markdown source={after} /> : null}
        </div>
      </Container>
    </>
  );
}
