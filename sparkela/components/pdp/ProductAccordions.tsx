import Link from "next/link";
import type { ReactNode } from "react";

import type { Product, VerifiedClaim } from "@/lib/types";
import { keepUnitsTogether, materialForVariant, needsHygieneSeal } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { pdpCopy } from "@/content/copy/pdp";
import { site } from "@/content/site";
import { Accordion, type AccordionItem } from "@/components/ui/Accordion";

import { productCodes } from "./variants";

/**
 * The accordions of the product page (docs/PLAN.md §13.9; brief §6 and §2.10; port of CORVANE ProductAccordions), Radix
 * Accordion type "multiple", all closed at first, h3 triggers under a visually hidden h2:
 * - Details en materiaal: the material per colour (materialForVariant, decision 81), dimensions, weight, closure, the
 *   verified claims ("… (bevestigd door de leverancier)", decision 82) and the article numbers.
 * - Verzorging: the metafield verzorging, else pdpCopy.care.default.
 * - Garantie: the 6 months on discolouration, Sparkela's own promise (brief §2.6).
 * - Verzenden en retourneren: for earrings and piercings (needsHygieneSeal: type oorbellen or tag piercing, decision 80)
 *   the hygiene rule site.hygieneRule as the first sentence; then dispatch, costs and the 14 days, from config.
 * - Productveiligheid (GPSR, brief §2.10): manufacturer, the responsible person in the EU, the product identification
 *   (article numbers and handle) and the warnings, from the metafields. Bracketed placeholders stay as they are
 *   (decision 100); an empty field is left out and pdp.gpsr.missing says the details follow. Never self-written safety
 *   text.
 * The gift card instead: Zo werkt het, Voorwaarden and Productveiligheid with pdp.gpsr.digital plus the seller's
 * details from site.company (decision 116). GPSR is on every product page.
 *
 * Server component: the content is rendered here and handed to the client Accordion as nodes. productAccordionItems is
 * exported so tests can render each panel (Radix leaves closed panels out of the markup).
 */

export interface ProductAccordionsProps {
  product: Product;
  claims: VerifiedClaim[];
  className?: string;
}

export function ProductAccordions({ product, claims, className }: ProductAccordionsProps) {
  return (
    <section className={className}>
      <h2 className="sr-only">{pdpCopy.sections.details}</h2>
      <Accordion type="multiple" headingLevel={3} items={productAccordionItems(product, claims)} />
    </section>
  );
}

/** The panels for a product, in the order of the brief. */
export function productAccordionItems(product: Product, claims: readonly VerifiedClaim[]): AccordionItem[] {
  const copy = pdpCopy.accordions;
  if (product.isGiftCard) {
    return [
      { id: "zo-werkt-het", title: copy.giftCard.how.title, content: <GiftCardHow /> },
      { id: "voorwaarden", title: copy.giftCard.terms.title, content: <GiftCardTerms /> },
      { id: "productveiligheid", title: copy.safety.title, content: <DigitalSafety /> },
    ];
  }
  return [
    { id: "details", title: copy.details.title, content: <Details product={product} claims={claims} /> },
    { id: "verzorging", title: copy.care.title, content: <Care text={product.metafields.verzorging} /> },
    { id: "garantie", title: copy.guarantee.title, content: <Guarantee /> },
    { id: "verzenden", title: copy.shipping.title, content: <ShippingReturns hygiene={needsHygieneSeal(product)} /> },
    { id: "productveiligheid", title: copy.safety.title, content: <Safety product={product} /> },
  ];
}

/* -------------------------------------------------------------------------- */
/* Building blocks                                                             */
/* -------------------------------------------------------------------------- */

const textLink =
  "inline-flex min-h-11 items-center font-medium text-link underline decoration-1 underline-offset-4 hover:text-link-hover hover:decoration-2";

/** One row of a definition list: term column and value column. */
const detailRow = "grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-4 py-2.5 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)]";

interface Row {
  id: string;
  term: string;
  value: ReactNode;
}

