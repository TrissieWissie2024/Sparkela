// capture-reference.mjs: screenshots and structural outlines of a reference shop
// (SPARKELA-BRIEF §6 and §8, phase 1).
//
// Usage, from the app directory (sparkela/):
//   node scripts/capture-reference.mjs                      # lashthing.nl, both viewports
//   node scripts/capture-reference.mjs --site=corvane       # CORVANE on http://localhost:3200
//   node scripts/capture-reference.mjs --site=corvane --base=http://localhost:3000 --only=mobile
//   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/capture-reference.mjs ...
// PW_CHROMIUM_PATH points at a Chromium binary; without it Playwright uses its own browser.
//
// Output: reference/<site>/<mobile|desktop>/NN-<state>.png, one <page>.structure.json per page
// or overlay, and reference/<site>/manifest.json (URLs, files, warnings, blockedHosts).
//
// Rules this script follows (brief §2.1 and §8):
// - Structure only. The JSON holds boxes, spacing and counts. Labels may contain up to 32 chars of
//   aria-label, id or heading text: on a reference site that is their copy, so labels are for
//   orientation only, never copy them into docs/ or content/. Nothing from a reference (text,
//   images, logos, icons, CSS, code) goes into Sparkela.
// - reference/ is gitignored: screenshots are never committed and never go into public/.
// - Cookie banners: always the most privacy-preserving choice (reject / only necessary). A
//   preferences panel is saved only when every optional toggle is already off. A consent banner
//   that is still visible afterwards is a warning in the manifest.
// - Never fills in a form, never types an email, never opens the checkout. Apart from the consent
//   buttons above, the only submit is the single add-to-cart click in the throwaway cart context.
//   As a safety net, checkout URLs and non-GET sign-up/contact/login requests are blocked at the
//   network level.
// - The cart drawer is captured in a throwaway browser context with exactly one item added.
// - Popups are waited for and closed with their close button; quizzes are opened, never answered.
// - Failed requests (for example a third-party host that the network policy blocks) are recorded
//   per page under blockedHosts in the manifest: a block whose script never loaded is unknown, not
//   absent.

import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Per-site settings. Paths left null are discovered from the page. `hints` go before the generic selectors. */
const SITES = {
  lashthing: { base: 'https://lashthing.nl', collection: null, product: null, quiz: null, hints: {} },
  corvane: {
    base: 'http://localhost:3200',
    collection: '/collections/all',
    product: '/products/north-swell',
    quiz: '/',
    hints: {
      quizSection: ['#scent-finder'],
      pill: ['.fixed:has(button[aria-label="Hide this offer"])'],
      popup: ['[role="dialog"]:has(button[aria-label="Close"])'],
    },
  },
};

