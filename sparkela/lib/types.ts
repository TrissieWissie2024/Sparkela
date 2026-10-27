/**
 * Domain types for Sparkela (docs/PLAN.md §6, verbatim). Pure: no imports, no runtime code except CARD_BADGE_ORDER.
 *
 * Times are ISO strings with an offset ("2026-11-27T00:00:00+01:00"), dates without a time are "YYYY-MM-DD",
 * and every amount is an integer number of euro cents.
 *
 * Copy types live next to their copy (SiteConfig in content/site.ts, SharedCopy in content/copy/shared.ts, ...),
 * so the owner of a copy file can add keys without touching this file.
 */

/* -------------------------------------------------------------------------- */
/* §6.1 Base                                                                   */
/* -------------------------------------------------------------------------- */

export type CurrencyCode = "EUR";
/** Integer euro cents. 1495 = €14,95. Never floats. */
export type Cents = number;
export interface Money { cents: Cents; currency: CurrencyCode }

export type IsoDateTime = string;   // "2026-11-27T00:00:00+01:00"
export type IsoDate = string;       // "2026-12-25"
export interface TimeWindow { startsAt: IsoDateTime; endsAt: IsoDateTime }   // endsAt exclusive

export type CountryCode = "NL" | "BE";
export type CommerceProviderName = "local" | "shopify";

/* -------------------------------------------------------------------------- */
/* §6.2 Catalog vocabulary                                                     */
/* -------------------------------------------------------------------------- */

export type ProductType = "oorbellen" | "armbanden" | "kettingen" | "ringen" | "cadeaukaart" | "cadeauverpakking";
export type JewelryType = Extract<ProductType, "oorbellen" | "armbanden" | "kettingen" | "ringen">;
export type StackEligibleType = Extract<ProductType, "oorbellen" | "armbanden">;
export type Vibe = "chunky-en-bold" | "clean-en-classy" | "kleurrijk-en-speels" | "retro";
export type Moment = "festival" | "date-night" | "kantoor-maar-niet-saai" | "strand" | "feestdagen";
export type DropSlug =
  | "holiday-sparkle" | "love-club" | "oranje-spark" | "like-mother-like-daughter"
  | "summer-spark" | "main-character" | "vamp" | "spark-friday";

/** Parsed from Shopify tags "type:…", "vibe:…", "moment:…", "drop:…", plus plain tags "nieuw", "verborgen" and "piercing". */
export interface ProductTags {
  type: ProductType | null;
  vibes: Vibe[];
  moments: Moment[];
  drops: DropSlug[];
  nieuw: boolean;
  verborgen: boolean;      // never listed (gift wrap)
  piercing: boolean;       // plain tag "piercing": hygiene rule applies (brief §2.10), see needsHygieneSeal()
  raw: string[];           // all tags, lower-cased and trimmed
}

/** Collection filters and sorting (used by lib/catalog.ts, the filter UI and sharedCopy.vocab). */
export type PriceBucket = "tot-15" | "15-20" | "20-25" | "vanaf-25";
export type SortKey = "uitgelicht" | "prijs-oplopend" | "prijs-aflopend" | "nieuwste";
export interface Facets { types: JewelryType[]; vibes: Vibe[]; moments: Moment[]; price: PriceBucket[] }

/* -------------------------------------------------------------------------- */
/* §6.3 Product                                                                */
/* -------------------------------------------------------------------------- */

export type ImageKind = "packshot" | "draagfoto" | "detail" | "schaal" | "stack" | "overig";
export interface ProductImage { url: string; alt: string; width: number; height: number; kind: ImageKind }

export interface SelectedOption { name: string; value: string }
export type SwatchId = "goud" | "zilver";

export interface Variant {
  id: string;                         // Shopify GID or "local:<handle>:<n>"
  title: string;                      // "Goud", "17", "€25"
  sku: string | null;
  availableForSale: boolean;
  quantityAvailable: number | null;   // null = not tracked or not exposed
  price: Money;
  compareAtPrice: Money | null;       // raw from Shopify; display only via lib/pricing.priceDisplay()
  selectedOptions: SelectedOption[];
  swatch: SwatchId | null;            // from option value "Goud"/"Zilver"
  image: ProductImage | null;
}

export interface ProductOption { name: string; values: string[] }   // "Kleur" | "Maat" | "Bedrag"

