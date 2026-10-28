import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/cn";
import { sharedCopy } from "@/content/copy/shared";

/**
 * The links under every FAQ block (QA round 4: the home FAQ and ProductFaq on the product page, /stacks and
 * /cadeaukaarten had two versions of this, with other words, weights and sizes): "Alle vragen" with an arrow to
 * /veelgestelde-vragen, then "Staat je vraag er niet bij? Stuur ons een bericht" (sharedCopy.faqLinks). The contact
 * link sits in a sentence; a before: area gives it a 44 px tall target without moving the line (AGENTS 44 px rule).
 * Server component.
 */
export function FaqFooterLinks({ className }: { className?: string }) {
  const copy = sharedCopy.faqLinks;
  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <Link
        href={copy.allLink.href}
        className="group/alle inline-flex min-h-11 items-center gap-2 font-semibold text-link underline decoration-1 underline-offset-4 hover:text-link-hover hover:decoration-2"
      >
        {copy.allLink.label}
        <ArrowRight
          aria-hidden="true"
          className="size-[18px] shrink-0 motion-safe:transition-transform motion-safe:duration-200 group-hover/alle:translate-x-0.5"
          strokeWidth={1.75}
        />
      </Link>
      <p className="text-[0.9375rem] text-tekst-2">
        {copy.contact.text}{" "}
        <Link
          href={copy.contact.link.href}
          className="relative inline-block text-link underline decoration-1 underline-offset-4 before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] hover:text-link-hover hover:decoration-2"
        >
          {copy.contact.link.label}
        </Link>
      </p>
    </div>
  );
}
