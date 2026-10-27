/**
 * The id the root layout's render-blocking <link rel="expect"> waits for (app/layout.tsx, integrator 10, decision
 * 212). ShopChrome and the (kaal) layout render FirstPaintMarker as the first child of <main>, so the browser paints
 * only once everything above the page content (the announcement bar and the header) has been parsed. An expect link
 * waits until its element has been parsed completely, so the marker is an empty element rather than <main> itself,
 * which would hold the first paint until the whole page had been parsed.
 */
export const FIRST_PAINT_ID = "sparkela-paint";

/** An empty, hidden element: nothing to see or hear. Server component; render it once per page. */
export function FirstPaintMarker() {
  return <span id={FIRST_PAINT_ID} hidden />;
}
