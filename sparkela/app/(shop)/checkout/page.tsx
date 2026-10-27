import type { Metadata } from "next";

import { resolveProviderName } from "@/lib/commerce";
import { pageMetadata } from "@/lib/seo";
import { pagesCopy } from "@/content/copy/pages";
import { CheckoutView } from "@/components/checkout/CheckoutView";
import { ShopifyCheckoutNote } from "@/components/checkout/ShopifyCheckoutNote";
import { PageHeader } from "@/components/pages/PageHeader";
import { Container } from "@/components/ui/Container";

/**
 * /checkout (docs/PLAN.md §1.3, §2.2, §14.18; brief §7). With COMMERCE_PROVIDER=local the demo checkout (CheckoutView:
 * order overview, discount code field, details form, "Demo-checkout: er wordt niet betaald" and the demo order
 * DEMO-XXXXXX). With Shopify one line and a button that opens the drawer: paying always happens in Shopify's checkout
 * (cart.checkoutUrl). The provider is fixed at build time (resolveProviderName(), as in ShopChrome), so the page stays
 * static (○). Always noindex. The email popup never shows here (components/email).
 */
const copy = pagesCopy.checkout;

export const metadata: Metadata = pageMetadata({
  title: copy.title,
  description: copy.metaDescription,
  path: "/checkout",
  noindex: true,
});

export default function CheckoutPage() {
  const shopify = resolveProviderName() === "shopify";
  // The demo checkout renders its own header: its intro goes once the order is placed (QA round 1).
  if (!shopify) {
    return (
      <>
        {/* A task page: the compact footer (app/globals.css, QA round 1). */}
        <div data-compacte-footer="" hidden />
        <CheckoutView />
      </>
    );
  }
  return (
    <>
      {/* A task page: the compact footer (app/globals.css, QA round 1). */}
      <div data-compacte-footer="" hidden />
      <PageHeader title={copy.title} />
      <Container className="pb-16 md:pb-24">
        <ShopifyCheckoutNote />
      </Container>
    </>
  );
}
