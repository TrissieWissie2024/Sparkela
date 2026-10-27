"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import type { MobileNavFeature, NavLink } from "@/lib/types";
import { defaultVariant } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { stackQuote } from "@/lib/pricing";
import { dropPath } from "@/lib/paths";
import { chromeCopy } from "@/content/copy/chrome";
import { sharedCopy } from "@/content/copy/shared";
import { mobileNav } from "@/content/navigation";
import { Logo } from "@/components/brand/Logo";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { Sheet } from "@/components/ui/Sheet";

import { isCurrentPage } from "./header/nav";

/**
 * The sheet of the mobile menu below xl (docs/PLAN.md §2.5, §13.5), loaded lazily by MobileNav, which owns the open
 * state. A Sheet from the left on vlak, 352 px (never wider than the viewport minus 24 px), with in this order:
 * 1. the main links (mobileNav.primary) in Unbounded 700, 20 px, 52 px high;
 * 2. the two expanding groups Shop per moment and Cadeaus (Radix Accordion, type "multiple"), with "Liever subtiel?";
 * 3. the service links under a hairline;
 * 4. the featured card: the drop that is publicly live, else Linde's first stack (`feature`, decided on the server).
 * Radix gives the focus trap, Escape and the overlay click; focus returns to the hamburger (Sheet). The current page
 * gets aria-current="page" and a small dot (shape, never colour alone). A link closes the menu, and so does any other
 * route change (the back button). Port of CORVANE components/layout/MobileNavSheet.tsx.
 */

export interface MobileNavSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Called when a link in the menu is followed, and on any route change while the menu is mounted. */
  onNavigate(): void;
  feature: MobileNavFeature | null;
}

function CurrentDot() {
  return (
    <span className="inline-flex shrink-0 items-center">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-roest" />
      <span className="sr-only">{chromeCopy.menu.current}</span>
    </span>
  );
}

/** Unbounded 700, 20 px, 52 px high (plan §2.5), for the main links and the two group triggers. */
const primaryClasses = "flex min-h-[52px] items-center gap-3 font-display text-xl leading-tight font-bold text-tekst";
const primaryLinkClasses = cn(primaryClasses, "decoration-1 underline-offset-4 hover:underline");

function SubLink({ link, pathname, onNavigate }: { link: NavLink; pathname: string | null; onNavigate(): void }) {
  const current = isCurrentPage(pathname, link.href);
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className="flex min-h-11 items-center gap-2.5 text-[0.9375rem] text-tekst underline-offset-4 hover:underline"
    >
      {link.label}
      {current ? <CurrentDot /> : null}
    </Link>
  );
}

/** The featured card at the bottom of the menu: a live drop, or one of Linde's stacks with its real stack price. */
export function MobileNavFeatureCard({ feature, onNavigate }: { feature: MobileNavFeature; onNavigate(): void }) {
  const card =
    "group mt-8 flex items-center gap-4 rounded-kaart border border-rand bg-kaart p-3 pr-4 text-tekst transition-shadow duration-200 [@media(hover:hover)]:hover:shadow-hover";

  if (feature.kind === "drop") {
    const { drop } = feature;
    return (
      <Link href={dropPath(drop.slug)} onClick={onNavigate} className={card}>
        <div className="w-[4.5rem] shrink-0 overflow-hidden rounded-[10px]">
          <PhotoSlot assetKey={drop.image} label={drop.name} alt="" aspect="4:5" sizes="72px" />
        </div>
        <span className="min-w-0 flex-1">
          <span className="label-caps block text-tekst-2">{chromeCopy.menu.featureDropEyebrow}</span>
          <span className="kop-3 mt-1 block decoration-1 underline-offset-4 group-hover:underline">{drop.name}</span>
          <span className="tekst-klein mt-0.5 block text-tekst-2">{drop.tagline}</span>
        </span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
      </Link>
    );
  }

  const { stack, products } = feature;
  const quote = stackQuote(products.map((product) => ({ price: defaultVariant(product).price.cents, type: product.type })));
  return (
    <Link href="/stacks" onClick={onNavigate} className={card}>
      <div className="w-[4.5rem] shrink-0 overflow-hidden rounded-[10px]">
        <PhotoSlot assetKey={stack.image} label={stack.name} alt="" aspect="4:5" sizes="72px" />
      </div>
      <span className="min-w-0 flex-1">
        <span className="label-caps block text-tekst-2">{chromeCopy.menu.featureStackEyebrow}</span>
        <span className="kop-3 mt-1 block decoration-1 underline-offset-4 group-hover:underline">{stack.name}</span>
        <span className="tekst-klein mt-0.5 block text-tekst-2">{chromeCopy.menu.featureStackLine}</span>
        {products.length > 0 ? (
          <span className="tabular mt-1 block text-sm font-semibold">
            {chromeCopy.menu.featureStackTotal(formatMoney(quote.total))}
          </span>
        ) : null}
      </span>
      <ArrowRight aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
    </Link>
  );
}

