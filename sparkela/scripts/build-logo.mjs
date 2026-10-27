#!/usr/bin/env node
/**
 * Builds the Sparkela logo files (`npm run logo`, docs/PLAN.md §13.1, brief §3).
 *
 * The wordmark is "SPARKELA" in Unbounded Black (900), outlined to paths with opentype.js, so the logo never depends
 * on a loaded font. Construction, as in Sparkela_Logo_Eindconcept.pdf:
 *
 * - Capitals with letter-spacing −0.03em (−0.03 × unitsPerEm after every letter) plus the font's own kerning (GPOS
 *   pair adjustments, read below; opentype.js 2 skips GPOS extension lookups). This reproduces the letter positions
 *   in the PDF to the unit.
 * - The whole word is sheared horizontally by −10° (`skewX(-10deg)`, x' = x − tan(10°)·y with y pointing down,
 *   around the baseline). The shear is applied to the path coordinates themselves: no transform in any output.
 * - The upright four-point spark (brief path in a 100 × 100 box) is half the cap height and is never sheared. It sits
 *   at the top-right corner of the last A: the bottom-left corner of its box lies 0.095 cap heights right of and
 *   0.039 cap heights below the right end of the A's flat apex, which is where the PDF puts it (measured from the
 *   vector data). Its left point and bottom point sit just beside the A's corner; its body stays clear of the letter.
 * - Monogram: the sheared S alone with a smaller spark (0.385 × the height of the S) at its top-right, again as
 *   measured in the PDF (avatar, app icon, stamp). In the icon tile the S is centred and 0.41 of the tile high.
 *
 * Units: the cap height is 100. Coordinates are rounded to 0.1 (0.1% of the cap height).
 *
 * Writes:
 * - components/brand/logo-paths.ts (path data and geometry for Logo, Monogram, Spark and LogoDefs)
 * - public/brand/*.svg (standalone colour versions), public/brand/icon-{192,512}.png, icon-maskable-512.png
 * - app/icon.svg, app/apple-icon.png, app/favicon.ico (16, 32 and 48 px PNGs in an ICO container)
 *
 * Colours are read from lib/brand-colors.ts (one entry per line), so this script has no colour values of its own.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

import opentype from "opentype.js";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONT_FILE = "node_modules/@fontsource/unbounded/files/unbounded-latin-900-normal.woff";

const WORD = "SPARKELA";
const BRAND_NAME = "Sparkela";
/** CSS letter-spacing of the wordmark, in em (brief §3). */
const TRACKING_EM = -0.03;
/** Horizontal shear of the wordmark and the monogram S, in degrees (brief §3: −10°, never rotated). */
const SHEAR_DEG = 10;
/** Output scale: the cap height in path units. */
const CAP = 100;
/** Coordinates are rounded to this many decimals. */
const DECIMALS = 1;

/** The spark of brief §3, in a 100 × 100 box: points at (50,0), (100,50), (50,100) and (0,50). */
const SPARK_PATH = "M50 0 C53 35 65 47 100 50 C65 53 53 65 50 100 C47 65 35 53 0 50 C35 47 47 35 50 0 Z";
const SPARK_BOX = 100;

/** Wordmark spark: half the cap height (brief §3). */
const SPARK_SIZE = CAP / 2;
/** Offset of the spark box's bottom-left corner from the top-right corner of the last A's apex, in cap heights (PDF). */
const SPARK_OFFSET = { x: 0.095, y: 0.039 };

/** Monogram spark, relative to the ink height of the S (PDF, section 05). */
const MONOGRAM_SPARK = { size: 0.385, x: -0.06, y: 0.125 };
/** Ink height of the S as a share of the icon tile (PDF app icon), and the corner radius of the tile. */
const TILE_S_RATIO = 0.41;
const TILE_RADIUS_RATIO = 0.2;
/**
 * Browser icons (app/icon.svg, app/favicon.ico) are seen at 16 to 32 px: there the mark is 1.25 times the tile size
 * above (the S about half the tile), with S and spark centred together, so the S stays legible in a browser tab.
 */
const FAVICON_SCALE = 1.25;
/** Maskable icons: everything inside the circle of 40% radius (the 80% safe zone), with a little air. */
const MASKABLE_SAFE_RADIUS = 0.4 * 0.94;

/* -------------------------------------------------------------------------- */
/* Colours from lib/brand-colors.ts                                            */
/* -------------------------------------------------------------------------- */

