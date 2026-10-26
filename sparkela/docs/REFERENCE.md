# Referenties: CORVANE en Lashthing (fase 1)

## 1. Inleiding

Dit document legt vast hoe de twee referenties zijn opgebouwd. PLAN en bouw gebruiken het als gezamenlijke basis.

- **Alleen structuur.** Volgorde, maten, grid, interactie en conversiemechanieken, in eigen woorden.
- **Lashthing:** we nemen geen tekst, beeld, logo's, iconen, code, CSS of kleuren over (brief §2.1). Ook geen productnamen, prijzen of slogans.
- **CORVANE** is ons eigen project. De opbouw en de code mogen we hergebruiken. Het merk (kleuren, fonts, teksten, product) niet.
- **Rolverdeling (§6):** waar de twee verschillen, bepaalt CORVANE het kader (grid, witruimte, header, productkaart, productpagina, cart drawer, footer). Lashthing levert de extra conversieblokken (reviews met foto, quiz, FAQ, fotostrook).
- **Betrouwbaarheid:** CORVANE is zelf bekeken, op beide viewports. Lashthing is tweedehands, via de zoekindex. Elk Lashthing-punt heeft daarom een label (zie §3).

### 1.1 Status

| Bron | Hoe | Wanneer | Resultaat |
| --- | --- | --- | --- |
| CORVANE | Lokale productiebuild van branch `claude/new-session-d68ewq`, commit `93d1c5b`. Read-only gekloond buiten de Sparkela-repo. `npm ci` en `npm run build` (Next 16.4.3, Node 24), daarna `next start -p 3200`. Vastgelegd met `scripts/capture-reference.mjs --site=corvane`, Chromium via `PW_CHROMIUM_PATH`. | 26 oktober 2026, mobiel 21:10 UTC, desktop 21:14 UTC | 15 screenshots mobiel, 14 desktop, per viewport 8 `*.structure.json`, plus `manifest.json`. Eén verwachte waarschuwing: de desktop-nav heeft geen dropdowns. |
| lashthing.nl, direct | Playwright en WebFetch | 26 oktober 2026 | **Geblokkeerd.** De netwerkproxy geeft 403 op CONNECT. WebFetch geeft ENOTFOUND. web.archive.org is ook geblokkeerd. We hebben de proxy niet omzeild. |
| lashthing.nl, indirect | WebSearch: 8 zoekopdrachten in standaardmodus (leverde bijna niets op) en 86 in extended modus. Extended gaf geïndexeerde snapshots die de zoektool samenvatte. | 26 oktober 2026 | Welke blokken er per paginatype zijn, met een betrouwbaarheidslabel. De sectievolgorde is grotendeels onbekend. Geen screenshots. |

**Opnieuw doen.** Eerst moet de netwerkpolicy van de omgeving lashthing.nl toestaan. Waarschijnlijk is dat niet genoeg: de e-mailpopup, de ingebedde quiz, de review- en fotowidget en de Trustpilot-widget laden meestal van hosts van derden, en de proxy blokkeert die ook (getest: een Klaviyo- en een Trustpilot-host gaven dezelfde fout als lashthing.nl). Welke hosts nodig zijn, blijkt pas uit een eerste run: het script zet ze per pagina onder `blockedHosts` in `manifest.json`. Draai dan vanuit `sparkela/`:

```bash
npm run capture:reference -- --site=lashthing
```

Het script staat in `scripts/capture-reference.mjs`. Heeft de machine geen Playwright-browser, zet dan `PW_CHROMIUM_PATH` op een Chromium-binary. De volledige checklist staat in §6.

**Screenshots** staan in `reference/` (in `.gitignore`), nooit in `public/`. Pad: `reference/<site>/<mobile|desktop>/NN-<staat>.png`, met `manifest.json` per site.

### 1.2 Wat er van CORVANE is vastgelegd

Mobiel is 390×844 met DPR 2, desktop 1440×900. Maten zijn gemeten met `page.evaluate` op 390, 768 en 1440 px, tenzij anders vermeld.

| # | `mobile/` | `desktop/` |
| --- | --- | --- |
| 01 | home-top | home-top |
| 02 | popup | popup |
| 03 | popup-pill | popup-pill |
| 04 | home-full | home-full |
| 05 | footer | footer |
| 06 | menu-open | nav-open (hover op de eerste link) |
| 07 | quiz | quiz |
| 08 | collection-top | collection-top |
| 09 | collection-full | collection-full |
| 10 | product-top | product-top |
| 11 | product-full | product-full |
| 12 | product-scrolled (sticky koopbalk) | product-scrolled (sticky kolommen) |
| 13 | cart-empty | cart-empty |
| 14 | cart-drawer | cart-drawer |
| 15 | cart-drawer-full | geen: de drawer past op desktop |

**Regels die het script volgt:**

- Een cookiebanner krijgt altijd de meest privacyvriendelijke keuze: weigeren of alleen noodzakelijk, ook via een link of in een iframe. Een voorkeurenpaneel wordt alleen opgeslagen als alle optionele schakelaars al uit staan. Is er daarna nog een cookiebanner zichtbaar, dan staat er een waarschuwing in het manifest.
- Een popup wordt gesloten met zijn eigen sluitknop.
- Een quiz wordt geopend, nooit ingevuld.
- De cart draait in een wegwerp-browsercontext met precies één klik op "toevoegen".
- Checkout-URL's en niet-GET-verzoeken naar aanmelden, contact en inloggen worden op netwerkniveau geblokkeerd.
- `structure.json` bevat maten, aantallen en vlakken. De enige tekst is een label van maximaal 32 tekens (aria-label, id of eerste kop). Op een referentiesite is dat hun eigen kopcopy: alleen ter oriëntatie, nooit overnemen in `docs/` of `content/`.
- Verzoeken die mislukken of een 403 krijgen, komen per pagina met hun host in `blockedHosts` in het manifest.

**Niet als screenshot gezien:** vraag 2 en 3 van de quiz, het resultaatscherm en de stappen kaart → e-mail → code in de popup. Die staan hieronder beschreven op basis van de broncode van CORVANE.

## 2. CORVANE (zelf bekeken, beide viewports)

CORVANE noemt zijn kleurrollen `fog` (pagina), `sand` (vlak), `deep` (donker), `kelp` (groen accent), `signal` (oranje knop) en `ink` (tekst). Die namen staan hieronder om de code terug te vinden. De vertaling naar Sparkela staat in §5.

### 2.1 Globaal kader

- **Container:** max-width 1240 px. Zijpadding 20 px op mobiel, 32 px vanaf `md` (768). De inhoud is 350 px breed op 390 en 1176 px op 1440. Alleen de promobalk gebruikt op telefoons 16 px zijpadding.
- **Breakpoints die de layout veranderen:** `sm` 640, `md` 768, `lg` 1024, `xl` 1280. `sm` verandert weinig maar wel iets: de finderopties gaan naar 2 × 2 en de findertegels naar 76 px, de kolomgap van het productgrid gaat van 12 naar 16 px, en de videokaarten gaan van 62% naar 40% breed.
- **Sectieritme (verticale padding):**
  - Volle secties op de home: 80 px mobiel, 112 px vanaf `md`, 128 px vanaf `lg`.
  - Een lege reviewsectie: 56 / 80 / 96 px.
  - Twee secties na elkaar op dezelfde paginakleur krijgen een haarlijn over de containerbreedte. De achtergrond wisselt dan niet.
- **Vlakken op de home, van boven naar beneden:** deep (hero) → fog (leverbalk, assortiment, uitleg) → sand (vergelijking) → deep (finder) → fog (reviews, films) → kelp (garantie) → fog (FAQ, verhaal) → deep (footer). Gekleurde banden wisselen af met veel licht vlak.
- **Radius:** kaarten, media, drawers, modals en optietegels 16 px. Knoppen, chips, invoervelden, de select en badges zijn helemaal rond. Het notenpaneel op de productkaart is 10 px.
- **Schaduw:** zacht bij hover, opgetild bij drawers en modals. De overlay erachter is inkt op 45%.
- **Typografie:**
  - Koppen: serif 600, tracking -0.015 tot -0.02em. Body en UI: Inter. Labels: 12 px, 600, kapitalen, tracking 0.14em.
  - Sectie-H2: 34 / 44 / 52 px.
  - Home-H1: clamp(40px, 11.25vw, 44px) op telefoons, 48 vanaf `md`, 68 vanaf `lg`, 78 vanaf `xl`, regelhoogte 1.02.
  - PDP-H1: 40 naar 54 px. Collectie-H1: 42 / 56 / 68 px.
- **Eyebrow:** een streepje van 24 × 1 px, dan het label in kapitalen, de kop 16 px eronder. Het streepje heeft de accentkleur op de home en een neutrale kleur op PDP en collectie.
- **Knoppen:** sm 36 px, md 48 px, lg 56 px hoog. Icoonknoppen zijn vierkant: 44, 48 of 56 px. Kleine knoppen krijgen een tikvlak van 44 px via een onzichtbare `::before`.

**Paginahoogtes (gemeten):** home 11.731 px mobiel en 9.910 px desktop. Collectie 4.265 en 3.458 px. Productpagina 6.072 en 5.419 px.

### 2.2 Promobalk

- 48 px hoog onder `lg` (tekst 12 px, actiebericht op twee regels). 40 px vanaf `lg` (13 px, alles op één regel met dunne scheidingslijnen).
- Staat in de normale flow en scrolt weg. Alleen de header blijft staan.
- **Met een actieve actie:** bericht, een chip met de code, de uitzondering, "eindigt over 6d 1u" en een pauzeknop.
- **Zonder actie:** op mobiel één roterende USP-regel (elke 4 s, met pauzeknop). Op desktop alle drie de USP's naast elkaar met dunne scheidingslijnen.
- De timer telt af naar een vaste einddatum uit de content. Hij reset nooit per bezoeker.

### 2.3 Header

- Sticky op top 0, z-index 30. **64 px op elke viewport, en hij krimpt niet bij scrollen** (64 px bovenaan en 64 px na 1200 px scrollen). Effen paginakleur met een rand van 1 px onderaan.
- **Opbouw:** een grid van drie kolommen (1fr / auto / 1fr, gap 16 px). Het logo staat daardoor altijd in het midden.
  - Mobiel: hamburger | woordmerk (139 × 17 px) | account en winkelwagen.
  - Vanaf `lg`: nav | woordmerk (172 × 21 px) | account en winkelwagen.
- Iconen 22 px, lijndikte 1.5, in knoppen van 48 px.
- **Teller op de winkelwagen:** een stip van 18 px in inkt met een ring, rechtsboven op het icoon. De ruimte is altijd gereserveerd, dus er verschuift niets. Hij komt in beeld met een fade en een schaal.

### 2.4 Desktop-nav

