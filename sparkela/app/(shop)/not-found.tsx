import type { Metadata } from "next";

import { sharedCopy } from "@/content/copy/shared";
import { NotFoundView } from "@/components/pages/NotFoundView";

/**
 * The 404 inside the shop (docs/PLAN.md §14.19, decision 201): notFound() from a shop page. The (shop) layout already
 * renders ShopChrome, so only the view.
 */
export const metadata: Metadata = {
  title: sharedCopy.notFound.metaTitle,
  robots: { index: false, follow: true },
};

export default function ShopNotFound() {
  return <NotFoundView />;
}
