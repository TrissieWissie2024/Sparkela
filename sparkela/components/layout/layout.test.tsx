import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The shop chrome of wave 4-6 (docs/PLAN.md §2.5, §12.3, §13.5; brief §2.10, §6 blocks 1, 2 and 16): announcement bar,
 * header, desktop nav, mobile menu card, footer, payment badges, ship label and the ShopChrome tree. Static markup only;
 * the async wrappers (ShopChrome, Header, AnnouncementBar) are awaited with lib/shop-data and the server clock mocked
 * (decision 139), their synchronous views are rendered.
 */

const clock = vi.hoisted(() => ({ now: Date.parse("2026-11-27T12:00:00+01:00") }));

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/server-clock", () => ({ getServerNow: async () => clock.now }));
vi.mock("@/lib/commerce", () => ({ resolveProviderName: () => "local" }));
vi.mock("@/lib/shop-data", () => ({
  getFeaturedDrop: vi.fn(async () => null),
  getVisibleStacks: vi.fn(async () => []),
  getCatalogProducts: vi.fn(async () => []),
}));

import { buildShipSchedule, promoSchedule } from "@/lib/dates";
import { getCatalogProducts, getFeaturedDrop, getVisibleStacks } from "@/lib/shop-data";
import type { CatalogProduct, Drop, Stack } from "@/lib/types";
import { chromeCopy } from "@/content/copy/chrome";
import { sharedCopy } from "@/content/copy/shared";
import { drops } from "@/content/drops";
import { footerNav, mainNav } from "@/content/navigation";
import { site } from "@/content/site";
import { stacks } from "@/content/stacks";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawerLoader } from "@/components/cart/CartDrawerLoader";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { EmailCaptureLoader } from "@/components/email/EmailCaptureLoader";
import { ReviewsCarousel } from "@/components/home/ReviewsCarousel";
import { AnnouncementBar, AnnouncementBarView, PROMO_SCHEDULE_DAYS } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { Header, HeaderView, mobileNavFeature } from "@/components/layout/Header";
import { isCurrentPage, momentImages } from "@/components/layout/header/nav";
import { MobileNavFeatureCard } from "@/components/layout/MobileNavSheet";
import { PaymentBadges } from "@/components/layout/PaymentBadges";
import { ShipLabel, shipLabelFallback } from "@/components/layout/ShipLabel";
import { ShopChrome } from "@/components/layout/ShopChrome";
import { UspBar } from "@/components/layout/UspBar";
import { ClockProvider } from "@/components/time/ClockProvider";
import { jet, lola, pieceList, tess } from "@/tests/fixtures/catalog";

const TEST_NOW = Date.parse("2026-11-27T12:00:00+01:00");
const PRELAUNCH = Date.parse("2026-11-20T12:00:00+01:00");

afterEach(() => {
  clock.now = TEST_NOW;
  vi.mocked(getFeaturedDrop).mockResolvedValue(null);
  vi.mocked(getVisibleStacks).mockResolvedValue([]);
});

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

/** The TimeSwitch variant wrappers of a fragment, in order. */
function variantsOf(html: string): Array<{ hidden: boolean; inner: string }> {
  const out: Array<{ hidden: boolean; inner: string }> = [];
  const pattern = /<(div|span) data-ts="[^"]+-\d+"( hidden="")?>([\s\S]*?)<\/\1>(?=<(?:div|span) data-ts=|<script)/g;
  for (const match of html.matchAll(pattern)) out.push({ hidden: match[2] !== undefined, inner: match[3] });
  return out;
}

function withProviders(children: ReactNode, now = TEST_NOW, products: CatalogProduct[] = pieceList): string {
  return renderToStaticMarkup(
    <ClockProvider serverNow={now}>
      <CatalogProvider products={products}>
        <CartProvider provider="local">{children}</CartProvider>
      </CatalogProvider>
    </ClockProvider>,
  );
}

const holiday = drops.find((drop) => drop.slug === "holiday-sparkle") as Drop;

