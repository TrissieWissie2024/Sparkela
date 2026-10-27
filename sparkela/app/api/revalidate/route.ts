import { revalidateTag } from "next/cache";

import { manualTags, tagsForWebhook, verifyBearer, verifyShopifyHmac, type TagRevalidation } from "@/lib/commerce/shopify/webhooks";
import { readEnv, readSecret } from "@/lib/env";

/**
 * POST /api/revalidate (docs/PLAN.md §7.6; decisions 52, 85, 130).
 *
 * 1. By hand (README curl): `Authorization: Bearer <REVALIDATE_SECRET>` and `{"tags":["products"]}` → every tag with
 *    { expire: 0 }. Allowed tags: catalog, products, collections, klok, product:<handle>. Without a secret (missing or
 *    shorter than 32 characters) 503; a wrong token 401; another body 400.
 * 2. Shopify webhook: X-Shopify-Hmac-Sha256 must be the base64 HMAC-SHA256 of the raw body with
 *    SHOPIFY_WEBHOOK_SECRET, checked in constant time BEFORE the body is parsed. Missing secret → 503; a bad or
 *    missing HMAC → 401 (never 500). X-Shopify-Topic → tagsForWebhook (webhooks.ts); an unknown topic → no tags.
 * Answer: 200 { ok: true, tags } with Cache-Control: no-store. updateTag does not work in route handlers, so this is
 * revalidateTag with an explicit profile, always.
 */

function json(body: { ok: boolean; tags?: string[] }, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function revalidate(entries: readonly TagRevalidation[]): Response {
  for (const entry of entries) revalidateTag(entry.tag, entry.profile);
  return json({ ok: true, tags: entries.map((entry) => entry.tag) }, 200);
}

export async function POST(request: Request): Promise<Response> {
  // Never JSON.parse before the signature is verified.
  const raw = await request.text();

  const authorization = request.headers.get("authorization");
  if (authorization !== null) {
    const secret = readSecret("REVALIDATE_SECRET");
    if (secret === null) return json({ ok: false }, 503);
    if (!verifyBearer(authorization, secret)) return json({ ok: false }, 401);
    const entries = manualTags(parseJson(raw));
    return entries ? revalidate(entries) : json({ ok: false }, 400);
  }

  const secret = readEnv(process.env, "SHOPIFY_WEBHOOK_SECRET");
  if (secret === null) return json({ ok: false }, 503);
  if (!verifyShopifyHmac(raw, request.headers.get("x-shopify-hmac-sha256"), secret)) return json({ ok: false }, 401);
  return revalidate(tagsForWebhook(request.headers.get("x-shopify-topic") ?? "", parseJson(raw)));
}
