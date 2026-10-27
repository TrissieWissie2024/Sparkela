import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatMoneyShort } from "@/lib/money";
import type { JewelryType, LocalProductInput, Money, ProductMetafields } from "@/lib/types";
import { pdpCopy } from "@/content/copy/pdp";
import { sharedCopy } from "@/content/copy/shared";
import { drops } from "@/content/drops";
import { giftCards, giftWrap } from "@/content/offers";
import { products } from "@/content/products";
import { pieces } from "@/tests/fixtures/catalog";

/**
 * content/products.ts against the table of plan §5.4 (handles, prices, variants and stock are used by unit and e2e
 * tests), the catalog fixtures of tests/fixtures/catalog.ts, and data/shopify-products.csv (the same products in
 * Shopify's product CSV format, with the metafield columns of plan §6.4).
 */

interface TableRow {
  handle: string;
  title: string;
  type: JewelryType;
  vibes: string[];
  moments: string[];
  price: number;
  variants: string[];
  stock: number[];
  extraTags: string[];
  favorite: boolean;
}

const RINGS = ["16", "17", "18", "19"];

/** Plan §5.4, row by row (featuredRank = position). */
const TABLE: TableRow[] = [
  { handle: "lola-chunky-hoops", title: "Lola chunky hoops", type: "oorbellen", vibes: ["chunky-en-bold", "retro"], moments: ["festival", "date-night"], price: 1995, variants: ["Goud", "Zilver"], stock: [25, 12], extraTags: ["nieuw"], favorite: true },
  { handle: "bo-statement-druppels", title: "Bo statement druppels", type: "oorbellen", vibes: ["chunky-en-bold"], moments: ["date-night", "feestdagen"], price: 2295, variants: ["Goud"], stock: [3], extraTags: ["nieuw"], favorite: false },
  { handle: "mila-color-pop", title: "Mila color pop", type: "oorbellen", vibes: ["kleurrijk-en-speels"], moments: ["festival", "strand"], price: 1795, variants: ["Goud"], stock: [18], extraTags: [], favorite: false },
  { handle: "fenna-retro-schijfjes", title: "Fenna retro schijfjes", type: "oorbellen", vibes: ["retro"], moments: ["kantoor-maar-niet-saai", "date-night"], price: 1695, variants: ["Goud"], stock: [20], extraTags: [], favorite: false },
  { handle: "noor-dikke-ringetjes", title: "Noor dikke ringetjes", type: "oorbellen", vibes: ["chunky-en-bold"], moments: ["kantoor-maar-niet-saai"], price: 1495, variants: ["Goud", "Zilver"], stock: [30, 30], extraTags: ["nieuw"], favorite: false },
  { handle: "jet-vonk-oorbellen", title: "Jet vonk oorbellen", type: "oorbellen", vibes: ["chunky-en-bold"], moments: ["feestdagen", "date-night"], price: 2495, variants: ["Goud"], stock: [15], extraTags: ["nieuw"], favorite: true },
  { handle: "sam-schelp-oorbellen", title: "Sam schelp oorbellen", type: "oorbellen", vibes: ["kleurrijk-en-speels"], moments: ["strand", "festival"], price: 1595, variants: ["Goud"], stock: [22], extraTags: [], favorite: false },
  { handle: "tess-schakelarmband", title: "Tess schakelarmband", type: "armbanden", vibes: ["chunky-en-bold"], moments: ["kantoor-maar-niet-saai", "date-night"], price: 1995, variants: ["Goud"], stock: [25], extraTags: ["nieuw"], favorite: true },
  { handle: "roos-brede-bangle", title: "Roos brede bangle", type: "armbanden", vibes: ["retro", "chunky-en-bold"], moments: ["festival"], price: 2195, variants: ["Goud"], stock: [14], extraTags: [], favorite: false },
  { handle: "lieke-kralenarmband", title: "Lieke kralenarmband", type: "armbanden", vibes: ["kleurrijk-en-speels"], moments: ["strand", "festival"], price: 1395, variants: ["Goud"], stock: [40], extraTags: [], favorite: false },
  { handle: "isa-dubbele-schakel", title: "Isa dubbele schakel", type: "armbanden", vibes: ["chunky-en-bold"], moments: ["feestdagen"], price: 2695, variants: ["Goud"], stock: [0], extraTags: [], favorite: false },
  { handle: "evi-dikke-schakelketting", title: "Evi dikke schakelketting", type: "kettingen", vibes: ["chunky-en-bold"], moments: ["date-night"], price: 2795, variants: ["Goud"], stock: [12], extraTags: ["nieuw"], favorite: true },
  { handle: "femke-muntketting", title: "Femke muntketting", type: "kettingen", vibes: ["retro"], moments: ["kantoor-maar-niet-saai"], price: 2395, variants: ["Goud"], stock: [16], extraTags: [], favorite: false },
  { handle: "sterre-hartketting", title: "Sterre hartketting", type: "kettingen", vibes: ["kleurrijk-en-speels", "retro"], moments: ["date-night"], price: 2195, variants: ["Goud"], stock: [10], extraTags: [], favorite: false },
  { handle: "nina-chunky-ring", title: "Nina chunky ring", type: "ringen", vibes: ["chunky-en-bold"], moments: ["festival", "date-night"], price: 1995, variants: RINGS, stock: [8, 8, 8, 2], extraTags: ["nieuw"], favorite: true },
  { handle: "vera-zegelring", title: "Vera zegelring", type: "ringen", vibes: ["retro"], moments: ["kantoor-maar-niet-saai"], price: 1795, variants: RINGS, stock: [6, 6, 6, 6], extraTags: [], favorite: false },
  { handle: "mae-mini-hoops", title: "Mae mini hoops", type: "oorbellen", vibes: ["clean-en-classy"], moments: ["kantoor-maar-niet-saai"], price: 1295, variants: ["Goud", "Zilver"], stock: [30, 30], extraTags: [], favorite: true },
  { handle: "lou-fijne-schakelketting", title: "Lou fijne schakelketting", type: "kettingen", vibes: ["clean-en-classy"], moments: ["kantoor-maar-niet-saai", "date-night"], price: 1695, variants: ["Goud"], stock: [20], extraTags: [], favorite: false },
  { handle: "ivy-dun-armbandje", title: "Ivy dun armbandje", type: "armbanden", vibes: ["clean-en-classy"], moments: ["kantoor-maar-niet-saai"], price: 1495, variants: ["Goud", "Zilver"], stock: [20, 20], extraTags: [], favorite: false },
  { handle: "jade-stipjes", title: "Jade stipjes", type: "oorbellen", vibes: ["clean-en-classy"], moments: ["kantoor-maar-niet-saai", "strand"], price: 1295, variants: ["Goud"], stock: [35], extraTags: [], favorite: false },
  { handle: "holiday-ster-oorbellen", title: "Ster oorbellen", type: "oorbellen", vibes: ["chunky-en-bold"], moments: ["feestdagen"], price: 2495, variants: ["Goud"], stock: [20], extraTags: ["drop:holiday-sparkle"], favorite: false },
  { handle: "holiday-glitter-hoops", title: "Glitter hoops", type: "oorbellen", vibes: ["kleurrijk-en-speels"], moments: ["feestdagen"], price: 2295, variants: ["Goud"], stock: [20], extraTags: ["drop:holiday-sparkle"], favorite: false },
  { handle: "holiday-sparkle-armband", title: "Sparkle armband", type: "armbanden", vibes: ["chunky-en-bold"], moments: ["feestdagen"], price: 2695, variants: ["Goud"], stock: [15], extraTags: ["drop:holiday-sparkle"], favorite: false },
  { handle: "holiday-ster-ketting", title: "Ster ketting", type: "kettingen", vibes: ["chunky-en-bold"], moments: ["feestdagen"], price: 2995, variants: ["Goud"], stock: [15], extraTags: ["drop:holiday-sparkle"], favorite: false },
];

