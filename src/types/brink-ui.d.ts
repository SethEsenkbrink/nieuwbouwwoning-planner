/**
 * Type-shim voor @brink/ui.
 *
 * Het huisstijlfundament is plain JSX zonder types (zie docs/decisions/ADR-0003).
 * Deze declaratie maakt de componenten importeerbaar zonder dat TypeScript
 * struikelt. De props zijn bewust ruim: strakker typen zou hier een tweede
 * waarheid naast het fundament creëren, en die loopt gegarandeerd achter.
 *
 * Wordt @brink/ui ooit zelf getypeerd, dan kan dit bestand weg.
 */
declare module "@brink/ui" {
  import type { ComponentType, ReactNode } from "react";

  interface BasisProps {
    children?: ReactNode;
    className?: string;
    [key: string]: unknown;
  }

  export const Button: ComponentType<BasisProps>;
  export const Eyebrow: ComponentType<BasisProps>;
  export const Section: ComponentType<BasisProps>;
  export const Container: ComponentType<BasisProps>;
  export const SatelliteCard: ComponentType<BasisProps>;
  export const NavPill: ComponentType<BasisProps>;
  export const Footer: ComponentType<BasisProps>;
  export const tokens: Record<string, unknown>;
}

declare module "@brink/ui/tokens" {
  export const color: Record<string, string>;
  export const radius: Record<string, string>;
  export const spacing: Record<string, string>;
  export const elevation: Record<string, string>;
  export const typography: {
    fontFamily: string;
    weight: Record<string, number>;
    tracking: Record<string, string>;
  };
}
