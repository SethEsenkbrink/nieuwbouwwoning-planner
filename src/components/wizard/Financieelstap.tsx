import { Bedragveld } from "@/components/Bedragveld";
import { Veld } from "@/components/Veld";
import { Keuzeveld } from "@/components/Keuzeveld";
import { Datumveld } from "@/components/Datumveld";
import { Melding } from "@/components/Melding";
import { Veldgroep } from "@/components/wizard/Wizardstap";
import { leesBedragInvoer, toonBedrag } from "@/lib/bedrag";
import type { Wizardwaarden } from "@/lib/wizard/waarden";
import { isOpOfNa, type Instapmoment } from "@/lib/wizard/instapmoment";
import type { TrajectType } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Het financiële beeld — de stap waar het om draait
 *
 * Deze gegevens stonden verspreid over drie schermen: de koopsom op de
 * projectinstellingen, het bouwdepot ergens daaronder, en de hypotheek nergens
 * (die map was niet eens weg te schrijven — zie de convertercommit). Wie de
 * wizard doorliep had daarna een agenda, geen financieel overzicht.
 *
 * WAT DE APP HIER WÉL EN NIET DOET. Het blok onderaan telt op en trekt af,
 * meer niet: koopsom plus meerwerkbudget min het hypotheekbedrag. Dat is
 * rekenen, geen advies. Er staat expliciet bij wat er níét in zit — kosten
 * koper, notaris, afsluitkosten — want een getal met de kop "eigen geld" waar
 * die posten buiten vallen, is precies het soort schijnzekerheid dat
 * constraint C6 verbiedt.
 *
 * DE VELDEN VOLGEN HET INSTAPMOMENT. Meerwerk en bouwdepot bestaan niet meer
 * als de sleutel er ligt, en het 5%-depot bestaat pas rond de oplevering. Ze
 * dan toch tonen levert lege velden op die eruitzien als iets wat je vergeten
 * bent.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const VORMOPTIES = [
  { waarde: "" as const, label: "Nog niet bekend" },
  {
    waarde: "annuitair" as const,
    label: "Annuïtair",
    toelichting: "Elke maand hetzelfde bedrag; in het begin veel rente, later veel aflossing.",
  },
  {
    waarde: "lineair" as const,
    label: "Lineair",
    toelichting: "Elke maand dezelfde aflossing, dus een maandlast die langzaam daalt.",
  },
  {
    waarde: "aflossingsvrij" as const,
    label: "Aflossingsvrij",
    toelichting: "Je betaalt alleen rente. Meestal een deel van de lening, niet het geheel.",
  },
];

interface FinancieelstapProps {
  waarden: Wizardwaarden;
  onWijzig: (patch: Partial<Wizardwaarden>) => void;
  traject: TrajectType;
  moment: Instapmoment;
}

