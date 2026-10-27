import type { ReactNode } from "react";

import { PdpStateProvider } from "@/components/pdp/PdpStateProvider";

/**
 * Layout of /products/[handle] (docs/PLAN.md §3.2, §13.9). It stays mounted while the visitor moves between product
 * pages, so PdpStateProvider keeps the chosen colour or size, the stack picks and the gift wrap tick per product for
 * the visit (CORVANE app/products/layout.tsx). A server component; only the provider is a client island. Adds no
 * markup and reads no cookies, headers or search params, so every product page stays static.
 */
export default function ProductsLayout({ children }: { children: ReactNode }) {
  return <PdpStateProvider>{children}</PdpStateProvider>;
}
