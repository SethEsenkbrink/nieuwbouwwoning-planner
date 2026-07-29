import { Link } from "react-router";
import { Logo } from "@/components/Logo";

export default function NietGevonden() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-s3 bg-canvas px-s2 text-center">
      <Logo hoogte={44} />
      <h1 className="text-h2 text-ink">Deze pagina bestaat niet</h1>
      <p className="max-w-md text-body text-slate">
        De link klopt niet of de pagina is verplaatst.
      </p>
      <Link to="/" className="brink-cta-primary px-6 py-3">
        Terug naar het dashboard
      </Link>
    </main>
  );
}
