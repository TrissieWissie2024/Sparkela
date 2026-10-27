import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The consent banner (docs/PLAN.md §19.1, decision 121; brief §2.10): with site.analytics.enabled mocked on, the banner
 * renders with "Akkoord" and "Weigeren" of the same style; with it off, nothing. This replaces a separate build with
 * analytics on. getServerConsent is mocked to "no choice yet" (null), so the server render shows the banner as the
 * browser does after hydration for a first visit (the real server snapshot is "unknown", which never flashes it).
 */

const flags = vi.hoisted(() => ({ enabled: true, gtmId: "GTM-TEST123" as string | null }));

vi.mock("@/content/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/content/site")>();
  return {
    site: {
      ...actual.site,
      analytics: {
        get enabled() {
          return flags.enabled;
        },
        get gtmId() {
          return flags.gtmId;
        },
      },
    },
  };
});

vi.mock("@/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...actual, getServerConsent: () => null };
});

import { chromeCopy } from "@/content/copy/chrome";
import { AnalyticsLoader } from "@/components/consent/AnalyticsLoader";
import { ConsentBanner } from "@/components/consent/ConsentBanner";

afterEach(() => {
  flags.enabled = true;
  flags.gtmId = "GTM-TEST123";
});

describe("ConsentBanner", () => {
  it("renders the banner with 'Akkoord' and 'Weigeren' when analytics is on and nothing was chosen", () => {
    const html = renderToStaticMarkup(<ConsentBanner />);
    expect(html).toContain(`>${chromeCopy.consent.accept}<`);
    expect(html).toContain(`>${chromeCopy.consent.reject}<`);
    expect(html).toContain(chromeCopy.consent.title);
    expect(html).toContain('href="/cookies"');
    // A labelled, non-modal card above the page content, below the drawers (z-50), hidden in print.
    expect(html).toMatch(/<section aria-labelledby="[^"]+" aria-describedby="[^"]+"/);
    expect(html).toContain("z-50");
    expect(html).toContain("print:hidden");
    expect(html).not.toContain('aria-modal="true"');
  });

  it("gives both choices the same button style and size", () => {
    const html = renderToStaticMarkup(<ConsentBanner />);
    const buttons = [...html.matchAll(/<button[^>]*class="([^"]+)"[^>]*>(Akkoord|Weigeren)<\/button>/g)];
    expect(buttons).toHaveLength(2);
    expect(buttons[0][1]).toBe(buttons[1][1]);
    expect(buttons[0][1]).not.toContain("bg-primair");
  });

  it("renders nothing when analytics is off", () => {
    flags.enabled = false;
    expect(renderToStaticMarkup(<ConsentBanner />)).toBe("");
  });
});

describe("AnalyticsLoader", () => {
  it("never puts the tag manager in the server HTML (no consent before hydration)", () => {
    expect(renderToStaticMarkup(<AnalyticsLoader />)).toBe("");
    flags.enabled = false;
    expect(renderToStaticMarkup(<AnalyticsLoader />)).toBe("");
  });
});
