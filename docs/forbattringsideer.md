# Idéer för Småbarnsmat (tastebuds-tots-tracker)

Anteckningar och förslag baserat på en genomgång av appens nuvarande flöden (Översikt, Dagbok, Smaker, Allergen).

## Snabba vinster

- **Streak/konsekvens-indikator** — "5 dagar i rad med loggad mat" kan vara en starkare motivator än totalpoäng, eftersom det är vanan (inte volymen) som är värdefull att bygga.
- **Redigera en loggad måltid** — just nu går det att ta bort en post men inte ändra den. Ett snabbt "ändra"-läge sparar en del friktion vid felskrivning.
- **Sök/filter i Dagbok** — när historiken växer blir det svårt att hitta "vad åt hon för en månad sen". Ett enkelt textfilter eller datumintervall hjälper.
- **Exportera/dela data** — en CSV- eller PDF-export av matloggen är guld värt inför ett BVC-besök eller läkarbesök, så föräldern inte behöver skrolla i appen framför sköterskan.

## Tillväxtresan

- **Visa hela resan, inte bara nästa steg** — en liten horisontell karta över alla nivåer (frö → grodd → ... → träd) ger en känsla av hur långt kvar det är, inte bara "5 till Grodd".
- **Fira nivåuppgångar** — en kort konfetti-/pulsanimation när man når en ny nivå gör att det faktiskt känns som en milstolpe, inte bara en siffra som ändras i bakgrunden.
- **Separata resor för smak vs allergen** — just nu blandas poäng från smaker, allergener och måltider i en gemensam nivå. Två separata, mindre resor (en för smaker, en för allergener) skulle göra framstegen tydligare per kategori.

## Allergen-delen

- **Datumstämpel + nästa-förslag baserat på faktiskt mellanrum** — om disclaimer säger "vänta 2–3 dagar", kan appen (utan att ge medicinska råd om *vilken* allergen) ändå räkna ut och visa "X dagar sedan senaste introduktionen" rent deskriptivt, så föräldern själv ser om de följer sitt eget tempo.
- **Möjlighet att ångra/markera "väntar fortfarande"** — om ett barn fått en mild reaktion och föräldern väntar med nästa allergen, vore en "pausad"-status (skild från "ej introducerad") bra, så listan inte ger sken av att allt är på väg in.
- **Tydligare separation av loggning vs rekommendation** — fortsätt hålla "Att tänka på"-rutan som *information*, inte ett påtvingat schema. Om ordningen i listan (1, 2, 3...) är hämtad från en specifik källa, var gärna explicit om det i UI:t ("ordning enligt [källa]") så att en förälder som fått andra instruktioner av sin BVC vet att de kan om-ordna fritt.

## Smaker

- **Gruppering kvar, men valfri** — fritextfältet är en bra lättnad jämfört med fasta kategorier, men en frivillig "tagga som frukt/grönsak/protein" hade gjort statistiken (t.ex. "mest grönsaker provade") möjlig utan att tvinga strukturen på användaren.
- **Bildstöd** — en liten emoji eller enkel ikon per smak (som ni redan gör på frö-ikonen) hade gjort listan snabbare att skumma visuellt, särskilt för en trött förälder kl. 21 på kvällen.

## Allmänt / UX

- **Offline-first / lokal cache** — om nätet är dåligt (vilket ofta är fallet när man är ute och loggar på språng) är det värt att säkerställa att inmatning inte går förlorad vid tillfälligt tapp i uppkoppling.
- **Flera vårdnadshavare** — om båda föräldrarna loggar är det värt att fundera på hur data delas/synkas mellan två telefoner, snarare än att vara bunden till en enhet.
- **Notistider** — en valfri påminnelse ("har ni loggat lunch idag?") kan hjälpa vid ojämn användning, men bör vara av som standard så det inte känns som ännu en sak att hantera.

---

*Detta är förslag, inte krav — plocka det som känns relevant för var appen är i sin utveckling.*
