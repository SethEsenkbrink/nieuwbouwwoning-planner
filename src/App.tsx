import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/context/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Laadscherm } from "@/components/Laadscherm";
import Inloggen from "@/routes/Inloggen";
import Registreren from "@/routes/Registreren";
import WachtwoordVergeten from "@/routes/WachtwoordVergeten";
import Dashboard from "@/routes/Dashboard";
import ProjectWizard from "@/routes/ProjectWizard";
import Betrokkenen from "@/routes/Betrokkenen";
import Ankers from "@/routes/Ankers";
import Afspraken from "@/routes/Afspraken";
import Projectinstellingen from "@/routes/Projectinstellingen";
import Tijdlijn from "@/routes/Tijdlijn";
import Meerwerk from "@/routes/Meerwerk";
import Bouwdepot from "@/routes/Bouwdepot";
import Oplevering from "@/routes/Oplevering";
import Nabudget from "@/routes/Nabudget";
import Woning from "@/routes/Woning";
import Onderdelen from "@/routes/Onderdelen";
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
          <Route
            path="/project/nieuw"
            element={
              <ProtectedRoute>
                <ProjectWizard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project"
            element={
              <ProtectedRoute>
                <Projectinstellingen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/betrokkenen"
            element={
              <ProtectedRoute>
                <Betrokkenen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ankers"
            element={
              <ProtectedRoute>
                <Ankers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/afspraken"
            element={
              <ProtectedRoute>
                <Afspraken />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tijdlijn"
            element={
              <ProtectedRoute>
                <Tijdlijn />
              </ProtectedRoute>
            }
          />
          <Route
            path="/oplevering"
            element={
              <ProtectedRoute>
                <Oplevering />
              </ProtectedRoute>
            }
          />
          <Route
            path="/na-oplevering"
            element={
              <ProtectedRoute>
                <Nabudget />
              </ProtectedRoute>
            }
          />
          <Route
            path="/woning"
            element={
              <ProtectedRoute>
                <Woning />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onderdelen"
            element={
              <ProtectedRoute>
                <Onderdelen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bouwdepot"
            element={
              <ProtectedRoute>
                <Bouwdepot />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meerwerk"
            element={
              <ProtectedRoute>
                <Meerwerk />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NietGevonden />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
