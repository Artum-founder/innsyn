// Utforsker kilder for Tema-sidene og skriver alt den finner til data/utforsk.json.
// Kjøres for hånd fra GitHub Actions («Utforsk kilder»). Endrer ikke nettsiden.
//  1. SSB: søker etter statistikktabeller per tema og henter beskrivelsen av de beste treffene.
//  2. Stortinget: finner ferdigbehandlede saker per tema og hvordan partiene stemte.
//  3. Lenker: sjekker at sider finnes og om de inneholder telefonnumre og tekst vi vil vise.
import { writeFile, mkdir } from 'node:fs/promises';

const UA = 'Innsyn/1.0 (+https://innsyn.life; https://github.com/Artum-founder/innsyn)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, opts = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opts.timeout || 25000);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'application/json, text/html;q=0.9, */*;q=0.5', ...(opts.headers || {}) }, redirect: 'follow' });
    const text = await r.text();
    return { ok: r.ok, status: r.status, url: r.url, text };
  } catch (e) { return { ok: false, status: 0, url, text: '', error: String(e.message || e) }; }
  finally { clearTimeout(t); }
}
const json = s => { try { return JSON.parse(s); } catch { return null; } };

/* ---------------- 1. SSB ---------------- */
const SSB_QUERIES = {
  okonomi: ['konsumprisindeks', 'vedvarende lavinntekt', 'inntekt husholdninger lavinntekt'],
  helse: ['fastlege', 'psykisk helsevern', 'spesialisthelsetjenesten pasienter'],
  strom: ['elektrisitetspriser', 'nettleie', 'elektrisitet produksjon forbruk'],
  barn: ['barnevern tiltak', 'barnevern meldinger', 'barn vedvarende lavinntekt'],
  trygghet: ['anmeldte lovbrudd', 'straffereaksjoner', 'etterforskede lovbrudd'],
  innvandring: ['innvandrere befolkning', 'sysselsatte innvandrere', 'bosatte flyktninger'],
  forsvar: ['utgifter etter formål', 'offentlig forvaltning utgifter forsvar', 'forsvar'],
};
async function ssbSearch(q) {
  const tries = [
    ['v2', `https://data.ssb.no/api/pxwebapi/v2/tables?lang=no&pageSize=8&query=${encodeURIComponent(q)}`],
    ['v2-beta', `https://data.ssb.no/api/pxwebapi/v2-beta/tables?lang=no&pageSize=8&query=${encodeURIComponent(q)}`],
    ['v0', `https://data.ssb.no/api/v0/no/table/?query=${encodeURIComponent(q)}`],
  ];
  const attempts = [];
  for (const [api, url] of tries) {
    const r = await get(url); await sleep(300);
    attempts.push({ api, status: r.status, error: r.error });
    const d = r.ok && json(r.text);
    if (!d) continue;
    const list = Array.isArray(d) ? d : (d.tables || d.items || []);
    const hits = list.slice(0, 8).map(t => ({ id: String(t.id || t.Id || ''), title: t.label || t.title || t.text || '', updated: t.updated || t.published || '', first: t.firstPeriod || '', last: t.lastPeriod || '' })).filter(t => t.id);
    if (hits.length) return { api, hits, attempts };
  }
  return { api: null, hits: [], attempts };
}
async function ssbMeta(id) {
  const r = await get(`https://data.ssb.no/api/v0/no/table/${id}`); await sleep(300);
  const d = r.ok && json(r.text);
  if (!d || !Array.isArray(d.variables)) return { id, status: r.status, error: r.error || 'ingen metadata' };
  return {
    id, title: d.title,
    variables: d.variables.map(v => ({
      code: v.code, text: v.text, time: !!v.time, elimination: !!v.elimination, count: (v.values || []).length,
      values: (v.time ? (v.values || []).slice(-12) : (v.values || []).slice(0, 25)),
      valueTexts: (v.time ? (v.valueTexts || []).slice(-12) : (v.valueTexts || []).slice(0, 25)),
    })),
  };
}

