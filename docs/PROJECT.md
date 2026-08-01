# PROJECT.md — Nieuwbouwplanner

> **Rol van dit bestand:** de _vaste waarheid_. Scope, constraints, datamodel en stack.
> Dit verandert zelden. Wijzig het alleen bij een fundamentele koerswijziging, en
> leg die wijziging altijd óók vast als ADR in `docs/decisions/`.
>
> Voor "waar staan we nu" → `STATE.md`. Voor "hoe werk ik in dit project" → `WORKFLOW.md`.

---

## 1. In één zin

Een webapplicatie die kopers van een **nieuwbouwwoning (gekocht van tekening)** door het
complete traject loodst — van koop-/aannemingsovereenkomst tot en met garantietermijn — met
deadlines, meerwerk-bewaking, bouwdepot-overzicht en een opleverchecklist, waarbij documenten
wél worden ingelezen maar **nooit worden opgeslagen**.

**En daarna houdt hij niet op.** Na de sleuteloverdracht verandert dezelfde app van vorm en
wordt hij het **woningdossier**: wat er in het huis zit, wanneer het onderhouden moet worden,
en wat er al gedaan is. Eén app, twee fases, omgezet met één veld — zie ADR-0010.

## 2. Doel & afbakening

De niche is bewust smal: **nieuwbouw van tekening**, niet bestaande bouw. Dat traject is
wezenlijk anders dan een gewone woningaankoop:

- Je koopt iets dat nog niet bestaat, met een **aannemingsovereenkomst** naast een
  koopovereenkomst voor de grond.
