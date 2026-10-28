# QA-notities

Metingen en bevindingen uit golf 10-11 en later. Integrator 10 schreef §1; E3 (visuele QA) en F1 (oplevering) vullen aan (plan §20.2). De besluiten die hieruit volgen staan in `docs/DECISIONS.md` (212 tot en met 215, QA-ronde 1: 216 en 217, QA-ronde 2: 218 tot en met 220, QA-ronde 3: 221 en 222).

## 1. Integrator 10 (27 oktober 2026)

### 1.1 Omgeving en werkwijze

- Container met 4 cores, Node 24.22.1, Next.js 16.4.3 (Turbopack), Chromium 153 (headless, `/opt/pw-browsers/chromium`).
- Alle app-controles op `npm run build:test` en `npm run start:test` (poort 3200, testklok vrijdag 27 november 2026 12.00 uur Amsterdam, lokale provider). Prelaunch-controles met de header `x-sparkela-test-now: 2026-11-20T12:00:00+01:00` (en in Playwright `page.clock` op dezelfde tijd).
- Lighthouse 13.5.0 (`npx lighthouse@13`), mobiel, gesimuleerde throttling, `--only-categories=performance,accessibility,best-practices,seo`, drie runs per pagina na elkaar, mediaan, zonder iets anders actief dan de testserver. De browserklok van Lighthouse is de echte datum (oktober), de serverklok de testklok; de pagina's zijn statisch, dus dat verandert alleen welke `TimeSwitch`-variant het inline script kiest.
- Vergelijkingen tussen builds zijn telkens op dezelfde machine gedaan. De spreiding tussen runs is 1 tot 4 punten; de LCP van Lighthouse springt tussen ongeveer 2,7 en 3,3 s, afhankelijk van of de eerste paint (gemeten rond 110 tot 230 ms) vóór of na de eerste lange scripttaken valt.

### 1.2 Mechanische controles (eindstand)

| Controle | Uitkomst |
| --- | --- |
| `npm run lint` | schoon |
| `npm run typecheck` | schoon |
| `npm test` | 79 bestanden geslaagd, 1 overgeslagen; 1424 tests geslaagd, 4 overgeslagen (was 1417: 7 nieuwe tests in `forms.test.tsx`) |
| `npm run build:test` | groen, geen waarschuwingen |
| `npm run test:e2e` (2 workers, tegen `start:test`) | 340 geslaagd, 22 overgeslagen, 0 mislukt, 5,1 minuut |

De 22 overgeslagen e2e-tests: 14 screenshots (alleen met `SCREENSHOTS=1`), 3 tests voor één viewport (compacte header en sticky koopbalk alleen mobiel, exit-intent alleen desktop) en 5 servertests in `seo.spec.ts` die alleen in het desktopproject draaien.

### 1.3 Buildoutput

- `○` voor elke statische pagina, `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/icon.svg`, `/apple-icon.png` en `/opengraph-image` (revalidate 30 dagen, cache `max`).
- `ƒ` alleen voor de zes `/api/*`-routes en de proxy.
- Per dynamische route één `◐`-shell plus `○`-regels voor de bekende params: 14 collecties, 25 producten, 8 drops, 8 teasers (Next toont er twee en vat de rest samen als `◐ [+N more paths]`, beslissing 208).
- `●` alleen bij de OG-routes: `/products/[handle]/opengraph-image` (25 paden: 24 sieraden en de cadeaukaart, niet de cadeauverpakking) en `/drops/[slug]/opengraph-image` (8 paden), zonder hash in de URL (de bestanden staan buiten de groep `(shop)`, beslissing 213a).

### 1.4 SEO-routes en OG-afbeeldingen

Gecontroleerd met `curl` op de eindbuild, op de testklok en met de prelaunch-header:

| URL | Testklok (27 nov) | Prelaunch (20 nov) |
| --- | --- | --- |
| `/opengraph-image` | 200 `image/png` | 200 `image/png` |
| `/products/lola-chunky-hoops/opengraph-image` | 200 `image/png` | 200 `image/png` |
| `/drops/holiday-sparkle/opengraph-image` | 200 `image/png`, drop-OG | 200 `image/png`, gate `teaser`: het merkbeeld |
| `/products/holiday-ster-oorbellen/opengraph-image` | 200 `image/png`, product-OG | 200 `image/png`, gate `teaser`: byte voor byte het merkbeeld (ook op 26 november zonder early-access-cookie) |
| `/products/cadeauverpakking/opengraph-image`, `/products/zzz/opengraph-image`, `/drops/iets/opengraph-image` | 404 | 404 |
| `/sitemap.xml` | 200 `application/xml`, 52 URL's | idem |
| `/robots.txt` | 200: `Allow: /`, `Disallow: /api/`, `Sitemap: http://localhost:3200/sitemap.xml` | idem |
| `/manifest.webmanifest` | 200 `application/manifest+json`, `display: browser`, `theme_color` #171717, vijf iconen | idem |

- De sitemap: 13 statische pagina's, 14 collecties, `/drops/holiday-sparkle` (live op de testklok) en 24 producten (ook de vier Holiday-stukken, die op 27 november live zijn). Geen noindex-pagina's, geen `/wachtlijst`, geen cadeauverpakking en geen cadeaukaart-PDP (beslissing 213h).
- `og:image` en `twitter:image` op de home en de collectie: `/opengraph-image`; op een PDP `/products/<handle>/opengraph-image` met de productnaam als alt; op de droppagina `/drops/holiday-sparkle/opengraph-image`. Alle vier de beelden zijn bekeken: merkbeeld (kop, subregel, twee promises, vonk op inkt), product (soort, naam, specregel, garantie, roest paneel met vonk zonder foto), drop (Limited, naam, tagline op roest), cadeaukaart (tagline in plaats van de garantie). Geen prijs.
- 404's: de root-404 (`/bestaat-niet`) heeft nu één robots-tag (`noindex`, van Next). De routes met het 404-patroon (`/products/zzz` enzovoort) hebben er nog twee, allebei noindex: die van Next en die van `productMetadata(null)` uit het contract van §18.1. Onschuldig; zo gelaten.
- De e2e-test "Open Graph images pass the proxy" slaat niet meer over en dekt nu merk-, product- en drop-OG op beide tijden.

