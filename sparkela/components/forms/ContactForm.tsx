"use client";

import { useId, useRef, useState, type FormEvent } from "react";

import { FORM_LIMITS, validateContact, type ContactField, type FieldErrors } from "@/lib/forms/validation";
import { formsCopy } from "@/content/copy/forms";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

import { FormStatus } from "./FormStatus";
import { Honeypot, honeypotValue } from "./Honeypot";
import { submitForm } from "./submitForm";

/**
 * The contact form on /contact (docs/PLAN.md §13.13, §14.15, §15.5): name, e-mail, order number (optional) and
 * message, with visible labels; the route's validation on submit, errors under the fields and focus to the first.
 * POST /api/contact; success: "Dank je. We reageren binnen 1 werkdag." with a button for another message. Without mail
 * keys (or on an upstream error): Sparkela's address as a mailto link. Port of CORVANE components/contact/ContactForm
 * with the shared primitives.
 */

type Values = { name: string; email: string; orderNumber: string; message: string };
type Status = "idle" | "sending" | "success" | "error";

const EMPTY: Values = { name: "", email: "", orderNumber: "", message: "" };
const ORDER: ContactField[] = ["name", "email", "orderNumber", "message"];

export function ContactForm() {
  const copy = formsCopy.contact;
  const id = useId();
  const ids: Record<ContactField, string> = {
    name: `${id}-name`,
    email: `${id}-email`,
    orderNumber: `${id}-order`,
    message: `${id}-message`,
  };
  const statusId = `${id}-status`;

  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<ContactField>>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState<{ message?: string; fallbackEmail?: string }>({});

  const sending = status === "sending";

  function check(next: Values): FieldErrors<ContactField> {
    const result = validateContact({ ...next, website: "" });
    return result.ok ? {} : result.fieldErrors;
  }

  function update(field: ContactField) {
    return (value: string) => {
      const next = { ...values, [field]: value };
      setValues(next);
      if (attempted) setErrors(check(next));
      if (status === "error") setStatus("idle");
    };
  }

  function focusFirst(next: FieldErrors<ContactField>) {
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
    const response = await submitForm("/api/contact", { ...values, website: honeypotValue(formRef.current) });
    if (response.ok) {
      setValues(EMPTY);
      setAttempted(false);
      setStatus("success");
      requestAnimationFrame(() => successRef.current?.focus());
      return;
    }
    if (response.error === "invalid" && response.fieldErrors && Object.keys(response.fieldErrors).length > 0) {
      const next = response.fieldErrors as FieldErrors<ContactField>;
      setErrors(next);
      setStatus("idle");
      focusFirst(next);
      return;
    }
    setStatus("error");
    setFailure(response.error === "rate-limited" ? { message: formsCopy.status.rateLimited } : { fallbackEmail: response.fallbackEmail });
  }

  function another() {
    setStatus("idle");
    requestAnimationFrame(() => document.getElementById(ids.name)?.focus());
  }

  if (status === "success") {
    return (
      <div className="rounded-kaart border border-rand bg-kaart p-5 sm:p-6 md:p-8">
        <p ref={successRef} tabIndex={-1} className="kop-3 text-tekst">
          {copy.success}
        </p>
        <Button variant="outline" size="md" className="mt-6" onClick={another}>
          {copy.sendAnother}
        </Button>
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
          id={ids.email}
          name="email"
          type="email"
          inputMode="email"
          label={copy.fields.email}
          autoComplete="email"
          required
          maxLength={FORM_LIMITS.email}
          value={values.email}
          onChange={update("email")}
          error={errors.email}
        />
        <TextField
          id={ids.orderNumber}
          name="orderNumber"
          label={copy.fields.orderNumber}
          markOptional
          autoComplete="off"
          maxLength={20}
          hint={copy.fields.orderNumberHint}
          value={values.orderNumber}
          onChange={update("orderNumber")}
          error={errors.orderNumber}
          className="md:col-span-2"
        />
        <TextField
          id={ids.message}
          name="message"
          label={copy.fields.message}
          multiline
          rows={6}
          required
          maxLength={FORM_LIMITS.messageMax}
          value={values.message}
          onChange={update("message")}
          error={errors.message}
          className="md:col-span-2"
        />
      </div>
      <Honeypot />
      <div className="mt-6">
        <Button type="submit" variant="primair" size="md" loading={sending} aria-describedby={statusId} className="w-full sm:w-auto">
          {copy.submit}
        </Button>
      </div>
      <FormStatus id={statusId} status={status} message={failure.message} fallbackEmail={failure.fallbackEmail} />
    </form>
  );
}
