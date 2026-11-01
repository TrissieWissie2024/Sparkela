# Compliance

Dit document laat per harde regel uit brief §2 zien hoe de code hem afdwingt, welke tests hem bewaken en wat handwerk blijft voor Linde en Tristan. Stand: 1 november 2026, na de eindgate van golf 10-11 (`docs/QA-NOTES.md` §9). Alle paden zijn relatief aan `sparkela/`.

Dit is geen juridisch advies. De juridische teksten en dit overzicht moeten nog door een jurist worden bekeken (zie §11 en §17).

## 0. Zo lees je dit

Per regel staan er vier onderdelen:

- **Code**: de bestanden en functies die de regel afdwingen.
- **Tests**: Vitest (`npm test`). De content-guard is `content/content-guard.test.ts`.
- **E2E**: Playwright (`npm run test:e2e`), tegen de productiebuild met `COMMERCE_PROVIDER=local`, op 390 × 844 en 1440 × 900.
- **Handwerk**: wat de code niet kan controleren.

**Wat de content-guard wel en niet ziet.** De guard leest alles wat in deze repository staat: elke export van `content/` en `content/copy/`, de bestanden `content/legal/*.md` en de string-literals in `components/`. Wat in Shopify staat, ziet hij niet: productnamen, beschrijvingen, prijzen, metafields, foto's en SEO-velden. Voor die gegevens zegt de code "nee" als iets ontbreekt (fail closed), bijvoorbeeld geen van-prijs zonder laagste prijs en geen claim zonder bevestiging. Of een ingevuld gegeven klopt, kan alleen een mens controleren. Let op: de productbeschrijving uit Shopify staat ongefilterd op de productpagina (`components/pdp/ProductInfo.tsx`).

**Nummering.** De content-guard telt zijn eigen regels 1 tot en met 13 (PLAN §19.1). Dat zijn niet de nummers van brief §2. Zo horen ze bij elkaar:

| Brief §2 | Regels van de content-guard |
| --- | --- |
| 1. Referentie, geen kopie | 12 (referentietekst), 2 ("Lashthing" als merknaam) |
| 2. Geen beeld of tekst van anderen | 2 ("Yehwang" als merknaam) |
| 3. Geen verzonnen social proof | 3 |
| 4. Echte timers | 6 |
| 5. Eerlijke prijzen | 5 |
| 6. Claims | 1 en 13 |
| 7. Badges | 4 |
| 8. E-mailaanmelding | 7 |
| 9. Geen merknamen | 2 |
| 10. Herroepen, hygiëne en veiligheid | 9 (juridische teksten), 10 (GPSR) |

Regel 8 (toon: geen lange streep, geen "u") en regel 11 (de zinnen uit de brief letterlijk) gelden voor alles.

## 1. Referentie, geen kopie (§2.1)

**Code**

- Het merk is van Sparkela: de kleuren en tokens uit brief §5 in `app/globals.css`, het logo en de vonk in `components/brand/` (paden uit de logo-PDF, gemaakt met `scripts/build-logo.mjs`) en zelf gehoste fonts in `assets/fonts/`. Geen kleur, font of tekst van CORVANE.
- Van CORVANE, ons eigen project, hergebruiken we opbouw en code (`docs/REFERENCE.md` §5). Van Lashthing alleen structuur en patronen, uit de notities in `docs/REFERENCE.md` §3, in eigen woorden.
- Schermafbeeldingen van referenties staan in `reference/`. Die map staat in `.gitignore` en komt nooit in `public/`.

**Tests**

- Content-guard regel 12: geen reeks van 5 woorden (kleine letters, zonder leestekens) gelijk aan (a) de strings in CORVANE's `content/` of (b) de labels in `reference/**/*.structure.json`. Een self-test bewijst dat hij een overlap vindt. Ontbreekt een bron (verse clone, CI), dan slaat hij dat deel zichtbaar over met `SKIPPED: …`, nooit stil.
- Een woordcontrole op CORVANE-woorden ("scent", "spray", "geur", "parfum", "vane", "corvane") in `content/` en `components/` (beslissing 99).
- Regel 2: "Lashthing" staat op de lijst met verboden merknamen.
- `tests/unit/contrast.test.ts` rekent het eigen palet na (WCAG AA).

**Handwerk**

- Schrijf nieuwe teksten zelf. Neem nooit een zin van een andere shop over, ook niet tijdelijk als voorbeeld.
- Wat we over Lashthing wel en niet konden controleren, staat in §16.

## 2. Geen beeld of tekst van anderen (§2.2)

**Code**

- Er staat geen enkele productfoto in de repository. De testproducten tonen placeholders "FOTO: …" (beslissing 70).
- Sitebeeld staat in `content/assets.ts`. Alleen bestanden in `SUPPLIED` worden getoond. Zonder bestand valt een blok in productie weg, er komt geen grijs vlak (beslissingen 119 en 127). `docs/ASSETS.md` beschrijft wat Linde fotografeert en filmt.
- De productteksten in `content/products.ts` en `data/shopify-products.csv` zijn zelf geschreven.

