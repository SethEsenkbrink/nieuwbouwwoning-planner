import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { db } from "@/db/db";
import type { VaultMeta } from "@/crypto/types";
import {
  initialiseerNieuweKluis,
  ontgrendelMetHerstelcode,
  ontgrendelMetWachtwoord,
} from "@/crypto/crypto";

const AUTO_LOCK_TIMEOUT_MS = 15 * 60 * 1000; // 15 minuten inactiviteit

export interface VaultContextWaarde {
  /** True wanneer de kluis ontgrendeld is en de DEK beschikbaar is in het geheugen */
  isOntgrendeld: boolean;
  /** True als er al een kluis is aangemaakt in IndexedDB */
  isGeinitialiseerd: boolean;
  /** Status tijdens initialisatie of cryptografische bewerking */
  bezig: boolean;
  /** De actieve non-extractable master encryptiesleutel (uitsluitend in RAM) */
  dek: CryptoKey | null;
  /** Metadata van de kluis (zouten, IVs, gewrapte DEK's) */
  meta: VaultMeta | null;
  /** Lokale gebruikersidentiteit */
  gebruiker: { uid: string } | null;

  /** Ontgrendelt de kluis met de wachtwoordzin */
  ontgrendel: (wachtwoord: string) => Promise<void>;
  /** Ontgrendelt de kluis met de 128-bit herstelcode */
  ontgrendelViaHerstel: (herstelcode: string) => Promise<void>;
  /** Initialiseert een nieuwe lokale kluis en geeft de herstelcode terug */
  initialiseerKluis: (wachtwoord: string) => Promise<{ herstelcode: string }>;
  /** Vergrendelt de kluis en wist de DEK uit het geheugen */
  vergrendel: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const VaultContext = createContext<VaultContextWaarde | undefined>(undefined);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [dek, setDek] = useState<CryptoKey | null>(null);
  const [meta, setMeta] = useState<VaultMeta | null>(null);
  const [isGeinitialiseerd, setIsGeinitialiseerd] = useState<boolean>(true);
  const [bezig, setBezig] = useState<boolean>(true);

  const lockTimerRef = useRef<number | null>(null);

  const vergrendel = useCallback(() => {
    setDek(null);
    if (lockTimerRef.current !== null) {
      window.clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  }, []);

  const resetLockTimer = useCallback(() => {
    if (lockTimerRef.current !== null) {
      window.clearTimeout(lockTimerRef.current);
    }
    lockTimerRef.current = window.setTimeout(() => {
      vergrendel();
    }, AUTO_LOCK_TIMEOUT_MS);
  }, [vergrendel]);

  // Initialiseer bij laden: controleer of er een vault_meta record bestaat
  useEffect(() => {
    let gemonteerd = true;
    async function laadMeta() {
      try {
        const opgeslagenMeta = await db.vault_meta.get("meta");
        if (gemonteerd) {
          if (opgeslagenMeta) {
            setMeta(opgeslagenMeta);
            setIsGeinitialiseerd(true);
          } else {
            setIsGeinitialiseerd(false);
          }
        }
      } catch (err) {
        console.error("Fout bij laden kluis-metadata:", err);
        if (gemonteerd) setIsGeinitialiseerd(false);
      } finally {
        if (gemonteerd) setBezig(false);
      }
    }

    void laadMeta();
    return () => {
      gemonteerd = false;
    };
  }, []);

  // Inactiviteit timer & Visibility Change listener
  useEffect(() => {
    if (!dek) return;

    resetLockTimer();

    const activiteitEvents = ["mousedown", "keydown", "touchstart", "scroll"];
    const onActiviteit = () => resetLockTimer();

    for (const ev of activiteitEvents) {
      window.addEventListener(ev, onActiviteit, { passive: true });
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        vergrendel();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (lockTimerRef.current !== null) {
        window.clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
      for (const ev of activiteitEvents) {
        window.removeEventListener(ev, onActiviteit);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [dek, resetLockTimer, vergrendel]);

  const ontgrendel = useCallback(
    async (wachtwoord: string) => {
      setBezig(true);
      try {
        let huidigeMeta = meta;
        if (!huidigeMeta) {
          const uitDb = await db.vault_meta.get("meta");
          if (!uitDb) {
            throw new Error("Geen kluis gevonden op dit apparaat.");
          }
          huidigeMeta = uitDb;
          setMeta(uitDb);
        }

        const ontgrendeldeDek = await ontgrendelMetWachtwoord(huidigeMeta, wachtwoord);
        setDek(ontgrendeldeDek);
        resetLockTimer();
      } finally {
        setBezig(false);
      }
    },
    [meta, resetLockTimer],
  );

  const ontgrendelViaHerstel = useCallback(
    async (herstelcode: string) => {
      setBezig(true);
      try {
        let huidigeMeta = meta;
        if (!huidigeMeta) {
          const uitDb = await db.vault_meta.get("meta");
          if (!uitDb) {
            throw new Error("Geen kluis gevonden op dit apparaat.");
          }
          huidigeMeta = uitDb;
          setMeta(uitDb);
        }

        const ontgrendeldeDek = await ontgrendelMetHerstelcode(huidigeMeta, herstelcode);
        setDek(ontgrendeldeDek);
        resetLockTimer();
      } finally {
        setBezig(false);
      }
    },
    [meta, resetLockTimer],
  );

  const initialiseer = useCallback(async (wachtwoord: string) => {
    setBezig(true);
    try {
      const resultaat = await initialiseerNieuweKluis(wachtwoord);
      await db.vault_meta.put(resultaat.meta);
      setMeta(resultaat.meta);
      setDek(resultaat.dek);
      setIsGeinitialiseerd(true);
      return { herstelcode: resultaat.herstelcode };
    } finally {
      setBezig(false);
    }
  }, []);

  const isOntgrendeld = dek !== null;

  const waarde = useMemo<VaultContextWaarde>(
    () => ({
      isOntgrendeld,
      isGeinitialiseerd,
      bezig,
      dek,
      meta,
      gebruiker: isOntgrendeld ? { uid: "lokaal" } : null,
      ontgrendel,
      ontgrendelViaHerstel,
      initialiseerKluis: initialiseer,
      vergrendel,
    }),
    [isOntgrendeld, isGeinitialiseerd, bezig, dek, meta, ontgrendel, ontgrendelViaHerstel, initialiseer, vergrendel],
  );

  return <VaultContext.Provider value={waarde}>{children}</VaultContext.Provider>;
}