- Vijf gewone links, geen dropdowns. 13 px met 12 px tussenruimte op `lg`, 14 px met 32 px vanaf `xl`.
- Tikvlak 44 px hoog, tekst op 75% inkt.
- Bij hover en op de huidige pagina groeit in 300 ms een lijn van 1 px van links onder de link. De huidige pagina krijgt ook `aria-current`.
- **Sparkela moet dropdownpanelen toevoegen** (Shop per moment, Cadeaus). CORVANE heeft daar geen patroon voor.

### 2.5 Mobiel menu

- Een drawer van links, 352 px breed (22rem, hooguit viewport min 24 px). Rechterhoeken 16 px rond, met overlay.
- Kopregel van 64 px: woordmerk (15 px) en een sluitknop van 44 px.
- Hoofdlinks in serif, 32 px, elk 53 px hoog. De huidige pagina krijgt een stipje in de accentkleur.
- Onder een haarlijn (32 px erboven, 20 px padding): servicelinks in 15 px secundaire tekst, elk 44 px hoog.
- Daaronder een uitgelichte productkaart (sand, radius 16: render, eyebrow, naam, regel, prijs, pijl) en onderaan de tagline met een icoon.
- Laadt lui, houdt de focus vast, sluit met Esc, geeft de focus terug aan de hamburger, en sluit bij een routewissel of als de viewport naar `lg` groeit.

### 2.6 Homepage, van boven naar beneden

| # | Sectie | Vlak | Hoogte mobiel | Hoogte desktop |
| --- | --- | --- | --- | --- |
| 1 | Promobalk | deep | 48 | 40 |
| 2 | Header (sticky) | fog | 64 | 64 |
| 3 | Hero | deep | 825 | 723 |
| 4 | Leverbalk | fog, rand onder | 117 | 65 |
| 5 | Productgrid | fog | 2.094 | 1.600 |
| 6 | Zo werkt het | fog, haarlijn boven | 776 | 917 |
| 7 | Vergelijking | sand | 1.288 | 1.066 |
| 8 | Finder (quiz) | deep | 862 | 721 |
| 9 | Reviews (lege staat) | fog | 249 | 329 |
| 10 | Videorij | fog, haarlijn boven | 772 | 613 |
| 11 | Garantie | kelp | 1.012 | 775 |
| 12 | FAQ | fog | 850 | 743 |
| 13 | Merkverhaal-teaser | fog, haarlijn boven | 1.231 | 1.036 |
| 14 | Footer | deep | 1.545 | 1.219 |

Per sectie:

1. **Hero (deep).**
   - Op mobiel komt de tekst eerst: eyebrow, H1 (max 14ch), subregel (17 tot 18 px, max 22rem), twee outline-pills (32 px, 13 px tekst, met icoon), twee knoppen, dan een mediavak van 4:5 (320 × 400).
   - Knoppen: 48 px, vanaf `lg` 56 px. Primair naar de shop. Secundair een outline-knop op donker met een pijl omlaag naar de finder.
   - Desktop: grid van 12 kolommen, kolomgap 24 px. Tekst links, media rechts in 5 van 12 kolommen (476 × 595). Een radiale gloed achter het product.
   - Padding 40/32 px op mobiel, 64 px vanaf `md`.
   - Op 390 × 844 staan de H1 en beide knoppen boven de vouw (H1 begint op 188 px, de knoppen eindigen op 489 px). Het product valt deels onder de vouw.
   - De ratingregel verschijnt alleen als er echte reviews zijn.
2. **Leverbalk (fog, rand onder).**
   - Mobiel: drie regels onder elkaar met een iconenkolom van 18 px: verzenddag, vlag met geschatte bezorgdag, gratis verzending vanaf €X. Rechts naast de laatste regel een NL/BE-schakelaar. Minstens 116 px hoog.
   - Vanaf `lg`: één rij van 64 px met haarlijnen ertussen, de schakelaar rechts.
   - Vaste tekst, geen aftelling. De server rendert eerst een versie die op elke dag klopt. Een live region meldt een landwissel aan schermlezers.
3. **Productgrid.**
   - Kopblok: eyebrow, H2, intro. De sorteerselect (pill van 44 px met het label "Sorteren op") staat vanaf `md` rechts naast de kop, op mobiel eronder.
   - Grid: 2 kolommen met gap 12 / 40 px (kolom / rij), kolomgap 16 vanaf `sm`. `md`: 3 kolommen, 24 / 56. `xl`: 4 kolommen, 24 / 64.
   - Het set-product is een brede kaart: een hele rij onder `xl`, 2 kolommen vanaf `xl`. Zo is elke rij vol.
   - Daarna een gecentreerde outline-knop "alles bekijken", 56 tot 80 px lager.
4. **Zo werkt het (fog, haarlijn boven).**
   - De enige gecentreerde displaykop op de pagina (38 / 46 / 60 / 64 px).
   - De drie stappen zijn een `<ol>`. Mobiel: rijen met een tegel van 104 px (4:5), dan nummer, H3 (26 px) en één regel. Vanaf `md`: drie gecentreerde kolommen met een tegel van 4:3 bovenaan (gap 24, 32 vanaf `lg`).
5. **Vergelijking (sand).** Dezelfde data wordt twee keer gerenderd.
   - Mobiel: een tabel van twee kolommen met een kopregel per kenmerk. De kolomkoppen blijven onder de header plakken (sticky `th`, z-index 10). De cellen zijn kaartjes.
   - Vanaf `md`: een tabel van drie kolommen. De eigen kolom staat op een vlak fog-paneel met radius 16 (geen schaduw).
   - Een kleine noot eronder.
6. **Finder (deep).**
   - Kop links (4 van 12 kolommen, 5 vanaf `xl`), paneel rechts (8 van 12, 7 vanaf `xl`). Op mobiel onder elkaar.
   - Paneel: een kaart met rand en radius 16. Linksboven "vraag 1 van 3" als label, rechtsboven een voortgangsbalk van 3 segmenten. De vraag in serif als H3, met radiotegels eronder (1 kolom op mobiel, 2 × 2 vanaf `sm` (640)).
   - Tegels 64 px hoog, 76 vanaf `sm` en 84 vanaf `lg`, radius 16. De knop "Volgende" is een lichte pill met pijl, rechts uitgelijnd.
7. **Reviews.** Een kortere sectie (56 / 80 / 96 px padding) met eyebrow, een kop die zegt dat er nog geen reviews zijn, en één regel. Geen sterren, geen nulscore.
8. **Videorij (fog, haarlijn boven).**
   - Mobiel: een horizontale scroll-snap-rij tot de schermrand. Kaarten zijn 62% breed (40% vanaf `sm`), 9:16, radius 16 (217 × 386), zodat de volgende kaart net in beeld komt. De rij is alleen focusbaar als hij echt overloopt.
   - `md`: vier kolommen.
   - `lg`: gesplitst. Tekst in 4 kolommen (met een noot onderaan), films in 8.
   - Bijschriften zijn genummerd: "01 Titel".
9. **Garantie (kelp).**
   - Vanaf `lg` links 5 van 12 kolommen: een decoratief rond zegel van 128 px (getal plus eenheid), eyebrow, H2, lead en een outline-knop op donker.
   - Rechts 6 kolommen: een definitielijst met punten (icoon in een cirkel van 44 tot 48 px, titel in serif 20 tot 22 px, tekst), gescheiden door haarlijnen.
   - Daarna een alinea over de wettelijke rechten met een link naar de juridische pagina.
10. **FAQ.**
    - Desktop: kop links (4 van 12) met een link naar alle vragen en een contactregel. De accordion rechts (7 kolommen, vanaf kolom 6).
    - Mobiel (eigen waarneming): de link en de contactregel staan ná de accordion.
    - Triggers zijn 72 px hoog op mobiel en 80 px op desktop, 16 tot 17 px semibold sans, met een chevron in een cirkel van 32 px. Eén item tegelijk open, en het open item kan dicht.
11. **Merkverhaal-teaser (haarlijn boven).** Op mobiel de foto eerst (bijgesneden op 5:4). Vanaf `md` de foto in 4:5 in 5 kolommen links. Tekst: eyebrow, H2, twee alinea's, een "naamblok" tussen haarlijnen, een tagline in serif en een outline-knop.
12. **Footer (deep).** Zie §2.13.

### 2.7 Zwevende e-mailpopup en pill

**Automatisch openen:**

- 8 s na het laden. Het script mat 8,1 s op beide viewports. Op desktop ook bij exit-intent.
- Hooguit één keer per 7 dagen (localStorage in try/catch). Nooit meer na een aanmelding. Nooit in de checkout.
- Nooit als er al een dialog of drawer open is, als de sticky koopbalk of de consentbanner in beeld is, of als de bezoeker aan het typen is.

**Popup:**

- Een modal die bovenaan verankerd is, zodat hij alleen naar beneden groeit. 358 px breed op mobiel, 512 px (32rem) op desktop, radius 16. Hij ligt ook over de header.
- Van boven naar beneden:
  - titel in serif (26 / 30 px) met sluitknop;
  - een regel dat elke kaart dezelfde beloning geeft, plus de voorwaarden (13 px);
  - een sand-paneel (radius 16) met drie kaartknoppen (91 × 122 op mobiel, 131 × 174 op desktop) met het merkteken;
  - een hulpregel en een tekstknop "nee, bedankt" (44 px hoog).
- Uit de broncode: na het omdraaien van een kaart verschijnt een e-mailveld met de toestemmingstekst. Daarna de code, om te kopiëren of met één klik op de cart toe te passen.

**Pill:**

- Vast linksonder, 16 px van de randen op mobiel en 24 px op desktop, z-index 45, 248 × 46 px.
- Een lichte pill met rand en opgetilde schaduw: mini-kaarticoon, label van 13 px semibold, een scheidingslijn, dan een sluitknop van 44 px.
- Verschijnt pas na 240 px scrollen en blijft dan op die pagina. Verborgen op productpagina's onder `lg`, want daar hoort de onderrand bij de sticky koopbalk. Zolang de pill er is, reserveert de pagina ruimte onderaan, zodat toetsenbordfocus er niet achter verdwijnt.

### 2.8 Productkaart

- Een `article` dat zijn layout uit de eigen breedte haalt (container query). In de DOM staat de naam eerst, maar visueel komt de media eerst.
- **Media:** 4:5, radius 16, sand-verloop, geen rand.
  - Badge rechtsboven: pill van 20 px, 11 px kapitalen.
  - Notenpaneel rechtsonder: fog, radius 10, 62% breed (54% vanaf `md`), met familie en drie noten.
  - Hover: zachte schaduw, en het product komt in 500 ms 4 px omhoog.
