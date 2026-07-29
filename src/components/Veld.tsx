import type { InputHTMLAttributes } from "react";
import { useId } from "react";

interface VeldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Korte uitleg onder het label, bijv. wachtwoordeisen. */
  hint?: string;
}

/**
 * Tekstveld in de Brink-huisstijl. Label en input zijn expliciet gekoppeld via
 * useId — belangrijk voor schermlezers en voor het aanklikken van het label.
 */
export function Veld({ label, hint, className, ...props }: VeldProps) {
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
        aria-describedby={hintId}
        className={[
          "w-full rounded-xs border border-bone bg-white px-4 py-3",
          "text-body text-ink placeholder:text-taupe",
          "transition-colors focus:border-olive",
          "disabled:cursor-not-allowed disabled:bg-bone disabled:text-granite",
          className ?? "",
        ].join(" ")}
        {...props}
      />
    </div>
  );
}
