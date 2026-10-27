import { describe, expect, it } from "vitest";

import { canAddToCart, gateItemFor, type GateContext, type GateItem } from "@/lib/commerce/cart-gate";
import type { Drop } from "@/lib/types";
import { drops } from "@/content/drops";
import { site } from "@/content/site";

/**
 * lib/commerce/cart-gate.ts (docs/PLAN.md §7.4, §19.1): preview always ok; drop "verborgen" refused; "early-access"
 * only with that drop's cookie; prelaunch: a regular piece refused, a drop piece with the cookie ok, a mix refused;
 * after the launch a regular piece ok.
 */

const PRELAUNCH = Date.parse("2026-11-20T12:00:00+01:00");
const EARLY_ACCESS = Date.parse("2026-11-26T12:00:00+01:00");
const LAUNCHED = Date.parse("2026-11-27T12:00:00+01:00");
const LOVE_CLUB_EARLY = Date.parse("2027-02-05T12:00:00+01:00");

const regular: GateItem = { variantId: "gid://shopify/ProductVariant/49012345600031", productHandle: "noor-dikke-ringetjes", dropSlugs: [] };
const holiday: GateItem = {
  variantId: "gid://shopify/ProductVariant/49012345600211",
  productHandle: "holiday-ster-oorbellen",
  dropSlugs: ["holiday-sparkle"],
};
const loveClubDrop = drops.find((drop) => drop.slug === "love-club") as Drop;
const loveClub: GateItem = { variantId: "gid://shopify/ProductVariant/49012345600901", productHandle: loveClubDrop.productHandles[0] ?? "love", dropSlugs: ["love-club"] };

function ctx(now: number, overrides: Partial<GateContext> = {}): GateContext {
  return { now, hasPreview: false, earlyAccessSlugs: [], drops, launchAt: site.launchAt, ...overrides };
}

describe("canAddToCart", () => {
  it("lets everything through with a valid preview cookie", () => {
    expect(canAddToCart([regular, holiday, loveClub], ctx(PRELAUNCH, { hasPreview: true }))).toEqual({ ok: true });
  });

  it("refuses a drop piece in the hidden phase, also with a cookie for another drop", () => {
    expect(canAddToCart([holiday], ctx(PRELAUNCH, { earlyAccessSlugs: ["holiday-sparkle"] }))).toEqual({
      ok: false,
      error: "not-yet-available",
      variantIds: [holiday.variantId],
    });
    expect(canAddToCart([loveClub], ctx(LAUNCHED))).toMatchObject({ ok: false, variantIds: [loveClub.variantId] });
  });

  it("allows an early-access drop piece only with the cookie of that drop", () => {
    expect(canAddToCart([holiday], ctx(EARLY_ACCESS))).toMatchObject({ ok: false, error: "not-yet-available" });
    expect(canAddToCart([holiday], ctx(EARLY_ACCESS, { earlyAccessSlugs: ["love-club"] }))).toMatchObject({ ok: false });
    expect(canAddToCart([holiday], ctx(EARLY_ACCESS, { earlyAccessSlugs: ["holiday-sparkle"] }))).toEqual({ ok: true });
  });

  it("refuses a regular piece during the prelaunch, alone or next to an early-access drop piece", () => {
    expect(canAddToCart([regular], ctx(PRELAUNCH))).toEqual({ ok: false, error: "not-yet-available", variantIds: [regular.variantId] });
    expect(canAddToCart([regular], ctx(EARLY_ACCESS, { earlyAccessSlugs: ["holiday-sparkle"] }))).toMatchObject({ ok: false });
    expect(canAddToCart([holiday, regular], ctx(EARLY_ACCESS, { earlyAccessSlugs: ["holiday-sparkle"] }))).toEqual({
      ok: false,
      error: "not-yet-available",
      variantIds: [regular.variantId],
    });
  });

  it("allows a regular piece and a live drop piece after the launch", () => {
    expect(canAddToCart([regular, holiday], ctx(LAUNCHED))).toEqual({ ok: true });
  });

  it("follows the phases of a later drop after the launch", () => {
    expect(canAddToCart([loveClub], ctx(LOVE_CLUB_EARLY))).toMatchObject({ ok: false });
    expect(canAddToCart([loveClub, regular], ctx(LOVE_CLUB_EARLY, { earlyAccessSlugs: ["love-club"] }))).toEqual({ ok: true });
  });

  it("allows an ended drop piece (the page stays reachable while Shopify sells it)", () => {
    expect(canAddToCart([holiday], ctx(Date.parse("2027-01-02T12:00:00+01:00")))).toEqual({ ok: true });
  });

  it("allows an empty list", () => {
    expect(canAddToCart([], ctx(PRELAUNCH))).toEqual({ ok: true });
  });
});

describe("gateItemFor", () => {
  it("adds every drop whose productHandles list the product, even without its tag (fail closed)", () => {
    expect(gateItemFor("v1", { handle: "holiday-ster-oorbellen", dropSlugs: [] }, drops).dropSlugs).toEqual(["holiday-sparkle"]);
    expect(gateItemFor("v2", { handle: "noor-dikke-ringetjes", dropSlugs: [] }, drops).dropSlugs).toEqual([]);
    expect(gateItemFor("v3", { handle: "iets-anders", dropSlugs: ["holiday-sparkle"] }, drops)).toEqual({
      variantId: "v3",
      productHandle: "iets-anders",
      dropSlugs: ["holiday-sparkle"],
    });
  });

  it("refuses a product that only the content lists during the hidden phase", () => {
    const item = gateItemFor("v1", { handle: "holiday-ster-oorbellen", dropSlugs: [] }, drops);
    expect(canAddToCart([item], ctx(PRELAUNCH, { earlyAccessSlugs: ["holiday-sparkle"] }))).toMatchObject({ ok: false });
  });
});
