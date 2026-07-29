import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/context/useAuth";

/**
 * Nog leeg — dit is het fundament, niet de app.
 *
 * Wat hier komt (docs/PROJECT.md §6, MVP):
 *   - eerstvolgende deadline
 *   - wat loopt achter
 *   - snelkoppeling naar de fase-tijdlijn
 *
 * De eerstvolgende stap staat in docs/STATE.md.
 */
export default function Dashboard() {
  const { gebruiker } = useAuth();

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Dashboard</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Je bent ingelogd</h1>

      <p className="mt-s2 max-w-xl text-body text-slate">
        Het fundament staat: authenticatie, huisstijl, security-rules en de build-pipeline
        werken. Hier komt straks je overzicht met de eerstvolgende deadlines.
      </p>

      <div className="brink-card mt-s4 max-w-xl p-s3">
        <h2 className="text-h3 text-ink">Status</h2>
        <dl className="mt-s2 grid grid-cols-[auto_1fr] gap-x-s2 gap-y-1 text-body">
          <dt className="text-slate">Account</dt>
          <dd className="text-ink">{gebruiker?.email ?? "—"}</dd>
          <dt className="text-slate">Projecten</dt>
          <dd className="text-ink">Nog geen — komt in de volgende stap</dd>
        </dl>
      </div>
    </AppShell>
  );
}
