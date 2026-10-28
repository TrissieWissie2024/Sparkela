"use client";

import { useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef, useState, type FormEvent, type RefObject } from "react";

import type { SubscribeConfirmResult } from "@/lib/types";
import { cn } from "@/lib/cn";
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
 *
 * Every state has its own H1 and intro (QA round 1): "Bevestig je aanmelding" with "Nog één klik…" only above the
 * button, "Deze link werkt niet meer" above a new sign-up, "Je bent erbij." after confirming. So the page never
 * promises one click and refuses it in the same view.
 *
 * No layout shift (integrator 10, decision 212): the static HTML cannot know whether the link has a token, so the
 * Suspense fallback carries both first states (the button, and the "invalid" state with the sign-up) and a small inline
 * script shows the right one before the first paint. When this component takes over, it renders the same markup.
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

/** The page's H1 and intro for a state; the H1 takes focus when a result replaces the button. */
function ConfirmHeading({
  title,
  intro,
  headingRef,
}: {
  title: string;
  intro: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <>
      {/* At most 12em wide (QA round 2): each state's title wraps the same in Unbounded and in its fallback, so a late
          font never changes the line count and moves the form ("Bevestig je aanmelding" is always two lines). */}
      <h1 ref={headingRef} tabIndex={-1} className="kop-1 mt-8 max-w-[12em] md:mt-10">
        {title}
      </h1>
      <p className="tekst-groot mt-4 text-tekst-2-op-donker">{intro}</p>
    </>
  );
}

/** The "invalid" state: the message and a new sign-up. Shared with ConfirmFallback, so both render the same markup. */
function InvalidState({ message, headingRef }: { message: string; headingRef?: RefObject<HTMLHeadingElement | null> }) {
  return (
    <div className="text-tekst-op-donker">
      <ConfirmHeading title={formsCopy.confirm.invalidTitle} intro={message} headingRef={headingRef} />
      <h2 className="kop-3 mt-10">{formsCopy.confirm.retryTitle}</h2>
      {/* Inline, as on the waitlist in the same kaal template: a pill button, not a 704 px roest bar (QA round 3). */}
      <SubscribeForm source="club" tone="donker" layout="inline" className="mt-4 max-w-[34rem]" />
    </div>
  );
}

/** The first state: the heading, the intro and the button (also the fallback's markup). */
function ButtonHeading() {
  return <ConfirmHeading title={formsCopy.confirm.title} intro={formsCopy.confirm.intro} />;
}

export function ConfirmSubscription() {
  const copy = formsCopy.confirm;
  const searchParams = useSearchParams();
  const [token] = useState(() => searchParams.get("t"));
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
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
      <div className="text-tekst-op-donker">
        <ConfirmHeading
          title={copy.success}
          intro={result === "already-confirmed" ? copy.already : copy.successText}
          headingRef={resultRef}
        />
        <ResultLinks />
      </div>
    );
  }

  if (status === "invalid") return <InvalidState message={message} headingRef={resultRef} />;

  return (
    <>
      <ButtonHeading />
      <form
        ref={formRef}
        method="post"
        noValidate
        onSubmit={handleSubmit}
        aria-busy={status === "sending" || undefined}
        className="relative mt-8"
      >
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
    </>
  );
}

/** Attribute on the two first states inside ConfirmFallback. */
const VARIANT_ATTRIBUTE = "data-confirm-variant";

/**
 * Runs while the fallback is parsed, before the first paint: without a token in the address (ConfirmSubscription
 * reads the same `t`), it hides the button and shows the "invalid" state, which is what ConfirmSubscription renders
 * first in that case. The token itself is never read into anything.
 */
export const CONFIRM_FALLBACK_SCRIPT =
  "(function(){var s=document.currentScript,b=s&&s.parentNode;if(!b)return;var t=null;" +
  'try{t=new URLSearchParams(window.location.search).get("t")}catch(e){}if(t)return;' +
  `var k=b.querySelector("[${VARIANT_ATTRIBUTE}=knop]"),o=b.querySelector("[${VARIANT_ATTRIBUTE}=opnieuw]");` +
  "if(k&&o){k.hidden=true;o.hidden=false}})()";

/**
 * The Suspense fallback of ConfirmSubscription (plan §14.21): both first states in the same place, so nothing moves
 * when the real form takes over. The button shows by default (a confirmation link always has a token, and without
 * JavaScript the button is all there is; the <noscript> line explains, with the address); the inline script switches
 * to the "invalid" state when the address has no token. React never hydrates this fallback (useSearchParams makes the
 * boundary render on the client), so the script may set `hidden`.
 */
export function ConfirmFallback() {
  return (
    <div>
      <div {...{ [VARIANT_ATTRIBUTE]: "knop" }}>
        <ButtonHeading />
        <button type="button" className={cn("mt-8", buttonClasses({ variant: "primair", size: "lg" }))}>
          {formsCopy.confirm.button}
        </button>
        <noscript>
          <p className="tekst-klein mt-3 text-tekst-op-donker">{formsCopy.confirm.noScript(site.email)}</p>
        </noscript>
      </div>
      <div {...{ [VARIANT_ATTRIBUTE]: "opnieuw" }} hidden>
        <InvalidState message={formsCopy.confirm.invalid} />
      </div>
      <script dangerouslySetInnerHTML={{ __html: CONFIRM_FALLBACK_SCRIPT }} />
    </div>
  );
}
