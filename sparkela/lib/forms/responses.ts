import type { FormErrorCode, FormResponse } from "@/lib/types";
import { site } from "@/content/site";

/**
 * FormResponse helpers (docs/PLAN.md §6.11, §15.1). Route handlers answer with formOk / formError; the browser reads
 * the answer with parseFormResponse (components/forms/submitForm.ts). Every answer is JSON with
 * `Cache-Control: no-store`. Status codes: 200 ok, 400 invalid, 429 rate-limited, 503 not-configured, 502 upstream.
 * Every error carries Sparkela's e-mail address (`fallbackEmail`), so a form can always offer the mailto fallback.
 * Pure (Response is a web standard), so the client may import it too.
 */

export const FORM_STATUS: Record<FormErrorCode, number> = {
  invalid: 400,
  "rate-limited": 429,
  "not-configured": 503,
  upstream: 502,
};

const FORM_ERROR_CODES = new Set<FormErrorCode>(["invalid", "rate-limited", "not-configured", "upstream"]);

/** Largest JSON body a form route reads (a withdrawal with 1000 characters of products is far below this). */
export const MAX_BODY_CHARS = 20_000;

export function formHeaders(extra?: Record<string, string>): Headers {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  if (extra) for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  return headers;
}

/** 200 { ok: true, data }. */
export function formOk<T>(data: T): Response {
  const body: FormResponse<T> = { ok: true, data };
  return new Response(JSON.stringify(body), { status: 200, headers: formHeaders() });
}

/** 400/429/503/502 { ok: false, error, fieldErrors?, fallbackEmail }. */
export function formError(
  error: FormErrorCode,
  options: { fieldErrors?: Record<string, string>; retryAfterMs?: number } = {},
): Response {
  const body: FormResponse<never> = {
    ok: false,
    error,
    ...(options.fieldErrors && Object.keys(options.fieldErrors).length > 0 ? { fieldErrors: options.fieldErrors } : {}),
    fallbackEmail: site.email,
  };
  const extra =
    error === "rate-limited" && options.retryAfterMs !== undefined
      ? { "Retry-After": String(Math.max(1, Math.ceil(options.retryAfterMs / 1000))) }
      : undefined;
  return new Response(JSON.stringify(body), { status: FORM_STATUS[error], headers: formHeaders(extra) });
}

/** The JSON body of a request, or null when it is missing, too large or not JSON. Never throws. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    const raw = await request.text();
    if (raw.length === 0 || raw.length > MAX_BODY_CHARS) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads a route's JSON answer as a FormResponse. Anything unexpected becomes `upstream` with the fallback address,
 * so the UI never shows something undefined. The data itself is the route's own shape (typed by the caller).
 */
export function parseFormResponse<T>(value: unknown): FormResponse<T> {
  if (isRecord(value) && value.ok === true) return { ok: true, data: value.data as T };
  if (isRecord(value) && value.ok === false && FORM_ERROR_CODES.has(value.error as FormErrorCode)) {
    const fieldErrors = isRecord(value.fieldErrors)
      ? Object.fromEntries(
          Object.entries(value.fieldErrors).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        )
      : undefined;
    return {
      ok: false,
      error: value.error as FormErrorCode,
      ...(fieldErrors && Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
      fallbackEmail: typeof value.fallbackEmail === "string" && value.fallbackEmail ? value.fallbackEmail : site.email,
    };
  }
  return { ok: false, error: "upstream", fallbackEmail: site.email };
}