- **Onder de media:**
  - naam in serif, 19 naar 22 px, 16 / 20 px marge erboven;
  - een beschrijvende regel, 14 tot 15 px, secundaire tekst;
  - een prijsrij 16 px lager.
- **Prijs en toevoegen:** onder een kaartbreedte van 14.5rem (alle kaarten in 2 kolommen op een telefoon) staan prijs en knop onder elkaar, en de knop is vol breed. Bredere kaarten zetten ze naast elkaar.
- **Toevoegknop:** outline-pill van 36 px met een plus-icoon en een tikvlak van 44 px. Toont 1,8 s een "toegevoegd"-staat en opent de drawer.
- **Meerdere varianten (eigen waarneming en broncode):** de cadeaukaart krijgt geen keuzelijst. In plaats van "toevoegen" staat er dezelfde outline-pill (sm, 36 px), maar als link naar de productpagina met het label "bedrag kiezen". Klikken verlaat het grid; het bedrag kies je op de productpagina.
- **Links:** een uitgerekte link maakt de hele kaart klikbaar. De toevoegknop ligt daarboven.
- **Maten:** 169 × 380 (mobiel), 219 × 452 (tablet), 276 × 490 (desktop).

### 2.9 Collectie

- Geen bannerafbeelding. Een kopblok (neutrale eyebrow, H1, intro), een haarlijn, dan een filterrij:
  - het label "familie";
  - chips als toggleknoppen (`aria-pressed`) met een kleurstip, pills van 44 px. De gekozen chip is een inkt-pill met een vinkje. Op mobiel lopen de chips door over meerdere regels;
  - een aantal resultaten dat schermlezers horen, plus de sorteerselect.
- Dan nog een haarlijn en hetzelfde grid. De namen op de kaarten worden hier H2.
- **Volle rijen (eigen waarneming, 9 producten):** op `xl` is het set-product 2 kolommen breed in rij 2, en de laatste twee producten zijn elk 2 kolommen breed in rij 3. Op mobiel is het set-product een hele rij, en de laatste twee staan naast elkaar.
- Na filteren komt er een linkkaart bij voor wie nog twijfelt.
- Filter en sortering staan in de URL (`?family=&sort=`). Ze worden ter plekke bijgewerkt, zonder nieuwe pagina te laden.
- De filterrij begint op 370 px (mobiel) en 413 px (desktop), bij de eerste haarlijn onder de kop. Het productgrid (de eerste kaartrij) begint op 636 px (mobiel) en 555 px (desktop). Op 390 × 844 valt de eerste kaartrij dus grotendeels onder de vouw: er staat ongeveer 200 px van in beeld. Direct na het grid komt de footer.

### 2.10 Productpagina

**Kader:**

- Eerst een kruimelpad, dan een grid:
  - mobiel: één kolom, rijgap 32 px, de galerij tot de schermranden;
  - `md`: twee gelijke kolommen (336 + 336 op 768), gap 32 px;
  - `lg`: 11fr / 9fr met een gap van 56 px, 80 px vanaf `xl` (603 + 493 op 1440).
- Padding boven 32 px, onder 80 px (desktop).
- Vanaf `md` plakken beide kolommen op top 88 px (header plus 24). Zo blijft de kortere kolom in beeld. Op de screenshot na scrollen blijft de galerij staan terwijl de koopkolom doorloopt.

**Galerij:**

- Mobiel: een swipebaan van 4:5 met puntknoppen eronder. De actieve punt is een balkje.
- Vanaf `lg`: links een kolom met vier thumbnails (de gekozen heeft een rand in inkt). Daarnaast de grote afbeelding met ronde vorige/volgende-knoppen rechtsonder.

**Koopkolom, in volgorde:**

1. Familie-eyebrow met een kleurstip, badge rechts.
2. H1.
3. Korte regel (18 tot 20 px).
4. Prijs (20 px semibold) met de inhoud.
5. Beschrijving (16 px, max 34rem).
6. Haarlijn.
7. Variant: label met de gekozen naam, dan swatches (cirkels van 44 px; op desktop cellen van 80 px met de naam eronder; de gekozen heeft een ring en een vinkje).
8. Aantal: radiotegels voor 1, 2 en 3 stuks, radius 16, de gekozen met een rand van 2 px in inkt. Prijs rechts, stukprijs en besparing eronder, een badge "beste waarde". Bij 3 stuks ook een regel over een gratis extra. Door die regels verschillen de hoogtes: 54 / 76 / 104 px op mobiel en 58 / 80 / 108 px op desktop.
9. Mix & match (alleen bij 2 of 3 stuks): een keuze voor stick 2 en 3, elk een rij swatches van 44 px als native radiogroep, plus een regel die de hele set noemt. Dit is het kader voor de stack-kiezer van de brief ("kies twee andere stukken").
10. Koopvorm: radiotegels (eenmalig of abonnement).
11. Een volle primaire knop "In winkelwagen · prijs", 56 px.

**Daarna, nog in de koopkolom:**

- Een leverschattingskaart (radius 16, met rand): verzenddag, vlag met datum, haarlijn, een regel over werkdagen en de NL/BE-schakelaar.
- Trustrijen: icoon in een sand-cirkel van 36 px, vetgedrukte titel, subregel, haarlijnen ertussen. Drie rijen: veilig betalen (met de betaalmethoden), gratis verzending, garantie.
- Noten als chips, in de rijen top, hart en basis.
- "Karakter" met een badge "indicatief": twee meters van 5 segmenten met labels aan de uiteinden, en een disclaimer.
- Accordions: details, gebruik, ingrediënten, verzenden en retourneren.

**Secties over de volle breedte:**

- Cross-sell: kop links in 4 van 12 kolommen, twee productkaarten rechts in 7.
- Een lege reviewrij (inline, kort).
- Een FAQ met vijf productvragen.

**Sticky koopbalk (mobiel, alleen onder `lg`):**

- Vast onderaan, 73 px hoog inclusief de safe area, z-index 40, met een rand boven.
- Links een kleurstip, de naam in serif (16 px) en een regel van 12 px met aantal en koopvorm. Rechts een primaire knop van 48 px met de prijs.
- Verschijnt zodra de grote knop boven de viewport is verdwenen. Voegt dan padding onderaan de pagina toe en verbergt de pill.

### 2.11 Cart drawer

- Van rechts. Op mobiel vol breed zonder radius. Vanaf `md` 432 px (27rem) met radius 16 aan de linkerkant. Opgetilde schaduw, schuift in 360 ms in. De drawer ligt over de hele pagina, ook over de header.
- **Kopregel (64 px):** titel in serif (22 px), aantal artikelen (13 px), sluitknop van 44 px.
- **Scrollende body:**
  - Twee voortgangsdoelen. Elk is een statusregel van 13 px met icoon en het bedrag vet, plus een balk van 2 px. Gratis verzending is één doorlopende balk. Het tweede doel (een cadeau) heeft drie segmenten met een subregel. Een bereikt doel klapt in tot één regel met een vinkje.
  - Een lijn.
  - Per regel: thumbnail van 56 × 70 (sand, afgerond), kleurstip en naam, een regel met de koopvorm, prijs rechts, een stepper van 100 × 36 (−/1/+; uitgeschakelde uiteinden blijven focusbaar) en rechts een onderstreepte link "verwijderen".
  - Een lijn, het label "voeg toe aan je bestelling" en tot drie upsellkaarten. Eén kaart staat als rij over de volle breedte. Twee of drie kaarten staan in een horizontale scroll-snap-rij van tegels van 10,5 tot 12,5rem breed. Drie tegels zijn samen minstens 528 px breed in een body van 350 px, dus de derde loopt zijwaarts door. Elke tegel: beeldtegel van 92 px op sand, witte body met rand, naam, regel, prijs en een kleine outline-knop zonder icoon. Met één product in de cart waren het er twee (zo ziet de screenshot eruit).
  - Betaalbadges gecentreerd onderaan de body.
- **Sticky voet:** subtotaal, verzending, haarlijn, totaal (semibold, 18 px), een btw-regel met daarnaast de totale besparing, en een volle primaire knop "afrekenen" van 48 px.
- **Lege staat:** drie productrenders in een groepje, kop in serif van 28 px, één of twee regels, een primaire knop naar de shop (minstens 13rem breed) en een onderstreepte secundaire link.
- **Gedrag:** focus-trap, Esc sluit, de focus gaat terug naar de knop die de drawer opende, sluit bij een routewissel. Na verwijderen gaat de focus naar de volgende regel (`CartDrawer`, `handleRemove`).

### 2.12 Quiz (uit de broncode)

- Elke vraag is een formulier: een `fieldset` met een H3 in de `legend`, en native radio's. Pijltjestoetsen gaan door de opties. "Volgende" zonder keuze toont een beleefde melding om iets te kiezen. Er zijn geen uitgeschakelde knoppen.
- Terug houdt alle antwoorden vast. Opnieuw beginnen wist ze.
- Bij elke stap gaat de focus naar de kop van de nieuwe stap, en een statusregio meldt "vraag 2 van 3". De stap komt in 420 ms in beeld (fade en omhoog). De hoogte van het paneel animeert in 320 ms.
- **Resultaat:** productrender, naam, familie, prijs, een regel waarom, de noten, in winkelwagen, een link naar de productpagina, opnieuw beginnen, en de set als uitweg.
- CORVANE vraagt in de quiz geen e-mailadres. De Spark Finder van Sparkela voegt na het resultaat een aanmeldstap voor 10% toe.

### 2.13 Footer (deep)

- **Nieuwsbriefblok:** padding 64 / 96 px boven en 56 / 80 px onder. Vanaf `lg` een grid van 5 / 6 van 12 kolommen.
  - Links een H2 (32 / 44 px) en een intro.
  - Rechts het label "e-mailadres", een invoerveld als pill van 48 px op donker naast een primaire aanmeldknop, de toestemmingstekst (13 px) en een demonotitie.
- **Linkkolommen:** 2 kolommen op mobiel (gap 24 / 40), 4 vanaf `md` (gap 32 / 40), padding 48 / 64. Koppen in kapitalen en gedempte tekst. Links 15 px, 44 px hoog. Kolommen: shop, hulp, bedrijf, juridisch.
- **Onderste rijen:**
  - betaalbadges als tekstlabels (22 / 24 px hoog) en sociale links met een ↗-icoon;
  - bedrijfsgegevens (13 px), met copyright en demonotitie rechts vanaf `lg`;
  - een reusachtig woordmerk over de volle containerbreedte.

### 2.14 Beweging en interactie

- Elke animatie zit achter een reduced-motion-check. Bij reduced motion staan alle duurtijden globaal op nul.
- **Duurtijden:**
  - sheets: 360 ms in, 240 ms uit;
  - modals: 320 ms in, 200 ms uit (fade, 12 px omhoog en een lichte schaal);
  - accordions: 280 / 220 ms met een draaiende chevron;
  - overlay: 300 ms fade.