/** Generic selectors, tried in order (first visible match wins). */
const SELECTORS = {
  menuButton: ['button[aria-label*="menu" i]:not([aria-label*="close" i]):not([aria-label*="sluit" i])', 'header-drawer summary', 'summary[aria-label*="menu" i]', 'header [aria-controls*="menu" i]'],
  navTrigger: ['header nav details > summary', 'header nav [aria-haspopup="true"]', 'header nav button[aria-expanded]', 'header nav a[href]'],
  overlay: ['[role="dialog"][aria-modal="true"]', '[role="dialog"]', 'dialog[open]', 'cart-drawer.active .drawer__inner', '#CartDrawer', '.menu-drawer'],
  close: ['button[aria-label*="close" i]', 'button[aria-label*="sluit" i]', '.klaviyo-close-form', '.drawer__close'],
  popup: ['div[role="dialog"].needsclick', '.klaviyo-form [role="dialog"]', '[role="dialog"][aria-modal="true"]'],
  pill: ['.kl-teaser', '[class*="teaser" i]'],
  addToCart: ['main form[action*="/cart/add"] [type="submit"]', 'main product-form button[type="submit"]', 'role=button[name=/^(add to cart|in (de )?winkelwagen|toevoegen)/i]'],
  cartButton: ['header button[aria-label*="cart" i]', 'header button[aria-label*="winkelwagen" i]', 'header #cart-icon-bubble'],
  quizSection: ['[id*="quiz" i]', '[class*="quiz" i]', '[id*="finder" i]'],
  quizStart: ['[data-action="start"]', 'role=button[name=/^(start|begin)/i]'],
  footer: ['body > footer', 'footer', '.shopify-section-group-footer-group'],
};
// Cookie consent. Unanchored, tried in order: an explicit reject first ("Weiger alles", "Alles afwijzen",
// "Reject all cookies"), then "only necessary" ("Alleen noodzakelijke", "Use necessary cookies only").
const COOKIE_REJECT = [
  /\b(weiger(en)?|afwijzen)\b|\b(reject|decline|deny|refuse)\b/i,
  /\balleen\s+(strikt\s+)?(noodzakelijke?|essenti|functione)|^\s*(strikt\s+)?noodzakelijke\s+cookies\s*$|\bonly\s+(strictly\s+)?(necessary|essential|required)\b|\b(necessary|essential|required)(\s+cookies)?\s+only\b/i,
];
const COOKIE_PREFS = /voorkeur|instelling|aanpassen|beheren|preferences|settings|customi[sz]e|manage|options/i;
const COOKIE_SAVE = /opslaan|bewaren|bevestig|save|confirm|selectie|selection|mijn keuze|my choices/i;
const COOKIE_ALL = /\b(alle|alles|all)\b/i; // a save button that says "all" accepts everything: never clicked
/** Ids, classes and iframe URLs of consent banners (generic words plus common consent platforms). */
const CONSENT_HINT = /cookie|consent|gdpr|onetrust|cookiebot|didomi|usercentrics|iubenda|klaro|termly|osano|quantcast|trustarc|sourcepoint/i;
const BLOCK_ALWAYS = /\/checkouts?(\/|\?|$)/i;
const BLOCK_WRITES = /subscribe|newsletter|klaviyo|contact|login|register|\/account/i;
const blockedByUs = (request) => BLOCK_ALWAYS.test(request.url()) || (request.method() !== 'GET' && BLOCK_WRITES.test(request.url()));

const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};
const POPUP_WAIT_MS = 15_000;

const { values: args } = parseArgs({ options: { site: { type: 'string', default: 'lashthing' }, base: { type: 'string' }, only: { type: 'string' } } });
const SITE = SITES[args.site];
if (!SITE) throw new Error(`Unknown --site=${args.site} (use ${Object.keys(SITES).join(' or ')})`);
if (args.only && !VIEWPORTS[args.only]) throw new Error(`Unknown --only=${args.only} (use mobile or desktop)`);
const BASE = (args.base ?? SITE.base).replace(/\/$/, '');
const OUT = path.join(ROOT, 'reference', args.site);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...parts);
const sel = (key) => [...(SITE.hints[key] ?? []), ...(SELECTORS[key] ?? [])];
const abs = (href) => (href ? new URL(href, BASE).href : null);

// --- In-page outline (serialised into the browser, so it must be self-contained) ---

