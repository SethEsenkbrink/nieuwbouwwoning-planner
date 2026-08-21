import { useEffect } from "react";
import { CANONIEKE_ORIGIN, canoniekeUrl, paginaVoorPad } from "@/data/publieke-paginas";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Titel, omschrijving en canonical per pagina
 *
 * Een SPA serveert voor élke route dezelfde `index.html`. Zonder deze hook
 * heten de landingspagina, de voorwaarden en de privacyverklaring in een
 * zoekresultaat alle drie hetzelfde, en verwijst hun canonical alle drie naar
 * dezelfde URL — waarmee je Google vertelt dat twee van de drie duplicaten
 * zijn.
 *
 * WAAROM DE CANONICAL HIER STAAT EN NIET IN index.html. Eén vaste canonical in
 * de HTML zou op /voorwaarden zeggen "de echte versie hiervan is de
 * homepage". Dat is erger dan geen canonical: het haalt de pagina actief uit
 * de index. Hij hoort dus per route gezet te worden, en dat kan alleen hier.
 *
 * DE APP-ROUTES KRIJGEN GEEN CANONICAL. Die horen niet in een index thuis en
 * worden door robots.txt afgeschermd. Ze zetten alleen de titel terug naar de
 * standaard, zodat het tabblad niet "Privacyverklaring" blijft heten nadat
 * iemand vanaf die pagina zijn kluis heeft geopend.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const STANDAARD_TITEL = "Woningdossier — 100% lokaal en versleuteld";

function zetMeta(selector: string, attribuut: string, waarde: string): void {
  const element = document.querySelector(selector);
  if (element) element.setAttribute(attribuut, waarde);
}

function zetCanonical(url: string | null): void {
  const bestaand = document.querySelector('link[rel="canonical"]');

  if (url === null) {
    bestaand?.remove();
    return;
  }

  if (bestaand) {
    bestaand.setAttribute("href", url);
    return;
  }

  const link = document.createElement("link");
  link.rel = "canonical";
  link.href = url;
  document.head.appendChild(link);
}

/**
 * Zet de metadata voor een publieke pagina.
 *
 * @param pad het pad uit `PUBLIEKE_PAGINAS`, bijvoorbeeld "/privacy"
 */
export function usePaginameta(pad: string): void {
  useEffect(() => {
    const pagina = paginaVoorPad(pad);
    if (!pagina) return;

    const url = canoniekeUrl(pagina.pad, CANONIEKE_ORIGIN);

    document.title = pagina.titel;
    zetMeta('meta[name="description"]', "content", pagina.beschrijving);
    zetMeta('meta[property="og:title"]', "content", pagina.titel);
    zetMeta('meta[property="og:description"]', "content", pagina.beschrijving);
    zetMeta('meta[property="og:url"]', "content", url);
    zetCanonical(url);
  }, [pad]);
}

/**
 * Zet de metadata terug naar de standaard, voor schermen binnen de app.
 *
 * Zonder canonical: deze schermen horen niet in een zoekindex.
 */
export function useStandaardmeta(): void {
  useEffect(() => {
    document.title = STANDAARD_TITEL;
    zetCanonical(null);
  }, []);
}