export function MobileNavSheet({ open, onOpenChange, onNavigate, feature }: MobileNavSheetProps) {
  const pathname = usePathname();

  // Any route change closes the menu (also the back button); the first render is not a change.
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    onNavigate();
  }, [pathname, onNavigate]);

  return (
    <Sheet
      side="left"
      size="sm"
      surface="vlak"
      open={open}
      onOpenChange={onOpenChange}
      title={sharedCopy.ui.menu}
      hideTitle
      closeLabel={chromeCopy.menu.close}
      headerExtra={<Logo variant="header" width={104} className="-ml-3" />}
      className="w-[min(calc(100vw-1.5rem),22rem)]!"
      bodyClassName="flex flex-col"
    >
      <nav aria-label={chromeCopy.header.mainNavLabel}>
        <ul className="-mt-1 flex flex-col">
          {mobileNav.primary.map((link) => {
            const current = isCurrentPage(pathname, link.href);
            return (
              <li key={link.href}>
                <Link href={link.href} onClick={onNavigate} aria-current={current ? "page" : undefined} className={primaryLinkClasses}>
                  {link.label}
                  {current ? <CurrentDot /> : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <Accordion.Root type="multiple" className="mt-2 border-t border-rand">
          {mobileNav.groups.map((group) => (
            <Accordion.Item key={group.id} value={group.id} className="border-b border-rand">
              <Accordion.Header className="m-0">
                <Accordion.Trigger className={cn(primaryClasses, "group/trigger w-full justify-between text-left")}>
                  {group.label}
                  <ChevronDown
                    aria-hidden="true"
                    className="size-5 shrink-0 group-data-[state=open]/trigger:rotate-180 motion-safe:transition-transform motion-safe:duration-300"
                    strokeWidth={1.5}
                  />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="overflow-hidden motion-safe:anim-accordion">
                <ul className="flex flex-col pb-3">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <SubLink link={link} pathname={pathname} onNavigate={onNavigate} />
                    </li>
                  ))}
                </ul>
                {group.extra ? (
                  <div className="border-t border-rand pt-3 pb-4">
                    <p className="label-caps text-tekst-2">{group.extra.heading}</p>
                    <SubLink link={group.extra} pathname={pathname} onNavigate={onNavigate} />
                  </div>
                ) : null}
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </nav>

      <nav aria-label={chromeCopy.menu.serviceLabel} className="mt-6">
        <ul className="flex flex-col">
          {mobileNav.service.map((link) => {
            const current = isCurrentPage(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onNavigate}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2.5 text-[0.9375rem] underline-offset-4 hover:underline",
                    current ? "font-semibold text-tekst" : "text-tekst-2 hover:text-tekst",
                  )}
                >
                  {link.label}
                  {current ? <CurrentDot /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {feature ? <MobileNavFeatureCard feature={feature} onNavigate={onNavigate} /> : null}
    </Sheet>
  );
}