/** Structural outline of the page regions, or of one root element. Boxes and counts; labels cut to 32 chars. */
function outlineInPage(rootSelector) {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && r.bottom > -scrollY && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0;
  };
  const COUNTS = {
    h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', links: 'a[href]', buttons: 'button, [role="button"], summary', images: 'img, picture, video, svg[role="img"]',
    inputs: 'input:not([type="hidden"]), select, textarea', forms: 'form', dialogs: '[role="dialog"], dialog', expandables: 'details, [aria-expanded]',
  };
  const px = (v) => Math.round(parseFloat(v) || 0);
  const rect = (el, page = true) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top + (page ? scrollY : 0)), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const label = (el) => (el.getAttribute('aria-label') || el.id || el.querySelector('h1, h2, h3, legend')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32) || null;
  const count = (el, s) => [...el.querySelectorAll(s)].filter(vis).length;
  const unwrap = (el) => {
    let node = el;
    for (let kids = [...node.children].filter(vis); kids.length === 1; kids = [...node.children].filter(vis)) node = kids[0];
    return node;
  };
  const describe = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const boxes = [...el.querySelectorAll('*')].filter((c) => !/^(img|video|svg|picture|path)$/i.test(c.tagName) && vis(c)).slice(0, 400);
    const wrap = [el, ...boxes].find((c) => /px$/.test(getComputedStyle(c).maxWidth));
    const grid = [el, ...boxes].find((c) => getComputedStyle(c).display.includes('grid') && [...c.children].filter(vis).length >= 2);
    const leaves = [...el.querySelectorAll('h1, h2, h3, h4, p, a, button, img, svg, input, select, video, li, table')].filter(vis).map((c) => c.getBoundingClientRect());
    const ws = wrap && getComputedStyle(wrap);
    const gs = grid && getComputedStyle(grid);
    return {
      tag: el.tagName.toLowerCase(),
      label: label(el),
      class: (el.getAttribute('class') || '').slice(0, 100) || null,
      box: rect(el),
      position: s.position,
      background: s.backgroundColor,
      radius: s.borderRadius,
      paddingY: [px(s.paddingTop), px(s.paddingBottom)],
      contentInset: leaves.length ? [Math.round(Math.min(...leaves.map((l) => l.top)) - r.top), Math.round(r.bottom - Math.max(...leaves.map((l) => l.bottom)))] : null,
      container: ws ? { maxWidth: ws.maxWidth, width: Math.round(wrap.getBoundingClientRect().width), paddingX: [px(ws.paddingLeft), px(ws.paddingRight)] } : null,
      grid: gs ? { columns: gs.gridTemplateColumns.split(' ').length, template: gs.gridTemplateColumns.slice(0, 80), gap: [px(gs.rowGap), px(gs.columnGap)] } : null,
      counts: Object.fromEntries(Object.entries(COUNTS).map(([key, s]) => [key, count(el, s)])),
    };
  };

  const floating = [];
  for (const el of document.body.querySelectorAll('*')) {
    const p = getComputedStyle(el).position;
    const r = el.getBoundingClientRect();
    if ((p === 'fixed' || p === 'sticky') && vis(el) && r.bottom > 0 && !floating.some((f) => f.el.contains(el))) floating.push({ el, p });
  }
  const meta = {
    path: location.pathname,
    viewport: { w: innerWidth, h: innerHeight },
    documentHeight: document.documentElement.scrollHeight,
    scrollY: Math.round(scrollY),
    fixedAndSticky: floating.slice(0, 20).map(({ el, p }) => ({ tag: el.tagName.toLowerCase(), label: label(el), class: (el.getAttribute('class') || '').slice(0, 60) || null, position: p, zIndex: getComputedStyle(el).zIndex, viewportBox: rect(el, false) })),
  };
  if (rootSelector) {
    const root = [...document.querySelectorAll(rootSelector)].find(vis);
    if (!root) return { ...meta, error: `root not found: ${rootSelector}` };
    return { ...meta, root: describe(root), children: [...unwrap(root).children].filter(vis).map(describe) };
  }
  const main = document.querySelector('main') || document.body;
  const siblings = main === document.body ? [] : [...main.parentElement.children].filter((el) => el !== main && vis(el) && getComputedStyle(el).position !== 'fixed' && !/^(script|style|noscript)$/i.test(el.tagName));
  return {
    ...meta,
    before: siblings.filter((el) => el.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).map(describe),
    main: [...unwrap(main).children].filter(vis).map(describe),
    after: siblings.filter((el) => el.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_PRECEDING).map(describe),
  };
}

/**
 * Marks the visible consent banners and dialogs of a document with data-capture-consent="<n>" and returns
 * how many there are. A consent root floats (fixed, sticky or a dialog, or inside a fixed or sticky
 * parent), is larger than a corner widget, has a button or link, has no email field (an email popup is not
 * a consent banner), and is named like one (id, class or aria-label) or talks about cookies or consent.
 */
function markConsentRoots(hintSource) {
  const hint = new RegExp(hintSource, 'i');
  for (const el of document.querySelectorAll('[data-capture-consent]')) el.removeAttribute('data-capture-consent');
  const floats = (el) => {
    for (let node = el; node && node !== document.body; node = node.parentElement) if (/fixed|sticky/.test(getComputedStyle(node).position)) return true;
    return false;
  };
  const roots = [];
  for (const el of document.body?.querySelectorAll('*') ?? []) {
    if (roots.some((root) => root.contains(el))) continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 20_000) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
    const dialog = el.tagName === 'DIALOG' || /^(dialog|alertdialog)$/.test(el.getAttribute('role') ?? '');
    if (!dialog && !floats(el)) continue;
    const text = el.textContent ?? '';
    const named = hint.test(`${el.id} ${el.getAttribute('class') ?? ''} ${el.getAttribute('aria-label') ?? ''}`);
    // Unnamed: the text itself must mention cookies, not just a link to the cookie policy (a sticky header).
    const mentions = (t) => (t.match(/cookie|consent|toestemming/gi) ?? []).length;
    const inLinks = () => [...el.querySelectorAll('a')].reduce((sum, a) => sum + mentions(a.textContent ?? ''), 0);
    if (!named && !(text.length < 4000 && !el.closest('header, nav') && mentions(text) > inLinks())) continue;
    if (!el.querySelector('button, [role="button"], a[href], input[type="submit"]') || el.querySelector('input[type="email"]')) continue;
    roots.push(el);
  }
  roots.forEach((el, i) => el.setAttribute('data-capture-consent', String(i)));
  return roots.length;
}

