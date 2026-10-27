import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { storageKeys } from "@/lib/storage";

/**
 * The popup rules (docs/PLAN.md §13.11.1, §19.1): the 7-day cooldown, never after a sign-up, never when storage is
 * broken, and the page conditions (consent banner, sticky bar, blocked paths). Storage and the DOM are small in-memory
 * stand-ins on globalThis; every test loads the modules fresh, because lib/subscription.ts remembers a sign-up for the
 * rest of the visit.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-27T12:00:00+01:00");

class MemoryStorage {
  readonly data = new Map<string, string>();
  broken = false;

  getItem(key: string): string | null {
    if (this.broken) throw new Error("SecurityError");
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.broken) throw new Error("QuotaExceededError");
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    if (this.broken) throw new Error("SecurityError");
    this.data.delete(key);
  }
}

let storage: MemoryStorage;
let body: { dataset: Record<string, string | undefined>; bottomBar: string };

async function load() {
  vi.resetModules();
  const state = await import("./state");
  const subscription = await import("@/lib/subscription");
  return { ...state, ...subscription };
}

beforeEach(() => {
  storage = new MemoryStorage();
  body = { dataset: {}, bottomBar: "" };
  vi.stubGlobal("window", { localStorage: storage, addEventListener: () => {}, removeEventListener: () => {} });
  vi.stubGlobal("document", { body });
  vi.stubGlobal("getComputedStyle", () => ({
    getPropertyValue: (name: string) => (name === "--onderbalk" ? body.bottomBar : ""),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isCooldownOver", () => {
  it("counts a missing or unreadable value as never shown", async () => {
    const { isCooldownOver } = await load();
    expect(isCooldownOver(null, NOW, 7)).toBe(true);
    expect(isCooldownOver("onzin", NOW, 7)).toBe(true);
  });

  it("is over after exactly 7 days, not before", async () => {
    const { isCooldownOver } = await load();
    expect(isCooldownOver(NOW - 7 * DAY + 1, NOW, 7)).toBe(false);
    expect(isCooldownOver(NOW - 7 * DAY, NOW, 7)).toBe(true);
    expect(isCooldownOver(NOW - 8 * DAY, NOW, 7)).toBe(true);
  });

  it("treats a time in the future as recent (a clock that moved back never skips the cap)", async () => {
    const { isCooldownOver } = await load();
    expect(isCooldownOver(NOW + DAY, NOW, 7)).toBe(false);
  });
});

describe("canShowPill and markShown (rules 2 and 3)", () => {
  it("shows on a first visit and stores the moment", async () => {
    const { canShowPill, markShown, readLastShown } = await load();
    expect(canShowPill(NOW)).toBe(true);
    expect(markShown(NOW)).toBe(true);
    expect(readLastShown()).toBe(NOW);
    expect(storage.data.has(`${storageKeys.emailCaptureLastShown}:test`)).toBe(false);
  });

  it("at most once per 7 days", async () => {
    const { canShowPill, markShown } = await load();
    markShown(NOW);
    expect(canShowPill(NOW + 1000)).toBe(false);
    expect(canShowPill(NOW + 6 * DAY)).toBe(false);
    expect(canShowPill(NOW + 7 * DAY)).toBe(true);
  });

  it("8 days after the last time it comes back (the e2e case)", async () => {
    storage.data.set(storageKeys.emailCaptureLastShown, JSON.stringify(NOW - 8 * DAY));
    const { canShowPill } = await load();
    expect(canShowPill(NOW)).toBe(true);
  });

  it("never after a sign-up", async () => {
    const { canShowPill, markSubscribed } = await load();
    markSubscribed();
    expect(canShowPill(NOW)).toBe(false);
    expect(canShowPill(NOW + 30 * DAY)).toBe(false);
  });

  it("never when storage is broken: the 7-day cap could not be kept", async () => {
    storage.broken = true;
    const { canShowPill, markShown } = await load();
    expect(canShowPill(NOW)).toBe(false);
    expect(markShown(NOW)).toBe(false);
  });

  it("reads a hand-written ISO date too (the e2e suppression writes a far-future date)", async () => {
    storage.data.set(storageKeys.emailCaptureLastShown, "2100-01-01");
    const first = await load();
    expect(first.canShowPill(NOW)).toBe(false);
    storage.data.set(storageKeys.emailCaptureLastShown, JSON.stringify("2100-01-01T00:00:00+01:00"));
    const second = await load();
    expect(second.canShowPill(NOW)).toBe(false);
  });

  it("stays away when the popup is switched off", async () => {
    vi.resetModules();
    vi.doMock("@/content/site", async (importOriginal) => {
      const original = await importOriginal<typeof import("@/content/site")>();
      return { site: { ...original.site, emailCapture: { ...original.site.emailCapture, enabled: false } } };
    });
    const { canShowPill } = await import("./state");
    expect(canShowPill(NOW)).toBe(false);
    vi.doUnmock("@/content/site");
  });
});

describe("page conditions", () => {
  it("is blocked while the consent banner is open or the sticky add-to-cart bar is in view", async () => {
    const { bodyBlocksPill, consentOpen, stickyBarHeight } = await load();
    expect(bodyBlocksPill()).toBe(false);
    body.dataset.consentOpen = "true";
    expect(consentOpen()).toBe(true);
    expect(bodyBlocksPill()).toBe(true);
    delete body.dataset.consentOpen;
    body.bottomBar = "72px";
    expect(stickyBarHeight()).toBe(72);
    expect(bodyBlocksPill()).toBe(true);
    body.bottomBar = "0px";
    expect(bodyBlocksPill()).toBe(false);
  });

  it("never on /checkout or /wachtlijst", async () => {
    const { isBlockedPath } = await load();
    expect(isBlockedPath("/checkout")).toBe(true);
    expect(isBlockedPath("/wachtlijst")).toBe(true);
    expect(isBlockedPath("/checkout/klaar")).toBe(true);
    expect(isBlockedPath("/")).toBe(false);
    expect(isBlockedPath("/products/lola-chunky-hoops")).toBe(false);
    expect(isBlockedPath("/checkouts")).toBe(false);
    expect(isBlockedPath(null)).toBe(false);
  });
});
