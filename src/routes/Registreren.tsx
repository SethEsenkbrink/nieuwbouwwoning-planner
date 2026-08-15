import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useVault } from "@/context/useVault";
import { authFoutmelding } from "@/lib/authFouten";
import { AuthLayout } from "@/components/AuthLayout";
import { Veld } from "@/components/Veld";
import { Knop } from "@/components/Knop";
import { Melding } from "@/components/Melding";

const MIN_WACHTWOORD = 8;

export default function Registreren() {
  const { initialiseerKluis } = useVault();
  const navigeer = useNavigate();

  const [wachtwoord, setWachtwoord] = useState("");
  const [herhaling, setHerhaling] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const [gegenereerdeCode, setGegenereerdeCode] = useState<string | null>(null);
  const [bevestigdOpgeslagen, setBevestigdOpgeslagen] = useState(false);
  const [gekopieerd, setGekopieerd] = useState(false);

  async function verstuur(e: FormEvent) {
    e.preventDefault();
    setFout(null);

    if (wachtwoord.length < MIN_WACHTWOORD) {
      setFout(`Kies een wachtwoordzin van minimaal ${MIN_WACHTWOORD} tekens.`);
      return;
    }
    if (wachtwoord !== herhaling) {
      setFout("De twee wachtwoordzinnen zijn niet gelijk.");
      return;
    }

    setBezig(true);
    try {
      const res = await initialiseerKluis(wachtwoord);
      setGegenereerdeCode(res.herstelcode);
    } catch (err) {
      setFout(authFoutmelding(err));
    } finally {
      setBezig(false);
    }
  }

  async function kopieerCode() {
    if (!gegenereerdeCode) return;
    try {
      await navigator.clipboard.writeText(gegenereerdeCode);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 3000);
    } catch {
      // Negeer clipboard fout
    }
  }

  function afronden() {
    void navigeer("/project/nieuw", { replace: true });
  }

  if (gegenereerdeCode) {
    return (
      <AuthLayout
        titel="Herstelcode bewaren"
        ondertitel="Je lokale kluis is aangemaakt en versleuteld. Bewaar je 128-bit herstelcode nu veilig."
      >
        <div className="flex flex-col gap-s3">
          <Melding soort="info">
            Omdat Woningdossier 100% lokaal werkt en er geen centrale server is, kan niemand je
            wachtwoord resetten. Deze code is de <strong>enige</strong> manier om je dossier te
            herstellen als je je wachtwoordzin vergeet.
          </Melding>

          <div className="rounded-card border-2 border-clay bg-bone p-s3 text-center">
            <span className="text-eyebrow uppercase text-slate">Jouw 128-bit Herstelcode</span>
            <p className="mt-s1 font-mono text-h3 tracking-wider text-ink select-all">
              {gegenereerdeCode}
            </p>
            <div className="mt-s2 flex justify-center">
              <Knop variant="secundair" onClick={() => void kopieerCode()}>
                {gekopieerd ? "✓ Gekopieerd naar klembord" : "Kopieer herstelcode"}
              </Knop>
            </div>
          </div>

          <label className="flex items-start gap-s2 cursor-pointer pt-s1 text-body text-charcoal">
            <input
              type="checkbox"
              checked={bevestigdOpgeslagen}
              onChange={(e) => setBevestigdOpgeslagen(e.target.checked)}
              className="mt-1 size-4 rounded border-bone text-clay focus:ring-clay"
            />
            <span>
              Ik heb mijn herstelcode veilig genoteerd of opgeslagen in mijn wachtwoordmanager.
            </span>
          </label>

          <Knop
            type="button"
            volledigeBreedte
            disabled={!bevestigdOpgeslagen}
            onClick={afronden}
          >
            Start met Woningdossier
          </Knop>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      titel="Nieuwe kluis aanmaken"
      ondertitel="100% lokaal en end-to-end versleuteld. Je gegevens verlaten dit apparaat nooit."
      voettekst={
        <>
          Heb je al een kluis?{" "}
          <Link to="/inloggen" className="font-semibold text-link underline">
            Ontgrendelen
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void verstuur(e)} className="flex flex-col gap-s2" noValidate>
        {fout && <Melding soort="fout">{fout}</Melding>}

        <Veld
          label="Wachtwoordzin"
          hint={`Kies een sterke wachtwoordzin van minimaal ${MIN_WACHTWOORD} tekens.`}
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_WACHTWOORD}
          value={wachtwoord}
          onChange={(e) => setWachtwoord(e.target.value)}
          placeholder="Bijvoorbeeld 4 willekeurige woorden"
        />

        <Veld
          label="Wachtwoordzin herhalen"
          type="password"
          autoComplete="new-password"
          required
          value={herhaling}
          onChange={(e) => setHerhaling(e.target.value)}
        />

        <Knop type="submit" bezig={bezig} volledigeBreedte>
          {bezig ? "Kluis aanmaken (Argon2id berekenen)..." : "Kluis aanmaken"}
        </Knop>
      </form>
    </AuthLayout>
  );
}
