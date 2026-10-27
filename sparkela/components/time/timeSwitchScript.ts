/**
 * The inline script of TimeSwitch (plan §10.5 step 2). It runs while the browser parses the HTML, right after the
 * variants, before the first paint: it counts the boundaries that have passed (`Date.now() >= boundary`, the same
 * rule as phaseIndex in lib/schedule.ts) and sets `hidden` on every variant except that one. So a static page built
 * days earlier still shows the right promo bar, VAT line or label at first paint, without a flash or a layout shift.
 *
 * It looks up the wrappers by their data-ts attribute ("{id}-{index}") with a string comparison, not a CSS selector,
 * so any useId() value works. Pure string building; no DOM access here. The values are JSON-encoded and "<" is
 * escaped, so the output can never close the <script> element.
 */

/** Attribute on every variant wrapper of a TimeSwitch: data-ts="{id}-{index}". */
export const TIME_SWITCH_ATTRIBUTE = "data-ts";

/** The data-ts value of variant `index` of the TimeSwitch with this id. */
export function timeSwitchKey(id: string, index: number): string {
  return `${id}-${index}`;
}

/** JSON for a script body: "<" becomes <, so "</script>" can never appear. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function timeSwitchScript(id: string, boundaries: number[]): string {
  const finite = boundaries.filter((boundary) => Number.isFinite(boundary));
  return (
    "(function(){try{" +
    `var b=${scriptJson(finite)},p=${scriptJson(`${id}-`)},n=Date.now(),i=0,k;` +
    "for(k=0;k<b.length;k++)if(b[k]<=n)i++;" +
    `var a=document.querySelectorAll(${scriptJson(`[${TIME_SWITCH_ATTRIBUTE}]`)});` +
    "for(k=0;k<a.length;k++){" +
    `var v=a[k].getAttribute(${scriptJson(TIME_SWITCH_ATTRIBUTE)});` +
    "if(!v||v.slice(0,p.length)!==p)continue;" +
    "var r=v.slice(p.length);" +
    "if(!/^\\d+$/.test(r))continue;" +
    "a[k].hidden=Number(r)!==i}" +
    "}catch(e){}})();"
  );
}
