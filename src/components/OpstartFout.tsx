import { Logo } from "./Logo";

/**
 * Toont een opstartfout als volledig scherm.
 *
 * Zonder dit krijg je een witte pagina met de melding alleen in de console —
 * precies op het moment dat iemand de app voor het eerst probeert te draaien en
 * nog niet weet waar hij moet kijken.
 */
export function OpstartFout({ fout }: { fout: unknown }) {
  const melding = fout instanceof Error ? fout.message : String(fout);
  const isConfigFout = melding.includes("Firebase-configuratie onvolledig");

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-s2 py-s6">
      <div className="w-full max-w-2xl">
        <div className="mb-s4 flex justify-center">
          <Logo hoogte={44} />
        </div>

        <div className="brink-card p-s4">
          <div className="mb-s3 flex items-center gap-2">
            <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
            <span className="text-eyebrow uppercase text-slate">
              {isConfigFout ? "Configuratie ontbreekt" : "Opstartfout"}
            </span>
          </div>

          {isConfigFout ? (
            <>
              <h1 className="text-h3 text-ink">De app kan nog niet starten</h1>
              <p className="mt-s2 text-body text-slate">
                Er is nog geen Firebase-configuratie gevonden. Dat is normaal bij een verse
                installatie — de app stopt hier bewust, in plaats van straks halverwege een
                onbegrijpelijke fout te geven.
              </p>

              <h2 className="mt-s3 text-body font-semibold text-ink">Wat je moet doen</h2>
              <ol className="mt-s1 list-decimal space-y-1.5 pl-5 text-body text-slate">
                <li>
                  Maak een Firebase-project aan en registreer een web-app.{" "}
                  <span className="text-granite">
                    Firebase Hosting niet aanvinken — wij hosten op Netlify.
                  </span>
                </li>
                <li>
                  Kopieer <code className="rounded-xs bg-bone px-1">.env.example</code> naar{" "}
                  <code className="rounded-xs bg-bone px-1">.env.local</code> en vul de vier
                  waarden in.
                </li>
                <li>
                  Herstart <code className="rounded-xs bg-bone px-1">npm run dev</code>. Vite
                  leest omgevingsvariabelen alleen bij het opstarten.
                </li>
              </ol>

              <p className="mt-s3 text-body text-slate">
                De volledige stappen staan in{" "}
                <code className="rounded-xs bg-bone px-1">
                  docs/2026-07-29-setup-checklist.md
                </code>
                .
              </p>
            </>
          ) : (
            <>
              <h1 className="text-h3 text-ink">De app is gestopt bij het opstarten</h1>
              <p className="mt-s2 text-body text-slate">
                Er ging iets mis vóórdat de applicatie kon renderen. De technische melding
                staat hieronder; de volledige stacktrace vind je in de browserconsole (F12).
              </p>
            </>
          )}

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
