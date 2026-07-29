import { useContext } from "react";
import { AuthContext, type AuthContextWaarde } from "./AuthContext";

/**
 * Staat bewust in een eigen bestand: een module die zowel componenten als
 * hooks exporteert breekt React Fast Refresh.
 */
export function useAuth(): AuthContextWaarde {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth moet binnen een <AuthProvider> gebruikt worden.");
  }
  return context;
}
