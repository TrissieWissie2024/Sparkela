<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Sparkela engineering rules

Every builder agent follows these rules. They are short; the details live in `docs/PLAN.md`.

### Before you write code
- Read `docs/PLAN.md` first (at least §1, §20, §21 and the sections your files point to), then `../SPARKELA-BRIEF.md`. Brief §2 (hard rules) overrides everything.
- Only touch the files your wave assigns to you (`docs/PLAN.md` §20). Need a change in someone else's file? Write a request in your final report; do not edit it.
- Use the names, types, props, routes and copy keys from the plan exactly. Deviations go into `docs/PLAN.md` and `docs/DECISIONS.md` via the integrator.
- For Next.js behaviour not covered by the plan, read `node_modules/next/dist/docs/` before coding.
- Language (brief §0): code, identifiers, comments and commits in English; visible copy in Dutch (in `content/`); `README.md` and everything in `docs/` in Dutch. Translate Dutch comments when you port CORVANE code.

### Next.js 16.4.3 with Cache Components
- Never call `Date.now()`, `new Date()`, `Math.random()` or `crypto.randomUUID()` during render. Allowed: inside `'use cache'`, in `proxy.ts`, in route handlers, in event handlers, in effects and `useSyncExternalStore` snapshots.
- Never read `cookies()`, `headers()` or `searchParams` in a shared layout or page. Only route handlers (`/api/*`) and `proxy.ts` read cookies.
- `useSearchParams()` only inside a `<Suspense>` boundary. Update URL state with `window.history.replaceState`, not `router.replace`.
- On product and collection routes, call `notFound()` only inside `<Suspense>` (plan §14.2). Keep H1, price, buy box and JSON-LD outside Suspense.
- `cacheLife` and `cacheTag` only inside `'use cache'`. Always set an explicit `cacheLife`.
- `revalidateTag(tag, profile)` always with a profile: `{ expire: 0 }` for product and collection webhooks and manual revalidation, `"max"` for `inventory_levels/update`. `updateTag` only in Server Actions.
- Never put `'use cache'` on a function whose argument changes per call without bound (`now`, a `Date`, random values, user input); it becomes part of the cache key. Bounded keys such as a product handle, drop slug or limit are fine. Read the time inside the cached scope with `serverNow()`.
- The file is `proxy.ts`. There is no `middleware.ts`.
- Never export route segment configs `dynamic`, `revalidate`, `runtime`, `fetchCache` or `dynamicParams`. Only `ensureStatic`, `instant` and `prefetch` where the plan says so.
- `generateStaticParams` never returns `[]` (empty catalog → the sentinel `NO_PRODUCTS_HANDLE`, which 404s).
- Unknown params on product, collection and drop routes use the 404 pattern: `<Suspense fallback={<NotFoundView/>}><Missing/></Suspense>` with `notFound()` in `Missing`. `NotFoundView` (4-6/C4) is the only 404 view; there is no `ProductNotFoundView`.
- Use `preload` on the LCP image, not `priority`. Always pass `sizes` to `next/image`.
- Generate ids with `useId()`; Activity keeps hidden routes in the DOM.
- React 19 types: there is no global `JSX` namespace; use `React.JSX.Element` or omit the return type. `useRef<T>(null)` is `RefObject<T | null>`, so type ref props as `RefObject<HTMLButtonElement | null>`.
- Builder agents typecheck with `npx tsc --noEmit --incremental false -p tsconfig.json`; only the integrator runs `npm run typecheck` (`next typegen && tsc --noEmit`). Lint is `npx eslint <your files>` (integrator: `npm run lint`).

### Data, money, time
- Design tokens only: Tailwind token classes (`bg-pagina`, `text-tekst-2`, `bg-primair`) or `var(--…)`. No hex, `rgb()` or named colors in components.
- All visible copy lives in `content/`, including labels, aria-labels and errors. No Dutch string literals in components. New copy goes into the copy file of your feature (`content/copy/*.ts`, plan §5.1) that your wave assigns to you, type and value together. Generic labels and the texts `lib/` returns live in `sharedCopy`; never rename keys from plan §5.2 or §5.9.
- Money is integer cents (`Cents`). Format only with `lib/money.ts`. Compute only in `lib/pricing.ts` (`percentOf`, half-up, no float math).
- Time logic only via `lib/dates.ts`; the server clock only via `lib/clock.ts` (`serverNow`) and `lib/server-clock.ts` (`getServerNow`). Pass `now` into pure functions.
- Never `setTimeout(cb, target - now)` to a time boundary: delays above 2^31-1 ms (about 24.8 days) fire at once. Use `scheduleAt(target, cb)` from `lib/schedule.ts`.
- Pages and components get `CatalogProduct`s (with `badges` and `listable`) ready-made from `lib/shop-data.ts`; never call `toCatalogProduct`, `deriveBadges` or `badgeContextAt` yourself.
- Commerce only via `lib/commerce` and `lib/shop-data.ts` (server) or `useCart()` / `useCatalog()` (client). Client components never import `content/products.ts` or `lib/commerce/*`; exceptions: `lib/commerce/types.ts`, and `CartProvider` may import the client-safe adapters in `lib/commerce/cart/`. Those adapters never import a server-only module.
- `/api/cart` decides on fresh Shopify data (`VariantGate` query + `canAddToCart()`), never on the cached catalog.
- With the Shopify provider, never compute cart totals yourself; use the amounts from the Shopify cart.
- `localStorage` and `sessionStorage` only through `lib/storage.ts` (try/catch; the site must work without storage).
- Keep pure logic free of `next/*` imports so Vitest can run it; mock `next/cache` where needed.

