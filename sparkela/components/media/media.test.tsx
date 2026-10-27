import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ProductImage } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";

import { PhotoSlot } from "./PhotoSlot";
import { ProductPhoto } from "./ProductPhoto";
import { VideoSlot } from "./VideoSlot";

/*
 * Media slots (plan §13.4, §17): a flat placeholder "FOTO: …" / "VIDEO: …" until a file is supplied, next/image with
 * `sizes` and `preload` (never `priority`) once it is, and a video that never autoplays.
 *
 * next/image is replaced by a plain <img> that prints the props it got, so the test checks what the slots pass
 * (the real image goes through lib/image-loader.ts, which has its own test). "hero.desktop" and "video.01" are
 * marked as supplied through a mocked SUPPLIED; the real manifest is used for everything else.
 */

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; sizes?: string; fill?: boolean; preload?: boolean; priority?: boolean }) => (
    // A stand-in for next/image in this test only: it prints the props the slots pass.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={props.src}
      alt={props.alt}
      data-sizes={props.sizes}
      data-fill={String(Boolean(props.fill))}
      data-preload={String(Boolean(props.preload))}
      data-priority={String(Boolean(props.priority))}
    />
  ),
}));

vi.mock("@/content/assets", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/content/assets")>();
  return { ...original, SUPPLIED: new Set(["hero.desktop", "video.01"]) };
});

const shopifyImage: ProductImage = {
  url: "https://cdn.shopify.com/s/files/1/0001/lola.jpg?v=1",
  alt: "Lola chunky hoops in goud",
  width: 1600,
  height: 2000,
  kind: "draagfoto",
};

describe("PhotoSlot", () => {
  it("shows a flat placeholder with 'FOTO: {label}' while the file is not supplied", () => {
    const html = renderToStaticMarkup(<PhotoSlot assetKey="hero.mobiel" label="Hero mobiel" />);
    expect(html).toContain(`>${sharedCopy.ui.photoPlaceholder("Hero mobiel")}</span>`);
    expect(html).toContain("bg-vlak");
    expect(html).toContain("aspect-[4/5]");
    expect(html).toContain('role="img"');
    expect(html).toContain("text-xs");
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/gradient|<svg/);
  });

  it("uses the asset's aspect ratio and tones", () => {
    expect(renderToStaticMarkup(<PhotoSlot assetKey="drops.holiday-sparkle" label="Drop" />)).toContain("aspect-video");
    expect(renderToStaticMarkup(<PhotoSlot assetKey="fotostrook.01" label="Strook" />)).toContain("aspect-square");
    expect(renderToStaticMarkup(<PhotoSlot label="Vrij" aspect="fill" tone="donker" />)).toContain("absolute inset-0");
    expect(renderToStaticMarkup(<PhotoSlot label="Vrij" tone="donker" />)).toContain("bg-bot-wit-900");
  });

  it("hides a decorative placeholder from screen readers", () => {
    expect(renderToStaticMarkup(<PhotoSlot label="Sfeer" alt="" />)).toContain('aria-hidden="true"');
  });

  it("renders next/image with sizes and preload once the file is supplied", () => {
    const html = renderToStaticMarkup(
      <PhotoSlot assetKey="hero.desktop" label="Hero desktop" sizes="(min-width: 1024px) 58vw, 100vw" preload />,
    );
    expect(html).toContain('src="/images/hero/hero-desktop.webp"');
    expect(html).toContain('data-sizes="(min-width: 1024px) 58vw, 100vw"');
    expect(html).toContain('data-fill="true"');
    expect(html).toContain('data-preload="true"');
    expect(html).toContain('data-priority="false"');
    expect(html).toContain("aspect-video");
    expect(html).not.toContain("FOTO:");
  });
});

describe("VideoSlot", () => {
  it("shows 'VIDEO: {label}' in 9:16 without a file", () => {
    const html = renderToStaticMarkup(<VideoSlot assetKey="video.02" label="Stack aandoen" />);
    expect(html).toContain(sharedCopy.ui.videoPlaceholder("Stack aandoen"));
    expect(html).toContain("aspect-[9/16]");
    expect(html).not.toContain("<video");
  });

  it("never autoplays a supplied video and loads nothing before play", () => {
    const html = renderToStaticMarkup(<VideoSlot assetKey="video.01" label="Video 01" />);
    expect(html).toContain("<video");
    expect(html).toContain('controls=""');
    expect(html).toContain('preload="none"');
    expect(html).toContain('poster="/videos/sparkela-01-poster.webp"');
    expect(html).toContain('src="/videos/sparkela-01.mp4"');
    expect(html).not.toMatch(/autoplay/i);
  });
});

describe("ProductPhoto", () => {
  it("shows 'FOTO: {title}, {kind}' without an image", () => {
    const html = renderToStaticMarkup(<ProductPhoto image={null} productTitle="Lola chunky hoops" sizes="50vw" />);
    expect(html).toContain("FOTO: Lola chunky hoops, packshot");
    expect(html).toContain("aspect-[4/5]");
    const detail = renderToStaticMarkup(<ProductPhoto image={null} productTitle="Lola chunky hoops" kind="schaal" sizes="50vw" />);
    expect(detail).toContain(`FOTO: Lola chunky hoops, ${sharedCopy.ui.imageKinds.schaal}`);
  });

  it("renders the Shopify photo through next/image with its alt text, sizes and preload", () => {
    const html = renderToStaticMarkup(
      <ProductPhoto image={shopifyImage} productTitle="Lola chunky hoops" sizes="(min-width: 1024px) 55vw, 100vw" preload />,
    );
    expect(html).toContain('src="https://cdn.shopify.com/s/files/1/0001/lola.jpg?v=1"');
    expect(html).toContain('alt="Lola chunky hoops in goud"');
    expect(html).toContain('data-sizes="(min-width: 1024px) 55vw, 100vw"');
    expect(html).toContain('data-preload="true"');
    expect(html).toContain("aspect-[4/5]");
  });

  it("falls back to '{title}, {kind}' for an empty alt text", () => {
    const html = renderToStaticMarkup(<ProductPhoto image={{ ...shopifyImage, alt: " " }} productTitle="Lola chunky hoops" sizes="50vw" />);
    expect(html).toContain(`alt="${sharedCopy.ui.imageAlt("Lola chunky hoops", sharedCopy.ui.imageKinds.draagfoto)}"`);
  });
});
