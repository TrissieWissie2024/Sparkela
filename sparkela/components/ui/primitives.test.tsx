import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { BadgeId } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";
import { PageHeader } from "@/components/pages/PageHeader";

import { Accordion } from "./Accordion";
import { Breadcrumbs } from "./Breadcrumbs";
import { Carousel } from "./Carousel";
import { Checkbox } from "./Checkbox";
import { Chip } from "./Chip";
import { Container } from "./Container";
import { Flag } from "./Flag";
import { InlineScript } from "./InlineScript";
import { Modal } from "./Modal";
import { MOTION_KEYFRAMES, MotionStyles } from "./MotionStyles";
import { Pill } from "./Pill";
import { ProgressBar } from "./ProgressBar";
import { ScrollRow } from "./ScrollRow";
import { SectionHeading } from "./SectionHeading";
import { Select } from "./Select";
import { Sheet } from "./Sheet";
import { Spinner } from "./Spinner";
import { Stars } from "./Stars";
import { STATUS_LABEL_CLASSES, StatusLabel } from "./StatusLabel";
import { Tabs } from "./Tabs";
import { TextField } from "./TextField";
import { VisuallyHidden } from "./VisuallyHidden";

/*
 * Static markup of the primitives (plan §13.2): names, roles and states that the rest of the site relies on.
 * Interaction (Radix focus traps, scrolling) is covered by the Playwright specs of wave 10-11.
 */

const noop = () => {};

describe("StatusLabel (plan §4.9)", () => {
  const expected: Record<BadgeId, string> = {
    "op-voorraad": "bg-succes-vlak text-succes",
    uitverkocht: "bg-kaart text-tekst ring-1 ring-rand-sterk ring-inset",
    "early-access": "bg-roest text-bot-wit",
    "laatste-stuks": "bg-fout-vlak text-fout",
    sale: "bg-fout-vlak text-fout",
    nieuw: "bg-info-vlak text-info",
    limited: "bg-roest text-bot-wit",
    bestseller: "bg-donker text-tekst-op-donker",
  };

  it.each(Object.keys(expected) as BadgeId[])("%s has the text from sharedCopy.badges and the colours of the table", (id) => {
    const html = renderToStaticMarkup(<StatusLabel id={id} />);
    expect(STATUS_LABEL_CLASSES[id]).toBe(expected[id]);
    expect(html).toContain(expected[id]);
    expect(html).toContain(`>${sharedCopy.badges[id]}</span>`);
    expect(html).toContain("label-caps");
    expect(html).toContain("rounded-full");
    expect(html).toContain("forced-colors:border-[CanvasText]");
  });

  it("is 20 px on a card and 24 px on the product page", () => {
    expect(renderToStaticMarkup(<StatusLabel id="nieuw" />)).toContain("h-5");
    expect(renderToStaticMarkup(<StatusLabel id="nieuw" size="pdp" />)).toContain("h-6");
  });

  it("has no label 'Lindes favoriet'", () => {
    expect(Object.values(sharedCopy.badges)).not.toContain("Lindes favoriet");
  });
});

describe("Stars (brief §2.3)", () => {
  it("renders nothing without real reviews", () => {
    expect(renderToStaticMarkup(<Stars rating={null} />)).toBe("");
    expect(renderToStaticMarkup(<Stars rating={{ average: 4.5, count: 0 }} />)).toBe("");
    expect(renderToStaticMarkup(<Stars rating={{ average: Number.NaN, count: 3 }} />)).toBe("");
  });

  it("names the rating for screen readers and shows the count", () => {
    const html = renderToStaticMarkup(<Stars rating={{ average: 4.64, count: 12 }} />);
    expect(html).toContain(`role="img" aria-label="${sharedCopy.ui.rating("4,6", 12)}"`);
    expect(html).toContain("4,6 (12)");
    expect(html).toContain("width:92.8%");
    expect(html).not.toMatch(/[★☆]/);
  });
});

