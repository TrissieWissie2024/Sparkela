import { breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

import { PageHeader, type PageHeaderProps } from "./PageHeader";

export interface IndexedPageHeaderProps extends PageHeaderProps {
  /** The page's own path ("/stacks"): the last crumb (without href) points there. */
  path: string;
}

/**
 * PageHeader for an indexable content or service page: the visible trail is also BreadcrumbList JSON-LD, the same
 * trail (QA round 5, brief §7; lib/seo.ts breadcrumbJsonLd). Before, only collections and product pages had it.
 * Server only (lib/seo.ts reads the environment); noindex pages (search, checkout, account) use PageHeader.
 */
export function IndexedPageHeader({ path, ...props }: IndexedPageHeaderProps) {
  const crumbs = props.breadcrumbs ?? [];
  return (
    <>
      {crumbs.length > 0 ? (
        <JsonLd data={breadcrumbJsonLd(crumbs.map((crumb) => ({ name: crumb.label, path: crumb.href ?? path })))} />
      ) : null}
      <PageHeader {...props} />
    </>
  );
}
