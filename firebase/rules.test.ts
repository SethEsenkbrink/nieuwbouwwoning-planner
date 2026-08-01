import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  Timestamp,
} from "firebase/firestore";

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

/**
 * Meerwerk — de deadline kent drie vormen (ADR-0011). `sluiting` is verplicht
 * en zegt welke; de bijbehorende velden zijn optioneel, want je noteert een
 * wens vaak voordat je de datum kent.
 */
const geldigMeerwerk = {
  omschrijving: "Extra wandcontactdozen woonkamer",
  status: "overweeg",
  sluiting: "vaste_datum",
};

describe("meerwerk", () => {
  it("accepteert meerwerk met een vaste sluitingsdatum", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/meerwerk/m1`), {
        ...geldigMeerwerk,
        bedrag: 850,
        sluitingsdatum: Timestamp.fromDate(new Date("2026-09-15T00:00:00Z")),
      }),
    );
  });

  it("accepteert meerwerk dat aan een bouwmoment hangt", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/meerwerk/m2`), {
        ...geldigMeerwerk,
        sluiting: "bouwmoment",
        sluitingAnkerType: "dekvloer_gestort",
        sluitingOffsetDagen: -14,
      }),
    );
  });

  it("accepteert meerwerk zonder deadline", async () => {
    // Een wens noteren voordat je weet tot wanneer het kan, moet kunnen.
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/meerwerk/m3`), {
        ...geldigMeerwerk,
        sluiting: "onbekend",
      }),
    );
  });

  it("weigert meerwerk zonder sluiting-veld", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(
        doc(db, `users/${ALICE}/projects/p1/meerwerk/m4`),
        zonderVeld(geldigMeerwerk, "sluiting"),
      ),
    );
  });

  it("weigert een onbekende sluitingssoort", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/meerwerk/m5`), {
        ...geldigMeerwerk,
        sluiting: "zodra_het_uitkomt",
      }),
    );
  });

  it("weigert een onbekend ankertype bij de sluiting", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/meerwerk/m6`), {
        ...geldigMeerwerk,
        sluiting: "bouwmoment",
        sluitingAnkerType: "tuin_aangelegd",
      }),
    );
  });

  it("weigert een offset buiten het bereik", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/meerwerk/m7`), {
        ...geldigMeerwerk,
        sluiting: "bouwmoment",
        sluitingAnkerType: "dekvloer_gestort",
        sluitingOffsetDagen: 99999,
      }),
    );
  });

  it("weigert een sluitingsdatum die geen timestamp is", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/meerwerk/m8`), {
        ...geldigMeerwerk,
        sluitingsdatum: "15 september",
      }),
    );
  });

  it("weigert een onbekende meerwerkstatus", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/meerwerk/m9`), {
        ...geldigMeerwerk,
        status: "misschien",
      }),
    );
  });

  it("weigert dat Bob meerwerk in het project van Alice zet", async () => {
    const db = alsGebruiker(BOB);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/meerwerk/m10`), geldigMeerwerk),
    );
  });
});

/**
 * Het 5%-opschortingsrecht (ADR-0012). Alleen de keuze en het bedrag worden
 * opgeslagen; de uiterste datum wordt afgeleid en hoort hier dus niet.
 */
describe("opschorting op project", () => {
  const basis = { naam: "Ons huis", aangemaaktOp: serverTimestamp() };

  it("accepteert een project met een opschortingskeuze", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1`), {
        ...basis,
        opschortingStatus: "in_depot",
        opschortingBedrag: 9500,
        opschortingNotitie: "Depot bij notaris Jansen",
      }),
    );
  });

  it("accepteert een project zonder opschortingsvelden", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(setDoc(doc(db, `users/${ALICE}/projects/p2`), basis));
  });

  it("weigert een onbekende opschortingsstatus", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p3`), {
        ...basis,
        opschortingStatus: "misschien_wel",
      }),
    );
  });

  it("weigert een negatief bedrag", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p4`), { ...basis, opschortingBedrag: -100 }),
    );
  });
});

/**
 * Gebreken zijn opleverpunten: ze hebben een locatie en een hersteltermijn die
 * de aannemer moet halen. Ze staan bewust los van `tasks` (ADR-0012).
 */
const geldigGebrek = {
  omschrijving: "Kras in het kozijn van slaapkamer 2",
  status: "open",
};