/* ---------------- 2. Stortinget ---------------- */
const STO = 'https://data.stortinget.no/eksport';
const SESSIONS = ['2023-2024', '2024-2025', '2025-2026'];
const VOTE_MATCH = {
  okonomi: /revidert nasjonalbudsjett|statsbudsjettet|skatt/i,
  helse: /pasient|helse|fastlege|sykehus/i,
  strom: /strøm|norgespris|energiloven|kraft|nettleie/i,
  barn: /barnevern|barnetrygd|barnehage|foreldrepenger/i,
  trygghet: /samtykke|voldtekt|seksuell|vold i nære|straffeloven/i,
  innvandring: /utlending|asyl|familiegjenforening|integrering|statsborger/i,
  forsvar: /langtidsplan|forsvar|verneplikt|totalberedskap/i,
};
const msDate = s => { const m = /\/Date\((\d+)/.exec(String(s || '')); return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : ''; };
async function stortingCases() {
  const all = [];
  for (const s of SESSIONS) {
    const r = await get(`${STO}/saker?sesjonid=${s}&format=json`); await sleep(400);
    const d = r.ok && json(r.text);
    const list = (d && d.saker_liste) || [];
    for (const x of list) all.push({ id: String(x.id), session: s, title: x.tittel || '', short: x.korttittel || '', status: x.status, docGroup: x.dokumentgruppe, updated: msDate(x.sist_oppdatert_dato), ref: x.henvisning || '' });
  }
  return all;
}
const PARTY_MAP = { A: 'Ap' };
async function votesFor(sakId) {
  const r = await get(`${STO}/voteringer?sakid=${sakId}&format=json`); await sleep(400);
  const d = r.ok && json(r.text);
  const list = (d && d.sak_votering_liste) || [];
  const votes = list.map(v => ({ id: String(v.votering_id), tema: v.votering_tema || '', for: v.antall_for, mot: v.antall_mot, vedtatt: v.vedtatt, resultat: v.votering_resultat_type_tekst || '', date: msDate(v.votering_tid) }));
  const rev = [...votes].reverse();
  const main = rev.find(v => /i sin helhet/i.test(v.tema)) || rev.find(v => /innstilling|tilråding|komiteens/i.test(v.tema)) || rev.find(v => v.vedtatt === true) || rev[0];
  let byParty = null, sample = null;
  if (main && main.id) {
    const rr = await get(`${STO}/voteringsresultat?voteringid=${main.id}&format=json`); await sleep(400);
    const dd = rr.ok && json(rr.text);
    const arr = dd && (dd.voteringsresultat_liste || dd.representant_voteringsresultat_liste || Object.values(dd).find(Array.isArray));
    if (Array.isArray(arr)) {
      sample = arr.slice(0, 2);
      byParty = {};
      for (const x of arr) {
        const rep = x.representant || x;
        const p = (rep.parti && (rep.parti.id || rep.parti)) || x.parti_id || '?';
        const raw = x.votering ?? x.stemme ?? x.votering_resultat ?? '';
        const k = String(raw).toLowerCase();
        const bucket = /^(1|for)$/.test(k) ? 'for' : /^(2|mot)$/.test(k) ? 'mot' : 'fravær';
        const pid = PARTY_MAP[p] || p;
        byParty[pid] = byParty[pid] || { for: 0, mot: 0, 'fravær': 0, raw: {} };
        byParty[pid][bucket]++; byParty[pid].raw[k] = (byParty[pid].raw[k] || 0) + 1;
      }
    }
  }
  return { count: votes.length, main, byParty, sample, last: votes.slice(-6) };
}

/* ---------------- 3. Lenker og hjelpetelefoner ---------------- */
const CHECKS = [
  { id: 'legevakt', url: 'https://www.helsenorge.no/legevakt/', want: ['116 117'] },
  { id: 'nodnummer', url: 'https://www.helsenorge.no/forstehjelp/nodnummer/', want: ['113', '112', '110'] },
  { id: 'mentalhelse', url: 'https://mentalhelse.no/fa-hjelp/hjelpetelefonen', want: ['116 123'] },
  { id: 'kirkens-sos', url: 'https://www.kirkens-sos.no/', want: ['22 40 00 40'] },
  { id: 'alarmtelefonen', url: 'https://www.116111.no/', want: ['116 111'] },
  { id: 'dinutvei', url: 'https://dinutvei.no/', want: ['800 57 000', '116 117', 'overgrepsmottak'] },
  { id: 'dinutvei-overgrepsmottak', url: 'https://dinutvei.no/overgrepsmottak', want: ['116 117', 'gratis', 'anmelde'] },
  { id: 'dixi', url: 'https://www.dixi.no/', want: ['voldtatt', '22 44 40 50'] },
  { id: 'smiso', url: 'https://www.smiso.no/', want: ['800 57 000'] },
  { id: 'politiet-kontakt', url: 'https://www.politiet.no/kontakt-politiet/', want: ['112', '02800'] },
  { id: 'barneombudet', url: 'https://www.barneombudet.no/', want: ['Barneombudet'] },
  { id: 'pasientombud', url: 'https://www.helsenorge.no/pasient-og-brukerombudet/', want: ['pasient- og brukerombud'] },
  { id: 'statsforvalter-klage-helse', url: 'https://www.helsenorge.no/rettigheter/klage-pa-helsehjelp/', want: ['Statsforvalteren', 'klage'] },
  { id: 'helsenorge-ventetid', url: 'https://www.helsenorge.no/velg-behandlingssted/ventetider/', want: ['ventetid'] },
  { id: 'helsedir-ventetider-stat', url: 'https://www.helsedirektoratet.no/statistikk/statistikk-om-ventetider', want: ['ventetid'] },
  { id: 'bufdir-barnevern', url: 'https://www.bufdir.no/statistikk-og-analyse/barnevern/', want: ['barnevern'] },
  { id: 'bekymringsmelding', url: 'https://www.bufdir.no/barnevern/meld-bekymring/', want: ['bekymring'] },
  { id: 'udi-statistikk', url: 'https://www.udi.no/statistikk-og-analyse/', want: ['asyl'] },
  { id: 'imdi-tall', url: 'https://www.imdi.no/tall-og-statistikk/', want: ['bosett'] },
  { id: 'nve-nettleie', url: 'https://www.nve.no/reguleringsmyndigheten/kunde/nett/nettleiestatistikk/', want: ['nettleie'] },
  { id: 'regjeringen-forsvarsbudsjett', url: 'https://www.regjeringen.no/no/tema/forsvar/', want: ['forsvar'] },
  { id: 'statsbudsjettet', url: 'https://www.statsbudsjettet.no/', want: ['2027'] },
  { id: 'nkvts-voldtekt', url: 'https://www.nkvts.no/tema/voldtekt-og-seksuelle-overgrep/', want: ['voldtekt'] },
  { id: 'minsak', url: 'https://minsak.no/', want: ['innbyggerforslag'] },
  { id: 'einnsyn', url: 'https://einnsyn.no/', want: ['innsyn'] },
  { id: 'horinger', url: 'https://www.regjeringen.no/no/dokument/hoyringar/id1763/', want: ['høring', 'Høring'] },
];
const PHONE = /(?<!\d)(?:\d{3} \d{2} \d{3}|\d{2} \d{2} \d{2} \d{2}|11\d \d{3}|0\d{4}|11[0-3])(?!\d)/g;
function pageText(html) {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;| /g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}
async function check(c) {
  const r = await get(c.url, { headers: { Accept: 'text/html' } }); await sleep(500);
  const text = pageText(r.text || '');
  const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(r.text || '') || [])[1] || '';
  const low = text.toLowerCase();
  return {
    id: c.id, url: c.url, finalUrl: r.url, status: r.status, error: r.error, title: title.replace(/\s+/g, ' ').trim().slice(0, 140),
    found: Object.fromEntries(c.want.map(w => [w, low.includes(w.toLowerCase())])),
    phones: [...new Set(text.match(PHONE) || [])].slice(0, 20),
  };
}

