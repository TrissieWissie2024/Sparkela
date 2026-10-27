import Link from "next/link";
import type { CSSProperties } from "react";

import type { CatalogProduct, Drop, DropPhase, MobileNavFeature, Stack } from "@/lib/types";
import { getFeaturedDrop, getVisibleStacks } from "@/lib/shop-data";
import { chromeCopy } from "@/content/copy/chrome";
import { mainNav } from "@/content/navigation";
import { Logo, logoLayout } from "@/components/brand/Logo";
import { Container } from "@/components/ui/Container";

import { AccountLink } from "./header/AccountLink";
import { CartButton } from "./header/CartButton";
import { DesktopNav } from "./header/DesktopNav";
import { HeaderCompactSentinel } from "./header/HeaderCompactSentinel";
import { SearchButton } from "./header/SearchButton";
import { MobileNav } from "./MobileNav";

/**
 * The sticky site header (docs/PLAN.md §2.5, §4.6, §13.5, decisions 36, 40 and 83; brief §6 block 2).
 *
 * - Sticky at the top, z-30, exactly --header-hoogte tall (64 px, 72 px from xl), solid pagina with a hairline: dark
 *   sections never show through. No ancestor may set overflow, or sticky stops working.
 * - Below xl a grid of three columns (1fr auto 1fr), so the logo is always centred: [menu, search] [logo, 120 px,
 *   104 px below xs] [account from xs, "Tas (n)"]. Below 380 px the account icon goes (the menu has it), so nothing
 *   scrolls sideways at 320 px.
 * - From xl: [logo, 150 px, its letters on the container edge] [DesktopNav with the two expanding groups] [search,
 *   account, "Tas (n)"]. The megamenu panels hang under the header (it is their positioned ancestor).
 * - Compact on scroll: HeaderCompactSentinel sets data-compact on the header once it sticks; the logo then scales
 *   to 104/120 within the same height (motion-safe), so nothing moves (no CLS).
 *
 * The logo's free space (the height of the S, decision 161) is part of its <svg>. Below xl the grid counts only the
 * letters, so the free space may overlap the transparent 11 px padding of the icon buttons beside it (the icons keep
 * their distance); that is what lets menu, search, logo, account and "Tas (n)" fit from 380 px, and everything but
 * the account icon at 320 px, without scrolling sideways. From xl the free space on the left is pulled into the
 * container gutter, so the letters line up with the content.
 *
 * Header is the thin async data wrapper: it decides the featured card of the mobile menu (a drop only while it is
 * publicly live, else Linde's first visible stack). HeaderView is synchronous and takes it as a prop.
 */

export function mobileNavFeature(
  featured: { drop: Drop; phase: DropPhase } | null,
  stacks: Array<{ stack: Stack; products: CatalogProduct[] }>,
): MobileNavFeature | null {
  if (featured?.phase === "live") return { kind: "drop", drop: featured.drop };
  const first = stacks[0];
  return first ? { kind: "stack", stack: first.stack, products: first.products } : null;
}

/** The logo widths of plan §13.5 (the letters, without the free space). */
export const HEADER_LOGO_WIDTHS = { xs: 104, base: 120, xl: 150 } as const;

const small = logoLayout(HEADER_LOGO_WIDTHS.xs);
const base = logoLayout(HEADER_LOGO_WIDTHS.base);
const wide = logoLayout(HEADER_LOGO_WIDTHS.xl);

/** Rendered widths and margins per breakpoint, as custom properties (computed sizes, no design token exists). */
const logoVars = {
  "--logo-w-sm": `${small.width}px`,
  "--logo-w-md": `${base.width}px`,
  "--logo-w-xl": `${wide.width}px`,
  "--logo-trim-sm": `${-small.clearSpace}px`,
  "--logo-trim-md": `${-base.clearSpace}px`,
  "--logo-trim-xl": `${-wide.clearSpace}px`,
} as CSSProperties;

export function HeaderView({ feature }: { feature: MobileNavFeature | null }) {
  return (
    <>
      <HeaderCompactSentinel />
      <header
        data-site-header=""
        className="group/header sticky top-0 z-30 h-header border-b border-rand bg-pagina print:hidden"
      >
        <Container className="grid h-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:gap-8">
          <div className="-ml-3 flex min-w-0 items-center justify-start xl:hidden">
            <MobileNav feature={feature} />
            <SearchButton placement="mobile" />
          </div>

          <Link
            href="/"
            aria-label={chromeCopy.header.home}
            style={logoVars}
            className="mx-(--logo-trim-sm) flex items-center justify-center xs:mx-(--logo-trim-md) xl:mr-0 xl:ml-(--logo-trim-xl) xl:justify-start"
          >
            <Logo
              variant="header"
              width={HEADER_LOGO_WIDTHS.xl}
              className="h-auto w-(--logo-w-sm) origin-center xs:w-(--logo-w-md) xl:w-(--logo-w-xl) xl:origin-left motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out group-data-[compact=true]/header:scale-[0.8667]"
            />
          </Link>

          <DesktopNav items={mainNav} className="max-xl:hidden" />

          <div className="-mr-3 flex min-w-0 items-center justify-end">
            <SearchButton placement="desktop" className="max-xl:hidden" />
            <AccountLink className="max-xs:hidden" />
            <CartButton />
          </div>
        </Container>
      </header>
    </>
  );
}

export async function Header() {
  const [featured, stacks] = await Promise.all([getFeaturedDrop(), getVisibleStacks()]);
  return <HeaderView feature={mobileNavFeature(featured, stacks)} />;
}