**Tests**

- Content-guard regel 2: "Yehwang" en bestaande sieradenmerken en -winkels zijn verboden in alle content.
- `content/assets.test.ts`: elke plek heeft een vaste bestandsnaam, maat, alt-tekst en een briefing voor Linde; `SUPPLIED` noemt alleen bestanden die echt in `public/` staan.

**Handwerk**

- Upload in Shopify alleen eigen foto's en video's. Nooit beeld van Yehwang of van een andere webshop, ook niet tijdelijk.
- Schrijf de productbeschrijving in Shopify zelf. De guard ziet Shopify-teksten niet.
- Klantfoto's (fotostrook, reviews) alleen met schriftelijke toestemming.

## 3. Geen verzonnen social proof (§2.3)

**Code**

- `content/reviews.ts` is leeg en `site.flags.showReviews` staat uit (`content/site.ts`).
- `getReviews()`, `getRatingSummary()` en `hasReviews()` in `lib/reviews.ts` geven niets zolang de vlag uit staat of de lijst leeg is. Nooit "0 reviews".
- De componenten bestaan, maar tonen niets: `ReviewsCarousel` (home en boven de footer), `ProductReviews` (productpagina), `Stars`, de ratingregel in `Hero` en de rating op `ProductCard`.
- `productJsonLd()` in `lib/seo.ts` zet nooit `aggregateRating` of reviews zonder echte, getoonde reviews.
- Er is geen component voor "X mensen bekijken dit", "zojuist gekocht", klantaantallen of Trustpilot.
- "Bestseller" en de carrousel op de home: zie §7.

**Tests**

- Content-guard regel 3: geen "mensen bekijken", "zojuist gekocht", "bekijken dit", "Trustpilot", "★", een getal met "klanten" of "reviews". Een review telt alleen met een bron, een geverifieerde koper en toestemming voor een foto. Een lanceringsbewaker faalt zodra er reviews staan terwijl `showReviews` uit is.
- `lib/reviews.test.ts`, `components/home/ReviewsCarousel.test.tsx` (niets zonder reviews, in beide varianten) en `lib/seo.test.ts` ("never has aggregateRating or reviews without real reviews").

**Handwerk**

- Reviews komen pas na de lancering, uit een review-app met echte kopers (PLAN §22.1). Zet dan pas `site.flags.showReviews` aan.
- Importeer nooit reviews van een leverancier, een marktplaats of een andere shop.
- Ook in Shopify-beschrijvingen, Club-mails en socials: geen klantaantallen en geen "populair bij …".

## 4. Echte timers (§2.4)

**Code**

- Vaste data: `content/drops.ts` (drops), `content/offers.ts` (lanceringscadeau, acties, cadeauverpakking in december) en `content/site.ts` (`launchAt`, `vat.switchAt`). Alleen ISO-literals met tijdzone-offset.
- `components/time/Countdown.tsx` telt naar een vast doel. Nooit negatief, nooit opnieuw, nooit per bezoeker. Op het doel toont hij "Nu live" of niets. `components/time/countdownScript.ts` zet vóór de eerste paint dezelfde stand, ook op een pagina uit de cache (beslissing 187).
- `TimeSwitch` en `TimeGate` (`components/time/`) wisselen inhoud op datum. `lib/schedule.ts` (`scheduleAt`, `getCountdown`) en `lib/dates.ts` (`getDropPhase`, `getActiveCampaign`, `getPromoState`) rekenen in Europe/Amsterdam.
- Een timer leest geen cookie of browseropslag. Er is niets per bezoeker.

**Tests**

- Content-guard regel 6: alleen literals met offset, en geen `Date.now(` of `new Date(` in de broncode van `content/`.
- `content/drops.test.ts`, `content/offers.test.ts`, `lib/dates.test.ts` (onder andere een drop vlak voor en na de start), `lib/schedule.test.ts`, `components/time/time.test.tsx`, `components/time/countdownScript.test.ts` en `components/time/timeSwitchScript.test.ts`.

**E2E**

- `drops.spec.ts`: Love Club telt af tot nul en springt op "Nu live"; de Holiday-banner verdwijnt op zijn einddatum zonder herladen.
- `promo-bar.spec.ts`: het lanceringscadeau verdwijnt na `endsAt`, en "Nu live: Holiday Sparkle" neemt het over.

**Handwerk**

- De data van de drops in 2027 en het einde van het lanceringscadeau zijn voorstellen (beslissing 22, PLAN §22 punten 1 en 2). Bevestig ze vóór de lancering.
- Verleng een lopende actie niet. Een nieuwe actie krijgt een nieuwe entry met eigen data.
- Zet de kortingen in Shopify op dezelfde start en hetzelfde einde als in `content/offers.ts`.

