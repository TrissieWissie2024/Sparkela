import type { Metadata, Viewport } from "next";
import { Inter, Unbounded } from "next/font/google";

import { brandColor } from "@/lib/brand-colors";
import { OG_LOCALE, siteUrl } from "@/lib/seo";
import { home } from "@/content/home";
import { site } from "@/content/site";
import { LogoDefs } from "@/components/brand/LogoDefs";
import { RouteFocus } from "@/components/layout/RouteFocus";
import { SkipLink } from "@/components/layout/SkipLink";
import { MotionStyles } from "@/components/ui/MotionStyles";

import "./globals.css";

/**
 * Fonts (docs/PLAN.md §4.3, brief §5, decision 46): Unbounded 700 and 800 for headings, Inter for body and UI.
 * next/font/google downloads them at build time and self-hosts them, so the browser never talks to Google.
 * Unbounded 900 is only used in the logo, which is an SVG.
 */
const unbounded = Unbounded({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-unbounded", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

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
 * route stays static. In DOM order: shared SVG definitions (LogoDefs, added by B1 in wave 3b, so the first paint can
 * draw the logo), SkipLink (z-70, visible on focus only), the route (ShopChrome or the (kaal) layout renders
 * <main id="main" tabIndex={-1}>), RouteFocus (renders nothing) and MotionStyles (the sparkela-* keyframes as a
 * hoisted <style>, which React moves into <head> once; added by B2 in wave 3b).
 *
 * body is a flex column of at least the viewport height; main is flex-1. No ancestor of the sticky header may
 * set overflow, or `sticky` stops working (plan §4.6).
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className={`${inter.variable} ${unbounded.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col bg-pagina font-sans text-tekst">
        <LogoDefs />
        <SkipLink />
        {children}
        <RouteFocus />
        <MotionStyles />
      </body>
    </html>
  );
}