// --- Node-side helpers ---

/** First visible element for a list of selectors, polling until `timeout` ms. */
async function firstVisible(scope, selectors, timeout = 0) {
  const deadline = Date.now() + timeout;
  for (;;) {
    for (const s of selectors) {
      const loc = scope.locator(s);
      const n = Math.min(await loc.count().catch(() => 0), 12);
      for (let i = 0; i < n; i++) if (await loc.nth(i).isVisible().catch(() => false)) return loc.nth(i);
    }
    if (Date.now() >= deadline) return null;
    await sleep(300);
  }
}

async function open(page, url, rec) {
  log('  goto', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await rejectCookies(page, rec);
}

/** Consent banners in every frame, as locators; a consent-platform iframe counts as a whole. */
async function consentScopes(page) {
  const scopes = [];
  for (const frame of page.frames()) {
    const n = await frame.evaluate(markConsentRoots, CONSENT_HINT.source).catch(() => 0);
    for (let i = 0; i < n; i++) scopes.push(frame.locator(`[data-capture-consent="${i}"]`));
    if (n > 0 || frame === page.mainFrame() || !CONSENT_HINT.test(frame.url())) continue;
    const element = await frame.frameElement().catch(() => null);
    if (element && (await element.isVisible().catch(() => false))) scopes.push(frame.locator(':root'));
  }
  return scopes;
}

/**
 * Clicks the first visible button or link in `scopes` whose accessible name matches a pattern (patterns in
 * order) and that `ok` accepts. Never a link that navigates or a control inside a form with an email field.
 * Returns whether it clicked.
 */
async function clickMatching(scopes, patterns, ok = async () => true) {
  const safe = (loc) =>
    loc
      .evaluate((el) => {
        const href = el.tagName === 'A' ? (el.getAttribute('href') ?? '') : '#';
        const inEmailForm = el.closest('form, dialog, [role="dialog"]')?.querySelector('input[type="email"]');
        return /^(#|javascript:|$)/i.test(href) && !inEmailForm;
      })
      .catch(() => false);
  for (const pattern of patterns) {
    for (const scope of scopes) {
      for (const role of ['button', 'link']) {
        const candidates = scope.getByRole(role, { name: pattern });
        const n = Math.min(await candidates.count().catch(() => 0), 8);
        for (let i = 0; i < n; i++) {
          const el = candidates.nth(i);
          if (!(await el.isVisible().catch(() => false)) || !(await safe(el)) || !(await ok(el))) continue;
          if (await el.click({ timeout: 5000 }).then(() => true, () => false)) return true;
        }
      }
    }
  }
  return false;
}

/** Optional consent toggles that are on, over all scopes (disabled ones, such as "necessary", do not count). */
async function optionalTogglesOn(scopes) {
  let on = 0;
  for (const scope of scopes) {
    on += await scope
      .evaluate((root) =>
        [...root.querySelectorAll('input[type="checkbox"], [role="switch"], [role="checkbox"]')]
          .filter((t) => !t.disabled && t.getAttribute('aria-disabled') !== 'true')
          .filter((t) => t.checked === true || t.getAttribute('aria-checked') === 'true').length,
      )
      .catch(() => 0);
  }
  return on;
}

/**
 * Cookie banner: always the most privacy-preserving option. Reject or "only necessary" in the banner, else
 * anywhere in the page or its frames; else open the preferences and reject there, or save them only when
 * every optional toggle is already off. Warns when a consent banner is still visible afterwards.
 */
async function rejectCookies(page, rec) {
  const everywhere = () => page.frames().map((frame) => frame.locator(':root'));
  // A reject is never an expandable header (a "Noodzakelijke cookies" category in the preferences).
  const notToggle = (el) => el.evaluate((node) => !node.hasAttribute('aria-expanded')).catch(() => false);
  const notAll = (el) => el.evaluate((node, all) => !new RegExp(all, 'i').test(`${node.textContent} ${node.getAttribute('aria-label') ?? ''}`), COOKIE_ALL.source).catch(() => false);
  let scopes = await consentScopes(page);
  let clicked = (await clickMatching(scopes, COOKIE_REJECT, notToggle)) || (await clickMatching(everywhere(), COOKIE_REJECT, notToggle));
  let note = '';
  if (!clicked && scopes.length > 0 && (await clickMatching(scopes, [COOKIE_PREFS]))) {
    await page.waitForTimeout(800);
    scopes = await consentScopes(page);
    clicked = await clickMatching(scopes, COOKIE_REJECT, notToggle);
    if (!clicked) {
      const on = await optionalTogglesOn(scopes);
      if (on === 0) clicked = await clickMatching(scopes, [COOKIE_SAVE], notAll);
      else note = ` (${on} optional toggle(s) on in the preferences, so nothing was saved)`;
    }
  }
  if (clicked) await page.waitForTimeout(800);
  if ((await consentScopes(page)).length > 0) rec.warn(`cookie banner still visible on ${new URL(page.url()).pathname}, not rejected${note}`);
}

/** Close a popup or overlay with its own close button (never a submit), else Escape. */
async function closeOverlay(page, root) {
  const close = root ? await firstVisible(root, SELECTORS.close) : null;
  if (close) await close.click().catch(() => {});
  else await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(700);
}

/** Scroll down and back up in steps, so lazy images and scroll-triggered content load. */
async function lazyScroll(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 300) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function scrollTo(page, y) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await page.waitForTimeout(600);
}

/** CSS selector for a located element, via a data attribute (outlineInPage takes a selector). */
async function mark(locator, name) {
  await locator.evaluate((el, n) => el.setAttribute('data-capture', n), name);
  return `[data-capture="${name}"]`;
}

/** Run `fn` with fixed (and optionally sticky) elements hidden and focus dropped: for stitched shots. */
async function withoutFloating(page, positions, fn) {
  await page.evaluate((list) => {
    document.activeElement?.blur?.();
    for (const el of [...document.body.querySelectorAll('*')].filter((e) => list.includes(getComputedStyle(e).position))) {
      el.dataset.captureVisibility = el.style.visibility;
      el.style.visibility = 'hidden';
    }
  }, positions);
  try {
    return await fn();
  } finally {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-capture-visibility]')) {
        el.style.visibility = el.dataset.captureVisibility;
        el.removeAttribute('data-capture-visibility');
      }
    });
  }
}

