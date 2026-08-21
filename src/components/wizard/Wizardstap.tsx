import type { ReactNode } from "react";
import { Knop } from "@/components/Knop";
import { Melding } from "@/components/Melding";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Het omhulsel van één wizardstap
 *
 * Kop, uitleg, inhoud en dezelfde drie knoppen onderaan. Dat laatste is de
 * reden dat dit een component is en geen stukje JSX per stap: de knopregel
 * bepaalt of een stap overgeslagen kan worden, en die regel op negen plekken
 * herhalen betekent dat er op de tiende plek eentje anders staat.
 *
 * "LATER INVULLEN" IS EEN ECHTE KNOP EN GEEN GRIJZE LINK. Bij een optionele
 * stap moet overslaan net zo goed te vinden zijn als doorgaan; anders vult
 * iemand iets in wat hij niet weet, alleen om verder te kunnen. Bij een
 * verplichte stap staat de knop er niet — niet uitgegrijsd, maar weg, zodat er
 * niets te ontdekken valt wat toch niet kan.
 * ═══════════════════════════════════════════════════════════════════════════
 */

interface WizardstapProps {
  kop: string;
  uitleg: string;
  children: ReactNode;
  fout?: string | null;
  bezig?: boolean;
  /** Ontbreekt dit, dan is dit de eerste stap en is er geen terug. */
  onTerug?: (() => void) | undefined;
  onVerder: () => void;
  /** Alleen aanwezig bij een optionele stap. */
  onOverslaan?: (() => void) | undefined;
  /** De tekst op de doorgaan-knop. Op de laatste stap iets anders. */
  verderLabel?: string;
}

export function Wizardstap({
  kop,
  uitleg,
  children,
  fout,
  bezig = false,
  onTerug,
  onVerder,
  onOverslaan,
  verderLabel = "Verder",
}: WizardstapProps) {
  return (
    <section className="brink-card mt-s4 max-w-2xl p-s4">
      <h2 className="text-h3 text-ink">{kop}</h2>
      <p className="mt-s2 text-body text-slate">{uitleg}</p>

      {fout && (
        <div className="mt-s3">
          <Melding soort="fout">{fout}</Melding>
        </div>
      )}

      <div className="mt-s4">{children}</div>

      <div className="mt-s4 flex flex-wrap items-center justify-between gap-s2 border-t border-bone pt-s3">
        <div>
          {onTerug && (
            <Knop variant="secundair" onClick={onTerug}>
              Terug
            </Knop>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-s2">
          {onOverslaan && (
            <Knop variant="secundair" onClick={onOverslaan}>
              Later invullen
            </Knop>
          )}
          <Knop bezig={bezig} onClick={onVerder}>
            {verderLabel}
          </Knop>
        </div>
      </div>
    </section>
  );
}

/**
 * Een blok velden met een kop erboven, binnen een stap.
 *
 * De financiële stap heeft er drie (de woning, het meerwerk, de hypotheek) en
 * zou zonder deze scheiding een muur van vijftien invoervakken zijn.
 */
export function Veldgroep({
  titel,
  toelichting,
  children,
}: {
  titel: string;
  toelichting?: string | undefined;
  children: ReactNode;
}) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="text-body font-semibold text-ink">{titel}</legend>
      {toelichting && <p className="mt-1 text-sm text-slate">{toelichting}</p>}
      <div className="mt-s2 grid gap-s2 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
