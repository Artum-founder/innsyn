// Henter tall, voteringer og sjekker hjelpetelefoner for Tema-sidene.
// Kjøres hver uke av GitHub Actions («Oppdater tema»). Skriver data/tema-tall.json.
// Ingenting skrives inn for hånd: hvert tall har tabell, kilde og dato fra kilden selv.
import { writeFile, mkdir, readFile } from 'node:fs/promises';

const UA = 'Innsyn/1.0 (+https://innsyn.life; https://github.com/Artum-founder/innsyn)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastSsb = 0;
async function get(url, opts = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opts.timeout || 30000);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'application/json, text/html;q=0.9, */*;q=0.5', ...(opts.headers || {}) }, redirect: 'follow' });
    return { ok: r.ok, status: r.status, url: r.url, text: await r.text() };
  } catch (e) { return { ok: false, status: 0, url, text: '', error: String(e.message || e) }; }
  finally { clearTimeout(t); }
}
// SSB tillater omtrent 30 kall i minuttet. Vi holder god avstand og prøver igjen ved 429.
async function ssb(url, opts) {
  for (let i = 0; i < 4; i++) {
    const wait = lastSsb + 2600 - Date.now(); if (wait > 0) await sleep(wait);
    lastSsb = Date.now();
    const r = await get(url, opts);
    if (r.status !== 429) return r;
    await sleep(20000 * (i + 1));
  }
  return { ok: false, status: 429, url, text: '' };
}
const json = s => { try { return JSON.parse(s); } catch { return null; } };

/* ------------------------------------------------------------------ */
/* Konfigurasjon                                                      */
/* ------------------------------------------------------------------ */
// select: regex mot verdiens tekst (eller kode). Variabler som ikke nevnes: utelates hvis SSB
// tillater det, ellers brukes «i alt»/«alle»/«begge», ellers første verdi.
export const STATS = [
  { id: 'kpi', tema: 'okonomi', table: '14711', label: 'Prisvekst: endring i konsumprisindeksen fra året før', unit: 'prosent', years: 11, transform: 'yoy', chart: 'bar',
    note: 'Regnet ut fra den årlige konsumprisindeksen (KPI).' },
  { id: 'lavinntekt', tema: 'okonomi', table: '10459', label: 'Andel som bor i husholdninger med vedvarende lavinntekt', unit: 'prosent', years: 10, chart: 'line',
    select: { ContentsCode: /prosent|andel/i, Alder: /i alt|alle|^total/i } },
  { id: 'strompris', tema: 'strom', table: '09007', label: 'Hva husholdningene betaler for strøm, per kWh', unit: 'øre/kWh', years: 10, chart: 'stack', seriesBy: 'ContentsCode',
    note: 'Kraftpris, nettleie og avgifter, gjennomsnitt for landet.' },
  { id: 'psykisk', tema: 'helse', table: '14823', label: 'Voksne pasienter i psykisk helsevern, per 1 000 innbyggere', unit: 'per 1 000', years: 10, chart: 'line',
    select: { Kjonn: /begge|i alt|alle/i, InnvandrKat: /i alt|alle|hele/i } },
  { id: 'bekymring', tema: 'barn', table: '10673', label: 'Bekymringsmeldinger til barnevernet', unit: 'meldinger', years: 10, chart: 'bar',
    select: { ContentsCode: /bekymringsmelding/i } },
  { id: 'barnlavinntekt', tema: 'barn', table: '10459', label: 'Andel barn (0–17 år) i husholdninger med vedvarende lavinntekt', unit: 'prosent', years: 10, chart: 'line',
    select: { ContentsCode: /prosent|andel/i, Alder: /0-17|0–17|under 18/i } },
];

