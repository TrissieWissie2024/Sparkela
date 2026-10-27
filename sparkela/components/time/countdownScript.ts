import { scriptJson } from "./timeSwitchScript";

/**
 * The inline script of Countdown: writes the remaining time into the countdown's text box before the first paint,
 * so a static page shows the running digits at once instead of the fixed label first (no flash, no layout shift
 * when hydration takes over). It mirrors getCountdown and formatCountdown in lib/schedule.ts ("2d 5u" above 24
 * hours, "05:12:09" from 24 hours down, "24:00:00" at exactly one day); countdownScript.test.ts runs it against
 * those functions so the two never drift apart.
 *
 * Once the target has passed (a static page built before it, visited after it), it shows what React shows after
 * hydration, so the stale fixed label ("Begint op …") is not shown before hydration or when the bundle fails: with
 * a `liveLabel` it writes that label into the text box (readable, no longer aria-hidden) and hides the elements marked
 * COUNTDOWN_HIDE_ATTRIBUTE (the screen-reader label and the pause button); without one it hides the whole countdown
 * (decision 187). The elements it touches carry suppressHydrationWarning. With reduced motion it writes no digits
 * (the fixed label stays, plan §4.7). `prefix` goes before the digits, as in Countdown. Pure string building; values
 * are JSON-encoded with "<" escaped.
 */

/** Attribute on the text box of a Countdown, inside the element with the countdown's id. */
export const COUNTDOWN_TEXT_ATTRIBUTE = "data-countdown-text";
/** Attribute on the parts of a Countdown that go once the target has passed (screen-reader label, pause button). */
export const COUNTDOWN_HIDE_ATTRIBUTE = "data-countdown-hide";

export function countdownScript(
  id: string,
  targetMs: number,
  units: { days: string; hours: string },
  liveLabel: string | null = null,
  prefix = "",
): string {
  if (!Number.isFinite(targetMs)) return "";
  return (
    "(function(){try{" +
    `var r=document.getElementById(${scriptJson(id)});if(!r)return;` +
    `var t=r.querySelector(${scriptJson(`[${COUNTDOWN_TEXT_ATTRIBUTE}]`)});if(!t)return;` +
    `var ms=${scriptJson(targetMs)}-Date.now(),l=${scriptJson(liveLabel)};` +
    "if(!(ms>0)){if(l===null){r.hidden=true;return}" +
    't.textContent=l;t.removeAttribute("aria-hidden");' +
    `var x=r.querySelectorAll(${scriptJson(`[${COUNTDOWN_HIDE_ATTRIBUTE}]`)});for(var i=0;i<x.length;i++)x[i].hidden=true;return}` +
    'if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;' +
    "var s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),c=s%60;" +
    'function p(x){return(x<10?"0":"")+x}' +
    `t.textContent=${scriptJson(prefix)}+(ms>86400000?d+${scriptJson(units.days)}+" "+h+${scriptJson(units.hours)}:p(d*24+h)+":"+p(m)+":"+p(c))` +
    "}catch(e){}})();"
  );
}
