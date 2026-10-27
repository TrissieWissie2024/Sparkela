import { FORM_DEADLINE_MS } from "@/lib/deadline";
import { clientKey, RATE_LIMITS, rateLimit } from "@/lib/forms/rate-limit";
import { formError, formOk, readJsonBody } from "@/lib/forms/responses";
import { honeypotFilled, validateContact } from "@/lib/forms/validation";
import { contactMail, getMailConfig, sendMail } from "@/lib/mail";

/**
 * POST /api/contact (docs/PLAN.md §15.5): one mail to MAIL_TO with reply_to the sender (HTML values escaped), subject
 * "Contact: {naam}". Honeypot (silent ok), validation, rate limit (5 per 10 minutes per IP); without MAIL_API_KEY,
 * MAIL_FROM or MAIL_TO "not-configured", and the form shows Sparkela's address. One budget for the request
 * (FORM_DEADLINE_MS, decision 198).
 */

export async function POST(request: Request): Promise<Response> {
  const deadline = Date.now() + FORM_DEADLINE_MS;
  const body = await readJsonBody(request);
  if (body === null) return formError("invalid");
  if (honeypotFilled(body)) return formOk(undefined);

  const validated = validateContact(body);
  if (!validated.ok) return formError("invalid", { fieldErrors: validated.fieldErrors as Record<string, string> });

  const limit = rateLimit(clientKey(request, "contact"), RATE_LIMITS.contact);
  if (!limit.ok) return formError("rate-limited", { retryAfterMs: limit.retryAfterMs });

  const config = getMailConfig();
  if (config === null || config.to === null) return formError("not-configured");

  const { name, email, orderNumber, message } = validated.value;
  const sent = await sendMail({
    to: config.to,
    ...contactMail({ name, email, message, ...(orderNumber ? { orderNumber } : {}) }),
    replyTo: email,
    idempotencyKey: `contact-${crypto.randomUUID()}`,
    deadline,
  });
  if (!sent.ok) {
    console.error("contact-mail-failed");
    return formError("upstream");
  }
  return formOk(undefined);
}
