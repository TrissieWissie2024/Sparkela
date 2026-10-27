import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import sharp from "sharp";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * Open Graph images (docs/PLAN.md §17.3, §19.1, decisions 113 and 131): ogPhotoUrl() only lets JPEG and PNG originals
 * through with format=jpg, loadOgPhoto() only hands Satori real JPEG or PNG bytes, a rendered product OG with
 * tests/fixtures/og-photo.jpg has an opaque photo panel (a WebP would be fully transparent), and the three routes
 * (brand, product, drop) answer with a 1200 × 630 PNG or 404. next/cache is mocked; 'use cache' is a plain string
 * under Vitest, and the routes read the local catalog at a fixed server time.
 */

const clock = vi.hoisted(() => {
  vi.stubEnv("COMMERCE_PROVIDER", "local");
  vi.stubEnv("VERCEL_ENV", "");
  return { now: Date.parse("2026-11-27T12:00:00+01:00") };
});

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/clock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/clock")>();
  return { ...actual, serverNow: () => clock.now };
});

import { cacheTag } from "next/cache";

import { brandColor, type BrandColorToken } from "@/lib/brand-colors";
import { NO_PRODUCTS_HANDLE } from "@/lib/shop-data";
import { drops } from "@/content/drops";
import { giftWrap } from "@/content/offers";
import {
  displayWidthEm,
  fitDisplaySize,
  loadOgPhoto,
  OG_PHOTO_PANEL,
  ogPhotoUrl,
  renderOgImage,
  sniffOgPhoto,
  splitSentences,
} from "@/components/seo/OgImage";
import BrandImage, * as brandRoute from "@/app/opengraph-image";
import DropImage, * as dropRoute from "@/app/drops/[slug]/opengraph-image";
import ProductImage, * as productRoute from "@/app/products/[handle]/opengraph-image";

afterAll(() => {
  vi.unstubAllEnvs();
});

const JPEG = readFileSync(join(process.cwd(), "tests/fixtures/og-photo.jpg"));
/** The flat colour of the fixture photo around its edges (a light disc sits in the middle). */
const PHOTO_EDGE: [number, number, number] = [200, 50, 51];
/** A minimal WebP header: what Shopify returns for a WebP original, whatever the format parameter says. */
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(16)]);
const SHOPIFY_JPG = "https://cdn.shopify.com/s/files/1/0001/products/lola-packshot.jpg?v=1730000000";

function respondWith(body: Uint8Array | string, status = 200): typeof fetch {
  return vi.fn(async () => new Response(typeof body === "string" ? body : new Uint8Array(body), { status }));
}

interface Pixels {
  width: number;
  height: number;
  at(x: number, y: number): [number, number, number, number];
}

async function decode(png: Uint8Array): Promise<Pixels> {
  const { data, info } = await sharp(Buffer.from(png)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    at(x, y) {
      const offset = (y * info.width + x) * info.channels;
      return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
    },
  };
}

function hex(token: BrandColorToken): [number, number, number] {
  const value = brandColor(token).slice(1);
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16)) as [number, number, number];
}

function expectColor(pixel: [number, number, number, number], rgb: [number, number, number], tolerance = 10) {
  expect(pixel[3]).toBe(255);
  rgb.forEach((channel, index) => expect(Math.abs(pixel[index] - channel)).toBeLessThanOrEqual(tolerance));
}

describe("ogPhotoUrl", () => {
  it("asks Shopify for a 1200 px JPEG of a .jpg or .png original and keeps the other parameters", () => {
    const jpg = new URL(ogPhotoUrl(SHOPIFY_JPG) ?? "");
    expect(jpg.searchParams.get("format")).toBe("jpg");
    expect(jpg.searchParams.get("width")).toBe("1200");
    expect(jpg.searchParams.get("v")).toBe("1730000000");
    expect(jpg.pathname).toBe("/s/files/1/0001/products/lola-packshot.jpg");

    for (const original of ["https://cdn.shopify.com/s/files/1/x/Ring.PNG", "https://sparkela.nl/cdn/shop/files/oorbel.jpeg?width=400"]) {
      const url = new URL(ogPhotoUrl(original) ?? "");
      expect(url.searchParams.get("format")).toBe("jpg");
      expect(url.searchParams.get("width")).toBe("1200");
    }
  });

  it("gives null for WebP and AVIF originals, a .jpg only in the query, relative paths and junk", () => {
    expect(ogPhotoUrl("https://cdn.shopify.com/s/files/1/x/products/lola.webp?v=1")).toBeNull();
    expect(ogPhotoUrl("https://cdn.shopify.com/s/files/1/x/products/lola.avif")).toBeNull();
    expect(ogPhotoUrl("https://cdn.shopify.com/s/files/1/x/products/lola.webp?name=lola.jpg")).toBeNull();
    expect(ogPhotoUrl("/images/hero/hero-desktop.webp")).toBeNull();
    expect(ogPhotoUrl("/images/linde/portret.jpg")).toBeNull();
    expect(ogPhotoUrl("data:image/jpeg;base64,AAAA")).toBeNull();
    expect(ogPhotoUrl("not a url")).toBeNull();
  });
});

