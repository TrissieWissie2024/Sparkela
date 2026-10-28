import type { AssetKey, JewelryType, Moment } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";
import { stackDiscount } from "@/content/offers";
import { site, type SocialLink } from "@/content/site";

/**
 * Homepage copy (docs/PLAN.md §5.8, §14.1, brief §6). Verbatim brief copy (plan §5.2) is checked by the content
 * guard. Amounts, times and percentages come from config (site.usps, content/shipping.ts, content/offers.ts).
 * The delivery-day texts of the delivery bar live in sharedCopy.deliveryBar (lib/dates.ts returns them).
 * Owner after wave 3: B4 (3b), D1 (7-9). The keys of plan §5.8 are kept; D1 added labels for the home sections
 * (see the comments per key).
 */

export interface HomeLink {
  label: string;
  href: string;
}

export interface HomeStep {
  title: string;
  text: string;
}

export interface HomeColumn {
  title: string;
  text: string;
  cta: HomeLink;
  image: AssetKey;
}

export interface HomeMomentTile {
  moment: Moment;
  label: string;
  image: AssetKey;
}

export interface HomePoint {
  title: string;
  text: string;
}

export interface HomeContent {
  meta: { title: string; description: string };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    pills: [string, string, string];
    /** Accessible name of the list of USP pills (D1). */
    pillsLabel: string;
    guaranteeBadge: string;
    /** The round badge drawn from guaranteeBadge: the number, the unit and the rest (D1; screen readers get guaranteeBadge). */
    seal: { value: string; unit: string; text: string };
    ctas: [HomeLink, HomeLink];
    imageDesktop: AssetKey;
    imageMobile: AssetKey;
  };
  /** `title` is the visually hidden section heading (D1). */
  deliveryBar: { title: string; flagLabel: string; freeFrom: (amount: string) => string };
  productGrid: {
    eyebrow: string;
    title: string;
    intro: string;
    tabs: Array<{ id: "alles" | JewelryType; label: string }>;
    /** Accessible name of the tab list (D1). */
    tabsLabel: string;
    sortLabel: string;
    viewAll: string;
    /** The button under a type tab: "Bekijk alle oorbellen" (D1). */
    viewAllType: (typeLabel: string) => string;
    /** The styling tile that fills a row a short tab leaves open (D1, StylingTile of the collections). */
    tile: { title: string; text: string; image: AssetKey; href: string };
    /** A type tab's own tile: rings and necklaces do not count for the stack discount (fix 7-9). */
    tileByTab: Partial<Record<"alles" | JewelryType, { eyebrow?: string; title: string; text: string; image: AssetKey; href: string }>>;
  };
  howToStack: { title: string; steps: [HomeStep, HomeStep, HomeStep]; link: HomeLink };
  favorites: {
    eyebrow: string;
    title: string;
    titleWithSales: string;
    viewAll: string;
    /** D1: the link target of viewAll, the intro lines and the eyebrow with real sales data. */
    viewAllHref: string;
    intro: string;
    eyebrowWithSales: string;
    introWithSales: string;
  };
  statementVsSubtle: { eyebrow: string; title: string; intro: string; columns: [HomeColumn, HomeColumn] };
  moments: { eyebrow: string; title: string; intro: string; tiles: HomeMomentTile[] };
  finder: { eyebrow: string; title: string; text: string };
  /** No empty-state text: the section is hidden while there are no real reviews. */
  reviews: {
    eyebrow: string;
    title: string;
    /** One review's stars for screen readers: "5 van 5 sterren". */
    ratingLabel: (rating: number) => string;
    /** Only on a review that the review app marked as a real purchase. */
    verifiedBuyer: string;
  };
  videos: {
    eyebrow: string;
    title: string;
    intro: string;
    /** Says the videos are Sparkela's own content, never customers (D1). */
    note: string;
    listLabel: string;
    slots: Array<{ label: string }>;
  };
  photoStrip: {
    title: string;
    intro: string;
    listLabel: string;
    /** Accessible name of a photo link: "Bekijk Lola chunky hoops" (plan §14.1). */
    itemLabel: (productTitle: string) => string;
    items: Array<{ image: AssetKey; productHandle: string }>;
  };
  guarantee: {
    eyebrow: string;
    title: string;
    text: string;
    points: [HomePoint, HomePoint, HomePoint];
    /** The guarantee comes on top of the statutory rights; said once, never as a perk (D1). */
    note: string;
    seal: { value: string; unit: string };
    cta: HomeLink;
  };
  /** The links under the questions are sharedCopy.faqLinks (QA round 4: the same block as on the product page). */
  faq: { eyebrow: string; title: string };
  aboutLinde: {
    eyebrow: string;
    title: string;
    text: string;
    signature: string;
    /** One of site.taglines as a closing display line. */
    tagline: string;
    cta: HomeLink;
    image: AssetKey;
  };
}

