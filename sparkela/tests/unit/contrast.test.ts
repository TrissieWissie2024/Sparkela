import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { brandColors, type BrandColorToken } from "@/lib/brand-colors";

/**
 * The contrast table of docs/PLAN.md §4.10, recomputed from lib/brand-colors.ts with the WCAG 2.1 formula for
 * relative luminance. A test fails when an allowed pair drops below its threshold, when the table's ratio no longer
 * matches the colours, or when a forbidden pair would suddenly pass (then the table and its rules need a look).
 * It also checks that lib/brand-colors.ts mirrors the :root tokens in app/globals.css one to one, because the
 * components only ever use the CSS tokens.
 */

/** Relative luminance of an sRGB hex colour (WCAG 2.1, 1.4.3). */
function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const ratio = (fg: BrandColorToken, bg: BrandColorToken) => contrastRatio(brandColors[fg], brandColors[bg]);

/**
 * - "tekst": normal text, at least 4.5:1 (AA).
 * - "groot": large text only (24 px, or 18.66 px bold), at least 3:1.
 * - "niet-tekst": focus rings and control borders, at least 3:1 (WCAG 1.4.11).
 * - "decoratief": hairlines and decoration, no requirement.
 * - "verboden": must stay below 4.5:1 as text (and the rules of §4.2 keep it out of the UI).
 */
type Verdict = "tekst" | "groot" | "niet-tekst" | "decoratief" | "verboden";

interface Pair {
  fg: BrandColorToken;
  bg: BrandColorToken;
  /** The ratio as printed in plan §4.10 (two decimals). */
  table: number;
  verdict: Verdict;
  use: string;
}

