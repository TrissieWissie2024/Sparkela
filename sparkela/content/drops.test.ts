import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { DropSlug } from "@/lib/types";
import { assets } from "@/content/assets";
import { drops, EARLY_ACCESS_HOURS, isDropSlug } from "@/content/drops";
import { products } from "@/content/products";
import { site } from "@/content/site";
import { stacks } from "@/content/stacks";

/**
 * content/drops.ts against brief §4 and plan §12.1, §9.5: unique slugs equal to DropSlug, literal times with the
 * right Amsterdam offset, startsAt < endsAt, no clock in the source, and productHandles equal to the products tagged
 * drop:<slug> in content/products.ts.
 */

/** Every DropSlug of lib/types.ts, in calendar order (plan §6.2). */
const DROP_SLUGS: DropSlug[] = [
  "holiday-sparkle",
  "love-club",
  "oranje-spark",
  "like-mother-like-daughter",
  "summer-spark",
  "main-character",
  "vamp",
  "spark-friday",
];

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
const CLOCK_CALL = /\bDate\s*\.\s*now\s*\(|\bnew\s+Date\s*\(/;
const HOUR_MS = 60 * 60 * 1000;
const source = readFileSync(fileURLToPath(new URL("./drops.ts", import.meta.url)), "utf8");

function amsterdamWallClock(ms: number): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(ms)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

const tagged = (slug: DropSlug) =>
  products.filter((product) => product.tags.includes(`drop:${slug}`)).map((product) => product.handle);

describe("drops (plan §12.1)", () => {
  it("has the eight drops of the brief, in calendar order, with unique slugs", () => {
    expect(drops.map((drop) => drop.slug)).toEqual(DROP_SLUGS);
    expect(new Set(drops.map((drop) => drop.slug)).size).toBe(drops.length);
  });

  it("has the start and end times of the plan table", () => {
    expect(drops.map((drop) => [drop.slug, drop.startsAt, drop.endsAt])).toEqual([
      ["holiday-sparkle", "2026-11-27T00:00:00+01:00", "2027-01-01T00:00:00+01:00"],
      ["love-club", "2027-02-05T19:00:00+01:00", "2027-03-01T00:00:00+01:00"],
      ["oranje-spark", "2027-04-09T19:00:00+02:00", "2027-05-01T00:00:00+02:00"],
      ["like-mother-like-daughter", "2027-05-01T19:00:00+02:00", "2027-05-10T00:00:00+02:00"],
      ["summer-spark", "2027-06-04T19:00:00+02:00", "2027-09-01T00:00:00+02:00"],
      ["main-character", "2027-09-03T19:00:00+02:00", "2027-10-01T00:00:00+02:00"],
      ["vamp", "2027-10-01T19:00:00+02:00", "2027-11-01T00:00:00+01:00"],
      ["spark-friday", "2027-11-26T00:00:00+01:00", "2027-11-30T00:00:00+01:00"],
    ]);
  });

  it("starts every drop publicly in the month brief §4 gives it (decision 184)", () => {
    const briefMonth: Record<string, string> = {
      "holiday-sparkle": "11",
      "love-club": "02",
      "oranje-spark": "04",
      "like-mother-like-daughter": "05",
      "summer-spark": "06",
      "main-character": "09",
      vamp: "10",
      "spark-friday": "11",
    };
    for (const drop of drops) {
      expect(amsterdamWallClock(Date.parse(drop.startsAt)).slice(5, 7), drop.slug).toBe(briefMonth[drop.slug]);
    }
  });

  it("writes every time as a literal with the real Amsterdam offset, and ends after it starts", () => {
    for (const drop of drops) {
      for (const value of [drop.startsAt, drop.endsAt]) {
        expect(value, drop.slug).toMatch(ISO_WITH_OFFSET);
        expect(source.includes(`"${value}"`), `${drop.slug}: ${value} is not a literal`).toBe(true);
        expect(amsterdamWallClock(Date.parse(value)), `${drop.slug}: wrong offset in ${value}`).toBe(value.slice(0, 19));
      }
      expect(Date.parse(drop.startsAt), drop.slug).toBeLessThan(Date.parse(drop.endsAt));
    }
  });

  it("starts Holiday Sparkle at the launch, with early access 24 hours before", () => {
    expect(EARLY_ACCESS_HOURS).toBe(24);
    const holiday = drops[0];
    expect(holiday.startsAt).toBe(site.launchAt);
    expect(Date.parse(holiday.startsAt) - EARLY_ACCESS_HOURS * HOUR_MS).toBe(Date.parse("2026-11-26T00:00:00+01:00"));
  });

  it("never reads the clock in content/drops.ts", () => {
    expect(source).not.toMatch(CLOCK_CALL);
  });

  it("fills every text, the banner, the teaser, the SEO fields and an image that exists", () => {
    for (const drop of drops) {
      const texts = [drop.name, drop.tagline, drop.description, drop.banner.title, drop.banner.text, drop.banner.cta, drop.teaser.title, drop.teaser.text, drop.seo.title, drop.seo.description];
      for (const text of texts) expect(text.trim(), drop.slug).not.toBe("");
      expect(drop.image).toBe(`drops.${drop.slug}`);
      expect(assets.images[drop.image], drop.image).toBeDefined();
      expect(drop.teaser.text).toContain(`${EARLY_ACCESS_HOURS} uur`);
    }
  });

  it("narrows route params with isDropSlug", () => {
    for (const slug of DROP_SLUGS) expect(isDropSlug(slug)).toBe(true);
    for (const value of ["", "holiday", "Holiday-Sparkle", "binnenkort", "__geen-producten__"]) expect(isDropSlug(value)).toBe(false);
  });
});

describe("drop products (plan §12.1, §21.3)", () => {
  it("lists exactly the products tagged drop:<slug>, in catalog order", () => {
    for (const drop of drops) expect(drop.productHandles, drop.slug).toEqual(tagged(drop.slug));
  });

  it("gives Holiday Sparkle the four pieces 21 to 24 and the later drops none yet", () => {
    expect(drops[0].productHandles).toEqual([
      "holiday-ster-oorbellen",
      "holiday-glitter-hoops",
      "holiday-sparkle-armband",
      "holiday-ster-ketting",
    ]);
    for (const drop of drops.slice(1)) expect(drop.productHandles, drop.slug).toEqual([]);
  });

  it("only tags existing drops", () => {
    const unknown = products.flatMap((product) =>
      product.tags.filter((tag) => tag.startsWith("drop:") && !isDropSlug(tag.slice("drop:".length))).map((tag) => `${product.handle} ${tag}`),
    );
    expect(unknown).toEqual([]);
  });

  it("links the Holiday stack to its drop, and keeps drop pieces out of the other stacks", () => {
    for (const stack of stacks) {
      const dropSlugs = new Set(
        stack.productHandles.flatMap((handle) =>
          (products.find((product) => product.handle === handle)?.tags ?? [])
            .filter((tag) => tag.startsWith("drop:"))
            .map((tag) => tag.slice("drop:".length)),
        ),
      );
      if (stack.dropSlug) expect([...dropSlugs], stack.slug).toEqual([stack.dropSlug]);
      else expect([...dropSlugs], stack.slug).toEqual([]);
    }
  });
});
