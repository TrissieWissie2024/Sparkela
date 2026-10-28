import { ArrowUpRight, Check } from "lucide-react";

import { formatDayMonth } from "@/lib/dates";
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
 * The waitlist (docs/PLAN.md §14.20, §11.8; brief §6 Prelaunch; decisions 67, 119, 136, 223). On --pagina with the
 * header logo (inkt word, roest spark), so the only public page of the prelaunch keeps the brand's 70/20/10 like the
 * drop teaser (QA round 4: it was about 95% inkt); only the MiniFooter below is donker. Top to bottom on a phone: the
 * logo, the H1 "Sparkela komt eraan" with the promise (the date from site.launchAt, never retyped), the photo of
 * Linde, then the Club sign-up in a white card with the reward stated up front, and the socials.
 *
 * The photo block shows when its file is supplied, and in local, test and preview builds also as the "FOTO: Linde,
 * wachtlijst" placeholder (site.flags.hideMissingOptionalMedia false, QA round 1), so the two-column layout is built and
 * checked before the photo arrives. Production without the file keeps no photo block (decision 119). Below lg the
 * photo is a compact 16:9 crop (QA round 4), so on a 390 × 844 phone the email field is on the first screen; from lg
 * it is 4:5 next to the text and the card, everything above the fold at 1440 × 900.
 *
 * At launchAt the TimeGate right under the H1 swaps the promise for "We zijn live." with a button to the shop, in a
 * reserved height (no layout shift), so a visitor who kept the page open sees it on the first screen (QA round 4). The
 * button is a plain <a href="/"> (not next/link): a full page load, so the proxy serves the shop and not a cached
 * waitlist. Server component; the form and the TimeGate are client islands.
 */

const PHOTO_KEY = "linde.wachtlijst";
const TITLE_ID = "wachtlijst-titel";
const SIGNUP_ID = "wachtlijst-aanmelden";
const LOGO_WIDTH = 160;
/** The logo's built-in free space, trimmed on the left so its letters line up with the H1 (as in Header). */
const logoTrim = { marginLeft: -logoLayout(LOGO_WIDTH).clearSpace };

export function WaitlistHero({ hideMissing = site.flags.hideMissingOptionalMedia }: { hideMissing?: boolean } = {}) {
  const copy = formsCopy.waitlist;
  const supplied = suppliedImage(PHOTO_KEY);
  const photo = supplied ?? (hideMissing ? null : (assets.images[PHOTO_KEY] ?? null));
  // "27 november" never breaks between day and month.
  const launchLabel = formatDayMonth(site.launchAt).replace(/ /g, " ");
  const column = photo ? "lg:col-span-7 lg:col-start-1" : undefined;

  return (
    <section aria-labelledby={TITLE_ID} className="flex-1 bg-pagina text-tekst">
      <Container className="py-8 md:py-12">
        {/* Without a photo one 44rem column on the left edge; Container keeps its own max width (cn() does not merge). */}
        <div
          className={cn(
            "grid gap-6 md:gap-8",
            photo ? "lg:grid-cols-12 lg:items-center lg:gap-x-12 lg:gap-y-8" : "max-w-[44rem]",
          )}
        >
          <div className={cn(column, photo && "lg:self-end")}>
            <div style={logoTrim}>
              <Logo variant="header" width={LOGO_WIDTH} />
            </div>
            <h1 id={TITLE_ID} className="kop-1 mt-6 md:mt-10">
              {copy.title}
            </h1>
            {/* The promise, and from launchAt "We zijn live." with the button in the same reserved height. */}
            <TimeGate
              at={site.launchAt}
              className="mt-3 min-h-14 md:mt-4 lg:min-h-15"
              before={
                // One sentence per line: "Vanaf" never dangles after the first sentence (QA round 3).
                <p className="tekst-groot max-w-[34rem] text-tekst-2">
                  <SentenceLines text={copy.promise(launchLabel)} />
                </p>
              }
              after={
                <div className="flex min-h-14 flex-wrap items-center gap-x-5 gap-y-3 lg:min-h-15">
                  <p className="tekst-groot font-semibold text-tekst">{copy.live}</p>
                  {/* A full page load on purpose: the proxy serves the shop, not a cached waitlist (plan §11.8, decision 136). */}
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                  <a href="/" className={buttonClasses({ variant: "primair", size: "md" })}>
                    {copy.toShop}
                  </a>
                </div>
              }
            />
          </div>

          {photo ? (
            <div className="relative aspect-video overflow-hidden rounded-kaart lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:aspect-[4/5]">
              <PhotoSlot
                assetKey={PHOTO_KEY}
                label={photo.label}
                aspect="fill"
                preload={supplied !== null}
                sizes="(min-width: 1280px) 470px, (min-width: 1024px) 38vw, 100vw"
              />
            </div>
          ) : null}

          <section
            aria-labelledby={SIGNUP_ID}
            className={cn("rounded-kaart border border-rand bg-kaart p-5 md:p-8", column, photo && "lg:self-start")}
          >
            <h2 id={SIGNUP_ID} className="kop-3 text-tekst">
              {copy.signupTitle}
            </h2>
            <ul aria-label={copy.benefitsLabel} className="mt-4 space-y-2">
              {site.club.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-tekst-2">
                  <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-roest" strokeWidth={1.75} />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <SubscribeForm source="wachtlijst" layout="inline" className="mt-5 max-w-[34rem] md:mt-6" />
          </section>

          {/* Only confirmed accounts: this page is where social traffic lands before the launch (QA round 3). */}
          {confirmedSocials.length > 0 ? (
            <nav aria-label={copy.socialsLabel} className={column}>
              <ul className="flex flex-wrap gap-x-6">
                {confirmedSocials.map((social) => (
                  <li key={social.id}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-link underline-offset-4 hover:text-link-hover hover:underline"
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
      </Container>
    </section>
  );
}
