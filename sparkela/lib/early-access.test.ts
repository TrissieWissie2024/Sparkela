import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  EARLY_ACCESS_TOKEN_LENGTH,
  earlyAccessCookieName,
  earlyAccessLink,
  earlyAccessToken,
  isValidEarlyAccess,
} from "@/lib/early-access";

const SECRET = "test-early-access-secret-0123456789abcdef";
const OTHER_SECRET = "another-early-access-secret-0123456789ab";
const appRoot = fileURLToPath(new URL("..", import.meta.url));

describe("lib/early-access", () => {
  it("makes the token from the first 22 characters of base64url(HMAC-SHA256(secret, 'ea:' + slug))", async () => {
    const expected = createHmac("sha256", SECRET).update("ea:holiday-sparkle").digest("base64url").slice(0, 22);
    const token = await earlyAccessToken("holiday-sparkle", SECRET);
    expect(token).toBe(expected);
    expect(token).toHaveLength(EARLY_ACCESS_TOKEN_LENGTH);
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("is stable per slug and differs per slug and per secret", async () => {
    const a = await earlyAccessToken("holiday-sparkle", SECRET);
    expect(await earlyAccessToken("holiday-sparkle", SECRET)).toBe(a);
    expect(await earlyAccessToken("love-club", SECRET)).not.toBe(a);
    expect(await earlyAccessToken("holiday-sparkle", OTHER_SECRET)).not.toBe(a);
  });

  it("accepts only the token of that drop and fails closed without a secret", async () => {
    const token = await earlyAccessToken("holiday-sparkle", SECRET);
    expect(await isValidEarlyAccess("holiday-sparkle", token, SECRET)).toBe(true);
    expect(await isValidEarlyAccess("love-club", token, SECRET)).toBe(false);
    expect(await isValidEarlyAccess("holiday-sparkle", token, OTHER_SECRET)).toBe(false);
    expect(await isValidEarlyAccess("holiday-sparkle", `${token}x`, SECRET)).toBe(false);
    expect(await isValidEarlyAccess("holiday-sparkle", token.slice(0, 21), SECRET)).toBe(false);
    expect(await isValidEarlyAccess("holiday-sparkle", token, null)).toBe(false);
    expect(await isValidEarlyAccess("holiday-sparkle", null, SECRET)).toBe(false);
    expect(await isValidEarlyAccess("holiday-sparkle", "", SECRET)).toBe(false);
  });

  it("names the cookie per drop and builds the Club-mail link", async () => {
    expect(earlyAccessCookieName("holiday-sparkle")).toBe("sparkela_ea_holiday-sparkle");
    const token = await earlyAccessToken("holiday-sparkle", SECRET);
    expect(await earlyAccessLink("holiday-sparkle", SECRET, "https://sparkela.nl/")).toBe(
      `https://sparkela.nl/drops/holiday-sparkle?toegang=${token}`,
    );
  });

  it("prints the same link from scripts/early-access-link.mjs (npm run early-access-link)", async () => {
    const output = execFileSync(process.execPath, ["scripts/early-access-link.mjs", "holiday-sparkle"], {
      cwd: appRoot,
      env: { PATH: process.env.PATH ?? "", EARLY_ACCESS_SECRET: SECRET, NEXT_PUBLIC_SITE_URL: "https://sparkela.nl" },
      encoding: "utf8",
    });
    expect(output.trim()).toBe(await earlyAccessLink("holiday-sparkle", SECRET, "https://sparkela.nl"));
  });

  it("refuses an unknown drop or a short secret in the script", () => {
    const run = (args: string[], secret: string) => () =>
      execFileSync(process.execPath, ["scripts/early-access-link.mjs", ...args], {
        cwd: appRoot,
        env: { PATH: process.env.PATH ?? "", EARLY_ACCESS_SECRET: secret, NEXT_PUBLIC_SITE_URL: "https://sparkela.nl" },
        encoding: "utf8",
        stdio: "pipe",
      });
    expect(run(["iets"], SECRET)).toThrow(/Unknown drop/);
    expect(run(["holiday-sparkle"], "te-kort")).toThrow(/EARLY_ACCESS_SECRET/);
  });
});
