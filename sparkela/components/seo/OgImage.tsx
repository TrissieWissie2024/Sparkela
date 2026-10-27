import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import type { ReactElement } from "react";

import { brandColor } from "@/lib/brand-colors";
import { OG_IMAGE_SIZE } from "@/lib/seo";
import { LOGO_BOX, LOGO_VIEWBOX, SPARK_PATH, SPARK_TRANSFORM, SPARK_VIEWBOX, WORDMARK_PATH } from "@/components/brand/logo-paths";

/**
 * Open Graph images (docs/PLAN.md §13.14, §17.3, brief §7), drawn with next/og (Satori: flexbox only, no grid) at
 * 1200 × 630:
 * - "merk": app/opengraph-image.tsx, the default for every page without an image of its own. Logo, the hero line,
 *   the subline and two promise pills on --donker, with a large roest spark.
 * - "product": app/products/[handle]/opengraph-image.tsx. Logo, type, name and spec line on --donker; the packshot
 *   in a 4:5 panel on the right (504 × 630), or a roest panel with a spark when there is no usable photo.
 * - "drop": app/drops/[slug]/opengraph-image.tsx. Logo, "Limited", name and tagline on --roest. Never a photo.
 *
 * Photos: only JPEG or PNG ever reaches Satori (decisions 113 and 131). Satori silently turns a WebP into a fully
 * transparent area, so the product route fetches its photo through loadOgPhoto(): ogPhotoUrl() only accepts originals
 * ending in .jpg, .jpeg or .png and asks Shopify's CDN for `width=1200&format=jpg`; the downloaded bytes must then be
 * JPEG or PNG by their signature, and they go to Satori as a data URI. Anything else gives null: an OG without photo.
 * Site images (.webp in public/images) never appear in an OG.
 *
 * Fonts (SIL Open Font License, licence files next to them): Unbounded ExtraBold (800) and Inter Regular and SemiBold,
 * latin subset, as WOFF in assets/fonts (copied from @fontsource; Satori cannot read WOFF2). The logo is the SVG path
 * from components/brand/logo-paths.ts as a data URI (no <text>), and colours come from lib/brand-colors.ts.
 * Pure drawing plus file and network reads: no copy of its own, every string comes in through the props.
 */

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

const C = {
  donker: brandColor("donker"),
  botWit: brandColor("bot-wit"),
  tekst2OpDonker: brandColor("tekst-2-op-donker"),
  randOpDonker: brandColor("rand-op-donker"),
  roest: brandColor("roest"),
  roest800: brandColor("roest-800"),
  roest600: brandColor("roest-600"),
} as const;

const WIDTH = OG_IMAGE_SIZE.width;
const HEIGHT = OG_IMAGE_SIZE.height;

/** The photo panel of the product image: exactly 4:5 at full height (630 × 4 / 5). */
export const OG_PHOTO_PANEL = { width: 504, height: HEIGHT } as const;

/** Width Shopify's CDN is asked for (plan §17.3). */
export const OG_PHOTO_WIDTH = 1200;

/* -------------------------------------------------------------------------- */
/* Fonts                                                                       */
/* -------------------------------------------------------------------------- */

type OgFont = { name: "Unbounded" | "Inter"; data: Buffer; weight: 400 | 600 | 800; style: "normal" };

let fontsPromise: Promise<OgFont[]> | null = null;

/**
 * Reads the three WOFF files once per process. Static path strings, so the output file tracing ships them with the
 * route (a revalidated OG renders again at runtime). Local files only: a fetch() would be uncached I/O.
 */
export function loadOgFonts(): Promise<OgFont[]> {
  fontsPromise ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Unbounded-ExtraBold.woff")),
    readFile(join(process.cwd(), "assets/fonts/Inter-Regular.woff")),
    readFile(join(process.cwd(), "assets/fonts/Inter-SemiBold.woff")),
  ]).then(([unbounded, inter, interSemiBold]): OgFont[] => [
    { name: "Unbounded", data: unbounded, weight: 800, style: "normal" },
    { name: "Inter", data: inter, weight: 400, style: "normal" },
    { name: "Inter", data: interSemiBold, weight: 600, style: "normal" },
  ]);
  return fontsPromise;
}

/* -------------------------------------------------------------------------- */
/* Photos                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The URL to fetch a product photo for an OG, or null (plan §17.3, decision 131): only an absolute http(s) URL whose
 * path ends in .jpg, .jpeg or .png (case ignored, query ignored). Shopify converts those to JPEG; a WebP original
 * stays WebP and would render transparent, so it gives null. Keeps other parameters (such as v=) and sets
 * width=1200 and format=jpg.
 */