function recorder(viewport, dir) {
  let n = 0;
  const rec = { files: [], warnings: [], urls: {}, blockedHosts: {} };
  rec.shot = async (target, name, options = {}) => {
    const file = `${String(n + 1).padStart(2, '0')}-${name}.png`;
    await target.screenshot({ path: path.join(dir, file), timeout: 30_000, ...options });
    n += 1;
    rec.files.push(file);
    log(`  saved ${viewport}/${file}`);
  };
  rec.json = async (name, data) => {
    await fs.writeFile(path.join(dir, `${name}.structure.json`), JSON.stringify(data, null, 2));
    rec.files.push(`${name}.structure.json`);
  };
  rec.warn = (message) => {
    if (rec.warnings.includes(message)) return; // e.g. the same banner on every visit of the homepage
    rec.warnings.push(message);
    log(`  WARN ${message}`);
  };
  /** A request that failed or got a 403: its host, per page path (the path of a failed navigation itself). */
  rec.blocked = (request, reason) => {
    if (!/^https?:/i.test(request.url())) return;
    let at;
    try {
      const frame = request.frame();
      at = new URL(request.isNavigationRequest() && !frame.parentFrame() ? request.url() : frame.page().url()).pathname;
    } catch {
      at = '(no page)'; // a service worker request has no frame
    }
    (rec.blockedHosts[at] ??= {})[new URL(request.url()).host] ??= reason;
  };
  return rec;
}

