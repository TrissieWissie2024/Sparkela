/**
 * Storefront API catalog queries (docs/PLAN.md §16.3, API version 2026-10) and the shapes of their answers.
 *
 * Pure: constants and types only, no server-only and no next/* imports, so Vitest, the mappers and the live test
 * share them. Every query runs in `@inContext(country: NL, language: NL)`, so prices are the Dutch prices in EUR.
 * Values never go into the query text: handles, cursors and search terms are GraphQL variables.
 *
 * Query cost (decision 98): nested `first:` values multiply the cost, so 50 products per page, 10 variants (the
 * products have at most 4) and 6 images. `npm run test:shopify` runs CatalogProducts against the real store.
 */

/** The manual collection that holds every piece in the "uitgelicht" order (plan §16.6). */
export const ALL_COLLECTION_HANDLE = "alle";

/** Products per CatalogProducts page. */
export const CATALOG_PAGE_SIZE = 50;

/** Variants and images per product (decision 98). */
export const VARIANTS_PER_PRODUCT = 10;
export const IMAGES_PER_PRODUCT = 6;

/** Results of PredictiveSearch. */
export const SEARCH_LIMIT = 10;

/** The metafields of plan §6.4, in the order of the `identifiers` argument (Shopify answers in the same order). */
export const METAFIELD_KEYS = [
  "spec_regel",
  "materiaal",
  "afmetingen",
  "gewicht",
  "sluiting",
  "verzorging",
  "statement_meter",
  "nikkelvrij",
  "gpsr_fabrikant",
  "gpsr_verantwoordelijke_eu",
  "gpsr_waarschuwingen",
  "laagste_prijs_30d",
  "bestseller",
  "lindes_favoriet",
] as const;

export type MetafieldKey = (typeof METAFIELD_KEYS)[number];

/** Namespace of every Sparkela metafield definition. */
export const METAFIELD_NAMESPACE = "custom";

const metafieldIdentifiers = METAFIELD_KEYS.map((key) => `{ namespace: "${METAFIELD_NAMESPACE}", key: "${key}" }`).join(", ");

export const IMAGE_FRAGMENT = /* GraphQL */ `
  fragment Img on Image { url altText width height }
`;

export const MONEY_FRAGMENT = /* GraphQL */ `
  fragment MoneyFields on MoneyV2 { amount currencyCode }
`;

export const PRODUCT_FRAGMENT = /* GraphQL */ `
  fragment ProductFields on Product {
    id handle title description tags isGiftCard availableForSale publishedAt
    seo { title description }
    options { name optionValues { name } }
    priceRange { minVariantPrice { ...MoneyFields } maxVariantPrice { ...MoneyFields } }
    images(first: ${IMAGES_PER_PRODUCT}) { nodes { ...Img } }
    variants(first: ${VARIANTS_PER_PRODUCT}) {
      nodes {
        id title sku availableForSale quantityAvailable
        price { ...MoneyFields } compareAtPrice { ...MoneyFields }
        selectedOptions { name value }
        image { ...Img }
      }
    }
    metafields(identifiers: [${metafieldIdentifiers}]) { namespace key type value }
  }
`;

const PRODUCT_FRAGMENTS = `${PRODUCT_FRAGMENT}${IMAGE_FRAGMENT}${MONEY_FRAGMENT}`;

/** One page of the collection "alle" in its manual order (the index is featuredRank). `collection: null` before the import. */
export const CATALOG_PRODUCTS_QUERY = /* GraphQL */ `
  query CatalogProducts($cursor: String) @inContext(country: NL, language: NL) {
    collection(handle: "${ALL_COLLECTION_HANDLE}") {
      products(first: ${CATALOG_PAGE_SIZE}, after: $cursor, sortKey: MANUAL) {
        pageInfo { hasNextPage endCursor }
        nodes { ...ProductFields }
      }
    }
  }
  ${PRODUCT_FRAGMENTS}
`;

/** One product by handle; also products outside "alle" (gift wrap, gift card, drop products not in "alle"). */
export const PRODUCT_BY_HANDLE_QUERY = /* GraphQL */ `
  query ProductByHandle($handle: String!) @inContext(country: NL, language: NL) {
    product(handle: $handle) { ...ProductFields }
  }
  ${PRODUCT_FRAGMENTS}
`;

/** Product handles for a search term, best match first (decision 35: the site itself searches in the browser). */
export const PREDICTIVE_SEARCH_QUERY = /* GraphQL */ `
  query PredictiveSearch($q: String!) @inContext(country: NL, language: NL) {
    predictiveSearch(query: $q, limit: ${SEARCH_LIMIT}, types: [PRODUCT], unavailableProducts: LAST) {
      products { handle }
    }
  }
`;

/**
 * The gift wrap variant for /api/cart (op "giftWrap", plan §7.4): fresh and uncached, like VariantGate, so a
 * republished gift wrap product is picked up without a deploy.
 */
export const GIFT_WRAP_VARIANT_QUERY = /* GraphQL */ `
  query GiftWrapVariant($handle: String!) @inContext(country: NL, language: NL) {
    product(handle: $handle) {
      variants(first: 1) { nodes { id availableForSale } }
    }
  }
`;

/* -------------------------------------------------------------------------- */
/* Answer shapes (the `data` object of each query)                            */
/* -------------------------------------------------------------------------- */

/** MoneyV2: a decimal string such as "14.95" and the ISO currency code. */
export interface ShopifyMoney {
  amount: string;
  currencyCode: string;
}

/** Image: width and height are null for some legacy uploads. */
export interface ShopifyImage {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

/** Metafield as selected by ProductFields; `value` is always a string (JSON for money). */
export interface ShopifyMetafield {
  namespace: string;
  key: string;
  type: string;
  value: string;
}

export interface ShopifySelectedOption {
  name: string;
  value: string;
}

export interface ShopifyVariant {
  id: string;
  title: string;
  sku: string | null;
  availableForSale: boolean;
  /** Null without the unauthenticated_read_product_inventory scope or when stock is not tracked. */
  quantityAvailable: number | null;
  price: ShopifyMoney;
  compareAtPrice: ShopifyMoney | null;
  selectedOptions: ShopifySelectedOption[];
  image: ShopifyImage | null;
}

export interface ShopifyProduct {
  id: string;
  handle: string;
  title: string;
  /** Plain text (Shopify strips the HTML of descriptionHtml). */
  description: string;
  tags: string[];
  isGiftCard: boolean;
  availableForSale: boolean;
  publishedAt: string;
  seo: { title: string | null; description: string | null };
  options: Array<{ name: string; optionValues: Array<{ name: string }> }>;
  priceRange: { minVariantPrice: ShopifyMoney; maxVariantPrice: ShopifyMoney };
  images: { nodes: ShopifyImage[] };
  variants: { nodes: ShopifyVariant[] };
  /** One entry per identifier, in the same order; null where the product has no value. */
  metafields: Array<ShopifyMetafield | null>;
}

export interface CatalogProductsData {
  collection: {
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: ShopifyProduct[];
    };
  } | null;
}

export interface ProductByHandleData {
  product: ShopifyProduct | null;
}

export interface PredictiveSearchData {
  predictiveSearch: { products: Array<{ handle: string }> } | null;
}

export interface GiftWrapVariantData {
  product: { variants: { nodes: Array<{ id: string; availableForSale: boolean }> } } | null;
}
