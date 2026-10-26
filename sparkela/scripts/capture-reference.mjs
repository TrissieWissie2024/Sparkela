// Capture the reference site lashthing.nl for STRUCTURE analysis (brief §8, phase 1).
// Output goes to reference/lashthing/<viewport>/ (gitignored). Never copy content from it.
//
// Usage (from the project root):
//   node scripts/capture-reference.mjs                 # both viewports
//   node scripts/capture-reference.mjs --only=mobile   # or --only=desktop
//
// Rules this script follows:
// - Cookie banner: always the most privacy-preserving option (preferences -> reject all).
// - Never fills in a form, never submits an email, never goes to checkout.
// - Adds exactly one product to the cart (throwaway browser context) to see the cart drawer.

import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF_DIR = path.join(ROOT, 'reference');
const SITE_DIR = path.join(REF_DIR, 'lashthing');
const BASE = 'https://lashthing.nl';

const VIEWPORTS = {
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  },
  desktop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  },
};

const MAX_SLICES = 20;
const POPUP_WAIT_MS = 12_000;

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const selected = onlyArg ? [onlyArg.split('=')[1]] : ['mobile', 'desktop'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

// ---------------------------------------------------------------------------
// In-page helpers (serialised into the page with page.evaluate)
// ---------------------------------------------------------------------------

/** Structural outline of a page or of one root element. Runs in the browser. */
function outlineInPage(opts) {
  const { rootSelector = null, label = '' } = opts || {};
  const sy = window.scrollY;
  const isVisible = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) !== 0;
  };
  const clean = (t, n = 120) => (t || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top + sy), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const classes = (el) => (typeof el.className === 'string' ? el.className : el.getAttribute('class') || '')
    .split(/\s+/).filter(Boolean).slice(0, 12);

  const patternChecks = {
    carousel: '[aria-roledescription*="carousel" i], slider-component, slideshow-component, [class*="swiper" i], [class*="slick" i], [class*="splide" i], [class*="flickity" i], [class*="carousel" i], [class*="slider" i], [class*="marquee" i], [class*="scrolling" i]',
    slide: '[aria-roledescription*="slide" i], [class*="slide" i]:not([class*="slider" i]):not([class*="slideshow" i])',
    accordion: 'details, [class*="accordion" i], [class*="collapsible" i]',
    tabs: '[role="tablist"], [role="tab"], [class*="tabs" i]',
    dialog: '[role="dialog"], dialog, [aria-modal="true"], [class*="modal" i], [class*="drawer" i]',
    expandable: '[aria-expanded]',
    form: 'form',
    input: 'input:not([type="hidden"]), select, textarea',
    video: 'video, iframe[src*="youtube"], iframe[src*="vimeo"]',
    rating: '[class*="rating" i], [class*="stars" i], [class*="review" i], [class*="trustpilot" i]',
    price: '[class*="price" i]',
    badge: '[class*="badge" i]',
    timer: '[class*="countdown" i], [class*="timer" i]',
  };

  const describe = (el, depth = 0) => {
    const roles = {};
    for (const [k, sel] of Object.entries(patternChecks)) {
      let n = 0;
      try { n = el.querySelectorAll(sel).length + (el.matches(sel) ? 1 : 0); } catch { n = -1; }
      if (n) roles[k] = n;
    }
    const ariaRoles = {};
    for (const r of el.querySelectorAll('[role]')) {
      const role = r.getAttribute('role');
      ariaRoles[role] = (ariaRoles[role] || 0) + 1;
    }
    // Descend through single-child wrappers to find the first level with real layout children.
    let node = el;
    for (let i = 0; i < 8; i++) {
      const kids = [...node.children].filter(isVisible);
      if (kids.length === 1) node = kids[0];
      else break;
    }
    const layoutChildren = [...node.children].filter(isVisible).slice(0, 16).map((c) => ({
      tag: c.tagName.toLowerCase(),
      class: classes(c).slice(0, 6).join(' '),
      ...box(c),
      headings: [...c.querySelectorAll('h1,h2,h3,h4')].filter(isVisible).slice(0, 3).map((h) => clean(h.innerText, 80)),
      links: c.querySelectorAll('a[href]').length,
      buttons: c.querySelectorAll('button, [role="button"], input[type="submit"]').length,
      images: c.querySelectorAll('img').length,
    }));
    const css = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      class: classes(el),
      ...box(el),
      visible: isVisible(el),
      position: css.position,
      background: css.backgroundColor,
      headings: [...el.querySelectorAll('h1,h2,h3')].filter(isVisible).slice(0, 15)
        .map((h) => ({ level: h.tagName.toLowerCase(), text: clean(h.innerText) })),
      counts: {
        links: el.querySelectorAll('a[href]').length,
        buttons: el.querySelectorAll('button, [role="button"], input[type="submit"]').length,
        images: el.querySelectorAll('img').length,
        svgs: el.querySelectorAll('svg').length,
        videos: el.querySelectorAll('video').length,
      },
      patterns: roles,
      ariaRoles,
      layoutContainer: node === el ? 'self' : `${node.tagName.toLowerCase()}.${classes(node).slice(0, 4).join('.')}`,
      layoutChildren,
    };
  };

  // Elements that float over the page (fixed / sticky): pills, chat bubbles, sticky bars, popups.
  const floating = [];
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if ((s.position === 'fixed' || s.position === 'sticky') && isVisible(el)) {
      if (floating.some((f) => f.el.contains(el))) continue;
      const r = el.getBoundingClientRect();
      floating.push({ el, data: { tag: el.tagName.toLowerCase(), id: el.id || null, class: classes(el).slice(0, 6).join(' '), position: s.position, viewportBox: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }, zIndex: s.zIndex, text: clean(el.innerText, 80) } });
    }
  }

  const result = {
    label,
    url: location.href,
    title: document.title,
    viewport: { width: innerWidth, height: innerHeight },
    documentHeight: document.documentElement.scrollHeight,
    capturedAt: new Date().toISOString(),
    floating: floating.map((f) => f.data).slice(0, 30),
    blocks: [],
  };

  if (rootSelector) {
    const root = document.querySelector(rootSelector);
    if (!root) { result.error = `root not found: ${rootSelector}`; return result; }
    result.root = describe(root);
    result.blocks = [...root.children].filter(isVisible).map((c) => ({ region: 'root-child', ...describe(c) }));
    return result;
  }

  const headerEls = [...document.querySelectorAll('.shopify-section-group-header-group')];
  if (!headerEls.length) { const h = document.querySelector('body > header, header'); if (h) headerEls.push(h); }
  const main = document.querySelector('main, #MainContent');
  const footerEls = [...document.querySelectorAll('.shopify-section-group-footer-group')];
  if (!footerEls.length) { const f = document.querySelector('body > footer, footer'); if (f) footerEls.push(f); }

  for (const el of headerEls) result.blocks.push({ region: 'header', ...describe(el) });
  if (main) for (const el of [...main.children].filter((c) => c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE')) result.blocks.push({ region: 'main', ...describe(el) });
  for (const el of footerEls) result.blocks.push({ region: 'footer', ...describe(el) });
  return result;
}

// ---------------------------------------------------------------------------
// Node-side helpers
// ---------------------------------------------------------------------------

async function settle(page, ms = 1500) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function gotoPage(page, url) {
  log('goto', url);
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await settle(page, 2500);
  return resp ? resp.status() : null;
}

async function isVisible(locator) {
  try { return (await locator.count()) > 0 && (await locator.first().isVisible()); } catch { return false; }
}

/** Cookie banner: always choose the most privacy-preserving option. Returns a description of what was done. */
async function declineCookies(page) {
  const reject = page.getByRole('button', { name: /^(reject all|alles weigeren|weigeren|alleen noodzakelijk|only necessary|decline)$/i });
  if (await isVisible(reject)) {
    await reject.first().click();
    await page.waitForTimeout(800);
    return 'clicked direct reject button';
  }
  const prefs = page.getByRole('button', { name: /^(voorkeuren|instellingen|preferences|cookie-instellingen)$/i });
  if (await isVisible(prefs)) {
    await prefs.first().click();
    await page.waitForTimeout(1200);
    if (await isVisible(reject)) {
      await reject.first().click();
      await page.waitForTimeout(800);
      return 'opened preferences, clicked "Reject All" (only necessary cookies)';
    }
    return 'opened preferences but found no reject button';
  }
  return 'no cookie banner visible';
}

/** Klaviyo-style email popup close button (never the submit button, never the email field). */
function popupCloseLocator(page) {
  return page.locator('button[aria-label="Close dialog"], .klaviyo-close-form, [class*="klaviyo"] button[aria-label*="close" i]');
}

async function closeEmailPopup(page) {
  const close = popupCloseLocator(page);
  if (await isVisible(close)) {
    await close.first().click().catch(() => {});
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

async function dismissOverlays(page) {
  await declineCookies(page).catch(() => {});
  await closeEmailPopup(page).catch(() => {});
}

/** Scroll slowly to the bottom and back up to trigger lazy loading and scroll animations. */
async function lazyScroll(page) {
  await page.evaluate(async () => {
    const sleepIn = (ms) => new Promise((r) => setTimeout(r, ms));
    let y = 0;
    while (y < document.documentElement.scrollHeight) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await sleepIn(140);
      y += 260;
    }
    await sleepIn(900);
    for (let yy = document.documentElement.scrollHeight; yy > 0; yy -= 700) {
      window.scrollTo({ top: yy, behavior: 'instant' });
      await sleepIn(70);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.evaluate(async () => {
    const imgs = [...document.images].filter((i) => !i.complete);
    await Promise.race([
      Promise.all(imgs.map((i) => new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))),
      new Promise((r) => setTimeout(r, 6000)),
    ]);
  });
  await page.waitForTimeout(600);
}

async function scrollToY(page, y) {
  await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y);
  await page.waitForTimeout(550);
  return page.evaluate(() => Math.round(window.scrollY));
}

class Recorder {
  constructor(viewportName, dir) {
    this.viewport = viewportName;
    this.dir = dir;
    this.files = [];
    this.notes = [];
    this.urls = {};
  }
  abs(file) { return path.join(this.dir, file); }
  add(file, prefix, shows) {
    this.files.push({ file, path: this.abs(file), prefix, viewport: this.viewport, shows });
    log(`  saved ${this.viewport}/${file}`);
  }
  note(msg) { this.notes.push(msg); log(`  NOTE: ${msg}`); }
  async json(file, prefix, data, shows) {
    await fs.writeFile(this.abs(file), JSON.stringify(data, null, 2), 'utf8');
    this.add(file, prefix, shows);
  }
}

/** Viewport-sized slices of the page between document offsets `from` and `to`. */
async function slicePage(page, rec, prefix, label, from = 0, to = null, startIndex = 1) {
  const vh = page.viewportSize().height;
  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  const end = Math.min(to ?? docH, docH);
  const lastTop = Math.max(from, end - vh);
  let step = Math.round(vh * 0.9);
  const needed = Math.floor((lastTop - from) / step) + 1 + ((lastTop - from) % step ? 1 : 0);
  if (needed > MAX_SLICES) step = Math.ceil((lastTop - from) / (MAX_SLICES - 1));
  let i = startIndex - 1;
  const total = Math.min(MAX_SLICES, Math.ceil((lastTop - from) / step) + 1);
  for (let y = from; ; y += step) {
    const target = Math.min(y, lastTop);
    await closeEmailPopup(page).catch(() => {});
    const actual = await scrollToY(page, target);
    i++;
    const file = `${prefix}-${pad(i)}.png`;
    await page.screenshot({ path: rec.abs(file) });
    rec.add(file, prefix, `${label}: viewport slice ${i - startIndex + 1}/${total}, scrollY ${actual}-${actual + vh} of ${docH} CSS px`);
    if (target >= lastTop || i - startIndex + 1 >= MAX_SLICES) break;
  }
  return i;
}

async function fullPage(page, rec, prefix, label, mobile) {
  await closeEmailPopup(page).catch(() => {});
  await scrollToY(page, 0);
  const file = `${prefix}-full.png`;
  await page.screenshot({ path: rec.abs(file), fullPage: true, scale: mobile ? 'css' : 'device' });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  rec.add(file, prefix, `${label}: full-page image (${h} CSS px tall${mobile ? ', saved at CSS scale 1x' : ''})`);
}

/** Screenshot an element by its page box (fullPage clip, so it works for elements taller than the viewport). */
async function clipElement(page, rec, file, prefix, shows, box, mobile) {
  const vw = page.viewportSize().width;
  const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(vw, box.w), height: Math.max(1, box.h) };
  await page.screenshot({ path: rec.abs(file), fullPage: true, clip, scale: mobile ? 'css' : 'device' });
  rec.add(file, prefix, shows);
}

async function pageBox(page, selectorOrFn) {
  return page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().height > 0);
    if (!els.length) return null;
    const rs = els.map((e) => e.getBoundingClientRect());
    const top = Math.min(...rs.map((r) => r.top)) + scrollY;
    const bottom = Math.max(...rs.map((r) => r.bottom)) + scrollY;
    const left = Math.min(...rs.map((r) => r.left));
    const right = Math.max(...rs.map((r) => r.right));
    return { x: Math.round(left), y: Math.round(top), w: Math.round(right - left), h: Math.round(bottom - top) };
  }, selectorOrFn);
}

