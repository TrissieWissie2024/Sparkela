import type { SubscribeSource } from "@/lib/types";
import { welcomeCode } from "@/content/offers";
import { site } from "@/content/site";

/**
 * Form copy (docs/PLAN.md §5.1, §13.13, §14.14, §14.15, §14.20, §14.21, §15): sign-up, consent error, double opt-in
 * confirmation, withdrawal, contact, waitlist, form status, validation, the honeypot, the mails and the mini footer.
 * Owned by C1 in wave 4-6 (type and value together). The consent sentence itself is site.consentText
 * (content/site.ts); percentages, the code, days and the cut-off come from content/offers.ts, content/shipping.ts and
 * content/site.ts, so copy and config never drift (brief §2.8, plan §21.2). Templated copy takes formatted strings.
 */
export interface FormsCopy {
  subscribe: {
    /** Accessible name of every sign-up form. */
    formLabel: string;
    /**
     * The form's name per source where another sign-up can be on the same page (the footer's): two form landmarks
     * with one name read as duplicates (axe landmark-unique, QA round 1). Others use formLabel.
     */
    formLabelBySource: Partial<Record<SubscribeSource, string>>;
    emailLabel: string;
    emailPlaceholder: string;
    /** Next to every sign-up field: what you sign up for (brief §2.8). */
    what: string;
    consentError: string;
    /**
     * After every sign-up: a mail is on its way (the confirmation link, or for a member a "je bent al lid" mail). The
     * same answer for every address, so the form never tells whether an address is a member (decision 199).
     */
    pending: string;
    sending: string;
    /** Heading of the success state (focus moves there). */
    successTitle: string;
  };
  confirm: {
    title: string;
    intro: string;
    button: string;
    sending: string;
    success: string;
    successText: string;
    already: string;
    /** H1 of the "invalid" state (an expired or broken link, or no token at all). */
    invalidTitle: string;
    expired: string;
    invalid: string;
    /** Heading above the sign-up form shown after an expired or invalid link; states the reward up front (brief §2.8). */
    retryTitle: string;
    toShop: string;
    toWaitlist: string;
    /** Text of the fallback before JavaScript runs (plan §14.21). */
    noScript: (email: string) => string;
    metaTitle: string;
    metaDescription: string;
  };
  withdrawal: {
    title: string;
    metaDescription: string;
    intro: (days: string) => string;
    formTitle: string;
    formIntro: string;
    fields: {
      name: string;
      orderNumber: string;
      orderNumberHint: string;
      email: string;
      emailHint: string;
      productsHint: string;
    };
    /** The one button of the withdrawal form (brief §6). */
    submit: string;
    productsLabel: string;
    sending: string;
    receipt: {
      title: string;
      text: string;
      reference: string;
      receivedAt: string;
      detailsTitle: string;
      nextTitle: string;
      next: (days: string) => string[];
    };
    /** Labels of WithdrawalReceipt.summary (route, receipt and mails). */
    summary: { name: string; orderNumber: string; email: string; products: string; productsEmpty: string };
    /** Subject of the mailto fallback without mail keys (plan §15.4 step 3). */
    mailtoSubject: (orderNumber: string) => string;
    /** First line of the mailto body: an unambiguous withdrawal statement, followed by the filled-in fields. */
    mailtoIntro: string;
    /** Under the intro on /herroepen, above the form. */
    hygieneTitle: string;
  };
  contact: {
    title: string;
    metaDescription: string;
    intro: string;
    emailTitle: string;
    responseTime: string;
    formTitle: string;
    fields: { name: string; email: string; orderNumber: string; orderNumberHint: string; message: string };
    submit: string;
    sending: string;
    success: string;
    sendAnother: string;
    companyTitle: string;
    moreTitle: string;
    faqLink: string;
    shippingLink: string;
    withdrawalLink: string;
  };
  waitlist: {
    title: string;
    /** launchLabel = formatDayMonth(site.launchAt), never typed again (plan §14.20). */
    promise: (launchLabel: string) => string;
    signupTitle: string;
    /** Before the launch: when the shop opens (formatStartLabel(site.launchAt)), same box as `live`. */
    opensAt: (startLabel: string) => string;
    live: string;
    toShop: string;
    benefitsLabel: string;
    socialsLabel: string;
    metaTitle: string;
    metaDescription: string;
  };
  status: {
    /** not-configured or upstream: the mailto fallback (plan §13.13). */
    fallback: (email: string) => string;
    sending: string;
    error: string;
    rateLimited: string;
    checkFields: string;
  };
  validation: {
    email: string;
    name: string;
    orderNumber: string;
    message: string;
    tooLong: (max: number) => string;
  };
  honeypot: { label: string };
  mail: {
    greeting: string;
    greetingName: (name: string) => string;
    signoff: string;
    footer: string;
    linkRemoved: string;
    confirm: {
      subject: string;
      intro: string;
      button: string;
      linkHint: string;
      validity: (days: string) => string;
      code: string;
      ignore: string;
    };
    withdrawalCustomer: {
      subject: (orderNumber: string) => string;
      intro: string;
      receivedAt: (label: string) => string;
      reference: (reference: string) => string;
      detailsTitle: string;
      nextTitle: string;
      questions: (email: string) => string;
    };
    withdrawalCopy: {
      subject: (orderNumber: string, reference: string) => string;
      intro: string;
    };
    /** A sign-up of an address that is already a confirmed member (lib/mail.ts memberMail, decision 199). */
    member: {
      subject: string;
      intro: string;
      ignore: string;
    };
    contact: {
      subject: (name: string) => string;
      intro: string;
      message: string;
    };
  };
  miniFooter: {
    legalLabel: string;
    companyLabel: string;
    kvk: (kvk: string) => string;
    vatId: (vatId: string) => string;
  };
}