async function newContext(browser, name, rec) {
  const context = await browser.newContext({ ...VIEWPORTS[name], locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', colorScheme: 'light' });
  await context.route('**/*', (route) => (blockedByUs(route.request()) ? route.abort() : route.continue()));
  // Record what did not load. A proxy that refuses a host shows up as a failed request (in Chromium
  // net::ERR_TUNNEL_CONNECTION_FAILED) or as a 403. Our own blocks and requests cut off by a navigation
  // (net::ERR_ABORTED) are left out.
  context.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText ?? 'failed';
    if (!blockedByUs(request) && reason !== 'net::ERR_ABORTED') rec.blocked(request, reason);
  });
  context.on('response', (response) => {
    if (response.status() === 403) rec.blocked(response.request(), 'HTTP 403');
  });
  return context;
}

// --- Capture steps ---

async function captureHome(page, rec) {
  const started = Date.now();
  rec.urls.home = `${BASE}/`;
  await open(page, `${BASE}/`, rec);
  await rec.shot(page, 'home-top');

  // Email popup: wait for it (never fill it), capture, close it; then its trigger pill.
  const popup = await firstVisible(page, sel('popup'), Math.max(0, POPUP_WAIT_MS - (Date.now() - started)));
  const popupData = { appearedAfterMs: popup ? Date.now() - started : null };
  if (popup) {
    await page.waitForTimeout(800);
    await rec.shot(page, 'popup');
    popupData.dialog = await page.evaluate(outlineInPage, await mark(popup, 'popup'));
    await closeOverlay(page, popup);
  } else rec.warn(`no email popup within ${POPUP_WAIT_MS / 1000} s`);
  await scrollTo(page, 600);
  const pill = await firstVisible(page, sel('pill'), 3000);
  if (pill) {
    await rec.shot(page, 'popup-pill');
    popupData.pill = await page.evaluate(outlineInPage, await mark(pill, 'pill'));
  } else rec.warn('no popup trigger pill found');
  await rec.json('popup', popupData);

  // Full homepage, plus the header height at the top and after scrolling (sticky / compact header).
  await lazyScroll(page);
  const headerHeight = () => page.evaluate(() => Math.round(document.querySelector('header')?.getBoundingClientRect().height ?? 0));
  const header = { atTop: await headerHeight() };
  await scrollTo(page, 1200);
  header.scrolled = await headerHeight();
  await scrollTo(page, 0);
  await withoutFloating(page, ['fixed'], () => rec.shot(page, 'home-full', { fullPage: true, scale: 'css' }));
  await rec.json('home', { header, ...(await page.evaluate(outlineInPage, null)) });
}

async function captureFooter(page, rec) {
  const footer = await firstVisible(page, sel('footer'));
  if (!footer) return rec.warn('footer not found');
  await withoutFloating(page, ['fixed', 'sticky'], () => rec.shot(footer, 'footer', { scale: 'css' }));
  await rec.json('footer', await page.evaluate(outlineInPage, await mark(footer, 'footer')));
}

async function captureMenu(page, rec, mobile) {
  await open(page, `${BASE}/`, rec);
  if (mobile) {
    const button = await firstVisible(page, sel('menuButton'), 5000);
    if (!button) return rec.warn('mobile menu button not found');
    await button.click();
    const panel = await firstVisible(page, sel('overlay'), 5000);
    await page.waitForTimeout(700);
    await rec.shot(page, 'menu-open');
    if (panel) await rec.json('menu', await page.evaluate(outlineInPage, await mark(panel, 'menu')));
    return closeOverlay(page, panel);
  }
  const trigger = await firstVisible(page, sel('navTrigger'), 5000);
  if (!trigger) return rec.warn('desktop nav not found');
  await trigger.hover();
  await page.waitForTimeout(600);
  const state = await trigger.evaluate((el) => ({
    opens: el.tagName === 'SUMMARY' || el.hasAttribute('aria-expanded') || el.getAttribute('aria-haspopup') === 'true',
    open: Boolean(el.parentElement.open) || el.getAttribute('aria-expanded') === 'true',
  }));
  if (state.opens && !state.open) {
    await trigger.click();
    await page.waitForTimeout(600);
  }
  if (!state.opens) rec.warn('desktop nav has no dropdowns; captured the hover state of the first link');
  // Clip: the header plus whatever opened below it (mega menu panel), at least 240 px.
  const bottom = await page.evaluate(() => {
    const els = [...document.querySelectorAll('header, header *, [role="menu"]')].filter((el) => getComputedStyle(el).visibility !== 'hidden');
    return Math.max(240, ...els.map((el) => Math.min(innerHeight, el.getBoundingClientRect().bottom)));
  });
  await rec.shot(page, 'nav-open', { clip: { x: 0, y: 0, width: page.viewportSize().width, height: Math.round(bottom) + 24 } });
  await rec.json('nav', await page.evaluate(outlineInPage, 'header'));
}