/** Slice + full + outline for an overlay (drawer / menu) whose content may scroll internally. */
async function captureOverlay(page, rec, prefix, label, rootSelector, startIndex, mobile) {
  const info = await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return null;
    let best = null;
    for (const el of [root, ...root.querySelectorAll('*')]) {
      const s = getComputedStyle(el);
      const extra = el.scrollHeight - el.clientHeight;
      if (extra > 10 && /(auto|scroll)/.test(s.overflowY) && el.clientHeight > 0 && (!best || extra > best.extra)) best = { el, extra };
    }
    if (best) { best.el.setAttribute('data-capture-scroll', '1'); }
    return best ? { extra: best.extra, client: best.el.clientHeight } : { extra: 0, client: 0 };
  }, rootSelector);
  if (!info) { rec.note(`${label}: overlay root ${rootSelector} not found`); return startIndex - 1; }
  let i = startIndex - 1;
  const step = Math.max(200, Math.round(info.client * 0.9));
  let pos = 0;
  for (;;) {
    await page.evaluate((p) => { const s = document.querySelector('[data-capture-scroll="1"]'); if (s) s.scrollTop = p; }, pos);
    await page.waitForTimeout(450);
    i++;
    const file = `${prefix}-${pad(i)}.png`;
    await page.screenshot({ path: rec.abs(file) });
    rec.add(file, prefix, `${label}: viewport${info.extra ? `, inner scroll ${pos}/${info.extra}px` : ''}`);
    if (pos >= info.extra || i - startIndex + 1 >= MAX_SLICES) break;
    pos = Math.min(info.extra, pos + step);
  }
  await page.evaluate(() => { const s = document.querySelector('[data-capture-scroll="1"]'); if (s) s.scrollTop = 0; });
  // Full image: temporarily make the viewport tall enough that the overlay content no longer scrolls.
  const vp = page.viewportSize();
  try {
    if (info.extra > 0) {
      await page.setViewportSize({ width: vp.width, height: Math.min(vp.height + info.extra + 40, 6000) });
      await page.waitForTimeout(700);
    }
    const box = await page.evaluate((sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return { x: Math.round(Math.max(0, r.left)), y: Math.round(Math.max(0, r.top)), w: Math.round(Math.min(innerWidth, r.right) - Math.max(0, r.left)), h: Math.round(Math.min(innerHeight, r.bottom) - Math.max(0, r.top)) };
    }, rootSelector);
    const file = `${prefix}-full.png`;
    if (box && box.w > 0 && box.h > 0) {
      await page.screenshot({ path: rec.abs(file), clip: { x: box.x, y: box.y, width: box.w, height: box.h }, scale: mobile ? 'css' : 'device' });
      rec.add(file, prefix, `${label}: complete overlay panel, unscrolled (viewport temporarily enlarged)`);
    }
  } finally {
    await page.setViewportSize(vp);
    await page.waitForTimeout(400);
  }
  return i;
}