const { code, percent } = welcomeCode;
const days = String(site.returnDays);

export const formsCopy: FormsCopy = {
  subscribe: {
    formLabel: "Aanmelden voor de Sparkela Club",
    formLabelBySource: {
      popup: "Aanmelden via de Spark-kaarten",
      finder: "Aanmelden na de Spark Finder",
      wachtlijst: "Aanmelden voor de wachtlijst",
    },
    emailLabel: "Je e-mailadres",
    emailPlaceholder: "jij@voorbeeld.nl",
    what: `${percent}% op je eerste bestelling, nieuwe drops en af en toe een actie. Afmelden kan altijd.`,
    consentError: "Vink aan dat je de nieuwsbrief wilt ontvangen.",
    pending: `Check je mail om je aanmelding af te ronden. Je code ${code} kun je meteen gebruiken.`,
    sending: "Je aanmelding wordt verstuurd.",
    successTitle: "Bijna klaar",
  },
  confirm: {
    title: "Bevestig je aanmelding",
    intro: "Nog één klik en je zit in de Sparkela Club. Zo weten we zeker dat jij je zelf hebt aangemeld.",
    button: "Bevestig mijn aanmelding",
    sending: "We bevestigen je aanmelding.",
    success: "Je bent erbij.",
    successText: `Je hoort als eerste van nieuwe drops en krijgt early access. Je code ${code} geeft ${percent}% op je eerste bestelling.`,
    already: "Je aanmelding was al bevestigd. Je zit al in de Club.",
    invalidTitle: "Deze link werkt niet meer",
    expired: "Deze link is verlopen. Hieronder vraag je een nieuwe aan.",
    invalid: "Geen probleem: hieronder vraag je een nieuwe link aan.",
    retryTitle: `Meld je opnieuw aan en krijg ${percent}% op je eerste bestelling`,
    toShop: "Naar de shop",
    toWaitlist: "Naar de wachtlijst",
    noScript: (email) => `Zonder JavaScript werkt deze knop niet. Zet JavaScript aan of mail ons op ${email}.`,
    metaTitle: "Aanmelding bevestigen",
    metaDescription: "Bevestig je aanmelding voor de Sparkela Club met één klik.",
  },
  withdrawal: {
    title: "Herroepen",
    metaDescription: `Je hebt ${days} dagen bedenktijd. Herroep je bestelling hier en je krijgt direct een ontvangstbevestiging per mail.`,
    intro: (d) =>
      `Je hebt ${d} dagen bedenktijd. Wil je je bestelling, of een deel ervan, herroepen? Vul het formulier in. Je krijgt direct een ontvangstbevestiging per mail.`,
    formTitle: "Herroepingsformulier",
    formIntro: "Alle velden zijn nodig, behalve de producten.",
    fields: {
      name: "Je naam",
      orderNumber: "Bestelnummer",
      orderNumberHint: "Staat in je orderbevestiging, bijvoorbeeld #1001.",
      email: "E-mailadres voor de bevestiging",
      emailHint: "Hier sturen we je ontvangstbevestiging naartoe.",
      productsHint: "Laat dit leeg als je de hele bestelling herroept.",
    },
    submit: "Herroeping bevestigen",
    productsLabel: "Welke producten? (optioneel)",
    sending: "Je herroeping wordt verstuurd.",
    receipt: {
      title: "We hebben je herroeping ontvangen",
      text: "Hieronder staat wat je hebt ingevuld. Dezelfde bevestiging krijg je per mail.",
      reference: "Referentie",
      receivedAt: "Ontvangen op",
      detailsTitle: "Wat je hebt ingevuld",
      nextTitle: "Hoe gaat het nu verder?",
      next: (d) => [
        "We mailen je het adres waar je de producten naartoe stuurt.",
        `Stuur de producten binnen ${d} dagen na je herroeping terug, goed verpakt.`,
        `We betalen je binnen ${d} dagen na je herroeping terug. We mogen daarmee wachten tot we de producten terug hebben, of tot je laat zien dat je ze hebt teruggestuurd.`,
        site.hygieneRule,
      ],
    },
    summary: {
      name: "Naam",
      orderNumber: "Bestelnummer",
      email: "E-mailadres",
      products: "Producten",
      productsEmpty: "Niet ingevuld",
    },
    mailtoSubject: (orderNumber) => `Herroeping bestelling ${orderNumber}`,
    mailtoIntro: "Hierbij herroep ik de overeenkomst over de bestelling hieronder.",
    hygieneTitle: "Let op bij oorbellen en piercings",
  },
  contact: {
    title: "Contact",
    metaDescription: `Vraag over je bestelling of een sieraad? Mail ons of stuur een bericht. Je hoort binnen ${site.responseTime} van ons.`,
    intro: "Vraag over je bestelling, een sieraad of je stack? Stuur ons een bericht, we helpen je graag.",
    emailTitle: "Mail ons",
    responseTime: `Binnen ${site.responseTime} antwoord`,
    formTitle: "Stuur een bericht",
    fields: {
      name: "Je naam",
      email: "Je e-mailadres",
      orderNumber: "Bestelnummer",
      orderNumberHint: "Gaat je vraag over een bestelling? Dan helpt je bestelnummer ons, bijvoorbeeld #1001.",
      message: "Je bericht",
    },
    submit: "Verstuur bericht",
    sending: "Je bericht wordt verstuurd.",
    success: `Dank je. We reageren binnen ${site.responseTime}.`,
    sendAnother: "Nog een bericht sturen",
    companyTitle: "Bedrijfsgegevens",
    moreTitle: "Misschien staat je antwoord er al",
    faqLink: "Veelgestelde vragen",
    shippingLink: "Verzenden en retourneren",
    withdrawalLink: "Bestelling herroepen",
  },
  waitlist: {
    title: "Sparkela komt eraan",
    promise: (launchLabel) => `Chunky sieraden met een spark. Vanaf ${launchLabel} online.`,
    signupTitle: `Als eerste shoppen, plus ${percent}% op je eerste bestelling`,
    opensAt: (startLabel) => `De shop opent op ${startLabel}.`,
    live: "We zijn live.",
    toShop: "Naar de shop",
    benefitsLabel: "Wat je krijgt als Club-lid",
    socialsLabel: "Volg Sparkela",
    metaTitle: `${site.name} | Binnenkort online`,
    metaDescription: `Chunky sieraden met een spark, gestyled door Linde. Meld je aan, shop als eerste en krijg ${percent}% op je eerste bestelling.`,
  },
  status: {
    fallback: (email) => `Dat lukt nu even niet. Mail ons op ${email}.`,
    sending: "Bezig met verzenden",
    error: "Dat lukte niet. Probeer het opnieuw.",
    rateLimited: "Je hebt het net een paar keer geprobeerd. Wacht een paar minuten en probeer het dan opnieuw.",
    checkFields: "Kijk de gemarkeerde velden nog even na.",
  },
  validation: {
    email: "Vul een geldig e-mailadres in.",
    name: "Vul je naam in.",
    orderNumber: "Vul je bestelnummer in, bijvoorbeeld #1001.",
    message: "Schrijf minstens een korte zin.",
    tooLong: (max) => `Maximaal ${max} tekens.`,
  },
  honeypot: { label: "Laat dit veld leeg" },
  mail: {
    greeting: "Hoi,",
    greetingName: (name) => `Hoi ${name},`,
    signoff: `Groetjes,\nLinde en Tristan van ${site.name}`,
    footer: `${site.company.tradeName} · ${site.company.legalName} · ${site.company.address} · KvK ${site.company.kvk}`,
    linkRemoved: "[link verwijderd]",
    confirm: {
      subject: "Bevestig je aanmelding bij Sparkela",
      intro: "Leuk dat je bij de Sparkela Club wilt. Klik op de knop om je aanmelding te bevestigen. Pas daarna sturen we je onze nieuwsbrief.",
      button: "Bevestig mijn aanmelding",
      linkHint: "Werkt de knop niet? Plak deze link in je browser:",
      validity: (d) => `De link werkt ${d} dagen.`,
      code: `Je code ${code} voor ${percent}% op je eerste bestelling kun je nu al gebruiken.`,
      ignore: "Heb je je niet zelf aangemeld? Negeer deze mail dan. Je krijgt dan niets van ons.",
    },
    withdrawalCustomer: {
      subject: (orderNumber) => `Ontvangstbevestiging herroeping ${orderNumber}`,
      intro: "We hebben je herroeping ontvangen. Dit is je ontvangstbevestiging.",
      receivedAt: (label) => `Ontvangen op ${label}`,
      reference: (reference) => `Referentie: ${reference}`,
      detailsTitle: "Wat je hebt ingevuld",
      nextTitle: "Hoe gaat het nu verder?",
      questions: (email) => `Vragen? Mail ons op ${email}.`,
    },
    withdrawalCopy: {
      subject: (orderNumber, reference) => `Herroeping ${orderNumber} (${reference})`,
      intro: "Er is een herroeping binnengekomen via het formulier op de site. Beantwoord deze mail om de klant te mailen.",
    },
    member: {
      subject: "Je bent al lid van de Sparkela Club",
      intro: "Dit e-mailadres is net aangemeld voor de Sparkela Club. Je bent al lid, dus er verandert niets: je hoort nog steeds als eerste van nieuwe drops.",
      ignore: "Heb je je niet zelf aangemeld? Dan hoef je niets te doen.",
    },
    contact: {
      subject: (name) => `Contact: ${name}`,
      intro: "Nieuw bericht via het contactformulier. Beantwoord deze mail om de afzender direct te mailen.",
      message: "Bericht",
    },
  },
  miniFooter: {
    legalLabel: "Juridisch",
    companyLabel: "Bedrijfsgegevens",
    kvk: (kvk) => `KvK ${kvk}`,
    vatId: (vatId) => `Btw-id ${vatId}`,
  },
};
