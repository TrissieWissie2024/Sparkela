import type { Drop, DropSlug } from "@/lib/types";

/**
 * Drops (docs/PLAN.md §12.1, §9.5, brief §4). Every time is an ISO literal with an offset, never computed;
 * endsAt is exclusive. content/drops.test.ts checks the literals, that slugs are unique and equal DropSlug,
 * that startsAt < endsAt, and that productHandles equals the products tagged drop:<slug> in content/products.ts.
 *
 * Holiday Sparkle starts at the launch. The 2027 dates are proposals that Linde and Tristan confirm (decision 22).
 * Overlapping drops are allowed (none overlap now); getPromoState then picks the first started. Every drop starts in
 * the month brief §4 gives it (decision 184).
 * Adding a drop: plan §21.3 (DropSlug in lib/types.ts, tag drop:<slug>, image drops.<slug> in content/assets.ts).
 */

/** Club members get access this many hours before startsAt (via the signed link in the Club mail, plan §11.5). */
export const EARLY_ACCESS_HOURS = 24;

const banner = { cta: "Bekijk de drop" } as const;
const earlyAccessLine = `Club-leden zijn er ${EARLY_ACCESS_HOURS} uur eerder bij.`;

export const drops: Drop[] = [
  {
    slug: "holiday-sparkle",
    name: "Holiday Sparkle",
    tagline: "Het extra diamantje met kerst.",
    description: "Sterren, glitter en goud voor de feestdagen. Een kleine drop die je outfit van kerstdiner tot oud en nieuw laat stralen.",
    startsAt: "2026-11-27T00:00:00+01:00",
    endsAt: "2027-01-01T00:00:00+01:00",
    productHandles: ["holiday-ster-oorbellen", "holiday-glitter-hoops", "holiday-sparkle-armband", "holiday-ster-ketting"],
    banner: { title: "Holiday Sparkle.", text: "Het extra diamantje met kerst.", cta: banner.cta },
    teaser: { title: "Holiday Sparkle komt eraan", text: earlyAccessLine },
    image: "drops.holiday-sparkle",
    seo: {
      title: "Holiday Sparkle",
      description: "De feestdagendrop van Sparkela: sterren, glitter en goud voor kerst en oud en nieuw.",
    },
  },
  {
    slug: "love-club",
    name: "Love Club",
    tagline: "Hartjes, rood en een vleugje goud.",
    description: "Een drop vol hartjes voor februari. Om cadeau te geven, of gewoon voor jezelf.",
    startsAt: "2027-02-05T19:00:00+01:00",
    endsAt: "2027-03-01T00:00:00+01:00",
    productHandles: [],
    banner: { title: "Love Club.", text: "Hartjes, rood en een vleugje goud.", cta: banner.cta },
    teaser: { title: "Love Club komt eraan", text: earlyAccessLine },
    image: "drops.love-club",
    seo: {
      title: "Love Club",
      description: "De Valentijnsdrop van Sparkela: hartjes en warm goud, om te geven of zelf te dragen.",
    },
  },
  {
    slug: "oranje-spark",
    name: "Oranje Spark",
    tagline: "Oranje aan je oren, goud om je pols.",
    description: "Feestelijke stukken voor Koningsdag en de eerste festivals. Knallend oranje, met goud erbij.",
    startsAt: "2027-04-09T19:00:00+02:00",
    endsAt: "2027-05-01T00:00:00+02:00",
    productHandles: [],
    banner: { title: "Oranje Spark.", text: "Oranje aan je oren, goud om je pols.", cta: banner.cta },
    teaser: { title: "Oranje Spark komt eraan", text: earlyAccessLine },
    image: "drops.oranje-spark",
    seo: {
      title: "Oranje Spark",
      description: "De Koningsdagdrop van Sparkela: oranje statementstukken met goud, klaar voor feest en festival.",
    },
  },
  {
    slug: "like-mother-like-daughter",
    name: "Like Mother, Like Daughter",
    tagline: "Samen dragen, samen stralen.",
    description: "Voor Moederdag: sieraden die je samen draagt. Eén voor jou en één voor haar.",
    startsAt: "2027-05-01T19:00:00+02:00",
    endsAt: "2027-05-10T00:00:00+02:00",
    productHandles: [],
    banner: { title: "Like Mother, Like Daughter.", text: "Samen dragen, samen stralen.", cta: banner.cta },
    teaser: { title: "Like Mother, Like Daughter komt eraan", text: earlyAccessLine },
    image: "drops.like-mother-like-daughter",
    seo: {
      title: "Like Mother, Like Daughter",
      description: "De Moederdagdrop van Sparkela: sieraden om samen te dragen, voor jou en voor haar.",
    },
  },
  {
    slug: "summer-spark",
    name: "Summer Spark",
    tagline: "Zon, zee en goud aan je oren.",
    description: "Lichte, kleurige stukken voor lange zomerdagen. Van het strand tot het terras.",
    startsAt: "2027-06-04T19:00:00+02:00",
    endsAt: "2027-09-01T00:00:00+02:00",
    productHandles: [],
    banner: { title: "Summer Spark.", text: "Zon, zee en goud aan je oren.", cta: banner.cta },
    teaser: { title: "Summer Spark komt eraan", text: earlyAccessLine },
    image: "drops.summer-spark",
    seo: {
      title: "Summer Spark",
      description: "De zomerdrop van Sparkela: kleurige oorbellen en armbanden voor strand, terras en festival.",
    },
  },
  {
    slug: "main-character",
    name: "Main Character",
    tagline: "Jij speelt de hoofdrol.",
    description: "Grote, gedurfde stukken voor het nieuwe seizoen. Voor elke dag dat jij de show steelt.",
    startsAt: "2027-09-03T19:00:00+02:00",
    endsAt: "2027-10-01T00:00:00+02:00",
    productHandles: [],
    banner: { title: "Main Character.", text: "Jij speelt de hoofdrol.", cta: banner.cta },
    teaser: { title: "Main Character komt eraan", text: earlyAccessLine },
    image: "drops.main-character",
    seo: {
      title: "Main Character",
      description: "De septemberdrop van Sparkela: grote, gedurfde statementstukken voor het nieuwe seizoen.",
    },
  },
  {
    slug: "vamp",
    name: "Vamp",
    tagline: "Donker, glanzend en een tikje mysterieus.",
    description: "Diepe tinten en chunky goud voor de herfst. Gemaakt voor lange avonden.",
    startsAt: "2027-10-01T19:00:00+02:00",
    endsAt: "2027-11-01T00:00:00+01:00",
    productHandles: [],
    banner: { title: "Vamp.", text: "Donker, glanzend en een tikje mysterieus.", cta: banner.cta },
    teaser: { title: "Vamp komt eraan", text: earlyAccessLine },
    image: "drops.vamp",
    seo: {
      title: "Vamp",
      description: "De herfstdrop van Sparkela: diepe tinten en chunky goud voor lange avonden.",
    },
  },
  {
    slug: "spark-friday",
    name: "Spark Friday",
    tagline: "Een jaar Sparkela, en dat vieren we.",
    description: "Ons eerste jaar vieren we met een eigen drop. Alleen dit lange weekend.",
    startsAt: "2027-11-26T00:00:00+01:00",
    endsAt: "2027-11-30T00:00:00+01:00",
    productHandles: [],
    banner: { title: "Spark Friday.", text: "Een jaar Sparkela, en dat vieren we.", cta: banner.cta },
    teaser: { title: "Spark Friday komt eraan", text: earlyAccessLine },
    image: "drops.spark-friday",
    seo: {
      title: "Spark Friday",
      description: "De verjaardagsdrop van Sparkela: een lang weekend met een eigen drop.",
    },
  },
];

const dropSlugs: ReadonlySet<string> = new Set(drops.map((drop) => drop.slug));

/** Narrows a route param to a known drop slug (decision 103: an unknown slug gets the 404 pattern). */
export function isDropSlug(value: string): value is DropSlug {
  return dropSlugs.has(value);
}
