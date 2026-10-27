import { formatMoneyShort } from "@/lib/money";
import type { CollectionDefinition } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";
import { EARLY_ACCESS_HOURS } from "@/content/drops";
import { stackDiscount } from "@/content/offers";

/**
 * Collections (docs/PLAN.md §2.3, decision 26). Membership follows the product tags through the rule, the same
 * for both providers; Shopify gets the same automatic collections. "Stacks" and "Cadeaukaarten" are pages, not
 * collections. bannerImage and stylingTile are optional; they use the site photos of content/assets.ts that launch
 * needs anyway (moment tiles, Statement/subtiel, Linde, stacks), so no collection waits for an extra shot.
 */

const { type, vibe, moment } = sharedCopy.vocab;

/** Rule of "Cadeaus onder €25": minimum variant price below this (plan §2.3). */
const GIFT_LIMIT_CENTS = 2500;
const giftLimit = formatMoneyShort(GIFT_LIMIT_CENTS);

/**
 * Where a styling tile goes: after this many products. CollectionView snaps it to a multiple of 12 (a row start in 2, 3
 * and 4 columns) or to the end of a shorter grid, and lets it span the cells the last row would leave empty, so the
 * unfiltered grid has no ragged rows (components/collection/filterParams.ts, stylingTilePlacement).
 */
const STYLING_TILE_AFTER = 12;

type StylingTileContent = NonNullable<CollectionDefinition["stylingTile"]>;

/**
 * Every collection has a styling tile (fix 7-9: "aligned grids, no ragged rows"): it fills the cells the last row
 * leaves empty. Each one points somewhere that fits the collection: the Spark Finder, the stacks (only where the pieces
 * count for the stack discount: earrings and bracelets), the ring size, the Club or the gift cards.
 */
function tile(title: string, text: string, image: StylingTileContent["image"], href: string): StylingTileContent {
  return { afterIndex: STYLING_TILE_AFTER, title, text, image, href };
}

const finderTile = (title: string) =>
  tile(title, "Doe de Spark Finder. Drie vragen, en Linde laat zien welke stukken bij jouw vibe passen.", "linde.portret", "/spark-finder");

const stacksTile = (image: StylingTileContent["image"]) =>
  tile(
    "Maak er een stack van",
    `Drie oorbellen of armbanden die samen kloppen. Vanaf ${stackDiscount.minUnits} stuks krijg je ${stackDiscount.percent}% stack-korting.`,
    image,
    "/stacks",
  );

const giftCardTile = tile(
  "Liever zelf laten kiezen?",
  "Geef een cadeaukaart. Dan kiest de ontvanger zelf een spark, en de kaart staat meteen in de mail.",
  "linde.portret",
  "/cadeaukaarten",
);

