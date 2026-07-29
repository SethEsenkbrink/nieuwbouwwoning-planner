/**
 * Eyebrow — sectie-categorie label.
 * Coral accent-dot + uppercase tekst. De dot is identiteit: nooit weglaten.
 */
export function Eyebrow({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-eyebrow uppercase text-slate ${className}`}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-pill bg-coral"
      />
      {children}
    </span>
  );
}

export default Eyebrow;
