// Innsyn: henter ferske data fra Stortinget og regjeringen.no og oppdaterer ./data/data.json.
// Node 18+, ingen avhengigheter. Kjør: node update.mjs [--dry-run] [--fixtures <mappe>] [--data-dir <mappe>]
//
// Prinsipp: eksisterende data.json er grunnlaget. Felter vi ikke kan hente på nytt beholdes,
// og ved nettverksfeil skrives ingenting (filen blir stående som den er).

import { readFile, writeFile, rename, mkdir, copyFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULTS = {
  dataDir: process.env.DATA_DIR || path.join(HERE, 'data'),
  publicDir: process.env.PUBLIC_DIR || path.join(HERE, 'public'),
  maxVoteLookups: 25,        // voteringsoppslag per kjøring
  delayMs: 400,              // pause mellom kall mot samme tjeneste
  timeoutMs: 20000,
  prevSessionBehandletDays: 45, // ferdigbehandlede saker fra forrige sesjon tas bare med hvis nylig oppdatert
  maxPrevBehandlet: 20,         // … og høyst så mange nye av dem per kjøring
  newsPerMinistry: 3,
};

const STO = 'https://data.stortinget.no/eksport';
const RSS_BASE = 'https://www.regjeringen.no/no/rss/Rss/2581966/';
// owner først: robots.txt på regjeringen.no sperrer "/*/?ownerid" og "/*/?documenttype" (ikke denne formen).
export const rssUrl = ownerId => `${RSS_BASE}?owner=${ownerId}&documentType=aktuelt/nyheter`;
const UA = 'Innsyn/1.0 (offentlig informasjonsside; henter hver 6. time)';
const SEATS_TOTAL = 169;

/* ------------------------------------------------------------------ */
/* Kodeverk. JSON-eksporten fra data.stortinget.no bruker heltall for  */
/* enum-feltene. Verdiene under er kontrollert mot XML-eksporten        */
/* (som bruker navn) for de samme sakene, oktober 2026.                 */
/* ------------------------------------------------------------------ */
export const STATUS_BY_INT = { 1: 'behandlet', 2: 'til_behandling', 3: 'mottatt' };
export const TYPE_BY_INT = { 1: 'budsjett', 2: 'alminneligsak', 3: 'lovsak' };
export const DOCGROUP_BY_INT = {
  0: 'ikke_spesifisert', 1: 'proposisjon', 2: 'melding', 3: 'redegjorelse', 4: 'representantforslag',
  5: 'grunnlovsforslag', 6: 'dokumentserien', 7: 'innstillingssaker', 8: 'innberetning',
};
const STATUS_NAMES = new Set(['varslet', 'mottatt', 'til_behandling', 'behandlet']);
const PAGE_STATUSES = new Set(['mottatt', 'til_behandling', 'behandlet', 'varslet']);

function enumValue(v, byInt, normalise = s => s) {
  if (typeof v === 'number') return byInt[v] ?? null;
  if (typeof v === 'string' && v) {
    if (/^\d+$/.test(v)) return byInt[Number(v)] ?? null;
    return normalise(v.toLowerCase());
  }
  return null;
}
export const mapStatus = v => { const s = enumValue(v, STATUS_BY_INT); return STATUS_NAMES.has(s) ? s : null; };
export const mapType = v => enumValue(v, TYPE_BY_INT);
export const mapDocGroup = v => enumValue(v, DOCGROUP_BY_INT, s => s.replace('redegjoerelse', 'redegjorelse'));

/* ------------------------------------------------------------------ */
/* Hjelpere                                                           */
/* ------------------------------------------------------------------ */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const str = v => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

/** "/Date(1791756000000+0200)/" -> millisekunder (UTC). Tåler også ISO-datoer. */
export function parseMsDate(s) {
  if (typeof s !== 'string' || !s) return null;
  const m = /\/Date\((-?\d+)(?:[+-]\d{4})?\)\//.exec(s);
  if (m) return Number(m[1]);
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}
const OSLO = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' });
/** millisekunder -> "YYYY-MM-DD" i norsk tid */
export function osloDate(ms) {
  if (ms == null || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  // 0001-01-01 og lignende plassholdere er ikke ekte datoer
  if (d.getUTCFullYear() < 1900) return '';
  return OSLO.format(d);
}
export const todayOslo = (now = Date.now()) => OSLO.format(new Date(now));
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

export function previousSession(id) {
  const m = /^(\d{4})-(\d{4})$/.exec(id || '');
  return m ? `${+m[1] - 1}-${+m[2] - 1}` : null;
}

/** "Prop. 86 L (2025-2026), Innst. 362 L (2025-2026)" -> ["Prop. 86 L (2025–2026)", "Innst. 362 L (2025–2026)"] */
export function splitReference(s) {
  return str(s)
    .replace(/\((\d{4})-(\d{4})\)/g, '($1–$2)')
    .split(/\s*;\s*|,\s*(?=[A-ZÆØÅ])/)
    .map(x => x.trim())
    .filter(Boolean);
}
export function mergeReference(apiRef, baseRef) {
  const out = [];
  const seen = new Set();
  // Baseline først (den er håndredigert og kan forkorte, f.eks. "Lovvedtak 87" uten sesjon); så nye deler fra API.
  for (const part of [...splitReference(baseRef), ...splitReference(apiRef)]) {
    const k = part.toLowerCase().replace(/\(\d{4}[–-]\d{4}\)/g, '').replace(/\s+/g, ' ').trim();
    if (!seen.has(k)) { seen.add(k); out.push(part); }
  }
  return out.join('; ');
}

/** Gjør "Representantforslag fra ... om å redusere X" om til "Redusere X" (samme stil som de håndskrevne titlene). */
export function shortTitle(t) {
  let s = str(t);
  const m = /^Representantforslag(?:\s+fra\s+stortingsrepresentant(?:ene|en)\s+.+?)?\s+om\s+(?:å\s+)?(.+)$/i.exec(s);
  if (m && m[1].length > 3) s = m[1];
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------------ */
/* Filtre: saker baseline-dataene utelater (rent administrative)      */
/* ------------------------------------------------------------------ */
const ADMIN_TITLE = new RegExp([
  'sammensetning',                       // endringer i komiteenes sammensetning
  '^(supplerings)?valg (av|til)\\b',      // valg av medlemmer/delegasjoner
  'suppleringsvalg',
  'statsrådets protokoller',
  'spørsmål til skriftlig besvarelse',
  'saker som stortinget ikke har behandlet',
  'forelegg for stortinget av overenskomster',
  'nobelkomit',
  'innberetning fra valgkomiteen',
  'godkjenning av fullmakter',
  'søknad om (fritak|permisjon)',
].join('|'), 'i');

export function isAdministrative(docGroup, title) {
  if (docGroup === 'ikke_spesifisert' || docGroup === 'innberetning') return true;
  return ADMIN_TITLE.test(title || '');
}

/* ------------------------------------------------------------------ */
/* Stortinget: mapping                                                 */
/* ------------------------------------------------------------------ */
export function partyCodeMap(parties) {
  const map = { A: 'Ap' };
  for (const p of parties || []) if (p && p.apiId && p.party) map[p.apiId] = p.party;
  return map;
}

/** forslagstiller_liste -> "FrP (Ola Nordmann, Kari Nordmann)" / "SV og R (…)" / "H (Navn m.fl., 9 representanter)" */
export function formatProposer(list, partyMap = {}) {
  if (!Array.isArray(list) || !list.length) return '';
  const people = list
    .map(r => ({
      name: [str(r && r.fornavn), str(r && r.etternavn)].filter(Boolean).join(' '),
      party: (r && r.parti && (partyMap[r.parti.id] || r.parti.id)) || '',
    }))
    .filter(p => p.name);
  if (!people.length) return '';
  const parties = [...new Set(people.map(p => p.party).filter(Boolean))];
  const ptxt = parties.length <= 1 ? (parties[0] || '') : parties.slice(0, -1).join(', ') + ' og ' + parties[parties.length - 1];
  const names = people.length > 6 ? `${people[0].name} m.fl., ${people.length} representanter` : people.map(p => p.name).join(', ');
  return ptxt ? `${ptxt} (${names})` : names;
}

/** Departement ut fra statsrådtittel i saksnavnet, f.eks. "Redegjørelse av utenriksministeren om …" -> "ud" */
export function ministryFromTitle(title, ministries) {
  const t = str(title).toLowerCase();
  if (!t.includes('minister')) return '';
  const pairs = [];
  for (const m of ministries || []) for (const p of m.ministers || []) if (p && p.title) pairs.push([p.title.toLowerCase(), m.id]);
  pairs.sort((a, b) => b[0].length - a[0].length);
  for (const [title2, id] of pairs) if (t.includes(title2 + 'en') || t.includes(title2 + 'ens')) return id;
  return '';
}

const DEFAULT_NEXT = {
  mottatt: 'Venter på å bli referert og sendt til komité.',
  til_behandling: 'Til behandling i komiteen.',
  behandlet: '',
};

/** Én sak fra /saker -> vårt saksformat (uten baseline). Returnerer {skip} når saken ikke skal med. */
export function mapSak(raw, ctx) {
  if (!raw || typeof raw !== 'object' || raw.id == null) return { skip: 'ugyldig' };
  const id = String(raw.id);
  const status = mapStatus(raw.status);
  const type = mapType(raw.type) || '';
  const docGroup = mapDocGroup(raw.dokumentgruppe) || '';
  const fullTitle = str(raw.tittel) || str(raw.korttittel);
  const title = str(raw.korttittel) || fullTitle;
  const komite = raw.komite && typeof raw.komite === 'object' ? str(raw.komite.navn) : '';
  const topics = Array.isArray(raw.emne_liste) ? [...new Set(raw.emne_liste.map(e => str(e && e.navn)).filter(Boolean))] : [];
  const updated = osloDate(parseMsDate(raw.sist_oppdatert_dato));
  const henvisning = str(raw.henvisning);
  // Sesjon: dokumentets sesjon fra henvisningen (slik baseline gjør), men bare hvis den er en av de to vi henter.
  const refSess = /\((\d{4})[–-](\d{4})\)/.exec(henvisning);
  const session = refSess && (ctx.allowedSessions || []).includes(`${refSess[1]}-${refSess[2]}`) ? `${refSess[1]}-${refSess[2]}` : ctx.session;
  return {
    id,
    title,
    fullTitle,
    session,
    status, // kan være null (ukjent kode)
    type,
    docGroup,
    committee: komite,
    ministry: '',
    proposer: formatProposer(raw.forslagstiller_liste, ctx.partyMap),
    topics,
    updated,
    decided: '',
    outcome: '',
    nextStep: '',
    reference: henvisning,
    url: `https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=${encodeURIComponent(id)}`,
  };
}

/** Slår sammen API-sak med baseline. API vinner der det har verdi; ellers beholdes baseline. */
export function mergeCase(api, base, ctx) {
  if (!base) {
    const c = { ...api };
    c.title = shortTitle(api.title);
    if (['redegjorelse', 'proposisjon', 'melding'].includes(c.docGroup)) c.ministry = ministryFromTitle(api.fullTitle, ctx.ministries);
    c.nextStep = DEFAULT_NEXT[c.status] ?? '';
    c.reference = mergeReference(api.reference, '');
    return c;
  }
  const c = { ...base };
  c.fullTitle = api.fullTitle || base.fullTitle;
  // Tittelen i baseline er redigert kort og lesbar; den beholdes.
  if (!c.title) c.title = shortTitle(api.title);
  if (api.status) c.status = api.status;
  if (api.type) c.type = api.type;
  if (api.docGroup) c.docGroup = api.docGroup;
  if (api.committee) c.committee = api.committee;
  if (!c.proposer && api.proposer) c.proposer = api.proposer;
  if (api.topics.length) c.topics = api.topics;
  if (api.updated && (!base.updated || api.updated >= base.updated)) c.updated = api.updated;
  c.reference = mergeReference(api.reference, base.reference);
  if (!c.ministry && ['redegjorelse', 'proposisjon', 'melding'].includes(c.docGroup)) c.ministry = ministryFromTitle(c.fullTitle, ctx.ministries);
  if (api.status && api.status !== base.status) {
    if (api.status === 'behandlet') c.nextStep = '';
    else if (c.nextStep === DEFAULT_NEXT[base.status]) c.nextStep = DEFAULT_NEXT[api.status] ?? '';
  }
  for (const k of ['decided', 'outcome', 'nextStep', 'ministry', 'proposer', 'committee', 'reference', 'fullTitle']) if (c[k] == null) c[k] = '';
  if (!Array.isArray(c.topics)) c.topics = [];
  return c;
}

/** /voteringer?sakid= -> {outcome, decided} eller null */
export function summariseVotes(json) {
  const list = json && json.sak_votering_liste;
  if (!Array.isArray(list) || !list.length) return null;
  const rev = [...list].reverse();
  const byTema = re => rev.find(v => v && re.test(str(v.votering_tema)));
  const main = byTema(/i sin helhet/i) || byTema(/innstilling|tilråding|komiteens/i) || rev.find(v => v && v.vedtatt === true) || rev[0];
  if (!main) return null;
  const txt = str(main.votering_resultat_type_tekst);
  const f = Number(main.antall_for), m = Number(main.antall_mot);
  let outcome;
  if (/enstemmig/i.test(txt)) outcome = main.vedtatt === false ? 'Enstemmig forkastet.' : 'Enstemmig vedtatt.';
  else if (Number.isFinite(f) && Number.isFinite(m) && f >= 0 && m >= 0 && f + m > 0) {
    if (m === 0 && main.vedtatt !== false) outcome = 'Enstemmig vedtatt.';
    else outcome = `${main.vedtatt === false ? 'Ikke vedtatt' : 'Vedtatt'}: ${f} for, ${m} mot.`;
  } else if (main.vedtatt === true) outcome = 'Vedtatt.';
  else if (main.vedtatt === false) outcome = 'Ikke vedtatt.';
  else return null;
  return { outcome, decided: osloDate(parseMsDate(main.votering_tid)) };
}

/** /dagensrepresentanter -> oppdaterte parties, eller null hvis tallene ikke er til å stole på. */
export function seatsFromRepresentatives(json, baseParties) {
  const list = json && json.dagensrepresentanter_liste;
  if (!Array.isArray(list) || !Array.isArray(baseParties) || !baseParties.length) return null;
  const counts = {};
  for (const r of list) {
    const id = r && r.parti && r.parti.id;
    if (!id) return null;
    counts[id] = (counts[id] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total !== SEATS_TOTAL) return null;
  const known = new Set(baseParties.map(p => p.apiId));
  if (Object.keys(counts).some(k => !known.has(k))) return null;
  if (baseParties.some(p => !counts[p.apiId])) return null;
  return baseParties.map(p => ({ ...p, seats: counts[p.apiId] }));
}

/* ------------------------------------------------------------------ */
/* regjeringen.no: RSS                                                 */
/* ------------------------------------------------------------------ */
function decodeXml(s) {
  return str(s)
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(lt|gt|quot|apos|amp);/g, (_, e) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }[e]))
    .replace(/\s+/g, ' ')
    .trim();
}
const tag = (xml, name) => {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
  return m ? decodeXml(m[1]) : '';
};

export function cleanNewsUrl(u) {
  try {
    const url = new URL(u);
    if (!/(^|\.)regjeringen\.no$/i.test(url.hostname)) return '';
    url.protocol = 'https:';
    for (const k of [...url.searchParams.keys()]) if (/^utm_/i.test(k)) url.searchParams.delete(k);
    url.hash = '';
    return url.toString().replace(/\?$/, '');
  } catch { return ''; }
}

export function parseRss(xml) {
  if (typeof xml !== 'string' || !/<rss\b|<channel\b/i.test(xml)) throw new Error('ikke RSS');
  const head = xml.split(/<item\b/i)[0];
  const description = tag(head, 'description');
  const items = [];
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const body = m[1];
    const title = tag(body, 'title');
    const url = cleanNewsUrl(tag(body, 'link'));
    const ms = parseMsDate(tag(body, 'pubDate'));
    if (title && url && ms != null) items.push({ title, date: osloDate(ms), url, _ms: ms });
  }
  return { description, items };
}

