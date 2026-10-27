import type {
  ContactRequest,
  Moment,
  QuizAnswers,
  QuizTypeAnswer,
  SubscribeConfirmRequest,
  SubscribeRequest,
  SubscribeSource,
  Vibe,
  WithdrawalRequest,
} from "@/lib/types";
import { formsCopy } from "@/content/copy/forms";
import { quiz } from "@/content/quiz";

/**
 * Validation of every form (docs/PLAN.md §15.1). The same functions run twice: in the browser on submit (field
 * errors under the fields) and in the route handler, which decides. Pure: no next/* imports, no clock, client-safe.
 *
 * Every validator takes `unknown` (a parsed JSON body or the form's values) and returns the normalized request or the
 * field errors. A failure without field errors (an unknown `source`, a malformed `quiz`) is a 400 without a message:
 * our own forms never send those. The honeypot (`website`) is checked first, separately (honeypotFilled).
 */

/** Limits from the plan's table (§15.1). */
export const FORM_LIMITS = {
  email: 254,
  nameMin: 2,
  nameMax: 100,
  products: 1000,
  messageMin: 10,
  messageMax: 2000,
  token: 600,
} as const;

/**
 * Strict on purpose (decision 76): no quotes, backslashes, `*` or `:`, so an address can never be read as search
 * syntax. The Admin API gets it as a GraphQL variable anyway.
 */
export const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** "#1001", "1001", "SP1001": an optional #, up to 4 letters and 3 to 10 digits. */
export const ORDER_NUMBER_PATTERN = /^#?[A-Za-z]{0,4}\d{3,10}$/;

/** The double opt-in token: base64url payload, a dot and a base64url HMAC-SHA256 (43 characters). */
export const CONFIRM_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;

export const SUBSCRIBE_SOURCES: readonly SubscribeSource[] = ["popup", "finder", "club", "footer", "wachtlijst"];

export type FieldErrors<F extends string = string> = Partial<Record<F, string>>;

export type Validated<T, F extends string> = { ok: true; value: T } | { ok: false; fieldErrors: FieldErrors<F> };

