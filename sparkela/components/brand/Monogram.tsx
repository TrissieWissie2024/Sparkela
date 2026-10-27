import { cn } from "@/lib/cn";
import { site } from "@/content/site";

import { LOGO_S_ID, LOGO_SPARK_ID } from "./LogoDefs";
import { MONOGRAM_SPARK_TRANSFORM, MONOGRAM_TILE, MONOGRAM_TILE_VIEWBOX, MONOGRAM_VIEWBOX } from "./logo-paths";

/**
 * Colour versions of the monogram (docs/PLAN.md §13.1). Without a tile:
 * - `inkt`: inkt S, roest spark (light surfaces)
 * - `botwit`: bot-wit S and spark (roest, olijf and leisteen surfaces)
 * - `roest`: roest S and spark (bot-wit surfaces)
 * On their own tile (a square with 20% rounded corners, as the app icon):
 * - `botwit-op-roest`: bot-wit S and spark on roest
 * - `botwit-op-inkt`: bot-wit S and roest spark on inkt (the favicon)
 */
export type MonogramVariant = "inkt" | "botwit" | "roest" | "botwit-op-roest" | "botwit-op-inkt";

export interface MonogramProps {
  variant?: MonogramVariant;
  /** Width and height in px. */
  size?: number;
  className?: string;
}

export const MONOGRAM_DEFAULT_SIZE = 32;

const VARIANTS: Record<MonogramVariant, { letter: string; spark: string; tile: string | null }> = {
  inkt: { letter: "fill-inkt", spark: "fill-roest", tile: null },
  botwit: { letter: "fill-bot-wit", spark: "fill-bot-wit", tile: null },
  roest: { letter: "fill-roest", spark: "fill-roest", tile: null },
  "botwit-op-roest": { letter: "fill-bot-wit", spark: "fill-bot-wit", tile: "fill-roest" },
  "botwit-op-inkt": { letter: "fill-bot-wit", spark: "fill-roest", tile: "fill-inkt" },
};

/**
 * The monogram: the slanted S with its spark (brief §3). Only for the favicon, app icons, an avatar and places
 * narrower than 40 px; never next to the wordmark in the same header, lockup or block. Draws the shared paths from
 * LogoDefs (app/layout.tsx).
 */
export function Monogram({ variant = "inkt", size = MONOGRAM_DEFAULT_SIZE, className }: MonogramProps) {
  const colors = VARIANTS[variant];

  return (
    <svg
      viewBox={colors.tile ? MONOGRAM_TILE_VIEWBOX : MONOGRAM_VIEWBOX}
      width={size}
      height={size}
      role="img"
      aria-label={site.name}
      className={cn(
        "shrink-0 forced-colors:[&_rect]:fill-[Canvas] forced-colors:[&_use]:fill-[CanvasText]",
        className,
      )}
    >
      {colors.tile ? (
        <rect
          x={MONOGRAM_TILE.x}
          y={MONOGRAM_TILE.y}
          width={MONOGRAM_TILE.width}
          height={MONOGRAM_TILE.height}
          rx={MONOGRAM_TILE.radius}
          className={colors.tile}
        />
      ) : null}
      <use href={`#${LOGO_S_ID}`} className={colors.letter} />
      <use href={`#${LOGO_SPARK_ID}`} transform={MONOGRAM_SPARK_TRANSFORM} className={colors.spark} />
    </svg>
  );
}