- **Micro-interacties:** knoppen schalen naar 98% bij indrukken. De primaire knop wordt lichter bij hover. De navlijn groeit van links. De pill komt in met een fade en gaat omhoog. De cartteller schaalt in. De USP-regel faded bij elke wissel.
- **Laden:** de code van drawer, menu en popup laadt pas als de pagina rustig is of bij de eerste interactie.

### 2.15 Toegankelijkheid

- **Skiplink en landmarks:** een skiplink naar `<main id="main" tabIndex=-1>` (fixed, z-index 70, zichtbaar bij focus). Eén H1 per pagina. Elke sectie heeft als naam zijn kop.
- **Focus:** overal een outline van 2 px in inkt met 3 px afstand (fog op donkere secties). Na client-side navigatie gaat de focus naar `<main>`.
- **Live meldingen:** de cart, de landschakelaar, het aantal in de collectie en de quiz hebben elk een eigen live region.
- **Status van knoppen:** hamburger en winkelwagen geven `aria-haspopup` en de open/dicht-staat door. Navlinks gebruiken `aria-current`.
- **Lijsten en grids:** elke lijst houdt `role="list"`. Horizontale rijen zijn alleen focusbaar als ze overlopen. Thumbnails van de galerij heten "afbeelding 2 van 4 tonen".
- **Tikvlakken en lagen:** tikvlakken minstens 44 px. Volgorde van de lagen: header 30 < sticky koopbalk 40 < pill 45 < consentbanner 50 < dialogs 60 < skiplink 70.

## 3. Lashthing (tweedehands, via de zoekindex)

### 3.1 Werkwijze en labels

lashthing.nl zelf is nooit geopend. De zoektool gaf in extended modus geïndexeerde snapshots van de pagina's en vatte ze samen. Die snapshots komen van verschillende data en spreken elkaar tegen over getallen: verzendgrenzen, prijzen, aantallen reviews, menu-items. Elk getal kan dus veranderd zijn. Alles hieronder staat in eigen woorden, zonder citaten.

- **hoog:** een zoekresultaat schrijft het punt expliciet toe aan een URL van Lashthing. Dat betekent níet dat we de pagina zelf zagen.
- **middel:** uit één samenvatting, of indirect afgeleid.
- **laag:** een afwezigheid ("niet gevonden"), of een vermoeden.
- **onbekend:** niet te zien in de zoekindex.

De volgorde van secties is in de fragmenten bijna nooit te zien. Er zijn geen screenshots en geen maten.

### 3.2 Wat bekend is, per onderdeel

**Navigatie en pagina's**

- Hoofdmenu in één snapshot: een dropdown voor wimpers, een dropdown voor nagels, toolkit, starterkit, contact, het verhaal en inloggen. (hoog)
- Oudere snapshots tonen een ander menu, onder meer met "shop op stijl" en een tijdelijke cadeauset. Het menu verandert dus mee met het assortiment. (hoog)
- De wimper-dropdown heeft twee groepen (hoog):
  - **op formaat:** vier links, elk met een korte uitleg tussen haakjes in het menu-item zelf. Dat is een goed microcopy-patroon;
  - **op intensiteit:** drie stijlniveaus plus een link naar bestsellers.
  - Of dit een mega-menu met beeld is of een simpele dropdown: onbekend.
- De nagel-dropdown heeft drie items. (middel)
- Er is een overzichtspagina van alle collecties, met onder meer een tijdelijke "weer op voorraad"-collectie, cadeaukits en een toolkit. (hoog)
- Er is een blog met uitleg (verwijderen, draagtijd, lijm, mapping, verzorging). De artikelen sturen naar producten. Of de blog in het hoofdmenu staat: onbekend. (hoog)
- Er is een zoekpagina. (hoog)
- Het verhaal is een oprichtersverhaal in de ik-vorm, gevolgd door een kort missieblok. (hoog)
- Juridisch: een pagina met contactgegevens, een wettelijke kennisgeving met bv, adres, KvK en btw, aparte voorwaarden (hoog), en beleid voor retour, verzending en privacy vanuit de footer (middel).

**Aankondigingsbalk**

- Heeft op verschillende momenten getoond (hoog dat deze berichten bestonden):
  - een gratis-verzendgrens voor NL en BE;
  - een gratis cadeau boven een bestelbedrag, met de waarde erbij;
  - een seizoenscode van 10%;
  - een "weer op voorraad"-bericht;
  - een belofte van levering de volgende dag;
  - een bericht over 30 dagen proberen.
- Of de berichten roteren of stapelen: onbekend.
- De drempels veranderen vaak: drie verschillende verzendgrenzen en twee cadeaugrenzen in de snapshots. (hoog)

**Homepage (blokken aanwezig, volgorde onbekend)**

1. Een hero of bovenblok met vier elementen: een claim over snelheid van aanbrengen en draagdagen, een eigen klantaantal met gemiddelde score, gratis verzending NL en BE, en een geld-terug-badge. (hoog voor de elementen, onbekend voor de layout)
2. Een "weer op voorraad"-banner, met de quiz in de buurt. (middel)
3. Een rij of carrousel met bestsellers. Per kaart: een bestsellerbadge, sterren met aantal, prijs met doorgestreepte prijs, een lengte-optie (3 maten) en een knop om opties te kiezen. (hoog)
4. Een uitgelichte starterkit. De premium kit heeft een directe toevoegknop, andere kits een doorgestreepte "totale waarde". (hoog)
5. De quiz als ingebed blok. (hoog)
6. Een productrij met een nieuwe categorie (nagels) en een link naar alles. (hoog)
7. Een samenvatting van de Trustpilot-score. (hoog)
8. Een FAQ-accordion (wat het product is, water na het uitharden, draagtijd). (hoog)
9. De e-mailpopup en de footer.

**Collecties**

- Elke collectie heeft een SEO-titel met eerst het producttype, dan een voordeel of formaat. Plus één introregel die het formaat uitlegt. (hoog)
- Sommige collecties hebben een banner die het eigen klantaantal en de score herhaalt. (hoog)
- Kaarten: stijlnaam met een stijltag (drie niveaus), sale- en normale prijs, een label "uitverkocht", drie lengte-opties, een knop om opties te kiezen, sterren met aantal. (hoog)
- Uitverkochte producten blijven in het grid, met een label. (hoog)
- Filteren is waarschijnlijk de standaard Shopify-facetfilter: een snapshot bevat de themetekst dat een filter de hele pagina herlaadt. Welke filters en sorteringen er zijn: onbekend. (middel)

**Productpagina**

1. Titels volgen een SEO-patroon: stijlnaam, producttype, formaat. (hoog)
2. Een sterrengemiddelde met een aantal per product, bovenaan. (hoog)
3. Prijs met sale en doorgestreepte prijs. Kits tonen een doorgestreepte totale waarde. Die referentieprijs verschilt tussen pagina's. Precies wat §2.5 verbiedt. (hoog)
4. Variantkiezers (hoog):
   - knoppen voor lengte (drie maten);
   - op sommige producten een stijlkiezer (drie niveaus);
   - een hint dat één maat het vaakst gekozen wordt;
   - een vuistregel voor wie twijfelt over de maat.
5. Op kitpagina's kiest de koper stijl en lengte binnen de kit. De inhoud staat als lijst met aantallen. (hoog)
6. Een voorraadindicator (op voorraad, bijna uitverkocht). Sommige snapshots tonen beide labels tegelijk, dus waarschijnlijk dynamisch. (hoog voor aanwezigheid)
7. **De quiz is ook ingebed op productpagina's**, met de stap e-mail-voor-korting en een link om opnieuw te doen. (hoog)
8. **Een "vaak samen gekocht"-blok** koppelt het product aan een kit of de toolkit, onder een label over bundelen en besparen. Hoe de korting werkt: onbekend. (hoog voor het blok)
9. **Upsell in de beschrijving zelf:** de tekst legt uit dat een los product de toolkit nodig heeft, en dat een kit alles bevat. Dat stuurt naar de duurdere kit. (hoog)
10. Een blok verzenden en retourneren als lijst met vinkjes: vervoerder en verzendgrens, retourtermijn, track-and-trace per mail. De retourtermijn verschilt per pagina (14 of 30 dagen). (hoog)
11. Een sectie "zo breng je het aan" met 5 genummerde stappen. (hoog)
12. Een product-FAQ als accordion (draagtijd, schade aan eigen wimpers, welke stijl past, water in de eerste 24 uur, vergelijking met de salon). (hoog)
13. Een reviewsectie met een label voor geverifieerde kopers en een slideshow van klantfoto's met een teller "1 van N". Welke review-app: onbekend. (middel tot hoog)
14. Een social-blok met links naar Instagram en TikTok. (middel)
15. Een goedkoop verrassingsproduct voor wie niet kan kiezen. De URL hint op een actie "vierde gratis". (hoog dat het product bestaat, laag voor de actie)
16. Structured data met prijs en beschikbaarheid. (middel)
17. Geen abonnement gevonden. (laag, want afwezigheid)

**Cart**

- Een melding over hoeveel er nog nodig is voor gratis verzending. De tekst staat in de snapshot van de homepage, dus waarschijnlijk staat de drawer-markup op elke pagina. (hoog voor de melding, middel dat het een drawer is)
- De lege staat zegt dat de cart leeg is en vraagt om in te loggen om sneller af te rekenen. (hoog)
- Verzending staat als "berekend bij afrekenen". (hoog)
- Een tweede mijlpaal voor het cadeau, upsellrijen, en notitie- of cadeau-opties: onbekend.

**Quiz**

- Noemt vooraf hoeveel vragen het zijn en hoe lang het duurt. (hoog)
- Waarschijnlijke vragen (middel): de gewenste look (vol of naturel), de gewenste mapping (waar de lengte zit), en de lengte van de eigen wimpers.
- Resultaat: een positieve kop, uitleg over "jouw mapping", een aanbevolen product en een link om opnieuw te doen. (middel)
- Beloning: 10% op de eerste bestelling voor een e-mailadres, met een expliciete optie om zonder e-mail door te gaan. (middel tot hoog)
- Inline op de homepage én op productpagina's. Een losse quiz-URL is niet gevonden. (hoog voor inline)

**E-mailpopup**

- Een percentage op de eerste bestelling. De bezoeker vult een e-mailadres in en de code komt per mail. Er is een weigerknop en een succesmelding. (hoog voor aanbod en succes, middel voor de weigerknop)
- Trigger, herhaling, gamification en een toestemmingsvakje: onbekend.

**Garantie en retour**

