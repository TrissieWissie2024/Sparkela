import { describe, expect, it } from "vitest";

import { brandColor } from "@/lib/brand-colors";
import { absoluteUrl, NOINDEX_PATHS } from "@/lib/seo";
import manifest from "@/app/manifest";
import robots from "@/app/robots";

/**
 * app/robots.ts and app/manifest.ts (docs/PLAN.md §18.1, §2.4, §19.1). robots.txt allows everything except /api/ and
 * names the sitemap; a noindex page is never disallowed, or crawlers would never see its noindex (D53.4). The manifest
 * names Sparkela in the brand colours with the monogram icons.
 */

describe("robots", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

  it("allows everything for every crawler except the API routes", () => {
    expect(rules).toHaveLength(1);
    expect(rules[0].userAgent).toBe("*");
    expect(rules[0].allow).toBe("/");
    expect(rules[0].disallow).toEqual(["/api/"]);
  });

  it("never disallows a noindex page", () => {
    const disallowed = [rules[0].disallow ?? []].flat();
    for (const path of [...NOINDEX_PATHS, "/nieuwsbrief/bevestigen", "/wachtlijst"]) {
      expect(disallowed.some((prefix) => path.startsWith(prefix))).toBe(false);
    }
  });

  it("points to the absolute sitemap URL", () => {
    expect(result.sitemap).toBe(absoluteUrl("/sitemap.xml"));
    expect(String(result.sitemap)).toMatch(/^https?:\/\/[^/]+\/sitemap\.xml$/);
  });
});

describe("manifest", () => {
  const result = manifest();

  it("names Sparkela in Dutch with the brand colours", () => {
    expect(result.short_name).toBe("Sparkela");
    expect(result.name).toMatch(/^Sparkela/);
    expect(result.lang).toBe("nl");
    expect(result.start_url).toBe("/");
    expect(result.theme_color).toBe(brandColor("donker"));
    expect(result.background_color).toBe(brandColor("pagina"));
  });

  it("has the SVG icon, PNG icons of 192 and 512 px and a maskable icon", () => {
    const icons = result.icons ?? [];
    expect(icons.some((icon) => icon.src === "/icon.svg" && icon.type === "image/svg+xml")).toBe(true);
    expect(icons.some((icon) => icon.sizes === "192x192")).toBe(true);
    expect(icons.some((icon) => icon.sizes === "512x512" && icon.purpose === undefined)).toBe(true);
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });
});
