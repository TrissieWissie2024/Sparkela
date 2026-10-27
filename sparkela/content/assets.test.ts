import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assets, SUPPLIED } from "@/content/assets";
import { collections } from "@/content/collections";
import { drops } from "@/content/drops";
import { home } from "@/content/home";
import { products } from "@/content/products";
import { stacks } from "@/content/stacks";

/**
 * content/assets.ts against plan §17.2: fixed keys, file names, aspect ratios and sizes; every key that content
 * uses exists; supplied files are really in public/; and every image folder exists in public/images/ (.gitkeep), so
 * Linde's files have a place to go.
 */

const publicDir = fileURLToPath(new URL("../public", import.meta.url));
const RATIO: Record<string, [number, number]> = { "4:5": [4, 5], "3:4": [3, 4], "16:9": [16, 9], "1:1": [1, 1], "9:16": [9, 16] };

describe("site imagery (plan §17.2)", () => {
  const images = Object.values(assets.images);

  it("has the fixed slots with their file names and sizes", () => {
    const pick = (key: string) => {
      const image = assets.images[key];
      return image ? [image.src, image.aspect, image.width, image.height] : null;
    };
    expect(pick("hero.desktop")).toEqual(["/images/hero/hero-desktop.webp", "16:9", 2400, 1350]);
    expect(pick("hero.mobiel")).toEqual(["/images/hero/hero-mobiel.webp", "4:5", 1200, 1500]);
    for (const moment of ["festival", "date-night", "kantoor-maar-niet-saai", "strand", "feestdagen"]) {
      expect(pick(`momenten.${moment}`)).toEqual([`/images/momenten/${moment}.webp`, "4:5", 1200, 1500]);
    }
    expect(pick("home.statement")).toEqual(["/images/home/statement.webp", "4:5", 1200, 1500]);
    expect(pick("home.subtiel")).toEqual(["/images/home/subtiel.webp", "4:5", 1200, 1500]);
    expect(pick("linde.portret")).toEqual(["/images/linde/portret.webp", "4:5", 1200, 1500]);
    expect(pick("linde.wachtlijst")).toEqual(["/images/linde/wachtlijst.webp", "4:5", 1200, 1500]);
    expect(pick("club.hero")).toEqual(["/images/club/club.webp", "4:5", 1200, 1500]);
    for (const stack of stacks) expect(pick(`stacks.${stack.slug}`)).toEqual([`/images/stacks/${stack.slug}.webp`, "4:5", 1200, 1500]);
    for (const drop of drops) expect(pick(`drops.${drop.slug}`)).toEqual([`/images/drops/${drop.slug}.webp`, "16:9", 2400, 1350]);
    for (let n = 1; n <= 8; n += 1) {
      const id = String(n).padStart(2, "0");
      expect(pick(`fotostrook.${id}`)).toEqual([`/images/fotostrook/${id}.webp`, "1:1", 1080, 1080]);
    }
  });

  it("keeps every key, size and ratio consistent, with alt text, label and a brief for Linde", () => {
    for (const [key, image] of Object.entries(assets.images)) {
      expect(image.key).toBe(key);
      expect(image.src, key).toMatch(/^\/images\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/);
      const [w, h] = RATIO[image.aspect];
      expect(image.width * h, key).toBe(image.height * w);
      for (const text of [image.alt, image.label, image.brief]) expect(text.trim(), key).not.toBe("");
    }
    expect(new Set(images.map((image) => image.src)).size).toBe(images.length);
  });

  it("has four 9:16 video slots with a poster", () => {
    const videos = Object.entries(assets.videos);
    expect(videos.map(([key]) => key)).toEqual(["video.01", "video.02", "video.03", "video.04"]);
    expect(home.videos.slots).toHaveLength(videos.length);
    for (const [key, video] of videos) {
      expect(video.key).toBe(key);
      expect(video.src).toMatch(/^\/videos\/sparkela-\d{2}\.mp4$/);
      expect(video.poster).toBe(video.src.replace(/\.mp4$/, "-poster.webp"));
      expect([video.width, video.height]).toEqual([1080, 1920]);
    }
  });

  it("has a folder with .gitkeep in public/images/ for every image slot", () => {
    const folders = new Set(images.map((image) => dirname(image.src)));
    for (const folder of [...folders, "/images/collecties"]) {
      expect(existsSync(join(publicDir, folder, ".gitkeep")), `public${folder}/.gitkeep`).toBe(true);
    }
  });

  it("lists in SUPPLIED only keys that exist and whose files are in public/", () => {
    for (const key of SUPPLIED) {
      const image = assets.images[key];
      const video = assets.videos[key];
      expect(image ?? video, key).toBeDefined();
      if (image) expect(existsSync(join(publicDir, image.src)), image.src).toBe(true);
      if (video) {
        expect(existsSync(join(publicDir, video.src)), video.src).toBe(true);
        expect(existsSync(join(publicDir, video.poster)), video.poster).toBe(true);
      }
    }
  });
});

describe("image keys used by content", () => {
  it("resolves every image key of the home page", () => {
    const keys = [
      home.hero.imageDesktop,
      home.hero.imageMobile,
      ...home.statementVsSubtle.columns.map((column) => column.image),
      ...home.moments.tiles.map((tile) => tile.image),
      ...home.photoStrip.items.map((item) => item.image),
      home.aboutLinde.image,
    ];
    for (const key of keys) expect(assets.images[key], key).toBeDefined();
  });

  it("links the photo strip (6 to 8 photos) to regular pieces that exist", () => {
    const items = home.photoStrip.items;
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(items.length).toBeLessThanOrEqual(8);
    for (const item of items) {
      const product = products.find((p) => p.handle === item.productHandle);
      expect(product, item.productHandle).toBeDefined();
      expect(product?.tags.some((tag) => tag.startsWith("drop:") || tag === "verborgen"), item.productHandle).toBe(false);
    }
  });

  it("resolves the image keys of drops, stacks and collections", () => {
    for (const drop of drops) expect(assets.images[drop.image], drop.image).toBeDefined();
    for (const stack of stacks) expect(assets.images[stack.image], stack.image).toBeDefined();
    for (const collection of collections) {
      if (collection.bannerImage) expect(assets.images[collection.bannerImage], collection.bannerImage).toBeDefined();
    }
  });
});

describe("docs/ASSETS.md (the shot list, plan §17.2)", () => {
  const markdown = readFileSync(fileURLToPath(new URL("../docs/ASSETS.md", import.meta.url)), "utf8");
  const rows = markdown.split("\n").filter((line) => line.startsWith("| `"));
  const rowOf = (key: string) => rows.find((row) => row.startsWith(`| \`${key}\``));

  it("names every image key with its file, ratio and size", () => {
    for (const image of Object.values(assets.images)) {
      const row = rowOf(image.key);
      expect(row, image.key).toBeDefined();
      expect(row, image.key).toContain(`\`${image.src}\``);
      expect(row, image.key).toContain(image.aspect);
      expect(row, image.key).toContain(`${image.width} × ${image.height}`);
    }
  });

  it("names every video key with its file, poster and size", () => {
    for (const video of Object.values(assets.videos)) {
      const row = rowOf(video.key);
      expect(row, video.key).toBeDefined();
      expect(row, video.key).toContain(`\`${video.src}\``);
      expect(row, video.key).toContain(`\`${video.poster}\``);
      expect(row, video.key).toContain(`${video.width} × ${video.height}`);
    }
  });

  it("says product photos in Shopify are JPEG or PNG, never WebP or AVIF", () => {
    expect(markdown).toMatch(/JPEG of PNG, nooit WebP of AVIF/);
  });
});