describe("AnnouncementBar (plan §12.3)", () => {
  it("on the test day: the launch gift with its countdown, then 'Nu live: Holiday Sparkle', then the USPs", async () => {
    const html = renderToStaticMarkup(<ClockProvider serverNow={TEST_NOW}>{await AnnouncementBar()}</ClockProvider>);
    expect(html).toMatch(/<section aria-label="Aankondigingen" data-vlak="donker"/);
    expect(html).toContain("min-h-promo");
    expect(html).toContain("bg-donker");
    expect(html).toContain("print:hidden");

    const variants = variantsOf(html);
    expect(variants).toHaveLength(promoSchedule(TEST_NOW, PROMO_SCHEDULE_DAYS).length);
    expect(variants[0].hidden).toBe(false);
    expect(variants[0].inner).toContain(escape("We zijn live. Bij elke bestelling met sieraden zit een cadeautje van ons."));
    expect(variants[0].inner).toContain("t/m 30 november");
    expect(variants[0].inner).toContain("Eindigt op maandag 30 november om middernacht");
    expect(variants[0].inner).toContain('href="/collections/nieuw"');
    expect(variants[1].hidden).toBe(true);
    expect(variants[1].inner).toContain(chromeCopy.promo.dropLive("Holiday Sparkle"));
    expect(variants[1].inner).toContain('href="/drops/holiday-sparkle"');
    expect(variants[variants.length - 1].inner).toContain(escape(site.usps[0]));
  });

  it("a week before the launch: 'Nieuwe drop' with a countdown to the start and the start labels (decision 135)", () => {
    const html = renderToStaticMarkup(
      <ClockProvider serverNow={PRELAUNCH}>
        <AnnouncementBarView entries={promoSchedule(PRELAUNCH, PROMO_SCHEDULE_DAYS)} />
      </ClockProvider>,
    );
    const first = variantsOf(html)[0];
    expect(first.hidden).toBe(false);
    expect(first.inner).toContain(chromeCopy.promo.dropUpcoming("Holiday Sparkle"));
    expect(first.inner).toContain("vrijdag 27 november om 00.00 uur");
    expect(first.inner).toContain("Begint op vrijdag 27 november om 00.00 uur");
    expect(first.inner).not.toContain("t/m");
    expect(first.inner).toContain('href="/sparkela-club"');
    expect(first.inner).toContain(chromeCopy.promo.earlyAccessLink);
  });
});

describe("UspBar (decision 59)", () => {
  it("lists every USP for screen readers, shows the first and has a pause button with a fixed label", () => {
    const html = renderToStaticMarkup(<UspBar usps={site.usps} />);
    for (const usp of site.usps) expect(html).toContain(escape(usp));
    expect(html).toContain(`aria-label="${chromeCopy.promo.uspListLabel}"`);
    expect(html).toContain(`aria-label="${chromeCopy.promo.pauseUsps}" aria-pressed="false"`);
    // The rotating line is hidden from screen readers; the desktop row shows all three from lg.
    expect(html).toMatch(/<p aria-hidden="true"[^>]*>.*Gratis verzending vanaf/);
    expect(html).toContain("lg:flex");
  });
});

