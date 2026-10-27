import type { FormResponse } from "@/lib/types";
import { parseFormResponse } from "@/lib/forms/responses";
import { site } from "@/content/site";

/**
 * Posts a form as JSON to its route (docs/PLAN.md §15.1) and reads the answer as a FormResponse. A time-out of 15 s
 * (above the routes' 12 s budget, FORM_DEADLINE_MS in lib/deadline.ts, decision 198), a network error or an
 * unexpected answer becomes `upstream` with Sparkela's address, so the form can always offer the mailto fallback.
 * Client-side only (forms call it in their submit handler).
 */

export const SUBMIT_TIMEOUT_MS = 15_000;

export async function submitForm<T>(url: string, body: unknown): Promise<FormResponse<T>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });
    const data: unknown = await response.json().catch(() => null);
    return parseFormResponse<T>(data);
  } catch {
    return { ok: false, error: "upstream", fallbackEmail: site.email };
  }
}