function readBrandColors() {
  const source = readFileSync(path.join(ROOT, "lib/brand-colors.ts"), "utf8");
  const colors = {};
  for (const match of source.matchAll(/^\s*"?([a-z0-9-]+)"?:\s*"(#[0-9A-Fa-f]{6})",?\s*$/gm)) {
    colors[match[1]] = match[2].toUpperCase();
  }
  for (const token of ["inkt", "bot-wit", "roest", "olijf", "leisteen", "steen"]) {
    if (!colors[token]) throw new Error(`lib/brand-colors.ts: no value found for "${token}".`);
  }
  return colors;
}

/* -------------------------------------------------------------------------- */
/* Font: WOFF tables and GPOS pair kerning                                     */
/* -------------------------------------------------------------------------- */

/** Raw sfnt tables of a WOFF (zlib per table) or a plain TTF/OTF file. */
function readSfntTables(buffer) {
  const tables = new Map();
  const signature = buffer.toString("latin1", 0, 4);
  if (signature === "wOFF") {
    const numTables = buffer.readUInt16BE(12);
    for (let i = 0; i < numTables; i += 1) {
      const entry = 44 + i * 20;
      const tag = buffer.toString("latin1", entry, entry + 4);
      const offset = buffer.readUInt32BE(entry + 4);
      const compLength = buffer.readUInt32BE(entry + 8);
      const origLength = buffer.readUInt32BE(entry + 12);
      const raw = buffer.subarray(offset, offset + compLength);
      tables.set(tag, compLength < origLength ? inflateSync(raw) : Buffer.from(raw));
    }
    return tables;
  }
  if (signature === "wOF2") throw new Error("WOFF2 is not supported; use the .woff file.");
  const numTables = buffer.readUInt16BE(4);
  for (let i = 0; i < numTables; i += 1) {
    const entry = 12 + i * 16;
    const tag = buffer.toString("latin1", entry, entry + 4);
    const offset = buffer.readUInt32BE(entry + 8);
    const length = buffer.readUInt32BE(entry + 12);
    tables.set(tag, Buffer.from(buffer.subarray(offset, offset + length)));
  }
  return tables;
}

function coverageIndex(table, offset, glyph) {
  const format = table.readUInt16BE(offset);
  if (format === 1) {
    const count = table.readUInt16BE(offset + 2);
    for (let i = 0; i < count; i += 1) if (table.readUInt16BE(offset + 4 + i * 2) === glyph) return i;
    return -1;
  }
  if (format === 2) {
    const count = table.readUInt16BE(offset + 2);
    for (let i = 0; i < count; i += 1) {
      const record = offset + 4 + i * 6;
      const start = table.readUInt16BE(record);
      const end = table.readUInt16BE(record + 2);
      if (glyph >= start && glyph <= end) return table.readUInt16BE(record + 4) + glyph - start;
    }
    return -1;
  }
  throw new Error(`GPOS: unknown coverage format ${format}.`);
}

function glyphClass(table, offset, glyph) {
  const format = table.readUInt16BE(offset);
  if (format === 1) {
    const start = table.readUInt16BE(offset + 2);
    const count = table.readUInt16BE(offset + 4);
    return glyph >= start && glyph < start + count ? table.readUInt16BE(offset + 6 + (glyph - start) * 2) : 0;
  }
  if (format === 2) {
    const count = table.readUInt16BE(offset + 2);
    for (let i = 0; i < count; i += 1) {
      const record = offset + 4 + i * 6;
      if (glyph >= table.readUInt16BE(record) && glyph <= table.readUInt16BE(record + 2)) {
        return table.readUInt16BE(record + 4);
      }
    }
    return 0;
  }
  throw new Error(`GPOS: unknown class definition format ${format}.`);
}

const VALUE_FIELDS = ["xPlacement", "yPlacement", "xAdvance", "yAdvance", "xPlaDevice", "yPlaDevice", "xAdvDevice", "yAdvDevice"];

function valueRecordSize(format) {
  let size = 0;
  for (let bit = 0; bit < 8; bit += 1) if (format & (1 << bit)) size += 2;
  return size;
}

function readValueRecord(table, offset, format) {
  const record = {};
  let cursor = offset;
  VALUE_FIELDS.forEach((field, bit) => {
    if (format & (1 << bit)) {
      record[field] = bit < 4 ? table.readInt16BE(cursor) : 0;
      cursor += 2;
    }
  });
  return record;
}