export interface ProductMetafields {
  specRegel: string | null;              // custom.spec_regel        single_line_text_field
  materiaal: string | null;              // custom.materiaal         single_line_text_field
  afmetingen: string | null;             // custom.afmetingen        single_line_text_field
  gewicht: string | null;                // custom.gewicht           single_line_text_field
  sluiting: string | null;               // custom.sluiting          single_line_text_field
  verzorging: string | null;             // custom.verzorging        multi_line_text_field
  statementMeter: 1 | 2 | 3 | 4 | 5 | null; // custom.statement_meter number_integer (1..5)
  nikkelvrij: boolean | null;            // custom.nikkelvrij        boolean (true counts as verified)
  gpsrFabrikant: string | null;          // custom.gpsr_fabrikant    multi_line_text_field
  gpsrVerantwoordelijkeEu: string | null;// custom.gpsr_verantwoordelijke_eu multi_line_text_field
  gpsrWaarschuwingen: string | null;     // custom.gpsr_waarschuwingen multi_line_text_field
  laagstePrijs30d: Money | null;         // custom.laagste_prijs_30d money
  bestseller: boolean;                   // custom.bestseller        boolean (manual flag; false if absent)
  lindesFavoriet: boolean;               // custom.lindes_favoriet   boolean
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  description: string;                 // short styling text, plain text
  type: ProductType | null;            // = tags.type (Shopify productType is ignored)
  tags: ProductTags;
  metafields: ProductMetafields;
  images: ProductImage[];              // kind by position: 1 packshot, 2 draagfoto, 3 detail, 4 schaal, 5 stack
  variants: Variant[];
  options: ProductOption[];
  priceRange: { min: Money; max: Money };
  availableForSale: boolean;
  totalQuantityAvailable: number | null; // sum of variant quantityAvailable, null if any is null
  isGiftCard: boolean;
  isGiftWrap: boolean;                 // type === "cadeauverpakking"
  publishedAt: IsoDateTime;
  featuredRank: number;                // 1 = first; local: table order; shopify: index in collection "alle" (MANUAL)
  seo: { title: string | null; description: string | null };
}

/** What client components get through CatalogProvider: no GPSR, care text or long fields. */
export type CatalogProduct = Pick<Product,
  "id" | "handle" | "title" | "type" | "tags" | "images" | "variants" | "options" | "priceRange" |
  "availableForSale" | "totalQuantityAvailable" | "isGiftCard" | "isGiftWrap" | "featuredRank" | "publishedAt"
> & {
  specRegel: string | null;
  lindesFavoriet: boolean;
  bestseller: boolean;                 // manual metafield; only used with site.flags.realSalesData
  laagstePrijs30d: Money | null;       // needed by priceDisplay() on cards
  badges: BadgeId[];                   // already filtered by site.badges.enabled
  listable: boolean;                   // isListable() at the server clock; false for gift wrap, gift card and drop products in early access
};

/** content/products.ts entries: like Product but without derived fields. */
export interface LocalProductInput {
  handle: string; title: string; description: string; tags: string[];
  metafields: Partial<ProductMetafields>;
  options: ProductOption[];
  variants: Array<{ title: string; price: Cents; compareAtPrice?: Cents | null; quantityAvailable: number | null; sku?: string; selectedOptions: SelectedOption[] }>;
  images?: Array<Omit<ProductImage, "kind">>;
  publishedAt: IsoDateTime;
  isGiftCard?: boolean;
}

/* -------------------------------------------------------------------------- */
/* §6.5 Badges                                                                 */
/* -------------------------------------------------------------------------- */

export type MarketingBadgeId = "nieuw" | "limited" | "laatste-stuks" | "sale" | "bestseller";
export type StatusBadgeId = "uitverkocht" | "early-access" | "op-voorraad";
export type BadgeId = MarketingBadgeId | StatusBadgeId;

/** Card shows at most one badge: the first of this order that applies. */
export const CARD_BADGE_ORDER = ["uitverkocht", "laatste-stuks", "limited", "sale", "nieuw", "bestseller"] as const;

export interface BadgeContext {
  now: number;
  drops: Drop[];
  lowStockThreshold: number;               // site.lowStockThreshold
  enabled: readonly MarketingBadgeId[];    // site.badges.enabled
  realSalesData: boolean;                  // site.flags.realSalesData
}

/* -------------------------------------------------------------------------- */
/* §6.6 Claims                                                                 */
/* -------------------------------------------------------------------------- */

