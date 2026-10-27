"use client";

import { Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { useAfterLoad } from "@/lib/hooks/useAfterLoad";
import { useLatch } from "@/lib/hooks/useLatch";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { sharedCopy } from "@/content/copy/shared";
import { Button } from "@/components/ui/Button";

import { XL_QUERY } from "./nav";

/** The dialog (Radix, the live result list) from the shared islands chunk, loaded after the page has settled (plan §18.4, decision 216). */
const SearchDialog = dynamic(() => import("@/components/layout/islands").then((module) => module.SearchDialog), {
  ssr: false,
});

/**
 * The search icon button in the header (docs/PLAN.md §13.5): 44 px, "Zoeken", opens the SearchDialog. The header
 * renders it twice, left on phones and on the right from xl (`placement`); only the instance that is visible loads
 * its dialog once the page has settled (useAfterLoad), and a tap loads it right away. aria-haspopup and aria-expanded
 * tell what it does; closing the dialog returns focus here (Sheet).
 */
export function SearchButton({ placement = "mobile", className }: { placement?: "mobile" | "desktop"; className?: string }) {
  const [open, setOpen] = useState(false);
  const xl = useMediaQuery(XL_QUERY, false);
  const visible = placement === "desktop" ? xl : !xl;
  const settled = useAfterLoad();
  const needed = useLatch(open);

  return (
    <>
      <Button
        variant="ghost"
        iconOnly
        size="sm"
        aria-label={sharedCopy.ui.search}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={className}
      >
        <Search aria-hidden="true" className="size-[22px]" strokeWidth={1.5} />
      </Button>
      {(settled && visible) || needed ? <SearchDialog open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