/** Pair adjustment of one PairPos subtable, or null when the subtable does not apply to this pair. */
function pairAdjustment(table, offset, left, right) {
  const format = table.readUInt16BE(offset);
  const coverage = coverageIndex(table, offset + table.readUInt16BE(offset + 2), left);
  if (coverage < 0) return null;
  const format1 = table.readUInt16BE(offset + 4);
  const format2 = table.readUInt16BE(offset + 6);
  const size1 = valueRecordSize(format1);
  const size2 = valueRecordSize(format2);
  if (format === 1) {
    const pairSet = offset + table.readUInt16BE(offset + 10 + coverage * 2);
    const count = table.readUInt16BE(pairSet);
    for (let i = 0; i < count; i += 1) {
      const record = pairSet + 2 + i * (2 + size1 + size2);
      if (table.readUInt16BE(record) === right) {
        return { first: readValueRecord(table, record + 2, format1), second: readValueRecord(table, record + 2 + size1, format2) };
      }
    }
    return null;
  }
  if (format === 2) {
    const class1 = glyphClass(table, offset + table.readUInt16BE(offset + 8), left);
    const class2 = glyphClass(table, offset + table.readUInt16BE(offset + 10), right);
    const class2Count = table.readUInt16BE(offset + 14);
    const record = offset + 16 + (class1 * class2Count + class2) * (size1 + size2);
    return { first: readValueRecord(table, record, format1), second: readValueRecord(table, record + size1, format2) };
  }
  throw new Error(`GPOS: unknown PairPos format ${format}.`);
}

/**
 * The font's horizontal pair kerning (GPOS feature "kern", lookup type 2, also inside type 9 extensions), as the
 * browser applies it by default. Returns (leftGlyphIndex, rightGlyphIndex) => advance adjustment in font units.
 */
function readPairKerning(tables) {
  const gpos = tables.get("GPOS");
  if (!gpos) return () => 0;
  const featureList = gpos.readUInt16BE(6);
  const lookupList = gpos.readUInt16BE(8);
  const lookupIndexes = new Set();
  const featureCount = gpos.readUInt16BE(featureList);
  for (let i = 0; i < featureCount; i += 1) {
    const record = featureList + 2 + i * 6;
    if (gpos.toString("latin1", record, record + 4) !== "kern") continue;
    const feature = featureList + gpos.readUInt16BE(record + 4);
    const count = gpos.readUInt16BE(feature + 2);
    for (let j = 0; j < count; j += 1) lookupIndexes.add(gpos.readUInt16BE(feature + 4 + j * 2));
  }
  const subtables = [];
  for (const index of [...lookupIndexes].sort((a, b) => a - b)) {
    const lookup = lookupList + gpos.readUInt16BE(lookupList + 2 + index * 2);
    const type = gpos.readUInt16BE(lookup);
    const count = gpos.readUInt16BE(lookup + 4);
    const lookupSubtables = [];
    for (let j = 0; j < count; j += 1) {
      let subtable = lookup + gpos.readUInt16BE(lookup + 6 + j * 2);
      let subtableType = type;
      if (type === 9) {
        subtableType = gpos.readUInt16BE(subtable + 2);
        subtable += gpos.readUInt32BE(subtable + 4);
      }
      if (subtableType === 2) lookupSubtables.push(subtable);
    }
    subtables.push(lookupSubtables);
  }
  return (left, right) => {
    let total = 0;
    for (const lookupSubtables of subtables) {
      for (const subtable of lookupSubtables) {
        const adjustment = pairAdjustment(gpos, subtable, left, right);
        if (adjustment === null) continue;
        if (adjustment.first.xPlacement || adjustment.second.xPlacement || adjustment.second.xAdvance) {
          throw new Error("GPOS: pair placement adjustments are not supported by this script.");
        }
        total += adjustment.first.xAdvance ?? 0;
        break; // The first subtable that covers the pair applies (OpenType).
      }
    }
    return total;
  };
}

/* -------------------------------------------------------------------------- */
/* Geometry                                                                    */
/* -------------------------------------------------------------------------- */

const SHEAR = Math.tan((SHEAR_DEG * Math.PI) / 180);
const POINT_KEYS = [
  ["x", "y"],
  ["x1", "y1"],
  ["x2", "y2"],
];

