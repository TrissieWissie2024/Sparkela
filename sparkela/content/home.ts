import type { AssetKey, JewelryType, Moment } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";
import { stackDiscount } from "@/content/offers";
import { shipping } from "@/content/shipping";
import { site } from "@/content/site";

/**
 * Homepage copy (docs/PLAN.md §5.8, §14.1, brief §6). Verbatim brief copy (plan §5.2) is checked by the content
 * guard. Amounts, times and percentages come from config (site.usps, content/shipping.ts, content/offers.ts).
 * The delivery-day texts of the delivery bar live in sharedCopy.deliveryBar (lib/dates.ts returns them).
 * Owner after wave 3: B4 (3b), D1 (7-9).
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

export interface HomeContent {
  meta: { title: string; description: string };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    pills: [string, string, string];
    guaranteeBadge: string;
    ctas: [HomeLink, HomeLink];
    imageDesktop: AssetKey;
    imageMobile: AssetKey;
  };
  deliveryBar: { flagLabel: string; freeFrom: (amount: string) => string };
  productGrid: {
    eyebrow: string;
    title: string;
    intro: string;
    tabs: Array<{ id: "alles" | JewelryType; label: string }>;
    sortLabel: string;
    viewAll: string;
  };
  howToStack: { title: string; steps: [HomeStep, HomeStep, HomeStep]; link: HomeLink };
  favorites: { eyebrow: string; title: string; titleWithSales: string; viewAll: string };
  statementVsSubtle: { title: string; intro: string; columns: [HomeColumn, HomeColumn] };
  moments: { title: string; intro: string; tiles: HomeMomentTile[] };
  finder: { eyebrow: string; title: string; text: string };
  /** No empty-state text: the section is hidden while there are no real reviews. */
  reviews: { title: string };
  videos: { eyebrow: string; title: string; intro: string; slots: Array<{ label: string }> };
  photoStrip: { title: string; intro: string; items: Array<{ image: AssetKey; productHandle: string }> };
  guarantee: { title: string; text: string; points: [string, string, string]; cta: HomeLink };
  faq: { title: string; allLink: HomeLink };
  aboutLinde: { eyebrow: string; title: string; text: string; cta: HomeLink; image: AssetKey };
}

const { type, moment } = sharedCopy.vocab;
const [uspFreeShipping, uspDispatch, uspGuarantee] = site.usps;
const momentOrder: Moment[] = ["festival", "date-night", "kantoor-maar-niet-saai", "strand", "feestdagen"];

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
    guaranteeBadge: uspGuarantee,
    ctas: [
      { label: "Shop oorbellen", href: "/collections/oorbellen" },
      { label: "Shop armbanden", href: "/collections/armbanden" },
    ],
    imageDesktop: "hero.desktop",
    imageMobile: "hero.mobiel",
  },
  deliveryBar: {
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
    sortLabel: "Sorteren",
    viewAll: "Bekijk alles",
  },
  howToStack: {
    title: "Zo stack je",
    steps: [
      { title: "Kies je statement", text: "Begin met het stuk dat je outfit draagt: een paar chunky oorbellen of een brede armband." },
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
  },
  statementVsSubtle: {
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
    title: "Shop per moment",
    intro: "Van festivalwei tot kantoor: voor elk moment een spark.",
    tiles: momentOrder.map((m) => ({ moment: m, label: moment[m], image: `momenten.${m}` })),
  },
  finder: {
    eyebrow: "Spark Finder",
    title: "Welke spark past bij jou?",
    text: "Drie vragen, nog geen minuut. Daarna zie je welke stukken bij je vibe passen.",
  },
  reviews: { title: "Dit zeggen jullie" },
  videos: {
    eyebrow: "Gestyled door Linde",
    title: "Zo draag je het",
    intro: "Korte video's met stylingtips, van een simpele stack tot een volle avondlook.",
    slots: [
      { label: "Stack van drie armbanden" },
      { label: "Chunky hoops bij een wit shirt" },
      { label: "Van kantoor naar date night" },
      { label: "Festivallook met kleur" },
    ],
  },
  photoStrip: {
    title: "Zo dragen jullie Sparkela",
    intro: "Jouw stack hier zien? Tag ons op Instagram of TikTok.",
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
    title: uspGuarantee,
    text: "Verkleurt je sieraad binnen die tijd? Wat balen! Stuur ons een foto en we sturen je een nieuwe.",
    points: ["Roestvrij staal met goudlaag", `${shipping.returnDays} dagen bedenktijd`, uspFreeShipping],
    cta: { label: "Verzenden en retourneren", href: "/verzenden-en-retourneren" },
  },
  faq: {
    title: "Veelgestelde vragen",
    allLink: { label: "Alle vragen", href: "/veelgestelde-vragen" },
  },
  aboutLinde: {
    eyebrow: "Over Sparkela",
    title: "Hoi, ik ben Linde",
    text: "[Linde schrijft hier een korte introductie over zichzelf en over Sparkela.]",
    cta: { label: "Lees het verhaal", href: "/over-sparkela" },
    image: "linde.portret",
  },
};
