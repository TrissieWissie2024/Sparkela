# Naar de lancering: stappenlijst voor Tristan

Dit is alles wat er buiten de code nog moet gebeuren, in volgorde. Elke stap zegt waar je het doet, wat je invult en hoe je test. Vink af wat klaar is.

Vandaag is het zondag 1 november 2026. De site zelf is klaar: alle teksten, pagina's, tests en controles zijn groen. Wat nog ontbreekt, zit in Shopify, Vercel, de mail, het beeld en een paar beslissingen van Linde en jou.

Bronnen: brief §11, plan §11.8, §11.9, §16.6, §16.9 en §20.4, `docs/DECISIONS.md`. Hoe je iets in de code aanpast, staat in de `README.md`. De details per onderwerp staan in `docs/METAFIELDS.md` (Shopify-inrichting), `docs/ASSETS.md` (beeld) en `docs/COMPLIANCE.md` (de harde regels en wat daarvan handwerk blijft).

## Data

| Wanneer | Wat | Stap |
| --- | --- | --- |
| ma 2 november | Wachtlijst live, met de foto van Linde | 1 |
| vr 20 november | Producten en productfoto's, sitebeeld (hero, Linde, momenttegels, Statement en subtiel), kortingen, verzending, betalen, domein, webhooks, account, mail en juridisch | 2, 4 tot 11 |
| vr 20 november | Alle open beslissingen genomen (hieronder) | Beslissingen |
| vr 20 november | Review-app gekozen en geïnstalleerd (niet kritiek) | 12 |
| di 24 november | Dropproducten van Holiday Sparkle gepubliceerd, eind-tot-eindtest in de echte winkel, early access getest met de preview-link | 3, 13, 15 |
| wo 25 november | Early-access-mail aan de Club | 13 |
| do 26 november 00.00 | Early access open (Holiday Sparkle, 24 uur vóór de start) | 13, 16 |
| vr 27 november 00.00 | Lancering. Holiday Sparkle en het lanceringscadeau starten op hetzelfde moment | 16 |
| na de lancering | Fotostrook en video's, België, Spark Guide, voorraadmelding, reviews | 17 |

Van 16 tot 24 november is er buffer voor fixes uit de echte winkel. Loopt iets meer dan twee dagen uit, dan schuiven eerst de niet-kritieke onderdelen naar "na de lancering".

## Open beslissingen (Linde en Tristan)

Neem deze uiterlijk vr 20 november. Geef de uitkomst door aan de ontwikkelaar: die zet hem in de code en in `docs/DECISIONS.md`.

- [ ] **Lanceringscadeau** (beslissingen 57 en 219). Wat zit er in het pakket? De promobalk zegt nu "We zijn live. Bij elke bestelling met sieraden zit een cadeautje van ons." met een timer. Bevestig ook:
  - de einddatum: nu tot en met maandag 30 november (`campaigns` in `content/offers.ts`, einde 1 december 00.00 uur);
  - of een bestelling met alleen een cadeaukaart ook een cadeautje krijgt. Nu niet: de tasregel staat alleen bij sieraden. Verandert dat, dan gaan de promotekst en de tasregel samen mee.
  - Er komt nooit iets automatisch in de tas: jullie pakken het cadeautje zelf in.
- [ ] **Klarna aan of uit** (beslissing 142, brief §4). Gaat hij aan in Shopify Payments (stap 7), dan komt `"Klarna"` erbij in `PAYMENT_METHODS` in `content/site.ts`, zodat de betaalbadges in footer en tas kloppen. Bij de lancering staat hij er niet bij.
- [ ] **Dropdata na Holiday Sparkle** (beslissing 22). Deze data zijn voorstellen in `content/drops.ts` (meestal vrijdag 19.00 uur; early access 24 uur eerder):

  | Drop | Publieke start | Einde (exclusief) |
  | --- | --- | --- |
  | Love Club | vr 5 februari 2027, 19.00 | 1 maart 2027 |
  | Oranje Spark | vr 9 april 2027, 19.00 | 1 mei 2027 |
  | Like Mother, Like Daughter | za 1 mei 2027, 19.00 | 10 mei 2027 |
  | Summer Spark | vr 4 juni 2027, 19.00 | 1 september 2027 |
  | Main Character | vr 3 september 2027, 19.00 | 1 oktober 2027 |
  | Vamp | vr 1 oktober 2027, 19.00 | 1 november 2027 |
  | Spark Friday | vr 26 november 2027, 00.00 | 30 november 2027 |

  De teaserpagina's (`/drops/<slug>/binnenkort`) tonen deze data al met een countdown. Een timer mag nooit verschuiven (brief §2), dus bevestig of wijzig ze vóór de lancering.
