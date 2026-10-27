import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type SubscriptionModule = typeof import("./subscription");

const KEY = "sparkela:email-capture:subscribed";

function fakeStorage(broken = false) {
  const data = new Map<string, string>();
  const fail = () => {
    throw new Error("storage blocked");
  };
  return {
    data,
    getItem: (key: string) => (broken ? fail() : (data.get(key) ?? null)),
    setItem: (key: string, value: string) => (broken ? fail() : void data.set(key, value)),
    removeItem: (key: string) => (broken ? fail() : void data.delete(key)),
  };
}

function fakeWindow(storage = fakeStorage()) {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  return {
    localStorage: storage,
    listeners,
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(listener);
    },
    removeEventListener: (type: string, listener: (event: unknown) => void) => listeners.get(type)?.delete(listener),
  };
}

/** A fresh copy of the module: the in-memory flag is module state. */
async function load(): Promise<SubscriptionModule> {
  vi.resetModules();
  return import("./subscription");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("with working storage", () => {
  it("is false until markSubscribed(), then stored under the sparkela key", async () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    const { hasSubscribed, markSubscribed } = await load();
    expect(hasSubscribed()).toBe(false);
    markSubscribed();
    expect(hasSubscribed()).toBe(true);
    expect(win.localStorage.data.get(KEY)).toBe("true");
  });

  it("remembers a sign-up from an earlier visit", async () => {
    const win = fakeWindow();
    win.localStorage.data.set(KEY, "true");
    vi.stubGlobal("window", win);
    const { hasSubscribed } = await load();
    expect(hasSubscribed()).toBe(true);
  });

  it("treats a stored false or garbage as not subscribed", async () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    const { hasSubscribed } = await load();
    win.localStorage.data.set(KEY, "false");
    expect(hasSubscribed()).toBe(false);
    win.localStorage.data.set(KEY, "{broken");
    expect(hasSubscribed()).toBe(false);
  });

  it("notifies subscribers in this tab and on a storage event from another tab", async () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    const { markSubscribed, subscribeSubscribed } = await load();
    const listener = vi.fn();
    const unsubscribe = subscribeSubscribed(listener);
    markSubscribed();
    expect(listener).toHaveBeenCalledTimes(1);

    win.listeners.get("storage")?.forEach((handler) => handler({ key: KEY }));
    win.listeners.get("storage")?.forEach((handler) => handler({ key: "sparkela:cart:v1" }));
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    expect(win.listeners.get("storage")?.size).toBe(0);
  });
});

describe("without working storage", () => {
  it("never throws and counts the sign-up for the rest of this visit", async () => {
    vi.stubGlobal("window", fakeWindow(fakeStorage(true)));
    const { hasSubscribed, markSubscribed } = await load();
    expect(hasSubscribed()).toBe(false);
    expect(() => markSubscribed()).not.toThrow();
    expect(hasSubscribed()).toBe(true);
  });

  it("forgets the in-memory sign-up on the next page load (a fresh module)", async () => {
    vi.stubGlobal("window", fakeWindow(fakeStorage(true)));
    const first = await load();
    first.markSubscribed();
    const second = await load();
    expect(second.hasSubscribed()).toBe(false);
  });
});

describe("on the server", () => {
  it("is false, and useSubscribed() renders the server snapshot", async () => {
    const { hasSubscribed, subscribeSubscribed, useSubscribed } = await load();
    expect(typeof window).toBe("undefined");
    expect(hasSubscribed()).toBe(false);
    expect(typeof subscribeSubscribed(() => {})).toBe("function");

    function Probe() {
      return createElement("span", null, useSubscribed() ? "yes" : "no");
    }
    expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>no</span>");
  });
});