export function ogPhotoUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!/\.(?:jpe?g|png)$/i.test(parsed.pathname)) return null;
  parsed.searchParams.set("width", String(OG_PHOTO_WIDTH));
  parsed.searchParams.set("format", "jpg");
  return parsed.toString();
}

/** "image/jpeg" or "image/png" by the file signature, else null (WebP, AVIF, HTML error pages, empty bodies). */
export function sniffOgPhoto(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((byte, index) => bytes[index] === byte)) return "image/png";
  return null;
}

/** How long the build waits for one photo before it renders the OG without it. */
const PHOTO_TIMEOUT_MS = 8000;

/**
 * Downloads the photo for a product OG and returns it as a data URI, or null when there is no usable photo: no URL,
 * not a JPEG or PNG original (ogPhotoUrl), a failed or slow request, or bytes that are not JPEG or PNG. Never throws,
 * so a photo problem never breaks the build; the OG is then drawn without a photo.
 */
export async function loadOgPhoto(url: string | null | undefined, fetcher: typeof fetch = fetch): Promise<string | null> {
  const source = url ? ogPhotoUrl(url) : null;
  if (!source) return null;
  try {
    const response = await fetcher(source, { signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS) });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = sniffOgPhoto(bytes);
    if (!type) return null;
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

/** Only a JPEG or PNG data URI (from loadOgPhoto) or an ogPhotoUrl() result may be drawn. */
function isEmbeddablePhoto(url: string): boolean {
  if (/^data:image\/(?:jpeg|png);base64,/.test(url)) return true;
  try {
    return new URL(url).searchParams.get("format") === "jpg";
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Fitting the display type                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Advance widths of Unbounded ExtraBold (assets/fonts/Unbounded-ExtraBold.woff) in units of 1/1000 em, for the
 * characters titles use. tests/unit/og.test.ts checks this table against the font file. Accented letters use their
 * base letter (same advance in Unbounded); anything else counts as UNKNOWN_ADVANCE, on the wide side.
 */
const ADVANCE: Readonly<Record<string, number>> = {
  a: 839, b: 824, c: 774, d: 842, e: 742, f: 606, g: 825, h: 793, i: 334, j: 334, k: 763, l: 334, m: 1226,
  n: 805, o: 801, p: 824, q: 824, r: 569, s: 767, t: 619, u: 792, v: 788, w: 1154, x: 743, y: 797, z: 708,
  A: 977, B: 895, C: 942, D: 936, E: 803, F: 781, G: 970, H: 947, I: 362, J: 815, K: 882, L: 772, M: 1255,
  N: 983, O: 970, P: 825, Q: 971, R: 863, S: 857, T: 829, U: 884, V: 951, W: 1375, X: 896, Y: 940, Z: 819,
  "0": 935, "1": 536, "2": 850, "3": 850, "4": 880, "5": 817, "6": 867, "7": 769, "8": 905, "9": 867,
  " ": 242, ".": 314, ",": 316, ":": 339, "!": 338, "?": 722, "'": 291, "’": 310, "&": 961, "-": 377,
  "(": 410, ")": 410, "%": 1321, "€": 878, "/": 472,
};
const UNKNOWN_ADVANCE = 900;

/** Letter spacing of the display type, as in the kop-* utilities: -0.01em. */
const DISPLAY_TRACKING = -0.01;

/** Width of a string in em of Unbounded ExtraBold, tracking included. */
export function displayWidthEm(text: string): number {
  const base = text.normalize("NFD").replace(/[̀-ͯ]/g, "");
  let units = 0;
  for (const char of base) units += ADVANCE[char] ?? UNKNOWN_ADVANCE;
  return units / 1000 + DISPLAY_TRACKING * Math.max(0, [...base].length - 1);
}

/** Number of lines greedy wrapping needs for `text` at `size` px in a box `width` px wide; Infinity if a word overflows. */
function linesAt(text: string, size: number, width: number): number {
  const space = displayWidthEm(" ") * size;
  let lines = 1;
  let line = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const wordWidth = displayWidthEm(word) * size;
    if (wordWidth > width) return Infinity;
    if (line === 0) line = wordWidth;
    else if (line + space + wordWidth <= width) line += space + wordWidth;
    else {
      lines += 1;
      line = wordWidth;
    }
  }
  return lines;
}

/**
 * The largest font size (from `max` down to `min`, in steps of 2 px) at which `text` fits `width` in at most `maxLines`
 * lines, with no single word wider than the box. A 4% margin covers the difference with Satori's own line breaking.
 * Long Dutch compounds ("schakelketting") would otherwise run out of the image.
 */
export function fitDisplaySize(text: string | readonly string[], width: number, maxLines: number, max: number, min: number): number {
  const blocks = typeof text === "string" ? [text] : text;
  const box = width * 0.96;
  for (let size = max; size > min; size -= 2) {
    if (blocks.reduce((lines, block) => lines + linesAt(block, size, box), 0) <= maxLines) return size;
  }
  return min;
}

/** "Eén paar oorbellen. Hele outfit af." → ["Eén paar oorbellen.", "Hele outfit af."]: every sentence starts a line. */
export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/* Drawing helpers                                                             */
/* -------------------------------------------------------------------------- */

function svgUri(viewBox: string, body: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** The wordmark with its spark (brief §3: word and spark in their own colours; the spark is never sheared). */
function Logo({ width, word, spark }: { width: number; word: string; spark: string }) {
  const height = Math.round((width * LOGO_BOX.height) / LOGO_BOX.width);
  const src = svgUri(
    LOGO_VIEWBOX,
    `<path fill="${word}" d="${WORDMARK_PATH}"/><path fill="${spark}" d="${SPARK_PATH}" transform="${SPARK_TRANSFORM}"/>`,
  );
  // eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image.
  return <img src={src} width={width} height={height} alt="" />;
}

/** The four-point spark on its own, upright (decoration). */
function Spark({ size, color, style }: { size: number; color: string; style?: Record<string, string | number> }) {
  // eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image.
  return <img src={svgUri(SPARK_VIEWBOX, `<path fill="${color}" d="${SPARK_PATH}"/>`)} width={size} height={size} alt="" style={style} />;
}

function Eyebrow({ children, color }: { children: string; color: string }) {
  return (
    <div style={{ display: "flex", fontFamily: "Inter", fontWeight: 600, fontSize: 20, letterSpacing: 2.4, textTransform: "uppercase", color }}>
      {children}
    </div>
  );
}

function Pill({ children, border, color }: { children: string; border: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 52,
        padding: "0 24px",
        borderRadius: 999,
        border: `2px solid ${border}`,
        fontFamily: "Inter",
        fontWeight: 600,
        fontSize: 21,
        color,
      }}
    >
      {children}
    </div>
  );
}

interface DisplayTitleProps {
  text: string;
  width: number;
  maxLines: number;
  max: number;
  min: number;
  color: string;
  /** Start every sentence on its own line (the two-sentence hero line). */
  breakSentences?: boolean;
}

/** The display line in Unbounded ExtraBold, at the largest size that fits (fitDisplaySize). */
function DisplayTitle({ text, width, maxLines, max, min, color, breakSentences = false }: DisplayTitleProps) {
  const blocks = breakSentences ? splitSentences(text) : [text];
  const size = fitDisplaySize(blocks, width, maxLines, max, min);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        fontFamily: "Unbounded",
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.1,
        letterSpacing: DISPLAY_TRACKING * size,
        color,
      }}
    >
      {blocks.map((block) => (
        <div key={block} style={{ display: "flex" }}>
          {block}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The image                                                                   */
/* -------------------------------------------------------------------------- */

export type OgImageKind = "merk" | "product" | "drop";

export interface OgImageProps {
  kind: OgImageKind;
  /** The display line: the hero line, the product name or the drop name. */
  title: string;
  /** One supporting line: the subline, the spec line or the drop tagline. */
  subtitle?: string;
  /** Product photo: a JPEG or PNG data URI from loadOgPhoto() (or an ogPhotoUrl() URL). Ignored for "merk" and "drop". */
  imageUrl?: string;
  /** Small caps line above the title: the product type, "Limited". */
  eyebrow?: string;
  /** Short promises as pills ("merk") or one quiet line at the bottom ("product", "drop"). */
  notes?: readonly string[];
}

const PAD_X = 72;
const PAD_Y = 64;

function BrandImage({ title, subtitle, notes = [] }: OgImageProps) {
  const textWidth = 720;
  return (
    <div style={{ width: WIDTH, height: HEIGHT, display: "flex", position: "relative", backgroundColor: C.donker, color: C.botWit }}>
      <Spark size={420} color={C.roest} style={{ position: "absolute", right: 40, top: 105 }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: WIDTH, padding: `${PAD_Y}px ${PAD_X}px` }}>
        <Logo width={250} word={C.botWit} spark={C.roest} />
        <div style={{ display: "flex", flexDirection: "column", width: textWidth }}>
          <DisplayTitle text={title} width={textWidth} maxLines={3} max={74} min={44} color={C.botWit} breakSentences />
          {subtitle ? (
            <div style={{ display: "flex", marginTop: 24, maxWidth: 640, fontFamily: "Inter", fontSize: 29, lineHeight: 1.35, color: C.tekst2OpDonker, textWrap: "balance" }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {notes.slice(0, 2).map((note) => (
            <Pill key={note} border={C.randOpDonker} color={C.botWit}>
              {note}
            </Pill>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductImage({ title, subtitle, eyebrow, imageUrl, notes = [] }: OgImageProps) {
  const panel = OG_PHOTO_PANEL;
  const columnWidth = WIDTH - panel.width;
  const textWidth = columnWidth - PAD_X - 56;
  const photo = imageUrl && isEmbeddablePhoto(imageUrl) ? imageUrl : null;
  return (
    <div style={{ width: WIDTH, height: HEIGHT, display: "flex", backgroundColor: C.donker, color: C.botWit }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: columnWidth,
          padding: `${PAD_Y}px 56px ${PAD_Y - 4}px ${PAD_X}px`,
        }}
      >
        <Logo width={200} word={C.botWit} spark={C.roest} />
        <div style={{ display: "flex", flexDirection: "column", width: textWidth }}>
          {eyebrow ? <Eyebrow color={C.tekst2OpDonker}>{eyebrow}</Eyebrow> : null}
          <div style={{ display: "flex", marginTop: eyebrow ? 20 : 0 }}>
            <DisplayTitle text={title} width={textWidth} maxLines={3} max={66} min={36} color={C.botWit} />
          </div>
          {subtitle ? (
            <div style={{ display: "flex", marginTop: 22, fontFamily: "Inter", fontSize: 27, lineHeight: 1.35, color: C.tekst2OpDonker, textWrap: "balance" }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", minHeight: 28, fontFamily: "Inter", fontWeight: 600, fontSize: 21, color: C.botWit }}>
          {notes[0] ?? ""}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          width: panel.width,
          height: panel.height,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: C.roest,
          overflow: "hidden",
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image.
          <img src={photo} width={panel.width} height={panel.height} alt="" style={{ objectFit: "cover" }} />
        ) : (
          <Spark size={190} color={C.botWit} />
        )}
      </div>
    </div>
  );
}

function DropImage({ title, subtitle, eyebrow, notes = [] }: OgImageProps) {
  // Narrower than the free space, so even a long name stays clear of the large spark.
  const textWidth = 640;
  return (
    <div style={{ width: WIDTH, height: HEIGHT, display: "flex", position: "relative", backgroundColor: C.roest, color: C.botWit }}>
      <Spark size={400} color={C.roest800} style={{ position: "absolute", right: 64, top: 115 }} />
      <Spark size={120} color={C.roest600} style={{ position: "absolute", right: 380, top: 70 }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: WIDTH, padding: `${PAD_Y}px ${PAD_X}px` }}>
        <Logo width={250} word={C.botWit} spark={C.botWit} />
        <div style={{ display: "flex", flexDirection: "column", width: textWidth }}>
          {eyebrow ? (
            <div style={{ display: "flex" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: 44,
                  padding: "0 20px",
                  borderRadius: 999,
                  border: `2px solid ${C.botWit}`,
                  fontFamily: "Inter",
                  fontWeight: 600,
                  fontSize: 19,
                  letterSpacing: 2.2,
                  textTransform: "uppercase",
                  color: C.botWit,
                }}
              >
                {eyebrow}
              </div>
            </div>
          ) : null}
          <div style={{ display: "flex", marginTop: eyebrow ? 26 : 0 }}>
            <DisplayTitle text={title} width={textWidth} maxLines={2} max={92} min={48} color={C.botWit} />
          </div>
          {subtitle ? (
            <div style={{ display: "flex", marginTop: 22, maxWidth: 620, fontFamily: "Inter", fontSize: 31, lineHeight: 1.35, color: C.botWit, textWrap: "balance" }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", minHeight: 28, fontFamily: "Inter", fontWeight: 600, fontSize: 21, color: C.botWit }}>
          {notes[0] ?? ""}
        </div>
      </div>
    </div>
  );
}

/** The 1200 × 630 drawing for Satori. Synchronous; data comes in as props. */
export function OgImage(props: OgImageProps): ReactElement {
  switch (props.kind) {
    case "merk":
      return <BrandImage {...props} />;
    case "product":
      return <ProductImage {...props} />;
    case "drop":
      return <DropImage {...props} />;
  }
}

/**
 * Renders an OG image to PNG bytes. The routes call this inside a 'use cache' function with cacheLife("max") and
 * wrap the bytes in a Response (CORVANE D53.2): the build can then prerender them.
 */
export async function renderOgImage(props: OgImageProps): Promise<Uint8Array> {
  const response = new ImageResponse(<OgImage {...props} />, { ...OG_IMAGE_SIZE, fonts: await loadOgFonts() });
  return new Uint8Array(await response.arrayBuffer());
}