async function captureQuiz(page, rec) {
  let link = null;
  if (!SITE.quiz) {
    await open(page, `${BASE}/`, rec);
    link = await page.locator('a[href*="quiz" i], a[href*="finder" i]').first().getAttribute('href', { timeout: 2000 }).catch(() => null);
  }
  rec.urls.quiz = abs(SITE.quiz ?? link ?? '/');
  await open(page, rec.urls.quiz, rec);
  await lazyScroll(page);
  const section = await firstVisible(page, sel('quizSection'), 3000);
  if (!section) {
    if (!link) return rec.warn('no quiz link or quiz section found');
    await rec.shot(page, 'quiz');
    return rec.json('quiz', await page.evaluate(outlineInPage, null));
  }
  const root = await mark(section, 'quiz');
  await withoutFloating(page, ['fixed', 'sticky'], () => rec.shot(section, 'quiz', { scale: 'css' }));
  const data = { intro: await page.evaluate(outlineInPage, root) };
  const start = await firstVisible(section, SELECTORS.quizStart); // a start button only, never an answer
  if (start) {
    await start.click();
    await page.waitForTimeout(1200);
    await withoutFloating(page, ['fixed', 'sticky'], () => rec.shot(section, 'quiz-started', { scale: 'css' }));
    data.started = await page.evaluate(outlineInPage, root);
  }
  await rec.json('quiz', data);
}

/** A page: first view (before any scrolling), full page, outline. */
async function capturePage(page, rec, name, url) {
  rec.urls[name] = url;
  await open(page, url, rec);
  await rec.shot(page, `${name}-top`);
  await lazyScroll(page);
  await withoutFloating(page, ['fixed'], () => rec.shot(page, `${name}-full`, { fullPage: true, scale: 'css' }));
  return page.evaluate(outlineInPage, null);
}

async function discover(page, pattern, scope) {
  const hrefs = await page.locator(`${scope} a[href*="${pattern}"]`).evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  return abs(hrefs.find((h) => !/\/collections\/all\/?$/.test(h) && !h.includes('#')));
}

/** Product page scrolled past its add-to-cart button: sticky buy bar (mobile) or sticky columns (desktop). */
async function captureProductScrolled(page, rec, outline) {
  const button = await firstVisible(page, sel('addToCart'), 3000);
  if (!button) return rec.warn('product: add-to-cart button not found');
  const y = await button.evaluate((el) => el.getBoundingClientRect().bottom + scrollY);
  await scrollTo(page, Math.round(y + 400));
  await rec.shot(page, 'product-scrolled');
  outline.fixedAfterScroll = (await page.evaluate(outlineInPage, null)).fixedAndSticky;
}

/** Cart drawer in a throwaway context: the empty state first, then exactly one item added. */
async function captureCart(browser, name, rec, productUrl) {
  const context = await newContext(browser, name, rec);
  try {
    const page = await context.newPage();
    await open(page, productUrl, rec);
    const data = {};
    const cartButton = await firstVisible(page, sel('cartButton'));
    if (cartButton) {
      const before = page.url();
      await cartButton.click();
      const drawer = await firstVisible(page, sel('overlay'), 4000);
      if (page.url() !== before) await page.goBack();
      else if (drawer) {
        await page.waitForTimeout(600);
        await rec.shot(page, 'cart-empty');
        data.empty = await page.evaluate(outlineInPage, await mark(drawer, 'cart-empty'));
        await closeOverlay(page, drawer);
      }
    }
    const add = await firstVisible(page, sel('addToCart'), 5000);
    if (!add) return rec.warn('cart: add-to-cart button not found');
    await add.click(); // exactly one item; there is never a second click
    const drawer = await firstVisible(page, sel('overlay'), 8000);
    if (!drawer) return rec.warn('cart: no drawer after add-to-cart');
    await page.waitForTimeout(900);
    await rec.shot(page, 'cart-drawer');
    const root = await mark(drawer, 'cart');
    data.drawer = await page.evaluate(outlineInPage, root);
    // Content that scrolls inside the drawer: grow the viewport until it all fits, then crop the drawer.
    const extra = await drawer.evaluate((el) => Math.max(0, ...[el, ...el.querySelectorAll('*')].map((c) => (/(auto|scroll)/.test(getComputedStyle(c).overflowY) ? c.scrollHeight - c.clientHeight : 0))));
    if (extra > 8) {
      const vp = page.viewportSize();
      await page.setViewportSize({ width: vp.width, height: Math.min(vp.height + extra + 40, 4000) });
      await page.waitForTimeout(600);
      await rec.shot(page.locator(root), 'cart-drawer-full', { scale: 'css' });
      await page.setViewportSize(vp);
    }
    await rec.json('cart', data);
  } finally {
    await context.close();
  }
}

