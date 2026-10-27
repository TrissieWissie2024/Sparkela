"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { sharedCopy } from "@/content/copy/shared";

import { ScrollRow } from "./ScrollRow";

/**
 * A carousel on ScrollRow (plan §13.2, §18.3 rule 7): a region with aria-roledescription "carrousel", every slide a
 * group with aria-roledescription "dia" and the label "{n} van {total}", "Vorige" and "Volgende" buttons at every
 * width (on phones in a row under the list, decision 216c), no autoplay. Used by FavoritesCarousel and
 * ReviewsCarousel, which renders nothing without real reviews (brief §2.3).
 *
 * Structure: region > list > list item > group. The roles of the plan sit on a wrapper and inside each <li>, so the
 * list keeps only list items as children (axe "list" and "listitem" rules). The region carries `label`; the list is
 * named sharedCopy.ui.slides ("Dia's"), so a screen reader does not announce the same name twice (decision 188).
 */

export interface CarouselProps {
  /** Accessible name of the carousel ("Wat jullie zeggen"). */
  label: string;
  items: ReactNode[];
  /** Width and snap of each slide; default about 85 % of a phone, a third from md, a quarter from xl. */
  itemClassName?: string;
  /** Classes of the scrolling list (a full-bleed row: negative margin and matching padding). */
  listClassName?: string;
  className?: string;
}

const DEFAULT_ITEM = "w-[85%] shrink-0 snap-start sm:w-[48%] md:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)]";

export function Carousel({ label, items, itemClassName, listClassName, className }: CarouselProps) {
  if (items.length === 0) return null;
  const total = items.length;
  return (
    <div role="region" aria-roledescription={sharedCopy.ui.carousel} aria-label={label} className={className}>
      <ScrollRow label={sharedCopy.ui.slides} controls="always" className={cn("gap-4", listClassName)}>
        {items.map((item, index) => (
          <li key={index} className={cn(itemClassName ?? DEFAULT_ITEM)}>
            <div
              role="group"
              aria-roledescription={sharedCopy.ui.slide}
              aria-label={sharedCopy.ui.slideLabel(index + 1, total)}
              className="h-full"
            >
              {item}
            </div>
          </li>
        ))}
      </ScrollRow>
    </div>
  );
}
