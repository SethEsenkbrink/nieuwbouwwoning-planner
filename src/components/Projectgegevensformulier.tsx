import { Veld } from "@/components/Veld";
import { Bedragveld } from "@/components/Bedragveld";
import { Keuzeveld } from "@/components/Keuzeveld";
import { WAARBORGOPTIES } from "@/data/project-opties";
import type { Projectgegevenswaarden } from "@/lib/projectgegevens";

/**
 * De vaste gegevens van het project.
 *
 * De waarden en hun lege startwaarde staan in `src/lib/projectgegevens.ts` en
 * niet hier: een bestand dat naast componenten ook constanten exporteert breekt
 * Fast Refresh.
 */

interface ProjectgegevensformulierProps {
  waarden: Projectgegevenswaarden;
  onWijzig: (patch: Partial<Projectgegevenswaarden>) => void;
  /**
   * Koopsom en meerwerkbudget staan niet in de wizard: bij het aanmaken van een
   * project weet je ze vaak nog niet, en elk extra veld verhoogt de drempel.
   * Op de projectinstellingen wel.
   */
  toonBedragen?: boolean;
  autoFocusNaam?: boolean;
}

export function Projectgegevensformulier({
  waarden,
  onWijzig,
  toonBedragen = false,
  autoFocusNaam = false,
}: ProjectgegevensformulierProps) {
  return (
    <div className="flex flex-col gap-s2">
      <Veld
        label="Naam van je project"
        hint="Voor jezelf, bijvoorbeeld “Ons huis in Almere”."
        value={waarden.naam}
        onChange={(e) => {
          onWijzig({ naam: e.target.value });
        }}
        autoFocus={autoFocusNaam}
      />
      <Veld
        label="Bouwnummer"
        hint="Optioneel. Zoals het in de stukken van de aannemer staat."
        value={waarden.bouwnummer}
        onChange={(e) => {
          onWijzig({ bouwnummer: e.target.value });
        }}
      />
      <Veld
        label="Projectnaam van de ontwikkelaar"
        value={waarden.projectnaam}
        onChange={(e) => {
          onWijzig({ projectnaam: e.target.value });
        }}
      />
      <Veld
        label="Aannemer"
        value={waarden.aannemer}
        onChange={(e) => {
          onWijzig({ aannemer: e.target.value });
        }}
      />
      <Keuzeveld
        label="Garantiewaarborg"
        waarde={waarden.waarborg}
        opties={WAARBORGOPTIES}
        onKies={(waarborg) => {
          onWijzig({ waarborg });
        }}
      />

      {toonBedragen && (
        <div className="grid gap-s2 sm:grid-cols-2">
          {/* De hint zegt nu wat de app met het bedrag dóét. Er stond
              "Hele euro's, zonder punten of komma's" — geen uitleg maar een
              omweg om BUG-01 heen, want de opschoning kon geen komma aan.
              Het veld regelt dat nu zelf. */}
          <Bedragveld
            label="Koopsom"
            hint="Optioneel. Hiermee rekent de app uit of je bouwdepot toereikend is."
            waarde={waarden.koopsom}
            onWijzig={(koopsom) => {
              onWijzig({ koopsom });
            }}
          />
          <Bedragveld
            label="Meerwerkbudget"
            hint="Ga je hieroverheen, dan waarschuwt het dashboard."
            waarde={waarden.meerwerkbudget}
            onWijzig={(meerwerkbudget) => {
              onWijzig({ meerwerkbudget });
            }}
          />
          <Bedragveld
            label="Bouwdepot"
            hint="Wat de bank in depot heeft gezet. Hiertegen zet de app de termijnen af."
            waarde={waarden.bouwdepot}
            onWijzig={(bouwdepot) => {
              onWijzig({ bouwdepot });
            }}
          />
        </div>
      )}
    </div>
  );
}
