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

/**
 * Kopie van een object met één veld weggelaten. Voor tests die controleren dat
 * een verplicht veld ook echt verplicht is.
 */
function zonderVeld<T extends object>(obj: T, veld: keyof T): Partial<T> {
  const kopie = { ...obj };
  delete kopie[veld];
  return kopie;
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

// ═══════════════════════════════════════════════════════════════════════════
// Betrokkenen- en schuif-impactmodule (ADR-0008 / ADR-0009)
//
// Dit is de eerste echte feature. De rules zijn hier strenger dan elders,
// omdat de rekenmotor op deze velden vertrouwt: een betrokkene zonder
// aanlooptijd of een afspraak met een onbekend anker levert een actielijst op
// die stilzwijgend verkeerd is.
// ═══════════════════════════════════════════════════════════════════════════

describe("opleverdatum als band op project", () => {
  it("accepteert een project met een volledige opleverband", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1`), {
        naam: "Huis",
        opleverStatus: "bandbreedte",
        opleverVroegst: new Date("2026-11-02"),
        opleverVerwacht: new Date("2026-11-16"),
        opleverLaatst: new Date("2026-12-14"),
        opleverBron: "mail aannemer 12-07",
        opleverBronDatum: new Date("2026-07-12"),
        aangemaaktOp: serverTimestamp(),
      }),
    );
  });

  it("accepteert een project zonder enige opleverdatum", async () => {
    // Een project moet kunnen bestaan voordat er ook maar iets bekend is.
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1`), {
        naam: "Huis",
        aangemaaktOp: serverTimestamp(),
      }),
    );
  });

  it("weigert een onbekende opleverStatus", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1`), {
        naam: "Huis",
        opleverStatus: "ongeveer",
        aangemaaktOp: serverTimestamp(),
      }),
    );
  });

  it("weigert een opleverdatum die geen timestamp is", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1`), {
        naam: "Huis",
        opleverVerwacht: "week 45",
        aangemaaktOp: serverTimestamp(),
      }),
    );
  });
});

