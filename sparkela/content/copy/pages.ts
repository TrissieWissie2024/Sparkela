/**
 * Page copy (docs/PLAN.md §5.1, §14.9 to §14.19): Over Sparkela, Club page, FAQ page, Spark Finder page, popup,
 * account and the demo checkout. The 404 copy lives in sharedCopy.notFound. Created in wave 3a with the texts the
 * plan already names; D4 owns this file in wave 7-9 and adds the rest (type and value together).
 */
export interface PagesCopy {
  about: {
    title: string;
    /** Placeholder until Linde writes her own story (brief §3: no invented personal details). */
    lindeIntro: string;
  };
  account: { title: string; text: string };
  checkout: {
    /** Local provider only (brief §7). */
    demoNotice: string;
  };
}

export const pagesCopy: PagesCopy = {
  about: {
    title: "Over Sparkela",
    lindeIntro: "Hoi, ik ben Linde. [Linde schrijft hier haar eigen verhaal.]",
  },
  account: {
    title: "Account",
    text: "Inloggen kan straks hier. Vragen over je bestelling? Mail ons.",
  },
  checkout: {
    demoNotice: "Demo-checkout: er wordt niet betaald",
  },
};