describe("Header (plan §2.5, §13.5)", () => {
  it("is sticky, z-30, a fixed height, and has menu, search, logo, account and 'Tas'", async () => {
    const html = withProviders(await Header());
    expect(html).toMatch(/<header data-site-header="" class="[^"]*sticky top-0 z-30 h-header/);
    expect(html).toContain("print:hidden");
    expect(html).toContain(`aria-label="${chromeCopy.header.home}"`);
    expect(html).toContain('href="/"');
    expect(html).toContain('role="img" aria-label="Sparkela"');
    expect(html).toContain(`aria-label="${chromeCopy.header.openMenu}" aria-haspopup="dialog" aria-expanded="false"`);
    expect(html.match(new RegExp(`aria-label="${sharedCopy.ui.search}"`, "g"))).toHaveLength(2);
    expect(html).toContain('href="/account"');
    expect(html).toContain(`aria-label="${chromeCopy.header.cartLabel(0)}"`);
    expect(html).toMatch(/>Tas <span aria-hidden="true"/);
    // The account icon goes below 380 px, the second search button below xl, the mobile cluster from xl.
    expect(html).toContain("max-xs:hidden");
    expect(html).toContain("max-xl:hidden");
  });

  it("has the desktop nav in the order of plan §2.5 with two disclosure groups", () => {
    const html = withProviders(<HeaderView feature={null} />);
    expect(html).toContain(`<nav aria-label="${chromeCopy.header.mainNavLabel}"`);
    let position = -1;
    for (const item of mainNav) {
      const at = html.indexOf(`>${item.label}<`, position + 1);
      expect(at, item.label).toBeGreaterThan(position);
      position = at;
    }
    const disclosures = [...html.matchAll(/<button type="button" aria-expanded="false" aria-controls="([^"]+)"/g)];
    expect(disclosures).toHaveLength(2);
    for (const [, panelId] of disclosures) expect(html).toMatch(new RegExp(`<div id="${panelId}" hidden=""`));
    // Every moment link in the panel has its explanation and a small photo slot; "Liever subtiel?" sits under it.
    expect(html).toContain("/collections/festival");
    expect(html).toContain("FOTO: Festival");
    expect(html).toContain("Liever subtiel?");
    expect(html).toContain('href="/collections/subtiel"');
    expect(html).toContain('href="/cadeaukaarten"');
  });

  it("mobile menu card: the drop only while it is publicly live, else Linde's first stack", async () => {
    const stack = stacks[0] as Stack;
    const products = [lola, tess, jet];
    expect(mobileNavFeature({ drop: holiday, phase: "live" }, [{ stack, products }])).toEqual({ kind: "drop", drop: holiday });
    expect(mobileNavFeature({ drop: holiday, phase: "early-access" }, [{ stack, products }])).toEqual({
      kind: "stack",
      stack,
      products,
    });
    expect(mobileNavFeature(null, [])).toBeNull();

    vi.mocked(getFeaturedDrop).mockResolvedValue({ drop: holiday, phase: "live" });
    const element = (await Header()) as ReactElement<{ feature: unknown }>;
    expect(element.props.feature).toEqual({ kind: "drop", drop: holiday });
  });

  it("the stack card shows the real stack price after 15% (Lola + Tess + Jet)", () => {
    const stack = stacks[0] as Stack;
    const html = renderToStaticMarkup(
      <MobileNavFeatureCard feature={{ kind: "stack", stack, products: [lola, tess, jet] }} onNavigate={() => {}} />,
    );
    // 1995 + 1995 + 2495 = 6485; 15% per piece: 299 + 299 + 374 = 972; total 5513.
    expect(html).toContain(escape(chromeCopy.menu.featureStackTotal("€55,13")));
    expect(html).toContain(chromeCopy.menu.featureStackEyebrow);
    expect(html).toContain('href="/stacks"');
    const drop = renderToStaticMarkup(<MobileNavFeatureCard feature={{ kind: "drop", drop: holiday }} onNavigate={() => {}} />);
    expect(drop).toContain('href="/drops/holiday-sparkle"');
    expect(drop).toContain(escape(holiday.tagline));
  });

  it("isCurrentPage matches the page itself only; momentImages maps moments to their photos", () => {
    expect(isCurrentPage("/collections/oorbellen/", "/collections/oorbellen")).toBe(true);
    expect(isCurrentPage("/collections/oorbellen", "/collections/oorbellen-sale")).toBe(false);
    expect(isCurrentPage(null, "/")).toBe(false);
    const group = mainNav.find((item) => item.kind === "group" && item.id === "momenten");
    expect(group?.kind).toBe("group");
    if (group?.kind !== "group") return;
    expect(momentImages(group)).toEqual({
      "/collections/festival": "momenten.festival",
      "/collections/date-night": "momenten.date-night",
      "/collections/kantoor-maar-niet-saai": "momenten.kantoor-maar-niet-saai",
      "/collections/strand": "momenten.strand",
      "/collections/feestdagen": "momenten.feestdagen",
    });
  });
});

