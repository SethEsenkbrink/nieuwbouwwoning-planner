/**
 * SHA-256 Checksums generator en validator voor `.woningdossier`
 *
 * Genereert en valideert een sha256sum-compatibel `CHECKSUMS` bestand
 * voor alle entries in het zip-archief.
 */

export async function berekenSha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    data as ArrayBufferView<ArrayBuffer>,
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Maakt de inhoud voor het `CHECKSUMS` bestand.
 * Formaat per regel: `<sha256-hex>  <bestandspad>`
 */
export async function maakChecksumsTekst(
  bestanden: Record<string, Uint8Array>,
): Promise<string> {
  const regels: string[] = [];
  const paden = Object.keys(bestanden).sort();

  for (const pad of paden) {
    if (pad === "CHECKSUMS") continue;
    const inhoud = bestanden[pad];
    if (!inhoud) continue;
    const hash = await berekenSha256Hex(inhoud);
    regels.push(`${hash}  ${pad}`);
  }

  return regels.join("\n") + "\n";
}

/**
 * Valideert of alle bestanden in het zip-archief overeenkomen met de regels in `CHECKSUMS`.
 */
export async function valideerChecksums(
  bestanden: Record<string, Uint8Array>,
  checksumsTekst: string,
): Promise<{ geldig: boolean; fouten: string[] }> {
  const regels = checksumsTekst.split("\n").map((r) => r.trim()).filter(Boolean);
  const fouten: string[] = [];

  for (const regel of regels) {
    const delen = regel.split(/\s+/);
    if (delen.length < 2) continue;
    const verwachteHash = delen[0];
    const pad = delen[1];
    if (!verwachteHash || !pad) continue;
    const bestand = bestanden[pad];

    if (!bestand) {
      fouten.push(`Bestand '${pad}' ontbreekt in het archief.`);
      continue;
    }

    const berekendeHash = await berekenSha256Hex(bestand);
    if (berekendeHash.toLowerCase() !== verwachteHash.toLowerCase()) {
      fouten.push(`Checksum corrupt voor '${pad}' (verwacht: ${verwachteHash}, berekend: ${berekendeHash})`);
    }
  }

  return {
    geldig: fouten.length === 0,
    fouten,
  };
}
