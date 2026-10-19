# RoutePratique – webversie 1.8.0

Franse gesprekspartner voor in de auto. Je spreekt, de app toont je zin, een verbeterde versie en het antwoord, en spreekt het antwoord uit.

## Wat je nodig hebt

- Android-telefoon met Chrome
- Een gratis GitHub-account (om de app online te zetten)
- Een gratis Groq API-sleutel: maak een account op console.groq.com en kies "API Keys" → "Create API Key"
- Een Franse stem op de telefoon. Test dit in de app met "Test stem". Hoor je niets, zoek dan in de Instellingen van Android naar "spraak" → Tekst-naar-spraak-uitvoer → tandwiel naast de Google-engine → Spraakgegevens installeren → Français (France).

## 1. Online zetten via GitHub Pages

De app moet via https draaien, anders geeft Chrome geen toegang tot de microfoon.

1. Maak op github.com een nieuwe, **publieke** repository, bijvoorbeeld `routepratique`.
2. Kies "uploading an existing file" en sleep **de inhoud** van de map (index.html, app.js, logic.js, style.css, sw.js, manifest.json en de map icons) erin. De bestanden moeten in de hoofdmap van de repository staan, niet in een submap.
3. Klik op "Commit changes".
4. Ga naar Settings → Pages. Kies bij "Branch" `main` en map `/ (root)`, en klik op Save.
5. Na een minuut of twee staat de app op `https://<jouw-gebruikersnaam>.github.io/routepratique/`.

Je API-sleutel zit **niet** in de code en komt dus nooit op GitHub terecht.

## 2. Installeren op de telefoon

1. Open het adres in Chrome op je telefoon.
2. Menu (⋮) → "Toevoegen aan startscherm" → "Installeren".
3. Open RoutePratique via het icoon, tik op ⚙ en vul je Groq-sleutel in.
4. Tik op "Test verbinding" en "Test stem". Kies eventueel een andere Franse stem.
5. Stel je beginniveau in en tik op "Opslaan".

Bij de eerste start vraagt Chrome toestemming voor de microfoon. Kies "Toestaan".

## 3. Gebruik in de auto

- Koppel de telefoon via Bluetooth, kies een thema en tik op **Start gesprek** vóór je vertrekt.
- Daarna verloopt alles met spraak. Laat de app op het scherm staan; het scherm blijft aan.
- Gesproken commando's (kort uitspreken):
  - "Répète" of "Pardon ?" – herhaalt het laatste antwoord
  - "Plus lentement" – trager spreken en herhalen
  - "Pause" – pauzeren
  - "On arrête" of "Stop" – sessie beëindigen, het verslag verschijnt
  - "À moi de poser les questions" – jij stelt voortaan de vragen
  - "À toi de poser les questions" – Camille stelt weer de vragen
- Na de sessie toont het verslag je correcties onder "Om te herhalen" en het volledige gesprek. Met ⧉ kopieer je het als tekst.

## Spraakherkenning zonder biepjes

Standaard neemt de app je stem zelf op en laat ze uitschrijven door Whisper bij Groq (zelfde API-sleutel). Er zijn dan geen biepjes, en de app bepaalt zelf wanneer je zin af is (zie Denkpauze).

- Bij de start vraagt Chrome één keer toegang tot de microfoon: kies Toestaan.
- De smalle balk onder "Luistert…" toont of de microfoon je hoort; groen = stem herkend.
- Na je zin verschijnt kort "Verwerkt je zin…" (opsturen en uitschrijven, meestal minder dan een seconde).
- Volgens de documentatie van Groq kan je ongeveer 8 uur spraak per dag laten uitschrijven; elke zin telt minstens 10 seconden mee.
- Bij ⚙ › Spraakherkenning kan je terug naar "Google in Chrome" (met biepjes). Lukt de eigen opname niet, dan schakelt de app vanzelf over op Google.

## Gespreksvorm: wie stelt de vragen?

Op het startscherm kies je bij **Gespreksvorm**:

- **Afwisselend** (standaard): Camille stelt niet elke beurt een vraag, vertelt ook zelf iets en nodigt je geregeld uit om haar iets te vragen.
- **Ik stel de vragen**: jij leidt het gesprek. Camille beantwoordt je vragen uitgebreid en vraagt normaal niets terug. Weet je niet wat te vragen, dan stelt ze een onderwerp voor.
- **Camille stelt de vragen**: zoals in de eerste versies.

