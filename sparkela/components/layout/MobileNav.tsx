"use client";

import { Menu } from "lucide-react";
import dynamic from "next/dynamic";
import { startTransition, useState } from "react";

import type { MobileNavFeature } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useAfterLoad } from "@/lib/hooks/useAfterLoad";
import { useLatch } from "@/lib/hooks/useLatch";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { chromeCopy } from "@/content/copy/chrome";
import { Button } from "@/components/ui/Button";

import { XL_QUERY } from "./header/nav";

/** The sheet (Radix Dialog, links, accordion, featured card), lazily from the shared islands chunk (plan §18.4, decision 216). */
const MobileNavSheet = dynamic(() => import("@/components/layout/islands").then((module) => module.MobileNavSheet), {
  ssr: false,
});

/**
 * The mobile menu below xl (docs/PLAN.md §2.5, §13.5; brief §6 block 2): the hamburger button, rendered on the server,
 * and the menu sheet, whose code loads once the page has settled (useAfterLoad: loaded and idle, or the first
 * interaction, and a tap is one) and stays mounted once it was needed (useLatch), so it can animate out and return
 * focus. The button has aria-haspopup="dialog" and aria-expanded; closing the sheet returns focus to it (Sheet).
 *
 * The menu closes on navigation (a link in it, or any route change the sheet sees) and when the viewport grows to xl,
 * where the button is hidden. `feature` is the featured card (a live drop or Linde's first stack), decided by Header
 * on the server. Port of CORVANE components/layout/MobileNav.tsx.
 */
export function MobileNav({ feature, className }: { feature: MobileNavFeature | null; className?: string }) {
  const [opened, setOpened] = useState(false);
  const xl = useMediaQuery(XL_QUERY, false);
  // Growing to xl closes the menu for good (it does not come back when the window shrinks again).
  if (xl && opened) setOpened(false);
  const open = opened && !xl;
  const settled = useAfterLoad();
  const needed = useLatch(open);

  return (
    <>
      <Button
        variant="ghost"
        iconOnly
        size="sm"
        aria-label={chromeCopy.header.openMenu}
        aria-haspopup="dialog"
        aria-expanded={open}
        // A transition (QA round 4, INP): the tap paints first, the menu's Radix mount and style recalculation after.
        onClick={() => startTransition(() => setOpened(true))}
        className={cn(className)}
      >
        <Menu aria-hidden="true" className="size-[22px]" strokeWidth={1.5} />
      </Button>
      {settled || needed ? (
        <MobileNavSheet open={open} onOpenChange={setOpened} onNavigate={() => setOpened(false)} feature={feature} />
      ) : null}
    </>
  );
}
