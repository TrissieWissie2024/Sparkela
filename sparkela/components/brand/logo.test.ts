import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Logo, LOGO_MIN_WIDTH, LOGO_SPARK_MIN_WIDTH, logoLayout, type LogoVariant } from "./Logo";
import { LogoDefs } from "./LogoDefs";
import { Monogram } from "./Monogram";
import { Spark } from "./Spark";
import {
  CAP_HEIGHT,
  CLEAR_SPACE,
  LOGO_BOX,
  LOGO_VIEWBOX,
  MONOGRAM_BOX,
  MONOGRAM_S_PATH,
  MONOGRAM_SPARK_TRANSFORM,
  MONOGRAM_TILE,
  MONOGRAM_TILE_VIEWBOX,
  MONOGRAM_VIEWBOX,
  SPARK_PATH,
  SPARK_TRANSFORM,
  SPARK_VIEWBOX,
  WORDMARK_BOX,
  WORDMARK_PATH,
  WORDMARK_VIEWBOX,
} from "./logo-paths";

const ROOT = path.resolve(__dirname, "../..");
const BRIEF_SPARK = "M50 0 C53 35 65 47 100 50 C65 53 53 65 50 100 C47 65 35 53 0 50 C35 47 47 35 50 0 Z";

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

function parseViewBox(viewBox: string): number[] {
  return viewBox.split(" ").map(Number);
}

/** translate(x y) scale(s) → { x, y, scale }; anything else (skew, rotate, matrix) fails to parse. */
function parseTransform(transform: string): { x: number; y: number; scale: number } | null {
  const match = /^translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)$/.exec(transform);
  return match ? { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]) } : null;
}

