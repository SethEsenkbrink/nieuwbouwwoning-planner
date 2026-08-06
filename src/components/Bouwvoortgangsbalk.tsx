import { toonDatum } from "@/lib/datum";
import type { Bouwvoortgang } from "@/lib/dashboard";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Waar staat de bouw — de zeven momenten als balk
 *
 * Het antwoord op de vraag die het dashboard tot nu toe niet gaf: hoe ver zijn
 * we? Er stond alleen "0 van de 7 bekend", en dat is een telling, geen beeld.
 *
 * GEEN CHART-BIBLIOTHEEK. Zeven segmenten naast elkaar zijn zeven div's; een
 * bibliotheek kost 100 kB in de bundle voor iets wat met CSS exact te maken is.
 * Zelfde afweging als bij `Voortgangsbalk` en ADR-0016.
 *
 * DRIE STANDEN, DRIE VORMEN — en kleur is nooit de enige drager:
 *
 *   gepasseerd  vol      dit is geweest
 *   bekend      gestreept er staat een datum, hij mag nog schuiven
 *   onbekend    leeg      nog niets ingevuld
 *
 * De legenda eronder noemt elk moment bij naam met zijn datum, zodat de balk
 * ook leesbaar is voor wie kleuren niet kan onderscheiden of hem op een
 * telefoon in de zon bekijkt.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function Bouwvoortgangsbalk({ voortgang }: { voortgang: Bouwvoortgang }) {
  const samenvatting = voortgang.momenten
    .map((m) => `${m.titel}: ${m.stand}`)
    .join(", ");

  return (
    <div>
      <div
        className="flex gap-1"
        role="img"
        aria-label={`Bouwvoortgang — ${samenvatting}`}
      >
        {voortgang.momenten.map((moment) => (
          <div
            key={moment.type}
            className={[
              "h-4 flex-1 rounded-pill",
              moment.stand === "gepasseerd"
                ? "bg-olive"
                : moment.stand === "bekend"
                  ? "bg-olive/30"
                  : "bg-bone",
            ].join(" ")}
          />
        ))}
      </div>

      <p className="mt-s2 text-body text-ink">
        {voortgang.gepasseerd} van de {voortgang.totaal} bouwmomenten geweest
      </p>

      {voortgang.laatstGepasseerd ? (
        <p className="mt-1 text-sm text-slate">
          Laatst: {voortgang.laatstGepasseerd.titel}
          {voortgang.laatstGepasseerd.datum &&
            ` — ${toonDatum(voortgang.laatstGepasseerd.datum)}`}
        </p>
      ) : (
        <p className="mt-1 text-sm text-slate">
          Nog geen bouwmoment ingevuld. Hoe meer je invult, hoe minder er vanaf de opleverdatum
          geschat hoeft te worden.
        </p>
      )}

      {voortgang.volgende && (
        <p className="mt-1 text-sm text-slate">
          Volgende: {voortgang.volgende.titel}
          {voortgang.volgende.datum && ` — ${toonDatum(voortgang.volgende.datum)}`}
        </p>
      )}
    </div>
  );
}
