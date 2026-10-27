/**
 * Server environment, read and validated in one place (docs/PLAN.md §3.5 and §3.9).
 *
 * Server-side only: proxy.ts, route handlers, 'use cache' scopes and build-time code. Nothing here reaches the
 * browser: getEnv() and readSecret() throw when called in a browser, and Next only inlines NEXT_PUBLIC_*
 * variables into client bundles anyway. No `import "server-only"` and no next/* imports, so proxy.ts and Vitest
 * can use this module too.
 *
 * Every function takes the environment as an argument (default process.env), so tests never touch the real one.
 * Values are trimmed; an empty string counts as missing (null).
 */

/** An environment to read from: process.env, or a plain object in tests. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/** Our own secrets: at least MIN_SECRET_LENGTH characters, made with `openssl rand -base64 32` (decision 91). */
export type SecretName = "PRELAUNCH_BYPASS_TOKEN" | "EARLY_ACCESS_SECRET" | "NEWSLETTER_CONFIRM_SECRET" | "REVALIDATE_SECRET";

export const MIN_SECRET_LENGTH = 32;

/** Default for NEXT_PUBLIC_SITE_URL (plan §3.9). */
export const DEFAULT_SITE_URL = "https://sparkela.nl";

function assertServer(fn: string): void {
  if (typeof window !== "undefined") {
    throw new Error(`lib/env.ts ${fn}() is server-only and must never run in the browser.`);
  }
}

/** Trimmed value of a variable, or null when it is unset or blank. */
export function readEnv(env: EnvSource, name: string): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

const warnedShortSecrets = new Set<string>();

/**
 * A secret from the environment, or null when it is missing or shorter than MIN_SECRET_LENGTH characters.
 * A short secret counts as absent, so the feature behind it stays closed (preview, early access, confirmation
 * link, manual revalidation; fail closed, decision 91). A short secret logs one warning per name and process,
 * with the name only, never the value or its length.
 */
export function readSecret(name: SecretName, env: EnvSource = process.env): string | null {
  assertServer("readSecret");
  const value = readEnv(env, name);
  if (value === null) return null;
  if (value.length < MIN_SECRET_LENGTH) {
    if (!warnedShortSecrets.has(name)) {
      warnedShortSecrets.add(name);
      console.warn(
        `[env] ${name} is shorter than ${MIN_SECRET_LENGTH} characters and is ignored. Create one with: openssl rand -base64 32`,
      );
    }
    return null;
  }
  return value;
}

/** Vercel's deployment kind (set by Vercel; absent locally). */
export type VercelEnv = "production" | "preview" | "development";

/** Every variable from plan §3.9, typed and validated. Missing optional values are null. */
export interface ServerEnv {
  /** Raw COMMERCE_PROVIDER; lib/commerce/index.ts resolves it (unknown → "local" with a warning). */
  commerceProvider: string | null;
  /** NEXT_PUBLIC_SITE_URL as an origin without a trailing slash; DEFAULT_SITE_URL when unset. */
  siteUrl: string;
  vercelEnv: VercelEnv | null;
  /** VERCEL_ENV === "production": the live site. */
  isProduction: boolean;
  shopify: {
    /** SHOPIFY_STORE_DOMAIN without protocol or trailing slash, lower case. */
    storeDomain: string | null;
    storefrontAccessToken: string | null;
    /** SHOPIFY_STOREFRONT_TOKEN_TYPE; null when unset (lib/commerce/shopify/config.ts defaults to "private"). */
    storefrontTokenType: string | null;
    adminClientId: string | null;
    adminClientSecret: string | null;
    adminAccessToken: string | null;
    /** Chosen by Shopify, so not held to MIN_SECRET_LENGTH. */
    webhookSecret: string | null;
    customerAccountUrl: string | null;
  };
  mail: { apiKey: string | null; from: string | null; to: string | null };
  /** Read with readSecret(): null when missing or too short. */
  secrets: {
    prelaunchBypassToken: string | null;
    earlyAccessSecret: string | null;
    newsletterConfirmSecret: string | null;
    revalidateSecret: string | null;
  };
  analytics: { enabled: boolean; gtmId: string | null };
  /** Raw test clock variables; lib/clock.ts decides whether the test clock is on (never in production). */
  testClock: { flag: string | null; now: string | null };
  /** SHOPIFY_LIVE_TEST=1 and SHOPIFY_LIVE_ADMIN=1 (npm run test:shopify). */
  liveTests: { shopify: boolean; admin: boolean };
}