- Een geld-terug-badge (30 dagen) staat prominent op homepage en productpagina's. (hoog)
- De voorwaarden hangen er condities aan: één geopend product per soort, de rest ongeopend, aanvragen per mail binnen 30 dagen, terugbetaling binnen 30 dagen, retourporto voor de koper tenzij defect. (hoog)
- De voorwaarden noemen 30 dagen bedenktijd, sommige productpagina's 14 dagen. Klachten binnen 7 dagen melden. (hoog)

**FAQ:** geen losse FAQ-pagina gevonden. De vragen staan als accordion op homepage en productpagina's. (middel, afwezigheid)

**Foto's, UGC en social**

- Instagram en TikTok vanuit footer en structured data. (middel)
- Klantfoto's als slideshow op productpagina's. (middel)
- Het merk leunt op video van de oprichter: TikTok, een uitlegvideo op YouTube, en reviewers die de tutorials noemen. (middel)
- Een fotostrook of Instagram-grid op de homepage: onbekend.

**Footer**

- Links naar privacy, retour, verzending, voorwaarden en de wettelijke kennisgeving. (middel)
- Een taal- of marktkeuze (NL, FR, DE). (middel)
- Sociale links. (middel)
- Kolommen, betaaliconen, nieuwsbriefveld en bedrijfsgegevens: onbekend.

**Talen, verzenden, betalen, platform**

- Een /en-pad met grotendeels Nederlandse inhoud, en een tweede domein met een /nl-pad: meerdere markten in Shopify. (hoog)
- Verzenden naar NL en BE (hoog), met DHL en track-and-trace per mail (hoog). Een volgende-dag-belofte; de cut-off is onbekend. (middel)
- De verzendgrens ligt rond 1,5 tot 2,5 keer de prijs van één product en is een paar keer veranderd. (hoog)
- Betaalmethoden: onbekend, er is niets geïndexeerd.
- Shopify (paden /collections, /products, /policies, /blogs). (hoog) Waarschijnlijk een thema uit de Dawn-familie, gezien de standaardteksten voor snel toevoegen, prijsopmaak, herladende filters en de inlogvraag in een lege cart. (middel)

### 3.3 Patronen die Sparkela niet overneemt

Dit zijn social-proof- en prijspatronen die botsen met §2.3, §2.5 en §2.7:

1. Een eigen klantaantal met gemiddelde score in de hero en in collectiebanners. De eigen cijfers van de site spreken elkaar tegen.
2. Een Trustpilot-widget.
3. Sterrengemiddelden met aantallen per product.
4. Bestsellerbadges die niet uit een handmatige flag komen.
5. Labels "bijna uitverkocht" zonder harde drempel.
6. Een hint dat een maat "het vaakst gekozen" wordt.
7. Doorgestreepte referentieprijzen die per pagina verschillen.
8. Een retourtermijn die per pagina verschilt.

Sparkela bouwt de componenten wel, maar laat ze leeg of verborgen tot er echte data is. Badges komen uit een handmatige flag. "Laatste stuks" verschijnt alleen bij een echte voorraad op of onder de drempel. Er komt geen regel met een klantaantal.

### 3.4 Open vragen (alleen met een echt bezoek te beantwoorden)

1. De sectievolgorde van de homepage, van boven naar beneden, op 390 en 1440 px. De layout van de hero (foto, knoppen, plek van de badge).
2. Is het wimpermenu een mega-menu met beeld of kolommen, of een gewone dropdown? Hoe gedraagt het mobiele menu zich?
3. Roteert of stapelt de aankondigingsbalk, hoe snel, en kan hij weg?
4. Cart: drawer of pagina? Een voortgangsbalk met één of twee mijlpalen (verzending en cadeau)? Upsellrijen? Cadeau- of notitieopties? Betaaliconen? Kortingscodeveld?
5. Precieze quizflow: vragen en antwoordopties, voortgangsindicator, layout van het resultaat, e-mail vóór of na het resultaat, een losse URL, toetsenbordgedrag.
6. E-mailpopup: trigger (vertraging, exit-intent, scroll), hoe vaak hij terugkomt, de visuele mechaniek, een toestemmingstekst, de mobiele variant en een zwevende teaserknop.
7. Productpagina: type galerij (thumbnails, swipe, zoom, video), een sticky koopbalk, een aantalstepper, de lijst en volgorde van accordions, de review-app en de layout van fotoreviews, en hoe "vaak samen gekocht" de korting toepast.
8. Collectie: welke filters en sorteringen, hover op kaarten (tweede foto), layout van de banner, gridkolommen op mobiel en desktop.
9. Homepage: een reviewcarrousel (voornaam en foto?), een fotostrook of Instagram-grid, en een vergelijking of uitlegblok. Aanwezig of niet, en hoe opgebouwd.
10. Footer: kolommen en koppen, nieuwsbriefveld, betaaliconen, bedrijfsgegevens, plek van de taalkeuze.
11. Welke betaalmethoden er vóór de checkout te zien zijn.
12. De cut-off voor verzenden en hoe de leverbelofte getoond wordt (vast of dynamisch).
13. Hoe de cadeaukits en het verrassingsproduct gepresenteerd worden, en of de actie "vierde gratis" loopt.
14. Een cookiebanner, en of er scripts laden vóór toestemming.

### 3.5 Bronnen

De zoekopdrachten zelf staan niet in dit document. Sommige bevatten productnamen, prijzen en zinnen van de site, en die horen niet in de repo. Dit zijn de belangrijkste geïndexeerde pagina's:

- Homepage: `https://lashthing.nl/en`
- Collecties: `/en/collections`, `/collections/alle-producten`, `/en/collections/all-lashes`, `/en/collections/best-sellers`, `/en/collections/natural-lashes`, `/en/collections/extra-lashes`, `/en/collections/complete-lashes`, `/collections/lash-strips`, `/collections/single-lashes`, `/en/collections/gift-kits`, `/en/collections/tool-kit`
- Productpagina's: een starterkit, twee losse stijlen, een complete set, de toolkit, de lijm, een verzorgingsproduct en het verrassingsproduct (onder `/products/` en `/en/products/`)
- Overig: `/search`, `/en/pages/our-story`, `/pages/algemene-voorwaarden`, `/policies/contact-information`, `/policies/legal-notice`, `/blogs/lash-tips/*`
- Derden: de Trustpilot-pagina van het domein, een influencer-overzicht en één YouTube-uitlegvideo (alleen de titel)

## 4. Synthese: wat Sparkela overneemt

**Uitgangspunt:** CORVANE levert het kader, Lashthing de conversieblokken, de brief bepaalt de inhoud. Waar Lashthing "onbekend" is, volgen we §6 van de brief.

### 4.1 Homepage, blok 1 tot en met 16

| # | Sparkela-blok (§6) | Kader | Conversieblok van Lashthing | Opmerking |
| --- | --- | --- | --- | --- |
| 1 | Aankondigingsbalk | CORVANE `PromoBar`: actie met echte timer en pauzeknop, anders roterende USP (mobiel) of drie USP's in een rij (desktop). 48 / 40 px. | Gebruikt de balk voor verzendgrens, cadeau bij bestelling, levertijd en codes (hoog). | Op `--donker`. De lanceringsactie (cadeautje 27 tot en met 30 november) past hier als actieve actie uit `content/offers.ts`. |
| 2 | Header | CORVANE op mobiel: grid van 3 kolommen, 64 px, sticky, cartteller met vaste ruimte. | Dropdown met groepen en een korte uitleg per link (hoog). | Afwijkingen van CORVANE die de brief vraagt: logo links op desktop, 8 nav-items, dropdowns voor Shop per moment en Cadeaus, zoeken, "Tas (2)", compacter bij scrollen. CORVANE krimpt niet en heeft geen dropdowns: dat bouwen we nieuw. |
| 3 | Hero | CORVANE `Hero`: tekst eerst op mobiel, H1 en knoppen boven de vouw, 12 kolommen op desktop, media rechts. | Garantiebadge en USP's in de hero (hoog). Knoppen en layout onbekend; de twee knoppen komen uit de brief (§6). | Het eigen klantaantal nemen we niet over (§2.3). Een ratingregel alleen bij echte reviews, net als CORVANE. Mobiel 4:5, desktop 16:9 (§5). |
| 4 | Leverbalk | CORVANE `DeliveryBar`: 3 regels mobiel, één rij van 64 px desktop, live region, servertekst die altijd klopt. | Volgende-dag-belofte in de balk (middel). | Alleen NL; de landschakelaar vervalt (België uit in config). Cut-off 16.00, feestdagen uit `content/shipping.ts`. |
| 5 | Productgrid | CORVANE `ProductGridSection`: kop met sortering, 2 / 3 / 4 kolommen, volle rijen, knop naar alles. | Bestsellerrij of -carrousel (hoog). | Tabs per type zijn nieuw. Het chippatroon van de collectie (`aria-pressed`) of echte tabs (Radix) kan de basis zijn: kiezen in PLAN. |
| 6 | Pill en popup | CORVANE `components/email/*`: trigger na 8 s of exit-intent, 1× per 7 dagen, nooit na aanmelding, pill linksonder, verborgen naast de koopbalk. | Procent op de eerste bestelling, code per mail, succesmelding (hoog); een weigerknop (middel). | "Kies je spark" met `WELKOM10` en de toestemmingstekst van §2.8. Zie punt 1 van §4.9 over wat er na 8 s verschijnt. |
| 7 | Drop-banner | CORVANE-sectieritme, `Button` op een roest vlak, eerlijke aftelling uit `lib/campaign.ts`. | Een "weer op voorraad"-banner op de homepage (middel). | Nieuw blok. De timer volgt §2.4: vaste datum, daarna "Nu live". |
| 8 | Zo stack je | CORVANE `HowItWorks`: gecentreerde kop, `<ol>`, 3 stappen, rij op mobiel, kolommen vanaf `md`. | Genummerde stappen staan bij Lashthing op de productpagina (hoog). | De inhoud komt uit de brief. |
| 9 | Lindes favorieten | CORVANE `ScrollRow` (scroll-snap, alleen focusbaar bij overloop) met `ProductCard`. | Bestsellerrij of -carrousel op de home (hoog). | Handmatige flag. Wordt "Bestsellers" pas bij echte verkoopdata. |
| 10 | Statement of subtiel? | CORVANE-plek en vlak van de vergelijking (sand). | Onbekend. | Twee fotokolommen, geen tabel. Geen claims. |
| 11 | Shop per moment | CORVANE-grid en `PhotoSlot`. | Onbekend. | Nieuw blok: tegels met foto en naam. Op mobiel eventueel als `ScrollRow`. |
| 12 | Spark Finder | CORVANE `FinderQuiz`: donkere sectie, kop links en paneel rechts, fieldset met radio's, voortgangsbalk, focusbeheer. | Noemt vooraf het aantal vragen en de duur (hoog); resultaat met aanbeveling en opnieuw doen (middel); 10% voor e-mail met een optie om over te slaan (middel tot hoog). | E-mailstap ná het resultaat; het resultaat is nooit afgeschermd. Zie §4.7. |
| 13 | Reviews en video | CORVANE `VideoRow` (9:16, kaarten van 62% met scroll-snap). | Reviews met label geverifieerd en een slideshow van klantfoto's, op de productpagina (middel tot hoog). Voornaam en een carrousel op de home: onbekend; die komen uit de brief (§6). | De brief wil de reviewcarrousel **verborgen** zolang er geen echte reviews zijn. CORVANE toont dan een korte lege staat. Sparkela volgt de brief; de videorij blijft staan. |
| 14 | Fotostrook | CORVANE-grid of `ScrollRow` met `PhotoSlot` 1:1. | Onbekend op de home; klantfoto's wel op de productpagina (middel). | Nieuw blok. Alleen eigen foto's of klantfoto's met toestemming, elk met een productlink. |
| 15 | Garantie, FAQ, Over Linde | CORVANE `GuaranteeBlock`, `FaqSection`, `StoryTeaser`. | Garantiebadge prominent; FAQ-accordion op home en productpagina (hoog). | Garantie: 6 maanden op verkleuring. FAQ met de vragen uit de brief. Teaser "Over Linde" met placeholder. |
| 16 | Footer | CORVANE `Footer`: nieuwsbrief bovenaan, linkkolommen, betaalbadges, socials, bedrijfsgegevens, groot woordmerk. | Beleidslinks en socials (middel). | Kolommen Shop / Klantenservice / Sparkela / Juridisch, Pinterest erbij, btw-tekst per datum, "Hier de overeenkomst herroepen". Een reviewblok erboven pas bij echte reviews. |