export type SubscribeField = "email" | "consent";
export type WithdrawalField = "name" | "orderNumber" | "email" | "products";
export type ContactField = "name" | "email" | "orderNumber" | "message";
export type ConfirmField = "token";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The trimmed string, or null when the value is not a string. */
function text(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

/** Trimmed, lower case: the form in which an address is stored and looked up. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return value.length <= FORM_LIMITS.email && EMAIL_PATTERN.test(value);
}

/** True when the honeypot field `website` holds anything: the route then answers a believable success and does nothing. */
export function honeypotFilled(input: unknown): boolean {
  if (!isRecord(input)) return false;
  return typeof input.website === "string" && input.website.trim() !== "";
}

function failed<F extends string>(errors: FieldErrors<F>): boolean {
  return Object.keys(errors).length > 0;
}

function checkEmail(value: unknown): { email: string | null; error?: string } {
  const raw = text(value);
  const email = raw === null ? null : normalizeEmail(raw);
  if (email === null || !isValidEmail(email)) return { email: null, error: formsCopy.validation.email };
  return { email };
}

function checkName(value: unknown): { name: string | null; error?: string } {
  const name = text(value);
  if (name === null || name.length < FORM_LIMITS.nameMin || name.length > FORM_LIMITS.nameMax) {
    return { name: null, error: formsCopy.validation.name };
  }
  return { name };
}

function checkOrderNumber(value: unknown): { orderNumber: string | null; error?: string } {
  const orderNumber = text(value);
  if (orderNumber === null || !ORDER_NUMBER_PATTERN.test(orderNumber)) {
    return { orderNumber: null, error: formsCopy.validation.orderNumber };
  }
  return { orderNumber };
}

const quizValues = {
  vibe: new Set(quiz.questions.find((q) => q.id === "vibe")?.options.map((o) => o.value) ?? []),
  moment: new Set(quiz.questions.find((q) => q.id === "moment")?.options.map((o) => o.value) ?? []),
  type: new Set(quiz.questions.find((q) => q.id === "type")?.options.map((o) => o.value) ?? []),
};

/** The quiz answers, or null when anything is not a value from quiz.questions. */
export function parseQuizAnswers(value: unknown): QuizAnswers | null {
  if (!isRecord(value)) return null;
  const { vibe, moment, type } = value;
  if (typeof vibe !== "string" || !quizValues.vibe.has(vibe)) return null;
  if (typeof moment !== "string" || !quizValues.moment.has(moment)) return null;
  if (typeof type !== "string" || !quizValues.type.has(type)) return null;
  return { vibe: vibe as Vibe, moment: moment as Moment, type: type as QuizTypeAnswer };
}

export function isSubscribeSource(value: unknown): value is SubscribeSource {
  return typeof value === "string" && (SUBSCRIBE_SOURCES as readonly string[]).includes(value);
}

/** POST /api/subscribe and SubscribeForm (plan §15.2). */
export function validateSubscribe(input: unknown): Validated<SubscribeRequest, SubscribeField> {
  if (!isRecord(input)) return { ok: false, fieldErrors: {} };
  const errors: FieldErrors<SubscribeField> = {};
  const { email, error } = checkEmail(input.email);
  if (error) errors.email = error;
  if (input.consent !== true) errors.consent = formsCopy.subscribe.consentError;
  if (failed(errors) || email === null) return { ok: false, fieldErrors: errors };
  if (!isSubscribeSource(input.source)) return { ok: false, fieldErrors: {} };
  let quizAnswers: QuizAnswers | undefined;
  if (input.quiz !== undefined && input.quiz !== null) {
    const parsed = parseQuizAnswers(input.quiz);
    if (parsed === null) return { ok: false, fieldErrors: {} };
    quizAnswers = parsed;
  }
  return {
    ok: true,
    value: { email, consent: true, source: input.source, ...(quizAnswers ? { quiz: quizAnswers } : {}), website: "" },
  };
}

/** POST /api/subscribe/confirm and ConfirmSubscription (plan §15.3). A bad token reads as "this link does not work". */
export function validateConfirm(input: unknown): Validated<SubscribeConfirmRequest, ConfirmField> {
  const token = isRecord(input) ? text(input.token) : null;
  if (token === null || token.length > FORM_LIMITS.token || !CONFIRM_TOKEN_PATTERN.test(token)) {
    return { ok: false, fieldErrors: { token: formsCopy.confirm.invalid } };
  }
  return { ok: true, value: { token } };
}

/** POST /api/herroepen and WithdrawalForm (plan §15.4). */
export function validateWithdrawal(input: unknown): Validated<WithdrawalRequest, WithdrawalField> {
  if (!isRecord(input)) return { ok: false, fieldErrors: {} };
  const errors: FieldErrors<WithdrawalField> = {};
  const { name, error: nameError } = checkName(input.name);
  if (nameError) errors.name = nameError;
  const { orderNumber, error: orderError } = checkOrderNumber(input.orderNumber);
  if (orderError) errors.orderNumber = orderError;
  const { email, error: emailError } = checkEmail(input.email);
  if (emailError) errors.email = emailError;
  let products: string | undefined;
  if (input.products !== undefined && input.products !== null) {
    const value = text(input.products);
    if (value === null || value.length > FORM_LIMITS.products) errors.products = formsCopy.validation.tooLong(FORM_LIMITS.products);
    else if (value !== "") products = value;
  }
  if (failed(errors) || name === null || orderNumber === null || email === null) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { name, orderNumber, email, ...(products ? { products } : {}), website: "" } };
}

/** POST /api/contact and ContactForm (plan §15.5). */
export function validateContact(input: unknown): Validated<ContactRequest, ContactField> {
  if (!isRecord(input)) return { ok: false, fieldErrors: {} };
  const errors: FieldErrors<ContactField> = {};
  const { name, error: nameError } = checkName(input.name);
  if (nameError) errors.name = nameError;
  const { email, error: emailError } = checkEmail(input.email);
  if (emailError) errors.email = emailError;
  let orderNumber: string | undefined;
  if (input.orderNumber !== undefined && input.orderNumber !== null && text(input.orderNumber) !== "") {
    const checked = checkOrderNumber(input.orderNumber);
    if (checked.error) errors.orderNumber = checked.error;
    else orderNumber = checked.orderNumber ?? undefined;
  }
  const message = text(input.message);
  if (message === null || message.length < FORM_LIMITS.messageMin) errors.message = formsCopy.validation.message;
  else if (message.length > FORM_LIMITS.messageMax) errors.message = formsCopy.validation.tooLong(FORM_LIMITS.messageMax);
  if (failed(errors) || name === null || email === null || message === null) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { name, email, ...(orderNumber ? { orderNumber } : {}), message, website: "" } };
}
