import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useVault } from "@/context/useVault";
import { Logo } from "./Logo";
import { Knop } from "./Knop";
import { Hoofdnavigatie, Menuknop, Mobielmenu, Subnavigatie } from "./Hoofdnavigatie";
import { magBewerken, useModus } from "@/context/useModus";

/**
 * Header + container voor alle schermen in het Woningdossier.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const modus = useModus();
  const { pathname } = useLocation();
  const bewerkenToegestaan = magBewerken(modus, pathname);
  const { vergrendel } = useVault();
  const navigeer = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function sluitKluis() {
    vergrendel();
    void navigeer("/inloggen", { replace: true });
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="niet-printen border-b border-bone bg-lifted">
        <div className="mx-auto max-w-content px-s2 py-s2">
          <div className="flex flex-wrap items-center gap-s2">
            <Link to="/" aria-label="Naar het dashboard" className="mr-s2 shrink-0">
              <Logo hoogte={36} />
            </Link>

            <Hoofdnavigatie />
            <Menuknop
              open={menuOpen}
              onKlik={() => {
                setMenuOpen((aan) => !aan);
              }}
            />

            <div className="ml-auto flex items-center gap-s2">
              <Link
                to="/diagnostiek"
                className="hidden items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium text-slate hover:bg-bone hover:text-ink md:inline-flex"
                title="Systeemaudit & Diagnostiek"
              >
                <span className="size-2 rounded-full bg-emerald-500" />
                Diagnostiek
              </Link>
              <Knop variant="secundair" onClick={sluitKluis}>
                Vergrendelen
              </Knop>
            </div>
          </div>

          {menuOpen && (
            <Mobielmenu
              onKies={() => {
                setMenuOpen(false);
              }}
            />
          )}

          <Subnavigatie />
        </div>
      </header>

      {/* ── Modusindicator ───────────────────────────────────────────────
          De actieve modus moet onmiskenbaar zijn (B8.1): op mobiel ben je
          aan het vastleggen, niet aan het beheren. */}
      {modus === "mobiel" && (
        <div className="niet-printen mx-auto max-w-content px-s2">
          <p className="rounded-md bg-bone px-s2 py-1 text-sm text-slate">
            <strong className="text-ink">Mobiele modus</strong> —
            {bewerkenToegestaan
              ? " snel vastleggen"
              : " alleen lezen. Bewerken doe je op de desktop."}
          </p>
        </div>
      )}

      {/* Op mobiel buiten quick-capture is de inhoud niet te bedienen (B8.2).
          `inert` zet alle controls in één keer uit; de navigatie hierboven
          valt erbuiten en blijft dus gewoon werken. */}
      <main className="mx-auto max-w-content px-s2 py-s4" inert={!bewerkenToegestaan}>
        {children}
      </main>

      <footer className="niet-printen mx-auto max-w-content px-s2 pb-s4">
        <p className="text-sm text-granite">
          Woningdossier structureert en herinnert; het is geen juridisch of financieel advies.
          Termijnen zijn indicatief — controleer ze altijd tegen je eigen contract.
        </p>

        {/* De juridische pagina's moeten ook binnen de app bereikbaar zijn.
            Ze staan bewust niet in de hoofdnavigatie: daar hoort werk, niet
            naslag. */}
        <nav aria-label="Juridisch" className="mt-s2 flex flex-wrap gap-s3 text-sm text-granite">
          <Link to="/voorwaarden" className="underline-offset-4 hover:text-slate hover:underline">
            Algemene voorwaarden
          </Link>
          <Link to="/privacy" className="underline-offset-4 hover:text-slate hover:underline">
            Privacyverklaring
          </Link>
        </nav>
      </footer>
    </div>
  );
}
