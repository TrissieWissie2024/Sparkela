import type { SubscribeConfirmResult } from "@/lib/types";
import { adminErrorLogCode, confirmSubscriber } from "@/lib/commerce/shopify/admin";
import { getShopifyAdminConfig } from "@/lib/commerce/shopify/config";
import { FORM_DEADLINE_MS } from "@/lib/deadline";
import { readSecret } from "@/lib/env";
import { verifyConfirmToken } from "@/lib/forms/confirm-token";
import { clientKey, RATE_LIMITS, rateLimit } from "@/lib/forms/rate-limit";
import { formError, formOk, readJsonBody } from "@/lib/forms/responses";
import { honeypotFilled, validateConfirm } from "@/lib/forms/validation";
import { formsCopy } from "@/content/copy/forms";

/**
 * POST /api/subscribe/confirm (docs/PLAN.md §15.3): finishes the double opt-in. Called by the one button on
 * /nieuwsbrief/bevestigen, never on page load (mail scanners open links).
 *
 * Validation and rate limit (10 per 10 minutes per IP); the signed token gives the customer id or "invalid" /
 * "expired" (400 with fieldErrors.token); then the customer: none → invalid, SUBSCRIBED → "already-confirmed",
 * PENDING → the token's tags and consent to SUBSCRIBED / CONFIRMED_OPT_IN, any other state (unsubscribed since the
 * link was sent, redacted) → "expired", so the visitor gets the sign-up form again (decision 199). ACCESS_DENIED →
 * upstream, logged as "admin-pii-denied". One budget for the request (FORM_DEADLINE_MS, decision 198).
 */

export async function POST(request: Request): Promise<Response> {
  const deadline = Date.now() + FORM_DEADLINE_MS;
  const body = await readJsonBody(request);
  if (body === null) return formError("invalid", { fieldErrors: { token: formsCopy.confirm.invalid } });
  if (honeypotFilled(body)) return formOk<SubscribeConfirmResult>({ status: "confirmed" });

  const validated = validateConfirm(body);
  if (!validated.ok) return formError("invalid", { fieldErrors: validated.fieldErrors as Record<string, string> });

  const limit = rateLimit(clientKey(request, "confirm"), RATE_LIMITS.confirm);
  if (!limit.ok) return formError("rate-limited", { retryAfterMs: limit.retryAfterMs });

  const secret = readSecret("NEWSLETTER_CONFIRM_SECRET");
  if (secret === null || getShopifyAdminConfig() === null) return formError("not-configured");

  const now = Date.now();
  const verified = await verifyConfirmToken(validated.value.token, now, secret);
  if (verified === "invalid" || verified === "expired") {
    return formError("invalid", { fieldErrors: { token: formsCopy.confirm[verified] } });
  }

  let status: Awaited<ReturnType<typeof confirmSubscriber>>;
  try {
    status = await confirmSubscriber(verified.customerId, now, undefined, { tags: verified.tags, deadline });
  } catch (error) {
    console.error(adminErrorLogCode(error));
    return formError("upstream");
  }
  if (status === "not-found") return formError("invalid", { fieldErrors: { token: formsCopy.confirm.invalid } });
  if (status === "stale") return formError("invalid", { fieldErrors: { token: formsCopy.confirm.expired } });
  return formOk<SubscribeConfirmResult>({ status });
}
