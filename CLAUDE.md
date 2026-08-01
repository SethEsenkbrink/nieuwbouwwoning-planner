# CLAUDE.md — de uitvoeringsomgeving

> **Rol van dit bestand:** wát er wáár draait, met welke versie, en wat een AI-sessie zélf
> kan verifiëren. Dit is het enige bestand dat over de *omgeving* gaat.
>
> Het vult de andere aan en overlapt er niet mee:
>
> | Bestand | Beantwoordt |
> | --- | --- |
> | `AGENTS.md` | Wat moet ik lezen, en welke fouten worden het vaakst gemaakt |
> | `docs/PROJECT.md` | Wát bouwen we, onder welke constraints |
> | `docs/STATE.md` | Waar staan we nu |
> | **`CLAUDE.md`** | **Waar draait het, en wat kan ik hier wél en níét uitvoeren** |
>
> **Lees `AGENTS.md` eerst.** Dit bestand vervangt de leesvolgorde niet.

---

## 1. Er zijn twee omgevingen — en dat is de bron van de meeste verwarring

| | AI-sandbox (waar `bash` draait) | De machine van Seth |
| --- | --- | --- |
| OS | Ubuntu 22.04, x86_64 | Windows |
| Cores / RAM | **2 / 3,8 GB** | — |
| Root / sudo | **nee** (bewust geblokkeerd) | ja |
| Levensduur | **weg na de sessie** | permanent |
| Netwerk | allowlist-proxy: npm en PyPI mogen, nodejs.org niet | vrij |

De projectmap is een **FUSE-mount** tussen die twee: dezelfde bestanden, twee besturings­
systemen. Vandaar de kern van dit document:

> **`node_modules` in deze map bevat Wíndows-binaries.**
> `node_modules/@rolldown/binding-win32-x64-msvc` — Linux kan daar niets mee. Elk commando
> dat die binaries nodig heeft (vitest, vite build, eslint via de lokale install) faalt in de
> sandbox met `Cannot find native binding`.

### Waarom we dat niet "even oplossen"

Onderzocht op 2026-08-01, met deze uitkomst:

| Poging | Resultaat |
| --- | --- |
| `npm ci` in een aparte Linux-map | Faalt: de lockfile is platformspecifiek (`Missing: @emnapi/runtime`) |
| `npm install` idem | **7+ minuten zonder één geschreven pakket** — 2 cores, alles via proxy |
| Node 24 installeren in de sandbox | Onmogelijk: nodejs.org geeft HTTP 403 via de proxy-allowlist |

De sandbox draait **Node 22**, dit project eist **>=24**. Zelfs als de install zou slagen,
kost hij per sessie ~10 minuten voor iets dat lokaal in ~900 ms klaar is.

**Conclusie: de werkverdeling hieronder is geen gebrek maar de snelste opzet die er is.**

## 2. Wat draait waar

### In de sandbox — de AI mag dit zelf draaien en erop vertrouwen

| Commando | Duur | Wat het dekt |
| --- | --- | --- |
| `npx tsc --build --force` | ~40 s | **De echte typecheck.** Zie de waarschuwing hieronder |
| `node scripts/verify-tokens.mjs` | < 1 s | Huisstijl-pariteit met `brink-ui/tokens.js` |
| `node scripts/verify-headers.mjs` | < 1 s | CSP en security headers uit `netlify.toml` |
| `node scripts/verify-rules.mjs` | < 1 s | Model ↔ Firestore-rules pariteit |
| `git`, `rg`, `jq`, `make`, `curl` | — | Aanwezig in het PATH |

> ### ⚠️ Gebruik NOOIT `tsc --noEmit`
>
> `tsconfig.json` heeft `"files": []` met project references. In die opzet **controleert
> `tsc --noEmit` niets en geeft hij exit 0.** Het `typecheck`-script stond daar tot 1 augustus
> 2026 op, waardoor de gate sinds sessie 01 een lege huls was en er twee echte typefouten in
> `lib/projecten.ts` onopgemerkt bleven.
>
> Aangetoond door `const kapot: number = "tekst"` in te voegen:
> `tsc --noEmit` → exit **0**. `tsc --build --force` → exit **2**.
>
> `npm run typecheck` staat nu goed. Wijzig dat script niet terug.

### Alleen op de machine van Seth

| Commando | Waarom niet in de sandbox |
| --- | --- |
| `npm run lint` (`eslint .`) | Duurt >40 s en heeft de lokale install nodig |
| `npm run test` (vitest) | Windows-binaries van rolldown |
| `npm run build` (vite) | Idem |
| `npm run rules:test` | Firestore-emulator vereist JDK 21+; de emulator-JAR staat niet op de proxy-allowlist |
| `npm run verify` | Bevat alle bovenstaande |

## 3. De regel die hieruit volgt

