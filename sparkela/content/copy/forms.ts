import { welcomeCode } from "@/content/offers";

/**
 * Form copy (docs/PLAN.md §5.1, §13.13, §15): sign-up, consent error, double opt-in confirmation, withdrawal,
 * contact, waitlist, form status and validation. Created in wave 3a with the keys the plan already fixes; C1 owns
 * this file in wave 4-6 and adds the rest (type and value together). The consent sentence itself is
 * site.consentText (content/site.ts); percentages and the code come from content/offers.ts.
 */
export interface FormsCopy {
  subscribe: {
    /** Next to every sign-up field: what you sign up for (brief §2.8). */
    what: string;
    consentError: string;
    pending: string;
    alreadySubscribed: string;
  };
  confirm: {
    title: string;
    button: string;
    success: string;
    expired: string;
    invalid: string;
  };
  withdrawal: {
    /** The one button of the withdrawal form (brief §6). */
    submit: string;
    productsLabel: string;
  };
  waitlist: {
    title: string;
    /** launchLabel = formatDayMonth(site.launchAt), never typed again (plan §14.20). */
    promise: (launchLabel: string) => string;
    signupTitle: string;
    live: string;
    toShop: string;
  };
  status: {
    /** not-configured or upstream: the mailto fallback (plan §13.13). */
    fallback: (email: string) => string;
  };
}

export const formsCopy: FormsCopy = {
  subscribe: {
    what: "Nieuwe drops, early access en af en toe een actie. Afmelden kan altijd.",
    consentError: "Vink aan dat je de nieuwsbrief wilt ontvangen.",
    pending: `Check je mail en bevestig je aanmelding. Je code ${welcomeCode.code} kun je meteen gebruiken.`,
    alreadySubscribed: `Je bent al lid. Je code is ${welcomeCode.code}.`,
  },
  confirm: {
    title: "Bevestig je aanmelding",
    button: "Bevestig mijn aanmelding",
    success: "Je bent erbij.",
    expired: "Deze link is verlopen. Meld je opnieuw aan, dan sturen we je een nieuwe.",
    invalid: "Deze link werkt niet. Meld je opnieuw aan, dan sturen we je een nieuwe.",
  },
  withdrawal: {
    submit: "Herroeping bevestigen",
    productsLabel: "Welke producten? (optioneel)",
  },
  waitlist: {
    title: "Sparkela komt eraan",
    promise: (launchLabel) => `Chunky sieraden met een spark. Vanaf ${launchLabel} online.`,
    signupTitle: `Als eerste shoppen, plus ${welcomeCode.percent}% op je eerste bestelling`,
    live: "We zijn live.",
    toShop: "Naar de shop",
  },
  status: {
    fallback: (email) => `Dat lukt nu even niet. Mail ons op ${email}.`,
  },
};
