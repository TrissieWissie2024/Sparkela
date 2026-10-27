# Plan

Fase 2 van de brief. Dit plan is het bindende contract voor de bouw. Bouwagents lezen eerst dit document, dan `AGENTS.md` en de brief (`../SPARKELA-BRIEF.md`). Ze houden zich aan de namen, typen, props, routes en copy-sleutels hieronder. Wil je afwijken, pas dan eerst dit document aan en zet de reden in `docs/DECISIONS.md` (nummers vanaf 15 staan bij de fase-2-beslissingen).

**Bronnen.** De brief is leidend; §2 van de brief gaat boven alles. Daarna `docs/REFERENCE.md` (CORVANE gemeten, Lashthing tweedehands). Gedrag van Next.js 16.4.3 volgt de gecontroleerde digest uit fase 2 en `node_modules/next/dist/docs/`. Code uit CORVANE mag je hergebruiken (zie §13 en `docs/REFERENCE.md` §5), het merk niet.

**Tijdlijn.** Vandaag is maandag 26 oktober 2026. De shop gaat live op vrijdag 27 november 2026 om 00.00 uur (Europe/Amsterdam). Alles is getest vóór donderdag 26 november 2026, want early access voor Holiday Sparkle begint op 26 november om 00.00 uur en dan kunnen er al echte bestellingen komen. De wachtlijst gaat zo vroeg mogelijk live (na golf 4-6). Streefdata per golf staan in §20.4.

**Leeswijzer voor agents.** §20 zegt welke bestanden van jou zijn. §3 geeft per bestand het doel. §5, §6 en §13 geven de exacte namen en typen. §21 geeft de conventies.

---

## 1. Doel en uitgangspunten

### 1.1 Wat we bouwen

Een mobile-first webshop voor Sparkela op Next.js 16.4.3 (App Router, Cache Components) met Shopify als headless backend. Producten, voorraad, kortingen, checkout en betalingen zitten in Shopify. De site toont, de cart staat in Shopify en afrekenen gebeurt in de checkout van Shopify.

### 1.2 Static-first

- Elke pagina is statisch (`○` in de build), behalve de API-routes (`ƒ`) en de lege shells voor onbekende handles (`◐`). Bekende params van een dynamische route staan als `○`-regels onder die route; `●` verschijnt alleen bij de `opengraph-image`-routes (§2.1).
- Productdata komt uit `'use cache'`-functies met `cacheTag` en `cacheLife`. Webhooks van Shopify verversen die tags (§7.6).
- Niets in een gedeelde layout leest `cookies()`, `headers()` of `searchParams`. De cart leeft volledig aan de clientkant en praat met `/api/cart`.
- Tijd lezen gebeurt op drie plekken, nergens anders: in `proxy.ts` (per request), in gecachte functies (`'use cache'`) en in de browser na mount of in een inline script (§10).

### 1.3 Providers

`COMMERCE_PROVIDER` kiest de commerce-laag:

| Waarde | Catalogus | Cart | Checkout | Sleutels nodig |
| --- | --- | --- | --- | --- |
| `local` (standaard) | `content/products.ts` | React-store + `localStorage` (try/catch), totalen via `lib/pricing.ts` | `/checkout`: demo met besteloverzicht, kortingscodeveld en "Demo-checkout: er wordt niet betaald" | geen |
| `shopify` | Storefront API (GraphQL, versie `2026-10`) | Shopify Cart API via `/api/cart`, cart-id in httpOnly-cookie | `cart.checkoutUrl` (Shopify) | Storefront-token; Admin-app (client-id en -secret) voor `/api/subscribe`; Resend voor de bevestigingsmail |

- Productie op Vercel draait altijd met `shopify`. `lib/commerce/index.ts` gooit een fout bij het laden als `VERCEL_ENV === "production"` en de provider niet `shopify` is. De build faalt dan, de site gaat nooit per ongeluk met testproducten live.
- Met `shopify` rekent de site geen bedragen uit. Alle regels, kortingen en totalen komen uit de Shopify-cart. `lib/pricing.ts` levert dan alleen de voortgangsteksten (afstand tot gratis verzending, stack-mijlpaal) op basis van die Shopify-bedragen.
- Zonder sleutels werkt alles met `local`. Formulieren tonen dan het e-mailadres van Sparkela als terugval.
- De wachtlijst kan live vóórdat de echte catalogus in Shopify staat. Productie eist wel `shopify`, maar een lege of onvolledige catalogus breekt de build niet (§7.7, §11.9). Een onbereikbare Shopify of een fout token breekt de build wel.

### 1.4 Server en client

| Laag | Server | Client |
| --- | --- | --- |
| Pagina's en secties | Alle pagina's, kopblokken, productkaarten (markup), JSON-LD, metadata | Alleen eilanden met interactie |
| Productdata | `lib/shop-data.ts` (cached) | `useCatalog()` uit `CatalogProvider` (in `app/(shop)/layout.tsx`), of props |
| Cart | `/api/cart` (Shopify) | `CartProvider` + `useCart()` met een adapter uit `lib/commerce/cart/` (`local` of `shopify`) |
| Tijd | `proxy.ts`, `getServerNow()` (cached), route handlers | `TimeSwitch`, `Countdown`, `useNow()`, inline scripts |
| Formulieren | `/api/subscribe`, `/api/subscribe/confirm`, `/api/herroepen`, `/api/contact` | `SubscribeForm`, `ConfirmSubscription`, `WithdrawalForm`, `ContactForm` |
| Prelaunch | `proxy.ts` | niets |

### 1.5 Wat niet

- Geen `middleware.ts` (het heet `proxy.ts`).
- Geen route segment configs `dynamic`, `revalidate`, `runtime`, `fetchCache` of `dynamicParams` (fout onder Cache Components).
- Geen zware UI-kits. Radix voor dialog, accordion en tabs.
- Geen scripts van derden vóór cookietoestemming. Analytics staat standaard uit.
- Geen cron (§10.4).

---

## 2. Sitemap

### 2.1 Legenda

- **Build**: wat `next build` moet tonen. `○` statisch; `◐` statische shell met dynamische rest (alleen voor onbekende params); `ƒ` dynamisch. Next 16.4.3 toont de bekende params van een route met `generateStaticParams` als `○`-regels onder die route, met revalidate en expire (bijvoorbeeld `○ /collections/alle 1h 1d`), plus één `◐`-shell voor de route zelf. `●` verschijnt alleen bij de `opengraph-image`-routes; hun URL krijgt een hash-achtervoegsel (`/products/<handle>/opengraph-image-<hash>`), wat de `META`-regex in §11.1 toelaat. Gemeten in fase 2 (beslissing 120).
- **Prelaunch**: `open` = werkt vóór `launchAt`; `wachtlijst` = proxy herschrijft naar `/wachtlijst`; `EA` = open met een geldige early-access-cookie voor die drop.
- **Index**: `index` of `noindex`. Een noindex-pagina staat nooit in `sitemap.xml` en nooit als `Disallow` in `robots.txt`.

### 2.2 Pagina's

Alle pagina's behalve `/wachtlijst` en `/nieuwsbrief/bevestigen` staan in de routegroep `app/(shop)/` en krijgen de shop-chrome (promobalk, header, footer, cart drawer, popup). Die twee staan in `app/(kaal)/`.

| Route | Bestand | Data | Build | Prelaunch | Index |
| --- | --- | --- | --- | --- | --- |
| `/` | `app/(shop)/page.tsx` | `getShopProducts()`, `content/home.ts`, `getFeaturedDrop()` | `○` | wachtlijst | index |
| `/collections/[handle]` | `app/(shop)/collections/[handle]/page.tsx` | `getShopCollection(handle)`, `content/collections.ts` | `○` per handle + `◐` shell | wachtlijst | index |
| `/products/[handle]` | `app/(shop)/products/[handle]/page.tsx` | `getShopProduct(handle)`, stacks, claims, faq | `○` per handle + `◐` shell | wachtlijst; dropproduct: EA | index (cadeauverpakking: noindex) |
| `/drops/[slug]` | `app/(shop)/drops/[slug]/page.tsx` | `content/drops.ts`, producten van de drop | `○` per slug + `◐` shell | EA voor die drop | index vanaf `startsAt` (via sitemap) |
| `/drops/[slug]/binnenkort` | `app/(shop)/drops/[slug]/binnenkort/page.tsx` (`ensureStatic = "navigation"`, `instant = false`, §14.6) | `content/drops.ts` | `○` per slug + `◐` shell | open (alleen via proxy-rewrite bereikt) | noindex, canonical `/drops/[slug]` |
| `/stacks` | `app/(shop)/stacks/page.tsx` | `content/stacks.ts`, producten | `○` | wachtlijst | index |
| `/cadeaukaarten` | `app/(shop)/cadeaukaarten/page.tsx` | product `cadeaukaart`, `offers.giftCards` | `○` | wachtlijst | index |
| `/sparkela-club` | `app/(shop)/sparkela-club/page.tsx` | `site.club`, `content/copy/pages.ts` `club` | `○` | wachtlijst | index |
| `/spark-finder` | `app/(shop)/spark-finder/page.tsx` | `content/quiz.ts`, catalogus | `○` | wachtlijst | index |
| `/zoeken` | `app/(shop)/zoeken/page.tsx` | catalogus (client) | `○` | wachtlijst | noindex |
| `/over-sparkela` | `app/(shop)/over-sparkela/page.tsx` | `content/copy/pages.ts` `about` | `○` | wachtlijst | index |
| `/veelgestelde-vragen` | `app/(shop)/veelgestelde-vragen/page.tsx` | `content/faq.ts` | `○` | wachtlijst | index |
| `/verzenden-en-retourneren` | `app/(shop)/verzenden-en-retourneren/page.tsx` | `content/shipping.ts`, `content/legal/verzenden-en-retourneren.md` | `○` | open | index |
| `/herroepen` | `app/(shop)/herroepen/page.tsx` | `content/copy/forms.ts` `withdrawal` | `○` | open | index |
| `/contact` | `app/(shop)/contact/page.tsx` | `content/copy/forms.ts` `contact` | `○` | open | index |
| `/algemene-voorwaarden` | `app/(shop)/algemene-voorwaarden/page.tsx` | `content/legal/algemene-voorwaarden.md` | `○` | open | index |
| `/privacy` | `app/(shop)/privacy/page.tsx` | `content/legal/privacy.md` | `○` | open | index |
| `/cookies` | `app/(shop)/cookies/page.tsx` | `content/legal/cookies.md` | `○` | open | index |
| `/account` | `app/(shop)/account/page.tsx` | `content/copy/pages.ts` `account` | `○` | open | noindex |
| `/checkout` | `app/(shop)/checkout/page.tsx` | lokale cart (client) | `○` | wachtlijst | noindex |
| `/wachtlijst` | `app/(kaal)/wachtlijst/page.tsx` | `content/copy/forms.ts` `waitlist` | `○` | open | index tijdens prelaunch, canonical `/`; na launch 307 naar `/sparkela-club` |
| `/nieuwsbrief/bevestigen` | `app/(kaal)/nieuwsbrief/bevestigen/page.tsx` | `content/copy/forms.ts` `confirm`; token uit `?t=` (client) | `○` | open | noindex |
| 404 (geen route) | `app/not-found.tsx` | `sharedCopy.notFound` (`content/copy/shared.ts`) via `NotFoundView` | `○` | wachtlijst | noindex (automatisch) |
| 404 (onbekende handle) | `app/(shop)/not-found.tsx` | idem | in de shell | wachtlijst | noindex |

- `/account`: `proxy.ts` stuurt met 307 door naar `SHOPIFY_CUSTOMER_ACCOUNT_URL` als die variabele bestaat. Zonder variabele toont de pagina "Inloggen kan straks hier" met links naar contact en herroepen.
- `/checkout`: alleen zinvol met `local`. Met `shopify` toont de pagina één regel ("Je rekent af in onze beveiligde checkout") en een knop die de drawer opent. Afrekenen gaat altijd via `cart.checkoutUrl`.
- `/drops/[slug]/binnenkort` is nooit gelinkt. De proxy herschrijft ernaartoe (§11.4).

### 2.3 Collectie-handles

Gedefinieerd in `content/collections.ts`. Lidmaatschap volgt uit de tags (§7.2), voor beide providers gelijk.

| Handle | Titel | Regel (`CollectionRule`) | Opmerking |
| --- | --- | --- | --- |
| `alle` | Alle sieraden | `{ kind: "all" }` | Zonder cadeauverpakking en cadeaukaart |
| `nieuw` | Nieuw | `{ kind: "tag", tag: "nieuw" }` | Handmatige tag `nieuw` |
| `oorbellen` | Oorbellen | `{ kind: "type", type: "oorbellen" }` | |
| `armbanden` | Armbanden | `{ kind: "type", type: "armbanden" }` | |
| `kettingen` | Kettingen | `{ kind: "type", type: "kettingen" }` | |
| `ringen` | Ringen | `{ kind: "type", type: "ringen" }` | |
| `subtiel` | Subtiel en klassiek | `{ kind: "vibe", vibe: "clean-en-classy" }` | De kleine lijn subtiele stukken |
| `limited` | Limited | `{ kind: "drop" }` | Alleen drops die nu publiek live zijn |
| `festival` | Festival | `{ kind: "moment", moment: "festival" }` | Shop per moment |
| `date-night` | Date night | `{ kind: "moment", moment: "date-night" }` | |
| `kantoor-maar-niet-saai` | Kantoor maar niet saai | `{ kind: "moment", moment: "kantoor-maar-niet-saai" }` | |
| `strand` | Strand | `{ kind: "moment", moment: "strand" }` | |
| `feestdagen` | Feestdagen | `{ kind: "moment", moment: "feestdagen" }` | |
| `onder-25` | Cadeaus onder €25 | `{ kind: "maxPrice", cents: 2500 }` | Minimale variantprijs < 2500 |

"Stacks" en "Cadeaukaarten" in de Cadeaus-groep zijn pagina's (`/stacks`, `/cadeaukaarten`), geen collecties.

### 2.4 API-routes en metadata-routes

| Route | Bestand | Methoden | Build | Doel |
| --- | --- | --- | --- | --- |
| `/api/subscribe` | `app/api/subscribe/route.ts` | POST | `ƒ` | Klant aanmaken of bijwerken in Shopify (Admin API) met toestemming `PENDING` en tags, en de bevestigingsmail sturen (§15.2) |
| `/api/subscribe/confirm` | `app/api/subscribe/confirm/route.ts` | POST | `ƒ` | Dubbele opt-in afronden: token controleren, toestemming naar `SUBSCRIBED` (§15.3) |
| `/api/herroepen` | `app/api/herroepen/route.ts` | POST | `ƒ` | Herroeping ontvangen, bevestiging naar klant en kopie naar Sparkela (§15.4) |
| `/api/contact` | `app/api/contact/route.ts` | POST | `ƒ` | Contactbericht per mail (§15.5) |
| `/api/cart` | `app/api/cart/route.ts` | GET, POST | `ƒ` | Shopify-cart lezen en muteren, cart-id in cookie (§7.4) |
| `/api/revalidate` | `app/api/revalidate/route.ts` | POST | `ƒ` | Shopify-webhooks (HMAC) en handmatige revalidatie met `REVALIDATE_SECRET` (§7.6) |
| `/sitemap.xml` | `app/sitemap.ts` | GET | `○` | Indexeerbare routes en zichtbare producten |
| `/robots.txt` | `app/robots.ts` | GET | `○` | `Disallow: /api/`, verwijzing naar sitemap |
| `/manifest.webmanifest` | `app/manifest.ts` | GET | `○` | Naam, kleuren, iconen |
| `/icon.svg`, `/apple-icon.png`, `/favicon.ico` | `app/icon.svg`, `app/apple-icon.png`, `app/favicon.ico` | GET | `○` | Uit `scripts/build-logo.mjs` |
| `/opengraph-image` | `app/opengraph-image.tsx` | GET | `○` | Merkbeeld 1200×630 |
| `/products/[handle]/opengraph-image` | `app/(shop)/products/[handle]/opengraph-image.tsx` | GET | `●` | Product-OG met eigen `generateStaticParams` |
| `/drops/[slug]/opengraph-image` | `app/(shop)/drops/[slug]/opengraph-image.tsx` | GET | `●` | Drop-OG op roest |

Er is geen `/api/search`, geen `/api/checkout` en geen cron-route. Zoeken gebeurt in de browser over de zichtbare catalogus (§7.3). Afrekenen gaat met `shopify` via `cart.checkoutUrl` en met `local` naar `/checkout`.

### 2.5 Navigatie

Bron: `content/navigation.ts` (§5).

**Desktop (vanaf `xl`, 1280 px).** Logo links, horizontale nav, rechts zoeken, account en "Tas (n)". Onder `xl` geldt de mobiele header (beslissing 40).

| # | Label | Doel |
| --- | --- | --- |
| 1 | Nieuw | `/collections/nieuw` |
| 2 | Oorbellen | `/collections/oorbellen` |
| 3 | Armbanden | `/collections/armbanden` |
| 4 | Kettingen | `/collections/kettingen` |
| 5 | Ringen | `/collections/ringen` |
| 6 | Shop per moment (klapt uit) | Festival, Date night, Kantoor maar niet saai, Strand, Feestdagen; plus "Bekijk alles" → `/collections/alle` |
| 7 | Limited | `/collections/limited` |
| 8 | Cadeaus (klapt uit) | Onder €25 → `/collections/onder-25`, Stacks → `/stacks`, Cadeaukaarten → `/cadeaukaarten` |

- De twee groepen zijn disclosure-knoppen (`aria-expanded`, `aria-controls`) met een paneel onder de header over de volle containerbreedte. Elk item heeft een korte toelichting (patroon van Lashthing) en bij Shop per moment een kleine momentfoto (`PhotoSlot` 4:5, 96 px breed). Openen op klik en op hover (met 150 ms vertraging), sluiten met Esc, bij klik buiten, bij focus buiten het paneel en bij navigatie.
- "Subtiel en klassiek" staat in het Shop-per-moment-paneel als extra link onder een haarlijn ("Liever subtiel?").

**Mobiel (onder `xl`).** Links hamburger en zoeken, logo in het midden, rechts account (icoon, 44 px) en "Tas (n)". Onder 380 px (`xs`) valt het accounticoon weg (account staat ook in het menu) en wordt het logo 104 px breed, zodat er op 320 px niets horizontaal scrolt. Het menu is een `Sheet` van links (352 px, max viewport min 24 px):

1. Hoofdlinks: Nieuw, Oorbellen, Armbanden, Kettingen, Ringen, Limited (Unbounded 700, 20 px, 52 px hoog).
2. Twee uitklapgroepen (Radix Accordion, `type="multiple"`): Shop per moment, Cadeaus.
3. Servicelinks onder een haarlijn: Spark Finder, Sparkela Club, Over Sparkela, Veelgestelde vragen, Contact, Account.
4. Een uitgelichte kaart: de actieve drop als die publiek live is, anders de eerste stack uit `content/stacks.ts`.

**Footer** (`--donker`):

| Kolom | Links |
| --- | --- |
| Shop | Nieuw, Oorbellen, Armbanden, Kettingen, Ringen, Subtiel en klassiek, Limited, Stacks, Cadeaukaarten |
| Klantenservice | Veelgestelde vragen, Verzenden en retourneren, Herroepen, Contact, Account |
| Sparkela | Over Sparkela, Sparkela Club, Spark Finder |
| Juridisch | Algemene voorwaarden, Privacy, Cookies, Cookie-instellingen (alleen met analytics aan) |

Onder de kolommen: betaalbadges (neutrale tekstbadges uit `site.paymentMethods`, beslissing 93), socials (Instagram, TikTok, Pinterest), bedrijfsgegevens, btw-tekst, en de link "Hier de overeenkomst herroepen" naar `/herroepen`.

**Reviewblok boven de footer** (brief §6, blok 16): `ReviewsCarousel variant="footer"` direct boven `Footer` in `ShopChrome`. Rendert niets zolang `site.flags.showReviews` uit staat of `reviews` leeg is.

---

## 3. Bestandsboom

Paden zijn relatief aan `sparkela/`. Kolom **Golf/eigenaar** verwijst naar §20 (bijvoorbeeld `3a/A1` = golf 3a, agent A1). Een bestand heeft per golf precies één eigenaar. Bestanden die al bestaan en worden vervangen staan met "(vervangt)".

### 3.1 Configuratie en root

| Pad | Doel | Golf/eigenaar |
| --- | --- | --- |
| `package.json` | Extra pakketten: `@radix-ui/react-tabs`, `@fontsource/inter` (dev); extra scripts `early-access-link` (`node scripts/early-access-link.mjs`), `test:shopify` (`SHOPIFY_LIVE_TEST=1 vitest run tests/unit/shopify-live.test.ts`), `build:test` (`node scripts/with-test-env.mjs next build`) en `start:test` (`node scripts/with-test-env.mjs next start -p 3200`), beide met `TEST_ENV` uit `tests/test-env.mjs` (§19.3); `typecheck` blijft `next typegen && tsc --noEmit` | 3a/A1 |
| `next.config.ts` | `images.loaderFile`, `htmlLimitedBots`, bestaande Turbopack-regel (§3.8) | 3a/A1 |
| `tsconfig.json` | Ongewijzigd; tests importeren `describe`, `it` en `expect` expliciet uit `vitest` | 3a/A1 |
| `vitest.config.mts` | `@`-alias, alias `server-only` → `tests/stubs/server-only.ts`, `environment: "node"`, includes `lib/**/*.test.ts`, `content/**/*.test.ts`, `components/**/*.test.{ts,tsx}`, `tests/unit/**/*.test.ts` | 3a/A1 |
| `playwright.config.ts` | Projecten mobile/desktop, webServer met productiebuild, `PW_CHROMIUM_PATH`, testklok (§19.3) | 3a/A1 |
| `tests/test-env.mjs` | `TEST_PORT`, `TEST_ENV` en `TEST_NOW` (één bron voor Playwright, `build:test`, `start:test` en Vitest, §19.3) | 3a/A1 |
| `scripts/with-test-env.mjs` | Start het meegegeven commando (`next build`, `next start -p 3200`) met `TEST_ENV` erbij in de omgeving | 3a/A1 |
| `.env.example` | Alle variabelen met uitleg (§3.9) | 3a/A1 |
| `tests/stubs/server-only.ts` | Leeg bestand voor Vitest | 3a/A1 |
| `tests/fixtures/catalog.ts` | `makeProduct()`, `makeCatalogProduct()` en de stukken uit §8.4 als vaste `CatalogProduct`-literals (handle, type, prijs, variant-id), zodat logica-tests niet op `content/products.ts` of `toCatalogProduct` wachten | 3a/A1 |
| `tests/fixtures/local-catalog.ts` | Synchroon en zonder `server-only`-imports, zodat Vitest én Playwright hem kunnen laden: `localCatalogProducts(now: number): CatalogProduct[]` (alle 26 lokale producten: `buildLocalProducts()` uit `lib/commerce/local-data.ts` en `toCatalogProduct(p, badgeContextAt(now))`) en `localShopRoutes(now: number): string[]` (`STATIC_ROUTES` uit `lib/seo.ts`, `/collections/<handle>` voor elke handle uit `content/collections.ts`, en `/products/<handle>` voor `localCatalogProducts(now).filter((p) => p.listable)`). E2's `SHOP_ROUTES` en E1's `sitemap.test.ts` gebruiken allebei `localShopRoutes(TEST_NOW)` (beslissing 140) | 4-6/C2a |
| `.gitignore` | Extra regel `screenshots/` | 3a/A1 |
| `proxy.ts` | Prelaunch, preview, early access, drop-gating, `/account`, `/wachtlijst` na launch (§11) | 4-6/C1 |
| `README.md` (vervangt) | Golf 4-6: starten en de sectie "Wachtlijst live zetten" (§11.9). Golf 12: content, Shopify, Vercel en de rest | 4-6/C1, 12/F1 |
| `AGENTS.md` | Beheerde Next-blok plus "Sparkela engineering rules" (fase 2) | fase 2 |

### 3.2 app/

| Pad | Doel | Golf/eigenaar |
| --- | --- | --- |
| `app/layout.tsx` (vervangt) | Root: `<html lang="nl">`, fonts, `metadata` (metadataBase, titeltemplate), `viewport` (`themeColor` uit `lib/brand-colors.ts`), `<body>` met `LogoDefs`, `SkipLink`, `RouteFocus`, `MotionStyles` | 3a/A2; 3b/B1 (paar 1) voegt `LogoDefs` toe, 3b/B2 (paar 2) voegt `MotionStyles` toe; daarna volgens de tabel in §20.1 |
| `app/globals.css` (vervangt) | Tokens, `@theme inline`, base, utilities (§4) | 3a/A2 |
| `app/page.tsx` | Verwijderen (de home staat in `app/(shop)/page.tsx`) | 3a/A2 |
| `app/favicon.ico` (vervangt) | Monogram 16/32/48 px, uit `scripts/build-logo.mjs` | 3b/B1 |
| `app/icon.svg` | Bot-wit S op inkt | 3b/B1 |
| `app/apple-icon.png` | 180×180, bot-wit S en vonk op roest | 3b/B1 |
| `app/manifest.ts` | Naam, `start_url: "/"`, kleuren via `lib/brand-colors.ts`, iconen | 10-11/E1 |
| `app/opengraph-image.tsx` | Merk-OG 1200×630 | 10-11/E1 |
| `app/sitemap.ts` | Statische routes, collecties, zichtbare producten, gestarte drops | 10-11/E1 |
| `app/robots.ts` (+ `tests/unit/robots.test.ts`) | Alles toegestaan behalve `/api/`; sitemap-URL | 10-11/E1 |
| `app/not-found.tsx` | Globale 404 met `ShopChrome` eromheen en `NotFoundView` | 7-9/D4 |
| `app/(kaal)/layout.tsx` | Minimale chrome: `ClockProvider`, `<main id="main">` en `MiniFooter` | 4-6/C1 |
| `app/(kaal)/wachtlijst/page.tsx` | Wachtlijstpagina (§14.20) | 4-6/C1 |
| `app/(kaal)/nieuwsbrief/bevestigen/page.tsx` | Bevestigingspagina van de dubbele opt-in (§14.21) | 4-6/C1 |
| `app/(shop)/layout.tsx` | `ShopChrome` om `children` | 4-6/C3 |
| `app/(shop)/not-found.tsx` | `NotFoundView` zonder extra chrome | 7-9/D4 |
| `app/(shop)/page.tsx` | Homepage, secties 1 tot 16 (§14.1) | 7-9/D1 |
| `app/(shop)/collections/[handle]/page.tsx` | Collectie (§14.3) | 7-9/D3 |
| `app/(shop)/products/[handle]/page.tsx` | Productpagina (§14.2) | 7-9/D2 |
| `app/(shop)/products/[handle]/opengraph-image.tsx` | Product-OG | 10-11/E1 |
| `app/(shop)/products/layout.tsx` | `PdpStateProvider` (keuzes blijven bij wisselen van product) | 7-9/D2 |
| `app/(shop)/drops/[slug]/page.tsx` | Droppagina (§14.6) | 7-9/D3 |
| `app/(shop)/drops/[slug]/binnenkort/page.tsx` | Teaser vóór toegang | 7-9/D3 |
| `app/(shop)/drops/[slug]/opengraph-image.tsx` | Drop-OG | 10-11/E1 |
| `app/(shop)/stacks/page.tsx` | Stacks (§14.7) | 7-9/D3 |
| `app/(shop)/cadeaukaarten/page.tsx` | Cadeaukaarten (§14.8) | 7-9/D3 |
| `app/(shop)/zoeken/page.tsx` | Zoeken (§14.10) | 7-9/D3 |
| `app/(shop)/sparkela-club/page.tsx` | Club (§14.9) | 7-9/D4 |
| `app/(shop)/spark-finder/page.tsx` | Spark Finder (§14.5) | 7-9/D4 |
| `app/(shop)/over-sparkela/page.tsx` | Over Sparkela (§14.11) | 7-9/D4 |
| `app/(shop)/veelgestelde-vragen/page.tsx` | FAQ (§14.12) | 7-9/D4 |
| `app/(shop)/verzenden-en-retourneren/page.tsx` | Verzenden en retourneren (§14.13) | 4-6/C1 |
| `app/(shop)/herroepen/page.tsx` | Herroepformulier (§14.14) | 4-6/C1 |
| `app/(shop)/contact/page.tsx` | Contact (§14.15) | 4-6/C1 |
| `app/(shop)/algemene-voorwaarden/page.tsx` | Juridisch, `LegalPage` | 4-6/C1 |
| `app/(shop)/privacy/page.tsx` | Juridisch | 4-6/C1 |
| `app/(shop)/cookies/page.tsx` | Juridisch plus cookietabel | 4-6/C1 |
| `app/(shop)/account/page.tsx` | Terugval zonder account-URL | 7-9/D4 |
| `app/(shop)/checkout/page.tsx` | Demo-checkout (local) | 7-9/D4 |
| `app/api/subscribe/route.ts` | §15.2 | 4-6/C1 |
| `app/api/subscribe/confirm/route.ts` | §15.3 | 4-6/C1 |
| `app/api/herroepen/route.ts` | §15.4 | 4-6/C1 |
| `app/api/contact/route.ts` | §15.5 | 4-6/C1 |
| `app/api/cart/route.ts` | §7.4 | 4-6/C2b |
| `app/api/revalidate/route.ts` | §7.6 | 4-6/C2b |

### 3.3 components/

| Pad | Doel | Golf/eigenaar |
| --- | --- | --- |
| `components/brand/Logo.tsx`, `Monogram.tsx`, `Spark.tsx`, `LogoDefs.tsx`, `logo-paths.ts` | Woordmerk, monogram, vonk; paden uit het logoscript | 3b/B1 |
| `components/ui/*` | Primitives (§13.2) | 3b/B2 |
| `components/time/TimeSwitch.tsx`, `TimeGate.tsx`, `Countdown.tsx`, `ClockProvider.tsx`, `timeSwitchScript.ts`, `VatNotice.tsx` | Tijd in de UI (§10); `VatNotice` hier, zodat C1 (`MiniFooter`) en C3 hem in 4-6 allebei gebruiken (beslissing 138) | 3b/B2 |
| `components/media/PhotoSlot.tsx`, `VideoSlot.tsx`, `ProductPhoto.tsx` | Beeldplekken en productfoto | 3b/B2 |
| `components/legal/LegalPage.tsx`, `LegalNotice.tsx`, `Markdown.tsx`, `UpcomingHolidays.tsx` | Juridische pagina's | 4-6/C1 |
| `components/forms/SubscribeForm.tsx`, `ConsentCheckbox.tsx`, `ConfirmSubscription.tsx`, `WithdrawalForm.tsx`, `ContactForm.tsx`, `Honeypot.tsx`, `FormStatus.tsx`, `submitForm.ts` | Formulieren | 4-6/C1 |
| `components/prelaunch/WaitlistHero.tsx`, `MiniFooter.tsx` | Wachtlijst en bevestigingspagina | 4-6/C1 |
| `components/catalog/CatalogProvider.tsx` | Client-catalogus (`useCatalog`) | 4-6/C2a |
| `components/cart/CartProvider.tsx`, `useCart.ts`, `CartAnnouncer.tsx` | Cart-state; kiest de adapter uit `lib/commerce/cart/` | 4-6/C2a |
| `components/cart/CartDrawer.tsx`, `CartDrawerLoader.tsx`, `CartLineItem.tsx`, `QuantityStepper.tsx`, `CartProgressBars.tsx`, `GiftWrapToggle.tsx`, `GiftWrapPrice.tsx`, `GiftMessageField.tsx`, `CampaignCartNote.tsx`, `CartUpsell.tsx`, `CartTotals.tsx`, `CheckoutButton.tsx`, `CartEmpty.tsx` | Cart-UI | 4-6/C3 |
| `components/product/QuickAdd.tsx` | Snel toevoegen (kaart, cart-upsell) | 4-6/C3 |
| `components/layout/ShopChrome.tsx`, `AnnouncementBar.tsx`, `UspBar.tsx`, `CampaignMessage.tsx`, `DropMessage.tsx`, `Header.tsx`, `header/*`, `MobileNav.tsx`, `MobileNavSheet.tsx`, `SearchDialog.tsx`, `Footer.tsx`, `footer/*`, `PaymentBadges.tsx`, `ShipLabel.tsx`, `SkipLink.tsx`, `RouteFocus.tsx` | Chrome | 4-6/C3 (`SkipLink`, `RouteFocus` in 3a/A2; `ShopChrome` in 7-9 bij de integrator) |
| `components/consent/ConsentBanner.tsx`, `AnalyticsLoader.tsx` | Consent | 4-6/C3 |
| `components/consent/CookieSettingsButton.tsx` | Opent de consentbanner opnieuw (`OPEN_CONSENT_EVENT`); gebruikt door `/cookies` (C1) en de footer (C3) | 4-6/C1 (beslissing 138) |
| `components/product/ProductCard.tsx`, `ProductGrid.tsx`, `SortSelect.tsx`, `ProductCardSkeleton.tsx` | Kaart en grid | 4-6/C4 |
| `components/collection/CollectionView.tsx`, `FilterBar.tsx`, `FilterSheet.tsx`, `StylingTile.tsx`, `collectionQueryScript.ts`, `filterParams.ts` (+ test) | Collectie | 7-9/D3 |
| `components/pdp/*` | Productpagina (§13.9) | 7-9/D2 |
| `components/home/*` | Homesecties (§13.10) | 7-9/D1 |
| `components/drops/DropBanner.tsx`, `DropHero.tsx`, `DropTeaser.tsx`, `EarlyAccessNote.tsx` | Drops | 7-9/D3 |
| `components/stacks/StackCard.tsx`, `AddStackButton.tsx` | Stacks | 7-9/D3 |
| `components/sections/HowToStack.tsx`, `FaqList.tsx` | Gedeelde secties (home, stacks, cadeaukaarten) | 7-9/D3 |
| `components/giftcards/GiftCardTiles.tsx` | Bedragtegels met "In tas" (cadeaukaarten) | 7-9/D3 |
| `components/search/SearchView.tsx` | Zoekpagina | 7-9/D3 |
| `components/finder/SparkFinder.tsx`, `FinderQuiz.tsx`, `FinderResult.tsx`, `finderState.ts` | Spark Finder | 7-9/D4 |
| `components/email/EmailCapture.tsx`, `EmailCaptureLoader.tsx`, `SparkPill.tsx`, `SparkCards.tsx`, `RewardCode.tsx`, `state.ts` | Popup "Kies je spark" | 7-9/D4 |
| `components/checkout/CheckoutView.tsx` | Demo-checkout | 7-9/D4 |
| `components/pages/NotFoundView.tsx`, `PageHeader.tsx` | 404 (ook de fallback van het 404-patroon op PDP, collectie en drop) en paginakop | 4-6/C4 (`NotFoundView`), 3b/B2 (`PageHeader`) |
| `components/seo/JsonLd.tsx` | JSON-LD-script | 3b/B3 |
| `components/seo/OgImage.tsx` | Satori-tekeningen | 10-11/E1 |

### 3.4 content/

Twee soorten bestanden. **Data en config** (de lijst uit brief §7 plus `assets.ts` en `legal.ts`) en **copy per feature** in `content/copy/`. Elk copybestand heeft per golf één eigenaar: de agent die die UI bouwt. Hij voegt zelf sleutels toe (type en waarde in hetzelfde bestand). A2 maakt in golf 3a elk bestand aan met zijn type en de sleutels die §5.2 en §5.9 al vastleggen, zodat imports vanaf het begin werken (beslissing 94).

| Pad | Doel | Golf/eigenaar |
| --- | --- | --- |
| `content/site.ts`, `offers.ts`, `drops.ts`, `shipping.ts` | Config: volledig in golf 3a (§5.3, §9.3, §12) | 3a/A2 |
| `content/products.ts` | 24 testproducten plus `cadeauverpakking` en `cadeaukaart` | 3a/A2 minimaal (2 producten), 3b/B4 volledig |
| `content/navigation.ts`, `collections.ts`, `stacks.ts`, `reviews.ts`, `faq.ts`, `claims.ts`, `quiz.ts`, `home.ts`, `assets.ts` | Data en homecopy (§5) | 3a/A2 skelet met typen, 3b/B4 gevuld; daarna `home.ts` 7-9/D1, `collections.ts` 7-9/D3, `navigation.ts` 4-6/C3 |
| `content/legal.ts` | Index van `content/legal/*.md`; exporteert ook `type LegalSlug = "algemene-voorwaarden" \| "privacy" \| "cookies" \| "verzenden-en-retourneren" \| "herroepen"`, `legalReviewNotice` en `cookieTable` | 3a/A2 skelet, 3b/B4, 4-6/C1 |
| `content/copy/shared.ts` | `sharedCopy`: teksten die `lib/` teruggeeft (leverbalk, leverschatting, voortgang, laagste prijs, badges, countdown), generieke labels (sluiten, menu, vorige, volgende, pauzeren, laden, fout, afbeeldingslabels), cart-meldingen (`announce`), het vocabulaire voor type, vibe, moment, prijs en sortering (`vocab`) en de 404 (`notFound`) (§5.9) | 3a/A2 volledig, 3b/B2, daarna integrator |
| `content/copy/forms.ts` | `formsCopy`: aanmelden, consent-fout, bevestigen (dubbele opt-in), herroepen, contact, wachtlijst, formulierstatus, validatiefouten | 3a/A2 skelet, 4-6/C1 |
| `content/copy/chrome.ts` | `chromeCopy`: promobalk, header, zoekdialoog, mobiel menu, footer, consentbanner (de cookietabel staat in `content/legal.ts`) | 3a/A2 skelet, 4-6/C3 |
| `content/copy/cart.ts` | `cartCopy`: drawer, regels, totalen, cadeauverpakking, cadeauboodschap, upsell, meldingen, fouten, lege staat, campagneregel, quick-add | 3a/A2 skelet, 4-6/C3 |
| `content/copy/product-card.ts` | `cardCopy`: gridlabels, kaart-aria (sorteerlabels staan in `sharedCopy.vocab.sort`) | 3a/A2 skelet, 4-6/C4 |
| `content/copy/collection.ts` | `collectionCopy`: filters (de facetlabels zelf komen uit `sharedCopy.vocab`), aantal, lege staat; zoekpagina; drop-, stacks- en cadeaukaartpagina | 3a/A2 skelet, 7-9/D3 |
| `content/copy/pdp.ts` | `pdpCopy`: koopkolom, varianten, ringmaatgids, stack-kiezer, trustrij, specs, claims, accordions, GPSR, verzorging (`care.default`) | 3a/A2 skelet, 3b/B4 (`care.default`), 7-9/D2 |
| `content/copy/pages.ts` | `pagesCopy`: Over Sparkela, Club-pagina, FAQ-pagina, Spark Finder-pagina, popup, account, demo-checkout (de 404-copy staat in `sharedCopy.notFound`) | 3a/A2 skelet, 7-9/D4 |
| `content/copy/money.ts` | `moneyCopy`: de woorden van `lib/money.ts` (`rangeJoiner`); importeert niets, zodat `lib/money.ts` hem zonder importcyclus leest; `sharedCopy.money` is hetzelfde object (beslissing 183) | fase 3/fixer, daarna integrator |
| `content/legal/algemene-voorwaarden.md`, `privacy.md`, `cookies.md`, `verzenden-en-retourneren.md`, `herroepen.md` | Juridische teksten, bovenaan `TODO: laten controleren` | 4-6/C1 |
| `content/content-guard.test.ts` | Bewakers voor §2 van de brief (§19.1); scant automatisch elk bestand in `content/` en `content/copy/` | 3b/B4 |
| `content/offers.test.ts`, `content/drops.test.ts`, `content/shipping.test.ts`, `content/quiz.test.ts` | Datacontroles | 3b/B4 |

### 3.5 lib/

| Pad | Doel | Golf/eigenaar |
| --- | --- | --- |
| `lib/types.ts` | Alle domeintypen (§6) | 3a/A1 |
| `lib/env.ts` | Server-env lezen en valideren (`getEnv()`), geen secrets naar de client; `readSecret(name)` geeft `null` (plus één `console.warn`) als een geheim korter is dan 32 tekens | 3a/A1 |
| `lib/money.ts` (+ test) | `formatMoney`, `formatMoneyShort`, `parseShopifyMoney`, `cents` | 3a/A1 |
| `lib/schedule.ts` (+ test) | `scheduleAt(at, cb)`: timer naar een tijdstip in stappen van hooguit 24 uur (§10.5, beslissing 108); `phaseIndex`, `CountdownParts`, `getCountdown`, `formatCountdown` (§10.7, beslissing 137) | 3a/A1 |
| `lib/image-loader.ts` | `next/image`-loader (Shopify `?width=`, §17.1); in 3a, omdat `next.config.ts` hem noemt en Next de config anders bij elke build en typegen weigert | 3a/A1 |
| `lib/storage.ts` | Port CORVANE: `readStorage`, `writeStorage`, `removeStorage`, `readJson`, `writeJson` (alles in try/catch, `null`/`false` zonder opslag) en `storageKeys = { cart: "sparkela:cart:v1", emailCaptureLastShown: "sparkela:email-capture:last-shown", emailCaptureSubscribed: "sparkela:email-capture:subscribed", consent: "sparkela:consent:v1" }` (alle sleutels al in 3a, zodat B1, C2a, C3 en D4 niets toevoegen) | 3a/A1 |
| `lib/cn.ts`, `lib/hooks/useNow.ts`, `lib/hooks/useAfterLoad.ts`, `lib/hooks/useMediaQuery.ts`, `lib/hooks/useMounted.ts`, `lib/hooks/useLatch.ts` | Hulpjes (port CORVANE, `sparkela:`-sleutels); `useLatch(value)` blijft `true` zodra `value` één keer `true` was (lazy eilanden blijven gemount) | 3a/A1 |
| `lib/brand-colors.ts` | Hexwaarden voor plekken zonder CSS (manifest, OG, logoscript, `themeColor`) | 3a/A1 |
| `lib/commerce/types.ts` | `CatalogSource`, `CartAdapter`, `CommerceProvider`, cart-request-typen (§7.1) | 3a/A1 |
| `lib/dates.ts` (+ `lib/dates.test.ts`) | Datumlogica (§9) | 3b/B3 |
| `lib/holidays.ts` (+ test) | `easterSunday`, feestdagen berekenen voor de controle in tests | 3b/B3 |
| `lib/pricing.ts` (+ `lib/pricing.test.ts`) | Prijslogica (§8) | 3b/B3 |
| `lib/clock.ts` (+ test) | `serverNow()`, `testClockEnabled()`, `requestNow()`, `clockLife()` (puur, §10.3) | 3b/B3 |
| `lib/server-clock.ts` | `getServerNow()` (cached) | 3b/B3 |
| `lib/claims.ts` (+ test) | Alleen geverifieerde claims (§6.6) | 3b/B3 |
| `lib/reviews.ts` | `getRatingSummary()` is `null` zonder reviews | 3b/B3 |
| `lib/seo.ts` (+ test) | `pageMetadata`, JSON-LD-builders, routeconstanten (§18.1) | 3b/B3 |
| `lib/catalog.ts` (+ test) | Puur: tags, badges, zichtbaarheid, collectieregels, filter, sorteer, zoeken, `needsHygieneSeal`, `materialForVariant` (§7.2) | 4-6/C2a |
| `lib/shop-data.ts` | Cached samenstelling: catalogus + klok (§7.2) | 4-6/C2a |
| `lib/commerce/index.ts` | Provider kiezen; cached `getProducts`, `getProduct`; gewone `getCollection`, `search` | 4-6/C2a |
| `lib/commerce/local-data.ts` | Puur, synchroon, geen `server-only`: `buildLocalProducts(): Product[]` (de 26 producten uit `content/products.ts` als domeinproducten); gedeeld door de provider en `tests/fixtures/local-catalog.ts` (beslissing 140) | 4-6/C2a |
| `lib/commerce/local.ts` | Lokale catalogusprovider (`server-only`); `getProducts()` geeft `buildLocalProducts()` | 4-6/C2a |
| `lib/commerce/collections.ts` | `buildCollection(definition, products, now, drops)` op basis van regels (gedeeld) | 4-6/C2a |
| `lib/commerce/cart/local-adapter.ts` | `CartAdapter` voor `local` (client-veilig, geen `server-only`) | 4-6/C2a |
| `lib/commerce/cart/shopify-adapter.ts` | `CartAdapter` voor `shopify`: `fetch` naar `/api/cart` (client-veilig) | 4-6/C2b |
| `lib/commerce/cart-gate.ts` (+ test) | Puur: mag deze toevoeging nu (prelaunch, drop-fase, cookies)? (§7.4) | 4-6/C2b |
| `lib/commerce/shopify/config.ts` | API-versie, endpoints, tokens (§16.1), `ShopifyError` (§16.2); al in 3a, omdat C1 (`admin.ts`) en C2b hem allebei gebruiken | 3a/A1 |
| `lib/commerce/shopify/client.ts` | Alleen Storefront: `storefront<T>()`, retry, timeout | 4-6/C2b |
| `lib/commerce/shopify/queries.ts` | GraphQL-fragmenten en queries | 4-6/C2b |
| `lib/commerce/shopify/mutations.ts` | Cart-mutaties | 4-6/C2b |
| `lib/commerce/shopify/mappers.ts` (+ test) | Shopify → domein, puur | 4-6/C2b |
| `lib/commerce/shopify/catalog.ts` | Shopify-catalogusprovider | 4-6/C2b |
| `lib/commerce/shopify/cart.ts` | Cart-operaties voor `/api/cart` | 4-6/C2b |
| `lib/commerce/shopify/admin.ts` (+ test) | Admin API alleen voor `/api/subscribe` en `/api/subscribe/confirm`; `getAdminToken()` (client credentials) en de enige Admin-client `adminGraphql<T>()` (§16.2) | 4-6/C1 |
| `lib/commerce/shopify/webhooks.ts` (+ test) | HMAC-controle, topic → tags | 4-6/C2b |
| `lib/commerce/commerce.test.ts` | Providerkeuze, lokale provider, collectieregels | 4-6/C2a |
| `lib/early-access.ts` (+ test) | Token maken en controleren (Web Crypto) | 4-6/C1 |
| `lib/preview.ts` (+ test) | Preview-cookie hash | 4-6/C1 |
| `lib/forms/validation.ts` (+ test) | Validatie van alle formulieren | 4-6/C1 |
| `lib/forms/rate-limit.ts` (+ test) | Eenvoudige rate limit | 4-6/C1 |
| `lib/forms/responses.ts` | `FormResponse`-helpers | 4-6/C1 |
| `lib/forms/confirm-token.ts` (+ test) | Token voor de dubbele opt-in maken en controleren (HMAC, 7 dagen geldig) | 4-6/C1 |
| `lib/mail.ts` (+ test) | Resend via `fetch`, mailteksten, HTML-escaping | 4-6/C1 |
| `lib/analytics.ts` (+ test) | dataLayer, consent, Consent Mode (§13.6); al in 3b, omdat `CartProvider` en `SubscribeForm` in 4-6 paar 1 `track()` aanroepen | 3b/B1 |
| `lib/subscription.ts` (+ test) | `markSubscribed()`, `hasSubscribed()`, `useSubscribed()` op `storageKeys.emailCaptureSubscribed` (`sparkela:email-capture:subscribed`), client-veilig | 3b/B1 |

### 3.6 Overig

| Pad | Doel | Golf/eigenaar |
| --- | --- | --- |
| `scripts/build-logo.mjs` | Logo naar paden, SVG's, iconen (§13.1) | 3b/B1 |
| `scripts/capture-reference.mjs` | Bestaat al, niet aanpassen | n.v.t. |
| `scripts/early-access-link.mjs` | Print de early-access-link per drop (leest `EARLY_ACCESS_SECRET`) | 4-6/C1 |
| `tests/unit/shopify-live.test.ts` | Leestest tegen de echte winkel, alleen met `SHOPIFY_LIVE_TEST=1`; logt de query-cost | 4-6/C2b |
| `public/brand/logo-inkt.svg`, `logo-botwit-op-roest.svg`, `logo-roest.svg`, `logo-botwit.svg`, `logo-op-inkt.svg`, `monogram-inkt.svg`, `monogram-botwit.svg`, `monogram-roest.svg`, `monogram-botwit-op-roest.svg`, `monogram-botwit-op-inkt.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`; daarnaast (beslissing 162) `logo-botwit-vonk-roest.svg`, `logo-inkt-vonk-botwit.svg`, `logo-roest-op-botwit.svg`, `logo-botwit-op-olijf.svg`, `logo-botwit-op-leisteen.svg`, `logo-inkt-op-steen.svg`, `vonk-roest.svg`, `vonk-botwit.svg`, `vonk-inkt.svg` | Merkbestanden | 3b/B1 |
| `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | Verwijderen | 3a/A2 |
| `public/images/**`, `public/videos/` | Lege mappen met `.gitkeep`; vaste bestandsnamen uit `content/assets.ts` | 3b/B4 (`public/videos/`: integrator 3b) |
| `assets/fonts/unbounded-latin-800-normal.woff`, `inter-latin-400-normal.woff`, `inter-latin-600-normal.woff`, `OFL-Unbounded.txt`, `OFL-Inter.txt` | Fonts voor OG (Satori leest geen WOFF2) | 10-11/E1 |
| `data/shopify-products.csv` | Dezelfde producten in het importformaat van Shopify, met metafields | 3b/B4 |
| `tests/fixtures/shopify/*.json` | Opgeslagen responses (§16.8) | 4-6/C2b (`admin-*`: C1) |
| `tests/unit/proxy.test.ts` | Proxygedrag | 4-6/C1 |
| `tests/unit/api-cart.test.ts`, `tests/unit/api-revalidate.test.ts` | Route handlers met fixtures | 4-6/C2b |
| `tests/unit/api-forms.test.ts` | Formulierroutes, incl. `/api/subscribe/confirm` | 4-6/C1 |
| `tests/unit/contrast.test.ts` | WCAG-ratio's van §4.10 | 3b/B2 |
| `tests/e2e/fixtures.ts` en specs | Playwright (§19.2) | 10-11/E2 |
| `tests/unit/og.test.ts`, `tests/fixtures/og-photo.jpg` | OG rendert een JPEG-foto niet transparant; `ogPhotoUrl()` zet `format=jpg` en geeft `null` bij WebP (§17.3) | 10-11/E1 |
| `tests/unit/robots.test.ts` | `robots()` volgens §18.1 | 10-11/E1 |
| `docs/PLAN.md`, `docs/DECISIONS.md` | Dit plan en beslissingen | fase 2 |
| `docs/METAFIELDS.md`, `docs/ASSETS.md` | Shopify-inrichting (metafields uit §6.4, tags, collecties, kortingen en hun combinaties uit §16.6) en de shotlist voor Linde (uit §17.2 en `content/assets.ts`, met bestandsnamen en maten). Al met de wachtlijst, zodat Tristan en Linde vanaf 30 oktober kunnen werken (beslissing 122) | 4-6/C4; 12/F1 werkt bij |
| `docs/COMPLIANCE.md`, `docs/TODO-LAUNCH.md` | Oplevering (TODO-LAUNCH volgens §16.9) | 12/F1 |
| `docs/QA-NOTES.md` | Meetresultaten van golf 10-11 (axe, Lighthouse, screenshots, open punten) voor F1 | 10-11/integrator en E3 |

`vercel.json` komt er niet: er is geen cron (beslissing 52).

### 3.7 Pakketten

Bestaande dependencies blijven. Toevoegen in golf 3a (alleen A1 wijzigt `package.json` en `package-lock.json`):

- `@radix-ui/react-tabs` (dependency, ^1.1) voor de typetabs op de home.
- `@fontsource/inter` (devDependency, ^5) voor de OG-font (WOFF).
- `server-only` (dependency, ^0.0.1), zodat TypeScript de import kent. Vitest koppelt `server-only` via `resolve.alias` aan een leeg bestand `tests/stubs/server-only.ts`.

Geen andere pakketten zonder wijziging in dit plan.

### 3.8 next.config.ts

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // All metadata is static; bots get the static shell too (CORVANE D54.2). Remove if a route ever streams metadata.
  htmlLimitedBots: /[^\s\S]/,
  images: { loader: "custom", loaderFile: "./lib/image-loader.ts" },
  turbopack: { rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } } },
};

export default nextConfig;
```

### 3.9 Omgevingsvariabelen (`.env.example`)

| Variabele | Waar gelezen | Verplicht | Uitleg |
| --- | --- | --- | --- |
| `COMMERCE_PROVIDER` | server, build | nee (`local`) | `local` of `shopify`; productie altijd `shopify` |
| `NEXT_PUBLIC_SITE_URL` | build | nee (`https://sparkela.nl`) | Basis voor `metadataBase`, sitemap, JSON-LD |
| `SHOPIFY_STORE_DOMAIN` | server | bij `shopify` | `sparkela.myshopify.com` (zonder `https://`) |
| `SHOPIFY_STOREFRONT_ACCESS_TOKEN` | server | bij `shopify` | Privétoken van het Headless-kanaal |
| `SHOPIFY_STOREFRONT_TOKEN_TYPE` | server | nee (`private`) | `private` of `public` (headernaam, §16.1) |
| `SHOPIFY_ADMIN_CLIENT_ID` | server | voor `/api/subscribe` | Client-id van de app in het Dev Dashboard (scopes `read_customers`, `write_customers`) |
| `SHOPIFY_ADMIN_CLIENT_SECRET` | server | voor `/api/subscribe` | Client-secret; `getAdminToken()` ruilt id en secret voor een token van ongeveer 24 uur (§16.1) |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | server | nee | Optionele override voor een winkel die nog een oude custom app met vast `shpat_`-token heeft |
| `SHOPIFY_WEBHOOK_SECRET` | server | voor `/api/revalidate` | Sleutel waarmee Shopify webhooks ondertekent |
| `SHOPIFY_CUSTOMER_ACCOUNT_URL` | proxy | nee | Doel van `/account`, bijvoorbeeld `https://account.sparkela.nl` |
| `REVALIDATE_SECRET` | server | nee | Bearer-token voor handmatige revalidatie |
| `MAIL_API_KEY` | server | voor herroepen/contact | Resend API-sleutel |
| `MAIL_FROM` | server | idem | `Sparkela <hallo@sparkela.nl>` (geverifieerd domein) |
| `MAIL_TO` | server | idem | Inbox van Sparkela voor kopieën |
| `PRELAUNCH_BYPASS_TOKEN` | proxy | nee | Geheim voor de preview-link |
| `EARLY_ACCESS_SECRET` | proxy, server | nee | Geheim voor early-access-links; zonder variabele werkt early access niet (fail closed) |
| `NEWSLETTER_CONFIRM_SECRET` | server | voor `/api/subscribe` | Geheim voor de bevestigingslink van de dubbele opt-in; zonder variabele antwoordt `/api/subscribe` `not-configured` |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | build | nee (`false`) | Consentbanner en GTM alleen bij `true` |
| `NEXT_PUBLIC_GTM_ID` | build | nee | `GTM-XXXXXXX` |
| `SPARKELA_TEST_CLOCK` | proxy, server | nee | `1` zet de testklok aan; genegeerd als `VERCEL_ENV === "production"` |
| `SPARKELA_TEST_NOW` | proxy, server | nee | ISO-tijd voor de testklok (§10.3) |
| `SHOPIFY_LIVE_TEST`, `SHOPIFY_LIVE_ADMIN` | Vitest | nee | `1` zet `npm run test:shopify` aan, en met `SHOPIFY_LIVE_ADMIN=1` ook de Admin-test van §11.9 stap 3 (maakt een testklant) |

Geheimen (`PRELAUNCH_BYPASS_TOKEN`, `EARLY_ACCESS_SECRET`, `NEWSLETTER_CONFIRM_SECRET`, `REVALIDATE_SECRET`, `SHOPIFY_WEBHOOK_SECRET` niet, want die kiest Shopify) zijn minstens 32 tekens. Maak ze met `openssl rand -base64 32`. Een korter geheim telt als afwezig (`readSecret`, beslissing 91), dus de functie werkt dan niet (fail closed).

---

## 4. Ontwerpsysteem

### 4.1 Tokens in `app/globals.css`

Componenten gebruiken alleen deze rollen, via Tailwind-klassen of `var(--…)`. Nooit een hexcode in een component (§21). De enige plekken met hexcodes zijn `app/globals.css` en `lib/brand-colors.ts` (voor manifest, OG en logoscript).

```css
@import "tailwindcss";

:root {
  /* merk */
  --inkt: #171717; --bot-wit: #E8E0D4; --steen: #77766F;
  --olijf: #59634B; --roest: #713B32; --leisteen: #344B65;

  /* achtergronden */
  --pagina: #F2EADE; --vlak: #E8E0D4; --kaart: #FFFFFF; --donker: #171717;

  /* tekst */
  --tekst: #171717; --tekst-2: #565550; --tekst-gedempt: #77766F;
  --tekst-op-donker: #E8E0D4; --tekst-2-op-donker: #ACA79E;

  /* interactie */
  --primair: #713B32; --primair-hover: #603028; --primair-tekst: #E8E0D4;
  --link: #344B65; --link-hover: #713B32; --focus: #344B65;

  /* lijnen */
  --rand: #CAC3B9; --rand-sterk: #A9A8A2;
  --rand-invoer: #77766F;          /* afgeleid: 3:1 voor invoervelden, radio's en stepper (WCAG 1.4.11) */
  --rand-op-donker: #413F3D;       /* bot-wit 800: haarlijn op --donker */

  /* productweergave en vlag: geen merkkleuren, alleen voor swatches en de NL-vlag */
  --swatch-goud: #C9A45C; --swatch-zilver: #BFC1C2;
  --vlag-rood: #AE1C28; --vlag-wit: #FFFFFF; --vlag-blauw: #21468B;

  /* status */
  --succes: #59634B; --succes-vlak: #E9EDE3;
  --fout: #713B32; --fout-vlak: #FBE6E2;
  --info: #344B65; --info-vlak: #E4ECF6;

  /* tinten (brief §5) */
  --inkt-50: #F7F7F7; --inkt-100: #EBEBEB; --inkt-200: #DBDBDB; --inkt-300: #C4C4C4; --inkt-400: #A8A8A8;
  --inkt-500: #898989; --inkt-600: #6F6F6F; --inkt-700: #555555; --inkt-800: #404040; --inkt-900: #171717;
  --bot-wit-50: #FDF6EB; --bot-wit-100: #F2EADE; --bot-wit-200: #E8E0D4; --bot-wit-300: #CAC3B9; --bot-wit-400: #ACA79E;
  --bot-wit-500: #8D8882; --bot-wit-600: #716E69; --bot-wit-700: #575551; --bot-wit-800: #413F3D; --bot-wit-900: #2D2B28;
  --steen-50: #F7F7F3; --steen-100: #ECEBE7; --steen-200: #DBDBD7; --steen-300: #C5C4BF; --steen-400: #A9A8A2;
  --steen-500: #8A8983; --steen-600: #77766F; --steen-700: #565550; --steen-800: #41403B; --steen-900: #2C2B28;
  --olijf-50: #F5F8F0; --olijf-100: #E9EDE3; --olijf-200: #D8DDD1; --olijf-300: #C1C7B9; --olijf-400: #A3AB9A;
  --olijf-500: #848D79; --olijf-600: #69735C; --olijf-700: #59634B; --olijf-800: #3B4330; --olijf-900: #282E1E;
  --roest-50: #FFF1ED; --roest-100: #FBE6E2; --roest-200: #ECD5D0; --roest-300: #D9BDB7; --roest-400: #C29E97;
  --roest-500: #A87D75; --roest-600: #916158; --roest-700: #713B32; --roest-800: #603028; --roest-900: #461D17;
  --leisteen-50: #EFF8FF; --leisteen-100: #E4ECF6; --leisteen-200: #D3DCE6; --leisteen-300: #BAC5D2; --leisteen-400: #9BA9BA;
  --leisteen-500: #7A8B9F; --leisteen-600: #5D7187; --leisteen-700: #415770; --leisteen-800: #344B65; --leisteen-900: #1B2D41;

  /* vorm (bronnaam verschilt van de Tailwind-naam: geen zelfverwijzing in @theme) */
  --hoek-kaart: 16px;
  --schaduw-hover: 0 1px 2px rgb(23 23 23 / 0.04), 0 8px 24px rgb(23 23 23 / 0.08);
  --schaduw-zwevend: 0 2px 4px rgb(23 23 23 / 0.06), 0 16px 40px rgb(23 23 23 / 0.14);

  /* focus: per vlak overschreven (4.8) */
  --ring: var(--focus);

  /* vaste hoogtes van de chrome (geen CLS) */
  --promo-hoogte: 48px;
  --header-hoogte: 64px;
}

@media (min-width: 64rem) { :root { --promo-hoogte: 40px; } }
@media (min-width: 80rem) { :root { --header-hoogte: 72px; } }

@theme inline {
  --color-*: initial;               /* geen standaardpalet van Tailwind: alleen Sparkela-kleuren bestaan */
  --color-transparent: transparent;
  --color-current: currentColor;

  --color-inkt: var(--inkt); --color-bot-wit: var(--bot-wit); --color-steen: var(--steen);
  --color-olijf: var(--olijf); --color-roest: var(--roest); --color-leisteen: var(--leisteen);
  --color-pagina: var(--pagina); --color-vlak: var(--vlak); --color-kaart: var(--kaart); --color-donker: var(--donker);
  --color-tekst: var(--tekst); --color-tekst-2: var(--tekst-2); --color-tekst-gedempt: var(--tekst-gedempt);
  --color-tekst-op-donker: var(--tekst-op-donker); --color-tekst-2-op-donker: var(--tekst-2-op-donker);
  --color-primair: var(--primair); --color-primair-hover: var(--primair-hover); --color-primair-tekst: var(--primair-tekst);
  --color-link: var(--link); --color-link-hover: var(--link-hover); --color-focus: var(--focus);
  --color-rand: var(--rand); --color-rand-sterk: var(--rand-sterk); --color-rand-invoer: var(--rand-invoer);
  --color-rand-op-donker: var(--rand-op-donker);
  --color-swatch-goud: var(--swatch-goud); --color-swatch-zilver: var(--swatch-zilver);
  --color-vlag-rood: var(--vlag-rood); --color-vlag-wit: var(--vlag-wit); --color-vlag-blauw: var(--vlag-blauw);
  --color-succes: var(--succes); --color-succes-vlak: var(--succes-vlak);
  --color-fout: var(--fout); --color-fout-vlak: var(--fout-vlak);
  --color-info: var(--info); --color-info-vlak: var(--info-vlak);
  /* plus elke tint: --color-roest-100: var(--roest-100); enzovoort, voor alle zes kleuren en 50 tot 900 */

  --font-sans: var(--font-inter), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: var(--font-unbounded), var(--font-inter), ui-sans-serif, system-ui, sans-serif;

  --radius-kaart: var(--hoek-kaart);
  --shadow-hover: var(--schaduw-hover);
  --shadow-zwevend: var(--schaduw-zwevend);
  --spacing-promo: var(--promo-hoogte);
  --spacing-header: var(--header-hoogte);
  --breakpoint-xs: 23.75rem;        /* 380 px: kleine telefoons */
}
```

- Het `:root`-blok met tokens staat **buiten** elke `@layer` (unlayered). Zet het nooit in `@layer base`: de `@theme inline`-variabelen in `@layer theme` verwijzen ernaar. Een token in `@theme inline` heeft nooit dezelfde naam als zijn bron (`--radius-kaart: var(--hoek-kaart)`, niet `var(--radius-kaart)`), anders is de variabele cyclisch en is `rounded-kaart` 0.
- Reken in CSS niet op variabelen uit `@theme inline`: Tailwind geeft ze alleen als CSS-variabele uit als zijn scanner de naam ergens in de bronbestanden ziet (gemeten in 3a, beslissing 156). Schrijf in CSS dus `--theme(--font-display)` en `--theme(--font-sans)` (niet `var(--font-display)`), en voor hoogtes de bronvariabelen `var(--header-hoogte)` en `var(--promo-hoogte)` (niet `var(--spacing-header)`). Tailwind-klassen (`font-display`, `h-header`, `min-h-promo`) werken gewoon. `globals.css` sluit `docs/` uit van de scan (`@source not "../docs"`), zodat klassen die alleen in dit plan staan nooit in de CSS komen.

**Klassen die agents gebruiken** (voorbeelden): `bg-pagina`, `bg-vlak`, `bg-kaart`, `bg-donker`, `text-tekst`, `text-tekst-2`, `text-tekst-gedempt`, `text-tekst-op-donker`, `text-tekst-2-op-donker`, `bg-primair`, `hover:bg-primair-hover`, `text-primair-tekst`, `text-link`, `hover:text-link-hover`, `border-rand`, `border-rand-invoer`, `bg-succes-vlak text-succes`, `bg-fout-vlak text-fout`, `bg-info-vlak text-info`, `bg-roest-100`, `text-leisteen-800`, `rounded-kaart`, `shadow-hover`, `shadow-zwevend`, `font-display`, `h-header`, `min-h-promo`, overlay `bg-inkt/45`.

### 4.2 Kleurregels (brief §5, als code)

- Verhouding per pagina ongeveer 70% bot-wit en wit, 20% inkt en steen, 10% roest, leisteen en olijf.
- Vlakken: pagina `bg-pagina`; secties, banners en menu `bg-vlak`; kaarten, invoervelden en foto's `bg-kaart`; hero, aankondigingsbalk en footer `bg-donker`.
- Roest is de enige knopkleur. Primaire knop `bg-primair text-primair-tekst hover:bg-primair-hover`. Op een roest vlak: knop `bg-bot-wit text-roest`. Andere knoppen hebben geen vulling: `outline`, `outline-op-donker`, `ghost` en `link` (beslissing 77). Nooit een knop gevuld met inkt, steen, olijf of leisteen.
- Leisteen is de enige linkkleur (`text-link hover:text-link-hover underline-offset-4`). Op `--donker`: `text-tekst-op-donker hover:underline`.
- Roest, leisteen en olijf nooit op elkaar. Op roest, leisteen en olijf staat altijd bot-wit, nooit inkt.
- `--tekst-gedempt` alleen op `--kaart` (4,56:1), of als grote tekst vanaf 24 px of 18,66 px vet (beslissing 43, strenger dan "vanaf 18 px" in de brief, omdat 3,82:1 op `--pagina` alleen voor grote tekst AA haalt).
- `--rand` en `--rand-sterk` zijn decoratief (kaarten, haarlijnen). Grenzen van bedieningselementen (invoerveld, select, radio, checkbox, stepper) gebruiken `--rand-invoer`.

### 4.3 Typografie

`next/font/google` in `app/layout.tsx`:

```ts
const unbounded = Unbounded({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-unbounded", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// <html lang="nl" className={`${inter.variable} ${unbounded.variable} antialiased`}>
```

Utilities in `globals.css` (via `@utility`), zodat maten op één plek staan:

| Utility | Font | Mobiel | Vanaf `md` | Vanaf `lg` | Regelhoogte | Tracking | Gebruik |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `kop-1` | Unbounded 800 | 32 px | 40 px | 48 px | 1.1 | -0.01em | H1 (één per pagina) |
| `kop-2` | Unbounded 800 | 24 px | 28 px | 32 px | 1.15 | -0.01em | H2 sectiekoppen |
| `kop-3` | Unbounded 700 | 18 px | 20 px | 22 px | 1.25 | 0 | H3, kaarttitels in secties |
| `kop-4` | Inter 600 | 16 px | 16 px | 17 px | 1.35 | 0 | Productnaam op kaart, accordiontriggers |
| `tekst-groot` | Inter 400 | 18 px | 18 px | 20 px | 1.5 | 0 | Subregels, intro's |
| (body) | Inter 400 | 16 px | 16 px | 16 px | 1.5 | 0 | Standaard |
| `tekst-klein` | Inter 400 | 14 px | 14 px | 14 px | 1.45 | 0 | Specregels, hulpteksten |
| `label-caps` | Inter 600 | 12 px | 12 px | 12 px | 1.33 | 0.06em | Eyebrows, labels, badges (kapitalen) |
| `tabular` | | | | | | | `font-variant-numeric: tabular-nums` (prijzen, timers) |

- Unbounded 900 komt alleen in het logo voor, en dat is een SVG.
- `h1, h2, h3` krijgen in `@layer base` `text-wrap: balance`; `p` krijgt `text-wrap: pretty`.
- `label-caps` nooit op tekst met een eenheid ("20 mm" wordt anders "20 MM"). Gebruik dan `tekst-klein font-semibold`.
- Leesbreedte: tekstblokken `max-w-[36rem]`, FAQ-antwoorden `max-w-[34rem]` (rem, niet `ch`).

### 4.4 Ruimte, ritme en kader

- **Container** (`components/ui/Container.tsx`): `mx-auto w-full max-w-[1240px] px-5 md:px-8` (20 px mobiel, 32 px vanaf 768). Gemeten kader van CORVANE (`docs/REFERENCE.md` §2.1).
- **Breakpoints**: Tailwind-standaard `sm` 640, `md` 768, `lg` 1024, `xl` 1280, plus `xs` 380.
- **Sectieritme**: `@utility sectie { padding-block: 4rem; } @media (md) 6rem; (lg) 7rem;` (64 / 96 / 112 px). Korte secties (`sectie-kort`): 48 / 64 / 80 px. Twee secties op hetzelfde vlak na elkaar krijgen een haarlijn (`border-t border-rand`) over de containerbreedte.
- **Grid**: productgrid 2 kolommen (gap 12 / rij 32 px) mobiel, 3 vanaf `md` (24 / 48), 4 vanaf `xl` (24 / 56).
- **Kopblok** (`SectionHeading`): eyebrow (`label-caps`, 16 px eronder), kop, intro (`tekst-groot text-tekst-2`, 12 px eronder). Actie (link of select) rechts vanaf `md`, eronder op mobiel.

### 4.5 Vorm, randen en schaduw

- Kaarten, media, drawers, modals en optietegels: `rounded-kaart` (16 px). Knoppen, chips, pills, invoervelden, selects en badges: `rounded-full`.
- Kaart: `bg-kaart border border-rand`. Geen schaduw in rust; `hover:shadow-hover` alleen op pointer-apparaten (`@media (hover: hover)`), met 200 ms transitie.
- Zwevende lagen (cart drawer, menu, modal, pill, megamenu-paneel, consentbanner) mogen `shadow-zwevend` (beslissing 44).
- Overlay achter dialogs: `bg-inkt/45`.

### 4.6 Lagen (z-index)

| Laag | z-index | Element |
| --- | --- | --- |
| Header (sticky) en megamenu-paneel | 30 | `Header` |
| Sticky koopbalk | 40 | `StickyAddToCart` |
| Spark-pill | 45 | `SparkPill` |
| Consentbanner | 50 | `ConsentBanner` |
| Drawers, modals, zoekdialoog | 60 | `Sheet`, `Modal` |
| Skiplink | 70 | `SkipLink` |

Geen voorouder van de header zet `overflow` (anders werkt `sticky` niet). `body` is `flex min-h-dvh flex-col`, `main` is `flex-1`. Pagina's renderen geen eigen `<main>`. `html { scroll-padding-top: calc(var(--header-hoogte) + 16px); }`.

### 4.7 Beweging

| Element | In | Uit | Easing |
| --- | --- | --- | --- |
| Sheet (drawer, menu) | 360 ms schuiven | 240 ms | `cubic-bezier(0.32,0.72,0,1)` in, `cubic-bezier(0.4,0,1,1)` uit |
| Modal | 320 ms fade + 12 px omhoog + schaal 0.98 → 1 | 200 ms | idem |
| Accordion | 280 ms hoogte | 220 ms | ease-out |
| Overlay | 300 ms fade | 200 ms | linear |
| Megamenu-paneel | 200 ms fade + 4 px omlaag | 150 ms | ease-out |
| Knop indrukken | schaal 0.98 | | |
| Kaart hover | tweede foto 300 ms crossfade, schaduw 200 ms | | |

- Keyframes heten `sparkela-*` en staan in `components/ui/MotionStyles.tsx` (React `<style href precedence>`).
- Elke animatie staat achter `motion-safe:`. Globaal in `globals.css`: bij `prefers-reduced-motion: reduce` zijn alle duurtijden 0.01 ms en is `scroll-behavior` `auto`.
- Rotatie (USP-balk) en timers hebben een pauzeknop (WCAG 2.2.2). Met reduced motion roteert de USP-balk niet: op mobiel staat de eerste USP vast, met een knop "Volgende" (beslissing 59).
- Geen autoplay van video. Geen parallax.

### 4.8 Focus

```css
@layer base {
  :focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  [data-vlak="donker"], [data-vlak="roest"], [data-vlak="olijf"], [data-vlak="leisteen"] { --ring: var(--bot-wit); }
  [data-vlak="roest"], [data-vlak="olijf"], [data-vlak="leisteen"] { --tekst-2-op-donker: var(--bot-wit); }
}
```

- Elk interactief element krijgt de ring. Nooit `outline: none` zonder vervanging.
- Secties en componenten op een donker of gekleurd vlak zetten `data-vlak="donker" | "roest" | "olijf" | "leisteen"` op hun wortel. Zo wordt de ring bot-wit (13,70:1 op donker, 6,76:1 op roest, 4,85:1 op olijf, 6,86:1 op leisteen). Op roest, olijf en leisteen wordt ook `--tekst-2-op-donker` bot-wit: #ACA79E haalt daar geen AA (3,70 / 2,65 / 3,75), dus een primitive met `tone="donker"` (SectionHeading, Price, Stars, VatNotice, Accordion) blijft op elk donker of gekleurd vlak AA, zolang het vlak `data-vlak` draagt (beslissing 186).
- De geselecteerde staat (swatch, tegel, chip) is een andere vorm dan de focusring: een rand van 2 px in `--tekst` plus een vinkje. Nooit alleen kleur.
- Focus verdwijnt nooit achter vaste UI (WCAG 2.4.11): sticky koopbalk, consentbanner en pill zetten `scroll-padding-bottom` (port CORVANE D52.4, D53.5).

### 4.9 Statuslabels

`components/ui/StatusLabel.tsx`, `label-caps`, `rounded-full`, hoogte 20 px (kaart) of 24 px (PDP), padding 8 px. Twee soorten (beslissing 78):

- **Marketingbadges** (`nieuw`, `limited`, `laatste-stuks`, `sale`, `bestseller`): verschijnen alleen als ze in `site.badges.enabled` staan én hun eigen regel klopt (§6.5). Bij de lancering staat `enabled` op `["nieuw", "limited", "laatste-stuks"]` (brief §2.7).
- **Beschikbaarheidsstatus** (`uitverkocht`, `early-access`, `op-voorraad`): feitelijke status, geen marketing. Altijd aan als de feiten kloppen.

Er is geen label "Lindes favoriet": de titel van de carrousel zegt het al.

| Label (`BadgeId`) | Soort | Tekst | Klassen | Contrast |
| --- | --- | --- | --- | --- |
| `op-voorraad` | status | Op voorraad | `bg-succes-vlak text-succes` | 5,34 |
| `uitverkocht` | status | Uitverkocht | `bg-vlak text-tekst` | 13,70 |
| `early-access` | status | Early access | `bg-roest text-bot-wit` | 6,76 |
| `laatste-stuks` | marketing | Laatste stuks | `bg-fout-vlak text-fout` | 7,38 |
| `sale` | marketing | Sale | `bg-fout-vlak text-fout` | 7,38 |
| `nieuw` | marketing | Nieuw | `bg-info-vlak text-info` | 7,53 |
| `limited` | marketing | Limited | `bg-roest text-bot-wit` | 6,76 |
| `bestseller` | marketing | Bestseller | `bg-donker text-tekst-op-donker` | 13,70 |

Forced colors: labels krijgen `forced-colors:border forced-colors:border-[CanvasText]`.

### 4.10 Contrasttabel (WCAG AA, berekend)

Berekend met de WCAG-formule voor relatieve luminantie. `tests/unit/contrast.test.ts` rekent deze tabel opnieuw uit uit de waarden in `lib/brand-colors.ts` en faalt als een "toegestaan"-paar onder de grens zakt.

| Voorgrond | Achtergrond | Ratio | Oordeel | Gebruik |
| --- | --- | --- | --- | --- |
| `--tekst` #171717 | `--pagina` #F2EADE | 15,02 | AA | alle tekst |
| `--tekst` | `--vlak` #E8E0D4 | 13,70 | AA | alle tekst |
| `--tekst` | `--kaart` #FFFFFF | 17,93 | AA | alle tekst |
| `--tekst-2` #565550 | `--pagina` | 6,26 | AA | secundaire tekst |
| `--tekst-2` | `--vlak` | 5,71 | AA | secundaire tekst |
| `--tekst-2` | `--kaart` | 7,47 | AA | secundaire tekst |
| `--tekst-gedempt` #77766F | `--kaart` | 4,56 | AA | hulptekst op kaarten |
| `--tekst-gedempt` | `--pagina` | 3,82 | alleen groot | vanaf 24 px of 18,66 px vet |
| `--tekst-gedempt` | `--vlak` | 3,48 | alleen groot | vanaf 24 px of 18,66 px vet |
| `--link` #344B65 | `--pagina` / `--vlak` / `--kaart` | 7,52 / 6,86 / 8,97 | AA | links |
| `--link-hover` (roest) #713B32 | `--pagina` / `--vlak` / `--kaart` | 7,41 / 6,76 / 8,85 | AA | link hover, roest tekst |
| `--primair-tekst` #E8E0D4 | `--primair` #713B32 | 6,76 | AA | primaire knop |
| `--primair-tekst` | `--primair-hover` #603028 | 8,22 | AA | knop hover |
| `--roest` | `--bot-wit` | 6,76 | AA | knop op roest vlak, logo secundair |
| `--tekst-op-donker` #E8E0D4 | `--donker` | 13,70 | AA | tekst op donker |
| `--tekst-2-op-donker` #ACA79E | `--donker` | 7,49 | AA | secundaire tekst op donker |
| `--bot-wit` | `--olijf` #59634B | 4,85 | AA | garantieblok |
| `--bot-wit` | `--leisteen` #344B65 | 6,86 | AA | leisteen vlakken |
| `--succes` | `--succes-vlak` | 5,34 | AA | Op voorraad, succesmeldingen |
| `--fout` | `--fout-vlak` | 7,38 | AA | Laatste stuks, Sale, foutmeldingen |
| `--info` | `--info-vlak` | 7,53 | AA | Nieuw, infomeldingen |
| `--tekst` | `--succes-vlak` / `--fout-vlak` / `--info-vlak` | 15,10 / 14,96 / 15,05 | AA | lopende tekst in meldingen |
| `--focus` | `--pagina` / `--vlak` / `--kaart` | 7,52 / 6,86 / 8,97 | ≥ 3 | focusring (niet-tekst) |
| `--bot-wit` (ring) | `--donker` / `--roest` | 13,70 / 6,76 | ≥ 3 | focusring op donker en roest |
| `--bot-wit` (ring) | `--olijf` / `--leisteen` | 4,85 / 6,86 | ≥ 3 | focusring op olijf en leisteen |
| `--rand-invoer` #77766F | `--kaart` / `--pagina` | 4,56 / 3,82 | ≥ 3 | randen van invoervelden |
| `--rand-sterk` #A9A8A2 | `--kaart` | 2,38 | **niet** voor bedieningsgrenzen | alleen decoratief |
| `--rand` #CAC3B9 | `--kaart` | 1,75 | decoratief | kaartranden, haarlijnen |
| `--roest` | `--donker` | 2,03 | **verboden** als tekst of dunne lijn | geen roest tekst, icoon of haarlijn op donker (de vonk in het logo is decoratief). Een gevulde `primair`-knop op donker mag wel: het label haalt 6,76:1 op de roest vulling, en de knop heeft een label als naam (een rand van de knop is voor 1.4.11 niet nodig) |
| `--leisteen` (focus) | `--donker` | 2,00 | **verboden** | daarom bot-witte ring op donker |
| `--tekst-2-op-donker` #ACA79E | `--roest` | 3,70 | **verboden** als tekst | op roest alleen bot-wit (`data-vlak="roest"` maakt de rol bot-wit, §4.8) |
| `--tekst-2-op-donker` #ACA79E | `--olijf` | 2,65 | **verboden** als tekst | op olijf alleen bot-wit (idem) |
| `--tekst-2-op-donker` #ACA79E | `--leisteen` | 3,75 | **verboden** als tekst | op leisteen alleen bot-wit (idem) |
| `--bot-wit` | `--steen` #77766F | 3,48 | alleen groot | steen als vlak vermijden |
| `--inkt` #171717 | `--steen` | 3,93 | logo (vrijgesteld, WCAG 1.4.3 logotypes) | `Logo variant="op-steen"`: het woordmerk is geen tekst om te lezen; nooit lopende tekst in inkt op steen |

### 4.11 Forced colors en print

- Gevulde knoppen hebben een transparante rand van 1 px (forced colors tekent die).
- Invoervelden hebben een echte `border`, geen ring via `box-shadow`.
- Voortgangsbalken: vulling `forced-color-adjust-none forced-colors:bg-[CanvasText]`, spoor `forced-colors:bg-[GrayText]`.
- SVG-iconen gebruiken `currentColor`. Het logo krijgt `forced-colors:[&_path]:fill-[CanvasText]`.
- Print: `print:hidden` op skiplink, aankondigingsbalk, header, footer, pill, consentbanner en sticky koopbalk.

---

## 5. Content-modules

Alle tekst die bezoekers zien staat in `content/`. Componenten importeren copy, nooit literals (uitzondering: `aria-hidden` decoratie). Bedragen en tijden in copy worden afgeleid uit config (`offers.ts`, `shipping.ts`), via functies met al opgemaakte waarden, zodat copy en config nooit uit elkaar lopen. Alle typen komen uit `lib/types.ts` (§6). Elk bestand exporteert benoemde constanten met een expliciet type (`export const x: T = …` of `satisfies`).

### 5.1 Overzicht

| Bestand | Exports | Type(n) | Inhoud |
| --- | --- | --- | --- |
| `content/site.ts` | `site` | `SiteConfig` | Merk, `launchAt`, contact, bedrijfsgegevens (placeholders), socials, betaalmethoden, btw-teksten, drempels, badges, USP's, consenttekst, Club-belofte, hygiëneregel, e-mailpopup-config, analytics-config |
| `content/navigation.ts` | `mainNav`, `mobileNav`, `footerNav`, `legalNav` | `NavItem[]`, `MobileNavConfig`, `FooterColumn[]`, `NavLink[]` | §2.5 |
| `content/products.ts` | `products` | `LocalProductInput[]` | 24 testproducten plus `cadeauverpakking` en `cadeaukaart` (§5.4). Alleen `lib/commerce/local-data.ts` en tests importeren dit bestand |
| `content/collections.ts` | `collections` | `CollectionDefinition[]` | §2.3, met titel, intro, SEO, optionele stylingtegel |
| `content/stacks.ts` | `stacks` | `Stack[]` | Lindes stacks van 3 (§5.5) |
| `content/offers.ts` | `welcomeCode`, `stackDiscount`, `giftWrap`, `giftCards`, `campaigns` | `WelcomeCodeOffer`, `StackDiscountOffer`, `GiftWrapOffer`, `GiftCardOffer`, `Campaign[]` | §12.2 |
| `content/drops.ts` | `drops`, `EARLY_ACCESS_HOURS`, `isDropSlug` | `Drop[]`, `24`, `(s: string) => s is DropSlug` | §12.1 |
| `content/shipping.ts` | `shipping` | `ShippingConfig` | §9.3 |
| `content/reviews.ts` | `reviews` | `Review[]` | `[]` tot er echte reviews zijn |
| `content/faq.ts` | `faq` | `FaqItem[]` | §5.6 |
| `content/claims.ts` | `claims` | `Claim[]` | Alle claims `verified: false` bij de start (§6.6) |
| `content/quiz.ts` | `quiz` | `QuizConfig` | §5.7 |
| `content/home.ts` | `home` | `HomeContent` | Copy van de homesecties (§5.8) |
| `content/assets.ts` | `assets`, `SUPPLIED` | `AssetManifest`, `ReadonlySet<AssetKey>` | Beeldplekken (§17.2) |
| `content/legal.ts` | `legalPages`, `legalReviewNotice`, `LegalSlug`, `cookieTable` | `LegalPageMeta[]`, `string`, `CookieTable` | Index van `content/legal/*.md` (slug, titel, bestand, `updatedAt` als literal); `cookieTable` (`{ caption; columns: { name; purpose; duration; when }; rows: CookieRow[]; settingsLabel: "Cookie-instellingen" }`) voor `/cookies` en het label van `CookieSettingsButton` (C1 in 4-6, beslissing 138) |
| `content/copy/shared.ts` | `sharedCopy` | `SharedCopy` | §5.9 (volledig vastgelegd) |
| `content/copy/forms.ts` | `formsCopy` | `FormsCopy` | Aanmelden, bevestigen, herroepen, contact, wachtlijst, validatie, status |
| `content/copy/chrome.ts` | `chromeCopy` | `ChromeCopy` | Promobalk, header, zoeken, menu, footer, consentbanner |
| `content/copy/cart.ts` | `cartCopy` | `CartCopy` | Drawer, regels, totalen, cadeauverpakking, boodschap, upsell, meldingen, fouten, lege staat, quick-add |
| `content/copy/product-card.ts` | `cardCopy` | `CardCopy` | Gridlabels, kaart-aria (sorteerlabels: `sharedCopy.vocab.sort`) |
| `content/copy/collection.ts` | `collectionCopy` | `CollectionCopy` | Filters, zoeken, drops, stacks, cadeaukaarten |
| `content/copy/pdp.ts` | `pdpCopy` | `PdpCopy` | Productpagina, ringmaatgids, claims, GPSR, `care.default` |
| `content/copy/pages.ts` | `pagesCopy` | `PagesCopy` | Over Sparkela, Club, FAQ-pagina, Spark Finder-pagina, popup, account, demo-checkout |
| `content/copy/money.ts` | `moneyCopy` | `MoneyCopy` | Het verbindingswoord van `formatMoneyRange` (ook als `sharedCopy.money`) |

Elk copytype staat in zijn eigen bestand (`export interface FormsCopy { … }` naast `export const formsCopy: FormsCopy = { … }`). De eigenaar van het bestand in die golf mag sleutels toevoegen; sleutels uit §5.2 en §5.9 hernoemt niemand.

### 5.2 Verbatim copy uit de brief

Deze strings staan letterlijk in `content/` en worden in `content/content-guard.test.ts` exact gecontroleerd. A2 zet ze in golf 3a al in het genoemde bestand.

| Sleutel | Tekst |
| --- | --- |
| `site.taglines` | `["Spark your outfit", "Made to spark", "Sieraden met een spark"]` |
| `site.consentText` | `Ja, ik wil de nieuwsbrief van Sparkela. Ben je jonger dan 16? Vraag dan eerst toestemming aan je ouder.` |
| `site.withdrawalLinkLabel` | `Hier de overeenkomst herroepen` |
| `site.vat.before` | `Prijzen inclusief 21% btw` |
| `site.vat.after` | `Sparkela maakt gebruik van de kleineondernemersregeling; er wordt geen btw berekend.` |
| `site.usps` | `["Gratis verzending vanaf €35", "Vóór 16.00 besteld, vandaag verstuurd", "6 maanden garantie op verkleuring"]` (bedragen en tijd afgeleid uit config) |
| `site.club.title` / `.cta` | `Als eerste bij elke drop. Plus 10% op je eerste bestelling.` / `Ik doe mee` |
| `site.hygieneRule` | `Om hygiënische redenen kun je oorbellen alleen retourneren met ongebroken hygiënezegel.` |
| `site.emailCapture.title` / `.intro` | `Kies je spark.` / `Elke kaart geeft 10% op je eerste bestelling.` |
| `site.emailCapture.pillLabel` | `Kies je spark` |
| `home.hero.title` | `Eén paar oorbellen. Hele outfit af.` |
| `home.hero.subtitle` | `Chunky sieraden met een spark, gestyled door Linde.` |
| `home.hero.pills` | `["Roestvrij staal met goudlaag", "Vóór 16.00 besteld, vandaag verstuurd", "Gratis verzending vanaf €35"]` |
| `home.hero.guaranteeBadge` | `6 maanden garantie op verkleuring` |
| `home.hero.ctas` | `[{ label: "Shop oorbellen", href: "/collections/oorbellen" }, { label: "Shop armbanden", href: "/collections/armbanden" }]` |
| `home.howToStack.steps` | `Kies je statement`, `Stack 3 stuks met 15% stack-korting`, `Vóór 16.00 besteld, vandaag verstuurd` (titels; elk met een korte regel eronder) |
| `home.statementVsSubtle.title` | `Statement of subtiel?` |
| `home.favorites.title` / `.titleWithSales` | `Lindes favorieten` / `Bestsellers` (alleen met `site.flags.realSalesData: true`, §14.1) |
| `home.photoStrip.title` | `Zo dragen jullie Sparkela` |
| `drops[holiday-sparkle].banner` | titel `Holiday Sparkle.`, tekst `Het extra diamantje met kerst.`, knop `Bekijk de drop` |
| `formsCopy.waitlist.signupTitle` | `Als eerste shoppen, plus 10% op je eerste bestelling` |
| `formsCopy.withdrawal.submit` | `Herroeping bevestigen` |
| `pagesCopy.about.lindeIntro` | `Hoi, ik ben Linde. [Linde schrijft hier haar eigen verhaal.]` |
| `sharedCopy.deliveryEstimate.today` | `Vóór 16.00 besteld, vandaag verstuurd. Meestal binnen 1 tot 2 werkdagen in je brievenbus.` |
| `sharedCopy.deliveryBar.today` / `.later(day)` | `Vóór 16.00 besteld? Vandaag verstuurd.` / `` `Nu besteld, ${day} verstuurd.` `` (`day`: "morgen", "maandag", …) |
| `sharedCopy.progress.remaining(amount)` | `` `Nog ${amount} tot gratis verzending` `` |
| `sharedCopy.progress.reached` | `Je verzending is gratis` |
| `sharedCopy.progress.stackOne` | `Nog 1 armband of oorbel voor 15% stack-korting` (en `stackTwo`: `Nog 2 armbanden of oorbellen voor 15% stack-korting`) |
| `cartCopy.checkout` | `Afrekenen` |
| `pagesCopy.checkout.demoNotice` | `Demo-checkout: er wordt niet betaald` |
| `legalReviewNotice` | `TODO: laten controleren` |
| `quiz` vragen | zie §5.7 |
| `faq` | zie §5.6 |

Voorbeeldregels uit de brief voor de rest van de copy (zelf schrijven, zelfde toon): "Chunky, goudkleurig en gemaakt om op te vallen." en "Wat balen! We sturen je vandaag nog een nieuwe." (bij garantie).

### 5.3 `content/site.ts` (vorm)

```ts
export const site: SiteConfig = {
  name: "Sparkela",
  description: "Chunky sieraden met een spark. Statement oorbellen en armbanden, gestyled door Linde.",
  taglines: ["Spark your outfit", "Made to spark", "Sieraden met een spark"],
  launchAt: "2026-11-27T00:00:00+01:00",            // literal, never computed (tests read the source)
  email: "hallo@sparkela.nl",                         // placeholder until the mailbox exists (TODO-LAUNCH)
  company: { legalName: "[Naam vof]", tradeName: "Sparkela", address: "[Straat en huisnummer], [Postcode] [Plaats]", kvk: "[KvK-nummer]", vatId: "[Btw-id]" },
  socials: [
    { id: "instagram", label: "Instagram", href: "https://www.instagram.com/sparkela.nl", confirmed: false },
    { id: "tiktok", label: "TikTok", href: "https://www.tiktok.com/@sparkela.nl", confirmed: false },
    { id: "pinterest", label: "Pinterest", href: "https://www.pinterest.com/sparkelanl", confirmed: false },
  ],
  paymentMethods: ["iDEAL | Wero", "Bancontact", "Creditcard", "Apple Pay"],
  vat: { switchAt: "2027-01-01T00:00:00+01:00", before: "Prijzen inclusief 21% btw", after: "Sparkela maakt gebruik van de kleineondernemersregeling; er wordt geen btw berekend." },
  lowStockThreshold: 3,
  badges: { enabled: ["nieuw", "limited", "laatste-stuks"] },   // marketing badges switched on (brief §2.7); "sale" and "bestseller" only after a decision
  guarantee: { months: 6, short: "6 maanden garantie op verkleuring" },
  returnDays: 14,
  usps: [/* 3 strings, built from shipping + guarantee */],
  consentText: "Ja, ik wil de nieuwsbrief van Sparkela. Ben je jonger dan 16? Vraag dan eerst toestemming aan je ouder.",
  privacyLink: { label: "Lees ons privacybeleid", href: "/privacy" },
  withdrawalLinkLabel: "Hier de overeenkomst herroepen",
  hygieneRule: "Om hygiënische redenen kun je oorbellen alleen retourneren met ongebroken hygiënezegel.",
  club: { title: "Als eerste bij elke drop. Plus 10% op je eerste bestelling.", cta: "Ik doe mee", benefits: [/* 3 short lines */] },
  emailCapture: { enabled: true, delayMs: 8000, cooldownDays: 7, pillLabel: "Kies je spark", title: "Kies je spark.", intro: "Elke kaart geeft 10% op je eerste bestelling.", reveal: "WELKOM10 · 10% op je eerste bestelling" },
  analytics: { enabled: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true", gtmId: process.env.NEXT_PUBLIC_GTM_ID ?? null },
  flags: { realSalesData: false, showReviews: false, hideMissingOptionalMedia: process.env.VERCEL_ENV === "production" },   // last: PhotoStrip and VideoRow render nothing in production while none of their files is SUPPLIED (beslissing 127)
};
```

`site.ts` gooit bij het laden een fout als `offers.welcomeCode.code` leeg is of als `launchAt` niet te parsen is (fail fast, zoals CORVANE). `site.paymentMethods` zijn tekstlabels; de footer en de drawer tonen ze als neutrale tekstbadges (beslissing 93).

### 5.4 `content/products.ts`: de 24 testproducten

Verzonnen namen, prijzen op ,95, geen echte merken. Handles zijn vast: tests gebruiken ze. **Materiaal** (beslissing 81): producten met alleen Goud krijgen `materiaal: "Roestvrij staal met goudlaag"`; producten met Goud en Zilver (1, 5, 17, 19) krijgen `materiaal: "Roestvrij staal"`. De getoonde tekst komt altijd uit `materialForVariant(materiaal, variant)` (§7.2): bij de swatch `goud` komt er " met goudlaag" achter (als de tekst dat nog nergens bevat: test met `includes`, niet met `endsWith`), bij `zilver` gaat " met goudlaag" eraf. Een Goud-stuk waarvan de beschrijving een deel noemt dat geen gewoon metaal is (kralen, schelp, kleur) krijgt `"Roestvrij staal met goudlaag; <deel>: [materiaal van de leverancier invullen]"` (nu Mila, Sam, Lieke en Sterre; beslissing 185). Dat deel verzinnen we nooit. `nikkelvrij` is overal `null` (niet bevestigd). **GPSR-velden** zijn herkenbare placeholders tussen haken: `"[Fabrikant, adres]"`, `"[Verantwoordelijke in de EU]"`, `"[Waarschuwingen van de leverancier invullen]"`. Nooit zelfverzonnen veiligheidstekst (beslissing 100). Foto's: geen (`images: []`), zodat kaarten een placeholder "FOTO: …" tonen. Geen testproduct heeft de tag `piercing`; de regel staat klaar voor later (§6.2).

| # | Handle | Titel | Type | Vibe(s) | Moment(en) | Prijs | Varianten | Voorraad | Tags extra | Favoriet |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `lola-chunky-hoops` | Lola chunky hoops | oorbellen | chunky-en-bold, retro | festival, date-night | 19,95 | Goud, Zilver | 25 / 12 | nieuw | ja |
| 2 | `bo-statement-druppels` | Bo statement druppels | oorbellen | chunky-en-bold | date-night, feestdagen | 22,95 | Goud | **3** | nieuw | |
| 3 | `mila-color-pop` | Mila color pop | oorbellen | kleurrijk-en-speels | festival, strand | 17,95 | Goud | 18 | | |
| 4 | `fenna-retro-schijfjes` | Fenna retro schijfjes | oorbellen | retro | kantoor-maar-niet-saai, date-night | 16,95 | Goud | 20 | | |
| 5 | `noor-dikke-ringetjes` | Noor dikke ringetjes | oorbellen | chunky-en-bold | kantoor-maar-niet-saai | **14,95** | Goud, Zilver | 30 / 30 | nieuw | |
| 6 | `jet-vonk-oorbellen` | Jet vonk oorbellen | oorbellen | chunky-en-bold | feestdagen, date-night | **24,95** | Goud | 15 | nieuw | ja |
| 7 | `sam-schelp-oorbellen` | Sam schelp oorbellen | oorbellen | kleurrijk-en-speels | strand, festival | **15,95** | Goud | 22 | | |
| 8 | `tess-schakelarmband` | Tess schakelarmband | armbanden | chunky-en-bold | kantoor-maar-niet-saai, date-night | **19,95** | Goud | 25 | nieuw | ja |
| 9 | `roos-brede-bangle` | Roos brede bangle | armbanden | retro, chunky-en-bold | festival | 21,95 | Goud | 14 | | |
| 10 | `lieke-kralenarmband` | Lieke kralenarmband | armbanden | kleurrijk-en-speels | strand, festival | 13,95 | Goud | 40 | | |
| 11 | `isa-dubbele-schakel` | Isa dubbele schakel | armbanden | chunky-en-bold | feestdagen | 26,95 | Goud | 0 (uitverkocht) | | |
| 12 | `evi-dikke-schakelketting` | Evi dikke schakelketting | kettingen | chunky-en-bold | date-night | 27,95 | Goud | 12 | nieuw | ja |
| 13 | `femke-muntketting` | Femke muntketting | kettingen | retro | kantoor-maar-niet-saai | 23,95 | Goud | 16 | | |
| 14 | `sterre-hartketting` | Sterre hartketting | kettingen | kleurrijk-en-speels, retro | date-night | 21,95 | Goud | 10 | | |
| 15 | `nina-chunky-ring` | Nina chunky ring | ringen | chunky-en-bold | festival, date-night | **19,95** | 16, 17, 18, 19 (mm) | 8 / 8 / 8 / 2 | nieuw | ja |
| 16 | `vera-zegelring` | Vera zegelring | ringen | retro | kantoor-maar-niet-saai | 17,95 | 16, 17, 18, 19 | 6 elk | | |
| 17 | `mae-mini-hoops` | Mae mini hoops | oorbellen | clean-en-classy | kantoor-maar-niet-saai | 12,95 | Goud, Zilver | 30 / 30 | | ja |
| 18 | `lou-fijne-schakelketting` | Lou fijne schakelketting | kettingen | clean-en-classy | kantoor-maar-niet-saai, date-night | 16,95 | Goud | 20 | | |
| 19 | `ivy-dun-armbandje` | Ivy dun armbandje | armbanden | clean-en-classy | kantoor-maar-niet-saai | 14,95 | Goud, Zilver | 20 / 20 | | |
| 20 | `jade-stipjes` | Jade stipjes | oorbellen | clean-en-classy | kantoor-maar-niet-saai, strand | 12,95 | Goud | 35 | | |
| 21 | `holiday-ster-oorbellen` | Ster oorbellen | oorbellen | chunky-en-bold | feestdagen | 24,95 | Goud | 20 | drop:holiday-sparkle | |
| 22 | `holiday-glitter-hoops` | Glitter hoops | oorbellen | kleurrijk-en-speels | feestdagen | 22,95 | Goud | 20 | drop:holiday-sparkle | |
| 23 | `holiday-sparkle-armband` | Sparkle armband | armbanden | chunky-en-bold | feestdagen | 26,95 | Goud | 15 | drop:holiday-sparkle | |
| 24 | `holiday-ster-ketting` | Ster ketting | kettingen | chunky-en-bold | feestdagen | 29,95 | Goud | 15 | drop:holiday-sparkle | |
| + | `cadeauverpakking` | Cadeauverpakking | cadeauverpakking | | | 1,95 | Standaard | 999 | verborgen | |
| + | `cadeaukaart` | Cadeaukaart | cadeaukaart | | | 15,00 / 25,00 / 50,00 | €15, €25, €50 | onbeperkt (`null`) | (isGiftCard) | |

- Vetgedrukte prijzen en voorraad worden door E2E-tests gebruikt (§19.2). Niet wijzigen zonder de tests aan te passen.
- `featuredRank` = volgorde in de tabel (1 tot 24). `publishedAt`: `2026-11-20T12:00:00+01:00` voor alle stukken, behalve de nieuw-getagde (`2026-11-25T12:00:00+01:00`) zodat "nieuwste" iets betekent.
- Elk product heeft een `spec_regel` (type-afhankelijke maat). Producten met alleen Goud: "Verguld staal · 20 mm"; een stuk met een deel dat geen gewoon metaal is noemt dat deel ("Verguld staal met kleuraccent · 35 mm", "Verguld staal met schelpje · 25 mm", "Kralen met verguld staal · 18 cm"; beslissing 185). Producten met Goud en Zilver (1, 5, 17, 19) krijgen een specregel zonder laagwoord: "Staal, goud of zilver · 20 mm" (beslissing 115). Een content-test bewaakt dat een product met een Zilver-variant nooit "Verguld", "verguld" of "goudlaag" in `specRegel` heeft. Verder heeft elk product `afmetingen`, `gewicht` (per stuk, in de vorm "8 g"), `sluiting` ("Klapsluiting", "Oorsteker met stopper", "Karabijnsluiting"; ringen in maat 16 tot 19 "Gesloten ring", de bangle "Open model, zonder sluiting", de kralenarmband "Elastiek, zonder sluiting"; beslissing 165), `verzorging` (algemene tekst uit `pdpCopy.care.default`), `statement_meter` (1 tot 5: chunky-stukken 4 of 5, subtiel 1 of 2), en een korte stylingtekst (`description`, 1 tot 2 zinnen, eigen woorden).
- `data/shopify-products.csv` bevat precies dezelfde producten (behalve `cadeaukaart`, die maakt Tristan als cadeaukaart in Shopify aan) in het huidige importformaat van Shopify (beslissing 164; Shopify accepteert de oudere namen `Handle`, `Body (HTML)`, `Variant SKU` enzovoort nog steeds): `Title, URL handle, Description, Vendor (Sparkela), Product category, Type, Tags, Published on online store (FALSE), Status, SKU, Option1 name, Option1 value, Price, Compare-at price, Charge tax, Inventory tracker (shopify), Inventory quantity, Continue selling when out of stock (deny), Weight value (grams), Weight unit for display, Requires shipping, Fulfillment service (manual), Product image URL, Image position, Image alt text, Gift card, SEO title, SEO description`, één rij per variant, plus metafield-kolommen in de vorm `spec_regel (product.metafields.custom.spec_regel)` enzovoort, voor alle velden van §6.4. `Status` is `draft` voor alle rijen: Tristan zet ze na controle op actief en publiceert ze in het Headless-kanaal (TODO-LAUNCH). De wachtlijst heeft ze niet nodig (§11.9).

### 5.5 `content/stacks.ts`

```ts
export const stacks: Stack[] = [
  { slug: "goud-en-gedurfd", name: "Goud en gedurfd", description: "…", productHandles: ["lola-chunky-hoops", "tess-schakelarmband", "roos-brede-bangle"], image: "stacks.goud-en-gedurfd" },
  { slug: "kleur-op-je-pols", name: "Kleur op je pols", description: "…", productHandles: ["mila-color-pop", "lieke-kralenarmband", "sam-schelp-oorbellen"], image: "stacks.kleur-op-je-pols" },
  { slug: "kantoor-maar-niet-saai", name: "Kantoor maar niet saai", description: "…", productHandles: ["noor-dikke-ringetjes", "ivy-dun-armbandje", "tess-schakelarmband"], image: "stacks.kantoor-maar-niet-saai" },
  { slug: "holiday-stack", name: "Holiday stack", description: "…", productHandles: ["holiday-ster-oorbellen", "holiday-glitter-hoops", "holiday-sparkle-armband"], image: "stacks.holiday-stack", dropSlug: "holiday-sparkle" },
];
```

Regel (getest): elke stack heeft precies 3 handles, alle drie van type `oorbellen` of `armbanden`, alle drie bestaan in de catalogus. Een stack met `dropSlug` is alleen zichtbaar als die drop publiek live is.

### 5.6 `content/faq.ts`

`FaqItem { id, question, answer, category, onHome, onProduct, claim?, link? }`. De zeven vragen uit de brief, letterlijk:

| id | Vraag | Antwoord | Home | PDP |
| --- | --- | --- | --- | --- |
| `verkleuren` | Verkleuren de sieraden? | De vaste collectie is van roestvrij staal met een goudlaag. Dat gaat lang mee, en je krijgt 6 maanden garantie op verkleuring. Wil je de goudlaag zo mooi mogelijk houden? Doe je sieraden af bij zwemmen, sporten en douchen en bewaar ze droog in het zakje. | ja | ja |
| `nikkelvrij` | Zijn de sieraden nikkelvrij? | Bij elk product staat het materiaal. Staat er "nikkelvrij", dan heeft onze leverancier dat voor dat product bevestigd. (`claim: "nikkelvrij"`) | ja | ja |
| `levertijd` | Hoe snel heb ik mijn bestelling? | Op werkdagen vóór 16.00 uur besteld, gaat dezelfde dag met PostNL de deur uit. Meestal ligt hij binnen 1 tot 2 werkdagen in je brievenbus. | ja | ja |
| `verzendkosten` | Wat kost verzenden? | €3,95, en gratis vanaf €35. We versturen binnen Nederland. | ja | nee |
| `stack-korting` | Hoe werkt de stack-korting? | Koop je 3 of meer armbanden of oorbellen, dan krijg je 15% korting op die stuks. Je ziet het meteen in je winkelwagen. | ja | ja |
| `retourneren` | Kan ik retourneren? | Ja, binnen 14 dagen. Oorbellen en piercings kun je om hygiënische redenen alleen retourneren met ongebroken hygiënezegel. Herroepen kan via "Hier de overeenkomst herroepen" onderaan elke pagina. (`link: { label: "Hier de overeenkomst herroepen", href: "/herroepen" }`) | ja | ja |
| `cadeaukaart` | Kan ik een cadeaukaart kopen? | Ja, digitaal voor €15, €25 of €50. Hij komt direct in je mail. | ja | nee |

Bedragen en tijden in deze antwoorden zijn letterlijk uit de brief; `content/offers.test.ts` controleert dat ze overeenkomen met `shipping.ts` en `offers.ts`. Extra vragen voor `/veelgestelde-vragen` (zelf schrijven): ringmaat bepalen, cadeauverpakking, welkomstcode, early access voor drops, betalen, garantie aanvragen.

### 5.7 `content/quiz.ts`

```ts
export const quiz: QuizConfig = {
  intro: { title: "Spark Finder", text: "Drie vragen, nog geen minuut. Dan weet je welke spark bij je past." },
  questions: [
    { id: "vibe", title: "Wat is je vibe?", options: [
      { value: "chunky-en-bold", label: "Chunky en bold" }, { value: "clean-en-classy", label: "Clean en classy" },
      { value: "kleurrijk-en-speels", label: "Kleurrijk en speels" }, { value: "retro", label: "Retro" } ] },
    { id: "moment", title: "Voor welk moment?", options: [
      { value: "festival", label: "Festival" }, { value: "date-night", label: "Date night" },
      { value: "kantoor-maar-niet-saai", label: "Kantoor maar niet saai" }, { value: "strand", label: "Strand" },
      { value: "feestdagen", label: "Feestdagen" } ] },
    { id: "type", title: "Wat zoek je?", options: [
      { value: "oorbellen", label: "Oorbellen" }, { value: "armbanden", label: "Armbanden" },
      { value: "kettingen", label: "Kettingen" }, { value: "ringen", label: "Ringen" }, { value: "verras-me", label: "Verras me" } ] },
  ],
  scoring: { vibe: 3, moment: 2, lindesFavoriet: 1, minResults: 3, maxResults: 6 },
  result: { title: "Jouw sparks", restart: "Opnieuw beginnen", emailTitle: "Krijg 10% op je eerste bestelling", skip: "Liever zonder e-mail verder" },
};
```

Scoring (puur, in `components/finder/finderState.ts` → `recommend(answers: QuizAnswers, products: CatalogProduct[], config: QuizConfig["scoring"] = quiz.scoring): CatalogProduct[]`): alleen zichtbare, beschikbare sieraden; bij type ≠ `verras-me` alleen dat type; score = vibe-match × 3 + moment-match × 2 + Lindes favoriet × 1; aflopend op score, dan `featuredRank`. Neem de producten met score > 0 tot `maxResults`. Minder dan `minResults`: aanvullen met Lindes favorieten (eerst van het gekozen type, dan alle), zonder dubbelen. Tags naar Shopify: `quiz:vibe-<vibe>`, `quiz:moment-<moment>`, `quiz:type-<type>`.

### 5.8 `content/home.ts` (sleutels)

`home.meta` (title, description) · `home.hero` (eyebrow, title, subtitle, pills, guaranteeBadge, ctas, `imageDesktop: "hero.desktop"`, `imageMobile: "hero.mobiel"`) · `home.deliveryBar` (flagLabel "Verzonden vanuit Nederland", freeFrom(amount); de verzenddagteksten komen uit `sharedCopy.deliveryBar`) · `home.productGrid` (eyebrow, title "De lanceringscollectie", intro, tabs `[{ id: "alles", label: "Alles" }, { id: "oorbellen", … }, { id: "armbanden", … }, { id: "kettingen", … }, { id: "ringen", … }]`, sortLabel, viewAll "Bekijk alles") · `home.howToStack` (title, steps[3] met title en text, link) · `home.favorites` (eyebrow, title, titleWithSales, viewAll) · `home.statementVsSubtle` (title, intro, columns[2]: title, text, cta, image) · `home.moments` (title, intro, tiles[5]: moment, label, image) · `home.finder` (eyebrow, title, text) · `home.reviews` (title; geen lege-staat-tekst, sectie verborgen) · `home.videos` (eyebrow, title, intro, slots[4]: label) · `home.photoStrip` (title, intro, items[6 tot 8]: image, productHandle) · `home.guarantee` (title, text, points[3]) · `home.faq` (title, allLink) · `home.aboutLinde` (eyebrow, title, text, cta, image).

### 5.9 `content/copy/shared.ts` (volledig, 3a/A2)

`lib/dates.ts`, `lib/pricing.ts` en de UI-primitives lezen deze sleutels. A2 schrijft ze in golf 3a volledig uit, zodat B2 en B3 niets hoeven te raden. Templated copy is een functie van al opgemaakte strings.

```ts
export interface SharedCopy {
  deliveryBar: { today: string; later: (day: string) => string; fallback: string };
  // today: "Vóór 16.00 besteld? Vandaag verstuurd." · later: `Nu besteld, ${day} verstuurd.` · fallback: "Op werkdagen vóór 16.00 besteld, dezelfde dag verstuurd."
  deliveryEstimate: { today: string; later: (day: string) => string; fallback: string };
  // today: brief §6 (zie §5.2) · later: `Nu besteld, ${day} verstuurd. Meestal binnen 1 tot 2 werkdagen daarna in je brievenbus.` · fallback: "Op werkdagen vóór 16.00 besteld, dezelfde dag verstuurd. Meestal binnen 1 tot 2 werkdagen in je brievenbus."
  progress: {
    remaining: (amount: string) => string; reached: string; giftCardsOnly: string;
    stackOne: string; stackTwo: string; stackReached: string;   // stackReached: "Je stack-korting van 15% is binnen"
    shopifyNote: string;                                         // "Verzendkosten zie je bij het afrekenen."
  };
  price: { from: (amount: string) => string; was: string; now: string; lowest30d: (amount: string) => string; savings: (amount: string) => string };
  // from: `Vanaf ${amount}` · was: "Van" (visually hidden before the struck price) · now: "nu" (3b/B2, visually hidden before the current price next to a struck one) · lowest30d: `Laagste prijs in de 30 dagen hiervoor: ${amount}` · savings: `Je bespaart ${amount}`
  badges: Record<BadgeId, string>;   // "Nieuw", "Limited", "Laatste stuks", "Sale", "Bestseller", "Uitverkocht", "Early access", "Op voorraad"
  countdown: { pause: string; resume: string; live: string; days: string; hours: string };   // "Aftellen pauzeren", "Aftellen hervatten", "Nu live", "d", "u"
  ui: {
    close: string; menu: string; search: string; previous: string; next: string; pause: string; play: string;
    loading: string; error: string; retry: string; required: string; optional: string;
    slideLabel: (n: number, total: number) => string;        // `${n} van ${total}`
    showImage: (n: number, total: number) => string;         // `Toon afbeelding ${n} van ${total}`
    carousel: string; slide: string;                          // aria-roledescription: "carrousel", "dia"
    slides: string;                                           // "Dia's": name of the list inside a Carousel (fixer 3, decision 188)
    breadcrumbs: string; skipLink: string; newWindow: string; // "Kruimelpad", "Naar de inhoud", "(opent in nieuw venster)"
    photoPlaceholder: (label: string) => string;              // `FOTO: ${label}`
    videoPlaceholder: (label: string) => string;              // `VIDEO: ${label}`
    // Added in 3b (B2): home: "Home" (first crumb) · imageKinds: Record<ImageKind, string> ("packshot", "draagfoto", "detail", "schaalfoto", "stackfoto", "foto")
    // imageAlt: (title, kind) => `${title}, ${kind}` · rating: (average, count) => `Gemiddeld ${average} van 5 sterren (aantal beoordelingen: ${count})` · charactersLeft: (left: number) => "Nog 1 teken" | `Nog ${left} tekens`
  };
  announce: { added: (title: string) => string; removed: (title: string) => string; updated: (title: string, quantity: number) => string; error: string };
  // added: `Toegevoegd: ${title}` · removed: `Verwijderd: ${title}` · updated: `${title}: aantal ${quantity}` · error: "Dat lukte niet. Probeer het opnieuw." (CartAnnouncer, 4-6/C2a)
  vocab: { type: Record<JewelryType, string>; vibe: Record<Vibe, string>; moment: Record<Moment, string>; price: Record<PriceBucket, string>; sort: Record<SortKey, string> };
  // type: "Oorbellen", "Armbanden", "Kettingen", "Ringen" · vibe: "Chunky en bold", "Clean en classy", "Kleurrijk en speels", "Retro"
  // moment: "Festival", "Date night", "Kantoor maar niet saai", "Strand", "Feestdagen"
  // price: "Tot €15", "€15 tot €20", "€20 tot €25", "Vanaf €25" (bedragen via formatMoneyShort) · sort: "Uitgelicht", "Prijs laag naar hoog", "Prijs hoog naar laag", "Nieuwste"
  notFound: { title: string; text: string; shop: string; finder: string; search: string; favoritesTitle: string; metaTitle: string };
  // "Deze pagina bestaat niet (meer)", "Misschien vind je hier wat je zocht.", "Naar de shop", "Spark Finder", "Zoeken", "Lindes favorieten"
  // metaTitle: "Pagina niet gevonden" (integrator 3b, decision 180: metadata of an unknown product, lib/seo.ts NOT_FOUND_TITLE)
  dates: { today: string; tomorrow: string; hours: string; at: string; midnight: string; startsOn: string; endsOn: string; through: string; until: string };
  // integrator 3b, read by lib/dates.ts (DATE_WORDS_NL): "vandaag", "morgen", "uur", "om", "middernacht", "Begint op", "Eindigt op", "t/m", "tot"
  discounts: { stack: (percent: string) => string; giftWrap: string };
  // integrator 3b, read by lib/pricing.ts (DISCOUNT_TITLES): stack: `Stack-korting ${percent}` ("15%") · giftWrap: "Cadeauverpakking december" (= title of the automatic discount in Shopify, §16.5)
  money: MoneyCopy;
  // fixer 3, decision 183: { rangeJoiner: "tot" } for formatMoneyRange ("€15 tot €50"). The object lives in content/copy/money.ts (MoneyCopy, imports nothing) because shared.ts imports lib/money.ts; lib/money.ts reads it there, sharedCopy.money is the same object
}
```

**Eén vocabulaire** (beslissing 125). De kaart (vibe-chip), de PDP (`ProductChips`), de filters (chips en checkboxen), de navigatie en de quiz gebruiken voor type, vibe, moment en prijs dezelfde woorden: `sharedCopy.vocab`. `content/quiz.test.ts` (B4) controleert dat de quizlabels en de labels in `content/navigation.ts` gelijk zijn aan `sharedCopy.vocab`.

## 6. Datamodel (`lib/types.ts`)

Dit blok is de inhoud van `lib/types.ts` (3a/A1). Tijden zijn ISO-strings met offset (`"2026-11-27T00:00:00+01:00"`). Datums zonder tijd zijn `YYYY-MM-DD`. Bedragen zijn hele centen.

### 6.1 Basis

```ts
export type CurrencyCode = "EUR";
/** Integer euro cents. 1495 = €14,95. Never floats. */
export type Cents = number;
export interface Money { cents: Cents; currency: CurrencyCode }

export type IsoDateTime = string;   // "2026-11-27T00:00:00+01:00"
export type IsoDate = string;       // "2026-12-25"
export interface TimeWindow { startsAt: IsoDateTime; endsAt: IsoDateTime }   // endsAt exclusive

export type CountryCode = "NL" | "BE";
export type CommerceProviderName = "local" | "shopify";
```

### 6.2 Catalogusvocabulaire

```ts
export type ProductType = "oorbellen" | "armbanden" | "kettingen" | "ringen" | "cadeaukaart" | "cadeauverpakking";
export type JewelryType = Extract<ProductType, "oorbellen" | "armbanden" | "kettingen" | "ringen">;
export type StackEligibleType = Extract<ProductType, "oorbellen" | "armbanden">;
export type Vibe = "chunky-en-bold" | "clean-en-classy" | "kleurrijk-en-speels" | "retro";
export type Moment = "festival" | "date-night" | "kantoor-maar-niet-saai" | "strand" | "feestdagen";
export type DropSlug =
  | "holiday-sparkle" | "love-club" | "oranje-spark" | "like-mother-like-daughter"
  | "summer-spark" | "main-character" | "vamp" | "spark-friday";

/** Parsed from Shopify tags "type:…", "vibe:…", "moment:…", "drop:…", plus plain tags "nieuw", "verborgen" and "piercing". */
export interface ProductTags {
  type: ProductType | null;
  vibes: Vibe[];
  moments: Moment[];
  drops: DropSlug[];
  nieuw: boolean;
  verborgen: boolean;      // never listed (gift wrap)
  piercing: boolean;       // plain tag "piercing": hygiene rule applies (brief §2.10), see needsHygieneSeal()
  raw: string[];           // all tags, lower-cased and trimmed
}

/** Collection filters and sorting (used by lib/catalog.ts, the filter UI and sharedCopy.vocab). */
export type PriceBucket = "tot-15" | "15-20" | "20-25" | "vanaf-25";
export type SortKey = "uitgelicht" | "prijs-oplopend" | "prijs-aflopend" | "nieuwste";
export interface Facets { types: JewelryType[]; vibes: Vibe[]; moments: Moment[]; price: PriceBucket[] }
```

### 6.3 Product

```ts
export type ImageKind = "packshot" | "draagfoto" | "detail" | "schaal" | "stack" | "overig";
export interface ProductImage { url: string; alt: string; width: number; height: number; kind: ImageKind }

export interface SelectedOption { name: string; value: string }
export type SwatchId = "goud" | "zilver";

export interface Variant {
  id: string;                         // Shopify GID or "local:<handle>:<n>"
  title: string;                      // "Goud", "17", "€25"
  sku: string | null;
  availableForSale: boolean;
  quantityAvailable: number | null;   // null = not tracked or not exposed
  price: Money;
  compareAtPrice: Money | null;       // raw from Shopify; display only via lib/pricing.priceDisplay()
  selectedOptions: SelectedOption[];
  swatch: SwatchId | null;            // from option value "Goud"/"Zilver"
  image: ProductImage | null;
}

export interface ProductOption { name: string; values: string[] }   // "Kleur" | "Maat" | "Bedrag"

export interface ProductMetafields {
  specRegel: string | null;              // custom.spec_regel        single_line_text_field
  materiaal: string | null;              // custom.materiaal         single_line_text_field
  afmetingen: string | null;             // custom.afmetingen        single_line_text_field
  gewicht: string | null;                // custom.gewicht           single_line_text_field
  sluiting: string | null;               // custom.sluiting          single_line_text_field
  verzorging: string | null;             // custom.verzorging        multi_line_text_field
  statementMeter: 1 | 2 | 3 | 4 | 5 | null; // custom.statement_meter number_integer (1..5)
  nikkelvrij: boolean | null;            // custom.nikkelvrij        boolean (true counts as verified)
  gpsrFabrikant: string | null;          // custom.gpsr_fabrikant    multi_line_text_field
  gpsrVerantwoordelijkeEu: string | null;// custom.gpsr_verantwoordelijke_eu multi_line_text_field
  gpsrWaarschuwingen: string | null;     // custom.gpsr_waarschuwingen multi_line_text_field
  laagstePrijs30d: Money | null;         // custom.laagste_prijs_30d money
  bestseller: boolean;                   // custom.bestseller        boolean (manual flag; false if absent)
  lindesFavoriet: boolean;               // custom.lindes_favoriet   boolean
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  description: string;                 // short styling text, plain text
  type: ProductType | null;            // = tags.type (Shopify productType is ignored)
  tags: ProductTags;
  metafields: ProductMetafields;
  images: ProductImage[];              // kind by position: 1 packshot, 2 draagfoto, 3 detail, 4 schaal, 5 stack
  variants: Variant[];
  options: ProductOption[];
  priceRange: { min: Money; max: Money };
  availableForSale: boolean;
  totalQuantityAvailable: number | null; // sum of variant quantityAvailable, null if any is null
  isGiftCard: boolean;
  isGiftWrap: boolean;                 // type === "cadeauverpakking"
  publishedAt: IsoDateTime;
  featuredRank: number;                // 1 = first; local: table order; shopify: index in collection "alle" (MANUAL)
  seo: { title: string | null; description: string | null };
}

/** What client components get through CatalogProvider: no GPSR, care text or long fields. */
export type CatalogProduct = Pick<Product,
  "id" | "handle" | "title" | "type" | "tags" | "images" | "variants" | "options" | "priceRange" |
  "availableForSale" | "totalQuantityAvailable" | "isGiftCard" | "isGiftWrap" | "featuredRank" | "publishedAt"
> & {
  specRegel: string | null;
  lindesFavoriet: boolean;
  bestseller: boolean;                 // manual metafield; only used with site.flags.realSalesData
  laagstePrijs30d: Money | null;       // needed by priceDisplay() on cards
  badges: BadgeId[];                   // already filtered by site.badges.enabled
  listable: boolean;                   // isListable() at the server clock; false for gift wrap, gift card and drop products in early access
};

/** content/products.ts entries: like Product but without derived fields. */
export interface LocalProductInput {
  handle: string; title: string; description: string; tags: string[];
  metafields: Partial<ProductMetafields>;
  options: ProductOption[];
  variants: Array<{ title: string; price: Cents; compareAtPrice?: Cents | null; quantityAvailable: number | null; sku?: string; selectedOptions: SelectedOption[] }>;
  images?: Array<Omit<ProductImage, "kind">>;
  publishedAt: IsoDateTime;
  isGiftCard?: boolean;
}
```

### 6.4 Metafield-mapping

| Metafield (`custom.`) | Shopify-type | Domeinveld | Leeg of ontbrekend |
| --- | --- | --- | --- |
| `spec_regel` | `single_line_text_field` | `specRegel` | `null`, kaart toont geen specregel |
| `materiaal` | `single_line_text_field` | `materiaal` | `null` |
| `afmetingen` | `single_line_text_field` | `afmetingen` | `null` |
| `gewicht` | `single_line_text_field` | `gewicht` | `null` |
| `sluiting` | `single_line_text_field` | `sluiting` | `null` |
| `verzorging` | `multi_line_text_field` | `verzorging` | `null`, accordion valt terug op `pdpCopy.care.default` |
| `statement_meter` | `number_integer` (validatie 1 tot 5) | `statementMeter` | `null`, meter verborgen |
| `nikkelvrij` | `boolean` | `nikkelvrij` | `null` = niet bevestigd |
| `gpsr_fabrikant` | `multi_line_text_field` | `gpsrFabrikant` | `null`, accordion toont `pdpCopy.gpsr.missing` |
| `gpsr_verantwoordelijke_eu` | `multi_line_text_field` | `gpsrVerantwoordelijkeEu` | idem |
| `gpsr_waarschuwingen` | `multi_line_text_field` | `gpsrWaarschuwingen` | idem |
| `laagste_prijs_30d` | `money` (JSON `{"amount":"14.95","currency_code":"EUR"}`) | `laagstePrijs30d` | `null`, dan nooit een doorgestreepte prijs |
| `bestseller` | `boolean` | `bestseller` | `false` |
| `lindes_favoriet` | `boolean` | `lindesFavoriet` | `false` |

Ongeldige waarden (statement_meter 7, kapotte JSON) worden `null` en geven één `console.warn` in de mapper. Ze breken nooit de build.

### 6.5 Badges

```ts
export type MarketingBadgeId = "nieuw" | "limited" | "laatste-stuks" | "sale" | "bestseller";
export type StatusBadgeId = "uitverkocht" | "early-access" | "op-voorraad";
export type BadgeId = MarketingBadgeId | StatusBadgeId;

/** Card shows at most one badge: the first of this order that applies. */
export const CARD_BADGE_ORDER = ["uitverkocht", "laatste-stuks", "limited", "sale", "nieuw", "bestseller"] as const;

export interface BadgeContext {
  now: number;
  drops: Drop[];
  lowStockThreshold: number;               // site.lowStockThreshold
  enabled: readonly MarketingBadgeId[];    // site.badges.enabled
  realSalesData: boolean;                  // site.flags.realSalesData
}
```

`deriveBadges(product, ctx: BadgeContext): BadgeId[]` in `lib/catalog.ts` (puur). Een marketingbadge komt alleen mee als hij in `ctx.enabled` staat **en** zijn regel klopt:

- `uitverkocht` (status): `!availableForSale`.
- `laatste-stuks`: `totalQuantityAvailable !== null && 0 < totalQuantityAvailable <= lowStockThreshold`.
- `limited`: product heeft een `drop:`-tag en die drop is publiek live (`startsAt <= now < endsAt`).
- `early-access` (status): drop in de early-access-fase (alleen op de droppagina; nooit in lijsten, want daar staat het product dan niet). Op de PDP tonen `limited` en `early-access` alleen via `DropStatusLabel`; `getProductBadges` laat ze weg (beslissing 134).
- `sale`: `priceDisplay(variant).showCompareAt` is waar (§8.6).
- `nieuw`: tag `nieuw`.
- `bestseller`: metafield `bestseller` en `realSalesData` (bij de start `false`, dus nooit).
- `op-voorraad` (status): alleen op de PDP, als beschikbaar en geen `laatste-stuks`.

### 6.6 Claims

```ts
export type ClaimId = "nikkelvrij" | "waterproof" | "hypoallergeen";
export interface Claim {
  id: ClaimId;
  label: string;                         // "Nikkelvrij"
  verified: boolean;                     // false at launch
  productHandles: string[] | "alle";     // where it applies when verified
  source: string | null;                 // required when verified: e.g. "Leveranciersverklaring 2026-11-12"
}
export interface VerifiedClaim { id: ClaimId; label: string; origin: "metafield" | "content" }
```

`getVerifiedClaims(product): VerifiedClaim[]` in `lib/claims.ts`. De PDP toont een geverifieerde claim als `pdpCopy.claims.confirmed(label)` = "{label} (bevestigd door de leverancier)", nooit als "getest" (beslissing 82). Werking: `nikkelvrij` komt mee als `metafields.nikkelvrij === true` of als `content/claims.ts` een entry met `verified: true` en een `source` voor dit product heeft, behalve als `metafields.nikkelvrij === false`: een expliciet nee in de productdata wint altijd van een content-claim, ook van `productHandles: "alle"` (fail closed, beslissing 182). Alle andere claims alleen via `content/claims.ts` met `verified: true` en `source`. Componenten tonen claims uitsluitend via deze functie.

### 6.7 Collecties, stacks, drops, acties

```ts
export type CollectionRule =
  | { kind: "all" }
  | { kind: "type"; type: JewelryType }
  | { kind: "vibe"; vibe: Vibe }
  | { kind: "moment"; moment: Moment }
  | { kind: "tag"; tag: "nieuw" }
  | { kind: "drop" }                       // any drop that is publicly live now
  | { kind: "maxPrice"; cents: Cents };    // priceRange.min < cents

export interface CollectionDefinition {
  handle: string; title: string; intro: string;
  seo: { title: string; description: string };
  rule: CollectionRule;
  bannerImage: AssetKey | null;
  stylingTile: { afterIndex: number; title: string; text: string; image: AssetKey; href: string } | null;
}
export interface Collection extends CollectionDefinition { products: Product[] }
/** What a collection page gets from lib/shop-data.ts getShopCollection(). */
export interface ShopCollection { definition: CollectionDefinition; products: CatalogProduct[]; facets: Facets }

export interface Stack {
  slug: string; name: string; description: string;
  productHandles: [string, string, string];
  image: AssetKey;
  dropSlug?: DropSlug;
}

export interface Drop {
  slug: DropSlug;
  name: string;                 // "Holiday Sparkle"
  tagline: string;              // one short sentence
  description: string;          // drop page intro
  startsAt: IsoDateTime;        // public start
  endsAt: IsoDateTime;          // exclusive
  productHandles: string[];     // must equal the products tagged drop:<slug>
  banner: { title: string; text: string; cta: string };
  teaser: { title: string; text: string };
  image: AssetKey;
  seo: { title: string; description: string };
}
export type DropPhase = "verborgen" | "early-access" | "live" | "afgelopen";   // see §9.5

export interface PromoCopy { message: string; short: string; href: string | null; linkLabel: string | null }
export interface Campaign extends TimeWindow {
  id: string;                    // "lanceringscadeau"
  title: string;
  promo: PromoCopy;              // announcement bar text
  showTimer: boolean;            // countdown to endsAt
  inCart: false;                 // nothing is added to the cart (brief §4)
}
export interface WelcomeCodeOffer { code: "WELKOM10"; percent: 10; firstOrderOnly: true; combinesWithStack: false; excludedTypes: ProductType[] }
export interface StackDiscountOffer { percent: 15; minUnits: 3; eligibleTypes: StackEligibleType[] }
export interface GiftWrapOffer { productHandle: "cadeauverpakking"; price: Money; freeWindows: TimeWindow[]; maxPerOrder: 1 }
export interface GiftCardOffer { productHandle: "cadeaukaart"; denominations: Cents[] }
```

### 6.8 Verzending

```ts
export interface Holiday { date: IsoDate; name: string }
export interface ShippingCountry {
  code: CountryCode; enabled: boolean; label: string;
  rate: Money; freeFrom: Money;
  transitDays: { min: number; max: number };
}
export interface ShippingConfig {
  timeZone: "Europe/Amsterdam";
  cutoff: { hour: 16; minute: 0; label: "16.00" };
  carrier: "PostNL"; method: "brievenbuspakje";
  countries: Record<CountryCode, ShippingCountry>;   // NL enabled, BE disabled
  defaultCountry: "NL";
  holidays: Holiday[];                                // dispatch closed
  closedDays: Holiday[];                              // extra closures (holiday break), empty at launch
  returnDays: 14;
}
```

### 6.9 Reviews, FAQ, quiz

```ts
export interface Review {
  id: string; firstName: string; text: string; rating: 1 | 2 | 3 | 4 | 5;
  photo: { src: string; alt: string; consent: true } | null;
  productHandle: string | null; date: IsoDate; verifiedBuyer: boolean; source: "judge-me" | "handmatig";
}
export interface RatingSummary { average: number; count: number }

export type FaqCategory = "bestellen" | "verzenden" | "sieraden" | "retour" | "cadeaus";
export interface FaqItem {
  id: string; question: string; answer: string; category: FaqCategory;
  onHome: boolean; onProduct: boolean;
  claim?: ClaimId; link?: { label: string; href: string };
}

export type QuizQuestionId = "vibe" | "moment" | "type";
export type QuizTypeAnswer = JewelryType | "verras-me";
export interface QuizOption<V extends string = string> { value: V; label: string }
export interface QuizQuestion { id: QuizQuestionId; title: string; options: QuizOption[] }
export interface QuizAnswers { vibe: Vibe; moment: Moment; type: QuizTypeAnswer }
export interface QuizConfig {
  intro: { title: string; text: string };
  questions: [QuizQuestion, QuizQuestion, QuizQuestion];
  scoring: { vibe: number; moment: number; lindesFavoriet: number; minResults: number; maxResults: number };
  result: { title: string; restart: string; emailTitle: string; skip: string };
}
```

### 6.10 Cart en checkout

```ts
export type DiscountSource = "stack" | "code" | "cadeauverpakking" | "overig";
export interface DiscountApplication {
  source: DiscountSource;
  kind: "automatic" | "code";
  title: string;                // "Stack-korting 15%", "WELKOM10"
  code: string | null;
  amount: Money;                // total allocated in this cart
}
export interface DiscountCodeState { code: string; applicable: boolean; reason: "ok" | "unknown" | "not-combinable" | "not-eligible" | null }

export interface CartMerchandise {
  variantId: string; productId: string; productHandle: string; productTitle: string;
  variantTitle: string | null;   // null when the product has one default variant
  image: ProductImage | null;
  type: ProductType | null;
  isGiftCard: boolean; isGiftWrap: boolean;
  quantityAvailable: number | null;
}
export interface CartLine {
  id: string;                    // Shopify line GID, or "local:<variantId>"
  merchandise: CartMerchandise;
  quantity: number;              // 1..99
  unitPrice: Money;
  subtotal: Money;               // unitPrice × quantity
  discounts: Array<{ source: DiscountSource; amount: Money }>;
  total: Money;                  // subtotal − discounts
  attributes: Array<{ key: string; value: string }>;
}

export type ShippingQuote =
  | { kind: "free" }
  | { kind: "amount"; amount: Money }
  | { kind: "at-checkout" }      // shopify: the cart has no address yet
  | { kind: "none" };            // nothing to ship (gift cards only, or empty)

export interface CartTotals {
  merchandise: Money;            // sum of line subtotals (before discounts)
  discounts: Money;              // sum of all discounts
  freeShippingBasis: Money;      // after discounts, without gift cards (conservative: never above Shopify's basis, §8.2 rule 7)
  shipping: ShippingQuote;
  total: Money;                  // merchandise − discounts + shipping (amount or 0)
  savings: Money;                // = discounts (free shipping is not counted)
}
export interface CartProgress {
  freeShipping: { applies: boolean; threshold: Money; remaining: Money; reached: boolean; ratio: number };
  stack: { applies: boolean; units: number; needed: 0 | 1 | 2; reached: boolean };
}
export interface GiftWrapState { selected: boolean; free: boolean; price: Money; lineId: string | null; available: boolean }
export type CartNotice =
  | { kind: "code-not-combined"; code: string }   // stack discount was higher, code not used
  | { kind: "code-invalid"; code: string }
  | { kind: "line-removed"; title: string }        // product no longer available
  | { kind: "quantity-capped"; title: string; max: number }
  | { kind: "not-yet-available"; title: string };  // drop product before access

export interface Cart {
  id: string;
  provider: CommerceProviderName;
  lines: CartLine[];             // without the gift wrap line (shown via giftWrap)
  itemCount: number;             // units, gift wrap excluded
  discountCodes: DiscountCodeState[];
  discounts: DiscountApplication[];
  totals: CartTotals;
  progress: CartProgress;
  giftWrap: GiftWrapState;
  note: string;                  // gift message, max 200 characters
  checkoutUrl: string;           // shopify: cart.checkoutUrl; local: "/checkout"
  notices: CartNotice[];
}

export interface CartLineInput { variantId: string; quantity: number; attributes?: Array<{ key: string; value: string }> }

export interface CheckoutState {   // local demo checkout only
  status: "review" | "placing" | "placed";
  orderRef: string | null;          // "DEMO-<6 chars>" after placing
}
```

### 6.11 Formulieren en analytics

```ts
export type SubscribeSource = "popup" | "finder" | "club" | "footer" | "wachtlijst";
export interface SubscribeRequest {
  email: string;
  consent: true;                  // the unchecked-by-default checkbox, must be ticked
  source: SubscribeSource;
  quiz?: QuizAnswers;
  website: string;                // honeypot, must be empty
}
export interface WithdrawalRequest {
  name: string; orderNumber: string; email: string;
  products?: string;              // optional, free text
  website: string;
}
export interface ContactRequest {
  name: string; email: string; orderNumber?: string; message: string;
  website: string;
}
export type FormErrorCode = "invalid" | "rate-limited" | "not-configured" | "upstream";
export type FormResponse<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: FormErrorCode; fieldErrors?: Record<string, string>; fallbackEmail: string };
/** "pending": confirmation mail sent (double opt-in, §15.2). "already-subscribed": nothing sent. */
export interface SubscribeResult { status: "pending" | "already-subscribed"; code: "WELKOM10" }
export interface SubscribeConfirmRequest { token: string }
export interface SubscribeConfirmResult { status: "confirmed" | "already-confirmed" }
export type SubscribeConfirmErrorCode = "expired" | "invalid";   // sent as FormErrorCode "invalid" + fieldErrors.token
export interface WithdrawalReceipt { reference: string; receivedAt: IsoDateTime; receivedAtLabel: string; summary: Array<{ label: string; value: string }> }

export interface AnalyticsItem {
  item_id: string; item_name: string; item_brand: "Sparkela";
  item_category: string | null; item_variant: string | null;
  price: number;                  // euros (GA4), converted from cents only in lib/analytics.ts
  quantity: number;
}
export type AnalyticsEvent =
  | { event: "view_item"; ecommerce: { currency: "EUR"; value: number; items: AnalyticsItem[] } }
  | { event: "add_to_cart"; ecommerce: { currency: "EUR"; value: number; items: AnalyticsItem[] } }
  | { event: "begin_checkout"; ecommerce: { currency: "EUR"; value: number; items: AnalyticsItem[]; coupon?: string } }
  | { event: "sign_up"; method: SubscribeSource };
export type ConsentValue = "granted" | "denied";
```

### 6.12 Overige gedeelde typen

```ts
export interface NavLink { label: string; href: string; description?: string }
export interface NavGroup { label: string; id: "momenten" | "cadeaus"; links: NavLink[]; extra?: NavLink & { heading: string } }
export type NavItem = ({ kind: "link" } & NavLink) | ({ kind: "group" } & NavGroup);
export interface MobileNavConfig { primary: NavLink[]; groups: NavGroup[]; service: NavLink[] }
export interface FooterColumn { title: string; links: NavLink[] }
export type MobileNavFeature = { kind: "drop"; drop: Drop } | { kind: "stack"; stack: Stack; products: CatalogProduct[] };
export interface Crumb { label: string; href?: string }   // last crumb without href = current page
/** Result of priceDisplay() in lib/pricing.ts; prop of Price (components/ui). Here so B2 and B3 can build in parallel (beslissing 137). */
export interface PriceDisplay { price: Money; compareAt: Money | null; lowest30d: Money | null; showCompareAt: boolean }

export type AssetKey = string;   // "hero.desktop", "momenten.festival", "fotostrook.01", "video.01", "stacks.<slug>", "drops.<slug>"
export interface ImageAsset { key: AssetKey; src: string; aspect: "4:5" | "3:4" | "16:9" | "1:1" | "9:16"; width: number; height: number; alt: string; label: string; brief: string }
export interface VideoAsset { key: AssetKey; src: string; poster: string; width: 1080; height: 1920; label: string; brief: string }
export interface AssetManifest { images: Record<AssetKey, ImageAsset>; videos: Record<AssetKey, VideoAsset> }
```

**Copytypen staan in hun eigen contentbestand**, niet in `lib/types.ts`: `SiteConfig` in `content/site.ts`, `HomeContent` in `content/home.ts`, `LegalPageMeta` in `content/legal.ts`, en `SharedCopy`, `FormsCopy`, `ChromeCopy`, `CartCopy`, `CardCopy`, `CollectionCopy`, `PdpCopy`, `PagesCopy` in `content/copy/*.ts` (§5.1). Zo kan de eigenaar van een copybestand zelf sleutels toevoegen zonder `lib/types.ts` te raken. Templated copy is een functie van al opgemaakte strings (`(amount: string) => string`), nooit van centen.

---

## 7. Commerce-laag

### 7.1 Interfaces (`lib/commerce/types.ts`)

De brief noemt één interface in `lib/commerce/` met tien functies en twee implementaties. Die interface is `CommerceProvider`. Hij bestaat uit twee helften met dezelfde namen als in de brief: de catalogus draait op de server (cached, statisch), de cart draait in de browser (per bezoeker). Beide helften en beide implementaties staan in `lib/commerce/` (beslissing 84).

```ts
import type { Cart, CartLineInput, Collection, CommerceProviderName, Product } from "@/lib/types";

/** Server-side catalog source. Implemented by lib/commerce/local.ts and lib/commerce/shopify/catalog.ts. */
export interface CatalogSource {
  readonly name: CommerceProviderName;
  /** Every product incl. hidden ones (gift wrap), gift card and drop products, sorted by featuredRank. */
  getProducts(): Promise<Product[]>;
  getProduct(handle: string): Promise<Product | null>;
  /** Product handles matching the query, best match first. Visibility filtering happens in lib/catalog.ts. */
  search(query: string): Promise<string[]>;
}

/** Client-side cart. Implemented by lib/commerce/cart/local-adapter.ts and lib/commerce/cart/shopify-adapter.ts (client-safe, no server-only). */
export interface CartAdapter {
  readonly name: CommerceProviderName;
  getCart(): Promise<CartResult>;
  addToCart(lines: CartLineInput[]): Promise<CartResult>;
  updateCart(lines: Array<{ lineId: string; quantity: number }>): Promise<CartResult>;
  removeFromCart(lineIds: string[]): Promise<CartResult>;
  applyDiscountCode(code: string): Promise<CartResult>;
  removeDiscountCode(code: string): Promise<CartResult>;
  setGiftWrap(enabled: boolean): Promise<CartResult>;
  setNote(note: string): Promise<CartResult>;
  /** shopify: cart.checkoutUrl (absolute); local: "/checkout". Throws CartError("empty") without lines. */
  getCheckoutUrl(): Promise<string>;
}

export type CartErrorCode =
  | "network" | "invalid" | "unavailable" | "not-yet-available" | "quantity-capped"
  | "code-invalid" | "rate-limited" | "upstream" | "not-configured" | "empty";
export type CartResult = { ok: true; cart: Cart | null } | { ok: false; error: CartErrorCode; cart: Cart | null };

/** The only error a CartAdapter throws (getCheckoutUrl without lines); every other method resolves with a CartResult (beslissing 144). */
export class CartError extends Error {
  readonly code: CartErrorCode;
  constructor(code: CartErrorCode, message?: string);
}

/** POST /api/cart body (shopify adapter only). */
export type CartRequest =
  | { op: "add"; lines: CartLineInput[] }
  | { op: "update"; lines: Array<{ lineId: string; quantity: number }> }
  | { op: "remove"; lineIds: string[] }
  | { op: "discount"; codes: string[] }          // full list; [] removes all codes
  | { op: "giftWrap"; enabled: boolean }
  | { op: "note"; note: string };
export type CartResponse = CartResult;

/** The single interface from brief §7: catalog half (server) + collection lookup + cart half (client). */
export type CommerceProvider = CatalogSource & CartAdapter & {
  getCollection(handle: string, now: number): Promise<Collection | null>;
};
```

`getCollection` staat niet in `CatalogSource` maar wel in `CommerceProvider`: de collectieregels zijn voor beide providers gelijk (`buildCollection` in `lib/commerce/collections.ts`, §7.2), dus `lib/commerce/index.ts` implementeert hem één keer voor beide. `CommerceProvider` is een documenterend type: geen enkel object implementeert alle drie de delen tegelijk, omdat de catalogus server-only is en de cart client-only.

**Imports.** Client components mogen uit `lib/commerce/` alleen `types.ts`, `cart/local-adapter.ts` en `cart/shopify-adapter.ts` importeren (in de praktijk alleen `CartProvider`). Alles anders in `lib/commerce/` is server-only.

### 7.2 Catalogus: modules en functies

**`lib/commerce/index.ts`** (server-only; client components importeren dit nooit):

```ts
export function resolveProviderName(value = process.env.COMMERCE_PROVIDER): CommerceProviderName; // unknown → "local" + console.warn
// Throws at module load when VERCEL_ENV === "production" and the provider is not "shopify".

export async function getProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "products");
  return source.getProducts();
}
export async function getProduct(handle: string): Promise<Product | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "products", `product:${handle}`);
  return source.getProduct(handle);
}
// Plain async functions: NO 'use cache' (now would become part of the cache key).
// Only called inside the cached scopes of lib/shop-data.ts, which own cacheLife/cacheTag.
export async function getCollection(handle: string, now: number): Promise<Collection | null>; // buildCollection(definition, await getProducts(), now, drops)
export async function search(query: string, now: number): Promise<Product[]>;               // source.search → visible products only
```

**`lib/catalog.ts`** (puur, getest, geen `next/*`-imports):

```ts
export function parseTags(raw: string[]): ProductTags;
export function deriveBadges(product: Product, ctx: BadgeContext): BadgeId[];
export function cardBadge(badges: BadgeId[]): BadgeId | null;                 // first of CARD_BADGE_ORDER
export function isListable(product: Product, now: number, drops: Drop[]): boolean;  // !verborgen, !isGiftCard, !isGiftWrap, drop live
export function applyCollectionRule(products: Product[], rule: CollectionRule, now: number, drops: Drop[]): Product[];
// SortKey, PriceBucket and Facets live in lib/types.ts (§6.2).
export function sortProducts<T extends Pick<Product, "featuredRank" | "priceRange" | "publishedAt" | "availableForSale">>(items: T[], key: SortKey): T[];
export function filterProducts<T extends CatalogProduct>(items: T[], f: Partial<Facets>): T[];
export function availableFacets(items: CatalogProduct[]): Facets;            // only values that occur
export function searchProducts<T extends CatalogProduct>(items: T[], query: string): T[]; // title, type, vibe, moment; diacritics-insensitive
export function badgeContextAt(now: number): BadgeContext;                   // site.lowStockThreshold, site.badges.enabled, site.flags.realSalesData, drops
export function toCatalogProduct(p: Product, ctx: BadgeContext): CatalogProduct; // listable = isListable(p, ctx.now, ctx.drops); only lib/shop-data.ts and tests call this
export function findVariant(product: Pick<Product, "variants">, variantId: string): Variant | null;
export function defaultVariant(product: Pick<Product, "variants">): Variant;   // first available, else first
export function isStackEligible(type: ProductType | null): type is StackEligibleType;
export function needsHygieneSeal(p: Pick<Product, "type" | "tags">): boolean;      // p.type === "oorbellen" || p.tags.piercing
export function materialForVariant(materiaal: string | null, variant: Pick<Variant, "swatch"> | null): string | null; // §5.4, beslissing 81
export function homeFavorites(items: CatalogProduct[], realSalesData: boolean): { products: CatalogProduct[]; useSalesTitle: boolean }; // §14.1 sectie 9
export const MAX_LINE_QUANTITY = 99;
export const MAX_CART_LINES = 50;
```

Sorteren: `uitgelicht` op `featuredRank`, uitverkochte producten achteraan (beslissing 42); `prijs-*` op `priceRange.min`, gelijke prijs op `featuredRank`; `nieuwste` op `publishedAt` aflopend, dan `featuredRank`. Filters combineren als EN tussen facetten en OF binnen een facet. Prijsbuckets op `priceRange.min`: `tot-15` < 1500, `15-20` 1500 tot 1999, `20-25` 2000 tot 2499, `vanaf-25` ≥ 2500. De labels in `sharedCopy.vocab.price` (3a) gebruiken dezelfde grenzen.

**Lokale id's** (`lib/commerce/local-data.ts`, gelijk aan `tests/fixtures/catalog.ts`, beslissing 145): product `local:<handle>`, variant `local:<handle>:<n>` met `n` vanaf 1 in de volgorde van `variants` in `content/products.ts`, cartregel `local:<variantId>` (§6.10).

**`lib/shop-data.ts`** (server, de enige plek waar pagina's productdata halen):

Elke functie is `'use cache'`, leest de tijd met `serverNow()` uit `lib/clock.ts` (§10.3), zet `cacheTag("catalog", "products", "klok")` en `cacheLife(clockLife(now))`. `getShopCollection` en `getCatalogProducts` zetten daarnaast `collections`. Argumenten zijn alleen begrensde sleutels (handle, slug, limit), nooit `now`.

**Alleen deze module maakt `CatalogProduct`'s** (beslissing 106): binnen de gecachte scope met `toCatalogProduct(p, badgeContextAt(serverNow()))`. Pagina's en componenten roepen `toCatalogProduct`, `deriveBadges` en `badgeContextAt` nooit zelf aan. Elke functie die een lijst voor kaarten geeft, geeft `CatalogProduct[]` met `badges` en `listable`.

```ts
export async function getShopProducts(): Promise<CatalogProduct[]>;         // listable, sorted uitgelicht, with badges
export async function getShopProduct(handle: string): Promise<Product | null>; // any product incl. drop products (proxy gates)
export async function getProductBadges(handle: string): Promise<BadgeId[]>;   // PDP labels (ProductInfo): deriveBadges incl. op-voorraad, WITHOUT limited and early-access (DropStatusLabel owns those, exact to the second; beslissing 134)
export async function getShopCollection(handle: string): Promise<ShopCollection | null>; // definition + CatalogProduct[] + availableFacets
export async function getCatalogProducts(): Promise<CatalogProduct[]>;      // listable + drop products in early access (listable: false) + cadeauverpakking + cadeaukaart
export async function getFeaturedDrop(): Promise<{ drop: Drop; phase: DropPhase } | null>; // drop live at the server clock, else the next drop whose startsAt is within 14 days (DropBanner keeps it hidden until startsAt, §12.4)
export async function getDropData(slug: DropSlug): Promise<{ drop: Drop; phase: DropPhase; products: CatalogProduct[] } | null>; // every product of the drop, in any phase (the proxy gates the page)
export async function getVisibleStacks(): Promise<Array<{ stack: Stack; products: CatalogProduct[] }>>;
export async function getRecommendedFor(handle: string, limit: 2 | 3 | 4): Promise<CatalogProduct[]>; // "Maak de look af"
export async function getStackOptionsFor(handle: string): Promise<{ candidates: CatalogProduct[]; defaultPicks: [string, string] | null }>; // StackPicker; defaultPicks are VARIANT ids, null only with fewer than 2 candidates
export async function getShipSchedule(): Promise<ShipLabelEntry[]>;           // §10.5, cacheLife("hours")
export async function getSitemapProducts(): Promise<Array<{ handle: string }>>;
export async function getShopProductsForParams(): Promise<Array<{ handle: string }>>; // every product except cadeauverpakking; empty catalog → [{ handle: NO_PRODUCTS_HANDLE }] (never [])
export const NO_PRODUCTS_HANDLE = "__geen-producten__";   // sentinel: getShopProduct returns null → 404 pattern
```

"Maak de look af" (`getRecommendedFor`): eerst de andere stukken uit een stack in `content/stacks.ts` die dit product bevat, dan producten met dezelfde vibe en een ander type, dan Lindes favorieten; alleen listable en beschikbaar, zonder het product zelf, zonder dubbelen.

Stack-kiezer (`getStackOptionsFor`, beslissing 129): `candidates` zijn de listable, beschikbare oorbellen en armbanden behalve het product zelf. `defaultPicks` zijn **variant-id's**: van de andere twee stukken van de eerste stack in `content/stacks.ts` met dit product, elk met `defaultVariant(p)` (eerste beschikbare variant), als beide stukken kandidaat zijn. Anders (geen stack, zoals bij `bo-statement-druppels`, `fenna-retro-schijfjes`, `jet-vonk-oorbellen`, `mae-mini-hoops` en `jade-stipjes`, of een stuk van de stack uitverkocht) de twee kandidaten met de laagste `featuredRank` van het andere stack-type (oorbel → armbanden, armband → oorbellen), aangevuld met het eigen type als het andere er minder dan twee heeft. `null` alleen bij minder dan twee kandidaten; dan toont `StackPicker` alleen "Los".

**Dropproduct vóór de publieke start** (fase `verborgen` of `early-access` op de server-klok, beslissing 107): `getRecommendedFor` en `getStackOptionsFor` nemen alleen beschikbare stukken uit dezelfde drop, en `defaultPicks` komt uit de stack met die `dropSlug`. Tijdens early access op 26 november is het nog prelaunch en weigert de cart-gate gewone producten (§7.4); zo werken "Voeg de stack toe" en de quick-adds in "Maak de look af" op de PDP's van Holiday Sparkle.

### 7.3 Hoe componenten productdata krijgen

1. **Server components** (pagina's, secties, `ProductCard`) krijgen `CatalogProduct` (lijsten en kaarten) of `Product` (alleen de PDP) als prop, opgehaald via `lib/shop-data.ts`. Ze roepen nooit `toCatalogProduct`, `deriveBadges` of `badgeContextAt` aan (§7.2).
2. **Client components** die een lijst nodig hebben (cart-upsell, Spark Finder, zoeken, stack-kiezer, quick-add in de cart) gebruiken `useCatalog()` uit `components/catalog/CatalogProvider.tsx`. `app/(shop)/layout.tsx` (via `ShopChrome`) vult de provider met `await getCatalogProducts()`.
3. Client components importeren nooit `content/products.ts` of `lib/commerce/*`, behalve `lib/commerce/types.ts` (typen) en de twee client-adapters in `lib/commerce/cart/` (alleen `CartProvider`).

```ts
// components/catalog/CatalogProvider.tsx ("use client")
export interface CatalogValue {
  products: CatalogProduct[];                                   // entries with listable === true, sorted uitgelicht
  byHandle(handle: string): CatalogProduct | null;              // over every entry (incl. listable: false)
  byVariantId(variantId: string): { product: CatalogProduct; variant: Variant } | null; // idem: also drop variants in early access
  giftWrap: CatalogProduct | null;                               // handle "cadeauverpakking"
  giftCard: CatalogProduct | null;                               // handle "cadeaukaart"
}
export function CatalogProvider(props: { products: CatalogProduct[]; children: ReactNode }): React.JSX.Element;
export function useCatalog(): CatalogValue;
```

Dropproducten in early access staan met `listable: false` in de provider (beslissing 107): ze verschijnen in geen enkele lijst, maar de lokale cart, `CartAnnouncer` en analytics vinden hun varianten. Zoeken (header en `/zoeken`) gebruikt `searchProducts(useCatalog().products, q)` in de browser. Dat is direct, werkt statisch en toont nooit een drop vóór de start. `search()` in de commerce-laag bestaat voor de interface en tests; de Shopify-versie gebruikt `predictiveSearch` (beslissing 35).

### 7.4 Cart

**Provider en hook** (`components/cart/CartProvider.tsx`, `useCart.ts`, "use client"):

```ts
export interface CartContextValue {
  provider: CommerceProviderName;
  cart: Cart | null;              // null before hydration and when empty (shopify)
  hydrated: boolean;              // first read finished; header shows the count only after this
  pending: boolean;               // a mutation is running
  itemCount: number;              // 0 before hydration
  isOpen: boolean;
  openCart(): void; closeCart(): void; setOpen(open: boolean): void;
  addToCart(lines: CartLineInput[], options?: { open?: boolean; source?: "pdp" | "card" | "stack" | "upsell" | "finder" }): Promise<CartResult>;
  updateQuantity(lineId: string, quantity: number): Promise<CartResult>;
  removeLine(lineId: string): Promise<CartResult>;
  applyDiscountCode(code: string): Promise<CartResult>;
  removeDiscountCode(code: string): Promise<CartResult>;
  setGiftWrap(enabled: boolean): Promise<CartResult>;
  setNote(note: string): Promise<CartResult>;   // debounced 600 ms by GiftMessageField, not by the provider
  checkout(): Promise<void>;                      // fires begin_checkout, then location.assign(url) or router.push("/checkout")
  lastError: CartErrorCode | null;
}
export function CartProvider(props: { provider: CommerceProviderName; children: ReactNode }): React.JSX.Element;
export function useCart(): CartContextValue;
export function useCartActions(): Pick<CartContextValue, "addToCart" | "openCart" | "closeCart" | "setOpen">; // stable, no re-render on cart changes
```

- De provider kiest de adapter met de prop `provider` (vanuit `ShopChrome`: `resolveProviderName()`, bij de build bepaald).
- Na mount (in `startTransition` na `setTimeout(0)`, CORVANE D53.7) roept hij `adapter.getCart()` aan.
- Elke mutatie: `pending = true`, adapter aanroepen, `cart` vervangen door het antwoord. Geen optimistische bedragen; wel blijft de oude cart in beeld tot het antwoord er is.
- `addToCart` opent de drawer (standaard), vuurt `track({ event: "add_to_cart", … })` uit `lib/analytics.ts` (3b/B1) en meldt `sharedCopy.announce.added(titel)` ("Toegevoegd: {titel}") in de live region (`CartAnnouncer`, `role="status" aria-live="polite"`). Verwijderen en aantal wijzigen melden `announce.removed` en `announce.updated`, een fout `announce.error`. `checkout()` vuurt `begin_checkout`.
- Twee contexts (state en stabiele acties), zoals CORVANE.

**Lokale adapter** (`lib/commerce/cart/local-adapter.ts`, `createLocalCartAdapter(deps: { resolve: PriceCartInput["resolve"]; now: () => number }): CartAdapter`):

- Opslag: `localStorage["sparkela:cart:v1"] = { v: 1, lines: Array<{ variantId: string; quantity: number }>, discountCode: string | null, giftWrap: boolean, note: string }`, via `lib/storage.ts` (try/catch). Zonder opslag werkt de cart in het geheugen.
- Valideert bij het laden: onbekende varianten vallen weg, aantal 1 tot 99, maximaal 50 regels, dubbele varianten samengevoegd.
- Prijst met `priceCart()` uit `lib/pricing.ts` (§8) met de `CatalogProduct`-data uit `useCatalog()` en `now = Date.now()` op het moment van de mutatie. Een timer op `nextPricingBoundary(now)` prijst opnieuw (cadeauverpakking gratis op 1 december), altijd via `scheduleAt()` uit `lib/schedule.ts`, nooit met een `setTimeout` direct naar een verre grens (§10.5).
- `storage`-events houden tabbladen gelijk.
- `getCheckoutUrl()` geeft `/checkout`.

**Shopify-adapter** (`lib/commerce/cart/shopify-adapter.ts`, `createShopifyCartAdapter(): CartAdapter`):

- `fetch("/api/cart", { method: "POST", body: JSON.stringify(request), headers: { "content-type": "application/json" } })`, `GET /api/cart` voor `getCart()`. Time-out 10 s (`AbortSignal.timeout`). Netwerkfout → `{ ok: false, error: "network" }`.
- `getCheckoutUrl()` geeft `cart.checkoutUrl` uit de laatste cart.

**Route handler `app/api/cart/route.ts`** (alleen met `shopify`; met `local` antwoordt hij `{ ok: false, error: "not-configured", cart: null }`):

| Stap | Gedrag |
| --- | --- |
| Cookie | `sparkela_cart` = cart-GID; `httpOnly`, `secure`, `sameSite: "lax"`, `path: "/"`, `maxAge: 60 * 60 * 24 * 10` |
| GET | Geen cookie → `{ ok: true, cart: null }`. Cart bestaat niet meer bij Shopify → cookie wissen, `cart: null` |
| POST | Body valideren als `CartRequest` (§15.6). Geen cart → `cartCreate` met `buyerIdentity: { countryCode: NL }`, cookie zetten. Daarna de mutatie |
| `add` | Eerst een **verse, ongecachete** query `VariantGate` (§16.4) voor de varianten: handle, tags en `isGiftCard` van het product. Nooit de gecachete catalogus: die is per serverless-instance en kan een uur oud zijn (beslissing 87). Onbekende variant → `invalid`. Cadeauverpakking via `add` → `invalid` (alleen via `giftWrap`). Daarna `canAddToCart()` uit `lib/commerce/cart-gate.ts` (hieronder). Pas dan `cartLinesAdd`; andere fouten (voorraad) komen uit de `userErrors` van Shopify |
| `giftWrap` | Variant van `cadeauverpakking` toevoegen (aantal 1) of de regel verwijderen. Alleen als er een fysiek product in de cart zit |
| `update` / `remove` | Daarna: geen fysieke producten meer → cadeauverpakking ook weg |
| `discount` | `cartDiscountCodesUpdate` met de volledige lijst, codes hoofdletters en getrimd. Code niet `applicable` → antwoord `ok: true` met `discountCodes[].applicable: false`; de UI toont `cartCopy.discount.notApplicable` |
| `note` | `cartNoteUpdate`, maximaal 200 tekens, HTML-tags gestript |
| Antwoord | Altijd `Cache-Control: private, no-store`. `userErrors` van Shopify → `{ ok: false, error }` met `invalid`, `unavailable` of `quantity-capped` plus de actuele cart |
| Rate limit | 60 verzoeken per minuut per IP (§15.7) |

**Cart-gate** (`lib/commerce/cart-gate.ts`, puur, getest in `cart-gate.test.ts` en `api-cart.test.ts`):

```ts
export interface GateItem { variantId: string; productHandle: string; dropSlugs: DropSlug[] }
export interface GateContext { now: number; hasPreview: boolean; earlyAccessSlugs: DropSlug[]; drops: Drop[]; launchAt: IsoDateTime }
export function canAddToCart(items: GateItem[], ctx: GateContext): { ok: true } | { ok: false; error: "not-yet-available"; variantIds: string[] };
```

1. `hasPreview` (geldige preview-cookie) → altijd `ok`.
2. Per item met een drop-tag: fase `verborgen` → weigeren; fase `early-access` → alleen met de EA-cookie van die drop; `live` en `afgelopen` → door naar 3.
3. **Prelaunch** (`now < launchAt`): alleen `ok` als **elk** item hoort bij een drop waarvoor de bezoeker een geldige EA-cookie heeft. Zo kan niemand vóór 27 november een gewoon product bestellen via een variant-id uit de RSC-payload van een open juridische pagina. Een gewone sieraad naast een dropstuk in early access wordt geweigerd.
4. De route neemt `now = serverNow()` (de testklok werkt daar ook), leest de cookies `sparkela_preview` en `sparkela_ea_<slug>` en controleert ze met `lib/preview.ts` en `lib/early-access.ts`.

**Kortingscode in de cart drawer.** De drawer heeft geen codeveld; de code komt uit de popup ("Zet op mijn tas") of op `/checkout` (local). Met `shopify` voert de klant een code verder in de checkout van Shopify in. Een via de popup toegepaste code staat als regel in de totalen met een knop "Verwijderen".

### 7.5 Caching en tags

| Tag | Gezet door | Ververst door |
| --- | --- | --- |
| `catalog` | alle cataloguslezingen | handmatig (`/api/revalidate` met `REVALIDATE_SECRET`) |
| `products` | `getProducts`, `getProduct`, alles in `lib/shop-data.ts` | webhooks `products/*`, `inventory_levels/update` en `collections/*` (de volgorde en het lidmaatschap van `alle` bepalen `getProducts()`); bij `products/update` en voorraad met `"max"` (§7.6) |
| `product:<handle>` | `getProduct(handle)` | webhook `products/update` en `products/delete` (handle uit de payload) |
| `collections` | `getShopCollection`, `getCatalogProducts` | webhooks `collections/*` en `products/*` |
| `klok` | `getServerNow`, alles in `lib/shop-data.ts` | `cacheLife(clockLife(now))` (§10.4) en handmatig |

- `cacheLife("hours")` op ruwe catalogusreads is het vangnet als een webhook mist.
- Na een deploy zijn alle caches leeg; de build haalt alles vers op. Is Shopify onbereikbaar of het token fout tijdens de build, dan faalt de build. Een lege catalogus of een ontbrekende collectie `alle` breekt de build niet (§7.7): zo kan de wachtlijst live vóór de producten er zijn (§11.9). Dat de shop bij de lancering producten heeft, bewaakt de launch-checklist (§11.8).
- Vitest: modules die `next/cache` importeren worden getest met `vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))`. Pure logica staat in modules zonder `next/cache` (`lib/catalog.ts`, `mappers.ts`).

### 7.6 Revalidatie (`app/api/revalidate/route.ts`)

```ts
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();                     // never JSON.parse before the signature is verified
  // 1. Manual: Authorization: Bearer <REVALIDATE_SECRET>, body {"tags":["klok"]} → revalidateTag(tag, { expire: 0 }) for each allowed tag.
  // 2. Webhook: verifyShopifyHmac(raw, request.headers.get("x-shopify-hmac-sha256"), SHOPIFY_WEBHOOK_SECRET).
  //    Missing secret → 503 { ok: false }. Bad or missing HMAC → 401. Unknown topic → 200 { ok: true, tags: [] }.
  // 3. tagsForWebhook(topic, payload) → revalidateTag(tag, profile) per entry.
  // Response 200 { ok: true, tags: string[] } with Cache-Control: no-store.
}
```

In `lib/commerce/shopify/webhooks.ts` (puur, getest met `tests/fixtures/shopify/webhook-*.json`):

```ts
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
export function verifyShopifyHmac(raw: string, header: string | null, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest();
  const given = Buffer.from(header ?? "", "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);   // length check first: timingSafeEqual throws on unequal lengths
}
/** Constant-time bearer check: compare sha256 digests (always 32 bytes). */
export function verifyBearer(header: string | null, secret: string): boolean;     // "Bearer <token>"
export type RevalidateProfile = "max" | { expire: 0 };
export function tagsForWebhook(topic: string, payload: unknown): Array<{ tag: string; profile: RevalidateProfile }>;
```

| `X-Shopify-Topic` | Tags | Profiel |
| --- | --- | --- |
| `products/create` | `products`, `collections` | `{ expire: 0 }` |
| `products/update` | `product:<payload.handle>` met `{ expire: 0 }`; `products` en `collections` met `"max"` | gemengd (beslissing 130) |
| `products/delete` | `products`, `collections` (payload heeft alleen `id`) | `{ expire: 0 }` |
| `inventory_levels/update` | `products` | `"max"` |
| `collections/create`, `collections/update`, `collections/delete` | `collections`, `products` | `{ expire: 0 }` |

- `{ expire: 0 }` zorgt dat het volgende verzoek blokkeert en verse data krijgt (gemeten, digest E6). Zo staat een wijziging van inhoud, prijs of volgorde binnen een minuut op de site.
- **`products/update` komt ook bij elke voorraadwijziging**, vaak twee keer per wijziging (Shopify Community; `includeFields` voorkomt dat niet). Met `{ expire: 0 }` op `products` zou elke bestelling elke pagina laten blokkeren. Daarom: `product:<handle>` met `{ expire: 0 }` (de PDP van dat product is meteen vers; tags van binnenste caches gaan mee naar de buitenste) en `products`/`collections` met `"max"` (lijsten zijn één verzoek later vers). Een prijswijziging staat dus meteen op de PDP en na één extra verzoek in de lijsten (TODO-LAUNCH punt 9, beslissing 130). Create, delete, collectietopics en handmatige revalidatie houden `{ expire: 0 }`.
- `inventory_levels/update` komt bij elke bestelling. Daarom `"max"` (stale-while-revalidate): het volgende verzoek krijgt nog de oude pagina en ververst op de achtergrond, het verzoek daarna is vers (beslissing 85). Zo blokkeert niet elke pagina op de lanceringsavond na elke bestelling. Voorraad in de cart en de checkout komt altijd vers uit Shopify; alleen het label "Laatste stuks" kan één verzoek achterlopen.
- `updateTag` werkt niet in route handlers.

### 7.7 Fouten en terugval

| Situatie | Gedrag |
| --- | --- |
| Shopify onbereikbaar of token fout tijdens de build | Build faalt met een duidelijke melding |
| Collectie `alle` bestaat niet of is leeg (bijvoorbeeld vóór de import) | `getProducts()` geeft `[]` plus de losse producten die er wel zijn, met één `console.warn`; `generateStaticParams` valt terug op `NO_PRODUCTS_HANDLE`; de build slaagt (§11.9) |
| Product met tag `drop:<slug>` dat niet in `drops[].productHandles` staat | Eén `console.warn` per product in de Shopify-catalogusprovider tijdens de build (de proxy schermt de PDP dan niet af, beslissing 88) |
| Handle uit `drops[].productHandles` van een drop die nog niet voorbij is, maar niet in de collectie `alle` | De Shopify-catalogusprovider haalt hem los op met `ProductByHandle` (zoals de cadeaukaart, `featuredRank` achteraan) en geeft één `console.warn` in de build en in `npm run test:shopify`. Bestaat hij in Shopify helemaal niet: alleen de waarschuwing (beslissing 114) |
| Shopify onbereikbaar tijdens revalidatie | De functie gooit; Next blijft de vorige versie serveren |
| `getProduct` voor onbekende handle | `null` → 404-patroon (§14.2) |
| `/api/cart` upstream-fout | `{ ok: false, error: "upstream", cart: <laatste bekende of null> }`; drawer toont `cartCopy.errors.upstream` met "Probeer het opnieuw" |
| Netwerkfout in de browser | `error: "network"`; drawer toont `cartCopy.errors.network` |
| Cart-cookie verwijst naar verlopen cart | Cookie wissen, nieuwe cart bij de volgende `add` |
| Shopify-provider zonder token (lokaal per ongeluk) | `getShopifyConfig()` gooit `ShopifyNotConfiguredError` bij het laden van de catalogus; de build faalt |

---

## 8. Prijslogica (`lib/pricing.ts`)

Puur: geen `Date.now()`, geen React, geen `next/*`. `now` komt altijd als argument binnen. Config komt uit `content/offers.ts` en `content/shipping.ts`, maar elke functie accepteert een optionele `config` voor tests. Met de `local`-provider levert `priceCart` de hele `Cart`. Met `shopify` gebruikt de site alleen `cartProgress` en `progressTexts` op Shopify-bedragen.

### 8.1 API

```ts
export interface PricingConfig {
  stack: StackDiscountOffer; welcome: WelcomeCodeOffer; giftWrap: GiftWrapOffer;
  shipping: { rate: Cents; freeFrom: Cents };   // NL from content/shipping.ts
}
export const defaultPricingConfig: PricingConfig;

export function percentOf(cents: Cents, percent: number): Cents;          // Math.floor((cents * percent + 50) / 100): half-up, integer only
export function normalizeDiscountCode(code: string): string;              // trim + upper case
export function validateDiscountCode(code: string, now: number, config?: PricingConfig):
  { ok: true; percent: number; code: string } | { ok: false; reason: "unknown" | "empty" };

export interface PriceCartInput {
  lines: Array<{ variantId: string; quantity: number }>;
  resolve: (variantId: string) => { product: CatalogProduct; variant: Variant } | null;
  discountCode: string | null;
  giftWrap: boolean;
  note: string;
  now: number;
  config?: PricingConfig;
}
export function priceCart(input: PriceCartInput): Cart;                    // provider "local", id "local", checkoutUrl "/checkout"

export function cartProgress(input: {
  freeShippingBasis: Cents; hasShippable: boolean; stackUnits: number; config?: PricingConfig;
}): CartProgress;
export function progressTexts(p: CartProgress): { shipping: string | null; stack: string | null };   // copy from sharedCopy.progress (content/copy/shared.ts)
export function progressFromShopifyCart(cart: Omit<Cart, "progress">): CartProgress;               // basis = total − gift card lines − shipping

export function stackQuote(pieces: Array<{ price: Cents; type: ProductType | null }>, config?: PricingConfig):
  { subtotal: Cents; discount: Cents; total: Cents; eligibleUnits: number; active: boolean };   // PDP stack tile

// PriceDisplay lives in lib/types.ts (§6.12, 3a/A1), so Price (3b/B2) can type against it before this file exists.
export function priceDisplay(variant: Pick<Variant, "price" | "compareAtPrice">, laagstePrijs30d: Money | null): PriceDisplay;

export function nextPricingBoundary(now: number, config?: PricingConfig): number | null;          // start/end of gift wrap windows
```

### 8.2 Regels van `priceCart`

1. **Regels.** Onbekende varianten en varianten die niet meer te koop zijn vallen weg (notice `line-removed`; bij een onbekende variant met `title: ""`). Dubbele varianten worden één regel; een aantal onder 1 valt stil weg; het aantal wordt begrensd op 99 en op de bekende voorraad (notice `quantity-capped`, beslissing 173). Cadeauverpakking komt nooit als gewone regel binnen; `giftWrap: true` voegt één regel toe als er minstens één fysiek product is (geen cadeaukaart, geen cadeauverpakking).
2. **Subtotaal** (`merchandise`) = som van `unitPrice × quantity` over alle regels, inclusief cadeauverpakking en cadeaukaarten.
3. **Stack-korting.** `stackUnits` = som van de aantallen van regels met type `oorbellen` of `armbanden` (geen cadeaukaarten, geen cadeauverpakking). Bij `stackUnits >= 3` krijgt elke in aanmerking komende regel `percentOf(regelSubtotaal, 15)`. Afronden per regel, half naar boven.
4. **WELKOM10.** Grondslag = subtotaal van alle regels behalve cadeaukaarten, min de kortingen die al op die regels staan (in de praktijk alleen de gratis cadeauverpakking in december, regel 6; de stack-korting combineert niet, regel 5). Korting = `percentOf(grondslag, 10)`, toegewezen per regel naar rato (naar beneden afgerond, rest op de laatste regel). Dit volgt de inrichting in Shopify (§16.6): `WELKOM10` is daar een orderkorting die na de productkortingen werkt, en Shopify geeft nooit korting op cadeaukaarten. Buiten december krijgt een cadeauverpakking van €1,95 dus ook 10% (beslissing 104).
5. **Niet samen** (`combinesWithStack: false`). Zijn stack-korting en code allebei mogelijk, dan geldt de hoogste; bij gelijkspel de stack-korting (automatisch). De code blijft opgeslagen, krijgt `applicable: false, reason: "not-combinable"` en de cart krijgt notice `code-not-combined`. Dit spiegelt het advies voor Shopify (brief §11: welkomstcode niet samen met de stack-korting; Shopify kiest dan ook de beste korting). De gratis cadeauverpakking (regel 6) combineert wel met allebei (combinatiematrix in §16.6). "Eerste bestelling" kan lokaal niet gecontroleerd worden; Shopify dwingt "eenmaal per klant" af.
6. **Cadeauverpakking gratis.** Als `isGiftWrapFree(now)` (1 tot en met 31 december, uit `giftWrap.freeWindows`), krijgt de cadeauverpakkingsregel een korting gelijk aan zijn subtotaal (`source: "cadeauverpakking"`).
7. **Grondslag gratis verzending** = (subtotaal van alle regels behalve cadeaukaarten) − (alle kortingen op die regels). Cadeauverpakking telt mee zolang hij niet gratis is. Shopify rekent zijn prijsvoorwaarde op het bedrag na kortingen; of Shopify cadeaukaarten meetelt, is niet gedocumenteerd en testen we in de echte winkel (§22, beslissing 90). Onze grondslag is daarom bewust de voorzichtige: hij is nooit hoger dan die van Shopify. Zegt de drawer "Je verzending is gratis", dan is dat in de checkout ook zo. Andersom kan de drawer bij een cart met een cadeaukaart nog "Nog €X" zeggen terwijl Shopify al gratis verstuurt.
8. **Verzending.** Geen fysiek product → `{ kind: "none" }`. Grondslag ≥ 3500 → `{ kind: "free" }`. Anders `{ kind: "amount", amount: 395 }`.
9. **Totaal** = subtotaal − kortingen + verzendbedrag. **Besparing** = som van alle kortingen (gratis verzending telt niet mee).
10. **Afronding.** Alle bedragen zijn hele centen. Nooit `cents * 0.85` of `toFixed`. Alleen `percentOf` deelt.

### 8.3 Voortgangsteksten

| Situatie | `progressTexts().shipping` | `progressTexts().stack` |
| --- | --- | --- |
| Geen fysiek product | `null` (balk verborgen; bij alleen cadeaukaarten: `sharedCopy.progress.giftCardsOnly` "Cadeaukaarten komen per mail, zonder verzendkosten") | `null` |
| Grondslag < 3500 | `Nog €X tot gratis verzending` (X = 3500 − grondslag, `formatMoney`) | |
| Grondslag ≥ 3500 | `Je verzending is gratis` | |
| `stackUnits` = 0 | | `null` |
| `stackUnits` = 1 | | `Nog 2 armbanden of oorbellen voor 15% stack-korting` |
| `stackUnits` = 2 | | `Nog 1 armband of oorbel voor 15% stack-korting` |
| `stackUnits` ≥ 3 | | `Je stack-korting van 15% is binnen` (`sharedCopy.progress.stackReached`) |

`ratio` voor de balk = `min(1, grondslag / 3500)`. De stack-mijlpaal is een balk van 3 segmenten. Een bereikte mijlpaal klapt in tot één regel met een vinkje (CORVANE `ShippingProgress`).

### 8.4 Uitgewerkte voorbeelden (vaste testwaarden)

Producten uit §5.4. Alle bedragen in centen. Deze tabel staat letterlijk als testtabel in `lib/pricing.test.ts`.

| # | Cart | Subtotaal | Stack | Code | Kado | Grondslag | Verzending | Totaal | Tekst verzending | Tekst stack |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | Noor 14,95 + Nina 19,95 | 3490 | 0 | 0 | 0 | 3490 | 395 | 3885 | Nog €0,10 tot gratis verzending | Nog 2 armbanden of oorbellen voor 15% stack-korting |
| B | Sam 15,95 + Nina 19,95 | 3590 | 0 | 0 | 0 | 3590 | 0 | 3590 | Je verzending is gratis | Nog 2 armbanden of oorbellen … |
| C | Noor 14,95 + Tess 19,95 (2 stackstukken) | 3490 | 0 | 0 | 0 | 3490 | 395 | 3885 | Nog €0,10 tot gratis verzending | Nog 1 armband of oorbel voor 15% stack-korting |
| D | C + Jet 24,95 (3 stackstukken) | 5985 | 897 (224 + 299 + 374) | 0 | 0 | 5088 | 0 | 5088 | Je verzending is gratis | Je stack-korting van 15% is binnen |
| E | Noor 14,95 × 3 (één regel) | 4485 | 673 | 0 | 0 | 3812 | 0 | 3812 | Je verzending is gratis | binnen |
| F | D + WELKOM10 | 5985 | 897 | 0 (599 < 897, notice `code-not-combined`) | 0 | 5088 | 0 | 5088 | gratis | binnen |
| G | Nina 19,95 + Jet 24,95 + WELKOM10 | 4490 | 0 | 449 | 0 | 4041 | 0 | 4041 | gratis | Nog 2 … |
| H | Cadeaukaart €25 + Noor 14,95 | 3995 | 0 | 0 | 0 | 1495 | 395 | 4390 | Nog €20,05 tot gratis verzending | Nog 2 … |
| I | Alleen cadeaukaart €50 | 5000 | 0 | 0 | 0 | 0 | none | 5000 | `null` (giftCardsOnly) | `null` |
| J | Ster ketting 29,95 + cadeauverpakking, 20 november | 3190 | 0 | 0 | 0 | 3190 | 395 | 3585 | Nog €3,10 tot gratis verzending | `null` |
| K | Idem op 1 december 00.00 | 3190 | 0 | 0 | 195 | 2995 | 395 | 3390 | Nog €5,05 tot gratis verzending | `null` |
| L | Mae 12,95 + Jade 12,95 + Lieke 13,95 | 3985 | 597 (194 + 194 + 209) | 0 | 0 | 3388 | 395 | 3783 | Nog €1,12 tot gratis verzending | binnen |
| M | Grens: grondslag 3499 / 3500 (synthetische regels in de test) | | | | | 3499 / 3500 | 395 / 0 | | Nog €0,01 … / Je verzending is gratis | |
| N | Nina 19,95 + cadeauverpakking + WELKOM10, 20 november | 2190 | 0 | 219 (10% van 2190, ook over de cadeauverpakking) | 0 | 1971 | 395 | 2366 | Nog €15,29 tot gratis verzending | `null` |
| O | D + cadeauverpakking, 2 december | 6180 | 897 | 0 | 195 | 5088 | 0 | 5088 | Je verzending is gratis | binnen |
| P | G + cadeauverpakking, 2 december | 4685 | 0 | 449 (10% van 4685 − 195) | 195 | 4041 | 0 | 4041 | gratis | Nog 2 … |

- N, O en P zijn ook de testcarts voor de eind-tot-eindtest in de echte winkel (§16.9): ze tonen of de combinaties in Shopify kloppen.
- Voorbeeld L laat zien dat de stack-korting een cart onder de verzendgrens kan duwen. Dat is correct (zelfde grondslag als Shopify).
- E en D: afronden gebeurt per regel, dus drie losse regels van 14,95 (3 × 224 = 672) verschillen één cent van één regel met aantal 3 (673). Shopify verdeelt zelf; met `shopify` tonen we wat Shopify teruggeeft.
- €35,00 precies is met prijzen op ,95 niet te halen (ook niet met korting of cadeauverpakking). De grens wordt in Vitest getest met synthetische regels (M); de E2E-test gebruikt €34,90 (A) en €35,90 (B) (beslissing 33).

### 8.5 Geldopmaak (`lib/money.ts`)

Deterministisch, zonder `Intl` (server en browser geven anders verschillende spaties):

| Functie | Invoer | Uitvoer |
| --- | --- | --- |
| `formatMoney(cents)` | 1495 / 3500 / 0 / 123450 / -224 | `€14,95` / `€35,00` / `€0,00` / `€1.234,50` / `−€2,24` (U+2212) |
| `formatMoneyShort(cents)` | 3500 / 1495 | `€35` / `€14,95` (hele euro's zonder decimalen) |
| `formatMoneyRange(min, max)` | 1500, 5000 | `€15 tot €50` (het woord "tot" is `sharedCopy.money.rangeJoiner`, beslissing 183) |
| `parseShopifyMoney(amount)` | `"14.95"` / `"14.9"` / `"14"` / `"1234.50"` | 1495 / 1490 / 1400 / 123450 (string-split, geen `parseFloat`) |
| `money(cents)` | 1495 | `{ cents: 1495, currency: "EUR" }` |

### 8.6 Van-prijs en laagste prijs (brief §2.5)

- `priceDisplay(variant, laagstePrijs30d)`: `showCompareAt` is waar als `compareAtPrice > price` **en** `laagstePrijs30d !== null`. Anders nooit een doorgestreepte prijs, ook als Shopify een compare-at-prijs heeft (fail closed).
- Weergave (`Price`): `<s>` van-prijs met verborgen label "Van", de prijs, en op een eigen regel `sharedCopy.price.lowest30d(amount)` = "Laagste prijs in de 30 dagen hiervoor: €X". `Price` toont die regel **altijd** als `showCompareAt` waar is; er is geen prop om hem uit te zetten (brief §2.5).
- Geen kortingspercentage bij een sale. Wel de stackbesparing ("Je bespaart €8,97") en de totale besparing in de cart.
- Bij de lancering heeft geen product een compare-at-prijs. `content/content-guard.test.ts` faalt als een lokaal product `compareAtPrice` heeft zonder `laagste_prijs_30d`.

---

## 9. Datumlogica (`lib/dates.ts`)

Puur en getest. Alles in `Europe/Amsterdam`. Elke functie krijgt `now` (epoch-milliseconden, `number`) als argument; nergens `Date.now()` of `new Date()` zonder argument. Port van CORVANE `lib/delivery.ts` en `lib/campaign.ts`: `getZonedParts` met `Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", … }).formatToParts`, rekenen op ISO-datums (`YYYY-MM-DD`), weekdagen en maanden uit vaste Nederlandse arrays (server en browser geven dan hetzelfde).

### 9.1 Signatures

```ts
export const TIME_ZONE = "Europe/Amsterdam";
export const DAYS_NL = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"] as const;
export const MONTHS_NL = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"] as const;

export interface ZonedParts { year: number; month: number; day: number; hour: number; minute: number; second: number; isoWeekday: 1|2|3|4|5|6|7; isoDate: IsoDate }
export function toMs(value: IsoDateTime | number): number;                 // NaN-safe: throws on unparseable literal, also on a date or time that does not exist ("2026-02-30", "T24:00"; content is static)
export function getZonedParts(now: number): ZonedParts;
export function zonedTimeToInstant(isoDate: IsoDate, hour: number, minute: number): number;   // DST-safe
export function addCalendarDays(isoDate: IsoDate, days: number): IsoDate;
export function isoWeekdayOf(isoDate: IsoDate): 1|2|3|4|5|6|7;
export function isWorkingDay(isoDate: IsoDate, cfg?: ShippingConfig): boolean;                // Mon–Fri, not in holidays/closedDays
export function nextWorkingDay(isoDate: IsoDate, cfg?: ShippingConfig): IsoDate;              // strictly after isoDate

export interface DispatchInfo { dispatchDate: IsoDate; shipsToday: boolean; cutoffAt: number | null }
export function getDispatchInfo(now: number, cfg?: ShippingConfig): DispatchInfo;            // today if working day and now < 16:00
export function dispatchDayLabel(dispatchDate: IsoDate, now: number): string;                 // "vandaag" | "morgen" | "maandag" | "maandag 4 januari" (> 6 days)
export function deliveryBarText(now: number): string;                                         // sharedCopy.deliveryBar.today | later(label)
export function deliveryEstimateText(now: number): string;                                    // sharedCopy.deliveryEstimate.today | later(label)

export interface ShipLabelEntry { from: number; shipsToday: boolean; dispatchLabel: string; barText: string; estimateText: string }
export function buildShipSchedule(from: number, days?: number /* 14 */, cfg?: ShippingConfig): ShipLabelEntry[];  // an entry at every label change

export function vatText(now: number): string;                                                 // site.vat.before | after
export function isPrelaunch(now: number, launchAt?: IsoDateTime): boolean;                    // now < launchAt
export function isInWindow(w: TimeWindow, now: number): boolean;                              // startsAt <= now < endsAt
export function isGiftWrapFree(now: number, offer?: GiftWrapOffer): boolean;

export function earlyAccessAt(drop: Drop): number;                                            // startsAt − EARLY_ACCESS_HOURS h
export function getDropPhase(drop: Drop, now: number): DropPhase;
export function getActiveCampaign(now: number, campaigns?: Campaign[]): Campaign | null;      // first active by startsAt

// CountdownParts, getCountdown, formatCountdown and phaseIndex live in lib/schedule.ts (3a/A1, §10.7); lib/dates.ts re-exports them.
export { type CountdownParts, getCountdown, formatCountdown, phaseIndex } from "@/lib/schedule";
export function formatCountdownSr(target: IsoDateTime, kind: "start" | "end"): string;      // start: "Begint op vrijdag 27 november om 00.00 uur" · end: "Eindigt op maandag 30 november om middernacht"
export function formatEndLabel(endsAt: IsoDateTime): string;                                  // 00:00 → "t/m 30 november"; else "tot 28 februari 23.59 uur"
export function formatStartLabel(startsAt: IsoDateTime): string;                              // "vrijdag 5 februari om 19.00 uur"
export function formatDateTimeNl(now: number): string;                                        // "26 november 2026 om 14.03 uur"
export function formatDayMonth(value: IsoDateTime): string;                                   // "27 november" (Europe/Amsterdam)

export type PromoState =
  | { kind: "campaign"; campaign: Campaign; target: IsoDateTime | null }
  | { kind: "drop-upcoming"; drop: Drop; target: IsoDateTime }    // startsAt within PROMO_UPCOMING_DAYS
  | { kind: "drop-live"; drop: Drop; target: null }               // first PROMO_LIVE_DAYS after startsAt
  | { kind: "usp" };
export const PROMO_UPCOMING_DAYS = 7;
export const PROMO_LIVE_DAYS = 7;
export function getPromoState(now: number, input?: { campaigns: Campaign[]; drops: Drop[] }): PromoState;
export interface PromoEntry { from: number; state: PromoState }
/** One entry at `from`, then one at every change of getPromoState within `days` days (incl. PROMO_* offsets). Sorted, never empty. */
export function promoSchedule(from: number, days: number, input?: { campaigns: Campaign[]; drops: Drop[] }): PromoEntry[];

export function timeBoundaries(): number[];       // sorted, unique: launchAt, vat.switchAt, every campaign start/end, every drop earlyAccessAt/startsAt/endsAt (+ PROMO_* offsets), gift wrap windows
export function nextBoundary(now: number): number | null;
```

### 9.2 Regels

- **Verzenddag.** Vandaag als vandaag een werkdag is en `now < 16:00` lokale tijd. Anders de eerstvolgende werkdag. Werkdag = maandag tot en met vrijdag, niet in `shipping.holidays` en niet in `shipping.closedDays`.
- **16.00 precies** is te laat (de cut-off is exclusief): 15:59:59 verstuurt vandaag, 16:00:00 niet.
- **Teksten.** Leverbalk: "Vóór 16.00 besteld? Vandaag verstuurd." of "Nu besteld, {label} verstuurd.". PDP: "Vóór 16.00 besteld, vandaag verstuurd. Meestal binnen 1 tot 2 werkdagen in je brievenbus." of "Nu besteld, {label} verstuurd. Meestal binnen 1 tot 2 werkdagen daarna in je brievenbus.". Geen afteltimer naar 16.00 (dat zou een timer zijn die elke dag reset, brief §2.4).
- **Label.** "morgen" als de verzenddag morgen is (ook op zondag); de weekdag als het binnen 6 dagen is; anders "maandag 4 januari".
- **Btw.** Tot 2027-01-01T00:00:00+01:00 `site.vat.before`, daarna `site.vat.after`. De prijzen blijven gelijk.
- **Prelaunch.** `isPrelaunch(now)` is `now < toMs(site.launchAt)` met `launchAt = "2026-11-27T00:00:00+01:00"`.
- **Drops.** Zie §9.5.
- **Ongeldige literals** in content laten `toMs` gooien. `content/drops.test.ts` en `content/offers.test.ts` parsen alle datums, zodat dit nooit in productie gebeurt.

### 9.3 Feestdagen (`content/shipping.ts`)

Verzending staat stil op deze dagen. `lib/holidays.ts` rekent ze in `content/shipping.test.ts` opnieuw uit (Pasen via `easterSunday(year)`), zodat een tikfout opvalt.

| Datum | Dag | Naam |
| --- | --- | --- |
| 2026-01-01 | donderdag | Nieuwjaarsdag |
| 2026-04-05 | zondag | Eerste paasdag |
| 2026-04-06 | maandag | Tweede paasdag |
| 2026-04-27 | maandag | Koningsdag |
| 2026-05-14 | donderdag | Hemelvaartsdag |
| 2026-05-24 | zondag | Eerste pinksterdag |
| 2026-05-25 | maandag | Tweede pinksterdag |
| 2026-12-25 | vrijdag | Eerste kerstdag |
| 2026-12-26 | zaterdag | Tweede kerstdag |
| 2027-01-01 | vrijdag | Nieuwjaarsdag |
| 2027-03-28 | zondag | Eerste paasdag |
| 2027-03-29 | maandag | Tweede paasdag |
| 2027-04-27 | dinsdag | Koningsdag |
| 2027-05-06 | donderdag | Hemelvaartsdag |
| 2027-05-16 | zondag | Eerste pinksterdag |
| 2027-05-17 | maandag | Tweede pinksterdag |
| 2027-12-25 | zaterdag | Eerste kerstdag |
| 2027-12-26 | zondag | Tweede kerstdag |
| 2028-01-01 | zaterdag | Nieuwjaarsdag |

Beleid (beslissing 54): Goede Vrijdag is een werkdag. Bevrijdingsdag (5 mei) is alleen een vrije dag in lustrumjaren (2025, 2030), dus in 2026 en 2027 een werkdag. Koningsdag valt op 26 april als 27 april een zondag is (niet in 2026 of 2027). Kerstavond en oudejaarsdag zijn gewone werkdagen.

### 9.4 Testgevallen (`lib/dates.test.ts`)

| # | `now` | Verwacht |
| --- | --- | --- |
| 1 | vr 2026-11-27T15:59:00+01:00 | verzenddag 2026-11-27, `shipsToday: true`, "Vóór 16.00 besteld? Vandaag verstuurd." |
| 2 | vr 2026-11-27T16:00:00+01:00 | 2026-11-30, "Nu besteld, maandag verstuurd." |
| 3 | vr 2026-11-27T16:01:00+01:00 | 2026-11-30, maandag |
| 4 | za 2026-11-28T10:00:00+01:00 | 2026-11-30, "maandag" |
| 5 | zo 2026-11-29T22:00:00+01:00 | 2026-11-30, "morgen" |
| 6 | do 2026-12-24T15:59:00+01:00 | 2026-12-24, vandaag |
| 7 | do 2026-12-24T16:01:00+01:00 | 2026-12-28 (vr 25 en za 26 feestdag, zo 27), "maandag" |
| 8 | vr 2026-12-25T12:00:00+01:00 | 2026-12-28 |
| 9 | za 2026-12-26T12:00:00+01:00 | 2026-12-28 |
| 10 | do 2026-12-31T16:01:00+01:00 | 2027-01-04 (vr 1 januari feestdag), "maandag" |
| 11 | btw 2026-12-31T23:59:59+01:00 / 2027-01-01T00:00:00+01:00 | `vat.before` / `vat.after` |
| 12 | Zomertijd: vr 2027-03-26T16:30:00+01:00 | 2027-03-30 (ma 29 tweede paasdag), "dinsdag" |
| 13 | Zomertijd: di 2027-03-30T15:59:00+02:00 / 16:00:00+02:00 | vandaag / 2027-03-31 (cut-off is 14:00Z in zomertijd) |
| 14 | Wintertijd: vr 2027-10-29T16:01:00+02:00 | 2027-11-01 (offset +01:00 na zo 31 oktober) |
| 15 | Rond de omschakeling: zo 2027-03-28T01:59:59+01:00 en 03:00:00+02:00 | `getZonedParts` geeft 01:59:59 en 03:00:00 |
| 16 | Koningsdag: ma 2027-04-26T16:01:00+02:00 | 2027-04-28, "woensdag" |
| 17 | Bevrijdingsdag 2027: wo 2027-05-05T10:00:00+02:00 | vandaag (geen lustrum) |
| 18 | Hemelvaart: wo 2027-05-05T16:01:00+02:00 | 2027-05-07 |
| 19 | Prelaunch 2026-11-26T23:59:59+01:00 / 2026-11-27T00:00:00+01:00 | `true` / `false` |
| 20 | Holiday Sparkle 2026-11-25T23:59:59+01:00 / 2026-11-26T00:00:00+01:00 / 2026-11-26T23:59:59+01:00 / 2026-11-27T00:00:00+01:00 / 2026-12-31T23:59:59+01:00 / 2027-01-01T00:00:00+01:00 | `verborgen` / `early-access` / `early-access` / `live` / `live` / `afgelopen` |
| 21 | Love Club vlak voor en na `startsAt` 2027-02-05T19:00:00+01:00 (± 1 s) | `early-access` / `live` |
| 22 | Cadeauverpakking gratis 2026-11-30T23:59:59+01:00 / 2026-12-01T00:00:00+01:00 / 2026-12-31T23:59:59+01:00 / 2027-01-01T00:00:00+01:00 | `false` / `true` / `true` / `false` |
| 23 | Lanceringscadeau 2026-11-26T23:59:59+01:00 / 2026-11-27T00:00:00+01:00 / 2026-11-30T23:59:59+01:00 / 2026-12-01T00:00:00+01:00 | geen / actief / actief / geen |
| 24 | `getPromoState` op 2026-11-28 / 2026-12-02 / 2026-12-05 / 2027-01-31T12:00+01:00 | `campaign` / `drop-live` / `usp` / `drop-upcoming` (Love Club) |
| 25 | `formatCountdown` 2d 5u 3m / 23:59:59 / 0 | "2d 5u" / "23:59:59" / "00:00:00" |
| 26 | `formatEndLabel("2026-12-01T00:00:00+01:00")` | "t/m 30 november" |
| 27 | `buildShipSchedule` vanaf do 2026-12-24T09:00+01:00 | eerste entry "vandaag"; wissel op 2026-12-24T16:00+01:00 naar "maandag"; op 2026-12-27T00:00+01:00 naar "morgen" (zondag, verzenddag is morgen); op 2026-12-28T00:00+01:00 naar "vandaag"; op 2026-12-28T16:00+01:00 naar "morgen" |
| 28 | `nextBoundary` 2026-11-20T12:00+01:00 | 2026-11-26T00:00:00+01:00 (early access Holiday Sparkle) |
| 29 | `formatCountdownSr("2026-11-27T00:00:00+01:00", "start")` / `formatCountdownSr("2026-12-01T00:00:00+01:00", "end")` | "Begint op vrijdag 27 november om 00.00 uur" / "Eindigt op maandag 30 november om middernacht" |
| 30 | `formatStartLabel("2027-02-05T19:00:00+01:00")` | "vrijdag 5 februari om 19.00 uur" |

### 9.5 Drops: fasen

| Fase | Wanneer | Lijsten (menu, collecties, zoeken, sitemap) | `/drops/[slug]` | Producten |
| --- | --- | --- | --- | --- |
| `verborgen` | `now < startsAt − 24 h` | niet | proxy herschrijft naar `/drops/[slug]/binnenkort` (teaser met datum en Club-aanmelding) | proxy herschrijft PDP naar de teaser |
| `early-access` | `startsAt − 24 h <= now < startsAt` | niet | alleen met early-access-cookie of preview; anders teaser | idem; cart (`/api/cart`) weigert zonder cookie |
| `live` | `startsAt <= now < endsAt` | wel, label "Limited" | open, banner en "Nu live" | open |
| `afgelopen` | `now >= endsAt` | niet | open, met "Deze drop is voorbij" en Club-aanmelding; producten nog zichtbaar zolang Shopify ze beschikbaar heeft | PDP blijft bereikbaar (geen 404 voor gedeelde links) |

---

## 10. Tijd in de rendering

### 10.1 Eisen

Geen buildfouten (Cache Components faalt op `Date.now()` tijdens prerender), geen layout shift, exacte wissels waar een bezoeker het ziet, en open tabbladen die een grens passeren moeten mee wisselen. Alle logica staat in `lib/dates.ts`.

### 10.2 Drie lagen (beslissing 23)

| Laag | Waar | Wat | Precisie |
| --- | --- | --- | --- |
| 1. Proxy | `proxy.ts`, per request | Prelaunch, toegang tot drops en dropproducten, `/wachtlijst` na launch | Exact (per request) |
| 2. Server-klok | `'use cache'`-functies met `serverNow()` | Welke producten in lijsten, collecties, zoeken, sitemap, menu-kaart; welke drop de banner krijgt; de beginwaarde (`serverIndex`) van elke `TimeSwitch` | Vernieuwt uiterlijk binnen `clockLife` (max 1 uur, rond een grens vanaf 60 s), plus het eerste verzoek erna |
| 3. Browser | `TimeSwitch` + inline script, `Countdown`, `useNow` | Alles wat een bezoeker ziet wisselen: promobalk, timers, btw-regel, "Limited" of "Early access", dropbanner, verzenddag, gratis cadeauverpakking | Exact, vóór de eerste paint |

Laag 2 hoeft niet exact te zijn: wat toegang geeft regelt laag 1, wat zichtbaar wisselt regelt laag 3. Een drop die om 19.00 start, staat uiterlijk een paar minuten later in de collectie Limited; de droppagina en de banner wisselen precies om 19.00.

### 10.3 Server-klok (`lib/clock.ts` en `lib/server-clock.ts`)

Twee bestanden, zodat `proxy.ts` geen `next/cache` importeert.

```ts
// lib/clock.ts: pure, no next/* imports; used by proxy.ts, route handlers and lib/server-clock.ts
/** Wall clock for proxy, route handlers and 'use cache' scopes only. Never call during plain render. */
export function serverNow(): number;
// = Date.parse(process.env.SPARKELA_TEST_NOW) when testClockEnabled(), else Date.now().

/** True only when SPARKELA_TEST_CLOCK === "1" and VERCEL_ENV !== "production". */
export function testClockEnabled(): boolean;

/** Proxy only: the x-sparkela-test-now request header overrides the time when testClockEnabled(). */
export function requestNow(request: { headers: Headers }): number;

/** stale 300 s; revalidate = clamp(seconds until nextBoundary(now), 60, 3600); expire 86400. */
export function clockLife(now: number): { stale: number; revalidate: number; expire: number };
```

```ts
// lib/server-clock.ts: import "server-only"
import { cacheLife, cacheTag } from "next/cache";
import { clockLife, serverNow } from "@/lib/clock";

/** Cached clock for server components (ClockProvider, TimeSwitch serverIndex). */
export async function getServerNow(): Promise<number> {
  "use cache";
  const now = serverNow();
  cacheTag("klok");
  cacheLife(clockLife(now));
  return now;
}
```

- `ClockProvider` staat in `ShopChrome` én in `app/(kaal)/layout.tsx`, beide gevuld met `await getServerNow()`. Zonder provider geeft `useServerNow()` `0` terug (dus index 0, de vroegste variant) en logt in development een waarschuwing.
- `clockLife` houdt `expire` (1 dag) altijd groter dan `revalidate` en `revalidate` minstens 60 s, zodat elke pagina statisch blijft (`○`, `1m` tot `1h` in de buildoutput).
- In productie is de testklok altijd uit: `VERCEL_ENV` is daar `"production"`. Beide variabelen zijn nodig; een vergeten variabele op een preview-deploy doet niets zonder de andere.

### 10.4 Geen cron (beslissing 52)

Laag 1 en laag 3 zijn exact; laag 2 volgt via `clockLife`. Een cron per minuut zou alleen laag 2 iets sneller maken, iets wat geen bezoeker ziet, en voegt een extra route toe die beveiligd moet worden. Daarom geen `vercel.json`. Dit staat los van het Vercel-plan: Pro is wel nodig, omdat Hobby alleen voor niet-commercieel gebruik is en de wachtlijst al aanmeldingen voor een bedrijf verzamelt (§11.9, beslissing 105). Voor noodgevallen ververst Tristan de klok met `POST /api/revalidate` (`Authorization: Bearer <REVALIDATE_SECRET>`, body `{"tags":["klok"]}`), beschreven in de README.

### 10.5 `TimeSwitch` en het inline script

```ts
// components/time/TimeSwitch.tsx ("use client")
export interface TimeSwitchProps {
  /** Epoch ms, ascending. Variant i shows when boundaries[i-1] <= now < boundaries[i]. */
  boundaries: number[];
  /** Length must be boundaries.length + 1. Rendered on the server; may contain server components passed as nodes. */
  variants: ReactNode[];
  /** Index from the server clock; used for the static HTML. Defaults to phaseIndex(boundaries, useServerNow()) (phaseIndex from lib/schedule.ts). */
  serverIndex?: number;
  as?: "div" | "span";
  className?: string;   // must reserve the height of the tallest variant (min-h) to avoid CLS
}

// components/time/TimeGate.tsx ("use client"): sugar for one boundary
export function TimeGate(props: { at: IsoDateTime; before: ReactNode; after: ReactNode; as?: "div" | "span"; className?: string }): React.JSX.Element;

// components/time/ClockProvider.tsx ("use client")
export function ClockProvider(props: { serverNow: number; children: ReactNode }): React.JSX.Element;   // ShopChrome passes await getServerNow()
export function useServerNow(): number;
```

Werking (volgt `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`):

1. De component rendert elke variant in een eigen `<span data-ts="{id}-{i}">` (of `div`), met `hidden` op alle behalve `serverIndex`, en `suppressHydrationWarning` op elke wrapper. `id` komt uit `useId()`.
2. Direct erna, als laatste kind binnen het rootelement van de `TimeSwitch` (zo blijft de component één element, beslissing 168), staat een `InlineScript` (CORVANE `components/ui/InlineScript.tsx`: `type="text/javascript"` op de server, `"text/plain"` in de client) met `timeSwitchScript(id, boundaries)` uit `components/time/timeSwitchScript.ts`. Dat script draait tijdens het parsen, vóór de eerste paint: het telt `Date.now() >= boundary` en zet `hidden` goed.
3. Na hydration bepaalt `useSyncExternalStore(subscribe, () => phaseIndex(boundaries, Date.now()), () => serverIndex)` de index. `subscribe` plant de volgende grens met `scheduleAt(boundary, cb)` uit `lib/schedule.ts` (en opnieuw daarna). Zo wisselt een open tabblad precies op tijd. Nooit `setTimeout(cb, boundary - now)` direct: browsers en Node bewaren de wachttijd als 32-bits getal, en boven 2^31−1 ms (ongeveer 24,8 dagen) gaat de timer meteen af. Bij de lancering ligt de btw-grens 35 dagen weg; dan zou elke pagina met een footer in een lus timers afvuren (beslissing 108).
4. Bij een client-navigatie rendert React meteen met de echte index (het script draait dan niet, dat is goed).
4a. Een layout-effect houdt de `hidden`-attributen gelijk aan de index, ook als er tussen parsen en hydration een grens voorbijgaat; bij `visibilitychange` (tabblad weer zichtbaar, bijvoorbeeld na slaapstand) wordt de tijd opnieuw bekeken (beslissing 168).
5. Geen `Date.now()` in render: alleen in de snapshot-functie en in het script (gemeten: blijft `○`, digest E1).

**Plekken en grenzen:**

| Element | Component | Grenzen | Varianten |
| --- | --- | --- | --- |
| Btw-regel (footer, cart, PDP) | `VatNotice` → `TimeGate at={site.vat.switchAt}` | 1 | `vat.before`, `vat.after` |
| Promobalk | `AnnouncementBar` | uit `promoSchedule(serverNow, 60 dagen)` | per segment `CampaignMessage`, `DropMessage` of `UspBar` |
| Dropbanner op home | `DropBanner` | `startsAt`, `endsAt` | niets / "Nu live" + countdown naar `endsAt` / niets (§12.4) |
| Label op PDP van dropproduct | `DropStatusLabel` | `startsAt`, `endsAt` | "Early access" / "Limited" / geen |
| Verzenddag (leverbalk, PDP, cart) | `ShipLabel` | `getShipSchedule()` (14 dagen) | tekst per entry; na de laatste entry de altijd-ware tekst `sharedCopy.deliveryBar.fallback` (of `sharedCopy.deliveryEstimate.fallback` voor `estimateText`) |
| Cadeauverpakking-prijs (PDP, cart) | `GiftWrapPrice` | `giftWrap.freeWindows` | "+€1,95" / "Gratis in december" |
| Lanceringscadeau-regel in cart | `CampaignCartNote` | campagnevenster | niets / `cartCopy.campaignNote` ("Bij deze bestelling zit een cadeautje van ons.") / niets |

`promoSchedule(from, days)` staat in `lib/dates.ts` (§9.1) en geeft `PromoEntry[]`; de server rendert per entry de variant. `AnnouncementBar` gebruikt `promoSchedule(await getServerNow(), 60)`.

### 10.6 `Countdown`

```ts
// components/time/Countdown.tsx ("use client")
export interface CountdownProps {
  target: IsoDateTime;                 // fixed date from content/drops.ts or content/offers.ts, never computed
  liveLabel?: string;                  // "Nu live"; without it the countdown renders nothing at 0
  srLabel: string;                     // formatCountdownSr(target, kind), visible to screen readers only
  fallbackLabel: string;               // fixed text before mount: formatEndLabel(target) for an end, formatStartLabel(target) for a start
  tone?: "op-donker" | "op-roest" | "licht";
  showPause?: boolean;                 // default true; hidden with reduced motion (then the fixed label shows)
  className?: string;
}
```

- Vóór mount: `fallbackLabel` in dezelfde vaste box (`tabular`, `min-w` per formaat). Een eigen inline script (`components/time/countdownScript.ts`, zelfde `InlineScript`-patroon als §10.5) schrijft de lopende cijfers vóór de eerste paint in die box; hydration houdt ze (`suppressHydrationWarning`). De vaste tekst is dus alleen te zien zonder JavaScript, gepauzeerd en met reduced motion (beslissing 167). Is het doel al voorbij (statische pagina van vóór het doel), dan zet het script vóór hydration de `liveLabel` in de box (en verbergt het het schermlezerlabel en de pauzeknop, gemarkeerd met `data-countdown-hide`) of verbergt het zonder `liveLabel` de hele countdown, net als React daarna (beslissing 187). Zonder JavaScript blijft de vaste tekst staan; een countdown waarvan het doel kan verlopen terwijl de pagina gecachet is, staat daarom in een `TimeSwitch` op dat doel. `countdownScript.test.ts` vergelijkt de uitvoer van het script met `formatCountdown`.
- **Start of einde.** Een countdown naar `startsAt` (promobalk `drop-upcoming`, `DropHero`, `DropTeaser`) krijgt `srLabel={formatCountdownSr(startsAt, "start")}` en `fallbackLabel={formatStartLabel(startsAt)}`. Een countdown naar `endsAt` (campagne, `DropBanner`) krijgt `formatCountdownSr(endsAt, "end")` en `formatEndLabel(endsAt)`. Zo zegt een timer naar een start nooit "Eindigt op" of "t/m".
- Na mount: tikt elke seconde via `useNow(1000)`, cijfers `aria-hidden`, de `srLabel` als `VisuallyHidden`, geen live region.
- Pauzeknop "Aftellen pauzeren" met `aria-pressed` en een vast label (WCAG 2.2.2), 32 px zichtbaar met een tikvlak van 44 px via `before:` (zo groeit de promobalk van 40 px niet). Gepauzeerd: de vaste eindtekst.
- Bij 0: `liveLabel` of niets. Nooit negatief, nooit opnieuw beginnen.

### 10.7 `useNow` en `scheduleAt`

Port van CORVANE `lib/hooks/useNow.ts` (gedeelde klok per interval, `null` op de server en tijdens hydration). Gebruik voor timers en de lokale cart. Nooit `new Date()` in render. Anders dan in CORVANE geeft de hook epoch-milliseconden en geen `Date`, omdat elke tijdfunctie in `lib/` `now: number` neemt (beslissing 143).

```ts
// lib/hooks/useNow.ts (3a/A1): "use client"
/** Epoch ms after mount, ticking every intervalMs; null on the server, during prerender and during hydration. Same interval = one shared timer. */
export function useNow(intervalMs?: number /* 1000 */): number | null;

// lib/schedule.ts (3a/A1): client-safe, no next/* imports
export const MAX_TIMEOUT_STEP_MS = 24 * 60 * 60 * 1000;
/** Calls cb once, at or just after `at` (epoch ms). Waits in steps of at most MAX_TIMEOUT_STEP_MS and re-checks now() each step. Returns a cancel function. */
export function scheduleAt(at: number, cb: () => void, now?: () => number /* Date.now */): () => void;

/** Number of boundaries <= now (TimeSwitch index). */
export function phaseIndex(boundaries: number[], now: number): number;
export interface CountdownParts { totalMs: number; days: number; hours: number; minutes: number; seconds: number }   // not "Countdown": that is the component
/** Clamped at 0. A string target is an ISO literal with offset from content (validated by the content tests). */
export function getCountdown(now: number, target: string | number): CountdownParts;
/** "2d 5u" (> 24 h) | "05:12:09" (≤ 24 h). Units come from the caller (Countdown passes sharedCopy.countdown), so this module has no content import. */
export function formatCountdown(c: CountdownParts, units: { days: string; hours: string }): string;
```

Deze vier staan in golf 3a (beslissing 137), zodat `TimeSwitch` en `Countdown` (3b/B2) niet wachten op `lib/dates.ts` (3b/B3), dat ze opnieuw exporteert.

`TimeSwitch`, `Countdown` (voor de eindgrens), de lokale cart-adapter en elke andere timer naar een tijdstip gebruiken `scheduleAt`. `lib/schedule.test.ts` (fake timers): een grens over 40 dagen roept `cb` niet binnen 1 s aan, wel precies op de grens; een grens in het verleden roept `cb` direct aan; annuleren werkt.

---

## 11. Prelaunch, preview en early access in `proxy.ts`

### 11.1 Matcher

```ts
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|sitemap.xml|robots.txt|brand/|images/|videos/|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|txt|xml|woff2?|mp4|webm)$).*)"],
};
```

Metadata-afbeeldingen zonder extensie (`/opengraph-image`, `/products/x/opengraph-image`, `/drops/x/opengraph-image`, `/icon`, `/apple-icon`) laat de proxy zelf door met `META = /\/(opengraph-image|twitter-image|icon|apple-icon)(-[\w-]+)?$/` (digest E2: anders krijgen ze de wachtlijst-HTML).

### 11.2 Volgorde in `proxy(request)`

```ts
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const now = requestNow(request);                       // test header only when the test clock is enabled
  const { pathname, searchParams } = request.nextUrl;

  // 1. Preview link: ?preview=<PRELAUNCH_BYPASS_TOKEN> → set cookie, 307 to the same URL without the param.
  // 2. Early-access link: /drops/<slug>?toegang=<token> → valid token: set cookie sparkela_ea_<slug>, 307 without the param.
  //    Invalid token: 307 without the param and no cookie (the gate below decides what is shown).
  // 3. META or /account:
  //    /account + SHOPIFY_CUSTOMER_ACCOUNT_URL → 307 there. Otherwise next().
  // 4. hasPreview = cookie sparkela_preview === sha256(PRELAUNCH_BYPASS_TOKEN). Preview skips 5 and 6.
  // 5. Drop gate (also after launch), for /drops/<slug>, /drops/<slug>/binnenkort and /products/<handle in drop.productHandles>:
  //      phase "verborgen"                        → rewrite to /drops/<slug>/binnenkort
  //      phase "early-access" without EA cookie   → rewrite to /drops/<slug>/binnenkort
  //      phase "early-access" with EA cookie      → next() (also during prelaunch)
  //      "live" | "afgelopen"                     → continue to 6
  //    /drops/<slug>/binnenkort requested directly in phase live/afgelopen → 307 to /drops/<slug>.
  // 6. Prelaunch (isPrelaunch(now)): allowlisted paths → next(); everything else → rewrite to /wachtlijst.
  // 7. After launch: /wachtlijst → 307 to /sparkela-club. Otherwise next().
}
```

Elke response krijgt `x-sparkela-gate: open | wachtlijst | preview | early-access | teaser` (handig voor tests, onschuldig in productie).

### 11.3 Allowlist tijdens prelaunch

`/wachtlijst`, `/nieuwsbrief/bevestigen`, `/algemene-voorwaarden`, `/privacy`, `/cookies`, `/herroepen`, `/contact`, `/verzenden-en-retourneren`, de early-access-paden uit stap 5, `/api/*` (al buiten de matcher), alle statische bestanden en metadata-routes. De wachtlijst en de bevestigingspagina gebruiken de `(kaal)`-layout. De toegestane juridische pagina's en de drop-teaser tonen de gewone shop-chrome: ze zijn statisch en hetzelfde voor en na de lancering. Een klik op een shoplink geeft tijdens de prelaunch de wachtlijst, en de cart weigert gewone producten (§7.4, cart-gate). Dat is bewust (beslissing 16).

### 11.4 Preview-link

- URL: `https://sparkela.nl/?preview=<PRELAUNCH_BYPASS_TOKEN>` (werkt op elk pad).
- Cookie `sparkela_preview` = hex SHA-256 van het token (`crypto.subtle.digest`), `httpOnly`, `secure` (behalve op `http://localhost`), `sameSite: "lax"`, `path: "/"`, `maxAge: 30 dagen`. Het token zelf staat nooit in de cookie of de URL na de redirect.
- Fout token: geen cookie, gewoon de gate. Geen variabele: preview werkt niet (fail closed).
- `lib/preview.ts`: `hashToken(token): Promise<string>`, `hasValidPreview(cookieValue, token): Promise<boolean>` (vergelijking in constante tijd).

### 11.5 Early access (beslissing 20)

- **Link** in de Club-mail: `https://sparkela.nl/drops/<slug>?toegang=<token>`.
- **Token** = eerste 22 tekens van base64url(HMAC-SHA256(`EARLY_ACCESS_SECRET`, `"ea:" + slug`)). Eén token per drop, voor alle Club-leden. Het lekt hooguit 24 uur vroegtijdige toegang tot een drop; dat is acceptabel en eenvoudig.
- **Cookie** `sparkela_ea_<slug>` = dat token, `httpOnly`, `secure`, `sameSite: "lax"`, `path: "/"`, verloopt op `endsAt` van de drop.
- **Bereik**: de droppagina en de PDP's van `drop.productHandles`, ook tijdens prelaunch. De rest van de shop blijft achter de gate. De cart (`/api/cart`) controleert dezelfde cookie voor dropvarianten (§7.4), zodat afrekenen werkt.
- **Shopify**: publiceer de dropproducten in het Headless-kanaal **ruim vóór** `earlyAccessAt`, uiterlijk de dag ervoor (beslissing 88), en voeg ze toe aan de handmatige collectie `alle` (positie = volgorde in de drop). Zonder `alle` haalt de catalogus ze los op met een waarschuwing (§7.7, beslissing 114). Een publicatie start geen betrouwbare webhook, en de site verbergt de producten zelf tot de juiste fase (`isListable`, proxy-gate, cart-gate). Na het publiceren ververst Tristan `products` met de curl uit de README (`/api/revalidate`, body `{"tags":["products"]}`).
- Elke handle in `drops[].productHandles` heeft in Shopify de tag `drop:<slug>`, en andersom. `content/drops.test.ts` controleert dat lokaal; de Shopify-catalogusprovider waarschuwt in de build bij een product met `drop:<slug>` dat niet in de lijst staat (dan schermt de proxy de PDP niet af).
- `lib/early-access.ts`: `earlyAccessToken(slug, secret): Promise<string>`, `isValidEarlyAccess(slug, cookieValue, secret): Promise<boolean>`, `earlyAccessLink(slug): Promise<string>` (voor het script dat Tristan de link geeft: `npm run early-access-link -- holiday-sparkle`, in `scripts/early-access-link.mjs`, golf 4-6/C1).

### 11.6 Wachtlijst: indexering

- Tijdens prelaunch geeft elke shop-URL de wachtlijst met status 200. De wachtlijst heeft `robots: index, follow`, canonical `/` en title "Sparkela | Binnenkort online". Zo komt de homepage alvast in Google zonder dubbele pagina's.
- Na launch stuurt `/wachtlijst` met 307 door naar `/sparkela-club` (307 zodat browsers het niet vast cachen).
- `sitemap.xml` bevat vanaf het begin de shoproutes (canonical wijst tijdens prelaunch naar `/`).

### 11.7 Tijd in tests

- Playwright start één productieserver met `SPARKELA_TEST_CLOCK=1` en `SPARKELA_TEST_NOW=2026-11-27T12:00:00+01:00` (vrijdag van de lancering, shop open, Holiday Sparkle live, lanceringscadeau actief). Dezelfde variabelen staan aan tijdens `next build`, zodat de server-klok in de statische pagina's ook die tijd heeft.
- Prelaunch- en early-access-tests sturen de header `x-sparkela-test-now: 2026-11-20T12:00:00+01:00` (of `2026-11-26T12:00:00+01:00`) mee met `test.use({ extraHTTPHeaders })`. Alleen de proxy leest die header.
- **Browserklok standaard op `TEST_NOW`.** De basis-`test` in `tests/e2e/fixtures.ts` heeft de optie `clockAt` (standaard `TEST_NOW`). Vóór elke `goto` doet de fixture `page.clock.install({ time: clockAt })` en daarna `page.clock.resume()`, zodat de browser dezelfde tijd heeft als de statische HTML en de tijd gewoon doorloopt. Specs die de tijd zelf sturen (popup, promobalk, cadeauverpakking, drops, prelaunch, early access) zetten `test.use({ clockAt: "…" })` of `clockAt: null` en installeren de klok zelf. Zonder dit zou de browser (echte tijd, vóór de lancering) na hydration andere varianten tonen dan de server.
- **Wat E2E niet dekt.** De testbuild staat op `TEST_NOW` (drop live). Wat de server-klok op 26 november doet (dropproducten in `getCatalogProducts` met `listable: false`, `getStackOptionsFor` en `getRecommendedFor` uit de drop, `getDropData` met fase `early-access`), dekt `lib/commerce/commerce.test.ts` met `serverNow()` gemockt op `2026-11-26T12:00:00+01:00`, plus een test van de lokale cart-adapter die een dropvariant met `listable: false` houdt. De cart-gate draait alleen in `/api/cart` (Shopify-provider); de E2E-build gebruikt de lokale provider, waar de adapter geen gate kent. Weigeringen dekken `lib/commerce/cart-gate.test.ts` en `tests/unit/api-cart.test.ts`; `early-access.spec.ts` dekt de proxy, de browser en lokaal toevoegen, met alleen positieve stappen (geen weigering verwachten).
- Unit: `tests/unit/proxy.test.ts` roept `proxy()` aan met `new NextRequest(url, { headers })` en controleert rewrite (`x-middleware-rewrite`), redirects en cookies; matcher via `unstable_doesProxyMatch` uit `next/experimental/testing/server`.

### 11.8 Launch-dag

- Om 00.00 uur stopt de proxy met herschrijven. De shoppagina's zijn al gebouwd en gecachet, dus er is geen deploy nodig en de shop flitst nooit vóór de wachtlijst (en andersom).
- Wie de wachtlijst open had: één klik of herlaad geeft de shop. De wachtlijstpagina toont een `TimeGate at={site.launchAt}` met na de grens de regel "We zijn live." en een knop "Naar de shop" in dezelfde hoogte, zonder layout shift. Die knop is een gewone `<a href="/">` (met `buttonClasses({ variant: "primair" })`, geen `next/link`), zodat hij altijd een volledige pagina laadt.
- **Client router cache** (beslissing 136). Juridische pagina's en de teaser tonen tijdens prelaunch de shop-chrome, en hun `<Link>`s prefetchen shoproutes. De proxy beantwoordt die prefetches met de wachtlijst, en de browser bewaart die per URL tot 5 minuten (digest A3, E2). Wie om 23.58 uur `/privacy` open heeft en net na 00.00 uur op "Oorbellen" klikt, kan dus nog tot 5 minuten de wachtlijst zien; herladen lost het op. `router.refresh()` helpt niet: dat wist alleen de cache van de huidige route. Dit accepteren we: het gaat om een paar bezoekers op een juridische pagina rond middernacht, en de wachtlijst zelf (de pagina waar bijna iedereen op staat) gebruikt een gewone link.
- Holiday Sparkle start op hetzelfde moment (`startsAt = launchAt`); de lijsten met dropproducten verversen via `clockLife` binnen enkele minuten, de banner en labels exact.
- Checklist (komt in `docs/TODO-LAUNCH.md`, §16.9): preview-link vooraf getest; alle producten actief en gepubliceerd, collectie `alle` gevuld, ook met de dropproducten (de shop toont anders een lege catalogus); `EARLY_ACCESS_SECRET` gezet; dropproducten uiterlijk 24 november gepubliceerd en `products` ververst; early-access-link verstuurd op 25 november; op 26 november 00.05 uur de early-access-link, een dropproduct in de cart en de checkout getest; op 27 november 00.05 uur `/`, een collectie, een PDP, de cart en de checkout-redirect gecontroleerd; zo nodig `klok` handmatig verversen.

---

### 11.9 Wachtlijst live zetten (na golf 4-6)

De wachtlijst gaat live zodra golf 4-6 groen is, ook als de producten nog niet in Shopify staan (beslissing 72). De productie-eis "altijd `shopify`" blijft. Vanaf dat moment verzamelt de site aanmeldingen voor een bedrijf, dus dit is de livegang uit brief §11. Minimaal nodig, en zo beschreven in de README-sectie "Wachtlijst live zetten" (C1):

0. **Vercel Pro** (Hobby is alleen voor niet-commercieel gebruik; beslissing 105).
1. Shopify Basic met het Headless-kanaal en een privé Storefront-token. Lukt het Headless-kanaal niet, dan kan een token ook via `storefrontAccessTokenCreate` (Admin API) worden gemaakt; noteer dat in TODO-LAUNCH. De Online Store blijft open, zonder wachtwoord (anders werkt de checkout niet, §16.6).
2. Een app in het Dev Dashboard met `read_customers` en `write_customers`, geïnstalleerd op de winkel: `SHOPIFY_ADMIN_CLIENT_ID` en `SHOPIFY_ADMIN_CLIENT_SECRET`.
3. **Blokkerende test van de Admin API** (beslissing 110): met de echte app op het echte plan één keer `customerByIdentifier` en `customerCreate` uitvoeren (`npm run test:shopify` doet dat met `SHOPIFY_LIVE_ADMIN=1` en een testadres `test+<datum>@sparkela.nl`). Shopify beperkt beschermde klantgegevens voor apps die een winkel zelf maakt; geeft de Admin API "not approved to access the Customer object" of `ACCESS_DENIED`, dan gaat de wachtlijst niet live tot een van de twee oplossingen werkt: (a) de app maken vanuit een Partner-account met custom distribution en het offline token via de eenmalige OAuth-installatie in `SHOPIFY_ADMIN_ACCESS_TOKEN` zetten, of (b) een hoger Shopify-plan (Grow).
4. Resend met een geverifieerd domein: `MAIL_API_KEY`, `MAIL_FROM`, `MAIL_TO` (nodig voor de bevestigingsmail van de dubbele opt-in, herroepen en contact).
5. Geheimen (minstens 32 tekens): `PRELAUNCH_BYPASS_TOKEN`, `EARLY_ACCESS_SECRET`, `NEWSLETTER_CONFIRM_SECRET`, `REVALIDATE_SECRET`.
6. Vercel: Root Directory `sparkela`, `COMMERCE_PROVIDER=shopify`, `SHOPIFY_STORE_DOMAIN`, de tokens hierboven, `NEXT_PUBLIC_SITE_URL=https://sparkela.nl`; domein sparkela.nl naar Vercel.
7. **Foto van Linde** voor de wachtlijst: `public/images/linde/wachtlijst.webp` (4:5, 1200×1500, `docs/ASSETS.md`) en de sleutel `linde.wachtlijst` in `SUPPLIED`. Zonder dat bestand laat `WaitlistHero` het fotoblok weg in plaats van een grijs vlak te tonen (§14.20, beslissing 119).
8. Controle met curl: `curl -sI https://sparkela.nl/collections/oorbellen` geeft 200 met `x-sparkela-gate: wachtlijst`; `curl -sI https://sparkela.nl/privacy` geeft `x-sparkela-gate: open`; `curl -sI "https://sparkela.nl/?preview=<token>"` geeft 307 met `set-cookie: sparkela_preview`. Daarna één echte aanmelding: de bevestigingsmail komt aan, de link zet de klant in Shopify op `SUBSCRIBED`.

`docs/ASSETS.md` en `docs/METAFIELDS.md` komen in dezelfde golf (C4), zodat Linde kan fotograferen en Tristan de metafields kan aanmaken terwijl de wachtlijst loopt (beslissing 122).

Zonder producten en zonder collectie `alle` slaagt de build (§7.7). De shoppagina's bestaan dan wel, maar zijn leeg en achter de gate. Producten importeren en publiceren kan daarna; de webhooks verversen de site.

## 12. Drops en acties

### 12.1 `content/drops.ts`

`EARLY_ACCESS_HOURS = 24`. Alle tijden zijn literals met offset (getest: geen berekende datums, geen `Date.now(` in het bestand). `endsAt` is exclusief. Data na Holiday Sparkle zijn voorstellen die Linde en Tristan bevestigen (beslissing 22).

| slug | Naam | `startsAt` | `endsAt` | Early access vanaf | Producten bij de start |
| --- | --- | --- | --- | --- | --- |
| `holiday-sparkle` | Holiday Sparkle | 2026-11-27T00:00:00+01:00 | 2027-01-01T00:00:00+01:00 | 2026-11-26T00:00:00+01:00 | 21 tot 24 uit §5.4 |
| `love-club` | Love Club | 2027-02-05T19:00:00+01:00 | 2027-03-01T00:00:00+01:00 | 2027-02-04T19:00:00+01:00 | `[]` |
| `oranje-spark` | Oranje Spark | 2027-04-09T19:00:00+02:00 | 2027-05-01T00:00:00+02:00 | 2027-04-08T19:00:00+02:00 | `[]` |
| `like-mother-like-daughter` | Like Mother, Like Daughter | 2027-05-01T19:00:00+02:00 | 2027-05-10T00:00:00+02:00 | 2027-04-30T19:00:00+02:00 | `[]` |
| `summer-spark` | Summer Spark | 2027-06-04T19:00:00+02:00 | 2027-09-01T00:00:00+02:00 | 2027-06-03T19:00:00+02:00 | `[]` |
| `main-character` | Main Character | 2027-09-03T19:00:00+02:00 | 2027-10-01T00:00:00+02:00 | 2027-09-02T19:00:00+02:00 | `[]` |
| `vamp` | Vamp | 2027-10-01T19:00:00+02:00 | 2027-11-01T00:00:00+01:00 | 2027-09-30T19:00:00+02:00 | `[]` |
| `spark-friday` | Spark Friday | 2027-11-26T00:00:00+01:00 | 2027-11-30T00:00:00+01:00 | 2027-11-25T00:00:00+01:00 | `[]` |

```ts
export const drops: Drop[] = [
  {
    slug: "holiday-sparkle",
    name: "Holiday Sparkle",
    tagline: "Het extra diamantje met kerst.",
    description: "…",   // own words, 2 short sentences
    startsAt: "2026-11-27T00:00:00+01:00",
    endsAt: "2027-01-01T00:00:00+01:00",
    productHandles: ["holiday-ster-oorbellen", "holiday-glitter-hoops", "holiday-sparkle-armband", "holiday-ster-ketting"],
    banner: { title: "Holiday Sparkle.", text: "Het extra diamantje met kerst.", cta: "Bekijk de drop" },
    teaser: { title: "Holiday Sparkle komt eraan", text: "Club-leden zijn er 24 uur eerder bij." },
    image: "drops.holiday-sparkle",
    seo: { title: "Holiday Sparkle", description: "…" },
  },
  // … seven more, same shape
];
```

Regels (getest in `content/drops.test.ts`): slugs uniek en gelijk aan `DropSlug`; `startsAt < endsAt`; alle tijden zijn literals met offset; `productHandles` is gelijk aan de producten met tag `drop:<slug>` in `content/products.ts`. Overlappende drops mogen (nu overlapt er geen); `getPromoState` kiest dan de eerst gestarte. Elke drop start publiek in de maand die brief §4 noemt; Like Mother, Like Daughter dus op zaterdag 1 mei, ruim voor Moederdag (9 mei 2027) (beslissing 184).

### 12.2 `content/offers.ts`

```ts
export const welcomeCode: WelcomeCodeOffer = {
  code: "WELKOM10", percent: 10, firstOrderOnly: true, combinesWithStack: false,
  excludedTypes: ["cadeaukaart"],   // gift wrap counts, after its December discount (§8.2 rule 4, beslissing 104)
};
export const stackDiscount: StackDiscountOffer = { percent: 15, minUnits: 3, eligibleTypes: ["oorbellen", "armbanden"] };
export const giftWrap: GiftWrapOffer = {
  productHandle: "cadeauverpakking", price: { cents: 195, currency: "EUR" }, maxPerOrder: 1,
  freeWindows: [
    { startsAt: "2026-12-01T00:00:00+01:00", endsAt: "2027-01-01T00:00:00+01:00" },
    { startsAt: "2027-12-01T00:00:00+01:00", endsAt: "2028-01-01T00:00:00+01:00" },
  ],
};
export const giftCards: GiftCardOffer = { productHandle: "cadeaukaart", denominations: [1500, 2500, 5000] };
export const campaigns: Campaign[] = [
  {
    id: "lanceringscadeau",
    title: "Lanceringscadeau",
    startsAt: "2026-11-27T00:00:00+01:00",
    endsAt: "2026-12-01T00:00:00+01:00",            // t/m 30 november
    promo: { message: "We zijn live. Bij elke bestelling krijg je een cadeautje van ons.", short: "Cadeautje bij elke bestelling", href: "/collections/nieuw", linkLabel: "Shop nieuw" },
    showTimer: true,
    inCart: false,
  },
];
```

- Het lanceringscadeau is geen product in de cart: Linde en Tristan stoppen het erbij. De cart toont tijdens het venster alleen een regel `cartCopy.campaignNote` ("Bij deze bestelling zit een cadeautje van ons.").
- Er is geen kortingsactie. Spark Friday is in 2026 gelijk aan de lancering (27 november is Black Friday) en wordt in 2027 een drop.
- `WELKOM10` heeft geen einddatum en dus nooit een timer.

### 12.3 Promobalk: keuze

`getPromoState(now)` (puur, §9.1), in deze volgorde:

1. Een actieve campagne (`startsAt <= now < endsAt`) → campagnebericht met timer naar `endsAt` (als `showTimer`) en de eindtekst ("t/m 30 november").
2. Een drop met `startsAt` binnen 7 dagen → "Nieuwe drop: {naam}. Over {timer}." met timer naar `startsAt` en link "Club-leden zijn er 24 uur eerder bij" naar `/sparkela-club`.
3. Een drop die minder dan 7 dagen live is → "Nu live: {naam}" met link "Bekijk de drop" naar `/drops/<slug>`. Geen timer.
4. Anders de USP-balk: op mobiel roteert één regel elke 4 s (pauzeknop, pauze bij hover en focus), vanaf `lg` staan de drie USP's naast elkaar.

De server rendert alle segmenten van `promoSchedule(serverNow, 60)`; `TimeSwitch` toont het juiste. Hoogte: `min-h-promo` (48 px onder `lg`, 40 px vanaf `lg`); tekst mag de balk hoger maken, nooit afknippen.

### 12.4 Dropbanner (home, sectie 7)

Brief §7: "Na de start verschijnen de banner en het label Limited". De banner bestaat dus alleen tussen `startsAt` en `endsAt` (beslissing 128). Vóór de start kondigen alleen de promobalk (§12.3, regel 2) en de teaser op `/drops/[slug]/binnenkort` de drop aan.

- Server: `getFeaturedDrop()` geeft de drop die op de server-klok live is, anders de eerstvolgende drop waarvan `startsAt` binnen 14 dagen ligt. Die tweede rendert de server mee, maar verborgen, zodat de banner precies op `startsAt` verschijnt, ook in een open tabblad. Geen drop → geen sectie.
- `DropBanner` is een `TimeSwitch` met grenzen `[startsAt, endsAt]` en varianten `[niets, banner, niets]`.
- Banner: vlak `bg-roest` met `data-vlak="roest"`: `Pill tone="outline-op-donker"` met `sharedCopy.countdown.live` ("Nu live"), naam als H2 (`drop.banner.title`), korte zin (`drop.banner.text`), de echte aftelklok (brief §6, blok 7): `Countdown` naar `endsAt` zonder `liveLabel`, met `srLabel={formatCountdownSr(endsAt, "end")}` en `fallbackLabel={formatEndLabel(endsAt)}` (bij Holiday Sparkle "t/m 31 december"), en een bot-witte knop (`Button variant="op-roest"`) met `drop.banner.cta` naar `/drops/<slug>`.
- De variant "niets" heeft hoogte 0. De banner verschijnt op `startsAt` en verdwijnt op `endsAt`; dat zijn veranderingen na een grens, niet tijdens het laden (geen CLS-meting).
- `drops.spec.ts` controleert dit (§19.2): op `TEST_NOW` staat de banner met "Nu live" en een timer; op 2026-12-31T23:59:55+01:00 en `runFor(10000)` is hij weg.

### 12.5 Limited en early access voor de Club

- "Limited" staat op kaarten van producten in een live drop (lijsten tonen ze alleen dan) en op de PDP via `DropStatusLabel`.
- Club-leden zijn nieuwsbriefleden (Shopify-klanten met e-mailtoestemming `SUBSCRIBED` en tag `club`). Ze krijgen de early-access-link via Shopify Email (§11.5). De site heeft geen login nodig.
- Op de droppagina in de early-access-fase staat bovenaan `EarlyAccessNote`: "Jij bent er 24 uur eerder bij. Publiek live op {formatStartLabel(startsAt)}."

---

## 13. Componenteninventaris

Legenda: **S** = server component (geen directive), **C** = client component (`"use client"`). **Bron** = CORVANE-bestand dat geport of aangepast wordt (`docs/REFERENCE.md` §5); "nieuw" = geen voorbeeld. Kopieer nooit merk, kleuren of copy van CORVANE: alleen structuur en logica (§21).

### 13.1 Merk (`components/brand/`, 3b/B1)

**`scripts/build-logo.mjs`** (`npm run logo`):

1. Leest `node_modules/@fontsource/unbounded/files/unbounded-latin-900-normal.woff` met `opentype.js`.
2. Zet "SPARKELA" om naar één pad: kapitalen, letter-spacing −0.03em (in font units: −0.03 × unitsPerEm per letter) bovenop de eigen kerning van het font (alleen P–A, −81 units; het script leest de kern-tabel zelf, omdat opentype.js 2 die overslaat; beslissing 159), schuinte `skewX(-10deg)` op de paden zelf (matrix, geen CSS).
3. Vonk: pad `M50 0 C53 35 65 47 100 50 C65 53 53 65 50 100 C47 65 35 53 0 50 C35 47 47 35 50 0 Z`, geschaald naar een halve kapitaalhoogte, rechtop (niet geschoren). Plaatsing zoals in `Sparkela_Logo_Eindconcept.pdf` (gemeten in de vectordata, beslissing 159): de box van de vonk begint 0,095 kapitaalhoogte rechts van en 0,039 kapitaalhoogte onder de rechterbovenhoek van de vlakke top van de laatste A. (De eerdere lezing, de rechterbovenhoek van de bounding box van de geschoren A, ligt boven de rechtervoet en zet de vonk 0,26 kapitaalhoogte los van de letter.) De vonk krijgt alleen `translate` en `scale` (`SPARK_TRANSFORM`), nooit skew of rotate.
4. Monogram: alleen de S (geschoren) met de vonk.
5. Schrijft `components/brand/logo-paths.ts` (`export const WORDMARK_PATH`, `SPARK_PATH`, `MONOGRAM_S_PATH`, `LOGO_VIEWBOX`, `MONOGRAM_VIEWBOX`, `SPARK_TRANSFORM`), de SVG's in `public/brand/` (§3.6), `app/icon.svg` (bot-wit S op inkt, afgeronde vierkant 20%; S en vonk 1,25 keer zo groot als in de app-iconen, ook in `favicon.ico`, zodat de S op 16 px leesbaar is, beslissing 160), `app/apple-icon.png` (180×180, bot-wit S en vonk op roest, via `sharp`), `app/favicon.ico` (PNG's 16, 32, 48 in een ICO-container, zelf geschreven header), `public/brand/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (veilige zone 80%).
6. Kleuren uit `lib/brand-colors.ts` (het script importeert een `.mjs`-kopie niet; het leest de waarden met een kleine regex uit `lib/brand-colors.ts`, of de waarden staan als constante bovenin het script met een test die ze vergelijkt).

| Component | S/C | Props | Rendert | Bron |
| --- | --- | --- | --- | --- |
| `LogoDefs` | S | geen | 0×0 `<svg aria-hidden>` met `<path id="sparkela-wordmark">`, `<path id="sparkela-spark">`, `<path id="sparkela-s">` (één keer per document, CORVANE D53.7) | `Wordmark.tsx` (patroon) |
| `Logo` | S | `{ variant?: LogoVariant; width?: number; className?: string; title?: string }` (`width` = breedte van het logo zelf, zonder vrije ruimte; standaard 120; `logoLayout(width)` geeft viewBox, buitenmaat en `clearSpace` in px, beslissing 161) met `LogoVariant = "header" \| "op-donker" \| "op-roest" \| "op-botwit" \| "op-olijf" \| "op-leisteen" \| "op-steen"` | Inline `<svg role="img" aria-label="Sparkela">` met `<use href="#sparkela-wordmark">` en de vonk. `width >= 70`: met vonk; `50 <= width < 70`: zonder vonk; `width < 50`: dev-warning "gebruik Monogram" (brief §3: onder 40 px het monogram, 40 tot 50 px vermijden) | `Wordmark.tsx` |
| `Monogram` | S | `{ variant?: "inkt" \| "botwit" \| "roest" \| "botwit-op-roest" \| "botwit-op-inkt"; size?: number; className?: string }` | S met vonk, `aria-label="Sparkela"` | `VaneIcon.tsx` (patroon) |
| `Spark` | S | `{ className?: string; title?: string }` | Losse vonk (`aria-hidden` zonder `title`), voor kaarten in de popup en decoratie | nieuw |

Kleurversies (`Logo variant`): `header` inkt woord, roest vonk · `op-donker` bot-wit woord, roest vonk · `op-roest` bot-wit woord en vonk · `op-botwit` roest woord en vonk · `op-olijf`, `op-leisteen` bot-wit woord en vonk · `op-steen` inkt woord, bot-witte vonk. Vrije ruimte rondom: de hoogte van de S, in de component zelf: de gerenderde `<svg>` is aan elke kant `clearSpace` px groter dan `width` (beslissing 161). Wie de letters op de rand van de container wil uitlijnen (header), compenseert met `logoLayout(w).clearSpace`. Nooit schaduw, contour, andere hoek of uitrekken. Het `Monogram` staat nooit in dezelfde header, lockup of hetzelfde blok als het woordmerk: het is alleen voor favicon, app-iconen, avatar en plekken onder 40 px.

Extra exports (3b/B1, beslissing 162): `logo-paths.ts` ook `CAP_HEIGHT`, `LOGO_BOX`, `WORDMARK_BOX`/`WORDMARK_VIEWBOX`, `CLEAR_SPACE`, `SPARK_VIEWBOX`, `MONOGRAM_SPARK_TRANSFORM`, `MONOGRAM_BOX`, `MONOGRAM_TILE`/`MONOGRAM_TILE_VIEWBOX`; `LogoDefs.tsx` de ids `LOGO_WORDMARK_ID`, `LOGO_SPARK_ID`, `LOGO_S_ID`; `Logo.tsx` `LOGO_SPARK_MIN_WIDTH` (70), `LOGO_MIN_WIDTH` (50), `LOGO_DEFAULT_WIDTH` (120) en `logoLayout`. Het OG-logo (10-11/E1) gebruikt `LOGO_VIEWBOX`, `WORDMARK_PATH`, `SPARK_PATH` en `SPARK_TRANSFORM`; het manifest de iconen `/brand/icon-192.png`, `/brand/icon-512.png` en `/brand/icon-maskable-512.png` (`purpose: "maskable"`).

### 13.2 UI-primitives (`components/ui/`, 3b/B2)

| Component | S/C | Props (TypeScript) | Rendert | Bron |
| --- | --- | --- | --- | --- |
| `Button` | S (link) / C niet nodig | `ButtonProps = ({ href: string } & AnchorAttrs \| ButtonAttrs) & { variant?: "primair" \| "op-roest" \| "outline" \| "outline-op-donker" \| "ghost" \| "link"; size?: "sm" \| "md" \| "lg"; fullWidth?: boolean; iconOnly?: boolean; loading?: boolean; loadingLabel?: string; iconStart?: ReactNode; iconEnd?: ReactNode }` + `buttonClasses(opts)` | `<a>` voor in-page ankers, `next/link` voor routes, anders `<button type="button">`. Hoogtes sm 36 / md 48 / lg 56 px, tikvlak min 44 px via `before:`. `primair`: `bg-primair text-primair-tekst hover:bg-primair-hover`; `op-roest`: `bg-bot-wit text-roest`; `outline`: `bg-transparent border-tekst text-tekst`; `outline-op-donker`: `bg-transparent border-bot-wit text-bot-wit`; `ghost` en `link` zonder vulling. Er is geen gevulde variant in inkt (brief §5: roest is de enige knopkleur; beslissing 77). `aria-disabled` in plaats van `disabled` tijdens laden (D34) | `Button.tsx` |
| `Pill` | S | `{ tone?: "licht" \| "donker" \| "outline" \| "outline-op-donker"; size?: "sm" \| "md"; icon?: ReactNode; children: ReactNode }` | USP-pill (32 px, 13 px tekst) | `Pill.tsx` |
| `StatusLabel` | S | `{ id: BadgeId; size?: "kaart" \| "pdp"; className?: string }` | Label uit §4.9, tekst uit `sharedCopy.badges` | `Badge.tsx` |
| `Chip` | C | `{ pressed?: boolean; onClick?: () => void; href?: string; children: ReactNode; count?: number }` | Togglechip 44 px met `aria-pressed` en vinkje als gekozen; als link een gewone chip (type/vibe/moment op PDP) | `CollectionView.tsx` (FilterChip) |
| `Container` | S | `{ as?: "div" \| "section" \| "header" \| "footer" \| "nav"; className?: string; children }` | 1240 px, 20/32 px gutter | `Container.tsx` |
| `SectionHeading` | S | `{ eyebrow?: ReactNode; title: ReactNode; intro?: ReactNode; level?: 1 \| 2 \| 3; align?: "left" \| "center"; tone?: "licht" \| "donker"; id?: string; action?: ReactNode }` | Kopblok (§4.4); `level` kiest `kop-1/2/3` | `SectionHeading.tsx` |
| `PageHeader` | S | `{ eyebrow?: string; title: string; intro?: string; breadcrumbs?: Crumb[] }` | Kop van gewone pagina's met kruimelpad | nieuw |
| `Breadcrumbs` | S | `{ items: Crumb[] }` | `<nav aria-label="Kruimelpad">` met `aria-current="page"` | `ProductInfo.tsx` (patroon) |
| `Price` | S | `{ display: PriceDisplay; size?: "sm" \| "md" \| "lg"; tone?: "licht" \| "donker"; from?: boolean }` | Prijs (`tabular`), `from` → "Vanaf €15"; bij `showCompareAt` **altijd** `<s>` + de regel `sharedCopy.price.lowest30d` (geen prop om die uit te zetten, brief §2.5) | `Price.tsx` |
| `Accordion` | C | `AccordionProps = { items: Array<{ id: string; title: ReactNode; content: ReactNode }>; headingLevel?: 2 \| 3 \| 4; tone?: "licht" \| "donker" } & ({ type: "single"; defaultValue?: string } \| { type?: "multiple"; defaultValue?: string[] })` | Radix Accordion, triggers 64/72 px, chevron in cirkel | `Accordion.tsx` |
| `Sheet` | C | als CORVANE: `{ open; onOpenChange; side?: "left" \| "right" \| "top"; size?: "sm" \| "md" \| "lg" \| "full"; title; hideTitle?; description?; headerExtra?; footer?; closeLabel?; onOpenAutoFocus?; onCloseAutoFocus?; children }` | Radix Dialog als drawer; `top` voor de zoekdialoog | `Sheet.tsx` |
| `Modal` | C | `{ open; onOpenChange; size?: "sm" \| "md" \| "lg"; anchor?: "center" \| "top"; title; hideTitle?; description?; footer?; tone?: "licht" \| "donker"; onOpenAutoFocus?; onCloseAutoFocus?; children }` | Radix Dialog, sluitknop 44×44 | `Modal.tsx` |
| `Tabs` | C | `{ tabs: Array<{ id: string; label: string; panel: ReactNode }>; label: string; defaultTab?: string; onChange?: (id: string) => void }` | `@radix-ui/react-tabs`; tablist scrollt horizontaal op mobiel; pijltjestoetsen, Home/End (beslissing 36) | nieuw |
| `Select` | C | `{ id?: string; label: string; hideLabel?: boolean; value: string; options: Array<{ value: string; label: string }>; onChange(v: string): void }` | Native `<select>` in pill van 44 px, `border-rand-invoer` | `SortSelect.tsx` |
| `Stars` | S | `{ rating: RatingSummary \| null; size?: "sm" \| "md"; showCount?: boolean; tone? }` | Niets bij `null` (altijd zolang er geen reviews zijn) | `Stars.tsx` |
| `Flag` | S | `{ label?: string; decorative?: boolean }` | NL-vlag als inline SVG met `fill-vlag-rood`, `fill-vlag-wit`, `fill-vlag-blauw` (tokens uit §4.1), dunne rand `stroke-rand` | `Flag.tsx` |
| `ScrollRow` | C | `ComponentPropsWithoutRef<"ul"> & { label: string; controls?: "md" \| "always" \| "none"; wrapperClassName?: string }` | Scroll-snap-lijst, `role="list"`, alleen focusbaar (`tabIndex=0`) als hij overloopt (ResizeObserver). Vorige/volgende-knoppen zweven over de randen (geen gereserveerde ruimte) en verschijnen pas als de rij gemeten overloopt; `controls` standaard `"md"` (beslissing 169) | `ScrollRow.tsx` |
| `Carousel` | C | `{ label: string; items: ReactNode[]; itemClassName?: string; className?: string }` | `role="region"` met `aria-roledescription="carrousel"` en `aria-label` › `ScrollRow` (lijst, naam `sharedCopy.ui.slides` "Dia's", zodat de naam van de carrousel niet twee keer klinkt; beslissing 188) › `listitem` › `role="group" aria-roledescription="dia" aria-label="{n} van {total}"`; knoppen "Vorige" en "Volgende" altijd (`controls="always"`). `itemClassName` zet de breedte van de dia's (beslissing 169) | nieuw (op `ScrollRow`) |
| `VisuallyHidden` | S | `{ as?; children }` | sr-only | `VisuallyHidden.tsx` |
| `InlineScript` | C | `{ html: string }` | Zie §10.5 | `InlineScript.tsx` |
| `MotionStyles` | S | geen | `<style href="sparkela-motion" precedence="default">` met alle keyframes. Eén keer, in `app/layout.tsx`; `Sheet`, `Modal` en `Accordion` renderen hem niet zelf (beslissing 171). De hulpklassen `anim-overlay`, `anim-sheet-right/left/top`, `anim-modal`, `anim-accordion` en `anim-paneel` in `globals.css` kiezen per Radix-`data-state` een keyframe en staan altijd achter `motion-safe:` | `MotionStyles.tsx` |
| `Checkbox` | C | `{ id?: string; checked: boolean; onChange(v: boolean): void; label: ReactNode; description?: ReactNode; required?: boolean; error?: string }` | Native checkbox 24 px met tikvlak 44 px, rand `--rand-invoer` | nieuw |
| `TextField` | C | `{ id?: string; label: string; type?: "text" \| "email"; autoComplete?: string; value; onChange; error?: string; hint?: string; required?: boolean; multiline?: boolean; maxLength?: number }` | Label boven het veld, fout eronder met `aria-describedby`, `aria-invalid` | `ContactForm.tsx` (FormField) |
| `ProgressBar` | S | `{ value: number /* 0..1 */; label: string; segments?: number }` | Balk 4 px, `role="progressbar"` met `aria-valuenow`, forced-colors-vulling | `ShippingProgress.tsx` |
| `Spinner` | S | `{ label: string }` | Klein draaiend icoon met sr-tekst, `motion-safe` | nieuw |

Uitwerking in 3b (B2):

- **`Button`** (beslissing 170): icoonknoppen in `sm` zijn 44 px; tekstknoppen in `sm` 36 px met een tikvlak van 44 px via `before:`. `outline` krijgt bij hover een inset-ring in plaats van een vulling; `ghost` erft de tekstkleur en krijgt bij hover 10% van die kleur, zodat hij op lichte en donkere vlakken werkt. Een ladende knop krijgt `aria-disabled` en `aria-busy`, nooit `disabled`.
- **Extra props** (beslissing 171, alleen toevoegingen): `Sheet` `surface` (`"pagina"` of `"vlak"`), `trigger`, `defaultOpen`, `padded`, `className`, `bodyClassName`, `hideDescription`, en `size="md"` is op mobiel volle breedte en vanaf `md` 432 px (cart drawer); `Modal` dezelfde plus `tone`; `Select` `layout` (`"stack"` of `"inline"`), `name`, `selectClassName`; `TextField` `name`, `inputMode`, `onBlur`, `markOptional`, `rows`, `placeholder`; `Checkbox` `name`; `ProgressBar` `tone`; `Tabs` `className`, `panelClassName`. `Sheet.tsx` exporteert ook `useReturnFocus` en `overlayClasses`.
- **Gebruik in 4-6 (C3):** cart drawer `Sheet side="right" size="md"`, menu `Sheet side="left" size="sm" surface="vlak"`, megamenupaneel `motion-safe:anim-paneel` met een eigen `data-state`, promobalk `<Countdown tone="op-donker">`, footer `VatNotice tone="donker"`.

### 13.3 Tijd (`components/time/`, 3b/B2)

`TimeSwitch`, `TimeGate`, `ClockProvider`/`useServerNow`, `Countdown` en `timeSwitchScript`: zie §10.5 en §10.6.

| Component | S/C | Props | Rendert |
| --- | --- | --- | --- |
| `VatNotice` (`components/time/VatNotice.tsx`, 3b/B2) | C | `{ className?: string; tone?: "licht" \| "donker" }` | `TimeGate at={site.vat.switchAt}` met `site.vat.before`/`after`; gebruikt door `MiniFooter` (C1), `Footer`, `CartTotals` (C3) en `ProductInfo` (D2) |

`ShipLabel` staat in §13.5 (`components/layout/`, C3), `GiftWrapPrice` en `CampaignCartNote` in §13.7 (`components/cart/`, C3).

### 13.4 Media (`components/media/`, 3b/B2)

| Component | S/C | Props | Rendert | Bron |
| --- | --- | --- | --- | --- |
| `PhotoSlot` | S | `{ assetKey?: AssetKey; label: string; aspect?: "4:5" \| "3:4" \| "16:9" \| "1:1" \| "9:16" \| "fill"; sizes?: string; preload?: boolean; tone?: "vlak" \| "kaart" \| "donker"; alt?: string; className?: string }` | Met een aangeleverd bestand (`SUPPLIED.has(key)`): `next/image` met `sizes` en `preload` voor LCP. Anders een vlak in `--vlak` met "FOTO: {label}" in Inter 12 px, midden, zelfde verhouding. Geen verloop, geen icoon | `PhotoSlot.tsx` |
| `VideoSlot` | S/C | `{ assetKey?: AssetKey; label: string; tone?: "vlak" \| "kaart" \| "donker"; className?: string }` | 9:16, nooit autoplay; placeholder "VIDEO: {label}"; met bestand een `<video controls preload="none" poster>` | `VideoSlot.tsx` |
| `ProductPhoto` | S | `{ image: ProductImage \| null; productTitle: string; kind?: ImageKind; sizes: string; preload?: boolean; className?: string }` | Altijd 4:5. `next/image` via de Shopify-loader; een lege alt uit Shopify wordt `sharedCopy.ui.imageAlt(title, sharedCopy.ui.imageKinds[kind])`; zonder beeld een `PhotoSlot` met "FOTO: {titel}, {kind}" | nieuw |

Een placeholder van `PhotoSlot` en `ProductPhoto` heeft `role="img"` met de alt-tekst die de echte foto zou krijgen; een decoratief vlak (`alt=""`) is `aria-hidden` (beslissing 172).

### 13.5 Layout (`components/layout/`, 4-6/C3)

| Component | S/C | Props | Rendert | Bron |
| --- | --- | --- | --- | --- |
| `ShopChrome` | S (async) | `{ children: ReactNode }` | Haalt `getCatalogProducts()`, `getServerNow()`, `resolveProviderName()`. Rendert `ClockProvider` › `CatalogProvider` › `CartProvider` › (`ConsentBanner`?) `AnnouncementBar` `Header` `<main id="main" tabIndex={-1} className="flex-1 focus:outline-none">children</main>` `Footer` `CartDrawerLoader` `CartAnnouncer` (`AnalyticsLoader`?). C3 bouwt hem in golf 4-6 **zonder** `EmailCaptureLoader` en zonder reviewblok. De integrator van golf 7-9 voegt `<ReviewsCarousel reviews={reviews} variant="footer" />` direct boven `Footer` en `<EmailCaptureLoader />` na `Footer` toe (twee regels, zijn enige wijziging in dit bestand) | `app/layout.tsx` (CORVANE) |
| `SkipLink` | S | `{ targetId?: string }` | "Naar de inhoud", z-70, zichtbaar bij focus (3a/A2) | `SkipLink.tsx` |
| `RouteFocus` | C | `{ targetId?: string }` | Focus naar `<main>` na navigatie als focus op body of onzichtbaar is; `usePathname` binnen eigen `<Suspense fallback={null}>` (3a/A2) | `RouteFocus.tsx` |
| `AnnouncementBar` | S (async) | geen | `data-vlak="donker"`, `bg-donker text-tekst-op-donker`, `min-h-promo`; `TimeSwitch` over het promoschema (§12.3); `print:hidden` | `PromoBar.tsx`, `promo/*` |
| `UspBar` | C | `{ usps: string[] }` | Mobiel roterend (4 s, pauzeknop, pauze bij hover/focus), vanaf `lg` drie naast elkaar | `promo/UspBar.tsx` |
| `CampaignMessage` | S | `{ campaign: Campaign }` | Bericht, `Countdown` naar `endsAt` (eind-labels, §10.6: fallback "t/m 30 november"), link | `promo/CampaignMessage.tsx` |
| `DropMessage` | S | `{ drop: Drop; state: "upcoming" \| "live" }` | "Nieuwe drop: …" met timer naar `startsAt` (start-labels, §10.6), of "Nu live: …" | nieuw |
| `Header` | S (async) | geen | Haalt `getFeaturedDrop()` en `getVisibleStacks()` voor de `MobileNavFeature` (§2.5): de drop alleen bij `phase === "live"`, anders de eerste stack. Sticky `top-0 z-30 h-header bg-pagina border-b border-rand`; mobiel grid `1fr auto 1fr`: [`MobileNav` + `SearchButton`] [`Logo variant="header"` 120 px, 104 px onder `xs`] [`AccountLink` (vanaf `xs`) + `CartButton`]; vanaf `xl`: [`Logo` 150 px] [`DesktopNav`] [zoeken, account, `CartButton`]. Compacte staat via `HeaderCompactSentinel` (`data-compact` op de header: logo 120 → 104 px, kleinere padding), buitenhoogte blijft gelijk (beslissing 40) | `Header.tsx` |
| `header/DesktopNav` | C | `{ items: NavItem[] }` | Links met onderstreeplijn (300 ms, `aria-current`), twee `NavDisclosure`-groepen | `header/DesktopNav.tsx` |
| `header/NavDisclosure` | C | `{ group: NavGroup; images?: Partial<Record<string, AssetKey>> }` | Knop met `aria-expanded`/`aria-controls`, paneel over containerbreedte, z-30, `shadow-zwevend`; Esc sluit en zet focus terug; sluit bij klik buiten, focus buiten en `onNavigate` | nieuw |
| `header/CartButton` | C | geen | "Tas" + `(n)` in vaste box (`min-w-[4.5ch] tabular`); vóór hydration "Tas" met gereserveerde ruimte; naam "Tas, {n} artikelen"; `aria-haspopup="dialog"`, `aria-expanded` | `header/CartButton.tsx` |
| `header/SearchButton` | C | geen | Icoonknop 44 px "Zoeken", opent `SearchDialog` | nieuw |
| `header/AccountLink` | S | geen | Icoonlink 44 px naar `/account`, "Account" | nieuw |
| `header/HeaderCompactSentinel` | C | geen | 1 px sentinel bovenaan; IntersectionObserver zet `data-compact` | nieuw |
| `SearchDialog` | C | `{ open: boolean; onOpenChange(v: boolean): void }` | `Sheet side="top"`: zoekveld, live top 6 uit `searchProducts`, "Alle resultaten" → `/zoeken?q=`; Enter gaat naar `/zoeken?q=` | nieuw |
| `MobileNav` | C | `{ feature: MobileNavFeature \| null }` | Hamburger 44 px; lazy `MobileNavSheet` via `next/dynamic` na `useAfterLoad`; `useLatch` (`lib/hooks/useLatch.ts`) | `MobileNav.tsx` |
| `MobileNavSheet` | C | `{ open: boolean; onOpenChange(v: boolean): void; onNavigate(): void; feature: MobileNavFeature \| null }` (`MobileNavFeature` uit §6.12; `MobileNav` krijgt hem als prop van `Header`, dat hem met `getFeaturedDrop()` en `getVisibleStacks()` bepaalt) | §2.5 mobiel; sluit bij navigatie en bij resize naar `xl` | `MobileNavSheet.tsx` |
| `Footer` | S | geen | Bestand `components/layout/Footer.tsx` (subcomponenten in hetzelfde bestand of in `components/layout/footer/`, C3). `data-vlak="donker"`; bovenaan Club-aanmelding (`SubscribeForm source="footer"` met `site.club.title`), kolommen (§2.5), `PaymentBadges tone="donker"`, socials (↗, `rel="noopener"`), bedrijfsgegevens, `VatNotice`, de link `<a href="/herroepen">{site.withdrawalLinkLabel}</a>` ("Hier de overeenkomst herroepen", exact dit label en dit doel), © met jaar als literal in content | `Footer.tsx` |
| `prelaunch/MiniFooter` | S | geen | Voor de `(kaal)`-layout: juridische links (`legalNav`), dezelfde link `<a href="/herroepen">{site.withdrawalLinkLabel}</a>` als de footer, bedrijfsgegevens en `VatNotice`. `layout.spec.ts` controleert de link op elke route (§19.2). Bestand `components/prelaunch/MiniFooter.tsx` (4-6/C1); er is geen `components/layout/footer/MiniFooter.tsx` | nieuw |
| `PaymentBadges` | S | `{ tone?: "licht" \| "donker"; size?: "sm" \| "md" }` | Neutrale tekstbadges uit `site.paymentMethods`, geen merklogo's (beslissing 93) | `PaymentIcons.tsx` |
| `ShipLabel` | C | `{ schedule: ShipLabelEntry[]; field: "barText" \| "estimateText" \| "dispatchLabel"; className?: string }` | `TimeSwitch` over het schema; na de laatste entry de fallback uit `sharedCopy` | nieuw |

### 13.6 Consent en analytics (`components/consent/`, 4-6/C3)

| Component | S/C | Props | Rendert | Bron |
| --- | --- | --- | --- | --- |
| `ConsentBanner` | C | geen | Alleen gerenderd als `site.analytics.enabled`. Niet-modale kaart onderaan, z-50, "Akkoord" en "Weigeren" even groot, link naar `/cookies`; zet `body[data-consent-open]` en `scroll-padding-bottom` | `ConsentBanner.tsx` |
| `AnalyticsLoader` | C | geen | GTM alleen na `granted` en geldig ID; Consent Mode-volgorde zoals CORVANE | `AnalyticsLoader.tsx` |
| `CookieSettingsButton` | C | `{ className?: string; tone?: "licht" \| "donker" }` | Knop met `cookieTable.settingsLabel`; dispatcht `OPEN_CONSENT_EVENT` (`"sparkela:open-consent"`, uit `lib/analytics.ts`); rendert niets zonder `site.analytics.enabled`. Eigenaar 4-6/C1 (paar 1), de footer van C3 gebruikt hem | `footer/CookieSettingsButton.tsx` |

`lib/analytics.ts` (port, 3b/B1, `sparkela:`-sleutels, client-veilig): `OPEN_CONSENT_EVENT = "sparkela:open-consent"`, `track(event: AnalyticsEvent)`, `productToItem(p, variant, qty)`, `cartToItems(cart)`, `getConsent()`, `setConsent(v)`, `subscribeConsent(cb)`, `shouldShowConsentBanner({ enabled, consent, reopened })`, `shouldLoadAnalytics({ enabled, gtmId, consent })` (invoerobjecten, zodat ze puur blijven), `isValidGtmId(id)`. Daarnaast (beslissing 163): `centsToEuros`, `getServerConsent`, `resetConsent`, `gtmScriptUrl(id)`, `initConsentMode()`, `syncConsentMode(consent)`, `startTagManager()`, `clearAnalyticsCookies()` (voor `AnalyticsLoader`, C3) en de kant-en-klare events `viewItemEvent(product, variant)` (D2, `BuyBox`), `addToCartEvent(product, variant, qty)` en `beginCheckoutEvent(cart)` (C2a), `signUpEvent(source)` (C1, `SubscribeForm`); de omrekening van centen naar euro's (ook eenheidsprijs × aantal) blijft zo in `lib/analytics.ts`. `track` pusht altijd naar `window.dataLayer` (ook zonder consent: dat is een lokale array zonder netwerk); GTM leest hem pas na toestemming. Op de server doet `track` niets.

`lib/subscription.ts` (3b/B1, client-veilig): `markSubscribed(): void`, `hasSubscribed(): boolean`, `useSubscribed(): boolean` (`useSyncExternalStore`, `false` op de server), op `storageKeys.emailCaptureSubscribed` via `lib/storage.ts`; `subscribeSubscribed(cb)` synchroniseert tussen tabbladen. `SubscribeForm` (C1) en de popup (D4) gebruiken dit; zo hoeft niemand in 4-6 te wachten op `components/email/state.ts`.

### 13.7 Cart (`components/cart/`)

| Component | S/C | Props | Rendert | Bron | Golf |
| --- | --- | --- | --- | --- | --- |
| `CartProvider`, `useCart` | C | §7.4 | State; adapters uit `lib/commerce/cart/` | `CartProvider.tsx` | 4-6/C2a |
| `CartAnnouncer` | C | geen | `role="status" aria-live="polite"` met de laatste melding uit `sharedCopy.announce` (§5.9) | `CartProvider.tsx` (deel) | 4-6/C2a |
| `CartDrawerLoader` | C | geen | Lazy drawer na `useAfterLoad` of eerste open | `CartDrawerLoader.tsx` | 4-6/C3 |
| `CartDrawer` | C | geen | `Sheet side="right"` (vol breed mobiel, 432 px vanaf `md`), kop "Je tas" + aantal; body: `CartProgressBars`, regels (`CartLineItem`), `GiftWrapToggle`, `GiftMessageField`, `CampaignCartNote`, `CartUpsell`, `PaymentBadges`; sticky voet: `CartTotals`, `CheckoutButton`. Focus-trap, Esc, focus terug, sluit bij navigatie, na verwijderen focus naar volgende regel | `CartDrawer.tsx` | 4-6/C3 |
| `CartProgressBars` | S | `{ progress: CartProgress }` | Twee mijlpalen: balk naar gratis verzending + 3 segmenten voor stack; teksten uit `progressTexts` | `ShippingProgress.tsx` | 4-6/C3 |
| `CartLineItem` | C | `{ line: CartLine; onRemove(id: string): void; readOnly?: boolean }` | Foto 56×70 (`ProductPhoto`), titel (link), variant, `QuantityStepper`, regelprijs (`subtotal`); per korting op de regel een eigen regel `cartCopy.line.discount(label, bedrag)` ("Stack-korting −€2,24") en daaronder het regeltotaal. Nooit een doorgestreepte prijs: `<s>` bestaat alleen in `Price` (brief §2.5, beslissing 117). "Verwijderen" | `CartLine.tsx` | 4-6/C3 |
| `QuantityStepper` | C | `{ value: number; onChange(n: number): void; itemName: string; min?: number; max?: number; size?: "sm" \| "md" }` | −/n/+ met `aria-disabled` aan de grenzen, labels "Minder {naam}" / "Meer {naam}" | `QuantityStepper.tsx` | 4-6/C3 |
| `GiftWrapToggle` | C | geen | `Checkbox` "Cadeauverpakking" + `GiftWrapPrice`; verborgen zonder fysiek product | nieuw | 4-6/C3 |
| `GiftWrapPrice` | C | `{ className?: string }` | `TimeSwitch` over `giftWrap.freeWindows`: "+€1,95" / "Gratis in december" | nieuw | 4-6/C3 |
| `GiftMessageField` | C | geen | Uitklapbaar tekstveld "Cadeauboodschap" (max 200, teller), debounce 600 ms naar `setNote` | nieuw | 4-6/C3 |
| `CampaignCartNote` | C | geen | `TimeSwitch` over het campagnevenster | nieuw | 4-6/C3 |
| `CartUpsell` | C | `{ max?: number }` | "Maak de look af": tot 3 producten uit `useCatalog().products` (zelfde vibe, ander type, niet in de cart; bij 2 stackstukken eerst een stackstuk) in `ScrollRow`, elk met `QuickAdd size="sm"`. Rendert niets vóór `site.launchAt` (`TimeGate`): tijdens de prelaunch (ook early access op 26 november) weigert de cart-gate gewone producten (§7.4, beslissing 107) | `CartUpsell.tsx` | 4-6/C3 |
| `QuickAdd` | C | `{ product: CatalogProduct; size?: "sm" \| "md"; fullWidth?: boolean }` | Zie §13.8 (bestand `components/product/QuickAdd.tsx`, eigenaar C3 omdat cart-upsell en kaart hem allebei gebruiken) | `QuickAdd.tsx` | 4-6/C3 |
| `CartTotals` | C | `{ cart: Cart }` | `dl`: Subtotaal, per korting een rij (`−€X`), Verzending ("Gratis", bedrag, of "Berekend bij afrekenen"), Totaal, "Je bespaart €X", `VatNotice` | `CartSummary.tsx` | 4-6/C3 |
| `CheckoutButton` | C | `{ fullWidth?: boolean }` | "Afrekenen" (`primair`, 48 px), `loading` tijdens doorsturen, vuurt `begin_checkout` | `CartSummary.tsx` | 4-6/C3 |
| `CartEmpty` | S | geen | Kop "Je tas is nog leeg", regel, knop "Shop nieuw" en link "Bekijk alles" | `CartDrawer.tsx` | 4-6/C3 |

### 13.8 Product en collectie

| Component | S/C | Props | Rendert | Bron | Golf |
| --- | --- | --- | --- | --- | --- |
| `ProductCard` | gedeeld (S en C) | `{ product: CatalogProduct; headingLevel?: 2 \| 3; sizes?: string; preload?: boolean }` | `article` met container query; `bg-kaart border-rand rounded-kaart`; media 4:5 met `StatusLabel` (`cardBadge`) linksboven en vibe-chip rechtsonder (label uit `sharedCopy.vocab.vibe`); op `hover:hover` vanaf `lg` crossfade naar beeld 2; naam (`kop-4`, uitgerekte link), specregel (`tekst-klein text-tekst-2`), `Price` met `priceDisplay(defaultVariant(product), product.laagstePrijs30d)` (`from` bij meerdere prijzen; bij korting dus ook de laagste prijs van 30 dagen), `QuickAdd` (van C3). Naam staat eerst in de DOM. Sterren alleen met reviews | `ProductCard.tsx` | 4-6/C4 |
| `QuickAdd` | C | `{ product: CatalogProduct; size?: "sm" \| "md"; fullWidth?: boolean }` (eigenaar 4-6/C3) | Eén variant: knop "In tas" (`primair` sm, 36 px, tikvlak 44) die direct toevoegt, daarna 1,8 s "Toegevoegd". Meerdere varianten: knop "Kies" opent een kleine keuzelijst (`Popover`-achtig paneel binnen de kaart, `role="dialog"` niet-modaal, radio's per variant, uitverkochte disabled met "uitverkocht", knop "In tas"); Esc sluit. Cadeaukaart: link "Kies bedrag" naar de PDP. Uitverkocht: knop "Uitverkocht" `aria-disabled` | `QuickAdd.tsx` | 4-6/C3 |
| `ProductGrid` | gedeeld (S en C) | `{ products: CatalogProduct[]; label: string; headingLevel?: 2 \| 3; priorityCount?: number }` | `<ul role="list">` 2 / 3 / 4 kolommen (§4.4) | `ProductGrid.tsx` | 4-6/C4 |
| `SortSelect` | C | `{ value: SortKey; onChange(v: SortKey): void; id?: string }` | `Select` met de labels uit `sharedCopy.vocab.sort` ("Uitgelicht", "Prijs laag naar hoog", "Prijs hoog naar laag", "Nieuwste") | `SortSelect.tsx` | 4-6/C4 |
| `ProductCardSkeleton` | S | geen | Zelfde maten, voor fallbacks | nieuw | 4-6/C4 |
| `CollectionView` | C | `{ handle: string; products: CatalogProduct[]; cards: Record<string, ReactNode>; facets: Facets; stylingTile: ReactNode \| null; stylingTileAfter: number \| null }` | Leest `useSearchParams` (`type`, `vibe`, `moment`, `prijs`, `sort`), filtert en sorteert keyed `<li>`'s, schrijft met `history.replaceState`; aantal in live region; lege staat met "Wis filters" | `CollectionView.tsx` | 7-9/D3 |
| `CollectionViewFallback` | S | zelfde data | Volledige ongefilterde grid (statische HTML, no-JS) + `InlineScript` die bij een query de wrapper markeert (D50.9) | `CollectionView.tsx` | 7-9/D3 |
| `FilterBar` | C | `{ facets: Facets; value: Partial<Facets>; onChange(v): void; count: number; sort: SortKey; onSortChange(v): void }` | Vanaf `lg`: chiprijen per facet (`Chip` met `aria-pressed`) + `SortSelect`. Onder `lg`: knop "Filters ({n})" + `SortSelect` | nieuw | 7-9/D3 |
| `FilterSheet` | C | zelfde + `open`, `onOpenChange` | `Sheet side="left"` met per facet een `fieldset` van checkboxen; knoppen "Wis alles" en "Toon {n} producten" (beslissing 36) | nieuw | 7-9/D3 |
| `StylingTile` | S | `{ title: string; text: string; image: AssetKey; href: string }` | Tegel in het grid (zelfde maat als een kaart), link naar een stack of de Spark Finder | nieuw | 7-9/D3 |

**Gedeelde componenten** (beslissing 112). `ProductCard` en `ProductGrid` zijn synchroon, zonder hooks, zonder `server-only`- of `next/cache`-import en zonder data op te halen. Daardoor werken ze als server component én binnen een `"use client"`-bestand (hun kinderen `QuickAdd`, `ProductPhoto`, `Price` en `StatusLabel` mogen dat ook). `FinderResult` en `SearchView` gebruiken ze direct; er is geen tweede kaart. `ProductCard.test.tsx` rendert de kaart ook in een client-wrapper. Omdat `"use client"` in Vitest niets doet en `server-only` daar een stub is, controleert dezelfde test ook statisch de imports (§19.1): geen `server-only`, `next/cache`, `lib/shop-data`, `lib/commerce/index`, `lib/commerce/local` of `lib/server-clock` in de importboom van `ProductCard.tsx` en `ProductGrid.tsx`, en geen async componentfunctie. FilterBar en FilterSheet nemen hun facetlabels uit `sharedCopy.vocab`.

### 13.9 Productpagina (`components/pdp/`, 7-9/D2)

| Component | S/C | Props | Rendert | Bron |
| --- | --- | --- | --- | --- |
| `ProductDetail` | S | `{ product: Product; badges: BadgeId[]; stacks: Array<{ stack: Stack; products: CatalogProduct[] }>; stackOptions: { candidates: CatalogProduct[]; defaultPicks: [string, string] \| null /* variant ids */ }; lookProducts: CatalogProduct[]; faq: FaqItem[]; claims: VerifiedClaim[]; schedule: ShipLabelEntry[] }` (alles uit `lib/shop-data.ts`, §14.2) | Grid uit §14.2 | `app/products/[slug]/page.tsx` |
| `ProductGallery` | C | `{ images: ProductImage[]; title: string }` | Mobiel: scroll-snap 4:5 met puntknoppen 44×44; vanaf `lg`: thumbnails links ("Toon afbeelding 2 van 5"), groot beeld, vorige/volgende; zoom: klik/Enter opent `Modal size="lg"` met het beeld op 2× breedte en pinch-zoom via native scroll; zonder beelden 5 placeholders (packshot, draagfoto, detail, schaal, stack). Eerste dia in de statische HTML met `preload` | `ProductGallery.tsx` |
| `ProductInfo` | S | `{ product: Product; badges: BadgeId[] }` (`badges` uit `getProductBadges`, zonder `limited` en `early-access`) | `StatusLabel`(s), `DropStatusLabel` voor dropproducten (het enige "Limited"/"Early access" op de PDP), H1, `Price` + `VatNotice`, korte stylingtekst, `ProductChips` | `ProductInfo.tsx` |
| `ProductChips` | S | `{ product: Product }` | Chips (links) voor type, vibe(s), moment(en) naar de collecties, labels uit `sharedCopy.vocab` | `NotesChips.tsx` |
| `BuyBox` | C | `{ product: Product; stackCandidates: CatalogProduct[]; defaultStack: [string, string] \| null /* variant ids */ }` | `VariantPicker`, `StackPicker` (alleen bij oorbellen en armbanden), `GiftWrapCheckbox`, `AddToCart`, `StickyAddToCart`; vuurt `view_item` | `ProductConfigurator.tsx` |
| `VariantPicker` | C | `{ product: Product; value: string; onChange(variantId: string): void }` | Kleur: radiogroep met swatches 44 px (goud/zilver als vlakken met tokens `--swatch-goud`, `--swatch-zilver`) plus naam; maat: radiotegels "16" tot "19" met link "Welke maat heb ik?" → `RingSizeGuide`. Uitverkocht: doorgestreept + "uitverkocht" in de naam. Voorraad ≤ 3: "Nog {n}" | `ScentSwatches.tsx` |
| `RingSizeGuide` | C | `{ open; onOpenChange }` | `Modal`: tabel maat → binnendiameter en omtrek, uitleg meten met een touwtje, tip "Twijfel je? Kies de grotere maat." | nieuw |
| `StackPicker` | C | `{ product: Product; candidates: CatalogProduct[]; defaultPicks: [string, string] \| null; value: StackChoice; onChange(v: StackChoice): void }` met `StackChoice = { mode: "los" } \| { mode: "stack"; picks: [string, string] /* variant ids */ }` | Twee radiotegels: "Los" (prijs) en "Stack van 3 (−15%)" (totaal, "Je bespaart €X" via `stackQuote`). Bij stack: twee `Select`s "Stuk 2" en "Stuk 3" met **één optie per beschikbare variant** van de kandidaten, label `pdpCopy.stack.option(title, variantLabel \| null, price)` ("Lola chunky hoops, Zilver · €19,95"; bij één variant "Jade stipjes · €12,95"). Standaard `defaultPicks` (Lindes stack, anders de terugval uit §7.2), nooit leeg. Het eerste stuk is de variant uit `VariantPicker`. "Voeg de stack toe" voegt precies die drie variant-id's toe. Bij `defaultPicks === null` alleen "Los". Echte stukprijzen zichtbaar | `BundlePicker.tsx`, `MixAndMatch.tsx` |
| `GiftWrapCheckbox` | C | `{ value: boolean; onChange(v: boolean): void }` | "Cadeauverpakking" + `GiftWrapPrice`; voegt bij toevoegen `setGiftWrap(true)` toe | nieuw |
| `AddToCart` | C | `{ disabled: boolean; label: string; onAdd(): Promise<void>; buttonRef: RefObject<HTMLButtonElement \| null> }` (React 19: `useRef<HTMLButtonElement>(null)` geeft `RefObject<HTMLButtonElement \| null>`) | "In winkelwagen · €X" (`primair` lg, vol breed), stack: "Voeg de stack toe · €X" | `ProductConfigurator.tsx` |
| `StickyAddToCart` | C | `{ targetRef: RefObject<HTMLButtonElement \| null>; title: string; summary: string; price: string; onAdd(): void }` | Onder `lg`, z-40, verschijnt als de hoofdknop uit beeld is (D46), `inert` als verborgen, body-padding en `sparkela:sticky-atc` event | `StickyAddToCart.tsx` |
| `DeliveryEstimate` | C | `{ schedule: ShipLabelEntry[] }` | Kaart met `ShipLabel field="estimateText"`, vlag, "Bezorging met PostNL in je brievenbus" | `DeliveryEstimate.tsx` |
| `TrustRow` | S | `{ variant?: "product" \| "giftcard" }` | Vier rijen: "Veilig betalen met iDEAL \| Wero", "Gratis verzending vanaf €35", "6 maanden garantie op verkleuring", "14 dagen bedenktijd". Cadeaukaart: alleen veilig betalen en "Direct in je mail" | `TrustRow.tsx` |
| `ProductSpecs` | C | `{ product: Product; claims: VerifiedClaim[]; variantId: string }` | `dl`: Materiaal (`materialForVariant(product.metafields.materiaal, gekozen variant)`, dus Zilver nooit "met goudlaag"), Afmeting, Gewicht, Sluiting; elke geverifieerde claim als extra rij `pdpCopy.claims.confirmed(label)` = "Nikkelvrij (bevestigd door de leverancier)". Nooit "getest" (beslissing 82). Leest de gekozen variant uit `PdpStateProvider` | `ProductInfo.tsx` |
| `StatementMeter` | S | `{ value: 1 \| 2 \| 3 \| 4 \| 5 }` | 5 segmenten "Subtiel" ↔ "Chunky" met label "Indicatief", `role="img"` met naam "Statement-meter: 4 van 5, indicatief"; lege segmenten met rand 3:1 | `IntensityMeters.tsx` |
| `ProductAccordions` | S→C | `{ product: Product; claims: VerifiedClaim[] }` | `Accordion type="multiple"`: Details en materiaal; Verzorging; Garantie; Verzenden en retourneren (als `needsHygieneSeal(product)`, dus bij `type === "oorbellen"` of tag `piercing`, de hygiëneregel `site.hygieneRule` als eerste zin); Productveiligheid (fabrikant, verantwoordelijke in de EU, productidentificatie = SKU en handle, waarschuwingen; ontbrekend → `pdpCopy.gpsr.missing`). Cadeaukaart: Productveiligheid met `pdpCopy.gpsr.digital` ("Digitaal product van Sparkela, geen fysiek product.") plus de bedrijfsgegevens uit `site.company`, nooit zelfgeschreven veiligheidstekst (beslissing 116) | `ProductAccordions.tsx` |
| `CompleteTheLook` | S | `{ products: CatalogProduct[] }` | "Maak de look af": 2 tot 4 `ProductCard`s met `QuickAdd` | `CrossSell.tsx` |
| `DropStatusLabel` | C | `{ drop: Drop }` | `TimeSwitch`: "Early access" / "Limited" / niets | nieuw |
| `PdpStateProvider` | C | `{ children }` | Bewaart variant, stackkeuze en cadeauverpakking per handle tijdens de sessie | `PdpStateProvider.tsx` |
| `ProductReviews` | S | `{ handle: string }` | Niets zonder echte reviews | `ReviewsSection.tsx` |
| `ProductFaq` | S | `{ items: FaqItem[] }` | Accordion met `onProduct`-vragen | `FaqSection.tsx` |

### 13.10 Home (`components/home/`, 7-9/D1)

| # | Component | S/C | Props | Bron |
| --- | --- | --- | --- | --- |
| 3 | `Hero` | S | `{ content: HomeContent["hero"] }` | `Hero.tsx` |
| 4 | `DeliveryBar` | S | `{ schedule: ShipLabelEntry[] }` | `DeliveryBar.tsx` |
| 5 | `LaunchCollection` | S | `{ products: CatalogProduct[] }` → `HomeProductTabs` | `ProductGridSection.tsx` |
| 5 | `HomeProductTabs` | C | `{ tabs: Array<{ id: string; label: string; handles: string[] }>; products: CatalogProduct[]; cards: Record<string, ReactNode> }` (sorteert met `sortProducts` over `products`, rendert de kaarten uit `cards` per handle) | `SortableProductGrid.tsx` |
| 8 | `HowToStack` | S | Van D3: `components/sections/HowToStack.tsx`, `{ content: HomeContent["howToStack"]; headingLevel?: 2 \| 3 }` | `HowItWorks.tsx` |
| 9 | `FavoritesCarousel` | S | `{ products: CatalogProduct[]; useSalesTitle: boolean }` (uit `homeFavorites()`, §14.1) | `ScrollRow` |
| 10 | `StatementVsSubtle` | S | `{ content: HomeContent["statementVsSubtle"] }` | `SolidVsSpray.tsx` |
| 11 | `MomentTiles` | S | `{ content: HomeContent["moments"] }` | nieuw |
| 13 | `ReviewsCarousel` | S | `{ reviews: Review[]; variant?: "home" \| "footer" }` → `null` zonder reviews of als `site.flags.showReviews` uit staat; `footer` is het blok boven de footer (§2.5) | `ReviewsSection.tsx` |
| 13 | `VideoRow` | S | `{ content: HomeContent["videos"] }`; rendert niets als `site.flags.hideMissingOptionalMedia` aan staat en geen enkele `video.*` in `SUPPLIED` staat (beslissing 127) | `VideoRow.tsx` |
| 14 | `PhotoStrip` | S | `{ content: HomeContent["photoStrip"] }`; zelfde regel met `fotostrook.*` (beslissing 127) | nieuw |
| 15 | `GuaranteeBlock` | S | `{ content: HomeContent["guarantee"] }` | `GuaranteeBlock.tsx` |
| 15 | `FaqSection` | S | `{ items: FaqItem[]; content: HomeContent["faq"] }`; gebruikt `FaqList` van D3 | `FaqSection.tsx` |
| 15 | `AboutLindeTeaser` | S | `{ content: HomeContent["aboutLinde"] }` | `StoryTeaser.tsx` |

Secties 1, 2 en 16 zijn chrome (§13.5); 6 is de popup (§13.11); 7 is `DropBanner` (§13.12); 12 is `SparkFinder` (§13.11).

### 13.11 Spark Finder en popup (7-9/D4)

| Component | S/C | Props | Rendert | Bron |
| --- | --- | --- | --- | --- |
| `SparkFinder` | S | `{ variant: "blok" \| "pagina"; headingLevel?: 1 \| 2 }` | `data-vlak="donker"` sectie (blok) of pagina-layout; kop links, `FinderQuiz` rechts | `ScentFinder.tsx` |
| `FinderQuiz` | C | `{ config: QuizConfig }` | Eén vraag per scherm: `fieldset` + `legend` (H3), native radio's als tegels (1 kolom, 2×2 vanaf `sm`), "vraag 1 van 3" + `ProgressBar segments={3}`, "Volgende" en "Terug"; zonder keuze een beleefde melding in een live region (geen disabled knoppen); focus naar de kop bij elke stap; vaste minimale hoogte per breakpoint (geen CLS); eerste vraag in de statische HTML | `FinderQuiz.tsx` |
| `FinderResult` | C | `{ answers: QuizAnswers; products: CatalogProduct[] }` | Kop "Jouw sparks", 3 tot 6 producten in `ProductGrid` (gedeelde component, §13.8, met `QuickAdd`), "Opnieuw beginnen", daarna e-mailblok "Krijg 10% op je eerste bestelling" met `SubscribeForm source="finder" quiz={answers}` en link "Liever zonder e-mail verder" | `FinderQuiz.tsx` |
| `finderState.ts` | puur | `type FinderStep = 0 \| 1 \| 2 \| "result"`; `next(state)`, `back(state)`, `recommend(answers, products, config?)` (signatuur in §5.7) | | `finderState.ts` |
| `EmailCaptureLoader` | C | geen | Lazy na `useAfterLoad`; niet op `/checkout` en niet als `site.emailCapture.enabled` uit is | `EmailCaptureLoader.tsx` |
| `EmailCapture` | C | geen | Beheert pill en modal volgens §13.11.1 | `EmailCapture.tsx` |
| `SparkPill` | C | `{ onOpen(): void; onDismiss(): void }` | Linksonder (16 px mobiel, 24 px desktop), z-45, `bg-kaart border-rand shadow-zwevend`, `Spark` + "Kies je spark" + sluitknop 44 px | `EmailCapture.tsx` (pill) |
| `SparkCards` | C | `{ chosen: number \| null; onChoose(i: number): void }` | Drie `<button>`-kaarten met vonk; omdraaien (300 ms, met reduced motion direct) onthult `site.emailCapture.reveal` = "WELKOM10 · 10% op je eerste bestelling" (brief §6, blok 6; beslissing 92) | `RewardCards.tsx` |
| `RewardCode` | C | `{ status: SubscribeResult["status"]; onDone(): void }` | Na aanmelden: "Check je mail om je aanmelding te bevestigen." (bij `pending`), code `WELKOM10`, "Kopieer code", "Zet op mijn tas" (`applyDiscountCode`), melding | `RewardCode.tsx` |
| `state.ts` | puur + hooks | `canShowPill(now)`, `markShown(now)`, `isCooldownOver(lastShown, now, days)`, `bodyBlocksPill()`; de aanmeldstatus komt uit `lib/subscription.ts` (`hasSubscribed`, `useSubscribed`; 3b/B1) | sleutel `sparkela:email-capture:last-shown` (plus `subscribed` via `lib/subscription.ts`) | `state.ts` |

#### 13.11.1 Popupregels (beslissing 37)

1. De **pill** verschijnt na 8 s op de pagina (`performance.now()` vanaf laden) of bij exit-intent op desktop (`pointer: fine`, muis verlaat het venster bovenaan), wat eerst komt.
2. Alleen als: opslag werkt (testschrijfactie), geen aanmelding (`subscribed`), `last-shown` ontbreekt of is ouder dan 7 dagen, geen open dialog of drawer, geen sticky koopbalk in beeld, geen open consentbanner, bezoeker typt niet. Niet op `/checkout` en `/wachtlijst`. Op PDP's verschijnt de pill wel, ook op mobiel (daar komt het meeste verkeer binnen): staat de sticky koopbalk in beeld, dan schuift de pill erboven (`bottom: calc(var(--onderbalk, 0px) + 16px)`; `StickyAddToCart` zet `--onderbalk` op `<body>`), zodat ze nooit overlappen (beslissing 118).
3. Bij tonen van de pill: `markShown(Date.now())` (in een effect, niet in render). Zo verschijnt hij hooguit één keer per 7 dagen.
4. De **modal** opent alleen na een klik op de pill. Titel "Kies je spark.", intro "Elke kaart geeft 10% op je eerste bestelling." (de beloning staat er vóór het kiezen). Drie kaarten; na een keuze verschijnt het e-mailveld met de consent-checkbox (§15.1) en de privacylink.
5. Na een geslaagde aanmelding toont de popup `RewardCode`. `markSubscribed()` en `track({ event: "sign_up", method: source })` doet `SubscribeForm` zelf, voor elke bron (popup, footer, Club, finder, wachtlijst; §13.13), dus de popup vuurt ze niet nog een keer. Daarna nooit meer een pill.
6. Sluiten van de pill (×) bewaart niets extra (last-shown staat al); hij komt die 7 dagen niet terug.

### 13.12 Drops, stacks, zoeken (7-9/D3)

| Component | S/C | Props | Rendert |
| --- | --- | --- | --- |
| `DropBanner` | S | `{ drop: Drop }` | §12.4 |
| `DropHero` | S | `{ drop: Drop }` | Op `bg-roest`: naam (H1), tagline, `Countdown` naar `startsAt` met `liveLabel` "Nu live", `srLabel={formatCountdownSr(startsAt, "start")}`, `fallbackLabel={formatStartLabel(startsAt)}` (§10.6), beeld (`PhotoSlot` 16:9 desktop, 4:5 mobiel) |
| `DropTeaser` | S | `{ drop: Drop }` | Teaser: naam, `formatStartLabel(startsAt)`, `Countdown` naar `startsAt` (start-labels, §10.6), Club-aanmelding (`SubscribeForm source="club"`) |
| `EarlyAccessNote` | C | `{ drop: Drop }` | `TimeGate at={startsAt}`: vóór de start de early-access-regel, daarna niets |
| `StackCard` | S | `{ stack: Stack; products: CatalogProduct[] }` (uit `getVisibleStacks`) | Beeld (`PhotoSlot` 4:5), naam, beschrijving, de drie stukken met prijs, totaal met stack-korting ("€X in plaats van €Y", berekend met `stackQuote`), `AddStackButton products={products}` |
| `AddStackButton` | C | `{ products: [CatalogProduct, CatalogProduct, CatalogProduct]; label: string }` | Per stuk met meer dan één variant een `Select` (label `collectionCopy.stacks.variantLabel(title)`, "Kleur van Noor dikke ringetjes", opties per beschikbare variant), standaard `defaultVariant(p)`; stukken met één variant zonder keuze. "Voeg de stack toe": `addToCart` met de drie gekozen variant-id's (`source: "stack"`); uitverkocht stuk → `aria-disabled` met uitleg |
| `SearchView` | C | geen | Leest `q` met `useSearchParams` (binnen Suspense), zoekveld, resultaten als `ProductGrid` (gedeelde component, §13.8), lege staat met suggesties (collecties) |
| `HowToStack` | S | `{ content: HomeContent["howToStack"]; headingLevel?: 2 \| 3 }` | `components/sections/HowToStack.tsx`: `<ol>` met drie stappen; home (H2) en `/stacks` (H2 onder de H1) |
| `FaqList` | S | `{ items: FaqItem[]; headingLevel?: 2 \| 3 \| 4; tone?: "licht" \| "donker" }` | `components/sections/FaqList.tsx`: `Accordion type="multiple"` met vraag en antwoord (link uit `FaqItem.link`); gebruikt door `/stacks`, `/cadeaukaarten` en de home (`FaqSection`) |
| `GiftCardTiles` | C | `{ product: CatalogProduct }` | `components/giftcards/GiftCardTiles.tsx`: per variant (€15, €25, €50) een tegel met het bedrag en een knop "In tas" die `addToCart([{ variantId, quantity: 1 }])` aanroept; uitverkochte variant `aria-disabled` |

### 13.13 Formulieren, juridisch, prelaunch, checkout (4-6/C1 en 7-9/D4)

| Component | S/C | Props | Rendert | Golf |
| --- | --- | --- | --- | --- |
| `SubscribeForm` | C | `{ source: SubscribeSource; quiz?: QuizAnswers; tone?: "licht" \| "donker"; layout?: "inline" \| "stacked"; submitLabel?: string; onSuccess?(r: SubscribeResult): void }` | E-mailveld, `ConsentCheckbox`, honeypot, knop (standaard `site.club.cta`); succes bij `pending`: "Check je mail en bevestig je aanmelding. Je code WELKOM10 kun je meteen gebruiken."; bij `already-subscribed`: "Je bent al lid. Je code is WELKOM10."; terugval met e-mailadres. Bij elk succes (`ok: true`) roept hij zelf `markSubscribed()` (`lib/subscription.ts`) en `track({ event: "sign_up", method: source })` (`lib/analytics.ts`) aan, daarna `onSuccess` | 4-6/C1 |
| `ConfirmSubscription` | C | geen | Op `/nieuwsbrief/bevestigen`: leest `t` met `useSearchParams` (binnen Suspense), haalt `t` direct na het lezen uit de adresbalk met `history.replaceState` (vóór analytics kan lezen) en toont één knop "Bevestig mijn aanmelding" die `POST /api/subscribe/confirm` doet (nooit automatisch bij laden: mailscanners openen links). Succes: "Je bent erbij." met link naar de shop (of de wachtlijst tijdens prelaunch); verlopen of ongeldig: uitleg en `SubscribeForm source="club"` | 4-6/C1 |
| `ConsentCheckbox` | C | `{ checked; onChange; error?: string; tone? }` | `Checkbox` met label `site.consentText` (exact), daaronder de link `site.privacyLink`. Nooit vooraf aangevinkt | 4-6/C1 |
| `WithdrawalForm` | C | geen | Velden naam, bestelnummer, e-mailadres, "Welke producten? (optioneel)"; één knop "Herroeping bevestigen"; succes toont de ontvangstbevestiging (referentie, datum en tijd, inhoud) | 4-6/C1 |
| `ContactForm` | C | geen | Naam, e-mail, bestelnummer (optioneel), bericht | 4-6/C1 |
| `Honeypot` | S | `{ name?: "website" }` | Verborgen veld (`aria-hidden`, `tabIndex=-1`, `autoComplete="off"`, buiten beeld) | 4-6/C1 |
| `FormStatus` | C | `{ status: "idle" \| "sending" \| "success" \| "error"; message?: string; fallbackEmail?: string }` | Live region; bij `not-configured` of `upstream`: "Dat lukt nu even niet. Mail ons op {email}." met `mailto:` | 4-6/C1 |
| `LegalPage` | S | `{ slug: LegalSlug; children?: ReactNode }` | `PageHeader`, `LegalNotice`, Markdown-inhoud, "Laatst bijgewerkt: {updatedAt}" | 4-6/C1 |
| `LegalNotice` | S | geen | Banner `bg-info-vlak`: "TODO: laten controleren" | 4-6/C1 |
| `Markdown` | S | `{ source: string }` | `marked` (server-side) naar HTML met vaste opmaak (`prose`-achtige eigen klassen); links intern via `next/link` niet nodig (gewone `<a>`) | 4-6/C1 |
| `UpcomingHolidays` | S | geen | Lijst van de komende feestdagen uit `shipping.holidays` (op verzenden-en-retourneren); toont alle feestdagen van 2026 en 2027 (geen klok nodig) | 4-6/C1 |
| `WaitlistHero` | S | geen | §14.20 | 4-6/C1 |
| `CheckoutView` | C | geen | Demo-checkout: besteloverzicht (regels, totalen), kortingscodeveld (`applyDiscountCode`), contact- en adresvelden (alleen vorm), `notice` "Demo-checkout: er wordt niet betaald", knop "Bestelling plaatsen (demo)" → `CheckoutState placed` met `DEMO-XXXXXX`, cart leeg | 7-9/D4 |
| `NotFoundView` | S (async) | geen | Dunne wrapper: `<NotFoundContent favorites={homeFavorites(await getShopProducts(), false).products.slice(0, 4)} />`. De enige 404-weergave: globale 404, `(shop)`-404 en de fallback van het 404-patroon op PDP, collectie en drop (beslissing 124) | 4-6/C4 |
| `NotFoundContent` | S (sync) | `{ favorites: CatalogProduct[] }` | Copy uit `sharedCopy.notFound`: "Deze pagina bestaat niet (meer)", link naar `/zoeken`, knoppen "Naar de shop" en "Spark Finder", de favorieten als `ProductCard`s (titel `sharedCopy.notFound.favoritesTitle`). In hetzelfde bestand `components/pages/NotFoundView.tsx`; dit is de geteste eenheid (beslissing 139) | 4-6/C4 |

### 13.14 SEO (`components/seo/`)

| Component | S/C | Props | Rendert | Golf |
| --- | --- | --- | --- | --- |
| `JsonLd` | S | `{ data: object \| object[] }` | `<script type="application/ld+json">` met `JSON.stringify(data).replace(/</g, "\\u003c")` | 3b/B3 |
| `OgImage` | S | `{ kind: "merk" \| "product" \| "drop"; title: string; subtitle?: string; imageUrl?: string }` | Satori-tekening 1200×630 op `--donker` of `--roest`, Unbounded 800 WOFF, Inter WOFF; productfoto alleen als JPEG via `ogPhotoUrl(url)` (alleen bij een `.jpg`/`.jpeg`/`.png`-origineel, met `width=1200&format=jpg`; anders `null` en geen foto, §17.3). De drop-OG heeft geen foto | 10-11/E1 |

---

## 14. Pagina-opbouw

Elke pagina exporteert `metadata` of `generateMetadata` via `pageMetadata()` uit `lib/seo.ts` (§18.1). Eén H1 per pagina. Pagina's renderen geen `<main>` (dat doet `ShopChrome`). SEO-inhoud (H1, prijs, koopkolom, JSON-LD) staat nooit binnen een `<Suspense>` (React outlining, digest A5).

### 14.1 Home (`app/(shop)/page.tsx`)

| # | Sectie | Component | Vlak | Data |
| --- | --- | --- | --- | --- |
| 1 | Aankondigingsbalk | `AnnouncementBar` (chrome) | donker | `promoSchedule` |
| 2 | Header | `Header` (chrome) | pagina | `navigation.ts` |
| 3 | Hero | `Hero` | donker | `home.hero`; H1; mobiel tekst eerst, dan foto 4:5 (`hero.mobiel`, `preload`); vanaf `lg` 12 kolommen, foto 16:9 (`hero.desktop`) rechts in 7 kolommen; drie `Pill tone="outline-op-donker"`, garantiebadge (rond, bot-wit rand), knoppen `primair` "Shop oorbellen" en `outline-op-donker` "Shop armbanden"; ratingregel alleen met `getRatingSummary()` |
| 4 | Leverbalk | `DeliveryBar` | pagina, rand onder | `getShipSchedule()`; mobiel drie regels (verzenddag, vlag + "Verzonden vanuit Nederland", "Gratis verzending vanaf €35"), vanaf `lg` één rij van 64 px |
| 5 | De lanceringscollectie | `LaunchCollection` → `HomeProductTabs` | pagina | `getShopProducts()`; tabs Alles/Oorbellen/Armbanden/Kettingen/Ringen, elk max 8 op `featuredRank`; `SortSelect` per tab; knop "Bekijk alles" → `/collections/alle` |
| 6 | Pill "Kies je spark" | `EmailCapture` (chrome) | | §13.11.1 |
| 7 | Dropbanner | `DropBanner` | roest | `getFeaturedDrop()`; ontbreekt zonder drop |
| 8 | Zo stack je | `HowToStack` (D3, `components/sections/`) | pagina, haarlijn boven | `<ol>` met drie stappen; mobiel rijen met icoon, vanaf `md` drie kolommen; link naar `/stacks` |
| 9 | Lindes favorieten / Bestsellers | `FavoritesCarousel` | vlak | `homeFavorites(products, site.flags.realSalesData)` (`lib/catalog.ts`, getest): met `realSalesData: false` de producten met `lindesFavoriet` en titel `home.favorites.title`; met `true` de producten met metafield `bestseller === true` op `featuredRank` en titel `home.favorites.titleWithSales`. Nooit Lindes keuzes onder de titel "Bestsellers" (beslissing 79). `Carousel` met `ProductCard`'s (62% breed mobiel, 4 zichtbaar vanaf `xl`) |
| 10 | Statement of subtiel? | `StatementVsSubtle` | pagina | twee kolommen (mobiel onder elkaar): foto 4:5, titel, eerlijke tekst zonder claims, knop naar `/collections/alle?vibe=chunky-en-bold` en `/collections/subtiel` |
| 11 | Shop per moment | `MomentTiles` | pagina | vijf tegels 4:5 met naam; mobiel `ScrollRow`, vanaf `lg` vijf kolommen |
| 12 | Spark Finder | `SparkFinder variant="blok"` | donker | `quiz` |
| 13 | Reviews en video | `ReviewsCarousel` (verborgen zonder reviews), `VideoRow` | pagina | `reviews`, `home.videos` (4 × `VideoSlot`) |
| 14 | Zo dragen jullie Sparkela | `PhotoStrip` | pagina, haarlijn boven | 6 tot 8 × `PhotoSlot` 1:1, elk een link naar het product (`aria-label` "Bekijk {product}") |
| 15a | Garantie | `GuaranteeBlock` | olijf (`data-vlak="olijf"`) | `home.guarantee`; knop `outline-op-donker` naar `/verzenden-en-retourneren` |
| 15b | FAQ | `FaqSection` | pagina | `faq.filter(onHome)`; link "Alle vragen" |
| 15c | Over Linde | `AboutLindeTeaser` | pagina, haarlijn boven | foto 4:5 (`linde.portret`), tekst met placeholder, knop naar `/over-sparkela` |
| 16 | Footer | `Footer` (chrome) | donker | |

JSON-LD: `organizationJsonLd()` en `websiteJsonLd()`.

### 14.2 Productpagina (`app/(shop)/products/[handle]/page.tsx`)

```ts
export const ensureStatic = "navigation";
export const instant = false;
export async function generateStaticParams() { return (await getShopProductsForParams()).map((p) => ({ handle: p.handle })); } // all products incl. drop products; empty catalog → NO_PRODUCTS_HANDLE, never []
export async function generateMetadata({ params }: PageProps<"/products/[handle]">) { … productMetadata(await getShopProduct(handle)) … }
export default async function Page({ params }: PageProps<"/products/[handle]">) {
  const { handle } = await params;
  const product = await getShopProduct(handle);
  if (!product || product.isGiftWrap) return <Suspense fallback={<NotFoundView />}><Missing /></Suspense>;
  const [badges, stackOptions, lookProducts, stacks] = await Promise.all([
    getProductBadges(handle), getStackOptionsFor(handle), getRecommendedFor(handle, 4), getVisibleStacks(),
  ]);   // all from lib/shop-data.ts; the page never builds CatalogProducts or badges itself
  return <ProductDetail product={product} badges={badges} stackOptions={stackOptions} lookProducts={lookProducts} stacks={stacks.filter(/* contains handle */)} … />;   // no Suspense around SEO content
}
async function Missing(): Promise<never> { notFound(); }
```

`getShopProductsForParams()` staat in `lib/shop-data.ts` (alle handles behalve `cadeauverpakking`). `productMetadata(null)` geeft de titel "Pagina niet gevonden" en `robots: { index: false }` (ook voor `NO_PRODUCTS_HANDLE`). De cadeaukaart heeft een eigen pagina-variant (zie onder).

**Dropproduct vóór de publieke start**: de stack-kiezer, Lindes stack en "Maak de look af" tonen alleen stukken uit dezelfde drop (`getStackOptionsFor`, `getRecommendedFor`, §7.2), zodat alles op de PDP ook tijdens early access in de tas kan.

**Opbouw** (beslissing 41, volgorde van CORVANE zodat de knop hoog staat):

1. `Breadcrumbs`: Home › {collectie van het type} › {product}.
2. Grid: mobiel één kolom (galerij tot de schermrand); `md` twee gelijke kolommen; `lg` `11fr 9fr`, gap 56 px (80 vanaf `xl`); beide kolommen `sticky top-[calc(var(--header-hoogte)+24px)]` vanaf `md`.
3. Links: `ProductGallery`.
4. Rechts, in volgorde: `ProductInfo` (labels incl. `DropStatusLabel` voor dropproducten, H1, prijs + `VatNotice`, stylingtekst, `ProductChips`) · verborgen H2 "Kopen" · `BuyBox` (`VariantPicker` → `StackPicker` → `GiftWrapCheckbox` → `AddToCart`) · `DeliveryEstimate` · `TrustRow` · `ProductSpecs` · `StatementMeter` · `ProductAccordions`.
5. Volle breedte: `CompleteTheLook` (2 tot 4 producten), `ProductReviews` (niets zonder reviews), `ProductFaq`.
6. `StickyAddToCart` onder `lg`.

**Cadeaukaart** (`cadeaukaart`): `VariantPicker` als bedragtegels (€15, €25, €50), geen `StackPicker`, geen cadeauverpakking, geen `DeliveryEstimate` maar "Direct in je mail", `TrustRow variant="giftcard"`, accordions: "Zo werkt het", "Voorwaarden" en "Productveiligheid" (`pdpCopy.gpsr.digital` plus bedrijfsgegevens; GPSR staat op elke productpagina, beslissing 116).

Swatches krijgen een rand van 1 px `--rand-invoer` (goud en zilver halen geen 3:1 tegen wit). JSON-LD: `productJsonLd(product)` + `breadcrumbJsonLd(...)`.

### 14.3 Collectie (`app/(shop)/collections/[handle]/page.tsx`)

- `ensureStatic = "navigation"`, `instant = false`, `generateStaticParams` uit `content/collections.ts` (alle handles). Onbekende handle: hetzelfde 404-patroon als de PDP (`<Suspense fallback={<NotFoundView />}><Missing /></Suspense>`). Gemeten in fase 2 (Next 16.4.3, `cacheComponents`, `partialPrefetching`): `ensureStatic = "navigation"` met `instant = false`, een client-grid met `useSearchParams` binnen Suspense en een client-nav met `usePathname` in de groepslayout bouwt als `○ /collections/alle` (1h, 1d) plus `◐ /collections/[handle]`.
- Opbouw: `Breadcrumbs` · banner (`bg-vlak rounded-kaart` in de container: eyebrow "Collectie", H1 = titel, intro; optioneel `bannerImage` rechts vanaf `md`) · `FilterBar` / `FilterSheet` · aantal · grid · lege staat.
- Data: `getShopCollection(handle)` geeft `{ definition, products, facets }` (`ShopCollection`, `CatalogProduct[]` met badges).
- `<Suspense fallback={<CollectionViewFallback … />}><CollectionView … /></Suspense>`; kaarten worden op de server gerenderd en als `cards` doorgegeven (CORVANE-patroon, keyed reorder). Nooit server-`searchParams` lezen.
- URL-parameters: `?type=oorbellen,armbanden&vibe=retro&moment=festival&prijs=15-20&sort=prijs-oplopend` (komma-gescheiden). Filters die de collectie zelf al vastlegt (type op `/collections/oorbellen`) worden verborgen.
- Stylingtegel (optioneel per collectie): na `stylingTile.afterIndex` producten, alleen zonder actieve filters.
- Uitverkochte producten blijven in het grid met label "Uitverkocht", achteraan bij "uitgelicht" (beslissing 42).
- JSON-LD: `breadcrumbJsonLd`.

### 14.4 Cart drawer

Zie §13.7. Volgorde in de scrollende body: `CartProgressBars` · regels · haarlijn · `GiftWrapToggle` · `GiftMessageField` · `CampaignCartNote` · haarlijn · `CartUpsell` ("Maak de look af") · `PaymentBadges`. Sticky voet: `CartTotals` · `CheckoutButton`. Lege staat: `CartEmpty`. Cadeaukaarten tellen niet mee voor gratis verzending of stack-korting (§8.2).

### 14.5 Spark Finder (`/spark-finder` en homeblok)

- Pagina: `PageHeader` (H1 "Spark Finder", intro uit `quiz.intro`), `SparkFinder variant="pagina"`, daarna een korte regel met een link naar `/stacks` (geen `StackCard`: D3 bouwt die in hetzelfde paar).
- Blok op de home: `SparkFinder variant="blok"` met H2.
- Flow: intro met "3 vragen, nog geen minuut" → vraag 1 → 2 → 3 → resultaat (3 tot 6 producten) → e-mailstap (optioneel, overslaan kan). Volledig met toetsenbord.

### 14.6 Drop (`/drops/[slug]`)

- `generateStaticParams`: alle acht slugs. `ensureStatic = "navigation"`, `instant = false` (zoals de PDP). **Ook `/drops/[slug]/binnenkort/page.tsx`** exporteert `ensureStatic = "navigation"`, `instant = false` en `generateStaticParams` met alle acht slugs. Zonder `ensureStatic` geeft het 404-patroon bij het eerste verzoek 200 met `private, no-store` (gemeten met Next 16.4.3: `/drops/iets/binnenkort` eerst 200, pas daarna 404; met `ensureStatic` meteen 404; beslissing 133). Elke route met het 404-patroon exporteert beide.
- **Onbekende slug**: `isDropSlug(slug)` uit `content/drops.ts` versmalt de string param tot `DropSlug`. Onbekend → `<Suspense fallback={<NotFoundView />}><Missing /></Suspense>` met `notFound()` in `Missing`, op `/drops/[slug]` én `/drops/[slug]/binnenkort` (anders geeft `/drops/iets` een pagina met status 200, een zachte 404; beslissing 103). `getDropData` krijgt alleen een `DropSlug`.
- Opbouw: `DropHero` · `EarlyAccessNote` · H2 "De drop" + `ProductGrid` met `getDropData(slug).products` (`CatalogProduct[]`, ook in de fase `early-access`; lege lijst: "De stukken zie je hier vanaf {datum}.") · Holiday stack (als die bestaat) · Club-aanmelding · `afgelopen`-melding via `TimeGate at={endsAt}` ("Deze drop is voorbij. In de Club hoor je als eerste van de volgende.").
- Teaser `/drops/[slug]/binnenkort`: `DropTeaser`, `robots: noindex`, canonical `/drops/[slug]`.

### 14.7 Stacks (`/stacks`)

`PageHeader` (H1 "Stacks van Linde", intro over 3 stuks en 15% stack-korting) · uitleg in drie stappen (`HowToStack headingLevel={2}`) · grid van `StackCard` (1 kolom mobiel, 2 vanaf `md`, 3 vanaf `xl`) uit `getVisibleStacks()` · link naar de Spark Finder · `FaqList` met de vraag `stack-korting`.

### 14.8 Cadeaukaarten (`/cadeaukaarten`)

`PageHeader` (H1 "Cadeaukaarten") · `GiftCardTiles` (€15, €25, €50, elk met "In tas") · uitleg "Digitaal, direct in je mail, geen verzendkosten" · link naar `/products/cadeaukaart` · `FaqList` met de vraag `cadeaukaart` · cross-link "Onder €25" en "Stacks".

### 14.9 Sparkela Club (`/sparkela-club`)

`PageHeader` (H1 `site.club.title`) · voordelen in drie punten (als eerste bij elke drop, 24 uur early access, 10% op je eerste bestelling) · `SubscribeForm source="club" submitLabel="Ik doe mee"` · uitleg welke mails je krijgt en dat afmelden altijd kan · komende drops (naam en maand, zonder timers, alleen drops met `startsAt` in de toekomst).

### 14.10 Zoeken (`/zoeken`)

`PageHeader` (H1 "Zoeken") · `<Suspense fallback={<SearchFallback />}><SearchView /></Suspense>`. Fallback: zoekveld (formulier `GET /zoeken`) en de collectielinks. `robots: noindex`.

### 14.11 Over Sparkela (`/over-sparkela`)

`PageHeader` (H1 "Over Sparkela") · foto van Linde (`linde.portret`) naast `pagesCopy.about.lindeIntro` ("Hoi, ik ben Linde. [Linde schrijft hier haar eigen verhaal.]") · blok "Waarom Sparkela" (eigen woorden, geen verzonnen persoonlijke details) · Tristan als co-eigenaar in één zin · waarden (roestvrij staal met goudlaag, 6 maanden garantie, cadeautjes in plaats van grote kortingen) · Club-aanmelding.

### 14.12 Veelgestelde vragen (`/veelgestelde-vragen`)

`PageHeader` · per `FaqCategory` een H2 en een `Accordion` · contactblok onderaan. JSON-LD: geen FAQPage (bewuste keuze: geen rich-result-afhankelijkheid).

### 14.13 Verzenden en retourneren (`/verzenden-en-retourneren`)

`LegalPage slug="verzenden-en-retourneren"`: tarieven uit `content/shipping.ts` (€3,95, gratis vanaf €35, alleen Nederland), cut-off 16.00, `UpcomingHolidays`, 14 dagen herroepingsrecht, de hygiëneregel, hoe herroepen (link naar `/herroepen`), garantie van 6 maanden op verkleuring als aparte belofte.

### 14.14 Herroepen (`/herroepen`)

`PageHeader` (H1 "Herroepen") · korte uitleg (14 dagen, hygiëneregel) · `WithdrawalForm` · na verzenden de ontvangstbevestiging in dezelfde kaart · link naar het modelformulier in `content/legal/herroepen.md` (onder het formulier, als tekst).

### 14.15 Contact (`/contact`)

`PageHeader` · e-mailadres en reactietijd ("Binnen 1 werkdag antwoord") · `ContactForm` · bedrijfsgegevens · link naar FAQ en herroepen.

### 14.16 Juridische pagina's

`/algemene-voorwaarden`, `/privacy`, `/cookies`: `LegalPage`, inhoud uit `content/legal/*.md`, bovenaan `LegalNotice` ("TODO: laten controleren"). `/cookies` heeft daarnaast een tabel met alle cookies en opslagsleutels (`sparkela_cart`, `sparkela_preview`, `sparkela_ea_<slug>`, `sparkela:*` in localStorage, en GTM-cookies alleen na toestemming), met copy uit `cookieTable` in `content/legal.ts`, en de `CookieSettingsButton` (die zelf niets rendert zonder analytics). Alles op deze pagina is van C1; niets wacht op C3 (beslissing 138).

### 14.17 Account (`/account`)

Normaal stuurt de proxy door naar Shopify. Terugval: `PageHeader` (H1 "Account"), "Inloggen kan straks hier. Vragen over je bestelling? Mail ons.", links naar contact en herroepen. `robots: noindex`.

### 14.18 Checkout (`/checkout`)

`local`: `CheckoutView` (§13.13). `shopify`: één regel en een knop die de drawer opent. Altijd `robots: noindex`.

### 14.19 404

`app/not-found.tsx`: `<ShopChrome><NotFoundView /></ShopChrome>` (de root-404 valt buiten de routegroep, dus zet hij de chrome zelf). `app/(shop)/not-found.tsx`: alleen `<NotFoundView />`. Title "Pagina niet gevonden".

### 14.20 Wachtlijst (`app/(kaal)/wachtlijst/page.tsx`)

`(kaal)/layout.tsx`: `<main id="main" tabIndex={-1}>` en `MiniFooter`; geen header, geen cart, geen popup. Pagina (`WaitlistHero`), mobiel van boven naar beneden:

1. `Logo variant="op-donker"` (160 px) op `bg-donker`, `data-vlak="donker"`.
2. H1 "Sparkela komt eraan" (`formsCopy.waitlist.title`), belofte in één zin: `formsCopy.waitlist.promise(launchLabel)` = `` `Chunky sieraden met een spark. Vanaf ${launchLabel} online.` `` met `launchLabel = formatDayMonth(site.launchAt)` ("27 november"). Nooit de datum opnieuw typen.
3. Foto van Linde (`linde.wachtlijst`, 4:5, `preload`), alleen als het bestand in `SUPPLIED` staat. Zonder bestand valt het fotoblok weg (één kolom, gecentreerd) in plaats van een grijze placeholder op de enige openbare pagina (beslissing 119). Het bestand aanleveren is stap 7 van §11.9.
4. Aanmelding: H2 "Als eerste shoppen, plus 10% op je eerste bestelling", `SubscribeForm source="wachtlijst" tone="donker"`.
5. `TimeGate at={site.launchAt}` met na de grens "We zijn live." en knop "Naar de shop" (zelfde hoogte als de regel ervoor), een gewone `<a href="/">` zonder `next/link` (§11.8, beslissing 136).
6. Socials.

Vanaf `lg`: twee kolommen (tekst en formulier links, foto rechts; zonder foto één kolom), alles boven de vouw op 1440×900. `MiniFooter` met de herroepingslink staat eronder (§13.5). Metadata: title "Sparkela | Binnenkort online", canonical `/`, index.

### 14.21 Aanmelding bevestigen (`app/(kaal)/nieuwsbrief/bevestigen/page.tsx`)

Statisch, `robots: noindex`, open tijdens prelaunch. `Logo variant="op-donker"`, H1 "Bevestig je aanmelding" (`formsCopy.confirm.title`), korte uitleg, en `<Suspense fallback={<ConfirmFallback />}><ConfirmSubscription /></Suspense>`. De fallback toont dezelfde knop (zonder JavaScript werkt bevestigen niet; dat staat in de fallbacktekst met het e-mailadres).

---

## 15. Formulieren en API

### 15.1 Gedeelde regels

- Elk formulier post JSON naar zijn route met `submitForm<T>(url, body): Promise<FormResponse<T>>` (`components/forms/submitForm.ts`, time-out 10 s).
- Validatie twee keer met dezelfde functies uit `lib/forms/validation.ts`: in de browser (direct bij verzenden, fouten per veld) en in de route (leidend).
- **Honeypot**: veld `website`, visueel verborgen. Gevuld → de route doet niets (geen Shopify, geen mail) en antwoordt met een geldig, typeklopend succes, zodat een bot niets leert en de UI niets ongedefinieerds toont (beslissing 126): subscribe `{ ok: true, data: { status: "pending", code: "WELKOM10" } }`; confirm `{ ok: true, data: { status: "confirmed" } }`; herroepen een `WithdrawalReceipt` met een echte referentie en tijd en een samenvatting van de invoer (zonder mail); contact `{ ok: true, data: undefined }`.
- **Consent** (aanmelden): een niet aangevinkte checkbox met als label exact `site.consentText`, met daaronder `site.privacyLink`. Verplicht: zonder vinkje de fout "Vink aan dat je de nieuwsbrief wilt ontvangen." (beslissing 38). Bij het veld staat waarvoor je je aanmeldt: `formsCopy.subscribe.what` ("Nieuwe drops, early access en af en toe een actie. Afmelden kan altijd.").
- **Terugval zonder sleutels**: `{ ok: false, error: "not-configured", fallbackEmail: site.email }`. De UI toont "Dat lukt nu even niet. Mail ons op hallo@sparkela.nl." met een `mailto:`-link (bij herroepen met onderwerp en ingevulde inhoud als body).
- Antwoorden altijd `Content-Type: application/json` en `Cache-Control: no-store`. Statuscodes: 200 ok, 400 `invalid`, 429 `rate-limited`, 503 `not-configured`, 502 `upstream`.

**Validatieregels** (`lib/forms/validation.ts`):

| Veld | Regel | Foutmelding |
| --- | --- | --- |
| e-mail | getrimd, kleine letters, max 254, `^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$` (geen aanhalingstekens, backslashes, `*` of `:`) | "Vul een geldig e-mailadres in." |
| naam | getrimd, 2 tot 100 tekens | "Vul je naam in." |
| bestelnummer | getrimd, `^#?[A-Za-z]{0,4}\d{3,10}$` | "Vul je bestelnummer in, bijvoorbeeld #1001." |
| producten (herroepen) | optioneel, max 1000 | "Maximaal 1000 tekens." |
| bericht (contact) | 10 tot 2000 tekens | "Schrijf minstens een korte zin." |
| consent | `true` | "Vink aan dat je de nieuwsbrief wilt ontvangen." |
| source | een van `SubscribeSource` | (400 zonder veldfout) |
| quiz | optioneel; waarden uit `quiz.questions` | (400 zonder veldfout) |
| token (bevestigen) | `^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$`, max 600 | (400 met `fieldErrors.token`) |

### 15.2 `POST /api/subscribe`

Request `SubscribeRequest`, response `FormResponse<SubscribeResult>`. Altijd dubbele opt-in (beslissing 74). Shopify stuurt zelf geen bevestigingsmail voor klanten die via de Admin API zijn aangemaakt, dus de site stuurt die mail.

1. Honeypot, validatie, rate limit (5 per 10 minuten per IP).
2. Ontbreekt één van `SHOPIFY_STORE_DOMAIN`, Admin-toegang (`SHOPIFY_ADMIN_CLIENT_ID` + `SHOPIFY_ADMIN_CLIENT_SECRET`, of `SHOPIFY_ADMIN_ACCESS_TOKEN`), `NEWSLETTER_CONFIRM_SECRET`, `MAIL_API_KEY` of `MAIL_FROM` → `not-configured` met `fallbackEmail`. Nooit stil terugvallen op enkele opt-in.
3. Tags: `club`, `bron:<source>`, en met quiz `quiz:vibe-<vibe>`, `quiz:moment-<moment>`, `quiz:type-<type>`.
4. Admin API (`lib/commerce/shopify/admin.ts`, GraphQL, versie `2026-10`), altijd met GraphQL-variabelen, nooit met tekst in de query geplakt:
   - `query CustomerByEmail($identifier: CustomerIdentifierInput!) { customerByIdentifier(identifier: $identifier) { id tags defaultEmailAddress { marketingState } } }` met `{ identifier: { emailAddress: email } }`. Dit is een exacte opzoeking, geen zoeksyntax (beslissing 76). We lezen geen beschermd veld dat we niet nodig hebben: geen `email`, geen naam, en niet de verouderde `Customer.email` en `Customer.emailMarketingConsent`; de toestemming staat in `defaultEmailAddress.marketingState` (beslissing 110). C1 controleert in het 2026-10-schema dat `customerByIdentifier(identifier: { emailAddress })` en `defaultEmailAddress` bestaan. Zo niet: stoppen en melden; er is geen terugval op `customers(query:)`, want die vraagt om een vergelijking op het beschermde veld `email`.
   - Geen klant: `customerCreate(input: { email, tags, emailMarketingConsent: { marketingState: PENDING, marketingOptInLevel: CONFIRMED_OPT_IN, consentUpdatedAt } })`, en uit het antwoord alleen `customer { id }`. C1 controleert in het 2026-10-schema of de toestemming nog via dit inputveld gaat of via het nieuwe e-mailadresmodel (`CustomerEmailAddress`), en volgt de niet-verouderde vorm.
   - Wel een klant: `tagsAdd(id, tags)`. Staat hij op `SUBSCRIBED` → `status: "already-subscribed"`, geen mail. Anders `customerEmailMarketingConsentUpdate` naar `PENDING` / `CONFIRMED_OPT_IN` (nooit een bestaande `SUBSCRIBED` verlagen).
   - `userErrors` of HTTP-fout → `upstream`. Een GraphQL-fout met `ACCESS_DENIED` of de tekst "not approved to access the Customer object" → ook `upstream`, met `console.error("admin-pii-denied")` (de foutcode, geen persoonsgegevens), zodat Tristan in de Vercel-log ziet dat de app geen toegang tot klantgegevens heeft (§11.9 stap 3).
5. Bevestigingsmail via `lib/mail.ts`: onderwerp "Bevestig je aanmelding bij Sparkela", één link `https://sparkela.nl/nieuwsbrief/bevestigen?t=<token>` met `token = createConfirmToken(customerId, now)` (`lib/forms/confirm-token.ts`: `base64url(JSON{ c, t })` + `.` + `base64url(HMAC-SHA256(NEWSLETTER_CONFIRM_SECRET, payload))`; `c` = het numerieke deel van de klant-GID uit stap 4, `t` = tijd in ms; 7 dagen geldig). Het token bevat dus geen e-mailadres: de link komt in serverlogs, browsergeschiedenis en (met analytics) in `page_location` terecht, en `ConfirmSubscription` haalt `t` daarna nog uit de URL (beslissing 110). Vaste tekst, geen invoer van de bezoeker in de mail. `Idempotency-Key: subscribe-<sha256(token)>`: per token één sleutel, dus een tweede aanmelding op dezelfde dag (popup en dan footer, of een verloren mail) krijgt een nieuw token, een nieuwe sleutel en een nieuwe mail. Resend 409 `invalid_idempotent_request` of `concurrent_idempotent_requests` → behandelen als verstuurd (`pending`), niet als `upstream` (beslissing 111). Andere mailfout → `upstream`.
6. Antwoord `{ ok: true, data: { status: "pending", code: "WELKOM10" } }`. De UI zegt dat de bevestigingsmail onderweg is en toont de code (de code is publiek: de popupkaarten tonen hem ook).
7. Geen persoonsgegevens in logs; alleen `console.error` met de foutcode.

**Admin-token** (`getAdminToken()` in `lib/commerce/shopify/admin.ts`, beslissing 75): met `SHOPIFY_ADMIN_ACCESS_TOKEN` die waarde. Anders `POST https://{domain}/admin/oauth/access_token` met `Content-Type: application/x-www-form-urlencoded` en de body `grant_type=client_credentials&client_id=…&client_secret=…` (`URLSearchParams`, geen JSON); `admin.test.ts` controleert header en body. Het token blijft in het geheugen van de module tot `expires_in` min 5 minuten. Bij een 401 van de Admin API één keer een nieuw token halen en het verzoek herhalen. Getest met `tests/fixtures/shopify/admin-token.json`.

### 15.3 `POST /api/subscribe/confirm`

Request `SubscribeConfirmRequest`, response `FormResponse<SubscribeConfirmResult>`.

1. Validatie, rate limit (10 per 10 minuten per IP).
2. `verifyConfirmToken(token, now)` → `{ customerId }` of `"invalid" | "expired"`. Fout → 400 `invalid` met `fieldErrors.token` = `formsCopy.confirm.expired` of `.invalid`.
3. `query CustomerById($id: ID!) { customer(id: $id) { id defaultEmailAddress { marketingState } } }` met `gid://shopify/Customer/<customerId>`. Geen klant → `invalid`. Al `SUBSCRIBED` → `already-confirmed`. `ACCESS_DENIED` → `upstream` met `admin-pii-denied`. Anders `customerEmailMarketingConsentUpdate` naar `SUBSCRIBED` / `CONFIRMED_OPT_IN` met `consentUpdatedAt = now`.
4. Antwoord `{ ok: true, data: { status } }`. De bevestigingspagina (§14.21) roept dit aan met een knop, nooit vanzelf bij het laden.

In Shopify blijft "dubbele opt-in" aan staan voor de eigen formulieren van Shopify (checkout). Shopify Email verstuurt de Club-mails alleen aan klanten op `SUBSCRIBED`.

### 15.4 `POST /api/herroepen`

Request `WithdrawalRequest`, response `FormResponse<WithdrawalReceipt>`.

1. Honeypot, validatie, rate limit (5 per 10 minuten per IP).
2. `receivedAt = Date.now()` in de handler (route handlers mogen de klok lezen); `reference = "HR-" + 8 hex-tekens uit crypto.randomUUID()`; `receivedAtLabel = formatDateTimeNl(receivedAt)`.
3. Geen `MAIL_API_KEY`, `MAIL_FROM` of `MAIL_TO` → `not-configured` met `fallbackEmail`. De UI toont dan een `mailto:` met onderwerp "Herroeping bestelling {nummer}" en de ingevulde gegevens als body.
4. Twee mails via `lib/mail.ts` (`sendMail({ to, subject, text, html, replyTo, idempotencyKey })`). De REST-body is precies `{ from, to: [to], subject, text, html, reply_to }` (snake_case, beslissing 89) naar `POST https://api.resend.com/emails` met `Authorization: Bearer MAIL_API_KEY` en de header `Idempotency-Key: <reference>-klant` of `<reference>-kopie`:
   - Aan de klant: onderwerp "Ontvangstbevestiging herroeping {nummer}", met naam, bestelnummer, e-mail, producten, "Ontvangen op {receivedAtLabel}", referentie en de volgende stappen (retouradres volgt per mail, hygiëneregel). Vrije tekst (naam, producten) gaat door `sanitizeForCustomerMail()`: HTML-tags eruit, URL's en domeinachtige tekst vervangen door "[link verwijderd]". De mail is tekst eerst; de HTML-versie bevat geen klikbare inhoud van de bezoeker.
   - Aan `MAIL_TO`: de volledige inhoud, onderwerp "Herroeping {nummer} ({referentie})", `reply_to` = klant.
   - Elke waarde in de HTML-versie gaat door `escapeHtml()` (`& < > " '`), ook in de kopie.
5. Mail aan de klant mislukt → `upstream` (de klant moet een bevestiging krijgen). Alleen de kopie mislukt → toch `ok` (de klant heeft zijn bevestiging), `console.error`.
6. Antwoord `{ ok: true, data: { reference, receivedAt (ISO), receivedAtLabel, summary } }`. De pagina toont die bevestiging direct.
7. Er is precies één knop: "Herroeping bevestigen". Geen extra vinkjes.
8. Restrisico: iemand kan een bevestiging naar een vreemd adres laten sturen. De inhoud is vast en zonder links, met een rate limit per instance. Dat staat in `docs/COMPLIANCE.md`.

### 15.5 `POST /api/contact`

Request `ContactRequest`, response `FormResponse`. Honeypot, validatie, rate limit (5 per 10 minuten). Eén mail aan `MAIL_TO` met `reply_to` = afzender (HTML-waarden ge-escaped), onderwerp "Contact: {naam}". Zonder sleutels `not-configured`. Succes-UI: "Dank je. We reageren binnen 1 werkdag."

### 15.6 `/api/cart`-validatie

`CartRequest` (§7.1): `op` bekend; `lines` 1 tot 10 per verzoek; `variantId` matcht `^gid://shopify/ProductVariant/\d+$`; `quantity` geheel 1 tot 99 (`update`: 0 tot 99, 0 = verwijderen); `lineIds` matchen `^gid://shopify/CartLine/`; `codes` max 5, elk `^[A-Za-z0-9_-]{1,40}$`; `note` max 200 tekens. Fout → 400 `{ ok: false, error: "invalid", cart: null }`.

### 15.7 Rate limit (`lib/forms/rate-limit.ts`)

```ts
export function rateLimit(key: string, opts: { limit: number; windowMs: number }, now?: number): { ok: boolean; retryAfterMs: number };
export function clientKey(request: Request, route: string): string;   // route + first IP of x-forwarded-for (or "unknown")
```

Vast venster in een `Map` in het geheugen van de instance (max 5.000 sleutels, oudste eruit). Op serverless is dit per instance en verdwijnt het bij een koude start: het remt misbruik af, het is geen garantie. Dat staat in `docs/COMPLIANCE.md`; een gedeelde store (bijvoorbeeld Vercel KV) is een punt na de lancering.

---

## 16. Shopify-koppeling

### 16.1 Configuratie (`lib/commerce/shopify/config.ts`)

```ts
export const SHOPIFY_API_VERSION = "2026-10";   // Storefront and Admin; latest stable in October 2026, supported until about October 2027
export function getShopifyConfig(env = process.env): {
  domain: string;                                  // SHOPIFY_STORE_DOMAIN without protocol
  storefrontUrl: string;                           // https://{domain}/api/2026-10/graphql.json
  adminUrl: string;                                // https://{domain}/admin/api/2026-10/graphql.json
  storefrontToken: string; tokenType: "private" | "public";
};
export class ShopifyNotConfiguredError extends Error {}
// ShopifyError (shared by client.ts and admin.ts) is defined here too, see §16.2.
/** Admin side only (/api/subscribe, /confirm). null when the domain or both credential forms are missing. Does not need the Storefront token. */
export function getShopifyAdminConfig(env = process.env): {
  domain: string; adminUrl: string; tokenUrl: string;   // tokenUrl: https://{domain}/admin/oauth/access_token
  clientId: string | null; clientSecret: string | null; accessTokenOverride: string | null;
} | null;
```

- Storefront-header: privétoken → `Shopify-Storefront-Private-Token: <token>` plus `Shopify-Storefront-Buyer-IP: <ip>` bij cart-verzoeken vanuit `/api/cart`; publiek token → `X-Shopify-Storefront-Access-Token`.
- Admin-header: `X-Shopify-Access-Token: <await getAdminToken()>` (§15.2: client credentials uit het Dev Dashboard, of de optionele override `SHOPIFY_ADMIN_ACCESS_TOKEN`). Sinds 1 januari 2026 kan een winkel geen nieuwe custom app met vast token meer maken in de admin; tokens via client credentials verlopen na ongeveer 24 uur (beslissing 75). Alleen in `lib/commerce/shopify/admin.ts`, alleen geïmporteerd door `app/api/subscribe/route.ts` en `app/api/subscribe/confirm/route.ts`. Het bestand begint met `import "server-only"`.
- Versie herzien vóór oktober 2027 (TODO-LAUNCH).

### 16.2 Client (`lib/commerce/shopify/client.ts`)

```ts
export async function storefront<T>(query: string, variables?: Record<string, unknown>, opts?: { buyerIp?: string }): Promise<T>;
// ShopifyError comes from config.ts (3a/A1), shared with admin.ts.
```

`client.ts` is alleen de Storefront-client. De Admin-client staat in `lib/commerce/shopify/admin.ts` (4-6/C1, beslissing 132):

```ts
// lib/commerce/shopify/admin.ts: import "server-only"
export async function getAdminToken(): Promise<string>;                                  // §15.2
export async function adminGraphql<T>(query: string, variables?: Record<string, unknown>): Promise<T>;
// X-Shopify-Access-Token from getAdminToken(); AbortSignal.timeout(8000); one retry after 500 ms on 429/5xx/THROTTLED;
// on 401 fetch a new token once and repeat; GraphQL error code ACCESS_DENIED → ShopifyError("access-denied") (logcode admin-pii-denied).
```

In `lib/commerce/shopify/config.ts` (3a/A1), zodat beide clients dezelfde fout gebruiken:

```ts
export class ShopifyError extends Error {
  constructor(public code: "network" | "http" | "graphql" | "throttled" | "timeout" | "unauthorized" | "access-denied", message: string);
}
```

Gewone `fetch` (geen Next-cache-opties; caching zit in de `'use cache'`-functies), `AbortSignal.timeout(8000)`, één herhaling na 500 ms bij HTTP 429/5xx of GraphQL-fout `THROTTLED`. GraphQL `errors` → `ShopifyError("graphql")`.

### 16.3 Queries (`lib/commerce/shopify/queries.ts`)

Elke query gebruikt `@inContext(country: NL, language: NL)`.

```graphql
fragment Img on Image { url altText width height }
fragment MoneyFields on MoneyV2 { amount currencyCode }

fragment ProductFields on Product {
  id handle title description tags isGiftCard availableForSale publishedAt
  seo { title description }
  options { name optionValues { name } }
  priceRange { minVariantPrice { ...MoneyFields } maxVariantPrice { ...MoneyFields } }
  images(first: 6) { nodes { ...Img } }
  variants(first: 10) {
    nodes {
      id title sku availableForSale quantityAvailable
      price { ...MoneyFields } compareAtPrice { ...MoneyFields }
      selectedOptions { name value }
      image { ...Img }
    }
  }
  metafields(identifiers: [
    { namespace: "custom", key: "spec_regel" }, { namespace: "custom", key: "materiaal" },
    { namespace: "custom", key: "afmetingen" }, { namespace: "custom", key: "gewicht" },
    { namespace: "custom", key: "sluiting" }, { namespace: "custom", key: "verzorging" },
    { namespace: "custom", key: "statement_meter" }, { namespace: "custom", key: "nikkelvrij" },
    { namespace: "custom", key: "gpsr_fabrikant" }, { namespace: "custom", key: "gpsr_verantwoordelijke_eu" },
    { namespace: "custom", key: "gpsr_waarschuwingen" }, { namespace: "custom", key: "laagste_prijs_30d" },
    { namespace: "custom", key: "bestseller" }, { namespace: "custom", key: "lindes_favoriet" }
  ]) { namespace key type value }
}

query CatalogProducts($cursor: String) @inContext(country: NL, language: NL) {
  collection(handle: "alle") {
    products(first: 50, after: $cursor, sortKey: MANUAL) {
      pageInfo { hasNextPage endCursor }
      nodes { ...ProductFields }
    }
  }
}
query ProductByHandle($handle: String!) @inContext(country: NL, language: NL) {
  product(handle: $handle) { ...ProductFields }
}
query PredictiveSearch($q: String!) @inContext(country: NL, language: NL) {
  predictiveSearch(query: $q, limit: 10, types: [PRODUCT], unavailableProducts: LAST) { products { handle } }
}
```

- `getProducts()` (Shopify) = alle pagina's van `CatalogProducts` (index = `featuredRank`) plus `ProductByHandle` voor `cadeauverpakking` en `cadeaukaart` (die staan niet in "alle"), en voor elke handle uit `drops[].productHandles` van een drop die nog niet voorbij is maar niet in "alle" staat (achteraan, met `console.warn`, §7.7, beslissing 114). Elk ander product dat niet in "alle" staat, ontbreekt in lijsten; zo bepaalt Tristan de volgorde in Shopify. `collection: null` (collectie bestaat nog niet) → `[]` met één `console.warn`, geen fout (§7.7).
- **Querykosten.** Geneste `first:`-waarden vermenigvuldigen de kosten. Daarom 50 producten per pagina, 10 varianten (de producten hebben er hooguit 4) en 6 beelden. `npm run test:shopify` draait de echte `CatalogProducts`-query vóór de lancering en logt `extensions.cost` (beslissing 98).
- Geen menu-query: de navigatie staat in `content/navigation.ts`.

### 16.4 Cart-mutaties (`lib/commerce/shopify/mutations.ts`)

```graphql
fragment CartFields on Cart {
  id checkoutUrl totalQuantity note
  buyerIdentity { countryCode }
  cost { subtotalAmount { ...MoneyFields } totalAmount { ...MoneyFields } }
  discountCodes { code applicable }
  discountAllocations { discountedAmount { ...MoneyFields } ... on CartAutomaticDiscountAllocation { title } ... on CartCodeDiscountAllocation { code } }
  lines(first: 100) {
    nodes {
      id quantity attributes { key value }
      cost { amountPerQuantity { ...MoneyFields } subtotalAmount { ...MoneyFields } totalAmount { ...MoneyFields } }
      discountAllocations { discountedAmount { ...MoneyFields } ... on CartAutomaticDiscountAllocation { title } ... on CartCodeDiscountAllocation { code } }
      merchandise { ... on ProductVariant {
        id title quantityAvailable image { ...Img }
        product { id handle title tags isGiftCard }
      } }
    }
  }
}
mutation CartCreate($input: CartInput!) @inContext(country: NL, language: NL) { cartCreate(input: $input) { cart { ...CartFields } userErrors { field message code } warnings { code message } } }
mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...CartFields } userErrors { field message code } warnings { code message } } }
mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $cartId, lines: $lines) { … } }
mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { … } }
mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]!) { cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) { … } }
mutation CartNoteUpdate($cartId: ID!, $note: String!) { cartNoteUpdate(cartId: $cartId, note: $note) { … } }
query CartById($id: ID!) @inContext(country: NL, language: NL) { cart(id: $id) { ...CartFields } }
# Uncached, before every add (§7.4): fresh product data for the cart gate.
query VariantGate($ids: [ID!]!) @inContext(country: NL, language: NL) { nodes(ids: $ids) { ... on ProductVariant { id product { handle tags isGiftCard } } } }
```

- `cartCreate`-input: `{ lines, buyerIdentity: { countryCode: NL } }`.
- Cadeauboodschap: `cartNoteUpdate` (komt op de bestelling als notitie). Geen cart-attributes nodig.
- **Let op 2026-10**: `Cart.discountAllocations` en `CartDiscountAllocation.discountApplication` zijn vanaf 2026-07 verouderd ten gunste van `Cart.discountApplications`, `CartLine.discountAllocations(lineLevelOnly: false)` en `sourceDiscountApplication`. C2 controleert het schema van 2026-10 (introspectie tegen de echte winkel, of de Shopify-documentatie) en kiest de niet-verouderde velden; de mapper is de enige plek die dit raakt, en de fixtures volgen de gekozen vorm (beslissing 51).

### 16.5 Mapping naar het domein (`mappers.ts`, puur)

```ts
export function mapProduct(node: ShopifyProduct, featuredRank: number): Product;
export function mapCart(node: ShopifyCart, ctx: { giftWrapVariantId: string | null; now: number }): Cart;
export function mapMetafields(nodes: Array<ShopifyMetafield | null>): ProductMetafields;
export function imageKindForIndex(i: number): ImageKind;      // 0 packshot, 1 draagfoto, 2 detail, 3 schaal, 4 stack, else overig
```

- Tags via `parseTags` (`lib/catalog.ts`): `type:oorbellen` → `type`, `vibe:retro` → `vibes`, `moment:festival` → `moments`, `drop:holiday-sparkle` → `drops`, `nieuw`, `verborgen`, `piercing` (hygiëneregel voor een piercing die geen oorbel is, beslissing 80). Onbekende waarden worden genegeerd (met één `console.warn` per waarde in de build).
- Bedragen via `parseShopifyMoney`. Valuta moet `EUR` zijn, anders `ShopifyError("graphql")`.
- `mapCart`: regels met `isGiftWrap` gaan naar `giftWrap` (niet in `lines`); `giftWrap.free` = `isGiftWrapFree(now)` alleen voor de weergave, het bedrag komt uit Shopify. Kortingen per regel naar `DiscountSource` op basis van de titel van de automatische korting (`"Stack-korting"` → `stack`, `"Cadeauverpakking december"` → `cadeauverpakking`) en codes → `code`. `shipping` is altijd `{ kind: "at-checkout" }` (beslissing 34) of `{ kind: "none" }` zonder fysieke producten. `progress` via `progressFromShopifyCart`.
- De titels van de automatische kortingen in Shopify moeten exact "Stack-korting" en "Cadeauverpakking december" zijn (METAFIELDS/TODO-LAUNCH).

### 16.6 Shopify-inrichting (voor `docs/METAFIELDS.md` en `docs/TODO-LAUNCH.md`)

- **Online Store**: open laten, zonder wachtwoord. Een wachtwoord op de Online Store blokkeert ook de checkout van een headless shop (Shopify-documentatie over Hydrogen: "Online store password protection prevents Hydrogen checkouts"), en dus elke `checkoutUrl`. Daarom (beslissing 109): onder Online Store › Voorkeuren staat "Toegang beperken tot bezoekers met het wachtwoord" uit; een doorstuurthema of -snippet stuurt elke Online Store-pagina naar `https://sparkela.nl`; producten worden alleen in het Headless-kanaal gepubliceerd, nooit in het kanaal Online Store, zodat daar niets te koop is. Bestellen vóór de lancering via onze eigen site blokkeert de cart-gate (§7.4).
- **Headless-kanaal** (Shopify Basic of hoger). Storefront-permissies: `unauthenticated_read_product_listings`, `unauthenticated_read_product_inventory` (voor `quantityAvailable`), `unauthenticated_read_product_tags`, `unauthenticated_read_checkouts`, `unauthenticated_write_checkouts`, `unauthenticated_read_content`. Alle producten publiceren in het Headless-kanaal.
- **Metafield-definities** (namespace `custom`) uit §6.4, elk met "Storefronts"-toegang aan.
- **Producttypen als tags**: `type:…`, `vibe:…`, `moment:…`, `drop:…`, `nieuw`, `verborgen`, `piercing` (alleen voor een piercing die geen oorbel is: dan geldt de hygiëneregel ook, beslissing 80).
- **Producten**: `cadeauverpakking` (€1,95, tag `verborgen`, `type:cadeauverpakking`, niet verzendgewicht-relevant), `cadeaukaart` (Shopify-cadeaukaart met varianten €15, €25, €50).
- **Automatische collecties per tag** (zelfde regels als §2.3), plus handmatige collectie `alle` met de volgorde voor "uitgelicht". Elk sieraad staat in `alle`, ook de dropproducten (§11.5).
- **Kortingen** (beslissing 104):
  - "Stack-korting": automatisch, "Bedrag korting op producten", 15% op de collecties oorbellen en armbanden, minimaal 3 stuks uit die collecties.
  - "Cadeauverpakking december": automatisch, "Bedrag korting op producten", 100% op het product cadeauverpakking, van 1 december 00.00 tot en met 31 december.
  - `WELKOM10`: code, "Bedrag korting op bestelling", 10%, eenmaal per klant. Een orderkorting werkt na de productkortingen; op cadeaukaarten geeft Shopify nooit korting.
  - **Combinaties** (in Shopify kan een korting per soort combineren; twee kortingen combineren alleen als ze dat allebei toestaan):

    | Korting | Soort | Combineert met productkortingen | Combineert met orderkortingen | Combineert met verzendkortingen |
    | --- | --- | --- | --- | --- |
    | Stack-korting | product | ja | **nee** | ja |
    | Cadeauverpakking december | product | ja | ja | ja |
    | `WELKOM10` | order | ja | nee | ja |

    Uitkomst: stack + cadeauverpakking samen (ja, ja); `WELKOM10` + cadeauverpakking samen (cadeauverpakking staat orderkortingen toe, `WELKOM10` productkortingen); stack + `WELKOM10` niet (de stack-korting staat geen orderkortingen toe), dan kiest Shopify de grootste. Zo rekent ook `lib/pricing.ts` (§8.2 regels 4 tot 6). De eind-tot-eindtest controleert dit met de carts N, O en P uit §8.4 (§16.9).
- **Verzending**: Nederland, €3,95, gratis vanaf €35 (voorwaarde op bestelbedrag).
- **App in het Dev Dashboard** "Sparkela site" (dev.shopify.com, zelfde organisatie als de winkel): Admin-scopes `read_customers`, `write_customers`; versie uitbrengen (release) en installeren op de winkel. Client-id en -secret → `SHOPIFY_ADMIN_CLIENT_ID`, `SHOPIFY_ADMIN_CLIENT_SECRET`. Heeft de winkel al een oude custom app met vast token, dan mag dat in `SHOPIFY_ADMIN_ACCESS_TOKEN`.
- **Storefront-token**: via het Headless-kanaal. Lukt dat niet, dan met de Admin-mutatie `storefrontAccessTokenCreate` (de app heeft dan ook `unauthenticated_*`-scopes nodig).
- **Webhooks** (Instellingen › Meldingen › Webhooks, JSON, versie 2026-10) naar `https://sparkela.nl/api/revalidate`: Productcreatie, Productupdate, Productverwijdering, Voorraadniveau-update, Collectiecreatie, Collectie-update, Collectieverwijdering. De ondertekeningssleutel → `SHOPIFY_WEBHOOK_SECRET`.

### 16.7 Limieten en fouten

- Storefront API: geen vaste rate limit per app, wel bescherming tegen misbruik per buyer-IP; daarom `Shopify-Storefront-Buyer-IP` op cartverzoeken en caching op catalogusreads. Bij `THROTTLED` één herhaling.
- Admin API: kostengebaseerd (bucket); `/api/subscribe` gebruikt hooguit 3 kleine calls per aanmelding.
- Max 250 per pagina; de catalogus pagineert met `endCursor`.

### 16.8 Fixtures (`tests/fixtures/shopify/`)

Gemaakt in de vorm van de echte API (versie 2026-10), met verzonnen ids. Elke mapper-test gebruikt ze.

| Bestand | Inhoud |
| --- | --- |
| `catalog-page-1.json`, `catalog-page-2.json` | `CatalogProducts` met paginering, 3 + 2 producten, alle metafield-typen, één met `null`-metafields, één met ongeldige `statement_meter` |
| `product-holiday.json` | Dropproduct met `drop:holiday-sparkle` |
| `product-giftcard.json`, `product-giftwrap.json` | Cadeaukaart en cadeauverpakking |
| `product-not-found.json` | `{ "data": { "product": null } }` |
| `predictive-search.json` | Resultaat met 3 handles |
| `cart-empty.json`, `cart-two-lines.json` | Basis |
| `cart-stack-discount.json` | 3 stackstukken met automatische korting "Stack-korting" |
| `cart-welkom10.json` | Code toegepast (`applicable: true`) |
| `cart-code-not-applicable.json` | Code met `applicable: false` |
| `cart-giftwrap-free.json` | Cadeauverpakking met 100% korting |
| `cart-giftcard-only.json` | Alleen een cadeaukaart |
| `cart-user-errors.json` | `userErrors` (voorraad) |
| `error-throttled.json` | GraphQL `THROTTLED` |
| `webhook-products-update.json`, `webhook-inventory-levels-update.json`, `webhook-collections-update.json` | Payloads; de test berekent de HMAC zelf met een testsleutel |
| `admin-token.json`, `admin-customer-by-identifier-null.json`, `admin-customer-by-identifier-pending.json`, `admin-customer-by-identifier-subscribed.json`, `admin-customer-by-id-null.json`, `admin-customer-by-id-pending.json`, `admin-customer-by-id-subscribed.json`, `admin-customer-create.json`, `admin-tags-add.json`, `admin-consent-update.json`, `admin-user-errors.json`, `admin-unauthorized.json`, `admin-access-denied.json` (GraphQL-fout "This app is not approved to access the Customer object", code `ACCESS_DENIED`) | Voor `/api/subscribe` en `/confirm` (C1); de klantvelden volgen §15.2 (`defaultEmailAddress { marketingState }`, geen `email`) |
| `catalog-no-collection.json` | `{ "data": { "collection": null } }`: lege catalogus vóór de import (§7.7) |
| `variant-gate.json` | `VariantGate` met een gewoon product en een dropproduct |

Met sleutels in `.env.local` draait `npm run test:shopify` (script `vitest run tests/unit/shopify-live.test.ts`, alleen met `SHOPIFY_LIVE_TEST=1`) een leesquery tegen de echte winkel. Die test is standaard overgeslagen. Hij controleert ook: elke handle van een drop die nog niet voorbij is, staat in `alle` (anders een waarschuwing); van elk product heeft het eerste beeld de extensie `.jpg`, `.jpeg` of `.png`, en die URL met `format=jpg` geeft `Content-Type: image/jpeg` (§17.3, beslissing 131; anders faalt de test met de handle). Met `SHOPIFY_LIVE_ADMIN=1` erbij voert hij de Admin-test uit §11.9 stap 3 uit (`customerByIdentifier` en `customerCreate` met een testadres).

---

### 16.9 Inhoud van `docs/TODO-LAUNCH.md` (F1 neemt dit volledig over)

Elke regel uit brief §11 plus de stappen die dit plan toevoegt, in deze volgorde:

1. **Nu, voor de wachtlijst** (§11.9, dit is de livegang): Vercel Pro (Hobby is alleen voor niet-commercieel gebruik); Shopify Basic (het Headless-kanaal werkt niet op Starter); Headless-kanaal installeren en Storefront-token maken; Dev Dashboard-app met `read_customers`/`write_customers` (client-id en -secret) en de blokkerende Admin-test (§11.9 stap 3: werkt `customerByIdentifier` en `customerCreate` op dit plan? Zo niet: Partner-app met custom distribution en offline token, of het Grow-plan); Resend met geverifieerd afzenderdomein; geheimen van minstens 32 tekens; Vercel (Root Directory `sparkela`, alle variabelen uit §3.9); sparkela.nl naar Vercel; de foto van Linde voor de wachtlijst (`linde.wachtlijst`); de curl-controle en één echte aanmelding met bevestigingsmail. Dubbele opt-in: test dat de klant pas na de klik op `SUBSCRIBED` staat.
2. **Producten** (`docs/METAFIELDS.md`), in deze volgorde (beslissing 122): eerst alle metafield-definities uit §6.4 aanmaken, met het Shopify-type en Storefront-toegang aan; pas dan `data/shopify-products.csv` importeren (status `draft`; zonder definities negeert of weigert Shopify de metafield-kolommen); controle na de import: open één product en kijk of `spec_regel` en `gpsr_fabrikant` gevuld zijn; daarna productfoto's toevoegen (JPEG of PNG, volgorde uit §17.2), GPSR-gegevens per product invullen (geen `[`-placeholders meer), claims alleen als ze kloppen, tag `piercing` waar nodig; producten actief zetten en alleen in het Headless-kanaal publiceren; handmatige collectie `alle` met de volgorde voor "uitgelicht"; de automatische collecties per tag (§2.3).
3. **Dropproducten** van Holiday Sparkle: tags `drop:holiday-sparkle`, in de collectie `alle` (positie = volgorde in de drop), gepubliceerd uiterlijk 24 november, daarna `products` verversen (README-curl) en `npm run test:shopify` (waarschuwt voor een drophandle die niet in `alle` staat).
4. **Beeld** (`docs/ASSETS.md`): vóór de lancering de sitebeelden voor de hero (desktop en mobiel), het portret van Linde, de vijf momenttegels en Statement/subtiel; de fotostrook en de video's mogen na de lancering (in productie zijn die secties verborgen zolang er geen enkel bestand is, beslissing 127). Elk bestand onder de vaste naam in `public/images/` en de sleutel in `SUPPLIED` (`content/assets.ts`).
5. **Verzending**: €3,95, gratis vanaf €35, alleen Nederland. Daarna testen of een cadeaukaart meetelt voor de gratis-verzendgrens (carts H en L uit §8.4) en de uitkomst in DECISIONS zetten.
6. **Kortingen** volgens §16.6, met de combinatiematrix daar: automatisch "Stack-korting" (product, combineert niet met orderkortingen), automatisch "Cadeauverpakking december" (product, combineert met product- en orderkortingen) en `WELKOM10` (code, orderkorting, eenmaal per klant). De titels moeten exact zo heten (de mapper herkent ze). Zo gaat de welkomstcode niet samen met de stack-korting (advies brief §11) en is de cadeauverpakking in december met allebei gratis.
7. **Betalen en checkout**: Shopify Payments met iDEAL | Wero, Bancontact, creditcard en Apple Pay; Klarna is optioneel (brief §4): beslissen, en als hij aan gaat in Shopify Payments ook `"Klarna"` toevoegen aan `site.paymentMethods` (beslissing 142); de checkout in de huisstijl (logo, kleuren); de cookiebanner van de checkout.
8. **Domein en Online Store**: subdomein (bijvoorbeeld `shop.sparkela.nl`) naar Shopify voor de checkout. De standaard Online Store laten doorsturen naar `https://sparkela.nl` (doorstuurthema of -snippet), **niet** afschermen met een wachtwoord: dat blokkeert ook de checkout van de headless shop (§16.6, beslissing 109). Controle: Online Store › Voorkeuren › "Toegang beperken tot bezoekers met het wachtwoord" staat uit, en geen product is in het kanaal Online Store gepubliceerd.
9. **Webhooks** (§16.6) naar `/api/revalidate` met `SHOPIFY_WEBHOOK_SECRET`; `REVALIDATE_SECRET` voor de handmatige curl. Goed om te weten: een prijs- of tekstwijziging staat meteen op de productpagina en na één extra bezoek ook in de lijsten (beslissing 130); wie het meteen overal wil, ververst `products` met de README-curl.
10. **Account**: Customer accounts aanzetten en `SHOPIFY_CUSTOMER_ACCOUNT_URL` zetten.
11. **Mail en juridisch**: de link "Hier de overeenkomst herroepen" ook in de orderbevestiging van Shopify; Shopify Email voor de nieuwsbrief met dubbele opt-in aan; juridische teksten laten controleren; KvK-nummer, btw-id, adres en het echte e-mailadres invullen; socials bevestigen (`confirmed: true`).
12. **Review-app**: vóór de lancering een review-app kiezen en installeren (bijvoorbeeld Judge.me), zodat de eerste kopers een reviewverzoek krijgen; pas met echte reviews `content/reviews.ts` vullen en `site.flags.showReviews` aanzetten (§22.1). Tot dan tonen reviewblokken en sterren niets, dus de site zelf wacht er niet op.
13. **Early access**: `EARLY_ACCESS_SECRET` gezet; `npm run early-access-link -- holiday-sparkle` en de link op 25 november in de Club-mail; op 26 november 00.05 uur testen (droppagina, een dropproduct en de Holiday stack in de tas, checkout).
14. **Lanceringscadeau** en de einddatum bevestigen (beslissing 57).
15. **Eind-tot-eindtest** in de echte winkel uiterlijk 24 november: bestellen en betalen, mails, herroepen, retour; de cart met stack-korting, `WELKOM10` en cadeauverpakking, met de carts N (`WELKOM10` + cadeauverpakking), O (stack + cadeauverpakking) en P (`WELKOM10` + cadeauverpakking, gratis) uit §8.4; voor O en P zet Tristan de startdatum van "Cadeauverpakking december" tijdelijk op vandaag en daarna terug op 1 december 00.00; checkout-redirect.
16. **Launch-checklist** uit §11.8.
17. **Later**: API-versie `2026-10` herzien vóór oktober 2027; de punten "Na de lancering" uit §22.

## 17. Beeld

### 17.1 Loader (`lib/image-loader.ts`)

```ts
"use client";
export default function shopifyLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  // Shopify CDN (cdn.shopify.com or the store's /cdn/shop/ path): set ?width= (keep other params such as v=).
  // Local files (/images/..., /brand/...): return `${src}?w=${width}` so next/image does not warn; files are pre-sized.
}
```

- Ingesteld via `images.loaderFile` (§3.8), dus elke `<Image>` (ook in server components) gaat erdoorheen. Vercel doet geen beeldtransformaties.
- Altijd `sizes` meegeven. Productkaart: `(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw`. PDP-galerij: `(min-width: 1024px) 55vw, 100vw`. Hero: `(min-width: 1024px) 58vw, 100vw`.
- LCP-beeld met `preload` (niet `priority`): hero op de home, eerste galerijbeeld op de PDP, de eerste 2 (mobiel) of 4 kaarten in een collectie (`priorityCount`).
- Productfoto's komen alleen uit Shopify. Nooit foto's of teksten van de leverancier of andere shops (brief §2.2).

### 17.2 Sitebeeld (`content/assets.ts`, `public/images/`)

Elke plek heeft een vaste sleutel, bestandsnaam, verhouding en pixelmaat. Zolang een bestand niet in `SUPPLIED` staat, toont `PhotoSlot` de placeholder "FOTO: {label}". `docs/ASSETS.md` (golf 4-6, C4; beslissing 122) is de shotlist voor Linde met exact deze namen. Vóór de lancering nodig: hero, `linde.wachtlijst`, `linde.portret`, momenttegels, `home.statement` en `home.subtiel` (§16.9 punt 4).

| Sleutel | Bestand | Verhouding | Maat (px) | Waar |
| --- | --- | --- | --- | --- |
| `hero.desktop` | `/images/hero/hero-desktop.webp` | 16:9 | 2400×1350 | Home hero vanaf `lg` |
| `hero.mobiel` | `/images/hero/hero-mobiel.webp` | 4:5 | 1200×1500 | Home hero mobiel |
| `momenten.festival`, `.date-night`, `.kantoor-maar-niet-saai`, `.strand`, `.feestdagen` | `/images/momenten/<moment>.webp` | 4:5 | 1200×1500 | Momenttegels, megamenu |
| `home.statement`, `home.subtiel` | `/images/home/statement.webp`, `subtiel.webp` | 4:5 | 1200×1500 | Statement of subtiel? |
| `linde.portret` | `/images/linde/portret.webp` | 4:5 | 1200×1500 | Over Linde, Over Sparkela |
| `linde.wachtlijst` | `/images/linde/wachtlijst.webp` | 4:5 | 1200×1500 | Wachtlijst |
| `club.hero` | `/images/club/club.webp` | 4:5 | 1200×1500 | Sparkela Club |
| `stacks.<slug>` | `/images/stacks/<slug>.webp` | 4:5 | 1200×1500 | Stacks |
| `drops.<slug>` | `/images/drops/<slug>.webp` | 16:9 | 2400×1350 | Droppagina |
| `fotostrook.01` tot `.08` | `/images/fotostrook/01.webp` … | 1:1 | 1080×1080 | Fotostrook |
| `video.01` tot `.04` | `/videos/sparkela-01.mp4` + `/videos/sparkela-01-poster.webp` | 9:16 | 1080×1920 (H.264) | Videorij |
| `collecties.<handle>` | `/images/collecties/<handle>.webp` | 4:5 | 1200×1500 | Optioneel in de collectiebanner |

**Productfoto's in Shopify** (per model, in deze volgorde, 4:5, 1600×2000, **als JPEG of PNG**, nooit WebP of AVIF: Shopify zet alleen PNG en JPEG om naar JPEG, en de product-OG heeft JPEG nodig, §17.3 en beslissing 131; de CDN geeft browsers zelf WebP of AVIF): 1 packshot, 2 draagfoto (oor, pols, hals of hand), 3 detail, 4 schaalfoto (in de hand of naast een liniaal), 5 stackfoto. `imageKindForIndex` volgt die volgorde. De alt-tekst komt uit Shopify; leeg → "{titel}, {soort foto}".

### 17.3 OG-afbeeldingen

- `app/opengraph-image.tsx`, `app/(shop)/products/[handle]/opengraph-image.tsx` (met eigen `generateStaticParams`), `app/(shop)/drops/[slug]/opengraph-image.tsx`.
- Exports `alt`, `size = { width: 1200, height: 630 }`, `contentType = "image/png"`. Renderen in een `'use cache'` + `cacheLife("max")`-functie die een `Uint8Array` teruggeeft (CORVANE D53.2); de product-OG gebruikt `cacheTag("products", "product:<handle>")`.
- **Alleen JPEG of PNG in een OG-afbeelding** (beslissing 113). `next/og` (Satori/resvg) decodeert geen WebP: een WebP-foto wordt zonder foutmelding volledig transparant (gemeten in fase 2 met Next 16.4.3: JPEG-pixel `[200,50,51,255]`, dezelfde foto als WebP `[0,0,0,0]`). Daarom: de product-OG gebruikt `ogPhotoUrl(url): string | null` uit `components/seo/OgImage.tsx`. Dat geeft alleen een URL als het pad van het origineel eindigt op `.jpg`, `.jpeg` of `.png` (hoofdletters genegeerd, query niet meegeteld), en zet dan `width=1200&format=jpg`. Shopify zet alleen PNG en JPEG om naar JPEG; een WebP-origineel blijft WebP (beslissing 131). Anders `null`: de product-OG rendert dan zonder foto, net als de drop-OG en de merk-OG (merkkleur, logo, naam). Sitebeeld (`.webp`) komt nooit in een OG. `tests/unit/og.test.ts` rendert een OG met `tests/fixtures/og-photo.jpg` en controleert dat het fotovlak niet transparant is, dat `ogPhotoUrl` bij een `.jpg`- en `.png`-URL `format=jpg` zet, en dat een `.webp`-URL van Shopify `null` geeft (OG zonder foto).
- Satori leest geen WOFF2: fonts als WOFF uit `assets/fonts/` (gekopieerd uit `@fontsource/unbounded` en `@fontsource/inter`, met de OFL-licentie erbij), gelezen met `readFile(join(process.cwd(), "assets/fonts/…"))` op moduleniveau.
- Alleen flexbox, geen grid. Logo als SVG-data-URI uit `logo-paths.ts` (geen `<text>`).
- Onbekende handle: `notFound()`.
- Kleuren uit `lib/brand-colors.ts`.

---

## 18. SEO, analytics, consent, toegankelijkheid en performance

### 18.1 SEO (`lib/seo.ts`)

```ts
export const siteUrl: URL;                         // NEXT_PUBLIC_SITE_URL ?? "https://sparkela.nl"
export const OG_LOCALE = "nl_NL";
export const CONTENT_UPDATED = "2026-11-20";       // literal, used as sitemap lastModified
export const NOINDEX_PATHS = ["/zoeken", "/checkout", "/account"] as const;
export const STATIC_ROUTES: string[];              // indexable static pages
export function pageMetadata(input: { title: string | { absolute: string }; description: string; path: string; image?: string; noindex?: boolean; canonical?: string }): Metadata;   // always the full openGraph object (D53.1)
export function productMetadata(product: Product | null): Metadata;   // null (unknown handle, NO_PRODUCTS_HANDLE, gift wrap): title "Pagina niet gevonden", robots { index: false }
export function organizationJsonLd(): object;      // name Sparkela, url, logo, email, no sameAs while socials are unconfirmed
export function websiteJsonLd(): object;           // with SearchAction to /zoeken?q={search_term_string}
export function productJsonLd(product: Product): object;   // brand Sparkela, sku, image, offers per variant (price, EUR, availability, url, shippingDetails NL €3,95 / free from €35, hasMerchantReturnPolicy 14 days), never aggregateRating without reviews
export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>): object;
```

- Uitwerking in 3b (B3, beslissing 177): `STATIC_ROUTES` bevat de 13 indexeerbare statische pagina's (ook alle juridische), zonder collecties, producten, drops, `/wachtlijst` en de noindex-pagina's. De titel van `productMetadata(null)` is `NOT_FOUND_TITLE` (= `sharedCopy.notFound.metaTitle`). In `productJsonLd` hebben cadeaukaart-offers geen verzending en geen retourbeleid, en het retourbeleid noemt geen `returnFees`; het logo van `organizationJsonLd` is `/brand/icon-512.png`. `lib/seo.ts` leest `getEnv()` bij het laden, dus alleen servercode importeert hem.
- `app/layout.tsx`: `metadataBase: siteUrl`, `title: { default: "Sparkela | Chunky sieraden met een spark", template: "%s | Sparkela" }`, `description`, `openGraph` (locale `OG_LOCALE`, siteName; sinds integrator 3b uit `lib/seo.ts`, beslissingen 153 en 179), `twitter: { card: "summary_large_image" }`, geen root-canonical. `<html lang="nl">`.
- Elke pagina zet `canonical` via `pageMetadata` (`path`). De homepage gebruikt `{ absolute: … }`.
- `sitemap.ts`: `STATIC_ROUTES`, alle collecties, `getSitemapProducts()` (listable), drops met fase `live` of `afgelopen`; `lastModified: CONTENT_UPDATED`; geen `images`, video of alternates (D54.3). Noindex-pagina's staan er niet in.
- `robots.ts`: `allow: "/"`, `disallow: ["/api/"]`, `sitemap: ${siteUrl}/sitemap.xml`. Noindex-pagina's nooit in `disallow` (D53.4).
- `generateMetadata` op dynamische routes leest alleen gecachte data en geeft strings terug (geen `URL`-objecten).

### 18.2 Analytics en consent

- `lib/analytics.ts` (§13.6). Events: `view_item` (PDP, in `BuyBox`, met `setTimeout(0)` en cleanup tegen dubbel vuren), `add_to_cart` (in `CartProvider.addToCart` na succes), `begin_checkout` (in `checkout()`), `sign_up` (in `SubscribeForm` na elke geslaagde aanmelding, `method` = source; nergens anders). `lib/analytics.ts` bestaat al vanaf golf 3b (B1), zodat C1 en C2a hem in 4-6 paar 1 kunnen aanroepen (beslissing 123).
- Bedragen in GA4-vorm als euro's (`cents / 100`), alleen in `lib/analytics.ts`.
- Geen persoonsgegevens in URL's of events: het bevestigingstoken bevat een klant-id, geen e-mailadres, en `ConfirmSubscription` haalt `t` uit de URL vóór er iets geladen wordt (§15.2).
- Niets van derden vóór toestemming. Zonder `site.analytics.enabled` worden `ConsentBanner` en `AnalyticsLoader` niet eens gerenderd (geen code in de bundel).
- Shopify-analytics via `@shopify/hydrogen-react`: niet nu (DECISIONS 5).
- Functionele opslag zonder toestemming: cart-cookie, preview- en early-access-cookie, `sparkela:*`-sleutels in localStorage (cart, popup-status, consent). Dit staat op `/cookies`.

### 18.3 Toegankelijkheid (WCAG 2.1 AA) als regels

1. Eén H1 per pagina; secties hebben een kop en `aria-labelledby`.
2. Skiplink naar `<main id="main" tabIndex={-1}>`; `RouteFocus` na client-navigatie.
3. Focusring overal (§4.8). Nooit verborgen achter vaste UI.
4. Tikvlakken minstens 44×44 px (uitzonderingen minstens 24 px, gedocumenteerd in COMPLIANCE).
5. Dialogs (drawer, menu, modal, zoeken): Radix Dialog, focus-trap, Esc, focus terug naar de opener, titel (eventueel visueel verborgen).
6. Accordions: Radix (`aria-expanded`, knoppen in koppen).
7. Carrousels: `aria-roledescription`, dia-labels "n van totaal", knoppen, geen autoplay; rijen alleen focusbaar als ze overlopen.
8. Tabs: Radix Tabs (pijltjestoetsen, `aria-selected`).
9. Formulieren: zichtbare labels, `aria-invalid`, fouten via `aria-describedby`, statusmeldingen in live regions, geen `disabled` op verzendknoppen (wel `aria-disabled` tijdens verzenden).
10. Geselecteerde staat nooit alleen met kleur (vinkje, rand, tekst).
11. `prefers-reduced-motion`: geen animatie, geen rotatie, timers tonen de vaste eindtekst.
12. Tekst mag niet afknippen bij tekstafstand-overrides (WCAG 1.4.12): `min-h`, geen vaste hoogte met `overflow-hidden`.
13. Reflow op 320 px zonder horizontale scroll.
14. Live regions: cart (`CartAnnouncer`), aantal in de collectie, quizstap, formulierstatus.
15. Iconen zonder tekst hebben een toegankelijke naam; decoratieve iconen `aria-hidden`.
16. `lang="nl"`; Engelse woorden (outfit, vibe, drop) zonder `lang`-wissel (ingeburgerd).

### 18.4 Performance

- Doel: Lighthouse mobiel 90+ voor home, collectie en PDP (gemeten op `npm run start:test` met `npx lighthouse@13 --only-categories=performance,accessibility,best-practices,seo`, resultaten in COMPLIANCE).
- CLS 0: chromehoogtes vast (`--promo-hoogte`, `--header-hoogte`), badgebox altijd gerenderd, media in vaste verhoudingen, timers in vaste boxen met `tabular`, `TimeSwitch`-boxen met `min-h`, quiz met minimale hoogtes, popup en consent als `fixed`, prelaunch via de server.
- Lazy eilanden: `CartDrawer`, `MobileNavSheet`, `EmailCapture`, `SearchDialog` via `next/dynamic` met `ssr: false` na `useAfterLoad()` (CORVANE D53.7).
- Fonts via `next/font/google` (preload, zelf gehost). Geen andere fontbestanden in de pagina.
- Productkaarten: standaard `<Link>`-prefetch (geen `prefetch={true}` in grids).

### 18.5 CORVANE-gotcha's die gelden (digest §3)

| Nr. | Regel voor Sparkela |
| --- | --- |
| D05 | `npm run lint` = `eslint .`; `npm run typecheck` = `next typegen && tsc --noEmit` |
| D05b | Geen `new Date()`/`Date.now()` in render; `useNow()` of `now` als argument |
| D18 | Productdata alleen via `'use cache'` met `cacheLife` en `cacheTag` |
| D44/D54.1 | PDP en collectie: `ensureStatic = "navigation"`, `instant = false`, `notFound()` alleen binnen Suspense; SEO-inhoud buiten Suspense |
| D54.2 | `htmlLimitedBots: /[^\s\S]/` |
| D53.1 | Metadata via `pageMetadata` (volledig OG-object), geen root-canonical |
| D53.2 | OG in `'use cache'` + WOFF-fonts; eigen `generateStaticParams` |
| D53.4/D54.3 | Sitemap met constante `lastModified`, zonder images |
| D47/D50.9 | `useSearchParams` in Suspense; `history.replaceState`; inline script voor deep links |
| D50.3 | `RouteFocus`; role-locators in tests; `useId()` voor ids |
| D31/D36/D32 | Geen `overflow` boven de sticky header; effen header; `min-h` |
| D34 | `aria-disabled` in plaats van `disabled` op steppers en knoppen in dialogs |
| D35 | Forced colors: transparante rand op knoppen, echte rand op velden |
| D46 | Sticky koopbalk met IntersectionObserver en `inert` |
| D51.3/D52.4/D53.5 | Pill, consentbanner en sticky balk delen `scroll-padding-bottom` en body-padding |
| D53.7 | Lazy eilanden, `startTransition` na mount in de cartprovider |
| D55.9 | Playwright-klok en `performance.now()` (nieuwe context voor de cooldown-test) |

---

## 19. Testplan

### 19.1 Vitest (`npm test`)

Omgeving `node`. Componenten alleen met `renderToStaticMarkup`. Modules met `next/cache` → `vi.mock("next/cache", …)`. Geen netwerk: `fetch` wordt gemockt.

**Async servercomponenten** (beslissing 139). `renderToStaticMarkup` kan geen async component renderen (React 19.3 gooit "A component suspended while responding to synchronous input"). Patroon: mock de data (`vi.mock("@/lib/shop-data", …)` en `vi.mock("next/cache", …)`) en render het resultaat van de functie: `renderToStaticMarkup(await Component(props))`. Dat werkt als elk kind synchroon is. Daarom: async zijn alleen pagina's en de dunne data-wrappers (`NotFoundView`, `ShopChrome`, `Header`, `AnnouncementBar`); alles wat zij renderen is synchroon en krijgt zijn data als props. De homesecties zijn allemaal synchroon (§13.10), zodat D1 `await Page()` met gemockte `lib/shop-data` kan renderen. Client-kinderen renderen gewoon mee (hooks werken in SSR).

| Suite | Eigenaar | Gevallen |
| --- | --- | --- |
| `lib/money.test.ts` | A1 | §8.5-tabel; geen `Intl`-afhankelijkheid |
| `lib/schedule.test.ts` | A1 | Fake timers: grens over 40 dagen → geen callback binnen 1 s en geen `setTimeout` boven `MAX_TIMEOUT_STEP_MS`, wel precies op de grens; grens in het verleden → direct; annuleren werkt (§10.7); `phaseIndex` (voor, op en na een grens); `getCountdown` (nooit negatief); §9.4 geval 25 met `units = { days: "d", hours: "u" }` |
| `lib/pricing.test.ts` | B3 | §8.4-tabel A tot P met de stukken uit `tests/fixtures/catalog.ts` (niet uit `content/products.ts`); `percentOf` half naar boven; onbekende variant valt weg; aantal begrensd; cadeauverpakking alleen met fysiek product; code onbekend; code + stack (hoogste wint, notice); cadeaukaart telt nergens mee; `stackQuote`; `priceDisplay` (geen compare-at zonder `laagstePrijs30d`); `progressTexts` voor 0/1/2/3 stuks; `nextPricingBoundary` |
| `lib/dates.test.ts` | B3 | §9.4 (gevallen 1 tot 24 en 26 tot 30; 25 staat in `lib/schedule.test.ts`); `timeBoundaries` gesorteerd en uniek; `promoSchedule` |
| `lib/holidays.test.ts` | B3 | `easterSunday` 2024 tot 2030; afgeleide feestdagen gelijk aan `shipping.holidays` |
| `lib/clock.test.ts` | B3 | `clockLife` (min 60, max 3600, expire > revalidate); testklok aan alleen met beide variabelen en niet met `VERCEL_ENV=production` |
| `lib/claims.test.ts` | B3 | Niets zonder `verified`; metafield `nikkelvrij: true` geeft de claim; `verified` zonder `source` telt niet |
| `lib/seo.test.ts` | B3 | `productJsonLd` zonder `aggregateRating`; offers per variant; `pageMetadata` heeft altijd OG-afbeelding; noindex-pagina's niet in `STATIC_ROUTES` |
| `lib/catalog.test.ts` | C2a | `parseTags` (onbekende waarden genegeerd, `piercing`); `deriveBadges` (laatste stuks bij 3, niet bij 4 of 0; limited alleen live; bestseller uit zonder `realSalesData`; een badge buiten `enabled` komt nooit mee); `needsHygieneSeal` (oorbellen ja, ketting nee, ketting met tag `piercing` ja); `materialForVariant` (Zilver nooit "goudlaag", Goud altijd); `homeFavorites` (met `realSalesData` alleen `bestseller`-producten, zonder alleen `lindesFavoriet`); `cardBadge`-volgorde; alle `CollectionRule`s; sorteren (uitverkocht achteraan); filters (EN/OF); prijsbuckets; `searchProducts` (accenten); `isListable` (drop vóór start niet) |
| `lib/commerce/commerce.test.ts` | C2a | Providerkeuze; productie zonder shopify gooit; lokale provider levert 26 producten; `getCollection` per handle; lege catalogus → `getShopProductsForParams()` geeft `NO_PRODUCTS_HANDLE`; `lib/shop-data.ts` geeft overal `CatalogProduct[]` met badges; met `serverNow()` gemockt op `2026-11-26T12:00:00+01:00`: `getCatalogProducts` bevat de vier Holiday-producten met `listable: false`, `getShopProducts` niet, `getDropData("holiday-sparkle")` heeft fase `early-access` en vier producten, `getStackOptionsFor("holiday-ster-oorbellen")` en `getRecommendedFor` geven alleen Holiday-stukken; `getStackOptionsFor` op `TEST_NOW`: `lola-chunky-hoops` krijgt de Goud-varianten van Tess en Roos (stack `goud-en-gedurfd`), `bo-statement-druppels` (geen stack) twee armband-variant-id's en nooit `null`, `noor-dikke-ringetjes` een variant-id van Ivy (twee kleuren) en niet een product-handle; de lokale cart-adapter houdt een dropvariant met `listable: false` (beslissing 107) |
| `lib/commerce/shopify/mappers.test.ts` | C2b | Elke fixture uit §16.8 (ook `catalog-no-collection.json` → `[]`); metafield-typen; ongeldige waarden → `null`; `featuredRank`; cart-totalen en `progressFromShopifyCart`; cadeauverpakking uit `lines` gehaald; korting-bronnen |
| `lib/commerce/shopify/webhooks.test.ts` | C2b | HMAC goed, fout, ontbrekend, afgekapt en onzin-base64 (allemaal `false`, nooit een exception); bearer in constante tijd; topic → tags en profiel (`collections/update` → `collections` + `products` met `{ expire: 0 }`; `inventory_levels/update` → `"max"`; `products/update` → `product:<handle>` met `{ expire: 0 }` en `products` en `collections` met `"max"`) |
| `lib/commerce/cart-gate.test.ts` | C2b | Preview altijd ok; drop `verborgen` geweigerd; `early-access` alleen met EA-cookie van die drop; prelaunch: gewoon product geweigerd, dropproduct met EA-cookie ok, mix geweigerd; na launch gewoon product ok |
| `tests/unit/api-cart.test.ts` | C2b | Validatie; cookie zetten en lezen; `VariantGate` wordt vóór elke `add` aangeroepen (geen gecachete catalogus); onbekende variant → `invalid`; `not-yet-available` voor dropvariant zonder cookie en wel met cookie; prelaunch-tijd: gewoon product → `not-yet-available`; cadeauverpakking weg als laatste fysiek product weg is; `Cache-Control: private, no-store` |
| `tests/unit/api-revalidate.test.ts` | C2b | 401 bij foute of ontbrekende HMAC (geen 500); `revalidateTag` volgens de tabel in §7.6 (`products/update`: `product:x` met `{ expire: 0 }`, `products` met `"max"`; voorraad `"max"`; collecties `{ expire: 0 }`); handmatige bearer |
| `lib/commerce/shopify/admin.test.ts` | C1 | `adminGraphql` (timeout, één retry bij 429/`THROTTLED`, 401 → nieuw token en één herhaling, `ACCESS_DENIED` → `ShopifyError("access-denied")`); `getAdminToken` (client credentials als `application/x-www-form-urlencoded` met de body `grant_type=client_credentials&client_id=…&client_secret=…`, cache tot `expires_in` − 5 min, één retry na 401, override-variabele); de queries vragen geen `email` en geen `emailMarketingConsent`; `admin-access-denied.json` → `upstream` met logcode `admin-pii-denied`; e-mail gaat als GraphQL-variabele mee, nooit in de querytekst; nieuwe klant op `PENDING`; bestaande `SUBSCRIBED` → geen mutatie; `userErrors` |
| `lib/forms/confirm-token.test.ts` | C1 | Token geldig, verlopen na 7 dagen, vervalste handtekening, ander geheim; het gedecodeerde token bevat een klant-id en geen `@` |
| `lib/forms/validation.test.ts`, `rate-limit.test.ts`, `lib/mail.test.ts` | C1 | §15.1-tabel (e-mail met `*`, `"`, `\` of `:` → fout); venster en reset; Resend-payload met exact de sleutels `from`, `to`, `subject`, `text`, `html`, `reply_to` en de header `Idempotency-Key` (subscribe: `subscribe-<sha256(token)>`, twee aanmeldingen op dezelfde dag geven twee sleutels; Resend 409 `invalid_idempotent_request` en `concurrent_idempotent_requests` → verstuurd); `escapeHtml`; `sanitizeForCustomerMail` haalt URL's en tags weg |
| `lib/early-access.test.ts`, `lib/preview.test.ts` | C1 | Token stabiel per slug, anders per slug en per secret; hash vergelijkt correct |
| `tests/unit/proxy.test.ts` | C1 | Elke regel van §11.2 (ook `/nieuwsbrief/bevestigen` open tijdens prelaunch; een geheim korter dan 32 tekens werkt niet): prelaunch rewrite, allowlist, META-routes door, preview-redirect zonder token in de URL en met cookie, vervalste cookie, early-access-token en -cookie, teaser per fase, `/binnenkort` na start → 307, `/account`, `/wachtlijst` na launch → 307, matcher sluit `/api`, `/_next/static`, afbeeldingen uit; testheader genegeerd zonder `SPARKELA_TEST_CLOCK` |
| `tests/unit/api-forms.test.ts` | C1 | Honeypot → stil ok met een typeklopende payload per route (subscribe `pending` + `WELKOM10`, herroepen een receipt), zonder Shopify- of mailaanroep; tweede aanmelding op dezelfde dag → weer `pending` en een tweede mail; validatiefouten; `not-configured` zonder sleutels (ook zonder `NEWSLETTER_CONFIRM_SECRET` of mail: nooit enkele opt-in); subscribe → `pending` en één bevestigingsmail; confirm → `SUBSCRIBED`, verlopen token → `invalid`; herroepen: twee mails, klantmail faalt → `upstream`, kopie faalt → ok; receipt-vorm |
| `lib/analytics.test.ts`, `lib/subscription.test.ts` | B1 | Consent-beslissingen, GTM-id, eurobedragen, `track` doet niets op de server; `markSubscribed`/`hasSubscribed` met en zonder werkende opslag |
| `components/consent/ConsentBanner.test.tsx` | C3 | Met `site.analytics.enabled` gemockt op `true` rendert `ConsentBanner` de banner met "Akkoord" en "Weigeren"; met `false` niets (vervangt een aparte build met analytics aan) |
| `tests/unit/contrast.test.ts` | B2 | §4.10 opnieuw berekend; toegestane paren boven de grens |
| `components/time/timeSwitchScript.test.ts` | B2 | Het script kiest de juiste index (uitgevoerd met een nep-`document`) |
| `components/ui/Price.test.tsx` | B2 | Geen `<s>` zonder `showCompareAt`; met `showCompareAt` altijd de laagste-prijsregel, voor elke `size` en `tone` |
| `components/ui/Button.test.tsx` | B2 | `buttonClasses` voor elke variant: alleen `primair` heeft een vulling (`bg-primair`) of `op-roest` (`bg-bot-wit`); nooit `bg-donker`, `bg-inkt`, `bg-steen`, `bg-olijf` of `bg-leisteen` |
| `components/brand/logo.test.ts` | B1 | `logo-paths.ts` heeft niet-lege paden en viewboxen; `SPARK_TRANSFORM` bevat geen `skew` |
| `components/product/ProductCard.test.tsx` | C4 | Eén badge volgens `CARD_BADGE_ORDER`; uitverkocht; meerdere prijzen → "Vanaf"; van-prijs altijd met laagste-prijsregel; naam staat vóór de media in de DOM; `ProductCard` en `ProductGrid` renderen ook binnen een `"use client"`-wrapper (gedeeld, §13.8); `NotFoundContent` toont `sharedCopy.notFound.title` en vier favorieten; `NotFoundView` met gemockte `lib/shop-data` via `renderToStaticMarkup(await NotFoundView())`; statische importcheck (§13.8): `ProductCard.tsx` en `ProductGrid.tsx` (en hun relatieve en `@/`-imports, recursief binnen het project) importeren geen `server-only`, `next/cache`, `lib/shop-data`, `lib/commerce/index`, `lib/commerce/local` of `lib/server-clock`, en `ProductCard`/`ProductGrid` zijn geen async functies |
| `components/cart/*.test.tsx` | C3 | `CartProgressBars` voor 0/1/2/3 stackstukken; `CartLineItem` met stack-korting toont de regel "Stack-korting −€2,24" en geen `<s>`; `CartUpsell` rendert niets vóór `launchAt`; `QuickAdd` (één variant, meerdere, cadeaukaart, uitverkocht) binnen `CartProvider` en `CatalogProvider`; `CartTotals` met "Berekend bij afrekenen" bij `shopify` |
| `components/collection/filterParams.test.ts` | D3 | `parseFilterParams`/`toFilterParams` in `filterParams.ts`: URL ↔ filters (komma-gescheiden, onbekende waarden genegeerd); `StackCard`-totaal met `stackQuote`; `AddStackButton` van `kantoor-maar-niet-saai` toont een kleurkeuze voor Noor en Ivy en niet voor Tess |
| `components/pdp/*.test.tsx` | D2 | `ProductSpecs` (Zilver zonder "goudlaag", claimtekst "bevestigd door de leverancier"); `ProductAccordions` (hygiëneregel bij oorbellen en `piercing`, niet bij een ketting; GPSR altijd aanwezig, ook bij de cadeaukaart met `pdpCopy.gpsr.digital`); `StackPicker` voor een product zonder stack heeft twee gevulde `Select`s, en bij een stuk met Goud en Zilver een optie per kleur ("…, Zilver · €14,95"); `ProductInfo` van een live dropproduct bevat precies één keer "Limited" (beslissing 134) |
| `components/checkout/CheckoutView.test.tsx` | D4 | Demo-melding zichtbaar; staat `placed` met `DEMO-` en lege cart |
| `tests/unit/sitemap.test.ts` | E1 | Geen noindex-pagina's; geen dropproducten of drops vóór de start; collecties en zichtbare producten aanwezig; de paden in de sitemap zijn gelijk aan `localShopRoutes(TEST_NOW)` uit `tests/fixtures/local-catalog.ts`, dezelfde functie waar E2 `SHOP_ROUTES` uit haalt |
| `tests/unit/og.test.ts` | E1 | OG met `tests/fixtures/og-photo.jpg`: het fotovlak is niet transparant; `ogPhotoUrl` zet `format=jpg` bij `.jpg` en `.png`; een `.webp`-URL van Shopify geeft `null` en een OG zonder foto; drop-OG zonder foto (§17.3) |
| `tests/unit/robots.test.ts` | E1 | `robots()` geeft `allow: "/"`, `disallow: ["/api/"]` en `sitemap` met de absolute URL `${siteUrl}/sitemap.xml`; geen noindex-pagina in `disallow` (§18.1, D53.4) |
| `components/email/state.test.ts` | D4 | Cooldown 7 dagen; niet na aanmelding; opslag kapot → nooit |
| `components/finder/finderState.test.ts` | D4 | Met `localCatalogProducts(TEST_NOW)` uit `tests/fixtures/local-catalog.ts` (`TEST_NOW` uit `tests/test-env.mjs`): alle 4 × 5 × 5 paden geven 3 tot 6 producten, alleen listable en beschikbaar |
| `components/home/ReviewsCarousel.test.tsx` | D1 | Rendert niets zonder reviews of met `showReviews: false`, in beide varianten (`home`, `footer`) |
| `content/offers.test.ts`, `drops.test.ts`, `shipping.test.ts`, `quiz.test.ts` | B4 | Literals met offset; geen `Date.now(`/`new Date(` in de bronbestanden; FAQ-bedragen gelijk aan config; beloning gelijk aan config (brief §2.8): elk percentage in `site.club`, `site.emailCapture`, `quiz.result` en (zodra ze bestaan) `formsCopy.waitlist`, `formsCopy.subscribe` en `pagesCopy.popup`/`pagesCopy.club` is `${welcomeCode.percent}%`, en elke kortingscode daarin is `welcomeCode.code` (de verbatim brief-zinnen blijven zoals ze zijn; de test faalt pas als config en copy uit elkaar lopen); drophandles gelijk aan tags; stacks geldig; quizlabels en navigatielabels gelijk aan `sharedCopy.vocab` |
| `content/content-guard.test.ts` | B4 | Zie hieronder |

**Content-guard (brief §2 als test).** Loopt over alle exports van alle `content/*.ts` (strings, ook uit functies met voorbeeldargumenten) en over `content/legal/*.md`:

1. **Claims**: geen "nikkelvrij", "waterproof", "waterbestendig", "hypoallergeen", "allergievrij", "anti-allergisch", "huidvriendelijk", "verkleurt nooit", "getest", "dermatologisch" buiten `content/claims.ts` en de FAQ-vraag `nikkelvrij` (die de claim alleen voorwaardelijk noemt). Elke claim met `verified: true` heeft een `source`.
2. **Merknamen**: lijst van bestaande sieradenmerken en -winkels (onder andere Pandora, Swarovski, Cartier, Tiffany, Bulgari, Bvlgari, Van Cleef, Chanel, Dior, Gucci, Hermès, Mejuri, Missoma, Monica Vinader, Ana Luisa, Astrid & Miyu, Orelia, Daniel Wellington, Lucardi, Bijou Brigitte, My Jewellery, Six, Accessorize, Lashthing, Yehwang, CORVANE) en de woorden "dupe", "zoals van", "lijkt op", "geïnspireerd op", "inspired by".
3. **Social proof**: geen "mensen bekijken", "zojuist gekocht", "bekijken dit", "klanten gingen je voor", "Trustpilot", "★", getal + "klanten", getal + "reviews". `reviews` is `[]` (lanceringsbewaker: faalt bewust zodra iemand reviews toevoegt zonder `source` en `verifiedBuyer`).
4. **Badges**: `site.flags.realSalesData === false`; geen lokaal product met metafield `bestseller: true` zolang die vlag uit staat; `site.badges.enabled` bevat bij de lancering alleen `nieuw`, `limited` en `laatste-stuks` (brief §2.7).
5. **Prijzen**: alle sieraden eindigen op ,95 en liggen tussen 1295 en 2995; geen `compareAtPrice` zonder `laagstePrijs30d`.
6. **Timers**: in `content/drops.ts` en `content/offers.ts` alleen ISO-literals met offset; geen `Date.now(` of `new Date(` in de broncode van `content/`.
7. **Consent**: `site.consentText` is exact de zin van de brief; geen enkel bestand in `components/` bevat de zin letterlijk (alleen via import).
8. **Toon**: geen "!!", geen lange gedachtestreep (U+2014) en geen "–" tussen woorden, geen "u " of "uw " als aanspreekvorm.
9. **Juridisch**: elk `content/legal/*.md`-bestand begint met `TODO: laten controleren`.
10. **GPSR**: elk sieraad heeft `gpsrFabrikant`, `gpsrVerantwoordelijkeEu` en `gpsrWaarschuwingen`. Placeholders staan altijd tussen `[` en `]`; een waarschuwingstekst zonder haken in een lokaal product faalt (geen verzonnen veiligheidsinformatie). Met `COMMERCE_PROVIDER=shopify` waarschuwt de Shopify-catalogusprovider in de build voor elk GPSR-veld dat nog `[` bevat.
11. **Verbatim copy**: alle sleutels uit §5.2 hebben exact hun tekst.
12. **Geen referentietekst** (brief §10): een overlapcontrole op reeksen van 5 woorden (genormaliseerd: kleine letters, zonder leestekens) van alle strings in `content/` en `content/copy/` en alle string-literals in `components/` tegen (a) de strings in CORVANE's `content/` (pad uit `CORVANE_CONTENT_DIR`, anders `../../trissiewissie2024/corvane/corvane/content` als die bestaat; ontbreekt hij, dan wordt dit deel overgeslagen met een melding) en (b) de labels in `reference/**/*.structure.json` (nu `reference/corvane/desktop/*.structure.json` en `reference/corvane/mobile/*.structure.json`). Bestaat `reference/` maar vindt de glob niets, dan faalt de guard met een melding (nooit stil slagen). `reference/` staat in `.gitignore`: op een verse clone of in CI ontbreekt de map, en dan slaat de guard deel (b) over met `SKIPPED: reference` (beslissing 146). Een overgeslagen deel print een zichtbare regel `SKIPPED: <naam>` (`console.warn`): altijd `SKIPPED: lashthing`, want lashthing.nl is nooit opgehaald (REFERENCE §1.1) en er is dus geen tekst om mee te vergelijken; de guard draait opnieuw na de opname uit REFERENCE §6 (§22 punt 15). Plus een woordcontrole op CORVANE-woorden in `components/` en `content/`: "scent", "spray", "geur", "parfum", "vane", "corvane" (beslissing 99).
13. **Specregel per materiaal**: een product met een Zilver-variant heeft geen "Verguld", "verguld" of "goudlaag" in `specRegel` (beslissing 115).

### 19.2 Playwright (`npm run test:e2e`)

Tegen de productiebuild met `COMMERCE_PROVIDER=local`. Selectors op rol en label (Activity laat verborgen routes in de DOM, digest A8). `tests/e2e/fixtures.ts`: `test` met de optie `clockAt` (standaard `TEST_NOW`; vóór elke `goto` `page.clock.install({ time: clockAt })` en `page.clock.resume()`, zie §11.7; `null` = de spec regelt de klok zelf), automatische `suppressEmailPopup` (zet `sparkela:email-capture:last-shown` op 2100-01-01 via `addInitScript`), `gotoHydrated(page, path)`, `settleAnimations(page)`, `collectConsoleProblems(page)`, `addProduct(page, handle, options?)`, `SHOP_ROUTES = localShopRoutes(TEST_NOW)` (uit `tests/fixtures/local-catalog.ts`, C2a; dezelfde lijst als E1's `sitemap.test.ts`; de specs lezen nooit `/sitemap.xml`, zodat E2 ook draait zonder `app/sitemap.ts`), locators `cartButton` (rol button, naam begint met "Tas"), `cartDrawer` (dialog "Je tas"), `totalsRow(label)`, constanten `TEST_NOW` (opnieuw geëxporteerd uit `tests/test-env.mjs`), `PRELAUNCH_NOW`, `EARLY_ACCESS_NOW`, `PREVIEW_TOKEN`, `earlyAccessToken(slug)`.

| Spec | Brief §7-geval | Stappen en verwachting |
| --- | --- | --- |
| `home.spec.ts` | Home laadt | `/`: status 200, één H1 "Eén paar oorbellen. Hele outfit af.", promobalk zichtbaar, geen consolefouten of hydration-meldingen |
| `add-to-cart.spec.ts` | Product toevoegen | PDP `lola-chunky-hoops`, kies Goud, "In winkelwagen" → drawer open met de regel, header "Tas (1)"; quick add op kaart `jade-stipjes` (één variant) direct; `noor-dikke-ringetjes` via keuzelijst |
| `shipping-progress.spec.ts` | Gratis-verzendbalk bij €34,90 en €35,00 | Noor (Goud) + Nina (17) → "Nog €0,10 tot gratis verzending"; Sam + Nina (€35,90) → "Je verzending is gratis" (beslissing 33) |
| `stack-discount.spec.ts` | Stack-korting bij 2 en 3 | Noor + Tess → "Nog 1 armband of oorbel voor 15% stack-korting", geen kortingsregel; + Jet → regel "Stack-korting" "−€8,97", totaal "€50,88" |
| `gift-wrap.spec.ts` | Cadeauverpakking aan en uit | Aan → regel €1,95 en totaal +€1,95; uit → weg; met `page.clock.setFixedTime("2026-12-02T12:00:00+01:00")` → "Gratis in december" en korting −€1,95 |
| `promo-bar.spec.ts` | Actiebalk weg na `endsAt` | Klok 2026-11-28 → lanceringscadeau met timer; `clock.install` op 2026-11-30T23:59:50+01:00, `runFor(15000)` → bericht weg, "Nu live: Holiday Sparkle" zichtbaar; herladen op 2026-12-05 → USP-balk |
| `popup.spec.ts` | Popup maximaal één keer | Gewone `test` (geen onderdrukking), `clockAt: null`, eigen `clock.install`; `runFor(8000)` → pill "Kies je spark"; klik → modal met de belofte vóór de kaarten; een kaart omdraaien toont "WELKOM10"; sluiten; herladen + `runFor(9000)` → geen pill; nieuwe context met `last-shown` 8 dagen terug → pill; opslag geblokkeerd → nooit; exit-intent op desktop (`mouse.move(700, -20)`) |
| `finder.spec.ts` | Spark Finder geeft een aanbeveling | Chunky en bold → Date night → Oorbellen → minstens 3 kaarten, "Lola chunky hoops" erbij; dezelfde flow alleen met toetsenbord; e-mailstap zichtbaar met de consenttekst |
| `withdrawal.spec.ts` | Herroepformulier valideert | Leeg verzenden → drie veldfouten; fout bestelnummer → fout; geldig → terugval (geen mailsleutels) met `mailto:`-link; precies één knop "Herroeping bevestigen" |
| `prelaunch.spec.ts` | Prelaunch toont de wachtlijst en de preview-link werkt | Header `x-sparkela-test-now: 2026-11-20T12:00:00+01:00` en `page.clock` op dezelfde tijd (de `TimeGate` op de wachtlijst volgt de browserklok): `/` en `/collections/oorbellen` tonen H1 "Sparkela komt eraan"; `/privacy` toont de privacypagina; `/nieuwsbrief/bevestigen` is open; `/icon.svg` geeft 200 met `image/svg+xml` (META-route langs de proxy; `/opengraph-image` bestaat pas na E1 en controleert integrator 10); `/?preview=<token>` → URL zonder `preview`, cookie gezet, `/` toont de shop; fout token → wachtlijst |
| `early-access.spec.ts` | (drops) | Header en `page.clock` op `2026-11-26T12:00:00+01:00`: `/drops/holiday-sparkle` zonder token → teaser; met `?toegang=<token>` → droppagina met 4 producten, PDP `holiday-ster-oorbellen` bereikbaar, toevoegen werkt, de Holiday stack via "Voeg de stack toe" ook (drie regels in de tas), "Maak de look af" in de drawer is leeg; `/collections/oorbellen` → wachtlijst. Let op: de server-klok van de build staat op `TEST_NOW`; de 26-novemberstand van de server dekt `commerce.test.ts` (§11.7) |
| `drops.spec.ts` | Drop vlak voor en na de start (UI) | `page.clock` 2027-02-05T18:59:55+01:00 op `/drops/love-club` met preview-cookie: timer; `runFor(10000)` → "Nu live". Home op `TEST_NOW`: dropbanner "Holiday Sparkle." met "Nu live" en een timer (verborgen label "Eindigt op donderdag 31 december om middernacht"); `clock.install` op 2026-12-31T23:59:55+01:00, `runFor(10000)` → banner weg (§12.4) |
| `layout.spec.ts` | Strakke layout en herroepingslink | Op elke route uit `SHOP_ROUTES`, plus `/wachtlijst` (prelaunch-header), `/nieuwsbrief/bevestigen` en de 404: `getByRole("link", { name: "Hier de overeenkomst herroepen" })` is zichtbaar en wijst naar `/herroepen` (brief §2.10). Geen horizontale scroll op dezelfde routes; 404 heeft status 404 en noindex (ook `/drops/iets/binnenkort`, eerste verzoek); pill en sticky koopbalk overlappen niet (390×844); in de mobiele header (390 px) zijn menu, zoeken, logo, account en "Tas (n)" zichtbaar; op 320 px geen horizontale scroll |
| `a11y.spec.ts` | WCAG AA | `@axe-core/playwright` met tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` na `settleAnimations` op home, collectie, PDP, cart open, cart leeg, menu open, popup open, finder, herroepen, wachtlijst → nul overtredingen |
| `seo.spec.ts` | SEO | Zonder JavaScript: één zichtbare H1 en JSON-LD `Product` op elke PDP uit `SHOP_ROUTES`; onbekende handle → 404 met noindex (ook met Bingbot-user-agent); `/products/zzz`, `/collections/zzz`, `/drops/iets` en `/drops/iets/binnenkort` geven al bij het **eerste** verzoek status 404 (`request.get`, niet via de browser) |
| `screenshots.spec.ts` | Screenshots | Alleen met `SCREENSHOTS=1`: home, `/collections/oorbellen`, `/products/lola-chunky-hoops`, open cart drawer met 3 stuks, popup open, mobiel menu open (desktop: megamenu Shop per moment open), wachtlijst (prelaunch-header); `fullPage`, `animations: "disabled"`, na `document.fonts.ready`; opslag in `screenshots/<naam>-<project>.png` |

### 19.3 `playwright.config.ts`

```ts
import { defineConfig, devices } from "@playwright/test";
import { TEST_ENV, TEST_PORT } from "./tests/test-env.mjs";
// Always TEST_PORT, never process.env.PORT: start:test listens on 3200 whatever PORT a shell or CI sets (beslissing 152).
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${TEST_PORT}`;
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
// tests/test-env.mjs (plain JS, also imported by scripts/with-test-env.mjs):
// export const TEST_PORT = 3200;
// export const TEST_NOW = Date.parse("2026-11-27T12:00:00+01:00");   // same instant as TEST_ENV.SPARKELA_TEST_NOW; Vitest (D4) and E2E import it from here
// export const TEST_ENV = {
//   COMMERCE_PROVIDER: "local", SPARKELA_TEST_CLOCK: "1", SPARKELA_TEST_NOW: "2026-11-27T12:00:00+01:00",
//   PRELAUNCH_BYPASS_TOKEN: "test-preview-token-0123456789abcdefghij",   // ≥ 32 characters, obviously fake
//   EARLY_ACCESS_SECRET: "test-early-access-secret-0123456789abcdef",
//   NEXT_PUBLIC_SITE_URL: "http://localhost:3200",
// };
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 2,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure", launchOptions: { executablePath } },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, launchOptions: { executablePath } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions: { executablePath } } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "npm run build:test && npm run start:test",
    url: baseURL, timeout: 300_000, reuseExistingServer: !process.env.CI,
    env: TEST_ENV,
  },
});
```

- Twee workers: de container heeft 4 cores en de server draait mee.
- **Elke `next start`-controle draait met de testomgeving** (beslissing 121): `npm run build:test` en `npm run start:test` (poort 3200). Tot 27 november is de echte datum vóór `launchAt`; een kale `next start` zou elke shoproute naar de wachtlijst herschrijven, en zonder `SPARKELA_TEST_CLOCK` in de runtime negeert de proxy de testheader. Met `PLAYWRIGHT_BASE_URL` (E2) start Playwright geen server; de server moet dan al met `npm run start:test` draaien. Prelaunch-controles sturen de header `x-sparkela-test-now` of gebruiken de preview-link.
- Tests die tijd nodig hebben: browser via `page.clock`; proxy via de header `x-sparkela-test-now`; server-klok in de statische pagina's via `SPARKELA_TEST_NOW` tijdens de build. Zet bij een andere proxytijd altijd ook `page.clock` op die tijd, zodat proxy en browser hetzelfde moment zien.
- `screenshots/`, `test-results/` en `playwright-report/` staan in `.gitignore` (A1 voegt `screenshots/` toe in golf 3a).

### 19.4 Definition of done (brief §10)

1. `npm run lint`, `npm run typecheck`, `npm test` en `npm run build` slagen; de buildoutput toont de markers van §2 (bekende params als `○` onder hun route, één `◐`-shell per dynamische route, `●` alleen bij `opengraph-image`).
2. `npm run test:e2e` slaagt op beide projecten.
3. De site werkt volledig met `COMMERCE_PROVIDER=local` zonder sleutels. De Shopify-provider is getest met de fixtures (en met `npm run test:shopify` als `.env.local` sleutels heeft).
4. Screenshots van home, collectie, PDP, open cart drawer, popup, mobiel menu en wachtlijst op 390×844 en 1440×900 zijn gemaakt, bekeken naast `reference/corvane/`, en alles wat niet strak is (overlap, afgekapte tekst, horizontale scroll, rommelige afstanden) is opgelost.
5. `docs/COMPLIANCE.md` beschrijft per regel van brief §2 waar die in de code en tests wordt afgedwongen, en de content-guard bevestigt dat er geen referentietekst van CORVANE in de site staat. Voor Lashthing zegt COMPLIANCE eerlijk dat de vergelijking beperkt is: lashthing.nl is nooit opgehaald, er was geen tekst om over te nemen, en de guard meldt `SKIPPED: lashthing` tot de opname uit REFERENCE §6 er is (§22 punt 15).
6. Lighthouse mobiel 90+ op home, collectie en PDP, met de scores in COMPLIANCE.

---

## 20. Bouwgolven

### 20.1 Spelregels

- De orchestrator draait **hooguit 2 agents tegelijk** op een container met 4 cores. Per golf staat de volgorde van de stappen en paren vast (§20.2): een paar start pas als het vorige klaar is.
- Elk bestand heeft **per stap precies één eigenaar**. Een agent wijzigt alleen bestanden uit zijn lijst. Heeft hij iets nodig in een bestand van een ander, dan schrijft hij een notitie in zijn eindrapport ("Verzoek aan {eigenaar}/integrator: …") en werkt hij met het contract uit dit plan. Copy die hij nodig heeft, zet hij in **zijn eigen** copybestand (`content/copy/*`, §5.1), nooit als literal.
- Gedeelde bestanden en hun eigenaar per golf ("paar 1 → paar 2" = eigendom gaat over na paar 1):

| Bestand | 3a | 3b | 4-6 | 7-9 | 10-11 | 12 |
| --- | --- | --- | --- | --- | --- | --- |
| `package.json`, `package-lock.json`, `.gitignore` | A1 | integrator | integrator | integrator | integrator | F1 |
| `app/layout.tsx` | A2 | B1 → B2 | C3 | integrator | E1 | n.v.t. |
| `app/globals.css` | A2 | B2 | C3 | integrator | E1 | n.v.t. |
| `lib/types.ts`, `lib/commerce/types.ts` | A1 | integrator | integrator | integrator | integrator | n.v.t. |
| `next.config.ts` | A1 | integrator | integrator | integrator | E1 | n.v.t. |
| `content/copy/shared.ts` | A2 | B2 | integrator | integrator | integrator | n.v.t. |
| `content/navigation.ts` | A2 | B4 | C3 | integrator | integrator | n.v.t. |
| `content/home.ts` | A2 | B4 | integrator | D1 | integrator | n.v.t. |
| `content/collections.ts` | A2 | B4 | integrator | D3 | integrator | n.v.t. |
| `content/legal.ts` | A2 | B4 | C1 | integrator | integrator | n.v.t. |
| `content/copy/pdp.ts` | A2 | B4 | integrator | D2 | integrator | n.v.t. |
| overige `content/copy/*.ts` | A2 | integrator | eigenaar uit §3.4 | eigenaar uit §3.4 | integrator | n.v.t. |
| `lib/commerce/shopify/catalog.ts`, `lib/commerce/cart/shopify-adapter.ts` | n.v.t. | n.v.t. | C2a (stub) → C2b | integrator | integrator | n.v.t. |
| `components/layout/ShopChrome.tsx` | n.v.t. | n.v.t. | C3 | integrator (twee regels, §13.5) | integrator | n.v.t. |
| `README.md` | n.v.t. | n.v.t. | C1 | integrator | integrator | F1 |
| `docs/DECISIONS.md`, `docs/PLAN.md` | integrator | integrator | integrator | integrator | integrator | F1 |
| `docs/QA-NOTES.md` | n.v.t. | n.v.t. | n.v.t. | n.v.t. | integrator 10 → E3 | F1 |
| `content/assets.ts` | A2 | B4 | integrator | integrator | integrator | F1 |
| `playwright.config.ts`, `tests/test-env.mjs` | A1 | integrator | integrator | integrator | E2 | n.v.t. |
| `docs/ASSETS.md`, `docs/METAFIELDS.md` | n.v.t. | n.v.t. | C4 | integrator | integrator | F1 |
| elk ander bestand, na de golf die het maakte | maker | integrator | integrator | integrator | integrator | F1 |

- "integrator" = alleen de integratie-agent van die golf, na de bouwagents. Een bestand dat in een golf niet in iemands lijst staat, is van de integrator van die golf; wie er iets in nodig heeft, vraagt het in zijn rapport (D3 bijvoorbeeld een `collecties.<handle>`-sleutel in `content/assets.ts`, E2 een wijziging in `playwright.config.ts` buiten zijn golf).
- **Klaar voor een bouwagent is mechanisch** (beslissing 96): zijn eigen Vitest-bestanden en de content-guard zijn groen (`npx vitest run <eigen paden> content/content-guard.test.ts`, vanaf golf 3b paar 2: in paar 1 schrijft B4 de guard nog, dus B1 draait alleen zijn eigen tests en integrator 3b draait de guard ook over B1's `components/brand`-literals; een fout van de guard in het bestand van een ander noteert hij); componenten met `renderToStaticMarkup`, providers in de test zelf om de component heen), `npx eslint <zijn bestanden>` is schoon, en `npx tsc --noEmit --incremental false -p tsconfig.json` geeft nul fouten in zijn bestanden. Fouten in bestanden van de parallelle agent of in `.next/types` noteert hij, hij lost ze niet op.
- **Geen `next build` en geen `next dev` door bouwagents.** Next staat maar één `next dev` of `next build` per project toe (lockfile), en pagina's bekijken kan niet tegelijk. Alles wat een draaiende app nodig heeft (CLS, 404-patroon, filters in de URL, demo-checkout, drawer, buildmarkers) controleert de integrator met `npm run start:test` (§19.3). Geen tijdelijke pagina's of scratch-routes.
- **Typegen.** De orchestrator draait `npx next typegen` vóór elk paar. Dat kan vanaf golf 3a, omdat A1 `lib/image-loader.ts` samen met `next.config.ts` maakt (Next weigert de config als `images.loaderFile` niet bestaat, bij `next build` én `next typegen`). Een agent die een routebestand toevoegt, mag daarna één keer `npx next typegen` draaien voor `PageProps`; geeft dat een fout in `.next/types` door de andere agent, dan één keer opnieuw, verder negeren. `npm run typecheck` (met `incremental`) is alleen voor de integrator.
- Elke agent sluit af met een kort rapport: bestanden, wat getest is, open verzoeken, afwijkingen van het plan (die gaan via de integrator naar `docs/DECISIONS.md`).
- **Commits per fase** (brief §0, beslissing 86). Agents committen niet. Na een groene integratie commit de orchestrator per fase uit brief §9, in volgorde, met de bestandslijsten uit §20.2: na 3a en 3b "Phase 3"; na 4-6 eerst "Phase 4: waitlist" (C1, plus `docs/ASSETS.md` en `docs/METAFIELDS.md` van C4, die met de wachtlijst live gaan), dan "Phase 5: commerce" (C2a, C2b), dan "Phase 6: layout and product card" (C3, de kaart-, grid- en 404-bestanden van C4 en de fixes van de integrator; de kaart is uit fase 8 naar voren gehaald omdat QuickAdd in de chrome en de 404 hem nodig hebben, beslissing 141); na 7-9 "Phase 7: home" (D1), "Phase 8: collection, product page" (D2 en de collectiebestanden van D3; de productkaart zit al in fase 6), "Phase 9: popup, finder, drops, stacks, pages" (D4, de rest van D3, `ShopChrome`); na 10-11 "Phase 10" (E1) en "Phase 11" (E2, E3, integrator); "Phase 12" (F1). Alleen de laatste commit van een golf hoeft los te bouwen.

### 20.2 Golven

#### Golf 3a: contracten (stap 1: A1 alleen; stap 2: A2 alleen)

A2 importeert bijna alles van A1 (`lib/types.ts`, `lib/money.ts`, `lib/brand-colors.ts`) en A1 draait `npm install`. Daarom na elkaar (beslissing 95).

| Agent | Bestanden (exclusief) | Consumeert | Klaar als |
| --- | --- | --- | --- |
| **A1 contracten-lib** | `package.json`, `package-lock.json` (`npm install` van §3.7), `.gitignore`, `next.config.ts`, `tsconfig.json`, `vitest.config.mts`, `playwright.config.ts`, `.env.example`, `tests/stubs/server-only.ts`, `tests/fixtures/catalog.ts`, `lib/types.ts` (§6 letterlijk), `lib/env.ts`, `lib/money.ts` + test, `lib/cn.ts`, `lib/storage.ts`, `lib/hooks/{useNow,useAfterLoad,useMediaQuery,useMounted,useLatch}.ts`, `lib/brand-colors.ts`, `lib/commerce/types.ts` (§7.1), `lib/commerce/shopify/config.ts` (§16.1), `lib/image-loader.ts` (§17.1), `lib/schedule.ts` + test (§10.7), `tests/test-env.mjs`, `scripts/with-test-env.mjs` | §3, §6, §7.1, §8.5, §10.7, §16.1, §17.1, §19.3 | money- en schedule-tests groen; `npx next typegen` slaagt; eslint en tsc schoon op eigen bestanden |
| **A2 tokens-content** | `app/globals.css`, `app/layout.tsx`, `app/page.tsx` (verwijderen), `app/(shop)/page.tsx` (tijdelijk: H1 met `site.name`), `public/*.svg` van de scaffold (verwijderen), `components/layout/SkipLink.tsx`, `components/layout/RouteFocus.tsx`, alle `content/*.ts` en `content/copy/*.ts` uit §5.1 met hun typen; `site.ts`, `offers.ts`, `drops.ts`, `shipping.ts` en `copy/shared.ts` **volledig** (§5.3, §5.9, §9.3, §12); in de andere bestanden minstens de sleutels uit §5.2; `products.ts` met 2 producten | §4, §5, §6 | `globals.css` volgens §4.1 (alle tinten in `@theme`); fonts; `lang="nl"`; eslint en tsc schoon op eigen bestanden |

**Integratie 3a**: §20.3. Build: `○ /`.

#### Golf 3b: merk, primitives, logica, data (paar 1: B1 + B4; paar 2: B2 + B3)

B4 vult de data vóór B3 en B2 starten, zodat de logica en de primitives tegen echte content en copy werken (beslissing 95).

| Agent | Bestanden (exclusief) | Consumeert | Klaar als |
| --- | --- | --- | --- |
| **B1 merk** (paar 1) | `scripts/build-logo.mjs`, `components/brand/*` (incl. `logo-paths.ts`), `public/brand/*`, `app/icon.svg`, `app/apple-icon.png`, `app/favicon.ico`, `app/layout.tsx` (alleen `LogoDefs` toevoegen), `lib/analytics.ts` + test, `lib/subscription.ts` + test (§13.6) | brief §3, §13.1, §13.6, §18.2, `lib/brand-colors.ts`, `lib/storage.ts` | `npm run logo` maakt alle bestanden; een Vitest controleert dat `logo-paths.ts` niet-lege paden en viewboxen heeft en dat het SVG-bestand van de vonk geen `skewX` bevat; analytics- en subscription-tests groen |
| **B4 data** (paar 1) | `content/products.ts`, `collections.ts`, `stacks.ts`, `faq.ts`, `claims.ts`, `reviews.ts`, `quiz.ts`, `home.ts`, `assets.ts`, `navigation.ts`, `legal.ts`, `content/copy/pdp.ts` (alleen `care.default`), `data/shopify-products.csv`, `public/images/**/.gitkeep`, `content/*.test.ts` (incl. `content-guard.test.ts`) | §5, §12, §17.2, §19.1 | 24 + 2 producten volgens §5.4; CSV met dezelfde handles en metafield-kolommen; content-guard en datatests groen |
| **B2 ui** (paar 2) | `components/ui/*`, `components/time/*` (incl. `VatNotice.tsx`), `components/media/*`, `components/pages/PageHeader.tsx`, `app/globals.css` (utilities `kop-*`, `sectie`, keyframes-hulpklassen), `app/layout.tsx` (alleen `MotionStyles` toevoegen), `content/copy/shared.ts` (alleen sleutels toevoegen), `tests/unit/contrast.test.ts`, `components/time/timeSwitchScript.test.ts`, `components/ui/Price.test.tsx`, `components/ui/Button.test.tsx` | §4, §10.5 tot §10.7, §13.2 tot §13.4; uit 3a: `lib/types.ts` (`PriceDisplay`, `Money`, `BadgeId`), `lib/schedule.ts` (`scheduleAt`, `phaseIndex`, `getCountdown`, `formatCountdown`), `lib/hooks/useNow.ts`, `content/site.ts` (`site.vat`), `content/copy/shared.ts`. Nooit `lib/dates.ts` of `lib/pricing.ts` (die schrijft B3 tegelijk) | tests groen; eslint en tsc schoon |
| **B3 logica** (paar 2) | `lib/dates.ts`, `lib/holidays.ts`, `lib/pricing.ts`, `lib/clock.ts`, `lib/server-clock.ts`, `lib/claims.ts`, `lib/reviews.ts`, `lib/seo.ts`, `components/seo/JsonLd.tsx`, en hun tests (§19.1) | §6, §8, §9, §10.3, §18.1, `content/*`, `content/copy/shared.ts`, `tests/fixtures/catalog.ts` | alle B3-suites groen (pricing met `tests/fixtures/catalog.ts`); geen `Date.now()` buiten `serverNow` en de event-plekken |

**Integratie 3b**: §20.3. Met `npm run start:test`: de HTML van `/` bevat `LogoDefs` (`#sparkela-wordmark`) en `/icon.svg` geeft 200.

#### Golf 4-6: wachtlijst, commerce, chrome, kaart (paar 1: C1 + C2a; paar 2: C2b + C3; paar 3: C4 alleen)

C1 is fase 4 en is na deze golf live te zetten (§11.9). C2 is gesplitst (beslissing 95): C2a levert het lokale pad dat C3 en C4 nodig hebben, C2b de Shopify-kant.

| Agent | Bestanden (exclusief) | Consumeert | Klaar als |
| --- | --- | --- | --- |
| **C1 wachtlijst-formulieren** (paar 1) | `proxy.ts`, `lib/early-access.ts`, `lib/preview.ts` + tests, `scripts/early-access-link.mjs`, `lib/forms/{validation,rate-limit,responses,confirm-token}.ts` + tests, `lib/mail.ts` + test, `lib/commerce/shopify/admin.ts` + test, `tests/fixtures/shopify/admin-*.json`, `app/api/subscribe/route.ts`, `app/api/subscribe/confirm/route.ts`, `app/api/{herroepen,contact}/route.ts`, `tests/unit/proxy.test.ts`, `tests/unit/api-forms.test.ts`, `components/forms/*`, `components/legal/*`, `components/prelaunch/*`, `components/consent/CookieSettingsButton.tsx`, `app/(kaal)/layout.tsx`, `app/(kaal)/wachtlijst/page.tsx`, `app/(kaal)/nieuwsbrief/bevestigen/page.tsx`, `app/(shop)/{verzenden-en-retourneren,herroepen,contact,algemene-voorwaarden,privacy,cookies}/page.tsx`, `content/legal/*.md`, `content/legal.ts`, `content/copy/forms.ts`, `README.md` (starten en "Wachtlijst live zetten", §11.9) | §11, §14.13 tot §14.16, §14.20, §14.21, §15, `content/*`, `lib/analytics.ts` (`OPEN_CONSENT_EVENT`, `track`), `lib/subscription.ts`, `components/time/VatNotice.tsx` (3b/B2) | suites groen; formulieren geven zonder sleutels de terugval; README-sectie compleet (met Vercel Pro en de Admin-test, §11.9) |
| **C2a commerce-lokaal** (paar 1) | `lib/catalog.ts` + test, `lib/shop-data.ts`, `lib/commerce/index.ts`, `local.ts`, `local-data.ts`, `collections.ts`, `commerce.test.ts`, `lib/commerce/cart/local-adapter.ts`, stubs van `lib/commerce/shopify/catalog.ts` en `lib/commerce/cart/shopify-adapter.ts` (gooien "not implemented"), `tests/fixtures/local-catalog.ts`, `components/catalog/CatalogProvider.tsx`, `components/cart/{CartProvider.tsx,useCart.ts,CartAnnouncer.tsx}` | §6, §7.1 tot §7.5, §8, `lib/analytics.ts`, `lib/schedule.ts`, `sharedCopy.announce` | suites groen (ook de early-access-gevallen van §19.1); lokale provider levert alles; `tests/fixtures/local-catalog.ts` laadt zonder `server-only` (ook buiten Vitest); `lib/shop-data.ts` geeft alleen `CatalogProduct[]` aan lijsten; geen `cookies()` buiten route handlers |
| **C2b commerce-shopify** (paar 2) | `lib/commerce/shopify/{client,queries,mutations,mappers,catalog,cart,webhooks}.ts` + tests, `lib/commerce/cart/shopify-adapter.ts`, `lib/commerce/cart-gate.ts` + test, `app/api/cart/route.ts`, `app/api/revalidate/route.ts`, `tests/fixtures/shopify/*` (behalve `admin-*`), `tests/unit/api-cart.test.ts`, `tests/unit/api-revalidate.test.ts`, `tests/unit/shopify-live.test.ts` | §7, §16 | suites groen; geen import van `server-only`-modules in de adapter |
| **C3 chrome** (paar 2) | `components/layout/*` (behalve `SkipLink`, `RouteFocus`), `components/consent/*` (behalve `CookieSettingsButton.tsx`), `components/cart/*` (behalve de C2a-bestanden), `components/product/QuickAdd.tsx`, `components/consent/ConsentBanner.test.tsx`, `app/(shop)/layout.tsx`, `app/layout.tsx`, `app/globals.css`, `content/navigation.ts`, `content/copy/chrome.ts`, `content/copy/cart.ts` | §2.5, §4, §10.5, §12.3, §13.5 tot §13.7, §18.2, `useCart`, `useCatalog` | tests groen (o.a. `CartProgressBars`, `QuickAdd` binnen `CartProvider` en `CatalogProvider` met `renderToStaticMarkup`) |
| **C4 productkaart, 404, docs** (paar 3) | `components/product/{ProductCard,ProductGrid,SortSelect,ProductCardSkeleton}.tsx` + `ProductCard.test.tsx`, `components/pages/NotFoundView.tsx`, `content/copy/product-card.ts`, `docs/ASSETS.md`, `docs/METAFIELDS.md` | §6.4, §13.8, §13.13, §16.6, §17.2, `QuickAdd`, `lib/catalog.ts`, `lib/shop-data.ts`, `content/assets.ts` | test met alle staten (badge, uitverkocht, varianten, cadeaukaart, van-prijs met laagste prijs, client-wrapper) groen; ASSETS.md noemt elke sleutel uit `content/assets.ts` met bestand, verhouding en maat; METAFIELDS.md dekt §6.4 en §16.6 (tags incl. `piercing`, collectie `alle`, kortingsmatrix) en zet de stappen in de volgorde van §16.9 punt 2: definities vóór de CSV-import, dan de controle op `spec_regel` en `gpsr_fabrikant`; ASSETS.md zegt dat productfoto's in Shopify JPEG of PNG zijn, nooit WebP of AVIF (§17.2) |

**Integratie 4-6**: §20.3. Buildoutput: `ƒ Proxy`, `ƒ /api/*`, `○ /wachtlijst`, `○ /nieuwsbrief/bevestigen`, `○` juridische pagina's. Met `npm run build:test` en `npm run start:test`: met een prelaunch-tijd (`x-sparkela-test-now`) `curl` op de rewrite, de preview-link, `/icon.svg` (gaat langs de proxy) en `/privacy`; zonder header (testklok 27 november) header, menu, footer met herroepingslink en drawer op de tijdelijke home; geen CLS in de chrome. De consentbanner is gedekt door `ConsentBanner.test.tsx` (geen aparte build met analytics aan). De lege catalogus is gedekt door unit-tests (`mappers.test.ts` met `catalog-no-collection.json`, `commerce.test.ts` met `NO_PRODUCTS_HANDLE`); geen aparte build tegen Shopify.

#### Golf 7-9: alle pagina's (paar 1: D3 + D4; paar 2: D1 + D2)

| Agent | Bestanden (exclusief) | Consumeert | Klaar als |
| --- | --- | --- | --- |
| **D3 collectie-drops** (paar 1) | `components/collection/*`, `components/drops/*`, `components/stacks/*`, `components/search/*`, `components/sections/*`, `components/giftcards/*`, `app/(shop)/collections/[handle]/page.tsx`, `app/(shop)/drops/[slug]/page.tsx`, `app/(shop)/drops/[slug]/binnenkort/page.tsx`, `app/(shop)/stacks/page.tsx`, `app/(shop)/cadeaukaarten/page.tsx`, `app/(shop)/zoeken/page.tsx`, `content/collections.ts`, `content/copy/collection.ts` | §12, §13.8, §13.12, §14.3, §14.6 tot §14.10 | tests voor filter-URL-parsing en `StackCard`-totalen groen |
| **D4 finder-popup-pagina's** (paar 1) | `components/finder/*` + test, `components/email/*` + test, `components/checkout/*`, `app/not-found.tsx`, `app/(shop)/not-found.tsx`, `app/(shop)/{spark-finder,sparkela-club,over-sparkela,veelgestelde-vragen,account,checkout}/page.tsx`, `content/copy/pages.ts` | §5.7, §13.11, §13.13, §14.5, §14.9, §14.11, §14.12, §14.17 tot §14.19 | finder-paden en popupregels getest; `CheckoutView` getest op de staten `review` en `placed` |
| **D1 home** (paar 2) | `components/home/*` + test, `app/(shop)/page.tsx`, `content/home.ts` | §14.1, §13.10, `DropBanner`, `HowToStack`, `FaqList`, `SparkFinder` | `ReviewsCarousel`-test groen; secties in volgorde (test op de volgorde van de koppen met `renderToStaticMarkup(await Page())` en gemockte `lib/shop-data`, §19.1) |
| **D2 pdp** (paar 2) | `components/pdp/*` + tests, `app/(shop)/products/[handle]/page.tsx`, `app/(shop)/products/layout.tsx`, `content/copy/pdp.ts` | §14.2, §13.9 | tests voor `ProductSpecs` (materiaal per variant, claimtekst) en `ProductAccordions` (hygiëneregel) groen |

**Integratie 7-9**: §20.3, plus: `ShopChrome` krijgt `ReviewsCarousel variant="footer"` en `EmailCaptureLoader` (§13.5). Build met `npm run build:test` en laat `.next` staan voor E2. Buildmarkers: per bekend product, collectie en drop een `○`-regel onder de route, `◐` alleen de shells, `●` alleen bij `opengraph-image`. Met `npm run start:test`: elke route één keer, CLS 0 op de home, het 404-patroon (PDP, collectie, drop), filters in de URL, de demo-checkout.

#### Golf 10-11: SEO, analytics, a11y, performance, tests (paar 1: E1 + E2; daarna integrator; daarna E3 alleen)

| Agent | Bestanden (exclusief) | Consumeert | Klaar als |
| --- | --- | --- | --- |
| **E1 seo-perf** | `app/sitemap.ts`, `tests/unit/sitemap.test.ts`, `app/robots.ts`, `tests/unit/robots.test.ts`, `tests/unit/og.test.ts`, `tests/fixtures/og-photo.jpg`, `app/manifest.ts`, `app/opengraph-image.tsx`, `app/(shop)/products/[handle]/opengraph-image.tsx`, `app/(shop)/drops/[slug]/opengraph-image.tsx`, `components/seo/OgImage.tsx`, `assets/fonts/*`, `app/layout.tsx`, `app/globals.css`, `next.config.ts`; metadata-correcties in pagina's via verzoeken aan de integrator | §17.3, §18 | tests voor sitemap (geen noindex-pagina's, geen drops vóór de start) en robots groen |
| **E2 e2e** | `tests/e2e/*` | §19.2, §19.3 | Draait zijn specs met `PLAYWRIGHT_BASE_URL=http://localhost:3200` tegen `npm run start:test` op de build van integratie 7-9 (niet opnieuw bouwen; server na afloop stoppen). Routes uit `SHOP_ROUTES`, niet uit de sitemap (E1 bouwt die tegelijk). Klaar = specs groen, of per falende spec de oorzaak (spec of app) in het rapport |
| **Integrator 10** | alles (alleen) | | build, `npm run test:e2e`, controle dat `/opengraph-image` `image/png` geeft (ook tijdens prelaunch, langs de proxy), axe, Lighthouse; fixt falende specs of code; schrijft de metingen in `docs/QA-NOTES.md` |
| **E3 visuele QA** (alleen) | alles (alleen, mag bouwen) | brief §10, `reference/corvane/` | `npm run screenshots`; elke screenshot bekeken naast de referentie; overlap, afgekapte tekst, horizontale scroll en rommelige afstanden opgelost; opnieuw alle checks groen; bevindingen in `docs/QA-NOTES.md` |

#### Golf 12: oplevering (F1 alleen)

`README.md` (aanvullen), `docs/METAFIELDS.md` en `docs/ASSETS.md` (bijwerken; ze bestaan sinds golf 4-6), `docs/COMPLIANCE.md` (met de metingen uit `docs/QA-NOTES.md`; de Lashthing-vergelijking als beperkt beschreven, §19.4 punt 5), `docs/TODO-LAUNCH.md` (volledig volgens §16.9), laatste update van `docs/DECISIONS.md` en `docs/PLAN.md` (alleen correcties), eindcontrole (lint, typecheck, test, build, e2e) en het eindbericht (wat gebouwd is, aannames, vijf belangrijkste open punten).

### 20.3 Integratiestap (elke golf)

0. `git status --porcelain` naast de eigendomslijsten van §20.2 leggen. Bestanden buiten iemands lijst en tijdelijke bestanden melden en opruimen.
1. Verzoeken uit de agentrapporten uitvoeren in de gedeelde bestanden (ontbrekende typen, regels in `app/layout.tsx`, enzovoort).
2. `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` (in die volgorde, stoppen bij de eerste fout en die oplossen).
3. Buildoutput naast §2.2 en §2.4 leggen: geen onverwachte `ƒ` of `◐`.
4. De controles met `npm run start:test` (na `npm run build:test`) die bij de golf staan (§20.2). Nooit een kale `next start`: vóór 27 november toont die overal de wachtlijst. Server daarna stoppen.
5. Afwijkingen van het plan vastleggen in `docs/DECISIONS.md` (en het plan bijwerken als het contract verandert).
6. Kort rapport aan de orchestrator: groen of niet, wat er is aangepast, en de bestandslijst per fase voor de commits (§20.1).

### 20.4 Streefdata (beslissing 101)

| Wat | Klaar op | Kritiek voor de lancering |
| --- | --- | --- |
| Golf 3a en 3b | di 27 oktober | ja |
| Golf 4-6, wachtlijst live (zodra Tristan §11.9 heeft ingericht, met Vercel Pro en de Admin-test), `docs/ASSETS.md` en `docs/METAFIELDS.md` klaar | vr 30 oktober; live uiterlijk ma 2 november | ja |
| Foto van Linde voor de wachtlijst (`linde.wachtlijst`) | ma 2 november | ja (anders zonder fotoblok) |
| Golf 7-9 | vr 6 november | ja |
| Golf 10-11 | vr 13 november | ja |
| Golf 12 (docs) | ma 16 november | ja |
| Producten, productfoto's, sitebeeld voor hero, Linde, momenttegels en Statement/subtiel, kortingen en verzending (TODO-LAUNCH 2 tot 8) | vr 20 november | ja |
| Review-app gekozen en geïnstalleerd (TODO-LAUNCH 12) | vr 20 november | nee (de site toont pas reviews als ze er echt zijn) |
| Eind-tot-eindtest in de echte winkel, early-access-test met de preview, dropproducten gepubliceerd | di 24 november | ja |
| Early-access-mail aan de Club | wo 25 november | ja |
| Early access open | do 26 november 00.00 | ja |
| Lancering | vr 27 november 00.00 | ja |
| Fotostrook en video's (zonder bestanden in productie verborgen, beslissing 127), België, Spark Guide, voorraadmelding | na de lancering (§22) | nee |

Buffer: van 16 tot 24 november voor fixes uit de echte winkel. Schuift een golf meer dan twee dagen op, dan gaan eerst de niet-kritieke onderdelen naar "Na de lancering": de videorij en de fotostrook komen later (in productie verborgen zonder bestanden, beslissing 127), de zoekpagina krijgt alleen de header-zoekdialoog, de stylingtegel in collecties vervalt.

---

## 21. Conventies

### 21.1 Code

- **Taal** (brief §0): code, identifiers, comments en commits in het Engels; zichtbare copy in het Nederlands (in `content/`); `README.md` en alles in `docs/` in het Nederlands. Een geporte CORVANE-comment in het Nederlands wordt Engels.
- TypeScript strict, geen `any` (gebruik `unknown` en versmal). Geen `// @ts-ignore`; `// @ts-expect-error` alleen met reden.
- Bestandsnamen: componenten `PascalCase.tsx`, modules en hooks `camelCase.ts`, routes volgens Next. Eén component per bestand (kleine interne helpers mogen erbij).
- Named exports, behalve waar Next een default vraagt (pagina's, layouts, route-bestanden die dat eisen, `opengraph-image`, `sitemap`, `robots`, `manifest`, de image-loader).
- Imports via `@/`. Volgorde: React/Next, externe pakketten, `@/lib`, `@/content`, `@/components`, relatief.
- `"use client"` alleen waar state, effecten, event handlers of browser-API's nodig zijn. Server components blijven de standaard. Geef server-gerenderde `ReactNode`s door aan client-eilanden in plaats van hele lijsten client-side te renderen.
- Server-only modules beginnen met `import "server-only";`: `lib/commerce/index.ts`, `lib/commerce/local.ts`, `lib/commerce/shopify/{client,catalog,cart,admin}.ts`, `lib/shop-data.ts`, `lib/server-clock.ts`, `lib/mail.ts`. Pure modules (`mappers.ts`, `webhooks.ts`, `queries.ts`, `mutations.ts`, `config.ts`, `lib/commerce/cart-gate.ts`, `lib/catalog.ts`, `lib/clock.ts`) niet, zodat ze ook in `proxy.ts` en Vitest werken. De client-adapters `lib/commerce/cart/*-adapter.ts` importeren nooit een server-only module.
- **React 19-typen** (`@types/react` 19): er is geen globale `JSX`-namespace. Schrijf `React.JSX.Element` (of `import type { JSX } from "react"`), of laat het return-type weg. `useRef<T>(null)` geeft `RefObject<T | null>`; type ref-props daarom als `RefObject<HTMLButtonElement | null>`.
- Geen route segment configs behalve `ensureStatic`, `instant` en `prefetch` waar dit plan ze noemt.
- Geen `middleware.ts`. Geen `fetch`-cache-opties; caching via `'use cache'`.
- Ids met `useId()`, nooit vaste `id`s in herbruikbare componenten (Activity houdt verborgen routes in de DOM).
- Geen `useSearchParams()` buiten `<Suspense>`. Filter- en zoekstatus schrijven met `window.history.replaceState`.
- `localStorage`/`sessionStorage` alleen via `lib/storage.ts` (try/catch, werkt zonder opslag). Sleutels in `storageKeys` met prefix `sparkela:` en versie (`sparkela:cart:v1`).
- Bedragen altijd in hele centen (`Cents`). Opmaak alleen met `lib/money.ts`. Rekenen alleen in `lib/pricing.ts`.
- Tijd alleen via `lib/dates.ts` (logica), `lib/clock.ts` (`serverNow`) en `lib/server-clock.ts` (`getServerNow`). In render nooit `Date.now()`, `new Date()`, `Math.random()` of `crypto.randomUUID()`. Een timer naar een tijdstip altijd via `scheduleAt()` (`lib/schedule.ts`), nooit `setTimeout(cb, doel - nu)`.
- Commerce alleen via `lib/commerce` en `lib/shop-data.ts` (server) en `useCart`/`useCatalog` (client). Pagina's krijgen `CatalogProduct`'s kant-en-klaar uit `lib/shop-data.ts` en roepen `toCatalogProduct`, `deriveBadges` of `badgeContextAt` nooit zelf aan. Client components importeren uit `lib/commerce/` alleen `types.ts`; `CartProvider` daarnaast de adapters in `lib/commerce/cart/`.
- Knoppen alleen via `Button`/`buttonClasses` met de varianten uit §13.2. Geen gevulde knop in een andere kleur dan roest (of bot-wit op roest).
- Geen hexcodes, `rgb()` of named colors in componenten; alleen tokenklassen (`bg-primair`) of `var(--…)`. Uitzondering: `lib/brand-colors.ts` (voor manifest, OG, logoscript), en `globals.css`.
- Geen inline `style` voor kleuren of maten die een token hebben.
- Iconen: `lucide-react`, `strokeWidth={1.5}`, 20 tot 22 px, `aria-hidden` tenzij ze de enige naam zijn.

### 21.2 Copy

- Alle zichtbare tekst in `content/`. Ook knoppen, labels, `aria-label`s, foutmeldingen en lege staten. Een component met een Nederlandse string-literal is een fout (uitzondering: tekens als "×" met `aria-hidden`). Nieuwe copy gaat in het copybestand van jouw feature (`content/copy/*`, §5.1), met type en waarde samen; generieke labels staan al in `sharedCopy`.
- Toon: je en jij, kort, warm, speels; één belofte per zin; geen u, geen rij uitroeptekens, geen lange gedachtestreepjes (U+2014). Gebruik een punt of een komma.
- Bedragen, tijden en percentages in copy komen uit config via functies, nooit opnieuw getypt.
- Geen claims buiten `content/claims.ts` en `getVerifiedClaims`. Geen merknamen. Geen verzonnen social proof. Geen timers zonder vaste datum uit `drops.ts`/`offers.ts`.

### 21.3 Hoe voeg je iets toe

- **Product (lokaal)**: een `LocalProductInput` in `content/products.ts` (tags volgens §6.2, `piercing` waar nodig, prijs op ,95, GPSR ingevuld of als `[…]`-placeholder) en dezelfde rij in `data/shopify-products.csv`. Draai `npm test` (content-guard). In Shopify: product aanmaken met dezelfde tags en metafields; de webhook ververst de site.
- **Drop**: entry in `content/drops.ts` met literal `startsAt`/`endsAt` (met offset) en `productHandles`; de producten krijgen tag `drop:<slug>`; `DropSlug`-type uitbreiden in `lib/types.ts`; beeld `drops.<slug>` in `content/assets.ts`; producten in Shopify uiterlijk de dag vóór `earlyAccessAt` publiceren, aan de collectie `alle` toevoegen en `products` verversen (§11.5); early-access-link via `npm run early-access-link -- <slug>`.
- **Actie**: een `Campaign` in `content/offers.ts` met literal datums en `promo`-copy. Nooit iets in de cart; een korting zelf zet Tristan in Shopify.
- **Stack**: entry in `content/stacks.ts` met drie bestaande oorbellen/armbanden en een beeldsleutel.
- **Collectie**: entry in `content/collections.ts` met een `CollectionRule`, plus dezelfde automatische collectie in Shopify.
- **Claim**: alleen met bewijs: `verified: true` en `source` in `content/claims.ts`, of metafield `nikkelvrij` op `true` in Shopify.

### 21.4 Tests en commits

- Nieuwe pure logica krijgt een Vitest-bestand ernaast (`x.ts` → `x.test.ts`).
- Agents committen niet; de orchestrator commit na elke golf per fase uit brief §9 (§20.1) met een Engelse boodschap "Phase N: …" en de attributieregels uit de sessie.
- Nooit secrets committen: `.env*` staat in `.gitignore` (behalve `.env.example` zonder waarden). Geen tokens in code, tests, fixtures of logs. Testsleutels (`test-preview-token`) zijn duidelijk nep.

---

## 22. Open punten en aannames

Alle aannames staan ook genummerd in `docs/DECISIONS.md` (15 tot en met 142 uit fase 2, vanaf 143 uit de bouwgolven). Deze punten moeten Linde en Tristan nog bevestigen of met de echte winkel worden getest:

1. **Dropdata 2027** (beslissing 22): de start- en einddata van Love Club tot en met Spark Friday zijn voorstellen.
2. **Einde lanceringscadeau**: 30 november 23.59 uur aangenomen; wat het cadeautje is, beslissen Linde en Tristan.
3. **Dubbele opt-in** (beslissing 74): de site stuurt zelf de bevestigingsmail, omdat de Admin API dat niet doet. Vóór de wachtlijst live gaat (§11.9): één echte aanmelding testen tot en met `SUBSCRIBED`. Geeft Shopify later een API die zelf de bevestiging stuurt, dan kan de eigen mail eruit.
4. **Admin-toegang** (beslissing 75): de app in het Dev Dashboard moet in dezelfde organisatie als de winkel staan; anders geeft client credentials `shop_not_permitted`. Dan de eenmalige OAuth-installatie gebruiken en het offline token in `SHOPIFY_ADMIN_ACCESS_TOKEN` zetten.
4a. **Beschermde klantgegevens op Shopify Basic** (beslissing 110): blokkerend vóór de wachtlijst live gaat (§11.9 stap 3). Een app die de winkel zelf maakt, krijgt op Basic mogelijk geen toegang tot het Customer-object. Terugval: Partner-app met custom distribution en offline token, of het Grow-plan.
5. **`customerByIdentifier` met `emailAddress`** (beslissing 76): controleren in het 2026-10-schema; terugval staat in §15.2.
6. **Kortingsvelden in de Cart API 2026-10** (beslissing 51): de niet-verouderde velden voor kortingsallocaties kiezen en de fixtures daarop aanpassen.
7. **Kortingscombinaties in Shopify** (beslissingen 30 en 104): de matrix uit §16.6 (stack niet met `WELKOM10`; de cadeauverpakking in december met allebei). Testen in de checkout met de carts N, O en P uit §8.4, ook welke korting Shopify kiest als stack en code allebei kunnen.
7a. **Online Store** (beslissing 109): doorsturen, geen wachtwoord (dat blokkeert de headless checkout).
8. **Cadeaukaarten en de gratis-verzendgrens in Shopify** (beslissing 90): testen met carts H en L uit §8.4. Telt Shopify cadeaukaarten mee, dan blijft onze tekst voorzichtig (nooit te vroeg "gratis"); eventueel later gelijktrekken.
9. **Querykosten** (beslissing 98): `npm run test:shopify` met de echte catalogus vóór de lancering.
10. **Customer accounts-URL** voor `/account` (`SHOPIFY_CUSTOMER_ACCOUNT_URL`).
11. **E-mailadres, bedrijfsgegevens, socials**: placeholders (`hallo@sparkela.nl`, `[KvK-nummer]`, accounts `confirmed: false`).
12. **Juridische teksten**: placeholders met "TODO: laten controleren"; herroepingsmodelformulier en retouradres invullen.
13. **GPSR**: alle velden zijn `[…]`-placeholders tot de leverancier de gegevens levert (beslissing 100).
14. **Foto's en video's**: alle plekken zijn placeholders tot Linde levert (`docs/ASSETS.md`). In productie zijn de fotostrook en de videorij verborgen zolang er geen enkel bestand is; de wachtlijst toont zonder foto geen fotoblok (beslissingen 119 en 127).
15. **Lashthing opnieuw bekijken** zodra de netwerkpolicy het toestaat (`docs/REFERENCE.md` §6); daarna eventueel sectievolgorde en megamenu bijstellen.
16. **Rate limit op serverless** (beslissing 48): per instance; een gedeelde store na de lancering als er misbruik is (ook voor herroepen, §15.4).
17. **Vercel-plan**: Pro vóór de wachtlijst live gaat, want dat is de livegang (brief §11, beslissing 105); er is geen cron nodig (beslissing 52).
18. **België**: staat klaar in `content/shipping.ts` (`enabled: false`), tarieven daar zijn placeholders (€5,95, gratis vanaf €50, 2 tot 3 werkdagen).

### 22.1 Na de lancering (brief §9)

F1 zet deze lijst in TODO-LAUNCH (§16.9, punt 17) en in de README. Eerder mag als er tijd over is.

| Onderdeel | Waar het al op aansluit |
| --- | --- |
| Spark Guide (blog uit Shopify) | Nieuwe route `/spark-guide`; Shopify-blogs via de Storefront API (`blog`/`articles`); navigatie in `content/navigation.ts` |
| Review-app (bijvoorbeeld Judge.me) | `content/reviews.ts` en `Review.source`, `lib/reviews.ts` (`getRatingSummary`), `ReviewsCarousel` (home en boven de footer), `Stars`, `productJsonLd` (pas dan `aggregateRating`); `site.flags.showReviews` aanzetten |
| Melding als iets weer op voorraad is | `QuickAdd` en `VariantPicker` (uitverkochte staat), `SubscribeForm` met een extra tag `voorraad:<handle>` |
| België aanzetten | `shipping.countries.BE` (`enabled`), `buyerIdentity.countryCode` in `/api/cart`, verzendtarieven in Shopify |
| Echte klantfoto's in de fotostrook | `home.photoStrip.items` en `content/assets.ts` (`fotostrook.*`, `SUPPLIED`), alleen met toestemming |
| Badges "Sale" en "Bestseller" | `site.badges.enabled` en `site.flags.realSalesData` (§4.9) |