export const VOTES = [
  { tema: 'okonomi', sakId: '200314', pick: 'contested' },
  { tema: 'helse', sakId: '200231', pick: 'helhet' },
  { tema: 'helse', sakId: '200228', pick: 'helhet' },
  { tema: 'strom', sakId: '200126', pick: 'helhet' },
  { tema: 'barn', sakId: '200236', pick: 'helhet' },
  { tema: 'trygghet', session: '2024-2025', titleMatch: /samtykke til seksuell|voldtekt/i, pick: 'helhet' },
  { tema: 'innvandring', sakId: '200268', pick: 'helhet' },
  { tema: 'innvandring', sakId: '107721', pick: 'helhet' },
  { tema: 'forsvar', sakId: '200254', pick: 'contested' },
];

// Hjelpetelefoner og lenker. Første adresse der all tekst i «want» finnes, brukes.
export const CHECKS = {
  nodnummer: { urls: ['https://www.helsenorge.no/hjelpetilbud-i-kommunene/legevakt'], want: ['113'] },
  legevakt: { urls: ['https://www.helsenorge.no/hjelpetilbud-i-kommunene/legevakt'], want: ['116 117'] },
  mentalhelse: { urls: ['https://mentalhelse.no/fa-hjelp/hjelpetelefonen/'], want: ['116 123'] },
  'kirkens-sos': { urls: ['https://www.kirkens-sos.no/'], want: ['22 40 00 40'] },
  alarmtelefonen: { urls: ['https://www.116111.no/'], want: ['116 111'] },
  politi: { urls: ['https://www.politiet.no/kontakt-politiet'], want: ['112', '02800'] },
  overgrepsmottak: { urls: ['https://www.helsenorge.no/hjelpetilbud-i-kommunene/overgrepsmottak', 'https://www.helsenorge.no/overgrep/overgrepsmottak', 'https://www.helsenorge.no/vold-og-overgrep/overgrepsmottak', 'https://www.nkvts.no/overgrepsmottak/', 'https://dinutvei.no/hjelpetilbud/overgrepsmottak'], want: ['overgrepsmottak', '116 117'] },
  smiso: { urls: ['https://smiso.no/'], want: ['800 57 000'] },
  dixi: { urls: ['https://www.dixi.no/'], want: ['22 44 40 50'] },
  // lenker i «Hva kan du gjøre»
  'klage-helse': { urls: ['https://www.helsenorge.no/rettigheter/klage-pa-helsetjenester/', 'https://www.helsenorge.no/rettigheter/klage/', 'https://www.helsenorge.no/rettigheter/klage-pa-helsehjelp', 'https://www.statsforvalteren.no/tema/helse/klage-pa-helse--og-omsorgstjenester/'], want: ['klage', 'statsforvalter'] },
  fristbrudd: { urls: ['https://www.helsenorge.no/rettigheter/fristbrudd/', 'https://www.helsenorge.no/rettigheter/ventetid-og-fristbrudd/', 'https://www.helfo.no/fristbrudd'], want: ['fristbrudd', 'helfo'] },
  pasientombud: { urls: ['https://www.pasientogbrukerombudet.no/'], want: ['ombud'] },
  bekymring: { urls: ['https://www.bufdir.no/barnevern/bekymringsmelding/', 'https://www.bufdir.no/barnevern/meld-fra-til-barnevernet/', 'https://www.bufdir.no/barnevern/hva-skjer-nar-du-melder-fra/', 'https://www.bufdir.no/barnevern/'], want: ['bekymring'] },
  barneombudet: { urls: ['https://www.barneombudet.no/'], want: ['barneombudet'] },
  horinger: { urls: ['https://www.stortinget.no/no/Hva-skjer-pa-Stortinget/Horing/'], want: ['høring'] },
  komiteer: { urls: ['https://www.stortinget.no/no/Representanter-og-komiteer/Komiteene/Stortingets-komiteer/'], want: ['komite'] },
  'kom-finans': { urls: ['https://www.stortinget.no/no/Representanter-og-komiteer/Komiteene/Stortingets-komiteer/Finanskomiteen/'], want: ['finanskomiteen'] },
  'kom-justis': { urls: ['https://www.stortinget.no/no/Representanter-og-komiteer/Komiteene/Stortingets-komiteer/Justiskomiteen/'], want: ['justiskomiteen'] },
  einnsyn: { urls: ['https://einnsyn.no/'], want: ['innsyn'] },
  budsjettbehandling: { urls: ['https://www.stortinget.no/no/Stortinget-og-demokratiet/Arbeidet/Budsjettbehandlingen/', 'https://www.stortinget.no/no/Stortinget-og-demokratiet/Arbeidet/Budsjett/'], want: ['budsjett'] },
};

