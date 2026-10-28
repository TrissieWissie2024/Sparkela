import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { availableSearchPages, searchPages, searchProducts } from "@/lib/catalog";
import { collectionCopy } from "@/content/copy/collection";
import { pdpCopy } from "@/content/copy/pdp";
import { sharedCopy } from "@/content/copy/shared";
import { home } from "@/content/home";
import { site } from "@/content/site";
import { CartProvider } from "@/components/cart/CartProvider";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { StylingTile } from "@/components/collection/StylingTile";
import { FaqSection } from "@/components/home/FaqSection";
import { CompanyDetails } from "@/components/layout/CompanyDetails";
import { ProductFaq } from "@/components/pdp/ProductFaq";
import { VariantPicker } from "@/components/pdp/VariantPicker";
import { ProductCard } from "@/components/product/ProductCard";
import { Select } from "@/components/ui/Select";
import { faq } from "@/content/faq";
import { lola, nina, pieceList, sterKetting } from "@/tests/fixtures/catalog";

/**
 * Regression tests for QA round 4 (docs/QA-NOTES.md §5, decision 223): the shop's own words in search, the closed
 * stack select without a price, the size error in the label row, one FAQ footer, the company details per line, the
 * tile photo sizes, long spec lines and the photo strip line without a handle that does not exist.
 */

describe("search knows the shop's own words (QA round 4)", () => {
  const limitedSter = { ...sterKetting, badges: [...sterKetting.badges, "limited" as const] };
  const items = [...pieceList.filter((product) => product.handle !== sterKetting.handle), limitedSter];
  const handles = (query: string) => searchProducts(items, query).map((product) => product.handle);

  it("finds the Nieuw pieces, the live drop under limited and drop, and the clean pieces under subtiel and klassiek", () => {
    const nieuw = handles("nieuw");
    expect(nieuw.length).toBeGreaterThan(0);
    for (const handle of nieuw) expect(items.find((product) => product.handle === handle)?.tags.nieuw, handle).toBe(true);
    expect(handles("limited")).toEqual([sterKetting.handle]);
    expect(handles("drop")).toContain(sterKetting.handle);
    const clean = items.filter((product) => product.tags.vibes.includes("clean-en-classy")).map((product) => product.handle);
    expect(clean.length).toBeGreaterThan(0);
    expect(handles("subtiel").sort()).toEqual([...clean].sort());
    expect(handles("klassiek").sort()).toEqual([...clean].sort());
  });

  it("offers the collections as pages, an exact keyword before a prefix, and Limited only while a piece carries the badge", () => {
    const pages = (query: string, products = items) =>
      searchPages(availableSearchPages(sharedCopy.searchPages, products), query).map((page) => page.href);
    expect(pages("nieuw")[0]).toBe("/collections/nieuw");
    expect(pages("nieuw")).toContain("/sparkela-club");
    expect(pages("limited")).toEqual(["/collections/limited"]);
    expect(pages("limited", pieceList.filter((product) => !product.badges.includes("limited")))).toEqual([]);
    expect(pages("subtiel")).toEqual(["/collections/subtiel"]);
    expect(pages("onder 25")).toEqual(["/collections/onder-25"]);
  });
});

describe("stack select (QA round 4: no clipped price)", () => {
  it("shows the chosen piece without its price in the closed field, the price in the label row, the options in full", () => {
    const html = renderToStaticMarkup(
      <Select
        label="Stuk 2"
        value="a"
        options={[
          { value: "a", label: "Noor dikke ringetjes, Goud · €14,95" },
          { value: "b", label: "Ivy dun armbandje, Zilver · €14,95" },
        ]}
        display="Noor dikke ringetjes, Goud"
        labelAside={<span>€14,95</span>}
        onChange={() => {}}
      />,
    );
    // The real select lies invisibly over the field and keeps the full labels for screen readers and the picker.
    expect(html).toMatch(/<select[^>]*class="peer absolute inset-0 size-full cursor-pointer appearance-none opacity-0"/);
    expect(html).toContain('<option value="a" selected="">Noor dikke ringetjes, Goud · €14,95</option>');
    expect(html).toMatch(/<div aria-hidden="true" class="pointer-events-none flex min-h-11[^"]*"><span class="min-w-0 text-pretty">Noor dikke ringetjes, Goud<\/span><\/div>/);
    expect(html).toContain('<span aria-hidden="true" class="shrink-0"><span>€14,95</span></span>');
    expect(html).toContain("peer-focus-visible:outline-2");
  });

  it("names a piece without its price for the closed field", () => {
    expect(pdpCopy.stack.optionName("Noor dikke ringetjes", "Goud")).toBe("Noor dikke ringetjes, Goud");
    expect(pdpCopy.stack.optionName("Jade stipjes", null)).toBe("Jade stipjes");
  });
});