### Brief §2 as code rules
- Claims (nikkelvrij, waterproof, hypoallergeen and similar) only through `getVerifiedClaims()`: `verified: true` with a `source`, or metafield `nikkelvrij === true`.
- Badges only via `deriveBadges()`: a marketing badge needs to be in `site.badges.enabled` (launch: nieuw, limited, laatste-stuks) and pass its rule. "Bestseller" only with the manual flag and `site.flags.realSalesData`; "Laatste stuks" only at real stock of 1 to `site.lowStockThreshold`; "Limited" only for live drops; "Nieuw" only with the `nieuw` tag. No "Lindes favoriet" label. The favourites carousel shows `bestseller` products only under the title "Bestsellers".
- Buttons only via `Button`/`buttonClasses`. Roest is the only filled button colour (bot-wit on a roest surface); everything else is outline, ghost or link.
- Timers only count to a fixed literal date from `content/drops.ts` or `content/offers.ts`. Never reset per visitor or per day. At zero: "Nu live" or nothing.
- No invented social proof: no reviews, ratings, customer counts, "X bekijken dit" or "zojuist gekocht". Review and star components render nothing without real reviews.
- Strikethrough prices only via `priceDisplay()` and `Price`: compare-at above price and `laagste_prijs_30d` present, and then always with the lowest-30-days line (there is no prop to hide it). In the cart a discount is its own line ("Stack-korting −€2,24"), never `<s>`.
- Verified claims read "{label} (bevestigd door de leverancier)"; never "getest". Material text only via `materialForVariant()`.
- Every sign-up field shows the exact consent sentence from `site.consentText` as the label of an unchecked checkbox, plus the privacy link. Newsletter sign-up is always double opt-in (`PENDING` + our own confirmation mail); never fall back to single opt-in. `SubscribeForm` alone fires `sign_up` and calls `markSubscribed()` (`lib/subscription.ts`), for every source.
- Never select protected customer fields you do not need from the Admin API (no `email`, no name); never put an email address in a URL or token.
- No references to existing jewellery brands or designers, no "dupe" or "zoals …".
- The link "Hier de overeenkomst herroepen" (`site.withdrawalLinkLabel`, to `/herroepen`) is on every page: `Footer` and `MiniFooter` both render it. The hygiene rule shows for earrings and piercings (`needsHygieneSeal()`: type `oorbellen` or tag `piercing`). GPSR info is on every product page, the gift card included (`pdpCopy.gpsr.digital`). GPSR placeholders stay in `[brackets]`; never write safety text yourself.
- No third-party script before cookie consent; the consent banner only exists with `site.analytics.enabled`.
- OG images embed only JPEG or PNG (Satori renders WebP as transparent, without an error): Shopify photos via `ogPhotoUrl()` (`format=jpg`), never site `.webp` files.
- Never copy text, images, code or CSS from lashthing.nl, the supplier or other shops; never copy CORVANE's brand, colors, fonts or copy. When you port a CORVANE component, replace every string and CORVANE word (scent, spray, geur, vane); the content-guard checks for overlap.

### Accessibility
- Visible focus everywhere: 2px ring in `--focus`, 2px offset; on dark or colored surfaces set `data-vlak` so the ring turns bot-wit.
- Touch targets at least 44×44 px (enlarge with `before:` if the visual is smaller).
- Dialogs, drawers and menus use Radix Dialog: focus trap, Esc, focus returns to the opener, a title.
- Carousels: `aria-roledescription`, slide labels "n van totaal", prev/next buttons, no autoplay. Accordions and tabs via Radix.
- Respect `prefers-reduced-motion`: every animation behind `motion-safe:`; rotations and timers have a pause.
- Selected state never by color alone. Use `aria-disabled` instead of `disabled` on buttons that keep focus.
- One H1 per page; form fields have visible labels and errors linked with `aria-describedby`.
- No layout shift: reserve heights with `min-h`, fixed media ratios, `tabular` numbers in fixed boxes.

### Done and safety
- Done for a builder agent is mechanical: your own Vitest files and the content-guard pass (`npx vitest run <your paths> content/content-guard.test.ts`; components via `renderToStaticMarkup`, wrap providers in the test), `npx eslint <your files>` is clean, `npx tsc --noEmit --incremental false -p tsconfig.json` has no errors in your files, and you wrote a short report (files, tests, requests, deviations). Errors in another agent's files or in `.next/types`: note them, do not fix them.
- Never run `next build` or `next dev` unless you are the wave's integrator or the only agent in that step (Next allows one per project). No temporary pages or scratch routes. Run `npx next typegen` at most once, after adding a route file. Never start long-running servers you do not stop. Integrators run app checks with `npm run build:test` and `npm run start:test` only: before 27 November a plain `next start` shows the waitlist everywhere.
- Do not commit or push; the orchestrator does that.
- Never commit secrets. Real values go in `.env.local` (ignored); `.env.example` has names only. No tokens in code, fixtures, tests or logs, and no personal data in logs. Secrets are at least 32 characters; read them with `readSecret()` (shorter counts as missing).
- Escape every interpolated value in mail HTML; user input is never a GraphQL query string, always a variable.
