"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useId, useState, type ComponentPropsWithoutRef, type FocusEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { sharedCopy } from "@/content/copy/shared";

import { Button } from "./Button";
import { keepLocalEscape, overlayClasses, useReturnFocus } from "./Sheet";

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
 * When the body overflows (the ring size guide on a phone), it becomes a focusable region (tabIndex 0, role="region",
 * an inset focus ring, named sharedCopy.ui.dialogBody: the title would repeat the dialog's own name), so keyboard users can scroll it (WCAG 2.1.1); a body that fits
 * adds no tab stop. Once the body is scrolled, a hairline appears under the title row, so content sliding under it
 * reads as scrolled content (QA round 1). The description sits at the top of the scrolling body (`descriptionInBody`,
 * the default since QA round 2: the ring size guide's intro no longer stays fixed over its scrolling table), so only
 * the title row stays fixed; `descriptionInBody={false}` keeps it under the title.
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
  /** Render the description at the top of the scrolling body, so only the title row stays fixed. Default true. */
  descriptionInBody?: boolean;
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
  // On a short screen (a laptop, below 820 px high) the top margin is 1rem, so the dialog gets 16 px more (QA round 2).
  top:
    "mt-[max(1rem,calc(50dvh-22rem))] mb-auto max-h-[calc(100dvh-max(1rem,calc(50dvh-22rem))-1rem)] " +
    "[@media(max-height:820px)]:mt-4 [@media(max-height:820px)]:max-h-[calc(100dvh-2rem)]",
};

/** Height of the fade over the bottom of an overflowing body (h-10) plus room for a 2 px focus ring with its offset. */
const FADE_CLEARANCE_PX = 48;

/**
 * Whether a scrolling body is at its end: its last content is in view. The bottom padding counts as the end, because
 * focus scrolling only brings a control to the padding edge and the fade must not stay over it (QA round 3).
 */
export function isScrolledToEnd(node: HTMLElement): boolean {
  const padding = Number.parseFloat(getComputedStyle(node).paddingBottom) || 0;
  return node.scrollTop + node.clientHeight >= node.scrollHeight - padding - 2;
}

/**
 * Keeps a newly focused control inside a scrolling body clear of the fade over its bottom: a Tab into the last controls
 * of the popup left "Ik doe mee" under the opaque fade with its ring cut off (WCAG 2.4.7, 2.4.11, 1.4.3; QA round 3).
 * Scrolls the body just far enough; at the end of the body the fade is gone anyway.
 */
export function keepFocusClearOfFade(event: FocusEvent<HTMLElement>) {
  const body = event.currentTarget;
  const target = event.target;
  if (target === body || !(target instanceof HTMLElement) || body.scrollHeight <= body.clientHeight + 1) return;
  const limit = body.getBoundingClientRect().bottom - FADE_CLEARANCE_PX;
  const bottom = target.getBoundingClientRect().bottom;
  if (bottom > limit) body.scrollBy({ top: bottom - limit });
}

/**
 * Whether the element scrolls vertically and whether it is scrolled to its end; follows size changes of the element
 * and of its children (an error line that appears).
 */
function useOverflowing() {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    if (!node) return;
    const check = () => {
      setOverflowing(node.scrollHeight > node.clientHeight + 1);
      setAtEnd(isScrolledToEnd(node));
    };
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

  return [setNode, overflowing, atEnd, setAtEnd] as const;
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
  descriptionInBody = true,
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
  const { handleOpenAutoFocus, handleCloseAutoFocus, handleClickCapture } = useReturnFocus(
    Boolean(trigger),
    onOpenAutoFocus,
    onCloseAutoFocus,
  );
  const titleId = useId();
  const [bodyRef, overflowing, atEnd, setAtEnd] = useOverflowing();
  const [scrolled, setScrolled] = useState(false);

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
          onClickCapture={handleClickCapture}
          onEscapeKeyDown={keepLocalEscape}
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
              "relative flex shrink-0 items-start gap-3 px-5 pt-4 pb-2 md:px-7 md:pt-5",
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
            {/* The hairline under the title row while the body is scrolled. */}
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 h-px transition-opacity duration-150",
                dark ? "bg-rand-op-donker" : "bg-rand",
                scrolled && !hideTitle ? "opacity-100" : "opacity-0",
              )}
            />
          </div>

          {description && !descriptionInBody ? (
            <Dialog.Description
              className={cn(
                hideDescription ? "sr-only" : "px-5 leading-relaxed md:px-7",
                dark ? "text-tekst-2-op-donker" : "text-tekst-2",
              )}
            >
              {description}
            </Dialog.Description>
          ) : null}

          {/* The body and, while it overflows and is not scrolled to its end, a fade over its last 2.5rem: content cut
              off at the dialog's bottom edge reads as "there is more" (QA round 2, the popup's error state on a laptop).
              A focused control never sits under the fade: scroll-pb-12 for scrollIntoView and keepFocusClearOfFade for
              Tab, and the bottom padding counts as the end (QA round 3). */}
          <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={bodyRef}
            {...(overflowing ? { tabIndex: 0, role: "region", "aria-label": sharedCopy.ui.dialogBody } : {})}
            onScroll={(event) => {
              const next = event.currentTarget.scrollTop > 2;
              setScrolled((current) => (current === next ? current : next));
              const end = isScrolledToEnd(event.currentTarget);
              setAtEnd((current) => (current === end ? current : end));
            }}
            onFocus={keepFocusClearOfFade}
            className={cn(
              "peer min-h-0 flex-1 scroll-pb-12 overflow-y-auto overscroll-contain focus-visible:-outline-offset-2",
              padded && "px-5 pb-6 md:px-7 md:pb-7",
              padded && (description && !descriptionInBody ? "pt-5" : "pt-3"),
              bodyClassName,
            )}
          >
            {description && descriptionInBody ? (
              <Dialog.Description
                className={cn(
                  hideDescription ? "sr-only" : "mb-5 leading-relaxed",
                  dark ? "text-tekst-2-op-donker" : "text-tekst-2",
                )}
              >
                {description}
              </Dialog.Description>
            ) : null}
            {children}
          </div>
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t to-transparent transition-opacity duration-150",
              dark ? "from-donker" : "from-pagina",
              // Not over the body's own inset focus ring while a keyboard user scrolls it.
              overflowing && !atEnd ? "opacity-100 peer-focus-visible:opacity-0" : "opacity-0",
            )}
          />
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