## 5. Eerlijke prijzen (§2.5)

**Code**

- `priceDisplay(variant, laagstePrijs30d)` in `lib/pricing.ts`: een doorgestreepte van-prijs alleen als de compare-at hoger is dan de prijs én de laagste prijs van de 30 dagen ervoor bekend is. Anders geen van-prijs, ook niet als Shopify er een heeft (fail closed).
- `components/ui/Price.tsx` is de enige plek met `<s>`. Toont hij een van-prijs, dan staat er altijd "Laagste prijs in de 30 dagen hiervoor: €X" bij (`sharedCopy.price.lowest30d`). Er is geen prop om die regel weg te laten.
- Het metafield `custom.laagste_prijs_30d` (type money) wordt gelezen in `lib/commerce/shopify/mappers.ts`. Een ongeldige waarde wordt `null`. Zie `docs/METAFIELDS.md`.
- De badge "Sale" staat uit (`site.badges.enabled`) en hangt ook aan `priceDisplay()`.
- Geen kortingspercentage bij een van-prijs (beslissing 64).
- De besparing van de stack-korting mag (brief §2.5): `stackQuote()` in `lib/pricing.ts`. `StackCard` toont "€X in plaats van €Y" als platte tekst, nooit doorgestreept. In de tas staat de korting als eigen regel onder de stepper (`CartLineItem`, beslissingen 117 en 229).

**Tests**

- `lib/pricing.test.ts` (`priceDisplay` zonder laagste prijs geeft geen van-prijs), `components/ui/Price.test.tsx` (altijd de laagste-prijsregel, voor elke maat en tint), `components/product/ProductCard.test.tsx`, `components/cart/cart.test.tsx` (kortingsregel zonder `<s>`) en `components/stacks/stacks.test.tsx`.
- Content-guard regel 5: lokale prijzen op ,95 tussen €12,95 en €29,95, en nooit een compare-at zonder laagste prijs.

**E2E**

- `stack-discount.spec.ts` (bij 2 stuks de nudge, bij 3 de regel "Stack-korting" en het juiste totaal), `shipping-progress.spec.ts` en `gift-wrap.spec.ts`.

**Handwerk**

- Vul een compare-at-prijs in Shopify alleen in als die prijs echt gold.
- Vul dan `laagste_prijs_30d` met de laagste prijs van de 30 dagen vóór de korting. Shopify rekent die niet zelf uit. Weet je hem niet, laat het veld dan leeg: de site toont dan geen van-prijs.
- Bij de lancering heeft geen product een eerdere prijs. Een doorgestreepte Black Friday-prijs op 27 november kan dus niet. Het lanceringscadeau en de welkomstcode mogen wel.
- Haal de compare-at weg zodra de actie voorbij is.

## 6. Claims (§2.6)

**Code**

- `content/claims.ts`: nikkelvrij, waterproof en hypoallergeen staan alle drie op `verified: false` met `source: null`.
- `getVerifiedClaims()` in `lib/claims.ts` is de enige weg naar een claim. Een claim telt alleen met het Shopify-metafield `custom.nikkelvrij` op `true`, of met `verified: true` én een bron (`hasProof()`). Een expliciete `false` in Shopify wint altijd (beslissing 182). Cadeaukaart en cadeauverpakking krijgen nooit een claim.
- `ProductSpecs` (`components/pdp/ProductSpecs.tsx`) toont een claim als "Nikkelvrij (bevestigd door de leverancier)", nooit als "getest" (beslissing 82). Het FAQ-antwoord over nikkelvrij noemt de claim alleen voorwaardelijk.
- Specificaties: `specRows()` in `components/pdp/ProductSpecs.tsx` en `materialForVariant()` in `lib/catalog.ts`. Een zilveren variant krijgt nooit "goudlaag" of "verguld" (beslissingen 81, 115 en 185).
- De garantie van 6 maanden op verkleuring komt uit `site.guarantee` en mag overal staan.

**Tests**

- `lib/claims.test.ts` (niets zonder `verified`; `verified` zonder bron telt niet; het metafield geeft de claim).
- Content-guard regel 1: geen "nikkelvrij", "waterproof", "waterbestendig", "hypoallergeen", "huidvriendelijk", "verkleurt nooit", "getest" of "dermatologisch" buiten `content/claims.ts` en de voorwaardelijke FAQ-vraag; elke geverifieerde claim heeft een bron. Regel 13: geen laagwoord in de specregel van een stuk dat ook in Zilver bestaat.
- `components/pdp/pdp.test.tsx` (`ProductSpecs`) en `lib/catalog.test.ts` (`materialForVariant`).

**Handwerk**