- [ ] **FAQ over de goudlaag** (beslissing 228e). Het antwoord "De vaste collectie is van roestvrij staal met een goudlaag." komt letterlijk uit de brief en gaat uit van een goudkleurige collectie. Gaan er bij de lancering stukken met een Zilver-variant of zilverkleurige stukken live, beslis dan of dit antwoord verandert. Het staat letterlijk in de brief en in `content/faq.ts`, en de content-guard bewaakt het: verandert het, dan past de ontwikkelaar beide aan.
- [ ] **Juridische controle.** Laat de vijf teksten in `content/legal/*.md` controleren: algemene voorwaarden, privacy, cookies, herroepen, verzenden en retourneren. Elke pagina toont bovenaan "TODO: laten controleren". Na de controle haalt de ontwikkelaar die melding weg en past hij content-guard regel 9 aan (`docs/COMPLIANCE.md` §11). Beslis daarbij over de open plekken tussen haken:
  - het telefoonnummer in de voorwaarden (of haal die regel weg);
  - wie de kosten van het terugsturen betaalt (in de voorwaarden en op `/verzenden-en-retourneren`);
  - of en hoe de bedenktijd geldt voor een digitale cadeaukaart (voorwaarden);
  - de bewaartermijnen in de privacyverklaring, ook die van de serverlogs;
  - de doorgifte buiten de EU in de privacyverklaring: welke Shopify-onderneming, en in welke regio Shopify, Vercel en Resend werken, met welke waarborgen.

  Kies ook het retouradres: de voorwaarden zeggen dat je dat na een herroeping mailt. Het modelformulier voor herroepen staat al in `content/legal/herroepen.md`; laat ook dat controleren.
- [ ] **Bedrijfsgegevens** in `content/site.ts` (`company`): naam van de vof, adres, KvK-nummer en btw-id. Ze staan nu als `[…]` in de footer, de voorwaarden en de privacyverklaring. Liefst al vóór de wachtlijst live gaat: de privacyverklaring noemt wie verantwoordelijk is voor de aanmeldingen. Bevestig ook het e-mailadres `hallo@sparkela.nl` (`site.email`): bestaat de mailbox, en komt er mail aan?
- [ ] **Socials.** Maak de accounts aan of bevestig ze: Instagram `@sparkela.nl`, TikTok `@sparkela.nl`, Pinterest `sparkelanl`. Zet daarna per account `confirmed: true` in `content/site.ts` (en pas `href` en `handle` aan als de naam anders is). Tot dan linkt de site ze nergens, ook niet op de wachtlijst.
- [ ] **Teksten van Linde.** De introductie op de home ("[Linde schrijft hier een korte introductie …]", `content/home.ts`) en het verhaal op `/over-sparkela` ("[Linde schrijft hier haar eigen verhaal.]", `content/copy/pages.ts`). Zonder deze teksten staan er haken op de live site.
- [ ] **Analytics** (beslissing 68). Willen jullie statistieken? Dan een Google Tag Manager-container maken en in Vercel `NEXT_PUBLIC_ANALYTICS_ENABLED=true` en `NEXT_PUBLIC_GTM_ID` zetten (en opnieuw deployen). Pas dan verschijnt de cookiebanner. Zonder analytics laadt de site geen enkel script van derden, en dat mag ook bij de lancering.