/* ---------------- Kjør ---------------- */
const out = { ranAt: new Date().toISOString(), ssb: {}, votes: {}, checks: [] };
for (const [tema, qs] of Object.entries(SSB_QUERIES)) {
  out.ssb[tema] = [];
  const seen = new Set();
  for (const q of qs) {
    const s = await ssbSearch(q);
    const metas = [];
    for (const h of s.hits.slice(0, 3)) {
      if (seen.has(h.id)) continue; seen.add(h.id);
      metas.push(await ssbMeta(h.id));
    }
    out.ssb[tema].push({ query: q, api: s.api, attempts: s.attempts, hits: s.hits, meta: metas });
  }
  console.log(`SSB ${tema}: ${out.ssb[tema].reduce((n, x) => n + x.hits.length, 0)} treff`);
}
const cases = await stortingCases();
console.log(`Stortinget: ${cases.length} saker lest fra ${SESSIONS.join(', ')}`);
for (const [tema, re] of Object.entries(VOTE_MATCH)) {
  const hits = cases.filter(c => re.test(c.title) && (c.status === 1 || c.status === 'behandlet')).sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 6);
  out.votes[tema] = [];
  for (const c of hits) out.votes[tema].push({ ...c, votes: await votesFor(c.id) });
  console.log(`Stemmer ${tema}: ${hits.length} saker`);
}
for (const c of CHECKS) out.checks.push(await check(c));
console.log(`Lenker: ${out.checks.filter(c => c.status === 200).length}/${out.checks.length} svarte 200`);
await mkdir('data', { recursive: true });
await writeFile('data/utforsk.json', JSON.stringify(out, null, 1) + '\n');
console.log('Skrev data/utforsk.json');