// ---------------------------------------------------------------------------
// Capture steps
// ---------------------------------------------------------------------------

async function capturePopupAndHome(page, rec, mobile) {
  const t0 = Date.now();
  rec.urls.home = `${BASE}/`;
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(3000);
  let n = 0;
  // First impression for a new visitor, before any choice is made.
  await page.screenshot({ path: rec.abs(`popup-${pad(++n)}.png`) });
  rec.add(`popup-${pad(n)}.png`, 'popup', `First impression ~3 s after load, before any click: cookie banner${(await isVisible(popupCloseLocator(page))) ? ' + email popup' : ''} as a new visitor sees it`);

  const cookieAction = await declineCookies(page);
  rec.note(`Cookie banner: ${cookieAction}`);

  // Wait until ~12 s after load, polling for an email/reward popup.
  let popupAt = null;
  while (Date.now() - t0 < POPUP_WAIT_MS) {
    if (!popupAt && (await isVisible(popupCloseLocator(page)))) popupAt = Date.now() - t0;
    await page.waitForTimeout(500);
  }
  if (!popupAt && (await isVisible(popupCloseLocator(page)))) popupAt = Date.now() - t0;
  await page.screenshot({ path: rec.abs(`popup-${pad(++n)}.png`) });
  rec.add(`popup-${pad(n)}.png`, 'popup', `~12 s after load, cookies declined: ${popupAt ? `email/discount popup open (first seen by ~${Math.round(popupAt / 1000)} s)` : 'no email popup visible'}, plus any floating pills/chat bubble`);

  const popupOutline = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Close dialog"], .klaviyo-close-form');
    if (!btn) return null;
    let el = btn.parentElement;
    while (el && el !== document.body) {
      const r = el.getBoundingClientRect();
      if (r.height >= 250 && r.width >= 250 && r.width * r.height < innerWidth * innerHeight * 0.95) break;
      el = el.parentElement;
    }
    if (!el || el === document.body) return null;
    const r = el.getBoundingClientRect();
    const inputs = [...el.querySelectorAll('input:not([type=hidden])')].map((i) => ({ type: i.type, placeholder: i.placeholder || null }));
    const buttons = [...el.querySelectorAll('button')].map((b) => ({ text: (b.innerText || '').trim().slice(0, 60), aria: b.getAttribute('aria-label') }));
    const imgs = el.querySelectorAll('img').length;
    const layout = [...el.querySelectorAll('*')].filter((c) => c.children.length >= 2).slice(0, 1).map((c) => getComputedStyle(c).display);
    return { box: { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }, viewportBox: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }, class: String(el.className).slice(0, 120), inputs, buttons, images: imgs, firstLayoutDisplay: layout[0] || null, headingsAndText: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200) };
  });
  if (popupOutline) {
    const vb = popupOutline.viewportBox;
    await page.screenshot({ path: rec.abs('popup-full.png'), clip: { x: Math.max(0, vb.x), y: Math.max(0, vb.y), width: vb.w, height: vb.h } });
    rec.add('popup-full.png', 'popup', 'Email/discount popup card only (cropped to the dialog)');
  }
  const floatingNow = await page.evaluate(outlineInPage, { label: 'popup-state' });
  await rec.json('popup-outline.json', 'popup', { popupAppearedAfterMs: popupAt, cookieAction, popup: popupOutline, floatingElements: floatingNow.floating }, 'Popup structure: timing, inputs/buttons, card size, and all fixed/sticky floating elements at that moment');

  // Close the popup with its close (X) button, never the submit.
  const closed = await closeEmailPopup(page);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: rec.abs(`popup-${pad(++n)}.png`) });
  rec.add(`popup-${pad(n)}.png`, 'popup', `After closing the popup with its X button${closed ? '' : ' (no popup was open)'}: shows any teaser pill / chat bubble / floating elements that remain`);

  if (!mobile) {
    // Exit intent: move the mouse into the page, then up and out of the top edge.
    await page.mouse.move(720, 400);
    await page.waitForTimeout(500);
    await page.mouse.move(720, 5, { steps: 12 });
    await page.mouse.move(720, -5, { steps: 2 }).catch(() => {});
    await page.evaluate(() => {
      const ev = new MouseEvent('mouseout', { bubbles: true, clientX: 720, clientY: -2, relatedTarget: null });
      document.dispatchEvent(ev);
      document.documentElement.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false, clientX: 720, clientY: -2 }));
    });
    await page.waitForTimeout(3000);
    const reopened = await isVisible(popupCloseLocator(page));
    await page.screenshot({ path: rec.abs(`popup-${pad(++n)}.png`) });
    rec.add(`popup-${pad(n)}.png`, 'popup', `Desktop exit-intent attempt (mouse moved out of the top edge): ${reopened ? 'a popup re-appeared' : 'no new popup appeared'}`);
    rec.note(`Exit intent on desktop: ${reopened ? 'popup re-appeared' : 'no popup re-appeared after the first one was closed'}`);
    if (reopened) await closeEmailPopup(page);
    await page.mouse.move(720, 450);
  }

  // Homepage itself.
  await settle(page, 500);
  await lazyScroll(page);
  await dismissOverlays(page);
  await slicePage(page, rec, 'home', 'Homepage');
  await fullPage(page, rec, 'home', 'Homepage', mobile);
  await rec.json('home-outline.json', 'home', await page.evaluate(outlineInPage, { label: 'home' }), 'Homepage DOM outline: header group, every main section in order, footer group (boxes, headings, counts, carousel/accordion/tab/dialog patterns)');
}