- Zet `verified: true` (met `source`) of het metafield `nikkelvrij` alleen met schriftelijk bewijs van de leverancier, bijvoorbeeld een testrapport. Bewaar dat bewijs.
- Zet geen claims in een Shopify-titel of -beschrijving. De guard ziet die niet.
- Dezelfde regel geldt in mails, socials en advertenties.

## 7. Badges (§2.7)

**Code**

- `deriveBadges()` in `lib/catalog.ts` beslist elke badge; `cardBadge()` kiest er één per kaart.
- `site.badges.enabled` staat op `nieuw`, `limited` en `laatste-stuks`. Een badge buiten die lijst komt nooit mee.
- "Laatste stuks": echte voorraad van 1 tot en met `site.lowStockThreshold` (3). Onbekende voorraad geeft nooit de badge.
- "Limited": alleen als de drop van het product publiek live is.
- "Nieuw": de handmatige tag `nieuw` (beslissing 27).
- "Bestseller": het handmatige metafield `bestseller`, en alleen met `site.flags.realSalesData` aan (nu uit). Tot dan heet de carrousel op de home "Lindes favorieten", nooit "Bestsellers" (`homeFavorites()`, beslissing 79).

**Tests**

- `lib/catalog.test.ts`: "Laatste stuks" bij 3, niet bij 4 of 0; "Limited" alleen live; "Bestseller" uit zonder echte verkoopdata; nooit een badge buiten `enabled`; `homeFavorites`.
- `components/product/ProductCard.test.tsx` (één badge per kaart) en content-guard regel 4 (alleen de drie badges aan, geen lokaal product als bestseller).

**Handwerk**

- Zet "Voorraad bijhouden" aan in Shopify. Anders verschijnt "Laatste stuks" nooit.
- Haal de tag `nieuw` weg als een stuk niet meer nieuw is.
- Zet "Bestseller" (metafield en `realSalesData`) pas aan met echte verkoopcijfers.

## 8. E-mailaanmelding (§2.8)

**Code**

- De beloning komt uit config: `welcomeCode` in `content/offers.ts` (`WELKOM10`, 10%). Alle teksten rekenen daarmee.
- Iedereen krijgt dezelfde beloning. De kaarten in de popup tonen allemaal dezelfde code (beslissing 92).
- `ConsentCheckbox` (`components/forms/ConsentCheckbox.tsx`): het label is `site.consentText`, exact de zin uit de brief. Het vakje is nooit vooraf aangevinkt. Eronder staat de link naar het privacybeleid (`site.privacyLink`). Het vakje zit in `SubscribeForm` (footer, Club-pagina, wachtlijst, drop-teaser en drop-Club), in `EmailCapture` (popup) en in `FinderResult` (Spark Finder).
- Waarvoor je je aanmeldt, staat erbij: de Club-kop en de voordelen uit `site.club`.
- De server controleert opnieuw: `validateSubscribe()` in `lib/forms/validation.ts` weigert een aanmelding zonder `consent: true`.
- Dubbele opt-in (beslissing 74): `/api/subscribe` zet de klant in Shopify op `PENDING` en stuurt een bevestigingsmail met een ondertekende link (`lib/forms/confirm-token.ts`). Pas `/nieuwsbrief/bevestigen` zet hem op `SUBSCRIBED`.

**Tests**

- Content-guard regel 7: `site.consentText` is exact de zin uit de brief, en geen component typt de zin zelf.
- `content/offers.test.ts`: elk percentage en elke code in de copy is gelijk aan `welcomeCode`.
- `components/forms/forms.test.tsx` (niet aangevinkt, privacylink, gekoppelde foutmelding), `lib/forms/validation.test.ts`, `tests/unit/api-forms.test.ts` (nooit enkele opt-in, ook niet zonder sleutels) en `components/email/email.test.tsx`.

**E2E**

- `prelaunch.spec.ts` (veld, toestemming en knop van boven naar beneden; na aanmelding de code voor de lanceringsdag), `popup.spec.ts` en `finder.spec.ts` (het vinkje heeft de toestemmingszin als naam).

**Handwerk**

- Maak `WELKOM10` in Shopify precies zo aan: 10%, eenmaal per klant, niet samen met de stack-korting (beslissing 104).
- Verander je de beloning, pas dan `content/offers.ts` aan. De teksten volgen vanzelf. Pas de code in Shopify tegelijk aan.
- Test één echte aanmelding tot en met `SUBSCRIBED` (PLAN §22 punt 3).

## 9. Geen merknamen (§2.9)

**Code**

- Alle copy staat in `content/` en wordt in componenten geïmporteerd, nooit getypt (PLAN §21.2).

**Tests**

- Content-guard regel 2: een lijst van bestaande sieradenmerken en -winkels (onder andere Pandora, Swarovski, Cartier, Tiffany, Mejuri, Missoma, Monica Vinader, My Jewellery, Lucardi, Bijou Brigitte, Lashthing, Yehwang en CORVANE) en de woorden "dupe", "zoals van", "lijkt op", "geïnspireerd op" en "inspired by". Ook in `content/legal/*.md`. Met een self-test.