const PUBLISHED_AT = "2026-11-20T12:00:00+01:00";
const PUBLISHED_AT_NIEUW = "2026-11-25T12:00:00+01:00";
const GPSR = {
  gpsrFabrikant: "[Fabrikant, adres]",
  gpsrVerantwoordelijkeEu: "[Verantwoordelijke in de EU]",
  gpsrWaarschuwingen: "[Waarschuwingen van de leverancier invullen]",
};

const jewelry = products.slice(0, TABLE.length);
const byHandle = (handle: string): LocalProductInput => {
  const product = products.find((p) => p.handle === handle);
  if (!product) throw new Error(`content/products.ts has no ${handle}`);
  return product;
};
const tagValues = (product: LocalProductInput, prefix: string) =>
  product.tags.filter((tag) => tag.startsWith(prefix)).map((tag) => tag.slice(prefix.length));
const hasZilver = (product: LocalProductInput) => product.variants.some((variant) => variant.title === "Zilver");

describe("the catalog of plan §5.4", () => {
  it("has the 24 pieces in table order, then cadeauverpakking and cadeaukaart", () => {
    expect(products.map((product) => product.handle)).toEqual([...TABLE.map((row) => row.handle), "cadeauverpakking", "cadeaukaart"]);
    expect(new Set(products.map((product) => product.handle)).size).toBe(products.length);
  });

  it("matches every row of the table: title, type, vibes, moments, price, variants, stock, tags and favourite", () => {
    TABLE.forEach((row, index) => {
      const product = products[index];
      expect(product.title, row.handle).toBe(row.title);
      expect(tagValues(product, "type:"), row.handle).toEqual([row.type]);
      expect(tagValues(product, "vibe:"), row.handle).toEqual(row.vibes);
      expect(tagValues(product, "moment:"), row.handle).toEqual(row.moments);
      const plainAndDrop = product.tags.filter((tag) => !/^(type|vibe|moment):/.test(tag));
      expect(plainAndDrop, row.handle).toEqual(row.extraTags);
      expect(product.variants.map((variant) => variant.title), row.handle).toEqual(row.variants);
      expect(product.variants.map((variant) => variant.price), row.handle).toEqual(row.variants.map(() => row.price));
      expect(product.variants.map((variant) => variant.quantityAvailable), row.handle).toEqual(row.stock);
      expect(product.metafields.lindesFavoriet === true, row.handle).toBe(row.favorite);
    });
  });

  it("keeps the values the e2e tests rely on (bold in plan §5.4)", () => {
    expect(byHandle("bo-statement-druppels").variants[0].quantityAvailable).toBe(3);
    expect(byHandle("noor-dikke-ringetjes").variants.map((v) => v.price)).toEqual([1495, 1495]);
    expect(byHandle("jet-vonk-oorbellen").variants[0].price).toBe(2495);
    expect(byHandle("sam-schelp-oorbellen").variants[0].price).toBe(1595);
    expect(byHandle("tess-schakelarmband").variants[0].price).toBe(1995);
    expect(byHandle("nina-chunky-ring").variants.map((v) => v.price)).toEqual([1995, 1995, 1995, 1995]);
    expect(byHandle("isa-dubbele-schakel").variants[0].quantityAvailable).toBe(0);
    expect(byHandle("jade-stipjes").variants).toHaveLength(1);
  });

  it("has the counts of brief §4: 7 statement earrings, 4 bracelets, 3 necklaces, 2 rings, 4 subtle, 4 drop pieces", () => {
    const dropPieces = jewelry.filter((p) => tagValues(p, "drop:").length > 0);
    const subtle = jewelry.filter((p) => p.tags.includes("vibe:clean-en-classy"));
    const regular = jewelry.filter((p) => !dropPieces.includes(p) && !subtle.includes(p));
    const count = (type: string) => regular.filter((p) => p.tags.includes(`type:${type}`)).length;
    expect([count("oorbellen"), count("armbanden"), count("kettingen"), count("ringen"), subtle.length, dropPieces.length]).toEqual([7, 4, 3, 2, 4, 4]);
  });

  it("publishes the pieces tagged nieuw a little later, so sorting by nieuwste means something", () => {
    for (const product of products) {
      expect(product.publishedAt, product.handle).toBe(product.tags.includes("nieuw") ? PUBLISHED_AT_NIEUW : PUBLISHED_AT);
    }
  });

  it("has no photos, no sale prices and no piercing tag at launch", () => {
    for (const product of products) {
      expect(product.images ?? [], product.handle).toEqual([]);
      expect(product.tags, product.handle).not.toContain("piercing");
      for (const variant of product.variants) expect(variant.compareAtPrice ?? null, product.handle).toBeNull();
    }
  });

  it("uses lower-case, known tags only", () => {
    const known = /^(type:(oorbellen|armbanden|kettingen|ringen|cadeaukaart|cadeauverpakking)|vibe:(chunky-en-bold|clean-en-classy|kleurrijk-en-speels|retro)|moment:(festival|date-night|kantoor-maar-niet-saai|strand|feestdagen)|drop:[a-z-]+|nieuw|verborgen|piercing)$/;
    for (const product of products) {
      for (const tag of product.tags) expect(tag, product.handle).toMatch(known);
      expect(new Set(product.tags).size, product.handle).toBe(product.tags.length);
    }
  });

  it("keeps options and variants consistent, with unique SKUs", () => {
    const skus: string[] = [];
    for (const product of products) {
      if (product.options.length === 0) {
        expect(product.variants.map((v) => [v.title, v.selectedOptions]), product.handle).toEqual([["Standaard", []]]);
      } else {
        expect(product.options, product.handle).toHaveLength(1);
        const [option] = product.options;
        expect(option.values, product.handle).toEqual(product.variants.map((variant) => variant.title));
        for (const variant of product.variants) expect(variant.selectedOptions).toEqual([{ name: option.name, value: variant.title }]);
        const expectedName = product.tags.includes("type:ringen") ? "Maat" : product.isGiftCard ? "Bedrag" : "Kleur";
        expect(option.name, product.handle).toBe(expectedName);
      }
      for (const variant of product.variants) {
        expect(Number.isSafeInteger(variant.price), product.handle).toBe(true);
        expect(variant.sku, product.handle).toMatch(/^SPK-[A-Z0-9-]+$/);
        skus.push(variant.sku ?? "");
      }
    }
    expect(new Set(skus).size).toBe(skus.length);
  });
});

