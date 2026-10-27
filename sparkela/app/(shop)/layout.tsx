import type { ReactNode } from "react";

import { ShopChrome } from "@/components/layout/ShopChrome";

/**
 * The layout of every shop page (docs/PLAN.md §3.2, §2.2): ShopChrome around the page (announcement bar, header,
 * <main>, footer, cart drawer, consent). Reads no cookies, headers or search params, so every route stays static.
 * The waitlist and the confirmation page live in app/(kaal) without this chrome (decision 16).
 */
export default function ShopLayout({ children }: { children: ReactNode }) {
  return <ShopChrome>{children}</ShopChrome>;
}
