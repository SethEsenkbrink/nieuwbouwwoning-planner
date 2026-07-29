import type { ButtonHTMLAttributes } from "react";

interface KnopProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Huisstijlregel: primaire CTA = klei-pill, secundair = witte pill. */
  variant?: "primair" | "secundair";
  bezig?: boolean;
  volledigeBreedte?: boolean;
}

export function Knop({
  variant = "primair",
  bezig = false,
  volledigeBreedte = false,
  children,
  className,
  disabled,
  ...props
}: KnopProps) {
  const basis =
    "inline-flex items-center justify-center gap-2 rounded-pill px-6 py-3 " +
    "text-button transition-colors disabled:cursor-not-allowed disabled:opacity-50";

  const varianten = {
    primair: "bg-clay text-canvas hover:bg-clay-deep",
    secundair: "bg-white text-ink hover:bg-lifted border border-bone",
  } as const;

  return (
    <button
      className={[
        basis,
        varianten[variant],
        volledigeBreedte ? "w-full" : "",
        className ?? "",
      ].join(" ")}
      disabled={disabled ?? bezig}
      aria-busy={bezig}
      {...props}
    >
      {bezig && (
        <span
          className="size-4 animate-spin rounded-pill border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
