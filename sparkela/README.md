# Sparkela

De webshop van Sparkela: chunky sieraden met een spark. Next.js 16.4.3 (App Router, Cache Components) met Shopify als headless backend. Producten, voorraad, kortingen, checkout en betalingen zitten in Shopify; de site toont alles en praat met Shopify via de Storefront API.

Het bouwplan staat in `docs/PLAN.md`, de beslissingen in `docs/DECISIONS.md`. De regels voor iedereen die code schrijft staan in `AGENTS.md`.

> Deze README is in golf 4-6 geschreven (starten en de wachtlijst live zetten). In golf 12 komen content aanpassen, Shopify koppelen en deployen er volledig bij.

## Starten

Nodig: Node.js 24 en npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Zonder sleutels draait alles met `COMMERCE_PROVIDER=local`: de 24 testproducten uit `content/products.ts`, een winkelwagen in je browser en een demo-checkout. Formulieren tonen zonder mailsleutels het e-mailadres van Sparkela als terugval.

Let op: tot vrijdag 27 november 2026 00.00 uur toont de site op elke shoppagina de wachtlijst (de prelaunch staat in `proxy.ts`). Wil je lokaal de shop zien, gebruik dan de preview-link (zie hieronder) of de testserver.

| Commando | Wat het doet |
| --- | --- |
| `npm run dev` | Ontwikkelserver op poort 3000 |
| `npm run lint` | ESLint over het hele project |
| `npm run typecheck` | Routetypen maken en TypeScript controleren |
| `npm test` | Alle Vitest-tests, ook de content-guard (brief §2) |
| `npm run build` | Productiebuild |
| `npm run build:test` en `npm run start:test` | Build en server (poort 3200) met de testklok op vrijdag 27 november 2026 12.00 uur, zoals Playwright ze gebruikt. Gebruik nooit een kale `next start` om de shop te controleren: vóór 27 november toont die overal de wachtlijst |
| `npm run test:e2e` | Playwright-tests tegen de testserver |
| `npm run early-access-link -- holiday-sparkle` | Print de early-access-link van een drop voor de Club-mail (`-- --all` voor alle drops) |
| `npm run logo` | Maakt alle logobestanden opnieuw |

Omgevingsvariabelen staan met uitleg in `.env.example`. Echte waarden zet je in `.env.local` (lokaal, staat in `.gitignore`) of in Vercel. Nooit een waarde committen.

### Preview-link

Met `PRELAUNCH_BYPASS_TOKEN` in `.env.local` opent `http://localhost:3000/?preview=<token>` de hele shop, ook alle drops vóór hun start. De site zet een cookie met een hash van het token en haalt het token meteen uit de adresbalk. Het werkt 30 dagen per browser. Een geheim korter dan 32 tekens telt niet (de preview blijft dan dicht).

## Wachtlijst live zetten

De wachtlijst kan live zodra golf 4-6 af is, ook als de producten nog niet in Shopify staan. Vanaf dat moment verzamelt de site aanmeldingen voor een bedrijf: dit is de livegang. Loop de stappen in deze volgorde af (plan §11.9).

### 0. Vercel Pro

Zet het Vercel-project op het Pro-plan. Hobby is alleen voor niet-commercieel gebruik, en de wachtlijst verzamelt aanmeldingen voor Sparkela.

### 1. Shopify en het Headless-kanaal

1. Shopify Basic (het Headless-kanaal werkt niet op Starter).
2. Installeer het verkoopkanaal **Headless** en maak een storefront aan. Kopieer het **privétoken**: dat wordt `SHOPIFY_STOREFRONT_ACCESS_TOKEN` (`SHOPIFY_STOREFRONT_TOKEN_TYPE` blijft leeg, dan is het `private`).
3. Lukt het Headless-kanaal niet, dan kan een Storefront-token ook via de Admin API (`storefrontAccessTokenCreate`). Noteer dat dan in `docs/TODO-LAUNCH.md`.
4. Laat de Online Store open, **zonder wachtwoord**. Een wachtwoord blokkeert ook de checkout van de headless shop. Laat de Online Store later doorsturen naar sparkela.nl.

### 2. Een app voor de Admin API (aanmeldingen)

1. Maak in het **Dev Dashboard** van Shopify een app in dezelfde organisatie als de winkel, met de scopes `read_customers` en `write_customers`.
2. Installeer de app op de winkel.
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
2. Variabelen voor Production: `COMMERCE_PROVIDER=shopify`, `NEXT_PUBLIC_SITE_URL=https://sparkela.nl`, `SHOPIFY_STORE_DOMAIN` (bijvoorbeeld `sparkela.myshopify.com`), `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, de Admin-variabelen uit stap 2, de mailvariabelen uit stap 4 en de geheimen uit stap 5. Zet de testvariabelen (`SPARKELA_TEST_CLOCK`, `SPARKELA_TEST_NOW`) nooit in Vercel.
3. Koppel het domein sparkela.nl aan het project.

Productie bouwt altijd met `shopify`. Een lege catalogus breekt de build niet: de shoppagina's bestaan dan, zijn leeg en staan achter de wachtlijst. Een onbereikbare Shopify of een fout token breekt de build wel.

### 7. Foto van Linde

Exporteer de foto voor de wachtlijst als `public/images/linde/wachtlijst.webp` (4:5, 1200 × 1500 px, zie `docs/ASSETS.md`) en voeg de sleutel `linde.wachtlijst` toe aan `SUPPLIED` in `content/assets.ts`. Zonder dat bestand toont de wachtlijst geen fotoblok (en dus ook geen grijs vlak).

### 8. Controleren

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

### Early access voor een drop

1. Zorg dat `EARLY_ACCESS_SECRET` in Vercel en in `.env.local` hetzelfde is.
2. `npm run early-access-link -- holiday-sparkle` print de link voor de Club-mail.
3. De link geeft Club-leden 24 uur vóór de start toegang tot de droppagina en de producten van die drop, ook tijdens de prelaunch.

## Waar staat wat

| Map | Inhoud |
| --- | --- |
| `app/` | Routes: `(shop)` met de shop-chrome, `(kaal)` voor de wachtlijst en de bevestigingspagina, `api/` voor formulieren, cart en revalidatie |
| `components/` | UI, per onderwerp |
| `content/` | Alle teksten, instellingen en data; juridische teksten in `content/legal/*.md` |
| `lib/` | Logica (prijzen, datums, commerce, formulieren, mail) |
| `proxy.ts` | Prelaunch, preview, early access en de drop-gate |
| `docs/` | Plan, beslissingen, referenties en de handleidingen voor Shopify en beeld |