describe("headings and page structure", () => {
  it("SectionHeading picks the element and the kop utility from level", () => {
    for (const level of [1, 2, 3] as const) {
      const html = renderToStaticMarkup(<SectionHeading level={level} title="Lindes favorieten" id="favorieten" />);
      expect(html).toContain(`<h${level} id="favorieten" class="kop-${level} text-tekst">Lindes favorieten</h${level}>`);
    }
  });

  it("SectionHeading puts eyebrow, title and intro in order and the action after them", () => {
    const html = renderToStaticMarkup(
      <SectionHeading eyebrow="Nieuw" title="De lanceringscollectie" intro="Kies je favoriet." action={<a href="#alle">Bekijk alles</a>} tone="donker" />,
    );
    expect(html.indexOf("Nieuw")).toBeLessThan(html.indexOf("De lanceringscollectie"));
    expect(html.indexOf("De lanceringscollectie")).toBeLessThan(html.indexOf("Kies je favoriet."));
    expect(html.indexOf("Kies je favoriet.")).toBeLessThan(html.indexOf("Bekijk alles"));
    expect(html).toContain("label-caps mb-4 text-tekst-2-op-donker");
    expect(html).toContain("tekst-groot mt-3");
    expect(html).toContain("md:flex-row");
  });

  it("PageHeader renders one H1 with breadcrumbs whose last crumb is the current page", () => {
    const html = renderToStaticMarkup(
      <PageHeader eyebrow="Sparkela" title="Stacks van Linde" intro="Drie stuks, 15% stack-korting." breadcrumbs={[{ label: sharedCopy.ui.home, href: "/" }, { label: "Stacks" }]} />,
    );
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain(`<nav aria-label="${sharedCopy.ui.breadcrumbs}"`);
    expect(html).toContain('href="/"');
    expect(html).toMatch(/<span aria-current="page"[^>]*>Stacks<\/span>/);
    expect(html.indexOf("<nav")).toBeLessThan(html.indexOf("<h1"));
  });

  it("Breadcrumbs renders nothing without items and never links the current page", () => {
    expect(renderToStaticMarkup(<Breadcrumbs items={[]} />)).toBe("");
    const html = renderToStaticMarkup(<Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Lola", href: "/products/lola" }]} />);
    expect(html).not.toContain('href="/products/lola"');
    expect(html).toContain('aria-current="page"');
  });

  it("Container has the frame of the plan", () => {
    expect(renderToStaticMarkup(<Container as="section">x</Container>)).toBe(
      '<section class="mx-auto w-full max-w-[1240px] px-5 md:px-8">x</section>',
    );
  });

  it("VisuallyHidden is sr-only", () => {
    expect(renderToStaticMarkup(<VisuallyHidden>Van</VisuallyHidden>)).toBe('<span class="sr-only">Van</span>');
  });
});

describe("small parts", () => {
  it("Pill has the USP size and a forced-colors border", () => {
    const html = renderToStaticMarkup(<Pill tone="outline-op-donker">{sharedCopy.countdown.live}</Pill>);
    expect(html).toContain("min-h-8");
    expect(html).toContain("text-[0.8125rem]");
    expect(html).toContain("forced-colors:border");
    expect(html).toContain(sharedCopy.countdown.live);
  });

  it("Chip toggles with aria-pressed and a check mark, never colour alone", () => {
    const off = renderToStaticMarkup(<Chip pressed={false} onClick={noop}>Oorbellen</Chip>);
    expect(off).toContain('aria-pressed="false"');
    expect(off).not.toContain("<svg");
    const on = renderToStaticMarkup(<Chip pressed onClick={noop} count={7}>Oorbellen</Chip>);
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain("<svg");
    expect(on).toContain("border-tekst");
    expect(on).toContain(">7</span>");
    expect(on).toContain("min-h-11");
  });

  it("Chip with href is a plain link", () => {
    const html = renderToStaticMarkup(<Chip href="/collections/retro">Retro</Chip>);
    expect(html).toMatch(/^<a [^>]*href="\/collections\/retro"/);
    expect(html).not.toContain("aria-pressed");
  });

  it("ProgressBar is a progressbar with its value, also in segments", () => {
    const bar = renderToStaticMarkup(<ProgressBar value={0.997} label="Voortgang" />);
    expect(bar).toContain('role="progressbar"');
    expect(bar).toContain('aria-valuenow="100"');
    expect(bar).toContain('aria-label="Voortgang"');
    expect(bar).toContain("forced-colors:bg-[CanvasText]");
    expect(renderToStaticMarkup(<ProgressBar value={-3} label="x" />)).toContain('aria-valuenow="0"');

    const steps = renderToStaticMarkup(<ProgressBar value={2 / 3} label="Stap" segments={3} />);
    expect(steps).toContain('aria-valuemax="3"');
    expect(steps).toContain('aria-valuenow="2"');
    expect(steps.match(/bg-primair/g)).toHaveLength(2);
  });

  it("Spinner is a status with a screen reader text that turns only with motion allowed", () => {
    const html = renderToStaticMarkup(<Spinner label={sharedCopy.ui.loading} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(sharedCopy.ui.loading);
    expect(html).toContain("motion-safe:animate-spin");
  });

  it("Flag uses the flag tokens and a name, or hides when decorative", () => {
    const html = renderToStaticMarkup(<Flag />);
    for (const token of ["fill-vlag-rood", "fill-vlag-wit", "fill-vlag-blauw", "stroke-rand"]) expect(html).toContain(token);
    expect(html).toContain('role="img" aria-label="Nederland"');
    expect(renderToStaticMarkup(<Flag decorative />)).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it("InlineScript is text/javascript on the server", () => {
    expect(renderToStaticMarkup(<InlineScript html="var x=1;" />)).toBe('<script type="text/javascript">var x=1;</script>');
  });

  it("MotionStyles hoists the sparkela-* keyframes with href and precedence", () => {
    expect(MOTION_KEYFRAMES).toMatch(/^@keyframes sparkela-/);
    for (const name of MOTION_KEYFRAMES.match(/@keyframes [\w-]+/g) ?? []) expect(name).toMatch(/^@keyframes sparkela-/);
    for (const name of ["fade-in", "sheet-in-right", "sheet-in-left", "sheet-in-top", "modal-in", "accordion-down", "panel-in"]) {
      expect(MOTION_KEYFRAMES).toContain(`sparkela-${name}`);
    }
    // Rendered on its own, React keeps the <style>; inside a document it hoists it into <head>.
    expect(renderToStaticMarkup(<MotionStyles />)).toContain("sparkela-modal-in");
  });
});

describe("form controls", () => {
  it("Select has a visible label tied to a native select in a 44 px pill", () => {
    const html = renderToStaticMarkup(
      <Select id="sorteren" label="Sorteren" value="nieuwste" onChange={noop} options={Object.entries(sharedCopy.vocab.sort).map(([value, label]) => ({ value, label }))} />,
    );
    expect(html).toContain('<label for="sorteren"');
    expect(html).toContain('<select id="sorteren"');
    expect(html).toContain("h-11");
    expect(html).toContain("border-rand-invoer");
    expect(html).toMatch(/<option value="nieuwste" selected="">Nieuwste<\/option>/);
    expect(renderToStaticMarkup(<Select label="Kleur" hideLabel value="" onChange={noop} options={[]} />)).toContain('class="sr-only"');
  });

  it("Checkbox is never checked by default and links its description and error", () => {
    const html = renderToStaticMarkup(
      <Checkbox id="consent" checked={false} onChange={noop} label="Ja" description="Uitleg" error="Vink dit aan" required />,
    );
    expect(html).toContain('type="checkbox"');
    expect(html).not.toMatch(/checked=""/);
    expect(html).toContain('aria-describedby="consent-error consent-description"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-required="true"');
    expect(html).toContain('id="consent-error"');
    expect(html).toContain("min-h-11");
  });

  it("TextField has its label above, the error linked and a counter for a limited multiline field", () => {
    const html = renderToStaticMarkup(
      <TextField id="email" label="E-mailadres" type="email" value="" onChange={noop} error="Vul je e-mailadres in" hint="We sturen je een bevestiging." required />,
    );
    expect(html).toContain('<label for="email"');
    expect(html).toContain('type="email"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="email-error email-hint"');
    expect(html.indexOf("<label")).toBeLessThan(html.indexOf("<input"));

    const note = renderToStaticMarkup(<TextField id="note" label="Cadeauboodschap" multiline maxLength={200} value="Hoi" onChange={noop} markOptional />);
    expect(note).toContain("<textarea");
    expect(note).toContain('maxLength="200"');
    expect(note).toContain(sharedCopy.ui.charactersLeft(197));
    expect(note).toContain('aria-describedby="note-counter"');
    expect(note).toContain(`(${sharedCopy.ui.optional})`);
  });
});

describe("Radix and scrolling parts render on the server", () => {
  const items = [
    { id: "verkleuren", title: "Verkleuren de sieraden?", content: "Antwoord een" },
    { id: "levertijd", title: "Hoe snel heb ik mijn bestelling?", content: "Antwoord twee" },
  ];

  it("Accordion puts each trigger in a heading and defaults to multiple", () => {
    const html = renderToStaticMarkup(<Accordion items={items} defaultValue={["levertijd"]} />);
    expect(html.match(/<h3[\s>]/g)).toHaveLength(2);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Antwoord twee");
    expect(html).toContain("motion-safe:anim-accordion");
    expect(renderToStaticMarkup(<Accordion type="single" items={items} headingLevel={2} />).match(/<h2[\s>]/g)).toHaveLength(2);
  });

  it("Tabs renders a labelled tablist with the selected tab and only its panel", () => {
    const html = renderToStaticMarkup(
      <Tabs
        label="Producten per type"
        defaultTab="oorbellen"
        tabs={[
          { id: "alles", label: "Alles", panel: <p>alle stukken</p> },
          { id: "oorbellen", label: "Oorbellen", panel: <p>alleen oorbellen</p> },
        ]}
      />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Producten per type"');
    expect(html).toMatch(/aria-selected="true"[^>]*>Oorbellen</);
    expect(html).toContain("alleen oorbellen");
    expect(html).not.toContain("alle stukken");
  });

  it("ScrollRow is a labelled list, focusable until measured, without buttons before hydration", () => {
    const html = renderToStaticMarkup(
      <ScrollRow label="Lindes favorieten" className="gap-3">
        <li>een</li>
      </ScrollRow>,
    );
    expect(html).toContain('role="list"');
    expect(html).toContain('aria-label="Lindes favorieten"');
    expect(html).toContain('tabindex="0"');
    expect(html).not.toContain("<button");
  });

  it("Carousel gives every slide 'n van totaal' inside a list item", () => {
    const html = renderToStaticMarkup(<Carousel label="Reviews" items={["a", "b", "c"]} />);
    expect(html).toContain(`role="region" aria-roledescription="${sharedCopy.ui.carousel}" aria-label="Reviews"`);
    // The name is announced once: the list inside is "Dia's", not the carousel's label again.
    expect(html.match(/aria-label="Reviews"/g)).toHaveLength(1);
    expect(html).toContain(`role="list" aria-label="${sharedCopy.ui.slides.replace("'", "&#x27;")}"`);
    expect(html.match(/<li[\s>]/g)).toHaveLength(3);
    expect(html).toContain(`<li class="w-[85%]`);
    expect(html).toContain(`aria-roledescription="${sharedCopy.ui.slide}" aria-label="${sharedCopy.ui.slideLabel(2, 3)}"`);
    expect(renderToStaticMarkup(<Carousel label="Reviews" items={[]} />)).toBe("");
  });

  it("Sheet and Modal render only their trigger while closed", () => {
    const sheet = renderToStaticMarkup(<Sheet title="Je tas" trigger={<button type="button">Tas</button>} />);
    expect(sheet).toContain(">Tas</button>");
    expect(sheet).toContain('aria-haspopup="dialog"');
    expect(sheet).not.toContain("Je tas");
    const modal = renderToStaticMarkup(<Modal title="Kies je spark." trigger={<button type="button">Open</button>} />);
    expect(modal).toContain('aria-expanded="false"');
    expect(modal).not.toContain("Kies je spark.");
  });
});
