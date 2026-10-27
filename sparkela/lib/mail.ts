import "server-only";

import { brandColor } from "@/lib/brand-colors";
import { attemptSignal } from "@/lib/deadline";
import { readEnv, type EnvSource } from "@/lib/env";
import type { WithdrawalReceipt } from "@/lib/types";
import { formsCopy } from "@/content/copy/forms";
import { site } from "@/content/site";

/**
 * Transactional mail through the REST API of Resend, with fetch and without an SDK (docs/PLAN.md §15.2 to §15.5,
 * decisions 49, 89 and 111): the double opt-in confirmation, the withdrawal receipt and its copy to Sparkela, and the
 * contact message.
 *
 * - The body is exactly `{ from, to: [to], subject, text, html, reply_to }` (snake_case) and every mail carries an
 *   `Idempotency-Key`. A 409 about idempotency (`invalid_idempotent_request`, `concurrent_idempotent_requests`) counts
 *   as sent: the same key was already used for this mail.
 * - Every value in an HTML version goes through escapeHtml(). Free text a visitor typed goes through
 *   sanitizeForCustomerMail() before it reaches a mail to the visitor: no tags, no links, no domains, so nobody can
 *   use the withdrawal form to send a clickable link to a stranger (plan §15.4). The copy to Sparkela keeps the text
 *   as typed (escaped in HTML).
 * - Mails are text first; the HTML version has our own fixed link at most, never visitor content as a link.
 * - No personal data in logs: only fixed error codes.
 */

export const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Resend errors that mean "this key was already used": the mail is (being) sent. */
const IDEMPOTENCY_CONFLICTS = new Set(["invalid_idempotent_request", "concurrent_idempotent_requests"]);

const MAIL_TIMEOUT_MS = 10_000;

export interface MailConfig {
  apiKey: string;
  /** MAIL_FROM, a verified sender such as "Sparkela <hallo@sparkela.nl>". */
  from: string;
  /** MAIL_TO, Sparkela's inbox for copies; null when unset (withdrawal and contact then answer "not-configured"). */
  to: string | null;
}

/** MAIL_API_KEY plus MAIL_FROM, or null when either is missing. */
export function getMailConfig(env: EnvSource = process.env): MailConfig | null {
  const apiKey = readEnv(env, "MAIL_API_KEY");
  const from = readEnv(env, "MAIL_FROM");
  if (apiKey === null || from === null) return null;
  return { apiKey, from, to: readEnv(env, "MAIL_TO") };
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** reply_to; default MAIL_TO, else site.email, so a reply always reaches Sparkela. */
  replyTo?: string;
  /** Idempotency-Key header (at most 256 characters). */
  idempotencyKey: string;
  /** The route's deadline (lib/deadline.ts): the request is cut off there, never later than the 10 s time-out. */
  deadline?: number;
}

export type MailResult =
  | { ok: true; id: string | null; duplicate: boolean }
  | { ok: false; error: "not-configured" | "upstream"; status: number | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Sends one mail. Never throws: a missing configuration, a network error or a Resend error comes back as ok: false. */
export async function sendMail(message: MailMessage, env: EnvSource = process.env): Promise<MailResult> {
  const config = getMailConfig(env);
  if (config === null) return { ok: false, error: "not-configured", status: null };

  const body = {
    from: config.from,
    to: [message.to],
    subject: message.subject,
    text: message.text,
    html: message.html,
    reply_to: message.replyTo ?? config.to ?? site.email,
  };

  const signal = attemptSignal(MAIL_TIMEOUT_MS, message.deadline);
  if (signal === null) {
    console.error("mail-deadline");
    return { ok: false, error: "upstream", status: null };
  }
  let response: Response;
  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    console.error("mail-network");
    return { ok: false, error: "upstream", status: null };
  }

  const data: unknown = await response.json().catch(() => null);
  if (response.ok) {
    const id = isRecord(data) && typeof data.id === "string" ? data.id : null;
    return { ok: true, id, duplicate: false };
  }
  if (response.status === 409 && isRecord(data) && typeof data.name === "string" && IDEMPOTENCY_CONFLICTS.has(data.name)) {
    return { ok: true, id: null, duplicate: true };
  }
  console.error(`mail-http-${response.status}`);
  return { ok: false, error: "upstream", status: response.status };
}

/* -------------------------------------------------------------------------- */
/* Escaping and sanitizing                                                    */
/* -------------------------------------------------------------------------- */

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes & < > " ' for HTML text and attribute values. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

const TAG = /<\/?[A-Za-z!][^>]*>/g;
const URL_LIKE = /\b(?:[a-z][a-z0-9+.-]*:\/\/|www\.)\S+/gi;
/** "evil.com", "sub.evil.co.uk/path": labels with dots ending in letters, with an optional path. */
const DOMAIN_LIKE = /\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}\b(?:\/\S*)?/gi;
/** Control characters other than tab and newline. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Free text from a visitor, safe for a mail to the visitor (plan §15.4): HTML tags removed, URLs and domain-like text
 * replaced by "[link verwijderd]", control characters removed. The result is still plain text: escape it for HTML.
 */