export const collections: CollectionDefinition[] = [
  {
    handle: "alle",
    title: "Alle sieraden",
    intro: "Alles van Sparkela op een rij. Chunky, kleurig of juist subtiel: filter op wat bij je past.",
    seo: {
      title: "Alle sieraden",
      description: "Bekijk alle sieraden van Sparkela: statement oorbellen, armbanden, kettingen en ringen.",
    },
    rule: { kind: "all" },
    bannerImage: null,
    stylingTile: {
      afterIndex: STYLING_TILE_AFTER,
      title: "Twijfel je nog?",
      text: "Doe de Spark Finder. Drie vragen, en Linde laat zien welke stukken bij jouw vibe passen.",
      image: "linde.portret",
      href: "/spark-finder",
    },
  },
  {
    handle: "nieuw",
    title: "Nieuw",
    intro: "Net binnen en klaar om te stylen. Dit zijn de nieuwste stukken van Linde.",
    seo: {
      title: "Nieuw binnen",
      description: "De nieuwste sieraden van Sparkela: chunky oorbellen, armbanden en meer, net binnen.",
    },
    rule: { kind: "tag", tag: "nieuw" },
    bannerImage: null,
    stylingTile: finderTile("Twijfel je nog?"),
  },
  {
    handle: "oorbellen",
    title: type.oorbellen,
    intro: "Eén paar oorbellen maakt je hele outfit af. Van chunky hoops tot kleurige druppels.",
    seo: {
      title: "Oorbellen",
      description: "Statement oorbellen van Sparkela: chunky hoops, druppels en kleurige stukken.",
    },
    rule: { kind: "type", type: "oorbellen" },
    bannerImage: null,
    stylingTile: {
      afterIndex: STYLING_TILE_AFTER,
      title: "Maak er een stack van",
      text: `Combineer je oorbellen met twee armbanden of nog een paar. Vanaf ${stackDiscount.minUnits} stuks krijg je ${stackDiscount.percent}% stack-korting.`,
      image: "stacks.goud-en-gedurfd",
      href: "/stacks",
    },
  },
  {
    handle: "armbanden",
    title: type.armbanden,
    intro: "Schakels, bangles en kralen om te stacken. Combineer er drie en je krijgt stack-korting.",
    seo: {
      title: "Armbanden",
      description: "Armbanden van Sparkela om te stacken: schakelarmbanden, bangles en kralen.",
    },
    rule: { kind: "type", type: "armbanden" },
    bannerImage: null,
    stylingTile: {
      afterIndex: STYLING_TILE_AFTER,
      title: "Stacks van Linde",
      text: `Drie stuks die samen kloppen, met één knop in je tas. De ${stackDiscount.percent}% stack-korting gaat er vanzelf af.`,
      image: "stacks.kleur-op-je-pols",
      href: "/stacks",
    },
  },
  {
    handle: "kettingen",
    title: type.kettingen,
    intro: "Van een dikke schakel tot een fijne ketting met hanger. Draag ze los of samen.",
    seo: {
      title: "Kettingen",
      description: "Kettingen van Sparkela: dikke schakels, munten en fijne kettinkjes.",
    },
    rule: { kind: "type", type: "kettingen" },
    bannerImage: null,
    stylingTile: finderTile("Welke ketting past bij jou?"),
  },
  {
    handle: "ringen",
    title: type.ringen,
    intro: "Ringen die je ziet. Chunky of met een zegel, in jouw maat.",
    seo: {
      title: "Ringen",
      description: "Ringen van Sparkela: chunky ringen en zegelringen in meerdere maten.",
    },
    rule: { kind: "type", type: "ringen" },
    bannerImage: null,
    stylingTile: tile(
      "Welke ringmaat heb je?",
      "Meet de binnenkant van een ring die goed past. Zit je tussen twee maten in? Kies dan de grootste.",
      "linde.portret",
      "/veelgestelde-vragen",
    ),
  },
  {
    handle: "subtiel",
    title: "Subtiel en klassiek",
    intro: `Liever iets kleiners? Deze stukken zijn ${vibe["clean-en-classy"].toLowerCase()} en passen bij alles.`,
    seo: {
      title: "Subtiel en klassiek",
      description: "Subtiele, klassieke sieraden van Sparkela: kleine hoops, fijne kettingen en dunne armbandjes.",
    },
    rule: { kind: "vibe", vibe: "clean-en-classy" },
    bannerImage: "home.subtiel",
    stylingTile: finderTile("Toch iets meer spark?"),
  },
  {
    handle: "limited",
    title: "Limited",
    intro: "Stukken uit de drop die nu live is. Je vindt ze hier zolang de drop loopt.",
    seo: {
      title: "Limited",
      description: "Limited sieraden van Sparkela uit de drop die nu live is.",
    },
    rule: { kind: "drop" },
    bannerImage: null,
    stylingTile: tile(
      "Als eerste bij de volgende drop",
      `In de Sparkela Club hoor je het eerst wanneer er een drop komt, en je shopt ${EARLY_ACCESS_HOURS} uur eerder.`,
      "club.hero",
      "/sparkela-club",
    ),
  },
  {
    handle: "festival",
    title: moment.festival,
    intro: "Groot, kleurig en gemaakt om te dansen. Sieraden die opvallen in de menigte.",
    seo: {
      title: "Sieraden voor festivals",
      description: "Festivalsieraden van Sparkela: chunky en kleurige oorbellen en armbanden.",
    },
    rule: { kind: "moment", moment: "festival" },
    bannerImage: "momenten.festival",
    stylingTile: stacksTile("stacks.kleur-op-je-pols"),
  },
  {
    handle: "date-night",
    title: moment["date-night"],
    intro: "Een beetje glans voor een avond uit. Goud dat het licht vangt.",
    seo: {
      title: "Sieraden voor date night",
      description: "Sieraden voor een avond uit: statement oorbellen en kettingen van Sparkela.",
    },
    rule: { kind: "moment", moment: "date-night" },
    bannerImage: "momenten.date-night",
    stylingTile: finderTile("Op zoek naar jouw look?"),
  },
  {
    handle: "kantoor-maar-niet-saai",
    title: moment["kantoor-maar-niet-saai"],
    intro: "Net genoeg spark voor een werkdag. Opvallend, maar niet te veel.",
    seo: {
      title: "Sieraden voor op kantoor",
      description: "Sieraden voor op kantoor die toch opvallen: ringetjes, schakels en munten van Sparkela.",
    },
    rule: { kind: "moment", moment: "kantoor-maar-niet-saai" },
    bannerImage: "momenten.kantoor-maar-niet-saai",
    stylingTile: stacksTile("stacks.kantoor-maar-niet-saai"),
  },
  {
    handle: "strand",
    title: moment.strand,
    intro: "Licht, zonnig en klaar voor de vakantie. Schelpen, kralen en kleur.",
    seo: {
      title: "Sieraden voor het strand",
      description: "Zomerse sieraden van Sparkela: schelpen, kralen en kleurige oorbellen.",
    },
    rule: { kind: "moment", moment: "strand" },
    bannerImage: "momenten.strand",
    stylingTile: stacksTile("stacks.kleur-op-je-pols"),
  },
  {
    handle: "feestdagen",
    title: moment.feestdagen,
    intro: "Goud en glitter voor kerst en oud en nieuw. Ook een mooi cadeau.",
    seo: {
      title: "Sieraden voor de feestdagen",
      description: "Feestelijke sieraden van Sparkela voor kerst en oud en nieuw.",
    },
    rule: { kind: "moment", moment: "feestdagen" },
    bannerImage: "momenten.feestdagen",
    stylingTile: giftCardTile,
  },
  {
    handle: "onder-25",
    title: `Cadeaus onder ${giftLimit}`,
    intro: "Een cadeautje met een spark, zonder dat het veel kost. Voor een ander of voor jezelf.",
    seo: {
      title: `Cadeaus onder ${giftLimit}`,
      description: `Sieraden van Sparkela onder ${giftLimit}: kleine cadeaus met een spark.`,
    },
    rule: { kind: "maxPrice", cents: GIFT_LIMIT_CENTS },
    bannerImage: null,
    stylingTile: giftCardTile,
  },
];
