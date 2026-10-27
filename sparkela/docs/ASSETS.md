# Beeld: shotlist en bestanden

Dit is de shotlist voor Linde en de werkwijze voor Tristan. Elke foto- en videoplek op de site heeft een vaste sleutel, een vaste bestandsnaam, een verhouding en een maat in pixels. Die staan in `content/assets.ts`, en deze lijst noemt ze allemaal. Zolang een bestand er niet is, toont de site een nette placeholder in dezelfde verhouding ("FOTO: …" of "VIDEO: …"). Lever je een bestand onder de juiste naam aan, dan vervangt het de placeholder één op één, zonder dat er iets aan de opmaak verandert.

Bronnen: brief §5 (beeld), plan §17.2, beslissingen 60, 119, 122, 127 en 131.

## 1. Wat is wanneer nodig

| Klaar op | Wat | Waarom |
| --- | --- | --- |
| ma 2 november | `linde.wachtlijst` | De wachtlijst gaat live. Zonder deze foto laat de wachtlijst het fotoblok weg (geen grijs vlak), dus het mag later, maar de pagina is mooier met foto. |
| vr 20 november | `hero.desktop`, `hero.mobiel`, `linde.portret`, de vijf `momenten.*`, `home.statement`, `home.subtiel` | Nodig vóór de lancering (TODO-LAUNCH punt 4). |
| vr 20 november | Productfoto's van alle modellen en de cadeaukaart, in Shopify (§3) | Nodig vóór de lancering: de kaarten en productpagina's tonen anders "FOTO: …". |
| vóór 24 november | `drops.holiday-sparkle`, `stacks.holiday-stack` | De droppagina en de Holiday stack zijn vanaf de early access (26 november) te zien. |
| vóór de lancering, sterk aangeraden | `stacks.goud-en-gedurfd`, `stacks.kleur-op-je-pols`, `stacks.kantoor-maar-niet-saai`, `club.hero` | Zonder bestand staat er een nette placeholder. |
| na de lancering | `fotostrook.01` tot `.08`, `video.01` tot `.04` | In productie zijn de fotostrook en de videorij verborgen zolang er geen enkel bestand is (beslissing 127). |
| vóór de early access van elke volgende drop | `drops.<slug>` van die drop | Zie de data in §4.4. |

## 2. Regels voor alle beelden

- **Alleen eigen beeld.** Foto's en video's van Linde of van Sparkela, of klantfoto's met schriftelijke toestemming. Nooit foto's van de leverancier, van andere webshops of van internet, ook niet tijdelijk (brief §2.2). Dezelfde stukken worden elders verkocht; eigen beeld is wat Sparkela onderscheidt.
- **Geen tekst in het beeld.** Koppen, prijzen en knoppen zet de site er zelf overheen of naast. Tekst in een foto is niet te lezen voor schermlezers en niet aan te passen.
- **Exacte maat en verhouding.** Lever elk bestand precies op de maat uit de tabel. De site schaalt sitebeeld niet zelf (Vercel doet geen beeldbewerking): de browser krijgt het bestand zoals het is. De verhouding is vast, dus er wordt niets afgesneden als de maat klopt.
- **Sitebeeld als WebP**, sRGB, kwaliteit ongeveer 80. Houd een bestand liefst onder 400 kB (de hero desktop onder 600 kB), want de pagina moet ook op een telefoon met een matige verbinding snel laden (Lighthouse mobiel 90+).
- **Productfoto's als JPEG of PNG**, nooit WebP of AVIF (§3).
- **Bestandsnamen exact zoals in de tabel**: kleine letters, geen spaties, dezelfde map. Een andere naam vindt de site niet.
- **Onderwerp in het midden, lucht aan de randen.** Op kaarten en tegels liggen labels over de hoeken van de foto (linksboven een label zoals "Nieuw", rechtsonder de vibe of de naam van het moment).
- **Alt-tekst.** Elke plek heeft in `content/assets.ts` al een beschrijving van de foto die we verwachten (kolom "Alt-tekst" daar). Wordt de foto anders, pas dan die tekst aan, zodat schermlezers horen wat er echt te zien is.

