"use client";

import { useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";

import type { SubscribeConfirmResult } from "@/lib/types";
import { formsCopy } from "@/content/copy/forms";
import { site } from "@/content/site";
import { Button, buttonClasses } from "@/components/ui/Button";
import { TimeGate } from "@/components/time/TimeGate";

import { FormStatus } from "./FormStatus";
import { Honeypot, honeypotValue } from "./Honeypot";
import { SubscribeForm } from "./SubscribeForm";
import { submitForm } from "./submitForm";

/**
 * The second step of the double opt-in on /nieuwsbrief/bevestigen (docs/PLAN.md §13.13, §14.21, §15.3; decisions 74
 * and 110). On a dark surface ((kaal) layout).
 *
 * - Reads the token `t` with useSearchParams (the page wraps this in <Suspense fallback={<ConfirmFallback />}>), keeps
 *   it in state and removes it from the address bar right away with history.replaceState, before analytics could read
 *   page_location. The token holds a customer id, never an address.
 * - One button "Bevestig mijn aanmelding" does POST /api/subscribe/confirm. Never on load: mail scanners open links.
 * - Confirmed (or already): "Je bent erbij." with a link to the shop, or to the waitlist before the launch (TimeGate on
 *   site.launchAt; plain <a>, so the proxy decides).
 * - Expired or invalid (or no token at all): the explanation and a new sign-up (SubscribeForm source="club").
 * - not-configured or upstream: the mailto fallback.
 */

type Status = "idle" | "sending" | "done" | "invalid" | "error";

function ResultLinks() {
  const link = buttonClasses({ variant: "outline-op-donker", size: "md" });
  return (
    <TimeGate
      at={site.launchAt}
      className="mt-6 min-h-12"
      before={
        <a href="/wachtlijst" className={link}>
          {formsCopy.confirm.toWaitlist}
        </a>
      }
      after={
        // A full page load on purpose: the proxy serves the shop, never a cached waitlist (plan §11.8, decision 136).
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a href="/" className={buttonClasses({ variant: "primair", size: "md" })}>
          {formsCopy.confirm.toShop}
        </a>
      }
    />
  );
}

export function ConfirmSubscription() {
  const copy = formsCopy.confirm;
  const searchParams = useSearchParams();
  const [token] = useState(() => searchParams.get("t"));
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>(() => (token ? "idle" : "invalid"));
  const [result, setResult] = useState<SubscribeConfirmResult["status"] | null>(null);
  const [message, setMessage] = useState<string>(copy.invalid);
  const [fallbackEmail, setFallbackEmail] = useState<string | undefined>(undefined);

  // Remove the token from the address bar before anything else can read the URL (plan §15.2 step 5, §18.2).
  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("t")) return;
    url.searchParams.delete("t");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending" || !token) return;
    setStatus("sending");
    setFallbackEmail(undefined);
    const response = await submitForm<SubscribeConfirmResult>("/api/subscribe/confirm", {
      token,
      website: honeypotValue(formRef.current),
    });
    if (response.ok) {
      setResult(response.data.status);
      setStatus("done");
      requestAnimationFrame(() => resultRef.current?.focus());
      return;
    }
    if (response.error === "invalid") {
      setMessage(response.fieldErrors?.token ?? copy.invalid);
      setStatus("invalid");
      requestAnimationFrame(() => resultRef.current?.focus());
      return;
    }
    if (response.error === "rate-limited") {
      setMessage(formsCopy.status.rateLimited);
      setStatus("error");
      return;
    }
    setFallbackEmail(response.fallbackEmail);
    setStatus("error");
  }

  if (status === "done") {
    return (
      <div ref={resultRef} tabIndex={-1} className="text-tekst-op-donker">
        <p className="kop-3">{copy.success}</p>
        <p className="tekst-groot mt-3 text-tekst-2-op-donker">{result === "already-confirmed" ? copy.already : copy.successText}</p>
        <ResultLinks />
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="text-tekst-op-donker">
        <div ref={resultRef} tabIndex={-1}>
          <p className="tekst-groot">{message}</p>
        </div>
        <h2 className="kop-3 mt-8">{copy.retryTitle}</h2>
        <SubscribeForm source="club" tone="donker" className="mt-4" />
      </div>
    );
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} aria-busy={status === "sending" || undefined} className="relative">
      <Button type="submit" variant="primair" size="lg" loading={status === "sending"} loadingLabel={copy.sending}>
        {copy.button}
      </Button>
      <Honeypot />
      <FormStatus
        status={status === "sending" ? "sending" : status === "error" ? "error" : "idle"}
        message={status === "error" && !fallbackEmail ? message : undefined}
        fallbackEmail={fallbackEmail}
        tone="donker"
      />
    </form>
  );
}

/**
 * The Suspense fallback of ConfirmSubscription (plan §14.21): the same button in the same place, so nothing moves when
 * the real form takes over. Without JavaScript confirming cannot work; the <noscript> line says so, with the address.
 */
export function ConfirmFallback() {
  return (
    <div>
      <button type="button" className={buttonClasses({ variant: "primair", size: "lg" })}>
        {formsCopy.confirm.button}
      </button>
      <noscript>
        <p className="tekst-klein mt-3 text-tekst-op-donker">{formsCopy.confirm.noScript(site.email)}</p>
      </noscript>
    </div>
  );
}
