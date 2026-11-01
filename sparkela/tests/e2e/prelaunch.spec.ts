import type { Page } from "@playwright/test";

import { site } from "@/content/site";
import {
  boxesOverlap,
  expect,
  gotoHydrated,
  PRELAUNCH_NOW,
  PRELAUNCH_NOW_ISO,
  PREVIEW_TOKEN,
  proxyTimeHeaders,
  SECOND,
  test,
  TEST_NOW_HEADER,
  TEST_NOW_ISO,
} from "./fixtures";

/**
 * Brief §7 "prelaunch toont de wachtlijst en de preview-link werkt" (docs/PLAN.md §19.2, §11). The proxy reads the
 * time from the header x-sparkela-test-now; the browser clock is set to the same moment, because the TimeGate on the
 * waitlist follows the browser clock.
 */

test.use({ extraHTTPHeaders: proxyTimeHeaders(PRELAUNCH_NOW_ISO), clockAt: PRELAUNCH_NOW });

const WAITLIST_H1 = "Sparkela komt eraan";

async function expectWaitlist(page: Page) {
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText(WAITLIST_H1);
  // The bare layout: no shop header, no cart.
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page).toHaveTitle("Sparkela | Binnenkort online");
}

for (const path of ["/", "/collections/oorbellen"]) {
  test(`${path} shows the waitlist`, async ({ page }) => {
    const response = await gotoHydrated(page, path);
    expect(response?.headers()["x-sparkela-gate"]).toBe("wachtlijst");
    await expect(page).toHaveURL(path);
    await expectWaitlist(page);
    // The promise with the launch date from config, right under the H1 (QA round 4: the switch to "We zijn live." goes there).
    await expect(page.getByText("Vanaf 27\u00a0november online.", { exact: true })).toBeVisible();
  });
}

test("legal pages and the confirmation page stay open", async ({ page }) => {
  let response = await gotoHydrated(page, "/privacy");
  expect(response?.headers()["x-sparkela-gate"]).toBe("open");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Privacy/);
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(WAITLIST_H1);
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Hier de overeenkomst herroepen" })).toBeVisible();

  // With a token the button state; without one the page says at once that the link does not work (QA round 1).
  response = await gotoHydrated(page, "/nieuwsbrief/bevestigen?t=voorbeeld");
  expect(response?.headers()["x-sparkela-gate"]).toBe("open");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bevestig je aanmelding");
  response = await gotoHydrated(page, "/nieuwsbrief/bevestigen");
  expect(response?.headers()["x-sparkela-gate"]).toBe("open");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Deze link werkt niet meer");
});

test("metadata files pass the proxy", async ({ request }) => {
  const response = await request.get("/icon.svg", { headers: proxyTimeHeaders(PRELAUNCH_NOW_ISO) });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
});

test("Open Graph images pass the proxy, a hidden drop product gets the brand image", async ({ request }) => {
  // Since wave 10-11 (E1) every OG route exists; integrator 10 made this a hard check (no skip on a 404).
  for (const path of ["/opengraph-image", "/products/lola-chunky-hoops/opengraph-image", "/drops/holiday-sparkle/opengraph-image"]) {
    for (const iso of [TEST_NOW_ISO, PRELAUNCH_NOW_ISO]) {
      const response = await request.get(path, { headers: proxyTimeHeaders(iso) });
      expect(response.status(), `${path} at ${iso}`).toBe(200);
      expect(response.headers()["content-type"], `${path} at ${iso}`).toContain("image/png");
    }
  }
  const brand = await request.get("/opengraph-image", { headers: proxyTimeHeaders(PRELAUNCH_NOW_ISO) });
  const brandBytes = await brand.body();

  // Holiday Sparkle is hidden on 20 November: its product image is rewritten to the brand image (decision 201).
  const hidden = await request.get("/products/holiday-ster-oorbellen/opengraph-image", {
    headers: proxyTimeHeaders(PRELAUNCH_NOW_ISO),
  });
  expect(hidden.status()).toBe(200);
  expect(hidden.headers()["content-type"]).toContain("image/png");
  expect(hidden.headers()["x-sparkela-gate"]).toBe("teaser");
  expect(Buffer.compare(await hidden.body(), brandBytes), "the hidden product shows the brand image").toBe(0);
});

test("the preview link opens the shop and drops the token from the URL", async ({ page, context }) => {
  const response = await page.goto(`/?preview=${PREVIEW_TOKEN}`);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
  expect(page.url()).not.toContain("preview");
  expect(response?.headers()["x-sparkela-gate"]).toBe("preview");

  const cookie = (await context.cookies()).find((item) => item.name === "sparkela_preview");
  expect(cookie, "preview cookie").toBeDefined();
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  expect(cookie?.value).not.toContain(PREVIEW_TOKEN);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Eén paar oorbellen. Hele outfit af.");
  await expect(page.getByRole("banner")).toBeVisible();

  // The cookie keeps the shop open on other shop URLs.
  await gotoHydrated(page, "/collections/oorbellen");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Oorbellen");
});

test("a wrong preview token shows the waitlist and sets no cookie", async ({ page, context }) => {
  // Only a valid token redirects (plan §11.4); a wrong one simply meets the gate.
  const response = await page.goto("/?preview=not-the-right-token-0123456789abcdef");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-sparkela-gate"]).toBe("wachtlijst");
  await expectWaitlist(page);
  expect((await context.cookies()).some((item) => item.name === "sparkela_preview")).toBe(false);
});

