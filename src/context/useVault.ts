import { useContext } from "react";
import { VaultContext, type VaultContextWaarde } from "./VaultContext";

export function useVault(): VaultContextWaarde {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error("useVault moet binnen een VaultProvider gebruikt worden");
  }
  return ctx;
}
