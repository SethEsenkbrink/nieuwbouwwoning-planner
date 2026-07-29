import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/brink-theme.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Element #root niet gevonden in index.html.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
