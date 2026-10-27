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
        className="no-scrollbar -mx-5 flex gap-1 overflow-x-auto overscroll-x-contain px-5 shadow-[inset_0_-1px_0_var(--rand)] md:mx-0 md:px-0"
      >
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.id}
            value={tab.id}
            className={cn(
              "relative inline-flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-[0.9375rem] font-semibold whitespace-nowrap text-tekst-2",
              "transition-colors duration-200 hover:text-tekst focus-visible:-outline-offset-2",
              "data-[state=active]:border-tekst data-[state=active]:text-tekst",
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
