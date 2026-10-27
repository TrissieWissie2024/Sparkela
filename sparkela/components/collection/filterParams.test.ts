import { describe, expect, it } from "vitest";

import type { Facets } from "@/lib/types";
import { availableFacets } from "@/lib/catalog";
import { collections } from "@/content/collections";
import { localCatalogProducts } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import { COLLECTION_QUERY_ATTRIBUTE, COLLECTION_QUERY_SCRIPT, queryMarkScript } from "./collectionQueryScript";
import {
  activeFilterCount,
  applyFilterState,
  COLLECTION_QUERY_KEYS,
  DEFAULT_SORT,
  emptyFilters,
  parseFilterParams,
  stylingTilePlacement,
  toFilterParams,
  toggleFilter,
  visibleFacets,
} from "./filterParams";

/**
 * Filter and sort state in the URL of a collection page (docs/PLAN.md §14.3, §19.1, D3): parsing (comma separated,
 * unknown values ignored, restricted to the facets the page offers), writing (canonical order, commas, default sort
 * left out, other parameters kept), the facets a collection shows, the filtered and sorted list, the placement of the
 * styling tile (no ragged rows) and the inline deep-link script.
 */

const params = (query: string) => new URLSearchParams(query);

describe("parseFilterParams", () => {
  it("reads comma separated values in display order and the sort key", () => {
    const state = parseFilterParams(params("type=armbanden,oorbellen&vibe=retro&moment=festival&prijs=15-20&sort=prijs-oplopend"));
    expect(state).toEqual({
      filters: { types: ["oorbellen", "armbanden"], vibes: ["retro"], moments: ["festival"], price: ["15-20"] },
      sort: "prijs-oplopend",
    });
  });

  it("ignores unknown values, unknown sort keys, duplicates, blanks and case", () => {
    const state = parseFilterParams(params("type=OORBELLEN,,horloges,oorbellen&vibe=%20retro%20,goth&prijs=0-5&sort=duur"));
    expect(state.filters).toEqual({ types: ["oorbellen"], vibes: ["retro"], moments: [], price: [] });
    expect(state.sort).toBe(DEFAULT_SORT);
  });

  it("reads percent-encoded commas too", () => {
    expect(parseFilterParams(params("type=oorbellen%2Cringen")).filters.types).toEqual(["oorbellen", "ringen"]);
  });

  it("gives the default state without parameters (or without a reader)", () => {
    expect(parseFilterParams(params(""))).toEqual({ filters: emptyFilters(), sort: "uitgelicht" });
    expect(parseFilterParams(null)).toEqual({ filters: emptyFilters(), sort: "uitgelicht" });
  });

  it("keeps only the values the page offers", () => {
    const allowed: Facets = { types: [], vibes: ["retro", "chunky-en-bold"], moments: ["festival"], price: ["tot-15", "15-20"] };
    const state = parseFilterParams(params("type=ringen&vibe=retro,clean-en-classy&moment=strand&prijs=15-20"), allowed);
    expect(state.filters).toEqual({ types: [], vibes: ["retro"], moments: [], price: ["15-20"] });
  });
});

describe("toFilterParams", () => {
  it("writes facets comma separated in display order, without encoding the commas", () => {
    const query = toFilterParams({
      filters: { types: ["armbanden", "oorbellen"], vibes: ["retro"], moments: ["festival"], price: ["15-20"] },
      sort: "prijs-oplopend",
    });
    expect(query).toBe("type=oorbellen,armbanden&vibe=retro&moment=festival&prijs=15-20&sort=prijs-oplopend");
  });

  it("leaves out empty facets and the default sort", () => {
    expect(toFilterParams({ filters: emptyFilters(), sort: "uitgelicht" })).toBe("");
    expect(toFilterParams({ filters: { ...emptyFilters(), price: ["vanaf-25"] }, sort: "uitgelicht" })).toBe("prijs=vanaf-25");
    expect(toFilterParams({ filters: emptyFilters(), sort: "nieuwste" })).toBe("sort=nieuwste");
  });

  it("keeps other parameters and replaces its own", () => {
    const query = toFilterParams(
      { filters: { ...emptyFilters(), vibes: ["retro"] }, sort: "uitgelicht" },
      "utm_source=tiktok&vibe=chunky-en-bold&sort=nieuwste",
    );
    expect(query).toBe("utm_source=tiktok&vibe=retro");
  });

  it("round-trips through parseFilterParams", () => {
    const state = {
      filters: { types: ["kettingen" as const], vibes: ["kleurrijk-en-speels" as const], moments: ["strand" as const], price: ["tot-15" as const] },
      sort: "prijs-aflopend" as const,
    };
    expect(parseFilterParams(params(toFilterParams(state)))).toEqual(state);
  });
});

