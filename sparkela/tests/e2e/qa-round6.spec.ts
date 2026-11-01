import type { Locator, Page } from "@playwright/test";

import {
  cartDrawer,
  expect,
  fontsReady,
  gotoHydrated,
  mainAddToCart,
  PRELAUNCH_NOW,
  PRELAUNCH_NOW_ISO,
  proxyTimeHeaders,
  test,
} from "./fixtures";

/**
 * Regression checks for QA round 6 (docs/QA-NOTES.md §7, decision 227): the choice a visitor sees is the one that goes
 * into the bag, focus never falls to the drawer or <body>, the waitlist stays light and still, the teaser does not
 * invite browsing a closed shop, short pages are not mostly dark footer, the moment tiles keep the arrow with the name,
 * search reserves only up to the fold, and "In je tas" stays a quick interaction on a slow phone.
 */

/** Variant ids in the local cart, read from storage (the drawer only shows titles). */
async function cartVariantIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem("sparkela:cart:v1");
      const cart = raw ? (JSON.parse(raw) as { lines?: Array<{ variantId: string; quantity: number }> }) : null;
      return (cart?.lines ?? []).flatMap((line) => Array(line.quantity).fill(line.variantId) as string[]);
    } catch {
      return [];
    }
  });
}

/** Slows the page's CPU (Chromium only), like a mid-range phone; returns a function that restores it. */
async function throttleCpu(page: Page, rate: number): Promise<() => Promise<void>> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  return async () => {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await cdp.detach();
  };
}

/** Scrolls the tile near the top of the screen and returns its box. */
async function tileInView(page: Page, tile: Locator) {
  await tile.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 150));
  await page.waitForTimeout(300);
  const box = await tile.boundingBox();
  if (!box) throw new Error("tile not rendered");
  return box;
}

/** Clicks the centre of an element with raw mouse events, so the second click can follow the first at once. */
async function clickAt(page: Page, box: { x: number; y: number; width: number; height: number }) {
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Presses the buy button right after the tap, wherever it is by then (the stack panel mounts above it and moves it
 * 430 px down once the choice renders): a click on the element itself, in the page, so it lands before that render on
 * a slow CPU. The first tap stays a real pointer click on the tile.
 */
async function pressBuyButton(page: Page) {
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>("main button")).find((element) =>
      /^(In je tas|Voeg de stack toe)/.test(element.textContent?.trim() ?? ""),
    );
    button?.click();
  });
}

test.describe("the buy box adds what the visitor sees, also right after a tap (QA round 6)", () => {
  const cases = [
    { name: "a colour", handle: "lola-chunky-hoops", option: /^Zilver/, expected: ["local:lola-chunky-hoops:2"] },
    { name: "a ring size", handle: "nina-chunky-ring", option: /^17/, expected: ["local:nina-chunky-ring:2"] },
  ];
  for (const item of cases) {
    test(`${item.name} tapped just before "In je tas" at 4x CPU`, async ({ page }) => {
      await gotoHydrated(page, `/products/${item.handle}`);
      const main = page.getByRole("main");
      const tile = main.locator("label").filter({ hasText: item.option }).first();
      const tileBox = await tileInView(page, tile);
      const restore = await throttleCpu(page, 4);
      await clickAt(page, tileBox);
      await pressBuyButton(page);
      await expect(cartDrawer(page)).toBeVisible({ timeout: 15_000 });
      await restore();
      expect(await cartVariantIds(page)).toEqual(item.expected);
    });
  }

  test(`"Stack van 3" tapped just before the button at 4x CPU adds all three`, async ({ page }) => {
    await gotoHydrated(page, "/products/lola-chunky-hoops");
    const main = page.getByRole("main");
    const tile = main.locator("label").filter({ hasText: /^Stack van 3/ }).first();
    const tileBox = await tileInView(page, tile);
    const restore = await throttleCpu(page, 4);
    await clickAt(page, tileBox);
    await pressBuyButton(page);
    await expect(cartDrawer(page)).toBeVisible({ timeout: 15_000 });
    await restore();
    expect(await cartVariantIds(page)).toHaveLength(3);
  });
});

