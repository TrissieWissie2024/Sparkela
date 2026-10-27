import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { pageMetadata } from "@/lib/seo";
import { pagesCopy } from "@/content/copy/pages";
import { Spark } from "@/components/brand/Spark";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { PageHeader } from "@/components/pages/PageHeader";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

/**
 * /over-sparkela (docs/PLAN.md §14.11; brief §3, §6): PageHeader (H1 "Over Sparkela"), Linde's photo (linde.portret,
 * 4:5, a "FOTO: …" placeholder until it is supplied) beside her placeholder story "Hoi, ik ben Linde. [Linde schrijft
 * hier haar eigen verhaal.]", the block "Waarom Sparkela" in our own words (no invented personal details), Tristan as
 * co-owner in one sentence, the values (stainless steel with a gold layer, 6 months guarantee against discolouring,
 * gifts instead of big discounts) and a closing band to the shop and the Spark Finder. The Club sign-up of this page
 * is the footer's form directly below the band (a second identical form right above it would repeat itself).
 * Static (○).
 */
const copy = pagesCopy.about;

export const metadata: Metadata = pageMetadata({
  title: copy.title,
  description: copy.metaDescription,
  path: "/over-sparkela",
});

export default function OverSparkelaPage() {
  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} intro={copy.intro} />

      <Container className="pb-14 md:pb-20">
        <section
          aria-labelledby="over-linde"
          className="grid grid-cols-1 gap-8 md:grid-cols-12 md:items-center md:gap-x-8 lg:gap-x-12"
        >
          <div className="md:col-span-5">
            <PhotoSlot
              assetKey="linde.portret"
              label={copy.linde.photoLabel}
              aspect="4:5"
              sizes="(min-width: 768px) 40vw, 100vw"
              className="rounded-kaart"
            />
          </div>
          <div className="md:col-span-7 lg:col-span-6 lg:col-start-7">
            <p className="label-caps text-tekst-2">{copy.linde.eyebrow}</p>
            <h2 id="over-linde" className="kop-2 mt-4 text-tekst">
              {copy.linde.title}
            </h2>
            <p className="tekst-groot mt-5 max-w-[36rem] text-tekst">{copy.lindeIntro}</p>
            <p className="mt-8 flex items-center gap-3 border-t border-rand pt-5 text-[0.9375rem] font-semibold text-tekst">
              <Spark className="size-4 text-roest" />
              {copy.linde.signature}
            </p>
          </div>
        </section>
      </Container>

      <Container>
        <section
          aria-labelledby="over-waarom"
          className="sectie-kort grid grid-cols-1 gap-6 border-t border-rand md:gap-8 lg:grid-cols-12 lg:gap-x-8"
        >
          <div className="lg:col-span-4">
            <p className="label-caps text-tekst-2">{copy.why.eyebrow}</p>
            <h2 id="over-waarom" className="kop-2 mt-4 text-tekst">
              {copy.why.title}
            </h2>
          </div>
          <div className="flex max-w-[36rem] flex-col gap-5 lg:col-span-7 lg:col-start-6">
            <p className="tekst-groot text-tekst">{copy.why.lead}</p>
            {copy.why.paragraphs.map((paragraph) => (
              <p key={paragraph} className="leading-relaxed text-tekst-2 md:text-lg">
                {paragraph}
              </p>
            ))}
            <p className="leading-relaxed text-tekst-2 md:text-lg">{copy.team}</p>
          </div>
        </section>
      </Container>

      <section aria-labelledby="over-waarden" className="bg-vlak">
        <Container className="sectie-kort">
          <h2 id="over-waarden" className="kop-2 text-tekst">
            {copy.values.title}
          </h2>
          <ul className="mt-8 grid grid-cols-1 gap-3 md:mt-10 md:grid-cols-3 md:gap-6">
            {copy.values.items.map((value) => (
              <li key={value.title} className="flex flex-col rounded-kaart border border-rand bg-kaart p-6 md:p-7">
                <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-roest-100 text-roest">
                  <Spark className="size-4" />
                </span>
                <h3 className="kop-3 mt-5 text-tekst">{value.title}</h3>
                <p className="mt-2 leading-relaxed text-tekst-2">{value.text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container>
        <section
          aria-labelledby="over-verder"
          className="sectie-kort flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-10"
        >
          <div>
            <h2 id="over-verder" className="kop-2 text-tekst">
              {copy.outro.title}
            </h2>
            <p className="tekst-groot mt-3 max-w-[32rem] text-tekst-2">{copy.outro.text}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Button
              href={copy.outro.primary.href}
              variant="primair"
              iconEnd={<ArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
            >
              {copy.outro.primary.label}
            </Button>
            <Button href={copy.outro.secondary.href} variant="outline">
              {copy.outro.secondary.label}
            </Button>
          </div>
        </section>
      </Container>
    </>
  );
}