/** Goud pieces with a part that is not plain metal, and the word their material and spec line use (decision 185). */
const MIXED_PARTS: Record<string, string> = {
  "mila-color-pop": "kleuraccent",
  "sam-schelp-oorbellen": "schelpje",
  "lieke-kralenarmband": "kralen",
  "sterre-hartketting": "kleuraccent",
};

describe("metafields of the pieces (plan §5.4, §6.4, decisions 81, 100, 115)", () => {
  it("fills spec line, material, size, weight, closure, care, statement meter and GPSR placeholders", () => {
    for (const product of jewelry) {
      const m = product.metafields;
      for (const key of ["specRegel", "materiaal", "afmetingen", "gewicht", "sluiting"] as const) {
        expect(m[key]?.trim(), `${product.handle}.${key}`).toBeTruthy();
      }
      expect(m.gewicht, product.handle).toMatch(/^\d+ g$/);
      expect(m.verzorging, product.handle).toBe(pdpCopy.care.default);
      expect(m.nikkelvrij, product.handle).toBeNull();
      expect(m.bestseller, product.handle).toBe(false);
      expect(m.laagstePrijs30d ?? null, product.handle).toBeNull();
      expect({ gpsrFabrikant: m.gpsrFabrikant, gpsrVerantwoordelijkeEu: m.gpsrVerantwoordelijkeEu, gpsrWaarschuwingen: m.gpsrWaarschuwingen }, product.handle).toEqual(GPSR);
    }
  });

  it("uses one material per colour range, plus a placeholder for a part that is not plain metal (decisions 81, 185)", () => {
    for (const product of jewelry) {
      const part = MIXED_PARTS[product.handle];
      const expected = hasZilver(product)
        ? "Roestvrij staal"
        : part
          ? `Roestvrij staal met goudlaag; ${part}: [materiaal van de leverancier invullen]`
          : "Roestvrij staal met goudlaag";
      expect(product.metafields.materiaal, product.handle).toBe(expected);
    }
    expect(jewelry.filter(hasZilver).map((p) => p.handle)).toEqual(["lola-chunky-hoops", "noor-dikke-ringetjes", "mae-mini-hoops", "ivy-dun-armbandje"]);
  });

  it("gives every piece whose description names beads, a shell or colour a material placeholder for that part (decision 185)", () => {
    // "kleur" as a word of its own ("met een kleurtje", "kleurspat"), not inside "goudkleurig" (QA round 1).
    const namesOtherPart = /kral|kraal|schelp|(?<!goud|zilver)kleur|emaille|parel|steentje/i;
    const mixed = jewelry.filter((product) => namesOtherPart.test(product.description)).map((product) => product.handle);
    expect(mixed).toEqual(Object.keys(MIXED_PARTS));
  });

  it("writes the spec line as '<material> · <size>', without a plating word for Goud and Zilver (decisions 115, 185)", () => {
    for (const product of jewelry) {
      const spec = product.metafields.specRegel ?? "";
      const part = MIXED_PARTS[product.handle];
      const pattern = hasZilver(product)
        ? /^Staal, goud- of zilverkleurig · \S/
        : part === "kralen"
          ? /^Kralen met verguld staal · \S/
          : part
            ? new RegExp(`^Verguld staal met ${part} · \\S`)
            : /^Verguld staal · \S/;
      expect(spec, product.handle).toMatch(pattern);
      if (hasZilver(product)) expect(spec, product.handle).not.toMatch(/verguld|goudlaag/i);
    }
  });

  it("rates chunky pieces 4 or 5 and subtle pieces 1 or 2 on the statement meter", () => {
    for (const product of jewelry) {
      const meter = product.metafields.statementMeter;
      expect([1, 2, 3, 4, 5], product.handle).toContain(meter);
      if (product.tags.includes("vibe:chunky-en-bold")) expect([4, 5], product.handle).toContain(meter);
      if (product.tags.includes("vibe:clean-en-classy")) expect([1, 2], product.handle).toContain(meter);
    }
  });

  it("writes a short styling text of one or two sentences for every product", () => {
    for (const product of products) {
      const sentences = product.description.split(/[.?]\s+/).filter(Boolean);
      expect(sentences.length, product.handle).toBeGreaterThanOrEqual(1);
      expect(sentences.length, product.handle).toBeLessThanOrEqual(3);
      expect(product.description.length, product.handle).toBeLessThan(200);
    }
  });
});

