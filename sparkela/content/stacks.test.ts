import { describe, expect, it } from "vitest";
import { assets } from "@/content/assets";
import { drops } from "@/content/drops";
import { products } from "@/content/products";
import { stacks } from "@/content/stacks";

/**
 * content/stacks.ts (plan §5.5, brief §4): Linde's stacks of three. Rule: exactly 3 handles, all of type oorbellen or
 * armbanden (so "Voeg de stack toe" always earns the stack discount), all in the catalog. A stack with a dropSlug only
 * holds pieces of that drop; the other stacks hold no drop pieces (they would disappear before the drop starts).
 */

const productByHandle = new Map(products.map((product) => [product.handle, product]));
const typeOf = (handle: string) => productByHandle.get(handle)?.tags.find((tag) => tag.startsWith("type:"))?.slice("type:".length);
const dropsOf = (handle: string) =>
  (productByHandle.get(handle)?.tags ?? []).filter((tag) => tag.startsWith("drop:")).map((tag) => tag.slice("drop:".length));

describe("stacks (plan §5.5)", () => {
  it("has the four stacks of the plan with their pieces", () => {
    expect(stacks.map((stack) => [stack.slug, stack.productHandles, stack.dropSlug ?? null])).toEqual([
      ["goud-en-gedurfd", ["lola-chunky-hoops", "tess-schakelarmband", "roos-brede-bangle"], null],
      ["kleur-op-je-pols", ["mila-color-pop", "lieke-kralenarmband", "sam-schelp-oorbellen"], null],
      ["kantoor-maar-niet-saai", ["noor-dikke-ringetjes", "ivy-dun-armbandje", "tess-schakelarmband"], null],
      ["holiday-stack", ["holiday-ster-oorbellen", "holiday-glitter-hoops", "holiday-sparkle-armband"], "holiday-sparkle"],
    ]);
    expect(new Set(stacks.map((stack) => stack.slug)).size).toBe(stacks.length);
  });

  it("holds exactly three different earrings or bracelets that exist in the catalog", () => {
    for (const stack of stacks) {
      expect(stack.productHandles, stack.slug).toHaveLength(3);
      expect(new Set(stack.productHandles).size, stack.slug).toBe(3);
      for (const handle of stack.productHandles) {
        expect(productByHandle.has(handle), `${stack.slug}: ${handle}`).toBe(true);
        expect(["oorbellen", "armbanden"], `${stack.slug}: ${handle}`).toContain(typeOf(handle));
      }
    }
  });

  it("only uses pieces that are in stock, so the stack can be added at launch", () => {
    for (const stack of stacks) {
      for (const handle of stack.productHandles) {
        const stock = productByHandle.get(handle)?.variants.reduce((sum, variant) => sum + (variant.quantityAvailable ?? 0), 0) ?? 0;
        expect(stock, `${stack.slug}: ${handle}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps drop pieces in the stack of their drop only", () => {
    for (const stack of stacks) {
      for (const handle of stack.productHandles) {
        expect(dropsOf(handle), `${stack.slug}: ${handle}`).toEqual(stack.dropSlug ? [stack.dropSlug] : []);
      }
      if (stack.dropSlug) expect(drops.some((drop) => drop.slug === stack.dropSlug), stack.slug).toBe(true);
    }
  });

  it("has a name, a description and an image slot for every stack", () => {
    for (const stack of stacks) {
      expect(stack.name.trim(), stack.slug).not.toBe("");
      expect(stack.description.trim(), stack.slug).not.toBe("");
      expect(stack.image).toBe(`stacks.${stack.slug}`);
      expect(assets.images[stack.image], stack.image).toBeDefined();
    }
  });
});
