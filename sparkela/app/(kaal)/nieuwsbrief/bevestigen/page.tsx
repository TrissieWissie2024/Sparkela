import type { Metadata } from "next";
import { Suspense } from "react";

import { pageMetadata } from "@/lib/seo";
import { formsCopy } from "@/content/copy/forms";
import { Logo, logoLayout } from "@/components/brand/Logo";
import { ConfirmFallback, ConfirmSubscription } from "@/components/forms/ConfirmSubscription";
import { Container } from "@/components/ui/Container";

/**
 * /nieuwsbrief/bevestigen (docs/PLAN.md §14.21, §15.3): the second step of the double opt-in. Static and noindex, open
 * during the prelaunch. The token comes from ?t= in the browser only (ConfirmSubscription inside Suspense; the server
 * never reads search params), and one button confirms: never on load.
 */
const LOGO_WIDTH = 160;

export const metadata: Metadata = pageMetadata({
  title: formsCopy.confirm.metaTitle,
  description: formsCopy.confirm.metaDescription,
  path: "/nieuwsbrief/bevestigen",
  noindex: true,
});

export default function ConfirmPage() {
  return (
    <section data-vlak="donker" className="flex-1 bg-donker text-tekst-op-donker">
      <Container className="py-10 md:py-14 lg:py-16">
        {/* A 44rem column on the container's left edge, in line with the MiniFooter (as the waitlist). */}
        <div className="max-w-[44rem]">
        {/* The logo's built-in free space trimmed on the left, so its letters line up with the H1 (as on the waitlist). */}
        <div style={{ marginLeft: -logoLayout(LOGO_WIDTH).clearSpace }}>
          <Logo variant="op-donker" width={LOGO_WIDTH} />
        </div>
        {/* H1 and intro follow the state (button, invalid link, confirmed): ConfirmSubscription renders them. */}
        <Suspense fallback={<ConfirmFallback />}>
          <ConfirmSubscription />
        </Suspense>
        </div>
      </Container>
    </section>
  );
}
