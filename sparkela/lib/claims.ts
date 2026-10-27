import type { Claim, ClaimId, Product, VerifiedClaim } from "@/lib/types";
import { claims as allClaims } from "@/content/claims";

/**
 * Verified claims only (docs/PLAN.md §6.6, brief §2.6). Components show claims ("nikkelvrij", "waterproof",
 * "hypoallergeen") exclusively through getVerifiedClaims(), as pdpCopy.claims.confirmed(label):
 * "Nikkelvrij (bevestigd door de leverancier)", never "getest" (decision 82). At launch nothing is verified,
 * so every product gets an empty list.
 *
 * A claim counts when:
 * - nikkelvrij: the Shopify metafield custom.nikkelvrij is exactly true (origin "metafield"), or
 * - any claim: content/claims.ts has it with `verified: true`, a non-empty `source` and this product in
 *   `productHandles` (or "alle") (origin "content").
 * `verified: true` without a source does not count. A metafield custom.nikkelvrij that is explicitly false blocks the
 * content nikkelvrij claim for that product (fail closed: the shop's own product data says no, decision 182). Gift cards and the gift wrap never carry a claim.
 */

/** What getVerifiedClaims() reads from a product. */
export type ClaimSubject = Pick<Product, "handle" | "isGiftCard" | "isGiftWrap"> & {
  metafields: Pick<Product["metafields"], "nikkelvrij">;
};

/** A content claim with proof: verified and a written source. */
export function hasProof(claim: Claim): boolean {
  return claim.verified === true && typeof claim.source === "string" && claim.source.trim().length > 0;
}

function appliesTo(claim: Claim, handle: string): boolean {
  return claim.productHandles === "alle" || claim.productHandles.includes(handle);
}

/** The verified claims of one product, in content order, each claim once (the metafield wins for nikkelvrij). */
export function getVerifiedClaims(product: ClaimSubject, source: readonly Claim[] = allClaims): VerifiedClaim[] {
  if (product.isGiftCard || product.isGiftWrap) return [];
  const out: VerifiedClaim[] = [];
  const seen = new Set<ClaimId>();
  // An explicit "no" in the product data beats a content claim (also one with productHandles "alle").
  if (product.metafields.nikkelvrij === false) seen.add("nikkelvrij");

  if (product.metafields.nikkelvrij === true) {
    // The label comes from content (the one place with visible claim copy); without an entry there is no label.
    const entry = source.find((claim) => claim.id === "nikkelvrij");
    if (entry) {
      out.push({ id: "nikkelvrij", label: entry.label, origin: "metafield" });
      seen.add("nikkelvrij");
    }
  }

  for (const claim of source) {
    if (seen.has(claim.id) || !hasProof(claim) || !appliesTo(claim, product.handle)) continue;
    out.push({ id: claim.id, label: claim.label, origin: "content" });
    seen.add(claim.id);
  }
  return out;
}

/** True when this claim is verified for this product (for example the FAQ answer about nikkelvrij). */
export function hasVerifiedClaim(product: ClaimSubject, id: ClaimId, source: readonly Claim[] = allClaims): boolean {
  return getVerifiedClaims(product, source).some((claim) => claim.id === id);
}
