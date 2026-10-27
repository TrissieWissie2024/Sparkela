import { EARLY_ACCESS_HOURS } from "@/content/drops";

/**
 * Chrome copy (docs/PLAN.md §5.1, §12.3, §13.5, §13.6): announcement bar, header, search dialog, mobile menu,
 * footer and consent banner. Created in wave 3a with the texts the plan already names; C3 owns this file in
 * wave 4-6 and adds the rest (type and value together). The cookie table lives in content/legal.ts, the USPs in
 * site.usps and the generic labels (close, menu, search) in sharedCopy.ui.
 */
export interface ChromeCopy {
  promo: {
    /** Drop starting within 7 days: "Nieuwe drop: {naam}." followed by the countdown (plan §12.3 rule 2). */
    dropUpcoming: (name: string) => string;
    /** Before the countdown of an upcoming drop: "Over {timer}". */
    dropUpcomingIn: string;
    earlyAccessLink: string;
    /** Drop live for less than 7 days (rule 3). */
    dropLive: (name: string) => string;
    dropLink: string;
  };
  header: {
    cart: string;
    /** Accessible name of the cart button. */
    cartLabel: (count: number) => string;
    account: string;
    openMenu: string;
    home: string;
  };
  consent: {
    accept: string;
    reject: string;
  };
}

export const chromeCopy: ChromeCopy = {
  promo: {
    dropUpcoming: (name) => `Nieuwe drop: ${name}.`,
    dropUpcomingIn: "Over",
    earlyAccessLink: `Club-leden zijn er ${EARLY_ACCESS_HOURS} uur eerder bij`,
    dropLive: (name) => `Nu live: ${name}`,
    dropLink: "Bekijk de drop",
  },
  header: {
    cart: "Tas",
    cartLabel: (count) => (count === 1 ? "Tas, 1 artikel" : `Tas, ${count} artikelen`),
    account: "Account",
    openMenu: "Menu openen",
    home: "Sparkela, naar de homepage",
  },
  consent: {
    accept: "Akkoord",
    reject: "Weigeren",
  },
};
