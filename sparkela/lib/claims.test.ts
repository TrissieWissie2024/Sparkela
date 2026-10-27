import { describe, expect, it } from "vitest";

import { getVerifiedClaims, hasProof, hasVerifiedClaim } from "@/lib/claims";
import type { Claim } from "@/lib/types";
import { claims } from "@/content/claims";
import { pdpCopy } from "@/content/copy/pdp";
import { makeProduct } from "@/tests/fixtures/catalog";

const plain = makeProduct({ handle: "lola-chunky-hoops" });
const nickelFreeMetafield = makeProduct({ handle: "lola-chunky-hoops", metafields: { nikkelvrij: true } });

const verified: Claim[] = [
  { id: "nikkelvrij", label: "Nikkelvrij", verified: true, productHandles: ["lola-chunky-hoops"], source: "Leveranciersverklaring 2026-11-12" },
  { id: "waterproof", label: "Waterproof", verified: true, productHandles: "alle", source: "Testrapport 2026-11-10" },
  { id: "hypoallergeen", label: "Hypoallergeen", verified: false, productHandles: "alle", source: "Iets" },
];

describe("getVerifiedClaims", () => {
  it("returns nothing at launch: every claim in content is unverified", () => {
    expect(claims.every((claim) => claim.verified === false)).toBe(true);
    expect(getVerifiedClaims(plain)).toEqual([]);
  });

  it("gives nothing without verified, even with a source", () => {
    const unverified: Claim[] = [{ id: "waterproof", label: "Waterproof", verified: false, productHandles: "alle", source: "Rapport" }];
    expect(getVerifiedClaims(plain, unverified)).toEqual([]);
  });

  it("does not count verified without a source", () => {
    const noSource: Claim[] = [
      { id: "waterproof", label: "Waterproof", verified: true, productHandles: "alle", source: null },
      { id: "hypoallergeen", label: "Hypoallergeen", verified: true, productHandles: "alle", source: "   " },
    ];
    expect(getVerifiedClaims(plain, noSource)).toEqual([]);
    expect(hasProof(noSource[0])).toBe(false);
    expect(hasProof(noSource[1])).toBe(false);
  });

  it("gives nikkelvrij from the metafield (exactly true)", () => {
    expect(getVerifiedClaims(nickelFreeMetafield)).toEqual([{ id: "nikkelvrij", label: "Nikkelvrij", origin: "metafield" }]);
    expect(getVerifiedClaims(makeProduct({ metafields: { nikkelvrij: false } }))).toEqual([]);
    expect(getVerifiedClaims(makeProduct({ metafields: { nikkelvrij: null } }))).toEqual([]);
  });

  it("gives content claims with proof for the listed products or 'alle'", () => {
    expect(getVerifiedClaims(plain, verified)).toEqual([
      { id: "nikkelvrij", label: "Nikkelvrij", origin: "content" },
      { id: "waterproof", label: "Waterproof", origin: "content" },
    ]);
    expect(getVerifiedClaims(makeProduct({ handle: "mae-mini-hoops" }), verified)).toEqual([
      { id: "waterproof", label: "Waterproof", origin: "content" },
    ]);
  });

  it("lists each claim once; the metafield wins for nikkelvrij", () => {
    expect(getVerifiedClaims(nickelFreeMetafield, verified)).toEqual([
      { id: "nikkelvrij", label: "Nikkelvrij", origin: "metafield" },
      { id: "waterproof", label: "Waterproof", origin: "content" },
    ]);
  });

  it("lets an explicit nikkelvrij false in the product data block the content claim, also for 'alle'", () => {
    const everywhere: Claim[] = [
      { id: "nikkelvrij", label: "Nikkelvrij", verified: true, productHandles: "alle", source: "Leveranciersverklaring 2026-11-12" },
      { id: "waterproof", label: "Waterproof", verified: true, productHandles: "alle", source: "Testrapport 2026-11-10" },
    ];
    const saysNo = makeProduct({ handle: "lola-chunky-hoops", metafields: { nikkelvrij: false } });
    expect(getVerifiedClaims(saysNo, everywhere)).toEqual([{ id: "waterproof", label: "Waterproof", origin: "content" }]);
    expect(getVerifiedClaims(saysNo, verified)).toEqual([{ id: "waterproof", label: "Waterproof", origin: "content" }]);
    expect(hasVerifiedClaim(saysNo, "nikkelvrij", everywhere)).toBe(false);
    // Unknown (null) still lets the content claim through.
    expect(getVerifiedClaims(makeProduct({ handle: "mae-mini-hoops", metafields: { nikkelvrij: null } }), everywhere)[0]).toEqual({
      id: "nikkelvrij",
      label: "Nikkelvrij",
      origin: "content",
    });
  });

  it("never gives a claim to a gift card or the gift wrap", () => {
    expect(getVerifiedClaims(makeProduct({ type: "cadeaukaart", metafields: { nikkelvrij: true } }), verified)).toEqual([]);
    expect(getVerifiedClaims(makeProduct({ type: "cadeauverpakking" }), verified)).toEqual([]);
  });

  it("answers hasVerifiedClaim and renders as 'bevestigd door de leverancier', never 'getest'", () => {
    expect(hasVerifiedClaim(nickelFreeMetafield, "nikkelvrij")).toBe(true);
    expect(hasVerifiedClaim(plain, "nikkelvrij")).toBe(false);
    const [claim] = getVerifiedClaims(nickelFreeMetafield);
    const text = pdpCopy.claims.confirmed(claim.label);
    expect(text).toBe("Nikkelvrij (bevestigd door de leverancier)");
    expect(text.toLowerCase()).not.toContain("getest");
  });
});
