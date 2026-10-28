import { describe, expect, it } from "vitest";

import type { CatalogProduct, FaqItem, Product, ProductImage } from "@/lib/types";
import { defaultVariant } from "@/lib/catalog";
import { buildLocalProducts } from "@/lib/commerce/local-data";
import { stackQuote } from "@/lib/pricing";
import { faq } from "@/content/faq";
import { stacks } from "@/content/stacks";
import { localCatalogProducts } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import { gallerySlides, PLACEHOLDER_KINDS } from "./gallery";
import { defaultStackName, productChipLinks, productFaqItems, productTrail } from "./productLinks";
import { formatOneDecimal, parseRingSize, ringSizeRows } from "./ringSizes";
import { isDefaultPicks, optionsExcept, quoteStack, resolvePicks, stackOptionsFor } from "./stackPicks";
import { cheapestVariant, hasSeveralPrices, lowStockCount, productCodes, resolveVariant, variantKind } from "./variants";

/**
 * Pure helpers of the product page (docs/PLAN.md §13.9, §14.2, §19.1): variants, the stack picker's options and
 * picks (decision 129), ring sizes, chips, breadcrumbs, gallery slides, the product FAQ and the name of Linde's stack.
 * Against the local catalog at TEST_NOW (Holiday Sparkle live).
 */

const products = buildLocalProducts();
const catalog = localCatalogProducts(TEST_NOW);

function product(handle: string): Product {
  const found = products.find((candidate) => candidate.handle === handle);
  if (!found) throw new Error(`no product ${handle}`);
  return found;
}

function card(handle: string): CatalogProduct {
  const found = catalog.find((candidate) => candidate.handle === handle);
  if (!found) throw new Error(`no catalog product ${handle}`);
  return found;
}

/** The stack candidates as getStackOptionsFor builds them: listable, available earrings and bracelets but this one. */
function candidatesFor(handle: string): CatalogProduct[] {
  return catalog
    .filter(
      (candidate) =>
        candidate.handle !== handle &&
        candidate.listable &&
        candidate.availableForSale &&
        (candidate.type === "oorbellen" || candidate.type === "armbanden"),
    )
    .sort((a, b) => a.featuredRank - b.featuredRank);
}

describe("variants", () => {
  it("picks swatches, sizes, amounts or plain tiles", () => {
    expect(variantKind(product("lola-chunky-hoops"))).toBe("kleur");
    expect(variantKind(product("bo-statement-druppels"))).toBe("kleur");
    expect(variantKind(product("nina-chunky-ring"))).toBe("maat");
    expect(variantKind(product("cadeaukaart"))).toBe("bedrag");
    expect(variantKind({ isGiftCard: false, type: "kettingen", variants: [{ ...defaultVariant(product("evi-dikke-schakelketting")), swatch: null }] })).toBe(
      "overig",
    );
  });

  it("resolves a stored variant and falls back to the first one for sale", () => {
    const lola = product("lola-chunky-hoops");
    const zilver = lola.variants[1];
    expect(resolveVariant(lola, zilver?.id).title).toBe("Zilver");
    expect(resolveVariant(lola, "local:onbekend:9").title).toBe("Goud");
    expect(resolveVariant(lola, undefined).title).toBe("Goud");
  });

  it("says 'Nog n' only for a real stock of 1 to 3", () => {
    const nina = product("nina-chunky-ring");
    expect(nina.variants.map((variant) => lowStockCount(variant))).toEqual([null, null, null, 2]);
    expect(lowStockCount({ availableForSale: true, quantityAvailable: 3 })).toBe(3);
    expect(lowStockCount({ availableForSale: true, quantityAvailable: 4 })).toBeNull();
    expect(lowStockCount({ availableForSale: false, quantityAvailable: 0 })).toBeNull();
    expect(lowStockCount({ availableForSale: true, quantityAvailable: null })).toBeNull();
  });

  it("lists article numbers and finds the cheapest price", () => {
    expect(productCodes(product("lola-chunky-hoops"))).toEqual(["SPK-001-GOUD", "SPK-001-ZILVER"]);
    const giftCard = product("cadeaukaart");
    expect(hasSeveralPrices(giftCard)).toBe(true);
    expect(cheapestVariant(giftCard).price.cents).toBe(1500);
    expect(hasSeveralPrices(product("lola-chunky-hoops"))).toBe(false);
  });
});

