import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/brink-theme.css";
import "./styles/print.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Element #root niet gevonden in index.html.");
}

const root = createRoot(rootElement);

try {
  const { default: App } = await import("./App");
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (fout) {
  // Geen console.error: OpstartFout toont de melding én de stacktrace op het
  // scherm zelf. Dat is bruikbaarder dan een regel in een console die niemand
  // opent, en het houdt src/ vrij van console-aanroepen (bevinding A-20).
  const { OpstartFout } = await import("./components/OpstartFout");
  root.render(<OpstartFout fout={fout} />);
}
