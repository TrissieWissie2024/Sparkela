"use client";

import { OPEN_CONSENT_EVENT } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { cookieTable } from "@/content/legal";
import { site } from "@/content/site";
import { buttonClasses } from "@/components/ui/Button";

/**
 * "Cookie-instellingen" (docs/PLAN.md §13.6, §14.16, decision 138): reopens the consent banner by dispatching
 * OPEN_CONSENT_EVENT ("sparkela:open-consent", lib/analytics.ts), which ConsentBanner (C3) listens for. Renders nothing
 * while site.analytics.enabled is off: then there is no banner to reopen and no third-party script at all. Used on
 * /cookies and in the footer. A real <button>, styled as a text link; `tone="donker"` on dark surfaces.
 * Port of CORVANE components/layout/footer/CookieSettingsButton.tsx.
 */
export function CookieSettingsButton({ className, tone = "licht" }: { className?: string; tone?: "licht" | "donker" }) {
  if (!site.analytics.enabled) return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className={cn(
        tone === "donker"
          ? "relative inline-flex min-h-11 cursor-pointer items-center text-sm text-tekst-op-donker underline underline-offset-4 hover:decoration-2"
          : buttonClasses({ variant: "link", size: "sm" }),
        className,
      )}
    >
      {cookieTable.settingsLabel}
    </button>
  );
}