describe("gift wrap and gift card (plan §5.4, §12.2)", () => {
  it("has a hidden gift wrap of €1,95 with one Standaard variant and stock 999", () => {
    const wrap = byHandle(giftWrap.productHandle);
    expect(wrap.tags).toEqual(["type:cadeauverpakking", "verborgen"]);
    expect(wrap.options).toEqual([]);
    expect(wrap.variants.map((v) => [v.title, v.price, v.quantityAvailable])).toEqual([["Standaard", giftWrap.price.cents, 999]]);
    expect(wrap.isGiftCard ?? false).toBe(false);
    expect({ gpsrFabrikant: wrap.metafields.gpsrFabrikant, gpsrVerantwoordelijkeEu: wrap.metafields.gpsrVerantwoordelijkeEu, gpsrWaarschuwingen: wrap.metafields.gpsrWaarschuwingen }).toEqual(GPSR);
  });

  it("has a digital gift card in the amounts of content/offers.ts, without stock tracking", () => {
    const card = byHandle(giftCards.productHandle);
    expect(card.isGiftCard).toBe(true);
    expect(card.tags).toEqual(["type:cadeaukaart"]);
    expect(card.variants.map((v) => [v.title, v.price, v.quantityAvailable])).toEqual(
      giftCards.denominations.map((amount) => [formatMoneyShort(amount), amount, null]),
    );
    expect(card.variants.map((v) => v.title)).toEqual(["€15", "€25", "€50"]);
    expect(card.metafields.gpsrFabrikant ?? null).toBeNull();
  });
});