**Handwerk**

- De lijst dekt alleen de repository. Controleer zelf productnamen, beschrijvingen, SEO-titels en alt-teksten in Shopify, en je socials.
- Geen hashtags of zoekwoorden met merknamen van anderen.

## 10. Herroepen, hygiëne en veiligheid (§2.10)

### 10.1 Herroepingsfunctie op elke pagina

**Code**

- `Footer` (shop) en `MiniFooter` (wachtlijst, bevestigingspagina en de root-404 in `app/not-found.tsx`) tonen de link "Hier de overeenkomst herroepen" (`site.withdrawalLinkLabel`) naar `/herroepen`.
- `/herroepen` (`app/(shop)/herroepen/page.tsx`) heeft `WithdrawalForm` met één knop "Herroeping bevestigen" (beslissing 66). `app/api/herroepen/route.ts` maakt een referentie (`HR-…`) met een tijdstempel, mailt de klant een ontvangstbevestiging met de inhoud en Sparkela een kopie (`lib/mail.ts`). Zonder mailsleutels opent een `mailto:` met de ingevulde gegevens.
- `proxy.ts` houdt `/herroepen` en de juridische pagina's open tijdens de prelaunch (PLAN §11.3).
- Het modelformulier staat in `content/legal/herroepen.md`.

**Tests**

- `components/layout/layout.test.tsx` en `components/prelaunch/prelaunch.test.tsx` (de link in beide footers), `tests/unit/api-forms.test.ts` (twee mails; mislukt de mail aan de klant, dan is het verzoek mislukt) en `tests/unit/proxy.test.ts` (allowlist).

**E2E**

- `layout.spec.ts`: op elke shoproute, op de wachtlijst, op `/nieuwsbrief/bevestigen` en op de 404 is de link zichtbaar en wijst hij naar `/herroepen`.
- `prelaunch.spec.ts` (de link op de wachtlijst) en `withdrawal.spec.ts` (drie veldfouten, fout bestelnummer, een geldige aanvraag en precies één knop).

**Handwerk**

- Zet dezelfde link ook in de orderbevestiging van Shopify (brief §11).
- Zet de mailsleutels (Resend) met een geverifieerd afzenderdomein. Zonder sleutels valt het formulier terug op `mailto:`.
- Kies een retouradres: de voorwaarden zeggen dat Sparkela dat na een herroeping mailt. Laat de teksten controleren, ook het modelformulier in `content/legal/herroepen.md`.

### 10.2 Hygiëneregel

**Code**

- `needsHygieneSeal()` in `lib/catalog.ts` is de enige plek die dit beslist: type `oorbellen` of tag `piercing` (beslissing 80).
- `ProductAccordions` (`components/pdp/ProductAccordions.tsx`) zet `site.hygieneRule` als eerste zin in "Verzenden en retourneren".
- De regel staat ook in de FAQ ("Kan ik retourneren?") en in `content/legal/algemene-voorwaarden.md`.

**Tests**

- `lib/catalog.test.ts` (oorbellen ja, ketting nee, ketting met tag `piercing` ja) en `components/pdp/pdp.test.tsx` (de regel bij oorbellen en piercings, niet bij een ketting). Content-guard regel 11 houdt het FAQ-antwoord letterlijk gelijk aan de brief.
- Geen eigen e2e: de unit-tests renderen de accordeon zelf.

**Handwerk**

- Verpak oorbellen en piercings met een echt hygiënezegel. Anders geldt de uitzondering niet.
- Tag een piercing die geen oorbel is in Shopify met `piercing`.

### 10.3 Productveiligheid (GPSR)

Zie §12.

### 10.4 Geen niet-noodzakelijke scripts vóór toestemming

Zie §13.

## 11. ACM en consumentenrecht

