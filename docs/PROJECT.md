# PROJECT.md — Nieuwbouwplanner

> **Rol van dit bestand:** de *vaste waarheid*. Scope, constraints, datamodel en stack.
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

| # | Constraint | Consequentie |
|---|---|---|
| C1 | **Stack:** Firebase (Auth + Firestore) + Netlify (hosting + functions), frontend React | Geen andere backend introduceren |
| C2 | **Geen bestandsopslag** | Firebase Storage wordt nooit geïnitialiseerd. Documenten worden client-side gelezen; alleen geëxtraheerde velden gaan naar Firestore |
| C3 | **Gratis** | Firebase Spark-plan, Netlify free/pro. Nooit iets bouwen dat Blaze vereist |
| C4 | **Multi-user** | Iedereen eigen account, ziet uitsluitend eigen project(en) |
| C5 | **Geen juridisch/financieel advies** | Termijnen zijn indicatief; disclaimer zichtbaar in de UI |

**C2 en C3 zijn de twee die het makkelijkst per ongeluk sneuvelen.** Voordat je een package
of Firebase-service toevoegt: check of het Blaze vereist en of het bestanden persisteert.

## 4. Architectuur

### Waarom dit gratis blijft

- **Firebase Spark** levert Auth + Firestore kosteloos. Op Spark kun je géén Cloud Functions
  deployen — geen probleem, want *alle* serverside logica draait op **Netlify Functions**.
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

## 6. Features & volgorde

### MVP

- [ ] Gratis account aanmaken en inloggen (e-mail/wachtwoord; Google-login later)
- [ ] Eén nieuwbouwproject aanmaken met basisgegevens
- [ ] Vaste **fase-tijdlijn** met per fase de standaard-actiepunten en valkuilen
- [ ] Handmatig taken met deadlines toevoegen en afvinken
- [ ] Dashboard: eerstvolgende deadline, wat loopt achter

### Fase 2 — het onderscheidende

- [ ] **Meerwerk-tracker** met sluitingsdatums gekoppeld aan de bouwfase
- [ ] **Bouwdepot-overzicht**: gefactureerd / gedeclareerd / openstaand
- [ ] **Documentparser** (sectie 4): overeenkomst inlezen → termijnen in de tijdlijn

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

| Laag | Keuze | Versie |
|---|---|---|
| Runtime | Node LTS "Krypton" | 24 |
| Build | Vite | 8.x |
| UI | React + react-dom | 19.2.x |
| Taal | TypeScript (native compiler) | 7.x |
| Routing | `react-router` (declarative mode) | 8.x |
| Styling | Tailwind CSS v4 CSS-first + `@tailwindcss/vite` | 4.3.x |
| Huisstijl | `@brink/ui` (lokale kopie) + `src/styles/brink-theme.css` | — |
| Auth + DB | Firebase Auth + Cloud Firestore (Spark) | 12.x |
| Serverless | Netlify Functions (`.mts`) + `@netlify/vite-plugin` | 5.x / 2.x |
| Kwaliteit | ESLint 10 (flat) · Prettier 3 · Vitest 4 | — |
| PDF-extractie | `pdf.js` (client-side) — nog toe te voegen | — |

**Bewust níet:** Firebase Storage, Firebase Cloud Functions, React Compiler (nog),
`react-router-dom` (EOL op 7.18.2), PostCSS/autoprefixer (overbodig met Tailwind v4).

## 9. Bewust niet doen

- Geen opslag van originele documenten. Ooit.
- Geen claim van juridisch of financieel advies.
- Niet beginnen met multi-project of betalingen. Eerst één project dat écht klopt.
- Geen features verzinnen die de bouwer zelf nog niet nodig had.