const TABLE: Pair[] = [
  { fg: "tekst", bg: "pagina", table: 15.02, verdict: "tekst", use: "alle tekst" },
  { fg: "tekst", bg: "vlak", table: 13.7, verdict: "tekst", use: "alle tekst" },
  { fg: "tekst", bg: "kaart", table: 17.93, verdict: "tekst", use: "alle tekst" },
  { fg: "tekst-2", bg: "pagina", table: 6.26, verdict: "tekst", use: "secundaire tekst" },
  { fg: "tekst-2", bg: "vlak", table: 5.71, verdict: "tekst", use: "secundaire tekst" },
  { fg: "tekst-2", bg: "kaart", table: 7.47, verdict: "tekst", use: "secundaire tekst" },
  { fg: "tekst-gedempt", bg: "kaart", table: 4.56, verdict: "tekst", use: "hulptekst op kaarten" },
  { fg: "tekst-gedempt", bg: "pagina", table: 3.82, verdict: "groot", use: "alleen groot" },
  { fg: "tekst-gedempt", bg: "vlak", table: 3.48, verdict: "groot", use: "alleen groot" },
  { fg: "link", bg: "pagina", table: 7.52, verdict: "tekst", use: "links" },
  { fg: "link", bg: "vlak", table: 6.86, verdict: "tekst", use: "links" },
  { fg: "link", bg: "kaart", table: 8.97, verdict: "tekst", use: "links" },
  { fg: "link-hover", bg: "pagina", table: 7.41, verdict: "tekst", use: "link hover, roest tekst" },
  { fg: "link-hover", bg: "vlak", table: 6.76, verdict: "tekst", use: "link hover, roest tekst" },
  { fg: "link-hover", bg: "kaart", table: 8.85, verdict: "tekst", use: "link hover, roest tekst" },
  { fg: "primair-tekst", bg: "primair", table: 6.76, verdict: "tekst", use: "primaire knop" },
  { fg: "primair-tekst", bg: "primair-hover", table: 8.22, verdict: "tekst", use: "knop hover" },
  { fg: "roest", bg: "bot-wit", table: 6.76, verdict: "tekst", use: "knop op roest vlak, logo secundair" },
  { fg: "tekst-op-donker", bg: "donker", table: 13.7, verdict: "tekst", use: "tekst op donker" },
  { fg: "tekst-2-op-donker", bg: "donker", table: 7.49, verdict: "tekst", use: "secundaire tekst op donker" },
  { fg: "bot-wit", bg: "olijf", table: 4.85, verdict: "tekst", use: "garantieblok" },
  { fg: "bot-wit", bg: "leisteen", table: 6.86, verdict: "tekst", use: "leisteen vlakken" },
  { fg: "succes", bg: "succes-vlak", table: 5.34, verdict: "tekst", use: "Op voorraad, succesmeldingen" },
  { fg: "fout", bg: "fout-vlak", table: 7.38, verdict: "tekst", use: "Laatste stuks, Sale, foutmeldingen" },
  { fg: "info", bg: "info-vlak", table: 7.53, verdict: "tekst", use: "Nieuw, infomeldingen" },
  { fg: "tekst", bg: "succes-vlak", table: 15.1, verdict: "tekst", use: "lopende tekst in meldingen" },
  { fg: "tekst", bg: "fout-vlak", table: 14.96, verdict: "tekst", use: "lopende tekst in meldingen" },
  { fg: "tekst", bg: "info-vlak", table: 15.05, verdict: "tekst", use: "lopende tekst in meldingen" },
  { fg: "focus", bg: "pagina", table: 7.52, verdict: "niet-tekst", use: "focusring" },
  { fg: "focus", bg: "vlak", table: 6.86, verdict: "niet-tekst", use: "focusring" },
  { fg: "focus", bg: "kaart", table: 8.97, verdict: "niet-tekst", use: "focusring" },
  { fg: "bot-wit", bg: "donker", table: 13.7, verdict: "niet-tekst", use: "focusring op donker" },
  { fg: "bot-wit", bg: "roest", table: 6.76, verdict: "niet-tekst", use: "focusring op roest" },
  { fg: "bot-wit", bg: "olijf", table: 4.85, verdict: "niet-tekst", use: "focusring op olijf" },
  { fg: "bot-wit", bg: "leisteen", table: 6.86, verdict: "niet-tekst", use: "focusring op leisteen" },
  { fg: "rand-invoer", bg: "kaart", table: 4.56, verdict: "niet-tekst", use: "randen van invoervelden" },
  { fg: "rand-invoer", bg: "pagina", table: 3.82, verdict: "niet-tekst", use: "randen van invoervelden" },
  { fg: "rand-sterk", bg: "kaart", table: 2.38, verdict: "decoratief", use: "niet voor bedieningsgrenzen" },
  { fg: "rand", bg: "kaart", table: 1.75, verdict: "decoratief", use: "kaartranden, haarlijnen" },
  { fg: "roest", bg: "donker", table: 2.03, verdict: "verboden", use: "geen roest tekst, icoon of haarlijn op donker" },
  { fg: "leisteen", bg: "donker", table: 2.0, verdict: "verboden", use: "daarom een bot-witte ring op donker" },
  { fg: "tekst-2-op-donker", bg: "roest", table: 3.7, verdict: "verboden", use: "op roest alleen bot-wit" },
  { fg: "tekst-2-op-donker", bg: "olijf", table: 2.65, verdict: "verboden", use: "op olijf alleen bot-wit" },
  { fg: "tekst-2-op-donker", bg: "leisteen", table: 3.75, verdict: "verboden", use: "op leisteen alleen bot-wit" },
  { fg: "bot-wit", bg: "steen", table: 3.48, verdict: "groot", use: "steen als vlak vermijden" },
  // The wordmark is a logotype (WCAG 1.4.3 exempts it); recorded so the pair is known, never used for running text.
  { fg: "inkt", bg: "steen", table: 3.93, verdict: "decoratief", use: "Logo op-steen" },
];

/**
 * Pairs the B2 primitives use beyond the table (StatusLabel tones are in the table): hover faces, placeholders,
 * the progress bar and control borders on vlak. All must pass their threshold too.
 */
