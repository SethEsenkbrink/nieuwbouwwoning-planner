/**
 * Section + Container — layout-primitieven op het cream canvas.
 * tone: "canvas" (standaard) | "lifted" (raised paper) | "ink" (donkere sectie)
 */
export function Section({ tone = "canvas", children, className = "", ...rest }) {
  const tones = {
    canvas: "bg-canvas text-ink",
    lifted: "bg-lifted text-ink",
    ink: "bg-ink text-canvas",
  };
  return (
    <section
      className={`${tones[tone] || tones.canvas} py-s12 md:py-s16 ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}

export function Container({ children, className = "", ...rest }) {
  return (
    <div
      className={`mx-auto w-full max-w-content px-s3 md:px-s8 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Section;
