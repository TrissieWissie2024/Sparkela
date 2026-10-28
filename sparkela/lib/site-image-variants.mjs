// Width variants of the site's own photos and video posters (docs/PLAN.md §17.1, §17.2; QA round 3).
//
// Linde supplies one master per slot at the size docs/ASSETS.md lists (1200 × 1500, 2400 × 1350, 1080 × 1080, …).
// `npm run images` (scripts/build-images.mjs, also run before every build and `next dev`) writes every master at each
// width of the ladder below to public/_img/<width>/<path of the master>. lib/image-loader.ts then maps the width that
// next/image asks for to the smallest step that is at least that wide, so a 96 px menu thumbnail fetches the 256 px
// file instead of the 2400 px master, and one step is always one URL (no `?w=` copies of the same file).
// Plain JS, so the build script (Node) and the loader (browser) share it; it imports nothing.

/** The widths written for every site photo and poster. A step at or above the master's width is the master itself. */
export const SITE_IMAGE_WIDTHS = Object.freeze([256, 384, 640, 828, 1200, 1920, 2400]);

/** Folder under public/ with the generated variants. Never committed (.gitignore). */
export const VARIANT_DIR = "_img";

/** Whether `src` is a site master with variants: a local photo under /images/ or a video poster under /videos/. */
export function hasSiteVariants(src) {
  return /^\/(?:images\/[^?#]+|videos\/[^/?#]+-poster)\.(?:webp|jpe?g|png)$/i.test(src);
}

/** The ladder step for a requested width: the smallest step at least that wide, else the largest. */
export function variantWidth(width) {
  return SITE_IMAGE_WIDTHS.find((step) => step >= width) ?? SITE_IMAGE_WIDTHS[SITE_IMAGE_WIDTHS.length - 1];
}

/** "/images/hero/hero-desktop.webp" at 700 → "/_img/828/images/hero/hero-desktop.webp". */
export function siteVariantPath(src, width) {
  return `/${VARIANT_DIR}/${variantWidth(width)}${src}`;
}
