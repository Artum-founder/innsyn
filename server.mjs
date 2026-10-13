// Innsyn: liten HTTP-server uten avhengigheter.
// Serverer ./public og ./data/data.json på /data.json.
// Dataene oppdateres hver morgen av en GitHub Action (se .github/workflows/oppdater.yml).
// Serveren henter den ferske filen fra GitHub hver time. Svarer ikke GitHub, oppdaterer den selv.
import http from 'node:http';
import { readFile, writeFile, mkdir, stat, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runUpdate, DEFAULTS } from './update.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(DEFAULTS.publicDir);
const DATA_FILE = path.join(DEFAULTS.dataDir, 'data.json');
const PORT = Number(process.env.PORT) || 3000;
const HOUR = 60 * 60 * 1000;
const DATA_URL = process.env.INNSYN_DATA_URL || 'https://raw.githubusercontent.com/Artum-founder/innsyn/main/data/data.json';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.geojson': 'application/geo+json',
};

// Siden leser dataene fra <script id="innsyn-data"> i index.html. Vi bytter inn siste data.json
// der, slik at siden viser ferske data uten at den selv må hente /data.json.
let pageCache = { key: '', body: null };
async function renderIndex() {
  const file = path.join(PUBLIC, 'index.html');
  const [hs, ds] = await Promise.all([stat(file), stat(DATA_FILE).catch(() => null)]);
  const key = `${hs.mtimeMs}:${ds ? ds.mtimeMs : 0}`;
  if (pageCache.key === key) return pageCache.body;
  let html = await readFile(file, 'utf8');
  if (ds) {
    try {
      const data = JSON.parse(await readFile(DATA_FILE, 'utf8'));
      const blob = JSON.stringify(data).replace(/</g, '\\u003c');
      const re = /(<script[^>]*id="innsyn-data"[^>]*>)[\s\S]*?(<\/script>)/i;
      if (re.test(html)) html = html.replace(re, (_, a, b) => a + blob + b);
    } catch (e) {
      console.warn('[innsyn] data.json kunne ikke leses, viser innebygd øyeblikksbilde:', e.message);
    }
  }
  pageCache = { key, body: Buffer.from(html, 'utf8') };
  return pageCache.body;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(res.req.method === 'HEAD' ? undefined : body);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    const url = new URL(req.url, 'http://localhost');
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain; charset=utf-8' }); }

    if (pathname === '/data.json') {
      const body = await readFile(DATA_FILE).catch(() => null);
      if (!body) return send(res, 503, '{"error":"data ikke klare"}', { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return send(res, 200, body, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' });
    }
    if (pathname === '/healthz') return send(res, 200, 'ok', { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });

    if (pathname === '/' || pathname === '/index.html') {
      return send(res, 200, await renderIndex(), { 'Content-Type': TYPES['.html'], 'Cache-Control': 'public, max-age=300' });
    }

    const file = path.resolve(PUBLIC, '.' + pathname);
    if (!file.startsWith(PUBLIC + path.sep) || pathname.includes('\0')) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
    const st = await stat(file).catch(() => null);
    if (!st || !st.isFile()) return send(res, 404, 'Ikke funnet', { 'Content-Type': 'text/plain; charset=utf-8' });
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    return send(res, 200, await readFile(file), { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600', 'Content-Length': st.size });
  } catch (e) {
    console.error('[innsyn] Feil i forespørsel:', e);
    if (!res.headersSent) send(res, 500, 'Intern feil', { 'Content-Type': 'text/plain; charset=utf-8' });
    else res.destroy();
  }
});

async function refresh() {
  try { await runUpdate(); }
  catch (e) { console.error('[innsyn] Oppdatering feilet, beholder forrige data:', e); }
}

const localFetched = async () => { try { return JSON.parse(await readFile(DATA_FILE, 'utf8')).fetched || ''; } catch { return ''; } };

// Henter data.json fra GitHub. Tar den bare i bruk hvis den ser riktig ut og ikke er eldre enn den vi har.
async function syncRemote() {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(DATA_URL, { signal: ctl.signal, headers: { 'Cache-Control': 'no-cache' } }).finally(() => clearTimeout(t));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text(); const d = JSON.parse(text);
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d.fetched || '') || !d.gov || !d.buildings || !d.contacts || !Array.isArray(d.storting && d.storting.cases) || !d.storting.cases.length) throw new Error('ugyldig innhold');
    const mine = await localFetched();
    if (mine && d.fetched < mine) { console.log(`[innsyn] GitHub-data (${d.fetched}) er eldre enn lokale (${mine}); beholder lokale.`); return d.fetched; }
    await mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = DATA_FILE + '.remote.tmp'; await writeFile(tmp, text); await rename(tmp, DATA_FILE);
    console.log(`[innsyn] Hentet data fra GitHub (${d.fetched}, ${d.storting.cases.length} saker).`);
    return d.fetched;
  } catch (e) {
    console.warn('[innsyn] Kunne ikke hente data fra GitHub:', e.message);
    return null;
  }
}

// Hver time: hent fra GitHub. Er dataene derfra eldre enn i går, oppdaterer serveren selv.
async function tick() {
  const got = await syncRemote();
  const have = got || await localFetched();
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (!have || have < yesterday) { console.log('[innsyn] Dataene er gamle; oppdaterer direkte fra kildene.'); await refresh(); }
}

// Første oppstart: bygg data/data.json fra delene i data/parts.
async function ensureData() {
  if (await stat(DATA_FILE).catch(() => null)) return;
  const parts = path.join(path.dirname(DATA_FILE), 'parts');
  const read = async n => JSON.parse(await readFile(path.join(parts, n + '.json'), 'utf8'));
  try {
    const meta = await read('meta');
    const data = { fetched: meta.fetched, gov: await read('gov'), storting: await read('storting'), buildings: await read('buildings'), contacts: await read('contacts') };
    const tema = await read('tema').catch(() => null);
    if (tema) data.tema = { ...tema, tall: JSON.parse(await readFile(path.join(path.dirname(DATA_FILE), 'tema-tall.json'), 'utf8').catch(() => 'null')) };
    await mkdir(path.dirname(DATA_FILE), { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(data));
    console.log('[innsyn] Bygde data/data.json fra data/parts');
  } catch (e) {
    console.error('[innsyn] Kunne ikke bygge data fra data/parts:', e.message);
  }
}

await ensureData();
server.listen(PORT, () => {
  console.log(`[innsyn] Lytter på port ${PORT} (public: ${path.relative(HERE, PUBLIC) || '.'}, data: ${path.relative(HERE, DATA_FILE)})`);
  tick();
  setInterval(tick, HOUR).unref();
});

process.on('unhandledRejection', e => console.error('[innsyn] Ubehandlet avvisning:', e));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });
