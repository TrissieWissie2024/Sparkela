import { IMAGE_FRAGMENT, MONEY_FRAGMENT, type ShopifyImage, type ShopifyMoney } from "@/lib/commerce/shopify/queries";

/**
 * Storefront Cart API (docs/PLAN.md §16.4, API version 2026-10): the CartFields fragment, the cart mutations, the
 * cart query and the uncached VariantGate query that /api/cart runs before every add (§7.4, decision 87).
 *
 * Pure: constants and types only, so Vitest and the route share them. Values are always GraphQL variables.
 *
 * Discount fields (decision 51, plan §22 point 6). From 2026-07 `Cart.discountAllocations` and
 * `CartDiscountAllocation.discountApplication` are deprecated. CartFields therefore reads the allocations per line
 * with `discountAllocations(lineLevelOnly: false)`, which also returns order discounts (WELKOM10) spread over the
 * lines; the default `true` would leave them out. Each allocation says where it comes from through its concrete type:
 * CartAutomaticDiscountAllocation (title: "Stack-korting", "Cadeauverpakking december"), CartCodeDiscountAllocation
 * (code) or CartCustomDiscountAllocation (title). `targetType` tells line discounts from shipping discounts. Neither
 * deprecated field is selected, and `Cart.discountApplications` is not needed: the line allocations carry the
 * amounts and the source. The mapper (mappers.ts mapCart) is the only reader of these fields.
 *
 * Stock problems come back as `warnings` (MERCHANDISE_NOT_ENOUGH_STOCK, MERCHANDISE_OUT_OF_STOCK, since 2024-10),
 * hard refusals as `userErrors` with a CartErrorCode; lib/commerce/shopify/cart.ts maps both to CartErrorCodes.
 */

export const CART_FRAGMENT = /* GraphQL */ `
  fragment CartFields on Cart {
    id checkoutUrl totalQuantity note
    buyerIdentity { countryCode }
    cost { subtotalAmount { ...MoneyFields } totalAmount { ...MoneyFields } }
    discountCodes { code applicable }
    lines(first: 100) {
      nodes {
        id quantity attributes { key value }
        cost { amountPerQuantity { ...MoneyFields } subtotalAmount { ...MoneyFields } totalAmount { ...MoneyFields } }
        discountAllocations(lineLevelOnly: false) {
          discountedAmount { ...MoneyFields }
          targetType
          ... on CartAutomaticDiscountAllocation { title }
          ... on CartCodeDiscountAllocation { code }
          ... on CartCustomDiscountAllocation { title }
        }
        merchandise {
          ... on ProductVariant {
            id title quantityAvailable image { ...Img }
            product { id handle title tags isGiftCard }
          }
        }
      }
    }
  }
`;

const CART_FRAGMENTS = `${CART_FRAGMENT}${IMAGE_FRAGMENT}${MONEY_FRAGMENT}`;
const PAYLOAD = "cart { ...CartFields } userErrors { field message code } warnings { code message target }";

export const CART_CREATE_MUTATION = /* GraphQL */ `
  mutation CartCreate($input: CartInput!) @inContext(country: NL, language: NL) {
    cartCreate(input: $input) { ${PAYLOAD} }
  }
  ${CART_FRAGMENTS}
`;

export const CART_LINES_ADD_MUTATION = /* GraphQL */ `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) @inContext(country: NL, language: NL) {
    cartLinesAdd(cartId: $cartId, lines: $lines) { ${PAYLOAD} }
  }
  ${CART_FRAGMENTS}
`;

export const CART_LINES_UPDATE_MUTATION = /* GraphQL */ `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) @inContext(country: NL, language: NL) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) { ${PAYLOAD} }
  }
  ${CART_FRAGMENTS}
`;

export const CART_LINES_REMOVE_MUTATION = /* GraphQL */ `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) @inContext(country: NL, language: NL) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { ${PAYLOAD} }
  }
  ${CART_FRAGMENTS}
`;

export const CART_DISCOUNT_CODES_UPDATE_MUTATION = /* GraphQL */ `
  mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]!) @inContext(country: NL, language: NL) {
    cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) { ${PAYLOAD} }
  }
  ${CART_FRAGMENTS}
`;

