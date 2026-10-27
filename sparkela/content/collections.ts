import { formatMoneyShort } from "@/lib/money";
import type { CollectionDefinition } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";

/**
 * Collections (docs/PLAN.md §2.3, decision 26). Membership follows the product tags through the rule, the same
 * for both providers; Shopify gets the same automatic collections. "Stacks" and "Cadeaukaarten" are pages, not
 * collections. bannerImage and stylingTile are optional (collecties.<handle> in content/assets.ts).
 */

const { type, vibe, moment } = sharedCopy.vocab;

/** Rule of "Cadeaus onder €25": minimum variant price below this (plan §2.3). */
const GIFT_LIMIT_CENTS = 2500;
const giftLimit = formatMoneyShort(GIFT_LIMIT_CENTS);

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
    stylingTile: null,
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
    stylingTile: null,
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
    stylingTile: null,
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
    stylingTile: null,
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
    stylingTile: null,
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
    stylingTile: null,
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
    bannerImage: null,
    stylingTile: null,
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
    stylingTile: null,
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
    bannerImage: null,
    stylingTile: null,
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
    bannerImage: null,
    stylingTile: null,
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
    bannerImage: null,
    stylingTile: null,
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
    bannerImage: null,
    stylingTile: null,
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
    bannerImage: null,
    stylingTile: null,
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
    stylingTile: null,
  },
];
