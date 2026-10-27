# Shopify inrichten: metafields, tags, collecties en kortingen

Voor Tristan. Dit document zegt hoe de producten in Shopify moeten staan, zodat de site ze goed toont: de metafields (productspecificaties, GPSR, laagste prijs), de tags (type, vibe, moment, drop), de collecties en de kortingen met hun combinaties. De site leest alles via de Storefront API van het Headless-kanaal; wat daar niet zichtbaar is, bestaat voor de site niet.

Bronnen: plan §2.3, §6.4, §16.6 en §16.9 punt 2; beslissingen 30, 104, 109, 122, 164, 182 en 185. De rest van de livegang (Vercel, tokens, webhooks, betalen, domein) staat in `docs/TODO-LAUNCH.md` en de README.

## 1. Volgorde

Houd deze volgorde aan (beslissing 122). Vooral stap 1 vóór stap 2: zonder definities negeert of weigert Shopify de metafield-kolommen van de CSV.

1. **Metafield-definities aanmaken** (§3), elk met het juiste type en met Storefront-toegang aan.
2. **Pas dan `data/shopify-products.csv` importeren** (Producten › Importeren). Alle producten komen binnen als concept (`draft`) en zijn nog nergens gepubliceerd. De cadeaukaart zit niet in de CSV (§5.2).
3. **Controle na de import:** open één product, bijvoorbeeld Lola chunky hoops, en kijk onderaan bij de metafields of `spec_regel` ("Staal, goud of zilver · 30 mm") en `gpsr_fabrikant` ("[Fabrikant, adres]") gevuld zijn. Zijn ze leeg, dan ontbreekt een definitie of heeft hij een ander type: herstel de definitie en importeer opnieuw, met "Bestaande producten overschrijven" aan.
4. **Productfoto's toevoegen**: JPEG of PNG, 4:5, in de volgorde packshot, draagfoto, detail, schaalfoto, stackfoto (`docs/ASSETS.md` §3).
5. **GPSR-gegevens per product invullen** zodra de leverancier ze levert; daarna staat er nergens meer een `[`-placeholder (de build waarschuwt per product zolang dat wel zo is). **Claims alleen als ze kloppen** (§3.2). **Tag `piercing`** waar nodig (§4).
6. **Producten actief zetten en alleen in het Headless-kanaal publiceren**, nooit in het kanaal Online Store (beslissing 109).
7. **De handmatige collectie `alle`** maken, met de volgorde voor "Uitgelicht" (§6.1).
8. **De automatische collecties per tag** maken (§6.2).
9. **De kortingen** maken, met de combinaties uit §7.
10. **Controleren:** de site verversen (webhooks, of de curl uit de README) en `npm run test:shopify` draaien met de sleutels in `.env.local`.

## 2. Vooraf: Headless-kanaal

- Shopify Basic of hoger (het Headless-kanaal werkt niet op Starter), met het Headless-kanaal geïnstalleerd.
- Storefront-permissies van het kanaal: `unauthenticated_read_product_listings`, `unauthenticated_read_product_inventory` (voor de voorraad, nodig voor "Laatste stuks"), `unauthenticated_read_product_tags`, `unauthenticated_read_checkouts`, `unauthenticated_write_checkouts`, `unauthenticated_read_content`.
- Voorraad bijhouden staat aan bij elk sieraad ("Voorraad bijhouden"), en "Doorgaan met verkopen als het product niet op voorraad is" staat uit. Zonder voorraad toont de site geen "Laatste stuks" en geen "Uitverkocht".

## 3. Metafield-definities

**Waar:** Shopify-beheer › Instellingen › Aangepaste gegevens (Custom data) › Producten › Definitie toevoegen. De precieze labels kunnen per versie van het beheer iets verschillen.

**Per definitie:**

1. **Naam:** vrij te kiezen (voorstel in de tabel).
2. **Namespace en sleutel:** exact zoals in de tabel, altijd met namespace `custom` (bijvoorbeeld `custom.spec_regel`). De site zoekt op deze sleutel; een tikfout betekent een leeg veld.
3. **Type:** exact zoals in de tabel. Een ander type (bijvoorbeeld "tekst met meerdere regels" waar "één regel" hoort) leest de site niet goed.
4. **Validatie:** alleen bij `statement_meter` (minimum 1, maximum 5).
5. **Toegang:** zet **Storefronts** aan (in het Engelse beheer "Storefronts access", lezen). Zonder die toegang geeft de Storefront API het veld niet terug, ook al staat het in het beheer gevuld.

