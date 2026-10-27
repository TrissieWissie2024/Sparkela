"use client";

import { useId, useRef, useState, type FormEvent } from "react";

import type { WithdrawalReceipt } from "@/lib/types";
import { FORM_LIMITS, validateWithdrawal, type FieldErrors, type WithdrawalField } from "@/lib/forms/validation";
import { formsCopy } from "@/content/copy/forms";
import { site } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

import { FormStatus } from "./FormStatus";
import { Honeypot, honeypotValue } from "./Honeypot";
import { submitForm } from "./submitForm";

/**
 * The withdrawal form on /herroepen (brief §6 Herroepen, §2.10; docs/PLAN.md §13.13, §14.14, §15.4; decision 66).
 *
 * - Fields: name, order number, the e-mail address for the receipt and, optionally, which products.
 * - Exactly one button, "Herroeping bevestigen". No extra checkboxes.
 * - Validation on submit with the route's own rules; errors under the fields, focus to the first.
 * - Success: the receipt in the same card (reference, date and time of receipt, what was filled in, next steps);
 *   focus moves to its heading. The customer gets the same receipt by mail.
 * - Without mail keys (not-configured) or on an upstream error: "Dat lukt nu even niet. Mail ons op …" with a mailto
 *   that already holds the subject "Herroeping bestelling {nummer}" and the filled-in details (the visitor's own mail
 *   app, so no address reaches our server or logs).
 */

type Values = { name: string; orderNumber: string; email: string; products: string };
type Status = "idle" | "sending" | "success" | "error";

const EMPTY: Values = { name: "", orderNumber: "", email: "", products: "" };
const ORDER: WithdrawalField[] = ["name", "orderNumber", "email", "products"];