describe("tests/fixtures/catalog.ts agrees with content/products.ts", () => {
  it("has the same handle, title, type, tags, variants, prices, stock, favourite and rank for every fixed piece", () => {
    for (const piece of Object.values(pieces)) {
      const product = byHandle(piece.handle);
      const rank = products.indexOf(product) + 1;
      expect(piece.featuredRank, piece.handle).toBe(rank);
      expect(piece.title, piece.handle).toBe(product.title);
      expect(piece.type, piece.handle).toBe(tagValues(product, "type:")[0]);
      expect(piece.tags.vibes, piece.handle).toEqual(tagValues(product, "vibe:"));
      expect(piece.tags.moments, piece.handle).toEqual(tagValues(product, "moment:"));
      expect(piece.tags.drops, piece.handle).toEqual(tagValues(product, "drop:"));
      expect(piece.tags.nieuw, piece.handle).toBe(product.tags.includes("nieuw"));
      expect(piece.tags.verborgen, piece.handle).toBe(product.tags.includes("verborgen"));
      expect(piece.variants.map((v) => [v.title, v.price.cents, v.quantityAvailable]), piece.handle).toEqual(
        product.variants.map((v) => [v.title, v.price, v.quantityAvailable]),
      );
      expect(piece.options, piece.handle).toEqual(product.options);
      expect(piece.lindesFavoriet, piece.handle).toBe(product.metafields.lindesFavoriet === true);
      expect(piece.isGiftCard, piece.handle).toBe(product.isGiftCard === true);
    }
  });

  it("lists the Holiday Sparkle pieces in content/drops.ts", () => {
    const holiday = drops.find((drop) => drop.slug === "holiday-sparkle");
    expect(holiday?.productHandles).toEqual(TABLE.filter((row) => row.extraTags.includes("drop:holiday-sparkle")).map((row) => row.handle));
  });
});

