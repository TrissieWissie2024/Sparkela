import { Fragment } from "react";

/**
 * A heading's text split after each full stop, one block per sentence (the text itself is unchanged, the spaces stay
 * for screen readers and copy-paste). A sentence wraps inside itself only, so a line never starts with the end of the
 * previous sentence ("drop. Plus 10% op"). Used by PageHeader (sentenceLines) and the footer's Club heading.
 */
export function SentenceLines({ text }: { text: string }) {
  const sentences = text.split(/(?<=\.)\s+/).filter((sentence) => sentence.length > 0);
  return sentences.map((sentence, index) => (
    <Fragment key={index}>
      {index > 0 ? " " : null}
      <span className="block">{sentence}</span>
    </Fragment>
  ));
}