export function Financieelstap({ waarden, onWijzig, traject, moment }: FinancieelstapProps) {
  const naSleutel = isOpOfNa(moment, "net_opgeleverd");
  const isNieuwbouw = traject === "nieuwbouw";

  // Meerwerk en bouwdepot horen bij een bouw die nog loopt.
  const toonBouwposten = isNieuwbouw && !naSleutel;
  // Het 5%-opschortingsrecht speelt rond de oplevering, niet daarvoor of jaren erna.
  const toonOpschorting =
    isNieuwbouw && (moment === "bijna_oplevering" || moment === "net_opgeleverd");

  const koopsom = leesBedragInvoer(waarden.koopsom);
  const meerwerk = leesBedragInvoer(waarden.meerwerkbudget);
  const lening = leesBedragInvoer(waarden.hypotheekBedrag);

  const totaalBekend = (koopsom ?? 0) + (meerwerk ?? 0);
  const verschil =
    koopsom === undefined || lening === undefined ? undefined : totaalBekend - lening;

  return (
    <div className="flex flex-col gap-s4">
      <Veldgroep
        titel={isNieuwbouw ? "De koop" : "De aankoop"}
        toelichting={
          isNieuwbouw
            ? "De koopsom is grond plus aanneemsom, zoals in je koop-/aannemingsovereenkomst."
            : "De koopsom zoals die in de koopovereenkomst staat."
        }
      >
        <Bedragveld
          label="Koopsom"
          hint="Hieraan hangt de rest van het financiële beeld."
          waarde={waarden.koopsom}
          onWijzig={(koopsomTekst) => {
            onWijzig({ koopsom: koopsomTekst });
          }}
        />
        {toonBouwposten && (
          <Bedragveld
            label="Meerwerkbudget"
            hint="Ga je hieroverheen, dan waarschuwt het dashboard."
            waarde={waarden.meerwerkbudget}
            onWijzig={(meerwerkbudget) => {
              onWijzig({ meerwerkbudget });
            }}
          />
        )}
        {!isNieuwbouw && !naSleutel && (
          <Bedragveld
            label="Verbouwbudget"
            hint="Wat je na de sleutel aan de woning wilt besteden."
            waarde={waarden.meerwerkbudget}
            onWijzig={(meerwerkbudget) => {
              onWijzig({ meerwerkbudget });
            }}
          />
        )}
      </Veldgroep>

      {toonBouwposten && (
        <Veldgroep
          titel="Bouwdepot"
          toelichting="Wat de bank in depot heeft gezet. Hiertegen zet de app de termijnfacturen af, zodat je ziet hoeveel er nog in zit."
        >
          <Bedragveld
            label="Bouwdepot"
            waarde={waarden.bouwdepot}
            onWijzig={(bouwdepot) => {
              onWijzig({ bouwdepot });
            }}
          />
          <Bedragveld
            label="Bij het passeren al opgenomen"
            hint="De grond plus de termijnen die toen al vervallen waren. Dit deel kost vanaf dag één rente."
            waarde={waarden.grondbedrag}
            onWijzig={(grondbedrag) => {
              onWijzig({ grondbedrag });
            }}
          />
        </Veldgroep>
      )}

      {toonOpschorting && (
        <Veldgroep
          titel="Het 5%-opschortingsrecht"
          toelichting="Artikel 7:768 BW: je mag 5% van de aanneemsom in depot houden bij de notaris. Dat valt drie maanden na oplevering vrij, tenzij je schriftelijk blokkeert."
        >
          <Bedragveld
            label="Bedrag in depot"
            hint="Vul dit in, dan zet de app de klok en waarschuwt hij op tijd."
            waarde={waarden.opschortingBedrag}
            onWijzig={(opschortingBedrag) => {
              onWijzig({ opschortingBedrag });
            }}
          />
        </Veldgroep>
      )}

      <Veldgroep
        titel="De hypotheek"
        toelichting="Alleen wat de app nodig heeft om te rekenen. Inkomen, belastingschijf en hypotheekrenteaftrek staan er bewust niet bij — de app rekent bruto en geeft geen advies."
      >
        <Bedragveld
          label="Hypotheekbedrag"
          waarde={waarden.hypotheekBedrag}
          onWijzig={(hypotheekBedrag) => {
            onWijzig({ hypotheekBedrag });
          }}
        />
        <Veld
          label="Rente in %"
          hint="Bijvoorbeeld 3,85 — het percentage, niet het bedrag."
          inputMode="decimal"
          value={waarden.hypotheekRente}
          onChange={(e) => {
            onWijzig({ hypotheekRente: e.target.value });
          }}
        />
        <Keuzeveld
          label="Aflossingsvorm"
          waarde={waarden.hypotheekVorm}
          opties={VORMOPTIES}
          onKies={(hypotheekVorm) => {
            onWijzig({ hypotheekVorm });
          }}
        />
        <Veld
          label="Looptijd in jaren"
          hint="Doorgaans 30."
          inputMode="numeric"
          value={waarden.hypotheekLooptijdJaren}
          onChange={(e) => {
            onWijzig({ hypotheekLooptijdJaren: e.target.value });
          }}
        />
        {toonBouwposten && (
          <Veld
            label="Depotrente in %"
            hint="Wat de bank vergoedt over het saldo dat nog in depot staat. Vaak gelijk aan de hypotheekrente, maar niet altijd."
            inputMode="decimal"
            value={waarden.depotRente}
            onChange={(e) => {
              onWijzig({ depotRente: e.target.value });
            }}
          />
        )}
        <Datumveld
          label="Passeerdatum van de hypotheekakte"
          hint="Vanaf deze datum lopen je maandlasten. De app rekent hier ook de 24 maanden van je bouwdepot vanaf."
          waarde={waarden.passeerdatum}
          onKies={(passeerdatum) => {
            onWijzig({ passeerdatum });
          }}
        />
      </Veldgroep>

      {/* ── Wat er uit de ingevulde bedragen volgt ─────────────────────── */}
      {verschil !== undefined && (
        <div className="rounded-consent border border-taupe/40 bg-bone p-s3">
          <h3 className="text-body font-semibold text-ink">Wat hier direct uit volgt</h3>

          <dl className="mt-s2 flex flex-col gap-1.5">
            <div className="flex justify-between gap-s2 text-body">
              <dt className="text-slate">
                Koopsom{meerwerk === undefined ? "" : " plus meerwerkbudget"}
              </dt>
              <dd className="font-semibold text-ink">{toonBedrag(totaalBekend)}</dd>
            </div>
            <div className="flex justify-between gap-s2 text-body">
              <dt className="text-slate">Hypotheek</dt>
              <dd className="font-semibold text-ink">{toonBedrag(lening)}</dd>
            </div>
            <div className="flex justify-between gap-s2 border-t border-taupe/40 pt-1.5 text-body">
              <dt className="text-slate">
                {verschil >= 0 ? "Verschil, uit eigen geld" : "Ruimte boven de koopsom"}
              </dt>
              <dd className="font-semibold text-ink">{toonBedrag(Math.abs(verschil))}</dd>
            </div>
          </dl>

          <p className="mt-s2 text-sm text-granite">
            Dit is optellen en aftrekken, geen begroting. Kosten koper, notaris, taxatie,
            afsluitkosten en de inrichting zitten er niet in — die horen thuis bij de posten na
            de oplevering.
          </p>
        </div>
      )}

      <Melding soort="info">
        Deze bedragen zijn indicatief en dienen alleen om overzicht te houden. Je hypotheekakte
        en je koopovereenkomst zijn leidend.
      </Melding>
    </div>
  );
}
