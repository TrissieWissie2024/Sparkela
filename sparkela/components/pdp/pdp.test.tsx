import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CatalogProduct, Product, VerifiedClaim } from "@/lib/types";
import { badgeContextAt, defaultVariant, toCatalogProduct } from "@/lib/catalog";
import { buildLocalProducts } from "@/lib/commerce/local-data";
import { buildShipSchedule } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { stackQuote } from "@/lib/pricing";
import { pdpCopy } from "@/content/copy/pdp";
import { sharedCopy } from "@/content/copy/shared";
import { site } from "@/content/site";
import { CartProvider } from "@/components/cart/CartProvider";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { ClockProvider } from "@/components/time/ClockProvider";
import { localCatalogProducts } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import { BuyBox } from "./BuyBox";
import { CompleteTheLook } from "./CompleteTheLook";
import { DeliveryEstimate } from "./DeliveryEstimate";
import { productAccordionItems } from "./ProductAccordions";
import { ProductGallery } from "./ProductGallery";
import { ProductInfo } from "./ProductInfo";
import { ProductReviews } from "./ProductReviews";
import { ProductSpecs } from "./ProductSpecs";
import { StackPicker } from "./StackPicker";
import { StatementMeter } from "./StatementMeter";
import { STICKY_ATC_EVENT, StickyAddToCart } from "./StickyAddToCart";
import { TrustRow } from "./TrustRow";
import { VariantPicker } from "./VariantPicker";

/**
 * Product page components (docs/PLAN.md §13.9, §19.1): ProductSpecs (material per variant, the claim text),
 * ProductAccordions (the hygiene rule for earrings and piercings, GPSR always, also on the gift card), StackPicker
 * (two filled selects for a piece without a stack, one option per colour), ProductInfo of a live drop product
 * ("Limited" exactly once, decision 134), plus the variant picker, buy box, gallery, meter, trust row and sticky bar.
 * Rendered with renderToStaticMarkup; client components get their providers here.
 */

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

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

function render(children: ReactNode): string {
  return renderToStaticMarkup(
    <ClockProvider serverNow={TEST_NOW}>
      <CatalogProvider products={catalog}>
        <CartProvider provider="local">{children}</CartProvider>
      </CatalogProvider>
    </ClockProvider>,
  );
}

