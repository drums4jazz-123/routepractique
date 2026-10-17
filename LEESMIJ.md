# RoutePratique – webversie 1.1.0

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
- Na de sessie toont het verslag je correcties onder "Om te herhalen" en het volledige gesprek. Met ⧉ kopieer je het als tekst.

## Niveau-aanpassing

Het taalmodel geeft elke beurt een score. Na zes sterke beurten (gemiddeld 80 % of meer) stijgt het niveau; na vier zwakke beurten (35 % of minder) daalt het. Je kunt dit uitschakelen bij Instellingen.

## Updates

Vervang de bestanden in de GitHub-repository. Sluit de app op de telefoon volledig en open ze opnieuw; de nieuwe versie wordt dan geladen.

## Gekende beperkingen

- Zonder mobiele data werkt de app niet: zowel de spraakherkenning als het taalmodel lopen via internet.
- Verlaat de app het scherm (ander venster, scherm vergrendeld), dan pauzeert ze. Tik op "Hervat".
- Chrome laat bij elke luisterbeurt een kort geluidje horen. Dat is standaardgedrag van Android en kan de app niet uitschakelen.
- **Nog te testen op de Moto G84:** of Chrome de Bluetooth-microfoon van de auto gebruikt of de microfoon van de telefoon. Werkt de herkenning slecht, leg de telefoon dan dichter bij je of controleer de Bluetooth-instellingen voor "Telefoongesprekken".
- **Nog te testen:** hoe snel de spraakherkenning stopt na een korte stilte. Bij lange denkpauzes kan je zin halverwege worden afgebroken.
- Groq stopt geregeld met oudere modellen. Meldt de app dat het model niet meer bestaat, kies dan bij Instellingen een ander taalmodel (zie console.groq.com/docs/models). Standaard: openai/gpt-oss-120b.
- De gratis limieten van Groq kunnen wijzigen. Bij een limietmelding wacht de app even en probeert opnieuw.
