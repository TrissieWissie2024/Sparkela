import {
  addProduct,
  cartButton,
  cartDrawer,
  cartLines,
  expect,
  gotoHydrated,
  mainAddToCart,
  pickOption,
  test,
  totalsRow,
} from "./fixtures";

/**
 * Brief §7 "product toevoegen" (docs/PLAN.md §19.2): from a product page with a colour choice, with the quick add of a
 * card with one variant, and with the quick add of a card with a choice list. Every add opens the drawer with the
 * line and the header counts it. Plus the demo checkout (brief §7 local provider): the order overview, the notice
 * "Demo-checkout: er wordt niet betaald", a placed order with a DEMO reference and an empty bag afterwards.
 */

test("a product page adds the chosen colour and the header counts it", async ({ page }) => {
  await gotoHydrated(page, "/products/lola-chunky-hoops");
  await expect(cartButton(page)).toHaveText("Tas (0)");

  const main = page.getByRole("main");
  await pickOption(main, "Zilver");
  await pickOption(main, "Goud");
  await expect(mainAddToCart(page)).toHaveAccessibleName("In je tas €19,95");
  await mainAddToCart(page).click();

  const drawer = cartDrawer(page);
  await expect(drawer).toBeVisible();
  const line = cartLines(drawer);
  await expect(line).toHaveCount(1);
  await expect(line.getByRole("link", { name: "Lola chunky hoops", exact: true })).toBeVisible();
  await expect(line.getByText("Goud", { exact: true })).toBeVisible();
  await expect(line.getByRole("group", { name: "Aantal Lola chunky hoops" })).toContainText("1");
  await expect(drawer.getByText("1 artikel", { exact: true })).toBeVisible();

  // The header sits behind the modal drawer; after closing it reads "Tas (1)", named "Tas, 1 artikel".
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(cartButton(page)).toHaveText("Tas (1)");
  await expect(cartButton(page)).toHaveAccessibleName("Tas, 1 artikel");
  // Focus goes back to the button that opened the drawer.
  await expect(mainAddToCart(page)).toBeFocused();
});

test("quick add on a card: one variant goes straight in, several open a choice list", async ({ page }) => {
  await gotoHydrated(page, "/collections/oorbellen");
  const main = page.getByRole("main");

  // Jade stipjes has one variant: "In tas" adds it at once.
  await main.getByRole("button", { name: "In tas: Jade stipjes", exact: true }).click();
  const drawer = cartDrawer(page);
  await expect(drawer).toBeVisible();
  await expect(cartLines(drawer).getByRole("link", { name: "Jade stipjes", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(cartButton(page)).toHaveText("Tas (1)");

  // Noor dikke ringetjes has two colours: "Kies" opens a small choice list over the card (QA round 1: the card and its
  // row neighbours keep their height).
  const card = main.getByRole("article").filter({ has: page.getByRole("heading", { name: "Noor dikke ringetjes" }) });
  const heightsBefore = await main.getByRole("article").evaluateAll((cards) => cards.map((item) => item.getBoundingClientRect().height));
  await card.getByRole("button", { name: "Kies uitvoering: Noor dikke ringetjes" }).click();
  const choice = card.getByRole("dialog", { name: "Kies een uitvoering van Noor dikke ringetjes" });
  await expect(choice).toBeVisible();
  const heightsAfter = await main.getByRole("article").evaluateAll((cards) => cards.map((item) => item.getBoundingClientRect().height));
  expect(heightsAfter).toEqual(heightsBefore);
  await pickOption(choice, "Zilver");
  await choice.getByRole("button", { name: "In tas: Noor dikke ringetjes" }).click();

  await expect(drawer).toBeVisible();
  const noor = cartLines(drawer).filter({ has: page.getByRole("link", { name: "Noor dikke ringetjes", exact: true }) });
  await expect(noor).toHaveCount(1);
  await expect(noor.getByText("Zilver", { exact: true })).toBeVisible();
  await expect(cartLines(drawer)).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(cartButton(page)).toHaveText("Tas (2)");
  // Focus is back on the card's "Kies", not lost to <body> (WCAG 2.4.3, QA round 1).
  await expect(card.getByRole("button", { name: /^(Kies uitvoering|Toegevoegd): Noor dikke ringetjes$/ })).toBeFocused();
});

test("the choice list closes when focus leaves it, so the trigger and the title are never hidden under it", async ({ page }) => {
  await gotoHydrated(page, "/collections/oorbellen");
  const card = page.getByRole("main").getByRole("article").filter({ has: page.getByRole("heading", { name: "Lola chunky hoops" }) });
  const trigger = card.getByRole("button", { name: "Kies uitvoering: Lola chunky hoops" });
  const choice = card.getByRole("dialog", { name: "Kies een uitvoering van Lola chunky hoops" });
  await trigger.click();
  await expect(choice).toBeVisible();
  // Shift+Tab from the first option: focus on "Kies", the list closed (QA round 2, WCAG 2.4.11).
  await page.keyboard.press("Shift+Tab");
  await expect(trigger).toBeFocused();
  await expect(choice).toBeHidden();
  // A press outside closes it too, without moving focus into the list.
  await trigger.click();
  await expect(choice).toBeVisible();
  await page.getByRole("main").getByRole("heading", { level: 1 }).click();
  await expect(choice).toBeHidden();
});

test("a ring has no preselected size: the add asks for one first", async ({ page }) => {
  await gotoHydrated(page, "/products/nina-chunky-ring");
  const main = page.getByRole("main");
  await expect(main.getByRole("radiogroup").getByRole("radio", { checked: true })).toHaveCount(0);
  await mainAddToCart(page).click();
  await expect(main.getByText("Kies eerst je maat.", { exact: true })).toBeVisible();
  await expect(cartDrawer(page)).toBeHidden();
  await pickOption(main, "17");
  await mainAddToCart(page).click();
  await expect(cartLines(cartDrawer(page)).getByText("17", { exact: true })).toBeVisible();
});

test("the demo checkout places an order and empties the bag", async ({ page }) => {
  const drawer = await addProduct(page, "sam-schelp-oorbellen");
  await expect(totalsRow(drawer, "Totaal")).toHaveText("€19,90");

  await drawer.getByRole("button", { name: "Afrekenen" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("note").filter({ hasText: /^Demo-checkout: er wordt niet betaald$/ })).toBeVisible();
  await expect(main.getByRole("heading", { level: 1, name: "Afrekenen" })).toBeVisible();
  await expect(main.getByRole("textbox", { name: "Kortingscode" })).toBeVisible();

  await main.getByRole("textbox", { name: "E-mailadres" }).fill("test@voorbeeld.nl");
  await main.getByRole("textbox", { name: "Voornaam" }).fill("Test");
  await main.getByRole("textbox", { name: "Achternaam" }).fill("Klant");
  await main.getByRole("textbox", { name: "Straat en huisnummer" }).fill("Teststraat 1");
  await main.getByRole("textbox", { name: "Postcode" }).fill("1234 AB");
  await main.getByRole("textbox", { name: "Plaats" }).fill("Utrecht");
  await main.getByRole("button", { name: "Bestelling plaatsen (demo)" }).click();

  const placed = main.getByRole("heading", { name: "Je demo-bestelling is geplaatst" });
  await expect(placed).toBeVisible();
  await expect(placed).toBeFocused();
  await expect(main.getByText(/^DEMO-[A-Z2-9]{6}$/)).toBeVisible();
  await expect(cartButton(page)).toHaveText("Tas (0)");
});
