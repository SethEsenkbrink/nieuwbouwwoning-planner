/**
 * Button — Brink huisstijl
 * variant: "primary" (ink-pill, standaard marketing-CTA)
 *          "secondary" (outline pill)
 *          "consent" (coral — UITSLUITEND consent/legaal, NOOIT marketing)
 * Rendert als <a> wanneer `href` is meegegeven, anders <button>.
 */
export function Button({
  variant = "primary",
  href,
  children,
  className = "",
  ...rest
}) {
  const base =
    "inline-flex items-center justify-center gap-2 text-button transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

  const variants = {
    // D3: primaire CTA = klei-pill
    primary:
      "bg-clay text-white border-[1.5px] border-clay rounded-pill px-6 py-2.5 hover:bg-clay-deep",
    // secundair = witte pill met warme rand
    secondary:
      "bg-white text-ink border-[1.5px] border-ink/15 rounded-pill px-6 py-2.5 hover:bg-bone",
    // olijf variant voor diepe/secundaire accenten
    olive:
      "bg-olive text-white border-[1.5px] border-olive rounded-pill px-6 py-2.5 hover:bg-olive-deep",
    consent:
      "bg-consent text-white rounded-consent px-[30px] py-1.5 text-[13px] font-medium",
  };

  const cls = `${base} ${variants[variant] || variants.primary} ${className}`;

  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

export default Button;
