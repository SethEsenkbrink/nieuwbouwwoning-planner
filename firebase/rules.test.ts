import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from "firebase/firestore";

/**
 * Security-rules tests.
 *
 * Deze tests zijn het bewijs dat de belofte "je ziet uitsluitend je eigen data"
 * ook echt klopt. Rules die niet getest zijn, zijn rules waarvan je hoopt dat ze
 * werken.
 *
 * Draaien:  npm run rules:test
 * (start de Firestore-emulator, draait deze tests, sluit de emulator weer af)
 */

const ALICE = "alice-uid";
const BOB = "bob-uid";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "nieuwbouwplanner-rules-test",
    firestore: {
      rules: readFileSync(new URL("./firestore.rules", import.meta.url), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

/** Firestore-instantie namens een ingelogde gebruiker. */
function alsGebruiker(uid: string) {
  return testEnv.authenticatedContext(uid).firestore();
}

/** Firestore-instantie zonder inloggen. */
function alsGast() {
  return testEnv.unauthenticatedContext().firestore();
}

describe("isolatie tussen gebruikers", () => {
  it("laat een gebruiker zijn eigen project aanmaken", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1`), {
        naam: "Ons huis in Almere",
        aangemaaktOp: serverTimestamp(),
      }),
    );
  });

  it("weigert dat Bob in de map van Alice schrijft", async () => {
    const db = alsGebruiker(BOB);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1`), {
        naam: "Gekaapt",
        aangemaaktOp: serverTimestamp(),
      }),
    );
  });

  it("weigert dat Bob het project van Alice leest", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${ALICE}/projects/p1`), { naam: "Privé" });
    });
    const db = alsGebruiker(BOB);
    await assertFails(getDoc(doc(db, `users/${ALICE}/projects/p1`)));
  });

  it("weigert dat Bob de projectenlijst van Alice opvraagt", async () => {
    const db = alsGebruiker(BOB);
    await assertFails(getDocs(collection(db, `users/${ALICE}/projects`)));
  });

  it("weigert alles voor een niet-ingelogde bezoeker", async () => {
    const db = alsGast();
    await assertFails(getDoc(doc(db, `users/${ALICE}/projects/p1`)));
    await assertFails(setDoc(doc(db, `users/${ALICE}/projects/p1`), { naam: "x" }));
  });

  it("weigert schrijven buiten de users-boom", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(setDoc(doc(db, "willekeurig/document"), { iets: true }));
    await assertFails(setDoc(doc(db, "projects/p1"), { naam: "x" }));
  });
});

describe("veldvalidatie op project", () => {
  it("weigert een project zonder naam", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1`), { aangemaaktOp: serverTimestamp() }),
    );
  });

  it("weigert een lege naam", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1`), {
        naam: "",
        aangemaaktOp: serverTimestamp(),
      }),
    );
  });

  it("weigert een onbekende garantiewaarborg", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1`), {
        naam: "Huis",
        garantiewaarborg: "onzin",
        aangemaaktOp: serverTimestamp(),
      }),
    );
  });

  it("accepteert een geldige garantiewaarborg", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1`), {
        naam: "Huis",
        garantiewaarborg: "woningborg",
        koopsom: 425000,
        aangemaaktOp: serverTimestamp(),
      }),
    );
  });

  it("weigert een negatieve koopsom", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1`), {
        naam: "Huis",
        koopsom: -1,
        aangemaaktOp: serverTimestamp(),
      }),
    );
  });

  it("weigert een absurd lange naam (misbruik als opslag)", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1`), {
        naam: "x".repeat(500),
        aangemaaktOp: serverTimestamp(),
      }),
    );
  });

  it("weigert een document met te veel velden", async () => {
    const db = alsGebruiker(ALICE);
    const veelVelden: Record<string, unknown> = {
      naam: "Huis",
      aangemaaktOp: serverTimestamp(),
    };
    for (let i = 0; i < 30; i++) veelVelden[`extra${i}`] = "x";
    await assertFails(setDoc(doc(db, `users/${ALICE}/projects/p1`), veelVelden));
  });
});

describe("subcollecties", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${ALICE}/projects/p1`), { naam: "Huis" });
    });
  });

  it("accepteert een geldige taak", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/tasks/t1`), {
        titel: "Meerwerk elektra doorgeven",
        status: "open",
        bron: "handmatig",
      }),
    );
  });

  it("weigert een taak met een onbekende status", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/tasks/t1`), {
        titel: "Taak",
        status: "misschien",
        bron: "handmatig",
      }),
    );
  });

  it("weigert een termijn zonder de drie statusbooleans", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/termijnen/tm1`), {
        omschrijving: "Fundering gereed",
        bedrag: 25000,
        gefactureerd: true,
        // gedeclareerdBijBank en betaald ontbreken
      }),
    );
  });

  it("accepteert een volledige termijn", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/termijnen/tm1`), {
        omschrijving: "Fundering gereed",
        bedrag: 25000,
        gefactureerd: true,
        gedeclareerdBijBank: false,
        betaald: false,
      }),
    );
  });

  it("weigert dat Bob een taak in het project van Alice zet", async () => {
    const db = alsGebruiker(BOB);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/tasks/t1`), {
        titel: "Taak",
        status: "open",
        bron: "handmatig",
      }),
    );
  });

  it("weigert een fase met een onbekend type", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/phases/f1`), {
        type: "sloop",
        titel: "Sloopfase",
        status: "open",
      }),
    );
  });
});
