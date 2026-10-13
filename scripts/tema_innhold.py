# Tekstene til Tema-sidene. Kjør: python3 scripts/tema_innhold.py  -> data/parts/tema.json
# Tall og voteringer legges inn av scripts/tema-tall.mjs (hver uke), ikke her.
import json

L = 'https://lovdata.no/lov/'
STO = 'https://www.stortinget.no/no/Representanter-og-komiteer/Komiteene/Stortingets-komiteer/'

tema = [
 dict(id='okonomi', nr=1, title='Økonomi og hverdag',
  kort='Stortinget bestemmer hvor mye staten skal bruke, og hvilke skatter og avgifter vi skal betale. Regjeringen legger fram forslag til statsbudsjett hver høst, og Stortinget vedtar det før jul. Budsjettet påvirker alt fra skatt og priser til barnetrygd og kommunenes økonomi.',
  law=[
   dict(text='Stortinget vedtar skatter og avgifter, og bestemmer hva staten skal bruke penger på.', ref='Grunnloven § 75', url=L+'1814-05-17/§75'),
   dict(text='Den som ikke kan forsørge seg selv, har rett til økonomisk stønad fra NAV-kontoret.', ref='sosialtjenesteloven § 18', url=L+'2009-12-18-131/§18'),
   dict(text='Budsjettet legges fram i oktober. Stortinget vedtar rammene i november og hele budsjettet før jul.', ref='Stortingets budsjettbehandling', url='https://www.stortinget.no/no/Stortinget-og-demokratiet/Arbeidet/Budsjettbehandlingen/'),
  ],
  match=dict(committees=['Finanskomiteen'], ministries=['fin','kdd'], words='budsjett|skatt|avgift|dagligvare|pris|inntekt|lavinntekt'),
  ministries=['fin','kdd'], committees=['Finanskomiteen'],
  actions=[
   dict(t='Følg budsjetthøringene i Stortinget', d='Komiteene holder åpne høringer om budsjettet 14.–23. oktober.', url='https://www.stortinget.no/no/Hva-skjer-pa-Stortinget/Horing/', guide='mote'),
   dict(t='Skriv til finanskomiteen', d='Si hva du mener om skatter, avgifter og budsjettet.', url=STO+'Finanskomiteen/', guide='representant'),
   dict(t='Svar på høringer fra regjeringen', d='Alle kan svare på forslag til nye lover og regler.', url='https://www.regjeringen.no/no/dokument/hoyringar/id1763/', guide='horing'),
  ], help=[]),
 dict(id='helse', nr=2, title='Helse og psykisk helse',
  kort='Du har rett til nødvendig helsehjelp, både fra kommunen og fra sykehusene. Får du ikke hjelp innen fristen du har fått, skal Helfo skaffe deg behandling et annet sted. Er du misfornøyd, kan du klage, og pasient- og brukerombudet hjelper deg gratis.',
  law=[
   dict(text='Du har rett til nødvendig helsehjelp fra kommunen der du er.', ref='pasient- og brukerrettighetsloven § 2-1 a', url=L+'1999-07-02-63/§2-1a'),
   dict(text='Du har rett til nødvendig helsehjelp fra spesialisthelsetjenesten innen en frist. Brytes fristen, skal Helfo finne et annet behandlingssted.', ref='pasient- og brukerrettighetsloven § 2-1 b', url=L+'1999-07-02-63/§2-1b'),
   dict(text='Du kan klage. Klagen går først til den som ga helsehjelpen, og deretter til Statsforvalteren.', ref='pasient- og brukerrettighetsloven §§ 7-1 og 7-2', url=L+'1999-07-02-63/§7-2'),
   dict(text='Pasient- og brukerombudet gir gratis råd og hjelp, og kan ta saken din videre.', ref='pasient- og brukerrettighetsloven kapittel 8', url=L+'1999-07-02-63/KAPITTEL_8'),
  ],
  match=dict(committees=['Helse- og omsorgskomiteen'], ministries=['hod'], words='helse|pasient|sykehus|fastlege|psykisk|legemiddel'),
  ministries=['hod'], committees=['Helse- og omsorgskomiteen'],
  actions=[
   dict(t='Klag på helsehjelpen du har fått', d='Først til behandlingsstedet, så til Statsforvalteren.', url='https://www.helsenorge.no/rettigheter/klage-pa-helsehjelp/', guide=''),
   dict(t='Få hjelp av pasient- og brukerombudet', d='Gratis, og du kan være anonym.', url='https://www.helsenorge.no/pasient-og-brukerombudet/', guide=''),
   dict(t='Skriv til helse- og omsorgskomiteen', d='Si hva du mener om helsetilbudet der du bor.', url=STO+'Helse--og-omsorgskomiteen/', guide='representant'),
  ], help=['nodnummer','legevakt','mentalhelse','kirkens-sos']),
 dict(id='strom', nr=3, title='Strøm og energi',
  kort='Strømprisen avhenger av hvor i landet du bor, fordi Norge er delt i fem prisområder. I tillegg til strømmen betaler du nettleie og avgifter, som myndighetene fastsetter rammene for. Stortinget bestemmer støtteordninger og regler for kraft, nett og utbygging.',
  law=[
   dict(text='Den som vil bygge eller drive kraftanlegg og strømnett, må ha konsesjon (tillatelse) fra staten.', ref='energiloven', url=L+'1990-06-29-50'),
   dict(text='Nettleien fastsettes av nettselskapene innenfor rammer fra Reguleringsmyndigheten for energi (RME) i NVE.', ref='energiloven', url='https://www.nve.no/reguleringsmyndigheten/'),
   dict(text='Husholdninger kan få strømstøtte etter egne regler som Stortinget har vedtatt.', ref='strømstønadsloven', url='https://lovdata.no/sok?q=str%C3%B8mst%C3%B8nadsloven'),
  ],
  match=dict(committees=['Energi- og miljøkomiteen'], ministries=['ed','kld'], words='strøm|kraft|energi|nett|sol|vind|datasenter'),
  ministries=['ed','kld'], committees=['Energi- og miljøkomiteen'],
  actions=[
   dict(t='Send innspill til energi- og miljøkomiteen', d='Komiteen tar imot innspill når den behandler saker om strøm.', url='https://www.stortinget.no/no/Hva-skjer-pa-Stortinget/Horing/', guide='innspill'),
   dict(t='Svar på høringer fra Energidepartementet', d='Forslag om strøm, nett og kraft sendes ofte på høring.', url='https://www.regjeringen.no/no/dokument/hoyringar/id1763/', guide='horing'),
   dict(t='Skriv til energi- og miljøkomiteen', d='Si hva du mener om strømpris og nettleie.', url=STO+'Energi--og-miljokomiteen/', guide='representant'),
  ], help=[]),
 dict(id='barn', nr=4, title='Barn, familie og barnevern',
  kort='Barnets beste skal være et grunnleggende hensyn i alle saker som gjelder barn. Kommunen har ansvar for barnevernet, og alle kan si fra hvis de er bekymret for et barn. Barneombudet passer på at barns rettigheter blir fulgt.',
  law=[
   dict(text='Barnets beste skal være et grunnleggende hensyn i alle handlinger og avgjørelser som berører barn.', ref='Grunnloven § 104', url=L+'1814-05-17/§104'),
   dict(text='Barnevernsloven fra 2021 gir barn rett til hjelp og beskyttelse, og til å bli hørt.', ref='barnevernsloven', url=L+'2021-06-18-97'),
   dict(text='Ansatte i blant annet skole, barnehage og helse har plikt til å melde fra til barnevernet ved alvorlig bekymring.', ref='barnevernsloven § 13-2', url=L+'2021-06-18-97/§13-2'),
   dict(text='FNs barnekonvensjon gjelder som norsk lov.', ref='menneskerettsloven', url=L+'1999-05-21-30'),
  ],
  match=dict(committees=['Familie- og kulturkomiteen'], ministries=['bfd'], words='barn|barnevern|familie|foreldre|barnetrygd|barnehage'),
  ministries=['bfd','kd'], committees=['Familie- og kulturkomiteen'],
  actions=[
   dict(t='Meld fra hvis du er bekymret for et barn', d='Alle kan sende bekymringsmelding til barnevernet, også anonymt.', url='https://www.bufdir.no/barnevern/meld-bekymring/', guide=''),
   dict(t='Kontakt Barneombudet', d='Barneombudet tar opp saker som gjelder mange barn.', url='https://www.barneombudet.no/', guide=''),
   dict(t='Skriv til familie- og kulturkomiteen', d='Komiteen behandler saker om barnevern og familie.', url=STO+'Familie--og-kulturkomiteen/', guide='representant'),
  ], help=['alarmtelefonen','politi']),
 dict(id='trygghet', nr=5, title='Trygghet og seksualisert vold',
  kort='Siden 1. juli 2025 er voldtekt definert ut fra samtykke: sex med noen som ikke ved ord eller handling har vist at de vil, er voldtekt. For å dømme noen må retten være sikker utover rimelig tvil, og en frifinnelse betyr ikke at ingenting har skjedd. Mange saker blir aldri anmeldt, og tallene under viser hvor mange som når hvert steg i rettssystemet.',
  law=[
   dict(text='Sex med en person som ikke ved ord eller handling har gitt uttrykk for at hun eller han vil, er voldtekt. Grovere former kan gi opptil ti års fengsel.', ref='straffeloven § 291 (fra 1. juli 2025)', url=L+'2005-05-20-28/§291'),
   dict(text='Den som er utsatt for voldtekt, har rett til bistandsadvokat, betalt av staten.', ref='straffeprosessloven § 107 a', url=L+'1981-05-22-25/§107a'),
   dict(text='Alle har rett til å bli ansett som uskyldige til skyld er bevist etter loven.', ref='Grunnloven § 96', url=L+'1814-05-17/§96'),
  ],
  match=dict(committees=['Justiskomiteen'], ministries=['jd'], words='vold|voldtekt|seksuell|overgrep|politi|menneskehandel|straff'),
  ministries=['jd','hod','bfd','kd'], committees=['Justiskomiteen'],
  actions=[
   dict(t='Skriv til justiskomiteen', d='Komiteen behandler saker om straff, politi og vern mot vold.', url=STO+'Justiskomiteen/', guide='representant'),
   dict(t='Skriv til justisministeren', d='Send e-post til postmottak@jd.dep.no. Brevet blir journalført.', url='https://www.regjeringen.no/no/dep/jd/kontakt/id471/', guide=''),
   dict(t='Følg budsjetthøringen i justiskomiteen', d='Åpen høring om justisbudsjettet 21. og 23. oktober.', url='https://www.stortinget.no/no/Hva-skjer-pa-Stortinget/Horing/', guide='mote'),
  ], help=['politi','overgrepsmottak','smiso','dixi']),
 dict(id='innvandring', nr=6, title='Innvandring og integrering',
  kort='Utlendingsloven bestemmer hvem som kan få bo i Norge, for eksempel som flyktning, for å jobbe eller gjennom familiegjenforening. Kommunene bosetter flyktninger etter avtale med staten, og nyankomne flyktninger har rett og plikt til introduksjonsprogram. Stortinget behandler nå et forslag om familiegjenforening med barn.',
  law=[
   dict(text='Utlendingsloven har reglene for asyl, arbeidsinnvandring og familiegjenforening.', ref='utlendingsloven', url=L+'2008-05-15-35'),
   dict(text='Nyankomne flyktninger har rett og plikt til introduksjonsprogram og opplæring i norsk.', ref='integreringsloven', url=L+'2020-11-06-127'),
   dict(text='Statsborgerloven har kravene for å bli norsk statsborger.', ref='statsborgerloven', url=L+'2005-06-10-51'),
  ],
  match=dict(committees=[], ministries=['jd','aid'], words='utlending|asyl|familiegjenforening|integrering|statsborger|flyktning|innvandr'),
  ministries=['jd','aid','kdd'], committees=['Kommunal- og forvaltningskomiteen'],
  actions=[
   dict(t='Send innspill om familiegjenforening', d='Fristen for skriftlige innspill er 26. oktober kl. 12.', url='https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=200370', guide='innspill'),
   dict(t='Skriv til kommunal- og forvaltningskomiteen', d='Komiteen behandler saker om innvandring og integrering.', url=STO+'Kommunal--og-forvaltningskomiteen/', guide='representant'),
   dict(t='Be om innsyn i dokumentene', d='Se hva departementene har skrevet i saken.', url='https://einnsyn.no', guide='innsyn'),
  ], help=[]),
 dict(id='forsvar', nr=7, title='Forsvar og beredskap',
  kort='Forsvaret er under folkevalgt kontroll: Stortinget bevilger pengene og vedtar langtidsplanene, og regjeringen styrer. Kongen har formelt høyeste befaling, men beslutningene tas av regjeringen. Stortinget behandler nå blant annet eksporten av forsvarsmateriell i 2025.',
  law=[
   dict(text='Kongen har høyeste befaling over forsvaret. I praksis utøves den av regjeringen.', ref='Grunnloven § 25', url=L+'1814-05-17/§25'),
   dict(text='Stortinget bevilger pengene forsvaret får.', ref='Grunnloven § 75', url=L+'1814-05-17/§75'),
   dict(text='Avtaler med andre land som er særlig viktige, krever Stortingets samtykke.', ref='Grunnloven § 26', url=L+'1814-05-17/§26'),
  ],
  match=dict(committees=['Utenriks- og forsvarskomiteen'], ministries=['fd','ud'], words='forsvar|beredskap|nato|eksport|sikkerhet'),
  ministries=['fd','ud','jd'], committees=['Utenriks- og forsvarskomiteen'],
  actions=[
   dict(t='Følg budsjetthøringen i utenriks- og forsvarskomiteen', d='Åpen høring 15. og 16. oktober.', url='https://www.stortinget.no/no/Hva-skjer-pa-Stortinget/Horing/', guide='mote'),
   dict(t='Skriv til utenriks- og forsvarskomiteen', d='Si hva du mener om forsvar og beredskap.', url=STO+'Utenriks--og-forsvarskomiteen/', guide='representant'),
   dict(t='Les eksportmeldingen og si din mening', d='Meld. St. 12 viser hva Norge eksporterte av forsvarsmateriell i 2025.', url='https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=200374', guide=''),
  ], help=[]),
]

