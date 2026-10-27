import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { brandColor } from "@/lib/brand-colors";
import { OG_LOCALE, siteUrl } from "@/lib/seo";
import { home } from "@/content/home";
import { site } from "@/content/site";
import { LogoDefs } from "@/components/brand/LogoDefs";
import { FIRST_PAINT_ID } from "@/components/layout/FirstPaintMarker";
import { RouteFocus } from "@/components/layout/RouteFocus";
import { SkipLink } from "@/components/layout/SkipLink";
import { MotionStyles } from "@/components/ui/MotionStyles";

import "./globals.css";

/**
 * Fonts (docs/PLAN.md §4.3, brief §5, decision 46): Unbounded 700 and 800 for headings, Inter 400 to 600 for body and
 * UI. Self-hosted from assets/fonts with next/font/local (integrator 10, decision 212), like CORVANE's Inter
 * (CORVANE D53.7): the same fonts as Google Fonts serves, in smaller files, because every byte the page requests
 * before its first paint counts towards Lighthouse's LCP on a slow phone.
 * - Unbounded: the static latin 700 and 800 instances of @fontsource/unbounded (21 and 22 KB). next/font/google sent
 *   the whole variable font, 200 to 900, for both weights (51 KB).
 * - Inter: Google Fonts' Inter latin subset with the weight axis limited to 400-700 (34 KB instead of 48 KB; 700
 *   covers `bolder`). The same file as CORVANE's assets/fonts/Inter-latin-wght400-700.woff2.
 * Both are preloaded, so the browser fetches them with the HTML. SIL OFL 1.1: assets/fonts/OFL-*.txt.
 * Unbounded 900 is only used in the logo, which is an SVG.
 *
 * Fallbacks (wave 10-11, E1 and integrator 10): app/globals.css brings tuned fallback faces ("Unbounded Fallback
 * Arial/Roboto", "Inter Fallback Arial/Roboto"), and `fallback` puts them straight after the web font in
 * --font-unbounded and --font-inter. next/font's own fallback is one regular Arial face sized for regular Unbounded:
 * a bold heading in it ran about 7% narrower than Unbounded 800, so long H1s wrapped one line shorter until the font
 * arrived (404 H1: CLS 0.024 at 390 px), and it only knew local("Arial"), which Linux, ChromeOS and Android lack.
 * adjustFontFallback: false keeps next/font from generating that face; with next/font/google under Turbopack only a
 * manual `fallback` list removed it (decision 212).
 */
const unbounded = localFont({
  src: [{ path: "../assets/fonts/Unbounded-latin-800.woff2", weight: "800", style: "normal" }],
  variable: "--font-unbounded",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Unbounded Fallback Arial", "Unbounded Fallback Roboto"],
});
/**
 * Unbounded 700 (kop-3, the mobile menu) is its own family and not preloaded (QA round 1, decision 216): it is rarely
 * above the fold, and its 21 kB competed with the CSS and the 800 face (the LCP text) before the first paint. Its own
 * family, because a family that holds 800 would answer a 700 request with the 800 face instead of falling through.
 */
const unbounded700 = localFont({
  src: [{ path: "../assets/fonts/Unbounded-latin-700.woff2", weight: "700", style: "normal" }],
  variable: "--font-unbounded-700",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["Unbounded Fallback Arial", "Unbounded Fallback Roboto"],
});
const inter = localFont({
  src: "../assets/fonts/Inter-latin-wght400-700.woff2",
  weight: "400 700",
  style: "normal",
  variable: "--font-inter",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Inter Fallback Arial", "Inter Fallback Roboto"],
});

/**
 * Marks elements that are hidden by an inline display:none with data-inline-hidden, and unmarks them when shown again.
 * React's Activity hides the routes Next keeps in the DOM after a client navigation exactly that way. The footer rule
 * in app/globals.css (a page with its own Club sign-up hides the footer's Club block) uses this attribute instead of
 * matching [style*="display: none"] inside :has(): an attribute-substring selector in :has() made every inline style
 * change on the page (Radix sets CSS variables while measuring, for one) re-check the whole document, about 150 ms
 * of style work per page load on a fast desktop CPU. Runs during parsing, before anything is hidden; never touches
 * React-managed attributes.
 */