/* ------------------------------------------------------------------ */
/* SSB                                                                */
/* ------------------------------------------------------------------ */
const V0 = 'https://data.ssb.no/api/v0/no/table/';
const metaCache = new Map();
async function meta(table) {
  if (metaCache.has(table)) return metaCache.get(table);
  const r = await ssb(V0 + table); const d = r.ok && json(r.text);
  if (!d || !Array.isArray(d.variables)) throw new Error(`metadata ${table}: HTTP ${r.status}`);
  metaCache.set(table, d); return d;
}
const TOTAL = /^(i alt|alle|begge kjønn|hele landet|total|totalt|0 i alt)/i;
export function buildQuery(m, cfg) {
  const query = [], chosen = {};
  for (const v of m.variables) {
    const texts = v.valueTexts || v.values;
    if (v.time) {
      const vals = v.values.slice(-(cfg.years + (cfg.transform === 'yoy' ? 1 : 0)));
      query.push({ code: v.code, selection: { filter: 'item', values: vals } }); chosen[v.code] = 'tid: ' + vals[0] + '–' + vals.at(-1); continue;
    }
    const re = cfg.select && (cfg.select[v.code] || Object.entries(cfg.select).find(([k]) => k.toLowerCase() === v.code.toLowerCase())?.[1]);
    let idx = [];
    if (re) idx = texts.map((t, i) => (re.test(t) || re.test(v.values.at(i))) ? i : -1).filter(i => i >= 0);
    if (cfg.seriesBy === v.code && !idx.length) idx = texts.map((_, i) => i);
    if (!idx.length) {
      if (v.elimination && !re) { chosen[v.code] = '(utelatt)'; continue; }
      const t = texts.findIndex(x => TOTAL.test(x));
      idx = [t >= 0 ? t : 0];
    }
    if (cfg.seriesBy !== v.code) idx = idx.slice(0, 1);
    query.push({ code: v.code, selection: { filter: 'item', values: idx.map(i => v.values.at(i)) } });
    chosen[v.code] = idx.map(i => texts.at(i)).join(' | ');
  }
  return { query, chosen };
}
export function parseJsonStat2(d) {
  const ids = d.id, size = d.size, dims = ids.map(id => {
    const cat = d.dimension[id].category;
    const idx = Array.isArray(cat.index) ? cat.index : Object.keys(cat.index).sort((a, b) => cat.index[a] - cat.index[b]);
    return { id, codes: idx, labels: idx.map(c => (cat.label && cat.label[c]) || c) };
  });
  const rows = [], n = d.value.length;
  for (let k = 0; k < n; k++) {
    let rem = k; const row = {};
    for (let j = ids.length - 1; j >= 0; j--) { const p = rem % size.at(j); rem = Math.floor(rem / size.at(j)); row[ids.at(j)] = dims.at(j).labels.at(p); row['_' + ids.at(j)] = dims.at(j).codes.at(p); }
    row.value = d.value.at(k); rows.push(row);
  }
  return { rows, dims };
}
const tidLabel = s => String(s).replace(/^(\d{4})K(\d)$/, '$1 K$2').replace(/^(\d{4})M(\d{2})$/, '$1-$2');
async function fetchStat(cfg) {
  const m = await meta(cfg.table);
  const { query, chosen } = buildQuery(m, cfg);
  const r = await ssb(V0 + cfg.table, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, response: { format: 'json-stat2' } }) });
  const d = r.ok && json(r.text);
  if (!d || !d.value) throw new Error(`data ${cfg.table}: HTTP ${r.status} ${r.text.slice(0, 160)}`);
  const { rows } = parseJsonStat2(d);
  const timeVar = m.variables.find(v => v.time).code;
  const seriesKey = cfg.seriesBy || null;
  const groups = new Map();
  for (const row of rows) {
    const name = seriesKey ? row[seriesKey] : cfg.label;
    if (!groups.has(name)) groups.set(name, []);
    if (row.value !== null && row.value !== undefined) groups.get(name).push({ x: tidLabel(row['_' + timeVar]), y: row.value });
  }
  let series = [...groups].map(([name, points]) => ({ name, points }));
  if (cfg.transform === 'yoy') series = series.map(s => ({ name: s.name, points: s.points.slice(1).map((p, i) => ({ x: p.x, y: Math.round((p.y / s.points.at(i).y - 1) * 1000) / 10 })) }));
  return {
    id: cfg.id, tema: cfg.tema, label: cfg.label, unit: cfg.unit, chart: cfg.chart, note: cfg.note || '',
    source: 'Statistisk sentralbyrå (SSB)', table: cfg.table, tableTitle: m.title,
    sourceUrl: `https://www.ssb.no/statbank/table/${cfg.table}/`, updated: (d.updated || '').slice(0, 10), chosen, series,
  };
}

