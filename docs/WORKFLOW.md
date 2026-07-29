# WORKFLOW.md — spelregels voor dit project

> **Rol van dit bestand:** hoe er in dit project gewerkt wordt, door mens én AI.
> Dit is het bestand dat voorkomt dat kennis tussen chats wegvalt.

---

## 1. Leesvolgorde bij elke nieuwe sessie

Verplicht, in deze volgorde, vóórdat er ook maar één regel code wordt geschreven:

1. `docs/PROJECT.md` — wat bouwen we en onder welke constraints
2. `docs/STATE.md` — waar staan we nu en wat is de volgende stap
3. `docs/decisions/` — alleen de ADR's die raken aan wat je gaat doen
4. `docs/sessions/` — alleen de laatste 1–2 sessielogs

`docs/CONTEXT.md` bevat een kant-en-klare startprompt die dit afdwingt. Plak die als eerste
bericht in een nieuwe chat.

## 2. Bijwerkplicht (het belangrijkste onderdeel)

| Gebeurtenis | Werk dit bij | Wanneer |
|---|---|---|
| Sessie afgerond | `STATE.md` | **Altijd**, aan het eind |
| Sessie afgerond | `docs/sessions/YYYY-MM-DD-sessie-NN.md` | **Altijd**, aan het eind |
| Architectuur- of stackkeuze gemaakt | nieuwe ADR in `docs/decisions/` | Direct |
| Scope, constraint of datamodel gewijzigd | `PROJECT.md` **én** een ADR | Direct |
| Feature afgerond | vinkje in `PROJECT.md` §6 + `STATE.md` | Direct |

**Een sessie die eindigt zonder bijgewerkte `STATE.md` is een sessie die de volgende chat
niet kan overnemen.** Dit is de enige regel die nooit overgeslagen mag worden.

## 3. STATE.md — hoe die eruitziet

`STATE.md` is kort en actueel, geen logboek. Hij bevat:

- **Waar staan we** — één alinea
- **Klaar** — afgerond en geverifieerd
- **In uitvoering** — halfaf werk, incl. welke bestanden erbij horen
- **Direct volgende stap** — concreet genoeg om blind te beginnen
- **Open vragen / blokkades** — wachtend op een beslissing van Seth
- **Bekende valkuilen** — dingen die eerder misgingen; niet opnieuw in trappen

Wat er níet in hoort: geschiedenis. Die staat in `sessions/`.

## 4. ADR's — wanneer schrijf je er een

Schrijf een ADR bij elke keuze die je later zou moeten uitleggen of terugdraaien:

- Een library of framework kiezen of vervangen
- Datamodel-structuur wijzigen
- Een security-aanpak vastleggen
- Bewust iets *niet* doen (die zijn het waardevolst — ze voorkomen dat een volgende sessie
  het alsnog "even" invoert)

Bestandsnaam: `ADR-NNNN-korte-titel.md`, oplopend genummerd. Format staat in
`docs/decisions/ADR-0000-template.md`.

Een ADR wordt **nooit verwijderd of herschreven**. Achterhaald? Zet de status op
`Vervangen door ADR-XXXX` en schrijf een nieuwe.

## 5. Naamconventies

- Documentatie en losse bestanden: `YYYY-MM-DD-beschrijvende-naam.extensie`
- ADR's: `ADR-NNNN-korte-titel.md`
- Sessielogs: `YYYY-MM-DD-sessie-NN.md`
- Code: geen datums in bestandsnamen. React-componenten `PascalCase.tsx`, overige TS
  `camelCase.ts`, Netlify Functions `kebab-case.mts`.

## 6. Codeafspraken

- **TypeScript overal.** Geen `any` zonder `// eslint-disable-next-line` mét reden erbij.
- **Datamodel-types staan in `src/types/model.ts` en zijn leidend.** Wijzig je een type,
  loop dan expliciet na: Firestore-rules, `PROJECT.md` §5, en de converters.
- **Nooit losse hex-kleuren in componenten.** Alles via de Tailwind-classes uit de huisstijl
  (`bg-clay`, `text-ink`, `rounded-card`, …). Zie `AGENTS.md` in de werkruimte-root.
- **Nooit rechtstreeks in `brink-ui/` werken** — dat is een kopie die bij de volgende
  `node sync-huisstijl.mjs` wordt overschreven. Wijzig het fundament in
  `../Huisstijl/brink-ui/`.
- **Geen geheimen in code.** Alles met `VITE_`-prefix belandt in de browserbundle. Zit er een
  geheim in, dan is het per definitie fout geplaatst.
- Firestore-toegang loopt via `src/lib/` — componenten praten niet rechtstreeks met de SDK.

## 7. Werktempo & validatie

- Bij een taak van meerdere stappen: eerst een kort plan, dán uitvoeren.
- Na elke milestone: korte update van wat er is gedaan en wat de volgende stap is.
- Vóór het overschrijven of verwijderen van bestaand werk: laat zien wat er verandert en
  vraag bevestiging.
- Sluit een sessie nooit af zonder `npm run verify` (typecheck + lint + build) te draaien.

## 8. Definition of done (per feature)

1. Code werkt lokaal (`npm run dev`)
2. `npm run verify` is groen
3. Firestore-rules gecontroleerd als er een nieuwe collectie of veld bij kwam
4. `PROJECT.md` §6 bijgewerkt (vinkje)
5. `STATE.md` bijgewerkt
6. Sessielog geschreven