const INLINE_HIDDEN_SCRIPT =
  '(function(){var b=document.body;if(!b||typeof MutationObserver!=="function")return;' +
  "new MutationObserver(function(r){for(var i=0;i<r.length;i++){var t=r[i].target;if(!t.style)continue;" +
  'if(t.style.display==="none")t.setAttribute("data-inline-hidden","");' +
  'else if(t.hasAttribute("data-inline-hidden"))t.removeAttribute("data-inline-hidden")}})' +
  '.observe(b,{subtree:true,attributes:true,attributeFilter:["style"]})})()';

/**
 * Site-wide metadata (plan §18.1). metadataBase (siteUrl) and the Open Graph locale come from lib/seo.ts (decision
 * 153), so the root and pageMetadata() share them. metadataBase makes canonical and Open Graph URLs absolute. No
 * canonical here: every page sets its own through pageMetadata() (lib/seo.ts), and a root canonical would be
 * inherited by pages without one (CORVANE D53.1). Pages that set openGraph replace this object, so pageMetadata() repeats the shared
 * fields. Icons come from app/icon.svg, app/favicon.ico and app/apple-icon.png, the manifest from app/manifest.ts.
 */
export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: `${site.name} | ${home.meta.title}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    type: "website",
    locale: OG_LOCALE,
    siteName: site.name,
    title: `${site.name} | ${home.meta.title}`,
    description: site.description,
  },
  twitter: { card: "summary_large_image" },
};

/** The browser bar matches the announcement bar at the top of every page (--donker). Sparkela has no dark mode. */
export const viewport: Viewport = {
  themeColor: brandColor("donker"),
  colorScheme: "light",
};

/**
 * Root layout (plan §3.2, §4.6). A server component that reads no cookies, headers or search params, so every
 * route stays static. In DOM order: the inline-hidden marker script (INLINE_HIDDEN_SCRIPT, wave 10-11), shared SVG
 * definitions (LogoDefs, added by B1 in wave 3b, so the first paint can draw the logo), SkipLink (z-70, visible on
 * focus only), the route (ShopChrome or the (kaal) layout renders <main id="main" tabIndex={-1}>), RouteFocus
 * (renders nothing) and MotionStyles (the sparkela-* keyframes as a hoisted <style>, which React moves into <head>
 * once; added by B2 in wave 3b).
 *
 * body is a flex column of at least the viewport height; main is flex-1. No ancestor of the sticky header may
 * set overflow, or `sticky` stops working (plan §4.6).
 *
 * <link rel="expect" href="#sparkela-paint" blocking="render"> in <head> (integrator 10, decision 212): the browser
 * does not paint before it has parsed FirstPaintMarker, the first child of <main>, so the announcement bar and the
 * header are never painted half-built. A busy CPU let Chrome paint while the HTML was still being parsed: the centred
 * desktop nav first showed with some of its items and then re-centred as the rest arrived (CLS 0.0017 to 0.0026 at
 * 1440 px). Both layouts render the marker; a page without one paints when parsing ends. Browsers without
 * render-blocking `expect` links ignore the tag.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className={`${inter.variable} ${unbounded.variable} ${unbounded700.variable} antialiased`}>
      <head>
        {/* No first paint before the header is parsed (see the comment above RootLayout). */}
        <link rel="expect" href={`#${FIRST_PAINT_ID}`} blocking="render" />
      </head>
      <body className="flex min-h-dvh flex-col bg-pagina font-sans text-tekst">
        <script dangerouslySetInnerHTML={{ __html: INLINE_HIDDEN_SCRIPT }} />
        <LogoDefs />
        <SkipLink />
        {children}
        <RouteFocus />
        <MotionStyles />
      </body>
    </html>
  );
}
