import { useId } from "react";
import { alsInvoerwaarde, uitInvoerwaarde } from "@/lib/datum";

interface DatumveldProps {
  label: string;
  hint?: string;
  waarde: Date | undefined;
  onKies: (datum: Date | undefined) => void;
  disabled?: boolean;
}

/**
 * Datumveld dat `Date`-objecten in en uit geeft in plaats van strings.
 *
 * De omzetting zit in `src/lib/datum.ts` en werkt bewust in UTC: `planning.ts`
 * rekent met UTC-middernacht, en lokale tijd zou de datum in de zomer een dag
 * verschuiven.
 */
export function Datumveld({ label, hint, waarde, onKies, disabled }: DatumveldProps) {
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
      <input
        id={id}
        type="date"
        aria-describedby={hintId}
        disabled={disabled}
        value={alsInvoerwaarde(waarde)}
        onChange={(e) => {
          onKies(uitInvoerwaarde(e.target.value));
        }}
        className={[
          "w-full rounded-xs border border-bone bg-white px-4 py-3",
          "text-body text-ink",
          "transition-colors focus:border-olive",
          "disabled:cursor-not-allowed disabled:bg-bone disabled:text-granite",
        ].join(" ")}
      />
    </div>
  );
}
