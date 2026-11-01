import type { Metadata } from "next";
import Link from "next/link";

import { getServerNow } from "@/lib/server-clock";
import { chromeCopy } from "@/content/copy/chrome";
import { sharedCopy } from "@/content/copy/shared";
import { Logo, logoLayout } from "@/components/brand/Logo";
import { FirstPaintMarker } from "@/components/layout/FirstPaintMarker";
import { NotFoundContent } from "@/components/pages/NotFoundView";
import { MiniFooter } from "@/components/prelaunch/MiniFooter";
import { ClockProvider } from "@/components/time/ClockProvider";
import { Container } from "@/components/ui/Container";

/**
 * The root 404 (docs/PLAN.md §14.19, decisions 201 and 227): every URL without a route, and the proxy's rewrite target
 * for an unknown collection, drop or the gift wrap page (/niet-gevonden). Outside the (shop) group, in the bare shape
 * of the (kaal) pages: the header logo as a link home, NotFoundContent (H1, line, "Naar de shop", "Spark Finder",
 * "Zoeken") and the MiniFooter with the withdrawal link and the company details. notFound() inside the shop still
 * renders app/(shop)/not-found.tsx with the full chrome and Linde's favourites.
 *
 * Why bare (QA round 6): the root layout's not-found boundary is part of every page's payload. With ShopChrome in it,
 * the (kaal) pages (the waitlist, the only page before the launch, and /nieuwsbrief/bevestigen) loaded the whole shop
 * chrome: about 55 kB gzip of client chunks (cart, catalog, header nav, QuickAdd, popup) and 116 kB of RSC rows in the
 * HTML (172 kB, now 43). A catch-all route in (shop) instead gave either React error #419 in the console (the Suspense
 * 404 pattern) or a 404 without server HTML (notFound() at the top). Static; Next adds noindex. During the prelaunch
 * the proxy shows the waitlist instead.
 */
export const metadata: Metadata = {
  title: sharedCopy.notFound.metaTitle,
  // No robots here: Next already writes <meta name="robots" content="noindex"> on every 404, and a second tag made
  // the head say it twice (integrator 10, decision 212).
};

const LOGO_WIDTH = 160;
/** The logo's built-in free space, trimmed on the left so its letters line up with the H1 (as on the waitlist). */
const logoTrim = { marginLeft: -logoLayout(LOGO_WIDTH).clearSpace };

export default async function NotFound() {
  return (
    <ClockProvider serverNow={await getServerNow()}>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col bg-pagina focus:outline-none">
        <FirstPaintMarker />
        <Container className="pt-8 md:pt-12">
          <Link href="/" aria-label={chromeCopy.header.home} className="inline-flex min-h-11 items-center" style={logoTrim}>
            <Logo variant="header" width={LOGO_WIDTH} className="pointer-events-none" />
          </Link>
        </Container>
        <NotFoundContent favorites={[]} bare />
      </main>
      <MiniFooter />
    </ClockProvider>
  );
}
