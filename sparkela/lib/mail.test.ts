import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createConfirmToken, sha256Hex } from "@/lib/forms/confirm-token";
import {
  confirmationMail,
  contactMail,
  escapeHtml,
  getMailConfig,
  memberMail,
  RESEND_ENDPOINT,
  sanitizeNameForCustomerMail,
  sanitizeForCustomerMail,
  sendMail,
  withdrawalCopyMail,
  withdrawalCustomerMail,
  withdrawalSummary,
} from "@/lib/mail";
import type { WithdrawalReceipt } from "@/lib/types";
import { formsCopy } from "@/content/copy/forms";
import { site } from "@/content/site";

const ENV = { MAIL_API_KEY: "re_test_key", MAIL_FROM: "Sparkela <hallo@sparkela.nl>", MAIL_TO: "team@sparkela.nl" };
const SECRET = "test-newsletter-confirm-secret-0123456789";
const NOW = Date.parse("2026-11-20T12:00:00+01:00");

const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const message = { to: "klant@example.com", subject: "Onderwerp", text: "Tekst", html: "<p>Tekst</p>", idempotencyKey: "HR-1A2B3C4D-klant" };

describe("sendMail (Resend REST, plan §15.4 step 4, decision 89)", () => {
  it("posts exactly from, to, subject, text, html and reply_to, with bearer auth and an Idempotency-Key", async () => {
    fetchMock.mockImplementation(async () => json({ id: "mail-1" }));
    await expect(sendMail({ ...message, replyTo: "linde@example.com" }, ENV)).resolves.toEqual({ ok: true, id: "mail-1", duplicate: false });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(RESEND_ENDPOINT);
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer re_test_key");
    expect(headers.get("Idempotency-Key")).toBe("HR-1A2B3C4D-klant");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["from", "html", "reply_to", "subject", "text", "to"]);
    expect(body).toEqual({
      from: ENV.MAIL_FROM,
      to: ["klant@example.com"],
      subject: "Onderwerp",
      text: "Tekst",
      html: "<p>Tekst</p>",
      reply_to: "linde@example.com",
    });
  });

  it("replies to MAIL_TO by default, else to site.email", async () => {
    fetchMock.mockImplementation(async () => json({ id: "mail-1" }));
    await sendMail(message, ENV);
    await sendMail(message, { MAIL_API_KEY: ENV.MAIL_API_KEY, MAIL_FROM: ENV.MAIL_FROM });
    const replies = fetchMock.mock.calls.map(([, init]) => (JSON.parse(String(init?.body)) as { reply_to: string }).reply_to);
    expect(replies).toEqual(["team@sparkela.nl", site.email]);
  });

  it("treats Resend's idempotency conflicts as sent, any other error as upstream", async () => {
    for (const name of ["invalid_idempotent_request", "concurrent_idempotent_requests"]) {
      fetchMock.mockImplementationOnce(async () => json({ statusCode: 409, name, message: "conflict" }, 409));
      await expect(sendMail(message, ENV)).resolves.toEqual({ ok: true, id: null, duplicate: true });
    }
    fetchMock.mockImplementationOnce(async () => json({ statusCode: 422, name: "validation_error", message: "bad" }, 422));
    await expect(sendMail(message, ENV)).resolves.toEqual({ ok: false, error: "upstream", status: 422 });
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(sendMail(message, ENV)).resolves.toEqual({ ok: false, error: "upstream", status: null });
  });

  it("is not-configured without MAIL_API_KEY or MAIL_FROM, and never calls Resend then", async () => {
    await expect(sendMail(message, { MAIL_FROM: ENV.MAIL_FROM })).resolves.toMatchObject({ ok: false, error: "not-configured" });
    await expect(sendMail(message, { MAIL_API_KEY: ENV.MAIL_API_KEY })).resolves.toMatchObject({ ok: false, error: "not-configured" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getMailConfig({ ...ENV, MAIL_TO: " " })).toEqual({ apiKey: "re_test_key", from: ENV.MAIL_FROM, to: null });
  });

  it("gives the subscribe mail one key per token: two sign-ups on the same day get two keys (decision 111)", async () => {
    const first = await createConfirmToken("7001", NOW, SECRET);
    const second = await createConfirmToken("7001", NOW + 60_000, SECRET);
    const keys = [`subscribe-${await sha256Hex(first)}`, `subscribe-${await sha256Hex(second)}`];
    expect(keys[0]).toBe(`subscribe-${createHash("sha256").update(first).digest("hex")}`);
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[0].length).toBeLessThanOrEqual(256);
  });
});

describe("escapeHtml and sanitizeForCustomerMail", () => {
  it("escapes & < > \" '", () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;");
  });

  it("removes tags, URLs and domain-like text from free text", () => {
    const removed = formsCopy.mail.linkRemoved;
    expect(sanitizeForCustomerMail("<b>Lola</b> hoops")).toBe("Lola hoops");
    expect(sanitizeForCustomerMail("Kijk op https://evil.example/x?y=1 nu")).toBe(`Kijk op ${removed} nu`);
    expect(sanitizeForCustomerMail("ga naar www.evil.nl")).toBe(`ga naar ${removed}`);
    expect(sanitizeForCustomerMail("evil.com/pad en sub.evil.co.uk")).toBe(`${removed} en ${removed}`);
    expect(sanitizeForCustomerMail("Lola chunky hoops, Goud (2x)")).toBe("Lola chunky hoops, Goud (2x)");
    expect(sanitizeForCustomerMail("Bo\u0007 druppels")).toBe("Bo druppels");
  });
});