### 1.5 Fonts in de gebouwde CSS

- Eerste build met de wijzigingen van E1: `--font-unbounded: "Unbounded", "Unbounded Fallback"`, met nog steeds de automatische face "Unbounded Fallback" (gewone Arial, 134,59%). Turbopack negeert `adjustFontFallback: false`; met een lege Turbopack-cache was de uitkomst hetzelfde. Met een handmatige `fallback`-lijst verdwijnt hij (beslissing 212a).
- Eindstand (`next/font/local`, beslissing 212b): `--font-unbounded: "unbounded", Unbounded Fallback Arial, Unbounded Fallback Roboto` en `--font-inter: "inter", Inter Fallback Arial, Inter Fallback Roboto`; drie `@font-face`'s voor de webfonts (Unbounded 700, Unbounded 800, Inter 400 tot 700) en de twaalf afgestemde fallback-faces. Fontbestanden in de pagina: 21 + 22 + 34 kB = 77 kB (was 51 + 48 = 98 kB).
- Breedtes gemeten in de browser (32 px, Unbounded 800, letter-spacing −0,01 em): "Cadeaukaarten" 319,05 px in het nieuwe bestand, 319,11 px in het font van Google; de navlabels in Inter 500 zijn gelijk op de pixel. Fallback tegen webfont: de navlabels samen 524,5 tegen 523,8 px; maar de 0 van de fallback is 14% smaller (0,564 tegen 0,660 em in 600), vandaar beslissing 212c.

### 1.6 Playwright (e2e)

| Run | Build | Uitkomst |
| --- | --- | --- |
| 1 | E1 + fallback-fix | 329 geslaagd, 5 mislukt, 22 overgeslagen (356 tests) |
| 2 | + fixes 212c tot h | 339 geslaagd, 1 mislukt (desktopnav op `/products/sterre-hartketting`, CLS 0,0026) |
| 3 en eind | + 212i en j | 340 geslaagd, 0 mislukt (362 tests) |

De vijf fouten van run 1 en hun oorzaak:

1. `/cadeaukaarten` op 320 px: 19 px horizontale scroll. "Cadeaukaarten" in `kop-1` (32 px) is 319 px breed in een kolom van 280 px. Fix: `kop-1` is `min(2rem, 8.5vw)` (212d).
2. CLS `/nieuwsbrief/bevestigen` op 1440 px: 0,0078, de footer schoof omlaag. De Suspense-fallback (alleen de knop) was 328 px lager dan de staat zonder token. Fix: de fallback heeft beide staten en een inline script kiest vóór de eerste paint (212e). Nu 0 op 390 en 1440 px, met en zonder token.
3. en 4. CLS op `/sparkela-club` en `/over-sparkela` op 1440 px (0,0016 en 0,0026): de desktopnav verschoof 165 px. Met 6× CPU-throttling na te bootsen: Chrome tekende de header terwijl de HTML nog binnenkwam; de rechtergroep had alleen de zoekknop (44 px breed, daarna 159 px), en de nav stond gecentreerd tussen logo en rechtergroep. Fix: header in `1fr auto 1fr` (212i). Daarna kwam nog één keer een halve nav-lijst voor (584 → 768 px); fix: de render-blocking expect-link met `FirstPaintMarker` (212j). Met 6× throttling daarna geen verschuiving meer in 33 laadbeurten op 390 en 1440 px (home, collectie, PDP, Club, Over Sparkela, FAQ, stacks), op één na (zie §1.10).
5. Late fonts op `/collections/oorbellen` (1440 px): CLS 0,0011 in de promobalk, de fotoplaceholders en "Tas (0)": dozen in `ch` (212c).

De late-font-tests van E2 (fonts 1,5 s vertraagd) slagen nu op `/`, twee PDP's, `/collections/oorbellen`, `/sparkela-club` en de 404: dat bevestigt de fallback-faces van E1 in de echte build. Nieuw in de suite: CLS op `/nieuwsbrief/bevestigen?t=voorbeeld`, late fonts op `/sparkela-club`, de tabs van de lanceringscollectie (elke tab alleen eigen stukken, maximaal 8, ook de in de browser gerenderde) en de OG-test zonder skip.

### 1.7 Toegankelijkheid (axe)

- `tests/e2e/a11y.spec.ts` (axe-core, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, na `settleAnimations`) op alle staten van plan §19.2, op 390 × 844 en 1440 × 900: home, `/collections/oorbellen`, `/products/lola-chunky-hoops`, cart met een regel, lege cart, menu open, popup open met een omgedraaide kaart, `/spark-finder`, `/herroepen` en de wachtlijst (prelaunch-header). 20 tests, 0 overtredingen.
- Extra, met dezelfde tags, op 320, 390 en 1440 px (24 controles, 0 overtredingen en 0 px horizontale scroll): `/nieuwsbrief/bevestigen` met en zonder token, `/bestaat-niet`, `/cadeaukaarten`, `/sparkela-club`, `/veelgestelde-vragen`, en de home met de tab Ringen en de tab Armbanden open (kaarten uit de clientcatalogus).
- Lighthouse: toegankelijkheid 100 in elke run.

### 1.8 Lighthouse (mobiel, mediaan van 3 runs)

