import type { FaqCategory } from "@/lib/types";
import { EARLY_ACCESS_HOURS } from "@/content/drops";
import { welcomeCode } from "@/content/offers";
import { site } from "@/content/site";

/**
 * Page copy (docs/PLAN.md §5.1, §14.5, §14.9 to §14.19): Over Sparkela, Club page, FAQ page, Spark Finder (page and
 * quiz labels), the email popup, account and the demo checkout. The 404 copy lives in sharedCopy.notFound. Created in
 * wave 3a with the texts the plan already names; D4 owns this file in wave 7-9 (type and value together).
 *
 * The reward is real and comes from config (brief §2.8): every percentage and code in `popup` and `club` is derived
 * from content/offers.ts (welcomeCode), and content/offers.test.ts checks that they never drift apart. Amounts, days
 * and hours come from content/site.ts and content/drops.ts. Templated copy takes already formatted strings.
 */

const reward = `${welcomeCode.percent}% op je eerste bestelling`;

export interface PageLink {
  label: string;
  href: string;
}

export interface PagesCopy {
  about: {
    title: string;
    metaDescription: string;
    eyebrow: string;
    intro: string;
    /** Placeholder until Linde writes her own story (brief §3: no invented personal details). */
    lindeIntro: string;
    linde: { eyebrow: string; title: string; signature: string; photoLabel: string };
    why: { eyebrow: string; title: string; lead: string; paragraphs: string[] };
    /** Tristan as co-owner, in one sentence (plan §14.11). */
    team: string;
    values: { title: string; items: Array<{ title: string; text: string }> };
    /** Closing band: the Club sign-up itself is the footer form directly below it (decision note in the D4 report). */
    outro: { title: string; text: string; primary: PageLink; secondary: PageLink };
  };
  club: {
    metaTitle: string;
    metaDescription: string;
    eyebrow: string;
    intro: string;
    benefitsTitle: string;
    benefits: Array<{ title: string; text: string }>;
    form: { title: string; text: string };
    photoLabel: string;
    mails: { title: string; items: string[]; unsubscribe: string };
    drops: {
      title: string;
      intro: string;
      /** No drop with a start in the future. */
      empty: string;
      /** Month label of an upcoming drop: "februari 2027". */
      month: (month: string, year: string) => string;
      listLabel: string;
    };
  };
  faq: {
    title: string;
    metaDescription: string;
    eyebrow: string;
    intro: string;
    navLabel: string;
    /** Section order of the FAQ page. */
    order: FaqCategory[];
    categories: Record<FaqCategory, string>;
    questionCount: (count: number) => string;
    contact: { title: string; text: string; link: PageLink };
  };
  finder: {
    metaDescription: string;
    eyebrow: string;
    /** "Vraag 1 van 3" above every question. */
    progress: (step: number, total: number) => string;
    /** Accessible name of the three-segment progress bar. */
    progressLabel: string;
    next: string;
    back: string;
    /** The button of the last question. */
    showResult: string;
    /** Next without a choice: a polite message in a live region (no disabled buttons). */
    pickOne: string;
    /** Status line after the result appears. */
    resultAnnouncement: (count: number) => string;
    resultEyebrow: string;
    answersLabel: string;
    resultsLabel: string;
    /** Under the email title: what happens with the answers (brief §6: they go to Shopify as tags). */
    emailText: string;
    steps: { title: string; items: Array<{ title: string; text: string }> };
    stacks: { text: string; link: PageLink };
  };
  popup: {
    /** Visually hidden after the pill label, so the pill says what it offers. */
    pillSuffix: string;
    pillDismiss: string;
    /** Conditions of the reward, stated before a card is turned (brief §2.8). */
    conditions: string;
    cardsLabel: string;
    card: (n: number, total: number) => string;
    /** Visually hidden prefix of a turned card; the visible face (code and reward) completes its name. */
    cardChosen: (n: number, total: number) => string;
    cardRevealed: (n: number, total: number) => string;
    /** The face of every card: the same, real reward. */
    cardFace: { value: string; line: string };
    yourCard: string;
    sameReward: string;
    chooseHint: string;
    chosenLine: string;
    dismiss: string;
    reward: {
      title: string;
      /** After the sign-up: the double opt-in mail is on its way (decision 199). */
      pending: string;
      codeLabel: string;
      copy: string;
      copied: string;
      copiedMessage: (code: string) => string;
      copyFailed: string;
      apply: string;
      applied: string;
      appliedMessage: (code: string) => string;
      appliedEmpty: (code: string) => string;
      notCombined: (code: string) => string;
      continueShopping: string;
    };
  };
  account: {
    title: string;
    text: string;
    metaDescription: string;
    help: { title: string; text: string; mailLabel: string };
    links: { title: string; items: Array<PageLink & { description: string }> };
  };
  checkout: {
    /** Local provider only (brief §7). */
    demoNotice: string;
    title: string;
    metaDescription: string;
    intro: string;
    loading: string;
    summary: {
      title: string;
      itemCount: (count: number) => string;
      edit: string;
      linesLabel: string;
      giftWrap: string;
      giftWrapFree: string;
      giftMessage: string;
      /** Below lg the lines fold away behind this toggle, so the form starts high (fix 7-9). */
      showLines: string;
      hideLines: string;
    };
    discount: {
      label: string;
      placeholder: string;
      apply: string;
      empty: string;
      invalid: (code: string) => string;
      added: (code: string) => string;
      error: string;
    };
    formLabel: string;
    contact: { title: string; email: string; emailHint: string };
    address: {
      title: string;
      firstName: string;
      lastName: string;
      street: string;
      postalCode: string;
      city: string;
      country: string;
      giftCardsOnly: string;
    };
    errors: { required: (label: string) => string; email: string; summary: string };
    placeOrder: string;
    placing: string;
    formNote: string;
    placed: {
      title: string;
      text: string;
      orderRef: string;
      total: string;
      items: (count: number) => string;
      emailNote: (email: string) => string;
      cta: PageLink;
    };
    empty: { title: string; text: string; cta: PageLink; secondary: PageLink };
    shopify: { text: string; button: string };
  };
}

