import type { LogGebeurtenis, LogNiveau } from "./types";

const MAX_LOG_ITEMS = 200;
const logBuffer: LogGebeurtenis[] = [];

/**
 * Registreert een diagnostische gebeurtenis in het lokale in-memory logboek.
 */
export function logEvent(
  niveau: LogNiveau,
  categorie: string,
  bericht: string,
  context?: Record<string, unknown>,
): void {
  const item: LogGebeurtenis = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tijdstip: new Date().toISOString(),
    niveau,
    categorie,
    bericht,
    context,
  };

  logBuffer.unshift(item);
  if (logBuffer.length > MAX_LOG_ITEMS) {
    logBuffer.pop();
  }
}

export function haalLogGebeurtenissen(): LogGebeurtenis[] {
  return [...logBuffer];
}

export function wisLogGebeurtenissen(): void {
  logBuffer.length = 0;
}

// Initialiseer globale error-listeners in browseromgeving
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    logEvent("fout", "runtime_error", event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logEvent("fout", "unhandled_promise", String(event.reason), {
      reason: event.reason,
    });
  });
}
