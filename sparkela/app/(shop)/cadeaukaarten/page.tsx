import type { Metadata } from "next";
import { ArrowRight, Gift, Mail, ReceiptEuro } from "lucide-react";
import { useId } from "react";

import type { CatalogProduct } from "@/lib/types";
import { collectionPath, pageMetadata } from "@/lib/seo";
import { getCatalogProducts } from "@/lib/shop-data";
import { collections } from "@/content/collections";
import { collectionCopy } from "@/content/copy/collection";
import { sharedCopy } from "@/content/copy/shared";
import { faq } from "@/content/faq";
import { giftCards } from "@/content/offers";
import { GiftCardTiles } from "@/components/giftcards/GiftCardTiles";
import { PageHeader } from "@/components/pages/PageHeader";
import { FaqList } from "@/components/sections/FaqList";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

/**
 * /cadeaukaarten (docs/PLAN.md §14.8; brief §4: digital gift cards of €15, €25 and €50, no shipping). PageHeader
 * (H1 "Cadeaukaarten") · GiftCardTiles (one tile per amount with "In tas") and a link to the gift card's product page
 * · "Zo werkt het" (digital, straight to your inbox, no shipping costs) · the FAQ question about gift cards · cross
 * links to "Cadeaus onder €25" and the stacks. The gift card comes from the cached client catalog
 * (getCatalogProducts holds it although it is never listable); without it the tiles make way for a short line. Static.
 */

const copy = collectionCopy.giftCards;

/** FAQ items on this page (content/faq.ts ids). */
const FAQ_IDS = ["cadeaukaart"];

const HOW_ICONS = [Gift, Mail, ReceiptEuro];

export const metadata: Metadata = pageMetadata({ title: copy.title, description: copy.metaDescription, path: "/cadeaukaarten" });

export default async function GiftCardsPage() {
  const giftCard = (await getCatalogProducts()).find((product) => product.handle === giftCards.productHandle) ?? null;
  return <GiftCardsContent giftCard={giftCard} />;
}

function GiftCardsContent({ giftCard }: { giftCard: CatalogProduct | null }) {
  const chooseId = useId();
  const howId = useId();
  const faqId = useId();
  const crossId = useId();
  const faqItems = faq.filter((item) => FAQ_IDS.includes(item.id));
  const underLimit = collections.find((collection) => collection.handle === "onder-25");
  const crossLinks = [
    ...(underLimit ? [{ label: underLimit.title, href: collectionPath(underLimit.handle) }] : []),
    { label: collectionCopy.stacks.title, href: "/stacks" },
  ];

  return (
    <>
      <PageHeader title={copy.title} intro={copy.intro} breadcrumbs={[{ label: sharedCopy.ui.home, href: "/" }, { label: copy.title }]} />
      <Container className="pb-16 md:pb-24">
        <section aria-labelledby={chooseId}>
          <h2 id={chooseId} className="kop-2 text-tekst">
            {copy.chooseTitle}
          </h2>
          {giftCard ? (
            <GiftCardTiles product={giftCard} headingLevel={3} className="mt-6 md:mt-8" />
          ) : (
            <p className="mt-6 rounded-kaart bg-vlak px-6 py-8 text-tekst-2 md:mt-8 md:px-10">{copy.unavailable}</p>
          )}
          {giftCard ? (
            <Button
              href={copy.productLink.href}
              variant="link"
              iconEnd={<ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />}
              className="mt-6"
            >
              {copy.productLink.label}
            </Button>
          ) : null}
        </section>

        <section aria-labelledby={howId} className="mt-16 border-t border-rand pt-16 md:mt-24 md:pt-24">
          <h2 id={howId} className="kop-2 text-tekst">
            {copy.howTitle}
          </h2>
          <ul role="list" className="mt-8 grid gap-6 md:mt-12 md:grid-cols-3 md:gap-6 lg:gap-8">
            {copy.how.map((point, index) => {
              const Icon = HOW_ICONS[index % HOW_ICONS.length] ?? Gift;
              return (
                <li key={point.title} className="flex items-start gap-4 md:flex-col md:gap-0 md:rounded-kaart md:border md:border-rand md:bg-kaart md:p-7 lg:p-8">
                  <span
                    aria-hidden="true"
                    className="flex size-12 shrink-0 items-center justify-center rounded-full border border-rand bg-kaart text-roest md:size-14 md:border-transparent md:bg-vlak"
                  >
                    <Icon className="size-[22px]" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 pt-0.5 md:mt-6 md:pt-0">
                    <h3 className="kop-3 text-tekst">{point.title}</h3>
                    <p className="mt-2 max-w-[24rem] text-tekst-2">{point.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {faqItems.length > 0 ? (
          <section aria-labelledby={faqId} className="mt-16 grid gap-8 md:mt-24 lg:grid-cols-12 lg:gap-12">
            <h2 id={faqId} className="kop-2 text-tekst lg:col-span-4">
              {copy.faqTitle}
            </h2>
            <FaqList items={faqItems} headingLevel={3} className="lg:col-span-8" />
          </section>
        ) : null}

        <section
          aria-labelledby={crossId}
          className="mt-16 flex flex-col items-start gap-6 rounded-kaart bg-vlak px-6 py-10 md:mt-24 md:flex-row md:items-center md:justify-between md:gap-12 md:px-12 md:py-14"
        >
          <div className="max-w-[36rem]">
            <h2 id={crossId} className="kop-2 text-tekst">
              {copy.crossTitle}
            </h2>
            <p className="tekst-groot mt-3 text-tekst-2">{copy.crossIntro}</p>
          </div>
          <ul role="list" className="flex flex-wrap gap-3">
            {crossLinks.map((link) => (
              <li key={link.href}>
                <Button href={link.href} variant="outline">
                  {link.label}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </>
  );
}