describe("filter helpers", () => {
  it("toggles a value on and off in display order and counts the active values", () => {
    const one = toggleFilter(emptyFilters(), "moments", "strand");
    const two = toggleFilter(one, "moments", "festival");
    expect(two.moments).toEqual(["festival", "strand"]);
    expect(activeFilterCount(two)).toBe(2);
    expect(toggleFilter(two, "moments", "strand").moments).toEqual(["festival"]);
  });

  it("hides the facet a collection already fixes and every facet with fewer than two values", () => {
    const facets: Facets = {
      types: ["oorbellen"],
      vibes: ["chunky-en-bold", "retro"],
      moments: ["festival", "strand"],
      price: ["15-20", "20-25"],
    };
    expect(visibleFacets(facets, { kind: "type", type: "oorbellen" })).toEqual({ ...facets, types: [] });
    expect(visibleFacets(facets, { kind: "vibe", vibe: "retro" })).toEqual({ ...facets, types: [], vibes: [] });
    expect(visibleFacets(facets, { kind: "moment", moment: "strand" })).toEqual({ ...facets, types: [], moments: [] });
    expect(visibleFacets({ ...facets, types: ["oorbellen", "ringen"] }, { kind: "all" }).types).toEqual(["oorbellen", "ringen"]);
  });

  it("filters and sorts the local catalog like the page does", () => {
    const products = localCatalogProducts(TEST_NOW).filter((product) => product.listable);
    const state = parseFilterParams(params("type=oorbellen&vibe=chunky-en-bold&sort=prijs-oplopend"));
    const handles = applyFilterState(products, state).map((product) => product.handle);
    expect(handles[0]).toBe("noor-dikke-ringetjes");
    expect(handles).toContain("lola-chunky-hoops");
    expect(handles).not.toContain("tess-schakelarmband");
    const prices = applyFilterState(products, state).map((product) => product.priceRange.min.cents);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it("offers type filters on alle but not on oorbellen", () => {
    const products = localCatalogProducts(TEST_NOW).filter((product) => product.listable);
    const alle = collections.find((collection) => collection.handle === "alle");
    const oorbellen = collections.find((collection) => collection.handle === "oorbellen");
    if (!alle || !oorbellen) throw new Error("collections missing");
    expect(visibleFacets(availableFacets(products), alle.rule).types).toEqual(["oorbellen", "armbanden", "kettingen", "ringen"]);
    const earrings = products.filter((product) => product.type === "oorbellen");
    expect(visibleFacets(availableFacets(earrings), oorbellen.rule).types).toEqual([]);
  });
});

describe("stylingTilePlacement", () => {
  /** Cells in the last row of a grid with `count` products plus the tile, per column count. */
  function lastRowFull(count: number, spans: [number, number, number]): boolean {
    return [2, 3, 4].every((columns, i) => (count + (spans[i] ?? 0)) % columns === 0);
  }

  it("fills the gap of the last row, or takes a whole row, in 2, 3 and 4 columns", () => {
    for (let count = 1; count <= 30; count += 1) {
      const { spans } = stylingTilePlacement(count, 12);
      expect(lastRowFull(count, spans), `count ${count}`).toBe(true);
    }
    expect(stylingTilePlacement(11, 12).spans).toEqual([1, 1, 1]);
    expect(stylingTilePlacement(24, 12).spans).toEqual([2, 3, 4]);
    expect(stylingTilePlacement(6, 12).className).toBe("col-span-2 md:col-span-3 xl:col-span-2");
  });

  it("snaps the index to a row start in every column count, or to the end of a shorter grid", () => {
    expect(stylingTilePlacement(24, 12).index).toBe(12);
    expect(stylingTilePlacement(24, 17).index).toBe(12);
    expect(stylingTilePlacement(9, 12).index).toBe(9);
    expect(stylingTilePlacement(30, 5).index).toBe(0);
  });
});

describe("collectionQueryScript", () => {
  it("looks for every collection parameter and marks the parent", () => {
    for (const key of COLLECTION_QUERY_KEYS) expect(COLLECTION_QUERY_SCRIPT).toContain(`"${key}"`);
    expect(COLLECTION_QUERY_SCRIPT).toContain(`"${COLLECTION_QUERY_ATTRIBUTE}"`);
  });

  it("sets the attribute only for a non-empty listed parameter", () => {
    const run = (search: string) => {
      const attributes: Record<string, string> = {};
      const parent = { setAttribute: (name: string, value: string) => (attributes[name] = value) };
      const fn = new Function("location", "document", queryMarkScript("data-x", ["type", "q"]));
      fn({ search }, { currentScript: { parentElement: parent } });
      return "data-x" in attributes;
    };
    expect(run("?type=oorbellen")).toBe(true);
    expect(run("?q=lola")).toBe(true);
    expect(run("?q=%20")).toBe(false);
    expect(run("?utm_source=x")).toBe(false);
    expect(run("")).toBe(false);
  });
});
