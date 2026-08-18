/**
 * Nieuwbouwplanner-logo als React-component.
 *
 * De mark staat inline (geen <img>) zodat hij scherp blijft, meekleurt met de
 * variant en geen extra request kost. Zie public/logo/README.md voor de regels.
 */

type Variant = "icon" | "horizontaal";

interface LogoProps {
  variant?: Variant;
  /** Hoogte van de mark in px. Onder 24px de favicon-variant gebruiken. */
  hoogte?: number;
  /** Op donkere achtergrond wordt de wordmark cream in plaats van ink. */
  donker?: boolean;
  className?: string;
}

const GEVEL_PAD =
  "M42 5 Q45.2 5 47.4 7.2 L74.8 34.6 Q77 36.8 77 40 L77 69 Q77 75 71 75 " +
  "L13 75 Q7 75 7 69 L7 40 Q7 36.8 9.2 34.6 L36.6 7.2 Q38.8 5 42 5 Z";

function Mark({ gradientId }: { gradientId: string }) {
  return (
    <>
      <defs>
        <radialGradient id={gradientId} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="var(--color-clay-light)" />
          <stop offset="1" stopColor="var(--color-clay)" />
        </radialGradient>
      </defs>
      <path d={GEVEL_PAD} fill={`url(#${gradientId})`} />
      <circle cx="72" cy="72" r="16" fill="var(--color-lifted)" />
      <path
        d="M65 72.5 l4.8 4.8 L79 66.5"
        fill="none"
        stroke="var(--color-olive)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

export function Logo({
  variant = "horizontaal",
  hoogte = 40,
  donker = false,
  className,
}: LogoProps) {
  // Unieke gradient-id per instantie: twee logo's op één pagina met dezelfde
  // id laten de tweede de gradient van de eerste erven.
  const gradientId = `np-gevel-${variant}-${donker ? "d" : "l"}`;

  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 100 100"
        height={hoogte}
        width={hoogte}
        className={className}
        role="img"
        aria-label="Nieuwbouwplanner"
      >
        <Mark gradientId={gradientId} />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 440 120"
      height={hoogte}
      className={className}
      role="img"
      aria-label="Nieuwbouwplanner"
    >
      <g transform="translate(4,14) scale(0.92)">
        <Mark gradientId={gradientId} />
      </g>
      <text
        x="104"
        y="74"
        fontFamily="Manrope Variable, Manrope, system-ui, sans-serif"
        fontSize="36"
        fontWeight="700"
        letterSpacing="-1"
        fill={donker ? "var(--color-canvas)" : "var(--color-ink)"}
      >
        nieuwbouw
        <tspan fill={donker ? "var(--color-clay-light)" : "var(--color-clay)"}>planner</tspan>
      </text>
    </svg>
  );
}
