# Standaardbibliotheek betrokkenen

> Startwaarden voor de betrokkenen- en schuif-impactmodule (ADR-0008). Bedoeld als
> vertrekpunt bij het aanmaken van een project: de gebruiker vinkt aan wat van toepassing
> is en past de waarden aan.
>
> **Deze getallen zijn indicatief.** Ze komen uit gangbare praktijk, niet uit een
> normdocument. Toon ze in de UI als voorstel, nooit als feit, en laat de gebruiker altijd
> overschrijven met wat zijn eigen leverancier zegt. Dit sluit aan op constraint C5 uit
> `PROJECT.md`: de tool structureert, hij adviseert niet.

---

## Kolommen

| Veld | Betekenis |
|---|---|
| **Aanlooptijd** | Tijd tussen "partij weet het" en "partij staat er". Bepaalt hoe vroeg je moet informeren. |
| **Annuleertermijn** | Tot hoe lang van tevoren kosteloos verzetten. Bepaalt je uiterste beslismoment. |
| **Anker** | Waaraan de afspraak hangt. Zie de ankerlijst onderaan. |
| **Regel** | `direct` = bij elke wijziging informeren · `bij_aanzegging` = pas als de datum vaststaat |

---

## Installatie en techniek

| Betrokkene | Afspraak | Anker + offset | Aanlooptijd | Annuleertermijn | Regel |
|---|---|---|---|---|---|
| Keukenleverancier | inmeten | `ruwbouw_gereed` +0 d | 14 d | 7 d | direct |
| Keukenleverancier | levering + montage | `oplevering` +7 d | 56–70 d | 21 d | direct |
| Sanitair / tegelzetter | inmeten | `wind_waterdicht` +0 d | 14 d | 7 d | direct |
| Sanitair / tegelzetter | plaatsen | `oplevering` +7 d | 28 d | 14 d | direct |
| Waterontharder | plaatsing | `oplevering` +3 d | 14 d | 7 d | bij_aanzegging |
| Waterzuivering / osmose | plaatsing | `oplevering` +3 d | 14 d | 7 d | bij_aanzegging |
| Zonnepanelen | montage | `oplevering` +14 d | 28–42 d | 14 d | direct |
| Laadpaal | plaatsing | `oplevering` +14 d | 21 d | 7 d | bij_aanzegging |
| Airco / warmtepomp-extra | plaatsing | `oplevering` +14 d | 28 d | 14 d | direct |
| Domotica / netwerkbekabeling | trekken bekabeling | `ruwbouw_gereed` +0 d | 14 d | 7 d | direct |
| Alarm / camerasysteem | plaatsing | `oplevering` +21 d | 14 d | 7 d | bij_aanzegging |

> **Let op bij bekabeling en leidingwerk:** alles wat wegwerkt achter wanden of vloeren
> moet vóór het dichtmaken gebeuren. Die afspraken hangen aan een bouwmoment, en missen
> betekent hakken of opbouw. Dit zijn de duurste afspraken om te laat te plannen.

## Afbouw

| Betrokkene | Afspraak | Anker + offset | Aanlooptijd | Annuleertermijn | Regel |
|---|---|---|---|---|---|
| Stukadoor | wanden en plafonds | `oplevering` +7 d | 21 d | 14 d | direct |
| Vloerenlegger | leggen | `dekvloer_gestort` +42 d ⚠ | 21 d | 14 d | direct |
| Schilder | binnenschilderwerk | `oplevering` +21 d | 21 d | 14 d | direct |
| Timmerman | binnendeuren, plinten, kasten | `oplevering` +14 d | 21 d | 14 d | direct |
| Interieurbouwer | maatwerk | `oplevering` +28 d | 42–56 d | 21 d | direct |
| Raamdecoratie | inmeten | `oplevering` +3 d | 21 d | 7 d | bij_aanzegging |
| Raamdecoratie | plaatsen | `oplevering` +21 d | 28 d | 14 d | direct |

