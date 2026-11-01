# Sparkela

De webshop van Sparkela: chunky sieraden met een spark. Next.js 16.4.3 (App Router, Cache Components) met Shopify als headless backend. Producten, voorraad, kortingen, checkout en betalingen zitten in Shopify; de site toont alles en praat met Shopify via de Storefront API.

Het bouwplan staat in `docs/PLAN.md`, de beslissingen in `docs/DECISIONS.md`. De regels voor iedereen die code schrijft staan in `AGENTS.md`. Wat er vóór de lancering nog moet gebeuren, staat als stappenlijst in `docs/TODO-LAUNCH.md`. Hoe de code de harde regels uit de brief afdwingt, staat in `docs/COMPLIANCE.md`.

## Starten

Nodig: Node.js 24 en npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Zonder sleutels draait alles met `COMMERCE_PROVIDER=local`: de 24 testproducten uit `content/products.ts`, een winkelwagen in je browser en een demo-checkout. Formulieren tonen zonder mailsleutels het e-mailadres van Sparkela als terugval.

Let op: tot vrijdag 27 november 2026 00.00 uur toont de site op elke shoppagina de wachtlijst (de prelaunch staat in `proxy.ts`). Alleen de wachtlijst, de bevestigingspagina en de juridische en servicepagina's zijn open. Wil je lokaal de shop zien, dan heb je drie manieren:

- De preview-link (zie hieronder).
- De testklok in `.env.local`: `SPARKELA_TEST_CLOCK=1` en `SPARKELA_TEST_NOW=2026-11-27T12:00:00+01:00`. Dan denkt de site dat het die tijd is. Zo kun je ook early access of december testen. Op Vercel Production werkt de testklok nooit.
- De testserver: `npm run build:test` en daarna `npm run start:test` op [http://localhost:3200](http://localhost:3200). Die draait altijd met de testproducten en de testklok op vrijdag 27 november 2026 12.00 uur, zoals Playwright hem gebruikt. Gebruik nooit een kale `next start` om de shop te controleren: vóór 27 november toont die overal de wachtlijst.

| Commando | Wat het doet |
| --- | --- |
| `npm run dev` | Ontwikkelserver op poort 3000 (maakt eerst de beeldversies, zie `npm run images`) |
| `npm run lint` | ESLint over het hele project |
| `npm run typecheck` | Routetypen maken en TypeScript controleren |
| `npm test` | Alle Vitest-tests, ook de content-guard (brief §2) |
| `npm run build` | Productiebuild (maakt eerst de beeldversies) |
| `npm run build:test` en `npm run start:test` | Build en server (poort 3200) met de testproducten en de testklok, zoals hierboven |
| `npm run test:e2e` | Playwright-tests tegen de testserver |
| `npm run test:shopify` | Leestest tegen de echte Shopify-winkel (sleutels in `.env.local`); met `SHOPIFY_LIVE_ADMIN=1` ervoor ook de Admin-test |
| `npm run early-access-link -- holiday-sparkle` | Print de early-access-link van een drop voor de Club-mail (`-- --all` voor alle drops) |
| `npm run images` | Maakt de kleinere versies van elke sitefoto in `public/_img/` (niet in git) |
| `npm run logo` | Maakt alle logobestanden opnieuw |
| `npm run screenshots` | Screenshots van de belangrijkste pagina's op mobiel en desktop |

Omgevingsvariabelen staan met uitleg in `.env.example` en in de tabel bij "Deployen op Vercel". Echte waarden zet je in `.env.local` (lokaal, staat in `.gitignore`) of in Vercel. Nooit een waarde committen.

### Preview-link

Met `PRELAUNCH_BYPASS_TOKEN` in `.env.local` opent `http://localhost:3000/?preview=<token>` de hele shop, ook alle drops vóór hun start. Op de live site werkt het net zo: `https://sparkela.nl/?preview=<token>`. De site zet een cookie met een hash van het token en haalt het token meteen uit de adresbalk. Het werkt 30 dagen per browser. Een geheim korter dan 32 tekens telt niet (de preview blijft dan dicht).

De preview opent de pagina's, maar verandert de klok niet. Wat op tijd verschijnt (een drop in de lijsten, de Holiday stack op `/stacks`, de promobalk), zie je pas op dat moment, of lokaal met de testklok.

## Content aanpassen

Alle teksten, bedragen, data en instellingen staan in `content/`. Pas je daar iets aan, draai dan `npm test`: de content-guard controleert de harde regels uit de brief (letterlijke teksten, verboden woorden, geen verzonnen reviews of claims). Zet de wijziging daarna online: push naar de productietak van het Vercel-project (meestal `main`), dan bouwt Vercel opnieuw.

Bedragen staan in centen (`money(395)` is €3,95). Tijden staan als vaste datum met tijdzone (`"2026-11-27T00:00:00+01:00"`), nooit berekend.

| Wat | Bestand | Goed om te weten |
| --- | --- | --- |
| Merk, lanceringsmoment, e-mailadres, bedrijfsgegevens, socials, betaalmethoden, btw-regel, USP's, Club, popup, badges en vlaggen | `content/site.ts` | Bedrijfsgegevens staan als `[…]` tot ze bekend zijn. Een social verschijnt pas met `confirmed: true`. "Klarna" alleen erbij als hij in Shopify aan staat |
| Producten | Shopify | `content/products.ts` is alleen de testcatalogus voor `COMMERCE_PROVIDER=local` en de tests. Verander daar geen handles of prijzen: de tests gebruiken ze |
| Kortingen en acties: `WELKOM10`, stack-korting, cadeauverpakking, cadeaukaarten, lanceringscadeau | `content/offers.ts` | De kortingen zelf staan in Shopify (`docs/METAFIELDS.md` §7). Houd beide gelijk |
| Drops: namen, data, teksten, producthandles | `content/drops.ts` | De handles moeten gelijk zijn aan de producten met de tag `drop:<slug>` in Shopify. Een nieuwe drop: plan §21.3 |
| Verzending: tarief, gratis-grens, 16.00 uur, feestdagen, gesloten dagen, retourtermijn, België | `content/shipping.ts` | Houd de tarieven gelijk aan Shopify. Extra sluitingsdagen in `closedDays` |
| Veelgestelde vragen | `content/faq.ts` | De eerste zeven antwoorden komen letterlijk uit de brief; de content-guard bewaakt ze |
| Spark Finder (de quiz) | `content/quiz.ts` | De labels komen uit `sharedCopy.vocab`, zodat quiz, filters en menu dezelfde woorden gebruiken |
| Home | `content/home.ts` | Ook de fotostrook (`photoStrip.items`: welke foto naar welk product linkt) en de introductie van Linde |
| Juridische teksten | `content/legal/*.md` en `content/legal.ts` | Bedrijfsgegevens en bedragen vult de site zelf in. Zet bij elke wijziging `updatedAt` op de nieuwe datum |
| Sitefoto's en video's | `content/assets.ts` | Een bestand verschijnt pas als zijn sleutel in `SUPPLIED` staat. Zie `docs/ASSETS.md` |
| Collecties, stacks, menu | `content/collections.ts`, `content/stacks.ts`, `content/navigation.ts` | Een stack heeft precies drie oorbellen of armbanden |
| Claims en reviews | `content/claims.ts`, `content/reviews.ts` | Een claim alleen met `verified: true` en een bron. Reviews alleen echte; zonder reviews toont de site niets |
| Overige teksten (knoppen, labels, foutmeldingen) | `content/copy/*.ts` | Per onderwerp: tas, productpagina, formulieren, pagina's |

Wat in Shopify staat (producten, foto's, prijzen, voorraad, collecties, kortingen) verandert zonder deploy: de webhooks verversen de site.

## Shopify koppelen

De volledige inrichting staat in `docs/METAFIELDS.md`, de volgorde in `docs/TODO-LAUNCH.md`. In het kort:

1. **Plan en Headless-kanaal.** Shopify Basic of hoger (het Headless-kanaal werkt niet op Starter). Installeer het kanaal Headless, maak een storefront en zet de Storefront-permissies aan: `unauthenticated_read_product_listings`, `unauthenticated_read_product_inventory`, `unauthenticated_read_product_tags`, `unauthenticated_read_checkouts`, `unauthenticated_write_checkouts`, `unauthenticated_read_content`.
2. **Storefront-token.** Het privétoken van de storefront wordt `SHOPIFY_STOREFRONT_ACCESS_TOKEN`. `SHOPIFY_STOREFRONT_TOKEN_TYPE` blijft leeg (`private`). `SHOPIFY_STORE_DOMAIN` is het myshopify-domein, bijvoorbeeld `sparkela.myshopify.com`.
3. **Admin-app** voor de aanmeldingen: een app in het Dev Dashboard met `read_customers` en `write_customers` (zie "Wachtlijst live zetten", stap 2 en 3).
4. **Metafields** met Storefront-toegang: eerst de 14 definities uit `docs/METAFIELDS.md` §3 (namespace `custom`), pas dan `data/shopify-products.csv` importeren. Zonder Storefront-toegang ziet de site een veld niet, ook al is het gevuld.
5. **Producten, tags en collecties**: tags `type:…`, `vibe:…`, `moment:…`, `drop:…`, `nieuw`, `verborgen`, `piercing`. De handmatige collectie `alle` bepaalt welke producten op de site staan en in welke volgorde. Publiceer alles alleen in het Headless-kanaal.
6. **Webhooks**: Instellingen › Meldingen › Webhooks, JSON, API-versie 2026-10, naar `https://sparkela.nl/api/revalidate`, voor Productcreatie, Productupdate, Productverwijdering, Voorraadniveau-update, Collectiecreatie, Collectie-update en Collectieverwijdering. De ondertekeningssleutel daar wordt `SHOPIFY_WEBHOOK_SECRET`.
7. **Klantaccounts**: de URL van de accountpagina in `SHOPIFY_CUSTOMER_ACCOUNT_URL`; `/account` stuurt daarheen.
8. **Testen**: met de sleutels in `.env.local` draait `npm run test:shopify` een leestest tegen de echte winkel. Hij controleert onder meer of elke drophandle in `alle` staat en of de eerste foto van elk product JPEG of PNG is.

Lokaal tegen Shopify draaien kan ook: zet `COMMERCE_PROVIDER=shopify` en de Shopify-variabelen in `.env.local` en start `npm run dev`.

## Deployen op Vercel

1. **Pro-plan.** Hobby is alleen voor niet-commercieel gebruik, en de wachtlijst verzamelt al aanmeldingen voor Sparkela.
2. **Project.** Importeer de git-repository en zet Settings › General › Root Directory op `sparkela`. Framework: Next.js. Build- en installcommando's blijven standaard.
3. **Variabelen** (Settings › Environment Variables). Zet ze voor Production. Voor Preview mag hetzelfde, of laat `COMMERCE_PROVIDER` daar leeg: dan draait een preview-deploy met de testproducten. Een variabele die met `NEXT_PUBLIC_` begint, zit in de build: na een wijziging opnieuw deployen.
4. **Domein.** Settings › Domains: voeg `sparkela.nl` toe, zet de DNS-records bij je domeinregistrar zoals Vercel ze toont, en laat `www.sparkela.nl` doorsturen naar `sparkela.nl`. Het subdomein voor de checkout (bijvoorbeeld `shop.sparkela.nl`) gaat naar Shopify, niet naar Vercel (`docs/TODO-LAUNCH.md` stap 8).

| Variabele | Waar | Wat het doet |
| --- | --- | --- |
| `COMMERCE_PROVIDER` | Production: `shopify` | `local` (standaard: testproducten, tas in de browser) of `shopify`. Production bouwt alleen met `shopify`; anders faalt de build |
| `NEXT_PUBLIC_SITE_URL` | Production | Basis-URL voor metadata, sitemap, JSON-LD en de early-access-links. Standaard `https://sparkela.nl` |
| `SHOPIFY_STORE_DOMAIN` | Production | Het myshopify-domein zonder `https://`, bijvoorbeeld `sparkela.myshopify.com` |
| `SHOPIFY_STOREFRONT_ACCESS_TOKEN` | Production | Privétoken van het Headless-kanaal (catalogus en tas) |
| `SHOPIFY_STOREFRONT_TOKEN_TYPE` | leeg laten | `private` (standaard) of `public`: welke header het token draagt |
| `SHOPIFY_ADMIN_CLIENT_ID` en `SHOPIFY_ADMIN_CLIENT_SECRET` | Production | De app in het Dev Dashboard; de site ruilt ze zelf voor een token van ongeveer 24 uur. Alleen voor aanmelden en bevestigen |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | meestal leeg | Vast token van een oudere custom app of een Partner-app. Wint van de client-id en het secret |
| `SHOPIFY_WEBHOOK_SECRET` | Production | Sleutel waarmee Shopify de webhooks ondertekent. Zonder sleutel weigert `/api/revalidate` elke webhook |
| `SHOPIFY_CUSTOMER_ACCOUNT_URL` | Production | Volledige `https://`-URL van de klantaccounts; `/account` stuurt daarheen |
| `REVALIDATE_SECRET` | Production en lokaal | Geheim (minstens 32 tekens) voor het handmatig verversen van de cache |
| `MAIL_API_KEY` | Production | API-sleutel van Resend |
| `MAIL_FROM` | Production | Geverifieerde afzender, bijvoorbeeld `Sparkela <hallo@sparkela.nl>` |
| `MAIL_TO` | Production | Inbox van Sparkela voor de kopieën (herroepen, contact) |
| `PRELAUNCH_BYPASS_TOKEN` | Production en lokaal | Geheim (minstens 32 tekens) voor de preview-link |
| `EARLY_ACCESS_SECRET` | Production en lokaal, precies gelijk | Geheim (minstens 32 tekens) dat de early-access-links ondertekent. Zonder geheim werkt early access niet |
| `NEWSLETTER_CONFIRM_SECRET` | Production | Geheim (minstens 32 tekens) voor de bevestigingslink van de dubbele opt-in. Zonder geheim werkt aanmelden niet (nooit een stille enkele opt-in) |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | optioneel | `true` zet de cookiebanner aan en laadt na toestemming Google Tag Manager. Standaard uit |
| `NEXT_PUBLIC_GTM_ID` | optioneel | Container-id, bijvoorbeeld `GTM-XXXXXXX` |
| `SPARKELA_TEST_CLOCK` en `SPARKELA_TEST_NOW` | nooit in Vercel | De testklok (lokaal en in de tests). In Production altijd uit |
| `SHOPIFY_LIVE_TEST` en `SHOPIFY_LIVE_ADMIN` | alleen lokaal | Zetten `npm run test:shopify` en de Admin-test aan |
| `PLAYWRIGHT_BASE_URL`, `PW_CHROMIUM_PATH`, `CORVANE_CONTENT_DIR` | alleen lokaal | Voor de tests: een server die al draait, een eigen Chromium, de map voor de overlapcontrole |

`VERCEL_ENV` zet Vercel zelf. In Production staat dan ook de testklok uit en zijn de fotostrook en de videorij verborgen zolang er geen enkel bestand is.

Een lege catalogus breekt de build niet: de shoppagina's bestaan dan, zijn leeg en staan achter de wachtlijst. Een onbereikbare Shopify of een fout token breekt de build wel. Lees bij elke deploy de waarschuwingen in het buildlog: ze noemen per product een GPSR-placeholder, een ongeldig metafield, een onbekende tag of een dropproduct buiten `alle`.

Op de lanceringsdag is geen deploy nodig: om 00.00 uur stopt de proxy met de wachtlijst.

## Wachtlijst live zetten

De wachtlijst kan nu live, ook als de producten nog niet in Shopify staan. Vanaf dat moment verzamelt de site aanmeldingen voor een bedrijf: dit is de livegang. Streefdatum: maandag 2 november 2026. Loop de stappen in deze volgorde af (plan §11.9).

### 0. Vercel Pro

Zet het Vercel-project op het Pro-plan. Hobby is alleen voor niet-commercieel gebruik, en de wachtlijst verzamelt aanmeldingen voor Sparkela.

### 1. Shopify en het Headless-kanaal

1. Shopify Basic (het Headless-kanaal werkt niet op Starter).
2. Installeer het verkoopkanaal **Headless** en maak een storefront aan, met de permissies uit "Shopify koppelen". Kopieer het **privétoken**: dat wordt `SHOPIFY_STOREFRONT_ACCESS_TOKEN` (`SHOPIFY_STOREFRONT_TOKEN_TYPE` blijft leeg, dan is het `private`).
3. Lukt het Headless-kanaal niet, dan kan een Storefront-token ook via de Admin API (`storefrontAccessTokenCreate`). Noteer dat dan in `docs/TODO-LAUNCH.md`.
4. Laat de Online Store open, **zonder wachtwoord**. Een wachtwoord blokkeert ook de checkout van de headless shop. Laat de Online Store later doorsturen naar sparkela.nl.

### 2. Een app voor de Admin API (aanmeldingen)

1. Maak in het **Dev Dashboard** van Shopify (dev.shopify.com) een app in dezelfde organisatie als de winkel, met de scopes `read_customers` en `write_customers`.
2. Breng een versie uit en installeer de app op de winkel.
3. Zet de client-id en het client-secret in `SHOPIFY_ADMIN_CLIENT_ID` en `SHOPIFY_ADMIN_CLIENT_SECRET`. De site ruilt ze zelf voor een token van ongeveer 24 uur.
4. `SHOPIFY_ADMIN_ACCESS_TOKEN` blijft leeg, behalve bij oplossing (a) van stap 3.

### 3. Blokkerende test: mag de app bij klantgegevens?

Shopify beperkt beschermde klantgegevens (e-mail, naam) voor apps die een winkel zelf maakt. Test dit daarom één keer met de echte app op het echte plan, vóór de wachtlijst live gaat:

```bash
# In .env.local: SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_ACCESS_TOKEN, SHOPIFY_ADMIN_CLIENT_ID en SHOPIFY_ADMIN_CLIENT_SECRET
SHOPIFY_LIVE_ADMIN=1 npm run test:shopify
```

De test zoekt een klant op met `customerByIdentifier` en maakt een testklant aan met `customerCreate` (adres `test+<datum>@sparkela.nl`; verwijder die testklant daarna in Shopify).

Geeft hij "not approved to access the Customer object" of `ACCESS_DENIED`, dan gaat de wachtlijst **niet** live tot een van deze twee oplossingen werkt:

- (a) Maak de app vanuit een **Partner-account** met custom distribution, installeer hem één keer via OAuth en zet het offline token in `SHOPIFY_ADMIN_ACCESS_TOKEN`.
- (b) Kies een hoger Shopify-plan (Grow).

In de Vercel-logs herken je dit probleem later aan de regel `admin-pii-denied`.

### 4. Resend (mail)

1. Maak een account bij Resend en verifieer het afzenderdomein (sparkela.nl).
2. Zet `MAIL_API_KEY`, `MAIL_FROM` (bijvoorbeeld `Sparkela <hallo@sparkela.nl>`) en `MAIL_TO` (de inbox van Sparkela voor kopieën).

Resend verstuurt de bevestigingsmail van de dubbele opt-in, de ontvangstbevestiging van een herroeping (met een kopie naar Sparkela) en de berichten van het contactformulier. Zonder deze sleutels antwoorden de formulieren met het e-mailadres van Sparkela als terugval. Aanmelden voor de nieuwsbrief werkt zonder mail nooit: er is geen enkele opt-in.

### 5. Geheimen

Maak elk geheim met `openssl rand -base64 32` (minstens 32 tekens; korter telt als afwezig en de functie blijft dicht):

| Variabele | Waarvoor |
| --- | --- |
| `PRELAUNCH_BYPASS_TOKEN` | De preview-link vóór de lancering |
| `EARLY_ACCESS_SECRET` | De early-access-links van de drops |
| `NEWSLETTER_CONFIRM_SECRET` | De bevestigingslink van de dubbele opt-in (zonder dit geheim werkt aanmelden niet) |
| `REVALIDATE_SECRET` | Handmatig de cache verversen (zie hieronder) |

### 6. Vercel

1. Root Directory: `sparkela`.
2. Variabelen voor Production: `COMMERCE_PROVIDER=shopify`, `NEXT_PUBLIC_SITE_URL=https://sparkela.nl`, `SHOPIFY_STORE_DOMAIN` (bijvoorbeeld `sparkela.myshopify.com`), `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, de Admin-variabelen uit stap 2, de mailvariabelen uit stap 4 en de geheimen uit stap 5. De rest uit de tabel bij "Deployen op Vercel" mag later. Zet de testvariabelen (`SPARKELA_TEST_CLOCK`, `SPARKELA_TEST_NOW`) nooit in Vercel.
3. Koppel het domein sparkela.nl aan het project.

Productie bouwt altijd met `shopify`. Een lege catalogus breekt de build niet: de shoppagina's bestaan dan, zijn leeg en staan achter de wachtlijst. Een onbereikbare Shopify of een fout token breekt de build wel.

### 7. Foto van Linde

Exporteer de foto voor de wachtlijst als `public/images/linde/wachtlijst.webp` (4:5, 1200 × 1500 px, zie `docs/ASSETS.md`) en voeg de sleutel `linde.wachtlijst` toe aan `SUPPLIED` in `content/assets.ts`. Zonder dat bestand toont de wachtlijst geen fotoblok (en dus ook geen grijs vlak). Kleinere versies van elke foto maakt `scripts/build-images.mjs` vanzelf bij elke build en bij `npm run dev` (los: `npm run images`); ze komen in `public/_img/` en gaan niet mee in git.

### 8. Socials

Maak de accounts op Instagram, TikTok en Pinterest aan of bevestig ze, en zet per account `confirmed: true` in `content/site.ts` (pas `href` en `handle` aan als de naam anders is). Tot dan linken de wachtlijst, de footer en de JSON-LD ze niet. Dit mag ook na de livegang van de wachtlijst.

### 9. Controleren

```bash
curl -sI https://sparkela.nl/collections/oorbellen   # 200 met x-sparkela-gate: wachtlijst
curl -sI https://sparkela.nl/privacy                 # x-sparkela-gate: open
curl -sI "https://sparkela.nl/?preview=<token>"      # 307 met set-cookie: sparkela_preview
```

Doe daarna één echte aanmelding op de wachtlijst: de bevestigingsmail komt aan, de knop "Bevestig mijn aanmelding" op de bevestigingspagina zet de klant in Shopify op `SUBSCRIBED`. Controleer in Shopify dat de e-mailmarketing van de klant vóór de klik nog niet actief is (`PENDING`) en pas na de klik wel (`SUBSCRIBED`), met de tags `club` en `bron:wachtlijst`. Doe ook één herroeping via `/herroepen`: de ontvangstbevestiging en de kopie komen aan.

## Na de livegang

### Cache handmatig verversen

Shopify ververst de site zelf via webhooks. Wil je iets meteen overal zien (bijvoorbeeld nadat je dropproducten hebt gepubliceerd), of moet de klok van de server opnieuw worden gelezen:

```bash
curl -X POST https://sparkela.nl/api/revalidate \
  -H "Authorization: Bearer <REVALIDATE_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"tags":["products"]}'

# De serverklok (lijsten rond een drop- of lanceringsmoment):
# -d '{"tags":["klok"]}'
```

Toegestane tags: `catalog`, `products`, `collections`, `klok` en `product:<handle>`. Het antwoord is `{"ok":true,"tags":[…]}`. Een fout geheim geeft 401, een andere body 400, en zonder `REVALIDATE_SECRET` in Vercel 503.

### Early access voor een drop

1. Zorg dat `EARLY_ACCESS_SECRET` in Vercel en in `.env.local` hetzelfde is.
2. `npm run early-access-link -- holiday-sparkle` print de link voor de Club-mail.
3. De link geeft Club-leden 24 uur vóór de start toegang tot de droppagina en de producten van die drop, ook tijdens de prelaunch. Wie hem eerder opent, ziet tot dat moment de teaser; de toegang blijft bewaard tot het einde van de drop.

## Na de lancering

Deze onderdelen komen na de lancering (plan §22.1, brief §9). De site sluit er al op aan:

| Onderdeel | Waar het op aansluit |
| --- | --- |
| Spark Guide (blog uit Shopify) | Nieuwe route `/spark-guide`, Shopify-blogs via de Storefront API, menu in `content/navigation.ts` |
| Reviews (review-app, bijvoorbeeld Judge.me) | `content/reviews.ts` en `site.flags.showReviews`; pas dan sterren en reviewblokken |
| Melding als iets weer op voorraad is | De uitverkochte staat van de productkaart en de productpagina, het aanmeldformulier met een tag `voorraad:<handle>` |
| België | `shipping.countries.BE` in `content/shipping.ts` (`enabled`), de verzendtarieven in Shopify |
| Klantfoto's in de fotostrook | `home.photoStrip.items` en `SUPPLIED` in `content/assets.ts`, alleen met schriftelijke toestemming |
| Badges "Sale" en "Bestseller" | `site.badges.enabled` en `site.flags.realSalesData` |

## Waar staat wat

| Map | Inhoud |
| --- | --- |
| `app/` | Routes: `(shop)` met de shop-chrome, `(kaal)` voor de wachtlijst en de bevestigingspagina, `api/` voor formulieren, cart en revalidatie; `drops/` en `products/` daarbuiten bevatten alleen de deelafbeeldingen (OG) |
| `components/` | UI, per onderwerp |
| `content/` | Alle teksten, instellingen en data; juridische teksten in `content/legal/*.md` |
| `lib/` | Logica (prijzen, datums, commerce, formulieren, mail) |
| `proxy.ts` | Prelaunch, preview, early access en de drop-gate. Elk antwoord heeft de header `x-sparkela-gate` (`open`, `wachtlijst`, `preview`, `early-access` of `teaser`) |
| `public/` | Logo's, sitefoto's (`public/images/`) en video's (`public/videos/`) |
| `data/` | `shopify-products.csv` voor de import in Shopify |
| `scripts/` | Beeldversies, logo, early-access-link, testomgeving |
| `tests/` | Unit-tests, Playwright-tests en de Shopify-fixtures |
| `docs/` | Plan, beslissingen, referenties, QA-metingen, de stappenlijst voor de lancering, de handleidingen voor Shopify en beeld, en de compliance per harde regel (`COMPLIANCE.md`) |