async function captureFooter(page, rec, mobile) {
  const box = await pageBox(page, '.shopify-section-group-footer-group');
  const fb = box || (await pageBox(page, 'footer'));
  if (!fb) { rec.note('Footer not found'); return; }
  await slicePage(page, rec, 'footer', 'Footer (homepage)', Math.max(0, fb.y - 40), fb.y + fb.h);
  await clipElement(page, rec, 'footer-full.png', 'footer', `Footer group cropped (y ${fb.y}, ${fb.h} CSS px tall)`, fb, mobile);
  const outline = await page.evaluate(outlineInPage, { label: 'footer' });
  outline.blocks = outline.blocks.filter((b) => b.region === 'footer');
  await rec.json('footer-outline.json', 'footer', outline, 'Footer DOM outline: each footer-group section with columns, links, forms');
}

async function captureQuiz(page, rec, mobile) {
  // Prefer a dedicated quiz page if the nav/home links to one; otherwise use the inline homepage section.
  const quizLink = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href]')].find((x) => /quiz|finder/i.test(x.getAttribute('href')));
    return a ? new URL(a.getAttribute('href'), location.href).href : null;
  });
  if (quizLink) {
    rec.urls.quiz = quizLink;
    await gotoPage(page, quizLink);
    await dismissOverlays(page);
    await lazyScroll(page);
    await slicePage(page, rec, 'quiz', 'Quiz page');
    await fullPage(page, rec, 'quiz', 'Quiz page', mobile);
    await rec.json('quiz-outline.json', 'quiz', await page.evaluate(outlineInPage, { label: 'quiz' }), 'Quiz page DOM outline');
    return;
  }
  const secId = await page.evaluate(() => {
    const q = document.querySelector('[id*="quiz" i], [class*="quiz" i], [id*="finder" i], [class*="finder" i]');
    const sec = q && (q.closest('.shopify-section') || q);
    return sec ? sec.id || null : null;
  });
  if (!secId) { rec.note('Quiz: no quiz link and no quiz section found'); return; }
  rec.urls.quiz = `${BASE}/ (inline homepage section #${secId}; there is no separate quiz page/link)`;
  const sel = `#${CSS_escape(secId)}`;
  let box = await pageBox(page, sel);
  if (!box) { rec.note(`Quiz: section ${sel} has no visible box`); return; }
  const vh = page.viewportSize().height;
  let i = 0;
  await scrollToY(page, Math.max(0, box.y - 80));
  await page.screenshot({ path: rec.abs(`quiz-${pad(++i)}.png`) });
  rec.add(`quiz-${pad(i)}.png`, 'quiz', 'Lash-finder quiz block on the homepage, intro state (before start)');
  if (box.h > vh * 0.9) {
    i = await slicePage(page, rec, 'quiz', 'Quiz block intro (continued)', box.y - 80 + Math.round(vh * 0.9), box.y + box.h, i + 1);
  }
  await clipElement(page, rec, 'quiz-full.png', 'quiz', 'Quiz block cropped, intro state', box, mobile);
  const before = await page.evaluate(outlineInPage, { rootSelector: sel, label: 'quiz-intro' });
  const steps = await page.evaluate((s) => {
    const sec = document.querySelector(s);
    const isVis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const cands = [...sec.querySelectorAll('[data-step], [class*="step" i], [class*="question" i], [class*="screen" i], [class*="result" i]')]
      .filter((el) => /(^|[\s_-])(step|question|screen|result)s?($|[\s_-]|\d)/i.test(String(el.className)) || el.hasAttribute('data-step'));
    const top = cands.filter((el) => !cands.some((o) => o !== el && o.contains(el)));
    return top.map((el) => ({
      tag: el.tagName.toLowerCase(), class: String(el.className).slice(0, 100), dataStep: el.getAttribute('data-step'), visibleNow: isVis(el),
      heading: ((el.querySelector('h1,h2,h3,h4,legend,[class*="title" i]') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
      options: el.querySelectorAll('button, [role="radio"], input[type="radio"], input[type="checkbox"], label').length,
      images: el.querySelectorAll('img').length,
      hasEmailField: !!el.querySelector('input[type="email"]'),
      hasProgress: !!el.querySelector('progress, [role="progressbar"], [class*="progress" i]'),
    }));
  }, sel);
  // Start the quiz (no answers are chosen, nothing is filled in).
  const start = page.locator(`${sel} [data-action="start"], ${sel} button:has-text("START")`).first();
  let started = false;
  if (await isVisible(start)) {
    await start.click();
    await page.waitForTimeout(1500);
    started = true;
    box = await pageBox(page, sel);
    await scrollToY(page, Math.max(0, box.y - 80));
    await page.screenshot({ path: rec.abs(`quiz-${pad(++i)}.png`) });
    rec.add(`quiz-${pad(i)}.png`, 'quiz', 'Quiz after clicking START: first question screen (no answer chosen)');
    if (box.h > vh * 0.9) {
      i = await slicePage(page, rec, 'quiz', 'Quiz first question (continued)', box.y - 80 + Math.round(vh * 0.9), box.y + box.h, i + 1);
    }
  } else {
    rec.note('Quiz: start button not found/visible');
  }
  const after = started ? await page.evaluate(outlineInPage, { rootSelector: sel, label: 'quiz-started' }) : null;
  await rec.json('quiz-outline.json', 'quiz', { section: sel, introOutline: before, startedOutline: after, stepsInDom: steps }, 'Quiz block outline: intro and first-question states plus every quiz step found in the DOM (heading, option count, email field, progress)');
}

function CSS_escape(s) {
  return s.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}

async function captureMenu(page, rec, mobile) {
  await gotoPage(page, `${BASE}/`);
  await dismissOverlays(page);
  await scrollToY(page, 0);
  let i = 0;
  if (mobile) {
    const burger = page.locator('header-drawer summary, summary.header__icon--menu, button[aria-label*="menu" i], [aria-controls*="menu" i]').first();
    if (!(await isVisible(burger))) { rec.note('Mobile menu: hamburger not found'); return; }
    await burger.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: rec.abs(`menu-${pad(++i)}.png`) });
    rec.add(`menu-${pad(i)}.png`, 'menu', 'Mobile hamburger menu open (top level)');
    const drawerSel = (await page.locator('#menu-drawer').count()) ? '#menu-drawer' : '.menu-drawer';
    const outlineTop = await page.evaluate(outlineInPage, { rootSelector: drawerSel, label: 'mobile-menu' });
    const subs = page.locator(`${drawerSel} details > summary`);
    const subCount = await subs.count();
    const subStates = [];
    for (let k = 0; k < subCount; k++) {
      const s = subs.nth(k);
      if (!(await s.isVisible().catch(() => false))) continue;
      const name = ((await s.innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ');
      await s.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: rec.abs(`menu-${pad(++i)}.png`) });
      rec.add(`menu-${pad(i)}.png`, 'menu', `Mobile menu: submenu "${name}" opened (slides in)`);
      subStates.push(await page.evaluate(outlineInPage, { rootSelector: drawerSel, label: `mobile-menu-sub-${name}` }));
      // Back to the top level.
      const back = page.locator(`${drawerSel} details[open] .menu-drawer__close-button, ${drawerSel} details[open] button[aria-label*="terug" i], ${drawerSel} details[open] button[aria-label*="back" i]`).first();
      if (await isVisible(back)) await back.click();
      else await s.click().catch(() => {});
      await page.waitForTimeout(900);
    }
    i = await captureOverlay(page, rec, 'menu', 'Mobile menu drawer (top level)', drawerSel, i + 1, mobile);
    await rec.json('menu-outline.json', 'menu', { type: 'mobile drawer', drawerSelector: drawerSel, topLevel: outlineTop, submenus: subStates }, 'Mobile menu outline: drawer structure, top-level items, each submenu');
    await page.keyboard.press('Escape').catch(() => {});
    return;
  }
  // Desktop: hover (and if needed click) every top-level nav item that has a submenu.
  const items = page.locator('header details:not(#Details-menu-drawer-container):not([id^="Details-menu-drawer"]) > summary');
  const count = await items.count();
  const states = [];
  let fullSaved = false;
  for (let k = 0; k < count; k++) {
    const s = items.nth(k);
    if (!(await s.isVisible().catch(() => false))) continue;
    const name = ((await s.innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ');
    if (!name) continue;
    await s.hover();
    await page.waitForTimeout(800);
    let open = await s.evaluate((el) => el.parentElement.hasAttribute('open'));
    let how = 'hover';
    if (!open) {
      await s.click();
      await page.waitForTimeout(800);
      open = await s.evaluate((el) => el.parentElement.hasAttribute('open'));
      how = 'click';
    }
    await page.screenshot({ path: rec.abs(`menu-${pad(++i)}.png`) });
    rec.add(`menu-${pad(i)}.png`, 'menu', `Desktop nav: submenu "${name}" ${open ? `open (opened on ${how})` : 'did not open'}`);
    const sub = await s.evaluate((el) => {
      const d = el.parentElement;
      const panel = d.querySelector('ul, .mega-menu__content, [class*="submenu" i], [class*="dropdown" i]');
      const r = panel ? panel.getBoundingClientRect() : null;
      return {
        summary: el.innerText.trim(), detailsId: d.id, open: d.hasAttribute('open'),
        panelClass: panel ? String(panel.className).slice(0, 100) : null,
        panelBox: r ? { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) } : null,
        mega: !!d.querySelector('.mega-menu, [class*="mega" i]'),
        links: [...d.querySelectorAll('a[href]')].map((a) => ({ text: a.innerText.trim().replace(/\s+/g, ' ').slice(0, 60), href: a.getAttribute('href') })),
        images: d.querySelectorAll('img').length,
        nestedLevels: d.querySelectorAll('details details, ul ul').length,
      };
    });
    sub.openedOn = how;
    states.push(sub);
    if (open && !fullSaved) {
      fullSaved = true;
      const h = Math.min(900, (sub.panelBox ? sub.panelBox.y + sub.panelBox.h : 400) + 60);
      await page.screenshot({ path: rec.abs('menu-full.png'), clip: { x: 0, y: 0, width: 1440, height: h } });
      rec.add('menu-full.png', 'menu', `Desktop header + first dropdown ("${name}") cropped to the menu area`);
    }
    // Close again.
    if (await s.evaluate((el) => el.parentElement.hasAttribute('open'))) {
      await s.click().catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
    }
    await page.mouse.move(720, 600);
    await page.waitForTimeout(600);
  }
  const nav = await page.evaluate(() => {
    const navEl = document.querySelector('header nav, .header__inline-menu');
    if (!navEl) return null;
    const top = [...navEl.querySelectorAll(':scope > ul > li, :scope ul.list-menu--inline > li')];
    return top.map((li) => ({ text: li.innerText.split('\n')[0].trim(), hasSubmenu: !!li.querySelector('details, ul ul, ul'), href: (li.querySelector('a[href]') || {}).getAttribute?.('href') || null }));
  });
  const header = await page.evaluate(outlineInPage, { label: 'desktop-header' });
  await rec.json('menu-outline.json', 'menu', { type: 'desktop inline nav with dropdowns', topLevelItems: nav, submenus: states, headerBlocks: header.blocks.filter((b) => b.region === 'header') }, 'Desktop nav outline: top-level items in order, which have dropdowns, how they open, links per dropdown, header blocks');
}

