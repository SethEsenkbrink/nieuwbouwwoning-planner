import { Link } from "react-router";
import { Artikel, JuridischePagina } from "@/components/PubliekeLayout";
import { AANBIEDER, JURIDISCH_BIJGEWERKT } from "@/data/aanbieder";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Privacyverklaring
 *
 * DE VERLEIDING HIER IS OM TE KORT TE ZIJN. "Wij verzamelen niets" is waar
 * voor de app zelf, maar niet voor het complete plaatje: om de pagina te
 * laden gaat er wél een verzoek naar de hostingpartij, en die ziet een
 * IP-adres. Dat weglaten zou de verklaring onjuist maken op precies het punt
 * waar iemand die dit leest scherp op let.
 *
 * Artikel 3 benoemt dat daarom expliciet, mét de grens: het is een verzoek om
 * bestanden, niet om jouw dossier — dat verlaat het apparaat nooit.
 *
 * ⚠ Geen juridisch advies; laat de tekst nakijken vóór commercieel gebruik.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export default function Privacy() {
  return (
    <JuridischePagina
      titel="Privacyverklaring"
      intro={`${AANBIEDER.product} is gebouwd om zo min mogelijk over jou te weten. Deze verklaring beschrijft wat er precies gebeurt met de gegevens die je invult, en wat er gebeurt op het moment dat je de pagina opent.`}
      bijgewerkt={JURIDISCH_BIJGEWERKT}
    >
      <Artikel nummer={1} titel="De korte versie">
        <p>
          Alles wat je in {AANBIEDER.product} invult — je adres, je koopsom, je hypotheek, je
          documenten, je foto&apos;s — blijft op het apparaat waarop je werkt. Het wordt daar
          versleuteld opgeslagen. Er is geen server die het ontvangt, dus wij kunnen er niet bij,
          en er valt bij ons ook niets te lekken of te vorderen.
        </p>
        <p>
          Er zijn geen accounts, geen cookies voor tracking, geen analytics, geen advertenties en
          geen externe diensten die worden ingeladen. Het lettertype, de iconen en de code komen
          allemaal van de site zelf.
        </p>
      </Artikel>

      <Artikel nummer={2} titel="Wie verantwoordelijk is">
        <p>
          {AANBIEDER.naam}
          {AANBIEDER.vestigingsadres ? `, gevestigd te ${AANBIEDER.vestigingsadres}` : ""}
          {AANBIEDER.kvk ? ` (KvK ${AANBIEDER.kvk})` : ""} is de aanbieder van de app en
          verwerkingsverantwoordelijke voor de bezoekgegevens uit artikel 3.
        </p>
        <p>
          Voor de inhoud van je dossier ligt dat anders: die gegevens verwerk je zelf, op je
          eigen apparaat, voor je eigen huishouden. Wij hebben daar geen rol in en geen toegang
          toe. Vragen kun je stellen via{" "}
          <a href={`mailto:${AANBIEDER.email}`} className="text-link underline">
            {AANBIEDER.email}
          </a>
          .
        </p>
      </Artikel>

      <Artikel nummer={3} titel="Wat er wél gebeurt als je de pagina opent">
        <p>
          De app moet ergens vandaan komen. Op het moment dat je de site bezoekt, vraagt je
          browser de bestanden op bij onze hostingpartij. Die ziet daarbij — zoals elke webserver
          — je IP-adres, het tijdstip, welk bestand je opvraagt en welke browser je gebruikt. Dat
          gebeurt om de pagina te kunnen leveren en om misbruik en storingen te kunnen
          onderzoeken.
        </p>
        <p>
          Dat is de enige gegevensstroom die er is, en hij gaat over het ophalen van bestanden.{" "}
          <strong className="text-ink">De inhoud van je dossier zit er niet in.</strong> Zodra de
          app geladen is, maakt hij geen enkel verzoek meer naar buiten: de Content-Security-Policy
          van de pagina staat op <code className="rounded-xs bg-bone px-1">connect-src &apos;none&apos;</code>,
          waarmee de browser zelf elke uitgaande verbinding blokkeert. Voor de zekerheid wordt bij
          elke publicatie automatisch gecontroleerd dat er geen externe adressen in de gebouwde
          code staan.
        </p>
        <p>
          Wil je ook die bezoekgegevens vermijden, dan kan dat: installeer de app als PWA of laat
          hem één keer laden, en gebruik hem daarna offline. Hij werkt volledig zonder
          internetverbinding.
        </p>
      </Artikel>

      <Artikel nummer={4} titel="Wat er op jouw apparaat wordt opgeslagen">
        <p>De app gebruikt drie vormen van opslag in je browser, alledrie lokaal:</p>
        <ul className="ml-5 flex list-disc flex-col gap-1.5">
          <li>
            <strong className="text-ink">IndexedDB</strong> voor je dossier: het project, de
            planning, de kosten, de onderdelen, het onderhoud. Elk record is versleuteld met
            AES-256-GCM. Alleen de technische sleutels waarmee records worden teruggevonden staan
            leesbaar op schijf; de inhoud niet.
          </li>
          <li>
            <strong className="text-ink">OPFS</strong> (het privébestandssysteem van de browser)
            voor je documenten en foto&apos;s. Die worden per blok van 1 MiB versleuteld, elk met
            een eigen initialisatievector.
          </li>
          <li>
            <strong className="text-ink">De service worker cache</strong> voor de app zelf — de
            code, de stijl en het lettertype. Daar staan geen persoonsgegevens in; het is de
            reden dat de app offline werkt.
          </li>
        </ul>
        <p>
          De sleutel waarmee dit versleuteld wordt, bestaat uitsluitend in het werkgeheugen en
          wordt uit je wachtwoordzin afgeleid met Argon2id. Hij wordt nergens opgeslagen. Sluit
          je de kluis of loop je vijftien minuten weg, dan wordt hij uit het geheugen gewist en
          is er op schijf niets leesbaars meer.
        </p>
      </Artikel>

      <Artikel nummer={5} titel="Cookies">
        <p>
          De app zet geen cookies. Niet voor statistieken, niet voor advertenties, niet voor het
          onthouden van instellingen. Daarom is er ook geen cookiebanner — die zou alleen maar
          toestemming vragen voor iets wat niet gebeurt.
        </p>
      </Artikel>

      <Artikel nummer={6} titel="Delen met anderen">
        <p>
          Wij delen niets met derden, om de eenvoudige reden dat wij niets hebben. Er is geen
          verwerker die jouw dossier onder zich heeft, geen analytics-partij en geen
          advertentienetwerk.
        </p>
        <p>
          Wat je zelf deelt, is een andere zaak. Maak je een backup of een overdrachtsdossier en
          stuur je dat door, dan bepaal jij wie dat ontvangt en waar het terechtkomt. Een backup
          is versleuteld en zonder je wachtwoordzin of herstelcode niet te openen; een
          geëxporteerd woningpaspoort is dat bewust níét, want dat is juist bedoeld om aan een
          koper of een monteur te geven. Kijk dus na wat erin staat voordat je hem verstuurt.
        </p>
      </Artikel>

      <Artikel nummer={7} titel="Hoe lang gegevens bewaard blijven">
        <p>
          Je dossier blijft staan zolang jij het laat staan. Er is geen bewaartermijn die wij
          hanteren, want wij bewaren het niet.
        </p>
        <p>
          Wissen doe je zelf, en het gaat direct: de paniekknop in de app verwijdert de sleutel,
          de database en alle bestanden in één handeling. Wat er daarna nog over is, is het
          backupbestand dat je eerder hebt weggeschreven — dat staat op jouw schijf en moet je
          apart opruimen.
        </p>
        <p>
          De bezoekgegevens uit artikel 3 worden door de hostingpartij kortstondig bewaard voor
          beveiliging en foutopsporing, en daarna verwijderd.
        </p>
      </Artikel>

      <Artikel nummer={8} titel="Je rechten">
        <p>
          De AVG geeft je het recht op inzage, correctie, verwijdering, beperking, bezwaar en
          overdraagbaarheid van je persoonsgegevens. Bij deze app oefen je die rechten grotendeels
          zelf uit, want de gegevens staan bij jou:
        </p>
        <ul className="ml-5 flex list-disc flex-col gap-1.5">
          <li>
            <strong className="text-ink">Inzage en correctie</strong> — open je kluis; alles staat
            erin en is aan te passen.
          </li>
          <li>
            <strong className="text-ink">Overdraagbaarheid</strong> — de backupfunctie geeft je een
            bestand in een gedocumenteerd, open formaat, inclusief je bijlagen.
          </li>
          <li>
            <strong className="text-ink">Verwijdering</strong> — de paniekknop wist alles op het
            apparaat.
          </li>
        </ul>
        <p>
          Voor de bezoekgegevens uit artikel 3 kun je bij ons terecht via{" "}
          <a href={`mailto:${AANBIEDER.email}`} className="text-link underline">
            {AANBIEDER.email}
          </a>
          . Houd er rekening mee dat wij die niet aan een persoon kunnen koppelen zonder dat je
          ons daar zelf informatie voor geeft.
        </p>
        <p>
          Ben je het oneens met hoe wij hiermee omgaan, dan kun je een klacht indienen bij de
          Autoriteit Persoonsgegevens.
        </p>
      </Artikel>

      <Artikel nummer={9} titel="Kinderen en bijzondere gegevens">
        <p>
          De app is bedoeld voor volwassenen die een woning kopen, bouwen of onderhouden. Wij
          verzamelen bewust geen gegevens van kinderen — of van wie dan ook.
        </p>
        <p>
          Zet je zelf gevoelige informatie in je dossier, bijvoorbeeld een medische reden voor een
          aanpassing in de woning, dan blijft die net zo goed versleuteld op je eigen apparaat
          staan als de rest.
        </p>
      </Artikel>

      <Artikel nummer={10} titel="Controleerbaarheid">
        <p>
          Deze verklaring beschrijft hoe de software werkt, en die software is openbaar. De
          broncode staat onder de {AANBIEDER.licentie}-licentie, zodat je kunt nakijken dat wat
          hier staat ook echt zo geïmplementeerd is — inclusief de encryptie en het ontbreken van
          netwerkverkeer.
        </p>
        <p>
          Vind je iets dat niet klopt, of een kwetsbaarheid, meld het dan via{" "}
          <a href={`mailto:${AANBIEDER.beveiligingEmail}`} className="text-link underline">
            {AANBIEDER.beveiligingEmail}
          </a>
          .
        </p>
      </Artikel>

      <Artikel nummer={11} titel="Wijzigingen">
        <p>
          Verandert er iets aan de app dat gevolgen heeft voor je privacy, dan passen wij deze
          verklaring aan. De datum bovenaan geeft aan wanneer dat voor het laatst is gebeurd.
        </p>
        <p>
          Zie ook de{" "}
          <Link to="/voorwaarden" className="text-link underline">
            algemene voorwaarden
          </Link>
          .
        </p>
      </Artikel>
    </JuridischePagina>
  );
}
