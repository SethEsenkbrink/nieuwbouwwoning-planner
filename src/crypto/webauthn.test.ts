import { describe, expect, it } from "vitest";
import { isWebAuthnPrfSupported } from "./webauthn";

describe("WebAuthn PRF Slot", () => {
  it("geeft veilig false of boolean terug in headless/Node testomgeving zonder foutmelding", async () => {
    const supported = await isWebAuthnPrfSupported();
    expect(typeof supported).toBe("boolean");
  });
});