export function sanitizeForCustomerMail(value: string): string {
  const removed = formsCopy.mail.linkRemoved;
  return value
    .replace(CONTROL, "")
    .replace(TAG, "")
    .replace(URL_LIKE, removed)
    .replace(DOMAIN_LIKE, removed)
    .replace(/\r\n?/g, "\n")
    .trim();
}

/**
 * A name a visitor typed, safe for a mail to the visitor. Tags, URLs and control characters go as in
 * sanitizeForCustomerMail(), but domain-like text is kept and only made unclickable: a space after each dot. Dutch
 * names with initials ("J.de Vries", "A.van.Dijk") look like domains ("j.de") and would otherwise be replaced by
 * "[link verwijderd]" on the legal receipt; now they read "J. de Vries", and "evil.com" becomes "evil. com", which no
 * mail client turns into a link (decision 199).
 */
export function sanitizeNameForCustomerMail(value: string): string {
  return value
    .replace(CONTROL, "")
    .replace(TAG, "")
    .replace(URL_LIKE, formsCopy.mail.linkRemoved)
    .replace(DOMAIN_LIKE, (match) => match.replace(/\.(?=\S)/g, ". "))
    .replace(/\s+/g, " ")
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

/** One block of a mail: a paragraph, a heading, a list of label/value rows, a list of lines, or our own button. */
type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "rows"; rows: Array<{ label: string; value: string }> }
  | { kind: "list"; items: string[] }
  | { kind: "button"; label: string; href: string };

const color = {
  page: brandColor("pagina"),
  card: brandColor("kaart"),
  text: brandColor("tekst"),
  soft: brandColor("tekst-2"),
  line: brandColor("rand"),
  button: brandColor("primair"),
  buttonText: brandColor("primair-tekst"),
} as const;

const FONT = "Inter, Arial, Helvetica, sans-serif";

/** One line for a subject: whitespace runs (also newlines) become one space. */
function oneLine(value: string): string {
  return value.replace(CONTROL, "").replace(/\s+/g, " ").trim();
}

