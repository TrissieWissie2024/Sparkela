import { Clock3, Package } from "lucide-react";
import { useId, type ReactNode } from "react";

import type { ShipLabelEntry } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { formatMoneyShort } from "@/lib/money";
import { home } from "@/content/home";
import { shipping } from "@/content/shipping";
import { ShipLabel } from "@/components/layout/ShipLabel";
import { Container } from "@/components/ui/Container";
import { Flag } from "@/components/ui/Flag";

/**
 * Delivery bar under the hero (docs/PLAN.md §13.10, §14.1 section 4; brief §6 block 4; CORVANE DeliveryBar.tsx): the
 * shipping day ("Vóór 16.00 besteld? Vandaag verstuurd." or "Nu besteld, maandag verstuurd."), the Dutch flag with
 * "Verzonden vanuit Nederland" and the free-shipping threshold from content/shipping.ts.
 *
 * The shipping day is ShipLabel (layout, C3): a TimeSwitch over getShipSchedule(), switched by an inline script
 * before the first paint and exactly at 16.00 in an open tab. Fixed text, never a countdown to the cut-off (brief
 * §2.4). Only the Netherlands ships at launch, so CORVANE's country switch is left out.
 *
 * Phones and tablets: three lines with an icon column (at least 116 px, so a longer variant never moves the page);
 * from lg one row of 64 px with hairlines between the items. --pagina with a hairline at the bottom. Server component.
 */

export interface DeliveryBarProps {
  schedule: ShipLabelEntry[];
  className?: string;
}

export function DeliveryBar({ schedule, className }: DeliveryBarProps) {
  const headingId = useId();
  const copy = home.deliveryBar;
  const freeFrom = formatMoneyShort(shipping.countries[shipping.defaultCountry].freeFrom);

  return (
    <section aria-labelledby={headingId} className={cn("border-b border-rand bg-pagina text-tekst", className)}>
      <h2 id={headingId} className="sr-only">
        {copy.title}
      </h2>
      <Container className="flex min-h-[7.25rem] flex-col justify-center gap-y-2 py-4 lg:min-h-16 lg:flex-row lg:items-center lg:justify-start lg:gap-x-6 lg:py-3">
        <BarItem icon={<Clock3 aria-hidden="true" className="size-[18px]" strokeWidth={1.5} />} strong>
          <ShipLabel schedule={schedule} field="barText" />
        </BarItem>
        <BarItem icon={<Flag decorative />} divider>
          {copy.flagLabel}
        </BarItem>
        <BarItem icon={<Package aria-hidden="true" className="size-[18px]" strokeWidth={1.5} />} divider>
          {copy.freeFrom(freeFrom)}
        </BarItem>
      </Container>
    </section>
  );
}

function BarItem({
  icon,
  strong = false,
  divider = false,
  children,
}: {
  icon: ReactNode;
  strong?: boolean;
  /** Hairline before the item in the one-row layout (lg). */
  divider?: boolean;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-3 text-sm leading-5",
        strong ? "font-semibold text-tekst" : "text-tekst-2",
        divider && "lg:border-l lg:border-rand lg:pl-6",
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-tekst">{icon}</span>
      <span>{children}</span>
    </p>
  );
}
