"use client";

import { cn } from "@/lib/cn";
import { pagesCopy } from "@/content/copy/pages";
import { Spark } from "@/components/brand/Spark";

/**
 * The three face-down cards of the popup (docs/PLAN.md §13.11, decision 92; brief §2.8, §6 block 6). Port of CORVANE
 * components/email/RewardCards.tsx with Sparkela's card: roest with a bot-wit spark.
 *
 * - Every card is a <button> named by its content: "Kaart 1 van 3 omdraaien" (visually hidden) while face down, then
 *   "Kaart 1 van 3, jouw kaart:" plus the visible face ("WELKOM10 10% op je eerste bestelling"), fix 7-9. Every card hides the same real reward, and the modal says so
 *   before a card is turned (site.emailCapture.intro).
 * - Turning one flips it in 300 ms (CSS 3D, behind motion-safe: only); with reduced motion there is no transform: the
 *   back is swapped for the face at once. The face shows site.emailCapture.reveal: the code WELKOM10 and "10% op je
 *   eerste bestelling".
 * - The other two cards then turn as well (a little later, with motion), so the visitor sees that they hold the same
 *   reward. Their captions say "Jouw kaart" and "Zelfde beloning" (the caption line has a fixed height: no shift).
 * - After the turn the chosen card keeps focus (aria-disabled, a second press does nothing) and the other two leave
 *   the tab order, so the next Tab reaches the email field. The face is only mounted once turned, so a face-down card
 *   holds no text.
 * - Turned, the cards become a short row (4:3 instead of 3:4, no spark on the face; QA round 1), so the email field,
 *   the consent and "Ik doe mee" fit in the modal on a phone and on a 1280 × 800 laptop.
 */

export const CARD_COUNT = 3;

export interface SparkCardsProps {
  /** Index (0-based) of the card the visitor turned, or null while all are face down. */
  chosen: number | null;
  onChoose(index: number): void;
}

/** Flip delays of the two other cards, after the chosen one (motion only). */
const FOLLOW_DELAYS = ["motion-safe:delay-[180ms]", "motion-safe:delay-[300ms]"];

/** Card back: roest with a thin inner frame, a large bot-wit spark and two small ones in the corners. */
function CardBack({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute inset-0 flex items-center justify-center overflow-hidden rounded-[12px] bg-roest text-bot-wit",
        "transition-shadow duration-200 group-hover:shadow-hover motion-safe:backface-hidden",
        className,
      )}
    >
      <span className="absolute inset-[5px] rounded-[8px] border border-bot-wit/30 sm:inset-[7px] sm:rounded-[9px]" />
      <Spark className="absolute top-[12%] left-[16%] size-[11%] opacity-70" />
      <Spark className="size-[44%]" />
      <Spark className="absolute right-[16%] bottom-[12%] size-[11%] opacity-70" />
    </span>
  );
}

/** Card face: the same reward on every card. Its text is part of the button's name (no aria-label overrides it). */
function CardFace({ chosen }: { chosen: boolean }) {
  // Always the compact face: it is only mounted once the cards are turned (and the row is short).
  const face = pagesCopy.popup.cardFace;
  return (
    <span
      className={cn(
        "@container absolute inset-0 flex flex-col items-center justify-center rounded-[12px] bg-kaart px-1.5 text-center text-tekst",
        "motion-safe:rotate-y-180 motion-safe:backface-hidden",
        chosen ? "ring-2 ring-tekst ring-inset" : "ring-1 ring-rand ring-inset",
      )}
    >
      {/* Sized to the card (container units): Unbounded is wide, and the code must fit on one line at any width. */}
      <span className="font-display text-[11cqw] leading-none font-extrabold tracking-[-0.01em] whitespace-nowrap">
        {face.value}
      </span>{" "}
      {/* 7.6em is about 12 digits of Inter: em, not ch, so the line breaks stay put through the font swap. */}
      <span className="mt-1.5 max-w-[7.6em] text-[0.6875rem] leading-[1.3] text-tekst-2 sm:mt-2 sm:text-[0.8125rem]">
        {face.line}
      </span>
    </span>
  );
}

export function SparkCards({ chosen, onChoose }: SparkCardsProps) {
  const copy = pagesCopy.popup;
  const revealed = chosen !== null;
  const others = Array.from({ length: CARD_COUNT }, (_, index) => index).filter((index) => index !== chosen);

  return (
    <div role="group" aria-label={copy.cardsLabel} className="grid grid-cols-3 gap-2.5 sm:gap-4">
      {Array.from({ length: CARD_COUNT }, (_, index) => {
        const isChosen = chosen === index;
        const number = index + 1;
        // The name comes from the content: a visually hidden prefix, then (once turned) the visible face, so the
        // accessible name always contains the visible text (WCAG 2.5.3).
        const prefix = !revealed
          ? copy.card(number, CARD_COUNT)
          : isChosen
            ? copy.cardChosen(number, CARD_COUNT)
            : copy.cardRevealed(number, CARD_COUNT);
        const followDelay = revealed && !isChosen ? FOLLOW_DELAYS[others.indexOf(index)] : undefined;

        return (
          <div key={index} className="flex min-w-0 flex-col items-center gap-2">
            <button
              type="button"
              aria-disabled={revealed || undefined}
              tabIndex={revealed && !isChosen ? -1 : undefined}
              onClick={() => {
                if (!revealed) onChoose(index);
              }}
              data-card={number}
              data-revealed={revealed || undefined}
              className={cn(
                "group relative block w-full rounded-[12px] perspective-[1000px]",
                revealed ? "aspect-[4/3] cursor-default" : "aspect-[3/4] cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "relative block size-full rounded-[12px]",
                  "motion-safe:transition-[transform,translate] motion-safe:duration-300 motion-safe:ease-out motion-safe:transform-3d",
                  revealed ? "motion-safe:rotate-y-180" : "motion-safe:group-hover:-translate-y-1",
                  followDelay,
                )}
              >
                <span className="sr-only">{prefix} </span>
                {/* Reduced motion: no transform; the back is swapped for the face at once. */}
                <CardBack className={cn(revealed && "motion-reduce:hidden")} />
                {revealed ? <CardFace chosen={isChosen} /> : null}
              </span>
            </button>
            {/* The button's name already carries this; the caption is for sighted visitors. */}
            <span
              aria-hidden="true"
              className={cn(
                "h-4 text-center text-[0.6875rem] leading-4 whitespace-nowrap sm:text-xs",
                isChosen ? "font-semibold text-tekst" : "text-tekst-2",
              )}
            >
              {revealed ? (isChosen ? copy.yourCard : copy.sameReward) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
