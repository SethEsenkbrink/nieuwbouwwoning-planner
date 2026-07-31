import { Link, useLocation } from "react-router";
import { actiefItem, actieveGroep, groepVan, NAVIGATIE } from "@/data/navigatie";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Navigatie — vijf groepen in plaats van elf losse links
 *
 * OPBOUW: TWEE REGELS, GEEN UITKLAPMENU.
 * De bovenste regel toont de vijf groepen; zit je in een groep met subschermen,
 * dan verschijnt daaronder een tweede, lichtere regel met die schermen. Een
 * dropdown zou hier een extra klik kosten plus toetsenbord- en
 * klik-buiten-afhandeling, voor hooguit vier items die gewoon passen.
 *
 * De tweede regel verschijnt alleen binnen die groep. De navigatie beweegt dus
 * mee met waar je bent in plaats van altijd alles te tonen.
 *
 * WAAROM DRIE COMPONENTEN EN NIET ÉÉN.
 * De drie stukken staan op verschillende regels in de header, met het
 * accountblok ertussen op de eerste regel. In één component zou het mobiele
 * paneel het accountblok met `flex-wrap` naar een derde regel duwen. De
 * open/dicht-stand woont daarom in `AppShell`, die de rijen indeelt.
 *
 * Alle kleuren en maten komen uit de huisstijl (`brink-theme.css`); er staat
 * geen enkele losse hex-waarde in dit bestand.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-olive focus-visible:outline-offset-2";

/** De vijf groepen. Op mobiel vervangen door één knop; zie `Menuknop`. */
export function Hoofdnavigatie() {
  const { pathname } = useLocation();
  const huidige = actieveGroep(pathname);

  return (
    <nav className="hidden sm:block" aria-label="Hoofdmenu">
      <ul className="flex flex-wrap items-center gap-1">
        {NAVIGATIE.map((groep) => {
          const actief = groep.sleutel === huidige;
          return (
            <li key={groep.sleutel}>
              <Link
                to={groep.pad}
                aria-current={actief ? "page" : undefined}
                className={[
                  "rounded-pill px-4 py-2 text-body transition-colors",
                  FOCUS,
                  actief ? "bg-clay text-canvas" : "text-slate hover:bg-bone hover:text-ink",
                ].join(" ")}
              >
                {groep.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** De knop die op mobiel het volledige menu open- en dichtklapt. */
export function Menuknop({ open, onKlik }: { open: boolean; onKlik: () => void }) {
  const { pathname } = useLocation();
  const groep = groepVan(actieveGroep(pathname));

  return (
    <button
      type="button"
      className={[
        "flex items-center gap-2 rounded-pill border border-bone bg-white px-4 py-2",
        "text-body text-ink sm:hidden",
        FOCUS,
      ].join(" ")}
      aria-expanded={open}
      aria-controls="hoofdmenu"
      onClick={onKlik}
    >
      <span aria-hidden="true">{open ? "✕" : "☰"}</span>
      {groep?.label ?? "Menu"}
    </button>
  );
}

/** Alles onder elkaar, met de groepen als kopjes. Alleen op mobiel. */
export function Mobielmenu({ onKies }: { onKies: () => void }) {
  const { pathname } = useLocation();
  const huidigeGroep = actieveGroep(pathname);
  const huidigItem = actiefItem(pathname);

  return (
    <nav id="hoofdmenu" className="sm:hidden" aria-label="Hoofdmenu">
      <ul className="mt-s2 flex flex-col gap-1 border-t border-bone pt-s2">
        {NAVIGATIE.map((groep) => (
          <li key={groep.sleutel}>
            <Link
              to={groep.pad}
              aria-current={groep.sleutel === huidigeGroep ? "page" : undefined}
              className={[
                "block rounded-xs px-4 py-3 text-body",
                FOCUS,
                groep.sleutel === huidigeGroep ? "bg-clay text-canvas" : "text-ink hover:bg-bone",
              ].join(" ")}
              onClick={onKies}
            >
              {groep.label}
            </Link>

            {groep.items.length > 0 && (
              <ul className="mb-s2 ml-s3 mt-1 flex flex-col gap-1">
                {groep.items.map((sub) => (
                  <li key={sub.pad}>
                    <Link
                      to={sub.pad}
                      aria-current={sub.pad === huidigItem ? "page" : undefined}
                      className={[
                        "block rounded-xs px-4 py-2 text-body",
                        FOCUS,
                        sub.pad === huidigItem
                          ? "bg-bone text-ink"
                          : "text-slate hover:bg-bone hover:text-ink",
                      ].join(" ")}
                      onClick={onKies}
                    >
                      {sub.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** De tweede regel: de schermen binnen de groep waar je nu in zit. */
export function Subnavigatie() {
  const { pathname } = useLocation();
  const groep = groepVan(actieveGroep(pathname));
  const huidigItem = actiefItem(pathname);

  if (!groep || groep.items.length === 0) return null;

  return (
    <nav className="mt-s2 hidden sm:block" aria-label={`Onderdelen van ${groep.label}`}>
      <ul className="flex flex-wrap items-center gap-s2 border-t border-bone pt-s2">
        {groep.items.map((sub) => {
          const actief = sub.pad === huidigItem;
          return (
            <li key={sub.pad}>
              <Link
                to={sub.pad}
                aria-current={actief ? "page" : undefined}
                className={[
                  "rounded-xs px-3 py-1 text-body transition-colors",
                  FOCUS,
                  actief
                    ? "bg-bone font-semibold text-ink"
                    : "text-slate hover:bg-bone hover:text-ink",
                ].join(" ")}
              >
                {sub.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
