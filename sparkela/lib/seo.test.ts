import { describe, expect, it } from "vitest";

import {
  absoluteUrl,
  BRAND_OG_ALT,
  breadcrumbJsonLd,
  centsToDecimal,
  CONTENT_UPDATED,
  NOINDEX_PATHS,
  NOT_FOUND_TITLE,
  OG_LOCALE,
  organizationJsonLd,
  pageMetadata,
  productJsonLd,
  productMetadata,
  serializeJsonLd,
  siteUrl,
  STATIC_ROUTES,
  websiteJsonLd,
} from "@/lib/seo";
import { legalPages } from "@/content/legal";
import { site } from "@/content/site";
import { makeProduct } from "@/tests/fixtures/catalog";

const lola = makeProduct({
  handle: "lola-chunky-hoops",
  title: "Lola chunky hoops",
  description: "Chunky, goudkleurig en gemaakt om op te vallen.",
  type: "oorbellen",
  variants: [
    { title: "Goud", price: 1995, quantityAvailable: 25, sku: "SPK-LOLA-G" },
    { title: "Zilver", price: 1995, quantityAvailable: 0, sku: "SPK-LOLA-Z" },
  ],
});
const evi = makeProduct({ handle: "evi-dikke-schakelketting", title: "Evi dikke schakelketting", type: "kettingen", price: 3595 });
const giftCard = makeProduct({ handle: "cadeaukaart", title: "Cadeaukaart", type: "cadeaukaart" });
const giftWrap = makeProduct({ handle: "cadeauverpakking", title: "Cadeauverpakking", type: "cadeauverpakking" });

type Json = Record<string, unknown>;
const offersOf = (node: Json) => node.offers as Json[];

