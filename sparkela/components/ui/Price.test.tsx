import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Money, PriceDisplay } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";

import { Price, shouldStrikeThrough, type PriceSize } from "./Price";

/*
 * Honest prices (brief §2.5, plan §8.6): a struck-through previous price only with showCompareAt, and then always
 * with the line "Laagste prijs in de 30 dagen hiervoor: €X". There is no prop to hide that line, for any size or
 * tone. An inconsistent display (no lowest price, or a previous price that is not higher) strikes nothing through.
 */

const money = (cents: number): Money => ({ cents, currency: "EUR" });

const plain: PriceDisplay = { price: money(1995), compareAt: null, lowest30d: null, showCompareAt: false };
const onSale: PriceDisplay = { price: money(1995), compareAt: money(2495), lowest30d: money(1795), showCompareAt: true };

const SIZES: PriceSize[] = ["sm", "md", "lg"];
const TONES = ["licht", "donker"] as const;
const STRUCK = /<s[\s>]|<del[\s>]|line-through/;

describe("Price", () => {
  it("renders the price in tabular figures, without <s>, when showCompareAt is false", () => {
    for (const size of SIZES) {
      for (const tone of TONES) {
        const html = renderToStaticMarkup(<Price display={plain} size={size} tone={tone} />);
        expect(html).toContain("€19,95");
        expect(html).toContain("tabular");
        expect(html).not.toMatch(STRUCK);
        expect(html).not.toContain("Laagste prijs");
        expect(html).not.toContain(sharedCopy.price.was);
      }
    }
  });

  it("never strikes through a compare-at price that Shopify sends without showCompareAt", () => {
    const html = renderToStaticMarkup(
      <Price display={{ price: money(1995), compareAt: money(2495), lowest30d: null, showCompareAt: false }} />,
    );
    expect(html).not.toMatch(STRUCK);
    expect(html).not.toContain("€24,95");
  });

  it("with showCompareAt always shows <s> and the lowest-price line, for every size and tone", () => {
    for (const size of SIZES) {
      for (const tone of TONES) {
        const html = renderToStaticMarkup(<Price display={onSale} size={size} tone={tone} />);
        expect(html).toMatch(/<s[\s>]/);
        expect(html).toContain("€24,95");
        expect(html).toContain("€19,95");
        expect(html).toContain(sharedCopy.price.lowest30d("€17,95"));
        expect(html).toContain("Laagste prijs in de 30 dagen hiervoor: €17,95");
        expect(html).toContain(`${sharedCopy.price.was} `);
      }
    }
  });

  it("also shows the lowest-price line on a from-price", () => {
    const html = renderToStaticMarkup(<Price display={onSale} from />);
    expect(html).toContain("Vanaf €19,95");
    expect(html).toContain("Laagste prijs in de 30 dagen hiervoor: €17,95");
  });

  it("fails closed: no strike-through without a lowest price or with a previous price that is not higher", () => {
    const inconsistent: PriceDisplay[] = [
      { ...onSale, lowest30d: null },
      { ...onSale, compareAt: null },
      { ...onSale, compareAt: money(1995) },
      { ...onSale, compareAt: money(1495) },
    ];
    for (const display of inconsistent) {
      expect(shouldStrikeThrough(display)).toBe(false);
      const html = renderToStaticMarkup(<Price display={display} />);
      expect(html).not.toMatch(STRUCK);
      expect(html).not.toContain("Laagste prijs");
    }
    expect(shouldStrikeThrough(onSale)).toBe(true);
  });

  it("renders 'Vanaf' with whole euros short", () => {
    expect(renderToStaticMarkup(<Price display={{ ...plain, price: money(1500) }} from />)).toContain("Vanaf €15<");
    expect(renderToStaticMarkup(<Price display={{ ...plain, price: money(1500) }} />)).toContain("€15,00");
  });

  it("shows no discount percentage", () => {
    expect(renderToStaticMarkup(<Price display={onSale} size="lg" />)).not.toMatch(/%/);
  });
});
