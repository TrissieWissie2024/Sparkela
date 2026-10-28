import { cn } from "@/lib/cn";
import { site } from "@/content/site";

import { LOGO_SPARK_ID, LOGO_WORDMARK_ID } from "./LogoDefs";
import { CLEAR_SPACE, LOGO_BOX, SPARK_TRANSFORM, WORDMARK_BOX } from "./logo-paths";

/**
 * Colour versions of the wordmark (brief §3, docs/PLAN.md §13.1). The name says the surface the logo stands on.
 * - `header`: inkt word, roest spark (light surfaces: pagina, vlak, kaart)
 * - `op-donker`: bot-wit word, roest spark (inkt and --donker)
 * - `op-roest`: bot-wit word and spark (the primary logo)
 * - `op-botwit`: roest word and spark (the secondary logo)
 * - `op-olijf`, `op-leisteen`: bot-wit word and spark
 * - `op-steen`: inkt word, bot-wit spark
 */
export type LogoVariant = "header" | "op-donker" | "op-roest" | "op-botwit" | "op-olijf" | "op-leisteen" | "op-steen";

export interface LogoProps {
  variant?: LogoVariant;
  /**
   * Width of the logo itself in px, without the free space around it. From 70 px with the spark, from 50 to 70 px
   * without it; below 50 px use the Monogram (brief §3). The rendered <svg> adds the free space on every side.
   */
  width?: number;
  className?: string;
  /** Accessible name. Default: the brand name from content/site.ts. */
  title?: string;
  /**
   * Leave out the free space left and right (it stays above and below): for a logo whose letters must line up with
   * the text column it stands in, where the column's own margin is the free space (the footer, QA round 2).
   */
  trimInline?: boolean;
}

/** From this width the spark is drawn (brief §3: at least 70 px wide; narrower logos drop the spark). */
export const LOGO_SPARK_MIN_WIDTH = 70;
/** Below this width the wordmark is too small: use the Monogram (brief §3: under 40 px the monogram, avoid 40 to 50). */
export const LOGO_MIN_WIDTH = 50;
export const LOGO_DEFAULT_WIDTH = 120;

const VARIANT_FILLS: Record<LogoVariant, { word: string; spark: string }> = {
  header: { word: "fill-inkt", spark: "fill-roest" },
  "op-donker": { word: "fill-bot-wit", spark: "fill-roest" },
  "op-roest": { word: "fill-bot-wit", spark: "fill-bot-wit" },
  "op-botwit": { word: "fill-roest", spark: "fill-roest" },
  "op-olijf": { word: "fill-bot-wit", spark: "fill-bot-wit" },
  "op-leisteen": { word: "fill-bot-wit", spark: "fill-bot-wit" },
  "op-steen": { word: "fill-inkt", spark: "fill-bot-wit" },
};

export interface LogoLayout {
  /** Whether the spark is drawn at this width. */
  withSpark: boolean;
  /** The logo's ink box plus the free space on every side, in path units. */
  viewBox: string;
  /** Rendered size in px, free space included. */
  width: number;
  height: number;
  /** The free space on every side in px: the height of the S. Lets a layout align the ink itself, if it must. */
  clearSpace: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Size and viewBox of a logo that is `width` px wide (the ink), with the height of the S as free space around it
 * (only above and below with `trimInline`).
 */
export function logoLayout(width: number, { trimInline = false }: { trimInline?: boolean } = {}): LogoLayout {
  const withSpark = width >= LOGO_SPARK_MIN_WIDTH;
  const box = withSpark ? LOGO_BOX : WORDMARK_BOX;
  const scale = width / box.width;
  const pad = CLEAR_SPACE;
  const padX = trimInline ? 0 : pad;
  const outer = { x: box.x - padX, y: box.y - pad, width: box.width + 2 * padX, height: box.height + 2 * pad };
  return {
    withSpark,
    viewBox: [outer.x, outer.y, outer.width, outer.height].map(round).join(" "),
    width: round(outer.width * scale),
    height: round(outer.height * scale),
    clearSpace: round(pad * scale),
  };
}

/**
 * The Sparkela wordmark, inline, drawn from the shared paths in LogoDefs (app/layout.tsx). Never add a shadow, an
 * outline, another angle or stretching (brief §3); the colours come from the variant. The Monogram never stands in the
 * same header, lockup or block as this wordmark.
 */
export function Logo({ variant = "header", width = LOGO_DEFAULT_WIDTH, className, title, trimInline = false }: LogoProps) {
  if (process.env.NODE_ENV !== "production" && width < LOGO_MIN_WIDTH) {
    console.warn(`Logo: ${width}px is narrower than ${LOGO_MIN_WIDTH}px; use <Monogram> at this size (brief §3).`);
  }
  const layout = logoLayout(width, { trimInline });
  const fills = VARIANT_FILLS[variant];

  return (
    <svg
      viewBox={layout.viewBox}
      width={layout.width}
      height={layout.height}
      role="img"
      aria-label={title ?? site.name}
      className={cn("shrink-0 forced-colors:[&_use]:fill-[CanvasText]", className)}
    >
      <use href={`#${LOGO_WORDMARK_ID}`} className={fills.word} />
      {layout.withSpark ? (
        <use href={`#${LOGO_SPARK_ID}`} transform={SPARK_TRANSFORM} className={fills.spark} />
      ) : null}
    </svg>
  );
}
