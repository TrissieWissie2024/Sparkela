import { home } from "@/content/home";
import { LAUNCH_TAB_MAX } from "@/components/home/launchTabs";
import { localCatalogProducts } from "../fixtures/local-catalog";
import {
  collectConsoleProblems,
  expect,
  gotoHydrated,
  promoBar,
  scrollThrough,
  test,
  TEST_NOW,
  trackRequests,
} from "./fixtures";

/**
 * Brief §7 "home laadt" (docs/PLAN.md §19.2): status 200, exactly one H1 with the brand promise, the announcement bar
 * in view, and no console errors or hydration warnings, also after scrolling through the page (lazy islands mount and
 * every link prefetch runs, so a missing route would show up as a failed request).
 */

test("the home page loads with one H1, the promo bar and a clean console", async ({ page }) => {
  const problems = collectConsoleProblems(page);
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });

  const requests = trackRequests(page);
  await gotoHydrated(page, "/");

  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText("Eén paar oorbellen. Hele outfit af.");
  await expect(promoBar(page)).toBeVisible();
  await expect(page).toHaveTitle(/Sparkela/);

  await scrollThrough(page);
  await requests.settled();

  expect(problems, "console problems").toEqual([]);
  expect(failed, "failed requests").toEqual([]);
});

/**
 * "De lanceringscollectie": the first tab's cards come with the HTML, the other tabs render theirs in the browser from
 * the client catalog when they open (decision 212). Every tab shows its own pieces, at most eight, and nothing else.
 */
test("the launch collection tabs show their own cards, also the ones rendered in the browser", async ({ page }) => {
  const problems = collectConsoleProblems(page);
  await gotoHydrated(page, "/");
  const catalog = localCatalogProducts(TEST_NOW).filter((product) => product.listable && !product.isGiftCard && !product.isGiftWrap);
  const tablist = page.getByRole("tablist", { name: home.productGrid.tabsLabel });
  await tablist.scrollIntoViewIfNeeded();

  for (const tab of home.productGrid.tabs) {
    const pieces = catalog.filter((product) => tab.id === "alles" || product.type === tab.id);
    if (pieces.length === 0) continue;
    await tablist.getByRole("tab", { name: tab.label }).click();
    const panel = page.getByRole("tabpanel", { name: tab.label });
    const list = panel.getByRole("list", { name: tab.label });
    const expected = Math.min(pieces.length, LAUNCH_TAB_MAX);
    await expect(list.getByRole("article")).toHaveCount(expected);
    // Every card is one of this tab's pieces.
    const names = await list.getByRole("article").getByRole("heading", { level: 3 }).allTextContents();
    for (const name of names) expect(pieces.map((product) => product.title), `${tab.label}: ${name}`).toContain(name.trim());
  }

  expect(problems, "console problems").toEqual([]);
});
