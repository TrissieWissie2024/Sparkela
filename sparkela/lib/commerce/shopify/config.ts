/**
 * Shopify configuration (docs/PLAN.md §16.1) and the error type shared by the Storefront client (client.ts) and
 * the Admin client (admin.ts, §16.2, decision 132).
 *
 * Pure: no `server-only`, no next/* imports, the environment comes in as an argument, so proxy.ts, route handlers
 * and Vitest can all use it. Tokens never leave the server: only server-only modules (client.ts, admin.ts,
 * catalog.ts, cart.ts) call these functions.
 */

import { type EnvSource, normalizeShopDomain, readEnv } from "@/lib/env";

/** Storefront and Admin; latest stable in October 2026, supported until about October 2027 (review before then). */
export const SHOPIFY_API_VERSION = "2026-10";

export type StorefrontTokenType = "private" | "public";

export interface ShopifyConfig {
  /** SHOPIFY_STORE_DOMAIN without protocol, e.g. "sparkela.myshopify.com". */
  domain: string;
  /** https://{domain}/api/2026-10/graphql.json */
  storefrontUrl: string;
  /** https://{domain}/admin/api/2026-10/graphql.json */
  adminUrl: string;
  storefrontToken: string;
  /**
   * "private" (default): header `Shopify-Storefront-Private-Token`, plus `Shopify-Storefront-Buyer-IP` on cart
   * requests from /api/cart. "public": header `X-Shopify-Storefront-Access-Token`.
   */
  tokenType: StorefrontTokenType;
}

export interface ShopifyAdminConfig {
  domain: string;
  /** https://{domain}/admin/api/2026-10/graphql.json */
  adminUrl: string;
  /** https://{domain}/admin/oauth/access_token (client credentials grant, §15.2) */
  tokenUrl: string;
  clientId: string | null;
  clientSecret: string | null;
  /** SHOPIFY_ADMIN_ACCESS_TOKEN: optional fixed token of an older custom app; wins over client credentials. */
  accessTokenOverride: string | null;
}

/** Thrown when the Shopify provider runs without the variables it needs; fails the build instead of a broken site. */
export class ShopifyNotConfiguredError extends Error {
  constructor(detail?: string) {
    super(
      "The Shopify commerce provider is not configured. Set SHOPIFY_STORE_DOMAIN and " +
        "SHOPIFY_STOREFRONT_ACCESS_TOKEN (see .env.example), or unset COMMERCE_PROVIDER to use the local provider." +
        (detail ? ` ${detail}` : ""),
    );
    this.name = "ShopifyNotConfiguredError";
  }
}

export type ShopifyErrorCode = "network" | "http" | "graphql" | "throttled" | "timeout" | "unauthorized" | "access-denied";

/** Every failure of a Storefront or Admin request (§16.2). Messages carry no tokens and no personal data. */
export class ShopifyError extends Error {
  code: ShopifyErrorCode;

  constructor(code: ShopifyErrorCode, message: string) {
    super(message);
    this.name = "ShopifyError";
    this.code = code;
  }
}

/** A hostname such as "sparkela.myshopify.com" or "shop.sparkela.nl": labels of letters, digits and hyphens. */
const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** "https://Sparkela.myshopify.com/" → "sparkela.myshopify.com"; null when unset or not a hostname. */
function readDomain(env: EnvSource): string | null {
  const domain = normalizeShopDomain(readEnv(env, "SHOPIFY_STORE_DOMAIN"));
  return domain !== null && DOMAIN.test(domain) ? domain : null;
}

function adminUrlFor(domain: string): string {
  return `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

/**
 * Storefront configuration for the catalog and the cart. Throws ShopifyNotConfiguredError when the domain or the
 * Storefront token is missing, or when SHOPIFY_STOREFRONT_TOKEN_TYPE is not "private" or "public" (§7.7: the
 * build fails rather than going live without a catalog).
 */
export function getShopifyConfig(env: EnvSource = process.env): ShopifyConfig {
  const rawDomain = readEnv(env, "SHOPIFY_STORE_DOMAIN");
  const domain = readDomain(env);
  if (rawDomain === null) throw new ShopifyNotConfiguredError("SHOPIFY_STORE_DOMAIN is missing.");
  if (domain === null) {
    throw new ShopifyNotConfiguredError("SHOPIFY_STORE_DOMAIN is not a hostname such as sparkela.myshopify.com.");
  }
  const storefrontToken = readEnv(env, "SHOPIFY_STOREFRONT_ACCESS_TOKEN");
  if (storefrontToken === null) throw new ShopifyNotConfiguredError("SHOPIFY_STOREFRONT_ACCESS_TOKEN is missing.");

  const rawType = readEnv(env, "SHOPIFY_STOREFRONT_TOKEN_TYPE")?.toLowerCase() ?? "private";
  if (rawType !== "private" && rawType !== "public") {
    throw new ShopifyNotConfiguredError('SHOPIFY_STOREFRONT_TOKEN_TYPE must be "private" or "public".');
  }

  return {
    domain,
    storefrontUrl: `https://${domain}/api/${SHOPIFY_API_VERSION}/graphql.json`,
    adminUrl: adminUrlFor(domain),
    storefrontToken,
    tokenType: rawType,
  };
}

/**
 * Admin side only (/api/subscribe and /api/subscribe/confirm). Null when the domain is missing or invalid, or when
 * both credential forms are missing (client id plus secret, or SHOPIFY_ADMIN_ACCESS_TOKEN); the routes then answer
 * "not-configured". Does not need the Storefront token.
 */
export function getShopifyAdminConfig(env: EnvSource = process.env): ShopifyAdminConfig | null {
  const domain = readDomain(env);
  if (domain === null) return null;
  const clientId = readEnv(env, "SHOPIFY_ADMIN_CLIENT_ID");
  const clientSecret = readEnv(env, "SHOPIFY_ADMIN_CLIENT_SECRET");
  const accessTokenOverride = readEnv(env, "SHOPIFY_ADMIN_ACCESS_TOKEN");
  const hasClientCredentials = clientId !== null && clientSecret !== null;
  if (!hasClientCredentials && accessTokenOverride === null) return null;
  return {
    domain,
    adminUrl: adminUrlFor(domain),
    tokenUrl: `https://${domain}/admin/oauth/access_token`,
    clientId,
    clientSecret,
    accessTokenOverride,
  };
}
