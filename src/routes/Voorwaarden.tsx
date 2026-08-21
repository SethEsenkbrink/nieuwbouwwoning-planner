import { Link } from "react-router";
import { Artikel, JuridischePagina } from "@/components/PubliekeLayout";
import { AANBIEDER, JURIDISCH_BIJGEWERKT, VOORWAARDEN_VERSIE } from "@/data/aanbieder";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Algemene voorwaarden
 *
 * WAAROM DEZE TEKST ZO KORT IS. De meeste algemene voorwaarden zijn lang omdat
 * er een dienst achter zit: accounts, opslag, betalingen, support. Hier is
 * niets van dat alles. De software draait op het apparaat van de gebruiker,
 * er is geen server die data ontvangt en er wordt niets in rekening gebracht.
 * Wat er wél geregeld moet worden is daarmee klein: wat de app is, wat hij
 * uitdrukkelijk niet is, en wie waarvoor verantwoordelijk is.
 *
 * ⚠ DIT IS GEEN JURIDISCH ADVIES EN GEEN VERVANGING VAN EEN JURIST.
 * De tekst is opgesteld om eerlijk en leesbaar te beschrijven hoe de app
 * werkt. Ga je hem commercieel aanbieden, laat hem dan nakijken.
 *
 * De aanbiedergegevens staan in `src/data/aanbieder.ts` en niet hier, omdat
 * de privacyverklaring ze ook noemt.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export default function Voorwaarden() {
  return (
    <JuridischePagina
      titel="Algemene voorwaarden"
      intro={`Deze voorwaarden gelden voor het gebruik van ${AANBIEDER.product}. Ze zijn kort, omdat er weinig te regelen valt: er is geen account, geen abonnement en geen server die jouw gegevens ontvangt.`}
      bijgewerkt={JURIDISCH_BIJGEWERKT}
      versie={VOORWAARDEN_VERSIE}
    >
      <Artikel nummer={1} titel="Wie deze voorwaarden stelt">
        <p>
          {AANBIEDER.product} wordt aangeboden door {AANBIEDER.naam}
          {AANBIEDER.vestigingsadres ? `, gevestigd te ${AANBIEDER.vestigingsadres}` : ""}
          {AANBIEDER.kvk ? `, ingeschreven bij de Kamer van Koophandel onder nummer ${AANBIEDER.kvk}` : ""}
          . Vragen over deze voorwaarden kun je stellen via{" "}
          <a href={`mailto:${AANBIEDER.email}`} className="text-link underline">
            {AANBIEDER.email}
          </a>
          .
        </p>
        <p>
          Waar hieronder &quot;wij&quot; staat, wordt {AANBIEDER.naam} bedoeld. Waar &quot;jij&quot;
          staat, wordt de gebruiker van de app bedoeld.
        </p>
      </Artikel>

      <Artikel nummer={2} titel="Wat je krijgt">
        <p>
          {AANBIEDER.product} is een webapplicatie die volledig in je eigen browser draait. Je
          gebruikt hem om de gegevens rond je woning te ordenen: termijnen, kosten, afspraken,
          onderhoud, garanties en documenten.
        </p>
        <p>
          Wij leveren de software, niet de gegevens en niet de opslag. Alles wat je invult wordt
          op jouw apparaat opgeslagen. Er is geen account, er is geen server die jouw dossier
          ontvangt, en wij hebben er dus ook geen toegang toe.
        </p>
        <p>
          Het gebruik is kosteloos. Er is geen proefperiode die afloopt en er wordt niets in
          rekening gebracht.
        </p>
      </Artikel>

      <Artikel nummer={3} titel="Geen advies — dit is de belangrijkste bepaling">
        <p>
          De app rekent termijnen, rentes, garantieperiodes en energie-indicaties door op basis
          van algemene kaders en de gegevens die jij invult. Denk aan het 5%-opschortingsrecht
          uit artikel 7:768 BW, de garantieregelingen van Woningborg en SWK, en de
          rekenmethodiek NTA 8800.
        </p>
        <p>
          <strong className="text-ink">
            Die uitkomsten zijn indicatief en uitdrukkelijk geen juridisch, fiscaal, bouwkundig
            of financieel advies.
          </strong>{" "}
          Je koop- of aannemingsovereenkomst, je hypotheekakte, je garantiecertificaat en de
          opgave van een bevoegde instantie gaan altijd vóór op wat de app toont.
        </p>
        <p>
          Neem geen onomkeerbaar besluit — een termijn laten verstrijken, een depot vrijgeven,
          een overeenkomst tekenen — uitsluitend op basis van wat je hier ziet. Controleer het
          bij je aannemer, je notaris, je adviseur of de betreffende instantie.
        </p>
      </Artikel>

      <Artikel nummer={4} titel="Je wachtwoordzin en je herstelcode">
        <p>
          Bij het aanmaken van je kluis kies je een wachtwoordzin en krijg je een herstelcode.
          Uit die wachtwoordzin wordt de sleutel afgeleid waarmee je gegevens versleuteld worden.
          Wij bewaren geen van beide en kunnen ze niet achterhalen.
        </p>
        <p>
          <strong className="text-ink">
            Raak je zowel je wachtwoordzin als je herstelcode kwijt, dan is je dossier
            definitief niet meer te openen.
          </strong>{" "}
          Dat is geen tekortkoming maar het directe gevolg van het ontwerp: er is geen partij die
          een achterdeur heeft, ook wij niet.
        </p>
      </Artikel>

      <Artikel nummer={5} titel="Wat er van jou wordt verwacht">
        <ul className="ml-5 flex list-disc flex-col gap-1.5">
          <li>
            Je bewaart je herstelcode ergens anders dan op het apparaat waarop de kluis staat.
          </li>
          <li>
            Je maakt zelf backups. De app helpt daarbij en kan het grotendeels automatisch doen,
            maar de backup staat op jouw schijf en blijft jouw verantwoordelijkheid.
          </li>
          <li>
            Je controleert wat de app berekent tegen je eigen stukken, zoals in artikel 3
            beschreven.
          </li>
          <li>
            Je zorgt dat het apparaat waarop je de app gebruikt voldoende beveiligd is. De
            versleuteling beschermt je gegevens op schijf, niet tegen iemand die meekijkt terwijl
            je kluis openstaat.
          </li>
          <li>
            Je gebruikt de app niet voor iets onrechtmatigs, en niet om de rechten van anderen te
            schenden.
          </li>
        </ul>
      </Artikel>

      <Artikel nummer={6} titel="Beschikbaarheid">
        <p>
          De app wordt aangeboden zoals hij is. Wij spannen ons in om hem beschikbaar en werkend
          te houden, maar geven geen garantie op ononderbroken beschikbaarheid, op foutloze
          werking of op geschiktheid voor een specifiek doel.
        </p>
        <p>
          Omdat de app als Progressive Web App wordt geïnstalleerd en offline werkt, blijft een
          eenmaal geladen versie ook bruikbaar als de website tijdelijk niet bereikbaar is. Je
          gegevens staan immers lokaal.
        </p>
        <p>
          Wij mogen de app wijzigen, uitbreiden of stopzetten. Bij stopzetting blijft je
          bestaande installatie werken zolang je browser hem ondersteunt, en houd je via de
          backupfunctie een bestand met al je gegevens in een gedocumenteerd formaat.
        </p>
      </Artikel>

      <Artikel nummer={7} titel="Aansprakelijkheid">
        <p>
          De app is kosteloos en draait op jouw apparaat, buiten onze waarneming. Onze
          aansprakelijkheid voor schade die verband houdt met het gebruik ervan is daarom
          uitgesloten, voor zover de wet dat toestaat.
        </p>
        <p>
          Die uitsluiting geldt uitdrukkelijk niet bij opzet of bewuste roekeloosheid van onze
          kant, en niet voor schade aan leven, lichaam of gezondheid. Ben je consument, dan
          blijven je dwingendrechtelijke rechten onverkort gelden — deze bepaling doet daar niets
          aan af.
        </p>
        <p>
          Wij zijn in het bijzonder niet aansprakelijk voor gegevensverlies. Je gegevens staan op
          jouw apparaat; een defecte schijf, een gewiste browseropslag of een vergeten
          wachtwoordzin ligt buiten onze invloed. Maak backups.
        </p>
      </Artikel>

      <Artikel nummer={8} titel="Broncode, licentie en merknaam">
        <p>
          De broncode van {AANBIEDER.product} is openbaar en beschikbaar onder de{" "}
          <strong className="text-ink">{AANBIEDER.licentie}</strong>-licentie. Je mag de code
          bekijken, aanpassen en zelf draaien onder de voorwaarden van die licentie. De volledige
          licentietekst staat in het bestand <code className="rounded-xs bg-bone px-1">LICENSE</code>{" "}
          in de broncode.
        </p>
        <p>
          Die licentie geldt voor de code, niet voor de naam en de vormgeving. De namen{" "}
          {AANBIEDER.product} en {AANBIEDER.naam}, de logo&apos;s en de huisstijl zijn daarvan
          uitgezonderd. Publiceer je een aangepaste versie, doe dat dan onder je eigen naam en
          zonder onze merkelementen.
        </p>
      </Artikel>

      <Artikel nummer={9} titel="Persoonsgegevens">
        <p>
          Hoe er met gegevens wordt omgegaan staat in de{" "}
          <Link to="/privacy" className="text-link underline">
            privacyverklaring
          </Link>
          . De korte versie: wij ontvangen je dossier niet, want er is geen server die het kan
          ontvangen.
        </p>
      </Artikel>

      <Artikel nummer={10} titel="Wijziging van deze voorwaarden">
        <p>
          Wij kunnen deze voorwaarden aanpassen, bijvoorbeeld als de app wezenlijk verandert. De
          geldende versie staat altijd op deze pagina, met de datum van de laatste herziening en
          een versienummer bovenaan.
        </p>
        <p>
          Er is geen account en dus ook geen adres waarop wij je een wijziging kunnen sturen.
          Kijk deze pagina daarom af en toe na. Ben je het met een wijziging niet eens, dan kun
          je stoppen met het gebruik van de app en je gegevens meenemen via de backupfunctie.
        </p>
      </Artikel>

      <Artikel nummer={11} titel="Toepasselijk recht en geschillen">
        <p>
          Op deze voorwaarden is Nederlands recht van toepassing. Komen we er samen niet uit, dan
          is de bevoegde Nederlandse rechter aan zet. Ben je consument, dan behoud je het recht
          om je te wenden tot de rechter van je woonplaats.
        </p>
        <p>
          Heb je een klacht, laat het ons dan eerst weten via{" "}
          <a href={`mailto:${AANBIEDER.email}`} className="text-link underline">
            {AANBIEDER.email}
          </a>
          . Beveiligingsproblemen meld je liever vertrouwelijk via{" "}
          <a href={`mailto:${AANBIEDER.beveiligingEmail}`} className="text-link underline">
            {AANBIEDER.beveiligingEmail}
          </a>
          .
        </p>
      </Artikel>
    </JuridischePagina>
  );
}
