import { describe, expect, it } from "vitest";

import {
  FORM_LIMITS,
  honeypotFilled,
  isValidEmail,
  normalizeEmail,
  parseQuizAnswers,
  validateConfirm,
  validateContact,
  validateSubscribe,
  validateWithdrawal,
} from "@/lib/forms/validation";
import { formsCopy } from "@/content/copy/forms";

const validToken = `${"eyJjIjoiMTIzIiwidCI6MX0"}.${"a".repeat(43)}`;

describe("email (plan §15.1)", () => {
  it("accepts ordinary addresses, trimmed and lower case", () => {
    expect(isValidEmail("sanne@voorbeeld.nl")).toBe(true);
    expect(isValidEmail("s.de-vries+club@mail.example.com")).toBe(true);
    expect(normalizeEmail("  Sanne@Voorbeeld.NL ")).toBe("sanne@voorbeeld.nl");
  });

  it('rejects "*", quotes, backslashes, ":" and other malformed input', () => {
    for (const bad of [
      "*@gmail.com",
      'sanne"@voorbeeld.nl',
      "san\\ne@voorbeeld.nl",
      "sanne:x@voorbeeld.nl",
      "sanne@voorbeeld",
      "sanne@voorbeeld.n",
      "sanne voorbeeld.nl",
      "@voorbeeld.nl",
      "",
    ]) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
    expect(isValidEmail(`${"a".repeat(250)}@x.nl`)).toBe(false);
  });
});

describe("validateSubscribe", () => {
  const base = { email: " Sanne@Voorbeeld.nl ", consent: true, source: "wachtlijst", website: "" };

  it("returns the normalized request", () => {
    expect(validateSubscribe(base)).toEqual({
      ok: true,
      value: { email: "sanne@voorbeeld.nl", consent: true, source: "wachtlijst", website: "" },
    });
  });

  it("needs a valid email and a ticked consent box, with messages", () => {
    const result = validateSubscribe({ ...base, email: "nope", consent: false });
    expect(result).toEqual({
      ok: false,
      fieldErrors: { email: formsCopy.validation.email, consent: formsCopy.subscribe.consentError },
    });
    expect(validateSubscribe({ ...base, consent: "true" }).ok).toBe(false);
  });

  it("rejects an unknown source or a malformed quiz without a field error", () => {
    expect(validateSubscribe({ ...base, source: "admin" })).toEqual({ ok: false, fieldErrors: {} });
    expect(validateSubscribe({ ...base, source: "finder", quiz: { vibe: "x", moment: "strand", type: "ringen" } })).toEqual({
      ok: false,
      fieldErrors: {},
    });
    expect(validateSubscribe(null)).toEqual({ ok: false, fieldErrors: {} });
  });

  it("keeps valid quiz answers", () => {
    const quiz = { vibe: "retro", moment: "strand", type: "verras-me" };
    const result = validateSubscribe({ ...base, source: "finder", quiz });
    expect(result.ok && result.value.quiz).toEqual(quiz);
    expect(parseQuizAnswers({ vibe: "retro", moment: "strand" })).toBeNull();
  });
});

describe("validateWithdrawal", () => {
  const base = { name: "Sanne de Vries", orderNumber: "#1001", email: "sanne@voorbeeld.nl", website: "" };

  it("accepts the required fields and drops empty products", () => {
    expect(validateWithdrawal({ ...base, products: "  " })).toEqual({ ok: true, value: { ...base } });
    const withProducts = validateWithdrawal({ ...base, products: "Lola chunky hoops" });
    expect(withProducts.ok && withProducts.value.products).toBe("Lola chunky hoops");
  });

  it("gives three field errors for an empty form", () => {
    const result = validateWithdrawal({ name: "", orderNumber: "", email: "", website: "" });
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        name: formsCopy.validation.name,
        orderNumber: formsCopy.validation.orderNumber,
        email: formsCopy.validation.email,
      },
    });
  });

  it("checks the order number pattern and the products length", () => {
    for (const ok of ["#1001", "1001", "SP1001", "#ABCD1234567890"]) {
      expect(validateWithdrawal({ ...base, orderNumber: ok }).ok, ok).toBe(true);
    }
    for (const bad of ["#12", "bestelling 1001", "#ABCDE1001", "1001!", "#12345678901"]) {
      expect(validateWithdrawal({ ...base, orderNumber: bad }).ok, bad).toBe(false);
    }
    const long = validateWithdrawal({ ...base, products: "x".repeat(FORM_LIMITS.products + 1) });
    expect(long).toEqual({ ok: false, fieldErrors: { products: formsCopy.validation.tooLong(FORM_LIMITS.products) } });
  });

  it("needs a name of 2 to 100 characters", () => {
    expect(validateWithdrawal({ ...base, name: "S" }).ok).toBe(false);
    expect(validateWithdrawal({ ...base, name: "S".repeat(101) }).ok).toBe(false);
    expect(validateWithdrawal({ ...base, name: "Sa" }).ok).toBe(true);
  });
});

describe("validateContact", () => {
  const base = { name: "Sanne", email: "sanne@voorbeeld.nl", message: "Hoe groot zijn de Lola hoops?", website: "" };

  it("accepts a message with an optional order number", () => {
    expect(validateContact(base)).toEqual({ ok: true, value: base });
    expect(validateContact({ ...base, orderNumber: "" })).toEqual({ ok: true, value: base });
    const withOrder = validateContact({ ...base, orderNumber: "#1001" });
    expect(withOrder.ok && withOrder.value.orderNumber).toBe("#1001");
    expect(validateContact({ ...base, orderNumber: "abc" }).ok).toBe(false);
  });

  it("needs a message of 10 to 2000 characters", () => {
    expect(validateContact({ ...base, message: "Hoi" })).toEqual({ ok: false, fieldErrors: { message: formsCopy.validation.message } });
    expect(validateContact({ ...base, message: "x".repeat(2001) })).toEqual({
      ok: false,
      fieldErrors: { message: formsCopy.validation.tooLong(FORM_LIMITS.messageMax) },
    });
  });
});

describe("validateConfirm", () => {
  it("accepts the token shape and rejects anything else with fieldErrors.token", () => {
    expect(validateConfirm({ token: validToken })).toEqual({ ok: true, value: { token: validToken } });
    const invalid = { ok: false, fieldErrors: { token: formsCopy.confirm.invalid } };
    expect(validateConfirm({ token: "abc" })).toEqual(invalid);
    expect(validateConfirm({ token: `${validToken}a` })).toEqual(invalid);
    expect(validateConfirm({ token: `${"a".repeat(600)}.${"b".repeat(43)}` })).toEqual(invalid);
    expect(validateConfirm({})).toEqual(invalid);
  });
});

describe("honeypot", () => {
  it("is filled only by a non-empty string in `website`", () => {
    expect(honeypotFilled({ website: "https://spam.example" })).toBe(true);
    expect(honeypotFilled({ website: "" })).toBe(false);
    expect(honeypotFilled({ website: "   " })).toBe(false);
    expect(honeypotFilled({})).toBe(false);
    expect(honeypotFilled(null)).toBe(false);
  });
});
