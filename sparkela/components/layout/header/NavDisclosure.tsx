"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type PointerEvent } from "react";

import type { AssetKey, NavGroup, NavLink } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Container } from "@/components/ui/Container";
import { PhotoSlot } from "@/components/media/PhotoSlot";

/**
 * One expanding group of the desktop nav, "Shop per moment" or "Cadeaus" (docs/PLAN.md §2.5, §13.5; brief §6
 * block 2). A disclosure, not a menu: a button with aria-expanded and aria-controls, and a panel of ordinary links.
 *
 * - The panel hangs under the header over the full width (it is positioned against the sticky header, z-30) with the
 *   links in the container width, each with a short line of explanation, and for the moments a small photo
 *   (PhotoSlot 4:5, 96 px). "Liever subtiel?" sits under a hairline as an extra link (group.extra).
 * - Opens on click, and on hover with a mouse after 150 ms; a panel opened by hover closes 150 ms after the pointer
 *   leaves button and panel. Closes with Escape (focus back to the button), on a click outside, when focus leaves
 *   button and panel, and on navigation (a link in the panel, or `closeSignal` from DesktopNav on a route change).
 * - Fades in 4 px from above with motion allowed (anim-paneel). The closed panel stays in the DOM (hidden), so its
 *   links are in the HTML.
 */

export interface NavDisclosureProps {
  group: NavGroup;
  /** Photo per link href (the moments: "momenten.<moment>"). */
  images?: Partial<Record<string, AssetKey>>;
  /** Changes on every route change; the panel closes then. */
  closeSignal?: string | null;
  className?: string;
}

const HOVER_DELAY_MS = 150;

type OpenReason = "click" | "hover";

/**
 * A link in a panel. In a group with photo tiles (`tiled`), a link without its own photo ("Bekijk alles") gets a tile
 * of the same size with an arrow, so its text lines up with the others instead of looking like a missing photo
 * (QA round 1).
 */
function PanelLink({
  link,
  image,
  tiled,
  onNavigate,
}: {
  link: NavLink;
  image?: AssetKey;
  tiled: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className="group/link flex min-h-11 items-start gap-4 rounded-kaart p-2 -m-2 transition-colors duration-200 hover:bg-pagina"
    >
      {image ? (
        <div className="w-24 shrink-0 overflow-hidden rounded-[10px]">
          <PhotoSlot assetKey={image} label={link.label} alt="" aspect="4:5" sizes="96px" tone="kaart" />
        </div>
      ) : tiled ? (
        <div
          aria-hidden="true"
          className="flex aspect-[4/5] w-24 shrink-0 items-center justify-center rounded-[10px] border border-rand bg-kaart text-tekst"
        >
          <ArrowRight className="size-6 motion-safe:transition-transform group-hover/link:translate-x-0.5" strokeWidth={1.5} />
        </div>
      ) : null}
      <span className="min-w-0 pt-0.5">
        <span className="kop-4 block text-tekst decoration-1 underline-offset-4 group-hover/link:underline">{link.label}</span>
        {link.description ? <span className="tekst-klein mt-1 block text-tekst-2">{link.description}</span> : null}
      </span>
    </Link>
  );
}

export function NavDisclosure({ group, images, closeSignal, className }: NavDisclosureProps) {
  const tiled = images !== undefined && Object.keys(images).length > 0;
  const id = useId();
  const panelId = `${id}-panel`;
  const [reason, setReason] = useState<OpenReason | null>(null);
  const open = reason !== null;

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearTimer = () => clearTimeout(timerRef.current);
  const close = useCallback(() => {
    clearTimeout(timerRef.current);
    setReason(null);
  }, []);

  // Close on a route change (DesktopNav passes the pathname).
  const [lastSignal, setLastSignal] = useState(closeSignal);
  if (closeSignal !== lastSignal) {
    setLastSignal(closeSignal);
    if (reason !== null) setReason(null);
  }

  // A click outside closes the panel; so does a pointer on another group's button.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    // Escape closes an open panel wherever focus is (QA round 2, WCAG 1.4.13): a panel that hover opened covers the
    // page while focus is still on the body. Focus only returns to the button when it was inside this group.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const inside = rootRef.current?.contains(document.activeElement) ?? false;
      close();
      if (inside) buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    clearTimer();
    if (!open) timerRef.current = setTimeout(() => setReason("hover"), HOVER_DELAY_MS);
  };
  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    clearTimer();
    if (reason === "hover") timerRef.current = setTimeout(close, HOVER_DELAY_MS);
  };
  // Focus moving to something outside closes the panel. Without a related target (a click on a plain area, or Safari,
  // which does not focus links on click) the pointerdown handler decides, so a click on a panel link always lands.
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (open && next instanceof Node && !event.currentTarget.contains(next)) close();
  };

  const toggle = () => {
    clearTimer();
    // A panel that hover opened stays open on a click; otherwise the click toggles it.
    setReason((current) => (current === "hover" ? "click" : current ? null : "click"));
  };

  return (
    <div
      ref={rootRef}
      className={className}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onBlur={onBlur}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        close();
        buttonRef.current?.focus();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={cn(
          "group/nav relative inline-flex h-11 items-center gap-1 px-1 text-sm font-medium whitespace-nowrap transition-colors",
          open ? "text-tekst" : "text-tekst/80 hover:text-tekst",
        )}
      >
        {group.label}
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 motion-safe:transition-transform motion-safe:duration-200", open && "rotate-180")}
          strokeWidth={1.75}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-x-1 bottom-2 h-px origin-left bg-tekst motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out",
            open ? "scale-x-100" : "scale-x-0 group-hover/nav:scale-x-100",
          )}
        />
      </button>

      <div
        id={panelId}
        hidden={!open}
        data-state={open ? "open" : "closed"}
        className="absolute inset-x-0 top-full z-30 border-b border-rand bg-vlak shadow-zwevend motion-safe:anim-paneel"
      >
        <Container className="py-8">
          <ul className="grid grid-cols-3 gap-x-8 gap-y-6">
            {group.links.map((link) => (
              <li key={link.href}>
                <PanelLink link={link} image={images?.[link.href]} tiled={tiled} onNavigate={close} />
              </li>
            ))}
          </ul>
          {group.extra ? (
            <div className="mt-8 border-t border-rand pt-6">
              <p className="label-caps text-tekst-2">{group.extra.heading}</p>
              <Link
                href={group.extra.href}
                onClick={close}
                className="group/extra mt-2 inline-flex min-h-11 items-center gap-2 font-semibold text-link underline-offset-4 hover:text-link-hover hover:underline"
              >
                {group.extra.label}
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover/extra:translate-x-0.5"
                  strokeWidth={1.75}
                />
              </Link>
              {group.extra.description ? <p className="tekst-klein text-tekst-2">{group.extra.description}</p> : null}
            </div>
          ) : null}
        </Container>
      </div>
    </div>
  );
}
