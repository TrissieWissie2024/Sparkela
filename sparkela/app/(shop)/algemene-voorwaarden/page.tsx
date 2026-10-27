import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";
import { LegalPage, legalPage } from "@/components/legal/LegalPage";

/** /algemene-voorwaarden (docs/PLAN.md §14.16): the legal text from content/legal/algemene-voorwaarden.md. Static, open during the prelaunch. */
const page = legalPage("algemene-voorwaarden");

export const metadata: Metadata = pageMetadata({ title: page.title, description: page.description, path: "/algemene-voorwaarden" });

export default function TermsPage() {
  return <LegalPage slug="algemene-voorwaarden" />;
}
