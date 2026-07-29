interface MeldingProps {
  soort: "fout" | "gelukt" | "info";
  children: React.ReactNode;
}

/**
 * Inline melding boven of onder een formulier.
 * role="alert" zorgt dat schermlezers de melding voorlezen zodra hij verschijnt.
 */
export function Melding({ soort, children }: MeldingProps) {
  const stijl = {
    fout: "bg-clay/10 text-clay-deep border-clay/30",
    gelukt: "bg-olive/10 text-olive-deep border-olive/30",
    info: "bg-bone text-charcoal border-taupe/40",
  } as const;

  return (
    <div
      role={soort === "fout" ? "alert" : "status"}
      className={`rounded-consent border px-4 py-3 text-body ${stijl[soort]}`}
    >
      {children}
    </div>
  );
}
