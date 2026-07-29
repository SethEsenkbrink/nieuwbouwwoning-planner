import { createContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export interface AuthContextWaarde {
  /** null = niet ingelogd. Pas betrouwbaar als `bezigMetLaden` false is. */
  gebruiker: User | null;
  /**
   * True zolang Firebase de sessie nog aan het herstellen is. In die periode
   * mag je NIET concluderen dat iemand uitgelogd is — anders knippert de app
   * bij elke refresh even naar het inlogscherm.
   */
  bezigMetLaden: boolean;
  registreren: (email: string, wachtwoord: string) => Promise<void>;
  inloggen: (email: string, wachtwoord: string) => Promise<void>;
  uitloggen: () => Promise<void>;
  wachtwoordResetMailen: (email: string) => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextWaarde | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [gebruiker, setGebruiker] = useState<User | null>(null);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);

  useEffect(() => {
    // Firebase herstelt de sessie asynchroon uit IndexedDB. Deze listener
    // vuurt één keer met de herstelde status, en daarna bij elke wijziging.
    const stop = onAuthStateChanged(auth, (u) => {
      setGebruiker(u);
      setBezigMetLaden(false);
    });
    return stop;
  }, []);

  const waarde = useMemo<AuthContextWaarde>(
    () => ({
      gebruiker,
      bezigMetLaden,
      registreren: async (email, wachtwoord) => {
        await createUserWithEmailAndPassword(auth, email.trim(), wachtwoord);
      },
      inloggen: async (email, wachtwoord) => {
        await signInWithEmailAndPassword(auth, email.trim(), wachtwoord);
      },
      uitloggen: async () => {
        await signOut(auth);
      },
      wachtwoordResetMailen: async (email) => {
        await sendPasswordResetEmail(auth, email.trim());
      },
    }),
    [gebruiker, bezigMetLaden],
  );

  return <AuthContext.Provider value={waarde}>{children}</AuthContext.Provider>;
}
