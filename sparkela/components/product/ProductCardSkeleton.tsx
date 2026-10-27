import { cn } from "@/lib/cn";

/**
 * Placeholder of a ProductCard for Suspense fallbacks (docs/PLAN.md §13.8): the same frame (white card, thin border,
 * 4:5 media, name, spec line, price row with a 36 px button) and the same size-container rules, so the real cards
 * replace it without a jump. The bars use the line heights of kop-4, tekst-klein and the md price (em units on the
 * same type classes). No animation (calm, and nothing to switch off for reduced motion) and hidden from screen
 * readers: the surrounding fallback says what is loading, if anything.
 */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("@container flex h-full flex-col rounded-kaart border border-rand bg-kaart", className)}
    >
      <div className="aspect-[4/5] w-full rounded-t-[calc(var(--hoek-kaart)_-_1px)] bg-vlak" />
      <div className="flex flex-1 flex-col px-3 pb-3 @min-[15rem]:px-4 @min-[15rem]:pb-4">
        <div className="kop-4 pt-3 @min-[15rem]:pt-4">
          <span className="block h-[1.35em] w-3/4 rounded-full bg-vlak" />
        </div>
        <div className="tekst-klein mt-1">
          <span className="block h-[1.45em] w-1/2 rounded-full bg-vlak" />
        </div>
        <div
          className={cn(
            "mt-auto flex items-center justify-between gap-3 pt-3",
            "@max-[14.5rem]:flex-col @max-[14.5rem]:items-stretch @max-[14.5rem]:gap-2.5",
          )}
        >
          <span className="block h-6 w-16 rounded-full bg-vlak" />
          <span className="block h-9 w-24 rounded-full bg-vlak @max-[14.5rem]:w-full" />
        </div>
      </div>
    </div>
  );
}