/* ------------------------------------------------------------------ */
/* Stortinget: hvordan partiene stemte                                */
/* ------------------------------------------------------------------ */
const STO = 'https://data.stortinget.no/eksport';
const msDate = s => { const m = /\/Date\((\d+)/.exec(String(s || '')); return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : ''; };
const PARTY = { A: 'Ap' };
const sessionCache = new Map();
async function sessionCases(s) {
  if (sessionCache.has(s)) return sessionCache.get(s);
  const r = await get(`${STO}/saker?sesjonid=${s}&format=json`); await sleep(400);
  const list = ((r.ok && json(r.text)) || {}).saker_liste || [];
  sessionCache.set(s, list); return list;
}
async function findCase(cfg) {
  for (const s of cfg.session ? [cfg.session] : ['2025-2026', '2024-2025', '2026-2027']) {
    const list = await sessionCases(s);
    const hit = cfg.sakId ? list.find(x => String(x.id) === cfg.sakId) : list.filter(x => cfg.titleMatch.test(x.tittel || '') || cfg.titleMatch.test(x.korttittel || '')).find(x => x.status === 1) || null;
    if (hit) return { id: String(hit.id), title: hit.korttittel || hit.tittel, fullTitle: hit.tittel, ref: hit.henvisning || '', session: s };
  }
  return null;
}
async function fetchVote(cfg) {
  const c = await findCase(cfg);
  if (!c) throw new Error('fant ikke saken ' + (cfg.sakId || cfg.titleMatch));
  const r = await get(`${STO}/voteringer?sakid=${c.id}&format=json`); await sleep(400);
  const list = (((r.ok && json(r.text)) || {}).sak_votering_liste || []).map(v => ({ id: String(v.votering_id), tema: v.votering_tema || '', f: Number(v.antall_for), m: Number(v.antall_mot), vedtatt: v.vedtatt, res: v.votering_resultat_type_tekst || '', date: msDate(v.votering_tid) }));
  if (!list.length) throw new Error('ingen voteringer for ' + c.id);
  const helhet = [...list].reverse().find(v => /i sin helhet/i.test(v.tema));
  const contested = list.filter(v => v.vedtatt !== false && v.f >= 0 && v.m >= 0).sort((a, b) => Math.min(b.f, b.m) - Math.min(a.f, a.m))[0];
  const main = (cfg.pick === 'contested' ? contested || helhet : helhet || contested) || list.at(-1);
  const rr = await get(`${STO}/voteringsresultat?voteringid=${main.id}&format=json`); await sleep(400);
  const dd = rr.ok && json(rr.text);
  const arr = dd && (dd.voteringsresultat_liste || Object.values(dd).find(Array.isArray)) || [];
  const parties = {};
  for (const x of arr) {
    const p = (x.representant && x.representant.parti && x.representant.parti.id) || '?';
    const pid = PARTY[p] || p, code = String(x.votering);
    parties[pid] = parties[pid] || { for: 0, mot: 0, borte: 0 };
    if (code === '2') parties[pid].for++; else if (code === '3') parties[pid].mot++; else parties[pid].borte++;
  }
  const sumF = Object.values(parties).reduce((a, p) => a + p.for, 0), sumM = Object.values(parties).reduce((a, p) => a + p.mot, 0);
  const check = main.f >= 0 ? (sumF === main.f && sumM === main.m) : sumM === 0;
  const result = main.f >= 0 ? `${main.vedtatt === false ? 'Ikke vedtatt' : 'Vedtatt'} ${main.f}–${main.m}` : (main.vedtatt === false ? 'Enstemmig forkastet' : 'Enstemmig vedtatt');
  return {
    tema: cfg.tema, sakId: c.id, title: c.title, fullTitle: c.fullTitle, ref: c.ref, date: main.date, voteTema: main.tema, result,
    for: sumF, mot: sumM, parties, check,
    url: `https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/Voteringsoversikt/?p=${c.id}&dnid=1`, caseUrl: `https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=${c.id}`,
  };
}

/* ------------------------------------------------------------------ */
/* Lenker og hjelpetelefoner                                          */
/* ------------------------------------------------------------------ */
const pageText = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;| /g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').toLowerCase();
async function runCheck(id, c) {
  const tried = [];
  for (const u of c.urls) {
    const r = await get(u, { headers: { Accept: 'text/html' } }); await sleep(500);
    const t = pageText(r.text || '');
    const found = c.want.filter(w => t.includes(w.toLowerCase()));
    tried.push({ url: u, status: r.status, found });
    if (r.ok && found.length === c.want.length) return { id, ok: true, url: r.url || u, tried };
  }
  return { id, ok: false, url: null, tried };
}

/* ------------------------------------------------------------------ */
const out = { ranAt: new Date().toISOString(), stats: [], votes: [], checks: {}, errors: [] };
for (const s of STATS) {
  try { const r = await fetchStat(s); out.stats.push(r); console.log(`Tall ${s.id}: ${r.series.length} serie(r), ${r.series[0]?.points.length || 0} punkter`); }
  catch (e) { out.errors.push(`tall ${s.id}: ${e.message}`); console.warn(`Tall ${s.id} feilet: ${e.message}`); }
}
for (const v of VOTES) {
  try { const r = await fetchVote(v); out.votes.push(r); console.log(`Stemmer ${v.tema} ${r.sakId}: ${r.result} (kontroll ${r.check ? 'ok' : 'AVVIK'})`); }
  catch (e) { out.errors.push(`stemmer ${v.tema}: ${e.message}`); console.warn(`Stemmer ${v.tema} feilet: ${e.message}`); }
}
for (const [id, c] of Object.entries(CHECKS)) {
  const r = await runCheck(id, c); out.checks[id] = r;
  console.log(`Sjekk ${id}: ${r.ok ? 'ok ' + r.url : 'IKKE bekreftet'}`);
}
// Behold forrige verdier for det som feilet denne gangen.
const prev = json(await readFile('data/tema-tall.json', 'utf8').catch(() => '')) || {};
for (const s of prev.stats || []) if (!out.stats.find(x => x.id === s.id)) out.stats.push({ ...s, stale: true });
for (const v of prev.votes || []) if (!out.votes.find(x => x.sakId === v.sakId)) out.votes.push({ ...v, stale: true });
await mkdir('data', { recursive: true });
await writeFile('data/tema-tall.json', JSON.stringify(out, null, 1) + '\n');
console.log(`Skrev data/tema-tall.json: ${out.stats.length} tall, ${out.votes.length} voteringer, ${Object.values(out.checks).filter(c => c.ok).length}/${Object.keys(out.checks).length} lenker ok, ${out.errors.length} feil.`);
