import { Navigate, useLocation } from "react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/context/useAuth";
import { Laadscherm } from "./Laadscherm";

/**
 * Beschermt routes die alleen voor ingelogde gebruikers zijn.
 *
 * De volgorde is belangrijk: eerst wachten tot Firebase de sessie hersteld
 * heeft, pas daarna beslissen. Zonder die check stuurt de app iedereen bij een
 * refresh kort naar /inloggen voordat de sessie terug is.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { gebruiker, bezigMetLaden } = useAuth();
  const locatie = useLocation();

  if (bezigMetLaden) {
    return <Laadscherm />;
  }

  if (!gebruiker) {
    // Bewaar waar iemand heen wilde, zodat we na inloggen terug kunnen sturen.
    return <Navigate to="/inloggen" state={{ vanaf: locatie.pathname }} replace />;
  }

  return <>{children}</>;
}