/** Visible text without tags, with entities decoded where the tests need them. */
function text(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** What render() gives around nothing: the cart's live region. */
const EMPTY = render(null);

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const NIKKELVRIJ: VerifiedClaim = { id: "nikkelvrij", label: "Nikkelvrij", origin: "metafield" };

describe("ProductSpecs", () => {
  const lola = product("lola-chunky-hoops");
  const [goud, zilver] = lola.variants;

  it("names the gold layer for Goud and never for Zilver", () => {
    const gold = render(<ProductSpecs product={lola} claims={[]} variantId={goud?.id ?? ""} />);
    expect(gold).toContain("Roestvrij staal met goudlaag");
    const silver = render(<ProductSpecs product={lola} claims={[]} variantId={zilver?.id ?? ""} />);
    expect(silver).toContain("Roestvrij staal");
    expect(silver).not.toContain("goudlaag");
  });

  it("keeps value and unit together and shows the four specs", () => {
    const html = render(<ProductSpecs product={lola} claims={[]} variantId={goud?.id ?? ""} />);
    for (const term of [pdpCopy.specs.materiaal, pdpCopy.specs.afmeting, pdpCopy.specs.gewicht, pdpCopy.specs.sluiting]) {
      expect(html).toContain(`>${term}</dt>`);
    }
    expect(html).toContain("Doorsnede 30 mm, dikte 6 mm");
    expect(html).toContain("8 g");
  });

  it("shows a verified claim as 'bevestigd door de leverancier', never as tested", () => {
    const html = render(<ProductSpecs product={lola} claims={[NIKKELVRIJ]} variantId={goud?.id ?? ""} />);
    expect(html).toContain("Nikkelvrij (bevestigd door de leverancier)");
    expect(html.toLowerCase()).not.toContain("getest");
    expect(render(<ProductSpecs product={lola} claims={[]} variantId={goud?.id ?? ""} />)).not.toContain("Nikkelvrij");
  });

  it("renders nothing for the gift card", () => {
    const giftCard = product("cadeaukaart");
    expect(render(<ProductSpecs product={giftCard} claims={[]} variantId={defaultVariant(giftCard).id} />)).toBe(EMPTY);
  });
});

describe("ProductAccordions", () => {
  function panels(item: Product, claims: VerifiedClaim[] = []): Record<string, string> {
    return Object.fromEntries(
      productAccordionItems(item, claims).map((entry) => [String(entry.title), text(renderToStaticMarkup(<>{entry.content}</>))]),
    );
  }

  it("has the five panels of the brief in order", () => {
    expect(productAccordionItems(product("lola-chunky-hoops"), []).map((entry) => entry.title)).toEqual([
      "Details en materiaal",
      "Verzorging",
      "Garantie",
      "Verzenden en retourneren",
      "Productveiligheid",
    ]);
  });

  it("starts Verzenden en retourneren with the hygiene rule for earrings", () => {
    const shipping = panels(product("lola-chunky-hoops"))["Verzenden en retourneren"] ?? "";
    expect(shipping.trim().startsWith(site.hygieneRule)).toBe(true);
  });

  it("shows the hygiene rule for a piece tagged piercing, and not for a necklace", () => {
    const evi = product("evi-dikke-schakelketting");
    expect(panels(evi)["Verzenden en retourneren"]).not.toContain(site.hygieneRule);
    const piercing: Product = { ...evi, tags: { ...evi.tags, piercing: true } };
    expect(panels(piercing)["Verzenden en retourneren"]).toContain(site.hygieneRule);
  });

  it("always has product safety: GPSR fields, identification and the missing-details line", () => {
    const safety = panels(product("lola-chunky-hoops"))["Productveiligheid"] ?? "";
    expect(safety).toContain("[Fabrikant, adres]");
    expect(safety).toContain("[Verantwoordelijke in de EU]");
    expect(safety).toContain("[Waarschuwingen van de leverancier invullen]");
    expect(safety).toContain("SPK-001-GOUD, SPK-001-ZILVER (lola-chunky-hoops)");
    const bare = product("lola-chunky-hoops");
    const empty: Product = { ...bare, metafields: { ...bare.metafields, gpsrFabrikant: null } };
    expect(panels(empty)["Productveiligheid"]).toContain(pdpCopy.gpsr.missing);
  });

  it("gives the gift card How it works, Terms and product safety with the digital line and the company", () => {
    const giftCard = product("cadeaukaart");
    const items = productAccordionItems(giftCard, []);
    expect(items.map((entry) => entry.title)).toEqual(["Zo werkt het", "Voorwaarden", "Productveiligheid"]);
    const safety = panels(giftCard)["Productveiligheid"] ?? "";
    expect(safety).toContain(pdpCopy.gpsr.digital);
    expect(safety).toContain(site.company.legalName);
    expect(safety).toContain(site.company.kvk);
  });

  it("lists the material per colour and the verified claims in the details", () => {
    const details = panels(product("lola-chunky-hoops"), [NIKKELVRIJ])["Details en materiaal"] ?? "";
    expect(details).toContain("Materiaal: Goud Roestvrij staal met goudlaag");
    expect(details).toContain("Materiaal: Zilver Roestvrij staal ");
    expect(details).toContain("Nikkelvrij (bevestigd door de leverancier)");
  });
});

describe("StackPicker", () => {
  const bo = product("bo-statement-druppels");
  const candidates = candidatesFor("bo-statement-druppels");
  // Bo is in no stack: the fallback of plan §7.2 (the two bracelets with the lowest featuredRank).
  const picks: [string, string] = [defaultVariant(card("tess-schakelarmband")).id, defaultVariant(card("roos-brede-bangle")).id];

  it("for a piece without a stack has two filled selects with real unit prices", () => {
    const html = render(
      <StackPicker
        product={bo}
        variant={defaultVariant(bo)}
        candidates={candidates}
        defaultPicks={picks}
        value={{ mode: "stack", picks }}
        onChange={() => {}}
      />,
    );
    expect(count(html, "<select")).toBe(2);
    expect(html).toContain(">Stuk 2</label>");
    expect(html).toContain(">Stuk 3</label>");
    expect(html).toMatch(new RegExp(`<option value="${picks[0]}" selected="">Tess schakelarmband · €19,95</option>`));
    expect(html).toMatch(new RegExp(`<option value="${picks[1]}" selected="">Roos brede bangle · €21,95</option>`));
    // One option per colour of a piece in Goud and Zilver.
    expect(html).toContain("Noor dikke ringetjes, Zilver · €14,95");
    expect(html).toContain("Noor dikke ringetjes, Goud · €14,95");
    expect(html).toContain("Ivy dun armbandje, Zilver · €14,95");
  });

  it("shows Los and the stack tile with the total and the saving, never a struck price", () => {
    const quote = stackQuote([
      { price: 2295, type: "oorbellen" },
      { price: 1995, type: "armbanden" },
      { price: 2195, type: "armbanden" },
    ]);
    const html = render(
      <StackPicker product={bo} variant={defaultVariant(bo)} candidates={candidates} defaultPicks={picks} value={{ mode: "los" }} onChange={() => {}} />,
    );
    expect(html).toContain(pdpCopy.stack.single);
    expect(html).toContain("Stack van 3 (−15%)");
    expect(html).toContain(formatMoney(quote.total));
    expect(html).toContain(sharedCopy.price.savings(formatMoney(quote.discount)));
    expect(html).not.toContain("<s>");
    expect(html).not.toContain("<select");
  });

  it("names Linde's stack while the picks are hers", () => {
    const lola = product("lola-chunky-hoops");
    const html = render(
      <StackPicker
        product={lola}
        variant={defaultVariant(lola)}
        candidates={candidatesFor("lola-chunky-hoops")}
        defaultPicks={picks}
        value={{ mode: "stack", picks }}
        onChange={() => {}}
        stackName="Goud en gedurfd"
      />,
    );
    expect(html).toContain("Lindes stack: Goud en gedurfd");
    expect(html).toContain("Lola chunky hoops, Goud · €19,95");
  });

  it("renders nothing without default picks (Los only)", () => {
    expect(
      render(<StackPicker product={bo} variant={defaultVariant(bo)} candidates={[]} defaultPicks={null} value={{ mode: "los" }} onChange={() => {}} />),
    ).toBe(EMPTY);
  });
});

describe("ProductInfo", () => {
  it("shows 'Limited' exactly once for a live drop product (decision 134)", () => {
    const star = product("holiday-ster-oorbellen");
    const badges = toCatalogProduct(star, badgeContextAt(TEST_NOW)).badges.filter((id) => id !== "limited" && id !== "early-access");
    // Even if a caller passed "limited" by mistake, the page shows it once, through DropStatusLabel.
    const html = render(<ProductInfo product={star} badges={[...badges, "limited"]} />);
    expect(count(html, ">Limited<")).toBe(1);
    expect(count(html, ">Early access<")).toBe(1);
    expect(count(html, "<h1")).toBe(1);
  });

  it("has the H1, the spec line with its unit kept together, the price, the VAT line and the chips", () => {
    const lola = product("lola-chunky-hoops");
    const html = render(<ProductInfo product={lola} badges={["nieuw", "op-voorraad"]} />);
    expect(html).toMatch(/<h1[^>]*>Lola chunky hoops<\/h1>/);
    expect(html).toContain("Staal, goud of zilver · 30 mm");
    expect(html).toContain("€19,95");
    expect(html).toContain(site.vat.before);
    expect(html).toContain(">Nieuw<");
    expect(html).toContain(">Op voorraad<");
    expect(html).toContain('href="/collections/oorbellen"');
    expect(html).not.toContain("Limited");
  });

  it("shows 'Vanaf' for the gift card", () => {
    const html = render(<ProductInfo product={product("cadeaukaart")} badges={[]} />);
    expect(html).toContain(sharedCopy.price.from("€15"));
  });
});

describe("VariantPicker", () => {
  it("shows colour swatches with their names as radios", () => {
    const lola = product("lola-chunky-hoops");
    const html = render(<VariantPicker product={lola} value={defaultVariant(lola).id} onChange={() => {}} />);
    expect(html).toContain('role="radiogroup"');
    expect(count(html, 'type="radio"')).toBe(2);
    expect(html).toContain("bg-swatch-goud");
    expect(html).toContain("bg-swatch-zilver");
    expect(html).toMatch(/checked=""[^>]*>[\s\S]*?Goud/);
  });

  it("shows ring sizes with the size guide and the low stock of size 19", () => {
    const nina = product("nina-chunky-ring");
    const html = render(<VariantPicker product={nina} value={nina.variants[3]?.id ?? ""} onChange={() => {}} />);
    expect(count(html, 'type="radio"')).toBe(4);
    expect(html).toContain(pdpCopy.variant.sizeGuide);
    expect(html).toContain(pdpCopy.variant.lowStock(2));
  });

  it("shows amount tiles for the gift card and a fixed colour line for a piece in one colour", () => {
    const giftCard = product("cadeaukaart");
    const amounts = render(<VariantPicker product={giftCard} value={defaultVariant(giftCard).id} onChange={() => {}} />);
    for (const amount of ["€15", "€25", "€50"]) expect(amounts).toContain(`>${amount}<`);
    expect(amounts).toContain(pdpCopy.variant.giftCardNote);
    const bo = product("bo-statement-druppels");
    const single = render(<VariantPicker product={bo} value={defaultVariant(bo).id} onChange={() => {}} />);
    expect(single).not.toContain('type="radio"');
    expect(single).toContain("Goud");
  });

  it("marks a sold-out variant", () => {
    const lola = product("lola-chunky-hoops");
    const zilver = lola.variants[1];
    if (!zilver) throw new Error("no Zilver");
    const soldOut: Product = { ...lola, variants: [lola.variants[0] ?? zilver, { ...zilver, availableForSale: false, quantityAvailable: 0 }] };
    const html = render(<VariantPicker product={soldOut} value={defaultVariant(soldOut).id} onChange={() => {}} />);
    expect(html).toContain("line-through");
    expect(html).toContain(pdpCopy.variant.soldOut);
    expect(html).toMatch(/disabled=""/);
  });
});

describe("BuyBox", () => {
  it("has the hidden heading, the variant, stack and gift wrap choices and the buy button", () => {
    const lola = product("lola-chunky-hoops");
    const picks: [string, string] = [defaultVariant(card("tess-schakelarmband")).id, defaultVariant(card("roos-brede-bangle")).id];
    const html = render(
      <BuyBox product={lola} stackCandidates={candidatesFor("lola-chunky-hoops")} defaultStack={picks} stackName="Goud en gedurfd">
        <DeliveryEstimate schedule={buildShipSchedule(TEST_NOW)} />
      </BuyBox>,
    );
    expect(html).toContain(`<h2 class="sr-only">${pdpCopy.sections.buy}</h2>`);
    expect(html).toContain("Stack van 3");
    expect(html).toContain(pdpCopy.giftWrap.label);
    expect(text(html)).toContain(`${pdpCopy.addToCart.label} · €19,95`);
    expect(html).toContain(pdpCopy.delivery.carrier);
    // The sticky bar is portalled into <body> after mount: never in the static HTML.
    expect(html).not.toContain(`aria-label="${pdpCopy.stickyBar.label}"`);
  });

  it("has no stack picker or gift wrap for the gift card, and amount tiles", () => {
    const giftCard = product("cadeaukaart");
    const html = render(<BuyBox product={giftCard} stackCandidates={[]} defaultStack={null} />);
    expect(html).not.toContain("Stack van 3");
    expect(html).not.toContain(pdpCopy.giftWrap.label);
    expect(text(html)).toContain(`${pdpCopy.addToCart.label} · €15,00`);
  });

  it("says Uitverkocht and keeps the button focusable for a sold-out piece", () => {
    const isa = product("isa-dubbele-schakel");
    const html = render(<BuyBox product={isa} stackCandidates={candidatesFor("isa-dubbele-schakel")} defaultStack={null} />);
    expect(html).toContain(pdpCopy.addToCart.soldOut);
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain(" disabled=");
  });
});

describe("other blocks", () => {
  it("StatementMeter is one image named with its value, marked indicative", () => {
    const html = renderToStaticMarkup(<StatementMeter value={4} />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Statement-meter: 4 van 5, indicatief"');
    expect(html).toContain(pdpCopy.meter.indicative);
    expect(count(html, "bg-tekst ")).toBe(4);
  });

  it("TrustRow has the four promises of the brief, and two for the gift card", () => {
    const html = renderToStaticMarkup(<TrustRow />);
    expect(html).toContain("Veilig betalen met iDEAL | Wero");
    expect(html).toContain("Gratis verzending vanaf €35");
    expect(html).toContain("6 maanden garantie");
    expect(html).toContain("14 dagen bedenktijd");
    const giftCard = renderToStaticMarkup(<TrustRow variant="giftcard" />);
    expect(count(giftCard, "<li")).toBe(2);
    expect(giftCard).toContain("Direct in je mail");
  });

  it("DeliveryEstimate shows the brief's estimate as switching text, never a countdown", () => {
    const html = render(<DeliveryEstimate schedule={buildShipSchedule(TEST_NOW)} />);
    expect(html).toContain(sharedCopy.deliveryEstimate.today);
    expect(html).toContain("data-ts=");
  });

  it("the gallery has five placeholder slides named 'n van 5', the first in view, without zoom", () => {
    const html = render(<ProductGallery images={[]} title="Lola chunky hoops" />);
    expect(count(html, 'aria-roledescription="dia"')).toBe(5);
    expect(html).toContain('aria-label="1 van 5"');
    expect(html).toContain("FOTO: Lola chunky hoops, packshot");
    expect(html).toContain('aria-label="Toon afbeelding 2 van 5"');
    expect(html).not.toContain(pdpCopy.gallery.zoom);
  });

  it("the gallery offers zoom on a real photo", () => {
    const html = render(
      <ProductGallery
        images={[{ url: "https://cdn.shopify.com/s/files/lola.jpg", alt: "", width: 1600, height: 2000, kind: "packshot" }]}
        title="Lola chunky hoops"
      />,
    );
    expect(html).toContain(`aria-label="${pdpCopy.gallery.zoom}"`);
    expect(html).toContain('alt="Lola chunky hoops, packshot"');
  });

  it("the sticky bar announces itself with the event the banner and the pill listen to, and waits for the browser", () => {
    expect(STICKY_ATC_EVENT).toBe("sparkela:sticky-atc");
    const html = render(
      <StickyAddToCart targetRef={{ current: null }} title="Lola chunky hoops" summary={["Goud", "Stack van 3"]} price="€19,95" onAdd={() => {}} />,
    );
    expect(html).toBe(EMPTY);
  });

  it("CompleteTheLook shows 2 to 4 cards and nothing for fewer", () => {
    const four = catalog.filter((item) => item.listable).slice(0, 4);
    const html = render(<CompleteTheLook products={four} headingId="look" stackHint />);
    expect(html).toContain(pdpCopy.look.title);
    expect(count(html, "<article")).toBe(4);
    expect(html).toContain('href="/stacks"');
    expect(render(<CompleteTheLook products={four.slice(0, 1)} headingId="look" />)).toBe(EMPTY);
  });

  it("ProductReviews renders nothing without real reviews", () => {
    expect(renderToStaticMarkup(<ProductReviews handle="lola-chunky-hoops" />)).toBe("");
    const review = {
      id: "r1",
      firstName: "Sanne",
      text: "Mooi en licht.",
      rating: 5 as const,
      photo: null,
      productHandle: "lola-chunky-hoops",
      date: "2026-12-01",
      verifiedBuyer: true,
      source: "judge-me" as const,
    };
    const html = renderToStaticMarkup(<ProductReviews handle="lola-chunky-hoops" source={[review]} enabled />);
    expect(html).toContain("Mooi en licht.");
    expect(html).toContain(`Sanne, ${pdpCopy.reviews.verifiedBuyer}`);
  });
});