> ⚠ **Droogtijd dekvloer.** De +42 dagen is géén willekeurige buffer. Een cementdekvloer
> heeft ruwweg een week droogtijd per centimeter; bij een gangbare dikte van 5–7 cm kom je
> op vijf tot zeven weken. Leg je er te vroeg een vloer op, dan krijg je vocht onder de
> afwerking. Anhydriet droogt anders en vraagt vaak schuren vooraf.
>
> **Laat dit altijd meten** met een vochtmeting door de vloerenlegger. De app moet deze
> afspraak daarom aan `dekvloer_gestort` hangen en niet aan de oplevering: die twee lopen
> uit elkaar zodra de bouw ongelijkmatig schuift, en dan zit je er zomaar drie weken naast.

## Tuin en buiten

| Betrokkene | Afspraak | Anker + offset | Aanlooptijd | Annuleertermijn | Regel |
|---|---|---|---|---|---|
| Hovenier | aanleg tuin | `oplevering` +60 d | 28–42 d | 21 d | bij_aanzegging |
| Bestrating / oprit | aanleg | `oplevering` +45 d | 28 d | 14 d | bij_aanzegging |
| Schutting / erfafscheiding | plaatsing | `oplevering` +45 d | 21 d | 14 d | bij_aanzegging |
| Berging / overkapping | plaatsing | `oplevering` +60 d | 42 d | 21 d | bij_aanzegging |

> Tuinwerk is weersafhankelijk en heeft doorgaans ruime marge. Meestal `bij_aanzegging`,
> tenzij je een specifieke aannemer met een volle agenda hebt vastgelegd.

## Verhuizing

| Betrokkene | Afspraak | Anker + offset | Aanlooptijd | Annuleertermijn | Regel |
|---|---|---|---|---|---|
| Verhuisbedrijf | verhuisdag | `sleuteloverdracht` +7 d | 28 d | 14 d | direct |
| Busverhuur | ophalen bus | `sleuteloverdracht` +7 d | 7 d | 2 d | bij_aanzegging |
| Verhuisliftverhuur | liftdag | `sleuteloverdracht` +7 d | 14 d | 7 d | bij_aanzegging |
| Opslagruimte | huurperiode start | `sleuteloverdracht` −14 d | 14 d | 14 d | direct |
| Helpende handen | verhuisdag | `sleuteloverdracht` +7 d | 21 d | 3 d | bij_aanzegging |
| Schoonmaak oude woning | eindschoonmaak | `sleuteloverdracht` +10 d | 14 d | 3 d | bij_aanzegging |

## Huidige woning

| Betrokkene | Afspraak | Anker + offset | Aanlooptijd | Annuleertermijn | Regel |
|---|---|---|---|---|---|
| Verhuurder | huur opzeggen ⚠ | `sleuteloverdracht` −45 d | 30 d | n.v.t. | direct |
| Makelaar (bij verkoop) | overdracht oude woning | `sleuteloverdracht` +0 d | 60 d | n.v.t. | direct |
| Woningcorporatie | eindinspectie | `sleuteloverdracht` +10 d | 21 d | 7 d | direct |

> ⚠ **Opzegtermijn is onomkeerbaar en start meestal op de eerste van de maand.** Zeg je op
> 2 september op met een maand opzegtermijn, dan loop je vaak tot en met 31 oktober. Te
> vroeg opzeggen betekent dubbele woonlasten óf dakloos tussen twee woningen in; te laat
> betekent alleen dubbele woonlasten. Bij een indicatieve opleverdatum is **te laat het
> goedkopere risico**. Dit is de belangrijkste beslissing in het hele traject — de app moet
> hier expliciet voor waarschuwen en nooit automatisch aanraden.

## Nutsvoorzieningen en diensten

| Betrokkene | Afspraak | Anker + offset | Aanlooptijd | Annuleertermijn | Regel |
|---|---|---|---|---|---|
| Energieleverancier | contract nieuwe woning | `oplevering` −14 d | 14 d | n.v.t. | bij_aanzegging |
| Netbeheerder | meterstanden doorgeven | `oplevering` +0 d | 7 d | n.v.t. | bij_aanzegging |
| Waterbedrijf | aansluiting op naam | `oplevering` +0 d | 14 d | n.v.t. | bij_aanzegging |
| Internet / TV | aansluiting activeren | `oplevering` +3 d | 21 d | 7 d | direct |
| Gemeente | adreswijziging | `sleuteloverdracht` +0 d | 5 d | n.v.t. | bij_aanzegging |
| Verzekeraar | opstal- en inboedelverzekering ⚠ | `oplevering` −7 d | 7 d | n.v.t. | direct |

