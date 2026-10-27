import type { QuizConfig } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";
import { welcomeCode } from "@/content/offers";

/**
 * Spark Finder (docs/PLAN.md §5.7, brief §6). Three questions, one per screen. Option labels come from
 * sharedCopy.vocab, so the quiz says exactly what filters, cards and navigation say (decision 125; checked in
 * content/quiz.test.ts). Scoring lives in components/finder/finderState.ts (recommend()): vibe 3, moment 2,
 * Linde's favourite 1; fewer than minResults are topped up with Linde's favourites, at most maxResults.
 * The answers go to Shopify as tags quiz:vibe-<vibe>, quiz:moment-<moment>, quiz:type-<type>.
 */

const { type, vibe, moment } = sharedCopy.vocab;

export const quiz: QuizConfig = {
  intro: {
    title: "Spark Finder",
    text: "Drie vragen, nog geen minuut. Dan weet je welke spark bij je past.",
  },
  questions: [
    {
      id: "vibe",
      title: "Wat is je vibe?",
      options: [
        { value: "chunky-en-bold", label: vibe["chunky-en-bold"] },
        { value: "clean-en-classy", label: vibe["clean-en-classy"] },
        { value: "kleurrijk-en-speels", label: vibe["kleurrijk-en-speels"] },
        { value: "retro", label: vibe.retro },
      ],
    },
    {
      id: "moment",
      title: "Voor welk moment?",
      options: [
        { value: "festival", label: moment.festival },
        { value: "date-night", label: moment["date-night"] },
        { value: "kantoor-maar-niet-saai", label: moment["kantoor-maar-niet-saai"] },
        { value: "strand", label: moment.strand },
        { value: "feestdagen", label: moment.feestdagen },
      ],
    },
    {
      id: "type",
      title: "Wat zoek je?",
      options: [
        { value: "oorbellen", label: type.oorbellen },
        { value: "armbanden", label: type.armbanden },
        { value: "kettingen", label: type.kettingen },
        { value: "ringen", label: type.ringen },
        { value: "verras-me", label: "Verras me" },
      ],
    },
  ],
  scoring: { vibe: 3, moment: 2, lindesFavoriet: 1, minResults: 3, maxResults: 6 },
  result: {
    title: "Jouw sparks",
    restart: "Opnieuw beginnen",
    emailTitle: `Krijg ${welcomeCode.percent}% op je eerste bestelling`,
    skip: "Liever zonder e-mail verder",
  },
};
