import { cn } from "@/lib/cn";
import { collectionCopy } from "@/content/copy/collection";
import { Spark } from "@/components/brand/Spark";
import { Button } from "@/components/ui/Button";

/**
 * A collection without products (docs/PLAN.md §14.3 "lege staat"), as opposed to filters that leave nothing (that
 * state lives in CollectionView). "limited" while no drop is publicly live points to the Club, where the next drop is
 * announced first; every other collection points to all jewellery. No filter bar and no count: there is nothing to
 * filter. Server component.
 */
export function CollectionEmpty({ variant = "default", className }: { variant?: "default" | "limited"; className?: string }) {
  const copy = variant === "limited" ? collectionCopy.emptyLimited : collectionCopy.emptyCollection;
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-4 rounded-kaart border border-rand bg-kaart px-6 py-10 md:items-center md:px-10 md:py-16 md:text-center",
        className,
      )}
    >
      <Spark className="size-7 text-roest" />
      <h2 className="kop-3 text-tekst">{copy.title}</h2>
      <p className="max-w-[32rem] text-tekst-2">{copy.text}</p>
      <Button href={copy.cta.href} variant="primair" className="mt-2">
        {copy.cta.label}
      </Button>
    </div>
  );
}