const COMPONENT_PAIRS: Array<Omit<Pair, "table">> = [
  { fg: "roest", bg: "bot-wit-50", verdict: "tekst", use: "Button op-roest hover" },
  { fg: "tekst-2", bg: "vlak", verdict: "tekst", use: "PhotoSlot placeholder (vlak)" },
  { fg: "tekst-2", bg: "kaart", verdict: "tekst", use: "PhotoSlot placeholder (kaart)" },
  { fg: "tekst-2-op-donker", bg: "bot-wit-900", verdict: "tekst", use: "PhotoSlot placeholder (donker)" },
  { fg: "rand-invoer", bg: "vlak", verdict: "niet-tekst", use: "Select, Checkbox, Chip on a vlak section" },
  { fg: "primair", bg: "rand", verdict: "niet-tekst", use: "ProgressBar fill on its track" },
  { fg: "bot-wit", bg: "rand-op-donker", verdict: "niet-tekst", use: "ProgressBar fill on a dark track" },
  { fg: "bot-wit", bg: "donker", verdict: "tekst", use: "Countdown op-donker, Pill outline-op-donker" },
  { fg: "fout", bg: "pagina", verdict: "tekst", use: "TextField and Checkbox errors" },
  { fg: "tekst-gedempt", bg: "kaart", verdict: "tekst", use: "TextField placeholder" },
  // tone="donker" on a coloured data-vlak: --tekst-2-op-donker resolves to bot-wit there (globals.css, decision 186).
  { fg: "bot-wit", bg: "roest", verdict: "tekst", use: "secondary text of tone donker on roest (DropBanner, DropHero)" },
  { fg: "bot-wit", bg: "olijf", verdict: "tekst", use: "secondary text of tone donker on olijf (GuaranteeBlock), Logo op-olijf" },
  { fg: "bot-wit", bg: "leisteen", verdict: "tekst", use: "secondary text of tone donker on leisteen" },
];

const MINIMUM: Record<Verdict, number> = { tekst: 4.5, groot: 3, "niet-tekst": 3, decoratief: 0, verboden: 0 };

describe("contrast table (plan §4.10)", () => {
  it.each(TABLE)("$fg on $bg is $table:1 ($verdict, $use)", ({ fg, bg, table, verdict }) => {
    const actual = ratio(fg, bg);
    expect(Math.round(actual * 100) / 100, "the ratio printed in the plan").toBeCloseTo(table, 2);
    expect(actual).toBeGreaterThanOrEqual(MINIMUM[verdict]);
    // Large-only and forbidden pairs must really be below AA for normal text, or the table's rule is stale.
    if (verdict === "groot" || verdict === "verboden") expect(actual).toBeLessThan(4.5);
  });

  it("keeps every label colour of §4.9 at AA", () => {
    const labels: Array<[BrandColorToken, BrandColorToken]> = [
      ["succes", "succes-vlak"],
      ["tekst", "vlak"],
      ["bot-wit", "roest"],
      ["fout", "fout-vlak"],
      ["info", "info-vlak"],
      ["tekst-op-donker", "donker"],
    ];
    for (const [fg, bg] of labels) expect(ratio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(COMPONENT_PAIRS)("$use: $fg on $bg passes ($verdict)", ({ fg, bg, verdict }) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(MINIMUM[verdict]);
  });

  it("computes the WCAG formula correctly (black on white is 21:1)", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });
});

describe("secondary text on coloured surfaces (plan §4.8, decision 186)", () => {
  const css = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");

  it("turns --tekst-2-op-donker into bot-wit on roest, olijf and leisteen", () => {
    const rule = /((?:\[data-vlak="[a-z]+"\],?\s*)+)\{\s*--tekst-2-op-donker:\s*var\(--bot-wit\);\s*\}/.exec(css);
    expect(rule, "the data-vlak override in app/globals.css").not.toBeNull();
    const surfaces = [...(rule?.[1] ?? "").matchAll(/data-vlak="([a-z]+)"/g)].map((match) => match[1]).sort();
    expect(surfaces).toEqual(["leisteen", "olijf", "roest"]);
  });
});

describe("tokens: lib/brand-colors.ts mirrors app/globals.css", () => {
  const css = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");
  const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
  const cssTokens = new Map<string, string>();
  for (const match of rootBlock.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    cssTokens.set(match[1], match[2].toUpperCase());
  }

  it("has every colour of lib/brand-colors.ts in :root with the same value", () => {
    const mismatches = Object.entries(brandColors)
      .filter(([token, hex]) => cssTokens.get(token) !== hex.toUpperCase())
      .map(([token, hex]) => `--${token}: css ${cssTokens.get(token) ?? "missing"}, brand-colors ${hex}`);
    expect(mismatches).toEqual([]);
  });

  it("has no hex colour in :root that lib/brand-colors.ts does not know", () => {
    const unknown = [...cssTokens.keys()].filter((token) => !(token in brandColors));
    expect(unknown).toEqual([]);
  });
});
