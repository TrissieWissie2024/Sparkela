import type { CartResult } from "@/lib/commerce/types";
import type { Cart, CheckoutState, Money } from "@/lib/types";
import { isValidEmail } from "@/lib/forms/validation";
import { formatMoney } from "@/lib/money";
import { cartCopy } from "@/content/copy/cart";
import { pagesCopy } from "@/content/copy/pages";
import { discountLabel } from "@/components/cart/discountLabel";

/**
 * Pure logic of the local demo checkout (docs/PLAN.md §13.13, §14.18; brief §7): the fields and their check, the demo
 * order reference, the snapshot shown after placing, and emptying the cart through the cart actions. No React and no
 * next/*, so CheckoutView.test.tsx can test them directly. Nothing here sends or stores anything.
 */

export type CheckoutField = "email" | "firstName" | "lastName" | "street" | "postalCode" | "city";

export type CheckoutValues = Record<CheckoutField, string>;

export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

export const EMPTY_CHECKOUT_VALUES: CheckoutValues = {
  email: "",
  firstName: "",
  lastName: "",
  street: "",
  postalCode: "",
  city: "",
};

/** Field order: focus goes to the first field with an error. */
export const CHECKOUT_FIELDS: readonly CheckoutField[] = ["email", "firstName", "lastName", "street", "postalCode", "city"];

/** The address fields (not needed for gift cards only). */
export const ADDRESS_FIELDS: readonly CheckoutField[] = ["firstName", "lastName", "street", "postalCode", "city"];

/** Visible label per field (pagesCopy.checkout). */
export function fieldLabel(field: CheckoutField): string {
  const copy = pagesCopy.checkout;
  return field === "email" ? copy.contact.email : copy.address[field];
}

/** Errors of the form: email required and valid; the address fields required when something is shipped. */
export function validateCheckout(values: CheckoutValues, needsAddress: boolean): CheckoutErrors {
  const errors: CheckoutErrors = {};
  const email = values.email.trim();
  if (email === "") errors.email = pagesCopy.checkout.errors.required(fieldLabel("email"));
  else if (!isValidEmail(email)) errors.email = pagesCopy.checkout.errors.email;
  if (needsAddress) {
    for (const field of ADDRESS_FIELDS) {
      if (values[field].trim() === "") errors[field] = pagesCopy.checkout.errors.required(fieldLabel(field));
    }
  }
  return errors;
}

/** No ambiguous characters (0/O, 1/I/L), so a reference reads back without doubt. */
export const DEMO_REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const DEMO_REF_PREFIX = "DEMO-";

/** "DEMO-" plus six characters from DEMO_REF_ALPHABET, one per byte (pure: the bytes come from the caller). */
export function demoOrderRef(bytes: ArrayLike<number>): string {
  let out = "";
  for (let index = 0; index < 6; index += 1) {
    const byte = bytes[index] ?? 0;
    out += DEMO_REF_ALPHABET[byte % DEMO_REF_ALPHABET.length];
  }
  return `${DEMO_REF_PREFIX}${out}`;
}

/** A fresh demo reference from crypto.getRandomValues. Event handlers only (never during render). */
export function newDemoOrderRef(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return demoOrderRef(bytes);
}

/** What the confirmation shows once the cart is empty again. */
export interface PlacedOrder {
  orderRef: string;
  email: string;
  itemCount: number;
  total: Money;
  lines: Array<{ id: string; title: string; variant: string | null; quantity: number }>;
  /**
   * What else was in the order (QA round 5: the confirmation dropped them): the gift wrap ("Cadeauverpakking €1,95")
   * and one row per discount, as in the review ("Code WELKOM10 −€4,69", "Gratis cadeauverpakking in december −€1,95").
   */
  extras: Array<{ id: string; label: string; value: string }>;
  /** The gift message, or "". */
  note: string;
}

export function placedOrderFrom(cart: Cart, orderRef: string, email: string): PlacedOrder {
  const extras: PlacedOrder["extras"] = [];
  if (cart.giftWrap.selected) {
    extras.push({ id: "cadeauverpakking", label: cartCopy.giftWrap.label, value: formatMoney(cart.giftWrap.price) });
  }
  for (const discount of cart.discounts) {
    if (discount.amount.cents <= 0) continue;
    extras.push({
      id: `korting-${discount.source}-${discount.code ?? discount.title}`,
      label: discountLabel(discount),
      value: formatMoney(-discount.amount.cents),
    });
  }
  return {
    orderRef,
    email: email.trim(),
    itemCount: cart.itemCount,
    total: cart.totals.total,
    lines: cart.lines.map((line) => ({
      id: line.id,
      title: line.merchandise.productTitle,
      variant: line.merchandise.variantTitle,
      quantity: line.quantity,
    })),
    extras,
    note: cart.note.trim(),
  };
}

/** The cart actions emptyCart() needs (a subset of useCart()). */
export interface CartClearer {
  removeLine(lineId: string, options?: { announce?: boolean }): Promise<CartResult>;
  removeDiscountCode(code: string): Promise<CartResult>;
  setGiftWrap(enabled: boolean): Promise<CartResult>;
  setNote(note: string): Promise<CartResult>;
}

/**
 * Empties the cart after the demo order, one action after another (the provider queues them anyway): gift wrap off,
 * every code removed, the gift message cleared, then every line. True when every action succeeded.
 */
export async function emptyCart(cart: Cart, actions: CartClearer): Promise<boolean> {
  let ok = true;
  const run = async (call: () => Promise<CartResult>) => {
    const result = await call();
    if (!result.ok) ok = false;
  };
  if (cart.giftWrap.selected) await run(() => actions.setGiftWrap(false));
  for (const state of cart.discountCodes) await run(() => actions.removeDiscountCode(state.code));
  if (cart.note) await run(() => actions.setNote(""));
  // Silently: right after "Je demo-bestelling is geplaatst" a screen reader must not hear "Verwijderd: …" per line.
  for (const line of cart.lines) await run(() => actions.removeLine(line.id, { announce: false }));
  return ok;
}

/** The state machine of the demo checkout (CheckoutState, plan §6.10): review → placing → placed. */
export function toPlacing(state: CheckoutState): CheckoutState {
  return state.status === "review" ? { status: "placing", orderRef: null } : state;
}

export function toPlaced(state: CheckoutState, orderRef: string): CheckoutState {
  return state.status === "placing" ? { status: "placed", orderRef } : state;
}

export const INITIAL_CHECKOUT_STATE: CheckoutState = { status: "review", orderRef: null };