### 4.2 Volgorde lager op de homepage

**Besluit: de volgorde van §6 blijft staan.**

- CORVANE heeft dezelfde volgorde als het gedeelde deel van §6: uitleg → vergelijking → quiz → reviews en video → garantie → FAQ → verhaal → footer. Dat ondersteunt §6.
- Van Lashthing is de volgorde onbekend. De fragmenten tonen alleen welke blokken er zijn. Het enige signaal is dat de quiz in de buurt van een "weer op voorraad"-banner zou staan (middel). Waar op de pagina dat is, is onbekend. Dat is geen sterk bewijs.
- De blokken die Sparkela toevoegt (drop-banner, favorieten, shop per moment, fotostrook) komen in geen van beide referenties op een vaste plek voor. Er is dus geen bewijs voor een andere plek.

Zodra lashthing.nl bereikbaar is, kijken we opnieuw (zie §6). Alleen bij een duidelijk betere volgorde passen we het aan, en dan noteren we dat in `docs/DECISIONS.md`.

### 4.3 Productkaart

- **Kader van CORVANE:**
  - `article` met container query;
  - media 4:5 met radius 16, badge rechtsboven, een overlay rechtsonder (wordt de vibe-chip);
  - naam, een regel eronder (wordt de specregel "Verguld staal · 20 mm"), prijsrij;
  - de toevoegknop vol breed onder 14.5rem kaartbreedte;
  - een uitgerekte link, tikvlakken van 44 px, en een "toegevoegd"-staat die de drawer opent.
- **Van Lashthing:**
  - een stijltag op de kaart (wordt de vibe-chip);
  - een knop om opties te kiezen bij meerdere varianten;
  - uitverkocht blijft zichtbaar met een label (hoog).
- **Afwijkingen die de brief vraagt:**
  - een witte kaart (`--kaart`) met een dunne rand in `--rand`; CORVANE heeft een sand-vlak zonder rand;
  - een tweede foto bij hover op desktop; niet in CORVANE, bij Lashthing onbekend (zie §3.4, vraag 8);
  - quick-add in roest: bij één variant direct toevoegen, anders een kleine keuzelijst. Een keuzelijst op de kaart zelf is nieuw: de cadeaukaart van CORVANE linkt naar de productpagina. Het dichtstbijzijnde voorbeeld is de native select van 32 px hoog (`h-8`) in de upsellkaart "+1 stick" (`CartUpsell.tsx`), of de bedragtegels in `SimpleConfigurator`;
  - prijs met van-prijs en laagste prijs van 30 dagen, alleen als de van-prijs echt gold;
  - sterren alleen bij echte reviews.

### 4.4 Productpagina

- **Kader van CORVANE:**
  - kruimelpad;
  - grid 1 kolom → 2 gelijke kolommen → 11fr / 9fr met gap 56 en 80 px;
  - sticky kolommen op top 88 px;
  - galerij als swipebaan met punten op mobiel, thumbnails links vanaf `lg`;
  - de koopkolom (variant → keuzetegels → grote knop → leverschatting → trustrijen → chips en meter → accordions);
  - cross-sell, reviews en FAQ over de volle breedte;
  - de sticky koopbalk onder `lg`.
- **Van Lashthing:**
  - een vuistregel bij twijfel over de maat: wordt de ringmaatgids in een modal (`Modal`);
  - kitinhoud als lijst: wordt de inhoud van een stack;
  - "vaak samen gekocht": wordt "Maak de look af" en de stack-kiezer;
  - verzenden en retour als lijst met vinkjes: wordt de accordion Verzenden en retourneren;
  - genummerde stappen: wordt Verzorging;
  - een product-FAQ en reviews met foto (alleen echte).
  - We nemen niet over: de hint "meest gekozen maat", wisselende referentieprijzen, een retourtermijn die per pagina verschilt, en een quiz ingebed op de productpagina (de brief vraagt dat niet).
- **Afwijkingen die de brief vraagt:**
  - zoom en vijf soorten foto's;
  - chips voor type, vibe en moment;
  - specificaties;
  - de Statement-meter in plaats van twee meters, gemarkeerd als indicatief;
  - swatches goud/zilver of knoppen voor ringmaat;
  - de tegels "Los" en "Stack van 3 (−15%)" in plaats van aantal en koopvorm (geen abonnement), met mix & match als kader voor de keuze van de twee andere stukken;
  - een vinkje voor cadeauverpakking;
  - de btw-tekst bij de prijs;
  - de hygiëneregel en GPSR in de accordions;
  - 2 tot 4 producten in "Maak de look af".

### 4.5 Collectie

- **Kader van CORVANE:**
  - kopblok, haarlijn, filterrij met chips (`aria-pressed`), een aantal in een live region, sortering, haarlijn, grid;
  - filter en sortering in de URL zonder nieuwe pagina te laden;
  - brede kaarten om rijen vol te maken;
  - na filteren een linkkaart: wordt een Spark Finder- of stylingtegel.
- **Van Lashthing:** een introregel die de categorie uitlegt (hoog), en uitverkochte producten die met een label in het grid blijven (hoog). De herladende Shopify-filter nemen we niet over; die van CORVANE werkt prettiger. De banner met het klantaantal ook niet.
- **Afwijkingen die de brief vraagt:** een banner met titel en korte tekst, filters op vier dimensies (type, vibe, moment, prijs) in plaats van één chiprij, en de sorteringen uitgelicht, prijs en nieuwste.

### 4.6 Cart drawer

- **Kader van CORVANE:**
  - van rechts, vol breed op mobiel, 432 px vanaf `md`;
  - kopregel van 64 px;
  - twee voortgangsdoelen;
  - regels met stepper en "verwijderen";
  - upsell: één kaart als rij over de volle breedte, twee of drie als horizontale scroll-snap-rij van tegels;
  - betaalbadges;
  - een sticky voet met totalen en een knop van 48 px;
  - een lege staat met knop en link;
  - focus-trap, Esc, focus terug, en na verwijderen focus naar de volgende regel.
- **Van Lashthing:** de melding hoeveel er nog nodig is voor gratis verzending (hoog). Dat is de "melding van Lashthing" uit §6.
- **Afwijkingen die de brief vraagt:**
  - het tweede doel wordt de stack-korting ("nog 1 armband of oorbel");
  - een vinkje voor cadeauverpakking (in december gratis) en een notitieveld voor een cadeauboodschap;
  - de totale besparing en de btw-regel bestaan al ("You save", "Taxes included."); ze krijgen Sparkela-copy en de btw-tekst per datum;
  - "Afrekenen" in roest naar `cart.checkoutUrl`;
  - "Maak de look af" als scrollrij, zoals de upsell van CORVANE;
  - cadeaukaarten tellen niet mee voor de drempels.

### 4.7 Spark Finder

- **Kader van CORVANE:**
  - de donkere sectie met kop en paneel;
  - één vraag per scherm in een `fieldset` met native radio's;
  - "vraag X van 3" en een voortgangsbalk in drie segmenten;
  - focus naar de kop bij elke stap, een statusregio, een melding zonder uitgeschakelde knoppen;
  - terug houdt de antwoorden vast.
- **Van Lashthing:** vooraf het aantal vragen en de duur noemen, een resultaat met uitleg en "opnieuw", 10% voor een e-mailadres, en de keuze om zonder e-mail door te gaan.
- **Afwijkingen die de brief vraagt:**
  - een eigen pagina `/spark-finder` naast het homeblok;
  - 3 tot 6 producten als resultaat (aangevuld met Lindes favorieten), in plaats van één;
  - de e-mailstap na het resultaat, met de toestemmingstekst;
  - de antwoorden als tags naar Shopify.

### 4.8 Overige pagina's

- **CORVANE heeft al:** over ons, FAQ, verzenden en retourneren, contact, account, cookiebeleid, privacy, voorwaarden, wettelijke kennisgeving, een demo-checkout, 404, `sitemap.ts`, `robots.ts` en OG-afbeeldingen. Die opbouw (`SectionHeading`, `Container`, `components/legal/*` met juridische teksten uit `content/`) is de basis.
- **Cadeaukaarten heeft CORVANE ook al:** bedragtegels met digitale levering in `SimpleConfigurator`, `TrustRow` zonder verzending (`digital`), accordions voor de cadeaukaart, een cart met alleen cadeaukaarten (geen verzending nodig in `ShippingProgress` en `CartSummary`) en een quick-add die naar de bedragkeuze linkt. De regel van de brief dat cadeaukaarten niet meetellen voor de drempels zit er al in: `lib/pricing.ts` rekent gratis verzending alleen over verzendbare artikelen, en de bundelprijzen alleen over sticks.
- **Van Lashthing:**
  - een oprichtersverhaal in de ik-vorm met een kort missieblok. Dat past bij "Hoi, ik ben Linde", met placeholder;
  - een blog met uitleg die naar producten stuurt. Dat is de Spark Guide, na de lancering;
  - een wettelijke kennisgeving met bedrijfsgegevens.
