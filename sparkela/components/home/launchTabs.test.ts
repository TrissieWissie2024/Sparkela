import { describe, expect, it } from "vitest";

import { assets } from "@/content/assets";
import { home } from "@/content/home";
import { localCatalogProducts } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import { fillTileClassName, LAUNCH_TAB_MAX, launchTabs, poolHandles, sortedTabHandles, tabHandles } from "./launchTabs";

/** The tabs of "De lanceringscollectie" and the cell of the styling tile (docs/PLAN.md §14.1 section 5). */

const catalog = localCatalogProducts(TEST_NOW);
const listable = catalog.filter((product) => product.listable);

describe("launchTabs", () => {
  it("gives Alles and every type at most eight products in 'uitgelicht' order, sold out last", () => {
    const tabs = launchTabs(listable, home.productGrid);
    expect(tabs.map((tab) => tab.id)).toEqual(["alles", "oorbellen", "armbanden", "kettingen", "ringen"]);
    for (const tab of tabs) expect(tab.handles.length).toBeLessThanOrEqual(LAUNCH_TAB_MAX);
    expect(tabs[0]?.handles).toHaveLength(LAUNCH_TAB_MAX);
    const bracelets = tabs.find((tab) => tab.id === "armbanden");
    expect(bracelets?.handles.at(-1)).toBe("isa-dubbele-schakel");
    expect(bracelets?.viewAll).toEqual({ label: "Bekijk alle armbanden", href: "/collections/armbanden" });
    expect(tabs[0]?.viewAll).toEqual({ label: home.productGrid.viewAll, href: "/collections/alle" });
    expect(new Set(tabHandles(tabs)).size).toBe(tabHandles(tabs).length);
  });

  it("sorts by price over the whole tab, not only the eight featured pieces (QA round 1)", () => {
    const tabs = launchTabs(listable, home.productGrid);
    const alles = tabs[0];
    const cheapest = Math.min(...listable.filter((product) => !product.isGiftCard).map((product) => product.priceRange.min.cents));
    const byPrice = sortedTabHandles(alles, listable, "prijs-oplopend");
    expect(byPrice).toHaveLength(alles.handles.length);
    const first = listable.find((product) => product.handle === byPrice[0]);
    expect(first?.priceRange.min.cents).toBe(cheapest);
    // "uitgelicht" keeps the server's eight as they are.
    expect(sortedTabHandles(alles, listable, "uitgelicht")).toEqual(alles.handles);
    // Every pool handle is in poolHandles, once.
    expect(poolHandles(tabs).length).toBe(new Set(poolHandles(tabs)).size);
    expect(poolHandles(tabs)).toEqual(expect.arrayContaining(byPrice));
  });

  it("fills short tabs with a styling tile whose photo slot exists", () => {
    expect(assets.images[home.productGrid.tile.image]).toBeDefined();
  });

  it("leaves out the gift card, the gift wrap and types without products", () => {
    const tabs = launchTabs(
      catalog.filter((product) => product.type !== "ringen"),
      home.productGrid,
    );
    expect(tabs.map((tab) => tab.id)).not.toContain("ringen");
    expect(tabHandles(tabs)).not.toContain("cadeaukaart");
    expect(tabHandles(tabs)).not.toContain("cadeauverpakking");
    expect(launchTabs([], home.productGrid)).toEqual([]);
  });
});

describe("fillTileClassName", () => {
  it("fills exactly the cells the last row leaves open, at 2 and at 4 columns", () => {
    expect(fillTileClassName(8)).toBeNull();
    expect(fillTileClassName(4)).toBeNull();
    expect(fillTileClassName(0)).toBeNull();
    for (let count = 1; count <= 8; count += 1) {
      const classes = fillTileClassName(count);
      if (classes === null) continue;
      const mobileSpan = classes.includes("col-span-1") && !classes.startsWith("hidden") ? 1 : 0;
      expect((count + mobileSpan) % 2, `phones, ${count}`).toBe(0);
      const desktop = /lg:col-span-(\d)/.exec(classes);
      const desktopSpan = classes.includes("lg:hidden") ? 0 : Number(desktop?.[1] ?? 0);
      expect((count + desktopSpan) % 4, `desktop, ${count}`).toBe(0);
    }
  });
});
