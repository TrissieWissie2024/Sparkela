import type { ButtonVariant } from "@/components/ui/Button";

/**
 * The two surfaces the Spark Finder sits on (docs/PLAN.md §13.11, §14.1 section 12, §14.5). Port of CORVANE
 * components/finder/tones.ts in Sparkela's tokens:
 * - "donker": the home block, a dark band (data-vlak="donker", so focus rings turn bot-wit) with a warm dark panel.
 * - "licht": the /spark-finder page, a white card with a hairline on the page surface.
 *
 * Option tiles take their selected look from :has(:checked), so a choice made before hydration already shows. The
 * selected state is never colour alone: the tile fills, its border thickens and the round mark gets a check (plan §4.8).
 * Roest stays the only filled button colour (brief §5): "Volgende" is `primair` on both surfaces.
 */
export type FinderTone = "licht" | "donker";

export interface FinderToneClasses {
  panel: string;
  strong: string;
  soft: string;
  rule: string;
  /** The option tile (a <label> around a visually hidden radio); the label is the `group`. */
  tile: string;
  /** The round mark inside a tile. */
  mark: string;
  progress: "licht" | "donker";
  back: ButtonVariant;
  /** Tone of nested primitives (SectionHeading, SubscribeForm, Pill). */
  surface: "licht" | "donker";
}

const tileBase =
  "group relative flex min-h-14 cursor-pointer items-center gap-3.5 rounded-kaart border px-4 py-3 text-left " +
  "text-[0.9375rem] leading-snug font-medium transition-[background-color,border-color,box-shadow,color] duration-200 " +
  "ease-out sm:min-h-[4.5rem] sm:px-5 lg:min-h-20 sm:odd:last:col-span-2 " +
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-solid has-focus-visible:outline-(--ring)";

const markBase =
  "flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-200 " +
  "forced-colors:border-current";

export const finderTones: Record<FinderTone, FinderToneClasses> = {
  donker: {
    panel: "border border-rand-op-donker bg-bot-wit-900/60",
    strong: "text-tekst-op-donker",
    soft: "text-tekst-2-op-donker",
    rule: "border-rand-op-donker",
    tile:
      `${tileBase} border-rand-op-donker bg-donker/40 text-tekst-op-donker hover:border-bot-wit-400 ` +
      "has-checked:border-bot-wit has-checked:bg-bot-wit has-checked:text-inkt",
    // bot-wit-400 on donker is about 7.6:1 (WCAG 1.4.11); checked: an inkt disc with a bot-wit check.
    mark:
      `${markBase} border-bot-wit-400 text-bot-wit group-hover:border-bot-wit ` +
      "group-has-checked:border-inkt group-has-checked:bg-inkt",
    progress: "donker",
    back: "ghost",
    surface: "donker",
  },
  licht: {
    panel: "border border-rand bg-kaart",
    strong: "text-tekst",
    soft: "text-tekst-2",
    rule: "border-rand",
    tile:
      `${tileBase} border-rand bg-pagina text-tekst hover:border-tekst ` +
      "has-checked:border-tekst has-checked:bg-kaart has-checked:shadow-[inset_0_0_0_1px_var(--tekst)]",
    // --rand-invoer is 3:1 on white and on --pagina (WCAG 1.4.11).
    mark:
      `${markBase} border-rand-invoer text-bot-wit group-hover:border-tekst ` +
      "group-has-checked:border-inkt group-has-checked:bg-inkt",
    progress: "licht",
    back: "ghost",
    surface: "licht",
  },
};
