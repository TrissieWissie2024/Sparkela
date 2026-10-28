import { mkdtemp, mkdir, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

import { buildImages } from "@/scripts/build-images.mjs";

import shopifyLoader from "./image-loader";
import { hasSiteVariants, SITE_IMAGE_WIDTHS, siteVariantPath, variantWidth } from "./site-image-variants.mjs";

/**
 * The image loader (docs/PLAN.md §17.1): Shopify's CDN scales product photos with ?width=; the site's own photos map
 * to the width variants scripts/build-images.mjs writes (QA round 3: before, every width got the full master).
 */

describe("shopifyLoader", () => {
  it("sets width= on Shopify CDN URLs and keeps the other parameters", () => {
    expect(shopifyLoader({ src: "https://cdn.shopify.com/s/files/1/0001/lola.jpg?v=1", width: 640 })).toBe(
      "https://cdn.shopify.com/s/files/1/0001/lola.jpg?v=1&width=640",
    );
  });

  it("maps a site photo to the smallest variant at least as wide as asked, one URL per step", () => {
    expect(shopifyLoader({ src: "/images/hero/hero-desktop.webp", width: 750 })).toBe("/_img/828/images/hero/hero-desktop.webp");
    expect(shopifyLoader({ src: "/images/hero/hero-desktop.webp", width: 828 })).toBe("/_img/828/images/hero/hero-desktop.webp");
    // A 96 px menu thumbnail at 2× no longer pulls a 1200 or 2400 px master.
    expect(shopifyLoader({ src: "/images/momenten/festival.webp", width: 192 })).toBe("/_img/256/images/momenten/festival.webp");
    expect(shopifyLoader({ src: "/images/momenten/festival.webp", width: 32 })).toBe("/_img/256/images/momenten/festival.webp");
    // Past the ladder: the largest step.
    expect(shopifyLoader({ src: "/images/hero/hero-desktop.webp", width: 3840 })).toBe("/_img/2400/images/hero/hero-desktop.webp");
  });

  it("leaves other local files and data URLs alone", () => {
    expect(shopifyLoader({ src: "/brand/logo-inkt.svg", width: 256 })).toBe("/brand/logo-inkt.svg?w=256");
    expect(shopifyLoader({ src: "data:image/png;base64,AAAA", width: 256 })).toBe("data:image/png;base64,AAAA");
  });
});

describe("site image variants", () => {
  it("covers posters and photos, not videos or brand files", () => {
    expect(hasSiteVariants("/images/linde/portret.webp")).toBe(true);
    expect(hasSiteVariants("/videos/sparkela-01-poster.webp")).toBe(true);
    expect(hasSiteVariants("/videos/sparkela-01.mp4")).toBe(false);
    expect(hasSiteVariants("/brand/logo-inkt.svg")).toBe(false);
    expect(siteVariantPath("/videos/sparkela-01-poster.webp", 640)).toBe("/_img/640/videos/sparkela-01-poster.webp");
  });

  it("has an ascending ladder", () => {
    expect([...SITE_IMAGE_WIDTHS].sort((a, b) => a - b)).toEqual([...SITE_IMAGE_WIDTHS]);
    expect(variantWidth(1)).toBe(SITE_IMAGE_WIDTHS[0]);
  });
});

describe("scripts/build-images.mjs", () => {
  const dirs: string[] = [];
  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("writes every step (scaled down, never enlarged), keeps fresh variants and removes orphans", async () => {
    const publicDir = await mkdtemp(path.join(tmpdir(), "sparkela-images-"));
    dirs.push(publicDir);
    await mkdir(path.join(publicDir, "images/momenten"), { recursive: true });
    const master = path.join(publicDir, "images/momenten/festival.webp");
    await sharp({ create: { width: 1200, height: 1500, channels: 3, background: { r: 113, g: 59, b: 50 } } })
      .webp()
      .toFile(master);
    await writeFile(path.join(publicDir, "images/momenten/.gitkeep"), "");
    await mkdir(path.join(publicDir, "_img/256/images/oud"), { recursive: true });
    await writeFile(path.join(publicDir, "_img/256/images/oud/weg.webp"), "x");

    const first = await buildImages(publicDir);
    expect(first).toEqual({ masters: 1, written: SITE_IMAGE_WIDTHS.length, kept: 0, removed: 1 });
    expect((await sharp(path.join(publicDir, "_img/640/images/momenten/festival.webp")).metadata()).width).toBe(640);
    // 1920 and 2400 are wider than the master: the master itself.
    expect((await sharp(path.join(publicDir, "_img/2400/images/momenten/festival.webp")).metadata()).width).toBe(1200);
    expect(await readdir(path.join(publicDir, "_img/256/images"))).toEqual(["momenten"]);

    const second = await buildImages(publicDir);
    expect(second).toEqual({ masters: 1, written: 0, kept: SITE_IMAGE_WIDTHS.length, removed: 0 });

    // A newer master is written again.
    const later = new Date((await stat(master)).mtimeMs + 60_000);
    await utimes(master, later, later);
    expect((await buildImages(publicDir)).written).toBe(SITE_IMAGE_WIDTHS.length);
  });
});
