/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Gestapelde balk met legenda — de "grafiek" van deze app
 *
 * Bewust geen chart-bibliotheek. Recharts of Chart.js kost 100 kB in de bundle
 * voor wat hier neerkomt op vier div's naast elkaar, en het brengt een
 * afhankelijkheid mee die bij elke Vite- of React-upgrade kan breken. Wat hier
 * getoond wordt is een verdeling van één geheel — daar is een gestapelde balk
 * de juiste vorm voor, en die is met CSS exact te maken.
 *
 * TWEE DINGEN DIE EEN GRAFIEK ZONDER TEKST FOUT DOET
 *
 * 1. **Kleur alleen is geen informatie.** Elk segment staat óók in de legenda
 *    met zijn naam en bedrag. Wie kleurenblind is of de balk op een telefoon
 *    in de zon bekijkt, mist anders precies het verschil dat ertoe doet.
 * 2. **Een segment van 0,3% verdwijnt.** Segmenten met een waarde boven nul
 *    krijgen een minimumbreedte, zodat "er staat nog iets open" zichtbaar
 *    blijft ook als het bedrag klein is.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Segment {
  label: string;
  waarde: number;
  /** Een achtergrondklasse uit de huisstijl, bijv. `bg-olive`. */
  kleur: string;
  /** Korte uitleg onder de legenda-regel. */
  toelichting?: string | undefined;
}

interface VoortgangsbalkProps {
  segmenten: readonly Segment[];
  /** Hoe waarden getoond worden — meestal een bedragformatter. */
  toon: (waarde: number) => string;
  /**
   * Waar de balk tegen afgezet wordt. Standaard de som van de segmenten; geef
   * een hoger getal mee om ruimte te tonen die nog niet is ingevuld.
   */
  totaal?: number;
  /** Label bij het restant als `totaal` groter is dan de som. */
  restLabel?: string;
}

/** Minimale breedte in procent, zodat een klein segment niet verdwijnt. */
const MINIMUM_BREEDTE = 2;

export function Voortgangsbalk({
  segmenten,
  toon,
  totaal,
  restLabel = "Nog niet ingevuld",
}: VoortgangsbalkProps) {
  const som = segmenten.reduce((n, s) => n + s.waarde, 0);
  const noemer = Math.max(totaal ?? som, som, 1);
  const rest = Math.max(0, (totaal ?? som) - som);

  const zichtbaar = segmenten.filter((s) => s.waarde > 0);

  // De breedtes staan als SVG-presentatieattribuut en niet als inline style.
  // Dat is geen cosmetisch verschil: `width` op een <rect> is een XML-attribuut
  // en valt buiten de CSP, waardoor `style-src 'unsafe-inline'` kan vervallen
  // (bevinding A-04). De proporties blijven daarbij exact — bij afronden naar
  // vaste klassen zouden ze over de segmenten opstapelen.
  const rechthoeken = zichtbaar.reduce<{ segment: Segment; x: number; breedte: number }[]>(
    (verzameld, segment) => {
      const vorige = verzameld[verzameld.length - 1];
      const start = vorige ? vorige.x + vorige.breedte : 0;
      const breedte = Math.max(MINIMUM_BREEDTE, (segment.waarde / noemer) * 100);
      return [...verzameld, { segment, x: start, breedte }];
    },
    [],
  );

  return (
    <div>
      <div
        className="h-4 w-full overflow-hidden rounded-pill bg-bone"
        role="img"
        aria-label={zichtbaar.map((s) => `${s.label}: ${toon(s.waarde)}`).join(", ")}
      >
        <svg
          className="block h-full w-full"
          viewBox="0 0 100 1"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {rechthoeken.map(({ segment, x: start, breedte }) => (
            <rect
              key={segment.label}
              x={start}
              y={0}
              width={breedte}
              height={1}
              className={segment.kleur.replace(/\bbg-/g, "fill-")}
            />
          ))}
        </svg>
      </div>

      <dl className="mt-s2 flex flex-col gap-1">
        {segmenten.map((segment) => (
          <div key={segment.label} className="flex flex-wrap items-baseline gap-2">
            <span
              className={`size-3 shrink-0 rounded-pill ${segment.kleur}`}
              aria-hidden="true"
            />
            <dt className="text-body text-slate">{segment.label}</dt>
            <dd className="ml-auto text-body text-ink">{toon(segment.waarde)}</dd>
            {segment.toelichting && (
              <p className="w-full pl-5 text-sm text-granite">{segment.toelichting}</p>
            )}
          </div>
        ))}

        {rest > 0 && (
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="size-3 shrink-0 rounded-pill bg-bone" aria-hidden="true" />
            <dt className="text-body text-slate">{restLabel}</dt>
            <dd className="ml-auto text-body text-ink">{toon(rest)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
