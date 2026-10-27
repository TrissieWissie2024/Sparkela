"use client";

import { pdpCopy } from "@/content/copy/pdp";
import { Modal } from "@/components/ui/Modal";

import { ringSizeRows } from "./ringSizes";

/**
 * The ring size guide (docs/PLAN.md §13.9; brief §6: "een ringmaatgids in een modal"): a table size → inside diameter
 * and circumference, measuring with a piece of string, measuring a ring that fits, and the tip "Twijfel je? Kies de
 * grotere maat." A Radix Dialog through Modal (focus trap, Esc, focus back to "Welke maat heb ik?"). The rows come
 * from the sizes of the ring itself (`sizes`, the values of its size option), so the table matches what can be bought.
 */

export interface RingSizeGuideProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The size values of the ring ("16" to "19"). */
  sizes: readonly string[];
}

export function RingSizeGuide({ open, onOpenChange, sizes }: RingSizeGuideProps) {
  const copy = pdpCopy.sizeGuide;
  const rows = ringSizeRows(sizes);

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="md" title={copy.title} description={copy.intro}>
      <div className="flex flex-col gap-7">
        {rows.length > 0 ? (
          <table className="w-full border-collapse text-left text-[0.9375rem]">
            <caption className="sr-only">{copy.caption}</caption>
            <thead>
              <tr className="border-b border-rand-invoer">
                <th scope="col" className="label-caps py-2.5 pr-3 font-semibold text-tekst-2">
                  {copy.columns.size}
                </th>
                <th scope="col" className="label-caps py-2.5 pr-3 font-semibold text-tekst-2">
                  {copy.columns.diameter}
                </th>
                <th scope="col" className="label-caps py-2.5 font-semibold text-tekst-2">
                  {copy.columns.circumference}
                </th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map((row) => (
                <tr key={row.size} className="border-b border-rand last:border-b-0">
                  <th scope="row" className="py-3 pr-3 font-semibold text-tekst">
                    {row.size}
                  </th>
                  <td className="py-3 pr-3 text-tekst">{copy.millimetres(row.diameter)}</td>
                  <td className="py-3 text-tekst">{copy.millimetres(row.circumference)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        <section>
          <h3 className="kop-4">{copy.measureTitle}</h3>
          <ol role="list" className="mt-3 flex flex-col gap-2.5">
            {copy.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-tekst-2">
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
        </section>

        <section>
          <h3 className="kop-4">{copy.ringTitle}</h3>
          <p className="mt-2 text-tekst-2">{copy.ringText}</p>
        </section>

        <p className="rounded-kaart bg-vlak px-4 py-3 font-semibold text-tekst">{copy.tip}</p>
      </div>
    </Modal>
  );
}
