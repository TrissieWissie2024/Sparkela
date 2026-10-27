import { formatMoneyShort } from "@/lib/money";
import type { Cents, LocalProductInput, ProductMetafields, ProductOption, SelectedOption } from "@/lib/types";
import { pdpCopy } from "@/content/copy/pdp";
import { giftCards, giftWrap } from "@/content/offers";

/**
 * Local test catalog (docs/PLAN.md §5.4, decisions 70 and 81): 24 made-up pieces plus cadeauverpakking and
 * cadeaukaart. Made-up names, prices ending in ,95, no real brands, no supplier text and no photos (cards show
 * "FOTO: …" placeholders). Handles, prices and stock are fixed: unit and e2e tests use them (content/products.test.ts
 * pins the §5.4 table). featuredRank is the position in this array. data/shopify-products.csv mirrors every entry
 * except the gift card, which Tristan creates as a Shopify gift card.
 *
 * Only lib/commerce/local-data.ts and tests import this file; client components never do.
 *
 * Tags follow plan §6.2: "type:…", "vibe:…", "moment:…", "drop:…" and the plain tags "nieuw" and "verborgen".
 * No test piece is tagged "piercing"; the hygiene rule for piercings is ready for later (decision 80).
 *
 * Material (decision 81): pieces in Goud only get "Roestvrij staal met goudlaag"; pieces in Goud and Zilver get
 * "Roestvrij staal" and a spec line without a plating word (decision 115). A Goud piece whose description names a
 * part that is not plain metal (beads, shell, colour) gets materiaalMet() and a spec line that names that part
 * (decision 185). The text shown per variant always comes
 * from materialForVariant(). nikkelvrij stays null (not confirmed by the supplier). GPSR fields are bracketed
 * placeholders until the supplier delivers them (decision 100): never write safety text yourself.
 */

/** publishedAt of every piece (plan §5.4). */
const PUBLISHED_AT = "2026-11-20T12:00:00+01:00";
/** publishedAt of the pieces tagged "nieuw": a little newer, so sorting by "nieuwste" means something. */
const PUBLISHED_AT_NIEUW = "2026-11-25T12:00:00+01:00";

/** materiaal of pieces that only come in Goud (decision 81). */
const MATERIAAL_GOUD = "Roestvrij staal met goudlaag";
/** materiaal of pieces in Goud and Zilver; materialForVariant() adds or drops "met goudlaag" per variant. */
const MATERIAAL_TWEE_KLEUREN = "Roestvrij staal";

/**
 * materiaal of a Goud piece with a part that is not plain metal (beads, a shell, a colour accent; decision 185): the
 * gold-plated steel plus a bracketed placeholder for that part, until the supplier names its material. Never guess it.
 */
function materiaalMet(part: string): string {
  return `${MATERIAAL_GOUD}; ${part}: [materiaal van de leverancier invullen]`;
}

/** GPSR placeholders (decision 100). The Shopify catalog warns in the build for every field that still has "[". */
const gpsrPlaceholders = {
  gpsrFabrikant: "[Fabrikant, adres]",
  gpsrVerantwoordelijkeEu: "[Verantwoordelijke in de EU]",
  gpsrWaarschuwingen: "[Waarschuwingen van de leverancier invullen]",
} satisfies Partial<ProductMetafields>;

/** Metafields every piece shares until the supplier and Linde deliver the real values. */
const sharedMetafields = {
  ...gpsrPlaceholders,
  verzorging: pdpCopy.care.default,
  nikkelvrij: null,
  laagstePrijs30d: null,
  bestseller: false,
} satisfies Partial<ProductMetafields>;

type Kleur = "Goud" | "Zilver";
type LocalVariant = LocalProductInput["variants"][number];

const KLEUR = "Kleur";
const MAAT = "Maat";
const BEDRAG = "Bedrag";

function option(name: string, values: string[]): ProductOption {
  return { name, values };
}

function selected(name: string, value: string): SelectedOption[] {
  return [{ name, value }];
}