async function discoverCollection(page) {
  return page.evaluate(() => {
    const links = [...document.querySelectorAll('header a[href*="/collections/"], .menu-drawer a[href*="/collections/"], nav a[href*="/collections/"]')]
      .map((a) => new URL(a.getAttribute('href'), location.href))
      .filter((u) => u.hostname === location.hostname && !/\/collections\/all\/?$/.test(u.pathname) && !u.hash);
    return links.length ? links[0].origin + links[0].pathname : null;
  });
}

async function captureCollection(page, rec, mobile, url) {
  rec.urls.collection = url;
  await gotoPage(page, url);
  await dismissOverlays(page);
  await lazyScroll(page);
  await dismissOverlays(page);
  await slicePage(page, rec, 'collection', 'Collection page');
  await fullPage(page, rec, 'collection', 'Collection page', mobile);
  await rec.json('collection-outline.json', 'collection', await page.evaluate(outlineInPage, { label: 'collection' }), 'Collection page DOM outline (banner, filters/sort, product grid, cards)');
  return page.evaluate(() => {
    const a = [...document.querySelectorAll('main a[href*="/products/"]')].map((x) => new URL(x.getAttribute('href'), location.href)).find((u) => u.hostname === location.hostname);
    return a ? a.origin + a.pathname : null;
  });
}