export type ClaimId = "nikkelvrij" | "waterproof" | "hypoallergeen";
export interface Claim {
  id: ClaimId;
  label: string;                         // "Nikkelvrij"
  verified: boolean;                     // false at launch
  productHandles: string[] | "alle";     // where it applies when verified
  source: string | null;                 // required when verified: e.g. "Leveranciersverklaring 2026-11-12"
}
export interface VerifiedClaim { id: ClaimId; label: string; origin: "metafield" | "content" }

/* -------------------------------------------------------------------------- */
/* §6.7 Collections, stacks, drops and offers                                  */
/* -------------------------------------------------------------------------- */

export type CollectionRule =
  | { kind: "all" }
  | { kind: "type"; type: JewelryType }
  | { kind: "vibe"; vibe: Vibe }
  | { kind: "moment"; moment: Moment }
  | { kind: "tag"; tag: "nieuw" }
  | { kind: "drop" }                       // any drop that is publicly live now
  | { kind: "maxPrice"; cents: Cents };    // priceRange.min < cents

export interface CollectionDefinition {
  handle: string; title: string; intro: string;
  seo: { title: string; description: string };
  rule: CollectionRule;
  bannerImage: AssetKey | null;
  stylingTile: { afterIndex: number; title: string; text: string; image: AssetKey; href: string } | null;
}
export interface Collection extends CollectionDefinition { products: Product[] }
/** What a collection page gets from lib/shop-data.ts getShopCollection(). */
export interface ShopCollection { definition: CollectionDefinition; products: CatalogProduct[]; facets: Facets }

export interface Stack {
  slug: string; name: string; description: string;
  productHandles: [string, string, string];
  image: AssetKey;
  dropSlug?: DropSlug;
}

export interface Drop {
  slug: DropSlug;
  name: string;                 // "Holiday Sparkle"
  tagline: string;              // one short sentence
  description: string;          // drop page intro
  startsAt: IsoDateTime;        // public start
  endsAt: IsoDateTime;          // exclusive
  productHandles: string[];     // must equal the products tagged drop:<slug>
  banner: { title: string; text: string; cta: string };
  teaser: { title: string; text: string };
  image: AssetKey;
  seo: { title: string; description: string };
}
export type DropPhase = "verborgen" | "early-access" | "live" | "afgelopen";   // see docs/PLAN.md §9.5

export interface PromoCopy { message: string; short: string; href: string | null; linkLabel: string | null }
export interface Campaign extends TimeWindow {
  id: string;                    // "lanceringscadeau"
  title: string;
  promo: PromoCopy;              // announcement bar text
  showTimer: boolean;            // countdown to endsAt
  inCart: false;                 // nothing is added to the cart (brief §4)
}
export interface WelcomeCodeOffer { code: "WELKOM10"; percent: 10; firstOrderOnly: true; combinesWithStack: false; excludedTypes: ProductType[] }
export interface StackDiscountOffer { percent: 15; minUnits: 3; eligibleTypes: StackEligibleType[] }
export interface GiftWrapOffer { productHandle: "cadeauverpakking"; price: Money; freeWindows: TimeWindow[]; maxPerOrder: 1 }
export interface GiftCardOffer { productHandle: "cadeaukaart"; denominations: Cents[] }

/* -------------------------------------------------------------------------- */
/* §6.8 Shipping                                                               */
/* -------------------------------------------------------------------------- */

export interface Holiday { date: IsoDate; name: string }
export interface ShippingCountry {
  code: CountryCode; enabled: boolean; label: string;
  rate: Money; freeFrom: Money;
  transitDays: { min: number; max: number };
}
export interface ShippingConfig {
  timeZone: "Europe/Amsterdam";
  cutoff: { hour: 16; minute: 0; label: "16.00" };
  carrier: "PostNL"; method: "brievenbuspakje";
  countries: Record<CountryCode, ShippingCountry>;   // NL enabled, BE disabled
  defaultCountry: "NL";
  holidays: Holiday[];                                // dispatch closed
  closedDays: Holiday[];                              // extra closures (holiday break), empty at launch
  returnDays: 14;
}

/* -------------------------------------------------------------------------- */
/* §6.9 Reviews, FAQ and quiz                                                  */
/* -------------------------------------------------------------------------- */