/** Applies (x, y) => [x', y'] to every point of a command list (affine maps keep Béziers exact). */
function mapCommands(commands, map) {
  return commands.map((command) => {
    const next = { ...command };
    for (const [kx, ky] of POINT_KEYS) {
      if (next[kx] === undefined) continue;
      [next[kx], next[ky]] = map(next[kx], next[ky]);
    }
    return next;
  });
}

/** skewX(−10deg) around the baseline (y = 0, y down): the top of a letter leans to the right. */
function shear(commands) {
  return mapCommands(commands, (x, y) => [x - SHEAR * y, y]);
}

function bounds(commands) {
  const p = new opentype.Path();
  p.extend(commands);
  const box = p.getBoundingBox();
  return { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2, width: box.x2 - box.x1, height: box.y2 - box.y1 };
}

function round(value, decimals = DECIMALS) {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function num(value, decimals = DECIMALS) {
  return String(round(value, decimals));
}

/**
 * Compact absolute path data. Every contour is closed with Z (opentype.js leaves TrueType contours open), a final line
 * back to the contour's start is left to Z, and zero-length lines (opentype.js leaves some after a moveTo) are dropped.
 */
function toPathData(commands) {
  const pair = (x, y) => `${num(x)} ${num(y)}`;
  const same = (a, b) => a !== null && b !== null && a[0] === b[0] && a[1] === b[1];
  const contours = [];
  let contour = null;
  for (const command of commands) {
    if (command.type === "M") {
      contour = { start: [round(command.x), round(command.y)], segments: [] };
      contours.push(contour);
      continue;
    }
    if (command.type === "Z") {
      contour = null;
      continue;
    }
    if (!contour) throw new Error(`Path command ${command.type} without a moveTo.`);
    const end = [round(command.x), round(command.y)];
    const current = contour.segments.at(-1)?.end ?? contour.start;
    if (command.type === "L") {
      if (!same(end, current)) contour.segments.push({ end, d: `L${pair(command.x, command.y)}`, line: true });
    } else if (command.type === "Q") {
      contour.segments.push({ end, d: `Q${pair(command.x1, command.y1)} ${pair(command.x, command.y)}`, line: false });
    } else if (command.type === "C") {
      contour.segments.push({
        end,
        d: `C${pair(command.x1, command.y1)} ${pair(command.x2, command.y2)} ${pair(command.x, command.y)}`,
        line: false,
      });
    } else {
      throw new Error(`Unknown path command ${command.type}.`);
    }
  }
  return contours
    .filter((c) => c.segments.length > 0)
    .map((c) => {
      const segments = [...c.segments];
      const last = segments.at(-1);
      if (last && last.line && same(last.end, c.start)) segments.pop();
      return `M${num(c.start[0])} ${num(c.start[1])}${segments.map((segment) => segment.d).join("")}Z`;
    })
    .join("");
}

function transformString({ x, y, scale }) {
  return `translate(${num(x, 2)} ${num(y, 2)}) scale(${num(scale, 4)})`;
}

function viewBox({ x, y, width, height }) {
  return `${num(x, 2)} ${num(y, 2)} ${num(width, 2)} ${num(height, 2)}`;
}

function buildGeometry(font, kerning) {
  const scale = CAP / font.tables.os2.sCapHeight;
  const tracking = TRACKING_EM * font.unitsPerEm;

  // 1. Lay out the word in font units (y down, baseline 0), shear it, then scale to CAP.
  let penX = 0;
  let previous = null;
  const letters = [];
  for (const char of WORD) {
    const glyph = font.charToGlyph(char);
    if (!glyph || glyph.index === 0) throw new Error(`The font has no glyph for "${char}".`);
    if (previous) penX += kerning(previous.index, glyph.index);
    const outline = glyph.getPath(penX, 0, font.unitsPerEm).commands;
    letters.push({ char, commands: mapCommands(shear(outline), (x, y) => [x * scale, y * scale]) });
    penX += glyph.advanceWidth + tracking;
    previous = glyph;
  }
  const wordCommands = letters.flatMap((letter) => letter.commands);

  // 2. The spark at the right end of the last A's flat apex.
  const lastA = letters.at(-1);
  if (lastA.char !== "A") throw new Error("The wordmark must end in an A.");
  const points = lastA.commands.filter((command) => command.y !== undefined);
  const apexY = Math.min(...points.map((command) => command.y));
  const apexX = Math.max(...points.filter((command) => Math.abs(command.y - apexY) < 1e-6).map((command) => command.x));
  const sparkLeft = apexX + SPARK_OFFSET.x * CAP;
  const sparkBottom = apexY + SPARK_OFFSET.y * CAP;
  const spark = { x: sparkLeft, y: sparkBottom - SPARK_SIZE, size: SPARK_SIZE };

  // 3. Normalise: the ink box of word and spark starts at (0, 0).
  const word = bounds(wordCommands);
  const minX = Math.min(word.x1, spark.x);
  const minY = Math.min(word.y1, spark.y);
  const maxX = Math.max(word.x2, spark.x + spark.size);
  const maxY = Math.max(word.y2, spark.y + spark.size);
  const shift = (x, y) => [x - minX, y - minY];
  const wordmark = mapCommands(wordCommands, shift);
  const wordBox = { x: word.x1 - minX, y: word.y1 - minY, width: word.width, height: word.height };
  const logoBox = { x: 0, y: 0, width: maxX - minX, height: maxY - minY };
  const sparkTransform = { x: spark.x - minX, y: spark.y - minY, scale: spark.size / SPARK_BOX };

  // 4. Monogram: the sheared S alone, centred in a tile; the smaller spark at its top-right.
  const sGlyph = font.charToGlyph("S");
  const sRaw = mapCommands(shear(sGlyph.getPath(0, 0, font.unitsPerEm).commands), (x, y) => [x * scale, y * scale]);
  const sBox = bounds(sRaw);
  const clearSpace = sBox.height; // brief §3: free space around the logo is at least the height of the S
  const tileSize = Math.round(sBox.height / TILE_S_RATIO);
  const centre = tileSize / 2;
  const sShift = (x, y) => [x - (sBox.x1 + sBox.width / 2) + centre, y - (sBox.y1 + sBox.height / 2) + centre];
  const monogramS = mapCommands(sRaw, sShift);
  const sTile = bounds(monogramS);
  const monogramSparkSize = MONOGRAM_SPARK.size * sTile.height;
  const monogramSpark = {
    x: sTile.x2 + MONOGRAM_SPARK.x * sTile.height,
    y: sTile.y1 + MONOGRAM_SPARK.y * sTile.height - monogramSparkSize,
    size: monogramSparkSize,
  };
  const groupX1 = Math.min(sTile.x1, monogramSpark.x);
  const groupY1 = Math.min(sTile.y1, monogramSpark.y);
  const groupX2 = Math.max(sTile.x2, monogramSpark.x + monogramSpark.size);
  const groupY2 = Math.max(sTile.y2, monogramSpark.y + monogramSpark.size);
  const side = Math.max(groupX2 - groupX1, groupY2 - groupY1);
  const monogramBox = {
    x: (groupX1 + groupX2) / 2 - side / 2,
    y: (groupY1 + groupY2) / 2 - side / 2,
    width: side,
    height: side,
  };
  const tile = { x: 0, y: 0, width: tileSize, height: tileSize, radius: tileSize * TILE_RADIUS_RATIO };

  // Farthest ink point from the tile centre (curve endpoints and control points bound the curves), for maskable icons.
  const sparkCorners = [
    [monogramSpark.x, monogramSpark.y + monogramSpark.size / 2],
    [monogramSpark.x + monogramSpark.size / 2, monogramSpark.y],
    [monogramSpark.x + monogramSpark.size, monogramSpark.y + monogramSpark.size / 2],
    [monogramSpark.x + monogramSpark.size / 2, monogramSpark.y + monogramSpark.size],
  ];
  const inkPoints = [
    ...monogramS.flatMap((command) => POINT_KEYS.filter(([kx]) => command[kx] !== undefined).map(([kx, ky]) => [command[kx], command[ky]])),
    ...sparkCorners,
  ];
  const inkRadius = Math.max(...inkPoints.map(([x, y]) => Math.hypot(x - centre, y - centre)));

  return {
    wordmarkPath: toPathData(wordmark),
    wordBox,
    logoBox,
    sparkTransform,
    clearSpace,
    monogramSPath: toPathData(monogramS),
    monogramSparkTransform: { x: monogramSpark.x, y: monogramSpark.y, scale: monogramSpark.size / SPARK_BOX },
    monogramBox,
    tile,
    inkRadius,
  };
}

/* -------------------------------------------------------------------------- */
/* Output: logo-paths.ts                                                       */
/* -------------------------------------------------------------------------- */

function writeLogoPaths(geometry) {
  const { wordBox, logoBox, tile, monogramBox } = geometry;
  const box = (b) => `{ x: ${num(b.x, 2)}, y: ${num(b.y, 2)}, width: ${num(b.width, 2)}, height: ${num(b.height, 2)} }`;
  const source = `/**
 * Generated by scripts/build-logo.mjs (npm run logo). Do not edit by hand: change the script and run it again.
 *
 * The Sparkela wordmark: "${WORD}" in Unbounded Black (900), letter-spacing ${TRACKING_EM}em plus the font's kerning,
 * the whole word sheared by -${SHEAR_DEG} degrees in the path coordinates themselves (horizontal shear around the baseline,
 * never rotated). Units: the cap height is ${CAP}. The upright spark is drawn from SPARK_PATH (the brief's path in a
 * ${SPARK_BOX} x ${SPARK_BOX} box) with SPARK_TRANSFORM, which only translates and scales: the spark is never sheared.
 *
 * Wordmark coordinates: the ink box of word and spark is LOGO_VIEWBOX (origin 0, 0). WORDMARK_BOX is the word alone
 * (for widths below the spark threshold). CLEAR_SPACE is the height of the S, the minimum free space around the logo.
 *
 * Monogram coordinates: MONOGRAM_TILE is the icon tile (S centred, ${TILE_S_RATIO * 100}% of the tile high, corner radius
 * ${TILE_RADIUS_RATIO * 100}%). MONOGRAM_VIEWBOX is the tight square around the S and its spark, for the variants without a tile.
 */

export interface LogoBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Cap height in path units. */
export const CAP_HEIGHT = ${CAP};

/** Ink box of word and spark. */
export const LOGO_BOX: LogoBox = ${box(logoBox)};
export const LOGO_VIEWBOX = "${viewBox(logoBox)}";

/** Ink box of the word without the spark, in the same coordinates. */
export const WORDMARK_BOX: LogoBox = ${box(wordBox)};
export const WORDMARK_VIEWBOX = "${viewBox(wordBox)}";

/** Height of the S: the minimum free space on every side of the logo (brief §3). */
export const CLEAR_SPACE = ${num(geometry.clearSpace, 2)};

/** Outlined, sheared glyphs of "${WORD}" in one path (nonzero fill, no fill colour of its own). */
export const WORDMARK_PATH =
  "${geometry.wordmarkPath}";

/** The four-point spark in a ${SPARK_BOX} x ${SPARK_BOX} box (brief §3), upright. */
export const SPARK_PATH = "${SPARK_PATH}";
export const SPARK_VIEWBOX = "0 0 ${SPARK_BOX} ${SPARK_BOX}";

/** Places SPARK_PATH at the top-right corner of the last A, at half the cap height. Translate and scale only. */
export const SPARK_TRANSFORM = "${transformString(geometry.sparkTransform)}";

/** The sheared S of the monogram, centred in MONOGRAM_TILE. */
export const MONOGRAM_S_PATH =
  "${geometry.monogramSPath}";

/** Places SPARK_PATH at the top-right of the monogram S. Translate and scale only. */
export const MONOGRAM_SPARK_TRANSFORM = "${transformString(geometry.monogramSparkTransform)}";

/** Tight square around the monogram S and its spark (variants without a tile). */
export const MONOGRAM_BOX: LogoBox = ${box(monogramBox)};
export const MONOGRAM_VIEWBOX = "${viewBox(monogramBox)}";

/** The icon tile of the monogram: a square with rounded corners. */
export const MONOGRAM_TILE: LogoBox & { radius: number } = { x: ${num(tile.x, 2)}, y: ${num(tile.y, 2)}, width: ${num(tile.width, 2)}, height: ${num(tile.height, 2)}, radius: ${num(tile.radius, 2)} };
export const MONOGRAM_TILE_VIEWBOX = "${viewBox(tile)}";
`;
  return write("components/brand/logo-paths.ts", source);
}

/* -------------------------------------------------------------------------- */
/* Output: SVG and PNG files                                                   */
/* -------------------------------------------------------------------------- */

function svgDocument({ box, width, height, body }) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox(box)}" width="${num(width, 2)}" height="${num(height, 2)}">` +
    `<title>${BRAND_NAME}</title>${body}</svg>\n`
  );
}