## 1. Nu: de wachtlijst live (uiterlijk ma 2 november)

Dit is de livegang: vanaf nu verzamelt de site aanmeldingen voor een bedrijf. Alle details staan in de README, sectie "Wachtlijst live zetten". In het kort:

- [ ] **Vercel Pro.** Vercel › het project › Settings › Billing. Hobby is alleen voor niet-commercieel gebruik.
- [ ] **Shopify Basic** (het Headless-kanaal werkt niet op Starter). Shopify-beheer › Instellingen › Abonnement.
- [ ] **Headless-kanaal.** Installeer het kanaal Headless uit de Shopify App Store, maak een storefront aan en zet de Storefront-permissies uit `docs/METAFIELDS.md` §2 aan. Kopieer het privétoken naar `SHOPIFY_STOREFRONT_ACCESS_TOKEN`. Lukt het kanaal niet: maak het token met de Admin-mutatie `storefrontAccessTokenCreate` en noteer dat hier.
- [ ] **Dev Dashboard-app** "Sparkela site" (dev.shopify.com, dezelfde organisatie als de winkel), met de scopes `read_customers` en `write_customers`. Breng een versie uit (release), installeer hem op de winkel en zet de client-id en het client-secret in `SHOPIFY_ADMIN_CLIENT_ID` en `SHOPIFY_ADMIN_CLIENT_SECRET`.
- [ ] **Blokkerende Admin-test.** Met de sleutels in `.env.local`: `SHOPIFY_LIVE_ADMIN=1 npm run test:shopify`. Werken `customerByIdentifier` en `customerCreate`? Zo niet ("not approved to access the Customer object" of `ACCESS_DENIED`), dan gaat de wachtlijst niet live tot (a) een Partner-app met custom distribution en een offline token in `SHOPIFY_ADMIN_ACCESS_TOKEN`, of (b) het Grow-plan werkt. Verwijder daarna de testklant `test+<datum>@sparkela.nl` in Shopify › Klanten.
- [ ] **Resend.** Account maken, het domein sparkela.nl verifiëren (de DNS-records die Resend toont), en `MAIL_API_KEY`, `MAIL_FROM` en `MAIL_TO` invullen.
- [ ] **Geheimen** van minstens 32 tekens (`openssl rand -base64 32`): `PRELAUNCH_BYPASS_TOKEN`, `EARLY_ACCESS_SECRET`, `NEWSLETTER_CONFIRM_SECRET`, `REVALIDATE_SECRET`. Bewaar ze ook in een wachtwoordmanager.
- [ ] **Vercel.** Root Directory `sparkela` en alle variabelen voor Production (README, "Deployen op Vercel").
- [ ] **sparkela.nl naar Vercel.** Vercel › Settings › Domains › sparkela.nl toevoegen, de DNS-records bij je domeinregistrar zetten zoals Vercel ze toont, en `www.sparkela.nl` laten doorsturen naar `sparkela.nl`.
- [ ] **Foto van Linde** voor de wachtlijst: `public/images/linde/wachtlijst.webp` (4:5, 1200 × 1500 px) en de sleutel `linde.wachtlijst` in `SUPPLIED` (`content/assets.ts`). Zonder foto toont de wachtlijst geen fotoblok, dus dit mag ook iets later.
- [ ] **Socials** bevestigd (zie de beslissingen). Mag later; tot dan staan ze er niet.
- [ ] **Controle met curl** (README, stap "Controleren"): een shoppagina geeft `x-sparkela-gate: wachtlijst`, `/privacy` geeft `open`, de preview-link geeft een 307 met de cookie `sparkela_preview`.
- [ ] **Eén echte aanmelding.** Meld je aan op `https://sparkela.nl/wachtlijst` met je eigen adres. De bevestigingsmail komt aan. Controleer in Shopify › Klanten dat de e-mailmarketing van die klant nog op "in afwachting" (`PENDING`) staat. Klik op de link en op "Bevestig mijn aanmelding": nu staat hij op "geabonneerd" (`SUBSCRIBED`), met de tags `club` en `bron:wachtlijst`. Doe ook één herroeping via `/herroepen`: de ontvangstbevestiging en de kopie naar `MAIL_TO` komen aan.