const receipt: WithdrawalReceipt = {
  reference: "HR-1A2B3C4D",
  receivedAt: "2026-11-27T13:03:00.000Z",
  receivedAtLabel: "27 november 2026 om 14.03 uur",
  summary: [],
};

describe("mail content", () => {
  it("confirmation mail: fixed text, the link, no visitor input", () => {
    const link = "https://sparkela.nl/nieuwsbrief/bevestigen?t=abc.def";
    const mail = confirmationMail(link, 7);
    expect(mail.subject).toBe("Bevestig je aanmelding bij Sparkela");
    expect(mail.text).toContain(link);
    expect(mail.text).toContain(formsCopy.mail.confirm.validity("7"));
    expect(mail.html).toContain(`href="${link}"`);
  });

  it("withdrawal receipt to the customer: content, date and time of receipt, reference, next steps, no links", () => {
    const details = {
      name: "Linde <script>alert(1)</script>",
      orderNumber: "#1001",
      email: "klant@example.com",
      products: "Lola hoops, zie www.evil.nl en <a href=\"https://x.y\">klik</a>",
    };
    const mail = withdrawalCustomerMail(receipt, details);
    expect(mail.subject).toBe("Ontvangstbevestiging herroeping #1001");
    expect(mail.text).toContain("27 november 2026 om 14.03 uur");
    expect(mail.text).toContain("HR-1A2B3C4D");
    expect(mail.text).toContain("#1001");
    expect(mail.text).toContain(site.hygieneRule);
    expect(mail.text).not.toContain("www.evil.nl");
    expect(mail.text).not.toContain("<script>");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("evil.nl");
    expect(mail.html).not.toMatch(/<a\s/);
  });

  it("keeps Dutch names with initials readable on the receipt, while a domain in the name stays unclickable", () => {
    expect(sanitizeNameForCustomerMail("J.de Vries")).toBe("J. de Vries");
    expect(sanitizeNameForCustomerMail("M.de Jong")).toBe("M. de Jong");
    expect(sanitizeNameForCustomerMail("A.van.Dijk")).toBe("A. van. Dijk");
    expect(sanitizeNameForCustomerMail("Linde van der Berg")).toBe("Linde van der Berg");
    expect(sanitizeNameForCustomerMail("bezoek evil.com nu")).toBe("bezoek evil. com nu");
    expect(sanitizeNameForCustomerMail("https://evil.example/x")).toBe(formsCopy.mail.linkRemoved);
    expect(sanitizeNameForCustomerMail("<b>Sam</b>")).toBe("Sam");

    const mail = withdrawalCustomerMail(receipt, { name: "J.de Vries", orderNumber: "#1001", email: "klant@example.com" });
    expect(mail.text).toContain("Hoi J. de Vries,");
    expect(mail.text).toContain("Naam: J. de Vries");
    expect(mail.text).not.toContain(formsCopy.mail.linkRemoved);
    expect(mail.text).not.toContain("J.de");
  });

  it("the 'al lid' mail: fixed text with the code, no link", () => {
    const mail = memberMail();
    expect(mail.subject).toBe(formsCopy.mail.member.subject);
    expect(mail.text).toContain("WELKOM10");
    expect(mail.text).not.toContain("http");
    expect(mail.html).not.toMatch(/<a\s/);
  });

  it("copy to Sparkela: everything as typed, escaped in HTML", () => {
    const details = { name: "Tom & Jerry", orderNumber: "#1001", email: "klant@example.com", products: "<b>2x</b> Lola" };
    const mail = withdrawalCopyMail(receipt, details);
    expect(mail.subject).toBe("Herroeping #1001 (HR-1A2B3C4D)");
    expect(mail.text).toContain("<b>2x</b> Lola");
    expect(mail.html).toContain("&lt;b&gt;2x&lt;/b&gt; Lola");
    expect(mail.html).toContain("Tom &amp; Jerry");
  });

  it("summary rows in form order, with a placeholder for empty products", () => {
    const rows = withdrawalSummary({ name: "Linde", orderNumber: "#1001", email: "l@example.com" });
    expect(rows.map((row) => row.value)).toEqual(["Linde", "#1001", "l@example.com", formsCopy.withdrawal.summary.productsEmpty]);
  });

  it("contact mail: one-line subject, escaped HTML", () => {
    const mail = contactMail({ name: "Sam\nde <Vries>", email: "sam@example.com", message: "Hoi <b>daar</b>, waar blijft mijn pakketje?" });
    expect(mail.subject).toBe("Contact: Sam de <Vries>");
    expect(mail.html).toContain("Hoi &lt;b&gt;daar&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>daar</b>");
  });
});
