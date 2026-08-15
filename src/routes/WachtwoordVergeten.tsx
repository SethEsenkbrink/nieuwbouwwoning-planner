import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useVault } from "@/context/useVault";
import { authFoutmelding } from "@/lib/authFouten";
import { AuthLayout } from "@/components/AuthLayout";
import { Veld } from "@/components/Veld";
import { Knop } from "@/components/Knop";
import { Melding } from "@/components/Melding";

export default function WachtwoordVergeten() {
  const { ontgrendelViaHerstel } = useVault();
  const navigeer = useNavigate();

  const [herstelcode, setHerstelcode] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function verstuur(e: FormEvent) {
    e.preventDefault();
    setFout(null);

    if (!herstelcode.trim()) {
      setFout("Voer je 128-bit herstelcode in.");
      return;
    }

    setBezig(true);
    try {
      await ontgrendelViaHerstel(herstelcode);
      void navigeer("/", { replace: true });
    } catch (err) {
      setFout(authFoutmelding(err));
    } finally {
      setBezig(false);
    }
  }

  return (
    <AuthLayout
      titel="Kluis herstellen"
      ondertitel="Omdat je kluis 100% lokaal versleuteld is, kan niemand je wachtwoord resetten. Voer je 128-bit herstelcode in om toegang te herstellen."
      voettekst={
        <Link to="/inloggen" className="font-semibold text-link underline">
          Terug naar ontgrendelen
        </Link>
      }
    >
      <form onSubmit={(e) => void verstuur(e)} className="flex flex-col gap-s2" noValidate>
        {fout && <Melding soort="fout">{fout}</Melding>}

        <Veld
          label="128-bit Herstelcode"
          hint="Bijv. XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-X (streepjes en hoofdletters zijn optioneel)"
          type="text"
          autoComplete="off"
          required
          value={herstelcode}
          onChange={(e) => setHerstelcode(e.target.value)}
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-X"
        />

        <Knop type="submit" bezig={bezig} volledigeBreedte>
          {bezig ? "Kluis herstellen..." : "Kluis herstellen met code"}
        </Knop>
      </form>
    </AuthLayout>
  );
}
