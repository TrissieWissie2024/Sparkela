import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BUTTON_VARIANT_CLASSES, Button, buttonClasses, isInPageAnchor, type ButtonSize, type ButtonVariant } from "./Button";

/*
 * Brief §5 and decision 77: roest is the only button colour. Only `primair` is filled (bg-primair), and on a roest
 * surface `op-roest` is bot-wit (bg-bot-wit). No variant, size or state ever fills a button with inkt, donker, steen,
 * olijf or leisteen, not even on hover.
 */

const VARIANTS = Object.keys(BUTTON_VARIANT_CLASSES) as ButtonVariant[];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];
const FORBIDDEN_FILL = /(^|:)bg-(donker|inkt|steen|olijf|leisteen)(-\d+)?(\/|$)/;

/** Background classes without a variant prefix (the resting state). */
function restingBackgrounds(classes: string): string[] {
  return classes.split(/\s+/).filter((name) => /^bg-/.test(name));
}

describe("buttonClasses", () => {
  it("knows exactly the six variants of the plan", () => {
    expect(VARIANTS.sort()).toEqual(["ghost", "link", "op-roest", "outline", "outline-op-donker", "primair"]);
  });

  it.each(VARIANTS)("%s: only primair (bg-primair) and op-roest (bg-bot-wit) have a fill", (variant) => {
    for (const size of SIZES) {
      for (const iconOnly of [false, true]) {
        const backgrounds = restingBackgrounds(buttonClasses({ variant, size, iconOnly }));
        if (variant === "primair") expect(backgrounds).toEqual(["bg-primair"]);
        else if (variant === "op-roest") expect(backgrounds).toEqual(["bg-bot-wit"]);
        else expect(backgrounds).toEqual(["bg-transparent"]);
      }
    }
  });

  it.each(VARIANTS)("%s: never bg-donker, bg-inkt, bg-steen, bg-olijf or bg-leisteen, in any state", (variant) => {
    for (const size of SIZES) {
      for (const iconOnly of [false, true]) {
        for (const fullWidth of [false, true]) {
          const forbidden = buttonClasses({ variant, size, iconOnly, fullWidth })
            .split(/\s+/)
            .filter((name) => FORBIDDEN_FILL.test(name));
          expect(forbidden).toEqual([]);
        }
      }
    }
  });

  it("gives filled buttons a transparent border, which forced colors paints (CORVANE D35)", () => {
    expect(buttonClasses({ variant: "primair" })).toContain("border-transparent");
    expect(buttonClasses({ variant: "op-roest" })).toContain("border-transparent");
  });

  it("uses roest with bot-wit text and the darker hover for the primary button", () => {
    const classes = buttonClasses({ variant: "primair" });
    expect(classes).toContain("text-primair-tekst");
    expect(classes).toContain("hover:bg-primair-hover");
    expect(buttonClasses({ variant: "op-roest" })).toContain("text-roest");
  });

  it("has the heights of the plan and touch targets of at least 44 px", () => {
    expect(buttonClasses({ size: "sm" })).toContain("h-9");
    // A centred 44 px ::before, not insets: insets sit inside the 1 px border and would give 42 px (decision 201).
    const sm = buttonClasses({ size: "sm" });
    expect(sm).toContain("before:h-[44px]");
    expect(sm).toContain("before:top-1/2");
    expect(sm).toContain("before:-translate-y-1/2");
    expect(sm).not.toMatch(/before:-inset-y-/);
    expect(buttonClasses({ size: "md" })).toContain("h-12");
    expect(buttonClasses({ size: "lg" })).toContain("h-14");
    expect(buttonClasses({ size: "sm", iconOnly: true })).toContain("size-[44px]");
    expect(buttonClasses({ size: "md", iconOnly: true })).toContain("size-[48px]");
    expect(buttonClasses({ size: "lg", iconOnly: true })).toContain("size-[56px]");
    expect(buttonClasses({ variant: "link" })).toContain("before:-inset-y-3");
  });

  it("animates the press only with motion allowed", () => {
    expect(buttonClasses()).toContain("motion-safe:active:scale-[0.98]");
    expect(buttonClasses()).not.toMatch(/(^|\s)active:scale/);
  });
});

describe("Button", () => {
  it("renders <button type=\"button\"> without href", () => {
    const html = renderToStaticMarkup(<Button>Afrekenen</Button>);
    expect(html).toMatch(/^<button type="button"/);
    expect(html).toContain("bg-primair");
    expect(html).toContain(">Afrekenen</button>");
  });

  it("keeps a submit type when asked", () => {
    expect(renderToStaticMarkup(<Button type="submit">Verstuur</Button>)).toContain('type="submit"');
  });

  it("renders a link for a route and a plain anchor for an in-page anchor", () => {
    const route = renderToStaticMarkup(
      <Button href="/collections/oorbellen" variant="outline">
        Shop oorbellen
      </Button>,
    );
    expect(route).toMatch(/^<a [^>]*href="\/collections\/oorbellen"/);
    expect(route).not.toContain("<button");

    const anchor = renderToStaticMarkup(<Button href="#finder">Naar de finder</Button>);
    expect(anchor).toMatch(/^<a [^>]*href="#finder"/);
    expect(isInPageAnchor("#finder")).toBe(true);
    expect(isInPageAnchor("/stacks")).toBe(false);
  });

  it("keeps focus while loading: aria-disabled and aria-busy, never the disabled attribute (CORVANE D34)", () => {
    const html = renderToStaticMarkup(
      <Button loading loadingLabel="Bezig">
        In winkelwagen
      </Button>,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/\sdisabled(=|\s|>)/);
    expect(html).toContain("Bezig");
    expect(html).not.toContain("In winkelwagen");
    expect(html).toContain("motion-safe:animate-spin");
  });

  it("marks a loading link as busy and disabled", () => {
    const html = renderToStaticMarkup(
      <Button href="/checkout" loading>
        Afrekenen
      </Button>,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-disabled="true"');
  });

  it("renders decorative icons around the label and drops them while loading", () => {
    const icon = <svg aria-hidden="true" data-icon="start" />;
    expect(renderToStaticMarkup(<Button iconStart={icon}>Zoeken</Button>)).toContain('data-icon="start"');
    expect(renderToStaticMarkup(<Button iconEnd={icon} loading>Zoeken</Button>)).not.toContain('data-icon="start"');
  });
});