## 2. Producten (uiterlijk vr 20 november)

Volg `docs/METAFIELDS.md` §1, in die volgorde (beslissing 122):

- [ ] **Metafield-definities** aanmaken: Instellingen › Aangepaste gegevens › Producten › Definitie toevoegen. Alle 14 uit `docs/METAFIELDS.md` §3, namespace `custom`, het juiste type en **Storefronts-toegang aan**.
- [ ] **Pas dan** `data/shopify-products.csv` importeren: Producten › Importeren. Alles komt binnen als concept (`draft`). De cadeaukaart zit er niet in.
- [ ] **Controle na de import.** Open Lola chunky hoops: onderaan bij de metafields is `spec_regel` "Staal, goud- of zilverkleurig · 30 mm" en `gpsr_fabrikant` "[Fabrikant, adres]". Leeg? Dan ontbreekt een definitie of is het type anders: herstel en importeer opnieuw met "Bestaande producten overschrijven" aan.
- [ ] **De echte producten.** Pas titels, beschrijvingen, prijzen, varianten en voorraad aan naar de echte modellen. Houd de regels van `docs/METAFIELDS.md` §3.1 aan: nooit "goud" als los materiaalwoord, nooit "handgemaakt" of "eigen ontwerp", geen andere merken.
- [ ] **Productfoto's**: per model vijf foto's in de volgorde packshot, draagfoto, detail, schaalfoto, stackfoto. JPEG of PNG, 4:5, 1600 × 2000 px, nooit WebP (`docs/ASSETS.md` §3). Bij een Goud- en Zilver-variant: de packshot per kleur aan de variant koppelen.
- [ ] **GPSR per product**: fabrikant, verantwoordelijke in de EU en waarschuwingen, zoals de leverancier ze levert. Daarna staat er nergens meer een `[`. De build waarschuwt per product zolang dat wel zo is.
- [ ] **Claims alleen als ze kloppen**: `nikkelvrij` alleen op `true` met een schriftelijke verklaring van de leverancier per product. Anders leeg laten.
- [ ] **Tag `piercing`** op een piercing die geen oorbel is (dan geldt de hygiëneregel ook).
- [ ] **`lindes_favoriet`** op minstens 6 stukken die Linde zelf kiest (`docs/METAFIELDS.md` §3).
- [ ] **De cadeaukaart** met de hand maken: Producten › Cadeaukaarten, handle `cadeaukaart`, varianten €15, €25 en €50, tag `type:cadeaukaart` (`docs/METAFIELDS.md` §5.2).
- [ ] **Actief zetten en alleen in het Headless-kanaal publiceren**, nooit in het kanaal Online Store. De cadeauverpakking en de cadeaukaart ook in Headless.
- [ ] **Handmatige collectie `alle`** (titel "Alle sieraden", sortering Handmatig), met de volgorde voor "Uitgelicht". Elk sieraad erin, ook de dropproducten; de cadeauverpakking en de cadeaukaart niet. Publiceer de collectie in Headless.
- [ ] **Automatische collecties per tag** uit `docs/METAFIELDS.md` §6.2, met dezelfde handles.
- [ ] **Test.** Ververs de site (de webhooks uit stap 9, of de curl uit de README met `{"tags":["products"]}`) en draai `npm run test:shopify`: groen. De test faalt als de eerste foto van een product geen JPEG of PNG is.

## 3. Dropproducten van Holiday Sparkle (uiterlijk di 24 november)