export interface Review {
  id: string; firstName: string; text: string; rating: 1 | 2 | 3 | 4 | 5;
  photo: { src: string; alt: string; consent: true } | null;
  productHandle: string | null; date: IsoDate; verifiedBuyer: boolean; source: "judge-me" | "handmatig";
}
export interface RatingSummary { average: number; count: number }

export type FaqCategory = "bestellen" | "verzenden" | "sieraden" | "retour" | "cadeaus";
export interface FaqItem {
  id: string; question: string; answer: string; category: FaqCategory;
  onHome: boolean; onProduct: boolean;
  claim?: ClaimId; link?: { label: string; href: string };
}

export type QuizQuestionId = "vibe" | "moment" | "type";
export type QuizTypeAnswer = JewelryType | "verras-me";
export interface QuizOption<V extends string = string> { value: V; label: string }
export interface QuizQuestion { id: QuizQuestionId; title: string; options: QuizOption[] }
export interface QuizAnswers { vibe: Vibe; moment: Moment; type: QuizTypeAnswer }
export interface QuizConfig {
  intro: { title: string; text: string };
  questions: [QuizQuestion, QuizQuestion, QuizQuestion];
  scoring: { vibe: number; moment: number; lindesFavoriet: number; minResults: number; maxResults: number };
  result: { title: string; restart: string; emailTitle: string; skip: string };
}

/* -------------------------------------------------------------------------- */
/* §6.10 Cart and checkout                                                     */
/* -------------------------------------------------------------------------- */

export type DiscountSource = "stack" | "code" | "cadeauverpakking" | "overig";
export interface DiscountApplication {
  source: DiscountSource;
  kind: "automatic" | "code";
  title: string;                // "Stack-korting 15%", "WELKOM10"
  code: string | null;
  amount: Money;                // total allocated in this cart
}
export interface DiscountCodeState { code: string; applicable: boolean; reason: "ok" | "unknown" | "not-combinable" | "not-eligible" | null }

export interface CartMerchandise {
  variantId: string; productId: string; productHandle: string; productTitle: string;
  variantTitle: string | null;   // null when the product has one default variant
  image: ProductImage | null;
  type: ProductType | null;
  isGiftCard: boolean; isGiftWrap: boolean;
  quantityAvailable: number | null;
}
export interface CartLine {
  id: string;                    // Shopify line GID, or "local:<variantId>"
  merchandise: CartMerchandise;
  quantity: number;              // 1..99
  unitPrice: Money;
  subtotal: Money;               // unitPrice × quantity
  discounts: Array<{ source: DiscountSource; amount: Money }>;
  total: Money;                  // subtotal − discounts
  attributes: Array<{ key: string; value: string }>;
}

export type ShippingQuote =
  | { kind: "free" }
  | { kind: "amount"; amount: Money }
  | { kind: "at-checkout" }      // shopify: the cart has no address yet
  | { kind: "none" };            // nothing to ship (gift cards only, or empty)

export interface CartTotals {
  merchandise: Money;            // sum of line subtotals (before discounts)
  discounts: Money;              // sum of all discounts
  freeShippingBasis: Money;      // after discounts, without gift cards (conservative: never above Shopify's basis, §8.2 rule 7)
  shipping: ShippingQuote;
  total: Money;                  // merchandise − discounts + shipping (amount or 0)
  savings: Money;                // = discounts (free shipping is not counted)
}
export interface CartProgress {
  freeShipping: { applies: boolean; threshold: Money; remaining: Money; reached: boolean; ratio: number };
  stack: { applies: boolean; units: number; needed: 0 | 1 | 2; reached: boolean };
}
export interface GiftWrapState { selected: boolean; free: boolean; price: Money; lineId: string | null; available: boolean }
export type CartNotice =
  | { kind: "code-not-combined"; code: string }   // stack discount was higher, code not used
  | { kind: "code-invalid"; code: string }
  | { kind: "line-removed"; title: string }        // product no longer available
  | { kind: "quantity-capped"; title: string; max: number }
  | { kind: "not-yet-available"; title: string };  // drop product before access

export interface Cart {
  id: string;
  provider: CommerceProviderName;
  lines: CartLine[];             // without the gift wrap line (shown via giftWrap)
  itemCount: number;             // units, gift wrap excluded
  discountCodes: DiscountCodeState[];
  discounts: DiscountApplication[];
  totals: CartTotals;
  progress: CartProgress;
  giftWrap: GiftWrapState;
  note: string;                  // gift message, max 200 characters
  checkoutUrl: string;           // shopify: cart.checkoutUrl; local: "/checkout"
  notices: CartNotice[];
}