describe("Footer (plan §2.5, §13.5; brief §2.8, §2.10)", () => {
  const html = withProviders(<Footer />);

  it("has the withdrawal link with exactly this label and target", () => {
    expect(html).toMatch(new RegExp(`<a href="/herroepen"[^>]*>${site.withdrawalLinkLabel}</a>`));
  });

  it("is dark with a bot-wit focus ring and hidden in print", () => {
    expect(html).toMatch(/<footer data-vlak="donker" class="[^"]*bg-donker[^"]*print:hidden/);
  });

  it("starts with the Club sign-up: the promise, the consent sentence on an unchecked box and the privacy link", () => {
    // One sentence per line (QA round 2), the text unchanged.
    for (const sentence of site.club.title.split(/(?<=\.)\s+/)) expect(html).toContain(`<span class="block">${escape(sentence)}</span>`);
    expect(html).toContain(escape(site.consentText));
    expect(html).toContain(`href="${site.privacyLink.href}"`);
    expect(html).not.toMatch(/type="checkbox"[^>]*checked=""/);
    expect(html.indexOf(escape(site.club.title))).toBeLessThan(html.indexOf(footerNav[0].title));
  });

  it("has the four link columns with every link", () => {
    for (const column of footerNav) {
      expect(html).toContain(`>${column.title}<`);
      for (const link of column.links) expect(html).toContain(`href="${link.href}"`);
    }
  });

  it("has payment badges, only confirmed socials, company details, the VAT line and the copyright", () => {
    for (const method of site.paymentMethods) expect(html).toContain(escape(method));
    // QA round 3: an unconfirmed handle is never linked (components/qa-round3.test.tsx covers a confirmed one).
    for (const social of site.socials) {
      if (social.confirmed) expect(html).toContain(`href="${social.href}" target="_blank" rel="noopener"`);
      else expect(html).not.toContain(`href="${social.href}"`);
    }
    expect(html).toContain(escape(site.company.legalName));
    expect(html).toContain(chromeCopy.footer.kvk(site.company.kvk));
    expect(html).toContain(chromeCopy.footer.vatId(site.company.vatId));
    expect(html).toContain(`mailto:${site.email}`);
    expect(html).toContain(escape(site.vat.before));
    expect(html).toContain(escape(chromeCopy.footer.copyright));
  });

  it("marks the English tagline as English (WCAG 3.1.2, QA round 3)", () => {
    expect(html).toContain(`<p lang="en" class="label-caps text-tekst-2-op-donker">${site.taglines[0]}</p>`);
  });

  it("has no cookie settings button while analytics is off", () => {
    expect(site.analytics.enabled).toBe(false);
    expect(html).not.toContain("Cookie-instellingen");
  });
});

describe("PaymentBadges (decision 93)", () => {
  it("lists the methods from config as neutral text badges", () => {
    const html = renderToStaticMarkup(<PaymentBadges tone="donker" size="sm" />);
    expect(html).toContain(`role="list" aria-label="${chromeCopy.payments.label}"`);
    expect(html.match(/<li /g)).toHaveLength(site.paymentMethods.length);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<svg");
  });
});

describe("ShipLabel (plan §10.5, decision 178)", () => {
  it("shows today's text from the schedule, later entries hidden, the fallback last", () => {
    const schedule = buildShipSchedule(TEST_NOW);
    const html = renderToStaticMarkup(
      <ClockProvider serverNow={TEST_NOW}>
        <ShipLabel schedule={schedule} field="barText" />
      </ClockProvider>,
    );
    const variants = variantsOf(html);
    expect(variants).toHaveLength(schedule.length + 1);
    expect(variants[0]).toEqual({ hidden: false, inner: escape(sharedCopy.deliveryBar.today) });
    expect(variants.slice(1).every((variant) => variant.hidden)).toBe(true);
    expect(variants[variants.length - 1].inner).toBe(escape(sharedCopy.deliveryBar.fallback));
  });

  it("without a schedule the always-true fallback", () => {
    expect(renderToStaticMarkup(<ShipLabel schedule={[]} field="estimateText" />)).toBe(
      `<span>${escape(shipLabelFallback("estimateText"))}</span>`,
    );
    expect(shipLabelFallback("estimateText")).toBe(sharedCopy.deliveryEstimate.fallback);
  });
});

describe("ShopChrome (plan §13.5)", () => {
  function childrenOf(element: ReactElement<{ children?: ReactNode }>): ReactNode[] {
    const children = element.props.children;
    return Array.isArray(children) ? children : [children];
  }

  it("nests ClockProvider › CatalogProvider › CartProvider around bar, header, <main>, reviews, footer, popup and drawer", async () => {
    vi.mocked(getCatalogProducts).mockResolvedValue(pieceList);
    const tree = (await ShopChrome({ children: <p>inhoud</p> })) as ReactElement<{ serverNow: number; children: ReactNode }>;
    expect(tree.type).toBe(ClockProvider);
    expect(tree.props.serverNow).toBe(TEST_NOW);

    const catalog = tree.props.children as ReactElement<{ products: CatalogProduct[]; children: ReactNode }>;
    expect(catalog.type).toBe(CatalogProvider);
    expect(catalog.props.products).toBe(pieceList);

    const cart = catalog.props.children as ReactElement<{ provider: string; children: ReactNode }>;
    expect(cart.type).toBe(CartProvider);
    expect(cart.props.provider).toBe("local");

    const parts = childrenOf(cart).filter(isValidElement) as ReactElement<Record<string, unknown>>[];
    const types = parts.map((part) => part.type);
    expect(types).toEqual([AnnouncementBar, Header, "main", ReviewsCarousel, Footer, EmailCaptureLoader, CartDrawerLoader]);
    expect(parts[3].props.variant).toBe("footer");
    const main = parts[2];
    expect(main.props.id).toBe("main");
    expect(main.props.tabIndex).toBe(-1);
    expect(main.props.className).toBe("flex-1 focus:outline-none");
  });
});
