import type { Garantiewaarborg } from "@/types/model";

/**
 * De formulierwaarden van de projectgegevens.
 *
 * Staat los van `components/Projectgegevensformulier.tsx` omdat een bestand dat
 * naast componenten ook constanten exporteert Fast Refresh breekt: React kan dan
 * niet meer bepalen of een wijziging de component raakt, en herlaadt de hele
 * pagina in plaats van alleen het component.
 *
 * Bedragen staan hier als tekst en worden pas bij het opslaan omgezet. Een half
 * ingetikt bedrag is nu eenmaal geen geldig getal, en een veld dat onder je
 * handen naar 0 springt is onwerkbaar.
 */
export interface Projectgegevenswaarden {
  naam: string;
  bouwnummer: string;
  projectnaam: string;
  aannemer: string;
  waarborg: Garantiewaarborg;
  koopsom: string;
  meerwerkbudget: string;
  bouwdepot: string;
}

export const LEGE_PROJECTGEGEVENS: Projectgegevenswaarden = {
  naam: "",
  bouwnummer: "",
  projectnaam: "",
  aannemer: "",
  waarborg: "woningborg",
  koopsom: "",
  meerwerkbudget: "",
  bouwdepot: "",
};