function mailtoFor(email: string, values: Values): string {
  const copy = formsCopy.withdrawal;
  const labels = copy.summary;
  const lines = [
    copy.mailtoIntro,
    "",
    `${labels.name}: ${values.name.trim()}`,
    `${labels.orderNumber}: ${values.orderNumber.trim()}`,
    `${labels.email}: ${values.email.trim()}`,
    `${labels.products}: ${values.products.trim() || labels.productsEmpty}`,
  ];
  const subject = copy.mailtoSubject(values.orderNumber.trim());
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

export function WithdrawalForm() {
  const copy = formsCopy.withdrawal;
  const id = useId();
  const ids: Record<WithdrawalField, string> = {
    name: `${id}-name`,
    orderNumber: `${id}-order`,
    email: `${id}-email`,
    products: `${id}-products`,
  };
  const statusId = `${id}-status`;

  const formRef = useRef<HTMLFormElement>(null);
  const receiptRef = useRef<HTMLHeadingElement>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<WithdrawalField>>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState<{ message?: string; fallbackEmail?: string }>({});
  const [receipt, setReceipt] = useState<WithdrawalReceipt | null>(null);

  const sending = status === "sending";

  function check(next: Values): FieldErrors<WithdrawalField> {
    const result = validateWithdrawal({ ...next, website: "" });
    return result.ok ? {} : result.fieldErrors;
  }

  function update(field: WithdrawalField) {
    return (value: string) => {
      const next = { ...values, [field]: value };
      setValues(next);
      if (attempted) setErrors(check(next));
      if (status === "error") setStatus("idle");
    };
  }

  function focusFirst(next: FieldErrors<WithdrawalField>) {
    const first = ORDER.find((field) => next[field]);
    if (first) document.getElementById(ids[first])?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setAttempted(true);
    const found = check(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirst(found);
      return;
    }

    setStatus("sending");
    setFailure({});
    const response = await submitForm<WithdrawalReceipt>("/api/herroepen", {
      ...values,
      website: honeypotValue(formRef.current),
    });
    if (response.ok) {
      setReceipt(response.data);
      setStatus("success");
      requestAnimationFrame(() => receiptRef.current?.focus());
      return;
    }
    if (response.error === "invalid" && response.fieldErrors && Object.keys(response.fieldErrors).length > 0) {
      const next = response.fieldErrors as FieldErrors<WithdrawalField>;
      setErrors(next);
      setStatus("idle");
      focusFirst(next);
      return;
    }
    setStatus("error");
    setFailure(
      response.error === "rate-limited"
        ? { message: formsCopy.status.rateLimited }
        : { fallbackEmail: response.fallbackEmail },
    );
  }

  if (status === "success" && receipt) {
    const r = copy.receipt;
    return (
      <div className="rounded-kaart border border-rand bg-kaart p-5 sm:p-6 md:p-8">
        <h2 ref={receiptRef} tabIndex={-1} className="kop-3 text-tekst">
          {r.title}
        </h2>
        <p className="mt-3 text-tekst-2">{r.text}</p>
        <dl className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
          <dt className="tekst-klein font-semibold text-tekst-2">{r.reference}</dt>
          <dd className="tabular font-semibold text-tekst">{receipt.reference}</dd>
          <dt className="tekst-klein font-semibold text-tekst-2">{r.receivedAt}</dt>
          <dd className="text-tekst">
            <time dateTime={receipt.receivedAt}>{receipt.receivedAtLabel}</time>
          </dd>
        </dl>
        <h3 className="mt-8 font-semibold text-tekst">{r.detailsTitle}</h3>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
          {receipt.summary.map((row) => (
            <div key={row.label} className="contents">
              <dt className="tekst-klein font-semibold text-tekst-2">{row.label}</dt>
              <dd className="min-w-0 whitespace-pre-line break-words text-tekst">{row.value}</dd>
            </div>
          ))}
        </dl>
        <h3 className="mt-8 font-semibold text-tekst">{r.nextTitle}</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-tekst-2">
          {r.next(String(site.returnDays)).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      aria-labelledby={`${id}-title`}
      aria-busy={sending || undefined}
      onSubmit={handleSubmit}
      className="relative rounded-kaart border border-rand bg-kaart p-5 sm:p-6 md:p-8"
    >
      <h2 id={`${id}-title`} className="kop-3 text-tekst">
        {copy.formTitle}
      </h2>
      <p className="mt-2 tekst-klein text-tekst-2">{copy.formIntro}</p>
      <div className="mt-6 grid gap-5 md:grid-cols-2 md:gap-x-5">
        <TextField
          id={ids.name}
          name="name"
          label={copy.fields.name}
          autoComplete="name"
          required
          maxLength={FORM_LIMITS.nameMax}
          value={values.name}
          onChange={update("name")}
          error={errors.name}
        />
        <TextField
          id={ids.orderNumber}
          name="orderNumber"
          label={copy.fields.orderNumber}
          autoComplete="off"
          required
          maxLength={20}
          hint={copy.fields.orderNumberHint}
          value={values.orderNumber}
          onChange={update("orderNumber")}
          error={errors.orderNumber}
        />
        <TextField
          id={ids.email}
          name="email"
          type="email"
          inputMode="email"
          label={copy.fields.email}
          autoComplete="email"
          required
          maxLength={FORM_LIMITS.email}
          hint={copy.fields.emailHint}
          value={values.email}
          onChange={update("email")}
          error={errors.email}
          className="md:col-span-2"
        />
        <TextField
          id={ids.products}
          name="products"
          label={copy.productsLabel}
          multiline
          rows={4}
          maxLength={FORM_LIMITS.products}
          hint={copy.fields.productsHint}
          value={values.products}
          onChange={update("products")}
          error={errors.products}
          className="md:col-span-2"
        />
      </div>
      <Honeypot />
      <div className="mt-6">
        <Button type="submit" variant="primair" size="md" loading={sending} aria-describedby={statusId} className="w-full sm:w-auto">
          {copy.submit}
        </Button>
      </div>
      <FormStatus
        id={statusId}
        status={status}
        message={failure.message}
        fallbackEmail={failure.fallbackEmail}
        mailtoHref={failure.fallbackEmail ? mailtoFor(failure.fallbackEmail, values) : undefined}
      />
    </form>
  );
}