In elke vorm beantwoordt Camille jouw vragen eerst volledig. Ze heeft een eigen leven in Frankrijk (werk, gezin, hobby's) waarover je haar vragen kunt stellen; ze blijft daarin consequent binnen een gesprek. Ook taalvragen kan je stellen, bijvoorbeeld "Comment on dit 'file' en français ?".

## Humor

Bij Instellingen (⚙) kies je bij **Humor** hoeveel Camille lacht en grapt: **Af en toe** (standaard, ongeveer één beurt op vier), **Veel** (ongeveer om de beurt) of **Uit**. De humor is licht en vriendelijk en past bij je niveau: eenvoudige overdrijving op A1–A2, ook woordspelingen en uitdrukkingen vanaf B1. Camille lacht nooit met je fouten en maakt geen grappen in de correctie. Maak je zelf een grapje, dan speelt ze mee.

## Mannelijke en vrouwelijke stem

Bij Instellingen (⚙) kies je apart een stem voor **de vragen** en voor **de verbetering**: Vrouw of Man. Standaard stelt een vrouwenstem de vragen en zegt een mannenstem de verbetering, zodat je het verschil meteen hoort. Met "Test stem" hoor je beide na elkaar.

Chrome op Android laat een webapp niet kiezen tussen de verschillende Google-stemmen; de app gebruikt de Franse standaardstem van je toestel en bootst het andere geslacht na door de toonhoogte aan te passen. Dat klinkt iets minder natuurlijk dan een echte stem.

- Vul bij **Deze stem klinkt standaard** in wat je hoort bij een normale toonhoogte (Google: standaard vrouwelijk).
- Wil je een echte mannenstem voor de vragen: kies in Android bij Tekst-naar-spraak-uitvoer › tandwiel › Frans een mannelijke stem, zet "Deze stem klinkt standaard" op Mannelijk en de stem voor de vragen op Man. De vrouwenstem wordt dan nagebootst.

Camille is in het Frans een naam voor zowel mannen als vrouwen. Kies je een mannenstem voor de vragen, dan spreekt Camille ook als man over zichzelf (je suis content, je suis allé).

## Correctie voorlezen

Bij Instellingen (⚙) kies je bij **Correctie voorlezen** wat er gebeurt als je een fout maakt:

- **Verbeterde zin voorlezen** (standaard): Camille zegt eerst "On dit plutôt : …" met de juiste zin en geeft daarna haar antwoord.
- **Verbeterde zin + uitleg (Nederlands)**: na de verbeterde zin volgt de korte uitleg met een Nederlandse stem. Daarvoor moet een Nederlandse stem geïnstalleerd zijn (Tekst-naar-spraak-uitvoer › Spraakgegevens installeren › Nederlands). Zonder Nederlandse stem wordt de uitleg overgeslagen.
- **Niet voorlezen**: de verbeterde zin staat alleen op het scherm en in het verslag; Camille verwerkt de juiste vorm dan ongemerkt in haar antwoord.

## Denkpauze

Bij Instellingen (⚙) stel je met **Denkpauze** in hoelang de app wacht als je stilvalt, voordat ze je antwoord als afgerond beschouwt (1 tot 8 seconden, standaard 2,5). Wil je midden in een zin kunnen nadenken, zet ze dan hoger. Hoelang de app wacht voordat je begint te spreken, is onbeperkt.

## Opnieuw beginnen

Bij Instellingen (⚙) wist de knop **Opnieuw beginnen** alle verslagen, de statistieken en de niveaugeschiedenis. Je start op het niveau dat in het keuzemenu staat. API-sleutel, stem en spreeksnelheid blijven behouden. Met **Alleen verslagen wissen** verwijder je enkel de verslagen.

## Niveau-aanpassing

Het taalmodel geeft elke beurt een score. Na zes sterke beurten (gemiddeld 80 % of meer) stijgt het niveau; na vier zwakke beurten (35 % of minder) daalt het. Je kunt dit uitschakelen bij Instellingen.

## Updates

Vervang de bestanden in de GitHub-repository (Add file › Upload files, of rechtstreeks via https://github.com/<gebruikersnaam>/routepratique/upload/main). Controleer op github.com dat app.js het nieuwe versienummer bevat en wacht tot de publicatie klaar is (tabblad Actions, groen vinkje). Open daarna de app op de telefoon: vanaf versie 1.2.1 haalt ze de nieuwe versie automatisch op en herlaadt ze zichzelf. Het versienummer staat onderaan bij Instellingen.

## Gekende beperkingen

- Zonder mobiele data werkt de app niet: zowel de spraakherkenning als het taalmodel lopen via internet.
- Verlaat de app het scherm (ander venster, scherm vergrendeld), dan pauzeert ze. Tik op "Hervat".
- Met "Google in Chrome" laat Android bij elke luisterbeurt een kort geluidje horen; dat kan een webapp niet uitschakelen. Gebruik daarom de standaard "Eigen opname + Whisper".
- **Nog te testen op de Moto G84:** hoe goed de eigen opname werkt met de microfoon van de auto (Bluetooth) en bij veel rijgeluid. Pikt de balk je stem niet op of ziet hij rijgeluid als spraak, meld het dan.
- **Nog te testen op de Moto G84:** of Chrome de Bluetooth-microfoon van de auto gebruikt of de microfoon van de telefoon. Werkt de herkenning slecht, leg de telefoon dan dichter bij je of controleer de Bluetooth-instellingen voor "Telefoongesprekken".
- De denkpauze gebruikt de continue spraakherkenning van Chrome. Op Android stuurt die na elk woord de volledige zin tot dan toe door en verbetert ze soms de laatste woorden. Vanaf versie 1.3.1 voegt de app die stukken samen zonder herhalingen. Zie je toch nog herhalingen in "Jouw zin", meld het dan met een voorbeeld uit het verslag.
- Groq stopt geregeld met oudere modellen. Meldt de app dat het model niet meer bestaat, kies dan bij Instellingen een ander taalmodel (zie console.groq.com/docs/models). Standaard: openai/gpt-oss-120b.
- De gratis limieten van Groq kunnen wijzigen. Bij een limietmelding wacht de app even en probeert opnieuw.
