import { describe, expect, it } from "vitest";

import { CONFIRM_TOKEN_PATTERN } from "@/lib/forms/validation";
import {
  CONFIRM_TOKEN_TTL_MS,
  createConfirmToken,
  customerGid,
  customerIdFromGid,
  sha256Hex,
  verifyConfirmToken,
} from "@/lib/forms/confirm-token";

const SECRET = "test-newsletter-confirm-secret-0123456789";
const OTHER = "other-newsletter-confirm-secret-012345678";
const NOW = Date.parse("2026-11-02T10:00:00+01:00");

function decodePayload(token: string): string {
  return Buffer.from(token.split(".")[0], "base64url").toString("utf8");
}

describe("confirm token (plan §15.2, §15.3)", () => {
  it("round-trips a customer id and matches the validation pattern", async () => {
    const token = await createConfirmToken("gid://shopify/Customer/7001", NOW, SECRET);
    expect(token).toMatch(CONFIRM_TOKEN_PATTERN);
    expect(await verifyConfirmToken(token, NOW, SECRET)).toEqual({ customerId: "7001", tags: [] });
  });

  it("contains a customer id and no e-mail address", async () => {
    const token = await createConfirmToken("7001", NOW, SECRET);
    const payload = decodePayload(token);
    expect(JSON.parse(payload)).toEqual({ c: "7001", t: NOW });
    expect(payload).not.toContain("@");
    expect(token).not.toContain("@");
  });

  it("carries an existing customer's sign-up tags, signed, and refuses anything else (decision 199)", async () => {
    const tags = ["club", "bron:finder", "quiz:vibe-retro", "quiz:moment-strand", "quiz:type-verras-me"];
    const token = await createConfirmToken("7001", NOW, SECRET, tags);
    expect(token).toMatch(CONFIRM_TOKEN_PATTERN);
    expect(token.length).toBeLessThanOrEqual(600);
    expect(await verifyConfirmToken(token, NOW, SECRET)).toEqual({ customerId: "7001", tags });

    await expect(createConfirmToken("7001", NOW, SECRET, ["vip"])).rejects.toThrow();
    const [, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ c: "7001", t: NOW, g: ["vip"] })).toString("base64url");
    expect(await verifyConfirmToken(`${forged}.${signature}`, NOW, SECRET)).toBe("invalid");
  });

  it("is valid for 7 days and expired after that", async () => {
    const token = await createConfirmToken("7001", NOW, SECRET);
    expect(await verifyConfirmToken(token, NOW + CONFIRM_TOKEN_TTL_MS, SECRET)).toEqual({ customerId: "7001", tags: [] });
    expect(await verifyConfirmToken(token, NOW + CONFIRM_TOKEN_TTL_MS + 1, SECRET)).toBe("expired");
  });

  it("rejects a forged signature, a changed payload and another secret", async () => {
    const token = await createConfirmToken("7001", NOW, SECRET);
    const [payload, signature] = token.split(".");
    const flipped = `${payload}.${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;
    expect(await verifyConfirmToken(flipped, NOW, SECRET)).toBe("invalid");
    const otherPayload = Buffer.from(JSON.stringify({ c: "7002", t: NOW })).toString("base64url");
    expect(await verifyConfirmToken(`${otherPayload}.${signature}`, NOW, SECRET)).toBe("invalid");
    expect(await verifyConfirmToken(token, NOW, OTHER)).toBe("invalid");
    expect(await verifyConfirmToken("nonsense", NOW, SECRET)).toBe("invalid");
    expect(await verifyConfirmToken("a.b.c", NOW, SECRET)).toBe("invalid");
  });

  it("rejects a token from the future", async () => {
    const token = await createConfirmToken("7001", NOW + 60 * 60 * 1000, SECRET);
    expect(await verifyConfirmToken(token, NOW, SECRET)).toBe("invalid");
  });

  it("refuses a non-numeric id and works without a secret only when the environment has one", async () => {
    await expect(createConfirmToken("abc", NOW, SECRET)).rejects.toThrow();
    const previous = process.env.NEWSLETTER_CONFIRM_SECRET;
    delete process.env.NEWSLETTER_CONFIRM_SECRET;
    await expect(createConfirmToken("7001", NOW)).rejects.toThrow(/NEWSLETTER_CONFIRM_SECRET/);
    if (previous !== undefined) process.env.NEWSLETTER_CONFIRM_SECRET = previous;
  });

  it("converts between GID and numeric id and hashes for the idempotency key", async () => {
    expect(customerIdFromGid("gid://shopify/Customer/7001")).toBe("7001");
    expect(customerIdFromGid("gid://shopify/Order/7001")).toBeNull();
    expect(customerGid("7001")).toBe("gid://shopify/Customer/7001");
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