| Build | `/` | `/collections/alle` | `/products/lola-chunky-hoops` |
| --- | --- | --- | --- |
| Golf 7-9 (vóór golf 10-11) | 82 (82, 82, 83); LCP 3,25 s, TBT 441 ms | 87 (81, 91, 87); LCP 3,32 s, TBT 281 ms | 79 (76, 80, 79); LCP 3,41 s, TBT 495 ms |
| E1 met de fallback-fix | 86 (86, 86, 92); LCP 2,89 s, TBT 261 ms | 89 (89, 89, 92); LCP 2,73 s, TBT 239 ms | 90 (90, 90, 91); LCP 2,88 s, TBT 251 ms |
| Experiment: beide `not-found.tsx` als één regel | 90 (90, 92, 86) | 91 (91, 93, 90) | 88 (93, 87, 88) |
| Experiment: Suspense rond pagina en footer | 85 (83, 85, 89); LCP 3,77 s | 90 (88, 91, 90) | 91 (91, 92, 84) |
| Lokale fonts en tabkaarten (212b, h) | 93 (93, 95, 93) | 96 (96, 95, 96) | 94 (95, 94, 92) |
| Idem zonder `turbopackChunking` (A/B) | 91 (91, 91, 91); 21 scripts | 93 (94, 89, 93); 25 scripts | 93 (93, 93, 92); 25 scripts |
| **Eindstand** | **95** (96, 95, 93); FCP 1,06 s, LCP 2,86 s, TBT 101 ms, SI 1,15 s, CLS 0 | **96** (96, 96, 93); FCP 0,91 s, LCP 2,57 s, TBT 146 ms, SI 0,91 s, CLS 0 | **93** (93, 93, 94); FCP 1,06 s, LCP 2,86 s, TBT 156 ms, SI 1,06 s, CLS 0 |

- Eindstand: toegankelijkheid, best practices en SEO 100 in alle negen runs; elke run minstens 93. Totale bytes 489, 539 en 532 kB; 14 tot 16 scripts.
- Wat het meeste opleverde: de goedkopere footer-Club-regel van E1 (TBT), de kleinere fontset (77 in plaats van 98 kB vóór de eerste paint) en `turbopackChunking` (minder, grotere chunks: 2 tot 3 punten).
- De LCP is in alle drie gevallen tekst (de H1 of de intro), die bij de eerste paint al staat. De gesimuleerde LCP hangt af van alles wat vóór die paint is aangevraagd (HTML, CSS, twee of drie fonts en de async scripts in `<head>`); daar zit nog de meeste ruimte.
- Na echte foto's (hero, packshots) opnieuw meten: dan kan de LCP een afbeelding worden (`docs/ASSETS.md`).

### 1.9 HTML-payload

| Pagina | Golf 7-9 / E1 (ruw, gzip) | Eindstand (ruw, gzip) |
| --- | --- | --- |
| `/` | 517 kB, 54,9 kB | 465 kB, 53,7 kB |
| `/collections/alle` | 393 kB, 36,7 kB | 394 kB, 36,9 kB |
| `/products/lola-chunky-hoops` | 333 kB, 42,6 kB | 333 kB, 42,7 kB |
| `/privacy` | 205 kB, 30,0 kB | 206 kB, 30,3 kB |

- Op de home bestond de RSC-payload voor ongeveer 50 kB uit kaarten van tabs die niet open zijn; die rendert de browser nu zelf (212h).
- De voorstellen van E1 zijn gemeten en afgewogen in beslissing 215: beide not-found-bomen samen zijn 57 tot 62 kB ruw maar 3,1 tot 3,5 kB gzip per pagina (geen meetbaar Lighthouse-effect); de clientcatalogus is 30,9 kB ruw (26 producten; `variants` 9,9 kB, `tags` 5,9 kB), een paar kB na gzip. Op de home zijn de class-attributen 106 kB van de markup; de Button-basisklasse alleen al komt 19 keer voor.

### 1.10 Layout shift: wat er nog kan

- Met 6× CPU-throttling en 390 px verschoof één keer (op 12 laadbeurten) een kaarttitel in `/collections/alle` 209 px: Chrome tekende de grid toen de naam van een kaart al geparsed was en de foto nog niet (de naam staat in de DOM vóór de foto, C4). In de e2e-suite en in Lighthouse niet gezien. Op een trage telefoon kan het bij een eerste bezoek gebeuren; een oplossing vraagt een andere opbouw van de productkaart. Open punt voor E3/F1.
- De H1 "Sterre hartketting" breekt in de fallback op sommige breedtes op één regel en in Unbounded op twee (beslissing 213i); alleen zichtbaar als het font pas na de eerste paint binnenkomt.
- De promobalk is gecentreerd: als Chrome hem half geparsed zou tekenen, schuift het bericht als de countdown erbij komt. Met de expect-link (212j) wordt de balk niet meer half getekend.

### 1.11 Open punten voor E3 en F1

- Visuele punten uit het E2-rapport (beslissing 214): het streepje in "Stack-korting −€2,99" in de drawer, "Bekijk alles" zonder beeldtegel in het megamenu "Shop per moment", een spatie vóór de komma in enkele toegankelijke namen ("Kies je spark , 10%…", "19 , Nog 2") en de logolink die op 390 px 1,7 px over de accountknop valt.
- De desktopnav staat sinds 212i op de pagina gecentreerd (10 px naar links op 1440 px); graag meenemen in de screenshotvergelijking.
- De productkaart bij half geparste HTML (§1.10).
- `docs/COMPLIANCE.md` (F1): de Lighthouse-eindstand uit §1.8 en de axe-resultaten uit §1.7.

### 1.12 Servers

Na elke meting is de testserver gestopt; aan het einde draait er geen `next start` en geen Playwright-server meer.

## 2. QA-ronde 1: fixer (27 oktober 2026)

Zes lenzen (design mobiel, design desktop, toegankelijkheid, performance, copy en compliance, functioneel, volledigheid) leverden 83 bevestigde bevindingen. Alle zijn in deze ronde opgepakt; wat bewust anders of niet is gedaan staat in beslissing 217. Alles is gecontroleerd op `npm run build:test` en `npm run start:test` (testklok 27 november 2026, prelaunch met de header `x-sparkela-test-now` en `page.clock`), met eigen Playwright-scripts op 390 × 844 en 1440 × 900 (ook 360, 320, 1280 × 800 en 1366 × 768 waar de bevinding daarom vroeg). De beslissingen staan in `docs/DECISIONS.md` 216 en 217; plan §11.3, §13, §14, §17.1 en §18 zijn bijgewerkt.

### 2.1 Wat er is opgelost (hoog en middel eerst)

