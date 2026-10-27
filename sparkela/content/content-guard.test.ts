import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import type { ClaimId, Review } from "@/lib/types";
import { claims } from "@/content/claims";
import { cartCopy } from "@/content/copy/cart";
import { formsCopy } from "@/content/copy/forms";
import { pagesCopy } from "@/content/copy/pages";
import { sharedCopy } from "@/content/copy/shared";
import { drops } from "@/content/drops";
import { faq } from "@/content/faq";
import { home } from "@/content/home";
import { legalPages, legalReviewNotice } from "@/content/legal";
import { products } from "@/content/products";
import { quiz } from "@/content/quiz";
import { reviews } from "@/content/reviews";
import { site } from "@/content/site";

/**
 * Content guard: brief §2 as a test (docs/PLAN.md §19.1, rules 1 to 13; walker ported from CORVANE).
 *
 * It walks every export of every module in content/ and content/copy/ (found on disk, so a new file can never slip
 * past), calls exported functions with sample arguments and checks their output too, and reads content/legal/*.md.
 * Component sources are read as text: their string literals and JSX text go through the reference and word checks,
 * and no component may contain the consent sentence itself (it must come from site.consentText).
 *
 * A skipped part prints a visible "SKIPPED: <name>" line (console.warn), never a silent pass.
 */

const contentDir = fileURLToPath(new URL(".", import.meta.url));
const appRoot = join(contentDir, "..");
const componentsDir = join(appRoot, "components");
const legalDir = join(contentDir, "legal");
const referenceDir = join(appRoot, "reference");
/** CORVANE's content/ (our own sister project): the overlap check compares against its copy (decision 99). */
const corvaneContentDir = process.env.CORVANE_CONTENT_DIR ?? join(appRoot, "../../trissiewissie2024/corvane/corvane/content");

/* -------------------------------------------------------------------------- */
/* Files                                                                      */
/* -------------------------------------------------------------------------- */

function listFiles(dir: string, accept: (file: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, accept));
    else if (accept(full)) out.push(full);
  }
  return out.sort();
}

const isSourceFile = (file: string) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) && !file.endsWith(".d.ts");
const rel = (file: string) => relative(appRoot, file).split("\\").join("/");

/** Every content module (content/*.ts and content/copy/*.ts), as "content/<path>.ts". */
const contentModuleFiles = listFiles(contentDir, isSourceFile);
const legalMarkdownFiles = listFiles(legalDir, (file) => file.endsWith(".md"));
const componentFiles = listFiles(componentsDir, isSourceFile);

type Module = Record<string, unknown>;

async function loadContentModules(): Promise<Array<{ file: string; exports: Module }>> {
  const modules: Array<{ file: string; exports: Module }> = [];
  for (const file of contentModuleFiles) {
    modules.push({ file: rel(file), exports: (await import(/* @vite-ignore */ pathToFileURL(file).href)) as Module });
  }
  return modules;
}

/* -------------------------------------------------------------------------- */
/* Collecting strings                                                         */
/* -------------------------------------------------------------------------- */

interface TextEntry {
  /** "content/site.ts", "content/legal/privacy.md", "components/brand/Logo.tsx". */
  file: string;
  /** Where in the export the string sits ("site.club.title", "faq[1].answer"); "source" for files read as text. */
  path: string;
  value: string;
}

/** Arguments for exported functions: strings first, then numbers (a function may reject one kind). */
const SAMPLE_ARGS: unknown[] = ["€10,00", "Lola chunky hoops", 1, 2, 3];
const MAX_DEPTH = 12;

function walk(file: string, path: string, value: unknown, out: TextEntry[], seen: Set<unknown>, depth = 0): void {
  if (depth > MAX_DEPTH) return;
  if (typeof value === "string") {
    out.push({ file, path, value });
    return;
  }
  if (typeof value === "function") {
    const fn = value as (...args: unknown[]) => unknown;
    const arity = Math.max(fn.length, 1);
    let called = false;
    for (const sample of SAMPLE_ARGS) {
      const args = Array.from({ length: arity }, () => sample);
      try {
        const result = fn(...args);
        called = true;
        walk(file, `${path}(${args.map((arg) => JSON.stringify(arg)).join(", ")})`, result, out, seen, depth + 1);
      } catch {
        // This sample does not fit the function; the next one may.
      }
    }
    if (!called) out.push({ file, path, value: "<function that could not be called with sample arguments>" });
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (value instanceof Set || value instanceof Map) {
    walk(file, path, [...value.values()], out, seen, depth + 1);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(file, `${path}[${index}]`, item, out, seen, depth + 1));
    return;
  }
  for (const [key, child] of Object.entries(value)) walk(file, `${path}.${key}`, child, out, seen, depth + 1);
}

