import Link from "next/link";
import type { ComponentProps } from "react";

import { needsFullPageLoad } from "@/lib/paths";

export type SiteLinkProps = Omit<ComponentProps<"a">, "href"> & { href: string };

/**
 * An internal link for navigation lists (footer, mobile menu): next/link, except for a path that leaves the app
 * (needsFullPageLoad, /account): then a plain anchor, so there is no prefetch and no RSC fetch that would follow the
 * proxy's redirect to Shopify (QA round 5).
 */
export function SiteLink({ href, ...rest }: SiteLinkProps) {
  if (needsFullPageLoad(href)) return <a href={href} {...rest} />;
  return <Link href={href} {...rest} />;
}