| Bevinding | Oplossing | Controle |
| --- | --- | --- |
| GPSR-term liep in de waarde ("Productidentificatie" over "SPK-001") | Op telefoons term boven waarde; vanaf `sm` een kolom van 9,5rem die mag afbreken; lijst negeert de `pr-10` van het accordeon | 390: geen overlap, scheidingslijnen 20 tot 370 px |
| Focus verdween na quick add met keuze en de drawer sluiten | "In tas" sluit de lijst en zet de focus eerst op "Kies" | Esc na de drawer: focus op "Toegevoegd: Nina chunky ring" (390 en 1440); nieuwe e2e-check |
| Beloning niet vooraf bij de drop-teaser en een afgelopen drop | `subscribe.what` noemt de 10% bij elk aanmeldveld; teaser- en afgelopen-droptekst ook | unit-test op `subscribe.what` |
| Keuzelijst rekte de kaart en de rij op (405 → 595 px) | Overlay in de kaart, groeit omhoog | Ringen: 383 → 383 px (390), 472 → 472 px (1440); e2e vergelijkt alle kaarthoogtes |
| Favorieten afgekapt op de containerrand, pijlen over de foto | Rij tot de schermrand (0 tot 390, 20 px padding), knoppen op telefoons onder de rij | screenshot 390 |
| Pill over het woordmerk onderaan | `--pill-ruimte` als padding onder de footer | pill 782 tot 828, woordmerk eindigt op 765 |
| Popup na het omdraaien te hoog | Belofte in de scrollbody, haarlijn bij scrollen, korte kaarten 4 : 3 | inhoud 643 px in 643 px (390 × 844), 638 in 638 (1280 × 800 en 1366 × 768); "Ik doe mee" en "Nee, bedankt" in beeld |
| Placeholder zoeken afgekapt, geen titel | "Bijvoorbeeld hoops of festival", zichtbare titel "Zoeken", lange zoekterm breekt af | screenshot 390 |
| Focusring na een tik op een tab | Ring alleen na toetsenbord (`data-pointer` op de lijst) | na tap: `:focus-visible` maar `outline-style: none` |
| Knoppen vraag 3 Spark Finder liepen over | Kleinere padding en gap; onder 19rem onder elkaar | rij 308/308, 278/278 en 238/238 px, document 0 px overloop op 390, 360 en 320 |
| Upsell in de drawer niet bereikbaar met een muis | Verticale lijst van compacte rijen; focus naar de volgende rij na toevoegen | 390 en 1440: na "In tas: Lou" focus op "Kies uitvoering: Ivy" |
| Stackfoto een strook van 228 × 700 px | Vanaf `xl` één stack per rij (6 : 5) | screenshot 1440 |
| Pauzeknop van de actiebalk over "Shop nieuw" | Pauzeknop rechts in de balk, tekst 40 px vrij | screenshot 390 |
| Te kleine tikvlakken | Gestrekte links in stack- en upsellrijen, `before:` op drawerregels en het kruimelpad, tab "Alles" 44 px | kruimelpad en H1 beide op x = 20 |
| Retourtermijn op de PDP te krap | "Laat het ons binnen die tijd weten", plus 14 dagen om terug te sturen | copy |
| "Gouden" voor verguld staal | "Goudkleurig" in beschrijvingen, alt-teksten en CSV; specregel "Staal, goud- of zilverkleurig" | content-tests |
| Zoeken vond goud, zilver, holiday, kerst niet | Kleuren, specregel, dropnaam en synoniemen in de zoektekst; paginalinks bij geen resultaat | zilver 4, goud 24, holiday 4, kerst 7, staal 24; unit-test |
| Alleen-cadeaukaart-tas beloofde een pakketje | Geen cadeauboodschap en geen lanceringsregel zonder fysiek product | drawer met €15-kaart |
| Footer domineerde korte pagina's | Geen voordelenlijst, minder padding, woordmerk hooguit 36rem; compacte footer op checkout, zoeken, account en contact | zie §2.2 |
| Wachtlijst zonder foto en scheef ten opzichte van de footer | Buiten productie de placeholder in twee kolommen; zonder foto links in lijn | H1 en eerste footerlink op x = 20 (390) en 132 (1440) |
| Dubbele Radix-code per eiland | Eén eilandenmodule (`components/layout/islands.ts`), zoom, ringmaatgids en filtersheet lazy | zie §2.3 |
| Unbounded 700 vooraf geladen | Eigen familie zonder preload | Link-header: alleen Inter en Unbounded 800 |
| `sizes` van galerij en kaarten te groot | Naar de gemeten breedtes | plan §17.1 |

De lage bevindingen (specregel zonder hangende punt, `tabular` alleen op bedragen, h2-ritme na de feestdagen, logo en H1 per staat op `/nieuwsbrief/bevestigen`, checkoutkop na plaatsen, FAQ-links na de vragen, feestdagen vanaf de lancering, aanhalingstekens, H1 van de Club per zin, kruimelpaden, megamenutegel "Bekijk alles", countdown-pill bij reduced motion, `text-pretty`, drie FAQ-vragen op cadeaukaarten en stacks, de "tas"-woorden, toegankelijke namen in één string, landmarknamen, focus naar `<main>` na navigatie uit een dialoog, ringmaat niet voorgekozen, Esc in de lijst in de drawer, voorraadgrens bij de stepper, kortingscodemeldingen, lokale checkout zonder storage, early access tot de demo-checkout, 404 zonder React-fout voor collecties en drops, de besparing op eigen regel, de vaste breedte van de sorteerselect, de consentcode uit de gedeelde chunk en de copy-polish) staan per punt in beslissing 216.

### 2.2 Footer en kleurverhouding (hoogte footer, aandeel van de pagina)

| Pagina | 390 vóór | 390 na | 1440 vóór | 1440 na |
| --- | --- | --- | --- | --- |
| Footer zelf | 2018 px | 1842 px | 1691 px | 1438 px |
| `/zoeken` | 72% | 30% (compact) | 72% | 26% (compact) |
| `/checkout` | 70% | 31% (compact) | 64% | 21% (compact) |
| `/account` | 65% | 26% (compact) | 67% | 23% (compact) |
| `/products/lola-chunky-hoops` | 30% | 27% | 30% | 27% |
| `/` | 14% | 13% | 14% | 12% |

