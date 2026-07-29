import type { ReactNode } from "react";
import { Logo } from "./Logo";

interface AuthLayoutProps {
  titel: string;
  ondertitel?: string;
  children: ReactNode;
  /** Links onderaan de kaart, bijv. "nog geen account?". */
  voettekst?: ReactNode;
}

/** Gedeelde opmaak voor inloggen, registreren en wachtwoord vergeten. */
export function AuthLayout({ titel, ondertitel, children, voettekst }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-s2 py-s6">
      <div className="w-full max-w-md">
        <div className="mb-s4 flex justify-center">
          <Logo hoogte={44} />
        </div>

        <div className="brink-card p-s4">
          <div className="mb-s3 flex items-center gap-2">
            {/* Eyebrow-dot: verplicht onderdeel van de huisstijl. */}
            <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
            <span className="text-eyebrow uppercase text-slate">{titel}</span>
          </div>

          {ondertitel && <p className="mb-s3 text-body text-slate">{ondertitel}</p>}

          {children}
        </div>

        {voettekst && <div className="mt-s3 text-center text-body text-slate">{voettekst}</div>}

        <p className="mt-s4 text-center text-sm text-granite">
          Deze tool structureert en herinnert. Termijnen zijn indicatief — je eigen contract
          blijft leidend.
        </p>
      </div>
    </main>
  );
}
