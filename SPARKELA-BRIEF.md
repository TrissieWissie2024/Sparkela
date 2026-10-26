# SPARKELA: bouwopdracht voor Claude Code

> **Gebruik:** zet dit bestand in een lege map, open Claude Code in die map en typ:
> `Lees SPARKELA-BRIEF.md en voer de opdracht volledig uit.`
>
> **Optioneel:** leg `Sparkela_Web_Kleurenpalet.pdf` en `Sparkela_Logo_Eindconcept.pdf` in dezelfde map, en vul in §8 het pad of de URL van de CORVANE-build in. Alles wat nodig is, staat ook in deze brief.

## 0. Zo werk je
- Werk autonoom van begin tot eind. Stel geen vragen; neem redelijke aannames en noteer ze in `docs/DECISIONS.md`.
- Bouw het project in de submap `sparkela/`. Deze brief blijft in de hoofdmap.
- Werk de fases uit §9 op volgorde af en commit na elke fase (begin met `git init` als er nog geen repo is).
- Taal: alle sitecopy in het Nederlands, met een Engels woord waar dat natuurlijk is (outfit, vibe, drop). Code, comments en commits in het Engels. `README.md` en alles in `docs/` in het Nederlands.
- Gebruik dezelfde stack en mappenstructuur als CORVANE (§7), zodat beide projecten op dezelfde manier werken.

## 1. Doel
Bouw een complete, mobile-first webshop voor het sieradenmerk **Sparkela** (direct-to-consumer, verkeer vooral via Instagram, TikTok en Pinterest). Anders dan CORVANE is Sparkela een echt bedrijf: de shop gaat op vrijdag 27 november 2026 (Black Friday) live en moet dan echte bestellingen en betalingen afhandelen. Daarom draait de site als Next.js-app op Vercel met Shopify als backend (headless): producten, voorraad, kortingen, checkout en betalingen zitten in Shopify. De layout volgt CORVANE en Lashthing (§6); merk, teksten en beeld zijn van Sparkela. Het eindresultaat moet eruitzien als een volwassen, modern merk, niet als een template.

**Deadline:** alles werkt en is getest vóór donderdag 26 november 2026. Wat daarna mag, staat onder "Na de lancering" in §9.

## 2. Harde regels
Deze regels gaan boven alles in deze brief. Ze houden de shop binnen het auteurs- en merkenrecht en de Nederlandse regels voor online verkoop (ACM).

1. **Referentie, geen kopie.** Neem van lashthing.nl alleen structuur, sectievolgorde, flow en interactiepatronen over. Kopieer geen teksten, afbeeldingen, logo's, iconen, code, CSS of kleurenschema's. CORVANE is ons eigen project: de opbouw en de code mag je hergebruiken, het merk (kleuren, fonts, teksten, product) niet.
2. **Geen beeld of tekst van anderen.** Nooit productfoto's of productteksten van leverancier Yehwang of van andere webshops; dezelfde stukken worden elders ook verkocht.
3. **Geen verzonnen social proof.** Geen bedachte reviews, sterrenscores, Trustpilot-badges, klantaantallen, "X mensen bekijken dit"- of "zojuist gekocht"-meldingen. Review- en ratingcomponenten bouw je wel, maar ze tonen niets (of een nette lege staat) zolang er geen echte reviews zijn.
4. **Echte timers.** Een afteltimer hoort alleen bij een drop of actie met een vaste datum uit `content/drops.ts` of `content/offers.ts`. Nooit resetten per bezoeker of per dag; na de datum verdwijnt de timer of springt hij op "Nu live".
5. **Eerlijke prijzen.** Een doorgestreepte van-prijs alleen als die echt gold, en altijd samen met de laagste prijs van de 30 dagen ervoor. De besparing van de stack-korting ten opzichte van de losse prijs tonen mag.
6. **Claims.** In de copy alleen productspecificaties: roestvrij staal, goudlaag, afmetingen, gewicht, sluiting. "Nikkelvrij", "waterproof", "hypoallergeen" en vergelijkbare claims verschijnen alleen bij een product als die claim daar `verified: true` heeft (metafield of `content/claims.ts`). De garantie van 6 maanden op verkleuring is een belofte van Sparkela en mag overal staan.
7. **Badges.** "Bestseller" alleen via een handmatige flag. Bij de lancering staan alleen "Nieuw", "Limited" (dropstukken) en "Laatste stuks" aan; die laatste verschijnt automatisch bij een echte voorraad van 3 of minder (drempel in config).
8. **E-mailaanmelding.** De beloning is echt en komt uit config (10% welkomstcode). Iedereen krijgt dezelfde beloning en dat staat er vooraf bij. Geen vooraf aangevinkte vakjes, duidelijk waarvoor iemand zich aanmeldt, en bij elk aanmeldveld de tekst "Ja, ik wil de nieuwsbrief van Sparkela. Ben je jonger dan 16? Vraag dan eerst toestemming aan je ouder." met een link naar het privacybeleid.
9. **Geen merknamen.** Geen verwijzingen naar bestaande sieradenmerken of designers ("zoals …", "dupe van …").
10. **Herroepen, hygiëne en veiligheid.** Een herroepingsfunctie op elke pagina (§6), de hygiëneregel bij oorbellen en piercings, productveiligheidsinformatie (GPSR) op elke productpagina, en geen niet-noodzakelijke scripts vóór cookietoestemming.

