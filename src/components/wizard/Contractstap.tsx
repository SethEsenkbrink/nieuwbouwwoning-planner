import { Veld } from "@/components/Veld";
import { Keuzeveld } from "@/components/Keuzeveld";
import { Datumveld } from "@/components/Datumveld";
import { Melding } from "@/components/Melding";
import { Veldgroep } from "@/components/wizard/Wizardstap";
import { WAARBORGOPTIES } from "@/data/project-opties";
import type { Wizardwaarden } from "@/lib/wizard/waarden";
import type { Garantiewaarborg, TrajectType } from "@/types/model";

/**
 * De contractstap. Wat hier staat verschilt per traject, want het zijn andere
 * partijen: bij nieuwbouw een aannemer met een garantieregeling, bij bestaande
 * bouw een notaris met een transportdatum.
 *
 * HET POLISNUMMER STAAT ER ALLEEN BIJ WONINGBORG OF SWK. Bij "geen waarborg"
 * bestaat er geen polis, en een leeg veld dat er toch staat suggereert dat je
 * iets vergeten bent.
 */

interface ContractstapProps {
  waarden: Wizardwaarden;
  onWijzig: (patch: Partial<Wizardwaarden>) => void;
  traject: TrajectType;
}

export function Contractstap({ waarden, onWijzig, traject }: ContractstapProps) {
  const heeftWaarborg = waarden.waarborg === "woningborg" || waarden.waarborg === "swk";

  return (
    <div className="flex flex-col gap-s4">
      {traject === "nieuwbouw" ? (
        <>
          <Veldgroep titel="Wie bouwt er">
            <Veld
              label="Aannemer"
              value={waarden.aannemer}
              onChange={(e) => {
                onWijzig({ aannemer: e.target.value });
              }}
            />
            <Veld
              label="Projectnaam van de ontwikkelaar"
              hint="Zoals het project heet in de brochure."
              value={waarden.ontwikkelaar}
              onChange={(e) => {
                onWijzig({ ontwikkelaar: e.target.value });
              }}
            />
            <Veld
              label="Bouwnummer"
              hint="Zoals het in de stukken van de aannemer staat."
              value={waarden.bouwnummer}
              onChange={(e) => {
                onWijzig({ bouwnummer: e.target.value });
              }}
            />
          </Veldgroep>

          <Veldgroep
            titel="Garantie en waarborg"
            toelichting="Deze keuze bepaalt welke garantietermijnen de app voor je bijhoudt: zes jaar algemeen en tien jaar voor ernstige gebreken bij Woningborg en SWK."
          >
            <Keuzeveld
              label="Garantiewaarborg"
              waarde={waarden.waarborg}
              opties={WAARBORGOPTIES}
              onKies={(waarborg: Garantiewaarborg) => {
                onWijzig({ waarborg });
              }}
            />
            {heeftWaarborg && (
              <Veld
                label="Polisnummer"
                hint="Staat op je waarborgcertificaat."
                value={waarden.waarborgpolisnummer}
                onChange={(e) => {
                  onWijzig({ waarborgpolisnummer: e.target.value });
                }}
              />
            )}
          </Veldgroep>
        </>
      ) : (
        <Veldgroep titel="Verkoop en bemiddeling">
          <Veld
            label="Verkopende partij of makelaar"
            value={waarden.aannemer}
            onChange={(e) => {
              onWijzig({ aannemer: e.target.value });
            }}
          />
          <Veld
            label="Eigen aankoopmakelaar"
            hint="Laat leeg als je die niet hebt."
            value={waarden.ontwikkelaar}
            onChange={(e) => {
              onWijzig({ ontwikkelaar: e.target.value });
            }}
          />
        </Veldgroep>
      )}

      <Veldgroep
        titel="Notaris en overdracht"
        toelichting={
          traject === "nieuwbouw"
            ? "Bij nieuwbouw passeert de akte voor de grond meestal vóór de bouw begint."
            : "De akte passeert bij de notaris; op dat moment krijg je de sleutel."
        }
      >
        <Veld
          label="Notaris"
          value={waarden.notaris}
          onChange={(e) => {
            onWijzig({ notaris: e.target.value });
          }}
        />
        <Datumveld
          label="Datum van transport"
          hint="De dag dat de akte passeert. Weet je hem nog niet, laat dan leeg."
          waarde={waarden.transportdatum}
          onKies={(transportdatum) => {
            onWijzig({ transportdatum });
          }}
        />
      </Veldgroep>

      <Veldgroep
        titel="Kadastrale aanduiding"
        toelichting="Staat op de leveringsakte. De app drukt dit af op het overdrachtsdossier dat je ooit aan een koper geeft."
      >
        <Veld
          label="Kadastrale gemeente"
          value={waarden.kadasterGemeente}
          onChange={(e) => {
            onWijzig({ kadasterGemeente: e.target.value });
          }}
        />
        <div className="grid grid-cols-2 gap-s2">
          <Veld
            label="Sectie"
            value={waarden.kadasterSectie}
            onChange={(e) => {
              onWijzig({ kadasterSectie: e.target.value });
            }}
          />
          <Veld
            label="Perceelnummer"
            value={waarden.kadasterPerceelnummer}
            onChange={(e) => {
              onWijzig({ kadasterPerceelnummer: e.target.value });
            }}
          />
        </div>
      </Veldgroep>

      <Melding soort="info">
        Deze gegevens komen uit je eigen stukken. De app haalt niets op bij het Kadaster of bij
        een andere instantie — er is geen netwerkverbinding.
      </Melding>
    </div>
  );
}
