import type { Claim } from "@/lib/types";

/**
 * Product claims (docs/PLAN.md §6.6, brief §2.6). Every claim is unverified at launch. A claim only appears on a
 * product through getVerifiedClaims() in lib/claims.ts: with `verified: true` plus a `source` here, or with the
 * Shopify metafield nikkelvrij set to true. Never set `verified` without written proof from the supplier.
 */
export const claims: Claim[] = [
  { id: "nikkelvrij", label: "Nikkelvrij", verified: false, productHandles: [], source: null },
  { id: "waterproof", label: "Waterproof", verified: false, productHandles: [], source: null },
  { id: "hypoallergeen", label: "Hypoallergeen", verified: false, productHandles: [], source: null },
];
