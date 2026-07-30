import { useId, type SelectHTMLAttributes } from "react";

export interface Keuze<T extends string> {
  waarde: T;
  label: string;
  /** Korte uitleg onder de optie, alleen zichtbaar bij de gekozen waarde. */
  toelichting?: string;
}

interface KeuzeveldProps<T extends string> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "onChange" | "value"
> {
  label: string;
  hint?: string;
  waarde: T;
  opties: readonly Keuze<T>[];
  onKies: (waarde: T) => void;
}

/**
 * Keuzelijst in de huisstijl, met dezelfde vormgeving als `Veld`.
 *
 * De toelichting bij de gekozen optie staat eronder in plaats van in de lijst:
 * zo zie je wat je keuze betekent zonder dat de lijst zelf onleesbaar wordt.
 * Bij de opleverstatus is dat het verschil tussen "indicatief" en "aangezegd",
 * en dat verschil bepaalt of je iemand definitief mag boeken.
 */
export function Keuzeveld<T extends string>({
  label,
  hint,
  waarde,
  opties,
  onKies,
  className,
  ...props
}: KeuzeveldProps<T>) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const gekozen = opties.find((o) => o.waarde === waarde);

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
      <select
        id={id}
        aria-describedby={hintId}
        value={waarde}
        onChange={(e) => {
          onKies(e.target.value as T);
        }}
        className={[
          "w-full rounded-xs border border-bone bg-white px-4 py-3",
          "text-body text-ink",
          "transition-colors focus:border-olive",
          "disabled:cursor-not-allowed disabled:bg-bone disabled:text-granite",
          className ?? "",
        ].join(" ")}
        {...props}
      >
        {opties.map((optie) => (
          <option key={optie.waarde} value={optie.waarde}>
            {optie.label}
          </option>
        ))}
      </select>
      {gekozen?.toelichting && <p className="text-sm text-granite">{gekozen.toelichting}</p>}
    </div>
  );
}
