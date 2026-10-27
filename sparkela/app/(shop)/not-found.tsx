import type { Metadata } from "next";

import { sharedCopy } from "@/content/copy/shared";
import { NotFoundView } from "@/components/pages/NotFoundView";

/**
 * The 404 inside the shop (docs/PLAN.md §14.19, decision 201): notFound() from a shop page. The (shop) layout already
 * renders ShopChrome, so only the view.
 */
export const metadata: Metadata = {
  title: sharedCopy.notFound.metaTitle,
  // No robots here: Next already writes <meta name="robots" content="noindex"> on every 404, and a second tag made
  // the head say it twice (integrator 10, decision 212).
};

export default function ShopNotFound() {
  return <NotFoundView />;
}
