"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useId, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { sharedCopy } from "@/content/copy/shared";

import { Button } from "./Button";
import { overlayClasses, useReturnFocus } from "./Sheet";

/**
 * Centred dialog on Radix Dialog with the API of Sheet minus `side` (plan §13.2): focus trap, Esc and a click on the
 * overlay close it, focus returns to the trigger (or to the element that had focus when it opened), a title is
 * required, the close button is 44 × 44 px. z-index 60. Fades and rises 12 px in only with motion allowed.
 *
 * `anchor`: "center" (default) centres the dialog. "top" keeps the top edge still while the content changes height
 * (the popup that grows a form): the top sits where a 44rem dialog would be centred, at least 1rem from the edge,
 * and the dialog only grows downwards. `tone="donker"` renders on --donker with data-vlak="donker",
 * so the focus ring turns bot-wit. Port of CORVANE components/ui/Modal.tsx.
 *
 * When the body overflows (the ring size guide on a phone), it becomes a focusable region named by the title
 * (tabIndex 0, role="region", an inset focus ring), so keyboard users can scroll it (WCAG 2.1.1); a body that fits
 * adds no tab stop.
 */

export type ModalSize = "sm" | "md" | "lg";

export type ModalAnchor = "center" | "top";

type ContentProps = ComponentPropsWithoutRef<typeof Dialog.Content>;

export interface ModalProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Element that opens the modal (rendered with Radix asChild). */
  trigger?: ReactNode;
  /** sm 26rem, md 32rem (default), lg 44rem; never wider than the viewport minus 2rem. */
  size?: ModalSize;
  anchor?: ModalAnchor;
  title: ReactNode;
  hideTitle?: boolean;
  description?: ReactNode;
  hideDescription?: boolean;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  /** Accessible name of the close button. Default sharedCopy.ui.close ("Sluiten"). */
  closeLabel?: string;
  tone?: "licht" | "donker";
  padded?: boolean;
  className?: string;
  bodyClassName?: string;
  onOpenAutoFocus?: ContentProps["onOpenAutoFocus"];
  onCloseAutoFocus?: ContentProps["onCloseAutoFocus"];
  children?: ReactNode;
}

const widths: Record<ModalSize, string> = {
  sm: "max-w-[26rem]",
  md: "max-w-[32rem]",
  lg: "max-w-[44rem]",
};

/** Vertical placement; horizontal centring (mx-auto) is shared. */
const anchors: Record<ModalAnchor, string> = {
  center: "my-auto max-h-[calc(100dvh-2rem)]",
  top: "mt-[max(1rem,calc(50dvh-22rem))] mb-auto max-h-[calc(100dvh-max(1rem,calc(50dvh-22rem))-1rem)]",
};

/** Whether the element scrolls vertically; follows size changes of the element and of its children. */
function useOverflowing() {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    if (!node) return;
    const check = () => setOverflowing(node.scrollHeight > node.clientHeight + 1);
    const resize = new ResizeObserver(check);
    const observeAll = () => {
      resize.disconnect();
      resize.observe(node);
      for (const child of Array.from(node.children)) resize.observe(child);
      check();
    };
    const mutations = new MutationObserver(observeAll);
    mutations.observe(node, { childList: true });
    observeAll();
    return () => {
      resize.disconnect();
      mutations.disconnect();
    };
  }, [node]);

  return [setNode, overflowing] as const;
}

export function Modal({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  size = "md",
  anchor = "center",
  title,
  hideTitle = false,
  description,
  hideDescription = false,
  headerExtra,
  footer,
  closeLabel = sharedCopy.ui.close,
  tone = "licht",
  padded = true,
  className,
  bodyClassName,
  onOpenAutoFocus,
  onCloseAutoFocus,
  children,
}: ModalProps) {
  const dark = tone === "donker";
  const { handleOpenAutoFocus, handleCloseAutoFocus } = useReturnFocus(Boolean(trigger), onOpenAutoFocus, onCloseAutoFocus);
  const titleId = useId();
  const [bodyRef, overflowing] = useOverflowing();

  return (
    <Dialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClasses} />
        <Dialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          {...(dark ? { "data-vlak": "donker" } : {})}
          aria-labelledby={titleId}
          onOpenAutoFocus={handleOpenAutoFocus}
          onCloseAutoFocus={handleCloseAutoFocus}
          className={cn(
            "fixed inset-0 z-60 mx-auto flex h-fit w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-kaart shadow-zwevend outline-none",
            "motion-safe:anim-modal",
            dark ? "bg-donker text-tekst-op-donker" : "bg-pagina text-tekst",
            widths[size],
            anchors[anchor],
            className,
          )}
        >
          <div
            className={cn(
              "flex shrink-0 items-start gap-3 px-5 pt-4 md:px-7 md:pt-5",
              hideTitle && !headerExtra && "absolute top-0 right-0 z-10",
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3 pt-2">
              <Dialog.Title id={titleId} className={cn(hideTitle ? "sr-only" : "kop-2")}>{title}</Dialog.Title>
              {headerExtra}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label={closeLabel} className="-mr-2.5">
                <X aria-hidden="true" className="size-[22px]" strokeWidth={1.5} />
              </Button>
            </Dialog.Close>
          </div>

          {description ? (
            <Dialog.Description
              className={cn(
                hideDescription ? "sr-only" : "px-5 pt-2 leading-relaxed md:px-7",
                dark ? "text-tekst-2-op-donker" : "text-tekst-2",
              )}
            >
              {description}
            </Dialog.Description>
          ) : null}

          <div
            ref={bodyRef}
            {...(overflowing ? { tabIndex: 0, role: "region", "aria-labelledby": titleId } : {})}
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:-outline-offset-2",
              padded && "px-5 pt-5 pb-6 md:px-7 md:pb-7",
              bodyClassName,
            )}
          >
            {children}
          </div>

          {footer ? (
            <div className={cn("shrink-0 border-t px-5 py-4 md:px-7", dark ? "border-rand-op-donker" : "border-rand")}>
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