function wordmarkBody(geometry, { word, spark, background }) {
  const { logoBox, clearSpace } = geometry;
  const pad = background ? clearSpace : 0;
  const box = { x: -pad, y: -pad, width: logoBox.width + pad * 2, height: logoBox.height + pad * 2 };
  const backgroundRect = background
    ? `<rect x="${num(box.x, 2)}" y="${num(box.y, 2)}" width="${num(box.width, 2)}" height="${num(box.height, 2)}" fill="${background}"/>`
    : "";
  return {
    box,
    body:
      backgroundRect +
      `<path fill="${word}" d="${geometry.wordmarkPath}"/>` +
      `<path fill="${spark}" transform="${transformString(geometry.sparkTransform)}" d="${SPARK_PATH}"/>`,
  };
}

function monogramParts(geometry, { letter, spark, background, tile = "rounded" }) {
  const box = background ? geometry.tile : geometry.monogramBox;
  let backgroundShape = "";
  if (background) {
    const radius = tile === "rounded" ? geometry.tile.radius : 0;
    backgroundShape = `<rect x="${num(box.x, 2)}" y="${num(box.y, 2)}" width="${num(box.width, 2)}" height="${num(box.height, 2)}"${
      radius ? ` rx="${num(radius, 2)}"` : ""
    } fill="${background}"/>`;
  }
  const ink =
    `<path fill="${letter}" d="${geometry.monogramSPath}"/>` +
    `<path fill="${spark}" transform="${transformString(geometry.monogramSparkTransform)}" d="${SPARK_PATH}"/>`;
  return { box, backgroundShape, ink };
}