## 3. Het merk
- **Naam:** Sparkela. **Taglines:** "Spark your outfit", "Made to spark", "Sieraden met een spark".
- **Wat:** chunky sieraden die een outfit afmaken: streetwear met een retro randje. Kern: statement oorbellen en opvallende armbanden, aangevuld met ringen en kettingen, plus een kleine lijn subtiele, klassieke stukken.
- **Wie:** Linde Wijnker (eigenaar, gezicht van het merk, maakt alle foto's en content) en Tristan Jas (co-eigenaar: webshop, sales en marketing). Linde is zichtbaar op de site. Verzin geen persoonlijke details; gebruik placeholders voor haar verhaal.
- **Doelgroep:** vrouwen van 16 tot 30, kern 18 tot 25. Persona Sanne (22): student of starter, haalt haar stijl van TikTok, Instagram en Pinterest, koopt stacks en limited drops, besteedt €30 tot €50.
- **Tone of voice:** je en jij, kort, warm en speels. Korte zinnen met één belofte per keer. Geen u, geen harde verkooppraat, geen rij uitroeptekens, geen lange gedachtestreepjes. Voorbeeldregels (de rest schrijf je zelf):
  - "Eén paar oorbellen. Hele outfit af."
  - "Chunky, goudkleurig en gemaakt om op te vallen."
  - "Wat balen! We sturen je vandaag nog een nieuwe."
- **Logo:** woordmerk SPARKELA in Unbounded Black (900), kapitalen, letter-spacing -0.03em. Het hele woord is horizontaal geschoren met -10° (`skewX(-10deg)`), nooit gedraaid. Een rechtopstaande vierpuntsvonk (✦) van een halve kapitaalhoogte raakt de rechterbovenhoek van de laatste A en wordt niet geschoren.
  - Kleurversies: primair bot-wit op roest; secundair roest op bot-wit; op inkt bot-wit met een roest vonk; in de header een inkt woord met een roest vonk; op olijf en leisteen woord en vonk allebei bot-wit.
  - Vrije ruimte rondom minstens de hoogte van de S. Minimaal 70 px breed; daaronder vervalt de vonk (tot 50 px). Onder 40 px gebruik je het monogram: de schuine S met vonk, voor favicon en app-icoon, nooit naast het woordmerk.
  - Niet doen: een andere hoek, uitrekken, schaduw of contour, kleuren buiten het palet.
  - Bouw: `scripts/build-logo.mjs` zet de letters uit Unbounded Black om naar paden (opentype.js, bijvoorbeeld met de statische 900-WOFF uit `@fontsource/unbounded`), past spatiëring en schuinte toe en voegt de vonk als los pad toe. Vonkpad in een vak van 100 bij 100: `M50 0 C53 35 65 47 100 50 C65 53 53 65 50 100 C47 65 35 53 0 50 C35 47 47 35 50 0 Z`. Uitvoer in `public/brand/`: `logo-inkt.svg`, `logo-botwit-op-roest.svg`, `logo-roest.svg`, `logo-botwit.svg` en `monogram-*.svg`, plus `app/icon.svg` (bot-wit S op inkt) en `app/apple-icon.png` (bot-wit S en vonk op roest). Een `<Logo>`-component rendert het logo inline met `aria-label="Sparkela"`.

## 4. Het assortiment
- **Lancering:** 24 modellen, ingekocht bij groothandel Yehwang: statement oorbellen (7), armbanden (4), kettingen (3), ringen (2), subtiel en klassiek (4) en de limited Holiday Sparkle-drop (4).
- **Prijzen:** €12,95 tot €29,95, de meeste €14,95 tot €24,95, altijd eindigend op ,95.
- **Materiaal:** roestvrij staal met een goudlaag. 6 maanden garantie op verkleuring.
- **Stack-korting:** 15% korting op armbanden en oorbellen bij 3 of meer stuks uit die twee categorieën samen (mix & match). In Shopify is dit één automatische korting.
- **Stacks:** Lindes kant-en-klare stacks van 3 stuks (in `content/stacks.ts`) met één knop "Voeg de stack toe"; de stack-korting gaat er vanzelf af.
- **Cadeauverpakking:** apart product van €1,95, als vinkje in de winkelwagen. Van 1 tot en met 31 december gratis via een automatische korting in Shopify.
- **Cadeaukaarten:** digitaal, €15, €25 of €50 (cadeaukaarten van Shopify, zonder verzending).
- **Verzenden:** PostNL brievenbuspakje, €3,95, gratis vanaf €35. Op werkdagen vóór 16.00 uur (Europe/Amsterdam) besteld, dezelfde dag verstuurd; feestdagen in config. Bij de start alleen Nederland; België staat klaar in config maar staat uit.
- **Betalen:** in de checkout van Shopify, met Shopify Payments: iDEAL | Wero, Bancontact, creditcard en Apple Pay. Klarna is optioneel.
- **Btw:** tot en met 31 december 2026 "Prijzen inclusief 21% btw". Vanaf 1 januari 2027 geldt de kleineondernemersregeling: "Sparkela maakt gebruik van de kleineondernemersregeling; er wordt geen btw berekend." De prijzen voor de klant blijven gelijk; de tekst wisselt automatisch op datum.
- **Acties** (alles in `content/offers.ts`):
  - Welkomstcode `WELKOM10`: 10% op de eerste bestelling, bij aanmelding via de popup, de Spark Finder of de Sparkela Club.
  - Lanceringsactie: van 27 tot en met 30 november 2026 een cadeautje bij elke bestelling. Linde en Tristan voegen dat zelf toe bij het inpakken, dus er komt geen product in de cart.
  - Verder weinig korting: bij acties geeft Sparkela liever een cadeautje dan een grote korting.
- **Drops** (in `content/drops.ts`): Holiday Sparkle (lancering, november en december), Love Club (februari), Oranje Spark (april), Like Mother, Like Daughter (mei), Summer Spark (juni tot augustus), Main Character (september), Vamp (oktober), Spark Friday (november). Leden van de nieuwsbrief, de Sparkela Club, krijgen 24 uur eerder toegang.
- **Placeholderdata:** zolang de echte producten nog niet in Shopify staan, werkt de site met 24 verzonnen testproducten in `content/products.ts`: verzonnen namen, prijzen op ,95, en tags en metafields volgens §7. Zet dezelfde producten ook in `data/shopify-products.csv` in het importformaat van Shopify, inclusief metafields, zodat Tristan de structuur kan importeren.

## 5. Visuele identiteit
Design tokens als CSS-variabelen en in het Tailwind-theme. Gebruik in componenten alleen deze rollen, nooit losse hexcodes.

```css
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

  /* status */
  --succes: #59634B; --succes-vlak: #E9EDE3;
  --fout: #713B32; --fout-vlak: #FBE6E2;
  --info: #344B65; --info-vlak: #E4ECF6;
}
```

Tinten per kleur (afgeleid in OKLCH; de merkkleur zelf is inkt 900, bot-wit 200, steen 600, olijf 700, roest 700 en leisteen 800). Voeg ze toe als `--roest-100` enzovoort; 50 tot 200 voor vlakken en labels, 700 tot 900 voor tekst en hover.

| Kleur | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inkt | F7F7F7 | EBEBEB | DBDBDB | C4C4C4 | A8A8A8 | 898989 | 6F6F6F | 555555 | 404040 | 171717 |
| Bot-wit | FDF6EB | F2EADE | E8E0D4 | CAC3B9 | ACA79E | 8D8882 | 716E69 | 575551 | 413F3D | 2D2B28 |
| Steen | F7F7F3 | ECEBE7 | DBDBD7 | C5C4BF | A9A8A2 | 8A8983 | 77766F | 565550 | 41403B | 2C2B28 |
| Olijf | F5F8F0 | E9EDE3 | D8DDD1 | C1C7B9 | A3AB9A | 848D79 | 69735C | 59634B | 3B4330 | 282E1E |
| Roest | FFF1ED | FBE6E2 | ECD5D0 | D9BDB7 | C29E97 | A87D75 | 916158 | 713B32 | 603028 | 461D17 |
| Leisteen | EFF8FF | E4ECF6 | D3DCE6 | BAC5D2 | 9BA9BA | 7A8B9F | 5D7187 | 415770 | 344B65 | 1B2D41 |

**Regels**
- Verhouding per pagina: ongeveer 70% bot-wit en wit, 20% inkt en steen, 10% roest, leisteen en olijf.
- Roest is de enige knopkleur: primaire knop roest met bot-wit tekst, hover `--primair-hover`. Op een roest vlak is de knop bot-wit met roest tekst.
- Leisteen is de enige linkkleur, hover roest. Op `--donker` zijn links `--tekst-op-donker`, onderstreept bij hover.
- Pagina `--pagina`; secties, banners en menu `--vlak`; kaarten, invoervelden en foto's `--kaart`; hero, aankondigingsbalk en footer `--donker`.
- Statuslabels: "Op voorraad" olijf op `--succes-vlak`; "Laatste stuks" en "Sale" roest op `--fout-vlak`; "Nieuw" leisteen op `--info-vlak`; "Limited" bot-wit op roest.
- Contrast: `--tekst-gedempt` alleen op wit of vanaf 18 px. Roest, leisteen en olijf nooit op elkaar. Op roest, leisteen en olijf komt bot-wit, nooit inkt. Controleer alle kleurcombinaties op WCAG AA.
- Focus: een ring van 2 px in `--focus` met 2 px afstand op elk interactief element; op `--donker` is de ring bot-wit.
- **Typografie** via `next/font/google` (wordt bij de build zelf gehost, de browser praat niet met Google): koppen in Unbounded 800 (H1, H2) en 700 (H3), richtmaten mobiel/desktop H1 32/48 px, H2 24/32 px, H3 18/22 px. Body en UI in Inter 400 tot 600, basis 16 px, regelhoogte 1,5. Labels in Inter 600, 12 px, kapitalen, letter-spacing 0.06em. Unbounded 900 alleen in het logo, en dat is een SVG.
- **Stijl:** de vormentaal van CORVANE in de kleuren van Sparkela: veel witruimte, grote koppen, afgeronde kaarten (16 px) met een dunne rand in `--rand`, knoppen, chips en USP's als pills, subtiele schaduwen alleen bij hover. Modern, fris en speels, met Linde als gezicht. Retro alleen als accent in de sieraden en props, niet in de vormgeving: geen filmkorrel, geen vintage letters.
- **Beeld:** geen foto's van anderen. Productfoto's komen uit Shopify; sitebeeld (hero, momenttegels, Linde, fotostrook) uit `public/images/` met vaste bestandsnamen. Tot er eigen foto's zijn: nette placeholders (vlak in `--vlak` met het label "FOTO: …" in Inter 12 px). Verhoudingen: product 4:5, draagfoto 4:5 of 3:4, hero 16:9 op desktop en 4:5 op mobiel, fotostrook 1:1, video 9:16. Schrijf `docs/ASSETS.md`: een shotlist voor Linde (packshot per model, draagfoto's op oor, pols, hals en hand, detail, schaalfoto, stacks, lifestyle per moment, een portret van Linde en 9:16-video's) met de formaten en bestandsnamen die de site verwacht, zodat alles later één op één te vervangen is.

## 6. Layout: wat CORVANE en Lashthing doen en wat Sparkela ervan maakt
Tristan houdt heel erg van de layout van CORVANE en Lashthing. Volg hun opbouw zo dicht mogelijk, in de huisstijl van Sparkela. Waar ze verschillen, bepaalt CORVANE het kader (grid, witruimte, header, productkaart, productpagina, cart drawer en footer) en levert Lashthing de extra conversieblokken (reviews met foto, quiz, FAQ, fotostrook). Ontwerp mobiel eerst (390 px) en schaal op naar desktop.

**Homepage, bovenste deel** (de opbouw van CORVANE):
1. Promobalk met actie en live timer, anders een roterende USP-balk → aankondigingsbalk in `--donker`: de actieve actie of drop uit config met een echte timer; anders roterend "Gratis verzending vanaf €35", "Vóór 16.00 besteld, vandaag verstuurd" en "6 maanden garantie op verkleuring".
2. Header met hamburger links, logo in het midden, account en winkelwagen met teller rechts → zelfde opbouw op mobiel, met zoeken en "Tas (2)". Op desktop het logo links met een horizontale nav: Nieuw, Oorbellen, Armbanden, Kettingen, Ringen, Shop per moment, Limited, Cadeaus. Shop per moment (Festival, Date night, Kantoor maar niet saai, Strand, Feestdagen) en Cadeaus (Onder €25, Stacks, Cadeaukaarten) klappen uit, zoals bij Lashthing. Sticky, en compacter bij scrollen.
3. Hero op een donkere achtergrond met groepsfoto, ratingregel, grote kop, subregel en twee USP-pills; Lashthing voegt een garantiebadge en twee knoppen toe → hero op `--donker` met een grote draagfoto (aparte uitsnede voor mobiel), kop, subregel, drie USP-pills ("Roestvrij staal met goudlaag", "Vóór 16.00 besteld, vandaag verstuurd", "Gratis verzending vanaf €35"), een garantiebadge "6 maanden garantie op verkleuring" en twee knoppen: "Shop oorbellen" en "Shop armbanden". Een ratingregel alleen bij echte reviews.
4. Leverbalk met verzenddag, landvlag en gratis-verzendgrens → dynamisch uit `content/shipping.ts`: "Vóór 16.00 besteld? Vandaag verstuurd." of "Nu besteld, maandag verstuurd.", met een NL-vlag (SVG) en de gratis-verzendgrens.
5. Productgrid met sectielabel en sorteerdropdown → "De lanceringscollectie": 8 producten met tabs per type, een sorteerdropdown en een knop naar alles. Twee kolommen op mobiel, vier op desktop.
6. Zwevende pill "kies een kaart, win een beloning" → pill linksonder "Kies je spark", die een modal opent met drie omgedraaide kaarten met een vonk. Elke kaart onthult dezelfde echte beloning (`WELKOM10`), en dat staat er vooraf bij. Eén e-mailveld met de toestemmingstekst uit §2. De pill verschijnt na 8 seconden of bij exit-intent op desktop, maximaal één keer per 7 dagen, en niet meer na een aanmelding (localStorage in try/catch).

**Lager op de homepage** (in deze volgorde, tenzij de referenties een duidelijk betere volgorde laten zien):

7. Drop-banner: roest vlak met de naam van de drop, een korte zin, een echte aftelklok en een bot-witte knop.
8. Zo werkt het (CORVANE: drie stappen met iconen) → "Zo stack je": kies je statement, stack 3 stuks met 15% stack-korting, vóór 16.00 besteld en vandaag verstuurd.
9. Carrousels met nieuw en bestsellers (Lashthing) → een swipebare carrousel "Lindes favorieten" (handmatige flag). Die wordt "Bestsellers" zodra er echte verkoopdata is.
10. Vergelijking (CORVANE: solid vs spray) → "Statement of subtiel?": twee kolommen (chunky en subtiel) met een foto, een korte, eerlijke beschrijving en een knop naar elke collectie. Geen claims.
11. Shop per moment: tegels met foto en naam (Festival, Date night, Kantoor maar niet saai, Strand, Feestdagen).
12. Quiz (CORVANE: scent finder; Lashthing: Lash Finder met 10% voor een e-mailadres) → het Spark Finder-blok (zie hieronder).
13. Reviews (CORVANE: alleen echte data plus een rij 9:16-videoplekken; Lashthing: carrousel met voornaam en foto) → een reviewcarrousel met voornaam, foto en tekst, verborgen zolang er geen echte reviews zijn, en een rij 9:16-videoplekken voor eigen TikTok- en Reels-content.
14. Fotostrook (Lashthing) → "Zo dragen jullie Sparkela": 6 tot 8 foto's van 1:1, elk met een link naar het product. Alleen eigen foto's of klantfoto's met toestemming.
15. Garantieblok, een FAQ-accordion met de vragen uit de copy-voorzet hieronder, en een teaser "Over Linde" met foto en link (CORVANE: merkverhaal-teaser).
16. Footer (CORVANE) → donker, met bovenaan de aanmelding voor de Sparkela Club, dan de kolommen Shop / Klantenservice / Sparkela / Juridisch, betaaliconen uit config, bedrijfsgegevens (naam van de vof, adres, KvK-nummer en btw-id als placeholders), socials (Instagram, TikTok, Pinterest), de btw-tekst en de link "Hier de overeenkomst herroepen". Een reviewblok erboven (Lashthing) pas als er echte reviews zijn.

**Productkaart** (CORVANE: badge, beeld met tekstoverlay, sterren, naam, prijs en quick-add) → witte kaart met een dunne rand, badge, foto 4:5 (op desktop de tweede foto bij hover), een vibe-chip als overlay, naam, een specregel ("Verguld staal · 20 mm"), prijs (bij korting met van-prijs en de laagste prijs van 30 dagen) en quick-add in roest: bij één variant direct toevoegen, anders een kleine keuzelijst. Sterren alleen bij echte reviews.

**Productpagina** (`/products/[handle]`):
- Galerij (swipen op mobiel, thumbnails op desktop, zoom): productfoto, draagfoto, detail, schaalfoto en stackfoto.
- Titel, prijs met de btw-tekst, badge, korte stylingtekst, chips voor type, vibe en moment, specificaties (materiaal, afmeting, gewicht, sluiting) en een "Statement-meter" (subtiel ↔ chunky), gemarkeerd als indicatief (CORVANE: noten als chips en intensiteitsmeters).
- Variantkiezer als swatches (bijvoorbeeld goud en zilver) of als knoppen voor ringmaten, met een ringmaatgids in een modal.
- Stack-kiezer (CORVANE: bundelkiezer met tegels en mix & match) → bij armbanden en oorbellen de tegels "Los" en "Stack van 3 (−15%)". Bij de stack kiest de klant twee andere stukken uit die categorieën, met Lindes voorgestelde stack als standaard. Toon de echte stukprijs en de besparing.
- Een vinkje voor cadeauverpakking (+€1,95).
- In winkelwagen, plus een sticky balk op mobiel zodra de knop uit beeld is.
- Leverschatting ("Vóór 16.00 besteld, vandaag verstuurd. Meestal binnen 1 tot 2 werkdagen in je brievenbus.") en een trustrij: veilig betalen met iDEAL | Wero, gratis verzending vanaf €35, 6 maanden garantie, 14 dagen bedenktijd.
- Accordions: Details en materiaal; Verzorging; Garantie; Verzenden en retourneren, bij oorbellen en piercings met de hygiëneregel ("Om hygiënische redenen kun je oorbellen alleen retourneren met ongebroken hygiënezegel."); Productveiligheid met fabrikant, importeur of verantwoordelijke in de EU, productidentificatie en waarschuwingen uit de metafields.
- "Maak de look af": 2 tot 4 producten met snel toevoegen. Daarna reviews (alleen echte) en de FAQ.

**Collectie** (`/collections/[handle]`, ook `alle`): banner met titel en korte tekst, filters op type, vibe, moment en prijs, sorteren (uitgelicht, prijs, nieuwste) en dezelfde kaarten. Optioneel tussen de producten een stylingtegel.

**Cart drawer** (CORVANE, met de melding van Lashthing): schuift in van rechts, met focus-trap, en sluit met Esc. Een voortgangsbalk naar gratis verzending ("Nog €X tot gratis verzending" of "Je verzending is gratis") met een tweede mijlpaal voor de stack-korting ("Nog 1 armband of oorbel voor 15% stack-korting"). Regels met variant, aantal-stepper en verwijderen. Een vinkje voor cadeauverpakking (in december gratis), een notitieveld voor een cadeauboodschap, een upsellrij "Maak de look af", subtotaal, totale besparing, de btw-tekst, de knop "Afrekenen" in roest, betaaliconen en een nette lege staat met links naar de collectie. Cadeaukaarten tellen niet mee voor gratis verzending of de stack-korting.

**Spark Finder** (`/spark-finder` en als blok op de homepage): drie vragen, één per scherm, met een voortgangsbalk.
1. "Wat is je vibe?" Chunky en bold, Clean en classy, Kleurrijk en speels, Retro
2. "Voor welk moment?" Festival, Date night, Kantoor maar niet saai, Strand, Feestdagen
3. "Wat zoek je?" Oorbellen, Armbanden, Kettingen, Ringen, Verras me

Resultaat: 3 tot 6 producten op basis van de tags (client-side), aangevuld met Lindes favorieten. Daarna "Krijg 10% op je eerste bestelling" met een e-mailveld en de toestemmingstekst; de antwoorden gaan als tags mee naar Shopify. Volledig te bedienen met het toetsenbord.

**Overige pagina's:** Over Sparkela (Lindes verhaal als placeholder: "Hoi, ik ben Linde. [Linde schrijft hier haar eigen verhaal.]"), Veelgestelde vragen, Verzenden en retourneren (met 14 dagen herroepingsrecht en de hygiëneregel), Herroepen, Contact, Stacks, Cadeaukaarten, Sparkela Club, drop-pagina's (`/drops/[slug]`), Zoeken, Algemene voorwaarden, Privacy, Cookies, Account (doorverwijzing naar de klantaccounts van Shopify) en 404. Juridische teksten krijgen bovenaan `TODO: laten controleren`.
- **Herroepen:** de link "Hier de overeenkomst herroepen" staat in de footer van elke pagina en opent een formulier met naam, bestelnummer, het e-mailadres voor de bevestiging en optioneel welke producten. Daarna volgt één knop "Herroeping bevestigen", zonder extra vinkjes. De klant krijgt direct een ontvangstbevestiging per e-mail met de inhoud en de datum en tijd van ontvangst; Sparkela krijgt een kopie.
- **Prelaunch:** tot `launchAt` in `content/site.ts` (27 november 2026, 00.00 uur) toont de site een wachtlijstpagina: logo, een korte belofte, een foto van Linde en de aanmelding voor de Sparkela Club ("Als eerste shoppen, plus 10% op je eerste bestelling"). De juridische pagina's en de early-access-link van de drop werken al. Met een geheime preview-link (`PRELAUNCH_BYPASS_TOKEN`) zien Linde en Tristan de hele shop. Zo kan de site meteen online om de wachtlijst te vullen.

**Copy-voorzet** (zet alles in `content/`; de rest schrijf je zelf in dezelfde toon):
- Hero: "Eén paar oorbellen. Hele outfit af." Subregel: "Chunky sieraden met een spark, gestyled door Linde."
- Drop-banner: "Holiday Sparkle. Het extra diamantje met kerst." Knop: "Bekijk de drop".
- Sparkela Club: "Als eerste bij elke drop. Plus 10% op je eerste bestelling." Knop: "Ik doe mee".
- Popup: "Kies je spark. Elke kaart geeft 10% op je eerste bestelling."
- Veelgestelde vragen:
  - *Verkleuren de sieraden?* De vaste collectie is van roestvrij staal met een goudlaag. Dat gaat lang mee, en je krijgt 6 maanden garantie op verkleuring. Wil je de goudlaag zo mooi mogelijk houden? Doe je sieraden af bij zwemmen, sporten en douchen en bewaar ze droog in het zakje.
  - *Zijn de sieraden nikkelvrij?* Bij elk product staat het materiaal. Staat er "nikkelvrij", dan heeft onze leverancier dat voor dat product bevestigd.
  - *Hoe snel heb ik mijn bestelling?* Op werkdagen vóór 16.00 uur besteld, gaat dezelfde dag met PostNL de deur uit. Meestal ligt hij binnen 1 tot 2 werkdagen in je brievenbus.
  - *Wat kost verzenden?* €3,95, en gratis vanaf €35. We versturen binnen Nederland.
  - *Hoe werkt de stack-korting?* Koop je 3 of meer armbanden of oorbellen, dan krijg je 15% korting op die stuks. Je ziet het meteen in je winkelwagen.
  - *Kan ik retourneren?* Ja, binnen 14 dagen. Oorbellen en piercings kun je om hygiënische redenen alleen retourneren met ongebroken hygiënezegel. Herroepen kan via "Hier de overeenkomst herroepen" onderaan elke pagina.
  - *Kan ik een cadeaukaart kopen?* Ja, digitaal voor €15, €25 of €50. Hij komt direct in je mail.

## 7. Techniek
- Next.js (App Router), TypeScript strict, Tailwind CSS. Toegankelijke primitives (bijvoorbeeld Radix) voor dialog, drawer, accordion en tabs; geen zware UI-kits.
- Alle content en instellingen in `content/` (`site.ts`, `navigation.ts`, `products.ts`, `stacks.ts`, `offers.ts`, `drops.ts`, `shipping.ts`, `reviews.ts`, `faq.ts`, `claims.ts`, `quiz.ts`, `home.ts`), zodat tekst aanpassen nooit componentwerk is. Juridische teksten als Markdown in `content/legal/`.
- **Commerce-laag** in `lib/commerce/` met één interface (`getProducts`, `getProduct`, `getCollection`, `search`, `getCart`, `addToCart`, `updateCart`, `removeFromCart`, `applyDiscountCode`, `getCheckoutUrl`) en twee implementaties, te kiezen met `COMMERCE_PROVIDER`:
  - `local`: data uit `content/products.ts`, de cart in React context + localStorage (in try/catch, werkt ook zonder storage) en een checkout-stub met besteloverzicht, kortingscodeveld en de melding "Demo-checkout: er wordt niet betaald". Werkt zonder sleutels.
  - `shopify`: de Storefront API (GraphQL, vaste API-versie in config) via het gratis Headless-verkoopkanaal: producten, collecties, metafields, voorraad (`quantityAvailable`), predictive search en de Cart API. De cart-ID staat in een cookie; afrekenen gaat naar `cart.checkoutUrl`, de checkout van Shopify. Met deze provider komen alle bedragen, kortingen en totalen uit de Shopify-cart; de site rekent ze niet zelf uit.
  - Productie op Vercel draait altijd met `shopify`. Zet alle variabelen in `.env.example`, onder andere `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_ADMIN_ACCESS_TOKEN` (alleen server-side), `SHOPIFY_WEBHOOK_SECRET`, `MAIL_API_KEY`, `MAIL_FROM`, `MAIL_TO` en `PRELAUNCH_BYPASS_TOKEN`.
- **Shopify-data:** tags `type:`, `vibe:`, `moment:` en `drop:`, en product-metafields in de namespace `custom`: `spec_regel`, `materiaal`, `afmetingen`, `gewicht`, `sluiting`, `verzorging`, `statement_meter` (1 tot 5), `nikkelvrij` (boolean, telt als geverifieerd), `gpsr_fabrikant`, `gpsr_verantwoordelijke_eu`, `gpsr_waarschuwingen`, `laagste_prijs_30d`, `bestseller` en `lindes_favoriet`. Schrijf in `docs/METAFIELDS.md` hoe Tristan ze aanmaakt, met Storefront-toegang aan.
- **Prijslogica** puur en getest in `lib/pricing.ts`: de totalen voor de lokale provider (stack-korting, welkomstcode, cadeauverpakking, verzendkosten) en de teksten vooraf ("nog €X tot gratis verzending", "nog 1 stuk voor 15% stack-korting"). Gebruik voor de gratis-verzendgrens dezelfde grondslag als Shopify: het subtotaal na kortingen, zonder cadeaukaarten.
- **Datumlogica** puur en getest in `lib/dates.ts`, alles in Europe/Amsterdam: de verzenddag (werkdagen, cut-off 16.00, Nederlandse feestdagen), de btw-tekst per datum, acties en drops (zichtbaarheid, early access, timers) en de prelaunch.
- **Drops:** vóór de publieke start is een drop verborgen in menu, collecties en zoeken; `/drops/[slug]` werkt al vanaf de early access (24 uur eerder) voor wie de link uit de nieuwsbrief heeft. Na de start verschijnen de banner en het label "Limited", en springt de aftelklok op "Nu live".
- **Prelaunch** wordt aan de serverkant afgehandeld, zodat de shop niet even zichtbaar is voor de wachtlijstpagina verschijnt.
- **Formulieren** als route handlers. `/api/subscribe` maakt of werkt via de Admin API van Shopify een klant bij met e-mailmarketingtoestemming en tags (`club`, `quiz:…`, `bron:popup`), zodat Shopify Email de nieuwsbrief kan sturen. `/api/herroepen` en `/api/contact` sturen e-mail via een transactionele maildienst (bijvoorbeeld Resend). Allemaal met een honeypot en een eenvoudige rate limit. Zonder sleutels tonen de formulieren het e-mailadres van Sparkela als terugval.
- **Revalidatie:** `/api/revalidate` ontvangt webhooks van Shopify (producten, voorraad, collecties), controleert de HMAC en ververst de cache met tags, zodat een wijziging in Shopify binnen een minuut op de site staat.
- **Afbeeldingen:** `next/image` met een loader die de CDN van Shopify laat schalen (`?width=`), zodat Vercel geen beeldtransformaties hoeft te doen.
- SEO: Nederlandse metadata per pagina, OG-afbeeldingen, JSON-LD (Organization, Product met `offers` en merk Sparkela, BreadcrumbList; geen `aggregateRating` zolang er geen echte reviews zijn), `sitemap.ts`, `robots.ts` en `lang="nl"`.
- Analytics: `lib/analytics.ts` met dataLayer-events (`view_item`, `add_to_cart`, `begin_checkout`, `sign_up`). Niets van derden laadt zonder cookietoestemming; de consentbanner staat alleen aan als `analytics.enabled` true is. Optioneel, na toestemming: Shopify-analytics via `@shopify/hydrogen-react`, zodat de rapporten in Shopify kloppen.
- Toegankelijkheid: WCAG 2.1 AA, zichtbare focus, volledige toetsenbordbediening, aria in carrousels, accordions en dialogs, en `prefers-reduced-motion` respecteren.
- Performance: Lighthouse mobiel 90+ voor home, collectie en productpagina; `next/image`, `next/font`, geen layout shift door balken, popups of de prelaunch.
- Tests: Vitest voor `lib/pricing.ts` en `lib/dates.ts` (onder andere vrijdag 15.59 en 16.01 uur, het weekend, 24 tot en met 26 december, de btw-wissel op 1 januari 2027, en een drop vlak voor en na de start) en voor het omzetten van Shopify-antwoorden (met opgeslagen voorbeeldresponses). Playwright-smoketests met de lokale provider: home laadt, product toevoegen, gratis-verzendbalk bij €34,90 en €35,00, stack-korting bij 2 en 3 stuks, cadeauverpakking aan en uit, actiebalk weg na `endsAt`, popup maximaal één keer, Spark Finder geeft een aanbeveling, herroepformulier valideert, prelaunch toont de wachtlijst en de preview-link werkt.

## 8. Referenties zelf bekijken
- **Lashthing:** bekijk voor je bouwt de homepage, een collectie, één productpagina en de cart drawer van lashthing.nl. Levert WebFetch te weinig op, gebruik dan Playwright met een mobiele viewport (390×844) en desktop (1440×900). Schrijf je observaties in `docs/REFERENCE.md`: alleen structuur, volgorde, interacties en conversiemechanieken, in je eigen woorden. Screenshots gaan in `reference/` (in `.gitignore`), nooit in `public/`.
- **CORVANE:** `[optioneel: pad naar de map corvane/ of de Vercel-URL van de CORVANE-build]`. Is die er, bekijk hem dan op dezelfde viewports, leg de opbouw vast in `docs/REFERENCE.md` en hergebruik componenten waar dat sneller is. Is hij er niet, dan is de beschrijving in §6 leidend.

## 9. Fases
1. Referenties bekijken → `docs/REFERENCE.md`
2. Plan → `docs/PLAN.md` (sitemap, componenten, datamodel, koppeling met Shopify); niet wachten op goedkeuring
3. Scaffold, design tokens, logo, favicon en placeholders
4. Wachtlijst: prelaunchpagina, `/api/subscribe`, toestemmingstekst en juridische placeholders. Vanaf hier kan de site live; zet in de README hoe.
5. Commerce-laag (lokaal en Shopify) en cart
6. Layout: aankondigingsbalk, header, menu, footer, cart drawer en cookiebanner
7. Homepage
8. Productkaart, collectie en productpagina
9. E-mailpopup, Spark Finder, drops, stacks, overige pagina's en formulieren
10. SEO, analytics-hooks, toegankelijkheid en performance
11. Tests en visuele controle
12. Oplevering

**Na de lancering** (eerder als er tijd over is): Spark Guide (blog uit Shopify), een review-app koppelen, een melding als iets weer op voorraad is, België aanzetten en echte klantfoto's in de fotostrook.

## 10. Klaar is pas klaar als
- `npm run lint`, `npm run typecheck` (`tsc --noEmit`), `npm run build` en alle tests slagen.
- De site volledig werkt met `COMMERCE_PROVIDER=local` zonder sleutels, en de Shopify-provider getest is met opgeslagen voorbeeldresponses (en tegen de echte winkel als `.env.local` sleutels bevat).
- Je met Playwright screenshots hebt gemaakt van home, collectie, productpagina, open cart drawer, popup, mobiel menu en de wachtlijstpagina op 390×844 en 1440×900, ze zelf hebt bekeken naast de referenties, en alles hebt opgelost wat niet strak is (overlap, afgekapte tekst, horizontale scroll, rommelige afstanden).
- `docs/COMPLIANCE.md` per regel uit §2 beschrijft hoe die in de code is afgedwongen, en je hebt gecontroleerd dat er geen tekst uit de referentie in de site staat.

## 11. Oplevering
- `README.md`: starten (`npm install`, `npm run dev`), content aanpassen, Shopify koppelen (Headless-kanaal, tokens, metafields, webhooks), deployen op Vercel (omgevingsvariabelen, domein) en de wachtlijst alvast live zetten.
- `docs/TODO-LAUNCH.md`, als stappenlijst voor Tristan:
  - Shopify Basic (het Headless-kanaal werkt niet op Starter). Het Headless-kanaal installeren, de tokens in Vercel zetten en de producten in dat kanaal publiceren.
  - Producten en foto's in Shopify (`data/shopify-products.csv` als basis), metafields met Storefront-toegang, GPSR-gegevens per product, en claims alleen als ze kloppen. De automatische collecties per tag aanmaken.
  - Verzendtarieven in Shopify gelijk aan `content/shipping.ts`: €3,95, gratis vanaf €35, alleen Nederland.
  - Kortingen in Shopify: `WELKOM10` (eenmalig per klant), de automatische stack-korting (15% vanaf 3 armbanden of oorbellen) en gratis cadeauverpakking in december. Kies welke kortingen samen mogen; advies: de welkomstcode niet samen met de stack-korting.
  - Shopify Payments met iDEAL | Wero, Bancontact, creditcard en Apple Pay; de checkout in de huisstijl (logo, kleuren) en de cookiebanner van de checkout.
  - Domein: sparkela.nl naar Vercel en een subdomein (bijvoorbeeld `shop.sparkela.nl`) naar Shopify voor de checkout. De standaard Online Store van Shopify afschermen met een wachtwoord of laten doorsturen.
  - Vercel Pro vóór de livegang: Hobby is alleen voor niet-commercieel gebruik.
  - Een maildienst met een geverifieerd afzenderdomein, en de link "Hier de overeenkomst herroepen" ook in de orderbevestiging van Shopify.
  - Shopify Email voor de nieuwsbrief, met dubbele opt-in aan.
  - Echte foto's en video's (zie `ASSETS.md`), een review-app (bijvoorbeeld Judge.me), de juridische teksten laten controleren, KvK-nummer, btw-id en adres invullen, het lanceringscadeautje en de einddatum bevestigen, en een testbestelling van begin tot eind (betalen, mails, herroepen, retour).
- `docs/DECISIONS.md`, `docs/REFERENCE.md`, `docs/PLAN.md`, `docs/METAFIELDS.md`, `docs/ASSETS.md`, `docs/COMPLIANCE.md` en `data/shopify-products.csv`.
- Eindbericht in de chat: wat er gebouwd is, welke aannames je deed en de vijf belangrijkste open punten.
