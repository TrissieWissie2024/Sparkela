"use client";

import { CircleAlert, CircleCheck } from "lucide-react";

import { cn } from "@/lib/cn";
import { formsCopy } from "@/content/copy/forms";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";

/**
 * The live region of a form (docs/PLAN.md §13.13, §15.1, §18.3 rule 14). Always in the DOM, so every change is
 * announced; without a message it takes no space.
 *
 * - sending: "Bezig met verzenden" for screen readers only (the button shows its own spinner).
 * - success: the message, with a check icon.
 * - error: with `fallbackEmail` (routes answer not-configured or upstream) the fallback sentence "Dat lukt nu even
 *   niet. Mail ons op {email}." with the address as a mailto link (`mailtoHref` adds a subject and body, as on
 *   /herroepen); otherwise the message or the generic error. An icon and text, never colour alone.
 *
 * `tone="donker"` for dark surfaces (waitlist, footer): bot-wit text.
 */

export interface FormStatusProps {
  status: "idle" | "sending" | "success" | "error";
  message?: string;
  fallbackEmail?: string;
  /** Full mailto: URL for the fallback link (with subject and body); default `mailto:{fallbackEmail}`. */
  mailtoHref?: string;
  tone?: "licht" | "donker";
  id?: string;
  className?: string;
}

function FallbackSentence({ email, href, linkClass }: { email: string; href: string; linkClass: string }) {
  const sentence = formsCopy.status.fallback(email);
  const at = sentence.indexOf(email);
  if (at < 0) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, at)}
      <a href={href} className={linkClass}>
        {email}
      </a>
      {sentence.slice(at + email.length)}
    </>
  );
}

export function FormStatus({ status, message, fallbackEmail, mailtoHref, tone = "licht", id, className }: FormStatusProps) {
  const dark = tone === "donker";
  const text = dark ? "text-tekst-op-donker" : "text-tekst";
  const linkClass = cn(
    "font-semibold underline underline-offset-4 hover:decoration-2",
    dark ? "text-tekst-op-donker" : "text-link hover:text-link-hover",
  );
  const visible = status === "success" || status === "error";

  return (
    <div
      id={id}
      role="status"
      aria-live="polite"
      className={cn("flex items-start gap-2 tekst-klein font-medium", text, visible && "mt-3", className)}
    >
      {status === "sending" ? <VisuallyHidden>{formsCopy.status.sending}</VisuallyHidden> : null}
      {status === "success" && message ? (
        <>
          <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          <span className="min-w-0">{message}</span>
        </>
      ) : null}
      {status === "error" ? (
        <>
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          <span className="min-w-0">
            {fallbackEmail ? (
              <FallbackSentence email={fallbackEmail} href={mailtoHref ?? `mailto:${fallbackEmail}`} linkClass={linkClass} />
            ) : (
              (message ?? formsCopy.status.error)
            )}
          </span>
        </>
      ) : null}
    </div>
  );
}