> **Een AI-sessie mag nooit beweren dat lint, tests of de build groen zijn.**

Dat is in sessie 05 misgegaan: achtergrondprocessen worden in de sandbox afgekapt zodra het
commando terugkeert, en een leeg logbestand werd gelezen als "geen fouten". Het was niet klaar.

Wat een sessie wél mag zeggen: *"typecheck en de drie verify-scripts zijn groen; draai
`npm run verify` en `npm run rules:test` lokaal."*

Draai je toch iets langlopends, gebruik dan een sentinel zodat zichtbaar is dát het proces
klaar is:

```bash
commando > /tmp/log 2>&1; echo "EXIT=$?" >> /tmp/log
```

## 4. Versies

### Wat het project eist

| Onderdeel | Eis | Waar vastgelegd |
| --- | --- | --- |
| Node | **>= 24** | `package.json` → `engines`, en `.nvmrc` |
| TypeScript | **6.x — bewust niet 7** | ADR-0003; `typescript-eslint` ondersteunt de native compiler niet, waardoor `no-floating-promises` zou vervallen |
| JDK | **21+** voor `npm run rules:test` | Firestore-emulator |
| Firebase CLI | recent genoeg voor `emulators:exec` | — |

### Wat er op de machine van Seth staat

**Gemeten op 2026-08-01. Niet gokken — opnieuw meten bij twijfel:**

```powershell
node --version; npm --version
java -version
$env:JAVA_HOME
firebase --version
```

| Onderdeel | Versie | Status |
| --- | --- | --- |
| Node | **24.12.0** | ✅ voldoet aan `>=24` en aan `.nvmrc` (24) |
| npm | 11.6.2 | ✅ |
| Java | **Temurin 21.0.12 LTS** | ✅ voldoet aan de emulator-eis van 21+ |
| `JAVA_HOME` | `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot` | ✅ correct gezet |
| Firebase CLI | 15.24.0 | ✅ ondersteunt `emulators:exec` |
| Git | 2.52.0.windows.1 | ✅ |

**Er is geen enkel versieconflict.** De `engines`-eis in `package.json`, `.nvmrc` en de
JDK-eis van de emulator kloppen alle drie met wat er geïnstalleerd staat. Dat is precies
waarom `npm run verify` en `npm run rules:test` lokaal groen draaien terwijl de sandbox ze
niet kan uitvoeren: het verschil zit in de omgeving, niet in de configuratie.

**Java staat niet vanzelf op de PATH na `winget install`.** `JAVA_HOME` en `...\bin` horen als
user-variabele te staan (zie de tabel). Na een PATH-wijziging moet de IDE opnieuw starten —
anders faalt `npm run rules:test` met een emulator die geen JDK vindt.

## 5. Bestandslocaties

| Wat | Waar |
| --- | --- |
| Broncode | `src/` — routes, components, lib, data, types |
| Rekenkern | `src/lib/planning.ts` — puur TypeScript, géén Firestore, géén React |
| Datamodel | `src/types/model.ts` — **leidend** |
| Datalaag | `src/lib/projecten.ts` — het enige bestand dat Firestore aanroept |
| Firestore-rules | `firebase/firestore.rules` + `firebase/rules.test.ts` |
| Verify-scripts | `scripts/verify-{tokens,headers,rules}.mjs` |
| Documentatie | `docs/` — zie `AGENTS.md` voor de leesvolgorde |
| Huisstijl (kopie) | `brink-ui/` — **nooit rechtstreeks wijzigen**, wordt overschreven |

## 6. Git in deze map

De mount blokkeert `rm` standaard. Twee gevolgen:

- **Een achtergebleven `.git/index.lock` kan niet zomaar weg.** Dit is op 1 augustus gebeurd:
  een lege lock van twaalf uur oud, over uit de vorige sessie. Symptoom: elke `git add` faalt
  met *"Another git process seems to be running"*. Controleer eerst grootte en tijdstempel
  (0 bytes + uren oud = stale) en vraag daarna toestemming om hem te verwijderen.
- Verwijderen van projectbestanden vereist expliciete goedkeuring van Seth. Dat is opzet.

## 7. Voordat je een sessie afsluit

Uit `WORKFLOW.md` §2 en §8, hier herhaald omdat het de enige regel is die nooit mag sneuvelen:

1. `docs/STATE.md` bijwerken — actuele stand, volgende stap, nieuwe valkuilen
2. Sessielog schrijven in `docs/sessions/YYYY-MM-DD-sessie-NN.md`
3. Vinkje in `docs/PROJECT.md` §6 bij een afgeronde feature
4. ADR schrijven bij elke keuze die je later zou moeten uitleggen
5. Seth `npm run verify` én `npm run rules:test` laten draaien, en de **werkelijke** uitkomst
   in `STATE.md` zetten — niet de verwachte