| Punt | Hoe het in de code zit | Tests | Handwerk |
| --- | --- | --- | --- |
| Herroepen | 14 dagen (`returnDays` in `content/shipping.ts`), de link op elke pagina, het formulier en de ontvangstbevestiging (§10.1) | Zie §10.1 | Link in de Shopify-orderbevestiging; retourproces testen met een echte bestelling |
| Hygiënezegel | `needsHygieneSeal()` en `site.hygieneRule` (§10.2) | Zie §10.2 | Echte zegels gebruiken |
| Btw-tekst | `VatNotice` (`components/time/VatNotice.tsx`) wisselt op `site.vat.switchAt` (1 januari 2027) van "Prijzen inclusief 21% btw" naar de zin over de kleineondernemersregeling. Hij staat bij de prijs op de productpagina (`ProductInfo`), in de tas (`CartTotals`), in `Footer` en in `MiniFooter`. De prijzen blijven gelijk | `lib/dates.test.ts` (`vatText`, de wissel op 1 januari 2027), `components/time/time.test.tsx` | De KOR op tijd aanvragen bij de Belastingdienst en op 1 januari de btw-instellingen in Shopify omzetten. Gaat de KOR niet door, dan `site.vat` aanpassen |
| Prijzen inclusief btw | Elk bedrag is een eindprijs in centen (`lib/money.ts`); de site toont nergens een prijs zonder btw | `lib/money.test.ts`, `lib/pricing.test.ts` | In Shopify "Alle prijzen inclusief btw" aan |
| Verzendkosten vooraf | €3,95 en gratis vanaf €35 uit `content/shipping.ts`. Het tarief en de grens staan in "Verzenden en retourneren" op elke productpagina, in de FAQ en op `/verzenden-en-retourneren`. De grens staat ook in de USP-balk (`UspBar`), de leverbalk op de home (`DeliveryBar`) en de balk in de tas ("Nog €X tot gratis verzending"). `CartTotals` toont lokaal het bedrag; met Shopify "Berekend bij afrekenen". Ook in de JSON-LD van elk product | `content/shipping.test.ts` (FAQ-bedragen gelijk aan config), `lib/pricing.test.ts`; e2e `shipping-progress.spec.ts` | Verzendtarieven in Shopify gelijk aan `content/shipping.ts`, alleen Nederland |
| Bedrijfsgegevens | `CompanyDetails` in `Footer` en `MiniFooter`, uit `site.company` | `components/layout/layout.test.tsx` | KvK-nummer, btw-id en adres invullen (nu placeholders tussen haken) |
| Juridische teksten | `content/legal/*.md`; elke pagina toont bovenaan "TODO: laten controleren" (`LegalNotice`) | Content-guard regel 9 (elke tekst begint met die melding) | Laten controleren; daarna de melding weghalen en guard regel 9 aanpassen. Tot dan staat de melding zichtbaar op de site |
| Echte urgentie en eerlijke prijzen | Zie §4 en §5 | Zie daar | Zie daar |

## 12. GPSR

**Code**

- `ProductAccordions` toont op elke productpagina het onderdeel "Productveiligheid" met de fabrikant, de verantwoordelijke in de EU en de waarschuwingen uit de metafields `gpsr_fabrikant`, `gpsr_verantwoordelijke_eu` en `gpsr_waarschuwingen` (zie `docs/METAFIELDS.md`).
- Een leeg veld valt weg en `pdpCopy.gpsr.missing` zegt dat de gegevens volgen. Er staat nooit zelfgeschreven veiligheidstekst (beslissing 100).
- De cadeaukaart toont `pdpCopy.gpsr.digital` met de bedrijfsgegevens (beslissing 116).
- Placeholders staan tussen haken. Met `COMMERCE_PROVIDER=shopify` waarschuwt de build per product dat nog `[` bevat (`checkProduct()` in `lib/commerce/shopify/catalog.ts`).

**Tests**

- Content-guard regel 10: elk sieraad heeft de drie velden, placeholders staan tussen haken, en een waarschuwing zonder haken in een lokaal product faalt.
- `components/pdp/pdp.test.tsx`: het onderdeel is er altijd, ook bij de cadeaukaart.

**Handwerk**

- Vraag de leverancier per product om de fabrikant, de verantwoordelijke in de EU en de waarschuwingen, en vul ze in Shopify in.
- Zolang de build een GPSR-placeholder meldt, is dat product niet klaar voor verkoop.
- Laat de jurist bevestigen dat naam en foto genoeg zijn om het product te identificeren.

## 13. AVG en cookies

**Gegevens**

- Het aanmeldformulier vraagt alleen een e-mailadres (en bij de Spark Finder de antwoorden als tags). Klantgegevens staan in Shopify; de site heeft geen eigen database.
- Het e-mailadres gaat als GraphQL-variabele mee, nooit in de querytekst. Het bevestigingstoken bevat een klant-id en geen e-mailadres (`lib/forms/confirm-token.ts`).
- Misbruik: een honeypot (`components/forms/Honeypot.tsx`) en een rate limit (`lib/forms/rate-limit.ts`). Klanttekst in mails gaat door `sanitizeForCustomerMail()` in `lib/mail.ts`.
- Tests: `lib/commerce/shopify/admin.test.ts`, `lib/forms/confirm-token.test.ts`, `lib/forms/rate-limit.test.ts`, `lib/mail.test.ts` en `tests/unit/api-forms.test.ts`.

**Cookies en scripts**

