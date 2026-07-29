import { Eyebrow } from "./Eyebrow.jsx";

/**
 * SatelliteCard — de signatuur van de huisstijl.
 * Cirkelvormige portret/mark met een witte satelliet-CTA rechtsonder.
 * Props:
 *  - eyebrow, title, description, href
 *  - image (optioneel): url voor foto in de cirkel
 *  - gradient (optioneel): "cobalt" (default) | "violet" | "coral" — vulkleur als er geen foto is
 *  - status (optioneel): tekst-badge, bijv. "Binnenkort"
 */
export function SatelliteCard({
  eyebrow,
  title,
  description,
  href = "#",
  image,
  gradient = "cobalt",
  status,
}) {
  const gradients = {
    clay: "bg-[radial-gradient(circle_at_35%_30%,#D77E4F,#C4633B)]",
    olive: "bg-[radial-gradient(circle_at_35%_30%,#67744F,#4E5B3C)]",
    sand: "bg-[radial-gradient(circle_at_35%_30%,#E7E0CF,#CDBFA3)]",
    // aliassen
    cobalt: "bg-[radial-gradient(circle_at_35%_30%,#D77E4F,#C4633B)]",
    violet: "bg-[radial-gradient(circle_at_35%_30%,#67744F,#4E5B3C)]",
    coral: "bg-[radial-gradient(circle_at_35%_30%,#D77E4F,#C4633B)]",
  };

  return (
    <article className="flex flex-col items-center text-center">
      <a
        href={href}
        className="group relative block focus-visible:outline-none"
        aria-label={title}
      >
        <div
          className={`relative flex h-[240px] w-[240px] items-center justify-center overflow-hidden rounded-pill shadow-e2 md:h-[280px] md:w-[280px] ${
            image ? "" : gradients[gradient] || gradients.cobalt
          }`}
        >
          {image ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : null}
          {status ? (
            <span className="absolute left-1/2 top-6 -translate-x-1/2 rounded-pill bg-white/90 px-4 py-1 text-eyebrow uppercase text-ink">
              {status}
            </span>
          ) : null}
        </div>
        {/* Satelliet-CTA: docked rechtsonder, steekt ~40% buiten de cirkel */}
        <span className="absolute bottom-2 right-2 flex h-14 w-14 items-center justify-center rounded-pill bg-white shadow-e1 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12h14M13 6l6 6-6 6"
              stroke="#141413"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </a>

      {eyebrow ? <div className="mt-8">{<Eyebrow>{eyebrow}</Eyebrow>}</div> : null}
      <h3 className="mt-3 text-h3 text-ink">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-[32ch] text-body text-slate">{description}</p>
      ) : null}
    </article>
  );
}

export default SatelliteCard;
