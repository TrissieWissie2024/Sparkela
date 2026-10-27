import { describe, expect, it } from "vitest";
import type { JewelryType, Moment, NavGroup, NavItem, NavLink, Vibe } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";
import { collections } from "@/content/collections";
import { home } from "@/content/home";
import { footerNav, legalNav, mainNav, mobileNav } from "@/content/navigation";
import { products } from "@/content/products";
import { quiz } from "@/content/quiz";

/**
 * content/quiz.ts (plan §5.7) and the one vocabulary (decision 125): the quiz, the navigation, the collection titles
 * and the home tabs use exactly the words of sharedCopy.vocab for type, vibe and moment.
 */

const { vocab } = sharedCopy;
const TYPES = Object.keys(vocab.type) as JewelryType[];
const VIBES = Object.keys(vocab.vibe) as Vibe[];
const MOMENTS = Object.keys(vocab.moment) as Moment[];

describe("Spark Finder config (plan §5.7)", () => {
  it("asks vibe, moment and type, in that order", () => {
    expect(quiz.questions.map((question) => question.id)).toEqual(["vibe", "moment", "type"]);
    expect(quiz.intro.title).toBe("Spark Finder");
    expect(quiz.intro.text.trim()).not.toBe("");
  });

  it("offers every vibe, every moment and every type plus Verras me", () => {
    const [vibe, moment, type] = quiz.questions;
    expect(vibe.options.map((option) => option.value)).toEqual(VIBES);
    expect(moment.options.map((option) => option.value)).toEqual(MOMENTS);
    expect(type.options.map((option) => option.value)).toEqual([...TYPES, "verras-me"]);
  });

  it("labels the options with the shared vocabulary", () => {
    const [vibe, moment, type] = quiz.questions;
    for (const option of vibe.options) expect(option.label).toBe(vocab.vibe[option.value as Vibe]);
    for (const option of moment.options) expect(option.label).toBe(vocab.moment[option.value as Moment]);
    for (const option of type.options.filter((o) => o.value !== "verras-me")) {
      expect(option.label).toBe(vocab.type[option.value as JewelryType]);
    }
    expect(type.options.find((option) => option.value === "verras-me")?.label).toBe("Verras me");
  });

  it("scores vibe 3, moment 2 and Linde's favourite 1, with 3 to 6 results", () => {
    expect(quiz.scoring).toEqual({ vibe: 3, moment: 2, lindesFavoriet: 1, minResults: 3, maxResults: 6 });
  });

  it("has the result copy", () => {
    expect(quiz.result.title).toBe("Jouw sparks");
    expect(quiz.result.restart).toBe("Opnieuw beginnen");
    expect(quiz.result.skip).toBe("Liever zonder e-mail verder");
  });

  it("can always top up to the minimum with Linde's favourites", () => {
    const favourites = products.filter((product) => product.metafields.lindesFavoriet === true);
    expect(favourites.length).toBeGreaterThanOrEqual(quiz.scoring.minResults);
  });

  it("finds at least one piece for every vibe and every moment", () => {
    for (const vibe of VIBES) expect(products.some((p) => p.tags.includes(`vibe:${vibe}`)), vibe).toBe(true);
    for (const moment of MOMENTS) expect(products.some((p) => p.tags.includes(`moment:${moment}`)), moment).toBe(true);
  });
});

describe("one vocabulary (decision 125)", () => {
  const collectionPath = /^\/collections\/([a-z0-9-]+)$/;

  /** Every link in the navigation, with where it sits. */
  function navLinks(): Array<{ where: string; link: NavLink }> {
    const out: Array<{ where: string; link: NavLink }> = [];
    const fromGroup = (where: string, group: NavGroup) => {
      group.links.forEach((link, i) => out.push({ where: `${where}.links[${i}]`, link }));
      if (group.extra) out.push({ where: `${where}.extra`, link: group.extra });
    };
    mainNav.forEach((item: NavItem, i) => {
      if (item.kind === "link") out.push({ where: `mainNav[${i}]`, link: item });
      else fromGroup(`mainNav[${i}]`, item);
    });
    mobileNav.primary.forEach((link, i) => out.push({ where: `mobileNav.primary[${i}]`, link }));
    mobileNav.groups.forEach((group, i) => fromGroup(`mobileNav.groups[${i}]`, group));
    mobileNav.service.forEach((link, i) => out.push({ where: `mobileNav.service[${i}]`, link }));
    footerNav.forEach((column, c) => column.links.forEach((link, i) => out.push({ where: `footerNav[${c}].links[${i}]`, link })));
    legalNav.forEach((link, i) => out.push({ where: `legalNav[${i}]`, link }));
    return out;
  }

  it("labels every type and moment link in the navigation with the vocabulary", () => {
    const wrong: string[] = [];
    for (const { where, link } of navLinks()) {
      const handle = collectionPath.exec(link.href)?.[1];
      if (!handle) continue;
      const expected = vocab.type[handle as JewelryType] ?? vocab.moment[handle as Moment];
      if (expected !== undefined && link.label !== expected) wrong.push(`${where}: "${link.label}" should be "${expected}"`);
    }
    expect(wrong).toEqual([]);
  });

  it("links the navigation only to collections that exist", () => {
    const handles = new Set(collections.map((collection) => collection.handle));
    const broken = navLinks()
      .map(({ where, link }) => ({ where, handle: collectionPath.exec(link.href)?.[1] }))
      .filter(({ handle }) => handle !== undefined && !handles.has(handle))
      .map(({ where, handle }) => `${where}: ${handle}`);
    expect(broken).toEqual([]);
  });

  it("names the type and moment collections with the vocabulary", () => {
    for (const collection of collections) {
      if (collection.rule.kind === "type") expect(collection.title).toBe(vocab.type[collection.rule.type]);
      if (collection.rule.kind === "moment") expect(collection.title).toBe(vocab.moment[collection.rule.moment]);
    }
  });

  it("labels the home tabs and moment tiles with the vocabulary", () => {
    for (const tab of home.productGrid.tabs) {
      if (tab.id !== "alles") expect(tab.label).toBe(vocab.type[tab.id]);
    }
    expect(home.moments.tiles.map((tile) => tile.moment)).toEqual(MOMENTS);
    for (const tile of home.moments.tiles) expect(tile.label).toBe(vocab.moment[tile.moment]);
  });

  it("has the desktop nav of plan §2.5 in order", () => {
    expect(mainNav.map((item) => item.label)).toEqual([
      "Nieuw",
      "Oorbellen",
      "Armbanden",
      "Kettingen",
      "Ringen",
      "Shop per moment",
      "Limited",
      "Cadeaus",
    ]);
    expect(footerNav.map((column) => column.title)).toEqual(["Shop", "Klantenservice", "Sparkela", "Juridisch"]);
  });
});