# Hjelpetelefoner. Hvert nummer sjekkes mot kilden av scripts/utforsk.mjs før det vises.
help = {
 'nodnummer': dict(name='Akutt fare for liv og helse', phone='113', url='https://www.helsenorge.no/forstehjelp/nodnummer/', when='Ring ambulanse ved akutt sykdom eller skade.'),
 'legevakt': dict(name='Legevakt', phone='116 117', url='https://www.helsenorge.no/legevakt/', when='Når du trenger lege raskt, men det ikke er livstruende.'),
 'mentalhelse': dict(name='Mental Helse hjelpetelefon', phone='116 123', url='https://mentalhelse.no/fa-hjelp/hjelpetelefonen', when='Noen å snakke med, døgnet rundt.'),
 'kirkens-sos': dict(name='Kirkens SOS', phone='22 40 00 40', url='https://www.kirkens-sos.no/', when='Krisetelefon døgnet rundt.'),
 'alarmtelefonen': dict(name='Alarmtelefonen for barn og unge', phone='116 111', url='https://www.116111.no/', when='Gratis for barn og unge som opplever vold, overgrep eller omsorgssvikt.'),
 'politi': dict(name='Politiet', phone='112', url='https://www.politiet.no/kontakt-politiet/', when='Ring 112 ved fare. Ellers 02800.'),
 'overgrepsmottak': dict(name='Overgrepsmottak', phone='116 117', url='https://dinutvei.no/overgrepsmottak', when='Gratis hjelp etter voldtekt eller overgrep. Du kan komme uten å anmelde.'),
 'smiso': dict(name='Hjelpetelefonen for seksuelt misbrukte', phone='800 57 000', url='https://www.smiso.no/', when='Gratis og anonymt.'),
 'dixi': dict(name='DIXI Ressurssenter', phone='22 44 40 50', url='https://www.dixi.no/', when='For deg som er utsatt for voldtekt, og pårørende.'),
}

json.dump(dict(tema=tema, help=help), open('data/parts/tema.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('skrev data/parts/tema.json', len(tema), 'tema')
