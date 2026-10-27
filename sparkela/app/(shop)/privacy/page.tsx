import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";
import { LegalPage, legalPage } from "@/components/legal/LegalPage";

/** /privacy (docs/PLAN.md §14.16): the legal text from content/legal/privacy.md. Static, open during the prelaunch. */
const page = legalPage("privacy");

export const metadata: Metadata = pageMetadata({ title: page.title, description: page.description, path: "/privacy" });

export default function PrivacyPage() {
  return <LegalPage slug="privacy" />;
}