`/contact` heeft daarna ook de compacte footer gekregen. `/spark-finder` vóór de eerste vraag en de 404 blijven op 390 px rond 55%: daar houdt de footer de volledige navigatie (beslissing 217c).

### 2.3 Performance

- Scripts na idle (eigen meting, alle chunks die laden): `/` 11 scripts, PDP en `/collections/alle` 13 (was 16); per pagina één chunk met de Radix Dialog-code (was vier tot zes kopieën). `ConsentBanner`, `AnalyticsLoader` en `CookieSettingsButton` staan alleen nog als `next/dynamic`-verwijzing in de gedeelde chunk.
- Lighthouse 13 mobiel, 3 runs na elkaar op een rustige machine (load 0,9 tot 1,8): PDP `lola-chunky-hoops` 94, 93, 94 (LCP 2,57 tot 2,92 s, TBT 175 tot 206 ms); home 95, 95, 91; `/collections/alle` 91, 95, 94. Toegankelijkheid, best practices en SEO 100 en CLS 0 in alle negen runs. De laagste PDP-run is 93 (de verifier mat vóór deze fixes 90, 93, 91). De spreiding hoort in `COMPLIANCE.md` (F1), niet alleen de mediaan.

### 2.4 Toegankelijkheid

- axe met `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` en `best-practice` op 390 en 1440: home, `/collections/ringen`, de Nina-PDP, `/stacks`, `/zoeken?q=hoops`, `/nieuwsbrief/bevestigen`, `/checkout`, `/veelgestelde-vragen`, `/contact`, `/verzenden-en-retourneren`, de popup na het omdraaien en de drawer met upsell: geen overtredingen (landmark-unique en label-content-name-mismatch zijn weg). Eén `color-contrast`-melding op de PDP bij 1440 kwam bij herhalen niet terug (een overgang die nog liep).
- 0 px horizontale scroll op alle gemeten routes.

### 2.5 Mechanische controles (eindstand)

| Controle | Uitkomst |
| --- | --- |
| `npm run lint` | schoon |
| `npm run typecheck` | schoon |
| `npm test` | 79 bestanden geslaagd, 1 overgeslagen; 1429 tests geslaagd, 4 overgeslagen |
| `npm run build:test` | groen, geen waarschuwingen; `ƒ` alleen de zes `/api/*`-routes en de proxy |
| `npm run test:e2e` (2 workers, tegen `start:test`) | 346 geslaagd, 22 overgeslagen, 0 mislukt, 5,0 minuut |

Bijgewerkte of nieuwe e2e-checks: de koopknop heet "In je tas" (`mainAddToCart`), de pill zonder spatie voor de komma (`SPARK_PILL_NAME`), de totaalregel "Gratis cadeauverpakking in december", de bevestigingspagina met en zonder token, de naam van het wachtlijstformulier, quick add zonder hoogteverschil en met focus terug op "Kies", een ring zonder voorgekozen maat, en twee drop-PDP's in de late-font-test. Nieuwe unit-tests: zoeken op kleur, specregel, dropnaam en synoniemen, sorteren van de home-tabs over het hele type, de beloning in `subscribe.what`, de wachtlijst met en zonder placeholder, `/checkout` met early access in de proxy, en onbekende slugs naar de root-404.

### 2.6 Servers

Na elke meting is de testserver gestopt; aan het einde draait er geen `next start`, geen Playwright-server en geen Chromium meer.


## 3. QA-ronde 2: fixer (28 oktober 2026)

Zeven lenzen (design mobiel en desktop, toegankelijkheid, performance, copy en compliance, functioneel, volledigheid) leverden 54 bevestigde bevindingen; de specregel kwam vier keer terug (in drie lenzen plus de late-font-meting). Alle zijn opgepakt; wat bewust anders of niet is gedaan staat in beslissing 220. Alles is gecontroleerd op `npm run build:test` en `npm run start:test` (testklok 27 november 2026) met eigen Playwright-scripts op 390 × 844 en 1440 × 900, en waar de bevinding daarom vroeg op 320, 360, 380 tot 400, 430, 768, 1024, 1280 × 800, 1366 × 768 en 1920 × 1080. De beslissingen staan in `docs/DECISIONS.md` 218 tot 220; plan §2, §4.6, §5.6, §7.3, §13, §14.3, §14.5, §14.7, §14.8, §14.10, §14.18, §17.1, §17.2 en §19.2 en `docs/ASSETS.md` §2 en §4 zijn bijgewerkt.

### 3.1 Wat er is opgelost (hoog en middel eerst)

