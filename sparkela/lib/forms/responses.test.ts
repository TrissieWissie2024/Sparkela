import { describe, expect, it } from "vitest";

import { formError, formOk, parseFormResponse, readJsonBody } from "@/lib/forms/responses";
import { site } from "@/content/site";

describe("form responses (plan §15.1)", () => {
  it("answers JSON with no-store and the status per error code", async () => {
    const ok = formOk({ status: "pending" });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain("application/json");
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(await ok.json()).toEqual({ ok: true, data: { status: "pending" } });

    const statuses = await Promise.all(
      (["invalid", "rate-limited", "not-configured", "upstream"] as const).map(async (code) => {
        const response = formError(code);
        return [response.status, await response.json()] as const;
      }),
    );
    expect(statuses.map(([status]) => status)).toEqual([400, 429, 503, 502]);
    for (const [, body] of statuses) expect(body.fallbackEmail).toBe(site.email);
  });

  it("adds field errors and Retry-After", async () => {
    const invalid = formError("invalid", { fieldErrors: { email: "Vul een geldig e-mailadres in." } });
    expect(await invalid.json()).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { email: "Vul een geldig e-mailadres in." },
      fallbackEmail: site.email,
    });
    expect(formError("rate-limited", { retryAfterMs: 61_000 }).headers.get("retry-after")).toBe("61");
  });

  it("reads a JSON body and returns null for anything else", async () => {
    const post = (body: string) => new Request("https://sparkela.nl/api/contact", { method: "POST", body });
    expect(await readJsonBody(post('{"a":1}'))).toEqual({ a: 1 });
    expect(await readJsonBody(post("{"))).toBeNull();
    expect(await readJsonBody(post(""))).toBeNull();
    expect(await readJsonBody(post(JSON.stringify({ x: "y".repeat(30_000) })))).toBeNull();
  });

  it("parses answers in the browser and turns anything unexpected into upstream", () => {
    expect(parseFormResponse({ ok: true, data: { a: 1 } })).toEqual({ ok: true, data: { a: 1 } });
    expect(parseFormResponse({ ok: true })).toEqual({ ok: true, data: undefined });
    expect(parseFormResponse({ ok: false, error: "invalid", fieldErrors: { email: "x", n: 1 }, fallbackEmail: "a@b.nl" })).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { email: "x" },
      fallbackEmail: "a@b.nl",
    });
    expect(parseFormResponse({ ok: false, error: "teapot" })).toEqual({ ok: false, error: "upstream", fallbackEmail: site.email });
    expect(parseFormResponse(null)).toEqual({ ok: false, error: "upstream", fallbackEmail: site.email });
  });
});
