import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { pdpCopy } from "@/content/copy/pdp";
import { sharedCopy } from "@/content/copy/shared";
import { site } from "@/content/site";
import { CartProvider } from "@/components/cart/CartProvider";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { Footer } from "@/components/layout/Footer";
import { GiftWrapCheckbox } from "@/components/pdp/GiftWrapCheckbox";
import { ProductFaq } from "@/components/pdp/ProductFaq";
import { ProductCard } from "@/components/product/ProductCard";
import { ClockProvider } from "@/components/time/ClockProvider";
import { faq } from "@/content/faq";
import { lola, pieceList } from "@/tests/fixtures/catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

/**
 * Regression tests for QA round 3 (docs/QA-NOTES.md §4, decision 221): a confirmed social is linked (unconfirmed ones
 * never are, see layout.test.tsx), the gift wrap tick reserves the height of both descriptions, a card's overlays step
 * aside for its choice list, and the FAQ block inside a page has no container of its own.
 */

// One confirmed account, so the footer's socials list renders (the real config has none confirmed yet).
vi.mock("@/content/site", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/content/site")>();
  return { ...original, confirmedSocials: [{ ...original.site.socials[0], confirmed: true }] };
});

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} />
  ),
}));

function withProviders(children: ReactNode): string {
  return renderToStaticMarkup(
    <ClockProvider serverNow={TEST_NOW}>
      <CatalogProvider products={pieceList}>
        <CartProvider provider="local">{children}</CartProvider>
      </CatalogProvider>
    </ClockProvider>,
  );
}

describe("socials (QA round 3)", () => {
  it("links a confirmed account in the footer, in a new window", () => {
    const html = withProviders(<Footer />);
    const [confirmed, ...others] = site.socials;
    expect(html).toContain(`href="${confirmed.href}" target="_blank" rel="noopener"`);
    for (const social of others) expect(html).not.toContain(`href="${social.href}"`);
  });
});

describe("GiftWrapCheckbox (QA round 3)", () => {
  it("keeps both descriptions in one grid cell, the inactive one invisible and out of the description", () => {
    const off = renderToStaticMarkup(<GiftWrapCheckbox value={false} onChange={() => {}} />);
    const on = renderToStaticMarkup(<GiftWrapCheckbox value onChange={() => {}} inCart />);
    for (const html of [off, on]) {
      expect(html).toContain(pdpCopy.giftWrap.description);
      expect(html).toContain(pdpCopy.giftWrap.alreadyOn);
    }
    expect(off).toContain(`<span class="[grid-area:1/1] invisible" aria-hidden="true">${pdpCopy.giftWrap.alreadyOn}</span>`);
    expect(on).toContain(`<span class="[grid-area:1/1] invisible" aria-hidden="true">${pdpCopy.giftWrap.description}</span>`);
  });
});

describe("ProductCard overlays (QA round 3)", () => {
  it("hides the badge and the vibe chip while the card's choice list is open", () => {
    const html = withProviders(<ProductCard product={lola} />);
    expect(html.match(/group-has-\[\[data-quick-add-panel\]\]\/kaart:invisible/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe("ProductFaq inPage (QA round 3)", () => {
  it("renders the PDP's FAQ block without a container of its own, with the eyebrow and both links", () => {
    const items = faq.filter((item) => ["stack-korting", "welkomstcode", "retourneren"].includes(item.id));
    const inPage = renderToStaticMarkup(<ProductFaq items={items} headingId="faq" inPage />);
    const own = renderToStaticMarkup(<ProductFaq items={items} headingId="faq" />);
    expect(inPage).not.toContain("max-w-[1240px]");
    expect(own).toContain("max-w-[1240px]");
    for (const html of [inPage, own]) {
      expect(html).toContain(pdpCopy.faq.eyebrow);
      expect(html).toContain(`href="${sharedCopy.faqLinks.allLink.href}"`);
      expect(html).toContain(`href="${sharedCopy.faqLinks.contact.link.href}"`);
      expect(html).toContain("lg:col-start-6");
    }
  });
});