async function captureProductAndCart(page, rec, mobile, url) {
  rec.urls.product = url;
  await gotoPage(page, url);
  await dismissOverlays(page);
  await lazyScroll(page);
  await dismissOverlays(page);
  await slicePage(page, rec, 'product', 'Product page');
  await fullPage(page, rec, 'product', 'Product page', mobile);
  await rec.json('product-outline.json', 'product', await page.evaluate(outlineInPage, { label: 'product' }), 'Product page DOM outline (gallery, buy box, bundle selector, accordions, related, reviews)');

  // Add one product to the cart to see the drawer. Never go to checkout.
  await scrollToY(page, 0);
  const addBtn = page.locator('main form[action*="/cart/add"] button[name="add"], main form[action*="/cart/add"] button[type="submit"], main product-form button[type="submit"]').filter({ visible: true }).first();
  if (!(await isVisible(addBtn))) { rec.note('Cart: add-to-cart button not found'); return; }
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();
  await page.waitForTimeout(3000);
  if (/\/cart(\?|$)/.test(new URL(page.url()).pathname)) {
    rec.note('Cart: add-to-cart redirected to /cart (no drawer)');
    await slicePage(page, rec, 'cart', 'Cart page');
    await fullPage(page, rec, 'cart', 'Cart page', mobile);
    await rec.json('cart-outline.json', 'cart', await page.evaluate(outlineInPage, { label: 'cart' }), 'Cart page DOM outline');
    return;
  }
  const drawerSel = await page.evaluate(() => {
    const cands = ['cart-drawer', '#CartDrawer', 'cart-notification', '[class*="cart-drawer" i]', '[id*="cart-drawer" i]'];
    for (const c of cands) {
      const el = document.querySelector(c);
      if (el) {
        const inner = el.querySelector('.drawer__inner') || el;
        const r = inner.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.left < innerWidth) return c;
      }
    }
    return null;
  });
  if (!drawerSel) {
    rec.note('Cart: no drawer detected after add-to-cart; captured viewport only');
    await page.screenshot({ path: rec.abs('cart-01.png') });
    rec.add('cart-01.png', 'cart', 'Viewport right after add-to-cart (no drawer detected)');
    return;
  }
  const innerSel = (await page.locator(`${drawerSel} .drawer__inner`).count()) ? `${drawerSel} .drawer__inner` : drawerSel;
  await captureOverlay(page, rec, 'cart', 'Cart drawer after adding one product', innerSel, 1, mobile);
  await rec.json('cart-outline.json', 'cart', await page.evaluate(outlineInPage, { rootSelector: innerSel, label: 'cart-drawer' }), 'Cart drawer DOM outline: header, progress/shipping bar, line items, upsells, totals, checkout button');
}

