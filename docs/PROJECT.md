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
        │     - omschrijving, bedrag, sluitingsdatum, phaseId
        │     - status (overweeg | besteld | bevestigd)
        ├── termijnen/{termId}          // bouwdepot
        │     - omschrijving (bijv. "fundering gereed"), bedrag
        │     - gefactureerd, gedeclareerdBijBank, betaald  (booleans + datums)
        └── gebreken/{defectId}         // oplevering
              - omschrijving, locatie, gemeldOp, hersteltermijn
              - status (open | hersteld)
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

> **`waardenBron` (ADR-0009).** Staat op `voorstel` zolang aanlooptijd en annuleertermijn
> uit de standaardbibliotheek komen, en op `eigen` zodra de gebruiker ze aanpast. De UI
> toont bij `voorstel` een disclaimer, bij `eigen` niet. Zonder dit veld is een schatting
> van de app niet te onderscheiden van het cijfer dat de leverancier zelf noemde — en dan
> sneuvelt constraint C5 in stilte.

## 6. Features & volgorde

> **Volgorde herzien op 2026-07-29 (ADR-0008).** De betrokkenen- en schuif-impactmodule is
> naar voren gehaald, vóór de fase-tijdlijn. Reden: dat is de acute pijn van gebruiker #1,
> en het dwingt het datamodel meteen langs het moeilijkste stuk (afgeleide datums).

### Klaar

- [x] Gratis account aanmaken en inloggen (e-mail/wachtwoord)

### MVP — nu aan de beurt

- [x] Eén nieuwbouwproject aanmaken, inclusief de **opleverdatum als band** met staat
      (indicatief / bandbreedte / aangezegd)
- [x] **Betrokkenen** vastleggen met aanlooptijd, annuleertermijn en communicatieregel,
      vanuit een standaardbibliotheek (`docs/2026-07-29-betrokkenen-standaardlijst.md`)
- [ ] **Afspraken** als anker + offset, met `gecommuniceerdeDatum`
- [ ] **Schuif-impact**: anker wijzigen → actielijst op urgentie, concept-berichten,
      bijgewerkte planning met een diff t.o.v. de vorige versie
- [ ] Dashboard: eerstvolgende beslismoment, wie wacht op bevestiging, waar de band knelt

### Fase 2

- [ ] Vaste **fase-tijdlijn** met per fase de standaard-actiepunten en valkuilen
- [ ] Handmatig taken met deadlines toevoegen en afvinken
- [ ] **Meerwerk-tracker** met sluitingsdatums gekoppeld aan de bouwfase
- [ ] **Bouwdepot-overzicht**: gefactureerd / gedeclareerd / openstaand
- [ ] **Documentparser** (sectie 4): overeenkomst inlezen → ankerpunten en afspraken

### Fase 3 — verdieping

- [ ] **Opleverchecklist** met gebreken, hersteltermijnen en 5%-opschortingsrecht
- [ ] **Budgetoverzicht** incl. de vergeten posten ná oplevering (vloer, tuin, gordijnen)
- [ ] Herinneringen via een scheduled Netlify Function
- [ ] Meerdere projecten per gebruiker; PDF-export (client-side gegenereerd)

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
| Taal          | TypeScript (native compiler)                              | 7.x       |
| Routing       | `react-router` (declarative mode)                         | 8.x       |
| Styling       | Tailwind CSS v4 CSS-first + `@tailwindcss/vite`           | 4.3.x     |
| Huisstijl     | `@brink/ui` (lokale kopie) + `src/styles/brink-theme.css` | —         |
| Auth + DB     | Firebase Auth + Cloud Firestore (Spark)                   | 12.x      |
| Serverless    | Netlify Functions (`.mts`) + `@netlify/vite-plugin`       | 5.x / 2.x |
| Kwaliteit     | ESLint 10 (flat) · Prettier 3 · Vitest 4                  | —         |
| Rekenkern     | `src/lib/planning.ts` — puur TypeScript, geen SDK         | —         |
| PDF-extractie | `pdf.js` (client-side) — nog toe te voegen                | —         |

**Bewust níet:** Firebase Storage, Firebase Cloud Functions, React Compiler (nog),
`react-router-dom` (EOL op 7.18.2), PostCSS/autoprefixer (overbodig met Tailwind v4).

## 9. Bewust niet doen

- Geen opslag van originele documenten. Ooit.
- Geen claim van juridisch of financieel advies.
- Niet beginnen met multi-project of betalingen. Eerst één project dat écht klopt.
- Geen features verzinnen die de bouwer zelf nog niet nodig had.
