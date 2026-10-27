import type { Metadata } from "next";

import { sharedCopy } from "@/content/copy/shared";
import { ShopChrome } from "@/components/layout/ShopChrome";
import { NotFoundView } from "@/components/pages/NotFoundView";

/**
 * The root 404 (docs/PLAN.md §14.19, decision 201): every URL without a route. It sits outside the (shop) route group,
 * so it puts ShopChrome around NotFoundView itself (header, footer with the withdrawal link, cart). Static; Next adds
 * noindex. During the prelaunch the proxy shows the waitlist instead.
 */
export const metadata: Metadata = {
  title: sharedCopy.notFound.metaTitle,
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <ShopChrome>
      <NotFoundView />
    </ShopChrome>
  );
}