## 3. Productfoto's (in Shopify)

Productfoto's staan in Shopify, niet in `public/`. Ze komen via de Storefront API op de site; de CDN van Shopify schaalt ze en geeft browsers zelf WebP of AVIF.

**Per model vijf foto's, in deze volgorde.** De positie in Shopify bepaalt wat voor foto het is (beslissing 60, `imageKindForIndex`):

| Positie | Soort | Wat |
| --- | --- | --- |
| 1 | packshot | Het stuk alleen, op een rustige lichte achtergrond, in het midden. Gebruik voor elk model dezelfde achtergrond, hetzelfde licht en dezelfde afstand, zodat het grid rustig oogt. Deze foto staat op de productkaart. |
| 2 | draagfoto | Gedragen: oorbellen aan het oor, armband om de pols, ketting om de hals, ring aan de hand. Deze foto verschijnt op desktop als je met de muis over de productkaart gaat. |
| 3 | detail | Close-up van sluiting, schakel of oppervlak. |
| 4 | schaalfoto | In de hand of naast een liniaal, zodat de maat duidelijk is. |
| 5 | stackfoto | Het stuk samen met andere Sparkela-stukken (een stack). |

**Formaat.** 4:5, 1600 × 2000 px, **JPEG of PNG, nooit WebP of AVIF**. Shopify zet alleen PNG en JPEG om naar JPEG, en de deelafbeelding van een productpagina (OG, zichtbaar bij delen op WhatsApp en socials) heeft een JPEG nodig; een WebP-origineel wordt daar stil een leeg vlak (beslissing 131). `npm run test:shopify` controleert de eerste foto van elk product.

**Alt-tekst.** Vul in Shopify per foto een korte beschrijving in ("Lola chunky hoops aan het oor"). Is hij leeg, dan maakt de site er "{titel}, {soort foto}" van ("Lola chunky hoops, draagfoto").

**Kleurvarianten.** Heeft een model een Goud- en een Zilver-variant, koppel dan in Shopify de packshot van elke kleur aan die variant (variantafbeelding).

**Welke modellen.** De 24 testproducten in `content/products.ts` zijn verzonnen; fotografeer de echte modellen zoals Tristan ze in Shopify zet. Bij de lancering zijn dat 24 modellen: statement oorbellen (7), armbanden (4), kettingen (3), ringen (2), subtiel en klassiek (4) en de Holiday Sparkle-drop (4, zie §4.4).

**Cadeaukaart en cadeauverpakking.** De cadeaukaart krijgt één beeld (4:5, 1600 × 2000 px, JPEG of PNG), bijvoorbeeld een vormgegeven kaart met het logo. De cadeauverpakking staat nooit in lijsten; één packshot van de verpakking is genoeg.

## 4. Sitebeeld: alle plekken

Alle bestanden staan onder `sparkela/public/`. De kolom "Bestand" is het pad vanaf `public/` (`/images/hero/hero-desktop.webp` is `public/images/hero/hero-desktop.webp`).

### 4.1 Home, Linde en de Club