describe("gebreken", () => {
  it("accepteert een volledig opleverpunt", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/gebreken/g1`), {
        ...geldigGebrek,
        locatie: "slaapkamer 2, kozijn noordzijde",
        gemeldOp: Timestamp.fromDate(new Date("2026-11-16T00:00:00Z")),
        hersteltermijn: Timestamp.fromDate(new Date("2026-12-14T00:00:00Z")),
      }),
    );
  });

  it("accepteert een opleverpunt zonder datums", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(setDoc(doc(db, `users/${ALICE}/projects/p1/gebreken/g2`), geldigGebrek));
  });

  it("weigert een opleverpunt zonder omschrijving", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(
        doc(db, `users/${ALICE}/projects/p1/gebreken/g3`),
        zonderVeld(geldigGebrek, "omschrijving"),
      ),
    );
  });

  it("weigert een onbekende gebrekstatus", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/gebreken/g4`), {
        ...geldigGebrek,
        status: "half_gemaakt",
      }),
    );
  });

  it("weigert een hersteltermijn die geen timestamp is", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/gebreken/g5`), {
        ...geldigGebrek,
        hersteltermijn: "over twee weken",
      }),
    );
  });

  it("weigert dat Bob een opleverpunt bij Alice zet", async () => {
    const db = alsGebruiker(BOB);
    await assertFails(setDoc(doc(db, `users/${ALICE}/projects/p1/gebreken/g6`), geldigGebrek));
  });
});

/**
 * Posten ná de oplevering: vloer, gordijnen, tuin. Twee bedragen naast elkaar —
 * geraamd en werkelijk — want het verschil is waar het overzicht om draait.
 */
const geldigePost = { omschrijving: "Tuinaanleg", status: "geraamd" };

describe("nabudget", () => {
  it("accepteert een post met beide bedragen", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/nabudget/n1`), {
        ...geldigePost,
        geraamd: 6000,
        werkelijk: 7250,
        status: "betaald",
        notitie: "Inclusief bestrating achterom",
      }),
    );
  });

  it("accepteert een post zonder bedragen", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(setDoc(doc(db, `users/${ALICE}/projects/p1/nabudget/n2`), geldigePost));
  });

  it("weigert een post zonder omschrijving", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(
        doc(db, `users/${ALICE}/projects/p1/nabudget/n3`),
        zonderVeld(geldigePost, "omschrijving"),
      ),
    );
  });

  it("weigert een onbekende status", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/nabudget/n4`), {
        ...geldigePost,
        status: "ooit_misschien",
      }),
    );
  });

  it("weigert een negatief bedrag", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/nabudget/n5`), {
        ...geldigePost,
        werkelijk: -50,
      }),
    );
  });

  it("weigert dat Bob een post bij Alice zet", async () => {
    const db = alsGebruiker(BOB);
    await assertFails(setDoc(doc(db, `users/${ALICE}/projects/p1/nabudget/n6`), geldigePost));
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Het woningdossier (ADR-0010, ADR-0013)
 *
 * Twee velden op het project. `woningpaspoort` is een GENESTE MAP, en dat is
 * de hele reden dat deze tests er zijn: een map telt in
 * `request.resource.data.size()` als één veld, dus `withinSize(25)` beschermt
 * de inhoud van die map niet. Zonder de eigen groottecheck in `geldigPaspoort`
 * zou het paspoort precies de opslagplek zijn die constraint C2 uitsluit.
 *
 * Dat is dezelfde soort stille fout als `request.resource.size()` in sessie 03:
 * het compileert, het deployt, en het weigert nooit iets.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("woningdossier op project", () => {
  const basis = { naam: "Ons huis", aangemaaktOp: serverTimestamp() };

  const geldigPaspoort = {
    adres: "Dorpsstraat 1",
    postcode: "1234 AB",
    plaats: "Almere",
    woningtype: "tussenwoning",
    bouwjaar: 2026,
    woonoppervlakte: 124,
    perceeloppervlakte: 180,
    energielabel: "A++++",
    energielabelRegistratie: "0123456789",
    energielabelOpnameDatum: Timestamp.fromDate(new Date("2026-09-01")),
    waarborgpolisnummer: "WB-2026-4471",
    notaris: "Notariskantoor Jansen",
    hypotheekverstrekker: "Rabobank",
  };

  it("accepteert een project met een volledig paspoort", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1`), {
        ...basis,
        woningStatus: "opgeleverd",
        woningpaspoort: geldigPaspoort,
      }),
    );
  });

  /**
   * Het migratiepad: elk project van vóór blok E mist beide velden en moet
   * gewoon te schrijven blijven.
   */
  it("accepteert een project zonder woningvelden", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(setDoc(doc(db, `users/${ALICE}/projects/p2`), basis));
  });

  it("accepteert een half ingevuld paspoort", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p3`), {
        ...basis,
        woningpaspoort: { adres: "Dorpsstraat 1" },
      }),
    );
  });

  it("weigert een onbekende woningStatus", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p4`), { ...basis, woningStatus: "bijna_klaar" }),
    );
  });

  it("weigert een onbekend woningtype", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p5`), {
        ...basis,
        woningpaspoort: { woningtype: "woonboot" },
      }),
    );
  });

  it("weigert een energielabel buiten de NTA 8800-schaal", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p6`), {
        ...basis,
        woningpaspoort: { energielabel: "A+++++++" },
      }),
    );
  });

  it("accepteert alle uiteinden van de labelschaal", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p7`), {
        ...basis,
        woningpaspoort: { energielabel: "A+++++" },
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p8`), {
        ...basis,
        woningpaspoort: { energielabel: "G" },
      }),
    );
  });

  it("weigert een onzinnig bouwjaar", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p9`), {
        ...basis,
        woningpaspoort: { bouwjaar: 12026 },
      }),
    );
  });

  it("weigert een bouwjaar dat geen geheel getal is", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p10`), {
        ...basis,
        woningpaspoort: { bouwjaar: 2026.5 },
      }),
    );
  });

  it("weigert een negatieve oppervlakte", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p11`), {
        ...basis,
        woningpaspoort: { woonoppervlakte: -10 },
      }),
    );
  });

  /**
   * DE BELANGRIJKSTE TEST VAN DIT BLOK.
   *
   * Zonder `data.woningpaspoort.size() <= 13` in de rules slaagt dit, want de
   * documentlimiet telt de map als één veld. Dan is het paspoort een vrij
   * beschrijfbare bak van duizend velden — een gat in constraint C2 van precies
   * dezelfde vorm als het `.data`-gat uit sessie 03.
   */
  it("weigert een paspoort met meer velden dan het model kent", async () => {
    const db = alsGebruiker(ALICE);
    const opgeblazen: Record<string, string> = {};
    for (let i = 0; i < 40; i += 1) opgeblazen[`veld${i}`] = "x";

    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p12`), {
        ...basis,
        woningpaspoort: opgeblazen,
      }),
    );
  });

  it("weigert een paspoort dat geen map is", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p13`), {
        ...basis,
        woningpaspoort: "Dorpsstraat 1, Almere",
      }),
    );
  });

  it("weigert een te lang adres", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p14`), {
        ...basis,
        woningpaspoort: { adres: "x".repeat(201) },
      }),
    );
  });

  it("weigert een opnamedatum die geen timestamp is", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p15`), {
        ...basis,
        woningpaspoort: { energielabelOpnameDatum: "2026-09-01" },
      }),
    );
  });

  it("weigert dat Bob het paspoort van Alice zet", async () => {
    const db = alsGebruiker(BOB);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p16`), {
        ...basis,
        woningpaspoort: geldigPaspoort,
      }),
    );
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Onderdelen — het register van wat er in de woning zit (ADR-0013)
 *
 * Twee geneste maps met elk een eigen groottecheck: `specs` (vrij, max 30) en
 * `registratieplicht` (vast vormgegeven, max 4). Zonder die checks telt de
 * documentlimiet ze als één veld en is `specs` een onbegrensde opslagbak —
 * hetzelfde gat als bij het woningpaspoort, en van dezelfde soort als het
 * `.data`-gat uit sessie 03.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const geldigOnderdeel = {
  naam: "Warmtepomp",
  categorie: "verwarming",
  montage: "vast_geinstalleerd",
  blijftBijWoning: true,
};

describe("onderdelen", () => {
  it("accepteert een volledig onderdeel", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o1`), {
        ...geldigOnderdeel,
        merk: "NIBE",
        type: "S2125-8",
        serienummer: "06231234567",
        specs: { vermogen: "8 kW", koudemiddel: "R290", scop: "4,8" },
        installatieDatum: Timestamp.fromDate(new Date("2026-09-15")),
        installateurBetrokkeneId: "b1",
        garantieMaanden: 60,
        documentUrl: "https://drive.example.com/handleiding-warmtepomp",
        notitie: "Buitenunit aan de noordgevel",
      }),
    );
  });

  it("accepteert een minimaal onderdeel", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o2`), geldigOnderdeel),
    );
  });

  it("weigert een onderdeel zonder naam", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(
        doc(db, `users/${ALICE}/projects/p1/onderdelen/o3`),
        zonderVeld(geldigOnderdeel, "naam"),
      ),
    );
  });

  it("weigert een lege naam", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o4`), {
        ...geldigOnderdeel,
        naam: "",
      }),
    );
  });

  it("weigert een onbekende categorie", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o5`), {
        ...geldigOnderdeel,
        categorie: "tuinkabouter",
      }),
    );
  });

  /**
   * `montage` en `blijftBijWoning` zijn allebei verplicht en staan bewust los
   * van elkaar (ADR-0013 §2). Ze zijn achteraf niet af te leiden, dus een
   * onderdeel zonder die velden mag er niet in.
   */
  it("weigert een onderdeel zonder montagevorm", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(
        doc(db, `users/${ALICE}/projects/p1/onderdelen/o6`),
        zonderVeld(geldigOnderdeel, "montage"),
      ),
    );
  });

  it("weigert een onbekende montagevorm", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o7`), {
        ...geldigOnderdeel,
        montage: "een_beetje_vast",
      }),
    );
  });

  it("weigert een onderdeel zonder blijftBijWoning", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(
        doc(db, `users/${ALICE}/projects/p1/onderdelen/o8`),
        zonderVeld(geldigOnderdeel, "blijftBijWoning"),
      ),
    );
  });

  it("weigert blijftBijWoning als tekst", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o9`), {
        ...geldigOnderdeel,
        blijftBijWoning: "ja",
      }),
    );
  });

  it("staat een plug-and-play onderdeel toe dat meeverhuist", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o10`), {
        naam: "Thuisbatterij",
        categorie: "opslag",
        montage: "plug_and_play",
        blijftBijWoning: false,
      }),
    );
  });

  /**
   * DE C2-TEST. Zonder `data.specs.size() <= 30` slaagt dit, want de
   * documentlimiet telt de map als één veld.
   */
  it("weigert een specs-map met te veel velden", async () => {
    const db = alsGebruiker(ALICE);
    const opgeblazen: Record<string, string> = {};
    for (let i = 0; i < 60; i += 1) opgeblazen[`spec${i}`] = "x";

    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o11`), {
        ...geldigOnderdeel,
        specs: opgeblazen,
      }),
    );
  });

  it("accepteert specs tot aan de grens", async () => {
    const db = alsGebruiker(ALICE);
    const specs: Record<string, string> = {};
    for (let i = 0; i < 30; i += 1) specs[`spec${i}`] = "waarde";

    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o12`), {
        ...geldigOnderdeel,
        specs,
      }),
    );
  });

  it("weigert specs die geen map zijn", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o13`), {
        ...geldigOnderdeel,
        specs: "vermogen 8 kW",
      }),
    );
  });

  it("accepteert een registratieplicht met aanmelding", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o14`), {
        naam: "Thuisbatterij",
        categorie: "opslag",
        montage: "plug_and_play",
        blijftBijWoning: false,
        registratieplicht: {
          instantie: "Netbeheerder via Energieleveren.nl",
          aangemeldOp: Timestamp.fromDate(new Date("2026-10-01")),
          referentie: "EL-2026-88213",
        },
      }),
    );
  });

  it("accepteert een registratieplicht die nog openstaat", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o15`), {
        ...geldigOnderdeel,
        registratieplicht: { instantie: "Netbeheerder via Energieleveren.nl" },
      }),
    );
  });

  /** Zonder instantie weet je wel dát er iets moet, maar niet bij wie. */
  it("weigert een registratieplicht zonder instantie", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o16`), {
        ...geldigOnderdeel,
        registratieplicht: { referentie: "EL-2026-88213" },
      }),
    );
  });

  it("weigert een registratieplicht met te veel velden", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o17`), {
        ...geldigOnderdeel,
        registratieplicht: {
          instantie: "Netbeheerder",
          aangemeldOp: Timestamp.fromDate(new Date("2026-10-01")),
          referentie: "x",
          toelichting: "y",
          extra: "dit hoort hier niet",
        },
      }),
    );
  });

  it("weigert een onmogelijke garantietermijn", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o18`), {
        ...geldigOnderdeel,
        garantieMaanden: 1200,
      }),
    );
  });

  it("weigert een negatieve garantietermijn", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o19`), {
        ...geldigOnderdeel,
        garantieMaanden: -12,
      }),
    );
  });

  it("weigert een installatiedatum die geen timestamp is", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o20`), {
        ...geldigOnderdeel,
        installatieDatum: "2026-09-15",
      }),
    );
  });

  it("weigert dat Bob een onderdeel bij Alice zet", async () => {
    const db = alsGebruiker(BOB);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderdelen/o21`), geldigOnderdeel),
    );
  });

  it("weigert dat Bob de onderdelen van Alice leest", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), `users/${ALICE}/projects/p1/onderdelen/o22`),
        geldigOnderdeel,
      );
    });
    const db = alsGebruiker(BOB);
    await assertFails(getDocs(collection(db, `users/${ALICE}/projects/p1/onderdelen`)));
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Onderhoud — taken en logboek (ADR-0014)
 *
 * De belangrijkste test in dit blok is "weigert een opgeslagen volgende datum":
 * er mag geen afgeleide datum in een onderhoudstaak staan. Dat is dezelfde
 * bewaking als "slaat geen afspraakdatum op" bij de converters, maar dan op
 * rules-niveau — en het is de regel die het makkelijkst per ongeluk sneuvelt
 * zodra iemand denkt "handig, dan hoef ik niet te rekenen".
 *
 * Onderhoudstaken zijn de enige collectie met `keys().hasOnly(...)`. Overal
 * elders begrenzen de rules alleen het aantal velden, waardoor een onbekende
 * veldnaam erdoorheen glipt. Dat is een bestaand openstaand punt; hier woog het
 * zwaarder omdat het precies de constraint uit ADR-0008 raakt.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const geldigeTaak = {
  titel: "WTW-filters vervangen",
  intervalDagen: 182,
  waardenBron: "voorstel",
};

describe("onderhoudstaken", () => {
  it("accepteert een volledige taak", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t1`), {
        ...geldigeTaak,
        omschrijving: "Beide filters uit de unit halen en vervangen",
        onderdeelId: "o1",
        voorkeursmaand: 10,
        laatstUitgevoerdOp: Timestamp.fromDate(new Date("2026-03-15")),
        waardenBron: "eigen",
        waarschuwing: "Vuile filters kosten rendement",
      }),
    );
  });

  it("accepteert een minimale taak", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t2`), geldigeTaak),
    );
  });

  it("weigert een taak zonder titel", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(
        doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t3`),
        zonderVeld(geldigeTaak, "titel"),
      ),
    );
  });

  it("weigert een lege titel", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t4`), {
        ...geldigeTaak,
        titel: "",
      }),
    );
  });

  it("weigert een taak zonder interval", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(
        doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t5`),
        zonderVeld(geldigeTaak, "intervalDagen"),
      ),
    );
  });

  /** Interval 0 zou de taak elke dag op de lijst zetten. */
  it("weigert een interval van nul dagen", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t6`), {
        ...geldigeTaak,
        intervalDagen: 0,
      }),
    );
  });

  it("weigert een negatief interval", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t7`), {
        ...geldigeTaak,
        intervalDagen: -30,
      }),
    );
  });

  it("weigert een absurd lang interval", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t8`), {
        ...geldigeTaak,
        intervalDagen: 40000,
      }),
    );
  });

  it("weigert een interval dat geen geheel getal is", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t9`), {
        ...geldigeTaak,
        intervalDagen: 182.5,
      }),
    );
  });

  it("accepteert een interval van tien jaar", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t10`), {
        ...geldigeTaak,
        titel: "Rookmelders vervangen",
        intervalDagen: 3650,
      }),
    );
  });

  it("weigert een voorkeursmaand buiten 1–12", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t11`), {
        ...geldigeTaak,
        voorkeursmaand: 13,
      }),
    );
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t12`), {
        ...geldigeTaak,
        voorkeursmaand: 0,
      }),
    );
  });

  it("accepteert de randen van de maandschaal", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t13`), {
        ...geldigeTaak,
        voorkeursmaand: 1,
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t14`), {
        ...geldigeTaak,
        voorkeursmaand: 12,
      }),
    );
  });

  it("weigert een onbekende waardenBron", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t15`), {
        ...geldigeTaak,
        waardenBron: "geschat",
      }),
    );
  });

  it("weigert een laatstUitgevoerdOp die geen timestamp is", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t16`), {
        ...geldigeTaak,
        laatstUitgevoerdOp: "2026-03-15",
      }),
    );
  });

  it("weigert dat Bob een taak bij Alice zet", async () => {
    const db = alsGebruiker(BOB);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t17`), geldigeTaak),
    );
  });

  /**
   * DE KERNTEST VAN DIT BLOK (ADR-0008, ADR-0014).
   *
   * De volgende beurt wordt afgeleid uit `laatstUitgevoerdOp` + `intervalDagen`
   * en mag nooit worden opgeslagen. Zonder `keys().hasOnly(...)` in de rule
   * slaagt dit, want de veldlimiet telt alleen het aantal — precies zoals bij
   * alle andere collecties.
   */
  it("weigert een opgeslagen volgende datum", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t18`), {
        ...geldigeTaak,
        volgendeOp: Timestamp.fromDate(new Date("2027-03-15")),
      }),
    );
  });

  it("weigert elk ander onbekend veld", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t19`), {
        ...geldigeTaak,
        verzonnenVeld: "dit hoort hier niet",
      }),
    );
  });

  /** Alle velden uit het model samen moeten wél door de whitelist komen. */
  it("accepteert elk veld dat het model kent", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudstaken/t20`), {
        titel: "Dakgoten schoonmaken",
        omschrijving: "Bladeren en mos verwijderen",
        onderdeelId: "o1",
        intervalDagen: 365,
        voorkeursmaand: 11,
        laatstUitgevoerdOp: Timestamp.fromDate(new Date("2026-11-01")),
        waardenBron: "eigen",
        waarschuwing: "Een verstopte goot laat water langs de gevel lopen",
      }),
    );
  });
});

describe("onderhoudslogboek", () => {
  const geldigeRegel = {
    taakId: "t1",
    uitgevoerdOp: Timestamp.fromDate(new Date("2026-03-15")),
  };

  it("accepteert een volledige logregel", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudslogboek/l1`), {
        ...geldigeRegel,
        onderdeelId: "o1",
        doorWie: "Zelf gedaan",
        kosten: 45,
        notitie: "Filters van Filterfabriek, maat 400",
      }),
    );
  });

  it("accepteert een minimale logregel", async () => {
    const db = alsGebruiker(ALICE);
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudslogboek/l2`), geldigeRegel),
    );
  });

  /** Zonder datum zegt een logregel niets — dat is de hele functie ervan. */
  it("weigert een logregel zonder datum", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(
        doc(db, `users/${ALICE}/projects/p1/onderhoudslogboek/l3`),
        zonderVeld(geldigeRegel, "uitgevoerdOp"),
      ),
    );
  });

  it("weigert een logregel zonder taakId", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(
        doc(db, `users/${ALICE}/projects/p1/onderhoudslogboek/l4`),
        zonderVeld(geldigeRegel, "taakId"),
      ),
    );
  });

  it("weigert negatieve kosten", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudslogboek/l5`), {
        ...geldigeRegel,
        kosten: -45,
      }),
    );
  });

  it("weigert een notitie die als opslagplek wordt misbruikt", async () => {
    const db = alsGebruiker(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/projects/p1/onderhoudslogboek/l6`), {
        ...geldigeRegel,
        notitie: "x".repeat(2001),
      }),
    );
  });

  it("weigert dat Bob het logboek van Alice leest", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), `users/${ALICE}/projects/p1/onderhoudslogboek/l7`),
        geldigeRegel,
      );
    });
    const db = alsGebruiker(BOB);
    await assertFails(getDocs(collection(db, `users/${ALICE}/projects/p1/onderhoudslogboek`)));
  });
});
