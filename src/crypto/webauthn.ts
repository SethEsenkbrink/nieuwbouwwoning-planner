/**
 * WebAuthn-PRF (Pseudo-Random Function) Extensie voor Biometrische Kluisontgrendeling
 *
 * Hiermee kan de gebruiker optioneel ontgrendelen via Touch ID, Face ID of Windows Hello
 * zonder dat de master DEK ooit buiten het beveiligde geheugen komt.
 */

export interface WebAuthnSlotConfig {
  credentialId: string;
  saltB64: string;
  wrappedDekB64: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Controleert of WebAuthn en de PRF-extensie beschikbaar zijn in deze browser.
 */
export async function isWebAuthnPrfSupported(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return false;
  }
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
    return false;
  }
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Registreert een biometrisch kluisslot via WebAuthn PRF en versleutelt de DEK.
 */
export async function registreerWebAuthnSlot(
  rawDek: Uint8Array,
  rpId = typeof window !== "undefined" ? window.location.hostname : "localhost",
): Promise<WebAuthnSlotConfig | null> {
  if (!(await isWebAuthnPrfSupported())) {
    return null;
  }

  const salt = new Uint8Array(32);
  crypto.getRandomValues(salt);

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);

  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Woningdossier", id: rpId },
        user: {
          id: userId,
          name: "woningdossier-eigenaar",
          displayName: "Woningdossier Kluis",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        extensions: {
          prf: {
            eval: {
              first: salt,
            },
          },
        },
      },
    })) as PublicKeyCredential & {
      getClientExtensionResults: () => { prf?: { results?: { first: ArrayBuffer } } };
    };

    if (!credential) return null;

    const prfResults = credential.getClientExtensionResults().prf;
    const prfOutput = prfResults?.results?.first;
    if (!prfOutput) return null;

    // Leid KEK af uit de PRF output
    const kek = await crypto.subtle.importKey(
      "raw",
      prfOutput,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );

    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);

    const wrappedDekBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      kek,
      rawDek as BufferSource,
    );

    const wrappedDekWithIv = new Uint8Array(iv.length + wrappedDekBuffer.byteLength);
    wrappedDekWithIv.set(iv, 0);
    wrappedDekWithIv.set(new Uint8Array(wrappedDekBuffer), iv.length);

    return {
      credentialId: arrayBufferToBase64(credential.rawId),
      saltB64: arrayBufferToBase64(salt.buffer),
      wrappedDekB64: arrayBufferToBase64(wrappedDekWithIv.buffer),
    };
  } catch {
    return null;
  }
}

/**
 * Ontgrendelt de DEK met behulp van de geregistreerde WebAuthn PRF sleutel.
 */
export async function ontgrendelMetWebAuthn(
  slotConfig: WebAuthnSlotConfig,
  rpId = typeof window !== "undefined" ? window.location.hostname : "localhost",
): Promise<CryptoKey | null> {
  if (!(await isWebAuthnPrfSupported())) {
    return null;
  }

  const credentialId = base64ToArrayBuffer(slotConfig.credentialId);
  const salt = base64ToArrayBuffer(slotConfig.saltB64);
  const wrappedWithIv = new Uint8Array(base64ToArrayBuffer(slotConfig.wrappedDekB64));

  if (wrappedWithIv.length < 28) return null;

  const iv = wrappedWithIv.slice(0, 12);
  const ciphertext = wrappedWithIv.slice(12);

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId,
        allowCredentials: [
          {
            id: credentialId,
            type: "public-key",
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60000,
        extensions: {
          prf: {
            eval: {
              first: new Uint8Array(salt),
            },
          },
        },
      },
    })) as PublicKeyCredential & {
      getClientExtensionResults: () => { prf?: { results?: { first: ArrayBuffer } } };
    };

    if (!assertion) return null;

    const prfResults = assertion.getClientExtensionResults().prf;
    const prfOutput = prfResults?.results?.first;
    if (!prfOutput) return null;

    const kek = await crypto.subtle.importKey(
      "raw",
      prfOutput,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const rawDekBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      kek,
      ciphertext,
    );

    return await crypto.subtle.importKey(
      "raw",
      rawDekBuffer,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  } catch {
    return null;
  }
}
