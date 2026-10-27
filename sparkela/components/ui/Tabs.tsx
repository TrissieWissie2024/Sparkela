"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Tabs on @radix-ui/react-tabs (plan §13.2, §18.3 rule 8, decision 36): a tablist with aria-selected, arrow keys move
 * between tabs (and wrap), Home and End jump to the first and last. The tablist scrolls sideways on phones; the
 * browser scrolls the focused tab into view, and the focus ring sits inside the tab so the scroll box cannot clip
 * it. The selected tab is never colour alone: it gets a 2 px underline in --tekst. Only the active panel is rendered
 * (Radix default), so a product is never in the DOM twice. Used for the type tabs on the home (HomeProductTabs).
 *
 * Radix focuses a tab on pointer down, and Chrome then matches :focus-visible on it, so a tap left the heavy focus
 * ring around the tab (QA round 1). The list marks pointer use (data-pointer, set on pointer down and cleared on any
 * key), and while it is set the ring is hidden; keyboard focus keeps the 2 px --focus ring (AGENTS.md).
 */

export interface TabItem {
  id: string;
  label: string;
  panel: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Accessible name of the tablist ("Producten per type"). */
  label: string;
  /** Initially selected tab id. Default: the first tab. */
  defaultTab?: string;
  onChange?: (id: string) => void;
  className?: string;
  panelClassName?: string;
}

export function Tabs({ tabs, label, defaultTab, onChange, className, panelClassName }: TabsProps) {
  if (tabs.length === 0) return null;
  const initial = defaultTab !== undefined && tabs.some((tab) => tab.id === defaultTab) ? defaultTab : tabs[0].id;

  return (
    <RadixTabs.Root defaultValue={initial} onValueChange={onChange} activationMode="automatic" className={className}>
      <RadixTabs.List
        aria-label={label}
        loop
        onPointerDown={(event) => {
          event.currentTarget.dataset.pointer = "";
        }}
        onKeyDown={(event) => {
          delete event.currentTarget.dataset.pointer;
        }}
        className="group/tabs no-scrollbar -mx-5 flex justify-between overflow-x-auto overscroll-x-contain px-5 shadow-[inset_0_-1px_0_var(--rand)] sm:justify-start sm:gap-1 md:mx-0 md:px-0"
      >
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.id}
            value={tab.id}
            className={cn(
              // Five tabs fit a 390 px phone (14 px, 4 px padding and the space spread between them below sm), so none hides
              // behind the edge; narrower phones scroll the row.
              "relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md px-1 text-sm font-semibold whitespace-nowrap text-tekst-2 sm:px-3 sm:text-[0.9375rem]",
              "transition-colors duration-200 hover:text-tekst focus-visible:-outline-offset-2",
              "group-data-[pointer]/tabs:focus-visible:outline-none",
              // The active line is drawn inside the tab, so the rounded focus ring never hides it (fix 7-9).
              "after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent sm:after:inset-x-3",
              "data-[state=active]:text-tekst data-[state=active]:after:bg-tekst",
            )}
          >
            {tab.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((tab) => (
        <RadixTabs.Content key={tab.id} value={tab.id} className={cn("pt-6 md:pt-8", panelClassName)}>
          {tab.panel}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
