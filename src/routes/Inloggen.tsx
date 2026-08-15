import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useVault } from "@/context/useVault";
import { authFoutmelding } from "@/lib/authFouten";
import { AuthLayout } from "@/components/AuthLayout";
import { Veld } from "@/components/Veld";
import { Knop } from "@/components/Knop";
import { Melding } from "@/components/Melding";
import { db } from "@/db/db";
import { importeerDossier } from "@/lib/backup/import";

interface LocatieState {
  vanaf?: string;
}

export default function Inloggen() {
  const { ontgrendel } = useVault();
  const navigeer = useNavigate();
  const locatie = useLocation();

  const [wachtwoord, setWachtwoord] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const [toonBackupHerstel, setToonBackupHerstel] = useState(false);
  const [gekozenBestand, setGekozenBestand] = useState<File | null>(null);
  const [backupWachtwoord, setBackupWachtwoord] = useState("");

  async function verstuur(e: FormEvent) {
    e.preventDefault();
    setFout(null);

    if (!wachtwoord) {
      setFout("Voer je wachtwoordzin in.");
      return;
    }

    setBezig(true);
    try {
      await ontgrendel(wachtwoord);
      const state = locatie.state as LocatieState | null;
      void navigeer(state?.vanaf ?? "/", { replace: true });
    } catch (err) {
      setFout(authFoutmelding(err));
    } finally {
      setBezig(false);
    }
  }

  async function herstelUitBackup(e: FormEvent) {
    e.preventDefault();
    setFout(null);

    if (!gekozenBestand || !backupWachtwoord.trim()) {
      setFout("Kies een backupbestand (.woningdossier) en voer het bijbehorende wachtwoord of de herstelcode in.");
      return;
    }

    setBezig(true);
    try {
      const buffer = await gekozenBestand.arrayBuffer();
      const zipBytes = new Uint8Array(buffer);
      await importeerDossier(zipBytes, backupWachtwoord, db);
      await ontgrendel(backupWachtwoord);
      void navigeer("/", { replace: true });
    } catch (err) {
      setFout(authFoutmelding(err));
    } finally {
      setBezig(false);
    }
  }

  return (
    <AuthLayout
      titel={toonBackupHerstel ? "Dossier herstellen uit backup" : "Kluis ontgrendelen"}
      ondertitel={
        toonBackupHerstel
          ? "Selecteer je versleutelde .woningdossier bestand om je data te herstellen."
          : "Voer je wachtwoordzin in om je lokale woningdossier te openen."
      }
      voettekst={
        <>
          Nog geen kluis aangemaakt?{" "}
          <Link to="/registreren" className="font-semibold text-link underline">
            Nieuwe kluis initialiseren
          </Link>
        </>
      }
    >
      {toonBackupHerstel ? (
        <form onSubmit={(e) => void herstelUitBackup(e)} className="flex flex-col gap-s2" noValidate>
          {fout && <Melding soort="fout">{fout}</Melding>}

          <div className="flex flex-col gap-1">
            <label className="text-eyebrow uppercase text-slate">Backupbestand (.woningdossier)</label>
            <input
              type="file"
              accept=".woningdossier"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setGekozenBestand(file);
              }}
              className="text-sm text-charcoal file:mr-2 file:rounded file:border-0 file:bg-clay file:px-3 file:py-1 file:text-sm file:font-semibold file:text-lifted hover:file:bg-clay/90"
            />
          </div>

          <Veld
            label="Wachtwoordzin of Herstelcode"
            type="password"
            autoComplete="current-password"
            value={backupWachtwoord}
            onChange={(e) => setBackupWachtwoord(e.target.value)}
            placeholder="Wachtwoordzin van de backup"
          />

          <Knop type="submit" bezig={bezig} volledigeBreedte disabled={!gekozenBestand || !backupWachtwoord.trim()}>
            {bezig ? "Dossier herstellen & ontsleutelen..." : "Dossier herstellen"}
          </Knop>

          <button
            type="button"
            onClick={() => {
              setToonBackupHerstel(false);
              setFout(null);
            }}
            className="text-center text-body text-slate underline mt-s1"
          >
            Terug naar gewoon ontgrendelen
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void verstuur(e)} className="flex flex-col gap-s2" noValidate>
          {fout && <Melding soort="fout">{fout}</Melding>}

          <Veld
            label="Wachtwoordzin"
            type="password"
            autoComplete="current-password"
            value={wachtwoord}
            onChange={(e) => setWachtwoord(e.target.value)}
            placeholder="Voer je geheime wachtwoordzin in"
          />

          <Knop type="submit" bezig={bezig} volledigeBreedte>
            {bezig ? "Kluis ontgrendelen..." : "Kluis openen"}
          </Knop>

          <div className="flex flex-col gap-1.5 text-center mt-s1">
            <Link to="/wachtwoord-vergeten" className="text-body text-slate underline">
              Wachtwoordzin vergeten? Herstel met code
            </Link>
            <button
              type="button"
              onClick={() => {
                setToonBackupHerstel(true);
                setFout(null);
              }}
              className="text-body text-slate underline"
            >
              Herstellen uit een .woningdossier backupbestand
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
