# Complete Deep Audit Report (A tot Z) — Gemini 3.6 Flash

**Datum**: 2026-08-01  
**Model**: Gemini 3.6 Flash (High)  
**Scope**: Volledige repository (`src/`, `firebase/`, `netlify/`, `docs/`, `package.json`, `netlify.toml`)

---

## 📋 Directiesamenvatting

Deze diepgaande audit brengt de volledige staat van **Nieuwbouwplanner** in kaart. De applicatie is architectonisch strak opgezet (geen Firebase Storage, geen Cloud Functions, react-router v8, Tailwind v4 CSS-first), maar kent een aantal kritieke verbeterpunten op het gebied van **foutafhandeling**, **beveiliging van de database**, **performance bij route-overgangen** en **onuitgevoerde core-features**.

---

## 🔍 Bevindingenoverzicht (A tot Z)

### 1. Correctheid & Bugs (BUG)
- **[BUG-01] Ontbreken van globale React Error Boundaries**  
  *Locatie*: `src/App.tsx`  
  *Impact*: Bij een onverwachte fout in een diepe component crasht de gehele applicatie naar een wit scherm (White Screen of Death) zonder dat de gebruiker de pagina kan herladen of feedback krijgt.

### 2. Beveiliging & Dependencies (SEC / DEP)
- **[SEC-01] Veld-validatie ontbreekt in Firestore Rules (`keys().hasOnly()`)**  
  *Locatie*: `firebase/firestore.rules`  
  *Impact*: Hoewel het maximaal aantal velden begrensd is (`withinSizeLimit`), wordt op de meeste collecties niet gecontroleerd welke veldnamen geschreven mogen worden. Dit stelt kwaadwillende of kapotte clients in staat om onbeperkt grote base64 blobs op te slaan in willekeurige velden, wat de databasekosten opdrijft.
- **[DEP-01] Handmatige dependency overrides in `package.json`**  
  *Locatie*: `package.json:27` (`brace-expansion`, `sharp`)  
  *Impact*: Oude overrides kunnen de installatie van nieuwere, beveiligde pakketversies blokkeren of onverwacht gedrag veroorzaken.

### 3. Developer Experience & Tooling (DX)
- **[DX-01] Netlify deploys negeren verification scripts**  
  *Locatie*: `netlify.toml:7`  
  *Impact*: Het bouwcommando is ingesteld op `npm run build` in plaats van `npm run verify`. Code met TypeScript- of linting-fouten kan hierdoor zonder waarschuwing naar productie worden uitgerold.
- **[DX-02] Geen geautomatiseerde Git pre-commit hooks**  
  *Locatie*: Repository root  
  *Impact*: Ontwikkelaars en AI-agents kunnen code committen zonder dat `npm run verify` automatisch wordt afgedwongen.

### 4. Architectuur & Tech Debt (TECH-DEBT)
- **[TECH-01] Dubbele data-fetching en gebrek aan caching**  
  *Locatie*: `src/routes/Dashboard.tsx`, `Afspraken.tsx`, `Onderdelen.tsx`, etc.  
  *Impact*: Elke route-pagina voert bij het mounten via `useEffect` zijn eigen query's uit om het project en alle subcollecties op te halen. Navigeren tussen tabbladen triggert telkens weer volledige Firestore sweeps.
- **[TECH-02] God-object route bestanden**  
  *Locatie*: `src/routes/Onderdelen.tsx` (~900 regels)  
  *Impact*: Layout, lijsten, formulier-state en complexe datumberekeningen zitten in één bestand. Wijzigingen in een formulier-input triggeren herberekeningen van de hele pagina.
- **[TECH-03] Handmatige en niet-gestandaardiseerde formuliervalidatie**  
  *Locatie*: `src/routes/Afspraken.tsx` e.a.  
  *Impact*: Losse `if`-statements voor validatie (`controleer()`) lopen het risico af te wijken van de Firestore security rules en TypeScript types.

### 5. Performance (PERF)
- **[PERF-01] Ontbreken van route-based code splitting**  
  *Locatie*: `src/App.tsx:6-23`  
  *Impact*: Alle 18 route-componenten worden statisch geïmporteerd, wat leidt tot een groot initiële JS bundle.
- **[PERF-02] Niet-gecachete en sequentiële netwerkoperaties**  
  *Locatie*: `src/lib/projecten.ts` & `src/lib/firebase.ts`  
  *Impact*: Bij het verwijderen van een project worden 12 subcollecties na elkaar (sequentieel) opgehaald. Tevens staat Firestore offline persistence niet ingeschakeld.

### 6. Toekomstige Richting & Core Features (DIR)
- **[DIR-01] Documentparser voor contractinlezing (C5)**  
  *Locatie*: `docs/PROJECT.md:65` & `netlify/functions/`  
  *Impact*: De "parsen zonder opslaan" AI-feature is nog niet geïmplementeerd.
- **[DIR-02] Automatische e-mailherinneringen voor onderhoud**  
  *Locatie*: `docs/STATE.md:148` & `netlify/functions/`  
  *Impact*: Gebruikers krijgen alleen herinneringen als ze de web-app openen.

---

## 🗂️ Uitvoeringsvolgorde & Status van de Plannen

| Plan | Titel | Prioriteit | Effort | Categorie | Status |
|------|-------|------------|--------|-----------|--------|
| 001  | BUG-01: Globale Error Boundaries | P1 | S | bug | TODO |
| 002  | SEC-01: Firestore Veld-validatie (`keys().hasOnly()`) | P1 | M | security | TODO |
| 003  | DX-01: Netlify Build Verification Script | P1 | S | dx | TODO |
| 004  | TECH-01: Gecentraliseerde Data Caching Hook | P2 | M | tech-debt | TODO |
| 005  | TECH-02: Opsplitsen van God-object Routes | P2 | L | tech-debt | TODO |
| 006  | TECH-03: Zod Formuliervalidatie Schema's | P2 | M | tech-debt | TODO |
| 007  | PERF-01: Memoïzatie van Zware Berekeningen | P2 | S | perf | TODO |
| 008  | PERF-02: Concurrent Subcollection Reads & Offline Cache | P2 | S | perf | TODO |
| 009  | DIR-01: Contract Documentparser (PDF + LLM) | P3 | L | direction | TODO |
| 010  | DIR-02: E-mailherinneringen voor Onderhoud | P3 | M | direction | TODO |
