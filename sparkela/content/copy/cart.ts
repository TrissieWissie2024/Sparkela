import type { CartErrorCode } from "@/lib/commerce/types";
import type { DiscountSource } from "@/lib/types";

/**
 * Cart copy (docs/PLAN.md §5.1, §13.7, §14.4): drawer, lines, totals, gift wrap, gift message, upsell, notices,
 * errors, empty state, campaign line and quick add. Created in wave 3a; C3 owns this file in wave 4-6 and keeps type
 * and value together. Progress texts live in sharedCopy.progress (lib/pricing.ts returns them), cart announcements in
 * sharedCopy.announce, "Je bespaart" in sharedCopy.price.savings and the generic labels in sharedCopy.ui.
 */
export interface CartCopy {
  /** Title of the cart drawer (the e2e locator looks for the dialog "Je tas"). */
  title: string;
  /** Next to the title once the cart has loaded. */
  itemCount: (count: number) => string;
  checkout: string;
  /** Label of the checkout button while it leads to the checkout. */
  checkoutLoading: string;
  /** During a campaign window, instead of a product in the cart (brief §4, plan §12.2). */
  campaignNote: string;
  /** Accessible name of the list of cart lines. */
  linesLabel: string;
  line: {
    /** A discount on a line is its own row, never a struck price (decision 117): "Stack-korting −€2,24". */
    discount: (label: string, amount: string) => string;
    /** Under the stepper at the stock limit, so the grey "+" has a reason. */
    maxStock: (count: number) => string;
    /** The label of a line discount per source. */
    discountLabels: Record<DiscountSource, string>;
    /** The line total under its discount rows. */
    total: (amount: string) => string;
    remove: string;
    /** Accessible name of the remove button; starts with the visible label (WCAG 2.5.3). */
    removeLabel: (title: string) => string;
    quantity: {
      /** Name of the stepper group. */
      label: (title: string) => string;
      decrease: (title: string) => string;
      increase: (title: string) => string;
    };
    /** Quantity of a read-only line (demo checkout). */
    quantityReadOnly: (quantity: number) => string;
    /** Under a gift card line: it is not shipped. */
    giftCardNote: string;
  };
  progress: {
    /** Accessible name of the progress block. */
    label: string;
    shippingMeter: string;
    stackMeter: string;
  };
  giftWrap: {
    label: string;
    description: string;
    /** The surcharge next to the checkbox, outside December: "+€1,95". */
    price: (amount: string) => string;
    /** In the free window (1 to 31 December). */
    free: string;
  };
  giftMessage: {
    /** Button that opens the field. */
    toggle: string;
    label: string;
    hint: string;
  };
  upsell: {
    title: string;
    /** With only gift cards in the tas: a voucher has no look to finish (QA round 2, as the gift card's product page). */
    giftCardTitle: string;
    listLabel: string;
  };
  totals: {
    /** Accessible name of the totals list. */
    label: string;
    subtotal: string;
    shipping: string;
    shippingFree: string;
    /** Shopify carts have no address yet, so no shipping amount (decision 34). */
    shippingAtCheckout: string;
    /** Gift cards only: nothing is shipped. */
    shippingNone: string;
    total: string;
    /** A discount code row: "Code WELKOM10". */
    code: (code: string) => string;
    /** The row of the free gift wrap in December (the discount's own title stays Shopify's). */
    giftWrapFree: string;
    removeCode: string;
    removeCodeLabel: (code: string) => string;
    /** Why a stored code does not count right now (DiscountCodeState.reason). */
    codeReasons: { "not-combinable": string; unknown: string; "not-eligible": string };
    /** Under a code row when the code beats the stack discount (QA round 2, the mirror of codeReasons). */
    codeBeatsStack: string;
    /** Under a code row when the code takes the order just under free shipping (QA round 2). */
    codeBelowFreeShipping: (threshold: string, remaining: string) => string;
    /** Polite announcement after "Verwijderen". */
    codeRemoved: (code: string) => string;
  };
  discount: {
    notApplicable: string;
  };
  notices: {
    codeNotCombined: (code: string) => string;
    codeInvalid: (code: string) => string;
    /** `title` is "" when the product is unknown (decision 173). */
    lineRemoved: (title: string) => string;
    quantityCapped: (title: string, max: number) => string;
    notYetAvailable: (title: string) => string;
  };
  /** Shown in the drawer after a failed cart action (CartContextValue.lastError). */
  errors: Record<CartErrorCode, string>;
  empty: {
    title: string;
    text: string;
    cta: { label: string; href: string };
    secondary: { label: string; href: string };
  };
  quickAdd: {
    add: string;
    /** Accessible names start with the visible label (WCAG 2.5.3). */
    addLabel: (title: string) => string;
    added: string;
    addedLabel: (title: string) => string;
    adding: string;
    /** Several variants: opens a small choice list in the card. */
    choose: string;
    chooseLabel: (title: string) => string;
    /** Accessible name of the choice list. */
    panelLabel: (title: string) => string;
    /** Legend of the radio group when the product has no option name. */
    optionFallback: string;
    /** Behind a sold-out variant in the choice list. */
    optionSoldOut: string;
    /** A variant in the choice list when the variants differ in price: "{title} · {price}". */
    optionWithPrice: (title: string, price: string) => string;
    /** The gift card has amounts: a link to its product page. */
    chooseAmount: string;
    chooseAmountLabel: (title: string) => string;
    soldOut: string;
    soldOutLabel: (title: string) => string;
    closePanel: string;
    /** A ring: "In tas" pressed before a size is chosen (no size is preselected). */
    chooseSizeFirst: string;
  };
}