describe("ankers", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${ALICE}/projects/p1`), { naam: "Huis" });
    });
  });

  it("accepteert een geldig anker", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/ankers/a1`), {
        type: "dekvloer_gestort",
        titel: "Dekvloer begane grond",
        status: "verwacht",
        verwachtOp: new Date("2026-09-08"),
        bron: "bouwvergadering 03-09",
      }),
    );
  });

  it("accepteert een anker zonder datum", async () => {
    // Je weet dát het moment komt, nog niet wanneer.
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/ankers/a1`), {
        type: "ruwbouw_gereed",
        titel: "Ruwbouw gereed",
        status: "verwacht",
      }),
    );
  });

  it("weigert een onbekend ankertype", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/ankers/a1`), {
        type: "dakpannen_gelegd",
        titel: "Dakpannen",
        status: "verwacht",
      }),
    );
  });

  it("weigert een onbekende ankerstatus", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/ankers/a1`), {
        type: "oplevering",
        titel: "Oplevering",
        status: "misschien",
      }),
    );
  });

  it("weigert een anker zonder titel", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/ankers/a1`), {
        type: "oplevering",
        status: "verwacht",
      }),
    );
  });

  it("weigert dat Bob een anker in het project van Alice zet", async () => {
    const db = alsGebruiker(BOB);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/ankers/a1`), {
        type: "oplevering",
        titel: "Oplevering",
        status: "verwacht",
      }),
    );
  });
});

describe("betrokkenen", () => {
  const geldigeBetrokkene = {
    naam: "Keukenstudio Van Dijk",
    categorie: "installatie",
    aanlooptijdDagen: 56,
    annuleertermijnDagen: 21,
    communicatieregel: "direct",
    waardenBron: "voorstel",
  };

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${ALICE}/projects/p1`), { naam: "Huis" });
    });
  });

  it("accepteert een geldige betrokkene", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/betrokkenen/b1`), geldigeBetrokkene),
    );
  });

  it("accepteert een betrokkene zonder contactgegevens", async () => {
    // Uitgangspunt 4 van de standaardlijst: de schuif-impact werkt ook zonder
    // e-mailadres. Wie alleen een lijstje wil, moet dat kunnen.
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/betrokkenen/b1`), geldigeBetrokkene),
    );
  });

  it("weigert een betrokkene zonder aanlooptijd", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(
        doc(db, `users/${ALICE}/projects/p1/betrokkenen/b1`),
        zonderVeld(geldigeBetrokkene, "aanlooptijdDagen"),
      ),
    );
  });

  it("weigert een betrokkene zonder annuleertermijn", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(
        doc(db, `users/${ALICE}/projects/p1/betrokkenen/b1`),
        zonderVeld(geldigeBetrokkene, "annuleertermijnDagen"),
      ),
    );
  });

  it("weigert een negatieve aanlooptijd", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/betrokkenen/b1`), {
        ...geldigeBetrokkene,
        aanlooptijdDagen: -5,
      }),
    );
  });

  it("weigert een absurde aanlooptijd", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/betrokkenen/b1`), {
        ...geldigeBetrokkene,
        aanlooptijdDagen: 99999,
      }),
    );
  });

  it("weigert een aanlooptijd die geen getal is", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/betrokkenen/b1`), {
        ...geldigeBetrokkene,
        aanlooptijdDagen: "acht weken",
      }),
    );
  });

  it("weigert een onbekende categorie", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/betrokkenen/b1`), {
        ...geldigeBetrokkene,
        categorie: "vrienden",
      }),
    );
  });

  it("weigert een onbekende communicatieregel", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/betrokkenen/b1`), {
        ...geldigeBetrokkene,
        communicatieregel: "soms",
      }),
    );
  });

  it("weigert een onbekende waardenBron", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/betrokkenen/b1`), {
        ...geldigeBetrokkene,
        waardenBron: "geraden",
      }),
    );
  });

  it("weigert een betrokkene met te veel velden", async () => {
    // Bewaakt `withinSizeLimit()` voor de subcollecties. Die functie telde tot
    // sessie 03 `request.resource.size()` in plaats van
    // `request.resource.data.size()` en deed daardoor niets — een limiet die
    // alleen in de code stond, niet in de praktijk.
    const db = alsGebruiker(ALICE);
    const veelVelden: Record<string, unknown> = { ...geldigeBetrokkene };
    for (let i = 0; i < 30; i++) veelVelden[`extra${i}`] = "x";
    await assertFails(setDoc(doc(db, `users/${ALICE}/projects/p1/betrokkenen/b1`), veelVelden));
  });

  it("weigert een notitie die als opslagplek wordt misbruikt", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/betrokkenen/b1`), {
        ...geldigeBetrokkene,
        notitie: "x".repeat(5000),
      }),
    );
  });

  it("weigert dat Bob de betrokkenen van Alice leest", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), `users/${ALICE}/projects/p1/betrokkenen/b1`),
        geldigeBetrokkene,
      );
    });
    const db = alsGebruiker(BOB);
    await assertFails(getDocs(collection(db, `users/${ALICE}/projects/p1/betrokkenen`)));
  });
});

describe("afspraken", () => {
  const geldigeAfspraak = {
    betrokkeneId: "b1",
    omschrijving: "Vloer leggen",
    ankerType: "dekvloer_gestort",
    offsetDagen: 42,
    status: "concept",
  };

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${ALICE}/projects/p1`), { naam: "Huis" });
    });
  });

  it("accepteert een geldige afspraak", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/afspraken/af1`), geldigeAfspraak),
    );
  });

  it("accepteert een negatieve offset", async () => {
    // Huur opzeggen: sleuteloverdracht −45 dagen.
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/afspraken/af1`), {
        ...geldigeAfspraak,
        ankerType: "sleuteloverdracht",
        offsetDagen: -45,
        omschrijving: "Huur opzeggen",
        waarschuwing: "Opzegtermijn is onomkeerbaar en start op de eerste van de maand.",
      }),
    );
  });

  it("accepteert een afspraak met een gecommuniceerde datum", async () => {
    // De enige datum die wél wordt opgeslagen: wat weet deze partij nu.
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/afspraken/af1`), {
        ...geldigeAfspraak,
        status: "voorlopig",
        gecommuniceerdeDatum: new Date("2026-11-20"),
        gecommuniceerdOp: serverTimestamp(),
      }),
    );
  });

  it("weigert een afspraak zonder betrokkeneId", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(
        doc(db, `users/${ALICE}/projects/p1/afspraken/af1`),
        zonderVeld(geldigeAfspraak, "betrokkeneId"),
      ),
    );
  });

  it("weigert een afspraak zonder anker", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(
        doc(db, `users/${ALICE}/projects/p1/afspraken/af1`),
        zonderVeld(geldigeAfspraak, "ankerType"),
      ),
    );
  });

  it("weigert een onbekend ankertype", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/afspraken/af1`), {
        ...geldigeAfspraak,
        ankerType: "koffiepauze",
      }),
    );
  });

  it("weigert een afspraak zonder offset", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(
        doc(db, `users/${ALICE}/projects/p1/afspraken/af1`),
        zonderVeld(geldigeAfspraak, "offsetDagen"),
      ),
    );
  });

  it("weigert een offset buiten het bereik", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/afspraken/af1`), {
        ...geldigeAfspraak,
        offsetDagen: 99999,
      }),
    );
  });

  it("weigert een onbekende afspraakstatus", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/afspraken/af1`), {
        ...geldigeAfspraak,
        status: "geregeld",
      }),
    );
  });

  it("weigert een gecommuniceerdeDatum die geen timestamp is", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/afspraken/af1`), {
        ...geldigeAfspraak,
        gecommuniceerdeDatum: "20 november",
      }),
    );
  });

  it("weigert dat Bob een afspraak in het project van Alice zet", async () => {
    const db = alsGebruiker(BOB);
    await assertFails(setDoc(doc(db, `users/${ALICE}/projects/p1/afspraken/af1`), geldigeAfspraak));
  });
});
