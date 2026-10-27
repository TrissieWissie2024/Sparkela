/**
 * The lazy dialogs and islands of the shop in one module (QA round 1, decision 216b): every next/dynamic import that
 * points here forms one chunk group, so Radix Dialog (DismissableLayer, FocusScope, Presence …) is downloaded and
 * compiled once instead of once per island. Turbopack's merged chunks (decision 215b) do not share modules between
 * separate dynamic imports. The four after-idle islands (cart drawer, mobile menu, search, email popup) load together
 * after the page settled; the product page's zoom and ring size guide and the collection's filter sheet load from
 * here on first use, so Radix leaves the initial JavaScript of those pages.
 */
export { CartDrawer } from "@/components/cart/CartDrawer";
export { FilterSheet } from "@/components/collection/FilterSheet";
export { EmailCapture } from "@/components/email/EmailCapture";
export { MobileNavSheet } from "@/components/layout/MobileNavSheet";
export { SearchDialog } from "@/components/layout/SearchDialog";
export { GalleryZoom } from "@/components/pdp/GalleryZoom";
export { RingSizeGuide } from "@/components/pdp/RingSizeGuide";
