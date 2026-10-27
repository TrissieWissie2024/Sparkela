import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as contactPost } from "@/app/api/contact/route";
import { POST as herroepenPost } from "@/app/api/herroepen/route";
import { POST as confirmPost } from "@/app/api/subscribe/confirm/route";
import { POST as subscribePost } from "@/app/api/subscribe/route";
import { resetAdminTokenCache } from "@/lib/commerce/shopify/admin";
import { createConfirmToken } from "@/lib/forms/confirm-token";
import { resetRateLimits } from "@/lib/forms/rate-limit";
import { RESEND_ENDPOINT } from "@/lib/mail";
import type { FormResponse, SubscribeConfirmResult, SubscribeResult, WithdrawalReceipt } from "@/lib/types";
import { formsCopy } from "@/content/copy/forms";
import { site } from "@/content/site";

/**
 * The form routes (docs/PLAN.md §15, §19.1): honeypot, validation, the fallback without keys (never a single opt-in),
 * double opt-in with one confirmation mail, confirmation, withdrawal with two mails, contact. fetch is mocked; no
 * network, no real Shopify or Resend.
 */

/** after() needs a request scope; here its tasks are collected and awaited by flushAfter(). */
const afterTasks = vi.hoisted(() => [] as Array<() => unknown>);
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: (() => unknown) | Promise<unknown>) => {
    afterTasks.push(typeof task === "function" ? task : () => task);
  },
}));

/** Runs the after() tasks, as Next does once the response has been sent. */
async function flushAfter(): Promise<void> {
  while (afterTasks.length > 0) await afterTasks.shift()?.();
}

const fixtureDir = join(process.cwd(), "tests/fixtures/shopify");
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixtureDir, `${name}.json`), "utf8")) as unknown;
}

const SECRET = "test-newsletter-confirm-secret-0123456789";
const ADMIN_ENV = {
  SHOPIFY_STORE_DOMAIN: "sparkela-test.myshopify.com",
  SHOPIFY_ADMIN_CLIENT_ID: "test-client-id",
  SHOPIFY_ADMIN_CLIENT_SECRET: "test-client-secret-0123456789",
  NEWSLETTER_CONFIRM_SECRET: SECRET,
};
const MAIL_ENV = { MAIL_API_KEY: "re_test_key", MAIL_FROM: "Sparkela <hallo@sparkela.nl>", MAIL_TO: "team@sparkela.nl" };
const ALL_ENV_NAMES = [...Object.keys(ADMIN_ENV), ...Object.keys(MAIL_ENV), "SHOPIFY_ADMIN_ACCESS_TOKEN", "NEXT_PUBLIC_SITE_URL"];

const TOKEN_URL = "https://sparkela-test.myshopify.com/admin/oauth/access_token";
const ADMIN_URL = "https://sparkela-test.myshopify.com/admin/api/2026-10/graphql.json";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

