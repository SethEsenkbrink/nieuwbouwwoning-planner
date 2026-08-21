import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { VaultProvider } from "@/context/VaultContext";
import { useVault } from "@/context/useVault";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Laadscherm } from "@/components/Laadscherm";
import Landing from "@/routes/Landing";
import Voorwaarden from "@/routes/Voorwaarden";
import Privacy from "@/routes/Privacy";
import Inloggen from "@/routes/Inloggen";
import Registreren from "@/routes/Registreren";
import WachtwoordVergeten from "@/routes/WachtwoordVergeten";
import Dashboard from "@/routes/Dashboard";
import Startwizard from "@/routes/Startwizard";
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
import Energie from "@/routes/Energie";
import SnelVastleggen from "@/routes/SnelVastleggen";
import Mjop from "@/routes/Mjop";
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

/**
 * `/` heeft drie gezichten, en het onderscheid zit hem in wat er op dít
 * apparaat al staat.
 *
 *   ontgrendeld         → het dashboard
 *   kluis bestaat hier  → het ontgrendelscherm
 *   geen kluis          → de landingspagina
 *
 * De landingspagina is nieuw: tot nu toe stuurde `/` iedereen rechtstreeks
 * naar /inloggen, dus naar een wachtwoordveld zonder één zin over waar dat
 * wachtwoord bij hoort.
 *
 * MAAR HIJ MAG NIET IEDEREEN OVERKOMEN. De kluis vergrendelt zichzelf bij
 * inactiviteit en zodra je van tabblad wisselt. Zou `/` dan de
 * marketingpagina tonen, dan krijgt iemand die zijn dossier al vier maanden
 * gebruikt elke keer opnieuw uitgelegd wat de app is, en moet hij zelf de weg
 * naar het ontgrendelscherm zoeken. Vandaar `isGeinitialiseerd`: bestaat er
 * hier een kluis, dan is dat de bedoeling van dit bezoek.
 *
 * Zolang dat nog niet vaststaat (`bezig`) toont hij een laadscherm en geen van
 * beide. Anders flitst er bij elke start eerst een verkeerd scherm voorbij —
 * `isGeinitialiseerd` staat op true tot het tegendeel uit IndexedDB blijkt.
 */
function Startpagina() {
  const { isOntgrendeld, isGeinitialiseerd, bezig } = useVault();

  if (isOntgrendeld) return <Dashboard />;
  if (bezig) return <Laadscherm />;
  if (isGeinitialiseerd) return <Navigate to="/inloggen" replace />;
  return <Landing />;
}

export default function App() {
  return (
    <BrowserRouter>
      <VaultProvider>
        <Routes>
          {/* ── Publiek: zichtbaar zonder ontgrendelde kluis ────────── */}
          <Route path="/voorwaarden" element={<Voorwaarden />} />
          <Route path="/privacy" element={<Privacy />} />

          <Route
            path="/inloggen"
            element={
              <AlleenVergrendeld>
                <Inloggen />
              </AlleenVergrendeld>
            }
          />
          {/* NIET in AlleenVergrendeld. `initialiseerKluis()` ontgrendelt de
              kluis zelf, waardoor die wacht tussen het aanmaken en het tonen
              van de herstelcode in zou wegnavigeren — en dan ziet de gebruiker
              de enige noodingang van zijn dossier nooit. Registreren beslist
              nu zelf, via `lib/registratie.ts`. */}
          <Route path="/registreren" element={<Registreren />} />
          <Route
            path="/wachtwoord-vergeten"
            element={
              <AlleenVergrendeld>
                <WachtwoordVergeten />
              </AlleenVergrendeld>
            }
          />

          <Route path="/" element={<Startpagina />} />
          <Route
            path="/start"
            element={
              <ProtectedRoute>
                <Startwizard />
              </ProtectedRoute>
            }
          />
          {/* De oude driestapswizard zat op /project/nieuw. Die URL staat in
              bladwijzers en in oude sessielogs, dus hij blijft werken en wijst
              door naar de startwizard. */}
          <Route path="/project/nieuw" element={<Navigate to="/start" replace />} />
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
            path="/snel"
            element={
              <ProtectedRoute>
                <SnelVastleggen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/energie"
            element={
              <ProtectedRoute>
                <Energie />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mjop"
            element={
              <ProtectedRoute>
                <Mjop />
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