export const CART_NOTE_UPDATE_MUTATION = /* GraphQL */ `
  mutation CartNoteUpdate($cartId: ID!, $note: String!) @inContext(country: NL, language: NL) {
    cartNoteUpdate(cartId: $cartId, note: $note) { ${PAYLOAD} }
  }
  ${CART_FRAGMENTS}
`;

export const CART_BY_ID_QUERY = /* GraphQL */ `
  query CartById($id: ID!) @inContext(country: NL, language: NL) {
    cart(id: $id) { ...CartFields }
  }
  ${CART_FRAGMENTS}
`;

/** Uncached, before every add (§7.4): fresh handle, tags and gift card flag per variant for the cart gate. */
export const VARIANT_GATE_QUERY = /* GraphQL */ `
  query VariantGate($ids: [ID!]!) @inContext(country: NL, language: NL) {
    nodes(ids: $ids) {
      ... on ProductVariant { id product { handle tags isGiftCard } }
    }
  }
`;

/* -------------------------------------------------------------------------- */
/* Answer shapes                                                               */
/* -------------------------------------------------------------------------- */

/**
 * One discount allocation on a cart line. `title` comes from CartAutomaticDiscountAllocation and
 * CartCustomDiscountAllocation, `code` from CartCodeDiscountAllocation.
 */
export interface ShopifyDiscountAllocation {
  discountedAmount: ShopifyMoney;
  /** DiscountApplicationTargetType: LINE_ITEM or SHIPPING_LINE. */
  targetType?: string | null;
  title?: string | null;
  code?: string | null;
}

export interface ShopifyCartMerchandise {
  id: string;
  title: string;
  quantityAvailable: number | null;
  image: ShopifyImage | null;
  product: { id: string; handle: string; title: string; tags: string[]; isGiftCard: boolean };
}

export interface ShopifyCartLine {
  id: string;
  quantity: number;
  attributes: Array<{ key: string; value: string | null }>;
  cost: { amountPerQuantity: ShopifyMoney; subtotalAmount: ShopifyMoney; totalAmount: ShopifyMoney };
  discountAllocations: ShopifyDiscountAllocation[];
  merchandise: ShopifyCartMerchandise;
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  note: string | null;
  buyerIdentity: { countryCode: string | null } | null;
  cost: { subtotalAmount: ShopifyMoney; totalAmount: ShopifyMoney };
  discountCodes: Array<{ code: string; applicable: boolean }>;
  lines: { nodes: ShopifyCartLine[] };
}

/** CartUserError: the mutation was refused; the cart is unchanged. */
export interface ShopifyCartUserError {
  field: string[] | null;
  message: string;
  code: string | null;
}

/** CartWarning: the mutation ran, but Shopify changed something (stock). `target` is the id of the line. */
export interface ShopifyCartWarning {
  code: string;
  message: string;
  target: string | null;
}

export interface ShopifyCartPayload {
  cart: ShopifyCart | null;
  userErrors: ShopifyCartUserError[];
  warnings?: ShopifyCartWarning[] | null;
}

export interface CartCreateData { cartCreate: ShopifyCartPayload | null }
export interface CartLinesAddData { cartLinesAdd: ShopifyCartPayload | null }
export interface CartLinesUpdateData { cartLinesUpdate: ShopifyCartPayload | null }
export interface CartLinesRemoveData { cartLinesRemove: ShopifyCartPayload | null }
export interface CartDiscountCodesUpdateData { cartDiscountCodesUpdate: ShopifyCartPayload | null }
export interface CartNoteUpdateData { cartNoteUpdate: ShopifyCartPayload | null }
export interface CartByIdData { cart: ShopifyCart | null }

/** A VariantGate node: the variant, `{}` for another node type, or null for an unknown id. */
export interface ShopifyGateVariant {
  id: string;
  product: { handle: string; tags: string[]; isGiftCard: boolean };
}
export interface VariantGateData {
  nodes: Array<ShopifyGateVariant | Record<string, never> | null>;
}
