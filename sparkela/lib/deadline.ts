/**
 * Time budgets for route handlers that make several upstream calls in a row (docs/PLAN.md §7.4, §15.1, decision 198).
 * A route sets one deadline (epoch ms, Date.now() based, never the test clock) when the request comes in and passes it
 * to every Storefront, Admin and Resend call. Each attempt then gets the shorter of its own time-out and the time left,
 * and a retry only starts when there is still room for it. So the route answers before the browser gives up, and the
 * browser never shows "Dat lukt nu even niet" while the server goes on and succeeds.
 *
 * Browser time-outs (lib/commerce/cart/shopify-adapter.ts 10 s, components/forms/submitForm.ts 15 s) stay above these
 * budgets, with room for a cold start and the network.
 */

/** /api/cart: one budget for the whole request (VariantGate, the mutation, a re-read or a new cart). */
export const CART_DEADLINE_MS = 8_500;

/** /api/subscribe, /api/subscribe/confirm, /api/herroepen (the customer's receipt) and /api/contact. */
export const FORM_DEADLINE_MS = 12_000;

/** A retry is only started when at least this much time is left after its delay. */
export const MIN_ATTEMPT_MS = 1_000;

/** Milliseconds left until `deadline`; Infinity without one. */
export function remainingMs(deadline: number | undefined, now: number = Date.now()): number {
  return deadline === undefined ? Number.POSITIVE_INFINITY : deadline - now;
}

/**
 * The abort signal of one attempt: `timeoutMs`, or less when the deadline comes first. Null when the deadline has
 * already passed (the caller treats that as a time-out without sending anything).
 */
export function attemptSignal(timeoutMs: number, deadline?: number): AbortSignal | null {
  const left = remainingMs(deadline);
  if (left <= 0) return null;
  return AbortSignal.timeout(Math.min(timeoutMs, left));
}

/** True when a retry after `delayMs` still leaves at least MIN_ATTEMPT_MS before the deadline. */
export function canRetry(delayMs: number, deadline?: number): boolean {
  return remainingMs(deadline) > delayMs + MIN_ATTEMPT_MS;
}
