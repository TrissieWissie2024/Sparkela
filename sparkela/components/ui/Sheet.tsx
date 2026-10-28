"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ComponentPropsWithoutRef, type MouseEvent, type ReactNode } from "react";

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
 * Escape inside an element marked data-escape-local (QuickAdd's choice list in the cart upsell) closes that element
 * only: Radix listens for Escape on the document before the element's own handler runs, so without this the whole
 * drawer closed (QA round 1). Shared by Sheet and Modal.
 */
export const keepLocalEscape: ContentProps["onEscapeKeyDown"] = (event) => {
  if (event.target instanceof Element && event.target.closest("[data-escape-local]")) event.preventDefault();
};

/**
 * Remembers what had focus when a dialog opened and returns focus there when it closes, for dialogs opened without
 * a Radix trigger (the cart after "In winkelwagen"). Shared by Sheet and Modal.
 *
 * A dialog closed by following a link inside it to another page (a search result, a menu link, a product in the
 * cart) sends focus to <main id="main"> instead of back to its trigger in the header, the same place RouteFocus puts
 * it after any other navigation (QA round 1). `handleClickCapture` goes on the dialog content to notice such a link.
 */
export function useReturnFocus(
  hasTrigger: boolean,
  onOpenAutoFocus?: ContentProps["onOpenAutoFocus"],
  onCloseAutoFocus?: ContentProps["onCloseAutoFocus"],
) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const navigatedRef = useRef(false);
  const openPathRef = useRef<string | null>(null);
  const handleOpenAutoFocus: ContentProps["onOpenAutoFocus"] = (event) => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    navigatedRef.current = false;
    openPathRef.current = window.location.pathname;
    onOpenAutoFocus?.(event);
  };
  const handleClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== "_self")) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin === window.location.origin && url.pathname !== window.location.pathname) navigatedRef.current = true;
  };
  const handleCloseAutoFocus: ContentProps["onCloseAutoFocus"] = (event) => {
    onCloseAutoFocus?.(event);
    if (event.defaultPrevented) return;
    const moved = openPathRef.current !== null && openPathRef.current !== window.location.pathname;
    openPathRef.current = null;
    if (navigatedRef.current || moved) {
      navigatedRef.current = false;
      returnFocusRef.current = null;
      event.preventDefault();
      document.getElementById("main")?.focus({ preventScroll: true });
      return;
    }
    if (hasTrigger) return;
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target?.isConnected) {
      event.preventDefault();
      target.focus({ preventScroll: true });
    }
  };
  return { handleOpenAutoFocus, handleCloseAutoFocus, handleClickCapture };
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
  const { handleOpenAutoFocus, handleCloseAutoFocus, handleClickCapture } = useReturnFocus(
    Boolean(trigger),
    onOpenAutoFocus,
    onCloseAutoFocus,
  );
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
          onClickCapture={handleClickCapture}
          onEscapeKeyDown={keepLocalEscape}
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
            {/* A top sheet is as wide as the page: title and close button line up with its centred 44rem column
                (the search form), not with the screen's corners (QA round 2). */}
            <div className={cn("flex min-w-0 flex-1 items-center gap-3", isTop && "mx-auto w-full max-w-[44rem]")}>
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
