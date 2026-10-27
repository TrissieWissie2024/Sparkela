import type { Metadata } from "next";
import { Suspense } from "react";

import { pageMetadata } from "@/lib/seo";
import { formsCopy } from "@/content/copy/forms";
import { Logo } from "@/components/brand/Logo";
import { ConfirmFallback, ConfirmSubscription } from "@/components/forms/ConfirmSubscription";
import { Container } from "@/components/ui/Container";

/**
 * /nieuwsbrief/bevestigen (docs/PLAN.md §14.21, §15.3): the second step of the double opt-in. Static and noindex, open
 * during the prelaunch. The token comes from ?t= in the browser only (ConfirmSubscription inside Suspense; the server
 * never reads search params), and one button confirms: never on load.
 */
export const metadata: Metadata = pageMetadata({
  title: formsCopy.confirm.metaTitle,
  description: formsCopy.confirm.metaDescription,
  path: "/nieuwsbrief/bevestigen",
  noindex: true,
});

export default function ConfirmPage() {
  const copy = formsCopy.confirm;
  return (
    <section data-vlak="donker" aria-labelledby="bevestigen-titel" className="flex-1 bg-donker text-tekst-op-donker">
      <Container className="max-w-[44rem] py-10 md:py-14 lg:py-16">
        <Logo variant="op-donker" width={160} />
        <h1 id="bevestigen-titel" className="kop-1 mt-8 md:mt-10">
          {copy.title}
        </h1>
        <p className="tekst-groot mt-4 text-tekst-2-op-donker">{copy.intro}</p>
        <div className="mt-8">
          <Suspense fallback={<ConfirmFallback />}>
            <ConfirmSubscription />
          </Suspense>
        </div>
      </Container>
    </section>
  );
}
