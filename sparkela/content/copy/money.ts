/**
 * Copy that lib/money.ts returns (plan §5.9, §8.5). This module imports nothing on purpose: content/copy/shared.ts
 * imports lib/money.ts, so lib/money.ts cannot import sharedCopy without an import cycle. sharedCopy.money is this
 * same object (decision 183); change the words here.
 */
export interface MoneyCopy {
  /** Joins the two ends of formatMoneyRange: "€15 tot €50". */
  rangeJoiner: string;
}

export const moneyCopy: MoneyCopy = {
  rangeJoiner: "tot",
};
