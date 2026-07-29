# CONTEXT.md — startprompt voor een nieuwe chat

> **Rol van dit bestand:** dit is wat je als **eerste bericht** in een nieuwe Claude- of
> Claude Code-sessie plakt. Daarmee is de nieuwe chat in één keer volledig op de hoogte,
> zonder dat jij hoeft uit te leggen wat er de vorige keer gebeurde.

---

## Startprompt — kopieer alles tussen de streepjes

---

Ik werk aan **Nieuwbouwplanner**, een webapp voor kopers van een nieuwbouwwoning.
De projectmap is `09 - Brink Multimedia/Nieuwbouwplanner/`.

Dit project heeft een vast documentatiesysteem. **Lees eerst deze bestanden, in deze
volgorde, voordat je iets voorstelt of bouwt:**

1. `docs/PROJECT.md` — scope, harde constraints, datamodel, stack (de vaste waarheid)
2. `docs/STATE.md` — waar we nu staan en wat de direct volgende stap is
3. `docs/WORKFLOW.md` — de spelregels, inclusief jouw bijwerkplicht aan het eind
4. `docs/decisions/` — de ADR's die raken aan waar we mee bezig zijn
5. `docs/sessions/` — het laatste sessielog
6. `../AGENTS.md` — de onwrikbare huisstijlregels van de werkruimte

Bevestig daarna kort in eigen woorden:

- wat de direct volgende stap is volgens `STATE.md`
- welke constraints uit `PROJECT.md` §3 van toepassing zijn op die stap
- of er open vragen in `STATE.md` staan die eerst een beslissing van mij nodig hebben

Ga pas daarna bouwen. Aan het eind van de sessie werk je verplicht `STATE.md` bij en schrijf
je een sessielog in `docs/sessions/`, conform `WORKFLOW.md` §2.

---

## Toelichting (niet meeplakken)

### Waarom dit werkt

De drie bestanden vullen elkaar aan en overlappen niet:

| Bestand | Beantwoordt | Verandert |
|---|---|---|
| `PROJECT.md` | Wát bouwen we, onder welke regels | Zelden |
| `STATE.md` | Waar staan we, wat nu | Elke sessie |
| `decisions/` | Waaróm is het zo | Bij elke keuze, nooit met terugwerkende kracht |

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
