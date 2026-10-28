import { pagesCopy } from "@/content/copy/pages";
import { Spark } from "@/components/brand/Spark";

/**
 * The three Club benefits (first at every drop, 24 hours early access, 10% on the first order) under the H2 "Dit
 * krijg je": hairline rows with a roest spark in a roest-100 circle. Shared by /sparkela-club and the drop teaser (QA
 * round 3), so both say it the same way. Server component.
 */
export function ClubBenefits({ headingId, className }: { headingId: string; className?: string }) {
  const copy = pagesCopy.club;
  return (
    <section aria-labelledby={headingId} className={className}>
      <h2 id={headingId} className="kop-2 text-tekst">
        {copy.benefitsTitle}
      </h2>
      <ul className="mt-5 border-t border-rand">
        {copy.benefits.map((benefit) => (
          <li key={benefit.title} className="flex items-start gap-4 border-b border-rand py-4 md:py-5">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-roest-100 text-roest">
              <Spark className="size-4" />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="kop-4 block text-tekst">{benefit.title}</span>
              <span className="tekst-klein mt-0.5 block text-tekst-2">{benefit.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