export const cartCopy: CartCopy = {
  title: "Je tas",
  itemCount: (count) => (count === 1 ? "1 artikel" : `${count} artikelen`),
  checkout: "Afrekenen",
  checkoutLoading: "Naar afrekenen",
  campaignNote: "Bij deze bestelling zit een cadeautje van ons.",
  linesLabel: "Artikelen in je tas",
  line: {
    discount: (label, amount) => `${label} ${amount}`,
    maxStock: (count) => `Meer hebben we er nu niet: maximaal ${count}.`,
    discountLabels: {
      stack: "Stack-korting",
      code: "Kortingscode",
      cadeauverpakking: "Cadeauverpakking gratis",
      overig: "Korting",
    },
    total: (amount) => `Samen ${amount}`,
    remove: "Verwijderen",
    removeLabel: (title) => `Verwijderen: ${title}`,
    quantity: {
      label: (title) => `Aantal ${title}`,
      decrease: (title) => `Minder ${title}`,
      increase: (title) => `Meer ${title}`,
    },
    quantityReadOnly: (quantity) => `Aantal: ${quantity}`,
    giftCardNote: "Komt per mail",
  },
  progress: {
    label: "Je voordelen",
    shippingMeter: "Op weg naar gratis verzending",
    stackMeter: "Op weg naar stack-korting",
  },
  giftWrap: {
    label: "Cadeauverpakking",
    description: "We pakken je bestelling feestelijk in.",
    price: (amount) => `+${amount}`,
    free: "Gratis in december",
  },
  giftMessage: {
    toggle: "Cadeauboodschap toevoegen",
    label: "Cadeauboodschap",
    hint: "Je boodschap gaat mee in het pakketje.",
  },
  upsell: {
    title: "Maak de look af",
    giftCardTitle: "Of kies zelf een spark",
    listLabel: "Stukken die erbij passen",
  },
  totals: {
    label: "Overzicht van je bestelling",
    subtotal: "Subtotaal",
    shipping: "Verzending",
    shippingFree: "Gratis",
    shippingAtCheckout: "Berekend bij afrekenen",
    shippingNone: "Per mail",
    total: "Totaal",
    code: (code) => `Code ${code}`,
    giftWrapFree: "Gratis cadeauverpakking in december",
    removeCode: "Verwijderen",
    removeCodeLabel: (code) => `Verwijderen: code ${code}`,
    codeReasons: {
      "not-combinable": "Je stack-korting is hoger, dus deze code telt nu niet mee.",
      unknown: "Deze code kennen we niet.",
      "not-eligible": "Deze code werkt niet voor wat er nu in je tas zit.",
    },
    codeBeatsStack: "Je code levert meer op dan de stack-korting, dus we rekenen met je code.",
    codeBelowFreeShipping: (threshold, remaining) =>
      `Met je code kom je net onder ${threshold}. Nog ${remaining} en je verzending is weer gratis.`,
    codeRemoved: (code) => `Code ${code} verwijderd.`,
  },
  discount: {
    notApplicable: "Deze code werkt niet voor wat er nu in je tas zit.",
  },
  notices: {
    codeNotCombined: (code) => `Je stack-korting is hoger dan ${code}, dus die geldt nu.`,
    codeInvalid: (code) => `De code ${code} kennen we niet.`,
    lineRemoved: (title) =>
      title ? `${title} is niet meer te koop en staat niet meer in je tas.` : "Een stuk is niet meer te koop en staat niet meer in je tas.",
    quantityCapped: (title, max) => `Van ${title} hebben we er nu ${max}. Die ${max === 1 ? "zit" : "zitten"} al in je tas.`,
    notYetAvailable: (title) => `${title} is nog niet te koop.`,
  },
  errors: {
    network: "Geen verbinding. Check je internet en probeer het opnieuw.",
    invalid: "Dat ging niet goed. Probeer het opnieuw.",
    unavailable: "Dit stuk is net uitverkocht.",
    "not-yet-available": "Dit stuk is nog niet te koop.",
    "quantity-capped": "Meer hebben we er nu niet van.",
    "code-invalid": "Deze code kennen we niet.",
    "rate-limited": "Even rustig aan. Probeer het over een minuutje opnieuw.",
    upstream: "Je tas bijwerken lukt nu even niet. Probeer het opnieuw.",
    "not-configured": "Je tas werkt nu even niet. Probeer het later opnieuw.",
    empty: "Je tas is leeg.",
  },
  empty: {
    title: "Je tas is nog leeg",
    text: "Eén paar chunky oorbellen en je outfit is af. Begin bij het nieuwste van Linde.",
    cta: { label: "Shop nieuw", href: "/collections/nieuw" },
    secondary: { label: "Bekijk alles", href: "/collections/alle" },
  },
  quickAdd: {
    add: "In tas",
    addLabel: (title) => `In tas: ${title}`,
    added: "Toegevoegd",
    addedLabel: (title) => `Toegevoegd: ${title}`,
    adding: "Toevoegen",
    choose: "Kies",
    chooseLabel: (title) => `Kies uitvoering: ${title}`,
    panelLabel: (title) => `Kies een uitvoering van ${title}`,
    optionFallback: "Uitvoering",
    optionSoldOut: "uitverkocht",
    optionWithPrice: (title, price) => `${title} · ${price}`,
    chooseAmount: "Kies bedrag",
    chooseAmountLabel: (title) => `Kies bedrag: ${title}`,
    soldOut: "Uitverkocht",
    soldOutLabel: (title) => `Uitverkocht: ${title}`,
    closePanel: "Keuze sluiten",
    chooseSizeFirst: "Kies eerst je maat.",
  },
};
