import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";
import { formsCopy } from "@/content/copy/forms";
import { WaitlistHero } from "@/components/prelaunch/WaitlistHero";

/**
 * /wachtlijst (docs/PLAN.md §14.20, §11.6): during the prelaunch the proxy rewrites every shop URL here (status 200),
 * so the page is indexable with canonical "/" and the title "Sparkela | Binnenkort online". After the launch the proxy
 * sends /wachtlijst to /sparkela-club with 307. Static.
 */
export const metadata: Metadata = pageMetadata({
  title: { absolute: formsCopy.waitlist.metaTitle },
  description: formsCopy.waitlist.metaDescription,
  path: "/wachtlijst",
  canonical: "/",
});

export default function WaitlistPage() {
  return <WaitlistHero />;
}
