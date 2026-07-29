/**
 * Footer — donkere ink-sectie met grote conversationele kop + kolommen.
 * Props:
 *  - headline: grote kop
 *  - logo: React node (per project uniek)
 *  - columns: [{ title, links: [{ label, href, external }] }]
 *  - legal: kleine regel onderaan
 */
export function Footer({ headline, logo, columns = [], legal }) {
  return (
    <footer className="bg-ink text-canvas">
      <div className="mx-auto max-w-content px-s3 pb-s12 pt-s12 md:px-s8">
        {headline ? (
          <h2 className="max-w-[18ch] text-h2 text-canvas">{headline}</h2>
        ) : null}

        <div className="mt-s8 grid grid-cols-2 gap-8 md:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-eyebrow uppercase text-taupe">{col.title}</h3>
              <ul className="mt-4 flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-[14px] font-body text-canvas/85 transition-colors hover:text-white"
                      {...(l.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      {l.label}
                      {l.external ? " ↗" : ""}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-s8 flex flex-col gap-4 border-t border-white/15 pt-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 opacity-90">{logo}</div>
          {legal ? <p className="text-[13px] text-canvas/60">{legal}</p> : null}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
