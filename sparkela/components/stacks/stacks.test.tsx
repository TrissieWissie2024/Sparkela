import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CatalogProduct, Stack } from "@/lib/types";
import { defaultVariant } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { stackQuote } from "@/lib/pricing";
import { collectionCopy } from "@/content/copy/collection";
import { sharedCopy } from "@/content/copy/shared";
import { stacks } from "@/content/stacks";
import { CartProvider } from "@/components/cart/CartProvider";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { ClockProvider } from "@/components/time/ClockProvider";
import { localCatalogProducts } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import { AddStackButton, choosableVariants } from "./AddStackButton";
import { StackCard, stackCardQuote } from "./StackCard";
import { StackGrid, stackGridClasses } from "./StackGrid";

/**
 * Linde's stacks (docs/PLAN.md §13.12, §19.1, D3): StackCard shows the three pieces with their prices and the stack
 * price from stackQuote ("€X in plaats van €Y", never struck through); AddStackButton offers a colour choice only for
 * pieces with more than one variant for sale (kantoor-maar-niet-saai: Noor and Ivy, not Tess) and is aria-disabled
 * with a reason when a piece is sold out; StackGrid never leaves a ragged row.
 */

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

const catalog = localCatalogProducts(TEST_NOW);

function piece(handle: string): CatalogProduct {
  const product = catalog.find((candidate) => candidate.handle === handle);
  if (!product) throw new Error(`no product ${handle}`);
  return product;
}

function stackBySlug(slug: string): Stack {
  const stack = stacks.find((candidate) => candidate.slug === slug);
  if (!stack) throw new Error(`no stack ${slug}`);
  return stack;
}

function piecesOf(stack: Stack): [CatalogProduct, CatalogProduct, CatalogProduct] {
  const [a, b, c] = stack.productHandles.map(piece);
  if (!a || !b || !c) throw new Error("three pieces expected");
  return [a, b, c];
}

function render(children: ReactNode): string {
  return renderToStaticMarkup(
    <ClockProvider serverNow={TEST_NOW}>
      <CatalogProvider products={catalog}>
        <CartProvider provider="local">{children}</CartProvider>
      </CatalogProvider>
    </ClockProvider>,
  );
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

/** The labels of the <select>s in the markup. */
function selectLabels(html: string): string[] {
  return [...html.matchAll(/<label for="[^"]+" class="tekst-klein font-semibold text-tekst">([^<]*)<\/label>/g)].map((m) => m[1] ?? "");
}

describe("StackCard", () => {
  it("computes the stack price with stackQuote over the default variants", () => {
    const pieces = piecesOf(stackBySlug("kantoor-maar-niet-saai"));
    const quote = stackCardQuote(pieces);
    const expected = stackQuote(pieces.map((p) => ({ price: defaultVariant(p).price.cents, type: p.type })));
    expect(quote).toEqual(expected);
    // Noor 14,95 + Ivy 14,95 + Tess 19,95 = 49,85; 15 % per piece, rounded half up: 2,24 + 2,24 + 2,99 = 7,47.
    expect(quote).toMatchObject({ subtotal: 4985, discount: 747, total: 4238, active: true });
  });

  it("shows the pieces, their prices and the total as plain text, never struck through", () => {
    const stack = stackBySlug("kantoor-maar-niet-saai");
    const pieces = piecesOf(stack);
    const html = render(<StackCard stack={stack} products={pieces} />);
    expect(html).toContain(`<h3 class="kop-3 text-tekst">${escape(stack.name)}</h3>`);
    expect(html).toContain(escape(stack.description));
    for (const p of pieces) {
      expect(html).toContain(`href="/products/${p.handle}"`);
      expect(html).toContain(formatMoney(defaultVariant(p).price));
    }
    expect(html).toContain("€42,38");
    expect(html).toContain(escape(collectionCopy.stacks.insteadOf("€49,85")));
    expect(html).toContain(escape(sharedCopy.price.savings("€7,47")));
    expect(html).not.toContain("<s>");
    expect(html).not.toContain("<s ");
  });

  it("renders nothing without exactly three pieces", () => {
    const stack = stackBySlug("goud-en-gedurfd");
    expect(renderToStaticMarkup(<StackCard stack={stack} products={piecesOf(stack).slice(0, 2)} />)).toBe("");
  });
});

describe("AddStackButton", () => {
  it("offers a colour choice for Noor and Ivy but not for Tess (kantoor-maar-niet-saai)", () => {
    const pieces = piecesOf(stackBySlug("kantoor-maar-niet-saai"));
    const html = render(<AddStackButton products={pieces} label={collectionCopy.stacks.add} stackName="Kantoor maar niet saai" />);
    expect(selectLabels(html)).toEqual([
      escape(collectionCopy.stacks.variantLabel("Noor dikke ringetjes")),
      escape(collectionCopy.stacks.variantLabel("Ivy dun armbandje")),
    ]);
    expect(html).not.toContain(escape(collectionCopy.stacks.variantLabel("Tess schakelarmband")));
    // One option per variant for sale, the default variant selected.
    expect(html).toContain(">Goud</option>");
    expect(html).toContain(">Zilver</option>");
    expect(html).toContain(`>${escape(collectionCopy.stacks.add)}<`);
    expect(html).toContain(`aria-label="${escape(collectionCopy.stacks.addLabel("Kantoor maar niet saai"))}"`);
    expect(html).not.toContain('aria-disabled="true"');
  });

  it("needs no choice when every piece has one variant", () => {
    const pieces = piecesOf(stackBySlug("kleur-op-je-pols"));
    expect(selectLabels(render(<AddStackButton products={pieces} label={collectionCopy.stacks.add} />))).toEqual([]);
  });

  it("is aria-disabled with the reason when a piece is sold out", () => {
    const isa = piece("isa-dubbele-schakel");
    expect(choosableVariants(isa)).toEqual([]);
    const pieces: [CatalogProduct, CatalogProduct, CatalogProduct] = [piece("lola-chunky-hoops"), isa, piece("tess-schakelarmband")];
    const html = render(<AddStackButton products={pieces} label={collectionCopy.stacks.add} />);
    expect(html).toContain('aria-disabled="true"');
    const reason = html.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(reason).toBeTruthy();
    expect(html).toContain(`id="${reason}"`);
    expect(html).toContain(escape(collectionCopy.stacks.soldOut(isa.title)));
  });
});

describe("StackGrid", () => {
  it("never leaves a ragged row", () => {
    expect(stackGridClasses(3)).toEqual({ list: expect.stringContaining("xl:grid-cols-3"), last: "md:col-span-2 xl:col-span-1" });
    expect(stackGridClasses(4).list).toContain("xl:grid-cols-4");
    expect(stackGridClasses(4).last).toBe("");
    expect(stackGridClasses(2).list).not.toMatch(/xl:grid-cols/);
    expect(stackGridClasses(1).last).toBe("md:col-span-2");
    expect(stackGridClasses(5).last).toBe("md:col-span-2");
  });

  it("renders one card per stack in a named list, and nothing without stacks", () => {
    const items = stacks.slice(0, 3).map((stack) => ({ stack, products: piecesOf(stack) }));
    const html = render(<StackGrid items={items} label={collectionCopy.stacks.listTitle} />);
    expect(html).toContain(`aria-label="${escape(collectionCopy.stacks.listTitle)}"`);
    expect(html.match(/<article/g)).toHaveLength(3);
    expect(renderToStaticMarkup(<StackGrid items={[]} label="x" />)).toBe("");
  });
});