function parseVercelEnv(value: string | null): VercelEnv | null {
  return value === "production" || value === "preview" || value === "development" ? value : null;
}

/** "https://sparkela.nl/" → "https://sparkela.nl". Throws on a value that is not an absolute http(s) URL. */
function parseSiteUrl(value: string | null): string {
  if (value === null) return DEFAULT_SITE_URL;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`NEXT_PUBLIC_SITE_URL must be an absolute URL such as ${DEFAULT_SITE_URL}.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`NEXT_PUBLIC_SITE_URL must use http or https.`);
  }
  return url.origin;
}

/** "https://Sparkela.myshopify.com/" → "sparkela.myshopify.com". */
export function normalizeShopDomain(value: string | null): string | null {
  if (value === null) return null;
  const domain = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  return domain ? domain : null;
}

/**
 * The whole server environment, validated. Throws only for values that would break the site silently
 * (a NEXT_PUBLIC_SITE_URL that is not a URL); everything optional is null when missing.
 */
export function getEnv(env: EnvSource = process.env): ServerEnv {
  assertServer("getEnv");
  const vercelEnv = parseVercelEnv(readEnv(env, "VERCEL_ENV"));
  return {
    commerceProvider: readEnv(env, "COMMERCE_PROVIDER"),
    siteUrl: parseSiteUrl(readEnv(env, "NEXT_PUBLIC_SITE_URL")),
    vercelEnv,
    isProduction: vercelEnv === "production",
    shopify: {
      storeDomain: normalizeShopDomain(readEnv(env, "SHOPIFY_STORE_DOMAIN")),
      storefrontAccessToken: readEnv(env, "SHOPIFY_STOREFRONT_ACCESS_TOKEN"),
      storefrontTokenType: readEnv(env, "SHOPIFY_STOREFRONT_TOKEN_TYPE"),
      adminClientId: readEnv(env, "SHOPIFY_ADMIN_CLIENT_ID"),
      adminClientSecret: readEnv(env, "SHOPIFY_ADMIN_CLIENT_SECRET"),
      adminAccessToken: readEnv(env, "SHOPIFY_ADMIN_ACCESS_TOKEN"),
      webhookSecret: readEnv(env, "SHOPIFY_WEBHOOK_SECRET"),
      customerAccountUrl: readEnv(env, "SHOPIFY_CUSTOMER_ACCOUNT_URL"),
    },
    mail: { apiKey: readEnv(env, "MAIL_API_KEY"), from: readEnv(env, "MAIL_FROM"), to: readEnv(env, "MAIL_TO") },
    secrets: {
      prelaunchBypassToken: readSecret("PRELAUNCH_BYPASS_TOKEN", env),
      earlyAccessSecret: readSecret("EARLY_ACCESS_SECRET", env),
      newsletterConfirmSecret: readSecret("NEWSLETTER_CONFIRM_SECRET", env),
      revalidateSecret: readSecret("REVALIDATE_SECRET", env),
    },
    analytics: {
      enabled: readEnv(env, "NEXT_PUBLIC_ANALYTICS_ENABLED") === "true",
      gtmId: readEnv(env, "NEXT_PUBLIC_GTM_ID"),
    },
    testClock: { flag: readEnv(env, "SPARKELA_TEST_CLOCK"), now: readEnv(env, "SPARKELA_TEST_NOW") },
    liveTests: { shopify: readEnv(env, "SHOPIFY_LIVE_TEST") === "1", admin: readEnv(env, "SHOPIFY_LIVE_ADMIN") === "1" },
  };
}