test("the waitlist form reads field, consent, button from top to bottom", async ({ page }) => {
  await gotoHydrated(page, "/wachtlijst");
  // The waitlist form has its own name (axe landmark-unique, QA round 1).
  const form = page.getByRole("form", { name: "Aanmelden voor de wachtlijst" });
  const field = form.getByRole("textbox", { name: "Je e-mailadres" });
  const consent = form.getByRole("checkbox", { name: site.consentText });
  const consentLabel = form.getByText(site.consentText, { exact: true });
  const privacy = form.getByRole("link", { name: "Lees ons privacybeleid" });
  const button = form.getByRole("button", { name: "Ik doe mee" });
  await expect(consent).not.toBeChecked();

  const [fieldBox, labelBox, privacyBox, buttonBox] = await Promise.all(
    [field, consentLabel, privacy, button].map((locator) => locator.boundingBox()),
  );
  if (!fieldBox || !labelBox || !privacyBox || !buttonBox) throw new Error("form parts not rendered");
  expect(fieldBox.y + fieldBox.height).toBeLessThanOrEqual(labelBox.y);
  expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(buttonBox.y);
  expect(boxesOverlap(privacyBox, buttonBox)).toBe(false);

  // Keyboard order follows the screen: field, consent, privacy link, button.
  await field.focus();
  await page.keyboard.press("Tab");
  await expect(consent).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(privacy).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();

  // Sending without consent: the error is on the checkbox, nothing is sent.
  await field.fill("lid@voorbeeld.nl");
  await button.click();
  await expect(consent).toHaveAttribute("aria-invalid", "true");
  await expect(form.getByText("Vink eerst het vakje aan.", { exact: true })).toBeVisible();
});

test("after a waitlist sign-up the code is for the launch day, not for now (QA round 5, brief §2.8)", async ({ page }) => {
  await page.route("**/api/subscribe", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { status: "pending" } }) }),
  );
  await gotoHydrated(page, "/wachtlijst");
  const form = page.getByRole("form", { name: "Aanmelden voor de wachtlijst" });
  await form.getByRole("textbox", { name: "Je e-mailadres" }).fill("lid@voorbeeld.nl");
  await form.getByRole("checkbox", { name: site.consentText }).check();
  await form.getByRole("button", { name: "Ik doe mee" }).click();
  await expect(page.getByText("Je code WELKOM10 gebruik je vanaf 27 november.", { exact: false })).toBeVisible();
  await expect(page.getByText("kun je meteen gebruiken", { exact: false })).toHaveCount(0);
  // QA round 6: the result is plain text in the card under "Bijna klaar", no bordered box inside the card.
  const card = page.getByRole("region", { name: "Bijna klaar" });
  await expect(card).toBeVisible();
  const nestedBoxes = await card.evaluate((section) =>
    Array.from(section.querySelectorAll("*")).filter((el) => getComputedStyle(el).borderTopStyle !== "none" && getComputedStyle(el).borderTopWidth !== "0px").length,
  );
  expect(nestedBoxes).toBe(0);
});

test("the sign-up title breaks after the comma, never after 'plus' (QA round 6)", async ({ page, isMobile }) => {
  test.skip(isMobile, "From md the title has a line per half.");
  await gotoHydrated(page, "/wachtlijst");
  const lines = await page.locator("#wachtlijst-aanmelden").evaluate((heading) => {
    const words: Record<number, string[]> = {};
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      for (const match of text.matchAll(/[^\s\u00a0]+/g)) {
        const range = document.createRange();
        range.setStart(node, match.index ?? 0);
        range.setEnd(node, (match.index ?? 0) + match[0].length);
        const top = Math.round(range.getBoundingClientRect().top);
        (words[top] ??= []).push(match[0]);
      }
    }
    return Object.keys(words)
      .map(Number)
      .sort((a, b) => a - b)
      .map((top) => words[top]!.join(" "));
  });
  expect(lines).toEqual(["Als eerste shoppen,", "plus 10% op je eerste bestelling"]);
});

test.describe("at the launch", () => {
  const justBefore = "2026-11-26T23:59:55+01:00";
  test.use({ extraHTTPHeaders: proxyTimeHeaders(justBefore), clockAt: Date.parse(justBefore) });

  test("an open waitlist turns into 'We zijn live.' with a link to the shop on the first screen, in the same height", async ({ page }) => {
    const response = await gotoHydrated(page, "/");
    expect(response?.headers()["x-sparkela-gate"]).toBe("wachtlijst");
    const region = page.getByRole("region", { name: WAITLIST_H1 });
    const before = await region.boundingBox();
    const promise = page.getByText("Vanaf 27\u00a0november online.", { exact: true });
    await expect(promise).toBeVisible();

    await page.clock.runFor(10 * SECOND);

    await expect(page.getByText("We zijn live.", { exact: true })).toBeVisible();
    const toShop = page.getByRole("link", { name: "Naar de shop" });
    await expect(toShop).toHaveAttribute("href", "/");
    await expect(promise).toBeHidden();
    const after = await region.boundingBox();
    expect(after?.height, "no layout shift at the switch").toBe(before?.height);
    // QA round 4: the switch replaces the promise under the H1, so it is on the first screen, not under the form.
    const box = await toShop.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.y + box.height <= viewport.height, "'Naar de shop' in the first viewport").toBe(true);

    // After the launch the proxy serves the shop (the header follows the new moment).
    await page.setExtraHTTPHeaders({ [TEST_NOW_HEADER]: "2026-11-27T00:00:10+01:00" });
    await toShop.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Eén paar oorbellen. Hele outfit af.");
  });
});