describe("ring size error (QA round 4)", () => {
  it("stands in the label row, so nothing below moves, and gives the size tiles the error border", () => {
    const html = renderToStaticMarkup(
      <VariantPicker product={nina} value={null} onChange={() => {}} errorId="maat-fout" error={pdpCopy.variant.chooseSize} />,
    );
    const row = html.slice(0, html.indexOf('role="radiogroup"'));
    expect(row).toContain(`id="maat-fout" role="status" class="tekst-klein font-semibold text-fout">${pdpCopy.variant.chooseSize}`);
    expect(html).toContain('aria-describedby="maat-fout"');
    expect(html).toContain("border-fout");
    const quiet = renderToStaticMarkup(<VariantPicker product={nina} value={null} onChange={() => {}} errorId="maat-fout" />);
    expect(quiet).not.toContain("border-fout");
    expect(quiet).toContain('id="maat-fout" role="status" class="tekst-klein font-semibold text-fout sr-only"');
  });
});

describe("one FAQ footer (QA round 4)", () => {
  it("has the same links and words under the home FAQ and the product FAQ", () => {
    const items = faq.filter((item) => item.onHome);
    const homeHtml = renderToStaticMarkup(<FaqSection items={items} content={home.faq} />);
    const pdpHtml = renderToStaticMarkup(<ProductFaq items={items} headingId="faq" />);
    for (const html of [homeHtml, pdpHtml]) {
      expect(html).toContain(sharedCopy.faqLinks.allLink.label);
      expect(html).toContain(sharedCopy.faqLinks.contact.text);
      expect(html).toContain(`href="${sharedCopy.faqLinks.contact.link.href}"`);
      expect(html).toContain("before:h-11");
    }
  });
});

describe("company details (QA round 4)", () => {
  it("put each group on its own line and the mail address in its own 44 px target", () => {
    const html = renderToStaticMarkup(<CompanyDetails />);
    const lines = [...html.matchAll(/<span>([\s\S]*?)<\/span>/g)].map((match) => (match[1] ?? "").replace(/<[^>]+>/g, ""));
    expect(lines).toEqual([
      `${site.company.tradeName} · ${site.company.legalName}`,
      site.company.address,
      `KvK ${site.company.kvk} · Btw-id ${site.company.vatId}`,
      site.email,
    ]);
    expect(html).toContain("before:h-11");
  });
});

describe("styling tile (QA round 4)", () => {
  it("asks for its real width in every layout and fills a one-cell row with the photo taking the rest", () => {
    const html = renderToStaticMarkup(<StylingTile title="Tegel" text="Tekst" image="linde.portret" href="/spark-finder" />);
    expect(html).toContain("in-tegelcel:flex-col!");
    expect(html).toContain("in-tegelcel:flex-1!");
    expect(html).toContain("in-tegelcel:pt-3!");
    // The arrow always has at least 12 px above it.
    expect(html).toMatch(/<span aria-hidden="true" class="mt-auto block pt-3/);
  });
});

describe("spec line (QA round 4)", () => {
  it("puts a long spec one part per line on every card, so its line count never depends on the font", () => {
    const render = (specRegel: string) =>
      renderToStaticMarkup(
        <CatalogProvider products={pieceList}>
          <CartProvider provider="local">
            <ProductCard product={{ ...lola, specRegel }} />
          </CartProvider>
        </CatalogProvider>,
      );
    expect(render("Staal, goud- of zilverkleurig · 30 mm")).toContain('class="-ml-[1.1em] flex flex-wrap flex-col"');
    expect(render("Verguld staal · 30 mm")).toContain('class="-ml-[1.1em] flex flex-wrap @max-[12rem]:flex-col"');
  });
});

describe("photo strip line (QA round 4)", () => {
  it("only asks to tag an account that is confirmed", () => {
    const confirmed = site.socials.some((social) => social.confirmed && (social.id === "instagram" || social.id === "tiktok"));
    if (confirmed) expect(home.photoStrip.intro).toMatch(/^Jouw stack hier zien\? Tag @/);
    else expect(home.photoStrip.intro).not.toMatch(/Tag|Instagram|TikTok/);
  });
});

describe("search tile link (QA round 4)", () => {
  it("is the short product name, so it fits the half-width tile", () => {
    expect(collectionCopy.search.more.links[0]?.label).toBe("Spark Finder");
    expect(collectionCopy.search.more.text).toContain("Spark Finder");
  });
});
