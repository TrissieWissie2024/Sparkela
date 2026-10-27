import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Revalidation by Shopify webhooks and by hand (docs/PLAN.md §7.5, §7.6; decisions 85 and 130). Pure: node:crypto
 * only, no next/* imports, so Vitest tests it with tests/fixtures/shopify/webhook-*.json. The route
 * (app/api/revalidate/route.ts) calls revalidateTag with what this module returns.
 *
 * Topic → tags and profile:
 * | topic                                          | tags                                                     |
 * | products/create                                | products, collections ({ expire: 0 })                    |
 * | products/update                                | product:<handle> ({ expire: 0 }); products, collections ("max") |
 * | products/delete                                | products, collections ({ expire: 0 }); the payload has only an id |
 * | inventory_levels/update                        | products ("max")                                         |
 * | collections/create, collections/update, /delete | collections, products ({ expire: 0 })                    |
 * products/update also fires on every stock change, often twice, so only that product's page blocks for fresh data;
 * lists follow one request later (stale-while-revalidate). Unknown topics give no tags.
 */

export type RevalidateProfile = "max" | { expire: 0 };

export interface TagRevalidation {
  tag: string;
  profile: RevalidateProfile;
}

const NOW: RevalidateProfile = { expire: 0 };
const SOFT: RevalidateProfile = "max";

/** A Shopify product handle: lower-case letters, digits and hyphens. */
const HANDLE = /^[a-z0-9][a-z0-9-]{0,254}$/;

/** Tags a manual revalidation may name (plan §7.5); `product:<handle>` too. */
export const MANUAL_TAGS = ["catalog", "products", "collections", "klok"] as const;

/**
 * True when `header` (X-Shopify-Hmac-Sha256) is the base64 HMAC-SHA256 of the raw body with `secret`. Compares in
 * constant time. A missing, truncated or nonsense header gives false, never an exception; so does an empty secret.
 */
export function verifyShopifyHmac(raw: string, header: string | null, secret: string): boolean {
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest();
  const text = header.trim();
  const given = Buffer.from(text, "base64");
  // Node's base64 decoder is lenient (it skips junk and stops at "="), so only the canonical form counts.
  if (given.toString("base64") !== text) return false;
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Constant-time bearer check for manual revalidation: "Bearer <token>" against `secret`. Both sides are hashed with
 * SHA-256 first, so the comparison always runs over 32 bytes whatever the length of the token. Empty secret → false.
 */
export function verifyBearer(header: string | null, secret: string): boolean {
  if (!secret || !header) return false;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header.trim());
  if (!match) return false;
  return timingSafeEqual(sha256(match[1]), sha256(secret));
}

function handleOf(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const handle = (payload as Record<string, unknown>).handle;
  return typeof handle === "string" && HANDLE.test(handle) ? handle : null;
}

/** The tags and profiles for one webhook (see the table in the module comment). */
export function tagsForWebhook(topic: string, payload: unknown): TagRevalidation[] {
  switch (topic.trim().toLowerCase()) {
    case "products/create":
    case "products/delete":
      return [
        { tag: "products", profile: NOW },
        { tag: "collections", profile: NOW },
      ];
    case "products/update": {
      const handle = handleOf(payload);
      return [
        ...(handle ? [{ tag: `product:${handle}`, profile: NOW }] : []),
        { tag: "products", profile: SOFT },
        { tag: "collections", profile: SOFT },
      ];
    }
    case "inventory_levels/update":
      return [{ tag: "products", profile: SOFT }];
    case "collections/create":
    case "collections/update":
    case "collections/delete":
      return [
        { tag: "collections", profile: NOW },
        { tag: "products", profile: NOW },
      ];
    default:
      return [];
  }
}

/**
 * The tags of a manual revalidation body `{ "tags": ["klok"] }` (README curl), each with { expire: 0 }. Allowed:
 * catalog, products, collections, klok and product:<handle>. Null when the body is not that shape or names another
 * tag, so the route answers 400 instead of silently doing part of it.
 */
export function manualTags(body: unknown): TagRevalidation[] | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const tags = (body as Record<string, unknown>).tags;
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > 20) return null;
  const result: TagRevalidation[] = [];
  for (const tag of tags) {
    if (typeof tag !== "string") return null;
    const allowed =
      (MANUAL_TAGS as readonly string[]).includes(tag) || (tag.startsWith("product:") && HANDLE.test(tag.slice("product:".length)));
    if (!allowed) return null;
    if (!result.some((entry) => entry.tag === tag)) result.push({ tag, profile: NOW });
  }
  return result;
}