| Naam (voorstel) | Namespace en sleutel | Type in Shopify | Wat de site ermee doet | Leeg of ontbrekend | Voorbeeld |
| --- | --- | --- | --- | --- | --- |
| Specregel | `custom.spec_regel` | Tekst, één regel (`single_line_text_field`) | Korte regel onder de naam op de productkaart | Geen specregel op de kaart | `Verguld staal · 20 mm` |
| Materiaal | `custom.materiaal` | Tekst, één regel (`single_line_text_field`) | Specificaties op de productpagina. Bij een Zilver-variant laat de site "met goudlaag" weg | Niet getoond | `Roestvrij staal met goudlaag` |
| Afmetingen | `custom.afmetingen` | Tekst, één regel (`single_line_text_field`) | Specificaties op de productpagina | Niet getoond | `Doorsnede 30 mm, dikte 6 mm` |
| Gewicht | `custom.gewicht` | Tekst, één regel (`single_line_text_field`) | Specificaties op de productpagina | Niet getoond | `8 g` |
| Sluiting | `custom.sluiting` | Tekst, één regel (`single_line_text_field`) | Specificaties op de productpagina | Niet getoond | `Klapsluiting` |
| Verzorging | `custom.verzorging` | Tekst, meerdere regels (`multi_line_text_field`) | Accordion "Verzorging" | De vaste verzorgingstekst van de site | `Doe je sieraden af bij zwemmen, …` |
| Statement-meter | `custom.statement_meter` | Geheel getal (`number_integer`), validatie 1 tot 5 | Meter subtiel ↔ chunky op de productpagina, als indicatief gemarkeerd | Meter verborgen | `4` |
| Nikkelvrij | `custom.nikkelvrij` | Waar of onwaar (`boolean`) | `true`: de claim "Nikkelvrij (bevestigd door de leverancier)" (§3.2) | Niet bevestigd, geen claim | `true` |
| GPSR fabrikant | `custom.gpsr_fabrikant` | Tekst, meerdere regels (`multi_line_text_field`) | Accordion "Productveiligheid" | De accordion meldt dat de gegevens ontbreken | `[Fabrikant, adres]` |
| GPSR verantwoordelijke in de EU | `custom.gpsr_verantwoordelijke_eu` | Tekst, meerdere regels (`multi_line_text_field`) | Accordion "Productveiligheid" | Idem | `[Verantwoordelijke in de EU]` |
| GPSR waarschuwingen | `custom.gpsr_waarschuwingen` | Tekst, meerdere regels (`multi_line_text_field`) | Accordion "Productveiligheid" | Idem | `[Waarschuwingen van de leverancier invullen]` |
| Laagste prijs 30 dagen | `custom.laagste_prijs_30d` | Geld (`money`), in EUR | Alleen hiermee mag een doorgestreepte van-prijs verschijnen (§3.3) | Nooit een doorgestreepte prijs | `{"amount":"14.95","currency_code":"EUR"}` |
| Bestseller | `custom.bestseller` | Waar of onwaar (`boolean`) | Handmatige vlag voor het label "Bestseller" en de carrousel "Bestsellers"; telt pas als de site echte verkoopdata gebruikt (`site.flags.realSalesData`, bij de lancering uit) | `false` | `false` |
| Lindes favoriet | `custom.lindes_favoriet` | Waar of onwaar (`boolean`) | Carrousel "Lindes favorieten" op de home, de 404-pagina en de aanvulling van de Spark Finder. Nooit als label op een product | `false` | `true` |

**In de CSV** heten de kolommen zoals het huidige importformaat van Shopify ze verwacht: `spec_regel (product.metafields.custom.spec_regel)` enzovoort (beslissing 164). Waarden: tekst gewoon, `true`/`false` voor de booleans, een geheel getal voor de meter, en geld als JSON (`{"amount":"14.95","currency_code":"EUR"}`). De metafields staan alleen op de eerste rij van een product; de volgende rijen zijn de varianten.

**Ongeldige waarden** (een meter van 7, kapotte JSON, een andere valuta dan EUR) negeert de site: het veld telt als leeg en de build geeft één waarschuwing per product. De build faalt er nooit op.

### 3.1 Specregel en materiaal per kleur

