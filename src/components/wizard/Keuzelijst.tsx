import type { ReactNode } from "react";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Aanvinklijst met kaarten — betrokkenen, installaties, onderhoud, meters
 *
 * Vier stappen in de wizard vragen hetzelfde: kies uit een standaardlijst wat
 * op jou van toepassing is. Ze deelden eerder niets, waardoor de betrokkenen
 * er als kaarten uitzagen en de rest als kale checkboxes.
 *
 * DE HELE KAART IS HET LABEL. Een checkbox van 16 bij 16 pixels is op een
 * telefoon geen doel maar een gok. Door het `<label>` om de hele kaart te
 * leggen is het aanraakvlak de kaart zelf, en werkt toetsenbordbediening
 * ongewijzigd.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Keuzeregel {
  sleutel: string;
  naam: string;
  /** Eén regel eronder, bijv. de aanlooptijd of het interval. */
  detail?: string;
  /** Nog een regel, zachter — waarom je dit zou willen. */
  toelichting?: string;
}

export interface Keuzegroep {
  /** Kop boven de groep. Leeg = geen kop, alles op één hoop. */
  titel?: string;
  regels: readonly Keuzeregel[];
}

interface KeuzelijstProps {
  groepen: readonly Keuzegroep[];
  gekozen: readonly string[];
  onWissel: (sleutel: string) => void;
  /** Boven de lijst, bijv. de disclaimer bij voorgestelde intervallen. */
  boven?: ReactNode;
}

export function Keuzelijst({ groepen, gekozen, onWissel, boven }: KeuzelijstProps) {
  return (
    <div className="flex flex-col gap-s4">
      {boven}

      {groepen.map((groep, index) => (
        <section key={groep.titel ?? `groep-${String(index)}`}>
          {groep.titel && <h3 className="text-body font-semibold text-ink">{groep.titel}</h3>}

          <div className="mt-s2 grid gap-s2 sm:grid-cols-2">
            {groep.regels.map((regel) => {
              const aan = gekozen.includes(regel.sleutel);
              return (
                <label
                  key={regel.sleutel}
                  className={[
                    "brink-card flex cursor-pointer gap-3 p-s2 transition-colors",
                    aan ? "ring-2 ring-clay" : "",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-clay"
                    checked={aan}
                    onChange={() => {
                      onWissel(regel.sleutel);
                    }}
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-body font-semibold text-ink">{regel.naam}</span>
                    {regel.detail && <span className="text-sm text-slate">{regel.detail}</span>}
                    {regel.toelichting && (
                      <span className="text-sm text-granite">{regel.toelichting}</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