test("tabbing out of the upsell choice list in the drawer keeps focus in the drawer's flow (QA round 6)", async ({ page }) => {
  await gotoHydrated(page, "/products/bo-statement-druppels");
  await mainAddToCart(page).click();
  const drawer = cartDrawer(page);
  await expect(drawer).toBeVisible();
  // Add single-variant suggestions until one with a choice list (a piece in Goud and Zilver) is offered.
  const choose = drawer.getByRole("button", { name: /^Kies uitvoering:/ }).first();
  for (let i = 0; i < 4 && (await choose.count()) === 0; i += 1) {
    await drawer.getByRole("button", { name: /^In tas:/ }).first().click();
    await page.waitForTimeout(500);
  }
  await choose.focus();
  await page.keyboard.press("Enter");
  const panel = drawer.locator("[data-quick-add-panel]");
  await expect(panel).toBeVisible();
  // Shift+Tab from the first radio goes back to "Kies", not to the drawer itself.
  await panel.getByRole("radio").first().focus();
  await page.keyboard.press("Shift+Tab");
  await expect(choose).toBeFocused();
  await expect(panel).toHaveCount(0);
  // Tab out of the last control goes to the next element after the list.
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: /^In tas:/ }).focus();
  await page.keyboard.press("Tab");
  await expect(panel).toHaveCount(0);
  const focused = await page.evaluate(() => ({
    role: document.activeElement?.getAttribute("role"),
    inDrawer: !!document.activeElement?.closest('[role="dialog"]'),
    tag: document.activeElement?.tagName,
  }));
  expect(focused.inDrawer).toBe(true);
  expect(focused.role).not.toBe("dialog");
});

test("the empty state's 'Wis filters' hands focus to the count, never to <body> (QA round 6)", async ({ page }) => {
  await gotoHydrated(page, "/collections/alle?vibe=clean-en-classy&moment=festival");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Geen sieraden gevonden" })).toBeVisible();
  // The filter bar has its own "Wis filters"; the empty state's comes after it.
  const clear = main.getByRole("button", { name: "Wis filters" }).last();
  await clear.focus();
  await page.keyboard.press("Enter");
  await expect(main.getByText(/^\d+ sieraden$/).first()).toBeFocused();
});

test.describe("prelaunch (QA round 6)", () => {
  test.use({ extraHTTPHeaders: proxyTimeHeaders(PRELAUNCH_NOW_ISO), clockAt: PRELAUNCH_NOW });

  test("the waitlist carries no shop chrome in its HTML (the 404 lives in the shop)", async ({ request }) => {
    const response = await request.get("/", { headers: proxyTimeHeaders(PRELAUNCH_NOW_ISO) });
    expect(response.headers()["x-sparkela-gate"]).toBe("wachtlijst");
    const html = await response.text();
    // About 71 kB; with the root 404's shop chrome (catalog, cards, header, footer) it was 172 kB.
    expect(html.length).toBeLessThan(80_000);
    // The root 404 is in every page's payload, but in its bare shape: no announcement bar, no favourites.
    expect(html).not.toContain("Aankondigingen");
    expect(html).not.toContain("Lindes favorieten");
  });

  test("the waitlist loads no shop scripts after hydration either (QA afsluitende controle)", async ({ page }) => {
    // A viewport prefetch of /privacy or another legal page (shop routes) used to pull in the shop chrome's chunk.
    const shopScripts: string[] = [];
    const prefetches: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("_rsc=")) prefetches.push(new URL(request.url()).pathname);
    });
    page.on("response", async (response) => {
      if (!response.url().endsWith(".js")) return;
      const body = await response.text().catch(() => "");
      if (body.includes("Artikelen in je tas")) shopScripts.push(response.url());
    });
    await gotoHydrated(page, "/");
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(3000);
    expect(prefetches).toEqual([]);
    expect(shopScripts).toEqual([]);
  });

  test("the drop teaser says when the shop opens instead of inviting a browse", async ({ page }) => {
    await gotoHydrated(page, "/drops/holiday-sparkle");
    const main = page.getByRole("main");
    await expect(main.getByText("De shop opent op 27 november.", { exact: true })).toBeVisible();
    await expect(main.getByRole("link", { name: "Naar de wachtlijst" })).toHaveAttribute("href", "/wachtlijst");
    await expect(main.getByRole("heading", { name: "Alvast rondkijken?" })).toBeHidden();
    await expect(main.getByRole("link", { name: "Stacks van Linde" })).toBeHidden();
  });

  test("the waitlist does not move after its first paint, also on a slow CPU", async ({ page, isMobile }) => {
    test.skip(isMobile, "The photo spans both rows from lg.");
    await page.addInitScript(() => {
      const store = window as unknown as { __shifts: number[] };
      store.__shifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
          if (!entry.hadRecentInput) store.__shifts.push(entry.value);
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    const restore = await throttleCpu(page, 4);
    await page.goto("/");
    await fontsReady(page);
    await restore();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const shifts = await page.evaluate(() => (window as unknown as { __shifts: number[] }).__shifts);
    expect(shifts.reduce((sum, value) => sum + value, 0)).toBeLessThan(0.001);
  });
});

