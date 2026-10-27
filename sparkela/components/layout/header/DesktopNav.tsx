"use client";

import Link from "next/link";
import { useState } from "react";

import type { NavItem } from "@/lib/types";
import { cn } from "@/lib/cn";
import { chromeCopy } from "@/content/copy/chrome";

import { isCurrentPage, momentImages } from "./nav";
import { NavDisclosure } from "./NavDisclosure";
import { PathnameWatcher } from "./PathnameWatcher";

/**
 * The horizontal main navigation from xl (docs/PLAN.md §2.5, §13.5, decision 40): Nieuw, Oorbellen, Armbanden,
 * Kettingen, Ringen, Shop per moment (expands), Limited, Cadeaus (expands), from content/navigation.ts mainNav.
 *
 * Links get a hairline underline that grows from the left in 300 ms on hover and on the current page (motion-safe
 * only); the current page also gets aria-current="page". The two groups are NavDisclosures. The current pathname
 * comes from PathnameWatcher after mount (usePathname() must not run during the prerender of the shared layout), so
 * the static HTML has no aria-current; the browser adds it at once. Port of CORVANE
 * components/layout/header/DesktopNav.tsx, plus the disclosure groups.
 */
export function DesktopNav({ items, className }: { items: NavItem[]; className?: string }) {
  const [pathname, setPathname] = useState<string | null>(null);

  return (
    <nav aria-label={chromeCopy.header.mainNavLabel} className={className}>
      <PathnameWatcher onChange={setPathname} />
      <ul className="flex items-center justify-center gap-5 2xl:gap-7">
        {items.map((item) => {
          if (item.kind === "group") {
            return (
              <li key={item.id}>
                <NavDisclosure group={item} images={momentImages(item)} closeSignal={pathname} />
              </li>
            );
          }
          const current = isCurrentPage(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "group relative inline-flex h-11 items-center px-1 text-sm font-medium whitespace-nowrap transition-colors",
                  current ? "text-tekst" : "text-tekst/80 hover:text-tekst",
                )}
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-1 bottom-2 h-px origin-left bg-tekst motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out",
                    current ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
