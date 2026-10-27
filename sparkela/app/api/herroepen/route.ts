import { after } from "next/server";

import type { WithdrawalReceipt } from "@/lib/types";
import { FORM_DEADLINE_MS } from "@/lib/deadline";
import { formatDateTimeNl } from "@/lib/dates";
import { clientKey, RATE_LIMITS, rateLimit } from "@/lib/forms/rate-limit";
import { formError, formOk, readJsonBody } from "@/lib/forms/responses";
import { FORM_LIMITS, honeypotFilled, validateWithdrawal } from "@/lib/forms/validation";
import {
  getMailConfig,
  sendMail,
  withdrawalCopyMail,
  withdrawalCustomerMail,
  withdrawalSummary,
  type WithdrawalDetails,
} from "@/lib/mail";

/**
 * POST /api/herroepen (docs/PLAN.md §15.4, brief §6 Herroepen, decision 66): receives a withdrawal, mails the
 * customer a receipt with the content and the date and time of receipt, and sends Sparkela a copy.
 *
 * - Honeypot: a real receipt (reference, time, summary of the input) without any mail (decision 126).
 * - Validation, rate limit (5 per 10 minutes per IP).
 * - receivedAt is read here (route handlers may read the clock); reference "HR-" plus 8 hex characters.
 * - Without MAIL_API_KEY, MAIL_FROM or MAIL_TO: "not-configured"; the form then opens a mailto with the details.
 * - The customer's mail failing → upstream (the customer must get a receipt), within FORM_DEADLINE_MS.
 * - The copy to Sparkela is the only record of the withdrawal (there is no database), so it is sent after the
 *   response (`after()`: the visitor only waits for their own receipt) and tried up to three times with the same
 *   Idempotency-Key (Resend sends it at most once). Only when all attempts fail is it logged, with the reference
 *   ("herroepen-copy-mail-failed HR-…", not personal data), so Tristan can match it to the customer's receipt
 *   (decision 199).
 */

/** Waits before the 2nd and 3rd attempt of the copy mail. */
const COPY_RETRY_DELAYS_MS = [2_000, 8_000] as const;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendCopy(receipt: WithdrawalReceipt, details: WithdrawalDetails, to: string): Promise<void> {
  const message = {
    to,
    ...withdrawalCopyMail(receipt, details),
    replyTo: details.email,
    idempotencyKey: `${receipt.reference}-kopie`,
  };
  for (let attempt = 0; ; attempt += 1) {
    if ((await sendMail(message)).ok) return;
    const delay = COPY_RETRY_DELAYS_MS[attempt];
    if (delay === undefined) break;
    await wait(delay);
  }
  console.error(`herroepen-copy-mail-failed ${receipt.reference}`);
}

function reference(): string {
  return `HR-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function receiptFor(details: WithdrawalDetails, receivedAt: number): WithdrawalReceipt {
  return {
    reference: reference(),
    receivedAt: new Date(receivedAt).toISOString(),
    receivedAtLabel: formatDateTimeNl(receivedAt),
    summary: withdrawalSummary(details),
  };
}

/** The honeypot's echo: whatever strings came in, trimmed and cut to the form's limits. */
function echo(body: unknown): WithdrawalDetails {
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const field = (name: string, max: number) => (typeof record[name] === "string" ? (record[name] as string).trim().slice(0, max) : "");
  const products = field("products", FORM_LIMITS.products);
  return {
    name: field("name", FORM_LIMITS.nameMax),
    orderNumber: field("orderNumber", 20),
    email: field("email", FORM_LIMITS.email),
    ...(products ? { products } : {}),
  };
}

export async function POST(request: Request): Promise<Response> {
  const deadline = Date.now() + FORM_DEADLINE_MS;
  const body = await readJsonBody(request);
  if (body === null) return formError("invalid");
  if (honeypotFilled(body)) return formOk(receiptFor(echo(body), Date.now()));

  const validated = validateWithdrawal(body);
  if (!validated.ok) return formError("invalid", { fieldErrors: validated.fieldErrors as Record<string, string> });

  const limit = rateLimit(clientKey(request, "herroepen"), RATE_LIMITS.herroepen);
  if (!limit.ok) return formError("rate-limited", { retryAfterMs: limit.retryAfterMs });

  const config = getMailConfig();
  if (config === null || config.to === null) return formError("not-configured");

  const { name, orderNumber, email, products } = validated.value;
  const details: WithdrawalDetails = { name, orderNumber, email, ...(products ? { products } : {}) };
  const receipt = receiptFor(details, Date.now());

  const customer = await sendMail({
    to: email,
    ...withdrawalCustomerMail(receipt, details),
    replyTo: config.to,
    idempotencyKey: `${receipt.reference}-klant`,
    deadline,
  });
  if (!customer.ok) {
    console.error("herroepen-customer-mail-failed");
    return formError("upstream");
  }

  const to = config.to;
  after(() => sendCopy(receipt, details, to));

  return formOk(receipt);
}