- Er zijn **meerwerk-deadlines** gekoppeld aan bouwfases ("elektra vastleggen vóór het
  storten van de vloer, daarna kan het niet meer").
- Er is een **bouwdepot** waaruit termijnen bij de bank worden gedeclareerd.
- Er is een **oplevering met opleverpunten**, een **5%-opschortingsregeling**, een
  **onderhoudstermijn** en jarenlange **garantie** (Woningborg / SWK).

Generieke verhuis- of woningaankoop-apps dekken dit traject-vóór-de-sleutel niet.

**Gebruiker #1 is de bouwer zelf (Seth).** Werkt het voor iemand die er middenin zit, dan
werkt het voor de volgende koper. Laat het eigen traject de volgorde van features bepalen.

## 3. Harde constraints (niet onderhandelbaar)

| #   | Constraint                                                                             | Consequentie                                                                                                                         |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | **Stack:** Firebase (Auth + Firestore) + Netlify (hosting + functions), frontend React | Geen andere backend introduceren                                                                                                     |
| C2  | **Geen bestandsopslag**                                                                | Firebase Storage wordt nooit geïnitialiseerd. Documenten worden client-side gelezen; alleen geëxtraheerde velden gaan naar Firestore |
| C3  | **Gratis**                                                                             | Firebase Spark-plan, Netlify free/pro. Nooit iets bouwen dat Blaze vereist                                                           |
| C4  | **Multi-user**                                                                         | Iedereen eigen account, ziet uitsluitend eigen project(en)                                                                           |
| C5  | **Geen juridisch/financieel advies**                                                   | Termijnen zijn indicatief; disclaimer zichtbaar in de UI                                                                             |

**C2 en C3 zijn de twee die het makkelijkst per ongeluk sneuvelen.** Voordat je een package
of Firebase-service toevoegt: check of het Blaze vereist en of het bestanden persisteert.

## 4. Architectuur

### Waarom dit gratis blijft

- **Firebase Spark** levert Auth + Firestore kosteloos. Op Spark kun je géén Cloud Functions
  deployen — geen probleem, want _alle_ serverside logica draait op **Netlify Functions**.
  Firebase blijft puur Auth + database.
- **Netlify** levert hosting + serverless functions. De functions zijn stateless: ze
  ontvangen tekst, geven gestructureerde data terug, en slaan zelf niets op.

### De "parsen zonder opslaan"-flow (het technische hart)

1. Gebruiker kiest een PDF (bijv. aannemingsovereenkomst) in de browser.
2. **Client-side** extraheert `pdf.js` de tekst. Het bestand blijft in browsergeheugen.
3. Alleen de **platte tekst** gaat naar een **Netlify Function**. Die roept een LLM aan
   (API-key serverside) met de opdracht: haal termijnen, bedragen en deadlines eruit en geef
   gestructureerde JSON terug.
4. De JSON komt terug in de browser, de gebruiker **controleert en corrigeert** de gevonden
   velden, en pas dán gaan ze naar **Firestore**.
5. PDF en ruwe tekst verdwijnen zodra de tab sluit.

Dit is de AI-native kern en de moat: elk contract is anders, dus betrouwbaar de juiste
termijnen eruit halen is technisch lastig.

## 5. Datamodel (Firestore)

Alles onder de user, zodat security-rules simpel en dichtgetimmerd blijven.

```
users/{uid}
  └── projects/{projectId}
        - naam, bouwnummer, projectnaam, aannemer
        - garantiewaarborg (woningborg | swk | geen | anders)
        - koopsom, meerwerkbudget, aangemaaktOp, bijgewerktOp
        // Opleverdatum als BAND met een staat — zie ADR-0008
        - opleverStatus (indicatief | bandbreedte | aangezegd)
        - opleverVroegst, opleverVerwacht, opleverLaatst
        - opleverBron        // "mail aannemer 12-07" — wie beweerde dit, wanneer
        - opleverBronDatum
        // Het 5%-opschortingsrecht — zie ADR-0012. Geen deadline hier: die
        // volgt uit de oplevering plus de onderhoudstermijn.
        - opschortingStatus (onbekend | niet_gebruikt | in_depot | vrijgegeven)
        - opschortingBedrag, opschortingNotitie
        ├── ankers/{ankerId}          // bouwmomenten waaraan afspraken hangen
        │     - type (start_bouw | begane_grond_gestort | ruwbouw_gereed
        │             | wind_waterdicht | dekvloer_gestort | oplevering
        │             | sleuteloverdracht | einde_onderhoudstermijn)
        │     - titel, verwachtOp, status (verwacht | bevestigd | gepasseerd), bron
        ├── betrokkenen/{betrokkeneId}
        │     - naam (bedrijf), contactpersoon, email, telefoon
        │     - categorie (installatie | afbouw | tuin | verhuizing
        │                 | huidige_woning | nuts | financieel | overig)
        │     - aanlooptijdDagen        // hoeveel notice hebben ze nodig
        │     - annuleertermijnDagen    // tot wanneer kosteloos verzetten
        │     - communicatieregel (direct | bij_aanzegging | handmatig)
        │     - waardenBron (voorstel | eigen)   // ADR-0009 — zie hieronder
        │     - notitie
        ├── afspraken/{afspraakId}
        │     - betrokkeneId, omschrijving
        │     - ankerType, offsetDagen  // negatief = ervóór. NOOIT een vaste datum
        │     - duurDagen
        │     - status (concept | voorlopig | bevestigd | afgerond | vervallen)
        │     - gecommuniceerdeDatum    // wat weet deze partij nu — de kern
        │     - gecommuniceerdOp
        │     - waarschuwing            // hoort bij de afspraak, niet bij de partij
        │     - notitie
        ├── phases/{phaseId}
        │     - type (koop | notaris | financiering | bouw | oplevering | onderhoud | garantie)
        │     - titel, status (open | bezig | klaar), streefdatum, volgorde
        ├── tasks/{taskId}
        │     - titel, deadline, phaseId, status (open | klaar), bron (handmatig | geparsed)
        ├── meerwerk/{itemId}
        │     - omschrijving, bedrag, phaseId, notitie
        │     - status (overweeg | besteld | bevestigd)
        │     // De deadline kent drie vormen — zie ADR-0011
        │     - sluiting (vaste_datum | bouwmoment | onbekend)
        │     - sluitingsdatum                       // bij vaste_datum
        │     - sluitingAnkerType, sluitingOffsetDagen  // bij bouwmoment
        ├── termijnen/{termId}          // bouwdepot
        │     - omschrijving (bijv. "fundering gereed"), bedrag
        │     - gefactureerd, gedeclareerdBijBank, betaald  (booleans + datums)
        ├── gebreken/{defectId}   // opleverpunten; apart van tasks (ADR-0012)
        │     - omschrijving, locatie, gemeldOp, hersteltermijn
        │     - status (open | hersteld)
        └── nabudget/{postId}     // wat er ná de oplevering nog komt
              - omschrijving, geraamd, werkelijk, notitie
              - status (geraamd | besteld | betaald)
```

De canonieke TypeScript-definities staan in `src/types/model.ts` — **dat bestand is leidend**
zodra het bestaat. Wijk je hier vanaf, werk dan bovenstaand schema én de Firestore-rules bij.

> **De belangrijkste regel in dit model:** een afspraakdatum wordt **nooit opgeslagen**.
> Alleen `ankerType` + `offsetDagen`. De datum is altijd afgeleid. Sla je hem wel op, dan
> heb je bij elke verschuiving een migratie — precies het handwerk dat deze app wegneemt.
> Zie ADR-0008.
>
> `gecommuniceerdeDatum` is de enige uitzondering, en dat is geen inconsistentie: het is
> geen planning maar een **feit over de buitenwereld** — welke datum die partij als laatste
> van je hoorde. Het verschil met de berekende datum ís de actielijst.

> **De sluitingsdatum van meerwerk is de uitzondering die de regel bevestigt (ADR-0011).**
> Die wordt wél als vaste datum opgeslagen, omdat het een administratieve termijn van de
> aannemer is en géén bouwmoment: de keuzelijst gaat dicht vóór de start van de bouw en
> schuift niet mee als de bouw verschuift. Meerwerk dat tíjdens de bouw opkomt hangt wél aan
> een anker. Het veld `sluiting` zegt welke van de twee het is.
>
> De onderliggende regel blijft dus: **sla een datum alleen op als hij een feit over de
> buitenwereld is, niet als hij uit de planning volgt.**

> **`waardenBron` (ADR-0009).** Staat op `voorstel` zolang aanlooptijd en annuleertermijn
> uit de standaardbibliotheek komen, en op `eigen` zodra de gebruiker ze aanpast. De UI
> toont bij `voorstel` een disclaimer, bij `eigen` niet. Zonder dit veld is een schatting
> van de app niet te onderscheiden van het cijfer dat de leverancier zelf noemde — en dan
> sneuvelt constraint C5 in stilte.

## 6. Features & volgorde

> **Volgorde herzien op 2026-07-29 (ADR-0008).** De betrokkenen- en schuif-impactmodule is
> naar voren gehaald, vóór de fase-tijdlijn. Reden: dat is de acute pijn van gebruiker #1,
> en het dwingt het datamodel meteen langs het moeilijkste stuk (afgeleide datums).
>
> **Uitgebreid op 2026-07-31 (ADR-0010).** Er is een fase 4 bijgekomen: het woningdossier.
> De volledige, genummerde backlog met de afgesproken volgorde staat in
> `docs/2026-07-31-bouwplan-en-backlog.md`; onderstaande lijst is de samenvatting.

### Klaar

- [x] Gratis account aanmaken en inloggen (e-mail/wachtwoord)
- [x] Eén nieuwbouwproject aanmaken, inclusief de **opleverdatum als band** met staat
      (indicatief / bandbreedte / aangezegd)
- [x] **Betrokkenen** vastleggen met aanlooptijd, annuleertermijn en communicatieregel,
      vanuit een standaardbibliotheek (`docs/2026-07-29-betrokkenen-standaardlijst.md`)
- [x] **Bouwmomenten** (ankers) invullen met datum, hardheid en bron — `/ankers`
- [x] **Schuif-impact**: de actielijst op het dashboard, gesorteerd op urgentie, met de
      zekerheid van elke berekening en de doorgegeven-knop

### MVP — af (31 juli 2026)

- [x] **Afspraken beheren**: zien, aanpassen, toevoegen en verwijderen (A1, A2)
- [x] **Betrokkenen toevoegen en verwijderen**, inclusief contactgegevens (A3)
- [x] **Opleverdatum en projectgegevens aanpassen** buiten de wizard (A4, A7)
- [x] **Concept-berichten** bij elke regel op de actielijst (A5)
- [x] **Wat-als** bij het verschuiven van een bouwmoment (A6)
- [x] Technische schuld: `verify:rules`, één anker per type, project verwijderen,
      foutafhandeling, opruimen (B1, B2, B3, B5, B6)
- [ ] **Live zetten** (B4) — bewust uitgesteld tot na het lokale testen

### Fase 2 — het bouwtraject compleet (31 juli 2026)

- [x] Vaste **fase-tijdlijn** met per fase de standaard-actiepunten en valkuilen
- [x] Handmatig taken met deadlines toevoegen en afvinken
- [x] **Meerwerk-tracker**, met de sluitingsdatum in drie vormen (ADR-0011)
- [x] **Bouwdepot-overzicht**: gefactureerd / gedeclareerd / betaald
- [x] **Grafieken en totaalbeeld** over budget, meerwerk en depot
- [ ] **Documentparser** (sectie 4): overeenkomst inlezen → ankerpunten en afspraken

### Fase 3 — oplevering en garantie (31 juli 2026)

- [x] **Opleverchecklist** met gebreken en hersteltermijnen
- [x] **5%-opschortingsregeling**: het depot, de afgeleide termijn en de keuze (ADR-0012)
- [x] **Onderhoudstermijn** als aftelklok, afgeleid uit anker of standaardtermijn
- [x] **Garantietermijnen** Woningborg/SWK als aftelklok. Per onderdeel volgt in fase 4
- [x] **Budgetoverzicht** met de vergeten posten ná oplevering (vloer, tuin, gordijnen)

### Fase 4 — het woningdossier (ADR-0010)

- [ ] **Woningpaspoort** en `woningStatus` (in_aanbouw / opgeleverd)
- [ ] **Onderdelenregister**: merk, type, serienummer, installatiedatum, garantie
- [ ] **Onderhoudsschema** uit een standaardbibliotheek, met interval en historie
- [ ] **Terugkerende controles** (rookmelder, aardlekschakelaar, waterdruk)
- [ ] **Logboek** van onderhoud en verbouwingen
- [ ] Herinneringen via een scheduled Netlify Function — **voorwaarde** voor deze fase
- [ ] Meterstanden, overdrachtsdossier, meerdere woningen, PDF-export

## 7. Security-uitgangspunten

- Firestore-rules: **default deny**. Een gebruiker mag uitsluitend lezen/schrijven onder zijn
  eigen `users/{uid}`. Alles daarbuiten geweigerd.
- De Firebase web-config (`VITE_FIREBASE_*`) is **publiek by design**; de beveiliging zit
  volledig in de rules. Geheimen (LLM-key, mailkey) staan uitsluitend in Netlify env vars
  zónder `VITE_`-prefix, zodat ze nooit in de bundle belanden.
- Geen persoonsgegevens of documentinhoud in URL's of logs.
- Security headers via `netlify.toml` (CSP, HSTS, frame-deny, referrer-policy).

## 8. Stack (vastgesteld 2026-07-29, zie ADR-0001 t/m 0005)

| Laag          | Keuze                                                     | Versie    |
| ------------- | --------------------------------------------------------- | --------- |
| Runtime       | Node LTS "Krypton"                                        | 24        |
| Build         | Vite                                                      | 8.x       |
| UI            | React + react-dom                                         | 19.2.x    |
| Taal          | TypeScript — **6.x, bewust niet 7** (ADR-0003)            | 6.x       |
| Routing       | `react-router` (declarative mode)                         | 8.x       |
| Styling       | Tailwind CSS v4 CSS-first + `@tailwindcss/vite`           | 4.3.x     |
| Huisstijl     | `@brink/ui` (lokale kopie) + `src/styles/brink-theme.css` | —         |
| Auth + DB     | Firebase Auth + Cloud Firestore (Spark)                   | 12.x      |
| Serverless    | Netlify Functions (`.mts`) + `@netlify/vite-plugin`       | 5.x / 2.x |
| Kwaliteit     | ESLint 10 (flat) · Prettier 3 · Vitest 4                  | —         |
| Rekenkern     | `src/lib/planning.ts` — puur TypeScript, geen SDK         | —         |
| PDF-extractie | `pdf.js` (client-side) — nog toe te voegen                | —         |

**Bewust níet:** Firebase Storage, Firebase Cloud Functions, React Compiler (nog),
`react-router-dom` (EOL op 7.18.2), PostCSS/autoprefixer (overbodig met Tailwind v4),
**TypeScript 7** — `typescript-eslint` ondersteunt de native compiler niet, waardoor alle
type-aware lintregels zouden vervallen, inclusief `no-floating-promises`. Zie ADR-0003.

## 9. Bewust niet doen

- Geen opslag van originele documenten. Ooit. **Ook niet in het woningdossier**, waar de
  verleiding het grootst is (handleidingen, facturen, foto's). Wat wel mag: de gegevens
  gestructureerd overnemen plus een `documentUrl` naar waar het bestand bij de gebruiker
  staat. Zie ADR-0010 §3.
- **Niet live gaan voordat het lokaal door en door getest is.** Besloten op 2026-07-31: eerst
  alles bouwen en uitproberen tegen de Firestore-emulator, pas daarna Netlify koppelen. De
  twee dingen die de emulator níét dekt staan in `STATE.md` onder de valkuilen.
- Geen claim van juridisch of financieel advies.
- Niet beginnen met multi-project of betalingen. Eerst één project dat écht klopt.
- Geen features verzinnen die de bouwer zelf nog niet nodig had.
