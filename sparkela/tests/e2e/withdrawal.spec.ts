import { expect, gotoHydrated, test } from "./fixtures";

/**
 * Brief §7 "herroepformulier valideert" (docs/PLAN.md §19.2, §15.4, decision 66): an empty submit gives three field
 * errors (name, order number, email) linked to their fields, a wrong order number its own error, and a valid form
 * without mail keys the fallback with a mailto: link that carries the filled-in withdrawal. The page has exactly one
 * button "Herroeping bevestigen" (brief §6).
 *
 * /api/herroepen allows 5 valid requests per 10 minutes per client. Every run of this spec gets a client address of its
 * own (IPv6 documentation range), so re-running the suite within 10 minutes never meets the limit.
 */

test.beforeEach(async ({ page }, testInfo) => {
  const now = Date.now().toString(16).padStart(12, "0");
  const client = `2001:db8::${now.slice(-12, -8)}:${now.slice(-8, -4)}:${now.slice(-4)}:${testInfo.parallelIndex}`;
  await page.route("**/api/herroepen", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": client } }),
  );
});

test("the withdrawal form validates and falls back to email without mail keys", async ({ page }) => {
  await gotoHydrated(page, "/herroepen");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Herroepen");

  const form = main.getByRole("form", { name: "Herroepingsformulier" });
  const name = form.getByRole("textbox", { name: "Je naam" });
  const order = form.getByRole("textbox", { name: "Bestelnummer" });
  const email = form.getByRole("textbox", { name: "E-mailadres voor de bevestiging" });
  const products = form.getByRole("textbox", { name: "Welke producten?" });
  const submit = page.getByRole("button", { name: "Herroeping bevestigen" });
  await expect(submit).toHaveCount(1);

  // Empty: three errors, each on its field, and focus on the first.
  await submit.click();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(order).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(products).not.toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveAccessibleDescription(/Vul je naam in\./);
  await expect(order).toHaveAccessibleDescription(/Vul je bestelnummer in, bijvoorbeeld #1001\./);
  await expect(email).toHaveAccessibleDescription(/Vul een geldig e-mailadres in\./);
  await expect(form.getByText("Vul je naam in.", { exact: true })).toBeVisible();
  await expect(form.getByText("Vul je bestelnummer in, bijvoorbeeld #1001.", { exact: true })).toBeVisible();
  await expect(form.getByText("Vul een geldig e-mailadres in.", { exact: true })).toBeVisible();
  await expect(name).toBeFocused();

  // A wrong order number: only that field keeps an error.
  await name.fill("Sanne de Vries");
  await email.fill("sanne@voorbeeld.nl");
  await order.fill("bestelling");
  await submit.click();
  await expect(order).toHaveAttribute("aria-invalid", "true");
  await expect(order).toBeFocused();
  await expect(name).not.toHaveAttribute("aria-invalid", "true");
  await expect(email).not.toHaveAttribute("aria-invalid", "true");
  await expect(form.getByText("Vul je bestelnummer in, bijvoorbeeld #1001.", { exact: true })).toBeVisible();

  // Valid: without mail keys the route answers not-configured and the form offers a mailto: with the filled-in data.
  await order.fill("#1001");
  await products.fill("Lola chunky hoops");
  await expect(order).not.toHaveAttribute("aria-invalid", "true");
  const answer = page.waitForResponse((response) => response.url().endsWith("/api/herroepen"));
  await submit.click();
  expect((await answer).status()).toBe(503);

  const status = form.getByRole("status").filter({ hasText: "Dat lukt nu even niet." });
  await expect(status).toHaveText("Dat lukt nu even niet. Mail ons op hallo@sparkela.nl.");
  const mailto = status.getByRole("link", { name: "hallo@sparkela.nl" });
  const href = await mailto.getAttribute("href");
  expect(href).toMatch(/^mailto:hallo@sparkela\.nl\?subject=/);
  const url = new URL(href ?? "");
  expect(url.searchParams.get("subject")).toBe("Herroeping bestelling #1001");
  const body = url.searchParams.get("body") ?? "";
  expect(body).toContain("Hierbij herroep ik de overeenkomst over de bestelling hieronder.");
  expect(body).toContain("Sanne de Vries");
  expect(body).toContain("sanne@voorbeeld.nl");
  expect(body).toContain("Lola chunky hoops");

  // Still exactly one confirm button, and the form keeps what was typed.
  await expect(submit).toHaveCount(1);
  await expect(name).toHaveValue("Sanne de Vries");
});