- Analytics staat standaard uit (`site.analytics.enabled` via `NEXT_PUBLIC_ANALYTICS_ENABLED`, beslissing 68). Dan bestaan de banner en de loader niet in de pagina, en doet de site geen enkel verzoek naar een derde partij.
- Staat analytics aan, dan toont `ConsentBanner` "Akkoord" en "Weigeren", even groot. `AnalyticsLoader` laadt Google Tag Manager alleen na "Akkoord" en met een geldig ID (`shouldLoadAnalytics()` in `lib/analytics.ts`). Consent Mode staat eerst op alles geweigerd. Intrekken kan met `CookieSettingsButton` in de footer; dan gaat `analytics_storage` op geweigerd en wist `clearAnalyticsCookies()` de `_ga`-cookies. Er is geen `<noscript>`-iframe.
- `track()` schrijft alleen naar de lokale `window.dataLayer`. Zonder Tag Manager verstuurt dat niets.
- Fonts zijn zelf gehost (geen Google Fonts), betaalmethoden zijn tekstbadges (beslissing 93) en er zijn geen embeds of iframes van derden.
- Zonder toestemming alleen functionele opslag: de tas, de stand van de popup, de aanmeldstatus, de cookiekeuze en de preview- en early-access-cookies. De volledige lijst staat in `cookieTable` (`content/legal.ts`) en op `/cookies`.
- Tests: `lib/analytics.test.ts` ("loads the tag manager only when enabled, with a valid id and explicit consent"; de banner alleen met analytics aan) en `components/consent/ConsentBanner.test.tsx`.

**Handwerk**

- Sluit verwerkersovereenkomsten met Shopify, Vercel en Resend (en Google als analytics aangaat), en noem ze in het privacybeleid.
- Zet in Shopify Email de dubbele opt-in aan, en de cookiebanner van de checkout (brief §11).
- Zet in de Tag Manager-container alleen tags die Consent Mode volgen. Komt er een cookie bij, zet hem dan in `cookieTable`.
- Laat het privacy- en cookiebeleid controleren (`content/legal/privacy.md`, `content/legal/cookies.md`).

## 14. Toegankelijkheid (WCAG 2.1 AA)

**Hoe**: de regels in PLAN §18.3 (één H1, skiplink, focusring, dialogs met focus-trap en Esc, live regions, geen kleur als enig signaal, reduced motion, reflow op 320 px, tekstafstand).

**Resultaten** (`docs/QA-NOTES.md`):