function sparkSvg(color) {
  const box = { x: 0, y: 0, width: SPARK_BOX, height: SPARK_BOX };
  return svgDocument({ box, width: 24, height: 24, body: `<path fill="${color}" d="${SPARK_PATH}"/>` });
}

/**
 * A monogram at `size` px: a tile when `colors.background` is set, else the tight square. `scale` resizes the S and
 * spark around the tile centre: below 1 for maskable icons, above 1 for the favicon. With `centre: "group"` the S and
 * spark together are centred instead of the S alone (used with the larger favicon mark, so it stays inside the tile).
 */
function monogramSvg(geometry, colors, size, { tile = "rounded", scale = 1, centre = "s" } = {}) {
  const { box, backgroundShape, ink } = monogramParts(geometry, { ...colors, tile });
  if (scale === 1 && centre === "s") return svgDocument({ box, width: size, height: size, body: backgroundShape + ink });
  const tileCentre = geometry.tile.width / 2;
  const { monogramBox } = geometry;
  const from = centre === "group"
    ? { x: monogramBox.x + monogramBox.width / 2, y: monogramBox.y + monogramBox.height / 2 }
    : { x: tileCentre, y: tileCentre };
  const transform = `translate(${num(tileCentre, 2)} ${num(tileCentre, 2)}) scale(${num(scale, 4)}) translate(${num(-from.x, 2)} ${num(-from.y, 2)})`;
  return svgDocument({ box, width: size, height: size, body: `${backgroundShape}<g transform="${transform}">${ink}</g>` });
}