describe("stack picker logic (decision 129)", () => {
  it("has one option per variant for sale, with the colour only where a piece has several", () => {
    const options = stackOptionsFor(candidatesFor("bo-statement-druppels"));
    const labels = options.map((option) => option.label);
    expect(labels).toContain("Noor dikke ringetjes, Zilver · €14,95");
    expect(labels).toContain("Noor dikke ringetjes, Goud · €14,95");
    expect(labels).toContain("Jade stipjes · €12,95");
    expect(labels).toContain("Tess schakelarmband · €19,95");
    // Isa is sold out: no option.
    expect(labels.some((label) => label.startsWith("Isa"))).toBe(false);
  });

  it("starts at Linde's picks, keeps valid picks of the visitor and never returns the same piece twice", () => {
    const options = stackOptionsFor(candidatesFor("lola-chunky-hoops"));
    const tess = defaultVariant(card("tess-schakelarmband")).id;
    const roos = defaultVariant(card("roos-brede-bangle")).id;
    const noorZilver = card("noor-dikke-ringetjes").variants[1]?.id ?? "";
    expect(resolvePicks(undefined, [tess, roos], options)).toEqual([tess, roos]);
    expect(resolvePicks({ mode: "los" }, [tess, roos], options)).toEqual([tess, roos]);
    expect(resolvePicks({ mode: "stack", picks: [noorZilver, roos] }, [tess, roos], options)).toEqual([noorZilver, roos]);
    // Same piece twice or an unknown id: back to Linde's stack.
    expect(resolvePicks({ mode: "stack", picks: [roos, roos] }, [tess, roos], options)).toEqual([tess, roos]);
    expect(resolvePicks({ mode: "stack", picks: ["local:weg:1", roos] }, [tess, roos], options)).toEqual([tess, roos]);
    // No default: the first two options.
    expect(resolvePicks(undefined, null, options)).toEqual([options[0]?.value, options[1]?.value]);
    expect(resolvePicks(undefined, null, options.slice(0, 1))).toBeNull();
    expect(optionsExcept(options, tess).some((option) => option.value === tess)).toBe(false);
    expect(isDefaultPicks([roos, tess], [tess, roos])).toBe(true);
    expect(isDefaultPicks([noorZilver, tess], [tess, roos])).toBe(false);
  });

  it("prices the stack like the cart: Noor + Tess + Jet is €50,88 with €8,97 off", () => {
    const options = stackOptionsFor(candidatesFor("noor-dikke-ringetjes"));
    const tess = defaultVariant(card("tess-schakelarmband")).id;
    const jet = defaultVariant(card("jet-vonk-oorbellen")).id;
    const quote = quoteStack({ price: 1495, type: "oorbellen" }, [tess, jet], options);
    expect(quote).toEqual(stackQuote([
      { price: 1495, type: "oorbellen" },
      { price: 1995, type: "armbanden" },
      { price: 2495, type: "oorbellen" },
    ]));
    expect(quote.total).toBe(5088);
    expect(quote.discount).toBe(897);
  });

  it("names Linde's stack behind the default picks, also for a drop stack outside the visible stacks", () => {
    const lolaPicks: [string, string] = [defaultVariant(card("tess-schakelarmband")).id, defaultVariant(card("roos-brede-bangle")).id];
    expect(defaultStackName("lola-chunky-hoops", lolaPicks, candidatesFor("lola-chunky-hoops"))).toBe("Chunky en gedurfd");
    const boPicks: [string, string] = lolaPicks;
    expect(defaultStackName("bo-statement-druppels", boPicks, candidatesFor("bo-statement-druppels"))).toBeNull();
    const holiday = stacks.find((stack) => stack.slug === "holiday-stack");
    const glitter = defaultVariant(card("holiday-glitter-hoops")).id;
    const armband = defaultVariant(card("holiday-sparkle-armband")).id;
    const dropCandidates = catalog.filter((candidate) => candidate.tags.drops.includes("holiday-sparkle"));
    expect(defaultStackName("holiday-ster-oorbellen", [glitter, armband], dropCandidates, [])).toBe(holiday?.name);
    expect(defaultStackName("lola-chunky-hoops", null, [])).toBeNull();
  });
});

