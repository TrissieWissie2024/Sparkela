import Link from "next/link";
import type { ComponentPropsWithRef, MouseEvent, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Buttons and button-styled links (plan §4.2, §13.2; brief §5: roest is the only button colour, decision 77).
 *
 * - `primair`: roest with bot-wit text (6,76:1), hover the darker `--primair-hover` (8,22:1).
 * - `op-roest`: bot-wit with roest text, for roest surfaces (data-vlak="roest").
 * - `outline`: no fill, a border in `--tekst`; hover thickens the border (inset ring, no layout shift).
 * - `outline-op-donker`: the same in bot-wit, for donker surfaces (data-vlak="donker").
 * - `ghost`: no fill and no border; takes the text colour of its surface, so it works on light and dark.
 * - `link`: leisteen text link with an underline, hover roest.
 * There is no filled variant in inkt, steen, olijf or leisteen; Button.test.tsx guards that.
 *
 * Heights: sm 36, md 48, lg 56 px. A text button of 36 px gets a 44 px touch target through `before:`; icon-only
 * buttons are at least 44 × 44 px (sm 44, md 48, lg 56), sized in px so a large default font size does not push
 * the header apart (CORVANE D43.10). Filled variants carry a transparent 1 px border, which forced colors paints
 * (CORVANE D35).
 *
 * Renders `next/link` for a route, a plain <a> for an in-page anchor ("#finder", so focus moves with the jump,
 * WCAG 2.4.3), otherwise <button type="button">. While `loading` the control keeps its focus: aria-disabled and
 * aria-busy instead of `disabled` (CORVANE D34), and clicks are ignored. Port of CORVANE components/ui/Button.tsx.
 */

export type ButtonVariant = "primair" | "op-roest" | "outline" | "outline-op-donker" | "ghost" | "link";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the width of the container. */
  fullWidth?: boolean;
  /** Square button for a single icon. Give it an aria-label. */
  iconOnly?: boolean;
}

const base =
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-sans font-semibold whitespace-nowrap " +
  "select-none no-underline transition-[background-color,border-color,color,box-shadow,transform] duration-200 " +
  "ease-out motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-disabled:cursor-not-allowed aria-disabled:not-aria-busy:opacity-50 aria-busy:cursor-progress!";

/** Per variant. Only `primair` (bg-primair) and `op-roest` (bg-bot-wit) are filled. */
export const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primair:
    "border border-transparent bg-primair text-primair-tekst hover:bg-primair-hover active:bg-primair-hover",
  "op-roest": "border border-transparent bg-bot-wit text-roest hover:bg-bot-wit-50 active:bg-bot-wit-50",
  outline:
    "border border-tekst bg-transparent text-tekst hover:shadow-[inset_0_0_0_1px_var(--tekst)] active:shadow-[inset_0_0_0_1px_var(--tekst)]",
  "outline-op-donker":
    "border border-bot-wit bg-transparent text-bot-wit hover:shadow-[inset_0_0_0_1px_var(--bot-wit)] active:shadow-[inset_0_0_0_1px_var(--bot-wit)]",
  ghost: "bg-transparent text-inherit hover:bg-current/10 active:bg-current/15",
  link:
    "bg-transparent text-link underline underline-offset-4 decoration-1 hover:text-link-hover hover:decoration-2 rounded-sm",
};

/** Text buttons. sm is 36 px high, with a 44 px touch target through an invisible ::before. */
const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
  md: "h-12 px-6 text-[0.9375rem]",
  lg: "h-14 px-8 text-base",
};

/** Icon-only buttons, in px (see the note above). */
const iconOnlySizes: Record<ButtonSize, string> = {
  sm: "size-[44px]",
  md: "size-[48px]",
  lg: "size-[56px]",
};

/** Text links have no box; the touch target grows to at least 44 px high around the text. */
const linkSizes: Record<ButtonSize, string> = {
  sm: "text-sm before:absolute before:-inset-x-1 before:-inset-y-3 before:content-['']",
  md: "text-[0.9375rem] before:absolute before:-inset-x-1 before:-inset-y-3 before:content-['']",
  lg: "text-base before:absolute before:-inset-x-1 before:-inset-y-3 before:content-['']",
};