const { type, moment } = sharedCopy.vocab;
const [uspFreeShipping, uspDispatch, uspGuarantee] = site.usps;
const momentOrder: Moment[] = ["festival", "date-night", "kantoor-maar-niet-saai", "strand", "feestdagen"];
const guaranteeMonths = String(site.guarantee.months);

/**
 * The photo strip's intro (QA round 4): "Tag …" only names accounts that exist (confirmedSocials, plan §11.9 step 8),
 * with the handle, so a visitor knows whom to tag. Until Instagram or TikTok is confirmed a neutral line.
 */
function photoStripIntro(socials: readonly SocialLink[]): string {
  const tagged = socials.filter((social) => social.confirmed && (social.id === "instagram" || social.id === "tiktok"));
  if (tagged.length === 0) return "Elke foto linkt naar het stuk dat je ziet.";
  const handles = [...new Set(tagged.map((social) => social.handle))];
  const platforms = tagged.map((social) => social.label).join(" of ");
  return handles.length === 1
    ? `Jouw stack hier zien? Tag ${handles[0]} op ${platforms}.`
    : `Jouw stack hier zien? Tag ons: ${tagged.map((social) => `${social.handle} op ${social.label}`).join(" of ")}.`;
}

export const home: HomeContent = {
  meta: {
    title: "Chunky sieraden met een spark",
    description: site.description,
  },
  hero: {
    eyebrow: "Nieuw: de lanceringscollectie",
    title: "Eén paar oorbellen. Hele outfit af.",
    subtitle: "Chunky sieraden met een spark, gestyled door Linde.",
    pills: ["Roestvrij staal met goudlaag", uspDispatch, uspFreeShipping],
    pillsLabel: "Waarom Sparkela",
    guaranteeBadge: uspGuarantee,
    seal: { value: guaranteeMonths, unit: "maanden", text: "garantie op verkleuring" },
    ctas: [
      { label: "Shop oorbellen", href: "/collections/oorbellen" },
      { label: "Shop armbanden", href: "/collections/armbanden" },
    ],
    imageDesktop: "hero.desktop",
    imageMobile: "hero.mobiel",
  },
  deliveryBar: {
    title: "Verzending",
    flagLabel: "Verzonden vanuit Nederland",
    freeFrom: (amount) => `Gratis verzending vanaf ${amount}`,
  },
  productGrid: {
    eyebrow: "Shop",
    title: "De lanceringscollectie",
    intro: "Statement oorbellen, armbanden om te stacken en een paar stukken voor elke dag.",
    tabs: [
      { id: "alles", label: "Alles" },
      { id: "oorbellen", label: type.oorbellen },
      { id: "armbanden", label: type.armbanden },
      { id: "kettingen", label: type.kettingen },
      { id: "ringen", label: type.ringen },
    ],
    tabsLabel: "Sieraden per soort",
    sortLabel: "Sorteren",
    viewAll: "Bekijk alles",
    viewAllType: (typeLabel) => `Bekijk alle ${typeLabel.toLowerCase()}`,
    tile: {
      title: "Maak er een stack van",
      text: `Combineer ${stackDiscount.minUnits}\u00a0oorbellen of armbanden en krijg ${stackDiscount.percent}% stack-korting. Linde zette er al een paar voor je klaar.`,
      image: "stacks.goud-en-gedurfd",
      href: "/stacks",
    },
    tileByTab: {
      ringen: {
        eyebrow: "Goed om te weten",
        title: "Welke ringmaat heb je?",
        text: "Meet de binnenkant van een ring die goed past. Zit je tussen twee maten in? Kies dan de grotere.",
        image: "linde.portret",
        href: "/veelgestelde-vragen",
      },
      kettingen: {
        eyebrow: "Spark Finder",
        title: "Welke ketting past bij jou?",
        // "Spark Finder" never breaks apart in a one-cell tile (QA round 4).
        text: "Drie vragen in de Spark\u00a0Finder, en Linde laat zien welke stukken bij jouw vibe passen.",
        image: "linde.portret",
        href: "/spark-finder",
      },
    },
  },
  howToStack: {
    title: "Zo stack je",
    steps: [
      {
        title: "Kies je statement",
        text: "Begin met het stuk dat je outfit draagt: een paar chunky oorbellen of een brede armband.",
      },
      {
        title: `Stack ${stackDiscount.minUnits} stuks met ${stackDiscount.percent}% stack-korting`,
        text: "Mix oorbellen en armbanden zoals jij wilt. De korting gaat er in je tas vanzelf af.",
      },
      { title: uspDispatch, text: "Op werkdagen gaat je bestelling dezelfde dag met PostNL de deur uit." },
    ],
    link: { label: "Bekijk de stacks van Linde", href: "/stacks" },
  },
  favorites: {
    eyebrow: "Gekozen door Linde",
    title: "Lindes favorieten",
    titleWithSales: "Bestsellers",
    viewAll: "Bekijk alles",
    viewAllHref: "/collections/alle",
    intro: "De stukken die Linde zelf koos om mee te beginnen.",
    eyebrowWithSales: "Populair",
    introWithSales: "De stukken die jullie het vaakst kiezen.",
  },
  statementVsSubtle: {
    eyebrow: "Jouw stijl",
    title: "Statement of subtiel?",
    intro: "Allebei mag. Kies wat bij je dag past, of combineer ze.",
    columns: [
      {
        title: "Statement",
        text: "Groot, glanzend en gemaakt om op te vallen. Eén stuk is genoeg om je outfit af te maken.",
        cta: { label: "Shop chunky", href: "/collections/alle?vibe=chunky-en-bold" },
        image: "home.statement",
      },
      {
        title: "Subtiel",
        text: "Kleine hoops, fijne kettinkjes en dunne armbandjes. Voor elke dag, en mooi onder een statement.",
        cta: { label: "Shop subtiel", href: "/collections/subtiel" },
        image: "home.subtiel",
      },
    ],
  },
  moments: {
    eyebrow: "Shop per moment",
    title: "Voor elk moment een spark",
    intro: "Van festivalwei tot kantoor: kies je moment en zie wat erbij past.",
    tiles: momentOrder.map((m) => ({ moment: m, label: moment[m], image: `momenten.${m}` })),
  },
  finder: {
    eyebrow: "Spark Finder",
    title: "Welke spark past bij jou?",
    text: "Drie vragen, nog geen minuut. Daarna zie je welke stukken bij je vibe passen.",
  },
  reviews: {
    eyebrow: "Reviews",
    title: "Dit zeggen jullie",
    ratingLabel: (rating) => `${rating} van 5 sterren`,
    verifiedBuyer: "Geverifieerde aankoop",
  },
  videos: {
    eyebrow: "Gestyled door Linde",
    title: "Zo draag je het",
    intro: "Korte video's met stylingtips, van een simpele stack tot een volle avondlook.",
    note: "Eigen video's van Sparkela, gemaakt door Linde.",
    listLabel: "Video's",
    slots: [
      { label: "Stack van drie armbanden" },
      { label: "Chunky hoops bij een wit shirt" },
      { label: "Van kantoor naar date night" },
      { label: "Festivallook met kleur" },
    ],
  },
  photoStrip: {
    title: "Zo dragen jullie Sparkela",
    intro: photoStripIntro(site.socials ?? []),
    listLabel: "Foto's",
    itemLabel: (productTitle) => `Bekijk ${productTitle}`,
    items: [
      { image: "fotostrook.01", productHandle: "lola-chunky-hoops" },
      { image: "fotostrook.02", productHandle: "tess-schakelarmband" },
      { image: "fotostrook.03", productHandle: "mila-color-pop" },
      { image: "fotostrook.04", productHandle: "evi-dikke-schakelketting" },
      { image: "fotostrook.05", productHandle: "nina-chunky-ring" },
      { image: "fotostrook.06", productHandle: "roos-brede-bangle" },
      { image: "fotostrook.07", productHandle: "jet-vonk-oorbellen" },
      { image: "fotostrook.08", productHandle: "mae-mini-hoops" },
    ],
  },
  guarantee: {
    eyebrow: "Onze belofte",
    title: uspGuarantee,
    text: "Verkleurt je sieraad binnen die tijd? Wat balen! Dan sturen we je een nieuwe.",
    points: [
      { title: "Zo vraag je het aan", text: "Mail ons een foto en je bestelnummer. Meer hoeft niet." },
      {
        title: "Roestvrij staal met goudlaag",
        text: "De vaste collectie is van roestvrij staal met een goudlaag. Dat gaat lang mee.",
      },
      {
        title: "Zo blijven ze mooi",
        text: "Doe je sieraden af bij zwemmen, sporten en douchen en bewaar ze droog in het zakje.",
      },
    ],
    note: "Deze garantie komt bovenop je wettelijke rechten.",
    seal: { value: guaranteeMonths, unit: "maanden" },
    cta: { label: "Verzenden en retourneren", href: "/verzenden-en-retourneren" },
  },
  faq: {
    eyebrow: "Vragen",
    title: "Veelgestelde vragen",
  },
  aboutLinde: {
    eyebrow: "Over Sparkela",
    title: "Hoi, ik ben Linde",
    text: "[Linde schrijft hier een korte introductie over zichzelf en over Sparkela.]",
    signature: "Linde Wijnker, eigenaar van Sparkela",
    tagline: site.taglines[1],
    cta: { label: "Lees het verhaal", href: "/over-sparkela" },
    image: "linde.portret",
  },
};
