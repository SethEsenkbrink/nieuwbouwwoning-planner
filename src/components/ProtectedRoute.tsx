import { Navigate, useLocation } from "react-router";
import type { ReactNode } from "react";
import { useVault } from "@/context/useVault";

/**
 * Beschermt routes die een ontgrendelde lokale kluis vereisen.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isOntgrendeld } = useVault();
  const locatie = useLocation();

  if (!isOntgrendeld) {
    return <Navigate to="/inloggen" state={{ vanaf: locatie.pathname }} replace />;
  }

  return <>{children}</>;
}