function pngSize(file: string): { width: number; height: number } {
  const buffer = readFileSync(path.join(ROOT, file));
  expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logo-paths.ts", () => {
  it("has non-empty, closed paths", () => {
    for (const d of [WORDMARK_PATH, SPARK_PATH, MONOGRAM_S_PATH]) {
      expect(d.length).toBeGreaterThan(20);
      expect(d.startsWith("M")).toBe(true);
      expect(d.trimEnd().endsWith("Z")).toBe(true);
      expect(d).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it("uses the spark path of the brief, upright", () => {
    expect(SPARK_PATH).toBe(BRIEF_SPARK);
    expect(SPARK_VIEWBOX).toBe("0 0 100 100");
  });

  it("has viewboxes with four finite numbers and a positive size", () => {
    for (const viewBox of [LOGO_VIEWBOX, WORDMARK_VIEWBOX, MONOGRAM_VIEWBOX, MONOGRAM_TILE_VIEWBOX, SPARK_VIEWBOX]) {
      const numbers = parseViewBox(viewBox);
      expect(numbers).toHaveLength(4);
      expect(numbers.every(Number.isFinite)).toBe(true);
      expect(numbers[2]).toBeGreaterThan(0);
      expect(numbers[3]).toBeGreaterThan(0);
    }
    expect(parseViewBox(LOGO_VIEWBOX)).toEqual([LOGO_BOX.x, LOGO_BOX.y, LOGO_BOX.width, LOGO_BOX.height]);
    expect(parseViewBox(WORDMARK_VIEWBOX)).toEqual([WORDMARK_BOX.x, WORDMARK_BOX.y, WORDMARK_BOX.width, WORDMARK_BOX.height]);
    expect(parseViewBox(MONOGRAM_VIEWBOX)).toEqual([MONOGRAM_BOX.x, MONOGRAM_BOX.y, MONOGRAM_BOX.width, MONOGRAM_BOX.height]);
  });

  it("only translates and scales the spark: no skew, rotation or matrix", () => {
    for (const transform of [SPARK_TRANSFORM, MONOGRAM_SPARK_TRANSFORM]) {
      expect(transform).not.toMatch(/skew|rotate|matrix/i);
      expect(parseTransform(transform)).not.toBeNull();
    }
  });

  it("draws the wordmark spark at half the cap height, at the top right, inside the logo box", () => {
    const spark = parseTransform(SPARK_TRANSFORM);
    expect(spark).not.toBeNull();
    if (!spark) return;
    const size = spark.scale * 100;
    expect(size).toBe(CAP_HEIGHT / 2);
    expect(spark.y).toBeCloseTo(LOGO_BOX.y, 1);
    expect(spark.x + size).toBeCloseTo(LOGO_BOX.x + LOGO_BOX.width, 1);
    // The spark's bottom point is at the top of the letters (cap line), not above or inside the word.
    const capTop = WORDMARK_BOX.y + (WORDMARK_BOX.height - CAP_HEIGHT) / 2;
    expect(Math.abs(spark.y + size - capTop)).toBeLessThan(CAP_HEIGHT * 0.06);
  });

  it("keeps the clear space at the height of the S and the monogram inside its tile", () => {
    expect(CLEAR_SPACE).toBeGreaterThan(CAP_HEIGHT);
    expect(CLEAR_SPACE).toBeLessThan(CAP_HEIGHT * 1.1);
    expect(MONOGRAM_BOX.x).toBeGreaterThan(MONOGRAM_TILE.x);
    expect(MONOGRAM_BOX.y).toBeGreaterThan(MONOGRAM_TILE.y);
    expect(MONOGRAM_BOX.x + MONOGRAM_BOX.width).toBeLessThan(MONOGRAM_TILE.x + MONOGRAM_TILE.width);
    expect(MONOGRAM_BOX.y + MONOGRAM_BOX.height).toBeLessThan(MONOGRAM_TILE.y + MONOGRAM_TILE.height);
    expect(MONOGRAM_TILE.radius).toBeCloseTo(MONOGRAM_TILE.width * 0.2, 5);
  });
});

describe("generated files", () => {
  const brandDir = path.join(ROOT, "public/brand");
  const brandSvgs = readdirSync(brandDir).filter((file) => file.endsWith(".svg"));

  it("contains every file of plan §3.6", () => {
    const files = readdirSync(brandDir);
    for (const file of [
      "logo-inkt.svg",
      "logo-botwit-op-roest.svg",
      "logo-roest.svg",
      "logo-botwit.svg",
      "logo-op-inkt.svg",
      "monogram-inkt.svg",
      "monogram-botwit.svg",
      "monogram-roest.svg",
      "monogram-botwit-op-roest.svg",
      "monogram-botwit-op-inkt.svg",
      "icon-192.png",
      "icon-512.png",
      "icon-maskable-512.png",
    ]) {
      expect(files).toContain(file);
    }
  });

  it("has standalone SVGs without skew transforms, text or rotation", () => {
    for (const file of [...brandSvgs.map((f) => `public/brand/${f}`), "app/icon.svg"]) {
      const svg = read(file);
      expect(svg.startsWith("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"")).toBe(true);
      expect(svg).not.toMatch(/skew|rotate|matrix\(|<text|font-family/i);
      expect(svg).toContain("<title>Sparkela</title>");
    }
  });

  it("has spark files with the brief's path and no skewX", () => {
    const sparkFiles = brandSvgs.filter((file) => file.startsWith("vonk-"));
    expect(sparkFiles.length).toBeGreaterThan(0);
    for (const file of sparkFiles) {
      const svg = read(`public/brand/${file}`);
      expect(svg).toContain(BRIEF_SPARK);
      expect(svg).not.toMatch(/skewX/i);
    }
  });

  it("draws every logo and monogram file from the same paths as logo-paths.ts", () => {
    for (const file of brandSvgs.filter((f) => f.startsWith("logo-"))) {
      const svg = read(`public/brand/${file}`);
      expect(svg).toContain(WORDMARK_PATH);
      expect(svg).toContain(`transform="${SPARK_TRANSFORM}" d="${BRIEF_SPARK}"`);
    }
    for (const file of brandSvgs.filter((f) => f.startsWith("monogram-"))) {
      const svg = read(`public/brand/${file}`);
      expect(svg).toContain(MONOGRAM_S_PATH);
      expect(svg).toContain(`transform="${MONOGRAM_SPARK_TRANSFORM}" d="${BRIEF_SPARK}"`);
    }
    expect(read("app/icon.svg")).toContain(MONOGRAM_S_PATH);
  });

  it("has app icons and manifest icons at their sizes", () => {
    expect(pngSize("app/apple-icon.png")).toEqual({ width: 180, height: 180 });
    expect(pngSize("public/brand/icon-192.png")).toEqual({ width: 192, height: 192 });
    expect(pngSize("public/brand/icon-512.png")).toEqual({ width: 512, height: 512 });
    expect(pngSize("public/brand/icon-maskable-512.png")).toEqual({ width: 512, height: 512 });
  });

  it("has a favicon.ico with 16, 32 and 48 px PNG images", () => {
    const ico = readFileSync(path.join(ROOT, "app/favicon.ico"));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    expect(count).toBe(3);
    const sizes: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const entry = 6 + index * 16;
      const size = ico.readUInt8(entry);
      const length = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      const png = ico.subarray(offset, offset + length);
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(png.readUInt32BE(16)).toBe(size);
      sizes.push(size);
    }
    expect(sizes).toEqual([16, 32, 48]);
  });
});

describe("components", () => {
  it("LogoDefs defines the three shared paths once, hidden", () => {
    const html = renderToStaticMarkup(createElement(LogoDefs));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(`<path id="sparkela-wordmark" d="${WORDMARK_PATH}"`);
    expect(html).toContain(`<path id="sparkela-spark" d="${SPARK_PATH}"`);
    expect(html).toContain(`<path id="sparkela-s" d="${MONOGRAM_S_PATH}"`);
    expect(html).not.toContain("fill=");
  });

  it("Logo is an image named Sparkela with the word and the spark from the shared paths", () => {
    const html = renderToStaticMarkup(createElement(Logo));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Sparkela"');
    expect(html).toContain('href="#sparkela-wordmark"');
    expect(html).toContain(`href="#sparkela-spark" transform="${SPARK_TRANSFORM}"`);
    expect(html).toContain('class="fill-inkt"');
    expect(html).toContain('class="fill-roest"');
    expect(html).toContain("forced-colors:[&amp;_use]:fill-[CanvasText]");
  });

  it("Logo has the colours of each variant", () => {
    const expected: Record<LogoVariant, [string, string]> = {
      header: ["fill-inkt", "fill-roest"],
      "op-donker": ["fill-bot-wit", "fill-roest"],
      "op-roest": ["fill-bot-wit", "fill-bot-wit"],
      "op-botwit": ["fill-roest", "fill-roest"],
      "op-olijf": ["fill-bot-wit", "fill-bot-wit"],
      "op-leisteen": ["fill-bot-wit", "fill-bot-wit"],
      "op-steen": ["fill-inkt", "fill-bot-wit"],
    };
    for (const [variant, [word, spark]] of Object.entries(expected) as Array<[LogoVariant, [string, string]]>) {
      const html = renderToStaticMarkup(createElement(Logo, { variant }));
      expect(html).toMatch(new RegExp(`href="#sparkela-wordmark" class="${word}"`));
      expect(html).toMatch(new RegExp(`href="#sparkela-spark" transform="[^"]+" class="${spark}"`));
    }
  });

  it("Logo drops the spark below 70 px and warns below 50 px", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(renderToStaticMarkup(createElement(Logo, { width: LOGO_SPARK_MIN_WIDTH }))).toContain("#sparkela-spark");
    const small = renderToStaticMarkup(createElement(Logo, { width: LOGO_SPARK_MIN_WIDTH - 1 }));
    expect(small).not.toContain("#sparkela-spark");
    expect(small).toContain("#sparkela-wordmark");
    expect(warn).not.toHaveBeenCalled();
    renderToStaticMarkup(createElement(Logo, { width: LOGO_MIN_WIDTH - 1 }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("Monogram");
  });

  it("Logo adds the height of the S as free space on every side", () => {
    const layout = logoLayout(160);
    const scale = 160 / LOGO_BOX.width;
    expect(layout.withSpark).toBe(true);
    expect(layout.clearSpace).toBeCloseTo(CLEAR_SPACE * scale, 1);
    expect(layout.width).toBeCloseTo(160 + 2 * CLEAR_SPACE * scale, 1);
    expect(layout.height).toBeCloseTo((LOGO_BOX.height + 2 * CLEAR_SPACE) * scale, 1);
    expect(parseViewBox(layout.viewBox)).toEqual(
      [-CLEAR_SPACE, -CLEAR_SPACE, LOGO_BOX.width + 2 * CLEAR_SPACE, LOGO_BOX.height + 2 * CLEAR_SPACE].map(
        (value) => Math.round(value * 100) / 100,
      ),
    );
    const html = renderToStaticMarkup(createElement(Logo, { width: 160 }));
    expect(html).toContain(`width="${layout.width}" height="${layout.height}"`);

    const noSpark = logoLayout(60);
    expect(noSpark.withSpark).toBe(false);
    expect(noSpark.width).toBeCloseTo(60 + (2 * CLEAR_SPACE * 60) / WORDMARK_BOX.width, 1);
  });

  it("Logo takes a custom accessible name", () => {
    expect(renderToStaticMarkup(createElement(Logo, { title: "Sparkela, naar de homepage" }))).toContain(
      'aria-label="Sparkela, naar de homepage"',
    );
  });

  it("Monogram draws the S and spark, with a tile only for the tile variants", () => {
    const plain = renderToStaticMarkup(createElement(Monogram));
    expect(plain).toContain('aria-label="Sparkela"');
    expect(plain).toContain(`viewBox="${MONOGRAM_VIEWBOX}"`);
    expect(plain).toContain('width="32" height="32"');
    expect(plain).toContain('href="#sparkela-s" class="fill-inkt"');
    expect(plain).toContain(`href="#sparkela-spark" transform="${MONOGRAM_SPARK_TRANSFORM}" class="fill-roest"`);
    expect(plain).not.toContain("<rect");

    const tile = renderToStaticMarkup(createElement(Monogram, { variant: "botwit-op-inkt", size: 64 }));
    expect(tile).toContain(`viewBox="${MONOGRAM_TILE_VIEWBOX}"`);
    expect(tile).toContain(`rx="${MONOGRAM_TILE.radius}" class="fill-inkt"`);
    expect(tile).toContain('href="#sparkela-s" class="fill-bot-wit"');
    expect(tile).toMatch(/href="#sparkela-spark" transform="[^"]+" class="fill-roest"/);

    const roest = renderToStaticMarkup(createElement(Monogram, { variant: "botwit-op-roest" }));
    expect(roest).toContain('class="fill-roest"');
    expect(roest).toMatch(/href="#sparkela-spark" transform="[^"]+" class="fill-bot-wit"/);
  });

  it("Spark is decorative without a title and an image with one", () => {
    const decorative = renderToStaticMarkup(createElement(Spark));
    expect(decorative).toContain('aria-hidden="true"');
    expect(decorative).toContain('class="shrink-0 size-4"');
    expect(decorative).toContain(`d="${SPARK_PATH}"`);
    expect(decorative).not.toMatch(/skew|transform/);
    const named = renderToStaticMarkup(createElement(Spark, { title: "Vonk", className: "size-6 text-roest" }));
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="Vonk"');
    expect(named).toContain('class="shrink-0 size-6 text-roest"');
  });

  it("uses colour tokens only, no hex codes", () => {
    for (const file of ["Logo.tsx", "Monogram.tsx", "Spark.tsx", "LogoDefs.tsx"]) {
      expect(read(`components/brand/${file}`)).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
    }
  });
});
