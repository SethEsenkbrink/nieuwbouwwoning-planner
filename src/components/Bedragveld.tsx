import { useId, type InputHTMLAttributes } from "react";
import { leesBedragInvoer, toonBedragInvoer } from "@/lib/bedrag";

interface BedragveldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  label: string;
  /** Korte uitleg onder het label. Eén regel — zegt wat de app met het bedrag doet. */
  hint?: string;
  /** De ingetypte tekst, niet het getal. De ouder houdt hem als string bij. */
  waarde: string;
  onWijzig: (tekst: string) => void;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Een veld waar geld in gaat — en dat er ook zo uitziet
 *
 * Tot 2 augustus 2026 was een bedrag een gewoon tekstveld met een label als
 * "Koopsom in euro's" en een hint "Hele euro's, zonder punten of komma's".
 * Die hint was geen uitleg maar een omweg om BUG-01 heen: de opschoning kon
 * geen komma aan, dus werd de gebruiker gevraagd zich daarnaar te voegen.
 *
 * Nu andersom. Het veld toont zelf dat het om geld gaat, accepteert elke
 * Nederlandse schrijfwijze, en bevestigt wat het ervan begrepen heeft.
 *
 * DRIE DINGEN DOEN HET WERK
 *
 * 1. **Het euroteken staat vast in het veld**, niet in het label. Je ziet aan
 *    het invoervak zelf waar je bent, ook als je halverwege een lang formulier
 *    binnenkomt. Het is een `span` naast de input en geen placeholder: een
 *    placeholder verdwijnt zodra je typt, precies wanneer je hem nodig hebt.
 * 2. **`inputMode="decimal"`** opent op een telefoon het numerieke toetsen-
 *    bord mét komma. Zonder dit staat daar het gewone alfabet.
 * 3. **Formatteren bij het verlaten van het veld.** Je typt `1250,50` en ziet
 *    `1.250` terugkomen zodra je verder klikt. Dat is de terugkoppeling die
 *    ontbrak: je wist pas bij het opslaan wat de app ervan gemaakt had, en bij
 *    een geweigerd bedrag wist je het helemaal niet.
 *
 * BIJ ONLEESBARE INVOER BLIJFT ER STAAN WAT ER STAAT. Verbeteren of leegmaken
 * zou de gebruiker zijn eigen typefout afnemen — dan zie je niet meer wat je
 * verkeerd deed. De foutmelding komt bij het opslaan, van het formulier zelf.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function Bedragveld({
  label,
  hint,
  waarde,
  onWijzig,
  className,
  ...props
}: BedragveldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body font-semibold text-ink">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-slate">
          {hint}
        </p>
      )}

      <div className="relative">
        {/* `aria-hidden`: de eenheid staat al in het label van het veld zelf,
            en een schermlezer die "euro" tussen label en waarde uitspreekt
            maakt het voorlezen van een formulier langer, niet duidelijker. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-body text-slate"
        >
          €
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-describedby={hintId}
          value={waarde}
          onChange={(e) => {
            onWijzig(e.target.value);
          }}
          onBlur={() => {
            const bedrag = leesBedragInvoer(waarde);
            if (bedrag !== undefined) onWijzig(toonBedragInvoer(bedrag));
          }}
          className={[
            "w-full rounded-xs border border-bone bg-white py-3 pl-9 pr-4",
            "text-body text-ink placeholder:text-taupe",
            "transition-colors focus:border-olive",
            "disabled:cursor-not-allowed disabled:bg-bone disabled:text-granite",
            className ?? "",
          ].join(" ")}
          {...props}
        />
      </div>
    </div>
  );
}
