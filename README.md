# Innsyn

Innsyn samler det som skjer i regjeringen og Stortinget på ett sted: et kart over departementene i Oslo, alle saker i Stortinget, frister for innspill og enkle guider for å si fra.

## Server og automatisk oppdatering

Liten Node-server uten avhengigheter (Node 18 eller nyere). Den viser Innsyn-siden og henter ferske data fra Stortinget og regjeringen.no.

## Slik kjører den

- **Replit:** startkommando `npm start`. Porten tas fra `PORT`, ellers 3000.
- Lokalt: `npm start`, og åpne http://localhost:3000.
- Kjør én oppdatering for hånd: `npm run update`. Legg til `-- --dry-run` hvis du bare vil se hva som ville blitt endret.

## Hva som skjer

1. Ved oppstart, og deretter **hver 6. time**, kjører `update.mjs`:
   - **Stortinget** (data.stortinget.no): saker for inneværende og forrige sesjon. Status, komité, emner, forslagsstillere og dato oppdateres, og nye saker legges til. Rent administrative saker blir hoppet over, for eksempel komitéendringer, statsrådsprotokoller og skriftlige spørsmål. For ferdigbehandlede saker uten resultat hentes voteringen (maks 25 per kjøring).
   - **Regjeringen** (RSS fra regjeringen.no): de tre siste nyhetene for hvert departement.
2. Resultatet lagres i `data/data.json`. Filen skrives atomisk: først til en midlertidig fil, så byttes den inn. Forrige versjon ligger i `data/data.prev.json`.
3. Siden (`/`) får alltid de nyeste dataene satt inn. Rådataene finnes også på `/data.json`, som bufres i 5 minutter.

## Første kjøring

Øyeblikksbildet fra 13.10.2026 ligger i `data/parts/`. Ved første oppstart settes delene sammen til `data/data.json`, så siden virker fra første sekund.

## Når noe feiler

Svarer ikke en kilde, beholdes de gamle dataene og det logges en advarsel. Filen blir aldri tom eller ødelagt. Felter som bare finnes i øyeblikksbildet blir aldri slettet: neste steg, utfall, vedtaksdato, korte titler, adresser, kontaktinfo og bygg.

## Filer

| Fil | Hva |
|---|---|
| `server.mjs` | HTTP-serveren |
| `update.mjs` | Henting og sammenslåing (`runUpdate()`) |
| `public/index.html` | Sidens HTML og stil |
| `public/app.js` | Kart, saker, guider og resten av logikken |
| `data/parts/` | Øyeblikksbildet: regjeringen, Stortinget, kontakter og bygg |
| `data/data.json` | Gjeldende data (lages automatisk, ikke i git) |

## Lisens

Innsyn er åpen kildekode under GNU Affero General Public License v3.0 (AGPL-3.0). Du kan bruke, endre og dele koden, men kjører du en endret versjon som en tjeneste for andre, må du også dele kildekoden til endringene dine.