- De specregel staat op de kaart, voor alle kleuren tegelijk. Heeft een model een Zilver-variant, zet dan geen "Verguld", "verguld" of "goudlaag" in de specregel (bijvoorbeeld `Staal, goud of zilver · 30 mm`); de content-guard bewaakt dat voor de testproducten (beslissing 115).
- `materiaal` mag "met goudlaag" noemen: bij de Zilver-variant laat de productpagina dat weg.
- Heeft een stuk een niet-metalen deel (kralen, een schelpje, emaille, een kleuraccent), noem dat deel dan in de specregel en zet het materiaal ervan pas in `materiaal` als de leverancier het heeft bevestigd. Tot dan staat er een herkenbare placeholder: `Roestvrij staal met goudlaag; kralen: [materiaal van de leverancier invullen]` (beslissing 185). Nooit zelf een materiaal verzinnen.

### 3.2 Claims (nikkelvrij en andere)

- Zet `nikkelvrij` alleen op `true` met een schriftelijke verklaring van de leverancier voor dat product. De site toont dan "Nikkelvrij (bevestigd door de leverancier)", nooit "getest".
- `false` is een expliciet nee en wint altijd, ook van een claim in `content/claims.ts` (beslissing 182). Leeg betekent: niet bevestigd, geen claim.
- Andere claims (waterproof, hypoallergeen en vergelijkbare) bestaan alleen via `content/claims.ts` met `verified: true` en een bron. Zet zulke woorden nooit in een specregel, materiaal of beschrijving.

### 3.3 Van-prijs en laagste prijs

- Een doorgestreepte van-prijs verschijnt alleen als de variant een "Vergelijk met prijs" (compare-at) heeft die hoger is dan de prijs **en** `laagste_prijs_30d` gevuld is. Dan staat er altijd de regel "Laagste prijs in de 30 dagen hiervoor: €X" bij (brief §2.5).
- Vul `laagste_prijs_30d` met de laagste prijs die het product in de 30 dagen vóór de korting had. Is die onbekend, laat het veld dan leeg: de site toont dan geen doorgestreepte prijs, ook al staat er een compare-at-prijs (fail closed).
- Bij de lancering heeft geen product een compare-at-prijs.

## 4. Tags

De site haalt type, vibe, moment en drop uit de tags, niet uit het Shopify-veld "Producttype" (dat mag je vrij gebruiken in het beheer). Schrijf tags in kleine letters, zonder spaties, exact zoals hieronder. Een onbekende waarde (bijvoorbeeld `vibe:boho`) negeert de site, met een waarschuwing in de build.

| Tag | Waarden | Wat het doet |
| --- | --- | --- |
| `type:<type>` | `oorbellen`, `armbanden`, `kettingen`, `ringen`, `cadeaukaart`, `cadeauverpakking` | Precies één per product. Bepaalt de collectie, de filters, de hygiëneregel (oorbellen) en de stack-korting (oorbellen en armbanden). |
| `vibe:<vibe>` | `chunky-en-bold`, `clean-en-classy`, `kleurrijk-en-speels`, `retro` | Eén of meer. Filters, Spark Finder, collectie `subtiel` (`clean-en-classy`). De kaart toont één vibe als label: de eerste die de API teruggeeft. Shopify kan tags alfabetisch sorteren; wil je een vaste vibe op de kaart, geef het product dan één vibe-tag. |
| `moment:<moment>` | `festival`, `date-night`, `kantoor-maar-niet-saai`, `strand`, `feestdagen` | Eén of meer. "Shop per moment", filters, Spark Finder. |
| `drop:<slug>` | `holiday-sparkle`, `love-club`, `oranje-spark`, `like-mother-like-daughter`, `summer-spark`, `main-character`, `vamp`, `spark-friday` | Alleen voor dropproducten. Vóór de early access is het product overal verborgen; tijdens de drop krijgt het het label "Limited". De handles moeten gelijk zijn aan `productHandles` van die drop in `content/drops.ts` (anders bewaakt de site de pagina niet: de build waarschuwt). |
| `nieuw` | (losse tag) | Label "Nieuw" en de collectie `nieuw`. Haal de tag weg als het stuk niet meer nieuw is. |
| `verborgen` | (losse tag) | Nooit in lijsten, zoeken of collecties. Alleen voor de cadeauverpakking. |
| `piercing` | (losse tag) | De hygiëneregel geldt ook voor een piercing die geen oorbel is ("Om hygiënische redenen kun je oorbellen alleen retourneren met ongebroken hygiënezegel."). Oorbellen (`type:oorbellen`) hebben de regel al vanzelf (beslissing 80). |