| Bevinding | Oplossing | Controle |
| --- | --- | --- |
| Specregel knipte de tweede regel van een afgebroken deel af ("goud- of / verkleurig", "euraccent", "helpje", "rguld staal") | Hangende inspringing per deel (de punt `indent-0`); onder 12rem staat elk deel op een eigen regel | per teken gemeten op `/`, `/collections/alle`, `/collections/kettingen`, `/zoeken?q=staal` en de 404 op 320, 360, 390, 430, 768, 1024, 1280 en 1440: 0 afgeknipte tekens; nieuwe e2e-check |
| QuickAdd-lijst bleef open boven "Kies" en de titel na Shift+Tab; een korte lijst liet de titel uitpiepen | Sluit bij focus buiten en bij een tik of klik erbuiten; ligt tegen de kaart en bedekt het hele tekstvak, "In tas" onderaan | Lola en Nina op 390 en 1440: Shift+Tab → focus op "Kies", lijst dicht; klik op label of legend → blijft open; klik buiten → dicht; nieuwe e2e-check |
| Zoeken: na Terug was het veld leeg (`/zoeken?q=armband` met de lege staat) | Verborgen route negeert URL-wijzigingen buiten `/zoeken`, leest de echte URL bij zichtbaar worden | typen → resultaat → Terug, ook na verfijnen en Enter: veld en 6 resultaten terug op 390 en 1440; nieuwe e2e-spec `search.spec.ts` |
| Zoeken vond geen cadeaukaart, stack of retour | Cadeaukaart in `searchable`, paginachips via `searchPages` | "cadeaukaart", "cadeau", "giftcard" → de kaart plus chip Cadeaukaarten; "stack" → chip Stacks van Linde; "retour", "verzending" → chip Verzenden en retourneren |
| Footerwoordmerk ingesprongen (letters op 52 px, rest op 20 px) | `Logo trimInline` | 390: woordmerk 20 tot 370 px, tagline en Club-kop op 20 px; 1440: woordmerk vanaf 132 px; geen horizontale scroll |
| Intro van de ringmaatgids stond vast boven de scrollende tabel | `descriptionInBody` standaard; vervaging onderaan zolang de body overloopt | 390: intro scrolt mee, haarlijn onder de titel |
| Favorieten op desktop: strookje van 16 px van de vijfde kaart, midden in de lucht afgesneden | Vanaf `md` 0,5rem uitloop (minder dan de gap) | 1280, 1440 en 1920: vier kaarten vullen de container, de vijfde begint buiten de rij |
| Focus verdween onder de sticky filterrij | `scroll-padding-top` telt de rij mee onder `lg` | omgekeerde Tab-wandeling over `/collections/oorbellen` en `/collections/alle` op 390 met de pill zichtbaar: geen enkele stop bedekt |
| Tegel "Niet gevonden wat je zocht?" scrolde op 320 px zijwaarts, tikvlakken overlapten | Tekstlinks die afbreken, elk 44 px | 320 en 360: 0 px overloop, links 48 en 44 px hoog binnen de tegel |
| Megamenu dat met hover openging, sloot niet op Esc | Document-luisteraar voor Esc zolang het paneel open is | "Shop per moment" en "Cadeaus": Esc → dicht, focus blijft op de body; met toetsenbord geopend: focus terug op de knop; nieuwe e2e-check |
| Zoek-deeplink: footer sprong uit beeld (CLS 0,19) | Hoogte gereserveerd met een zoekterm (fallback en view) | `?q=goud`, `?q=hoops`, `?q=xyzzy` op 390, 768, 1440 en 1920: CLS 0; beide in `CLS_ROUTES` |
| Placeholders lazen de alt-tekst van een foto die er niet is | Naam = zichtbare tekst ("FOTO: Sparkela Club") | `/sparkela-club` en de home: alle namen beginnen met "FOTO:"; unit-test |
| ASSETS.md beloofde "niets afgesneden" | §2 aangepast, tweede plekken in "Waar", nieuwe §4.7 met uitsneden en veilige zone; `collecties.<handle>` 16:9 | docs |
| "Vakantieproof" in het megamenu | "Klaar voor de vakantie"; content-guard weigert `-proof` en "bestand tegen" | content-guard |

De lage bevindingen (eyebrow en kruimelpad op stacks, cadeaukaarten en Spark Finder, countdown links in zijn doos, "(optioneel)" zoals op contact, één soort aanhalingstekens, tikvlakken van de mailadressen, stylingtegel na een filter, onderschriften van de fotostrook op 1024, betaalbadges boven de sticky totalen, Club-kop per zin, de popup op laptophoogte, focus na "Verwijderen" van een code, de cadeaukaarten-FAQ, de zoekdialoog in zijn kolom, stille tas na de demo-bestelling, de drawer na "In je tas" als transition, de bevestigings-H1, `sizes` van een grid met vier kolommen, de checkout-intro, de eyebrows van stylingtegels, de feestdagenzin, het lanceringscadeau, de upsell bij alleen cadeaukaarten, de copy-polish, één melding bij de voorraadgrens, de uitleg onder de coderij in twee gevallen, het PDP-vinkje cadeauverpakking, uitverkocht zonder verzendbelofte en de logolink in de header) staan per punt in beslissing 218(n) en 219.

### 3.2 Metingen

| Meting | Vóór | Na |
| --- | --- | --- |
| Kaarten met afgeknipte specletters op `/collections/alle`, 390 px | 8 van 24 | 0 |
| H1 van `/stacks`, `/cadeaukaarten`, `/spark-finder` (390 / 1440) | 180 / 196 tot 200 px | 212 / 228 px, gelijk aan contact en de Club |
| Gat tussen timer-icoon en tijd in de promobalk (390) | 19 px | gelijk aan de dropbanner (tekst links in zijn doos) |
| Ruimte tussen betaalbadges en sticky totalen in de drawer | 0 px | 20 px (390 en 1440) |
| Popup omgedraaid met beide foutregels, 1366 × 768 en 1280 × 800 | "Nee, bedankt" afgesneden | alles in beeld zonder scrollen (body 654 px in 654 px) |
| "In je tas" op de Lola-PDP, Event Timing bij 4× CPU | 312 tot 496 ms | 88 tot 104 ms (390), 96 tot 136 ms (1440) |
| CLS met late fonts (woff2 1,5 s vertraagd) | `/collections/kettingen` 390: 0,0025; `/nieuwsbrief/bevestigen?t=` 1440: 0,0040 tot 0,0079 | 0 op kettingen, subtiel en alle (360 tot 1024); bevestigen hooguit 0,0001; `/collections/alle` 1440: 0,00012 |
| Logolink tegen de accountknop (380 tot 400 px) | 1,7 tot 6,7 px overlap | 6,9 tot 16,9 px vrij; e2e op 380, 390 en 399 px |
| Ritme van gefilterde collecties (1440: `?vibe=retro`, `?type=ringen`) | rijen 4 + 2, 2 van 4 | elke rij vol (tegel sluit af), ook op 1024 en 390 |

### 3.3 Toegankelijkheid

- axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) op 390 en 1440: `/zoeken?q=stack`, `/zoeken?q=cadeaukaart`, de uitverkochte Isa-PDP, `/stacks`, `/spark-finder`, `/herroepen`, `/cadeaukaarten`, `/collections/alle?vibe=retro` en een open QuickAdd-lijst: geen overtredingen. De volledige a11y-spec is groen.
- Na de demo-bestelling hoort een schermlezer alleen "Je demo-bestelling is geplaatst"; na "Verwijderen" van een code "Code WELKOM10 verwijderd." met de focus op het codeveld (checkout) of "Afrekenen" (drawer).
- 0 px horizontale scroll en geen consolefouten op de home, `/collections/oorbellen`, de Lola-PDP, `/stacks`, `/cadeaukaarten`, `/spark-finder`, `/herroepen`, `/veelgestelde-vragen`, `/checkout` en `/zoeken?q=hoops` (390 en 1440).

### 3.4 Mechanische controles (eindstand)

| Controle | Uitkomst |
| --- | --- |
| `npm run lint` | schoon |
| `npm run typecheck` | schoon |
| `npm test` | 80 bestanden geslaagd, 1 overgeslagen; 1438 tests geslaagd, 4 overgeslagen |
| `npm run build:test` | groen, geen waarschuwingen; `ƒ` alleen de zes `/api/*`-routes en de proxy |
| `npm run test:e2e` (2 workers, tegen `start:test`) | 363 geslaagd, 23 overgeslagen, 0 mislukt, 4,2 minuten |

Nieuwe of bijgewerkte e2e-checks: `search.spec.ts` (Terug na een resultaat; cadeaukaart en paginachips), QuickAdd sluit bij focus buiten en klik buiten, geen afgeknipte specletters, megamenu sluit op Esc na hover, de telefoonheader op 380, 390 en 399 px zonder gedeelde pixel, `/collections/kettingen` en `/nieuwsbrief/bevestigen?t=voorbeeld` met late fonts, `/zoeken?q=goud` en `?q=xyzzy` in de CLS-routes, het promobericht en de label "Welke producten?". Nieuwe unit-tests in `components/qa-round2.test.tsx`: zoeken (cadeaukaart, `searchPages`), `logoLayout(…, { trimInline })`, de naam van een placeholder, de hangende specregel, `GRID_CARD_SIZES` en `codeRowNote`; bijgewerkt: footer (Club-kop per zin), countdown, cadeaukaart-FAQ, gefilterde collectie met tegel, de content-guard (aanhalingstekens, `-proof`).

### 3.5 Servers

Na elke meting is de testserver gestopt; aan het einde draait er geen `next start`, geen Playwright-server en geen Chromium meer.


## 4. QA-ronde 3: fixer (28 oktober 2026)

Zes lenzen (design mobiel en desktop, toegankelijkheid, performance, copy en compliance, functioneel, volledigheid) leverden 34 bevestigde bevindingen: 1 hoog, 8 middel, de rest laag; een paar kwamen dubbel (de Spark Finder-aanmelding drie keer, de drop-teaser, "Shop nieuw", de checkoutcode en de QuickAdd-overlays twee keer). Alle zijn opgepakt; wat bewust anders of niet is gedaan staat in beslissing 222. Alles is gecontroleerd op `npm run build:test` en `npm run start:test` (testklok 27 november 2026, prelaunch met de header `x-sparkela-test-now` en `page.clock`) met eigen Playwright-scripts op 390 × 844 en 1440 × 900, en waar de bevinding daarom vroeg op 320, 360, 375 × 667, 412, 1000 × 700, 1024, 1280 × 609, 1280 × 720, 1366 × 657, 1440 × 789, 1536 × 730 en 1920 × 1080. De beslissingen staan in `docs/DECISIONS.md` 221 en 222; plan §7.3, §11.9, §13.2, §13.5, §13.9, §13.11, §13.12, §14.2, §14.6 tot en met §14.9, §14.20 en §17.1 en §17.2 en `docs/ASSETS.md` §2 en §6 zijn bijgewerkt.

### 4.1 Wat er is opgelost (hoog en middel eerst)

| Bevinding | Oplossing | Controle |
| --- | --- | --- |
| Vorige/volgende van de PDP-galerij onder de vouw terwijl ze focus hadden (1366 × 657, 1280 × 609; hoog) | Galerij alleen sticky op een scherm van minstens 42rem hoog, daar de foto gekapt zodat alles onder de header past; `scroll-mb-4` op de knoppen | Tab-wandeling op Lola, Nina en de cadeaukaart op 12 maten: elke focusstop in de galerij volledig in beeld, ring inbegrepen; 1536 × 730: galerij sticky, foto 488 px breed, onderkant op 706 van 730; nieuwe e2e-check op vier laptopmaten |
| Popupkaart na het omdraaien: WELKOM10 8,7 px op 390, over de rand op 320 | "10%" groot (20 px, desktop 28 px) en de code in Inter-kapitalen (12 px, op 320 px 9 px); 4:3 met minstens 4,5rem | 390: kaart 91 × 72, 18 px vrij boven en onder; 320: 68 × 72, 19,5 px vrij, onderschriften naast elkaar zonder overlap (48–116, 135–185, 204–272); popup eindigt op 785 van 844 |
| Vervaging onder in de popup lag over "Ik doe mee" en "Nee, bedankt" met focus | Onderpadding telt als einde, `scroll-pb-12`, `keepFocusClearOfFade`, vervaging weg als de body zelf focus heeft | Tab-wandeling met en zonder foutregels op 1366 × 657, 1280 × 609, 1536 × 730, 390 × 844 en 375 × 667: geen control met focus onder een zichtbare vervaging; nieuwe e2e-check |
| "Bekijk alle N resultaten" net onder de rand van de zoeksheet | In de vaste footer van de sheet | 390 × 844: knop 653–701 in een sheet tot 717; 375 × 667: 503–551 tot 567; nieuwe e2e-check |
| Drop-teaser bijna helemaal donker en roest (13% licht op 1440) | Roestband plus licht deel met de Club-kaart, de voordelen en "Alvast rondkijken?"; compacte footer | `/drops/love-club` 1440: 60% licht, 20% roest, 21% donker (balk en footer); 390: 62% licht, 17% roest, 21% donker; geen horizontale scroll op 320 |
| Sitebeeld in volle mastermaat naar elk apparaat | Breedtevarianten bij de build (`scripts/build-images.mjs`), loader kiest de kleinste die past, poster 640 px | unit-tests op loader en script (schaalt naar 640, kopieert de master voor 1920 en 2400, houdt verse varianten, ruimt wezen op) |
| Voorwaarden beloofden verzendkosten "in je winkelwagen" | Zin die voor beide providers klopt; "tas" op `/cookies` | 0 keer "winkelwagen" op `/cookies` en `/algemene-voorwaarden` |
| Popup meldde korting bij een tas met alleen een cadeaukaart | Eigen regel met info-icoon, geen vinkje | unit-tests (lokaal en met de Shopify-vorm zonder reden) |

