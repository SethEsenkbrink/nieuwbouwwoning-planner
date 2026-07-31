import { toonDatum } from "@/lib/datum";
import type { Impact } from "@/lib/watals";

/**
 * Wat een verschuiving gaat betekenen, getoond vóórdat er iets opgeslagen is.
 *
 * De kop beantwoordt de vraag die op dat moment telt — kost dit geld? — en de
 * regels eronder zeggen wie het raakt en hoeveel. Geen kleurcodes zonder tekst:
 * "kost geld" en "haast" staan er letterlijk, want dit is precies het moment
 * waarop iemand snel iets wegklikt.
 */
export function Impactmelding({ impact }: { impact: Impact }) {
  if (impact.aantalGeraakt === 0) {
    return (
      <div className="rounded-consent border border-taupe/40 bg-bone px-4 py-3">
        <p className="text-body text-charcoal">
          Deze wijziging raakt geen enkele afspraak.
        </p>
      </div>
    );
  }

  const kop =
    impact.aantalKostGeld > 0
      ? `Let op: ${impact.aantalKostGeld} van de ${impact.aantalGeraakt} geraakte ${
          impact.aantalGeraakt === 1 ? "afspraak" : "afspraken"
        } valt buiten de kosteloze annuleertermijn.`
      : `Deze wijziging raakt ${impact.aantalGeraakt} ${
          impact.aantalGeraakt === 1 ? "afspraak" : "afspraken"
        }.`;

  return (
    <div
      className={[
        "rounded-consent border px-4 py-3",
        impact.aantalKostGeld > 0 ? "border-clay/30 bg-clay/10" : "border-taupe/40 bg-bone",
      ].join(" ")}
    >
      <p
        className={[
          "text-body font-semibold",
          impact.aantalKostGeld > 0 ? "text-clay-deep" : "text-charcoal",
        ].join(" ")}
      >
        {kop}
      </p>

      {impact.aantalHaast > 0 && (
        <p className="mt-1 text-sm text-charcoal">
          {impact.aantalHaast}{" "}
          {impact.aantalHaast === 1 ? "partij moet het" : "partijen moeten het"} meteen weten om
          de nieuwe datum nog te halen.
        </p>
      )}

      <ul className="mt-s2 flex flex-col gap-1">
        {impact.regels.map((regel) => (
          <li key={regel.afspraakId} className="text-sm text-charcoal">
            <span className="font-semibold">{regel.betrokkeneNaam}</span> — {regel.omschrijving}:{" "}
            {regel.oud ? toonDatum(regel.oud.verwacht) : "onbekend"} →{" "}
            {regel.nieuw ? toonDatum(regel.nieuw.verwacht) : "onbekend"}
            {regel.verschovenDagen !== 0 && (
              <>
                {" "}
                ({Math.abs(regel.verschovenDagen)}{" "}
                {Math.abs(regel.verschovenDagen) === 1 ? "dag" : "dagen"}{" "}
                {regel.verschovenDagen > 0 ? "later" : "eerder"})
              </>
            )}
            {regel.kostGeld && (
              <span className="text-clay-deep">
                {" "}
                — kost geld, kosteloos verzetten kon tot {toonDatum(regel.gratisTot)}
              </span>
            )}
            {!regel.kostGeld && regel.heeftHaast && (
              <span className="text-granite"> — moet het nu weten</span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-s2 text-sm text-granite">
        Na het opslaan staan deze partijen op je actielijst met een kant-en-klaar bericht.
      </p>
    </div>
  );
}