- [ ] De vier stukken met de handles uit `content/drops.ts`: `holiday-ster-oorbellen`, `holiday-glitter-hoops`, `holiday-sparkle-armband`, `holiday-ster-ketting`. Zijn de echte handles anders, geef ze dan door aan de ontwikkelaar (ook de Holiday stack in `content/stacks.ts` gebruikt er drie).
- [ ] Tag `drop:holiday-sparkle` op elk stuk, en elk stuk in de collectie `alle`, op de positie die de volgorde in de drop moet zijn.
- [ ] Gepubliceerd in het Headless-kanaal, uiterlijk 24 november. Tot de early access zijn ze op de site verborgen.
- [ ] Daarna `products` verversen (curl uit de README) en `npm run test:shopify` draaien: geen waarschuwing "is not in Shopify or not in "alle"".
- [ ] Controleer met de preview-link: `/drops/holiday-sparkle` toont de vier stukken en de Holiday stack. Op `/stacks` en in de lijsten verschijnen ze pas vanaf 27 november 00.00 uur, ook met de preview: die opent de pagina's, maar verandert de klok niet.

## 4. Beeld (sitebeeld uiterlijk vr 20 november)

Alles staat in `docs/ASSETS.md`, met de vaste bestandsnamen, maten en de checklist voor Linde (§7).

- [ ] Vóór de lancering: `hero.desktop` en `hero.mobiel`, `linde.portret`, de vijf `momenten.*`, `home.statement` en `home.subtiel`.
- [ ] Vóór 24 november: `drops.holiday-sparkle` en `stacks.holiday-stack`.
- [ ] Sterk aangeraden vóór de lancering: de drie andere stacks en `club.hero`.
- [ ] Na de lancering mag: de fotostrook (`fotostrook.01` tot `.08`) en de video's (`video.01` tot `.04`). Zolang er geen enkel bestand is, zijn die secties in productie verborgen.
- [ ] Per bestand: onder de vaste naam in `public/images/`, de sleutel in `SUPPLIED` in `content/assets.ts`, zo nodig de alt-tekst aanpassen, `npm run dev` om te kijken, en online zetten (`docs/ASSETS.md` §6).
- [ ] Test: open de home, `/over-sparkela`, een collectie per moment en `/stacks` op een telefoon en een laptop. Nergens staat nog "FOTO: …" waar een bestand hoort.

## 5. Verzending (uiterlijk vr 20 november)

- [ ] Instellingen › Verzending en levering › een verzendprofiel met alleen Nederland als zone.
- [ ] Tarief "PostNL brievenbuspakje" €3,95, en een tweede tarief €0,00 met de voorwaarde "op basis van bestelprijs" vanaf €35,00. Gelijk aan `content/shipping.ts`.
- [ ] België niet aanzetten (staat in de site klaar, maar uit).
- [ ] Test in de checkout met carts H en L uit plan §8.4. H: cadeaukaart €25 plus een sieraad van €14,95. De site telt de cadeaukaart niet mee en zegt "Nog €20,05 tot gratis verzending". Rekent Shopify verzendkosten, of is het gratis? L: drie stackstukken van samen €39,85, na de stack-korting €33,88. Rekent Shopify €3,95? Geef de uitkomst door voor `docs/DECISIONS.md`. Telt Shopify cadeaukaarten mee, dan blijft de site voorzichtig (nooit te vroeg "gratis").

## 6. Kortingen (uiterlijk vr 20 november)

Volgens `docs/METAFIELDS.md` §7. **De titels moeten exact zo heten**: de site herkent de automatische kortingen aan hun titel.

- [ ] Instellingen › Algemeen › tijdzone Europe/Amsterdam.
- [ ] Kortingen › Korting maken › automatisch, "Bedrag korting op producten": **Stack-korting**, 15% op de collecties `oorbellen` en `armbanden`, minimaal 3 artikelen. Combineert met productkortingen en verzendkortingen, **niet** met orderkortingen.
- [ ] Automatisch, "Bedrag korting op producten": **Cadeauverpakking december**, 100% op het product `cadeauverpakking`, van 1 december 2026 00.00 tot en met 31 december 2026 23.59. Combineert met alles.
- [ ] Kortingscode **WELKOM10**, "Bedrag korting op bestelling", 10%, "Beperken tot één gebruik per klant". Combineert met productkortingen en verzendkortingen, niet met orderkortingen.
- [ ] Uitkomst: stack-korting en `WELKOM10` gaan niet samen (Shopify kiest de grootste, advies brief §11); de cadeauverpakking is in december met allebei gratis.
- [ ] Test: zie stap 15 (carts N, O en P).