let ip = 0;
function post(path: string, body: unknown): Request {
  ip += 1;
  return new Request(`http://localhost:3200${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `203.0.113.${ip % 250}, 10.0.0.1` },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function read<T>(response: Response): Promise<FormResponse<T>> {
  return (await response.json()) as FormResponse<T>;
}

const fetchMock = vi.fn<typeof fetch>();

interface Routes {
  graphql?: (query: string, variables: Record<string, unknown>) => Response;
  mail?: (body: Record<string, unknown>, key: string | null) => Response;
}

function route(routes: Routes): void {
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === TOKEN_URL) return json(fixture("admin-token"));
    if (url === ADMIN_URL) {
      const { query, variables } = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
      if (!routes.graphql) throw new Error("unexpected Admin call");
      return routes.graphql(query, variables);
    }
    if (url === RESEND_ENDPOINT) {
      if (!routes.mail) throw new Error("unexpected mail");
      return routes.mail(JSON.parse(String(init?.body)) as Record<string, unknown>, new Headers(init?.headers).get("Idempotency-Key"));
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

function mails(): Array<{ body: Record<string, unknown>; key: string | null }> {
  return fetchMock.mock.calls
    .filter(([url]) => String(url) === RESEND_ENDPOINT)
    .map(([, init]) => ({
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      key: new Headers(init?.headers).get("Idempotency-Key"),
    }));
}

function adminQueries(): string[] {
  return fetchMock.mock.calls
    .filter(([url]) => String(url) === ADMIN_URL)
    .map(([, init]) => (JSON.parse(String(init?.body)) as { query: string }).query);
}

function setEnv(values: Record<string, string>): void {
  for (const name of ALL_ENV_NAMES) vi.stubEnv(name, "");
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

beforeEach(() => {
  afterTasks.length = 0;
  resetRateLimits();
  resetAdminTokenCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  setEnv({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const signup = { email: "Linde+Test@Example.com", consent: true, source: "wachtlijst", website: "" };
const withdrawal = { name: "Linde Test", orderNumber: "#1001", email: "linde@example.com", products: "Lola hoops", website: "" };
const contact = { name: "Sam", email: "sam@example.com", message: "Waar blijft mijn pakketje? Groetjes.", website: "" };

describe("shared rules (plan §15.1)", () => {
  it("answers JSON with no-store, and 400 for a body that is not JSON", async () => {
    for (const handler of [subscribePost, confirmPost, herroepenPost, contactPost]) {
      const response = await handler(post("/api/x", "not json"));
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await read(response)).toMatchObject({ ok: false, error: "invalid", fallbackEmail: site.email });
    }
  });

  it("honeypot: a believable, typed success per route, without any Shopify or mail call (decision 126)", async () => {
    setEnv({ ...ADMIN_ENV, ...MAIL_ENV });
    route({});
    const subscribe = await read<SubscribeResult>(await subscribePost(post("/api/subscribe", { ...signup, website: "https://spam.example" })));
    expect(subscribe).toEqual({ ok: true, data: { status: "pending", code: "WELKOM10" } });

    const confirm = await read<SubscribeConfirmResult>(await confirmPost(post("/api/subscribe/confirm", { token: "x", website: "spam" })));
    expect(confirm).toEqual({ ok: true, data: { status: "confirmed" } });

    const receipt = await read<WithdrawalReceipt>(await herroepenPost(post("/api/herroepen", { ...withdrawal, website: "spam" })));
    expect(receipt.ok).toBe(true);
    if (!receipt.ok) return;
    expect(receipt.data.reference).toMatch(/^HR-[0-9A-F]{8}$/);
    expect(Number.isNaN(Date.parse(receipt.data.receivedAt))).toBe(false);
    expect(receipt.data.receivedAtLabel).toMatch(/^\d{1,2} \p{L}+ \d{4} om \d{2}\.\d{2} uur$/u);
    expect(receipt.data.summary.map((row) => row.value)).toEqual(["Linde Test", "#1001", "linde@example.com", "Lola hoops"]);

    const contactAnswer = await read(await contactPost(post("/api/contact", { ...contact, website: "spam" })));
    expect(contactAnswer).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rate-limits per IP with 429 and Retry-After", async () => {
    const request = () =>
      new Request("http://localhost:3200/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.7" },
        body: JSON.stringify(contact),
      });
    for (let i = 0; i < 5; i += 1) expect((await contactPost(request())).status).toBe(503);
    const limited = await contactPost(request());
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await read(limited)).toMatchObject({ ok: false, error: "rate-limited" });
  });
});

describe("POST /api/subscribe (plan §15.2)", () => {
  it("returns field errors for an invalid address or a missing consent", async () => {
    const response = await subscribePost(post("/api/subscribe", { ...signup, email: "a*b@example.com", consent: false }));
    expect(response.status).toBe(400);
    expect(await read(response)).toMatchObject({
      ok: false,
      error: "invalid",
      fieldErrors: { email: formsCopy.validation.email, consent: formsCopy.subscribe.consentError },
    });
  });

  it("is not-configured without keys, and never falls back to single opt-in", async () => {
    route({});
    const cases: Array<Record<string, string>> = [
      {},
      { ...ADMIN_ENV, ...MAIL_ENV, NEWSLETTER_CONFIRM_SECRET: "" },
      { ...ADMIN_ENV, ...MAIL_ENV, NEWSLETTER_CONFIRM_SECRET: "too-short-secret" },
      { ...ADMIN_ENV, MAIL_API_KEY: "", MAIL_FROM: "" },
      { ...ADMIN_ENV, ...MAIL_ENV, SHOPIFY_ADMIN_CLIENT_ID: "", SHOPIFY_ADMIN_CLIENT_SECRET: "" },
    ];
    for (const env of cases) {
      setEnv(env);
      const response = await subscribePost(post("/api/subscribe", signup));
      expect(response.status).toBe(503);
      expect(await read(response)).toEqual({ ok: false, error: "not-configured", fallbackEmail: site.email });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates the customer on PENDING and sends exactly one confirmation mail with a link without the address", async () => {
    setEnv({ ...ADMIN_ENV, ...MAIL_ENV, NEXT_PUBLIC_SITE_URL: "https://sparkela.nl" });
    route({
      graphql: (query) =>
        query.includes("CustomerByEmail") ? json(fixture("admin-customer-by-identifier-null")) : json(fixture("admin-customer-create")),
      mail: () => json({ id: "mail-1" }),
    });
    const response = await subscribePost(post("/api/subscribe", signup));
    expect(response.status).toBe(200);
    expect(await read(response)).toEqual({ ok: true, data: { status: "pending", code: "WELKOM10" } });

    const [mail, ...rest] = mails();
    expect(rest).toEqual([]);
    expect(mail.body.to).toEqual(["linde+test@example.com"]);
    expect(mail.body.subject).toBe("Bevestig je aanmelding bij Sparkela");
    expect(mail.key).toMatch(/^subscribe-[0-9a-f]{64}$/);
    const link = /https:\/\/sparkela\.nl\/nieuwsbrief\/bevestigen\?t=([A-Za-z0-9_.-]+)/.exec(String(mail.body.text));
    expect(link).not.toBeNull();
    expect(link?.[0]).not.toContain("example.com");
    expect(Buffer.from(String(link?.[1].split(".")[0]), "base64url").toString("utf8")).not.toContain("@");
  });

  it("a second sign-up on the same day is pending again and gets a second mail with a new key", async () => {
    setEnv({ ...ADMIN_ENV, ...MAIL_ENV });
    route({
      graphql: (query) => {
        if (query.includes("CustomerByEmail")) return json(fixture("admin-customer-by-identifier-pending"));
        if (query.includes("TagsAdd")) return json(fixture("admin-tags-add"));
        return json(fixture("admin-consent-update"));
      },
      mail: () => json({ id: "mail" }),
    });
    const first = await read<SubscribeResult>(await subscribePost(post("/api/subscribe", signup)));
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await read<SubscribeResult>(await subscribePost(post("/api/subscribe", { ...signup, source: "footer" })));
    expect(first).toEqual({ ok: true, data: { status: "pending", code: "WELKOM10" } });
    expect(second).toEqual(first);
    const keys = mails().map((mail) => mail.key);
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("answers pending for a SUBSCRIBED member too (no membership signal), with a fixed 'al lid' mail and no changes", async () => {
    setEnv({ ...ADMIN_ENV, ...MAIL_ENV });
    route({
      graphql: (query) =>
        query.includes("CustomerByEmail") ? json(fixture("admin-customer-by-identifier-subscribed")) : json(fixture("admin-tags-add")),
      mail: () => json({ id: "mail" }),
    });
    expect(await read(await subscribePost(post("/api/subscribe", signup)))).toEqual({
      ok: true,
      data: { status: "pending", code: "WELKOM10" },
    });
    const [mail, ...rest] = mails();
    expect(rest).toEqual([]);
    expect(mail.body.subject).toBe(formsCopy.mail.member.subject);
    expect(String(mail.body.text)).not.toContain("http");
    expect(mail.key).toMatch(/^subscribe-member-[0-9a-f]{64}$/);
    expect(adminQueries()).toHaveLength(1);
    expect(adminQueries().some((query) => query.includes("TagsAdd") || query.includes("CustomerEmailMarketingConsentUpdate"))).toBe(false);
  });

  it("does not tag an existing customer before the opt-in: the tags travel in the signed link", async () => {
    setEnv({ ...ADMIN_ENV, ...MAIL_ENV, NEXT_PUBLIC_SITE_URL: "https://sparkela.nl" });
    route({
      graphql: (query) =>
        query.includes("CustomerByEmail") ? json(fixture("admin-customer-by-identifier-pending")) : json(fixture("admin-consent-update")),
      mail: () => json({ id: "mail" }),
    });
    await subscribePost(post("/api/subscribe", { ...signup, source: "footer" }));
    expect(adminQueries().some((query) => query.includes("TagsAdd"))).toBe(false);
    const link = /\?t=([A-Za-z0-9_.-]+)/.exec(String(mails()[0].body.text));
    const payload = JSON.parse(Buffer.from(String(link?.[1].split(".")[0]), "base64url").toString("utf8")) as { g?: string[] };
    expect(payload.g).toEqual(["club", "bron:footer"]);
  });

  it("answers upstream on ACCESS_DENIED and logs admin-pii-denied without personal data", async () => {
    setEnv({ ...ADMIN_ENV, ...MAIL_ENV });
    route({ graphql: () => json(fixture("admin-access-denied")) });
    const response = await subscribePost(post("/api/subscribe", signup));
    expect(response.status).toBe(502);
    expect(await read(response)).toEqual({ ok: false, error: "upstream", fallbackEmail: site.email });
    const logged = vi.mocked(console.error).mock.calls.map((call) => call.join(" "));
    expect(logged).toContain("admin-pii-denied");
    expect(logged.join(" ")).not.toContain("example.com");
  });

  it("answers upstream when the confirmation mail fails", async () => {
    setEnv({ ...ADMIN_ENV, ...MAIL_ENV });
    route({
      graphql: (query) =>
        query.includes("CustomerByEmail") ? json(fixture("admin-customer-by-identifier-null")) : json(fixture("admin-customer-create")),
      mail: () => json({ name: "application_error" }, 500),
    });
    expect((await subscribePost(post("/api/subscribe", signup))).status).toBe(502);
  });

  it("treats Resend's idempotency conflict as sent", async () => {
    setEnv({ ...ADMIN_ENV, ...MAIL_ENV });
    route({
      graphql: (query) =>
        query.includes("CustomerByEmail") ? json(fixture("admin-customer-by-identifier-null")) : json(fixture("admin-customer-create")),
      mail: () => json({ statusCode: 409, name: "invalid_idempotent_request", message: "used" }, 409),
    });
    expect(await read(await subscribePost(post("/api/subscribe", signup)))).toMatchObject({ ok: true, data: { status: "pending" } });
  });
});

describe("POST /api/subscribe/confirm (plan §15.3)", () => {
  it("sets the customer to SUBSCRIBED with a valid token", async () => {
    setEnv(ADMIN_ENV);
    route({
      graphql: (query) =>
        query.includes("CustomerById") ? json(fixture("admin-customer-by-id-pending")) : json(fixture("admin-consent-update")),
    });
    const token = await createConfirmToken("7001", Date.now(), SECRET);
    expect(await read(await confirmPost(post("/api/subscribe/confirm", { token, website: "" })))).toEqual({
      ok: true,
      data: { status: "confirmed" },
    });
    const update = fetchMock.mock.calls
      .filter(([url]) => String(url) === ADMIN_URL)
      .map(([, init]) => JSON.parse(String(init?.body)) as { variables: { input?: { emailMarketingConsent?: unknown } } })
      .find((body) => body.variables.input);
    expect(update?.variables.input?.emailMarketingConsent).toMatchObject({ marketingState: "SUBSCRIBED", marketingOptInLevel: "CONFIRMED_OPT_IN" });
  });

  it("adds the tags from the link on confirmation, before the consent update", async () => {
    setEnv(ADMIN_ENV);
    route({
      graphql: (query) => {
        if (query.includes("CustomerById")) return json(fixture("admin-customer-by-id-pending"));
        if (query.includes("TagsAdd")) return json(fixture("admin-tags-add"));
        return json(fixture("admin-consent-update"));
      },
    });
    const token = await createConfirmToken("7001", Date.now(), SECRET, ["club", "bron:footer"]);
    expect(await read(await confirmPost(post("/api/subscribe/confirm", { token })))).toEqual({ ok: true, data: { status: "confirmed" } });
    expect(adminQueries().map((query) => /(?:query|mutation) (\w+)/.exec(query)?.[1])).toEqual([
      "CustomerById",
      "TagsAdd",
      "CustomerEmailMarketingConsentUpdate",
    ]);
  });

  it("an old link of someone who unsubscribed since is expired, never a re-subscription", async () => {
    setEnv(ADMIN_ENV);
    route({
      graphql: () =>
        json({ data: { customer: { id: "gid://shopify/Customer/7001", defaultEmailAddress: { marketingState: "UNSUBSCRIBED" } } } }),
    });
    const token = await createConfirmToken("7001", Date.now() - 24 * 60 * 60 * 1000, SECRET);
    const response = await confirmPost(post("/api/subscribe/confirm", { token }));
    expect(response.status).toBe(400);
    expect(await read(response)).toMatchObject({ ok: false, error: "invalid", fieldErrors: { token: formsCopy.confirm.expired } });
    expect(adminQueries()).toHaveLength(1);
  });

  it("answers already-confirmed for a SUBSCRIBED customer", async () => {
    setEnv(ADMIN_ENV);
    route({ graphql: () => json(fixture("admin-customer-by-id-subscribed")) });
    const token = await createConfirmToken("7002", Date.now(), SECRET);
    expect(await read(await confirmPost(post("/api/subscribe/confirm", { token })))).toEqual({
      ok: true,
      data: { status: "already-confirmed" },
    });
  });

  it("an expired, forged or unknown token is invalid with fieldErrors.token", async () => {
    setEnv(ADMIN_ENV);
    route({ graphql: () => json(fixture("admin-customer-by-id-null")) });
    const expired = await createConfirmToken("7001", Date.now() - 8 * 24 * 60 * 60 * 1000, SECRET);
    const forged = await createConfirmToken("7001", Date.now(), "another-secret-for-the-test-0123456789");
    const unknown = await createConfirmToken("9999", Date.now(), SECRET);

    const answers = await Promise.all(
      [expired, forged, unknown, "nonsense"].map(async (token) => {
        const response = await confirmPost(post("/api/subscribe/confirm", { token }));
        return [response.status, await read(response)] as const;
      }),
    );
    expect(answers.map(([status]) => status)).toEqual([400, 400, 400, 400]);
    expect(answers.map(([, body]) => (body.ok ? null : body.fieldErrors?.token))).toEqual([
      formsCopy.confirm.expired,
      formsCopy.confirm.invalid,
      formsCopy.confirm.invalid,
      formsCopy.confirm.invalid,
    ]);
  });

  it("is not-configured without the secret or the Admin configuration", async () => {
    const token = await createConfirmToken("7001", Date.now(), SECRET);
    setEnv({ ...ADMIN_ENV, NEWSLETTER_CONFIRM_SECRET: "" });
    expect((await confirmPost(post("/api/subscribe/confirm", { token }))).status).toBe(503);
    setEnv({ NEWSLETTER_CONFIRM_SECRET: SECRET });
    expect((await confirmPost(post("/api/subscribe/confirm", { token }))).status).toBe(503);
  });
});

describe("POST /api/herroepen (plan §15.4)", () => {
  it("returns field errors for missing fields and a wrong order number", async () => {
    const empty = await read(await herroepenPost(post("/api/herroepen", { name: "", orderNumber: "", email: "", website: "" })));
    expect(empty).toMatchObject({
      ok: false,
      error: "invalid",
      fieldErrors: { name: formsCopy.validation.name, orderNumber: formsCopy.validation.orderNumber, email: formsCopy.validation.email },
    });
    const wrong = await read(await herroepenPost(post("/api/herroepen", { ...withdrawal, orderNumber: "bestelling" })));
    expect(wrong).toMatchObject({ ok: false, fieldErrors: { orderNumber: formsCopy.validation.orderNumber } });
  });

  it("is not-configured without MAIL_TO (the form then opens a mailto)", async () => {
    setEnv({ MAIL_API_KEY: MAIL_ENV.MAIL_API_KEY, MAIL_FROM: MAIL_ENV.MAIL_FROM });
    const response = await herroepenPost(post("/api/herroepen", withdrawal));
    expect(response.status).toBe(503);
    expect(await read(response)).toEqual({ ok: false, error: "not-configured", fallbackEmail: site.email });
  });

  it("sends the receipt to the customer and the copy to Sparkela, and returns the receipt", async () => {
    setEnv(MAIL_ENV);
    route({ mail: () => json({ id: "mail" }) });
    const answer = await read<WithdrawalReceipt>(await herroepenPost(post("/api/herroepen", withdrawal)));
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    const { reference, receivedAt, receivedAtLabel, summary } = answer.data;
    expect(reference).toMatch(/^HR-[0-9A-F]{8}$/);
    expect(Math.abs(Date.parse(receivedAt) - Date.now())).toBeLessThan(5000);
    expect(summary).toEqual([
      { label: "Naam", value: "Linde Test" },
      { label: "Bestelnummer", value: "#1001" },
      { label: "E-mailadres", value: "linde@example.com" },
      { label: "Producten", value: "Lola hoops" },
    ]);

    // The copy goes after the response (after()): only the customer's receipt is sent before it.
    expect(mails()).toHaveLength(1);
    await flushAfter();
    const [customer, copy] = mails();
    expect(mails()).toHaveLength(2);
    expect(customer.body.to).toEqual(["linde@example.com"]);
    expect(customer.body.subject).toBe("Ontvangstbevestiging herroeping #1001");
    expect(customer.body.reply_to).toBe("team@sparkela.nl");
    expect(String(customer.body.text)).toContain(receivedAtLabel);
    expect(String(customer.body.text)).toContain(reference);
    expect(customer.key).toBe(`${reference}-klant`);
    expect(copy.body.to).toEqual(["team@sparkela.nl"]);
    expect(copy.body.subject).toBe(`Herroeping #1001 (${reference})`);
    expect(copy.body.reply_to).toBe("linde@example.com");
    expect(copy.key).toBe(`${reference}-kopie`);
  });

  it("fails as upstream when the customer's mail fails, but stays ok when only the copy fails", async () => {
    setEnv(MAIL_ENV);
    route({ mail: (body) => ((body.to as string[])[0] === "linde@example.com" ? json({ name: "error" }, 500) : json({ id: "x" })) });
    expect((await herroepenPost(post("/api/herroepen", withdrawal))).status).toBe(502);

    fetchMock.mockReset();
    afterTasks.length = 0;
    route({ mail: (body) => ((body.to as string[])[0] === "team@sparkela.nl" ? json({ name: "error" }, 500) : json({ id: "x" })) });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const answer = await herroepenPost(post("/api/herroepen", withdrawal));
      expect(answer.status).toBe(200);
      const { data } = (await read<WithdrawalReceipt>(answer)) as { data: WithdrawalReceipt };
      const done = flushAfter();
      await vi.advanceTimersByTimeAsync(20_000);
      await done;
      // Three attempts with the same key, then one log line with the reference (not personal data).
      const copies = mails().filter((mail) => (mail.body.to as string[])[0] === "team@sparkela.nl");
      expect(copies).toHaveLength(3);
      expect(new Set(copies.map((mail) => mail.key))).toEqual(new Set([`${data.reference}-kopie`]));
      expect(vi.mocked(console.error)).toHaveBeenCalledWith(`herroepen-copy-mail-failed ${data.reference}`);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries the copy and stops as soon as it is sent", async () => {
    setEnv(MAIL_ENV);
    let copyAttempts = 0;
    route({
      mail: (body) => {
        if ((body.to as string[])[0] !== "team@sparkela.nl") return json({ id: "x" });
        copyAttempts += 1;
        return copyAttempts === 1 ? json({ name: "error" }, 503) : json({ id: "copy" });
      },
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      expect((await herroepenPost(post("/api/herroepen", withdrawal))).status).toBe(200);
      const done = flushAfter();
      await vi.advanceTimersByTimeAsync(20_000);
      await done;
    } finally {
      vi.useRealTimers();
    }
    expect(copyAttempts).toBe(2);
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).not.toContain("herroepen-copy-mail-failed");
  });
});

describe("POST /api/contact (plan §15.5)", () => {
  it("validates, and sends one mail to MAIL_TO with reply_to the sender", async () => {
    const invalid = await read(await contactPost(post("/api/contact", { ...contact, message: "Kort" })));
    expect(invalid).toMatchObject({ ok: false, fieldErrors: { message: formsCopy.validation.message } });

    setEnv(MAIL_ENV);
    route({ mail: () => json({ id: "mail" }) });
    expect(await read(await contactPost(post("/api/contact", { ...contact, orderNumber: "#1001" })))).toEqual({ ok: true });
    const [mail] = mails();
    expect(mails()).toHaveLength(1);
    expect(mail.body).toMatchObject({ to: ["team@sparkela.nl"], subject: "Contact: Sam", reply_to: "sam@example.com" });
    expect(String(mail.body.text)).toContain("#1001");
  });

  it("is not-configured without keys and upstream when Resend fails", async () => {
    expect((await contactPost(post("/api/contact", contact))).status).toBe(503);
    setEnv(MAIL_ENV);
    route({ mail: () => json({ name: "error" }, 500) });
    expect((await contactPost(post("/api/contact", contact))).status).toBe(502);
  });
});
