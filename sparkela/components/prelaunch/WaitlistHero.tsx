import { ArrowUpRight, Check } from "lucide-react";

import { formatDayMonth, formatStartLabel } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { assets } from "@/content/assets";
import { formsCopy } from "@/content/copy/forms";
import { sharedCopy } from "@/content/copy/shared";
import { confirmedSocials, site } from "@/content/site";
import { Logo, logoLayout } from "@/components/brand/Logo";
import { SubscribeForm } from "@/components/forms/SubscribeForm";
import { PhotoSlot, suppliedImage } from "@/components/media/PhotoSlot";
import { TimeGate } from "@/components/time/TimeGate";
import { buttonClasses } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SentenceLines } from "@/components/ui/SentenceLines";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";

/**
 * The waitlist (docs/PLAN.md §14.20, §11.8; brief §6 Prelaunch; decisions 67, 119, 136). On donker, top to bottom on a
 * phone: the logo, the H1 "Sparkela komt eraan" with the promise (the date from site.launchAt, never retyped), the photo
 * of Linde, the Club sign-up with the reward stated up front, the launch line and the socials. The photo block shows
 * when its file is supplied, and in local, test and preview builds also as the "FOTO: Linde, wachtlijst" placeholder
 * (site.flags.hideMissingOptionalMedia false, as PhotoStrip and VideoRow do; QA round 1), so the two-column layout
 * the brief asks for is built and checked before the photo arrives. Production without the file keeps no photo block
 * (decision 119): never a grey placeholder on the only public page.
 *
 * At launchAt the TimeGate swaps "De shop opent op …" for "We zijn live." with a button to the shop, in the same height
 * (no layout shift). The button is a plain <a href="/"> (not next/link): a full page load, so the proxy serves the shop
 * and not a cached waitlist.
 *
 * From lg two columns (text and form left, photo right); without a photo one 44rem column on the container's left edge,
 * in line with the MiniFooter below (QA round 1). Server component; the form and the TimeGate are client islands.
 */

const PHOTO_KEY = "linde.wachtlijst";
const TITLE_ID = "wachtlijst-titel";
const LOGO_WIDTH = 160;
/** The logo's built-in free space, trimmed on the left so its letters line up with the H1 (as in Header). */
const logoTrim = { marginLeft: -logoLayout(LOGO_WIDTH).clearSpace };

export function WaitlistHero({ hideMissing = site.flags.hideMissingOptionalMedia }: { hideMissing?: boolean } = {}) {
  const copy = formsCopy.waitlist;
  const supplied = suppliedImage(PHOTO_KEY);
  const photo = supplied ?? (hideMissing ? null : (assets.images[PHOTO_KEY] ?? null));
  // "27 november" never breaks between day and month.
  const launchLabel = formatDayMonth(site.launchAt).replace(/ /g, "\u00a0");
  const column = photo ? "lg:col-start-1" : undefined;

  return (
    <section data-vlak="donker" aria-labelledby={TITLE_ID} className="flex-1 bg-donker text-tekst-op-donker">
      <Container className="py-10 md:py-14 lg:py-12">
        {/* Without a photo one 44rem column on the left edge; Container keeps its own max width (cn() does not merge). */}
        <div className={cn("grid gap-8", photo ? "lg:grid-cols-2 lg:items-center lg:gap-x-16 lg:gap-y-8" : "max-w-[44rem]")}>
          <div className={column}>
            <div style={logoTrim}>
              <Logo variant="op-donker" width={LOGO_WIDTH} />
            </div>
            <h1 id={TITLE_ID} className="kop-1 mt-8 md:mt-10">
              {copy.title}
            </h1>
            {/* One sentence per line: "Vanaf" never dangles after the first sentence (QA round 3). */}
            <p className="tekst-groot mt-4 max-w-[34rem] text-tekst-2-op-donker">
              <SentenceLines text={copy.promise(launchLabel)} />
            </p>
          </div>

          {photo ? (
            <div className="lg:col-start-2 lg:row-span-3 lg:row-start-1">
              <PhotoSlot
                assetKey={PHOTO_KEY}
                label={photo.label}
                aspect="4:5"
                preload={supplied !== null}
                tone="donker"
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="overflow-hidden rounded-kaart"
              />
            </div>
          ) : null}

          <div className={column}>
            <h2 className="kop-3">{copy.signupTitle}</h2>
            <ul aria-label={copy.benefitsLabel} className="mt-4 space-y-2">
              {site.club.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-tekst-2-op-donker">
                  <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-tekst-op-donker" strokeWidth={1.5} />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <SubscribeForm source="wachtlijst" tone="donker" layout="inline" className="mt-6 max-w-[34rem]" />
          </div>

          <div className={column}>
            <TimeGate
              at={site.launchAt}
              className="min-h-12"
              before={<p className="flex min-h-12 items-center font-semibold">{copy.opensAt(formatStartLabel(site.launchAt))}</p>}
              after={
                <div className="flex min-h-12 flex-wrap items-center gap-x-5 gap-y-3">
                  <p className="font-semibold">{copy.live}</p>
                  {/* A full page load on purpose: the proxy serves the shop, not a cached waitlist (plan §11.8, decision 136). */}
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                  <a href="/" className={buttonClasses({ variant: "primair", size: "md" })}>
                    {copy.toShop}
                  </a>
                </div>
              }
            />
            {/* Only confirmed accounts: this page is where social traffic lands before the launch (QA round 3). */}
            {confirmedSocials.length > 0 ? (
              <nav aria-label={copy.socialsLabel} className="mt-6">
                <ul className="flex flex-wrap gap-x-6">
                  {confirmedSocials.map((social) => (
                    <li key={social.id}>
                      <a
                        href={social.href}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-tekst-op-donker underline-offset-4 hover:underline"
                      >
                        {social.label}
                        <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
                        <VisuallyHidden>{` ${sharedCopy.ui.newWindow}`}</VisuallyHidden>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
