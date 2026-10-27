import { MONOGRAM_S_PATH, SPARK_PATH, WORDMARK_PATH } from "./logo-paths";

/** Id of the shared wordmark path (the word without the spark). */
export const LOGO_WORDMARK_ID = "sparkela-wordmark";
/** Id of the shared spark path, in its 100 x 100 box. */
export const LOGO_SPARK_ID = "sparkela-spark";
/** Id of the shared monogram S, in monogram coordinates. */
export const LOGO_S_ID = "sparkela-s";

/**
 * The logo paths, once per document (docs/PLAN.md §13.1). Rendered first in <body> by app/layout.tsx, so the first
 * paint can draw every logo. Logo and Monogram draw them with <use href="#…">, so the path data is in the HTML and the
 * RSC payload once instead of once per logo. A <use> renders the path in the user units of its own <svg> and inherits
 * its fill, so the paths here have no fill of their own.
 *
 * Fixed ids are safe here: this component renders exactly once, in the root layout, outside any route that Activity
 * keeps hidden in the DOM.
 */
export function LogoDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      className="pointer-events-none absolute size-0 overflow-hidden"
    >
      <defs>
        <path id={LOGO_WORDMARK_ID} d={WORDMARK_PATH} />
        <path id={LOGO_SPARK_ID} d={SPARK_PATH} />
        <path id={LOGO_S_ID} d={MONOGRAM_S_PATH} />
      </defs>
    </svg>
  );
}
