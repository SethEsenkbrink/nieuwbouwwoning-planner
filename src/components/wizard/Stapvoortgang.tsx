/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De voortgangsbalk van de wizard
 *
 * Bewust niet `Voortgangsbalk` hergebruikt: die toont een verdeling van
 * bedragen mét legenda, en zou hier een lijst van negen regels onder de balk
 * plakken. En bewust niet `Stapindicator`: negen bolletjes met labels naast
 * elkaar past niet op een telefoon, en het aantal stappen verschilt per
 * instapmoment.
 *
 * DE BREEDTE STAAT ALS SVG-ATTRIBUUT, niet als inline style. `width` op een
 * `<rect>` is een XML-attribuut en valt buiten de Content-Security-Policy —
 * daardoor kan `style-src 'unsafe-inline'` weg blijven (bevinding A-04).
 * Hetzelfde procedé als in `Voortgangsbalk`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

interface StapvoortgangProps {
  /** Wat er nu op het scherm staat, bijv. "Stap 3 van 9 — Financieel". */
  label: string;
  gedaan: number;
  totaal: number;
}

export function Stapvoortgang({ label, gedaan, totaal }: StapvoortgangProps) {
  const noemer = Math.max(totaal, 1);
  const breedte = Math.min(100, Math.max(0, (gedaan / noemer) * 100));

  return (
    <div>
      <p className="text-body font-semibold text-ink">{label}</p>

      <div
        className="mt-s1 h-3 w-full overflow-hidden rounded-pill bg-bone"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totaal}
        aria-valuenow={gedaan}
        aria-label={`${String(gedaan)} van de ${String(totaal)} onderdelen ingevuld`}
      >
        <svg
          className="block h-full w-full"
          viewBox="0 0 100 1"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {breedte > 0 && <rect x={0} y={0} width={breedte} height={1} className="fill-olive" />}
        </svg>
      </div>
    </div>
  );
}
