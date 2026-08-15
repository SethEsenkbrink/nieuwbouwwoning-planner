import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { VaultProvider } from "@/context/VaultContext";
import { useVault } from "@/context/useVault";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import Onderhoud from "@/routes/Onderhoud";
import Meterstanden from "@/routes/Meterstanden";
import Overdrachtsdossier from "@/routes/Overdrachtsdossier";
import Diagnostiek from "@/routes/Diagnostiek";
import NietGevonden from "@/routes/NietGevonden";

/**
 * Routing in declarative mode (docs/decisions/ADR-0004).
 * Let op: importeren uit "react-router", niet uit "react-router-dom".
 */

/** Al ontgrendeld? Dan heeft het ontgrendelscherm geen zin. */
function AlleenVergrendeld({ children }: { children: React.ReactNode }) {
  const { isOntgrendeld } = useVault();
  if (isOntgrendeld) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <VaultProvider>
        <Routes>
          <Route
            path="/inloggen"
            element={
              <AlleenVergrendeld>
                <Inloggen />
              </AlleenVergrendeld>
            }
          />
          <Route
            path="/registreren"
            element={
              <AlleenVergrendeld>
                <Registreren />
              </AlleenVergrendeld>
            }
          />
          <Route
            path="/wachtwoord-vergeten"
            element={
              <AlleenVergrendeld>
                <WachtwoordVergeten />
              </AlleenVergrendeld>
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
            path="/onderhoud"
            element={
              <ProtectedRoute>
                <Onderhoud />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meterstanden"
            element={
              <ProtectedRoute>
                <Meterstanden />
              </ProtectedRoute>
            }
          />
          <Route
            path="/overdrachtsdossier"
            element={
              <ProtectedRoute>
                <Overdrachtsdossier />
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

          <Route
            path="/diagnostiek"
            element={
              <ProtectedRoute>
                <Diagnostiek />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NietGevonden />} />
        </Routes>
      </VaultProvider>
    </BrowserRouter>
  );
}
