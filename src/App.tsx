import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/context/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Laadscherm } from "@/components/Laadscherm";
import Inloggen from "@/routes/Inloggen";
import Registreren from "@/routes/Registreren";
import WachtwoordVergeten from "@/routes/WachtwoordVergeten";
import Dashboard from "@/routes/Dashboard";
import NietGevonden from "@/routes/NietGevonden";

/**
 * Routing in declarative mode (docs/decisions/ADR-0004).
 * Let op: importeren uit "react-router", niet uit "react-router-dom".
 */

/** Al ingelogd? Dan heeft het inlogscherm geen zin. */
function AlleenUitgelogd({ children }: { children: React.ReactNode }) {
  const { gebruiker, bezigMetLaden } = useAuth();
  if (bezigMetLaden) return <Laadscherm />;
  if (gebruiker) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/inloggen"
            element={
              <AlleenUitgelogd>
                <Inloggen />
              </AlleenUitgelogd>
            }
          />
          <Route
            path="/registreren"
            element={
              <AlleenUitgelogd>
                <Registreren />
              </AlleenUitgelogd>
            }
          />
          <Route
            path="/wachtwoord-vergeten"
            element={
              <AlleenUitgelogd>
                <WachtwoordVergeten />
              </AlleenUitgelogd>
            }
          />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NietGevonden />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
