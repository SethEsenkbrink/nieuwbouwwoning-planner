import { Veld } from "@/components/Veld";
import { Keuzeveld } from "@/components/Keuzeveld";
import { Veldgroep } from "@/components/wizard/Wizardstap";
import { ENERGIELABELOPTIES, WONINGTYPEOPTIES } from "@/data/woning-opties";
import type { Wizardwaarden } from "@/lib/wizard/waarden";
import type { Instapmoment } from "@/lib/wizard/instapmoment";
import { isOpOfNa } from "@/lib/wizard/instapmoment";
import type { TrajectType } from "@/types/model";

/**
 * De woningstap: adres, type en maten.
 *
 * HET ENERGIELABEL STAAT ER ALLEEN ALS HET KAN BESTAAN. Bij nieuwbouw die nog
 * in aanbouw is, is er geen afgemeld label — de vraag stellen nodigt uit tot
 * gokken, en een gegokt label komt daarna als feit op het overdrachtsdossier.
 *
 * PERCEELOPPERVLAKTE VERDWIJNT BIJ EEN APPARTEMENT. Een appartement heeft geen
 * perceel; het veld zou leeg blijven of, erger, met de oppervlakte van het
 * complex gevuld worden.
 */

const TYPEOPTIES = [
  { waarde: "" as const, label: "Kies een woningtype" },
  ...WONINGTYPEOPTIES,
];

const LABELOPTIES = [
  { waarde: "" as const, label: "Nog geen label" },
  ...ENERGIELABELOPTIES,
];

interface WoningstapProps {
  waarden: Wizardwaarden;
  onWijzig: (patch: Partial<Wizardwaarden>) => void;
  traject: TrajectType;
  moment: Instapmoment;
}

export function Woningstap({ waarden, onWijzig, traject, moment }: WoningstapProps) {
  const isAppartement = waarden.woningtype === "appartement";

  // Een afgemeld label bestaat pas als de woning er staat. Bij bestaande bouw
  // is dat altijd zo; bij nieuwbouw pas vanaf de oplevering.
  const labelKanBestaan = traject === "bestaandeBouw" || isOpOfNa(moment, "net_opgeleverd");

  return (
    <div className="flex flex-col gap-s4">
      <Veld
        label="Naam van je dossier"
        hint="Voor jezelf. Laat je dit leeg, dan gebruikt de app het adres."
        value={waarden.naam}
        onChange={(e) => {
          onWijzig({ naam: e.target.value });
        }}
        autoFocus
      />

      <Veldgroep
        titel="Adres"
        toelichting={
          moment === "orientatie"
            ? "Weet je het adres nog niet, laat het dan leeg en vul straks het bouwnummer in."
            : undefined
        }
      >
        <Veld
          label="Straat"
          value={waarden.adres}
          onChange={(e) => {
            onWijzig({ adres: e.target.value });
          }}
        />
        <div className="grid grid-cols-2 gap-s2">
          <Veld
            label="Huisnummer"
            inputMode="numeric"
            value={waarden.huisnummer}
            onChange={(e) => {
              onWijzig({ huisnummer: e.target.value });
            }}
          />
          <Veld
            label="Toevoeging"
            value={waarden.huisnummerToevoeging}
            onChange={(e) => {
              onWijzig({ huisnummerToevoeging: e.target.value });
            }}
          />
        </div>
        <Veld
          label="Postcode"
          autoComplete="postal-code"
          value={waarden.postcode}
          onChange={(e) => {
            onWijzig({ postcode: e.target.value });
          }}
        />
        <Veld
          label="Plaats"
          autoComplete="address-level2"
          value={waarden.plaats}
          onChange={(e) => {
            onWijzig({ plaats: e.target.value });
          }}
        />
      </Veldgroep>

      <Veldgroep
        titel="Wat voor woning is het"
        toelichting="Hiermee weet de app welke onderdelen en onderhoudstaken hij kan voorstellen."
      >
        <Keuzeveld
          label="Woningtype"
          waarde={waarden.woningtype}
          opties={TYPEOPTIES}
          onKies={(woningtype) => {
            onWijzig({ woningtype });
          }}
        />
        <Veld
          label="Bouwjaar"
          hint="Vier cijfers. Bij nieuwbouw het jaar van oplevering."
          inputMode="numeric"
          value={waarden.bouwjaar}
          onChange={(e) => {
            onWijzig({ bouwjaar: e.target.value });
          }}
        />
        <Veld
          label="Woonoppervlakte in m²"
          hint="Gebruiksoppervlakte wonen, zoals in de brochure."
          inputMode="decimal"
          value={waarden.woonoppervlakte}
          onChange={(e) => {
            onWijzig({ woonoppervlakte: e.target.value });
          }}
        />
        {!isAppartement && (
          <Veld
            label="Perceeloppervlakte in m²"
            inputMode="decimal"
            value={waarden.perceeloppervlakte}
            onChange={(e) => {
              onWijzig({ perceeloppervlakte: e.target.value });
            }}
          />
        )}
      </Veldgroep>

      {labelKanBestaan && (
        <Veldgroep
          titel="Energielabel"
          toelichting="Het definitieve label uit EP-Online. Is het er nog niet, laat dit dan staan op “Nog geen label” — een geschat label komt anders als feit op je overdrachtsdossier."
        >
          <Keuzeveld
            label="Energielabel"
            waarde={waarden.energielabel}
            opties={LABELOPTIES}
            onKies={(energielabel) => {
              onWijzig({ energielabel });
            }}
          />
        </Veldgroep>
      )}
    </div>
  );
}
