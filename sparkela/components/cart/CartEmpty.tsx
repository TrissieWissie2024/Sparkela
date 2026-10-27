import { cartCopy } from "@/content/copy/cart";
import { Spark } from "@/components/brand/Spark";
import { Button } from "@/components/ui/Button";

/**
 * The empty cart (docs/PLAN.md §13.7, §14.4; brief §6 cart drawer): three sparks, the heading "Je tas is nog leeg",
 * one line, the primary button "Shop nieuw" and the link "Bekijk alles". The heading takes focus after the last line
 * was removed (tabIndex -1, id from the drawer). No hooks, so it renders anywhere; `onNavigate` lets the drawer close
 * when a link leads to the page that is already open. Port of the empty state in CORVANE components/cart/CartDrawer.tsx.
 */
export function CartEmpty({ headingId, onNavigate }: { headingId?: string; onNavigate?: () => void }) {
  const copy = cartCopy.empty;
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-2 py-10 text-center">
      <div aria-hidden="true" className="mb-8 flex items-end justify-center gap-3 text-roest">
        <Spark className="size-7" />
        <Spark className="size-11" />
        <Spark className="size-7" />
      </div>
      <h3 id={headingId} tabIndex={-1} className="kop-2 text-tekst">
        {copy.title}
      </h3>
      <p className="mt-3 max-w-[20rem] text-[0.9375rem] leading-relaxed text-tekst-2">{copy.text}</p>
      <Button href={copy.cta.href} variant="primair" size="md" className="mt-8 min-w-[13rem]" onClick={onNavigate}>
        {copy.cta.label}
      </Button>
      <Button href={copy.secondary.href} variant="link" size="md" className="mt-4" onClick={onNavigate}>
        {copy.secondary.label}
      </Button>
    </div>
  );
}