## 7. Betalen en checkout (uiterlijk vr 20 november)

- [ ] Instellingen › Betalingen › Shopify Payments activeren, met iDEAL | Wero, Bancontact, creditcard en Apple Pay. Klarna volgens de beslissing hierboven.
- [ ] Instellingen › Checkout › Aanpassen: logo, kleuren en lettertype in de huisstijl (roest voor de knop, de achtergrond licht).
- [ ] Instellingen › Klantenprivacy: de cookiebanner van de checkout aan, voor Nederland en de EU.
- [ ] Test: een testbetaling met de testmodus van Shopify Payments, per betaalmethode één keer.

## 8. Domein en Online Store (uiterlijk vr 20 november)

- [ ] Instellingen › Domeinen › een bestaand domein koppelen: `shop.sparkela.nl` (of een ander subdomein). Zet bij je domeinregistrar het CNAME-record dat Shopify toont. De checkout draait daarna op dat subdomein.
- [ ] De Online Store **niet** afschermen met een wachtwoord: dat blokkeert ook de checkout van de headless shop (beslissing 109). Controleer: Online Store › Voorkeuren › "Toegang beperken tot bezoekers met het wachtwoord" staat uit.
- [ ] De Online Store laten doorsturen naar `https://sparkela.nl`: een eenvoudig doorstuurthema of een snippet in `theme.liquid` die elke pagina van de Online Store naar dezelfde pagina op sparkela.nl stuurt.
- [ ] Test: geen enkel product is in het kanaal Online Store gepubliceerd (Producten › filter op verkoopkanaal), en `https://shop.sparkela.nl/` komt uit op sparkela.nl.

## 9. Webhooks (samen met stap 2)

- [ ] Instellingen › Meldingen › Webhooks › webhook maken, formaat JSON, API-versie 2026-10, URL `https://sparkela.nl/api/revalidate`, voor: Productcreatie, Productupdate, Productverwijdering, Voorraadniveau-update, Collectiecreatie, Collectie-update, Collectieverwijdering.
- [ ] De ondertekeningssleutel die daar staat ("Je webhooks worden ondertekend met …") in Vercel als `SHOPIFY_WEBHOOK_SECRET`, en opnieuw deployen.
- [ ] `REVALIDATE_SECRET` staat in Vercel en lokaal, voor de handmatige curl.
- [ ] Test: klik in Shopify bij een webhook op "Testmelding sturen". In Vercel › Logs zie je een `POST /api/revalidate` met 200. Pas daarna een prijs aan: die staat meteen op de productpagina en na één extra bezoek ook in de lijsten (beslissing 130). Wil je het meteen overal, ververs dan `products` met de curl.

## 10. Account (uiterlijk vr 20 november)

- [ ] Instellingen › Klantaccounts › de nieuwe klantaccounts aan. Zet eventueel een eigen domein voor de accounts (bijvoorbeeld `account.sparkela.nl`).
- [ ] Kopieer de URL van de accountpagina (een volledige `https://`-URL) naar `SHOPIFY_CUSTOMER_ACCOUNT_URL` in Vercel.
- [ ] Test: `https://sparkela.nl/account` stuurt door naar het inlogscherm van Shopify.

## 11. Mail en juridisch (uiterlijk vr 20 november)