/* -------------------------------------------------------------------------- */
/* data/shopify-products.csv                                                  */
/* -------------------------------------------------------------------------- */

/** The metafields of plan §6.4, as "<key> (product.metafields.custom.<key>)" columns (Shopify's product CSV syntax). */
const METAFIELDS: Array<[key: string, field: keyof ProductMetafields]> = [
  ["spec_regel", "specRegel"],
  ["materiaal", "materiaal"],
  ["afmetingen", "afmetingen"],
  ["gewicht", "gewicht"],
  ["sluiting", "sluiting"],
  ["verzorging", "verzorging"],
  ["statement_meter", "statementMeter"],
  ["nikkelvrij", "nikkelvrij"],
  ["gpsr_fabrikant", "gpsrFabrikant"],
  ["gpsr_verantwoordelijke_eu", "gpsrVerantwoordelijkeEu"],
  ["gpsr_waarschuwingen", "gpsrWaarschuwingen"],
  ["laagste_prijs_30d", "laagstePrijs30d"],
  ["bestseller", "bestseller"],
  ["lindes_favoriet", "lindesFavoriet"],
];
const metafieldColumn = (key: string) => `${key} (product.metafields.custom.${key})`;

/** Column names of Shopify's current product CSV template; Shopify still accepts the older names too. */
const COLUMNS = [
  "Title",
  "URL handle",
  "Description",
  "Vendor",
  "Product category",
  "Type",
  "Tags",
  "Published on online store",
  "Status",
  "SKU",
  "Option1 name",
  "Option1 value",
  "Price",
  "Compare-at price",
  "Charge tax",
  "Inventory tracker",
  "Inventory quantity",
  "Continue selling when out of stock",
  "Weight value (grams)",
  "Weight unit for display",
  "Requires shipping",
  "Fulfillment service",
  "Product image URL",
  "Image position",
  "Image alt text",
  "Gift card",
  "SEO title",
  "SEO description",
  ...METAFIELDS.map(([key]) => metafieldColumn(key)),
];

const CATEGORY: Record<string, string> = {
  oorbellen: "Apparel & Accessories > Jewelry > Earrings",
  armbanden: "Apparel & Accessories > Jewelry > Bracelets",
  kettingen: "Apparel & Accessories > Jewelry > Necklaces",
  ringen: "Apparel & Accessories > Jewelry > Rings",
};

/** RFC 4180: quoted fields may hold commas, doubled quotes and line breaks. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** "19.95": Shopify's decimal amount, from integer cents. */
const decimal = (cents: number) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function metafieldCell(value: ProductMetafields[keyof ProductMetafields] | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") return JSON.stringify({ amount: decimal((value as Money).cents), currency_code: (value as Money).currency });
  return value;
}

