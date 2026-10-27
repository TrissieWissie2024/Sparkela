import { formatMoney } from "@/lib/money";
import type { FaqItem } from "@/lib/types";
import { EARLY_ACCESS_HOURS } from "@/content/drops";
import { giftWrap, stackDiscount, welcomeCode } from "@/content/offers";
import { site } from "@/content/site";

/**
 * Frequently asked questions (docs/PLAN.md §5.6). The first seven are verbatim from the brief (§6, copy-voorzet):
 * their amounts and times are literal there, and content/offers.test.ts checks that they match content/shipping.ts
 * and content/offers.ts. The extra questions for /veelgestelde-vragen derive amounts from config.
 *
 * The nikkelvrij question names the claim only conditionally (allowed by the content guard). Claims themselves only
 * ever appear through getVerifiedClaims() (lib/claims.ts).
 */

const paymentList = `${site.paymentMethodsInText.slice(0, -1).join(", ")} en ${site.paymentMethodsInText[site.paymentMethodsInText.length - 1]}`;

export const faq: FaqItem[] = [
  {
    id: "verkleuren",
    question: "Verkleuren de sieraden?",
    answer:
      "De vaste collectie is van roestvrij staal met een goudlaag. Dat gaat lang mee, en je krijgt 6 maanden garantie op verkleuring. Wil je de goudlaag zo mooi mogelijk houden? Doe je sieraden af bij zwemmen, sporten en douchen en bewaar ze droog in het zakje.",
    category: "sieraden",
    onHome: true,
    onProduct: true,
  },
  {
    id: "nikkelvrij",
    question: "Zijn de sieraden nikkelvrij?",
    answer:
      'Bij elk product staat het materiaal. Staat er "nikkelvrij", dan heeft onze leverancier dat voor dat product bevestigd.',
    category: "sieraden",
    onHome: true,
    onProduct: true,
    claim: "nikkelvrij",
  },
  {
    id: "levertijd",
    question: "Hoe snel heb ik mijn bestelling?",
    answer:
      "Op werkdagen vóór 16.00 uur besteld, gaat dezelfde dag met PostNL de deur uit. Meestal ligt hij binnen 1 tot 2 werkdagen in je brievenbus.",
    category: "verzenden",
    onHome: true,
    onProduct: true,
  },
  {
    id: "verzendkosten",
    question: "Wat kost verzenden?",
    answer: "€3,95, en gratis vanaf €35. We versturen binnen Nederland.",
    category: "verzenden",
    onHome: true,
    onProduct: false,
  },
  {
    id: "stack-korting",
    question: "Hoe werkt de stack-korting?",
    answer:
      "Koop je 3 of meer armbanden of oorbellen, dan krijg je 15% korting op die stuks. Je ziet het meteen in je winkelwagen.",
    category: "bestellen",
    onHome: true,
    onProduct: true,
  },
  {
    id: "retourneren",
    question: "Kan ik retourneren?",
    answer:
      'Ja, binnen 14 dagen. Oorbellen en piercings kun je om hygiënische redenen alleen retourneren met ongebroken hygiënezegel. Herroepen kan via "Hier de overeenkomst herroepen" onderaan elke pagina.',
    category: "retour",
    onHome: true,
    onProduct: true,
    link: { label: site.withdrawalLinkLabel, href: "/herroepen" },
  },
  {
    id: "cadeaukaart",
    question: "Kan ik een cadeaukaart kopen?",
    answer: "Ja, digitaal voor €15, €25 of €50. Hij komt direct in je mail.",
    category: "cadeaus",
    onHome: true,
    onProduct: false,
  },
  // Extra questions for /veelgestelde-vragen (own words, plan §5.6).
  {
    id: "ringmaat",
    question: "Hoe weet ik welke ringmaat ik heb?",
    answer:
      "Meet de binnenkant van een ring die goed om je vinger past, in millimeters. Bij elke ring staat een ringmaatgids die je laat zien welke maat daarbij hoort. Zit je tussen twee maten in? Kies dan de grotere.",
    category: "sieraden",
    onHome: false,
    onProduct: false,
  },
  {
    id: "cadeauverpakking",
    question: "Kunnen jullie mijn bestelling als cadeau inpakken?",
    answer: `Ja. Zet in je tas het vinkje bij cadeauverpakking aan, voor ${formatMoney(giftWrap.price)}. In december is inpakken gratis. Je kunt er ook een cadeauboodschap bij schrijven.`,
    category: "cadeaus",
    onHome: false,
    onProduct: false,
  },
  {
    id: "welkomstcode",
    question: "Hoe werkt de welkomstcode?",
    answer: `Meld je aan voor de Sparkela Club en je krijgt de code ${welcomeCode.code}: ${welcomeCode.percent}% op je eerste bestelling. Hij werkt niet op cadeaukaarten en niet samen met de stack-korting van ${stackDiscount.percent}%. Kom je voor allebei in aanmerking? Dan krijg je de hoogste korting.`,
    category: "bestellen",
    onHome: false,
    onProduct: false,
  },
  {
    id: "early-access",
    question: "Wat is early access bij een drop?",
    answer: `Leden van de Sparkela Club krijgen bij elke drop een mail met een eigen link. Daarmee shop je ${EARLY_ACCESS_HOURS} uur eerder dan iedereen, nog voordat de drop publiek live gaat.`,
    category: "bestellen",
    onHome: false,
    onProduct: false,
    link: { label: "Word lid van de Sparkela Club", href: "/sparkela-club" },
  },
  {
    id: "betalen",
    question: "Hoe kan ik betalen?",
    answer: `Je rekent af in onze beveiligde checkout. Betalen kan met ${paymentList}.`,
    category: "bestellen",
    onHome: false,
    onProduct: false,
  },
  {
    id: "garantie",
    question: "Hoe vraag ik garantie aan?",
    answer: `Is je sieraad binnen ${site.guarantee.months} maanden verkleurd? Wat balen! Mail ons een foto en je bestelnummer op ${site.email}, dan sturen we je een nieuwe.`,
    category: "retour",
    onHome: false,
    onProduct: false,
    link: { label: "Naar contact", href: "/contact" },
  },
];