- **Nieuw voor Sparkela:** Herroepen (formulier; kader `ContactForm`), Stacks, Sparkela Club, `/drops/[slug]` en Zoeken.
- **Prelaunch (in geen van beide referenties):** een wachtlijstpagina tot `launchAt` met logo, een korte belofte, een foto van Linde en de aanmelding voor de Sparkela Club. Kader uit CORVANE: het nieuwsbriefblok van de `Footer` met `NewsletterForm` (aanmelding met toestemmingstekst), `PhotoSlot` (foto van Linde) en het woordmerk (wordt `<Logo>`). Eisen uit de brief: een controle op `launchAt` aan de serverkant (de shop flitst nooit even in beeld), een whitelist voor de juridische pagina's en de early access van `/drops/[slug]`, en een preview-link met `PRELAUNCH_BYPASS_TOKEN`.

### 4.9 Punten om in PLAN te beslissen

1. **Wat verschijnt er na 8 seconden?** CORVANE opent na 8 s (of bij exit-intent) de modal. De pill komt los daarvan na 240 px scrollen. De brief zegt dat de **pill** na 8 s of bij exit-intent verschijnt en de modal opent. Voorstel: volg de brief letterlijk. De pill verschijnt na 8 s of bij exit-intent, de modal opent alleen na een klik. Hergebruik daarvoor de triggerlogica van CORVANE (cooldown, niet tijdens typen of naast drawers). Dat is minder opdringerig op mobiel.
2. **Vanaf welke breedte de volledige desktop-nav?** CORVANE past 5 links op `lg` met 13 px en 12 px tussenruimte. Sparkela heeft 8 items en 2 dropdowns, plus het logo links. Waarschijnlijk is `xl` (1280) nodig voor de volle nav en blijft de hamburger daaronder. Meten tijdens de bouw.
3. **Tabs op de home:** echte tabs (Radix) of chips met `aria-pressed`, zoals de collectie.
4. **Filters op mobiel:** vier dimensies passen niet in één chiprij. Bijvoorbeeld een `Sheet` met filters. Let op de hoogte: bij CORVANE begint de eerste kaartrij al op 636 px (mobiel) en 555 px (desktop), zonder banner en met één chiprij (§2.9). Een banner plus filters mag dat op mobiel niet nog verder omlaag duwen.
5. **Uitverkochte producten:** in het grid laten met een label (Lashthing) of achteraan zetten.
6. **Verzendregel in de cart met de Shopify-provider:** Lashthing toont "berekend bij afrekenen", CORVANE een bedrag. Met de Shopify-provider komen alle bedragen uit de Shopify-cart (§7). PLAN beslist hoe de verzendregel er dan uitziet.
7. **Volgorde in de koopkolom:** de brief noemt specificaties en de Statement-meter vóór de variantkiezer. CORVANE zet noten en meters ná de knop en de trustrij, zodat de koopknop hoog blijft. Voorstel: de volgorde van CORVANE. Dus titel, prijs met btw, badge, stylingtekst en chips, dan variant, stack, cadeauverpakking en de knop. Daarna leverschatting en trustrij, daarna specificaties en de Statement-meter, daarna de accordions.

## 5. Portlijst: wat we uit CORVANE hergebruiken

Paden zijn relatief aan de app-map van CORVANE (repo `TrissieWissie2024/Corvane`, map `corvane/`, branch `claude/new-session-d68ewq`, commit `93d1c5b`). In fase 1 is niets naar de Sparkela-repo gekopieerd. Hergebruik gebeurt in de bouwfases.

**Bij elk bestand:**

- **Tokens:** de kleurrollen van CORVANE worden die van Sparkela.

  | CORVANE | Sparkela |
  | --- | --- |
  | `fog` | `--pagina` |
  | `sand` | `--vlak` |
  | `deep` | `--donker` |
  | `signal` | `--primair` |
  | `kelp` | `--olijf` |
  | `ink-soft` | `--tekst-2` |
  | `mist` | `--tekst-2-op-donker` |
  | `line` | `--rand` |

- **Copy:** alle tekst gaat naar de Nederlandse `content/*.ts`.
- **Focus:** een ring van 2 px in `--focus` met 2 px afstand, bot-wit op `--donker` (CORVANE: inkt, 3 px afstand).
- **Koppen:** Unbounded 800 / 700 in de maten van de brief (H1 32/48, H2 24/32, H3 18/22). De serif van CORVANE op 44 tot 78 px zou in het brede Unbounded veel te groot worden.

### 5.1 UI-primitives (`components/ui/`)

| Bestand | Waarom | Wat verandert |
| --- | --- | --- |
| `Sheet.tsx` | Drawer achter cart en menu: Radix Dialog, focus terug, korte schermen, slots voor kop en voet. | Focusring, keyframes zonder `corvane-`-prefix, Nederlands sluitlabel. |
| `Modal.tsx` | Voor "Kies je spark" en de ringmaatgids. Bovenaan verankerd, dus geen sprongen. | Tokens, Unbounded-titels op de kleinere maten. |
| `Accordion.tsx`, `MotionStyles.tsx` | Accordions op PDP en FAQ, duurtijden en reduced motion. | Tokens en namen van keyframes. |
| `Button.tsx` | Varianten, maten, tikvlak van 44 px, ankers binnen de pagina. | Primair wordt roest met bot-wit tekst, hover `--primair-hover` (CORVANE: inkt op oranje). Op een roest vlak is de knop bot-wit met roest tekst. |
| `Pill.tsx`, `Badge.tsx` | USP-pills en statuslabels. | Tonen volgens de brief: "Nieuw" leisteen op `--info-vlak`, "Limited" bot-wit op roest, "Laatste stuks" roest op `--fout-vlak`. Tracking 0.06em. |
| `Container.tsx`, `SectionHeading.tsx` | Het kader van 1240 / 20 / 32 px en het eyebrowpatroon. | Kopmaten verkleinen naar de brief. |
| `Price.tsx` | Toont al alleen een doorgestreepte prijs bij een echte eerdere prijs. | Ook de laagste prijs van 30 dagen tonen. Nederlandse notatie (€14,95). |
| `ScrollRow.tsx`, `Flag.tsx`, `Stars.tsx`, `VisuallyHidden.tsx` | Rijen, vlag, lege sterren, verborgen tekst. | Zo overnemen. `Stars` blijft leeg zonder reviews. |

### 5.2 Layout (`components/layout/`)

| Bestand | Waarom | Wat verandert |
| --- | --- | --- |
| `Header.tsx`, `header/CartButton.tsx`, `header/nav.ts` | Sticky header van 64 px, cartteller met vaste ruimte. | Zoeken en het label "Tas (2)" erbij, een compacte staat bij scrollen (nieuw), logo links op desktop. |
| `header/DesktopNav.tsx` | Basis voor de nav en de underline-animatie. | Nieuwe dropdownpanelen voor "Shop per moment" en "Cadeaus". |
| `MobileNav.tsx`, `MobileNavSheet.tsx` | Lui laden en focusbeheer. | Uitklapbare subgroepen voor de 8 items. De uitgelichte kaart wordt een drop of stack. |
| `PromoBar.tsx`, `promo/*` (`UspBar`, `CampaignMessage`, `PromoMotion`, `useMediaQuery`, `format.ts`) | Wissel tussen actie en USP, eerlijke countdown, WCAG-pauzeknop. | Leest drops en offers van Sparkela, staat op `--donker`, springt op "Nu live". |
| `Footer.tsx`, `footer/CookieSettingsButton.tsx`, `NewsletterForm.tsx`, `PaymentIcons.tsx`, `SkipLink.tsx`, `RouteFocus.tsx`, `InstantReveal.tsx` | Opbouw van de footer en de a11y-hulpen. | Kolommen Shop / Klantenservice / Sparkela / Juridisch, de exacte toestemmingstekst van §2.8, de link "Hier de overeenkomst herroepen", de btw-tekst per datum, Pinterest. Betaaliconen uit config. |

### 5.3 Cart (`components/cart/`)

| Bestand | Waarom | Wat verandert |
| --- | --- | --- |
| `CartDrawer.tsx`, `CartDrawerLoader.tsx`, `CartLine.tsx`, `QuantityStepper.tsx`, `CartSummary.tsx` | Ligt dicht bij de drawer uit de brief. `CartDrawer` zet na verwijderen de focus op de volgende regel (`handleRemove`). `CartSummary` toont al de totale besparing ("You save", met uitsplitsing) en een btw-regel. | Besparing en btw-regel krijgen Sparkela-copy en de btw-tekst per datum. "Afrekenen" naar `cart.checkoutUrl`. Met de Shopify-provider komen de totalen uit de Shopify-cart. |
| `ShippingProgress.tsx` | Twee doelen, balk en segmenten, ingeklapt bij bereikt. | Het tweede doel wordt "nog 1 armband of oorbel voor 15% stack-korting". |
| `CartUpsell.tsx` | Upsellkaarten: één als rij over de volle breedte, twee of drie als horizontale scroll-snap-rij van tegels (de derde loopt zijwaarts door). | Wordt "Maak de look af", gepland als scrollrij. |
| `CartProvider.tsx` | Cartstatus en een live region voor meldingen. | Praat met `lib/commerce` in plaats van de bundelprijzen van CORVANE. Cadeauverpakking (vinkje) en een notitieveld erbij. |

### 5.4 Home (`components/home/`)

| Bestand | Wordt |
| --- | --- |
| `Hero.tsx` | Bot-wit op `--donker`, drie pills, garantiebadge, twee shopknoppen, een aparte uitsnede voor mobiel. |
| `DeliveryBar.tsx` | Alleen NL, cut-off 16.00, feestdagen. |
| `ProductGridSection.tsx` | 8 producten met tabs per type. |
| `HowItWorks.tsx` | "Zo stack je". `StepRender.tsx` vervalt (CORVANE-renders). |
| `SolidVsSpray.tsx` | "Statement of subtiel?" als twee fotokolommen, geen tabel. |
| `ReviewsSection.tsx` (met test) | Een carrousel met voornaam en foto, verborgen zonder echte reviews. |
| `VideoRow.tsx` | 9:16-plekken voor eigen TikTok- en Reels-content. |
| `GuaranteeBlock.tsx` | 6 maanden garantie op verkleuring. |
| `FaqSection.tsx` | Zo overnemen, met de vragen uit de brief. |
| `StoryTeaser.tsx` | "Over Linde". |

### 5.5 Product en collectie

- `components/product/ProductCard.tsx`, `QuickAdd.tsx`, `ProductGrid.tsx`, `gridClasses.ts`, `SortSelect.tsx`, `SortableProductGrid.tsx`, `CollectionView.tsx`:
  - de kaart wordt wit met rand, krijgt een tweede foto bij hover, een vibe-chip en een specregel;
  - quick-add krijgt een kleine variantkiezer (nieuw, zie §4.3);
  - de filters worden type, vibe, moment en prijs.
