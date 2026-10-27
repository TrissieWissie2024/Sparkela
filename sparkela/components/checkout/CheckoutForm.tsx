"use client";

import { CircleAlert, Info } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import type { Money } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { cartCopy } from "@/content/copy/cart";
import { pagesCopy } from "@/content/copy/pages";
import { shipping } from "@/content/shipping";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

import {
  ADDRESS_FIELDS,
  CHECKOUT_FIELDS,
  fieldLabel,
  validateCheckout,
  type CheckoutErrors,
  type CheckoutField,
  type CheckoutValues,
} from "./demoOrder";

/**
 * The details form of the demo checkout (docs/PLAN.md §13.13: "contact- en adresvelden (alleen vorm)"). Port of
 * CheckoutForm in CORVANE components/checkout/CheckoutView.tsx. Nothing is stored or sent: the values live in the
 * view's state only.
 *
 * - Contact (email) and, when something is shipped, the delivery address: labelled TextFields with autocomplete, errors
 *   under each field (aria-describedby, aria-invalid). Gift cards only: a line instead of the address fields.
 * - The country is Nederland, the only country we ship to now (content/shipping.ts), shown as text.
 * - On submit the fields are checked (validateCheckout); focus moves to the first field with an error and a polite
 *   line says to check them. Valid: onPlace(), which places the demo order.
 * - Under the total the button "Bestelling plaatsen (demo)" (primair, aria-disabled and a spinner while placing) and
 *   the notice "Demo-checkout: er wordt niet betaald" with "Er wordt niets opgeslagen of verstuurd."
 */

export interface CheckoutFormProps {
  values: CheckoutValues;
  onChange(values: CheckoutValues): void;
  needsAddress: boolean;
  total: Money;
  placing: boolean;
  onPlace(): void;
  className?: string;
}

const autoComplete: Record<CheckoutField, string> = {
  email: "email",
  firstName: "shipping given-name",
  lastName: "shipping family-name",
  street: "shipping address-line1",
  postalCode: "shipping postal-code",
  city: "shipping address-level2",
};

export function CheckoutForm({ values, onChange, needsAddress, total, placing, onPlace, className }: CheckoutFormProps) {
  const copy = pagesCopy.checkout;
  const id = useId();
  const fieldId = (field: CheckoutField) => `${id}-${field}`;
  const statusId = `${id}-status`;
  const country = shipping.countries[shipping.defaultCountry].label;

  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [attempted, setAttempted] = useState(false);
  const hasErrors = Object.keys(errors).length > 0;

  function change(field: CheckoutField, value: string) {
    const next = { ...values, [field]: value };
    onChange(next);
    if (attempted) setErrors(validateCheckout(next, needsAddress));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (placing) return;
    setAttempted(true);
    const found = validateCheckout(values, needsAddress);
    setErrors(found);
    const first = CHECKOUT_FIELDS.find((field) => found[field]);
    if (first) {
      document.getElementById(fieldId(first))?.focus();
      return;
    }
    onPlace();
  }

  const field = (name: CheckoutField, extra: { className?: string; type?: "text" | "email"; hint?: string } = {}) => (
    <TextField
      id={fieldId(name)}
      name={name}
      label={fieldLabel(name)}
      type={extra.type ?? "text"}
      inputMode={name === "email" ? "email" : undefined}
      autoComplete={autoComplete[name]}
      value={values[name]}
      onChange={(value) => change(name, value)}
      error={errors[name]}
      hint={extra.hint}
      required
      className={extra.className}
    />
  );

  return (
    <form noValidate aria-label={copy.formLabel} onSubmit={handleSubmit} className={className}>
      <fieldset>
        <legend className="kop-3 text-tekst">{copy.contact.title}</legend>
        <div className="mt-5 grid gap-5">{field("email", { type: "email", hint: copy.contact.emailHint })}</div>
      </fieldset>

      <fieldset className="mt-10 border-t border-rand pt-8 md:mt-12 md:pt-10">
        <legend className="float-left w-full kop-3 text-tekst">{copy.address.title}</legend>
        {needsAddress ? (
          <div className="clear-both grid gap-5 pt-5 sm:grid-cols-2 sm:gap-x-4">
            {ADDRESS_FIELDS.map((name) => (
              <div key={name} className={name === "street" ? "sm:col-span-2" : undefined}>
                {field(name)}
              </div>
            ))}
            <div className="sm:col-span-2">
              <p className="tekst-klein font-semibold text-tekst">{copy.address.country}</p>
              <p className="mt-1.5 flex h-12 items-center rounded-full border border-rand bg-vlak px-5 text-[0.9375rem] text-tekst">
                {country}
              </p>
            </div>
          </div>
        ) : (
          <p className="clear-both pt-4 leading-relaxed text-tekst-2">{copy.address.giftCardsOnly}</p>
        )}
      </fieldset>

      <div className="mt-10 border-t border-rand pt-8 md:mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-semibold text-tekst">{cartCopy.totals.total}</p>
          <p className="tabular text-xl font-semibold text-tekst">{formatMoney(total)}</p>
        </div>

        <Button
          type="submit"
          variant="primair"
          size="lg"
          fullWidth
          loading={placing}
          loadingLabel={copy.placing}
          aria-describedby={statusId}
          className="mt-5"
        >
          {copy.placeOrder}
        </Button>

        <p
          id={statusId}
          aria-live="polite"
          className={cn("flex items-start gap-2 text-sm leading-5 font-medium text-fout", attempted && hasErrors && "mt-3")}
        >
          {attempted && hasErrors ? (
            <>
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              {copy.errors.summary}
            </>
          ) : null}
        </p>

        <p className="mt-4 flex items-start gap-2.5 rounded-kaart bg-info-vlak px-4 py-3 text-sm leading-snug text-info">
          <Info aria-hidden="true" className="mt-px size-4 shrink-0" strokeWidth={2} />
          <span>
            <span className="font-semibold">{copy.demoNotice}.</span> {copy.formNote}
          </span>
        </p>
      </div>
    </form>
  );
}
