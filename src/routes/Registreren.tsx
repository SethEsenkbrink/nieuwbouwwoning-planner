import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/context/useAuth";
import { authFoutmelding } from "@/lib/authFouten";
import { AuthLayout } from "@/components/AuthLayout";
import { Veld } from "@/components/Veld";
import { Knop } from "@/components/Knop";
import { Melding } from "@/components/Melding";

/** Firebase weigert wachtwoorden korter dan 6; wij houden 8 aan. */
const MIN_WACHTWOORD = 8;

export default function Registreren() {
  const { registreren } = useAuth();
  const navigeer = useNavigate();

  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [herhaling, setHerhaling] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function verstuur(e: FormEvent) {
    e.preventDefault();
    setFout(null);

    // Client-side checks vóór de netwerkcall — scheelt de gebruiker wachttijd.
    if (wachtwoord.length < MIN_WACHTWOORD) {
      setFout(`Kies een wachtwoord van minimaal ${MIN_WACHTWOORD} tekens.`);
      return;
    }
    if (wachtwoord !== herhaling) {
      setFout("De twee wachtwoorden zijn niet gelijk.");
      return;
    }

    setBezig(true);
    try {
      await registreren(email, wachtwoord);
      void navigeer("/", { replace: true });
    } catch (err) {
      setFout(authFoutmelding(err));
    } finally {
      setBezig(false);
    }
  }

  return (
    <AuthLayout
      titel="Account aanmaken"
      ondertitel="Gratis. Je gegevens blijven van jou en zijn alleen voor jou zichtbaar."
      voettekst={
        <>
          Heb je al een account?{" "}
          <Link to="/inloggen" className="font-semibold text-link underline">
            Inloggen
          </Link>
        </>
      }
    >
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

        <Veld
          label="Wachtwoord"
          hint={`Minimaal ${MIN_WACHTWOORD} tekens.`}
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_WACHTWOORD}
          value={wachtwoord}
          onChange={(e) => setWachtwoord(e.target.value)}
        />

        <Veld
          label="Wachtwoord herhalen"
          type="password"
          autoComplete="new-password"
          required
          value={herhaling}
          onChange={(e) => setHerhaling(e.target.value)}
        />

        <Knop type="submit" bezig={bezig} volledigeBreedte>
          Account aanmaken
        </Knop>
      </form>
    </AuthLayout>
  );
}
