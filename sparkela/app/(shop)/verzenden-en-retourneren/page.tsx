import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";
import { LegalPage, legalPage } from "@/components/legal/LegalPage";
import { UpcomingHolidays } from "@/components/legal/UpcomingHolidays";

/**
 * /verzenden-en-retourneren (docs/PLAN.md §14.13): rates, the 16.00 cut-off, the holidays without dispatch, 14 days to
 * withdraw, the hygiene rule, how to withdraw (/herroepen) and the 6-month discolouration guarantee. Every amount, time
 * and number of days in the text comes from content/shipping.ts and content/site.ts (legalVariables). Static, open
 * during the prelaunch.
 */
const page = legalPage("verzenden-en-retourneren");

export const metadata: Metadata = pageMetadata({
  title: page.title,
  description: page.description,
  path: "/verzenden-en-retourneren",
});

export default function ShippingPage() {
  return (
    <LegalPage slug="verzenden-en-retourneren">
      <UpcomingHolidays />
    </LegalPage>
  );
}