describe("routes and constants", () => {
  it("has the site origin and the Dutch locale", () => {
    expect(siteUrl.origin).toMatch(/^https?:\/\/[^/]+$/);
    expect(OG_LOCALE).toBe("nl_NL");
    expect(CONTENT_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(absoluteUrl("/privacy")).toBe(`${siteUrl.origin}/privacy`);
    expect(absoluteUrl("https://cdn.shopify.com/a.jpg")).toBe("https://cdn.shopify.com/a.jpg");
  });

  it("keeps noindex pages out of STATIC_ROUTES", () => {
    for (const path of NOINDEX_PATHS) expect(STATIC_ROUTES).not.toContain(path);
    expect(STATIC_ROUTES).not.toContain("/wachtlijst");
    expect(STATIC_ROUTES).not.toContain("/nieuwsbrief/bevestigen");
    expect(NOINDEX_PATHS).toEqual(["/zoeken", "/checkout", "/account"]);
  });

  it("lists the indexable static pages once, with every legal page", () => {
    expect(new Set(STATIC_ROUTES).size).toBe(STATIC_ROUTES.length);
    expect(STATIC_ROUTES[0]).toBe("/");
    for (const page of legalPages) expect(STATIC_ROUTES).toContain(`/${page.slug}`);
    for (const path of ["/stacks", "/cadeaukaarten", "/sparkela-club", "/spark-finder", "/over-sparkela", "/veelgestelde-vragen", "/contact"]) {
      expect(STATIC_ROUTES).toContain(path);
    }
    // Collections, products and drops are added by the sitemap (plan §18.1).
    expect(STATIC_ROUTES.some((path) => /^\/(collections|products|drops)\//.test(path))).toBe(false);
  });
});

describe("pageMetadata", () => {
  it("always has the full Open Graph object with an image", () => {
    const meta = pageMetadata({ title: "Privacybeleid", description: "Zo gaan we om met je gegevens.", path: "/privacy" });
    expect(meta).toMatchObject({
      title: "Privacybeleid",
      description: "Zo gaan we om met je gegevens.",
      alternates: { canonical: "/privacy" },
      openGraph: {
        siteName: "Sparkela",
        locale: "nl_NL",
        type: "website",
        url: "/privacy",
        images: [{ url: "/opengraph-image", width: 1200, height: 630, type: "image/png", alt: BRAND_OG_ALT }],
      },
    });
    expect(meta.robots).toBeUndefined();
    expect(BRAND_OG_ALT).toBe("Sparkela: Sieraden met een spark");
  });

  it("takes an absolute title, a canonical other than the path, an own image and noindex", () => {
    const waitlist = pageMetadata({
      title: { absolute: "Sparkela | Binnenkort online" },
      description: site.description,
      path: "/wachtlijst",
      canonical: "/",
    });
    expect(waitlist.title).toEqual({ absolute: "Sparkela | Binnenkort online" });
    expect(waitlist.alternates).toEqual({ canonical: "/" });
    expect(waitlist.openGraph).toMatchObject({ url: "/" });

    const teaser = pageMetadata({
      title: "Holiday Sparkle komt eraan",
      description: "Teaser",
      path: "/drops/holiday-sparkle/binnenkort",
      canonical: "/drops/holiday-sparkle",
      image: "/drops/holiday-sparkle/opengraph-image",
      noindex: true,
    });
    expect(teaser.robots).toEqual({ index: false, follow: true });
    expect(teaser.openGraph).toMatchObject({
      images: [{ url: "/drops/holiday-sparkle/opengraph-image", alt: "Holiday Sparkle komt eraan", width: 1200, height: 630 }],
    });

    const photo = pageMetadata({ title: "X", description: "Y", path: "/x", image: "https://cdn.shopify.com/s/files/x.jpg" });
    expect(photo.openGraph).toMatchObject({ images: [{ url: "https://cdn.shopify.com/s/files/x.jpg", alt: "X" }] });
  });
});

describe("productMetadata", () => {
  it("uses product SEO, the canonical and the product's own OG image", () => {
    const meta = productMetadata(lola);
    expect(meta).toMatchObject({
      title: "Lola chunky hoops",
      description: "Chunky, goudkleurig en gemaakt om op te vallen.",
      alternates: { canonical: "/products/lola-chunky-hoops" },
      openGraph: { url: "/products/lola-chunky-hoops", images: [{ url: "/products/lola-chunky-hoops/opengraph-image" }] },
    });
    const custom = productMetadata(makeProduct({ handle: "x", seo: { title: "Eigen titel", description: "Eigen tekst" } }));
    expect(custom).toMatchObject({ title: "Eigen titel", description: "Eigen tekst" });
    expect(productMetadata(makeProduct({ handle: "y", description: "" })).description).toBe(site.description);
  });

  it("gives 'Pagina niet gevonden' with noindex for an unknown handle and the gift wrap", () => {
    for (const meta of [productMetadata(null), productMetadata(giftWrap)]) {
      expect(meta).toEqual({ title: NOT_FOUND_TITLE, robots: { index: false, follow: true } });
    }
    expect(NOT_FOUND_TITLE).toBe("Pagina niet gevonden");
  });
});

describe("productJsonLd", () => {
  it("has brand Sparkela, sku, images and one offer per variant", () => {
    const node = productJsonLd(lola) as Json;
    expect(node).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Lola chunky hoops",
      sku: "SPK-LOLA-G",
      url: absoluteUrl("/products/lola-chunky-hoops"),
      brand: { "@type": "Brand", name: "Sparkela" },
      category: "Oorbellen",
      image: [absoluteUrl("/products/lola-chunky-hoops/opengraph-image")],
    });
    const offers = offersOf(node);
    expect(offers).toHaveLength(2);
    expect(offers.map((o) => [o.name, o.sku, o.price, o.priceCurrency, o.availability])).toEqual([
      ["Goud", "SPK-LOLA-G", "19.95", "EUR", "https://schema.org/InStock"],
      ["Zilver", "SPK-LOLA-Z", "19.95", "EUR", "https://schema.org/OutOfStock"],
    ]);
    for (const offer of offers) expect(offer.url).toBe(absoluteUrl("/products/lola-chunky-hoops"));
  });

  it("never has aggregateRating or reviews without real reviews", () => {
    for (const product of [lola, evi, giftCard]) {
      const node = productJsonLd(product) as Json;
      expect(node).not.toHaveProperty("aggregateRating");
      expect(node).not.toHaveProperty("review");
      expect(JSON.stringify(node)).not.toMatch(/rating/i);
    }
  });

  it("ships NL for €3,95, free from €35, with the 14-day return policy", () => {
    const [cheap] = offersOf(productJsonLd(lola) as Json);
    const [dear] = offersOf(productJsonLd(evi) as Json);
    const rate = (offer: Json) => ((offer.shippingDetails as Json[])[0].shippingRate as Json).value;
    expect(rate(cheap)).toBe("3.95");
    expect(rate(dear)).toBe("0.00");
    expect((cheap.shippingDetails as Json[])[0]).toMatchObject({
      shippingDestination: { addressCountry: "NL" },
      deliveryTime: { transitTime: { minValue: 1, maxValue: 2, unitCode: "DAY" } },
    });
    expect((cheap.shippingDetails as Json[]).map((d) => (d.shippingDestination as Json).addressCountry)).toEqual(["NL"]);
    expect(cheap.hasMerchantReturnPolicy).toMatchObject({
      "@type": "MerchantReturnPolicy",
      applicableCountry: ["NL"],
      merchantReturnDays: 14,
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    });
  });

  it("gives the gift card offers without shipping (digital)", () => {
    const offers = offersOf(productJsonLd(giftCard) as Json);
    expect(offers.map((o) => o.price)).toEqual(["15.00", "25.00", "50.00"]);
    for (const offer of offers) {
      expect(offer).not.toHaveProperty("shippingDetails");
      expect(offer).not.toHaveProperty("hasMerchantReturnPolicy");
    }
  });

  it("uses the Shopify photos when there are any", () => {
    const withPhoto = makeProduct({
      handle: "met-foto",
      images: [{ url: "https://cdn.shopify.com/s/files/1/met-foto.jpg", alt: "Met foto", width: 1600, height: 2000, kind: "packshot" }],
    });
    expect((productJsonLd(withPhoto) as Json).image).toEqual(["https://cdn.shopify.com/s/files/1/met-foto.jpg"]);
    expect((productJsonLd(withPhoto) as Json).sku).toBe("met-foto");
  });
});

describe("organization, website and breadcrumbs", () => {
  it("describes Sparkela without sameAs while the socials are unconfirmed", () => {
    const org = organizationJsonLd() as Json;
    expect(org).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Sparkela",
      url: absoluteUrl("/"),
      email: site.email,
      logo: { url: absoluteUrl("/brand/icon-512.png") },
    });
    expect(site.socials.every((social) => !social.confirmed)).toBe(true);
    expect(org).not.toHaveProperty("sameAs");
  });

  it("has a SearchAction to /zoeken with the literal template", () => {
    const website = websiteJsonLd() as Json;
    expect(website).toMatchObject({ "@type": "WebSite", inLanguage: "nl", name: "Sparkela" });
    expect(website.potentialAction).toEqual({
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/zoeken")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    });
  });

  it("numbers breadcrumbs with absolute URLs", () => {
    expect(
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Oorbellen", path: "/collections/oorbellen" },
        { name: "Lola chunky hoops", path: "/products/lola-chunky-hoops" },
      ]),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Oorbellen", item: absoluteUrl("/collections/oorbellen") },
        { "@type": "ListItem", position: 3, name: "Lola chunky hoops", item: absoluteUrl("/products/lola-chunky-hoops") },
      ],
    });
  });
});

describe("serialization", () => {
  it("formats cents as a schema.org decimal", () => {
    expect(centsToDecimal(1995)).toBe("19.95");
    expect(centsToDecimal(395)).toBe("3.95");
    expect(centsToDecimal(5)).toBe("0.05");
    expect(centsToDecimal(0)).toBe("0.00");
    expect(centsToDecimal(-224)).toBe("-2.24");
  });

  it("escapes < so the JSON can never close its script element", () => {
    const out = serializeJsonLd({ name: "</script><b>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toEqual({ name: "</script><b>" });
    expect(JSON.parse(serializeJsonLd([organizationJsonLd(), websiteJsonLd()]))).toHaveLength(2);
  });
});
