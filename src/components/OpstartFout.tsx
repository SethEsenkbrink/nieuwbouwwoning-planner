import { Logo } from "./Logo";

/**
 * Toont een opstartfout als volledig scherm.
 */
export function OpstartFout({ fout }: { fout: unknown }) {
  const melding = fout instanceof Error ? fout.message : String(fout);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-s2 py-s6">
      <div className="w-full max-w-2xl">
        <div className="mb-s4 flex justify-center">
          <Logo hoogte={44} />
        </div>

        <div className="brink-card p-s4">
          <div className="mb-s3 flex items-center gap-2">
            <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
            <span className="text-eyebrow uppercase text-slate">Opstartfout</span>
          </div>

          <h1 className="text-h3 text-ink">De app kan niet starten</h1>
          <p className="mt-s2 text-body text-slate">
            Er ging iets mis bij het initialiseren van de lokale opslag of kluis.
          </p>

          <details className="mt-s3">
            <summary className="cursor-pointer text-body font-semibold text-ink">
              Technische melding
            </summary>
            <pre className="mt-s1 overflow-x-auto rounded-xs bg-bone p-3 text-sm text-charcoal">
              {melding}
            </pre>
          </details>
        </div>
      </div>
    </main>
  );
}
