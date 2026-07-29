import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/context/useAuth";
import { authFoutmelding } from "@/lib/authFouten";
import { AuthLayout } from "@/components/AuthLayout";
import { Veld } from "@/components/Veld";
import { Knop } from "@/components/Knop";
import { Melding } from "@/components/Melding";

interface LocatieState {
  vanaf?: string;
}

export default function Inloggen() {
  const { inloggen } = useAuth();
  const navigeer = useNavigate();
  const locatie = useLocation();

  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function verstuur(e: FormEvent) {
    e.preventDefault();
    setFout(null);
    setBezig(true);
    try {
      await inloggen(email, wachtwoord);
      // Terug naar waar de gebruiker heen wilde vóór de redirect naar inloggen.
      const state = locatie.state as LocatieState | null;
      void navigeer(state?.vanaf ?? "/", { replace: true });
    } catch (err) {
      setFout(authFoutmelding(err));
    } finally {
      setBezig(false);
    }
  }

  return (
    <AuthLayout
      titel="Inloggen"
      ondertitel="Welkom terug. Log in om verder te gaan met je project."
      voettekst={
        <>
          Nog geen account?{" "}
          <Link to="/registreren" className="font-semibold text-link underline">
            Maak er gratis een aan
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
          type="password"
          autoComplete="current-password"
          required
          value={wachtwoord}
          onChange={(e) => setWachtwoord(e.target.value)}
        />

        <Knop type="submit" bezig={bezig} volledigeBreedte>
          Inloggen
        </Knop>

        <Link to="/wachtwoord-vergeten" className="text-center text-body text-slate underline">
          Wachtwoord vergeten?
        </Link>
      </form>
    </AuthLayout>
  );
}
