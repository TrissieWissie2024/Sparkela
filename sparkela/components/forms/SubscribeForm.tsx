"use client";

import { CircleAlert } from "lucide-react";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import type { QuizAnswers, SubscribeResult, SubscribeSource } from "@/lib/types";
import { signUpEvent, track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { formatDayMonth, isPrelaunch } from "@/lib/dates";
import { validateSubscribe, type FieldErrors, type SubscribeField } from "@/lib/forms/validation";
import { markSubscribed } from "@/lib/subscription";
import { formsCopy } from "@/content/copy/forms";
import { welcomeCode } from "@/content/offers";
import { site } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { SentenceLines } from "@/components/ui/SentenceLines";

import { ConsentCheckbox } from "./ConsentCheckbox";
import { FormStatus } from "./FormStatus";
import { Honeypot, honeypotValue } from "./Honeypot";
import { submitForm } from "./submitForm";

/**
 * Sign-up for the Sparkela Club (docs/PLAN.md §13.13, §15.1, §15.2; brief §2.8). Used by the waitlist, the footer, the
 * Club page, the popup and the Spark Finder, always the same way:
 *
 * - An email field with a visible label, what you sign up for (formsCopy.subscribe.what, linked to the field), the
 *   unchecked ConsentCheckbox with the exact consent sentence and the privacy link, the honeypot and one button
 *   (default site.club.cta, "Ik doe mee").
 * - The same validation as the route (lib/forms/validation.ts) on submit: errors under the fields, focus to the first.
 * - POST /api/subscribe. Every success (ok: true) calls markSubscribed() and track(sign_up) here, for every source,
 *   then onSuccess; the form makes way for the result ("Check je mail om je aanmelding af te ronden. Je code WELKOM10
 *   kun je meteen gebruiken.", the same for members, decision 199) and focus moves there.
 * - not-configured or upstream: "Dat lukt nu even niet. Mail ons op hallo@sparkela.nl." with a mailto link.
 * - The button keeps focus while sending (aria-disabled, aria-busy).
 * - The <form> has method="post" (like every form with personal data): pressed before hydration, the browser posts to
 *   the page itself instead of adding ?email=… to the URL, where it would reach logs (decision 212).
 *
 * - Before the launch (the waitlist) the result says when the code works: "Je code WELKOM10 gebruik je vanaf 27
 *   november." (QA round 5: the shop is closed until then, so "meteen" was not true).
 * - `heading` (the Club page and the drop teaser, QA round 5; the waitlist, QA round 6): the form owns the heading and
 *   what sits between it and the field (a line, or the waitlist's benefit list), so the result can replace them. On
 *   success the heading (same id and size, so a section's aria-labelledby still works) says "Bijna klaar" and the
 *   result is plain text in the same card: no stale "Vul je e-mailadres in" above it, no box in the box.
 *
 * `tone="donker"` on dark surfaces (waitlist, footer): bot-wit labels, a white field. The order is always field, its
 * error, what you sign up for, the consent checkbox and then the button, on screen and in tab order, so nobody presses
 * the button before seeing the required checkbox (fix 7-9). `layout="inline"` gives the button its own width from sm;
 * "stacked" (default) makes it full width.
 */

export interface SubscribeFormHeading {
  /** The heading's id (a section's aria-labelledby). */
  id: string;
  /** The title; a node so a caller can set its own line breaks (the waitlist splits after the comma). */
  title: ReactNode;
  /** The line under the title while the form shows. */
  text?: string;
  /** Heading style; default kop-2. The result keeps it, so the card does not change its type scale. */
  className?: string;
  /** Content between the title (or line) and the form while the form shows, e.g. the waitlist's benefit list. */
  body?: ReactNode;
}

export interface SubscribeFormProps {
  source: SubscribeSource;
  /** An h2 with a line under it, owned by the form (see above). */
  heading?: SubscribeFormHeading;
  quiz?: QuizAnswers;
  tone?: "licht" | "donker";
  layout?: "inline" | "stacked";
  submitLabel?: string;
  onSuccess?(result: SubscribeResult): void;
  className?: string;
}

type Status = "idle" | "sending" | "success" | "error";

function withCode(text: string): ReactNode {
  const at = text.indexOf(welcomeCode.code);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <strong className="font-semibold tracking-[0.04em]">{welcomeCode.code}</strong>
      {text.slice(at + welcomeCode.code.length)}
    </>
  );
}