describe("data/shopify-products.csv (plan §5.4, §16.9 point 2)", () => {
  const raw = readFileSync(fileURLToPath(new URL("../data/shopify-products.csv", import.meta.url)), "utf8");
  const [header, ...rows] = parseCsv(raw);
  const records = rows.map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])) as Record<string, string>);
  const inCsv = products.filter((product) => !product.isGiftCard);

  it("is UTF-8 without BOM, with one header row of Shopify columns and the metafield columns of §6.4", () => {
    expect(raw.charCodeAt(0)).not.toBe(0xfeff);
    expect(raw.endsWith("\n")).toBe(true);
    expect(header).toEqual(COLUMNS);
    for (const cells of rows) expect(cells).toHaveLength(COLUMNS.length);
  });

  it("has every product except the gift card, in catalog order, one row per variant", () => {
    const handles = records.map((record) => record["URL handle"]);
    const expected = inCsv.flatMap((product) => product.variants.map(() => product.handle));
    expect(handles).toEqual(expected);
    expect(handles).not.toContain(giftCards.productHandle);
  });

  it("fills the product columns on the first row of each product and leaves them empty on variant rows", () => {
    for (const product of inCsv) {
      const [first, ...rest] = records.filter((record) => record["URL handle"] === product.handle);
      const type = tagValues(product, "type:")[0];
      expect(first.Title, product.handle).toBe(product.title);
      expect(first.Description, product.handle).toBe(`<p>${escapeHtml(product.description)}</p>`);
      expect(first.Vendor, product.handle).toBe("Sparkela");
      expect(first["Product category"], product.handle).toBe(CATEGORY[type] ?? "");
      expect(first.Type, product.handle).toBe(sharedCopy.vocab.type[type as JewelryType] ?? product.title);
      expect(first.Tags.split(", "), product.handle).toEqual(product.tags);
      // Draft and not on the Online Store: Tristan checks, then publishes in the Headless channel only (decision 109).
      expect(first["Published on online store"], product.handle).toBe("FALSE");
      expect(first.Status, product.handle).toBe("draft");
      expect(first["Gift card"], product.handle).toBe("FALSE");
      for (const [key, field] of METAFIELDS) {
        expect(first[metafieldColumn(key)], `${product.handle} ${key}`).toBe(metafieldCell(product.metafields[field]));
      }
      const productColumns = ["Title", "Description", "Vendor", "Product category", "Type", "Tags", "Published on online store", "Status", "Gift card", "Option1 name", ...METAFIELDS.map(([key]) => metafieldColumn(key))];
      for (const record of rest) {
        for (const column of productColumns) expect(record[column], `${product.handle} ${column} on a variant row`).toBe("");
      }
    }
  });

  it("matches every variant: option, SKU, price, stock and weight", () => {
    for (const product of inCsv) {
      const variantRows = records.filter((record) => record["URL handle"] === product.handle);
      const grams = product.metafields.gewicht ? Number.parseInt(product.metafields.gewicht, 10) : 0;
      product.variants.forEach((variant, index) => {
        const record = variantRows[index];
        const where = `${product.handle} ${variant.title}`;
        if (index === 0) expect(record["Option1 name"], where).toBe(product.options[0]?.name ?? "Title");
        // A product without options has Shopify's single "Default Title" variant.
        expect(record["Option1 value"], where).toBe(product.options.length > 0 ? variant.title : "Default Title");
        expect(record.SKU, where).toBe(variant.sku);
        expect(record.Price, where).toBe(decimal(variant.price));
        expect(record["Compare-at price"], where).toBe(variant.compareAtPrice ? decimal(variant.compareAtPrice) : "");
        expect(record["Inventory quantity"], where).toBe(String(variant.quantityAvailable));
        expect(record["Weight value (grams)"], where).toBe(String(grams));
        expect(
          [record["Charge tax"], record["Inventory tracker"], record["Continue selling when out of stock"], record["Weight unit for display"], record["Requires shipping"], record["Fulfillment service"]],
          where,
        ).toEqual(["TRUE", "shopify", "deny", "g", "TRUE", "manual"]);
        expect([record["Product image URL"], record["Image position"], record["Image alt text"]], where).toEqual(["", "", ""]);
      });
    }
  });
});