- [ ] Instellingen › Meldingen › Klantmeldingen › Orderbevestiging: voeg onderaan twee links toe. "Hier de overeenkomst herroepen" naar `https://sparkela.nl/herroepen`, en "Algemene voorwaarden" naar `https://sparkela.nl/algemene-voorwaarden` (artikel 5 van de voorwaarden belooft die link, beslissing 201).
- [ ] De afzender van de Shopify-mails: Instellingen › Meldingen › afzender `hallo@sparkela.nl`, met het domein geverifieerd in Shopify.
- [ ] Shopify Email installeren voor de nieuwsbrief en de Club-mails. Zet dubbele opt-in aan (zoek in Instellingen op "dubbele opt-in"; de plek verschilt per versie van het beheer). Zo bevestigen ook klanten die zich in de checkout aanmelden. De site doet zijn eigen aanmeldingen al met dubbele opt-in.
- [ ] Juridische teksten, bedrijfsgegevens en het e-mailadres: zie de beslissingen hierboven.
- [ ] Socials bevestigd: zie de beslissingen.
- [ ] Test: plaats een testbestelling (stap 15) en kijk of beide links in de orderbevestiging staan en werken.

## 12. Review-app (vr 20 november, niet kritiek)

- [ ] Kies en installeer een review-app (bijvoorbeeld Judge.me) in Shopify, zodat de eerste kopers na hun bestelling een reviewverzoek krijgen.
- [ ] De site toont tot die tijd geen sterren en geen reviews, en dat blijft zo tot er echte reviews zijn. Dan vult de ontwikkelaar `content/reviews.ts` en zet `site.flags.showReviews` aan (plan §22.1). Nooit zelf reviews verzinnen.

## 13. Early access voor Holiday Sparkle

- [ ] `EARLY_ACCESS_SECRET` is in Vercel en in je `.env.local` precies hetzelfde.
- [ ] Uiterlijk di 24 november: test met de preview-link de droppagina, een dropproduct en de Holiday stack in de tas.
- [ ] wo 25 november: `npm run early-access-link -- holiday-sparkle` print de link (met `NEXT_PUBLIC_SITE_URL` leeg of `https://sparkela.nl` in `.env.local`). Zet hem in een Shopify Email-campagne aan de Club: klanten met de tag `club` die op "geabonneerd" staan. Wie de link vóór 26 november 00.00 uur opent, ziet de teaser; de toegang blijft bewaard tot het einde van de drop.
- [ ] do 26 november 00.05 uur: open de link in een privévenster (zonder preview-cookie). De droppagina en de stukken zijn open, een dropproduct en de Holiday stack gaan in de tas, de checkout opent. Een gewoon product kan nog niet in de tas (de shop is pas om 00.00 uur op 27 november open).

## 14. Lanceringscadeau

- [ ] Het cadeautje en de einddatum bevestigd (zie de beslissingen). Het cadeautje ligt klaar om in te pakken bij elke bestelling met sieraden van 27 tot en met 30 november.

## 15. Eind-tot-eindtest in de echte winkel (uiterlijk di 24 november)

Doe dit met de preview-link op `https://sparkela.nl` en de testmodus van Shopify Payments (of een echte betaling die je daarna terugbetaalt).

- [ ] Een bestelling van begin tot eind: product in de tas, checkout, betalen, orderbevestiging (met de twee links uit stap 11), verzendbevestiging.
- [ ] Herroepen via `/herroepen`: de ontvangstbevestiging en de kopie komen aan. Een retour verwerken in Shopify en terugbetalen.
- [ ] De kortingen (`docs/METAFIELDS.md` §7.2), met de echte producten:
  - [ ] Stack-korting: drie oorbellen of armbanden, de tas toont "Stack-korting −€…" en de checkout hetzelfde bedrag.
  - [ ] Cart N: een ring + cadeauverpakking + `WELKOM10`, vóór december. `WELKOM10` geeft 10% over beide.
  - [ ] Cart O: drie stackstukken + cadeauverpakking, "in december". Stack-korting en de cadeauverpakking gratis.
  - [ ] Cart P: een ring en een oorbel + `WELKOM10` + cadeauverpakking, "in december". Cadeauverpakking gratis en `WELKOM10` over de rest.
  - [ ] Stack-korting en `WELKOM10` samen: Shopify past er één toe, de grootste.
  - Voor O en P zet je de startdatum van "Cadeauverpakking december" tijdelijk op vandaag, en daarna **terug op 1 december 00.00 uur**.
