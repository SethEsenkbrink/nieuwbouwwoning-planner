import { useId, type TextareaHTMLAttributes } from "react";

interface TekstvlakProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

/** Meerregelig tekstveld, verder identiek aan `Veld`. */
export function Tekstvlak({ label, hint, className, rows = 3, ...props }: TekstvlakProps) {
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
      <textarea
        id={id}
        rows={rows}
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
