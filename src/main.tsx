import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/brink-theme.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Element #root niet gevonden in index.html.");
}

const root = createRoot(rootElement);

/**
 * App wordt DYNAMISCH geïmporteerd, en dat is met opzet.
 *
 * `src/lib/firebase.ts` gooit tijdens het laden van de module een fout als de
 * configuratie ontbreekt (fail fast — beter dan straks een vage fout halverwege).
 * Bij een gewone statische import gebeurt dat vóórdat React ook maar iets kan
 * renderen: je krijgt een witte pagina met de melding alleen in de console.
 *
 * Met een dynamische import valt die fout binnen dit try/catch, zodat we een
 * leesbaar scherm kunnen tonen dat vertelt wat er moet gebeuren.
 */
try {
  const { default: App } = await import("./App");
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (fout) {
  console.error("Opstarten mislukt:", fout);
  const { OpstartFout } = await import("./components/OpstartFout");
  root.render(<OpstartFout fout={fout} />);
}
