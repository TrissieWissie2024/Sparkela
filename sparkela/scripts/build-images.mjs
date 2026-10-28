// Writes the width variants of the site's own photos and video posters (docs/PLAN.md §17.1, docs/ASSETS.md §2;
// QA round 3). Runs before every build and `next dev` (package.json prebuild, predev, build:test) and on its own with
// `npm run images`.
//
// For every master under public/images/ and every poster public/videos/*-poster.webp it writes
// public/_img/<width>/<path of the master> for each width of SITE_IMAGE_WIDTHS (lib/site-image-variants.mjs): scaled
// down with sharp in the master's own format, or a plain copy of the master where the step is as wide or wider (never
// enlarged). lib/image-loader.ts asks for exactly these files. A variant newer than its master is kept; variants of a
// master that no longer exists are removed. public/_img/ is generated and never committed.

import { copyFile, mkdir, readdir, rm, rmdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

import { hasSiteVariants, SITE_IMAGE_WIDTHS, VARIANT_DIR } from "../lib/site-image-variants.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");

/** Encoder settings per format: quality 80 keeps a photo sharp at about a third of the bytes of quality 100. */
const ENCODE = {
  webp: (image) => image.webp({ quality: 80 }),
  jpeg: (image) => image.jpeg({ quality: 80, mozjpeg: true }),
  png: (image) => image.png({ compressionLevel: 9 }),
};

/** All files under a folder, as paths relative to public/ with a leading slash ("/images/hero/hero-desktop.webp"). */
async function walk(publicDir, folder) {
  const absolute = path.join(publicDir, folder);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const relative = `${folder}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await walk(publicDir, relative)));
    else if (entry.isFile()) files.push(`/${relative}`);
  }
  return files;
}

/** Removes empty folders under `folder` (bottom up); returns whether `folder` itself is now empty. */
async function pruneEmpty(folder) {
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch {
    return false;
  }
  let empty = true;
  for (const entry of entries) {
    if (entry.isDirectory() && (await pruneEmpty(path.join(folder, entry.name)))) await rmdir(path.join(folder, entry.name));
    else empty = false;
  }
  return empty;
}

async function mtime(file) {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    return null;
  }
}

function formatOf(src) {
  const extension = path.extname(src).slice(1).toLowerCase();
  return extension === "jpg" ? "jpeg" : extension;
}

/**
 * Writes the variants of every master under `publicDir` and removes orphans. Returns counts, for the log and the test.
 * @param {string} [publicDir]
 */
export async function buildImages(publicDir = PUBLIC) {
  const masters = [...(await walk(publicDir, "images")), ...(await walk(publicDir, "videos"))].filter(hasSiteVariants);
  let written = 0;
  let kept = 0;

  for (const src of masters) {
    const masterFile = path.join(publicDir, src);
    const masterTime = await mtime(masterFile);
    const { width: masterWidth = 0 } = await sharp(masterFile).metadata();
    for (const step of SITE_IMAGE_WIDTHS) {
      const target = path.join(publicDir, VARIANT_DIR, String(step), src);
      const targetTime = await mtime(target);
      if (targetTime !== null && masterTime !== null && targetTime >= masterTime) {
        kept += 1;
        continue;
      }
      await mkdir(path.dirname(target), { recursive: true });
      if (masterWidth === 0 || step >= masterWidth) {
        await copyFile(masterFile, target);
      } else {
        const encode = ENCODE[formatOf(src)] ?? ENCODE.webp;
        await encode(sharp(masterFile).resize({ width: step, withoutEnlargement: true })).toFile(target);
      }
      written += 1;
    }
  }

  // Variants whose master is gone.
  const known = new Set(masters);
  let removed = 0;
  for (const step of SITE_IMAGE_WIDTHS) {
    const stepDir = `${VARIANT_DIR}/${step}`;
    for (const file of await walk(publicDir, stepDir)) {
      const src = file.slice(stepDir.length + 1);
      if (!known.has(src)) {
        await rm(path.join(publicDir, file));
        removed += 1;
      }
    }
  }

  await pruneEmpty(path.join(publicDir, VARIANT_DIR));

  return { masters: masters.length, written, kept, removed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await buildImages();
  console.log(
    `build-images: ${result.masters} masters, ${result.written} variants written, ${result.kept} up to date, ${result.removed} removed`,
  );
}