De lage bevindingen (QuickAdd-overlays, artikelnummers, checkoutcode, "Shop nieuw", FAQ-opbouw, goten, wachtlijstbelofte, pill over de leverbalk, inline aanmelding op `/nieuwsbrief/bevestigen`, `lang="en"`, cadeauverpakking, preloads, socials, ringmaatgids, jaartal, account, Spark Finder en zoeken op "ring") staan per punt in beslissing 221(g).

### 4.2 Metingen

| Meting | Vóór | Na |
| --- | --- | --- |
| Tikvlak "Shop nieuw" op 390 en 360 px (bereikbaar) | 0 tot 37,5 px hoog | 0 tot 43,5 px; op 320 px 13,5 tot 57 (balk eindigt op 58) |
| Linkerrand van de FAQ-vragen (1440 / 1280) | `/stacks` en `/cadeaukaarten` 540 / 460, PDP 635 / 555, home 632 / 552 | overal 635 / 555, overal met eyebrow, "Alle vragen" en contact |
| Kaartranden op de home en `/cadeaukaarten` (1440) | favorieten 132/430/728/1026 naast de grid 132/432/732/1032; drietallen 371 en 376 px breed | favorieten en grid 132/432/732/1032; elk drietal 376 px op 132/532/932 (1280 en 1024 idem) |
| Artikelnummers op 390 (Nina, Lola, Ivy) | "SPK-" / "015-19", "(lola-" / "chunky-hoops)" | regels breken alleen tussen codes |
| Wachtlijstbelofte (1440, 1024, 390) | "… spark. Vanaf" / "27 november online." | twee regels, één per zin |
| "Ik doe mee" op `/nieuwsbrief/bevestigen` (1440) | 704 × 48 | 129 × 48, formulier 544 px |
| Pill en leverbalk op de home | 1440 × 900: pill over "Vóór 16.00 besteld?" | 1440 × 900: pill wacht, verschijnt na 200 px scrollen; 1280 × 800, 390 en 412 ongewijzigd |
| "In je tas" met een bewaarde tas met cadeauverpakking (Nina, 1440 en 1280) | 20 px omhoog na ongeveer 300 ms | op 834 px vanaf de eerste paint, CLS 0 |
| Zoeken "ring" / "zilver ring" | Noor ringetjes eerst / alleen Noor | Nina, Vera / lege staat met suggesties; "ringetjes" vindt Noor nog |
| Footer op `/spark-finder` na het resultaat | tweede Club-formulier | weg zolang de finder-aanmelding er staat, terug na "Liever zonder e-mail verder" |

### 4.3 Toegankelijkheid

- axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) op 390 en 1440: `/drops/love-club`, `/drops/spark-friday`, `/stacks`, `/cadeaukaarten`, `/sparkela-club`, de Nina- en cadeaukaart-PDP, `/account`, `/nieuwsbrief/bevestigen`, `/spark-finder`, de home, `/collections/ringen`, `/zoeken?q=ring`, `/zoeken?q=zilver ring`, `/algemene-voorwaarden` en `/cookies`: geen overtredingen, geen consolefouten, 0 px horizontale scroll (ook op 320).
- Focus: de galerijknoppen en de popupknoppen zijn bij focus volledig zichtbaar (zie §4.1); de Engelse tagline in de footer heeft `lang="en"`.

### 4.4 Mechanische controles (eindstand)

| Controle | Uitkomst |
| --- | --- |
| `npm run lint` | schoon |
| `npm run typecheck` | schoon |
| `npm test` | 82 bestanden geslaagd, 1 overgeslagen; 1455 tests geslaagd, 4 overgeslagen |
| `npm run build:test` | groen, geen waarschuwingen; `ƒ` alleen de zes `/api/*`-routes en de proxy; de teaser blijft statisch per slug |
| `npm run test:e2e` (2 workers, tegen `start:test`) | 371 geslaagd, 27 overgeslagen, 0 mislukt, 4,4 minuten |

Nieuwe of bijgewerkte e2e-checks: de galerijknoppen in beeld bij focus op vier laptopmaten, "Bekijk alle N resultaten" in beeld op 390 × 844 en 375 × 667, de popupvervaging over geen enkele control met focus (1366 × 657), de pill die wacht zolang de leverbalk in zijn hoek staat (de bestaande pilltests, de axe-test van de popup en de popupscreenshot scrollen eerst voorbij de balk met de nieuwe helper `scrollPastPillSpot`), CLS 0 op een PDP als de bewaarde tas de cadeauverpakking al heeft, de naam van een omgedraaide kaart ("Kaart 2 van 3, jouw kaart: 10% op je eerste bestelling, code WELKOM10"), de footer zonder Club-formulier op `/spark-finder` na het resultaat en terug na overslaan, en de finder na een aanmelding zonder overslaan-link. Nieuwe unit-tests: `lib/image-loader.test.ts` (loader en `scripts/build-images.mjs`), `components/qa-round3.test.tsx` (bevestigde socials, cadeauverpakking, kaartoverlays, `ProductFaq inPage`), zoeken op type, startlabel met jaartal, `applyMessage` met alleen een cadeaukaart, de kaartvlakken, de artikelnummers, de teaser, de wachtlijstbelofte, de footer-tagline en `FinderResult ownsClub`.

### 4.5 Servers

Na elke meting is de testserver gestopt; aan het einde draait er geen `next start`, geen Playwright-server en geen Chromium meer.