/** Class names of a button, for elements that cannot use <Button> (a styled <summary>, a Radix trigger). */
export function buttonClasses({
  variant = "primair",
  size = "md",
  fullWidth = false,
  iconOnly = false,
}: ButtonStyleOptions = {}): string {
  const sizing = variant === "link" ? linkSizes[size] : iconOnly ? iconOnlySizes[size] : sizes[size];
  return cn(base, BUTTON_VARIANT_CLASSES[variant], sizing, fullWidth && "w-full");
}

interface ButtonOwnProps extends ButtonStyleOptions {
  /** Shows a spinner, sets aria-busy and aria-disabled and ignores clicks; the button keeps its focus. */
  loading?: boolean;
  /** Label while loading ("Bezig met toevoegen"). Defaults to the normal label. */
  loadingLabel?: string;
  /** Icon before the label (decorative: aria-hidden). */
  iconStart?: ReactNode;
  /** Icon after the label (decorative: aria-hidden). */
  iconEnd?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export type ButtonAsButtonProps = ButtonOwnProps &
  Omit<ComponentPropsWithRef<"button">, keyof ButtonOwnProps> & { href?: undefined };

export type ButtonAsLinkProps = ButtonOwnProps &
  Omit<ComponentPropsWithRef<typeof Link>, keyof ButtonOwnProps | "href"> & { href: string };

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

function ButtonSpinner() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-[1.1em] shrink-0 motion-safe:animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ButtonContent({
  loading,
  loadingLabel,
  iconStart,
  iconEnd,
  children,
}: Pick<ButtonOwnProps, "loading" | "loadingLabel" | "iconStart" | "iconEnd" | "children">) {
  return (
    <>
      {loading ? <ButtonSpinner /> : iconStart}
      {loading && loadingLabel ? loadingLabel : children}
      {loading ? null : iconEnd}
    </>
  );
}

/** True for a same-document fragment link such as "#finder". */
export function isInPageAnchor(href: string): boolean {
  return href.startsWith("#");
}

function blockClick(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
}

export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { href, variant, size, fullWidth, iconOnly, loading, loadingLabel, iconStart, iconEnd, className, children, ...rest } =
      props;
    const classes = cn(buttonClasses({ variant, size, fullWidth, iconOnly }), className);
    const content = (
      <ButtonContent loading={loading} loadingLabel={loadingLabel} iconStart={iconStart} iconEnd={iconEnd}>
        {children}
      </ButtonContent>
    );
    const busy = loading
      ? { "aria-busy": true as const, "aria-disabled": true as const, onClick: blockClick }
      : {};

    if (isInPageAnchor(href)) {
      // Drop the props only <Link> understands; the rest are plain anchor attributes.
      const {
        as,
        replace,
        scroll,
        shallow,
        passHref,
        prefetch,
        locale,
        legacyBehavior,
        onNavigate,
        transitionTypes,
        ...anchorRest
      } = rest;
      void [as, replace, scroll, shallow, passHref, prefetch, locale, legacyBehavior, onNavigate, transitionTypes];
      return (
        <a href={href} className={classes} {...anchorRest} {...busy}>
          {content}
        </a>
      );
    }

    return (
      <Link href={href} className={classes} {...rest} {...busy}>
        {content}
      </Link>
    );
  }

  const {
    href,
    variant,
    size,
    fullWidth,
    iconOnly,
    loading,
    loadingLabel,
    iconStart,
    iconEnd,
    className,
    children,
    type = "button",
    onClick,
    ...rest
  } = props;
  void href;
  return (
    <button
      type={type}
      className={cn(buttonClasses({ variant, size, fullWidth, iconOnly }), className)}
      {...rest}
      aria-busy={loading || undefined}
      aria-disabled={loading || rest["aria-disabled"] || undefined}
      onClick={loading ? blockClick : onClick}
    >
      <ButtonContent loading={loading} loadingLabel={loadingLabel} iconStart={iconStart} iconEnd={iconEnd}>
        {children}
      </ButtonContent>
    </button>
  );
}