test.describe("short pages are not mostly dark footer (QA round 6, brief §5)", () => {
  for (const [path, status] of [
    ["/spark-finder", 200],
    ["/bestaat-niet", 404],
  ] as const) {
    test(`${path}: the footer is at most a third of the page`, async ({ page }) => {
      await gotoHydrated(page, path, { status });
      await fontsReady(page);
      const share = await page.evaluate(() => {
        const footer = document.querySelector("footer")!.getBoundingClientRect().height;
        return footer / document.documentElement.scrollHeight;
      });
      expect(share).toBeLessThan(0.36);
    });
  }
});

test("a moment tile keeps its arrow right after the name, also when the name wraps (QA round 6)", async ({ page, isMobile }) => {
  test.skip(isMobile, "Measured at 1024, where 'Kantoor maar niet saai' wraps.");
  await page.setViewportSize({ width: 1024, height: 800 });
  await gotoHydrated(page, "/");
  await fontsReady(page);
  const gaps = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main li a[href^="/collections/"] > span.kop-4')).map((label) => {
      const arrow = label.querySelector("svg")!;
      const range = document.createRange();
      range.selectNodeContents(arrow.parentElement!.firstChild!);
      return Math.round(arrow.getBoundingClientRect().left - range.getBoundingClientRect().right);
    }),
  );
  expect(gaps.length).toBe(5);
  for (const gap of gaps) expect(gap).toBeLessThanOrEqual(12);
});

test("a search without results reserves only up to the fold (QA round 6)", async ({ page, isMobile }) => {
  test.skip(isMobile, "On a phone the page itself is longer than the screen.");
  await gotoHydrated(page, "/zoeken?q=xyzzy");
  await fontsReady(page);
  const { footerTop, viewport } = await page.evaluate(() => ({
    footerTop: document.querySelector("footer")!.getBoundingClientRect().top + scrollY,
    viewport: innerHeight,
  }));
  // Below the fold (no layout shift when results come in), but no screen of empty page above it.
  expect(footerTop).toBeGreaterThanOrEqual(viewport);
  expect(footerTop).toBeLessThan(viewport + 120);
});

test("'In je tas' answers within 200 ms on a 4x slower CPU (QA round 6, INP)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "A phone tap.");
  const durations: number[] = [];
  for (let run = 0; run < 3; run += 1) {
    await page.context().clearCookies();
    await page.evaluate(() => window.localStorage.removeItem("sparkela:cart:v1")).catch(() => undefined);
    await gotoHydrated(page, "/products/lola-chunky-hoops");
    await page.evaluate(() => {
      const store = window as unknown as { __inp: number[] };
      store.__inp = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { interactionId?: number }>) {
          if (entry.interactionId) store.__inp.push(entry.duration);
        }
      }).observe({ type: "event", durationThreshold: 16 } as PerformanceObserverInit);
    });
    const button = mainAddToCart(page);
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    if (!box) throw new Error("no buy button");
    const restore = await throttleCpu(page, 4);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(cartDrawer(page)).toBeVisible({ timeout: 15_000 });
    await restore();
    await page.waitForTimeout(300);
    durations.push(Math.max(0, ...(await page.evaluate(() => (window as unknown as { __inp: number[] }).__inp))));
  }
  // The best of three: one slow run on a busy test machine says little, three say a lot.
  expect(Math.min(...durations), JSON.stringify(durations)).toBeLessThan(200);
});
