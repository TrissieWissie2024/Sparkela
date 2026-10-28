import { formatMoneyShort } from "@/lib/money";
import type { FooterColumn, Moment, MobileNavConfig, NavGroup, NavItem, NavLink } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";

/**
 * Navigation (docs/PLAN.md §2.5): desktop nav (from xl), mobile menu, footer columns and the legal links of the
 * MiniFooter. Type, vibe and moment labels come from sharedCopy.vocab, so navigation, filters, cards and the quiz
 * say the same words everywhere (decision 125; content/quiz.test.ts checks it).
 *
 * The withdrawal link ("Hier de overeenkomst herroepen") is not in these lists: Footer and MiniFooter render it
 * themselves with site.withdrawalLinkLabel. "Cookie-instellingen" is a button (CookieSettingsButton), not a link.
 */

const { type, moment } = sharedCopy.vocab;

/** Upper bound of the "Cadeaus onder €25" collection (rule maxPrice 2500, plan §2.3). */
const GIFT_LIMIT_CENTS = 2500;

const link = {
  nieuw: { label: "Nieuw", href: "/collections/nieuw" },
  oorbellen: { label: type.oorbellen, href: "/collections/oorbellen" },
  armbanden: { label: type.armbanden, href: "/collections/armbanden" },
  kettingen: { label: type.kettingen, href: "/collections/kettingen" },
  ringen: { label: type.ringen, href: "/collections/ringen" },
  limited: { label: "Limited", href: "/collections/limited" },
  alle: { label: "Alle sieraden", href: "/collections/alle" },
  subtiel: { label: "Subtiel en klassiek", href: "/collections/subtiel" },
  stacks: { label: "Stacks", href: "/stacks" },
  cadeaukaarten: { label: "Cadeaukaarten", href: "/cadeaukaarten" },
  onder25: { label: `Onder ${formatMoneyShort(GIFT_LIMIT_CENTS)}`, href: "/collections/onder-25" },
  sparkFinder: { label: "Spark Finder", href: "/spark-finder" },
  club: { label: "Sparkela Club", href: "/sparkela-club" },
  over: { label: "Over Sparkela", href: "/over-sparkela" },
  faq: { label: "Veelgestelde vragen", href: "/veelgestelde-vragen" },
  verzenden: { label: "Verzenden en retourneren", href: "/verzenden-en-retourneren" },
  herroepen: { label: "Herroepen", href: "/herroepen" },
  contact: { label: "Contact", href: "/contact" },
  account: { label: "Account", href: "/account" },
  voorwaarden: { label: "Algemene voorwaarden", href: "/algemene-voorwaarden" },
  privacy: { label: "Privacy", href: "/privacy" },
  cookies: { label: "Cookies", href: "/cookies" },
} satisfies Record<string, NavLink>;

/** Short explanation under each moment in the megamenu panel (Lashthing pattern, own words). */
const momentDescriptions: Record<Moment, string> = {
  festival: "Groot, kleurig en klaar om te dansen",
  "date-night": "Een beetje glans voor een avond uit",
  "kantoor-maar-niet-saai": "Net genoeg spark voor een werkdag",
  strand: "Licht, zonnig en klaar voor de vakantie",
  feestdagen: "Goud en glitter voor de feestdagen",
};

const momentOrder: Moment[] = ["festival", "date-night", "kantoor-maar-niet-saai", "strand", "feestdagen"];

const momentGroup: NavGroup = {
  label: "Shop per moment",
  id: "momenten",
  links: [
    ...momentOrder.map((m) => ({ label: moment[m], href: `/collections/${m}`, description: momentDescriptions[m] })),
    { label: "Bekijk alles", href: link.alle.href, description: "Alle sieraden op een rij" },
  ],
  extra: {
    heading: "Liever subtiel?",
    ...link.subtiel,
    description: "Kleine, klassieke stukken voor elke dag",
  },
};

const giftGroup: NavGroup = {
  label: "Cadeaus",
  id: "cadeaus",
  links: [
    { ...link.onder25, description: "Kleine cadeautjes met een spark" },
    { ...link.stacks, description: "Drie stuks van Linde, met stack-korting" },
    { ...link.cadeaukaarten, description: "Digitaal, direct in je mail" },
  ],
};

/** Desktop nav from xl (1280 px), in this order (plan §2.5). */
export const mainNav: NavItem[] = [
  { kind: "link", ...link.nieuw },
  { kind: "link", ...link.oorbellen },
  { kind: "link", ...link.armbanden },
  { kind: "link", ...link.kettingen },
  { kind: "link", ...link.ringen },
  { kind: "group", ...momentGroup },
  { kind: "link", ...link.limited },
  { kind: "group", ...giftGroup },
];

/** Mobile menu (below xl): main links, two accordion groups, service links under a hairline. */
export const mobileNav: MobileNavConfig = {
  primary: [link.nieuw, link.oorbellen, link.armbanden, link.kettingen, link.ringen, link.limited],
  groups: [momentGroup, giftGroup],
  service: [link.sparkFinder, link.club, link.over, link.faq, link.contact, link.account],
};

/** Footer columns (plan §2.5). The Juridisch column also gets the cookie settings button when analytics is on. */
export const footerNav: FooterColumn[] = [
  {
    title: "Shop",
    links: [
      link.nieuw,
      link.oorbellen,
      link.armbanden,
      link.kettingen,
      link.ringen,
      link.subtiel,
      link.limited,
      link.stacks,
      link.cadeaukaarten,
    ],
  },
  { title: "Klantenservice", links: [link.faq, link.verzenden, link.herroepen, link.contact, link.account] },
  { title: "Sparkela", links: [link.over, link.club, link.sparkFinder] },
  { title: "Juridisch", links: [link.voorwaarden, link.privacy, link.cookies] },
];

/** Legal links of the MiniFooter on the waitlist and the confirmation page; all of them are open during prelaunch. */
export const legalNav: NavLink[] = [link.voorwaarden, link.privacy, link.cookies, link.verzenden, link.contact];