// --- Main ---

async function captureViewport(browser, name) {
  const dir = path.join(OUT, name);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const rec = recorder(name, dir);
  const context = await newContext(browser, name, rec);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const step = async (label, fn) => {
    log(`[${args.site}/${name}] ${label}`);
    try {
      await fn();
    } catch (err) {
      rec.warn(`${label} failed: ${String(err?.message ?? err).split('\n')[0]}`);
    }
  };

  let collectionUrl = abs(SITE.collection);
  let productUrl = abs(SITE.product);
  await step('home + popup', () => captureHome(page, rec));
  await step('footer', () => captureFooter(page, rec));
  await step(VIEWPORTS[name].isMobile ? 'mobile menu' : 'desktop nav', () => captureMenu(page, rec, VIEWPORTS[name].isMobile));
  await step('quiz', () => captureQuiz(page, rec));
  await step('collection', async () => {
    if (!collectionUrl) {
      await open(page, `${BASE}/`, rec);
      collectionUrl = await discover(page, '/collections/', 'header');
    }
    if (!collectionUrl) throw new Error('no /collections/ link in the header');
    await rec.json('collection', await capturePage(page, rec, 'collection', collectionUrl));
    productUrl ??= await discover(page, '/products/', 'main');
  });
  if (!productUrl) rec.warn('no product URL (configure one or check the collection page)');
  else {
    await step('product', async () => {
      const outline = await capturePage(page, rec, 'product', productUrl);
      await captureProductScrolled(page, rec, outline).catch((err) => rec.warn(`product scrolled failed: ${err.message.split('\n')[0]}`));
      await rec.json('product', outline);
    });
    await step('cart drawer', () => captureCart(browser, name, rec, productUrl));
  }
  await context.close();
  const hosts = [...new Set(Object.values(rec.blockedHosts).flatMap(Object.keys))];
  if (hosts.length > 0) {
    const own = new URL(BASE).host;
    const third = hosts.filter((host) => host !== own);
    rec.warn(
      `requests failed for ${hosts.length} host(s)${hosts.includes(own) ? `, including ${own} itself` : ''}: ${third.slice(0, 10).join(', ')}${third.length > 10 ? ', ...' : ''}. ` +
        'See blockedHosts: a popup, quiz, review or widget block that was not found may be blocked, not absent.',
    );
  }
  return { urls: rec.urls, files: rec.files, warnings: rec.warnings, blockedHosts: rec.blockedHosts };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const manifestPath = path.join(OUT, 'manifest.json');
  const manifest = await fs.readFile(manifestPath, 'utf8').then(JSON.parse).catch(() => ({ viewports: {} }));
  Object.assign(manifest, { site: args.site, base: BASE, note: 'Structure reference only: never commit, never copy content.' });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROMIUM_PATH || undefined });
  try {
    for (const name of args.only ? [args.only] : Object.keys(VIEWPORTS)) {
      manifest.viewports[name] = { capturedAt: new Date().toISOString(), ...(await captureViewport(browser, name)) };
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    }
  } finally {
    await browser.close();
  }
  for (const [name, result] of Object.entries(manifest.viewports)) {
    log(`${name}: ${result.files.length} files, ${result.warnings.length} warnings`);
    for (const warning of result.warnings) log(`  - ${warning}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
