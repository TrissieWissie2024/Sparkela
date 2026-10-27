import type { SubscribeResult } from "@/lib/types";
import {
  adminErrorLogCode,
  newsletterTags,
  upsertPendingSubscriber,
} from "@/lib/commerce/shopify/admin";
import { getShopifyAdminConfig } from "@/lib/commerce/shopify/config";
import { FORM_DEADLINE_MS } from "@/lib/deadline";
import { getEnv, readSecret } from "@/lib/env";
import { CONFIRM_TOKEN_TTL_MS, createConfirmToken, sha256Hex } from "@/lib/forms/confirm-token";
import { clientKey, RATE_LIMITS, rateLimit } from "@/lib/forms/rate-limit";
import { formError, formOk, readJsonBody } from "@/lib/forms/responses";
import { honeypotFilled, validateSubscribe } from "@/lib/forms/validation";
import { confirmationMail, getMailConfig, memberMail, sendMail } from "@/lib/mail";
import { welcomeCode } from "@/content/offers";

/**
 * POST /api/subscribe (docs/PLAN.md §15.2, decisions 74, 110, 111, 126, 198, 199): always double opt-in.
 *
 * 1. Honeypot (a believable "pending" without any call), validation, rate limit (5 per 10 minutes per IP).
 * 2. Without the Admin configuration, NEWSLETTER_CONFIRM_SECRET, MAIL_API_KEY or MAIL_FROM: "not-configured" with the
 *    fallback address. Never a silent single opt-in.
 * 3. Admin API: the customer by exact address; new → customerCreate on PENDING with the tags; an existing member
 *    (SUBSCRIBED) → nothing changes; any other existing customer → consent back to PENDING, its tags only after the
 *    confirmation (they travel in the signed token).
 * 4. One mail either way: the confirmation link (customer id, time and the pending tags, no address), or for a member
 *    the fixed "je bent al lid" mail. The answer is "pending" for every address, so it tells nobody whether an address
 *    is a member. Idempotency-Key per token, and per member per day (one such mail a day at most).
 * The whole request has one budget (FORM_DEADLINE_MS) below the browser's time-out. Logs carry fixed codes only.
 */

const CONFIRM_PATH = "/nieuwsbrief/bevestigen";
const DAY_MS = 24 * 60 * 60 * 1000;

function result(): SubscribeResult {
  return { status: "pending", code: welcomeCode.code };
}

export async function POST(request: Request): Promise<Response> {
  const deadline = Date.now() + FORM_DEADLINE_MS;
  const body = await readJsonBody(request);
  if (body === null) return formError("invalid");
  if (honeypotFilled(body)) return formOk(result());

  const validated = validateSubscribe(body);
  if (!validated.ok) return formError("invalid", { fieldErrors: validated.fieldErrors as Record<string, string> });

  const limit = rateLimit(clientKey(request, "subscribe"), RATE_LIMITS.subscribe);
  if (!limit.ok) return formError("rate-limited", { retryAfterMs: limit.retryAfterMs });

  const secret = readSecret("NEWSLETTER_CONFIRM_SECRET");
  if (getShopifyAdminConfig() === null || secret === null || getMailConfig() === null) {
    return formError("not-configured");
  }

  const { email } = validated.value;
  const now = Date.now();
  let customer: Awaited<ReturnType<typeof upsertPendingSubscriber>>;
  try {
    customer = await upsertPendingSubscriber(email, newsletterTags(validated.value), now, undefined, deadline);
  } catch (error) {
    console.error(adminErrorLogCode(error));
    return formError("upstream");
  }

  let sent: Awaited<ReturnType<typeof sendMail>>;
  if (customer.status === "already-subscribed") {
    const day = Math.floor(now / DAY_MS);
    sent = await sendMail({
      to: email,
      ...memberMail(),
      idempotencyKey: `subscribe-member-${await sha256Hex(`${customer.customerId}:${day}`)}`,
      deadline,
    });
  } else {
    const token = await createConfirmToken(customer.customerId, now, secret, customer.tagsOnConfirm);
    const link = `${getEnv().siteUrl}${CONFIRM_PATH}?t=${token}`;
    const mail = confirmationMail(link, Math.round(CONFIRM_TOKEN_TTL_MS / DAY_MS));
    sent = await sendMail({ to: email, ...mail, idempotencyKey: `subscribe-${await sha256Hex(token)}`, deadline });
  }
  if (!sent.ok) {
    console.error("subscribe-mail-failed");
    return formError("upstream");
  }
  return formOk(result());
}
