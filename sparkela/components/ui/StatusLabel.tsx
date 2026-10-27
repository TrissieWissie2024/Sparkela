import type { BadgeId } from "@/lib/types";
import { cn } from "@/lib/cn";
import { sharedCopy } from "@/content/copy/shared";

/**
 * A product label (plan §4.9, decision 78): label caps in a pill, 20 px on a card or 24 px on the product page. The
 * text comes from sharedCopy.badges. Which labels a product gets is decided elsewhere: marketing badges only via
 * deriveBadges() (site.badges.enabled plus their own rule), status labels when the facts are true. This component
 * only draws an id it is given.
 *
 * Colours per brief §5 (contrast in §4.10): Op voorraad olijf on succes-vlak (5,34), Laatste stuks and Sale roest on
 * fout-vlak (7,38), Nieuw leisteen on info-vlak (7,53), Limited and Early access bot-wit on roest (6,76), Uitverkocht
 * inkt on vlak (13,70), Bestseller bot-wit on donker (13,70). Forced colors draw a border. Port of CORVANE
 * components/ui/Badge.tsx.
 */

export const STATUS_LABEL_CLASSES: Record<BadgeId, string> = {
  "op-voorraad": "bg-succes-vlak text-succes",
  uitverkocht: "bg-vlak text-tekst",
  "early-access": "bg-roest text-bot-wit",
  "laatste-stuks": "bg-fout-vlak text-fout",
  sale: "bg-fout-vlak text-fout",
  nieuw: "bg-info-vlak text-info",
  limited: "bg-roest text-bot-wit",
  bestseller: "bg-donker text-tekst-op-donker",
};

export type StatusLabelSize = "kaart" | "pdp";

const sizes: Record<StatusLabelSize, string> = {
  kaart: "h-5",
  pdp: "h-6",
};

export interface StatusLabelProps {
  id: BadgeId;
  /** "kaart" (20 px, default) in product cards; "pdp" (24 px) on the product page. */
  size?: StatusLabelSize;
  className?: string;
}

export function StatusLabel({ id, size = "kaart", className }: StatusLabelProps) {
  return (
    <span
      className={cn(
        "label-caps inline-flex items-center rounded-full px-2 whitespace-nowrap",
        "forced-colors:border forced-colors:border-[CanvasText]",
        sizes[size],
        STATUS_LABEL_CLASSES[id],
        className,
      )}
    >
      {sharedCopy.badges[id]}
    </span>
  );
}