| Sleutel | Bestand | Verhouding | Maat (px) | Waar | Wat fotograferen |
| --- | --- | --- | --- | --- | --- |
| `hero.desktop` | `/images/hero/hero-desktop.webp` | 16:9 | 2400 × 1350 | Home, hero vanaf 1024 px breed | Grote draagfoto, liggend. Linde rechts in beeld, oorbellen en armbanden scherp, ruimte links voor de kop. |
| `hero.mobiel` | `/images/hero/hero-mobiel.webp` | 4:5 | 1200 × 1500 | Home, hero op telefoon en tablet | Zelfde shoot als de desktopversie, staand uitgesneden. Gezicht en oorbellen in de bovenste helft. |
| `home.statement` | `/images/home/statement.webp` | 4:5 | 1200 × 1500 | Home, blok "Statement of subtiel?" | Draagfoto met grote, chunky stukken. Eén duidelijk statement, rustige achtergrond. |
| `home.subtiel` | `/images/home/subtiel.webp` | 4:5 | 1200 × 1500 | Home, blok "Statement of subtiel?" | Draagfoto met de subtiele lijn: mini hoops, fijne ketting, dun armbandje. |
| `linde.portret` | `/images/linde/portret.webp` | 4:5 | 1200 × 1500 | Home ("Over Linde") en `/over-sparkela` | Portret van Linde met haar favoriete stukken, daglicht, ontspannen. |
| `linde.wachtlijst` | `/images/linde/wachtlijst.webp` | 4:5 | 1200 × 1500 | `/wachtlijst` | Staande foto van Linde voor de wachtlijstpagina, op een donkere of rustige achtergrond. |
| `club.hero` | `/images/club/club.webp` | 4:5 | 1200 × 1500 | `/sparkela-club` | Groepsfoto of duo met sieraden, vrolijk en informeel. |

### 4.2 Shop per moment

Op de home (tegels met de naam van het moment eroverheen) en in het megamenu "Shop per moment".

| Sleutel | Bestand | Verhouding | Maat (px) | Wat fotograferen |
| --- | --- | --- | --- | --- |
| `momenten.festival` | `/images/momenten/festival.webp` | 4:5 | 1200 × 1500 | Festivalsfeer buiten, kleurige outfit, oorbellen en armbanden goed in beeld. |
| `momenten.date-night` | `/images/momenten/date-night.webp` | 4:5 | 1200 × 1500 | Avondlicht, zwarte of donkere outfit, oorbellen en ketting in focus. |
| `momenten.kantoor-maar-niet-saai` | `/images/momenten/kantoor-maar-niet-saai.webp` | 4:5 | 1200 × 1500 | Blazer of overhemd, daglicht, subtiele maar opvallende stukken. |
| `momenten.strand` | `/images/momenten/strand.webp` | 4:5 | 1200 × 1500 | Buiten in de zon, zomeroutfit, kleurige oorbellen en kralen. |
| `momenten.feestdagen` | `/images/momenten/feestdagen.webp` | 4:5 | 1200 × 1500 | Warm licht, feestelijke outfit, de stukken van Holiday Sparkle. |

### 4.3 Stacks

Op `/stacks` en waar een stack wordt uitgelicht (bijvoorbeeld de kaart in het mobiele menu). Elke foto toont de drie stukken van de stack samen gedragen, oorbellen en pols in één beeld.

| Sleutel | Bestand | Verhouding | Maat (px) | De drie stukken |
| --- | --- | --- | --- | --- |
| `stacks.goud-en-gedurfd` | `/images/stacks/goud-en-gedurfd.webp` | 4:5 | 1200 × 1500 | Chunky hoops, schakelarmband, brede bangle |
| `stacks.kleur-op-je-pols` | `/images/stacks/kleur-op-je-pols.webp` | 4:5 | 1200 × 1500 | Kleurige oorbellen, kralenarmband, schelp oorbellen |
| `stacks.kantoor-maar-niet-saai` | `/images/stacks/kantoor-maar-niet-saai.webp` | 4:5 | 1200 × 1500 | Dikke ringetjes, dun armbandje, schakelarmband |
| `stacks.holiday-stack` | `/images/stacks/holiday-stack.webp` | 4:5 | 1200 × 1500 | Ster oorbellen, glitter hoops, sparkle armband (Holiday Sparkle) |

De stukken per stack staan in `content/stacks.ts`. Verandert een stack, dan verandert de foto mee.

### 4.4 Drops

Liggend sfeerbeeld voor de droppagina `/drops/<slug>`, met de stukken van de drop. Nodig vóór de early access van die drop (Club-leden kunnen 24 uur vóór de publieke start al kijken). De data zijn voorstellen (beslissing 22) en staan in `content/drops.ts`.