- [ ] Verzending: carts H en L (stap 5).
- [ ] Checkout-redirect: "Afrekenen" in de tas opent de checkout op het subdomein van stap 8, met dezelfde regels en bedragen.
- [ ] Een cadeaukaart kopen: de kaart komt per mail, zonder verzendkosten.
- [ ] `npm run test:shopify` nog één keer met de volledige catalogus: groen, en geen waarschuwingen. Lees ook de waarschuwingen in het deploy-log van Vercel (GPSR-placeholder, ongeldig metafield, onbekende tag, dropproduct buiten `alle`).
- [ ] Verwijder de testbestellingen en testklanten.

## 16. Launch-checklist (plan §11.8)

Om 00.00 uur op 27 november stopt de wachtlijst vanzelf. Er is geen deploy nodig.

- [ ] Vooraf: de preview-link getest, alle producten actief en gepubliceerd, `alle` gevuld (ook met de dropproducten), `EARLY_ACCESS_SECRET` gezet, dropproducten gepubliceerd en `products` ververst.
- [ ] wo 25 november: early-access-link verstuurd (stap 13).
- [ ] do 26 november 00.05 uur: early access getest (stap 13).
- [ ] vr 27 november 00.05 uur, in een privévenster zonder preview-cookie: `/` toont de shop met de promobalk van het lanceringscadeau en de banner van Holiday Sparkle, een collectie, een productpagina, de tas en de checkout-redirect werken, en `/wachtlijst` stuurt door naar `/sparkela-club`.
- [ ] Staat een lijst met dropproducten na een paar minuten nog niet goed, ververs dan de klok: de curl uit de README met `{"tags":["klok"]}`.
- [ ] Goed om te weten: wie rond middernacht een juridische pagina open had, kan tot 5 minuten nog de wachtlijst zien bij een klik. Herladen lost het op.

## 17. Later

- [ ] **Vóór 1 december 2026**: de startdatum van "Cadeauverpakking december" staat op 1 december 00.00 uur (na de test in stap 15).
- [ ] **Vóór 1 januari 2027**: de btw-instellingen in Shopify (Instellingen › Belastingen en heffingen) aanpassen aan de kleineondernemersregeling, met je boekhouder. De site wisselt de btw-regel zelf op 1 januari 2027 00.00 uur ("Sparkela maakt gebruik van de kleineondernemersregeling; er wordt geen btw berekend."). De prijzen voor de klant blijven gelijk.
- [ ] **Per volgende drop**: de handles in `productHandles` in `content/drops.ts`, de tag `drop:<slug>`, de producten in `alle` en de voorwaarde in de automatische collectie `limited`, het dropbeeld `drops.<slug>`, en de early-access-link in de Club-mail. Publiceren uiterlijk de dag vóór de early access.
- [ ] **Elk jaar**: de datums van "Cadeauverpakking december" in Shopify opnieuw zetten. De site kent december 2026 en december 2027 al (`giftWrap.freeWindows` in `content/offers.ts`); daarna een nieuw venster erbij.
- [ ] **Vóór oktober 2027**: de Shopify API-versie `2026-10` herzien (`lib/commerce/shopify/config.ts` en de versie van de webhooks).
- [ ] **Na de lancering** (plan §22.1, brief §9):
  - Spark Guide (een blog uit Shopify) op `/spark-guide`.
  - Echte reviews uit de review-app: `content/reviews.ts` en `site.flags.showReviews`.
  - Een melding als iets weer op voorraad is.
  - België aanzetten: `shipping.countries.BE` in `content/shipping.ts`, en verzendtarieven in Shopify. De bedragen daar zijn nog voorstellen.
  - Echte klantfoto's in de fotostrook, alleen met schriftelijke toestemming.
  - De badges "Sale" en "Bestseller", pas met echte verkoopdata (`site.badges.enabled` en `site.flags.realSalesData`).
  - Een gedeelde rate limit voor de formulieren als er misbruik is (beslissing 48).
  - De punten die na de lancering op de lijst staan in `docs/QA-NOTES.md` en `docs/DECISIONS.md` (beslissing 228b en andere).
