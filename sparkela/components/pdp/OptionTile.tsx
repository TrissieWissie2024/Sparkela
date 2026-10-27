import { Check } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Shared shape of the selectable tiles on the product page (port of CORVANE optionTileClasses and RadioMark in
 * BundlePicker.tsx): a <label> around a visually hidden native radio. Unselected: a 1 px --rand-invoer border (3:1,
 * WCAG 1.4.11). Selected: a 2 px border in --tekst, drawn as an inset shadow over the 1 px border so the content never
 * moves, plus a check mark (never colour alone, plan §4.8). Keyboard focus: an outline outside the tile in the focus
 * colour, a different shape from the selection. Server-compatible.
 */

/** Classes of a tile; `shape` "pill" for swatches and sizes, "card" for the larger tiles. */
export function optionTileClasses(selected: boolean, shape: "pill" | "card" = "card", disabled = false): string {
  return cn(
    "relative border bg-kaart transition-[border-color,box-shadow] duration-200 ease-out",
    shape === "pill" ? "rounded-full" : "rounded-kaart",
    selected ? "border-tekst shadow-[inset_0_0_0_1px_var(--tekst)]" : "border-rand-invoer",
    disabled ? "cursor-not-allowed" : "cursor-pointer",
    !selected && !disabled && "hover:border-tekst",
    "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:[outline-color:var(--ring)] has-focus-visible:outline-solid",
  );
}

/** Round radio mark: an empty ring, or filled --tekst with a check. */
export function RadioMark({ selected, className }: { selected: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full",
        selected
          ? "bg-tekst text-kaart forced-colors:border forced-colors:border-current"
          : "border-[1.5px] border-rand-invoer group-hover:border-tekst",
        className,
      )}
    >
      {selected ? <Check className="size-3" strokeWidth={3} /> : null}
    </span>
  );
}

/** The check in the corner of a selected size or amount tile (absolute, so the tile never changes width). */
export function CornerCheck() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-tekst text-kaart ring-2 ring-pagina forced-colors:border forced-colors:border-current"
    >
      <Check className="size-3" strokeWidth={3} />
    </span>
  );
}