| Sleutel | Bestand | Verhouding | Maat (px) | Drop | Publieke start |
| --- | --- | --- | --- | --- | --- |
| `drops.holiday-sparkle` | `/images/drops/holiday-sparkle.webp` | 16:9 | 2400 × 1350 | Holiday Sparkle | 27 november 2026 |
| `drops.love-club` | `/images/drops/love-club.webp` | 16:9 | 2400 × 1350 | Love Club | 5 februari 2027 |
| `drops.oranje-spark` | `/images/drops/oranje-spark.webp` | 16:9 | 2400 × 1350 | Oranje Spark | 9 april 2027 |
| `drops.like-mother-like-daughter` | `/images/drops/like-mother-like-daughter.webp` | 16:9 | 2400 × 1350 | Like Mother, Like Daughter | 1 mei 2027 |
| `drops.summer-spark` | `/images/drops/summer-spark.webp` | 16:9 | 2400 × 1350 | Summer Spark | 4 juni 2027 |
| `drops.main-character` | `/images/drops/main-character.webp` | 16:9 | 2400 × 1350 | Main Character | 3 september 2027 |
| `drops.vamp` | `/images/drops/vamp.webp` | 16:9 | 2400 × 1350 | Vamp | 1 oktober 2027 |
| `drops.spark-friday` | `/images/drops/spark-friday.webp` | 16:9 | 2400 × 1350 | Spark Friday | 26 november 2027 |

### 4.5 Fotostrook "Zo dragen jullie Sparkela"

Op de home: 6 tot 8 vierkante foto's, elk met een link naar het product dat erop staat. Eigen foto's, of klantfoto's met schriftelijke toestemming van de klant (bewaar die toestemming). Eén product duidelijk in beeld per foto.

| Sleutel | Bestand | Verhouding | Maat (px) | Linkt nu naar |
| --- | --- | --- | --- | --- |
| `fotostrook.01` | `/images/fotostrook/01.webp` | 1:1 | 1080 × 1080 | `lola-chunky-hoops` |
| `fotostrook.02` | `/images/fotostrook/02.webp` | 1:1 | 1080 × 1080 | `tess-schakelarmband` |
| `fotostrook.03` | `/images/fotostrook/03.webp` | 1:1 | 1080 × 1080 | `mila-color-pop` |
| `fotostrook.04` | `/images/fotostrook/04.webp` | 1:1 | 1080 × 1080 | `evi-dikke-schakelketting` |
| `fotostrook.05` | `/images/fotostrook/05.webp` | 1:1 | 1080 × 1080 | `nina-chunky-ring` |
| `fotostrook.06` | `/images/fotostrook/06.webp` | 1:1 | 1080 × 1080 | `roos-brede-bangle` |
| `fotostrook.07` | `/images/fotostrook/07.webp` | 1:1 | 1080 × 1080 | `jet-vonk-oorbellen` |
| `fotostrook.08` | `/images/fotostrook/08.webp` | 1:1 | 1080 × 1080 | `mae-mini-hoops` |

De koppeling foto → product staat in `content/home.ts` (`home.photoStrip.items`). De handles hierboven zijn die van de testproducten; zet daar de handle van het echte product dat op de foto staat.

### 4.6 Collectiebanner (optioneel)

| Sleutel | Bestand | Verhouding | Maat (px) | Waar |
| --- | --- | --- | --- | --- |
| `collecties.<handle>` | `/images/collecties/<handle>.webp` | 4:5 | 1200 × 1500 | Optioneel beeld in de banner van een collectie (bijvoorbeeld `collecties.oorbellen`) |

Deze sleutels staan nog niet in `content/assets.ts`: een collectie heeft standaard geen bannerbeeld. Wil je er één, dan voegt de ontwikkelaar de sleutel toe en zet hij hem bij de collectie in `content/collections.ts` (`bannerImage`).

