import { getDropPhase, isPrelaunch } from "@/lib/dates";
import type { Drop, DropSlug, IsoDateTime } from "@/lib/types";

/**
 * May these variants go into the cart right now? (docs/PLAN.md §7.4, §9.5, §11.5; decisions 20, 87, 107.)
 * Pure, no next/* imports; /api/cart builds the context from the server clock and the cookies and calls this with
 * fresh product data (VariantGate), never with the cached catalog.
 *
 * 1. A valid preview cookie → always ok.
 * 2. Every item with a drop: phase "verborgen" → refused; "early-access" → only with that drop's early-access cookie;
 *    "live" and "afgelopen" → on to 3.
 * 3. Prelaunch (now < launchAt): ok only when EVERY item belongs to a drop the visitor has early access to. So nobody
 *    orders a regular piece before 27 November with a variant id from the RSC payload of an open legal page, and a
 *    regular piece next to a drop piece in early access is refused too.
 * 4. After the launch: everything that passed 2.
 */

export interface GateItem {
  variantId: string;
  productHandle: string;
  dropSlugs: DropSlug[];
}

export interface GateContext {
  now: number;
  hasPreview: boolean;
  /** Drops for which the visitor has a valid sparkela_ea_<slug> cookie. */
  earlyAccessSlugs: DropSlug[];
  drops: Drop[];
  launchAt: IsoDateTime;
}

export type GateResult = { ok: true } | { ok: false; error: "not-yet-available"; variantIds: string[] };

/**
 * The drops of a product for the gate: its drop:<slug> tags plus every drop whose productHandles list it. Both
 * count (fail closed): the proxy gates by productHandles, the tags come fresh from Shopify.
 */
export function gateItemFor(variantId: string, product: { handle: string; dropSlugs: readonly DropSlug[] }, drops: readonly Drop[]): GateItem {
  const slugs = new Set<DropSlug>(product.dropSlugs);
  for (const drop of drops) if (drop.productHandles.includes(product.handle)) slugs.add(drop.slug);
  return { variantId, productHandle: product.handle, dropSlugs: [...slugs] };
}

function itemAllowed(item: GateItem, ctx: GateContext, prelaunch: boolean): boolean {
  const itemDrops = item.dropSlugs
    .map((slug) => ctx.drops.find((drop) => drop.slug === slug))
    .filter((drop): drop is Drop => drop !== undefined);

  for (const drop of itemDrops) {
    const phase = getDropPhase(drop, ctx.now);
    if (phase === "verborgen") return false;
    if (phase === "early-access" && !ctx.earlyAccessSlugs.includes(drop.slug)) return false;
  }
  if (!prelaunch) return true;
  return itemDrops.some((drop) => ctx.earlyAccessSlugs.includes(drop.slug));
}

export function canAddToCart(items: readonly GateItem[], ctx: GateContext): GateResult {
  if (ctx.hasPreview) return { ok: true };
  const prelaunch = isPrelaunch(ctx.now, ctx.launchAt);
  const refused = items.filter((item) => !itemAllowed(item, ctx, prelaunch)).map((item) => item.variantId);
  return refused.length === 0 ? { ok: true } : { ok: false, error: "not-yet-available", variantIds: [...new Set(refused)] };
}
