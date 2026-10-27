import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { hashToken, hasValidPreview, isPreviewToken, timingSafeEqualString } from "@/lib/preview";

const TOKEN = "test-preview-token-0123456789abcdefghij";

describe("lib/preview", () => {
  it("hashes the token to the hex SHA-256 (64 characters), never the token itself", async () => {
    const hash = await hashToken(TOKEN);
    expect(hash).toBe(createHash("sha256").update(TOKEN, "utf8").digest("hex"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(TOKEN);
  });

  it("accepts the cookie with the hash and rejects anything else", async () => {
    const hash = await hashToken(TOKEN);
    expect(await hasValidPreview(hash, TOKEN)).toBe(true);
    expect(await hasValidPreview(hash.toUpperCase(), TOKEN)).toBe(false);
    expect(await hasValidPreview("1", TOKEN)).toBe(false);
    expect(await hasValidPreview(TOKEN, TOKEN)).toBe(false);
    expect(await hasValidPreview(await hashToken("another-token-0123456789abcdefghijkl"), TOKEN)).toBe(false);
  });

  it("fails closed without a token or a cookie", async () => {
    const hash = await hashToken(TOKEN);
    expect(await hasValidPreview(hash, null)).toBe(false);
    expect(await hasValidPreview(null, TOKEN)).toBe(false);
    expect(await hasValidPreview(undefined, TOKEN)).toBe(false);
    expect(await hasValidPreview("", TOKEN)).toBe(false);
  });

  it("checks the ?preview= value against the token", async () => {
    expect(await isPreviewToken(TOKEN, TOKEN)).toBe(true);
    expect(await isPreviewToken(`${TOKEN}x`, TOKEN)).toBe(false);
    expect(await isPreviewToken("fout", TOKEN)).toBe(false);
    expect(await isPreviewToken(TOKEN, null)).toBe(false);
    expect(await isPreviewToken(null, TOKEN)).toBe(false);
  });

  it("compares strings correctly, also with different lengths", () => {
    expect(timingSafeEqualString("abc", "abc")).toBe(true);
    expect(timingSafeEqualString("abc", "abd")).toBe(false);
    expect(timingSafeEqualString("abc", "abcd")).toBe(false);
    expect(timingSafeEqualString("", "")).toBe(true);
    expect(timingSafeEqualString("", "a")).toBe(false);
  });
});
