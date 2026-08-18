# CONTEXT.md — startprompt voor een nieuwe chat

> **Rol van dit bestand:** dit is wat je als **eerste bericht** in een nieuwe Claude- of
> Claude Code-sessie plakt. Daarmee is de nieuwe chat in één keer volledig op de hoogte,
> zonder dat jij hoeft uit te leggen wat er de vorige keer gebeurde.

---

## Startprompt — kopieer alles tussen de streepjes

---

Ik werk aan **Nieuwbouwplanner**, een webapp voor kopers van een nieuwbouwwoning.
De projectmap is `C:\dev\projecten\Brink Multimedia - main folder\Nieuwbouwplanner`.

Dit project heeft een vast documentatiesysteem. **Lees eerst deze bestanden, in deze
volgorde, voordat je iets voorstelt of bouwt:**

1. `AGENTS.md` — de leesvolgorde en de vijf fouten die het vaakst gemaakt worden
2. `CLAUDE.md` — **wat je in een AI-sandbox wél en níét kunt draaien.** Lees dit vóór je een
   commando uitvoert; `tsc --noEmit` controleert in dit project bijvoorbeeld niets
3. `docs/PROJECT.md` — scope, harde constraints, datamodel, stack (de vaste waarheid)
4. `docs/STATE.md` — waar we nu staan en wat de direct volgende stap is
5. `docs/WORKFLOW.md` — de spelregels, inclusief jouw bijwerkplicht aan het eind
6. `docs/decisions/` — de ADR's die raken aan waar we mee bezig zijn (lees in elk geval de
   index in `decisions/README.md`)
7. `docs/archief/sessions/` — het laatste sessielog
8. `../AGENTS.md` — de onwrikbare huisstijlregels van de werkruimte

**Werk je aan ronde 9?** Lees dan óók `docs/archief/2026-08-01-bevindingen-live-test.md` en
**ADR-0017**. De volgorde uit het bouwplan is herzien: eerst bruikbaarheid en bugs, daarna pas
blok F en de documentparser.

Bevestig daarna kort in eigen woorden:

- wat de direct volgende stap is volgens `STATE.md`
- welke constraints uit `PROJECT.md` §3 van toepassing zijn op die stap
- of er open vragen in `STATE.md` staan die eerst een beslissing van mij nodig hebben
- welke commando's je zélf kunt draaien en welke ik lokaal moet doen

Ga pas daarna bouwen. Bij een taak van meerdere stappen: eerst een kort plan, wachten op mijn
akkoord, dán uitvoeren.

Aan het eind van de sessie werk je verplicht `STATE.md` bij en schrijf je een sessielog in
`docs/archief/sessions/`, conform `WORKFLOW.md` §2. Sluit af met een verificatiepass — die heeft in
sessie 06 en 07 elke keer echte bugs gevonden die bij het bouwen niet opvielen.

Wijzig je het opslagformaat, voeg dan een migratiestap toe in `src/migrations/`. Groene
`rules:test` betekent níét dat de rules in productie staan.

---

## Toelichting (niet meeplakken)

### Waarom dit werkt

De drie bestanden vullen elkaar aan en overlappen niet:

| Bestand | Beantwoordt | Verandert |
|---|---|---|
| `PROJECT.md` | Wát bouwen we, onder welke regels | Zelden |
| `STATE.md` | Waar staan we, wat nu | Elke sessie |
| `decisions/` | Waaróm is het zo | Bij elke keuze, nooit met terugwerkende kracht |
| `../CLAUDE.md` | Waar draait het, en wat kan ik uitvoeren | Bij een omgevings- of versiewijziging |

Een nieuwe chat die deze drie leest, weet net zoveel als de vorige — zonder dat de
volledige gespreksgeschiedenis nodig is.

### Als je maar één ding kunt plakken

Plak dan `STATE.md`. Die verwijst door naar de rest en bevat de volgende stap.

### Bij een grote refactor of koerswijziging

Vraag de nieuwe sessie expliciet om éérst een ADR te schrijven met de afweging, en pas te
bouwen nadat jij die hebt goedgekeurd. Anders verdwijnt de reden achter de wijziging.

### Waar dit systeem stukgaat

- **Sessie eindigt abrupt** (crash, context vol) → `STATE.md` is niet bijgewerkt en de
  volgende sessie denkt dat er niets gebeurd is. Tegenmaatregel: laat `STATE.md` óók
  halverwege bijwerken bij langere sessies, niet alleen aan het eind.
- **STATE.md groeit uit tot logboek** → hij wordt te lang om te lezen en verliest zijn nut.
  Geschiedenis hoort in `sessions/`. Houd `STATE.md` onder ± één scherm.
- **ADR's worden overgeslagen omdat "het maar een kleine keuze was"** → drie sessies later
  weet niemand meer waarom iets zo is. Bij twijfel: schrijf hem.
- **Alle controle zit op "klopt het" en geen enkele op "werkt het".** Acht sessies lang zijn de
  verificatiepasses langs typecheck, tests en rules gegaan zonder ooit vast te stellen of de
  app prettig te gebruiken is. Dat bleek in tien minuten live testen (ADR-0017). Tegenmaatregel:
  laat Seth elke twee rondes de app écht gebruiken, niet alleen de gate draaien.
