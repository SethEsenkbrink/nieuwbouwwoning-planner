/**
 * NavPill — zwevende witte pill-navigatie onder de bovenrand.
 * Zero-JS mobiel menu via <details> (geen client-side hydration nodig).
 * Props:
 *  - logo: React node (per project uniek, altijd in huisstijl)
 *  - links: [{ label, href }]
 *  - cta: { label, href } (optioneel, ink-pill)
 */
export function NavPill({ logo, links = [], cta }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-s3 z-50 px-s3">
      <nav className="pointer-events-auto mx-auto flex max-w-content items-center justify-between rounded-pill bg-white/95 px-5 py-3 shadow-e1 backdrop-blur md:px-8">
        <a href="/" className="flex items-center" aria-label="Home">
          {logo}
        </a>

        {/* Desktop links */}
        <ul className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-[15px] font-medium text-ink transition-colors hover:text-clay"
                {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {l.label}{l.external ? " ↗" : ""}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden md:block">
          {cta ? (
            <a
              href={cta.href}
              className="inline-flex items-center rounded-button border-[1.5px] border-ink bg-ink px-5 py-1.5 text-button text-canvas hover:bg-charcoal"
            >
              {cta.label}
            </a>
          ) : null}
        </div>

        {/* Mobiel: details/summary hamburger (geen JS) */}
        <details className="relative md:hidden">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-pill border border-ink/15 [&::-webkit-details-marker]:hidden">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="#141413" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </summary>
          <div className="absolute right-0 mt-3 w-56 rounded-stadium bg-white p-4 shadow-e2">
            <ul className="flex flex-col gap-1">
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="block rounded-xs px-3 py-2 text-[16px] font-medium text-ink hover:bg-bone"
                    {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {l.label}{l.external ? " ↗" : ""}
                  </a>
                </li>
              ))}
              {cta ? (
                <li className="mt-2">
                  <a
                    href={cta.href}
                    className="block rounded-button bg-ink px-3 py-2 text-center text-button text-canvas"
                  >
                    {cta.label}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </details>
      </nav>
    </div>
  );
}

export default NavPill;