export const pagesCopy: PagesCopy = {
  about: {
    title: "Over Sparkela",
    metaDescription: "Sparkela maakt chunky sieraden met een spark, gekozen en gestyled door Linde. Lees waar we voor staan.",
    eyebrow: "Ons verhaal",
    intro: "Sieraden die je outfit afmaken. Gekozen en gestyled door Linde, met een retro randje.",
    lindeIntro: "Hoi, ik ben Linde. [Linde schrijft hier haar eigen verhaal.]",
    linde: {
      eyebrow: "Het gezicht van Sparkela",
      title: "Linde",
      signature: "Linde Wijnker, eigenaar van Sparkela",
      photoLabel: "Linde, portret",
    },
    why: {
      eyebrow: "Waarom Sparkela",
      title: "Klein sieraad, groot verschil",
      lead: "Met het juiste paar oorbellen voelt een simpele outfit ineens af. Daar draait Sparkela om.",
      paragraphs: [
        "We kiezen chunky stukken met een knipoog naar streetwear en een retro randje: statement oorbellen en opvallende armbanden, aangevuld met ringen en kettingen.",
        "Hou je het liever rustig? Er is ook een kleine lijn subtiele, klassieke stukken. En bij elke drop komen er een paar limited stukken bij.",
      ],
    },
    team: "Linde doet dit samen met Tristan Jas, mede-eigenaar, die de webshop, sales en marketing regelt.",
    values: {
      title: "Waar we voor staan",
      items: [
        {
          title: "Roestvrij staal met goudlaag",
          text: "De vaste collectie is van roestvrij staal met een goudlaag. Gemaakt om vaak te dragen, niet om in een la te liggen.",
        },
        {
          title: site.guarantee.short,
          text: `Verkleurt je sieraad binnen ${site.guarantee.months} maanden? Mail ons een foto, dan sturen we je een nieuwe.`,
        },
        {
          title: "Cadeautjes in plaats van grote kortingen",
          text: "Bij een actie krijg je liever een cadeautje van ons dan een flinke korting. Zo blijven de prijzen eerlijk, elke dag.",
        },
      ],
    },
    outro: {
      title: "Zin in een spark?",
      text: "Shop de collectie of laat de Spark Finder kiezen wat bij jou past.",
      primary: { label: "Shop de collectie", href: "/collections/alle" },
      secondary: { label: "Doe de Spark Finder", href: "/spark-finder" },
    },
  },
  club: {
    metaTitle: "Sparkela Club",
    metaDescription: `Word lid van de Sparkela Club: als eerste bij elke drop, ${EARLY_ACCESS_HOURS} uur early access en ${reward}.`,
    eyebrow: "Sparkela Club",
    intro: "Gratis lid in een paar seconden. Je krijgt alleen mails die de moeite waard zijn.",
    benefitsTitle: "Dit krijg je",
    benefits: [
      { title: "Als eerste bij elke drop", text: "Je hoort het van ons voordat een nieuwe drop live gaat." },
      {
        title: `${EARLY_ACCESS_HOURS} uur early access`,
        text: `Met je eigen link shop je een drop ${EARLY_ACCESS_HOURS} uur eerder dan iedereen.`,
      },
      { title: reward, text: `Na je aanmelding krijg je de code ${welcomeCode.code}.` },
    ],
    form: {
      title: "Meld je aan",
      text: "Vul je e-mailadres in. Je krijgt een mail om je aanmelding te bevestigen.",
    },
    photoLabel: "Sparkela Club",
    mails: {
      title: "Welke mails krijg je?",
      items: [
        "Een seintje als er een nieuwe drop aankomt, met je early-access-link.",
        "Af en toe nieuws van Linde: nieuwe stukken en stylingtips.",
        "Geen dagelijkse mails, dat beloven we.",
      ],
      unsubscribe: "Afmelden kan altijd, met de link onderaan elke mail.",
    },
    drops: {
      title: "Komende drops",
      intro: "Zet ze alvast in je agenda. Als Club-lid hoor je als eerste wanneer ze live gaan.",
      empty: "De volgende drops maken we snel bekend.",
      month: (month, year) => `${month} ${year}`,
      listLabel: "Komende drops met hun maand",
    },
  },
  faq: {
    title: "Veelgestelde vragen",
    metaDescription:
      "Antwoord op je vragen over de sieraden, verzenden, retourneren, de stack-korting en cadeaus van Sparkela.",
    eyebrow: "Klantenservice",
    intro: "Staat je vraag er niet bij? Mail ons, we helpen je graag.",
    navLabel: "Onderwerpen",
    order: ["sieraden", "verzenden", "bestellen", "retour", "cadeaus"],
    categories: {
      sieraden: "Sieraden",
      verzenden: "Verzenden",
      bestellen: "Bestellen en betalen",
      retour: "Retour en garantie",
      cadeaus: "Cadeaus",
    },
    questionCount: (count) => (count === 1 ? "1 vraag" : `${count} vragen`),
    contact: {
      title: "Nog een vraag?",
      text: "Mail ons of gebruik het contactformulier.",
      link: { label: "Naar contact", href: "/contact" },
    },
  },
  finder: {
    metaDescription:
      "Drie vragen, nog geen minuut. De Spark Finder laat zien welke sieraden van Sparkela bij jouw vibe passen.",
    eyebrow: "Persoonlijk advies",
    progress: (step, total) => `Vraag ${step} van ${total}`,
    progressLabel: "Voortgang van de Spark Finder",
    next: "Volgende",
    back: "Terug",
    showResult: "Toon mijn sparks",
    pickOne: "Kies een antwoord om verder te gaan.",
    resultAnnouncement: (count) => `Jouw sparks: ${count} stukken`,
    resultEyebrow: "Jouw resultaat",
    answersLabel: "Je antwoorden",
    resultsLabel: "Sieraden die bij je passen",
    emailText:
      "Laat je e-mailadres achter voor de code. Je antwoorden bewaren we bij je aanmelding, zodat onze mails beter bij je passen.",
    steps: {
      title: "Zo werkt het",
      items: [
        { title: "Drie vragen", text: "Over je vibe, het moment en wat je zoekt." },
        { title: "Jouw sparks", text: "Je ziet meteen welke stukken bij je passen." },
        { title: reward, text: "Wil je? Laat je e-mailadres achter en je krijgt de code." },
      ],
    },
    stacks: {
      text: "Liever meteen een complete look?",
      link: { label: "Bekijk de stacks van Linde", href: "/stacks" },
    },
  },
  popup: {
    pillSuffix: `, ${reward}`,
    pillDismiss: "Kies je spark verbergen",
    conditions: "Eén keer te gebruiken. Niet op cadeaukaarten en niet samen met de stack-korting.",
    cardsLabel: "Drie kaarten met dezelfde beloning",
    card: (n, total) => `Kaart ${n} van ${total} omdraaien`,
    cardChosen: (n, total) => `Kaart ${n} van ${total}, jouw kaart:`,
    cardRevealed: (n, total) => `Kaart ${n} van ${total}:`,
    cardFace: { value: welcomeCode.code, line: reward },
    yourCard: "Jouw kaart",
    sameReward: "Zelfde beloning",
    chooseHint: "Kies een kaart en draai hem om. Daarna vraag je de code aan met je e-mailadres.",
    chosenLine: "Dit is jouw spark. Meld je aan en de code is van jou.",
    dismiss: "Nee, bedankt",
    reward: {
      title: "Je code staat klaar",
      pending: "Check je mail om je aanmelding af te ronden.",
      codeLabel: "Je kortingscode",
      copy: "Kopieer code",
      copied: "Gekopieerd",
      copiedMessage: (code) => `${code} staat op je klembord.`,
      copyFailed: "Kopiëren lukte niet. De code is geselecteerd, kopieer hem zelf.",
      apply: "Zet op mijn tas",
      applied: "Staat op je tas",
      appliedMessage: (code) => `${code} staat op je tas. Je ziet de korting in je tas.`,
      appliedEmpty: (code) => `${code} staat op je tas. De korting zie je zodra er iets in zit.`,
      notCombined: (code) => `${code} staat op je tas, maar je stack-korting is nu hoger. Die krijg je dan.`,
      continueShopping: "Verder shoppen",
    },
  },
  account: {
    title: "Account",
    text: "Inloggen kan straks hier. Vragen over je bestelling? Mail ons.",
    metaDescription: "Je account bij Sparkela.",
    help: {
      title: "Vragen over je bestelling?",
      text: "Mail ons met je bestelnummer, dan zoeken we het voor je uit.",
      mailLabel: "Mail ons",
    },
    links: {
      title: "Direct regelen",
      items: [
        { label: "Contact", href: "/contact", description: "Stel je vraag via het formulier." },
        {
          label: "Herroepen",
          href: "/herroepen",
          description: `Binnen ${site.returnDays} dagen je bestelling herroepen, met één formulier.`,
        },
        {
          label: "Verzenden en retourneren",
          href: "/verzenden-en-retourneren",
          description: "Levertijd, verzendkosten en retourneren.",
        },
        { label: "Veelgestelde vragen", href: "/veelgestelde-vragen", description: "Snel antwoord op de meest gestelde vragen." },
      ],
    },
  },
  checkout: {
    demoNotice: "Demo-checkout: er wordt niet betaald",
    title: "Afrekenen",
    metaDescription: "Controleer je bestelling en reken af.",
    intro: "Controleer je bestelling en vul je gegevens in.",
    loading: "Je tas wordt geladen",
    summary: {
      title: "Je bestelling",
      itemCount: (count) => (count === 1 ? "1 artikel" : `${count} artikelen`),
      edit: "Tas aanpassen",
      linesLabel: "Artikelen in je bestelling",
      giftWrap: "Cadeauverpakking",
      giftWrapFree: "Gratis in december",
      giftMessage: "Cadeauboodschap",
      showLines: "Toon de artikelen",
      hideLines: "Verberg de artikelen",
    },
    discount: {
      label: "Kortingscode",
      placeholder: "Code invullen",
      apply: "Toepassen",
      empty: "Vul eerst een code in.",
      invalid: (code) => `De code ${code} kennen we niet.`,
      added: (code) => `Code ${code} toegevoegd.`,
      error: "Dat lukte niet. Probeer het opnieuw.",
    },
    formLabel: "Je gegevens",
    contact: {
      title: "Contactgegevens",
      email: "E-mailadres",
      emailHint: "Hier zou je je orderbevestiging krijgen.",
    },
    address: {
      title: "Bezorgadres",
      firstName: "Voornaam",
      lastName: "Achternaam",
      street: "Straat en huisnummer",
      postalCode: "Postcode",
      city: "Plaats",
      country: "Land",
      giftCardsOnly: "Je bestelling bestaat alleen uit cadeaukaarten. Die komen per mail, dus een adres is niet nodig.",
    },
    errors: {
      required: (label) => `Vul dit veld in: ${label.toLowerCase()}.`,
      email: "Vul een geldig e-mailadres in, zoals naam@voorbeeld.nl.",
      summary: "Controleer de velden met een melding.",
    },
    placeOrder: "Bestelling plaatsen (demo)",
    placing: "Bestelling plaatsen",
    formNote: "Er wordt niets opgeslagen of verstuurd.",
    placed: {
      title: "Je demo-bestelling is geplaatst",
      text: "Dit was een demo: er is niets betaald en niets verstuurd.",
      orderRef: "Bestelnummer",
      total: "Totaal",
      items: (count) => (count === 1 ? "1 artikel" : `${count} artikelen`),
      emailNote: (email) => `In de echte winkel krijg je nu een bevestiging op ${email}.`,
      cta: { label: "Verder shoppen", href: "/collections/alle" },
    },
    empty: {
      title: "Je tas is leeg",
      text: "Er valt nog niets af te rekenen. Kies eerst een paar sparks.",
      cta: { label: "Shop nieuw", href: "/collections/nieuw" },
      secondary: { label: "Bekijk alles", href: "/collections/alle" },
    },
    shopify: {
      text: "Je rekent af in onze beveiligde checkout. Open je tas en kies Afrekenen.",
      button: "Open je tas",
    },
  },
};
