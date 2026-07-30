interface StapindicatorProps {
  stappen: readonly string[];
  /** Nul-gebaseerd. */
  huidige: number;
}

/**
 * Toont waar je bent in een meerstapsformulier.
 *
 * `aria-current="step"` zorgt dat een schermlezer de actieve stap aankondigt;
 * zonder dat is de indicator alleen visuele versiering.
 */
export function Stapindicator({ stappen, huidige }: StapindicatorProps) {
  return (
    <ol className="flex flex-wrap items-center gap-s2" aria-label="Voortgang">
      {stappen.map((stap, index) => {
        const gedaan = index < huidige;
        const actief = index === huidige;

        return (
          <li
            key={stap}
            aria-current={actief ? "step" : undefined}
            className="flex items-center gap-2"
          >
            <span
              className={[
                "flex size-7 items-center justify-center rounded-pill text-sm font-semibold",
                actief
                  ? "bg-clay text-canvas"
                  : gedaan
                    ? "bg-olive text-canvas"
                    : "bg-bone text-granite",
              ].join(" ")}
              aria-hidden="true"
            >
              {gedaan ? "✓" : index + 1}
            </span>
            <span className={actief ? "text-body text-ink" : "text-body text-granite"}>{stap}</span>
            {index < stappen.length - 1 && (
              <span className="ml-s2 hidden h-px w-8 bg-bone sm:block" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
