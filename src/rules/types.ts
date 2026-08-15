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

export interface RegelResultaat {
  id: string;
  regelId: string;
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