const newsKey = u => str(u).toLowerCase().replace(/^https?:\/\//, '').replace(/[?#].*$/, '').replace(/\/+$/, '');

export function mergeNews(feedItems, baseNews, n, today) {
  const out = [];
  const seen = new Set();
  const all = [...(feedItems || []), ...(Array.isArray(baseNews) ? baseNews : [])];
  for (const it of all) {
    if (!it || !it.title || !it.url || !it.date) continue;
    if (today && it.date > today) continue; // kalenderhendelser fram i tid
    const k = newsKey(it.url);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ title: it.title, date: it.date, url: it.url });
  }
  out.sort((a, b) => b.date.localeCompare(a.date)); // stabil: feed-rekkefølge beholdes ved lik dato
  return out.slice(0, n);
}

const ownerIdOf = m => { const r = /\/id(\d+)\/?$/.exec(str(m && m.url)); return r ? r[1] : null; };

/* ------------------------------------------------------------------ */
/* Henting                                                            */
/* ------------------------------------------------------------------ */
export function makeHttpFetcher({ timeoutMs = DEFAULTS.timeoutMs } = {}) {
  return async function fetchText(url) {
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': UA, Accept: 'application/json, application/rss+xml, application/xml;q=0.9, */*;q=0.5' },
          signal: AbortSignal.timeout(timeoutMs),
          redirect: 'follow',
        });
        if (!res.ok) {
          const e = new Error(`HTTP ${res.status}`);
          e.status = res.status;
          if (res.status < 500) throw e; // 4xx: ikke prøv igjen
          lastErr = e;
        } else return await res.text();
      } catch (e) {
        if (e && e.status && e.status < 500) throw e;
        lastErr = e;
      }
      if (attempt === 0) await sleep(1500);
    }
    throw lastErr;
  };
}

/** Leser lokale testfiler i stedet for nettet (for --fixtures). */
export function makeFixtureFetcher(dir) {
  return async function fetchText(url) {
    const u = new URL(url);
    let file;
    if (u.hostname === 'data.stortinget.no') {
      const ep = u.pathname.split('/').pop();
      if (ep === 'sesjoner') file = 'sesjoner.json';
      else if (ep === 'saker') file = `saker-${u.searchParams.get('sesjonid')}.json`;
      else if (ep === 'voteringer') file = `voteringer-${u.searchParams.get('sakid')}.json`;
      else if (ep === 'dagensrepresentanter') file = 'dagensrepresentanter.json';
    } else if (/regjeringen\.no$/.test(u.hostname)) file = `rss-${u.searchParams.get('owner')}.xml`;
    if (!file) { const e = new Error('HTTP 404 (ingen fixture for ' + url + ')'); e.status = 404; throw e; }
    try { return await readFile(path.join(dir, file), 'utf8'); }
    catch { const e = new Error('HTTP 404 (fixture mangler: ' + file + ')'); e.status = 404; throw e; }
  };
}

async function fetchJson(fetchText, url) {
  const text = await fetchText(url);
  try { return JSON.parse(text); } catch { throw new Error('ugyldig JSON fra ' + url); }
}

/* ------------------------------------------------------------------ */
/* Baseline og skriving                                               */
/* ------------------------------------------------------------------ */
export function extractEmbeddedData(html) {
  const open = /<script[^>]*id="innsyn-data"[^>]*>/i.exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  const end = html.indexOf('</script>', start);
  if (end < 0) return null;
  return JSON.parse(html.slice(start, end).replace(/<\\\//g, '</'));
}

export async function readBaseline(dataDir, publicDir) {
  try {
    return { data: JSON.parse(await readFile(path.join(dataDir, 'data.json'), 'utf8')), from: 'data.json' };
  } catch (e) {
    if (e.code !== 'ENOENT') throw new Error('data.json kunne ikke leses: ' + e.message);
  }
  const html = await readFile(path.join(publicDir, 'index.html'), 'utf8').catch(() => null);
  const data = html && extractEmbeddedData(html);
  if (!data) throw new Error('fant verken data/data.json eller innebygde data i public/index.html');
  return { data, from: 'public/index.html (innebygd øyeblikksbilde)' };
}

export function validate(next, base) {
  const errs = [];
  const ok = (cond, msg) => { if (!cond) errs.push(msg); };
  ok(next && typeof next === 'object', 'mangler data');
  if (errs.length) return errs;
  for (const k of ['gov', 'storting', 'buildings', 'contacts']) ok(next[k] != null, 'mangler ' + k);
  ok(/^\d{4}-\d{2}-\d{2}$/.test(next.fetched || ''), 'ugyldig fetched');
  const cases = next.storting && next.storting.cases;
  ok(Array.isArray(cases) && cases.length > 0, 'ingen saker');
  if (Array.isArray(cases)) {
    ok(cases.length >= ((base.storting && base.storting.cases) || []).length, 'færre saker enn før');
    const ids = new Set();
    for (const c of cases) {
      ok(c && c.id && c.title && PAGE_STATUSES.has(c.status) && Array.isArray(c.topics), 'ugyldig sak ' + (c && c.id));
      ok(!ids.has(c.id), 'duplikat sak ' + c.id);
      ids.add(c.id);
    }
  }
  const mins = next.gov && next.gov.ministries;
  ok(Array.isArray(mins) && mins.length === ((base.gov && base.gov.ministries) || []).length, 'feil antall departementer');
  ok(Array.isArray(next.buildings) && next.buildings.length === (base.buildings || []).length, 'feil antall bygg');
  return [...new Set(errs)];
}

async function writeAtomic(file, text) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, text, 'utf8');
  try {
    JSON.parse(await readFile(tmp, 'utf8')); // les tilbake før vi bytter
    await copyFile(file, file.replace(/\.json$/, '.prev.json')).catch(() => {});
    await rename(tmp, file);
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Oppdatering                                                        */
/* ------------------------------------------------------------------ */
async function updateStorting(base, gov, opts, log, today) {
  const { fetchText } = opts;
  const S = base;
  const sesj = await fetchJson(fetchText, `${STO}/sesjoner?format=json`);
  const current = sesj && sesj.innevaerende_sesjon && str(sesj.innevaerende_sesjon.id);
  if (!/^\d{4}-\d{4}$/.test(current || '')) throw new Error('fant ikke inneværende sesjon');
  const prev = previousSession(current);

  const curJson = await fetchJson(fetchText, `${STO}/saker?sesjonid=${current}&format=json`);
  const curList = curJson && curJson.saker_liste;
  if (!Array.isArray(curList) || !curList.length) throw new Error('tom saksliste for ' + current);
  let prevList = [];
  try {
    await sleep(opts.delayMs);
    const pj = await fetchJson(fetchText, `${STO}/saker?sesjonid=${prev}&format=json`);
    if (Array.isArray(pj && pj.saker_liste)) prevList = pj.saker_liste;
  } catch (e) {
    log.warn(`Stortinget: forrige sesjon (${prev}) feilet (${e.message}); beholder baseline for den.`);
  }

  const ctx = { session: current, allowedSessions: [current, prev], partyMap: partyCodeMap(S.parties), ministries: gov && gov.ministries };
  const baseById = new Map((S.cases || []).map(c => [String(c.id), c]));
  const stats = { api: 0, updated: 0, added: 0, skippedAdmin: 0, skippedOld: 0, unknownStatus: 0, votes: 0 };
  let prevBehandletAdded = 0;
  const apiById = new Map();
  const cutoff = addDays(today, -opts.prevSessionBehandletDays);

  for (const [list, sessionId] of [[prevList, prev], [curList, current]]) {
    for (const raw of list) {
      const api = mapSak(raw, { ...ctx, session: sessionId });
      if (api.skip) continue;
      stats.api++;
      const base0 = baseById.get(api.id);
      if (!base0) {
        if (isAdministrative(api.docGroup, api.fullTitle || api.title)) { stats.skippedAdmin++; continue; }
        if (!api.status) { stats.unknownStatus++; continue; }
        if (sessionId === prev && api.status === 'behandlet') {
          // Forrige sesjon har hundrevis av ferdige saker; ta bare med de nylig oppdaterte, og ikke for mange.
          if (!(api.updated >= cutoff) || prevBehandletAdded >= opts.maxPrevBehandlet) { stats.skippedOld++; continue; }
          prevBehandletAdded++;
        }
      } else if (!api.status) stats.unknownStatus++;
      // Saker som ligger i begge lister (overført fra forrige sesjon): siste liste vinner for status/dato.
      const prior = apiById.get(api.id);
      if (prior && !api.status) api.status = prior.status;
      apiById.set(api.id, api);
    }
  }

  const cases = [];
  for (const b of S.cases || []) {
    const api = apiById.get(String(b.id));
    if (!api) { cases.push(b); continue; }
    const merged = mergeCase(api, b, ctx);
    if (JSON.stringify(merged) !== JSON.stringify(b)) stats.updated++;
    cases.push(merged);
  }
  const fresh = [...apiById.values()].filter(a => !baseById.has(a.id)).map(a => mergeCase(a, null, ctx));
  fresh.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  stats.added = fresh.length;
  cases.push(...fresh);

  // Voteringsresultat for ferdigbehandlede saker uten utfall
  const needVotes = cases.filter(c => c.status === 'behandlet' && !c.outcome).slice(0, opts.maxVoteLookups);
  for (const c of needVotes) {
    await sleep(opts.delayMs);
    try {
      const v = summariseVotes(await fetchJson(fetchText, `${STO}/voteringer?sakid=${encodeURIComponent(c.id)}&format=json`));
      if (v) {
        c.outcome = v.outcome;
        if (!c.decided && v.decided) c.decided = v.decided;
        stats.votes++;
      }
    } catch (e) {
      log.warn(`Stortinget: voteringer for sak ${c.id} feilet (${e.message}).`);
    }
  }

  // Setefordeling: bare hvis tallene går opp til 169 med kjente partier
  let parties = S.parties;
  try {
    await sleep(opts.delayMs);
    const seats = seatsFromRepresentatives(await fetchJson(fetchText, `${STO}/dagensrepresentanter?format=json`), S.parties);
    if (seats) parties = seats;
    else log.info('Stortinget: setefordeling ikke entydig fra dagensrepresentanter; beholder baseline.');
  } catch (e) {
    log.info(`Stortinget: dagensrepresentanter feilet (${e.message}); beholder setefordeling.`);
  }

  const next = { ...S, fetched: today, session: current, parties, cases };
  log.info(`Stortinget: ${stats.api} saker fra API, ${stats.updated} oppdatert, ${stats.added} nye, ` +
    `${stats.skippedAdmin} administrative og ${stats.skippedOld} eldre ferdigbehandlede hoppet over, ` +
    `${stats.unknownStatus} med ukjent statuskode, ${stats.votes}/${needVotes.length} voteringsresultat hentet.`);
  return next;
}

async function updateNews(gov, opts, log, today) {
  const { fetchText } = opts;
  let ok = 0, changed = 0, netFailsInRow = 0;
  const failures = [];
  const ministries = [];
  for (const m of gov.ministries || []) {
    if (netFailsInRow >= 3) { ministries.push(m); failures.push(`${m.id}: hoppet over (nettet svarer ikke)`); continue; }
    const owner = ownerIdOf(m);
    if (!owner) { ministries.push(m); failures.push(`${m.id}: mangler id i url`); continue; }
    try {
      if (ok + failures.length > 0) await sleep(opts.delayMs);
      const { description, items } = parseRss(await fetchText(rssUrl(owner)));
      // Sikkerhet: kanalbeskrivelsen skal navngi departementet, ellers er filteret ikke brukt.
      const norm = x => str(x).toLowerCase().replace(/\s+/g, ' ');
      if (!norm(description).includes(norm('Departement: ' + m.name))) throw new Error(`feed er ikke filtrert på ${m.name} («${description.slice(0, 80)}»)`);
      if (!items.length) throw new Error('ingen elementer');
      const news = mergeNews(items, m.news, opts.newsPerMinistry, today);
      if (JSON.stringify(news) !== JSON.stringify(m.news)) changed++;
      ministries.push({ ...m, news });
      ok++;
      netFailsInRow = 0;
    } catch (e) {
      netFailsInRow = e && (e.status || /ikke RSS|filtrert|ingen elementer/.test(e.message)) ? 0 : netFailsInRow + 1;
      failures.push(`${m.id}: ${e.message}`);
      ministries.push(m);
    }
  }
  if (failures.length) log.warn(`Regjeringen: nyheter beholdt for ${failures.length} departement(er): ${failures.join('; ')}`);
  log.info(`Regjeringen: ${ok}/${(gov.ministries || []).length} RSS-feeder lest, ${changed} departement(er) med nye nyheter.`);
  return ok ? { ...gov, fetched: today, ministries } : null;
}

let running = null;

/**
 * Kjører én oppdatering. Kaster aldri for nettverksfeil; returnerer et sammendrag.
 * opts: { dataDir, publicDir, fetchText, dryRun, now, log, ... }
 */
export function runUpdate(options = {}) {
  if (running) return running;
  running = doRun(options).finally(() => { running = null; });
  return running;
}

async function doRun(options) {
  const opts = { ...DEFAULTS, ...options };
  const log = opts.log || {
    info: m => console.log(`[innsyn] ${m}`),
    warn: m => console.warn(`[innsyn] ADVARSEL: ${m}`),
  };
  opts.fetchText = opts.fetchText || makeHttpFetcher(opts);
  const today = todayOslo(opts.now);
  const file = path.join(opts.dataDir, 'data.json');
  const started = Date.now();

  let base, from;
  try { ({ data: base, from } = await readBaseline(opts.dataDir, opts.publicDir)); }
  catch (e) { log.warn(`Ingen baseline: ${e.message}. Ingenting skrevet.`); return { written: false, reason: 'no-baseline' }; }

  const next = JSON.parse(JSON.stringify(base));
  const refreshed = [];

  try {
    next.storting = await updateStorting(base.storting || {}, base.gov, opts, log, today);
    refreshed.push('storting');
  } catch (e) {
    log.warn(`Stortinget utilgjengelig (${e.message}); beholder sakene fra baseline.`);
  }
  try {
    const gov = await updateNews(base.gov || {}, opts, log, today);
    if (gov) { next.gov = gov; refreshed.push('nyheter'); }
  } catch (e) {
    log.warn(`regjeringen.no utilgjengelig (${e.message}); beholder nyhetene.`);
  }

  if (!refreshed.length) {
    log.warn(`Ingen kilder svarte; ${path.relative(process.cwd(), file) || file} er uendret.`);
    return { written: false, reason: 'offline', refreshed };
  }
  next.fetched = today;

  const errs = validate(next, base);
  if (errs.length) {
    log.warn(`Resultatet besto ikke kontrollen (${errs.slice(0, 5).join(', ')}); ingenting skrevet.`);
    return { written: false, reason: 'invalid', errors: errs, refreshed };
  }
  const text = JSON.stringify(next, null, 1) + '\n';
  if (opts.dryRun) {
    log.info(`Tørrkjøring: ville skrevet ${text.length} byte (${refreshed.join(' + ')}), baseline fra ${from}.`);
    return { written: false, reason: 'dry-run', refreshed, data: next };
  }
  await writeAtomic(file, text);
  log.info(`Skrev ${file} (${refreshed.join(' + ')}, ${next.storting.cases.length} saker) på ${((Date.now() - started) / 1000).toFixed(1)} s.`);
  return { written: true, refreshed, data: next };
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */
const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const args = process.argv.slice(2);
  const val = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const opts = { dryRun: args.includes('--dry-run') };
  if (val('--data-dir')) opts.dataDir = path.resolve(val('--data-dir'));
  if (val('--fixtures')) { opts.fetchText = makeFixtureFetcher(path.resolve(val('--fixtures'))); opts.delayMs = 0; }
  runUpdate(opts).then(
    () => process.exit(0),
    e => { console.error('[innsyn] Uventet feil:', e); process.exit(1); },
  );
}