## 5. Video's

Voor de videorij op de home (eigen TikTok- en Reels-content). De site speelt video nooit automatisch af; de bezoeker drukt zelf op afspelen, en pas dan laadt de video.

| Sleutel | Video | Poster (stilstaand beeld) | Verhouding | Maat (px) | Idee |
| --- | --- | --- | --- | --- | --- |
| `video.01` | `/videos/sparkela-01.mp4` | `/videos/sparkela-01-poster.webp` | 9:16 | 1080 × 1920 | Stack van drie armbanden aandoen, close-up van de pols. |
| `video.02` | `/videos/sparkela-02.mp4` | `/videos/sparkela-02-poster.webp` | 9:16 | 1080 × 1920 | Chunky hoops stylen bij een wit shirt. |
| `video.03` | `/videos/sparkela-03.mp4` | `/videos/sparkela-03-poster.webp` | 9:16 | 1080 × 1920 | Van kantoor naar date night: dezelfde outfit, andere sieraden. |
| `video.04` | `/videos/sparkela-04.mp4` | `/videos/sparkela-04-poster.webp` | 9:16 | 1080 × 1920 | Festivallook met kleurige oorbellen en kralen. |

- **Formaat:** MP4 met H.264, staand 9:16, 1080 × 1920 px. Kort (15 tot 30 seconden) en liefst onder 8 MB.
- **Poster:** een stilstaand beeld uit de video (of een eigen foto), WebP, ook 1080 × 1920 px. Die staat er zolang de video niet speelt.
- **Muziek:** alleen muziek waarvoor Sparkela een licentie heeft. Trending audio uit TikTok of Instagram mag op die platforms, maar niet automatisch op de eigen site.
- **Geen tekst die nodig is om de video te begrijpen** zonder ondertiteling: niet iedereen zet het geluid aan.

## 6. Een bestand live zetten (Tristan)

1. Exporteer het bestand op de maat en in het formaat uit de tabel.
2. Zet het onder exact die naam in `sparkela/public/` (bijvoorbeeld `public/images/hero/hero-desktop.webp`). Bij een video ook de poster.
3. Voeg de sleutel toe aan `SUPPLIED` onderaan `content/assets.ts`, bijvoorbeeld `new Set<AssetKey>(["linde.wachtlijst", "hero.desktop"])`. Zonder die sleutel blijft de placeholder staan, ook als het bestand er al is; zo komt er nooit een kapotte afbeelding online.
4. Pas zo nodig de alt-tekst van die sleutel aan in `content/assets.ts`.
5. Bekijk het lokaal met `npm run dev`, controleer de pagina op een telefoon en op een laptop, en zet de wijziging online (Vercel bouwt opnieuw).

Productfoto's gaan via Shopify (§3) en hoeven niet in `SUPPLIED`: zodra ze in Shopify staan en de webhook de site ververst, staan ze op de site.

## 7. Checklist voor Linde

- [ ] `linde.wachtlijst` (4:5, 1200 × 1500), uiterlijk 2 november
- [ ] Hero desktop (16:9, 2400 × 1350) en hero mobiel (4:5, 1200 × 1500) uit dezelfde shoot
- [ ] Portret van Linde (4:5)
- [ ] Vijf momenttegels: festival, date night, kantoor maar niet saai, strand, feestdagen (4:5)
- [ ] Statement en subtiel (4:5)
- [ ] Per model vijf productfoto's (packshot, draagfoto, detail, schaalfoto, stackfoto), 4:5, 1600 × 2000, JPEG of PNG
- [ ] Beeld voor de cadeaukaart (4:5, JPEG of PNG)
- [ ] Holiday Sparkle: dropbeeld (16:9) en de Holiday stack (4:5), vóór 24 november
- [ ] De drie andere stacks en de Club-foto (4:5)
- [ ] Na de lancering: fotostrook (1:1, 1080 × 1080) en vier video's (9:16, 1080 × 1920, met poster)
