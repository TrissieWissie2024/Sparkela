"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { sharedCopy } from "@/content/copy/shared";

import { Button } from "./Button";

/**
 * Drawer on Radix Dialog (plan §13.2, §18.3 rule 5): focus trap, Esc and a click on the overlay close it, focus
 * returns to the trigger (or to the element that had focus when it opened), the page behind is inert and does not
 * scroll. A title is required (hideTitle keeps it for screen readers only). z-index 60 (plan §4.6).
 *
 * - `side`: "right" (cart), "left" (mobile menu, filters) or "top" (search dialog).
 * - `size` for left and right: sm about 24rem (never wider than the viewport minus 3rem), md full width on phones and
 *   432 px from md (the cart), lg full width on phones and 36rem from md, full always full width.
 *   For "top": full is the whole viewport; the others are as high as their content, at most 85 % of it.
 * - `surface`: "pagina" (default) or "vlak" (menu, brief §5).
 *
 * Slides in only with motion allowed (anim-sheet-*, plan §4.7). Short windows (under 30rem: a phone in landscape,
 * 200 % zoom, a large default font) scroll the whole sheet with the header kept at the top, instead of a fixed footer
 * that leaves a sliver of body (CORVANE D53.6). Controlled (`open` + `onOpenChange`) or with a `trigger`.
 * Port of CORVANE components/ui/Sheet.tsx.
 */

export type SheetSide = "left" | "right" | "top";

export type SheetSize = "sm" | "md" | "lg" | "full";

type ContentProps = ComponentPropsWithoutRef<typeof Dialog.Content>;

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Element that opens the sheet (rendered with Radix asChild, for example a <Button>). */
  trigger?: ReactNode;
  side?: SheetSide;
  size?: SheetSize;
  title: ReactNode;
  /** Keep the title for screen readers, but do not show it. */
  hideTitle?: boolean;
  description?: ReactNode;
  hideDescription?: boolean;
  /** Extra content in the header row after the title (an item count, a logo). */
  headerExtra?: ReactNode;
  /** Sticky area under the scrolling body (totals and the checkout button). */
  footer?: ReactNode;
  /** Accessible name of the close button. Default sharedCopy.ui.close ("Sluiten"). */
  closeLabel?: string;
  surface?: "pagina" | "vlak";
  /** Padding around the body. Default true. */
  padded?: boolean;
  className?: string;
  bodyClassName?: string;
  onOpenAutoFocus?: ContentProps["onOpenAutoFocus"];
  onCloseAutoFocus?: ContentProps["onCloseAutoFocus"];
  children?: ReactNode;
}

const horizontalWidths: Record<SheetSize, string> = {
  sm: "w-[min(calc(100vw-3rem),24rem)]",
  md: "w-full md:w-[27rem]",
  lg: "w-full md:w-[36rem]",
  full: "w-full",
};

const sideClasses: Record<SheetSide, string> = {
  right: "inset-y-0 right-0 h-dvh max-h-dvh motion-safe:anim-sheet-right",
  left: "inset-y-0 left-0 h-dvh max-h-dvh motion-safe:anim-sheet-left",
  top: "inset-x-0 top-0 w-full motion-safe:anim-sheet-top",
};

/** Rounded on the open edge; a sheet that fills the phone's width only gets its corners from md. */
const cornerClasses: Record<SheetSide, { narrow: string; wide: string }> = {
  right: { narrow: "rounded-l-kaart", wide: "md:rounded-l-kaart" },
  left: { narrow: "rounded-r-kaart", wide: "md:rounded-r-kaart" },
  top: { narrow: "rounded-b-kaart", wide: "rounded-b-kaart" },
};

function corners(side: SheetSide, size: SheetSize): string {
  if (size === "full") return "";
  return size === "sm" ? cornerClasses[side].narrow : cornerClasses[side].wide;
}

/** Overlay behind sheets and modals: inkt at 45 % (plan §4.5), fading only with motion allowed. */
export const overlayClasses = "fixed inset-0 z-60 bg-inkt/45 motion-safe:anim-overlay";

/**
 * Remembers what had focus when a dialog opened and returns focus there when it closes, for dialogs opened without
 * a Radix trigger (the cart after "In winkelwagen"). Shared by Sheet and Modal.
 */
export function useReturnFocus(
  hasTrigger: boolean,
  onOpenAutoFocus?: ContentProps["onOpenAutoFocus"],
  onCloseAutoFocus?: ContentProps["onCloseAutoFocus"],
) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const handleOpenAutoFocus: ContentProps["onOpenAutoFocus"] = (event) => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    onOpenAutoFocus?.(event);
  };
  const handleCloseAutoFocus: ContentProps["onCloseAutoFocus"] = (event) => {
    onCloseAutoFocus?.(event);
    if (event.defaultPrevented || hasTrigger) return;
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target?.isConnected) {
      event.preventDefault();
      target.focus({ preventScroll: true });
    }
  };
  return { handleOpenAutoFocus, handleCloseAutoFocus };
}

export function Sheet({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  side = "right",
  size = "md",
  title,
  hideTitle = false,
  description,
  hideDescription = false,
  headerExtra,
  footer,
  closeLabel = sharedCopy.ui.close,
  surface = "pagina",
  padded = true,
  className,
  bodyClassName,
  onOpenAutoFocus,
  onCloseAutoFocus,
  children,
}: SheetProps) {
  const { handleOpenAutoFocus, handleCloseAutoFocus } = useReturnFocus(Boolean(trigger), onOpenAutoFocus, onCloseAutoFocus);
  const background = surface === "vlak" ? "bg-vlak" : "bg-pagina";
  const isTop = side === "top";

  return (
    <Dialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClasses} />
        <Dialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          onOpenAutoFocus={handleOpenAutoFocus}
          onCloseAutoFocus={handleCloseAutoFocus}
          className={cn(
            "fixed z-60 flex flex-col overflow-hidden text-tekst shadow-zwevend outline-none",
            "[@media(max-height:30rem)]:scroll-pt-16 [@media(max-height:30rem)]:overflow-y-auto [@media(max-height:30rem)]:overscroll-contain",
            background,
            sideClasses[side],
            isTop ? (size === "full" ? "h-dvh" : "max-h-[85dvh]") : horizontalWidths[size],
            corners(side, size),
            className,
          )}
        >
          <div
            className={cn(
              "flex min-h-16 shrink-0 items-center gap-3 border-b border-rand px-5 py-2 md:px-6",
              "[@media(max-height:30rem)]:sticky [@media(max-height:30rem)]:top-0 [@media(max-height:30rem)]:z-10",
              background,
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Dialog.Title className={cn(hideTitle ? "sr-only" : "kop-3 truncate")}>{title}</Dialog.Title>
              {headerExtra}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label={closeLabel} className="-mr-2.5">
                <X aria-hidden="true" className="size-[22px]" strokeWidth={1.5} />
              </Button>
            </Dialog.Close>
          </div>

          {description ? (
            <Dialog.Description className={cn(hideDescription ? "sr-only" : "px-5 pt-4 tekst-klein text-tekst-2 md:px-6")}>
              {description}
            </Dialog.Description>
          ) : null}

          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain",
              "[@media(max-height:30rem)]:flex-none [@media(max-height:30rem)]:overflow-visible",
              padded && "px-5 py-5 md:px-6",
              bodyClassName,
            )}
          >
            {children}
          </div>

          {footer ? (
            <div
              className={cn(
                "shrink-0 border-t border-rand px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:pb-6",
                background,
              )}
            >
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
