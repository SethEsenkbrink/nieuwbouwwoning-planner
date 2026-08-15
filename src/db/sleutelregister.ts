/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Sleutelregister — de actieve DEK, uitsluitend in RAM
 *
 * De datalaag (`src/lib/projecten.ts`) heeft bij élke lees- en schrijfactie de
 * DEK nodig. Die door 57 functiesignaturen en 17 routes heen rijgen zou een
 * enorme, foutgevoelige wijziging zijn zonder dat het iets aan de veiligheid
 * toevoegt: de sleutel blijft in beide gevallen een non-extractable CryptoKey
 * in het geheugen van hetzelfde tabblad.
 *
 * Daarom staat hij hier, in een moduleclosure. Eigenschappen die dit bewaakt:
 * - `extractable: false` blijft gelden — dit register bewaart de CryptoKey,
 *   nooit ruwe bytes;
 * - niets hiervan raakt localStorage, sessionStorage, IndexedDB of OPFS;
 * - `wisSleutel()` maakt de referentie leeg bij vergrendelen, zodat de
 *   garbage collector de sleutel kan opruimen.
 *
 * VaultContext is de enige die `zetSleutel` en `wisSleutel` aanroept.
 * ═══════════════════════════════════════════════════════════════════════════
 */

let actieveDek: CryptoKey | null = null;

/** Zet de actieve DEK. Alleen aan te roepen vanuit VaultContext bij ontgrendelen. */
export function zetSleutel(dek: CryptoKey): void {
  actieveDek = dek;
}

/** Wist de actieve DEK. Aangeroepen bij vergrendelen, auto-lock en tabbladwissel. */
export function wisSleutel(): void {
  actieveDek = null;
}

/** True zolang de kluis ontgrendeld is. */
export function isOntgrendeld(): boolean {
  return actieveDek !== null;
}

/**
 * Geeft de actieve DEK, of gooit als de kluis vergrendeld is.
 *
 * Bewust een harde fout in plaats van `null` teruggeven: een schrijfactie die
 * stilletjes overslaat omdat de kluis net dichtviel, is precies het soort
 * stil dataverlies dat deze applicatie niet mag hebben.
 */
export function vereisSleutel(): CryptoKey {
  if (!actieveDek) {
    throw new KluisVergrendeldFout();
  }
  return actieveDek;
}

/** Herkenbare fout, zodat de UI hierop kan reageren met "ontgrendel opnieuw". */
export class KluisVergrendeldFout extends Error {
  constructor() {
    super("De kluis is vergrendeld. Ontgrendel opnieuw om verder te gaan.");
    this.name = "KluisVergrendeldFout";
  }
}