async function contentTexts(): Promise<TextEntry[]> {
  const out: TextEntry[] = [];
  for (const { file, exports } of await loadContentModules()) {
    for (const [name, value] of Object.entries(exports)) walk(file, name, value, out, new Set());
  }
  for (const file of legalMarkdownFiles) out.push({ file: rel(file), path: "source", value: readFileSync(file, "utf8") });
  return out;
}

/** String literals, template parts and JSX text of a TypeScript source file, without comments or import paths. */
function sourceStrings(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, kind);
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isExternalModuleReference(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) out.push(node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) out.push(node.text);
    else if (ts.isJsxText(node) && node.text.trim()) out.push(node.text.trim());
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return out;
}

function componentTexts(): TextEntry[] {
  return componentFiles.flatMap((file) => sourceStrings(file).map((value) => ({ file: rel(file), path: "source", value })));
}

/* -------------------------------------------------------------------------- */
/* Rules                                                                      */
/* -------------------------------------------------------------------------- */

interface Rule {
  name: string;
  test: (text: string) => boolean;
  /** Entries where the rule does not apply. */
  allow?: (entry: TextEntry) => boolean;
}

interface Finding {
  file: string;
  path: string;
  rule: string;
  value: string;
}

/** Unicode-aware whole-word pattern (\b does not know "è" or "ï"). */
function word(source: string, flags = "iu"): RegExp {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${source})(?=$|[^\\p{L}\\p{N}])`, flags);
}

const CLAIM_IDS: ReadonlySet<string> = new Set<ClaimId>(["nikkelvrij", "waterproof", "hypoallergeen"]);
const nikkelvrijFaqIndex = faq.findIndex((item) => item.id === "nikkelvrij");

/** Rule 1: claims only in content/claims.ts and the conditional FAQ answer about nikkelvrij (brief §2.6). */
const CLAIM_WORDS = [
  "nikkelvrij",
  "nikkel-vrij",
  "waterproof",
  "waterbestendig",
  "waterdicht",
  "hypoallergeen",
  "hypo-allergeen",
  "allergievrij",
  "anti-allergisch",
  "huidvriendelijk",
  "verkleurt (?:nooit|niet)",
  "aanslagvrij",
  "getest",
  "geteste",
  "dermatologisch\\p{L}*",
];

/** Rule 2: existing jewellery brands, shops and designers, plus the reference wording (brief §2.9). Not complete. */
const BRANDS = [
  "pandora",
  "swarovski",
  "cartier",
  "tiffany",
  "bulgari",
  "bvlgari",
  "van cleef",
  "chanel",
  "dior",
  "gucci",
  "herm[eè]s",
  "louis vuitton",
  "prada",
  "chopard",
  "boucheron",
  "messika",
  "mejuri",
  "missoma",
  "monica vinader",
  "ana luisa",
  "astrid (?:&|and|en) miyu",
  "orelia",
  "daniel wellington",
  "lucardi",
  "bijou brigitte",
  "my jewellery",
  "six",
  "accessorize",
  "thomas sabo",
  "ti sento",
  "zinzi",
  "buddha to buddha",
  "pdpaola",
  "edblad",
  "maria black",
  "sophie buhai",
  "jenny bird",
  "laura lombardi",
  "otiumberg",
  "kendra scott",
  "alex (?:&|and) ani",
  "isabel marant",
  "lashthing",
  "yehwang",
  "corvane",
];
const REFERENCE_WORDING = ["dupes?", "zoals van", "lijkt op", "geïnspireerd op", "ge[iï]nspireerd door", "inspired by"];

/** Rule 3: invented social proof (brief §2.3). */
const SOCIAL_PROOF = [
  "mensen bekijken",
  "bekijken dit",
  "bekijkt dit",
  "zojuist gekocht",
  "net gekocht",
  "klanten gingen je voor",
  "trustpilot",
];

/** Rule 12: CORVANE words that betray a port that was not rewritten (decision 99). */
const CORVANE_WORDS = word("(?:scent|spray|geur|parfum)\\p{L}*|vane|corvane");

const RULES: Rule[] = [
  ...CLAIM_WORDS.map((source) => ({
    name: `claim "${source}" outside content/claims.ts`,
    test: (text: string) => word(source).test(text),
    allow: (entry: TextEntry) =>
      entry.file === "content/claims.ts" ||
      (entry.file === "content/faq.ts" && entry.path.startsWith(`faq[${nikkelvrijFaqIndex}].`)) ||
      (/\.claim$/.test(entry.path) && CLAIM_IDS.has(entry.value)),
  })),
  ...BRANDS.map((source) => ({ name: `brand name /${source}/`, test: (text: string) => word(source).test(text) })),
  ...REFERENCE_WORDING.map((source) => ({ name: `reference wording "${source}"`, test: (text: string) => word(source).test(text) })),
  ...SOCIAL_PROOF.map((source) => ({ name: `social proof "${source}"`, test: (text: string) => word(source).test(text) })),
  { name: "star rating character", test: (text) => /[★☆]/.test(text) },
  {
    name: "number of customers or reviews",
    test: (text) => new RegExp("\\d[\\d.,]*\\s*\\+?\\s*(?:tevreden\\s+)?(?:klanten|kopers|reviews|beoordelingen)", "iu").test(text),
  },
  // Rule 8: tone (brief §3).
  { name: "row of exclamation marks", test: (text) => text.includes("!!") },
  { name: "long dash (U+2014)", test: (text) => text.includes("\u2014") },
  { name: "en dash between words", test: (text) => new RegExp("\\p{L}\\s*\\u2013\\s*\\p{L}", "u").test(text) },
  { name: 'formal "u" or "uw"', test: (text) => new RegExp("(?:^|[^\\p{L}\\p{N}])(?:u|uw)\\s", "iu").test(text) },
  // Rule 12: words of the sister project.
  { name: "CORVANE word", test: (text) => CORVANE_WORDS.test(text) },
];

function check(entries: TextEntry[], rules: Rule[]): Finding[] {
  const findings: Finding[] = [];
  for (const entry of entries) {
    for (const rule of rules) {
      if (rule.allow?.(entry)) continue;
      if (rule.test(entry.value)) findings.push({ file: entry.file, path: entry.path, rule: rule.name, value: entry.value });
    }
  }
  return findings;
}

function report(findings: Finding[]): string {
  return findings
    .map((f) => `${f.file} ${f.path}: ${f.rule} in ${JSON.stringify(f.value.length > 160 ? `${f.value.slice(0, 160)}…` : f.value)}`)
    .join("\n");
}

/* -------------------------------------------------------------------------- */
/* Reference overlap (rule 12)                                                */
/* -------------------------------------------------------------------------- */

const NGRAM = 5;

/** Lower case, punctuation and symbols become spaces (diacritics stay letters). */
function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(new RegExp("[^\\p{L}\\p{N}]+", "gu"), " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function ngrams(text: string, n = NGRAM): string[] {
  const words = tokens(text);
  const out: string[] = [];
  for (let i = 0; i + n <= words.length; i += 1) out.push(words.slice(i, i + n).join(" "));
  return out;
}

/** Only multi-word text counts as copy: paths, URLs, ids and keys have no spaces. */
const isProse = (text: string) => /\S\s+\S/.test(text);

interface ReferenceSet {
  name: string;
  grams: Set<string>;
  /** Short reference phrases (3 or 4 words) that must not appear as a whole either (labels only, see below). */
  phrases: string[];
}

/**
 * Runs of 5 words, as the plan says. With `wholeShortPhrases` a reference text of 3 or 4 words also counts as a
 * whole: used for the captured labels, which are almost all shorter than 5 words ("Three cards, one reward") and
 * English, so a hit means a copied label. Not for CORVANE's content: both sites carry the same brief sentence
 * "TODO: laten controleren", which is required, not copied.
 */
function referenceSet(name: string, texts: string[], wholeShortPhrases = false): ReferenceSet {
  const grams = new Set<string>();
  const phrases: string[] = [];
  for (const text of texts) {
    if (!isProse(text)) continue;
    const words = tokens(text);
    if (words.length >= NGRAM) for (const gram of ngrams(text)) grams.add(gram);
    else if (wholeShortPhrases && words.length >= 3) phrases.push(words.join(" "));
  }
  return { name, grams, phrases };
}

function overlapFindings(entries: TextEntry[], sets: ReferenceSet[]): Finding[] {
  const findings: Finding[] = [];
  for (const entry of entries) {
    if (!isProse(entry.value)) continue;
    const grams = ngrams(entry.value);
    const padded = ` ${tokens(entry.value).join(" ")} `;
    for (const set of sets) {
      const hit = grams.find((gram) => set.grams.has(gram)) ?? set.phrases.find((phrase) => padded.includes(` ${phrase} `));
      if (hit) findings.push({ file: entry.file, path: entry.path, rule: `overlaps ${set.name}: "${hit}"`, value: entry.value });
    }
  }
  return findings;
}

function corvaneReference(): ReferenceSet | null {
  if (!existsSync(corvaneContentDir)) {
    console.warn(`SKIPPED: corvane (no CORVANE content at ${corvaneContentDir}; set CORVANE_CONTENT_DIR)`);
    return null;
  }
  const texts = [
    ...listFiles(corvaneContentDir, isSourceFile).flatMap((file) => sourceStrings(file)),
    ...listFiles(corvaneContentDir, (file) => file.endsWith(".md")).map((file) => readFileSync(file, "utf8")),
  ];
  expect(texts.length, `no strings found in ${corvaneContentDir}`).toBeGreaterThan(0);
  return referenceSet("CORVANE content", texts);
}

function collectLabels(value: unknown, out: string[]): void {
  if (Array.isArray(value)) value.forEach((item) => collectLabels(item, out));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "label" && typeof child === "string") out.push(child);
      else collectLabels(child, out);
    }
  }
}

function structureReference(): ReferenceSet | null {
  if (!existsSync(referenceDir)) {
    // reference/ is git-ignored (decision 146): a fresh clone or CI has no captures to compare against.
    console.warn("SKIPPED: reference (reference/ does not exist on this machine)");
    return null;
  }
  const files = listFiles(referenceDir, (file) => file.endsWith(".structure.json"));
  expect(files.length, "reference/ exists but has no *.structure.json: the guard never passes silently").toBeGreaterThan(0);
  const labels: string[] = [];
  for (const file of files) collectLabels(JSON.parse(readFileSync(file, "utf8")) as unknown, labels);
  return referenceSet("reference labels", labels, true);
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

const JEWELRY_TYPES = new Set(["oorbellen", "armbanden", "kettingen", "ringen"]);
const typeOf = (tags: string[]) => tags.find((tag) => tag.startsWith("type:"))?.slice("type:".length) ?? null;
const jewelry = products.filter((product) => JEWELRY_TYPES.has(typeOf(product.tags) ?? ""));

describe("content guard: coverage", () => {
  it("finds the content modules on disk and walks every export", async () => {
    const files = contentModuleFiles.map(rel);
    for (const expected of ["content/site.ts", "content/products.ts", "content/faq.ts", "content/copy/shared.ts", "content/copy/pdp.ts"]) {
      expect(files).toContain(expected);
    }
    const texts = await contentTexts();
    const uncallable = texts.filter((entry) => entry.value.startsWith("<function that could not"));
    expect(uncallable.map((entry) => `${entry.file} ${entry.path}`)).toEqual([]);
    expect(texts.length).toBeGreaterThan(500);
  });
});

describe("content guard: banned copy (rules 1, 2, 3, 8, 12)", () => {
  it("has no claims, brand names, social proof, wrong tone or CORVANE words in content/ and content/legal/", async () => {
    const findings = check(await contentTexts(), RULES);
    expect(findings, `Banned copy:\n${report(findings)}`).toEqual([]);
  });

  it("has no CORVANE words in the string literals of components/", () => {
    const wordRule = RULES.filter((rule) => rule.name === "CORVANE word");
    const findings = check(componentTexts(), wordRule);
    expect(findings, `CORVANE words in components:\n${report(findings)}`).toEqual([]);
  });

  it("catches what it should (self-test)", () => {
    const caught = [
      "Deze oorbellen zijn nikkelvrij.",
      "Waterproof, dus je kunt ermee zwemmen.",
      "Hypoallergeen en huidvriendelijk.",
      "Dermatologisch getest.",
      "Verkleurt nooit.",
      "Net als Mejuri, maar betaalbaar.",
      "Een dupe van een bekend merk.",
      "Geïnspireerd op Cartier.",
      "Lijkt op Hermès.",
      "Ook bij Astrid & Miyu.",
      "12 mensen bekijken dit nu",
      "Zojuist gekocht in Utrecht",
      "★★★★★",
      "Al 2.000 klanten gingen je voor",
      "500+ reviews",
      "Nu shoppen!!",
      "Groot \u2014 en goud",
      "Goud \u2013 zilver",
      "Wilt u verder winkelen?",
      "Uw bestelling is onderweg.",
      "Een frisse scent voor elke dag.",
      "Met een vleugje geur.",
    ];
    for (const sample of caught) {
      const findings = check([{ file: "content/sample.ts", path: "sample", value: sample }], RULES);
      expect(findings.length, `expected a finding for ${JSON.stringify(sample)}`).toBeGreaterThan(0);
    }
    const clean = [
      "Wat balen! We sturen je vandaag nog een nieuwe.",
      "Roestvrij staal met goudlaag",
      "Nieuw binnen en klaar om te stylen.",
      "Kies je statement, 2d 5u en 1 tot 2 werkdagen.",
      "Verkleuren de sieraden?",
      "Mix oorbellen en armbanden zoals jij wilt.",
      "Uitverkocht",
    ];
    const findings = check(clean.map((value) => ({ file: "content/sample.ts", path: "sample", value })), RULES);
    expect(findings, report(findings)).toEqual([]);
    // The nikkelvrij FAQ item and claims.ts may name the claim; the same words elsewhere may not.
    expect(check([{ file: "content/claims.ts", path: "claims[0].label", value: "Nikkelvrij" }], RULES)).toEqual([]);
    expect(
      check([{ file: "content/faq.ts", path: `faq[${nikkelvrijFaqIndex}].question`, value: "Zijn de sieraden nikkelvrij?" }], RULES),
    ).toEqual([]);
    expect(check([{ file: "content/home.ts", path: "home.hero.title", value: "Nikkelvrij goud" }], RULES).length).toBeGreaterThan(0);
  });
});

describe("content guard: claims and reviews (rules 1, 3)", () => {
  it("gives every verified claim a source", () => {
    const unsourced = claims.filter((claim) => claim.verified && !claim.source?.trim());
    expect(unsourced.map((claim) => claim.id)).toEqual([]);
  });

  it("has the nikkelvrij FAQ item that names the claim only conditionally", () => {
    expect(nikkelvrijFaqIndex).toBeGreaterThanOrEqual(0);
    expect(faq[nikkelvrijFaqIndex].claim).toBe("nikkelvrij");
    expect(faq[nikkelvrijFaqIndex].answer).toContain("Staat er");
  });

  it("only accepts real reviews: a source, a verified buyer and consent for a photo", () => {
    const invalid = (reviews as Review[]).filter(
      (review) => !review.source || review.verifiedBuyer !== true || (review.photo !== null && review.photo.consent !== true),
    );
    expect(invalid.map((review) => review.id)).toEqual([]);
  });

  it("launches without reviews while site.flags.showReviews is off (launch guard)", () => {
    if (!site.flags.showReviews) expect(reviews).toEqual([]);
  });
});

describe("content guard: badges (rule 4)", () => {
  it("switches on only Nieuw, Limited and Laatste stuks, without real sales data", () => {
    expect(site.flags.realSalesData).toBe(false);
    expect([...site.badges.enabled].sort()).toEqual(["laatste-stuks", "limited", "nieuw"]);
  });

  it("flags no local product as bestseller while realSalesData is off", () => {
    if (site.flags.realSalesData) return;
    expect(products.filter((product) => product.metafields.bestseller === true).map((p) => p.handle)).toEqual([]);
  });

  it('has no "Lindes favoriet" label anywhere (decision 78)', async () => {
    const labels = (await contentTexts()).filter((entry) => /^\s*lindes favoriet\s*$/i.test(entry.value));
    expect(labels.map((entry) => `${entry.file} ${entry.path}`)).toEqual([]);
  });
});

describe("content guard: prices (rule 5)", () => {
  it("prices every piece on ,95 between €12,95 and €29,95", () => {
    const wrong = jewelry.flatMap((product) =>
      product.variants
        .filter((variant) => variant.price % 100 !== 95 || variant.price < 1295 || variant.price > 2995)
        .map((variant) => `${product.handle} ${variant.title}: ${variant.price}`),
    );
    expect(wrong).toEqual([]);
  });

  it("never has a compare-at price without laagste_prijs_30d (brief §2.5)", () => {
    const wrong = products.flatMap((product) =>
      product.variants
        .filter((variant) => variant.compareAtPrice != null && !product.metafields.laagstePrijs30d)
        .map((variant) => `${product.handle} ${variant.title}`),
    );
    expect(wrong).toEqual([]);
  });
});

describe("content guard: timers (rule 6)", () => {
  const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?[+-]\d{2}:\d{2}$/;
  const CLOCK_CALL = /\bDate\s*\.\s*now\s*\(|\bnew\s+Date\s*\(/;

  function timeLiterals(value: unknown, path: string, out: Array<{ path: string; value: string }>): void {
    if (Array.isArray(value)) value.forEach((item, i) => timeLiterals(item, `${path}[${i}]`, out));
    else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if ((key === "startsAt" || key === "endsAt") && typeof child === "string") out.push({ path: `${path}.${key}`, value: child });
        else timeLiterals(child, `${path}.${key}`, out);
      }
    }
  }

  it("uses only ISO literals with an offset for drops, offers and the launch, written out in the source", async () => {
    const sources = [
      { file: "content/drops.ts", exports: (await import("@/content/drops")) as Module },
      { file: "content/offers.ts", exports: (await import("@/content/offers")) as Module },
    ];
    const problems: string[] = [];
    for (const { file, exports } of sources) {
      const text = readFileSync(join(appRoot, file), "utf8");
      const literals: Array<{ path: string; value: string }> = [];
      for (const [name, value] of Object.entries(exports)) timeLiterals(value, name, literals);
      expect(literals.length, file).toBeGreaterThan(0);
      for (const literal of literals) {
        if (!ISO_WITH_OFFSET.test(literal.value)) problems.push(`${file} ${literal.path}: ${literal.value} is not ISO with offset`);
        if (!text.includes(`"${literal.value}"`)) problems.push(`${file} ${literal.path}: ${literal.value} is not a literal in the source`);
      }
    }
    const siteSource = readFileSync(join(appRoot, "content/site.ts"), "utf8");
    for (const value of [site.launchAt, site.vat.switchAt]) {
      if (!ISO_WITH_OFFSET.test(value) || !siteSource.includes(`"${value}"`)) problems.push(`content/site.ts: ${value}`);
    }
    expect(problems).toEqual([]);
  });

  it("never reads the clock in the source of content/", () => {
    const offenders = contentModuleFiles.filter((file) => CLOCK_CALL.test(readFileSync(file, "utf8"))).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe("content guard: consent (rule 7)", () => {
  const CONSENT = "Ja, ik wil de nieuwsbrief van Sparkela. Ben je jonger dan 16? Vraag dan eerst toestemming aan je ouder.";

  it("has the exact consent sentence of the brief", () => {
    expect(site.consentText).toBe(CONSENT);
  });

  it("never spells the consent sentence out in components/ (only through site.consentText)", () => {
    const firstClause = "Ja, ik wil de nieuwsbrief van Sparkela";
    const offenders = componentFiles
      .filter((file) => readFileSync(file, "utf8").replace(/\s+/g, " ").includes(firstClause))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

describe("content guard: legal texts (rule 9)", () => {
  it("starts every content/legal/*.md with the review notice", () => {
    expect(legalReviewNotice).toBe("TODO: laten controleren");
    if (legalMarkdownFiles.length === 0) {
      console.warn("SKIPPED: legal (no content/legal/*.md yet; C1 writes them in wave 4-6)");
      return;
    }
    const wrong = legalMarkdownFiles
      .filter((file) => !readFileSync(file, "utf8").replace(/^\uFEFF/, "").startsWith(legalReviewNotice))
      .map(rel);
    expect(wrong).toEqual([]);
    // Once the texts exist, every page in the index has its file.
    const missing = legalPages.filter((page) => !existsSync(join(appRoot, page.file))).map((page) => page.file);
    expect(missing).toEqual([]);
  });
});

describe("content guard: GPSR (rule 10)", () => {
  const bracketed = (value: string | null | undefined) => typeof value === "string" && /^\[[^[\]]+\]$/.test(value.trim());
  const balanced = (value: string) => {
    let depth = 0;
    for (const char of value) {
      if (char === "[") depth += 1;
      if (char === "]") depth -= 1;
      if (depth < 0 || depth > 1) return false;
    }
    return depth === 0;
  };

  it("gives every piece the three GPSR fields", () => {
    const missing = jewelry.flatMap((product) =>
      (["gpsrFabrikant", "gpsrVerantwoordelijkeEu", "gpsrWaarschuwingen"] as const)
        .filter((key) => !product.metafields[key]?.trim())
        .map((key) => `${product.handle}.${key}`),
    );
    expect(missing).toEqual([]);
  });

  it("keeps placeholders in brackets and never invents a warning text", () => {
    const wrong: string[] = [];
    for (const product of products) {
      const { gpsrFabrikant, gpsrVerantwoordelijkeEu, gpsrWaarschuwingen } = product.metafields;
      for (const [key, value] of Object.entries({ gpsrFabrikant, gpsrVerantwoordelijkeEu, gpsrWaarschuwingen })) {
        if (value != null && !balanced(value)) wrong.push(`${product.handle}.${key}: unbalanced brackets`);
      }
      if (gpsrWaarschuwingen != null && !bracketed(gpsrWaarschuwingen)) {
        wrong.push(`${product.handle}.gpsrWaarschuwingen: a local warning text must be a [placeholder] (decision 100)`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe("content guard: verbatim copy (rule 11, plan §5.2)", () => {
  it("has every brief sentence exactly", () => {
    const holiday = drops.find((drop) => drop.slug === "holiday-sparkle");
    const actual = {
      taglines: site.taglines,
      consentText: site.consentText,
      withdrawalLinkLabel: site.withdrawalLinkLabel,
      vatBefore: site.vat.before,
      vatAfter: site.vat.after,
      usps: site.usps,
      clubTitle: site.club.title,
      clubCta: site.club.cta,
      hygieneRule: site.hygieneRule,
      emailCaptureTitle: site.emailCapture.title,
      emailCaptureIntro: site.emailCapture.intro,
      emailCapturePill: site.emailCapture.pillLabel,
      heroTitle: home.hero.title,
      heroSubtitle: home.hero.subtitle,
      heroPills: home.hero.pills,
      heroGuarantee: home.hero.guaranteeBadge,
      heroCtas: home.hero.ctas,
      howToStack: home.howToStack.steps.map((step) => step.title),
      statementVsSubtle: home.statementVsSubtle.title,
      favorites: [home.favorites.title, home.favorites.titleWithSales],
      photoStrip: home.photoStrip.title,
      dropBanner: holiday?.banner,
      waitlistSignup: formsCopy.waitlist.signupTitle,
      withdrawalSubmit: formsCopy.withdrawal.submit,
      lindeIntro: pagesCopy.about.lindeIntro,
      estimateToday: sharedCopy.deliveryEstimate.today,
      barToday: sharedCopy.deliveryBar.today,
      barLater: sharedCopy.deliveryBar.later("maandag"),
      remaining: sharedCopy.progress.remaining("€0,10"),
      reached: sharedCopy.progress.reached,
      stackOne: sharedCopy.progress.stackOne,
      stackTwo: sharedCopy.progress.stackTwo,
      checkout: cartCopy.checkout,
      demoNotice: pagesCopy.checkout.demoNotice,
      legalReviewNotice,
    };
    expect(actual).toEqual({
      taglines: ["Spark your outfit", "Made to spark", "Sieraden met een spark"],
      consentText: "Ja, ik wil de nieuwsbrief van Sparkela. Ben je jonger dan 16? Vraag dan eerst toestemming aan je ouder.",
      withdrawalLinkLabel: "Hier de overeenkomst herroepen",
      vatBefore: "Prijzen inclusief 21% btw",
      vatAfter: "Sparkela maakt gebruik van de kleineondernemersregeling; er wordt geen btw berekend.",
      usps: ["Gratis verzending vanaf €35", "Vóór 16.00 besteld, vandaag verstuurd", "6 maanden garantie op verkleuring"],
      clubTitle: "Als eerste bij elke drop. Plus 10% op je eerste bestelling.",
      clubCta: "Ik doe mee",
      hygieneRule: "Om hygiënische redenen kun je oorbellen alleen retourneren met ongebroken hygiënezegel.",
      emailCaptureTitle: "Kies je spark.",
      emailCaptureIntro: "Elke kaart geeft 10% op je eerste bestelling.",
      emailCapturePill: "Kies je spark",
      heroTitle: "Eén paar oorbellen. Hele outfit af.",
      heroSubtitle: "Chunky sieraden met een spark, gestyled door Linde.",
      heroPills: ["Roestvrij staal met goudlaag", "Vóór 16.00 besteld, vandaag verstuurd", "Gratis verzending vanaf €35"],
      heroGuarantee: "6 maanden garantie op verkleuring",
      heroCtas: [
        { label: "Shop oorbellen", href: "/collections/oorbellen" },
        { label: "Shop armbanden", href: "/collections/armbanden" },
      ],
      howToStack: ["Kies je statement", "Stack 3 stuks met 15% stack-korting", "Vóór 16.00 besteld, vandaag verstuurd"],
      statementVsSubtle: "Statement of subtiel?",
      favorites: ["Lindes favorieten", "Bestsellers"],
      photoStrip: "Zo dragen jullie Sparkela",
      dropBanner: { title: "Holiday Sparkle.", text: "Het extra diamantje met kerst.", cta: "Bekijk de drop" },
      waitlistSignup: "Als eerste shoppen, plus 10% op je eerste bestelling",
      withdrawalSubmit: "Herroeping bevestigen",
      lindeIntro: "Hoi, ik ben Linde. [Linde schrijft hier haar eigen verhaal.]",
      estimateToday: "Vóór 16.00 besteld, vandaag verstuurd. Meestal binnen 1 tot 2 werkdagen in je brievenbus.",
      barToday: "Vóór 16.00 besteld? Vandaag verstuurd.",
      barLater: "Nu besteld, maandag verstuurd.",
      remaining: "Nog €0,10 tot gratis verzending",
      reached: "Je verzending is gratis",
      stackOne: "Nog 1 armband of oorbel voor 15% stack-korting",
      stackTwo: "Nog 2 armbanden of oorbellen voor 15% stack-korting",
      checkout: "Afrekenen",
      demoNotice: "Demo-checkout: er wordt niet betaald",
      legalReviewNotice: "TODO: laten controleren",
    });
  });

  it("has the three Spark Finder questions of the brief (plan §5.7)", () => {
    expect(quiz.questions.map((question) => [question.title, question.options.map((option) => option.label)])).toEqual([
      ["Wat is je vibe?", ["Chunky en bold", "Clean en classy", "Kleurrijk en speels", "Retro"]],
      ["Voor welk moment?", ["Festival", "Date night", "Kantoor maar niet saai", "Strand", "Feestdagen"]],
      ["Wat zoek je?", ["Oorbellen", "Armbanden", "Kettingen", "Ringen", "Verras me"]],
    ]);
    expect(quiz.result.emailTitle).toBe("Krijg 10% op je eerste bestelling");
  });

  it("has the seven FAQ answers of the brief word for word (plan §5.6)", () => {
    const brief = [
      [
        "verkleuren",
        "Verkleuren de sieraden?",
        "De vaste collectie is van roestvrij staal met een goudlaag. Dat gaat lang mee, en je krijgt 6 maanden garantie op verkleuring. Wil je de goudlaag zo mooi mogelijk houden? Doe je sieraden af bij zwemmen, sporten en douchen en bewaar ze droog in het zakje.",
      ],
      [
        "nikkelvrij",
        "Zijn de sieraden nikkelvrij?",
        'Bij elk product staat het materiaal. Staat er "nikkelvrij", dan heeft onze leverancier dat voor dat product bevestigd.',
      ],
      [
        "levertijd",
        "Hoe snel heb ik mijn bestelling?",
        "Op werkdagen vóór 16.00 uur besteld, gaat dezelfde dag met PostNL de deur uit. Meestal ligt hij binnen 1 tot 2 werkdagen in je brievenbus.",
      ],
      ["verzendkosten", "Wat kost verzenden?", "€3,95, en gratis vanaf €35. We versturen binnen Nederland."],
      [
        "stack-korting",
        "Hoe werkt de stack-korting?",
        "Koop je 3 of meer armbanden of oorbellen, dan krijg je 15% korting op die stuks. Je ziet het meteen in je winkelwagen.",
      ],
      [
        "retourneren",
        "Kan ik retourneren?",
        'Ja, binnen 14 dagen. Oorbellen en piercings kun je om hygiënische redenen alleen retourneren met ongebroken hygiënezegel. Herroepen kan via "Hier de overeenkomst herroepen" onderaan elke pagina.',
      ],
      ["cadeaukaart", "Kan ik een cadeaukaart kopen?", "Ja, digitaal voor €15, €25 of €50. Hij komt direct in je mail."],
    ];
    expect(faq.slice(0, brief.length).map((item) => [item.id, item.question, item.answer])).toEqual(brief);
  });
});

describe("content guard: reference text (rule 12, brief §10)", () => {
  it("shares no run of 5 words with CORVANE's content or the captured reference labels", async () => {
    // lashthing.nl was never captured (REFERENCE §1.1): there is no text to compare against yet (plan §22 point 15).
    console.warn("SKIPPED: lashthing (no capture of lashthing.nl)");
    const sets = [corvaneReference(), structureReference()].filter((set): set is ReferenceSet => set !== null);
    if (sets.length === 0) return;
    const ours = [...(await contentTexts()), ...componentTexts()];
    const findings = overlapFindings(ours, sets);
    expect(findings, `Overlap with reference text:\n${report(findings)}`).toEqual([]);
  });

  it("detects an overlap (self-test)", () => {
    const content = referenceSet("sample content", ["Turn a card for ten percent off your first order", "TODO: laten controleren"]);
    const labels = referenceSet("sample labels", ["Your cart is empty"], true);
    const hit = (value: string) =>
      overlapFindings([{ file: "content/sample.ts", path: "sample", value }], [content, labels]).length > 0;
    expect(hit("Just turn a card, for ten percent off!")).toBe(true);
    expect(hit("Oops: your cart is empty.")).toBe(true);
    expect(hit("Kies je spark en krijg 10% op je eerste bestelling")).toBe(false);
    expect(hit("TODO: laten controleren")).toBe(false);
  });
});

describe("content guard: spec line per material (rule 13, decision 115)", () => {
  it("never puts a plating word in the spec line of a piece that also comes in Zilver", () => {
    const wrong = products
      .filter((product) => product.variants.some((variant) => variant.selectedOptions.some((option) => option.value === "Zilver")))
      .filter((product) => /verguld|goudlaag/i.test(product.metafields.specRegel ?? ""))
      .map((product) => `${product.handle}: ${product.metafields.specRegel}`);
    expect(wrong).toEqual([]);
  });
});
