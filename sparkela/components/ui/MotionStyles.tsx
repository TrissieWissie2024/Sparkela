/**
 * The sparkela-* keyframes of plan §4.7, as a React 19 hoisted <style>: React moves it into <head> and dedupes it by
 * `href`. Rendered once in app/layout.tsx. The motion helper classes in app/globals.css (anim-overlay, anim-sheet-*,
 * anim-modal, anim-accordion, anim-paneel) pick these keyframes per Radix data-state, always behind motion-safe:.
 *
 * Distances and scales match the plan: the modal rises 12 px and scales from 0.98, the megamenu panel drops 4 px.
 */
export const MOTION_KEYFRAMES = [
  "@keyframes sparkela-fade-in{from{opacity:0}to{opacity:1}}",
  "@keyframes sparkela-fade-out{from{opacity:1}to{opacity:0}}",
  "@keyframes sparkela-sheet-in-right{from{transform:translate3d(100%,0,0)}to{transform:translate3d(0,0,0)}}",
  "@keyframes sparkela-sheet-out-right{from{transform:translate3d(0,0,0)}to{transform:translate3d(100%,0,0)}}",
  "@keyframes sparkela-sheet-in-left{from{transform:translate3d(-100%,0,0)}to{transform:translate3d(0,0,0)}}",
  "@keyframes sparkela-sheet-out-left{from{transform:translate3d(0,0,0)}to{transform:translate3d(-100%,0,0)}}",
  "@keyframes sparkela-sheet-in-top{from{transform:translate3d(0,-100%,0)}to{transform:translate3d(0,0,0)}}",
  "@keyframes sparkela-sheet-out-top{from{transform:translate3d(0,0,0)}to{transform:translate3d(0,-100%,0)}}",
  "@keyframes sparkela-modal-in{from{opacity:0;transform:translate3d(0,12px,0) scale(.98)}to{opacity:1;transform:none}}",
  "@keyframes sparkela-modal-out{from{opacity:1;transform:none}to{opacity:0;transform:translate3d(0,12px,0) scale(.98)}}",
  "@keyframes sparkela-accordion-down{from{height:0}to{height:var(--radix-accordion-content-height)}}",
  "@keyframes sparkela-accordion-up{from{height:var(--radix-accordion-content-height)}to{height:0}}",
  "@keyframes sparkela-panel-in{from{opacity:0;transform:translate3d(0,-4px,0)}to{opacity:1;transform:none}}",
  "@keyframes sparkela-panel-out{from{opacity:1;transform:none}to{opacity:0;transform:translate3d(0,-4px,0)}}",
].join("");

/** Port of CORVANE components/ui/MotionStyles.tsx with Sparkela names and timings. */
export function MotionStyles() {
  return (
    <style href="sparkela-motion" precedence="default">
      {MOTION_KEYFRAMES}
    </style>
  );
}
