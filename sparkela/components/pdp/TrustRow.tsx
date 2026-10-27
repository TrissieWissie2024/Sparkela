import Link from "next/link";
import { Lock, Mail, ShieldCheck, Truck, Undo2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";
import { pdpCopy, type PdpTrustItem } from "@/content/copy/pdp";

/**
 * The trust row under the delivery estimate (docs/PLAN.md §13.9; brief §6: "veilig betalen met iDEAL | Wero, gratis
 * verzending vanaf €35, 6 maanden garantie, 14 dagen bedenktijd"; port of CORVANE TrustRow). Four rows with a line
 * icon in a vlak circle, a bold title and a short line; hairlines between them. The brief includes the 14 days of
 * reflection here (CORVANE left the withdrawal right out; the brief wins). The copy is built from config
 * (content/copy/pdp.ts), so amounts and days never drift. The gift card: secure payment and "Direct in je mail".
 * Server component.
 */

const ICONS: Record<PdpTrustItem["id"], LucideIcon> = {
  betalen: Lock,
  verzending: Truck,
  garantie: ShieldCheck,
  bedenktijd: Undo2,
  mail: Mail,
};

export function TrustRow({ variant = "product", className }: { variant?: "product" | "giftcard"; className?: string }) {
  const items = variant === "giftcard" ? pdpCopy.trust.giftCardItems : pdpCopy.trust.items;
  return (
    <div className={className}>
      <h2 className="sr-only">{pdpCopy.sections.trust}</h2>
      <ul role="list" className="flex flex-col divide-y divide-rand">
        {items.map((item) => {
          const Icon = ICONS[item.id];
          return (
            <li key={item.id} className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-vlak text-tekst">
                <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.5} />
              </span>
              <p className="min-w-0 pt-0.5 text-sm leading-5">
                <span className="block font-semibold text-tekst">{item.title}</span>
                <span className="mt-0.5 block text-tekst-2">
                  {item.text}
                  {item.link ? (
                    <>
                      {" "}
                      <Link
                        href={item.link.href}
                        className={cn(
                          "relative inline-block text-link underline decoration-1 underline-offset-4 hover:text-link-hover",
                          "before:absolute before:inset-x-0 before:-inset-y-3 before:content-['']",
                        )}
                      >
                        {item.link.label}
                      </Link>
                    </>
                  ) : null}
                </span>
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