| Controle | Uitkomst |
| --- | --- |
| `tests/e2e/a11y.spec.ts` (axe, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`): home, collectie, productpagina, Spark Finder, `/herroepen`, tas met een regel, lege tas, menu open, popup open met een omgedraaide kaart en de wachtlijst, op 390 × 844 en 1440 × 900 | 20 tests, 0 overtredingen (§9.2) |
| Extra axe-controles op 320, 390 en 1440 px: `/nieuwsbrief/bevestigen` met en zonder token, de 404, `/cadeaukaarten`, `/sparkela-club`, `/veelgestelde-vragen` en de tabs op de home | 24 controles, 0 overtredingen, 0 px horizontale scroll (§1.7) |
| Lighthouse toegankelijkheid | 100 in alle negen runs (§9.3) |
| Contrast | `tests/unit/contrast.test.ts` rekent elk toegestaan kleurpaar na (PLAN §4.10, strenger dan de brief, beslissing 43) |
| Handmatig in QA-rondes 1 tot en met 6 | Toetsenbord, focusvolgorde, focus na sluiten, tekstafstand, reflow en schermlezerlabels (QA-NOTES §2.4 tot en met §7.3) |

**Tikvlakken.** Minstens 44 × 44 px (PLAN §18.3 punt 4). Twee uitzonderingen:

- De links in de footer zijn met een muis vanaf `lg` (`pointer-fine`) 32 px hoog. Dat is ruim boven de 24 px van WCAG 2.5.8. Op een touchscreen blijven ze 44 px (`components/layout/Footer.tsx`).
- Het vinkje van een checkbox is 24 px, maar het tikvlak van vakje en label samen is minstens 44 px (`components/ui/Checkbox.tsx`, `components/forms/ConsentCheckbox.tsx`).

**Handwerk**

- Geef elke echte foto een alt-tekst (de briefings in `docs/ASSETS.md` noemen er een) en zet ondertitels bij video's met gesproken tekst.
- Draai `npm run test:e2e` opnieuw zodra de echte foto's en teksten erin staan.

## 15. Performance

Lighthouse 13, mobiel, mediaan van 3 runs, tegen `npm run start:test` (`docs/QA-NOTES.md` §9.3, eindgate van 1 november 2026). De norm is minstens 90 (PLAN §18.4).

| Pagina | Mediaan | Runs | FCP | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | **92** | 81, 92, 98 | 1,06 s | 1,06 s | 212 ms | 0 |
| `/collections/alle` | **93** | 93, 92, 98 | 0,92 s | 0,92 s | 322 ms | 0 |
| `/products/lola-chunky-hoops` | **95** | 95, 95, 90 | 1,07 s | 1,07 s | 265 ms | 0 |

- Elke mediaan haalt de norm. Toegankelijkheid, best practices en SEO zijn 100 in alle negen runs, CLS is overal 0.
- De spreiding komt van TBT (171 tot 399 ms buiten de eerste home-run). Die eerste home-run (81, TBT 784 ms) startte direct na de e2e- en screenshotruns, op een drukke machine. Een tweede reeks op de home met een rustige machine gaf **96** (92, 96, 96).
- De vorige eindstand (QA-NOTES §1.8) was 95, 96 en 93. De verschillen vallen binnen de spreiding.
- Meet opnieuw als de echte foto's er zijn. Dan kan de LCP een afbeelding worden in plaats van tekst (`docs/ASSETS.md`).

## 16. Referentie, geen kopie: wat we controleerden

**CORVANE.** Content-guard regel 12 vergelijkt al onze teksten (alle strings in `content/` en `content/copy/` en alle string-literals in `components/`) met de teksten van CORVANE en met de labels uit de vastgelegde CORVANE-pagina's in `reference/corvane/`. Op 1 november 2026 opnieuw gedraaid op deze machine, met beide bronnen aanwezig: 26 guard-tests groen, 0 overlappen.

**Lashthing.** lashthing.nl kon vanuit de bouwomgeving niet worden bezocht. De netwerkproxy gaf 403 op CONNECT, WebFetch gaf ENOTFOUND en web.archive.org was ook geblokkeerd (`docs/REFERENCE.md` §1.1, beslissing 8). We hebben de proxy niet omzeild. Daardoor hebben we geen pagina, afbeelding, CSS of code van Lashthing gezien, en konden we die ook niet overnemen. Wat we wel zagen, zijn samenvattingen uit een zoekindex, met hier en daar een kort label. Maar we konden de site niet naast de echte pagina's leggen. De vergelijking is daarom beperkt tot:

1. **De notities uit de zoekindex** (`docs/REFERENCE.md` §3): samenvattingen van geïndexeerde pagina's, in eigen woorden en zonder citaten. Daaruit namen we alleen structuur en patronen over (REFERENCE §4). De patronen die met brief §2 botsen, staan in REFERENCE §3.3 en zitten niet in de site.
2. **De labels die in die notities tussen aanhalingstekens staan**, met de hand gezocht in `content/`, `components/`, `app/` en `lib/`. Alleen algemene winkelwoorden komen voor: "Laatste stuks" (uit brief §2.7 zelf), "Berekend bij afrekenen" en "1 van N" (het dia-label van een carrousel, PLAN §18.3). "Bijna uitverkocht", "het vaakst gekozen", "vaak samen gekocht", "weer op voorraad", "zo breng je het aan", "shop op stijl", "totale waarde" en "vierde gratis" komen nergens voor.
3. **De content-guard**: "Lashthing" staat op de lijst met verboden merknamen. Elke run print `SKIPPED: lashthing`, zodat niemand denkt dat er tegen Lashthing is vergeleken (PLAN §19.4 punt 5, §22 punt 15).

**Wat nog kan.** Zodra een machine lashthing.nl mag bezoeken: draai `npm run capture:reference -- --site=lashthing` (REFERENCE §6). De guard leest alle `reference/**/*.structure.json`, dus de labels van Lashthing gaan dan vanzelf mee in de vergelijking. Haal daarna de vaste melding `SKIPPED: lashthing` uit `content/content-guard.test.ts`. Tot die tijd: loop als Linde of Tristan in je eigen browser één keer door de home, een collectie, een productpagina en de tas van lashthing.nl, en controleer dat geen zin van Sparkela daar letterlijk staat.

## 17. Handwerk in het kort

Voor Linde en Tristan, vóór de lancering. De volledige stappenlijst staat in `docs/TODO-LAUNCH.md`.

1. Alleen eigen foto's en eigen teksten in Shopify; geen claims, merknamen of klantaantallen in titels en beschrijvingen.
2. Compare-at-prijzen alleen als ze echt golden, altijd met `laagste_prijs_30d`; geen doorgestreepte prijs op de lanceringsdag.
3. Claims alleen met schriftelijk bewijs (`verified: true` met `source`, of het metafield `nikkelvrij`).
4. Reviews alleen van echte kopers via een review-app; pas dan `showReviews` aan.
5. "Bestseller" pas met echte verkoopcijfers; voorraad bijhouden aan.
6. Data van drops en acties bevestigen en niet verlengen; Shopify-kortingen op dezelfde data.
7. `WELKOM10` en de verzendtarieven in Shopify gelijk aan de config.
8. GPSR-gegevens per product invullen; geen placeholder meer in de build.
9. Herroepingslink in de orderbevestiging, mailsleutels en bedrijfsgegevens invullen; een retouradres kiezen.
10. Juridische teksten laten controleren; daarna de melding "TODO: laten controleren" weghalen.
