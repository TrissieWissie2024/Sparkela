"use client";

import { useId } from "react";

import type { Product, VerifiedClaim } from "@/lib/types";
import { keepUnitsTogether, materialForVariant } from "@/lib/catalog";
import { pdpCopy } from "@/content/copy/pdp";

import { useOptionalPdpState } from "./PdpStateProvider";
import { resolveVariant } from "./variants";

/**
 * The specifications of the piece (docs/PLAN.md §13.9; brief §6: materiaal, afmeting, gewicht, sluiting) as a
 * definition list, a term column and a value column with hairlines between the rows (CORVANE's details list):
 * - Materiaal for the CHOSEN variant: materialForVariant(product.metafields.materiaal, variant) (decision 81), so
 *   Zilver never says "met goudlaag" and Goud always names the gold layer. The chosen variant comes from
 *   PdpStateProvider (the VariantPicker's choice); `variantId` is the starting value (defaultVariant on the server,
 *   so the static HTML is right) and the value outside the provider.
 * - Afmeting, Gewicht and Sluiting from the metafields, value and unit kept together (keepUnitsTogether, decision 201).
 * - Every verified claim as an extra row: claims.confirmed(label) = "Nikkelvrij (bevestigd door de leverancier)"
 *   (brief §2.6, decision 82). Never "getest". At launch there are none.
 * Empty fields are left out; without any row (the gift card) it renders nothing.
 */

export interface ProductSpecsProps {
  product: Pick<Product, "handle" | "variants" | "metafields">;
  claims: VerifiedClaim[];
  variantId: string;
  className?: string;
}

interface SpecRow {
  id: string;
  term: string;
  value: string;
}

/** The rows for a variant (exported for tests and for the details accordion). */
export function specRows(product: Pick<Product, "variants" | "metafields">, variantId: string): SpecRow[] {
  const copy = pdpCopy.specs;
  const variant = resolveVariant(product, variantId);
  const { afmetingen, gewicht, sluiting, materiaal } = product.metafields;
  const rows: Array<SpecRow | null> = [
    entry("materiaal", copy.materiaal, materialForVariant(materiaal, variant)),
    entry("afmeting", copy.afmeting, afmetingen),
    entry("gewicht", copy.gewicht, gewicht),
    entry("sluiting", copy.sluiting, sluiting),
  ];
  return rows.filter((row): row is SpecRow => row !== null);
}

function entry(id: string, term: string, value: string | null): SpecRow | null {
  const text = value?.trim();
  return text ? { id, term, value: keepUnitsTogether(text) } : null;
}

/** One row: term left, value right (long values wrap in their own column). */
const ROW = "grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-4 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)]";

export function ProductSpecs({ product, claims, variantId, className }: ProductSpecsProps) {
  const headingId = useId();
  const state = useOptionalPdpState();
  const chosen = state?.choiceFor(product.handle).variantId ?? variantId;
  const rows = specRows(product, chosen);
  if (rows.length === 0 && claims.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={className}>
      <h2 id={headingId} className="label-caps text-tekst-2">
        {pdpCopy.specs.title}
      </h2>
      <dl className="mt-4 flex flex-col divide-y divide-rand text-[0.9375rem]">
        {rows.map((row) => (
          <div key={row.id} className={ROW}>
            <dt className="text-tekst-2">{row.term}</dt>
            <dd className="font-medium text-tekst">{row.value}</dd>
          </div>
        ))}
        {claims.length > 0 ? (
          <div className={ROW}>
            <dt className="text-tekst-2">{pdpCopy.specs.claims}</dt>
            <dd className="flex flex-col gap-1 font-medium text-tekst">
              {claims.map((claim) => (
                <span key={claim.id}>{pdpCopy.claims.confirmed(claim.label)}</span>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
