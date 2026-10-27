# QA-notities

Metingen en bevindingen uit golf 10-11 en later. Integrator 10 schreef §1; E3 (visuele QA) en F1 (oplevering) vullen aan (plan §20.2). De besluiten die hieruit volgen staan in `docs/DECISIONS.md` (212 tot en met 215, QA-ronde 1: 216 en 217).

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