describe("ring sizes", () => {
  it("gives inside diameter and circumference with a Dutch comma", () => {
    expect(ringSizeRows(["16", "17", "18", "19"])).toEqual([
      { size: "16", diameter: "16,0", circumference: "50,3" },
      { size: "17", diameter: "17,0", circumference: "53,4" },
      { size: "18", diameter: "18,0", circumference: "56,5" },
      { size: "19", diameter: "19,0", circumference: "59,7" },
    ]);
    expect(ringSizeRows(["S", "17,5"])).toEqual([{ size: "17,5", diameter: "17,5", circumference: "55,0" }]);
    expect(parseRingSize("€25")).toBeNull();
    expect(parseRingSize("5")).toBeNull();
    expect(formatOneDecimal(50.26)).toBe("50,3");
  });
});

describe("links of the product page", () => {
  it("links the chips to the collections, or to a filter on alle", () => {
    expect(productChipLinks(product("lola-chunky-hoops"))).toEqual([
      { id: "type-oorbellen", label: "Oorbellen", href: "/collections/oorbellen" },
      { id: "vibe-chunky-en-bold", label: "Chunky en bold", href: "/collections/alle?vibe=chunky-en-bold" },
      { id: "vibe-retro", label: "Retro", href: "/collections/alle?vibe=retro" },
      { id: "moment-festival", label: "Festival", href: "/collections/festival" },
      { id: "moment-date-night", label: "Date night", href: "/collections/date-night" },
    ]);
    expect(productChipLinks(product("mae-mini-hoops")).find((link) => link.id === "vibe-clean-en-classy")?.href).toBe(
      "/collections/subtiel",
    );
    expect(productChipLinks(product("cadeaukaart"))).toEqual([]);
  });

  it("builds the breadcrumb trail through the type collection", () => {
    expect(productTrail(product("tess-schakelarmband"))).toEqual([
      { label: "Home", href: "/" },
      { label: "Armbanden", href: "/collections/armbanden" },
      { label: "Tess schakelarmband" },
    ]);
    expect(productTrail(product("cadeaukaart"))).toEqual([
      { label: "Home", href: "/" },
      { label: "Cadeaukaarten", href: "/cadeaukaarten" },
      { label: "Cadeaukaart" },
    ]);
  });

  it("gives five placeholder shots without photos, and the photos with their alt text", () => {
    const placeholders = gallerySlides([], "Lola chunky hoops");
    expect(placeholders.map((slide) => slide.kind)).toEqual([...PLACEHOLDER_KINDS]);
    expect(placeholders[1]?.label).toBe("Lola chunky hoops, draagfoto");
    expect(gallerySlides([], "Cadeaukaart", ["packshot"])).toHaveLength(1);
    const images: ProductImage[] = [
      { url: "https://cdn.shopify.com/a.jpg", alt: "Lola aan het oor", width: 1600, height: 2000, kind: "draagfoto" },
      { url: "https://cdn.shopify.com/b.jpg", alt: " ", width: 1600, height: 2000, kind: "detail" },
    ];
    expect(gallerySlides(images, "Lola chunky hoops").map((slide) => slide.label)).toEqual([
      "Lola aan het oor",
      "Lola chunky hoops, detail",
    ]);
  });

  it("shows the product questions, and its own list for the gift card", () => {
    const onProduct = productFaqItems(product("lola-chunky-hoops"), faq);
    expect(onProduct.length).toBeGreaterThan(0);
    expect(onProduct.every((item: FaqItem) => item.onProduct)).toBe(true);
    expect(productFaqItems(product("cadeaukaart"), faq).map((item) => item.id)).toEqual(["cadeaukaart-gebruiken", "betalen", "welkomstcode"]);
  });
});