// ---------------------------------------------------------------------------
// INDEX.md
// ---------------------------------------------------------------------------

async function writeIndex(results) {
  const lines = [];
  lines.push('# Referentie-captures: lashthing.nl');
  lines.push('');
  lines.push(`Gemaakt op ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC met \`node scripts/capture-reference.mjs\` (Playwright, Chromium headless).`);
  lines.push('');
  lines.push('**Alleen voor structuuranalyse** (brief §2 regel 1 en §8): neem structuur, sectievolgorde, flow en interactiepatronen over, nooit teksten, beeld, logo\'s, iconen, code, CSS of kleuren. Deze map staat in `.gitignore` en hoort nooit in `public/`.');
  lines.push('');
  lines.push('Werkwijze: cookiebanner altijd geweigerd (Voorkeuren > Reject All), geen formulier ingevuld, geen e-mail ingevoerd, niet naar de checkout. Eén product in de winkelwagen gelegd (wegwerp-browsercontext) om de cart drawer te zien. Vóór het slicen is elke pagina langzaam naar onder en terug gescrold voor lazy loading.');
  lines.push('');
  lines.push('Bestanden per viewport: `<prefix>-NN.png` = viewport-slices (stap ~90% van de viewporthoogte), `<prefix>-full.png` = één volledige afbeelding, `<prefix>-outline.json` = DOM-outline (per blok: tag, id/class, box, h1-h3, aantallen links/knoppen/afbeeldingen, carrousel/accordion/tab/dialog-patronen, layout-kinderen, zwevende elementen).');
  lines.push('');
  for (const r of results) {
    lines.push(`## ${r.viewport} (${r.viewport === 'mobile' ? '390x844, DPR 2, isMobile, touch, mobiele Chrome-UA' : '1440x900, DPR 1, desktop Chrome-UA'})`);
    lines.push('');
    lines.push('Gebruikte URL\'s:');
    for (const [k, v] of Object.entries(r.urls)) lines.push(`- ${k}: ${v}`);
    lines.push('');
    if (r.notes.length) {
      lines.push('Notities:');
      for (const n of r.notes) lines.push(`- ${n}`);
      lines.push('');
    }
    lines.push('| Bestand | Prefix | Wat het toont |');
    lines.push('| --- | --- | --- |');
    for (const f of r.files) lines.push(`| \`lashthing/${r.viewport}/${f.file}\` | ${f.prefix} | ${f.shows.replace(/\|/g, '/')} |`);
    lines.push('');
  }
  await fs.writeFile(path.join(REF_DIR, 'INDEX.md'), lines.join('\n'), 'utf8');
  await fs.writeFile(path.join(SITE_DIR, 'manifest.json'), JSON.stringify(results, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runViewport(browser, name) {
  const cfg = VIEWPORTS[name];
  const dir = path.join(SITE_DIR, name);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const rec = new Recorder(name, dir);
  const mobile = cfg.isMobile;
  const context = await browser.newContext({
    ...cfg,
    locale: 'nl-NL',
    timezoneId: 'Europe/Amsterdam',
    colorScheme: 'light',
    extraHTTPHeaders: { 'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8' },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);

  const step = async (label, fn) => {
    log(`[${name}] ${label}`);
    try { await fn(); } catch (err) { rec.note(`${label} failed: ${err && err.message ? err.message.split('\n')[0] : err}`); }
  };

  await step('popup + homepage', () => capturePopupAndHome(page, rec, mobile));
  await step('footer', () => captureFooter(page, rec, mobile));
  await step('quiz', async () => {
    if (!page.url().startsWith(BASE)) await gotoPage(page, `${BASE}/`);
    await dismissOverlays(page);
    await lazyScroll(page);
    await captureQuiz(page, rec, mobile);
  });
  await step('menu', () => captureMenu(page, rec, mobile));
  let collectionUrl = null;
  await step('discover collection', async () => {
    await gotoPage(page, `${BASE}/`);
    await dismissOverlays(page);
    collectionUrl = await discoverCollection(page);
    if (!collectionUrl) throw new Error('no /collections/ link found in nav');
  });
  let productUrl = null;
  if (collectionUrl) await step('collection', async () => { productUrl = await captureCollection(page, rec, mobile, collectionUrl); });
  if (productUrl) await step('product + cart', () => captureProductAndCart(page, rec, mobile, productUrl));
  else rec.note('Product: no /products/ link discovered on the collection page');

  await context.close();
  return { viewport: name, urls: rec.urls, notes: rec.notes, files: rec.files };
}

async function main() {
  await fs.mkdir(SITE_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled', '--lang=nl-NL'] });
  const results = [];
  // Keep results of a viewport that is not re-run this time.
  try {
    const prev = JSON.parse(await fs.readFile(path.join(SITE_DIR, 'manifest.json'), 'utf8'));
    for (const r of prev) if (!selected.includes(r.viewport)) results.push(r);
  } catch { /* first run */ }
  try {
    for (const name of selected) {
      if (!VIEWPORTS[name]) throw new Error(`unknown viewport ${name}`);
      results.push(await runViewport(browser, name));
      results.sort((a, b) => a.viewport.localeCompare(b.viewport));
      await writeIndex(results);
    }
  } finally {
    await browser.close();
  }
  for (const r of results) {
    log(`${r.viewport}: ${r.files.length} files`);
    for (const n of r.notes) log(`  - ${n}`);
  }
  log(`INDEX: ${path.join(REF_DIR, 'INDEX.md')}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
