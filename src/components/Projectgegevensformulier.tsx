import { Veld } from "@/components/Veld";
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
          <Veld
            label="Koopsom in euro's"
            hint="Optioneel. Hele euro's, zonder punten of komma's."
            inputMode="numeric"
            value={waarden.koopsom}
            onChange={(e) => {
              onWijzig({ koopsom: e.target.value });
            }}
          />
          <Veld
            label="Meerwerkbudget in euro's"
            hint="Wat je maximaal aan meerwerk wilt uitgeven."
            inputMode="numeric"
            value={waarden.meerwerkbudget}
            onChange={(e) => {
              onWijzig({ meerwerkbudget: e.target.value });
            }}
          />
        </div>
      )}
    </div>
  );
}
