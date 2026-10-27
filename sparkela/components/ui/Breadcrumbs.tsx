import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { Crumb } from "@/lib/types";
import { cn } from "@/lib/cn";
import { sharedCopy } from "@/content/copy/shared";

/**
 * Breadcrumb trail (plan §13.2): <nav aria-label="Kruimelpad"> with an ordered list. A crumb with `href` is a link;
 * the last crumb without `href` is the current page (aria-current="page"). Separators are decorative. Links have a
 * 44 px touch target; the trail wraps on narrow screens instead of scrolling. JSON-LD for the same trail comes from
 * breadcrumbJsonLd() in lib/seo.ts (the page renders it).
 */

export interface BreadcrumbsProps {
  items: Crumb[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;
  return (
    <nav aria-label={sharedCopy.ui.breadcrumbs} className={cn("tekst-klein text-tekst-2", className)}>
      <ol className="flex flex-wrap items-center gap-x-1">
        {items.map((crumb, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${index}-${crumb.label}`} className="flex min-w-0 items-center gap-x-1">
              {crumb.href && !last ? (
                <Link
                  href={crumb.href}
                  className="relative inline-flex min-h-11 items-center text-link underline-offset-4 before:absolute before:inset-y-0 before:-inset-x-1.5 before:content-[''] hover:text-link-hover hover:underline"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn("inline-flex min-h-11 items-center", last && "text-tekst")}>
                  {crumb.label}
                </span>
              )}
              {last ? null : <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.5} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