function DetailList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <dl className="flex flex-col divide-y divide-rand">
      {rows.map((row) => (
        <div key={row.id} className={detailRow}>
          <dt className="font-medium text-tekst">{row.term}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A list with a short hairline marker per item. */
function PlainList({ items, className }: { items: readonly ReactNode[]; className?: string }) {
  return (
    <ul role="list" className={cn("flex flex-col gap-2", className)}>
      {items.map((item, index) => (
        <li key={index} className="relative pl-5">
          <span aria-hidden="true" className="absolute top-[0.8em] left-0 h-px w-2.5 bg-rand-invoer" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function present(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

/* -------------------------------------------------------------------------- */
/* Jewellery                                                                   */
/* -------------------------------------------------------------------------- */

function Details({ product, claims }: { product: Product; claims: readonly VerifiedClaim[] }) {
  const copy = pdpCopy.accordions.details;
  const { materiaal, afmetingen, gewicht, sluiting } = product.metafields;
  const colours = product.variants.filter((variant) => variant.swatch !== null);
  const rows: Row[] = [];

  if (colours.length > 1) {
    for (const variant of colours) {
      const text = materialForVariant(materiaal, variant);
      if (text) rows.push({ id: `materiaal-${variant.id}`, term: `${copy.material}: ${variant.title}`, value: text });
    }
  } else {
    const text = materialForVariant(materiaal, colours[0] ?? null);
    if (text) rows.push({ id: "materiaal", term: copy.material, value: text });
  }
  const dimensions = present(afmetingen);
  if (dimensions) rows.push({ id: "afmetingen", term: copy.dimensions, value: keepUnitsTogether(dimensions) });
  const weight = present(gewicht);
  if (weight) rows.push({ id: "gewicht", term: copy.weight, value: keepUnitsTogether(weight) });
  const closure = present(sluiting);
  if (closure) rows.push({ id: "sluiting", term: copy.closure, value: closure });
  if (claims.length > 0) {
    rows.push({
      id: "claims",
      term: pdpCopy.specs.claims,
      value: (
        <span className="flex flex-col gap-1">
          {claims.map((claim) => (
            <span key={claim.id}>{pdpCopy.claims.confirmed(claim.label)}</span>
          ))}
        </span>
      ),
    });
  }
  const codes = productCodes(product);
  if (codes.length > 0) rows.push({ id: "sku", term: copy.sku, value: <span className="tabular">{codes.join(", ")}</span> });

  return <DetailList rows={rows} />;
}

function Care({ text }: { text: string | null }) {
  const paragraphs = (present(text) ?? pdpCopy.care.default)
    .split(/\n\s*\n|\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  return (
    <div className="flex flex-col gap-3">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

function Guarantee() {
  const copy = pdpCopy.accordions.guarantee;
  return (
    <div className="flex flex-col gap-2">
      <p>{copy.text}</p>
      <p>
        <Link href={copy.link.href} className={textLink}>
          {copy.link.label}
        </Link>
      </p>
    </div>
  );
}

function ShippingReturns({ hygiene }: { hygiene: boolean }) {
  const copy = pdpCopy.accordions.shipping;
  return (
    <div className="flex flex-col gap-4">
      {hygiene ? <p className="font-semibold text-tekst">{site.hygieneRule}</p> : null}
      <PlainList items={copy.items} />
      <p>
        <Link href={copy.link.href} className={textLink}>
          {copy.link.label}
        </Link>
      </p>
    </div>
  );
}

function Safety({ product }: { product: Product }) {
  const copy = pdpCopy.accordions.safety;
  const { gpsrFabrikant, gpsrVerantwoordelijkeEu, gpsrWaarschuwingen } = product.metafields;
  const manufacturer = present(gpsrFabrikant);
  const responsible = present(gpsrVerantwoordelijkeEu);
  const warnings = present(gpsrWaarschuwingen);
  const codes = productCodes(product);
  const rows: Row[] = [];
  if (manufacturer) rows.push({ id: "fabrikant", term: copy.manufacturer, value: <MultiLine text={manufacturer} /> });
  if (responsible) rows.push({ id: "verantwoordelijke", term: copy.responsible, value: <MultiLine text={responsible} /> });
  rows.push({
    id: "identificatie",
    term: copy.identification,
    value: <span className="tabular">{copy.identificationValue(codes.length > 0 ? codes.join(", ") : product.title, product.handle)}</span>,
  });
  if (warnings) rows.push({ id: "waarschuwingen", term: copy.warnings, value: <MultiLine text={warnings} /> });
  const incomplete = !manufacturer || !responsible || !warnings;

  return (
    <div className="flex flex-col gap-4">
      <DetailList rows={rows} />
      {incomplete ? <p>{pdpCopy.gpsr.missing}</p> : null}
    </div>
  );
}

/** Multi-line metafield text (an address) with its line breaks. */
function MultiLine({ text }: { text: string }) {
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  return (
    <span className="flex flex-col">
      {lines.map((line, index) => (
        <span key={index}>{line}</span>
      ))}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Gift card                                                                   */
/* -------------------------------------------------------------------------- */

function GiftCardHow() {
  const steps = pdpCopy.accordions.giftCard.how.steps;
  return (
    <ol role="list" className="flex flex-col gap-2.5">
      {steps.map((step, index) => (
        <li key={step} className="flex gap-3">
          <span
            aria-hidden="true"
            className="tabular flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-tekst ring-1 ring-rand-invoer ring-inset"
          >
            {index + 1}
          </span>
          <span className="pt-px">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function GiftCardTerms() {
  const copy = pdpCopy.accordions.giftCard.terms;
  return (
    <div className="flex flex-col gap-4">
      <PlainList items={copy.items} />
      <p>
        <Link href={copy.link.href} className={textLink}>
          {copy.link.label}
        </Link>
      </p>
    </div>
  );
}

function DigitalSafety() {
  const copy = pdpCopy.accordions.safety;
  const company = site.company;
  return (
    <div className="flex flex-col gap-4">
      <p>{pdpCopy.gpsr.digital}</p>
      <DetailList
        rows={[
          {
            id: "verkoper",
            term: copy.seller,
            value: (
              <span className="flex flex-col">
                <span>{company.legalName}</span>
                <span>{company.address}</span>
                <span>{company.kvk}</span>
                <span>{site.email}</span>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