- `components/pdp/*`:
  - `ProductGallery`: zoom en de vijf soorten foto's erbij;
  - `BundlePicker` en `MixAndMatch`: worden "Los / Stack van 3 (−15%)";
  - `IntensityMeters`: wordt de Statement-meter;
  - `ScentSwatches`: wordt goud/zilver-swatches en ringmaatknoppen;
  - `NotesChips`: wordt chips voor type, vibe en moment;
  - `StickyAddToCart`, `DeliveryEstimate`, `TrustRow` (iDEAL | Wero, 14 dagen bedenktijd), `ProductAccordions` (GPSR en de hygiëneregel erbij), `CrossSell` ("Maak de look af"), `PdpStateProvider`, `ProductInfo`, `ProductConfigurator`, `SimpleConfigurator`: overnemen en aanpassen;
  - `PurchaseTypePicker` vervalt: Sparkela heeft geen abonnementen.

### 5.6 Finder, popup en consent

- `components/finder/*` (`FinderQuiz`, `ScentFinder`, `finderState`, `tones`): drie Spark Finder-vragen, resultaten op tags, een e-mailstap na het resultaat, een voortgangsbalk.
- `components/email/*` (`EmailCapture`, `EmailCaptureLoader`, `RewardCards`, `EmailCaptureForm`, `RewardCode`, `state` met test): wordt "Kies je spark" met drie vonkkaarten en `WELKOM10`. Cooldown en body-flaglogica blijven.
- `components/consent/*` (`ConsentBanner`, `AnalyticsLoader`): alleen als `analytics.enabled` aan staat.

### 5.7 Lib, content, tests en config

| Bestand | Waarom | Wat verandert |
| --- | --- | --- |
| `lib/hooks/useAfterLoad.ts`, `lib/hooks/useNow.ts`, `lib/storage.ts`, `lib/cn.ts` | Lui laden, klok, storage in try/catch, classnames. | Zo overnemen. |
| `lib/campaign.ts` (57 regels) | Pure, eerlijke countdown naar een vaste `endsAt`. | Basis voor drops en acties in `lib/dates.ts`, inclusief early access en "Nu live". |
| `lib/delivery.ts` | Verzenddag en bezorgdag, puur en getest. | Basis voor `lib/dates.ts`: 16.00 Europe/Amsterdam, Nederlandse feestdagen, btw-wissel op 1 januari 2027, prelaunch. |
| `lib/money.ts` | Geldopmaak. | Nederlandse notatie. |
| `lib/pricing.ts` | Alleen als voorbeeld van een pure, geteste prijsmodule. | De regels zijn anders: stack-korting 15%, welkomstcode, cadeauverpakking, verzendkosten. |
| `lib/analytics.ts`, `lib/seo.ts` (met tests) | dataLayer-events, metadata en JSON-LD. | Nederlandse metadata, BreadcrumbList, merk Sparkela, geen `aggregateRating` zonder echte reviews. |
| `lib/commerce/*` | Het providerpatroon en de keuze via `COMMERCE_PROVIDER`. | De interface van CORVANE is smal (`getProducts`, `getProduct`, `createCheckout`) en `shopify.ts` is een getypte stub. Sparkela heeft de volledige interface van §7 nodig en een echte implementatie op de Storefront API en de Cart API. |
| `lib/claims.ts`, `content/claims.ts` | Poort voor geverifieerde claims: `getVerifiedClaim` en `getVerifiedClaims` geven niets terug zonder `verified: true`, en `faqAnswer()` wisselt een FAQ-antwoord alleen bij een geverifieerde claim. Dat is §2.6 en de `content/claims.ts` van §7. | Wordt de bron voor nikkelvrij, waterproof, hypoallergeen en dergelijke per product (naast het metafield `nikkelvrij`), met de antwoordwissel voor "Zijn de sieraden nikkelvrij?". Basis voor `docs/COMPLIANCE.md`. |
| `lib/reviews.ts`, `content/reviews.ts` | `getRatingSummary()` is `null` zonder reviews, dus `Stars`, `Hero` en `ProductCard` tonen dan niets (§2.3). | Zo overnemen: reviews en ratings blijven leeg tot er echte data is. Basis voor `docs/COMPLIANCE.md`. |
| `lib/guards.test.ts` | Lanceringsbewakers die de build laten falen als content verandert zonder bewijs: een geverifieerde claim, een review of rating, of een welkomstcode die niet echt bestaat. | Bewakers voor §2.3, §2.6 en §2.8. Een geverifieerde claim moet bij Sparkela wel kunnen (bijvoorbeeld nikkelvrij uit het metafield); PLAN beslist hoe die bewaker dan werkt, bijvoorbeeld "alleen met bron". Basis voor `docs/COMPLIANCE.md`. |
| `content/content-guard.test.ts` | Loopt alle content na op verboden copy (hypewoorden, merknamen) en bevat al lanceringsbewakers. Claims mogen alleen in `content/claims.ts` staan. | Woordenlijsten van Sparkela: claimwoorden buiten `content/claims.ts`, sieradenmerken (§2.9) en een controle op Lashthing-tekst. Basis voor `docs/COMPLIANCE.md`. |
| `app/api/subscribe/route.ts`, `app/api/contact/route.ts` | Validatie en een vaste antwoordvorm. | Aanmelden gaat via de Admin API van Shopify (klant met marketingtoestemming en tags). Contact en herroepen via een maildienst. Honeypot en rate limit erbij. |
| `app/checkout/page.tsx`, `components/checkout/*` | Demo-checkout voor de lokale provider, met al een kortingscodeveld (`applyDiscountCode`) en een demomelding. `CheckoutView` gebruikt `ContactForm` (zie hieronder). | Zelfde opbouw in het Nederlands; de demomelding wordt "Demo-checkout: er wordt niet betaald". |
| `components/catalog/CatalogProvider.tsx` | `useCatalog` levert de productdata aan zeven overgenomen bestanden: `CartDrawer`, `CartLine`, `CartProvider`, `CartSummary`, `CartUpsell`, `FinderQuiz` en `MobileNavSheet`. | Overnemen of vervangen door een provider op `lib/commerce`. Zonder deze provider werken de overgenomen cart- en finderbestanden niet. |
| `components/contact/ContactForm.tsx`, `app/contact/page.tsx` | Velden (`FormField`), validatie (`isValidEmail`), `DemoNotice` en een vaste antwoordvorm. | Kader voor Contact en het herroepformulier (naam, bestelnummer, e-mail, optioneel producten, één knop "Herroeping bevestigen"). |
| `components/legal/*` (`LegalPage`, `InlineText`, `LegalNotice`, `UpcomingHolidays`) | Rendert elke juridische pagina van CORVANE. `LegalNotice` zet "TODO: laten controleren" bovenaan. `UpcomingHolidays` toont de verzendfeestdagen. | Teksten uit `content/legal/` (Markdown volgens §7; CORVANE gebruikt `content/legal.ts`). |
| `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`, `app/products/[slug]/opengraph-image.tsx`, `app/not-found.tsx` | SEO-basis en 404. | Sparkela-routes (`/products/[handle]`, `/collections/[handle]`) en Nederlandse teksten. |
| `components/media/PhotoSlot.tsx`, `VideoSlot.tsx` | Nette placeholders. | Label "FOTO: …" in Inter 12 px op `--vlak`. De renders van CORVANE (`StickRender` en dergelijke) vervallen. |
| `tests/e2e/*` (`a11y`, `add-to-cart`, `campaign`, `cart-subtotals`, `email-capture`, `popup`, `screenshots`, `seo`, `fixtures`) | Basis voor de smoketests van §7 met axe. | Scenario's van Sparkela. |
| `playwright.config.ts` | Projecten mobile 390×844 en desktop 1440×900, webServer met build en start. | `launchOptions.executablePath` uit `PW_CHROMIUM_PATH` (zie DECISIONS). |
| `vitest.config.mts`, `eslint.config.mjs` | Dezelfde toolchain. | Zo overnemen. |

## 6. Opnieuw doen zodra lashthing.nl bereikbaar is

- [ ] Controleer dat lashthing.nl bereikbaar is. Een `curl -sI https://lashthing.nl` geeft een 200 of een redirect, geen 403 van de proxy. Dat zegt nog niets over de hosts van derden (popup, quiz, reviews, widgets): die blijken pas uit `blockedHosts` na de eerste run.
- [ ] Zorg voor Node 24 (`.nvmrc`) en `npm ci` in `sparkela/`.
- [ ] Draai `npm run capture:reference -- --site=lashthing`. Zonder Playwright-browser: zet `PW_CHROMIUM_PATH`. Eén viewport tegelijk kan met `--only=mobile` of `--only=desktop`.
- [ ] Lees de waarschuwingen in `reference/lashthing/manifest.json`. Stel zo nodig de hints in `SITES.lashthing` bij: paden voor collectie, product en quiz, en selectors voor popup, menu en cart drawer. Deze tak van het script is nog nooit gedraaid.
- [ ] Controleer `blockedHosts` per viewport in `manifest.json`. Staan daar hosts van derden (popup, quiz, reviews, widgets), dan telt een element dat niet gevonden is als "onbekend", niet als "niet aanwezig". Laat die hosts zo mogelijk ook toestaan en draai opnieuw.
- [ ] Staat er een waarschuwing dat de cookiebanner nog zichtbaar is, pas dan de cookiepatronen in het script aan en draai opnieuw. Klik nooit zelf op accepteren.
- [ ] Houd de regels van het script aan: cookiebanner op de meest privacyvriendelijke keuze, popup sluiten met de eigen knop, quiz openen maar niet invullen, nooit een e-mailadres typen, cart in een wegwerpcontext met één product, nooit de checkout openen.
- [ ] Bekijk alle screenshots zelf op beide viewports. Leg ze naast die van CORVANE.
- [ ] Beantwoord de 14 open vragen uit §3.4. Zet de bevestigde punten in §3 op "gezien" en pas §4 aan waar dat nodig is.
- [ ] Noteer de sectievolgorde van de homepage. Toets §4.2 opnieuw, en wijzig de volgorde van §6 alleen bij een duidelijk betere volgorde.
- [ ] Leg de cart drawer met één product vast: mijlpalen, upsell, cadeau-opties, betaaliconen, kortingscodeveld.
- [ ] Noteer bij de popup na hoeveel tijd hij verschijnt (`appearedAfterMs` in `popup.structure.json`) en of er een zwevende teaser is.
- [ ] Neem geen tekst of beeld over. Screenshots blijven in `reference/`. Draai daarna de content-guard, zodat er geen Lashthing-tekst in `content/` staat.
- [ ] Werk de statustabel in §1.1 bij (datum, wat gelukt is) en noteer wijzigingen in `docs/DECISIONS.md`.