function htmlLines(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function blockText(block: Block): string {
  switch (block.kind) {
    case "p":
      return block.text;
    case "h":
      return block.text;
    case "rows":
      return block.rows.map((row) => `${row.label}: ${row.value}`).join("\n");
    case "list":
      return block.items.map((item) => `- ${item}`).join("\n");
    case "button":
      return `${block.label}:\n${block.href}`;
  }
}

function blockHtml(block: Block): string {
  const p = `margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.55;color:${color.text}`;
  switch (block.kind) {
    case "p":
      return `<p style="${p}">${htmlLines(block.text)}</p>`;
    case "h":
      return `<p style="margin:24px 0 8px;font-family:${FONT};font-size:15px;font-weight:700;color:${color.text}">${htmlLines(block.text)}</p>`;
    case "rows":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse;width:100%">${block.rows
        .map(
          (row) =>
            `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;font-family:${FONT};font-size:14px;color:${color.soft};white-space:nowrap">${htmlLines(row.label)}</td><td style="padding:6px 0;vertical-align:top;font-family:${FONT};font-size:14px;color:${color.text}">${htmlLines(row.value)}</td></tr>`,
        )
        .join("")}</table>`;
    case "list":
      return `<ul style="margin:0 0 16px;padding-left:20px;font-family:${FONT};font-size:15px;line-height:1.55;color:${color.text}">${block.items
        .map((item) => `<li style="margin:0 0 6px">${htmlLines(item)}</li>`)
        .join("")}</ul>`;
    case "button":
      return `<p style="margin:8px 0 24px"><a href="${escapeHtml(block.href)}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:${color.button};color:${color.buttonText};font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none">${escapeHtml(block.label)}</a></p>`;
  }
}

/** Text and HTML versions of the same blocks, with greeting, sign-off and the company line. */
function compose(subject: string, greeting: string, blocks: Block[]): MailContent {
  const all: Block[] = [{ kind: "p", text: greeting }, ...blocks, { kind: "p", text: formsCopy.mail.signoff }];
  const footer = formsCopy.mail.footer;
  const text = `${all.map(blockText).join("\n\n")}\n\n--\n${footer}\n`;
  const html =
    `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:24px 12px;background:${color.page}">` +
    `<div style="max-width:560px;margin:0 auto;padding:28px 24px;background:${color.card};border:1px solid ${color.line};border-radius:16px">` +
    `<p style="margin:0 0 24px;font-family:${FONT};font-size:18px;font-weight:800;letter-spacing:0.02em;color:${color.text}">${escapeHtml(site.name.toUpperCase())}</p>` +
    all.map(blockHtml).join("") +
    `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid ${color.line};font-family:${FONT};font-size:12px;line-height:1.5;color:${color.soft}">${escapeHtml(footer)}</p>` +
    `</div></body></html>`;
  return { subject, text, html };
}

/* -------------------------------------------------------------------------- */
/* Mails                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The double opt-in mail (plan §15.2 step 5): fixed text, one link, no visitor input. `validDays` is the token's life
 * in days (7).
 */
export function confirmationMail(link: string, validDays: number): MailContent {
  const copy = formsCopy.mail.confirm;
  return compose(copy.subject, formsCopy.mail.greeting, [
    { kind: "p", text: copy.intro },
    { kind: "button", label: copy.button, href: link },
    { kind: "p", text: `${copy.linkHint}\n${link}` },
    { kind: "p", text: copy.validity(String(validDays)) },
    { kind: "p", text: copy.code },
    { kind: "p", text: copy.ignore },
  ]);
}

/**
 * For a sign-up of an address that is already a confirmed member (plan §15.2 step 4, decision 199): the route answers
 * "pending" as for any other address, so the answer tells nobody whether an address is a member; this mail tells the
 * owner of the address instead. Fixed text, no link, no visitor input.
 */
export function memberMail(): MailContent {
  const copy = formsCopy.mail.member;
  return compose(copy.subject, formsCopy.mail.greeting, [
    { kind: "p", text: copy.intro },
    { kind: "p", text: formsCopy.mail.confirm.code },
    { kind: "p", text: copy.ignore },
  ]);
}

/** The filled-in fields of a withdrawal, as receipt rows. */
export interface WithdrawalDetails {
  name: string;
  orderNumber: string;
  email: string;
  products?: string;
}

/** WithdrawalReceipt.summary: label and value per field, in form order (route, receipt page and mails). */
export function withdrawalSummary(details: WithdrawalDetails): WithdrawalReceipt["summary"] {
  const labels = formsCopy.withdrawal.summary;
  return [
    { label: labels.name, value: details.name },
    { label: labels.orderNumber, value: details.orderNumber },
    { label: labels.email, value: details.email },
    { label: labels.products, value: details.products?.trim() ? details.products : labels.productsEmpty },
  ];
}

/**
 * The receipt to the customer (plan §15.4, brief §6): what was filled in, the date and time of receipt, the reference
 * and the next steps. Name and products are sanitized: the mail has no clickable visitor content.
 */
export function withdrawalCustomerMail(receipt: WithdrawalReceipt, details: WithdrawalDetails): MailContent {
  const copy = formsCopy.mail.withdrawalCustomer;
  const name = sanitizeNameForCustomerMail(details.name);
  const safe = withdrawalSummary({
    name,
    orderNumber: details.orderNumber,
    email: details.email,
    products: details.products === undefined ? undefined : sanitizeForCustomerMail(details.products),
  });
  return compose(copy.subject(details.orderNumber), name ? formsCopy.mail.greetingName(name) : formsCopy.mail.greeting, [
    { kind: "p", text: copy.intro },
    { kind: "rows", rows: [{ label: formsCopy.withdrawal.receipt.receivedAt, value: receipt.receivedAtLabel }, { label: formsCopy.withdrawal.receipt.reference, value: receipt.reference }] },
    { kind: "h", text: copy.detailsTitle },
    { kind: "rows", rows: safe },
    { kind: "h", text: copy.nextTitle },
    { kind: "list", items: formsCopy.withdrawal.receipt.next(String(site.returnDays)) },
    { kind: "p", text: copy.questions(site.email) },
  ]);
}

/** The full copy to Sparkela (plan §15.4): everything as typed (escaped in HTML), reply_to is the customer. */
export function withdrawalCopyMail(receipt: WithdrawalReceipt, details: WithdrawalDetails): MailContent {
  const copy = formsCopy.mail.withdrawalCopy;
  return compose(copy.subject(details.orderNumber, receipt.reference), formsCopy.mail.greeting, [
    { kind: "p", text: copy.intro },
    { kind: "rows", rows: [{ label: formsCopy.withdrawal.receipt.receivedAt, value: receipt.receivedAtLabel }, { label: formsCopy.withdrawal.receipt.reference, value: receipt.reference }] },
    { kind: "rows", rows: withdrawalSummary(details) },
  ]);
}

export interface ContactDetails {
  name: string;
  email: string;
  orderNumber?: string;
  message: string;
}

/** The contact message to MAIL_TO (plan §15.5), reply_to is the sender. */
export function contactMail(details: ContactDetails): MailContent {
  const copy = formsCopy.mail.contact;
  const labels = formsCopy.contact.fields;
  const rows = [
    { label: labels.name, value: details.name },
    { label: labels.email, value: details.email },
    ...(details.orderNumber ? [{ label: labels.orderNumber, value: details.orderNumber }] : []),
  ];
  return compose(copy.subject(oneLine(details.name)), formsCopy.mail.greeting, [
    { kind: "p", text: copy.intro },
    { kind: "rows", rows },
    { kind: "h", text: copy.message },
    { kind: "p", text: details.message },
  ]);
}