async function svgToPng(svg, size) {
  return sharp(Buffer.from(svg), { density: 72 * 4 })
    .resize(size, size, { fit: "fill", kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** An ICO file with PNG images (supported by every current browser and Windows since Vista). */
function icoFile(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

function write(relativePath, content) {
  const target = path.join(ROOT, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
  return relativePath;
}

async function main() {
  const c = readBrandColors();
  const fontBuffer = readFileSync(path.join(ROOT, FONT_FILE));
  const font = opentype.parse(fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength));
  const kerning = readPairKerning(readSfntTables(fontBuffer));
  const geometry = buildGeometry(font, kerning);

  const written = [writeLogoPaths(geometry)];

  // Wordmark colour versions (brief §3, PDF section 04). Transparent files are cut to the ink box; files with a
  // surface ("-op-") keep the minimum free space (the height of the S) on every side.
  const wordmarks = {
    "logo-inkt.svg": { word: c.inkt, spark: c.roest },
    "logo-roest.svg": { word: c.roest, spark: c.roest },
    "logo-botwit.svg": { word: c["bot-wit"], spark: c["bot-wit"] },
    "logo-botwit-vonk-roest.svg": { word: c["bot-wit"], spark: c.roest },
    "logo-inkt-vonk-botwit.svg": { word: c.inkt, spark: c["bot-wit"] },
    "logo-botwit-op-roest.svg": { word: c["bot-wit"], spark: c["bot-wit"], background: c.roest },
    "logo-roest-op-botwit.svg": { word: c.roest, spark: c.roest, background: c["bot-wit"] },
    "logo-op-inkt.svg": { word: c["bot-wit"], spark: c.roest, background: c.inkt },
    "logo-botwit-op-olijf.svg": { word: c["bot-wit"], spark: c["bot-wit"], background: c.olijf },
    "logo-botwit-op-leisteen.svg": { word: c["bot-wit"], spark: c["bot-wit"], background: c.leisteen },
    "logo-inkt-op-steen.svg": { word: c.inkt, spark: c["bot-wit"], background: c.steen },
  };
  for (const [file, colors] of Object.entries(wordmarks)) {
    const { box, body } = wordmarkBody(geometry, colors);
    const width = 480 * (box.width / geometry.logoBox.width);
    written.push(write(`public/brand/${file}`, svgDocument({ box, width, height: (width * box.height) / box.width, body })));
  }

  // Monogram versions: transparent (tight square) and as a tile with rounded corners.
  const monograms = {
    "monogram-inkt.svg": { letter: c.inkt, spark: c.roest },
    "monogram-botwit.svg": { letter: c["bot-wit"], spark: c["bot-wit"] },
    "monogram-roest.svg": { letter: c.roest, spark: c.roest },
    "monogram-botwit-op-roest.svg": { letter: c["bot-wit"], spark: c["bot-wit"], background: c.roest },
    "monogram-botwit-op-inkt.svg": { letter: c["bot-wit"], spark: c.roest, background: c.inkt },
  };
  for (const [file, colors] of Object.entries(monograms)) {
    written.push(write(`public/brand/${file}`, monogramSvg(geometry, colors, 128)));
  }

  // The spark on its own, upright (decoration, popup cards).
  written.push(write("public/brand/vonk-roest.svg", sparkSvg(c.roest)));
  written.push(write("public/brand/vonk-botwit.svg", sparkSvg(c["bot-wit"])));
  written.push(write("public/brand/vonk-inkt.svg", sparkSvg(c.inkt)));

  // Browser icon: bot-wit S on an inkt tile with a roest spark (PDF favicon), mark enlarged for 16 to 32 px.
  const favicon = { letter: c["bot-wit"], spark: c.roest, background: c.inkt };
  const iconSvg = monogramSvg(geometry, favicon, 32, { scale: FAVICON_SCALE, centre: "group" });
  written.push(write("app/icon.svg", iconSvg));
  const icoImages = [];
  for (const size of [16, 32, 48]) icoImages.push({ size, png: await svgToPng(iconSvg, size) });
  written.push(write("app/favicon.ico", icoFile(icoImages)));

  // App icons: bot-wit S and spark on roest (PDF app icon). iOS rounds the corners itself, so the Apple icon is a full
  // square; the manifest icons are rounded tiles; the maskable icon is full bleed with the mark inside the safe zone.
  const appIcon = { letter: c["bot-wit"], spark: c["bot-wit"], background: c.roest };
  written.push(write("app/apple-icon.png", await svgToPng(monogramSvg(geometry, appIcon, 180, { tile: "square" }), 180)));
  written.push(write("public/brand/icon-192.png", await svgToPng(monogramSvg(geometry, appIcon, 192), 192)));
  written.push(write("public/brand/icon-512.png", await svgToPng(monogramSvg(geometry, appIcon, 512), 512)));
  const maskScale = Math.min(1, (MASKABLE_SAFE_RADIUS * geometry.tile.width) / geometry.inkRadius);
  written.push(
    write(
      "public/brand/icon-maskable-512.png",
      await svgToPng(monogramSvg(geometry, appIcon, 512, { tile: "square", scale: maskScale }), 512),
    ),
  );

  const { logoBox, wordBox } = geometry;
  console.log(`Logo ${num(logoBox.width, 2)} × ${num(logoBox.height, 2)} (word ${num(wordBox.width, 2)} × ${num(wordBox.height, 2)}), cap ${CAP}, S ${num(geometry.clearSpace, 2)}.`);
  console.log(`Wordmark path ${geometry.wordmarkPath.length} bytes, monogram S ${geometry.monogramSPath.length} bytes, maskable scale ${num(maskScale, 3)}.`);
  console.log(`Wrote ${written.length} files:\n  ${written.join("\n  ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