> ⚠ **Opstalverzekering moet ingaan op de dag van oplevering.** Vanaf dat moment draag jij
> het risico. Dit is een afspraak die je niet mag missen en die niets kost om te vroeg te
> regelen — zet hem dus ruim vóór de vroegste datum uit de band.

## Financieel en juridisch

| Betrokkene | Afspraak | Anker + offset | Aanlooptijd | Annuleertermijn | Regel |
|---|---|---|---|---|---|
| Hypotheekadviseur | geldigheid offerte bewaken ⚠ | `oplevering` −30 d | 30 d | n.v.t. | direct |
| Bank | bouwdepot-termijn declareren | per bouwtermijn | 14 d | n.v.t. | direct |
| Notaris | transportakte grond | `start_bouw` −14 d | 21 d | 7 d | direct |
| Bouwkundig keurder | vooropname | `oplevering` −7 d | 21 d | 7 d | direct |
| Bouwkundig keurder | opleveringskeuring ⚠ | `oplevering` +0 d | 21 d | 7 d | direct |

> ⚠ **Twee dingen die geld kosten als ze misgaan:**
>
> **Hypotheekofferte.** Die heeft een geldigheidsduur. Schuift de oplevering ver door, dan
> kan de offerte verlopen en moet je verlengen — vaak tegen kosten, en bij gestegen rente
> mogelijk tegen slechtere voorwaarden. Bij elke verschuiving hoort dit de eerste vraag te
> zijn. Dat is precies waarom deze partij `direct` staat.
>
> **Opleveringskeuring.** Een bouwkundig keurder is meestal weken vooruit geboekt en
> loopt mee tijdens de oplevering zelf. Te laat boeken betekent zonder deskundige de
> opleverpunten vaststellen, terwijl juist die lijst bepaalt wat er nog hersteld moet
> worden en of je het 5%-opschortingsrecht goed inzet.

---

## Ankerpunten

| Anker | Betekenis | Wie bepaalt de datum |
|---|---|---|
| `start_bouw` | eerste paal / start werkzaamheden | aannemer |
| `begane_grond_gestort` | vloer begane grond gestort | aannemer |
| `ruwbouw_gereed` | casco staat, wanden geplaatst | aannemer |
| `wind_waterdicht` | dak en kozijnen dicht | aannemer |
| `dekvloer_gestort` | dekvloer aangebracht | aannemer |
| `oplevering` | formele oplevering | aannemer (aanzegging) |
| `sleuteloverdracht` | sleutels in handen | volgt meestal op oplevering |
| `einde_onderhoudstermijn` | einde 3 maanden onderhoudstermijn | afgeleid van oplevering |

Niet elk project kent alle ankers, en de gebruiker hoeft ze niet allemaal in te vullen.
Ontbreekt een anker, dan valt de afspraak terug op `oplevering` met een waarschuwing dat de
berekening minder precies is.

## Uitgangspunten voor de UI

1. **Toon geen enkele waarde als vaststaand.** Overal "voorstel — controleer bij je
   leverancier". Constraint C5: de tool adviseert niet.
2. **Aanvinken, niet invullen.** Bij een nieuw project een lijst met categorieën waar je
   afvinkt wat van toepassing is; de app maakt de betrokkenen met startwaarden aan.
3. **Waarschuwingen zijn onderdeel van de data**, geen losse tekst. De ⚠-notities
   hierboven horen bij de betreffende afspraak te staan op het moment dat hij relevant
   wordt — niet in een handleiding die niemand leest.
4. **Contactgegevens zijn optioneel.** Wie alleen een lijstje wil zonder e-mailadressen in
   te voeren, moet dat kunnen. De schuif-impact werkt ook zonder.