export function SubscribeForm({
  source,
  quiz,
  tone = "licht",
  layout = "stacked",
  submitLabel,
  onSuccess,
  className,
  heading,
}: SubscribeFormProps) {
  const copy = formsCopy.subscribe;
  const id = useId();
  const emailId = `${id}-email`;
  const whatId = `${id}-what`;
  const errorId = `${id}-email-error`;
  const statusId = `${id}-status`;
  const dark = tone === "donker";
  const inline = layout === "inline";

  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<SubscribeField>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState<{ message?: string; fallbackEmail?: string }>({});
  const [result, setResult] = useState<SubscribeResult | null>(null);
  /** Whether the sign-up happened before the launch (read in the submit handler, never in render). */
  const [beforeLaunch, setBeforeLaunch] = useState(false);

  const sending = status === "sending";

  function focusFirst(next: FieldErrors<SubscribeField>) {
    if (next.email) emailRef.current?.focus();
    else if (next.consent) consentRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    const body = { email, consent, source, ...(quiz ? { quiz } : {}), website: honeypotValue(formRef.current) };
    const checked = validateSubscribe({ ...body, website: "" });
    if (!checked.ok) {
      setErrors(checked.fieldErrors);
      setStatus("idle");
      focusFirst(checked.fieldErrors);
      return;
    }

    setErrors({});
    setFailure({});
    setStatus("sending");
    const response = await submitForm<SubscribeResult>("/api/subscribe", body);

    if (response.ok) {
      markSubscribed();
      track(signUpEvent(source));
      setBeforeLaunch(isPrelaunch(Date.now()));
      setResult(response.data);
      setStatus("success");
      onSuccess?.(response.data);
      requestAnimationFrame(() => resultRef.current?.focus());
      return;
    }
    if (response.error === "invalid" && response.fieldErrors) {
      const next: FieldErrors<SubscribeField> = {
        ...(response.fieldErrors.email ? { email: response.fieldErrors.email } : {}),
        ...(response.fieldErrors.consent ? { consent: response.fieldErrors.consent } : {}),
      };
      if (next.email || next.consent) {
        setErrors(next);
        setStatus("idle");
        focusFirst(next);
        return;
      }
    }
    setStatus("error");
    setFailure(
      response.error === "rate-limited"
        ? { message: formsCopy.status.rateLimited }
        : response.error === "invalid"
          ? { message: formsCopy.status.error }
          : { fallbackEmail: response.fallbackEmail },
    );
  }

  const text = dark ? "text-tekst-op-donker" : "text-tekst";
  const soft = dark ? "text-tekst-2-op-donker" : "text-tekst-2";

  const done = status === "success" && result !== null;
  const pending = beforeLaunch ? copy.pendingBeforeLaunch(formatDayMonth(site.launchAt)) : copy.pending;

  const headingClass = cn(heading?.className ?? "kop-2", text);

  if (done && heading) {
    return (
      <div ref={resultRef} tabIndex={-1}>
        <h2 id={heading.id} className={headingClass}>
          {copy.successTitle}
        </h2>
        <p className={cn("mt-2", soft)}>{withCode(pending)}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div
        ref={resultRef}
        tabIndex={-1}
        className={cn("rounded-kaart border p-5", dark ? "border-rand-op-donker" : "border-rand bg-kaart", text, className)}
      >
        <p className="font-semibold">{copy.successTitle}</p>
        <p className={cn("mt-1.5", soft)}>{withCode(pending)}</p>
      </div>
    );
  }

  const button = (
    <Button
      type="submit"
      variant="primair"
      size="md"
      loading={sending}
      aria-describedby={statusId}
      fullWidth={!inline}
      className={inline ? "w-full sm:w-auto" : undefined}
    >
      {submitLabel ?? site.club.cta}
    </Button>
  );

  const form = (
    <form
      ref={formRef}
      method="post"
      noValidate
      aria-label={copy.formLabelBySource[source] ?? copy.formLabel}
      aria-busy={sending || undefined}
      onSubmit={handleSubmit}
      className={cn("relative", className)}
    >
      <label htmlFor={emailId} className={cn("tekst-klein block font-semibold", text)}>
        {copy.emailLabel}
      </label>
      <input
        ref={emailRef}
        id={emailId}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        spellCheck={false}
        required
        aria-required="true"
        maxLength={254}
        placeholder={copy.emailPlaceholder}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-invalid={errors.email ? true : undefined}
        aria-describedby={cn(errors.email && errorId, whatId)}
        className={cn(
          "mt-1.5 block h-12 w-full min-w-0 rounded-full border bg-kaart px-5 text-base text-tekst md:text-[0.9375rem]",
          "transition-[border-color] duration-200 placeholder:text-tekst-gedempt",
          errors.email ? (dark ? "border-bot-wit" : "border-fout") : dark ? "border-kaart" : "border-rand-invoer hover:border-tekst",
        )}
      />
      {errors.email ? (
        <p id={errorId} className={cn("mt-1.5 flex items-start gap-1.5 tekst-klein font-medium", dark ? "text-tekst-op-donker" : "text-fout")}>
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {errors.email}
        </p>
      ) : null}
      {/* One sentence per line: the fallback face and Inter then wrap the same at every form width in use (QA round 5:
          at 350 px it was 2 lines in the fallback and 3 in Inter, a late-font shift of 20 px). */}
      <p id={whatId} className={cn("mt-2 tekst-klein", soft)}>
        <SentenceLines text={copy.what} />
      </p>
      <ConsentCheckbox
        inputRef={consentRef}
        checked={consent}
        onChange={(value) => {
          setConsent(value);
          if (value && errors.consent) setErrors((current) => ({ ...current, consent: undefined }));
        }}
        error={errors.consent}
        tone={tone}
        className="mt-2"
      />
      <Honeypot />
      <div className="mt-4">{button}</div>
      <FormStatus
        id={statusId}
        status={status}
        message={failure.message}
        fallbackEmail={failure.fallbackEmail}
        tone={tone}
      />
    </form>
  );

  if (!heading) return form;
  return (
    <>
      <h2 id={heading.id} className={headingClass}>
        {heading.title}
      </h2>
      {heading.text ? <p className={cn("mt-2", soft)}>{heading.text}</p> : null}
      {heading.body}
      {form}
    </>
  );
}
