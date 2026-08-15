/**
 * Herstelcode (KEK-C) generator en parser
 *
 * Genereert een cryptografisch willekeurige 128-bit (16-byte) herstelcode
 * gecodeerd in Crockford Base32.
 *
 * Eigenschappen:
 * - 128 bits cryptografische entropie
 * - Geen verwarring tussen 0/O, 1/I/L
 * - Case-insensitive en bestand tegen spaties en streepjes
 */

const CROCKFORD_ALFABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Zet 16 bytes (128 bits) om naar een Crockford Base32 string (26 karakters).
 */
export function encodeCrockfordBase32(bytes: Uint8Array): string {
  if (bytes.length !== 16) {
    throw new Error(`Ongeldige byte-lengte voor 128-bit herstelcode: ${bytes.length} (verwacht 16)`);
  }

  let bits = 0;
  let bitCount = 0;
  let result = "";

  for (const byte of bytes) {
    bits = (bits << 8) | byte;
    bitCount += 8;

    while (bitCount >= 5) {
      const index = (bits >>> (bitCount - 5)) & 31;
      result += CROCKFORD_ALFABET[index] ?? "";
      bitCount -= 5;
    }
  }

  if (bitCount > 0) {
    const index = (bits << (5 - bitCount)) & 31;
    result += CROCKFORD_ALFABET[index] ?? "";
  }

  return result;
}

/**
 * Decodeert een Crockford Base32 string terug naar 16 bytes (128 bits).
 */
export function decodeCrockfordBase32(invoer: string): Uint8Array {
  // Normaliseer: verwijder streepjes en spaties, zet om naar uppercase, normaliseer O->0, I/L->1
  const geschoond = invoer
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

  if (geschoond.length !== 26) {
    throw new Error(`Ongeldige herstelcode-lengte: ${geschoond.length} karakters (verwacht 26)`);
  }

  const bytes = new Uint8Array(16);
  let bits = 0;
  let bitCount = 0;
  let byteIndex = 0;

  for (const char of geschoond) {
    const val = CROCKFORD_ALFABET.indexOf(char);
    if (val === -1) {
      throw new Error(`Ongeldig karakter in herstelcode: '${char}'`);
    }

    bits = (bits << 5) | val;
    bitCount += 5;

    if (bitCount >= 8) {
      if (byteIndex < 16) {
        bytes[byteIndex++] = (bits >>> (bitCount - 8)) & 255;
      }
      bitCount -= 8;
    }
  }

  if (byteIndex !== 16) {
    throw new Error("Decoderen van herstelcode gaf onvolledig aantal bytes.");
  }

  return bytes;
}

/**
 * Formatteert 26 Crockford karakters in leesbare groepen:
 * XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-X
 */
export function formatteerHerstelcode(code26: string): string {
  const geschoond = code26.toUpperCase().replace(/[\s-]/g, "");
  const delen: string[] = [];
  for (let i = 0; i < geschoond.length; i += 5) {
    delen.push(geschoond.slice(i, i + 5));
  }
  return delen.join("-");
}

/**
 * Genereert een nieuwe 128-bit herstelcode en de bijbehorende raw bytes.
 */
export function genereerHerstelcode(): { code: string; bytes: Uint8Array } {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const rawBase32 = encodeCrockfordBase32(bytes);
  const formatted = formatteerHerstelcode(rawBase32);
  return {
    code: formatted,
    bytes,
  };
}

/**
 * Geeft een veilige gemaskeerde hint terug voor weergave in de instellingen.
 * Bijv. "••••-••••-••••-••••-••••-W"
 */
export function maskeerHerstelcode(code: string): string {
  const formatted = formatteerHerstelcode(code);
  const delen = formatted.split("-");
  return delen.map((d, i) => (i < delen.length - 1 ? "•••••" : d)).join("-");
}