/** A colour variant: "Goud" or "Zilver", SKU "SPK-<nr>-GOUD". */
function kleur(nr: string, value: Kleur, price: Cents, quantityAvailable: number): LocalVariant {
  return { title: value, price, quantityAvailable, sku: `SPK-${nr}-${value.toUpperCase()}`, selectedOptions: selected(KLEUR, value) };
}

/** A ring size in mm: "16" to "19", SKU "SPK-<nr>-<maat>". */
function maat(nr: string, value: string, price: Cents, quantityAvailable: number): LocalVariant {
  return { title: value, price, quantityAvailable, sku: `SPK-${nr}-${value}`, selectedOptions: selected(MAAT, value) };
}

const ringSizes = ["16", "17", "18", "19"];

export const products: LocalProductInput[] = [
  /* ------------------------------------------------------------------------ */
  /* Statement earrings (1 to 7)                                              */
  /* ------------------------------------------------------------------------ */
  {
    handle: "lola-chunky-hoops",
    title: "Lola chunky hoops",
    description:
      "Dikke, glanzende hoops die je outfit in één keer afmaken. Draag ze bij een wit shirt, of juist bij alles tegelijk.",
    tags: ["type:oorbellen", "vibe:chunky-en-bold", "vibe:retro", "moment:festival", "moment:date-night", "nieuw"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Staal, goud of zilver · 30 mm",
      materiaal: MATERIAAL_TWEE_KLEUREN,
      afmetingen: "Doorsnede 30 mm, dikte 6 mm",
      gewicht: "8 g",
      sluiting: "Klapsluiting",
      statementMeter: 5,
      lindesFavoriet: true,
    },
    options: [option(KLEUR, ["Goud", "Zilver"])],
    variants: [kleur("001", "Goud", 1995, 25), kleur("001", "Zilver", 1995, 12)],
    images: [],
    publishedAt: PUBLISHED_AT_NIEUW,
  },
  {
    handle: "bo-statement-druppels",
    title: "Bo statement druppels",
    description:
      "Grote gouden druppels die bij elke beweging het licht vangen. Zet ze bij een simpele zwarte top en je bent klaar.",
    tags: ["type:oorbellen", "vibe:chunky-en-bold", "moment:date-night", "moment:feestdagen", "nieuw"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · 45 mm",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Lengte 45 mm, breedte 22 mm",
      gewicht: "10 g",
      sluiting: "Oorsteker met stopper",
      statementMeter: 5,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("002", "Goud", 2295, 3)],
    images: [],
    publishedAt: PUBLISHED_AT_NIEUW,
  },
  {
    handle: "mila-color-pop",
    title: "Mila color pop",
    description: "Een vrolijke kleurspat aan je oor, op een gouden basis. Je outfit mag simpel blijven, Mila doet de rest.",
    tags: ["type:oorbellen", "vibe:kleurrijk-en-speels", "moment:festival", "moment:strand"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal met kleuraccent · 35 mm",
      materiaal: materiaalMet("kleuraccent"),
      afmetingen: "Lengte 35 mm, hanger 15 mm",
      gewicht: "6 g",
      sluiting: "Oorsteker met stopper",
      statementMeter: 3,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("003", "Goud", 1795, 18)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },
  {
    handle: "fenna-retro-schijfjes",
    title: "Fenna retro schijfjes",
    description:
      "Platte gouden schijfjes met een knipoog naar de jaren zeventig. Strak genoeg voor kantoor, leuk genoeg voor de borrel erna.",
    tags: ["type:oorbellen", "vibe:retro", "moment:kantoor-maar-niet-saai", "moment:date-night"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · 20 mm",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Doorsnede 20 mm",
      gewicht: "5 g",
      sluiting: "Oorsteker met stopper",
      statementMeter: 3,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("004", "Goud", 1695, 20)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },
  {
    handle: "noor-dikke-ringetjes",
    title: "Noor dikke ringetjes",
    description:
      "Kleine ringetjes, maar lekker dik. Ze doen het overal: op kantoor, in het weekend en naast een paar andere oorbellen.",
    tags: ["type:oorbellen", "vibe:chunky-en-bold", "moment:kantoor-maar-niet-saai", "nieuw"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Staal, goud of zilver · 15 mm",
      materiaal: MATERIAAL_TWEE_KLEUREN,
      afmetingen: "Doorsnede 15 mm, dikte 5 mm",
      gewicht: "4 g",
      sluiting: "Klapsluiting",
      statementMeter: 4,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud", "Zilver"])],
    variants: [kleur("005", "Goud", 1495, 30), kleur("005", "Zilver", 1495, 30)],
    images: [],
    publishedAt: PUBLISHED_AT_NIEUW,
  },
  {
    handle: "jet-vonk-oorbellen",
    title: "Jet vonk oorbellen",
    description:
      "Een gouden vonk voor als je outfit wel wat extra mag. Draag ze met je haar omhoog, dan zie je ze het best.",
    tags: ["type:oorbellen", "vibe:chunky-en-bold", "moment:feestdagen", "moment:date-night", "nieuw"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · 30 mm",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Lengte 30 mm, breedte 30 mm",
      gewicht: "7 g",
      sluiting: "Oorsteker met stopper",
      statementMeter: 5,
      lindesFavoriet: true,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("006", "Goud", 2495, 15)],
    images: [],
    publishedAt: PUBLISHED_AT_NIEUW,
  },
  {
    handle: "sam-schelp-oorbellen",
    title: "Sam schelp oorbellen",
    description:
      "Kleine gouden hoops met een schelpje eraan. Vakantiegevoel, ook als je gewoon op de fiets naar college gaat.",
    tags: ["type:oorbellen", "vibe:kleurrijk-en-speels", "moment:strand", "moment:festival"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal met schelpje · 25 mm",
      materiaal: materiaalMet("schelpje"),
      afmetingen: "Lengte 25 mm, hoop 15 mm",
      gewicht: "4 g",
      sluiting: "Klapsluiting",
      statementMeter: 3,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("007", "Goud", 1595, 22)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },

  /* ------------------------------------------------------------------------ */
  /* Bracelets (8 to 11)                                                      */
  /* ------------------------------------------------------------------------ */
  {
    handle: "tess-schakelarmband",
    title: "Tess schakelarmband",
    description: "Een stevige schakelarmband met flink wat goud. Mooi alleen, nog mooier met twee anderen erbij.",
    tags: ["type:armbanden", "vibe:chunky-en-bold", "moment:kantoor-maar-niet-saai", "moment:date-night", "nieuw"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · 19 cm",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Lengte 19 cm, schakel 8 mm",
      gewicht: "16 g",
      sluiting: "Karabijnsluiting",
      statementMeter: 4,
      lindesFavoriet: true,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("008", "Goud", 1995, 25)],
    images: [],
    publishedAt: PUBLISHED_AT_NIEUW,
  },
  {
    handle: "roos-brede-bangle",
    title: "Roos brede bangle",
    description:
      "Een brede gouden bangle die je pols meteen een statement geeft. Schuif er een dun armbandje naast voor een volle stack.",
    tags: ["type:armbanden", "vibe:retro", "vibe:chunky-en-bold", "moment:festival"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · 20 mm breed",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Binnendoorsnede 6,5 cm, breedte 20 mm",
      gewicht: "24 g",
      sluiting: "Open model, zonder sluiting",
      statementMeter: 5,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("009", "Goud", 2195, 14)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },
  {
    handle: "lieke-kralenarmband",
    title: "Lieke kralenarmband",
    description: "Kleurige kralen met gouden accentjes, op elastiek. Draag er één, of schuif er drie tegelijk om.",
    tags: ["type:armbanden", "vibe:kleurrijk-en-speels", "moment:strand", "moment:festival"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Kralen met verguld staal · 18 cm",
      materiaal: materiaalMet("kralen"),
      afmetingen: "Lengte 18 cm, rekbaar, kralen 4 mm",
      gewicht: "6 g",
      sluiting: "Elastiek, zonder sluiting",
      statementMeter: 3,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("010", "Goud", 1395, 40)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },
  {
    handle: "isa-dubbele-schakel",
    title: "Isa dubbele schakel",
    description:
      "Twee rijen dikke schakels in één armband. Een stuk dat je outfit draagt, ook als je verder alles simpel houdt.",
    tags: ["type:armbanden", "vibe:chunky-en-bold", "moment:feestdagen"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · 19 cm",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Lengte 19 cm, twee rijen schakels van 6 mm",
      gewicht: "22 g",
      sluiting: "Karabijnsluiting",
      statementMeter: 5,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud"])],
    // Sold out on purpose: tests use it for the "Uitverkocht" state and the sort order (decision 42).
    variants: [kleur("011", "Goud", 2695, 0)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },

  /* ------------------------------------------------------------------------ */
  /* Necklaces (12 to 14)                                                     */
  /* ------------------------------------------------------------------------ */
  {
    handle: "evi-dikke-schakelketting",
    title: "Evi dikke schakelketting",
    description:
      "Een dikke gouden schakelketting die je outfit in één keer afmaakt. Mooi op een zwarte top of over een coltrui.",
    tags: ["type:kettingen", "vibe:chunky-en-bold", "moment:date-night", "nieuw"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · 45 cm",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Lengte 45 cm, schakel 10 mm",
      gewicht: "38 g",
      sluiting: "Karabijnsluiting",
      statementMeter: 5,
      lindesFavoriet: true,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("012", "Goud", 2795, 12)],
    images: [],
    publishedAt: PUBLISHED_AT_NIEUW,
  },
  {
    handle: "femke-muntketting",
    title: "Femke muntketting",
    description: "Een fijne ketting met een gouden muntje. Een beetje retro, en toch draag je hem gewoon elke dag.",
    tags: ["type:kettingen", "vibe:retro", "moment:kantoor-maar-niet-saai"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · 42 cm",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Lengte 42 cm plus 5 cm verlengketting, munt 18 mm",
      gewicht: "12 g",
      sluiting: "Karabijnsluiting",
      statementMeter: 3,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("013", "Goud", 2395, 16)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },
  {
    handle: "sterre-hartketting",
    title: "Sterre hartketting",
    description: "Een gouden hartje met een kleurtje, aan een fijne ketting. Lief, maar met een randje.",
    tags: ["type:kettingen", "vibe:kleurrijk-en-speels", "vibe:retro", "moment:date-night"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal met kleuraccent · 45 cm",
      materiaal: materiaalMet("kleuraccent"),
      afmetingen: "Lengte 45 cm, hart 15 mm",
      gewicht: "9 g",
      sluiting: "Karabijnsluiting",
      statementMeter: 3,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("014", "Goud", 2195, 10)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },

  /* ------------------------------------------------------------------------ */
  /* Rings (15 and 16), sizes in mm inside diameter                           */
  /* ------------------------------------------------------------------------ */
  {
    handle: "nina-chunky-ring",
    title: "Nina chunky ring",
    description: "Een dikke gouden ring die je ziet zodra je zwaait. Twijfel je over je maat? Kijk even in de ringmaatgids.",
    tags: ["type:ringen", "vibe:chunky-en-bold", "moment:festival", "moment:date-night", "nieuw"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · 8 mm breed",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Binnendoorsnede 16 tot 19 mm, breedte 8 mm",
      gewicht: "6 g",
      sluiting: "Gesloten ring",
      statementMeter: 5,
      lindesFavoriet: true,
    },
    options: [option(MAAT, ringSizes)],
    // Size 19 has only 2 left: a low-stock variant for tests (the product as a whole has 26).
    variants: [maat("015", "16", 1995, 8), maat("015", "17", 1995, 8), maat("015", "18", 1995, 8), maat("015", "19", 1995, 2)],
    images: [],
    publishedAt: PUBLISHED_AT_NIEUW,
  },
  {
    handle: "vera-zegelring",
    title: "Vera zegelring",
    description: "Een klassieke zegelring met een glad gouden vlak. Draag hem los of samen met een paar dunne ringen.",
    tags: ["type:ringen", "vibe:retro", "moment:kantoor-maar-niet-saai"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · zegel 10 mm",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Binnendoorsnede 16 tot 19 mm, zegel 10 mm",
      gewicht: "5 g",
      sluiting: "Gesloten ring",
      statementMeter: 3,
      lindesFavoriet: false,
    },
    options: [option(MAAT, ringSizes)],
    variants: ringSizes.map((size) => maat("016", size, 1795, 6)),
    images: [],
    publishedAt: PUBLISHED_AT,
  },

  /* ------------------------------------------------------------------------ */
  /* Subtle and classic (17 to 20)                                            */
  /* ------------------------------------------------------------------------ */
  {
    handle: "mae-mini-hoops",
    title: "Mae mini hoops",
    description: "Kleine hoops voor elke dag. Ze passen bij alles, van joggingbroek tot jurk.",
    tags: ["type:oorbellen", "vibe:clean-en-classy", "moment:kantoor-maar-niet-saai"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Staal, goud of zilver · 12 mm",
      materiaal: MATERIAAL_TWEE_KLEUREN,
      afmetingen: "Doorsnede 12 mm, dikte 2 mm",
      gewicht: "2 g",
      sluiting: "Klapsluiting",
      statementMeter: 1,
      lindesFavoriet: true,
    },
    options: [option(KLEUR, ["Goud", "Zilver"])],
    variants: [kleur("017", "Goud", 1295, 30), kleur("017", "Zilver", 1295, 30)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },
  {
    handle: "lou-fijne-schakelketting",
    title: "Lou fijne schakelketting",
    description: "Een fijne schakelketting die je elke dag om kunt. Mooi alleen, of in laagjes met een langere ketting.",
    tags: ["type:kettingen", "vibe:clean-en-classy", "moment:kantoor-maar-niet-saai", "moment:date-night"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · 45 cm",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Lengte 45 cm, schakel 3 mm",
      gewicht: "4 g",
      sluiting: "Karabijnsluiting",
      statementMeter: 2,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("018", "Goud", 1695, 20)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },
  {
    handle: "ivy-dun-armbandje",
    title: "Ivy dun armbandje",
    description: "Een dun armbandje dat overal bij past. De rustige basis onder een stack van chunky stukken.",
    tags: ["type:armbanden", "vibe:clean-en-classy", "moment:kantoor-maar-niet-saai"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Staal, goud of zilver · 18 cm",
      materiaal: MATERIAAL_TWEE_KLEUREN,
      afmetingen: "Lengte 18 cm, schakel 2 mm",
      gewicht: "3 g",
      sluiting: "Karabijnsluiting",
      statementMeter: 1,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud", "Zilver"])],
    variants: [kleur("019", "Goud", 1495, 20), kleur("019", "Zilver", 1495, 20)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },
  {
    handle: "jade-stipjes",
    title: "Jade stipjes",
    description: "Kleine gouden stipjes in je oren. Simpel, en mooi naast een paar hoops in je tweede gaatje.",
    tags: ["type:oorbellen", "vibe:clean-en-classy", "moment:kantoor-maar-niet-saai", "moment:strand"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · 6 mm",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Doorsnede 6 mm",
      gewicht: "1 g",
      sluiting: "Oorsteker met stopper",
      statementMeter: 1,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("020", "Goud", 1295, 35)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },

  /* ------------------------------------------------------------------------ */
  /* Holiday Sparkle drop (21 to 24): tag drop:holiday-sparkle, content/drops */
  /* ------------------------------------------------------------------------ */
  {
    handle: "holiday-ster-oorbellen",
    title: "Ster oorbellen",
    description: "Grote gouden sterren voor de feestdagen. Van kerstdiner tot oudejaarsavond.",
    tags: ["type:oorbellen", "vibe:chunky-en-bold", "moment:feestdagen", "drop:holiday-sparkle"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · 35 mm",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Lengte 35 mm, ster 25 mm",
      gewicht: "7 g",
      sluiting: "Oorsteker met stopper",
      statementMeter: 5,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("021", "Goud", 2495, 20)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },
  {
    handle: "holiday-glitter-hoops",
    title: "Glitter hoops",
    description: "Hoops met een glinsterend randje dat elk lampje vangt. Feestelijk, zonder dat het te veel wordt.",
    tags: ["type:oorbellen", "vibe:kleurrijk-en-speels", "moment:feestdagen", "drop:holiday-sparkle"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · 30 mm",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Doorsnede 30 mm, dikte 3 mm",
      gewicht: "6 g",
      sluiting: "Klapsluiting",
      statementMeter: 3,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("022", "Goud", 2295, 20)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },
  {
    handle: "holiday-sparkle-armband",
    title: "Sparkle armband",
    description: "Een gouden schakelarmband met kleine glinsters. Samen met de Ster oorbellen heb je je kerstlook rond.",
    tags: ["type:armbanden", "vibe:chunky-en-bold", "moment:feestdagen", "drop:holiday-sparkle"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · 19 cm",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Lengte 19 cm, schakel 7 mm",
      gewicht: "14 g",
      sluiting: "Karabijnsluiting",
      statementMeter: 4,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("023", "Goud", 2695, 15)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },
  {
    handle: "holiday-ster-ketting",
    title: "Ster ketting",
    description: "Een gouden ster aan een stevige schakelketting. Draag hem op een zwarte jurk of over je kersttrui.",
    tags: ["type:kettingen", "vibe:chunky-en-bold", "moment:feestdagen", "drop:holiday-sparkle"],
    metafields: {
      ...sharedMetafields,
      specRegel: "Verguld staal · 45 cm",
      materiaal: MATERIAAL_GOUD,
      afmetingen: "Lengte 45 cm, ster 22 mm",
      gewicht: "11 g",
      sluiting: "Karabijnsluiting",
      statementMeter: 4,
      lindesFavoriet: false,
    },
    options: [option(KLEUR, ["Goud"])],
    variants: [kleur("024", "Goud", 2995, 15)],
    images: [],
    publishedAt: PUBLISHED_AT,
  },

  /* ------------------------------------------------------------------------ */
  /* Extras: gift wrap (hidden, only via the cart checkbox) and gift card     */
  /* ------------------------------------------------------------------------ */
  {
    handle: giftWrap.productHandle,
    title: "Cadeauverpakking",
    description: "We pakken je bestelling in als cadeau, klaar om te geven.",
    tags: ["type:cadeauverpakking", "verborgen"],
    // A physical add-on that ships with the order, so it keeps the GPSR placeholders (no PDP: it is never listed).
    metafields: { ...gpsrPlaceholders, nikkelvrij: null, laagstePrijs30d: null, bestseller: false, lindesFavoriet: false },
    options: [],
    variants: [
      { title: "Standaard", price: giftWrap.price.cents, quantityAvailable: 999, sku: "SPK-CADEAUVERPAKKING", selectedOptions: [] },
    ],
    images: [],
    publishedAt: PUBLISHED_AT,
  },
  {
    handle: giftCards.productHandle,
    title: "Cadeaukaart",
    description: "Twijfel je over een cadeau? Met een cadeaukaart kiest de ander zelf. Hij komt direct in de mail.",
    tags: ["type:cadeaukaart"],
    // Digital: no GPSR metafields; the product page shows pdpCopy.gpsr.digital (decision 116).
    metafields: { nikkelvrij: null, laagstePrijs30d: null, bestseller: false, lindesFavoriet: false },
    options: [option(BEDRAG, giftCards.denominations.map((amount) => formatMoneyShort(amount)))],
    variants: giftCards.denominations.map((amount) => ({
      title: formatMoneyShort(amount),
      price: amount,
      quantityAvailable: null,
      sku: `SPK-CADEAUKAART-${amount}`,
      selectedOptions: selected(BEDRAG, formatMoneyShort(amount)),
    })),
    images: [],
    publishedAt: PUBLISHED_AT,
    isGiftCard: true,
  },
];
