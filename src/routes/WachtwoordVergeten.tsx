import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useAuth } from "@/context/useAuth";
import { authFoutmelding } from "@/lib/authFouten";
import { AuthLayout } from "@/components/AuthLayout";
import { Veld } from "@/components/Veld";
import { Knop } from "@/components/Knop";
import { Melding } from "@/components/Melding";

export default function WachtwoordVergeten() {
  const { wachtwoordResetMailen } = useAuth();

  const [email, setEmail] = useState("");
  const [verstuurd, setVerstuurd] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function verstuur(e: FormEvent) {
    e.preventDefault();
    setFout(null);
    setBezig(true);
    try {
      await wachtwoordResetMailen(email);
      setVerstuurd(true);
    } catch (err) {
      setFout(authFoutmelding(err));
    } finally {
      setBezig(false);
    }
  }

  return (
    <AuthLayout
      titel="Wachtwoord vergeten"
      ondertitel="Vul je e-mailadres in, dan sturen we een link om een nieuw wachtwoord in te stellen."
      voettekst={
        <Link to="/inloggen" className="font-semibold text-link underline">
          Terug naar inloggen
        </Link>
      }
    >
      {verstuurd ? (
        // Bewust neutraal geformuleerd: we bevestigen niet of dit adres bestaat.
        <Melding soort="gelukt">
          Als er een account bij dit e-mailadres hoort, is er een reset-link onderweg. Kijk ook
          even in je spam.
        </Melding>
      ) : (
        <form onSubmit={(e) => void verstuur(e)} className="flex flex-col gap-s2" noValidate>
          {fout && <Melding soort="fout">{fout}</Melding>}

          <Veld
            label="E-mailadres"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jij@voorbeeld.nl"
          />

          <Knop type="submit" bezig={bezig} volledigeBreedte>
            Stuur reset-link
          </Knop>
        </form>
      )}
    </AuthLayout>
  );
}