Labels die de site zelf afleidt, zonder tag: "Laatste stuks" bij een echte voorraad van 1 tot 3 (drempel `site.lowStockThreshold`), "Uitverkocht" als niets meer te koop is, "Limited" tijdens een live drop. "Sale" en "Bestseller" staan bij de lancering uit.

### 4.1 Dropproducten

- Tag `drop:<slug>` en voeg ze toe aan de collectie `alle`, op de positie die de volgorde in de drop moet zijn.
- Publiceer ze uiterlijk de dag vóór de early access in het Headless-kanaal (Holiday Sparkle: uiterlijk 24 november 2026; early access 26 november 00.00 uur, publieke start 27 november).
- Ververs daarna `products` (curl in de README) en draai `npm run test:shopify`: die waarschuwt voor een drophandle die niet in `alle` staat.

## 5. Speciale producten

### 5.1 Cadeauverpakking

- Handle exact `cadeauverpakking`, prijs €1,95, één variant, tags `type:cadeauverpakking, verborgen`. Zit in de CSV.
- Gewicht 0 (telt niet mee voor het verzendgewicht), wel "Verzending vereist" (hij gaat mee in het pakket).
- Voorraad ruim (de CSV zet 999) of niet bijhouden.
- Wel publiceren in het Headless-kanaal (anders kan de cart hem niet toevoegen), **niet** in de collectie `alle`.

### 5.2 Cadeaukaart

- Een Shopify-cadeaukaart (Producten › Cadeaukaarten, in sommige versies van het beheer "Cadeaubonnen", › product toevoegen), handle exact `cadeaukaart`, varianten €15, €25 en €50 (optie "Bedrag"), tag `type:cadeaukaart`. Niet in de CSV: maak hem met de hand.
- Geen GPSR-metafields nodig; de productpagina toont daar een vaste regel voor digitale producten.
- Publiceren in het Headless-kanaal, **niet** in de collectie `alle`.
- Op cadeaukaarten geeft Shopify nooit korting; ze tellen bij de site niet mee voor de stack-korting of de gratis-verzendgrens.

## 6. Collecties

### 6.1 De handmatige collectie `alle`

- Titel "Alle sieraden", handle exact `alle`, sortering **Handmatig**.
- Elk sieraad staat erin, ook de dropproducten. De cadeauverpakking en de cadeaukaart niet.
- **De volgorde is "Uitgelicht" op de site**: positie 1 staat bovenaan op de home en in de collecties. Uitverkochte stukken zet de site zelf achteraan.
- **Publiceer de collectie in het Headless-kanaal.** De site leest de catalogus uit deze ene collectie: een product dat er niet in staat, staat niet op de site (behalve de cadeauverpakking, de cadeaukaart en de handles van een drop die nog niet voorbij is; die haalt de site los op, met een waarschuwing). Bestaat `alle` nog niet of is hij leeg, dan bouwt de site wel, maar zonder producten.

### 6.2 Automatische collecties per tag

De site berekent zelf welke producten in welke collectie horen, uit de tags (voor beide providers gelijk, plan §2.3). De automatische collecties in Shopify zijn nodig voor de kortingen (de stack-korting werkt op de collecties `oorbellen` en `armbanden`) en houden het beheer overzichtelijk. Gebruik dezelfde handles.

| Handle | Titel | Voorwaarde in Shopify ("Producttag is gelijk aan …", tenzij anders vermeld) |
| --- | --- | --- |
| `nieuw` | Nieuw | `nieuw` |
| `oorbellen` | Oorbellen | `type:oorbellen` (nodig voor de stack-korting) |
| `armbanden` | Armbanden | `type:armbanden` (nodig voor de stack-korting) |
| `kettingen` | Kettingen | `type:kettingen` |
| `ringen` | Ringen | `type:ringen` |
| `subtiel` | Subtiel en klassiek | `vibe:clean-en-classy` |
| `limited` | Limited | `drop:holiday-sparkle`; per nieuwe drop een voorwaarde erbij met "aan een willekeurige voorwaarde voldoen". De site toont hier alleen drops die nu publiek live zijn |
| `festival` | Festival | `moment:festival` |
| `date-night` | Date night | `moment:date-night` |
| `kantoor-maar-niet-saai` | Kantoor maar niet saai | `moment:kantoor-maar-niet-saai` |
| `strand` | Strand | `moment:strand` |
| `feestdagen` | Feestdagen | `moment:feestdagen` |
| `onder-25` | Cadeaus onder €25 | "Prijs is lager dan" €25,00. De site rekent zelf: alleen sieraden waarvan de goedkoopste variant onder €25 kost; dat de cadeaukaart of de cadeauverpakking in de Shopify-versie meekomt, maakt voor de site niet uit |

