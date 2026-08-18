import type {
  Afspraak,
  Anker,
  GarantieItem,
  Gebrek,
  InboedelItem,
  MateriaalItem,
  MeerwerkItem,
  Meter,
  Meterstand,
  Nabudgetpost,
  Onderdeel,
  OnderhoudTaak,
  Project,
  Termijn,
  VerzekeringItem,
} from "@/types/model";

export type SignaalNiveau = "info" | "attentie" | "waarschuwing" | "urgent";

export type RegelCategorie =
  | "termijnen"
  | "financieel"
  | "onderhoud"
  | "garantie"
  | "energie";

/** Alle categorieën met een leesbaar label, voor de schakelaars in de instellingen. */
export const REGELCATEGORIEEN: { waarde: RegelCategorie; label: string }[] = [
  { waarde: "termijnen", label: "Termijnen en deadlines" },
  { waarde: "financieel", label: "Geld en budget" },
  { waarde: "onderhoud", label: "Onderhoud" },
  { waarde: "garantie", label: "Garanties" },
  { waarde: "energie", label: "Energie" },
];

/** Status van een signaal in de signaaltabel. */
export type SignaalStatus = "nieuw" | "geaccepteerd" | "genegeerd" | "gesnoozed";

/** Hoeveel signalen er tegelijk zichtbaar mogen zijn (B6.8). */
export const MAX_ZICHTBARE_SIGNALEN = 3;

export interface RegelResultaat {
  id: string;
  regelId: string;
  /**
   * Versie van de regel die dit signaal maakte.
   *
   * Wordt centraal gestempeld door de motor uit REGELVERSIES, zodat een
   * regelwijziging niet stil onder hetzelfde nummer doorgaat: een weggeklikt
   * signaal van versie 1 komt bij versie 2 opnieuw langs.
   */
  versie?: number;
  categorie: RegelCategorie;
  niveau: SignaalNiveau;
  titel: string;
  beschrijving: string;
  actieTekst?: string;
  actieUrl?: string;
  deadlineDatum?: string; // YYYY-MM-DD
  referentieEntiteit?: {
    type: "project" | "gebrek" | "meerwerk" | "termijn" | "onderdeel" | "taak";
    id: string;
  };
  /**
   * De invoerwaarden waarop dit signaal berust.
   *
   * Twee doelen tegelijk. Ten eerste de uitleg: een signaal dat zegt "dit
   * verloopt bijna" zonder te tonen wélke datum en welk bedrag eronder zitten,
   * dwingt de lezer te vertrouwen in plaats van te controleren (B6.3).
   * Ten tweede de hash: hierover wordt de invoerHash berekend, zodat een
   * weggeklikt signaal wegblijft tot de onderliggende gegevens wijzigen (B6.6).
   *
   * Zet hier dus wáárden in, geen afgeleide tekst — en geen dagentellers die
   * elke nacht veranderen, want dan komt het signaal elke dag terug.
   */
  invoerwaarden?: Record<string, string | number | boolean>;
  /** Stabiele hash over regelId, versie en invoerwaarden. Gezet door de motor. */
  invoerHash?: string;
}

export interface RegelContext {
  project: Project & { id?: string };
  ankers?: (Anker & { id?: string })[];
  afspraken?: (Afspraak & { id?: string })[];
  meerwerk?: (MeerwerkItem & { id?: string })[];
  termijnen?: (Termijn & { id?: string })[];
  gebreken?: (Gebrek & { id?: string })[];
  nabudget?: (Nabudgetpost & { id?: string })[];
  onderdelen?: (Onderdeel & { id?: string })[];
  onderhoudstaken?: (OnderhoudTaak & { id?: string })[];
  garanties?: (GarantieItem & { id?: string })[];
  materialen?: (MateriaalItem & { id?: string })[];
  verzekeringen?: (VerzekeringItem & { id?: string })[];
  inboedel?: (InboedelItem & { id?: string })[];
  meters?: (Meter & { id?: string })[];
  meterstanden?: (Meterstand & { id?: string })[];
  peildatum?: Date;
}
