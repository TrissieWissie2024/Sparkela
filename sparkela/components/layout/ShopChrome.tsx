import type { ReactNode } from "react";

import { resolveProviderName } from "@/lib/commerce";
import { getServerNow } from "@/lib/server-clock";
import { getCatalogProducts } from "@/lib/shop-data";
import { site } from "@/content/site";
import { CartDrawerLoader } from "@/components/cart/CartDrawerLoader";
import { CartProvider } from "@/components/cart/CartProvider";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { AnalyticsLoader } from "@/components/consent/AnalyticsLoader";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { ClockProvider } from "@/components/time/ClockProvider";

import { AnnouncementBar } from "./AnnouncementBar";
import { Footer } from "./Footer";
import { Header } from "./Header";

/**
 * The shop chrome around every page of app/(shop) (docs/PLAN.md §13.5, §2.2, decision 16), and around the root 404.
 * A server component that reads no cookies, headers or search params, so every route stays static.
 *
 * Providers: ClockProvider (the cached server clock, getServerNow) › CatalogProvider (the client catalog,
 * getCatalogProducts: listable products plus drop products in early access, the gift wrap and the gift card) ›
 * CartProvider (the adapter of resolveProviderName(), fixed at build time; CartProvider needs the catalog and renders
 * the cart's live region, CartAnnouncer, itself).
 *
 * In DOM order: ConsentBanner (only with site.analytics.enabled; fixed at the bottom, early in the DOM so keyboard
 * users reach it first) · AnnouncementBar (in flow, scrolls away) · Header (sticky) · <main id="main" tabIndex={-1}>
 * (the skip link's target; pages never render their own <main>) · Footer (with the withdrawal link) · CartDrawerLoader
 * (the drawer, lazily) · AnalyticsLoader (only with analytics on). Without analytics neither consent component is
 * rendered, so their code is not in the page. SkipLink, RouteFocus, LogoDefs and MotionStyles sit in app/layout.tsx.
 *
 * Wave 7-9 adds two lines here (integrator): <ReviewsCarousel variant="footer" /> directly above Footer and
 * <EmailCaptureLoader /> after it.
 */
export async function ShopChrome({ children }: { children: ReactNode }) {
  const [products, serverNow] = await Promise.all([getCatalogProducts(), getServerNow()]);
  const provider = resolveProviderName();
  const analytics = site.analytics.enabled;

  return (
    <ClockProvider serverNow={serverNow}>
      <CatalogProvider products={products}>
        <CartProvider provider={provider}>
          {analytics ? <ConsentBanner /> : null}
          <AnnouncementBar />
          <Header />
          {/* tabIndex -1: the skip link and RouteFocus move focus here; no ring around the whole page. */}
          <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
          <Footer />
          <CartDrawerLoader />
          {analytics ? <AnalyticsLoader /> : null}
        </CartProvider>
      </CatalogProvider>
    </ClockProvider>
  );
}