"Stacks" en "Cadeaukaarten" in het menu zijn pagina's van de site, geen collecties.

## 7. Kortingen

Drie kortingen (beslissing 104). **De titels moeten exact zo heten**: de site herkent de automatische kortingen aan hun titel en toont ze als eigen regel in de tas ("Stack-korting −€2,24").

| Titel (exact) | Soort in Shopify | Instellingen |
| --- | --- | --- |
| `Stack-korting` | Automatische korting, "Bedrag korting op producten" | 15%, van toepassing op de collecties `oorbellen` en `armbanden`, minimumvereiste: minimaal 3 artikelen (uit die collecties samen, mix en match). Geen einddatum. |
| `Cadeauverpakking december` | Automatische korting, "Bedrag korting op producten" | 100% op het product `cadeauverpakking`. Start 1 december 2026 00.00 uur, einde 31 december 2026 23.59 uur. |
| `WELKOM10` | Kortingscode, "Bedrag korting op bestelling" | 10% op de bestelling, "Beperken tot één gebruik per klant". Wil je hem strikt op de eerste bestelling houden: een klantsegment van klanten die nog niet besteld hebben als voorwaarde. Op cadeaukaarten geeft Shopify nooit korting. |

De tijden in Shopify volgen de tijdzone van de winkel: zet die op Europe/Amsterdam (Instellingen › Algemeen). De site schakelt "gratis in december" op dezelfde momenten (`giftWrap.freeWindows` in `content/offers.ts`, ook al voor december 2027). Zet de data in Shopify elk jaar opnieuw, of maak per jaar een korting met dezelfde titel.

### 7.1 Combinaties

In Shopify stel je per korting in met welke soorten kortingen hij mag combineren. Twee kortingen combineren alleen als ze dat **allebei** toestaan.

| Korting | Soort | Combineert met productkortingen | Combineert met orderkortingen | Combineert met verzendkortingen |
| --- | --- | --- | --- | --- |
| Stack-korting | product | ja | **nee** | ja |
| Cadeauverpakking december | product | ja | ja | ja |
| `WELKOM10` | order | ja | nee | ja |

Uitkomst:

- **Stack-korting + cadeauverpakking:** samen (allebei ja).
- **`WELKOM10` + cadeauverpakking:** samen (de cadeauverpakking staat orderkortingen toe, `WELKOM10` productkortingen).
- **Stack-korting + `WELKOM10`:** niet samen (de stack-korting staat geen orderkortingen toe). Shopify kiest dan de grootste korting; zo rekent de site ook (advies brief §11: de welkomstcode niet samen met de stack-korting).

### 7.2 Testen in de echte winkel

Test de combinaties vóór 24 november in de checkout met de carts uit plan §8.4 (TODO-LAUNCH punt 15):

| Cart | Inhoud | Verwacht |
| --- | --- | --- |
| N | Nina chunky ring (€19,95) + cadeauverpakking + `WELKOM10`, vóór december | `WELKOM10` 10% over €21,90 (ook over de cadeauverpakking): −€2,19 |
| O | Noor + Tess + Jet (drie stackstukken) + cadeauverpakking, in december | Stack-korting −€8,97 en de cadeauverpakking gratis |
| P | Nina + Jet + `WELKOM10` + cadeauverpakking, in december | Cadeauverpakking gratis en `WELKOM10` 10% over €44,90: −€4,49 |

Voor O en P zet je de startdatum van "Cadeauverpakking december" tijdelijk op vandaag en daarna terug op 1 december 00.00 uur. Gebruik de echte producten met dezelfde soort (twee armbanden of oorbellen erbij voor de stack); de bedragen schuiven dan mee.

## 8. Na het inrichten

- **Webhooks** naar `/api/revalidate` (TODO-LAUNCH punt 9): een wijziging in Shopify staat meteen op de productpagina en na één extra bezoek ook in de lijsten. Wil je het meteen overal, ververs `products` met de curl uit de README.
- **`npm run test:shopify`** met de echte catalogus: controleert onder meer of elke drophandle in `alle` staat en of de eerste foto van elk product JPEG of PNG is.
- **Bouwwaarschuwingen** lezen (Vercel, deploy-log): ze noemen per product een GPSR-placeholder, een ongeldig metafield, een onbekende tag of een dropproduct buiten `alle`.
