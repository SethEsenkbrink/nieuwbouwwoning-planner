import { Link } from "react-router";

interface KerncijfertegelProps {
  label: string;
  /** Het getal, al opgemaakt. Bijvoorbeeld "12 weken" of "€ 8.400". */
  waarde: string;
  /** Wat eronder staat: de datum, het budget, de toelichting. */
  onder?: string | undefined;
  /** Kleurt de tegel als er iets misgaat. */
  alarm?: boolean;
  /** Waar de tegel heen linkt. */
  naar: string;
  /**
   * Staat het onderliggende veld nog leeg? Dan een streepje met een uitnodiging
   * in plaats van een getal.
   */
  leeg?: boolean;
  /** Wat er moet gebeuren als het veld leeg is, bijv. "Budget invullen". */
  legeTekst?: string;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Eén cijfer, groot genoeg om in één oogopslag te lezen
 *
 * Uit de live test van 2 augustus: *"er is geen dashboard waarin je een soort
 * totaaloverzicht hebt."* Het geldblok bestónd, maar stond als zevende sectie
 * onderaan. Een totaalbeeld dat je moet scrollen om te vinden, bestaat niet.
 *
 * HET VERSCHIL TUSSEN "€ 0" EN "NIETS INGEVULD" IS DE HELE REDEN DAT `leeg`
 * BESTAAT. Het oude dashboard toonde `€ 0` voor een meerwerkbudget dat nooit
 * was ingevuld, en dat leest als een kapotte app. Nu staat er een streepje met
 * de handeling die het oplost — de tegel vertelt zelf wat hij mist.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function Kerncijfertegel({
  label,
  waarde,
  onder,
  alarm = false,
  naar,
  leeg = false,
  legeTekst = "Invullen",
}: KerncijfertegelProps) {
  return (
    <Link
      to={naar}
      className={[
        "brink-card flex flex-col gap-1 p-s3 transition-colors",
        alarm ? "border border-clay/40" : "",
      ].join(" ")}
    >
      <span className="text-eyebrow uppercase text-slate">{label}</span>

      {leeg ? (
        <>
          <span className="text-h3 text-taupe">—</span>
          <span className="text-sm text-olive-deep underline">{legeTekst}</span>
        </>
      ) : (
        <>
          <span className={`text-h3 ${alarm ? "text-clay-deep" : "text-ink"}`}>{waarde}</span>
          {onder && <span className="text-sm text-slate">{onder}</span>}
        </>
      )}
    </Link>
  );
}