describe("loadOgPhoto", () => {
  it("returns the bytes of a JPEG as a data URI, fetched from the format=jpg URL", async () => {
    const fetcher = respondWith(JPEG);
    const photo = await loadOgPhoto(SHOPIFY_JPG, fetcher);
    expect(photo).toBe(`data:image/jpeg;base64,${JPEG.toString("base64")}`);
    const requested = new URL(String(vi.mocked(fetcher).mock.calls[0][0]));
    expect(requested.searchParams.get("format")).toBe("jpg");
  });

  it("gives null without fetching for a WebP original or no URL", async () => {
    const fetcher = respondWith(JPEG);
    expect(await loadOgPhoto("https://cdn.shopify.com/s/files/1/x/lola.webp", fetcher)).toBeNull();
    expect(await loadOgPhoto(undefined, fetcher)).toBeNull();
    expect(await loadOgPhoto(null, fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("gives null when the CDN answers with WebP bytes, an error page, a failure or a timeout", async () => {
    expect(await loadOgPhoto(SHOPIFY_JPG, respondWith(WEBP))).toBeNull();
    expect(await loadOgPhoto(SHOPIFY_JPG, respondWith("<html>Not found</html>", 404))).toBeNull();
    expect(await loadOgPhoto(SHOPIFY_JPG, respondWith("<html></html>"))).toBeNull();
    const failing = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    expect(await loadOgPhoto(SHOPIFY_JPG, failing)).toBeNull();
  });

  it("recognises JPEG and PNG by their signature only", () => {
    expect(sniffOgPhoto(new Uint8Array(JPEG))).toBe("image/jpeg");
    expect(sniffOgPhoto(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffOgPhoto(new Uint8Array(WEBP))).toBeNull();
    expect(sniffOgPhoto(new Uint8Array())).toBeNull();
  });
});

describe("display type fitting", () => {
  it("matches the advance widths of assets/fonts/Unbounded-ExtraBold.woff", () => {
    interface OpenTypeFont {
      unitsPerEm: number;
      charToGlyph(char: string): { advanceWidth: number };
    }
    const load = createRequire(import.meta.url);
    const opentype: { parse(buffer: ArrayBuffer): OpenTypeFont } = load("opentype.js");
    const file = readFileSync(join(process.cwd(), "assets/fonts/Unbounded-ExtraBold.woff"));
    const font = opentype.parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    for (const text of ["Lola chunky hoops", "Evi dikke schakelketting", "Holiday Sparkle", "Eén paar oorbellen.", "Cadeaus onder €25"]) {
      let units = 0;
      for (const char of text) units += font.charToGlyph(char).advanceWidth;
      const expected = units / font.unitsPerEm - 0.01 * (text.length - 1);
      expect(displayWidthEm(text)).toBeCloseTo(expected, 2);
    }
  });

  it("shrinks a long compound until it fits the column", () => {
    const width = 568;
    const size = fitDisplaySize("Evi dikke schakelketting", width, 3, 66, 36);
    expect(size).toBeLessThan(66);
    expect(displayWidthEm("schakelketting") * size).toBeLessThanOrEqual(width);
    expect(fitDisplaySize("Ring", width, 3, 66, 36)).toBe(66);
  });

  it("starts every sentence of the hero line on its own line", () => {
    expect(splitSentences("Eén paar oorbellen. Hele outfit af.")).toEqual(["Eén paar oorbellen.", "Hele outfit af."]);
    expect(splitSentences("Holiday Sparkle")).toEqual(["Holiday Sparkle"]);
  });
});

describe("renderOgImage", () => {
  it("draws the product photo opaque in the 4:5 panel (a WebP would be transparent here)", async () => {
    const photo = await loadOgPhoto(SHOPIFY_JPG, respondWith(JPEG));
    const png = await renderOgImage({ kind: "product", title: "Lola chunky hoops", eyebrow: "Oorbellen", imageUrl: photo ?? undefined });
    const pixels = await decode(png);
    expect([pixels.width, pixels.height]).toEqual([1200, 630]);
    const panelLeft = 1200 - OG_PHOTO_PANEL.width;
    expectColor(pixels.at(panelLeft + 12, 12), PHOTO_EDGE, 14);
    expectColor(pixels.at(1200 - 12, 630 - 12), PHOTO_EDGE, 14);
    expectColor(pixels.at(20, 600), hex("donker"));
  }, 30_000);

  it("draws a roest panel instead when there is no usable photo", async () => {
    const png = await renderOgImage({ kind: "product", title: "Lola chunky hoops", imageUrl: "https://cdn.shopify.com/x/lola.webp" });
    const pixels = await decode(png);
    expectColor(pixels.at(1200 - OG_PHOTO_PANEL.width + 12, 12), hex("roest"));
  }, 30_000);

  it("puts the brand image on donker and the drop image on roest", async () => {
    const brand = await decode(await renderOgImage({ kind: "merk", title: "Eén paar oorbellen. Hele outfit af." }));
    expectColor(brand.at(8, 8), hex("donker"));
    const drop = await decode(await renderOgImage({ kind: "drop", title: "Holiday Sparkle", imageUrl: `data:image/jpeg;base64,${JPEG.toString("base64")}` }));
    expectColor(drop.at(8, 8), hex("roest"));
    // A drop never shows a photo, even when one is passed.
    expectColor(drop.at(1200 - 12, 630 - 12), hex("roest"));
  }, 30_000);
});

describe("OG routes", () => {
  async function png(response: Response): Promise<Pixels> {
    expect(response.headers.get("Content-Type")).toBe("image/png");
    return decode(new Uint8Array(await response.arrayBuffer()));
  }

  it("export 1200 × 630 PNG metadata", () => {
    for (const route of [brandRoute, productRoute, dropRoute]) {
      expect(route.size).toEqual({ width: 1200, height: 630 });
      expect(route.contentType).toBe("image/png");
      expect(route.alt.length).toBeGreaterThan(0);
    }
  });

  it("render the brand image", async () => {
    const pixels = await png(await BrandImage());
    expect([pixels.width, pixels.height]).toEqual([1200, 630]);
  }, 30_000);

  it("render a product image per product, tagged like the product, and 404 for unknown handles and the gift wrap", async () => {
    const params = await productRoute.generateStaticParams();
    const handles = params.map((param) => param.handle);
    expect(handles).toContain("lola-chunky-hoops");
    expect(handles).toContain("holiday-ster-oorbellen");
    expect(handles).toContain("cadeaukaart");
    expect(handles).not.toContain(giftWrap.productHandle);

    const pixels = await png(await ProductImage({ params: Promise.resolve({ handle: "lola-chunky-hoops" }) }));
    expect([pixels.width, pixels.height]).toEqual([1200, 630]);
    expect(vi.mocked(cacheTag)).toHaveBeenCalledWith("products", "product:lola-chunky-hoops");

    for (const handle of ["bestaat-niet", NO_PRODUCTS_HANDLE, giftWrap.productHandle]) {
      await expect(ProductImage({ params: Promise.resolve({ handle }) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
    }
  }, 30_000);

  it("render a drop image for every drop and 404 for an unknown slug", async () => {
    expect(dropRoute.generateStaticParams()).toEqual(drops.map((drop) => ({ slug: drop.slug })));
    const pixels = await png(await DropImage({ params: Promise.resolve({ slug: "holiday-sparkle" }) }));
    expectColor(pixels.at(8, 8), hex("roest"));
    await expect(DropImage({ params: Promise.resolve({ slug: "bestaat-niet" }) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  }, 30_000);
});