export interface CartLineInput { variantId: string; quantity: number; attributes?: Array<{ key: string; value: string }> }

export interface CheckoutState {   // local demo checkout only
  status: "review" | "placing" | "placed";
  orderRef: string | null;          // "DEMO-<6 chars>" after placing
}

/* -------------------------------------------------------------------------- */
/* §6.11 Forms and analytics                                                   */
/* -------------------------------------------------------------------------- */

export type SubscribeSource = "popup" | "finder" | "club" | "footer" | "wachtlijst";
export interface SubscribeRequest {
  email: string;
  consent: true;                  // the unchecked-by-default checkbox, must be ticked
  source: SubscribeSource;
  quiz?: QuizAnswers;
  website: string;                // honeypot, must be empty
}
export interface WithdrawalRequest {
  name: string; orderNumber: string; email: string;
  products?: string;              // optional, free text
  website: string;
}
export interface ContactRequest {
  name: string; email: string; orderNumber?: string; message: string;
  website: string;
}
export type FormErrorCode = "invalid" | "rate-limited" | "not-configured" | "upstream";
export type FormResponse<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: FormErrorCode; fieldErrors?: Record<string, string>; fallbackEmail: string };
/** "pending": confirmation mail sent (double opt-in, §15.2). "already-subscribed": nothing sent. */
export interface SubscribeResult { status: "pending" | "already-subscribed"; code: "WELKOM10" }
export interface SubscribeConfirmRequest { token: string }
export interface SubscribeConfirmResult { status: "confirmed" | "already-confirmed" }
export type SubscribeConfirmErrorCode = "expired" | "invalid";   // sent as FormErrorCode "invalid" + fieldErrors.token
export interface WithdrawalReceipt { reference: string; receivedAt: IsoDateTime; receivedAtLabel: string; summary: Array<{ label: string; value: string }> }

export interface AnalyticsItem {
  item_id: string; item_name: string; item_brand: "Sparkela";
  item_category: string | null; item_variant: string | null;
  price: number;                  // euros (GA4), converted from cents only in lib/analytics.ts
  quantity: number;
}
export type AnalyticsEvent =
  | { event: "view_item"; ecommerce: { currency: "EUR"; value: number; items: AnalyticsItem[] } }
  | { event: "add_to_cart"; ecommerce: { currency: "EUR"; value: number; items: AnalyticsItem[] } }
  | { event: "begin_checkout"; ecommerce: { currency: "EUR"; value: number; items: AnalyticsItem[]; coupon?: string } }
  | { event: "sign_up"; method: SubscribeSource };
export type ConsentValue = "granted" | "denied";

/* -------------------------------------------------------------------------- */
/* §6.12 Other shared types                                                    */
/* -------------------------------------------------------------------------- */

export interface NavLink { label: string; href: string; description?: string }
export interface NavGroup { label: string; id: "momenten" | "cadeaus"; links: NavLink[]; extra?: NavLink & { heading: string } }
export type NavItem = ({ kind: "link" } & NavLink) | ({ kind: "group" } & NavGroup);
export interface MobileNavConfig { primary: NavLink[]; groups: NavGroup[]; service: NavLink[] }
export interface FooterColumn { title: string; links: NavLink[] }
export type MobileNavFeature = { kind: "drop"; drop: Drop } | { kind: "stack"; stack: Stack; products: CatalogProduct[] };
export interface Crumb { label: string; href?: string }   // last crumb without href = current page
/** Result of priceDisplay() in lib/pricing.ts; prop of Price (components/ui). Here so B2 and B3 can build in parallel (decision 137). */
export interface PriceDisplay { price: Money; compareAt: Money | null; lowest30d: Money | null; showCompareAt: boolean }

export type AssetKey = string;   // "hero.desktop", "momenten.festival", "fotostrook.01", "video.01", "stacks.<slug>", "drops.<slug>"
export interface ImageAsset { key: AssetKey; src: string; aspect: "4:5" | "3:4" | "16:9" | "1:1" | "9:16"; width: number; height: number; alt: string; label: string; brief: string }
export interface VideoAsset { key: AssetKey; src: string; poster: string; width: 1080; height: 1920; label: string; brief: string }
export interface AssetManifest { images: Record<AssetKey, ImageAsset>; videos: Record<AssetKey, VideoAsset> }
