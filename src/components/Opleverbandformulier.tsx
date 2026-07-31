import { Veld } from "@/components/Veld";
import { Datumveld } from "@/components/Datumveld";
import { Keuzeveld } from "@/components/Keuzeveld";
import { OPLEVERSTATUSOPTIES } from "@/data/project-opties";
import type { Opleverbandwaarden } from "@/lib/opleverband";

interface OpleverbandformulierProps {
  waarden: Opleverbandwaarden;
  onWijzig: (patch: Partial<Opleverbandwaarden>) => void;
}

/**
 * De opleverdatum als band met een staat (ADR-0008, principe 1).
 *
 * Staat hier als los component omdat hij op twee plekken voorkomt: in de wizard
 * bij het aanmaken en op de projectinstellingen bij elke verschuiving daarna.
 * De omzetting naar de drie opgeslagen datums zit in `src/lib/opleverband.ts`,
 * met tests — dit bestand toont alleen velden.
 *
 * De extra datumvelden verschijnen alleen bij `bandbreedte`. Bij de andere twee
 * staten vallen vroegst, verwacht en laatst toch samen, en drie velden tonen die
 * niets doen is erger dan één veld dat klopt.
 */
export function Opleverbandformulier({ waarden, onWijzig }: OpleverbandformulierProps) {
  return (
    <div className="flex flex-col gap-s2">
      <Keuzeveld
        label="Hoe zeker is de datum?"
        waarde={waarden.status}
        opties={OPLEVERSTATUSOPTIES}
        onKies={(status) => {
          onWijzig({ status });
        }}
      />

      <Datumveld
        label={waarden.status === "bandbreedte" ? "Verwachte datum" : "Opleverdatum"}
        waarde={waarden.verwacht}
        onKies={(verwacht) => {
          onWijzig({ verwacht });
        }}
      />

      {waarden.status === "bandbreedte" && (
        <>
          <Datumveld
            label="Vroegst mogelijke datum"
            hint="Leeg laten? Dan gebruikt de app de verwachte datum."
            waarde={waarden.vroegst}
            onKies={(vroegst) => {
              onWijzig({ vroegst });
            }}
          />
          <Datumveld
            label="Laatst mogelijke datum"
            waarde={waarden.laatst}
            onKies={(laatst) => {
              onWijzig({ laatst });
            }}
          />
        </>
      )}

      <Veld
        label="Waar komt deze datum vandaan?"
        hint="Bijvoorbeeld “mail aannemer 12-07”. Bij de derde verschuiving wil je dit terug kunnen zien."
        value={waarden.bron}
        onChange={(e) => {
          onWijzig({ bron: e.target.value });
        }}
      />
    </div>
  );
}
