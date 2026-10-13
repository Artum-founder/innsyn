(function(){
'use strict';
const D = JSON.parse(document.getElementById('innsyn-data').textContent);
const G = D.gov, S = D.storting;
const MIN = {}; G.ministries.forEach(m => MIN[m.id] = m);
const INST = {}; G.institutions.forEach(i => INST[i.id] = i);
const BUILD = D.buildings; const BID = {}; BUILD.forEach(b => BID[b.id] = b);
const HOME = {}; BUILD.forEach(b => b.occ.forEach(o => HOME[o] = b.id));
const CASES = S.cases;
const PARTY_COLORS = {Ap:'#D3222A',FrP:'#1D3E78',H:'#2F86D2',SV:'#BE2160',Sp:'#16804A',R:'#7A1018',MDG:'#5A9E35',KrF:'#E8B000',V:'#0E7670'};
const PARTY_DARK_TEXT = {KrF:1};
// Which Storting committee normally handles each ministry's area.
const COMMITTEE_FOR = {fin:['Finanskomiteen'],jd:['Justiskomiteen'],ud:['Utenriks- og forsvarskomiteen'],fd:['Utenriks- og forsvarskomiteen'],nfd:['Næringskomiteen'],lmd:['Næringskomiteen'],ed:['Energi- og miljøkomiteen'],kld:['Energi- og miljøkomiteen'],hod:['Helse- og omsorgskomiteen'],kd:['Utdannings- og forskningskomiteen'],sd:['Samferdselskomiteen'],bfd:['Familie- og kulturkomiteen'],kud:['Familie- og kulturkomiteen'],aid:['Arbeids- og sosialkomiteen'],kdd:['Kommunal- og forvaltningskomiteen'],dfd:['Kommunal- og forvaltningskomiteen'],smk:[]};
const STATUS = {mottatt:'Mottatt', til_behandling:'I komiteen', behandlet:'Behandlet'};
const DOCGROUP = {proposisjon:'Proposisjon',representantforslag:'Representantforslag',melding:'Melding',redegjorelse:'Redegjørelse',innstillingssaker:'Innstilling',dokumentserien:'Dokument'};
const sysReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let reduce = sysReduce;

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MONTHS = ['jan.','feb.','mars','apr.','mai','juni','juli','aug.','sep.','okt.','nov.','des.'];
function fmtDate(iso, withYear){ if(!iso) return ''; const [y,m,d] = iso.split('-').map(Number); return d + '. ' + MONTHS[m-1] + (withYear ? ' ' + y : ''); }
function isoToday(){ const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0'); }
const TODAY = isoToday();
function partyChip(p){ const c = PARTY_COLORS[p] || '#666'; return '<span class="party" style="background:' + c + ';color:' + (PARTY_DARK_TEXT[p] ? '#1b1b1b' : '#fff') + '">' + esc(p) + '</span>'; }
function store(k, v){ try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch(e) { return null; } }
let watch = new Set(store('innsyn.watch') || []);

document.getElementById('stamp').textContent = 'Data hentet ' + fmtDate(D.fetched, true);

/* ===================== MAP ===================== */
const LAT0 = 59.912, LNG0 = 10.740;
const KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KY = 111200;
const XY = (lat, lng) => [(lng - LNG0) * KX, (lat - LAT0) * KY];
const P = arr => arr.map(p => XY(p[0], p[1]));

// Stylised geography of central Oslo (approximate shoreline, river, parks and main streets).
const WATER = P([[59.9112,10.6960],[59.9100,10.7080],[59.9088,10.7150],[59.9074,10.7190],[59.9060,10.7220],[59.9068,10.7232],[59.9084,10.7236],[59.9076,10.7252],[59.9086,10.7266],[59.9100,10.7290],[59.9111,10.7318],[59.9109,10.7346],[59.9092,10.7352],[59.9070,10.7350],[59.9050,10.7368],[59.9036,10.7402],[59.9040,10.7424],[59.9058,10.7432],[59.9072,10.7452],[59.9078,10.7490],[59.9070,10.7522],[59.9061,10.7540],[59.9068,10.7562],[59.9056,10.7580],[59.9030,10.7588],[59.9012,10.7612],[59.9002,10.7700],[59.9000,10.7820],[59.8800,10.7820],[59.8800,10.6960]]);
const RIVER = P([[59.9270,10.7558],[59.9235,10.7548],[59.9205,10.7540],[59.9172,10.7548],[59.9146,10.7562],[59.9118,10.7570],[59.9090,10.7562],[59.9076,10.7552]]);
const PARKS = [
  {n:'Slottsparken', p:P([[59.9188,10.7232],[59.9190,10.7302],[59.9170,10.7322],[59.9152,10.7310],[59.9150,10.7256],[59.9166,10.7232]])},
  {n:'Studenterlunden', p:P([[59.9150,10.7332],[59.9144,10.7400],[59.9137,10.7398],[59.9143,10.7330]])},
  {n:'Akershus festning', p:P([[59.9088,10.7360],[59.9090,10.7392],[59.9078,10.7420],[59.9058,10.7428],[59.9044,10.7408],[59.9056,10.7368]])},
  {n:'Vår Frelsers gravlund', p:P([[59.9232,10.7398],[59.9233,10.7468],[59.9205,10.7476],[59.9198,10.7420]])},
  {n:'Youngstorget', p:P([[59.9160,10.7488],[59.9160,10.7506],[59.9150,10.7508],[59.9150,10.7490]])}
];
const STREETS = [
  {n:'Karl Johans gate', w:3, p:P([[59.9112,10.7503],[59.9124,10.7458],[59.9131,10.7420],[59.9140,10.7375],[59.9150,10.7335],[59.9163,10.7300]])},
  {n:'Akersgata', w:2.2, p:P([[59.9098,10.7392],[59.9120,10.7410],[59.9140,10.7430],[59.9160,10.7444],[59.9180,10.7447],[59.9202,10.7430]])},
  {n:'Kirkegata', w:1.4, p:P([[59.9082,10.7398],[59.9105,10.7425],[59.9128,10.7440]])},
  {n:'Prinsens gate', w:1.2, p:P([[59.9096,10.7352],[59.9104,10.7410],[59.9112,10.7470]])},
  {n:'Grensen', w:1.6, p:P([[59.9138,10.7432],[59.9146,10.7462],[59.9152,10.7488]])},
  {n:'Storgata', w:1.8, p:P([[59.9128,10.7480],[59.9138,10.7512],[59.9152,10.7540],[59.9172,10.7590],[59.9186,10.7640]])},
  {n:'Pilestredet', w:1.4, p:P([[59.9146,10.7385],[59.9168,10.7362],[59.9195,10.7330],[59.9222,10.7300]])},
  {n:'Universitetsgata', w:1.4, p:P([[59.9139,10.7352],[59.9165,10.7360],[59.9198,10.7370]])},
  {n:'Munkedamsveien', w:1.6, p:P([[59.9116,10.7322],[59.9124,10.7282],[59.9130,10.7230],[59.9140,10.7170]])},
  {n:'Ring 1', w:2.2, p:P([[59.9128,10.7215],[59.9150,10.7240],[59.9180,10.7330],[59.9192,10.7420],[59.9182,10.7500],[59.9160,10.7560],[59.9128,10.7585],[59.9098,10.7570]])},
  {n:'Teatergata', w:1.2, p:P([[59.9150,10.7400],[59.9165,10.7420],[59.9172,10.7444]])},
  {n:'Møllergata', w:1.2, p:P([[59.9128,10.7462],[59.9150,10.7468],[59.9176,10.7476]])},
  {n:'Dronning Eufemias gate', w:2, p:P([[59.9095,10.7480],[59.9086,10.7530],[59.9080,10.7580],[59.9070,10.7640]])},
  {n:'Bygdøy allé / Drammensveien', w:2, p:P([[59.9163,10.7300],[59.9150,10.7240],[59.9138,10.7170],[59.9142,10.7080]])}
];
const AREA_LABELS = [
  {t:'Pipervika', ll:[59.9088,10.7300]}, {t:'Bjørvika', ll:[59.9058,10.7500]}, {t:'Oslofjorden', ll:[59.9010,10.7300]},
  {t:'Akershus festning', ll:[59.9070,10.7390]}, {t:'Slottsparken', ll:[59.9174,10.7262]}, {t:'Kvadraturen', ll:[59.9102,10.7408]},
  {t:'Regjeringskvartalet', ll:[59.9170,10.7470]}, {t:'Akerselva', ll:[59.9190,10.7555]}, {t:'Karl Johans gate', ll:[59.9122,10.7468]}
];
BUILD.forEach(b => { const [x,y] = XY(b.lat, b.lng); b.x = x; b.y = y; });

const cv = document.getElementById('map'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
const cam = {cx:0, cy:0, s:0.5, tilt:0.92, rot:-0.28, ox:0, oy:0};
let mode3d = true, selected = null, selOcc = null, hovered = null, animT = null, needs = true, pulse = 0;
let colors = {}, ground = null;
const GB = {xMin:-2300, xMax:2400, yMin:-1700, yMax:2100};

function readColors(){
  const cs = getComputedStyle(document.documentElement); const g = n => cs.getPropertyValue(n).trim();
  ['--bg','--ink','--muted','--accent','--map-land','--map-fabric','--map-water','--map-water-deep','--map-park','--map-street','--map-shore','--map-haze','--map-label','--b-min','--b-min-top','--b-inst','--b-inst-top','--b-link','--surface'].forEach(k => colors[k.slice(2)] = g(k));
}
function rgba(hex, a){
  hex = (hex || '#000').trim();
  if (hex.startsWith('rgb')) { const n = hex.match(/[\d.]+/g).map(Number); return 'rgba(' + n[0] + ',' + n[1] + ',' + n[2] + ',' + a + ')'; }
  let h = hex.replace('#',''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const v = parseInt(h, 16); return 'rgba(' + (v>>16&255) + ',' + (v>>8&255) + ',' + (v&255) + ',' + a + ')';
}
function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Ground texture: drawn once per theme in world space, blurred, then mapped onto the tilted plane with one affine transform.
function buildGround(){
  const res = window.innerWidth < 700 ? 2.6 : 1.7;
  const gw = Math.ceil((GB.xMax - GB.xMin) / res), gh = Math.ceil((GB.yMax - GB.yMin) / res);
  const tx = x => (x - GB.xMin) / res, ty = y => (GB.yMax - y) / res;
  const path = pts => { const p = new Path2D(); pts.forEach((q,i) => i ? p.lineTo(tx(q[0]), ty(q[1])) : p.moveTo(tx(q[0]), ty(q[1]))); p.closePath(); return p; };
  const line = pts => { const p = new Path2D(); pts.forEach((q,i) => i ? p.lineTo(tx(q[0]), ty(q[1])) : p.moveTo(tx(q[0]), ty(q[1]))); return p; };
  const c = document.createElement('canvas'); c.width = gw; c.height = gh; const g = c.getContext('2d');
  const t = document.createElement('canvas'); t.width = gw; t.height = gh; const tg = t.getContext('2d');
  const waterP = path(WATER), parkPs = PARKS.map(p => path(p.p)), riverP = line(RIVER);
  const layer = (blur, draw) => { tg.clearRect(0,0,gw,gh); draw(tg); g.filter = blur ? 'blur(' + blur + 'px)' : 'none'; g.drawImage(t,0,0); g.filter = 'none'; };
  g.fillStyle = colors['map-land']; g.fillRect(0,0,gw,gh);
  // City fabric: seeded block-sized marks, denser toward the centre.
  layer(1.2 / res * 1.7, ctx2 => {
    const r = mulberry(1905); ctx2.fillStyle = rgba(colors['map-fabric'], .22);
    for (let i = 0; i < 9000; i++) {
      const x = GB.xMin + r() * (GB.xMax - GB.xMin), y = GB.yMin + r() * (GB.yMax - GB.yMin);
      const d = Math.hypot(x + 100, y - 300); if (r() > Math.exp(-d / 1700)) continue;
      const px = tx(x), py = ty(y);
      if (g.isPointInPath(waterP, px, py) || parkPs.some(p => g.isPointInPath(p, px, py))) continue;
      const ang = 0.35 * Math.sin(x / 650) + 0.25 * Math.cos(y / 820) - 0.3;
      const bw = (14 + r() * 34) / res, bh = (10 + r() * 26) / res;
      ctx2.save(); ctx2.translate(px, py); ctx2.rotate(ang); ctx2.fillRect(-bw/2, -bh/2, bw, bh); ctx2.restore();
    }
  });
  layer(10 / res * 1.7, ctx2 => { ctx2.fillStyle = colors['map-park']; parkPs.forEach(p => ctx2.fill(p)); });
  layer(14 / res * 1.7, ctx2 => {
    ctx2.fillStyle = colors['map-water']; ctx2.fill(waterP);
    ctx2.strokeStyle = colors['map-water']; ctx2.lineWidth = 26 / res; ctx2.lineCap = 'round'; ctx2.lineJoin = 'round'; ctx2.stroke(riverP);
  });
  layer(60 / res * 1.7, ctx2 => {
    ctx2.save(); ctx2.clip(waterP); ctx2.fillStyle = colors['map-water-deep'];
    ctx2.fillRect(0, ty(-200), gw, gh); ctx2.restore();
  });
  t.width = 0; t.height = 0;
  ground = {c, res};
}

function resize(){
  const r = cv.getBoundingClientRect(); DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = r.width; H = r.height; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); needs = true;
}
function trig(){ return {cr:Math.cos(cam.rot), sr:Math.sin(cam.rot), ct:Math.cos(cam.tilt), st:Math.sin(cam.tilt)}; }
function proj(x, y, z, T){
  const dx = x - cam.cx, dy = y - cam.cy;
  const rx = dx * T.cr - dy * T.sr, ry = dx * T.sr + dy * T.cr;
  return [W/2 + cam.ox + rx * cam.s, H/2 + cam.oy - ry * cam.s * T.ct - (z || 0) * cam.s * T.st, ry];
}
function unproj(sx, sy){
  const T = trig();
  const rx = (sx - W/2 - cam.ox) / cam.s, ry = -(sy - H/2 - cam.oy) / (cam.s * T.ct);
  return [cam.cx + T.cr * rx + T.sr * ry, cam.cy - T.sr * rx + T.cr * ry];
}

function corners(b){ const hw = b.w/2, hd = b.d/2; return [[b.x-hw,b.y-hd],[b.x+hw,b.y-hd],[b.x+hw,b.y+hd],[b.x-hw,b.y+hd]]; }
function buildingColors(b, on){
  if (b.kind === 'storting') return {side: rgba(colors.accent, on ? .95 : .78), top: rgba(colors.accent, 1), glow: colors.accent};
  if (b.kind === 'inst') return {side: colors['b-inst'], top: colors['b-inst-top'], glow: colors['b-inst-top']};
  return {side: colors['b-min'], top: colors['b-min-top'], glow: colors['b-min-top']};
}

function draw(){
  const T = trig(); const d = DPR;
  ctx.setTransform(d,0,0,d,0,0);
  ctx.fillStyle = colors['map-haze']; ctx.fillRect(0,0,W,H);
  // ground
  if (ground) {
    const res = ground.res, s = cam.s;
    const a = s * T.cr * res, c = s * T.sr * res;
    const e = s * T.cr * (GB.xMin - cam.cx) - s * T.sr * (GB.yMax - cam.cy) + W/2 + cam.ox;
    const b = -s * T.ct * T.sr * res, dd = s * T.ct * T.cr * res;
    const f = -s * T.ct * (T.sr * (GB.xMin - cam.cx) + T.cr * (GB.yMax - cam.cy)) + H/2 + cam.oy;
    ctx.setTransform(a*d, b*d, c*d, dd*d, e*d, f*d);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(ground.c, 0, 0);
    ctx.setTransform(d,0,0,d,0,0);
  }
  // streets
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const zoomK = Math.max(.55, Math.min(2.2, cam.s / .7));
  STREETS.forEach(st => {
    ctx.beginPath(); st.p.forEach((q,i) => { const p = proj(q[0], q[1], 0, T); i ? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1]); });
    ctx.strokeStyle = rgba(colors['map-street'], .22); ctx.lineWidth = st.w * 3.2 * zoomK; ctx.stroke();
    ctx.strokeStyle = rgba(colors['map-street'], .75); ctx.lineWidth = st.w * .8 * zoomK; ctx.stroke();
  });
  // shoreline
  ctx.beginPath(); WATER.slice(0, 28).forEach((q,i) => { const p = proj(q[0], q[1], 0, T); i ? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1]); });
  ctx.strokeStyle = rgba(colors['map-shore'], .35); ctx.lineWidth = 1; ctx.stroke();
  // area labels
  ctx.font = 'italic 12px ' + getFont('body'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  AREA_LABELS.forEach(l => { const [x,y] = XY(l.ll[0], l.ll[1]); const p = proj(x, y, 0, T); ctx.fillStyle = rgba(colors['map-label'], .75); ctx.fillText(l.t, p[0], p[1]); });
  // horizon haze in 3D
  if (cam.tilt > .05) {
    const hz = ctx.createLinearGradient(0, 0, 0, H * .55);
    hz.addColorStop(0, rgba(colors['map-haze'], .96 * Math.min(1, cam.tilt / .9))); hz.addColorStop(1, rgba(colors['map-haze'], 0));
    ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H * .55);
  }
  // building halos
  const order = BUILD.slice().sort((a,b) => proj(b.x,b.y,0,T)[2] - proj(a.x,a.y,0,T)[2]);
  order.forEach(b => {
    const on = b.id === selected || b.id === hovered; const p = proj(b.x, b.y, 0, T);
    const r = Math.max(26, 95 * cam.s) * (on ? 1.35 : 1);
    const gr = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
    const col = buildingColors(b, on).glow;
    gr.addColorStop(0, rgba(col, on ? .55 : .26)); gr.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = gr; ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(1, Math.max(.35, T.ct)); ctx.translate(-p[0], -p[1]);
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI*2); ctx.fill(); ctx.restore();
  });
  // selection pulse ring
  if (selected) {
    const b = BID[selected], p = proj(b.x, b.y, 0, T), k = (pulse % 1);
    ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(1, Math.max(.3, T.ct));
    ctx.strokeStyle = rgba(colors.accent, .55 * (1 - k)); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, (30 + 80 * k) * Math.max(.6, cam.s), 0, Math.PI*2); ctx.stroke(); ctx.restore();
  }
  // buildings
  const hits = [];
  order.forEach(b => {
    const on = b.id === selected || b.id === hovered; const col = buildingColors(b, on);
    const cs = corners(b), z = b.h * (mode3d ? 1 : 0) * Math.min(1, cam.tilt / .3);
    const base = cs.map(q => proj(q[0], q[1], 0, T)), top = cs.map(q => proj(q[0], q[1], z, T));
    const minPx = 7; // keep tiny buildings visible when zoomed out
    const pc = proj(b.x, b.y, z, T);
    const scaleFix = Math.max(1, minPx / Math.max(4, b.w * cam.s));
    const B = scaleFix > 1 ? base.map(p => { const c0 = proj(b.x,b.y,0,T); return [c0[0] + (p[0]-c0[0])*scaleFix, c0[1] + (p[1]-c0[1])*scaleFix]; }) : base;
    const TT = scaleFix > 1 ? top.map(p => [pc[0] + (p[0]-pc[0])*scaleFix, pc[1] + (p[1]-pc[1])*scaleFix]) : top;
    if (on) { ctx.shadowColor = rgba(col.glow, .9); ctx.shadowBlur = 22; }
    // side faces facing the viewer
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4; const ex = cs[j][0] - cs[i][0], ey = cs[j][1] - cs[i][1];
      const nx = ey, ny = -ex; // outward normal for counter-clockwise footprint
      const nry = nx * T.sr + ny * T.cr; if (nry >= 0 || z <= 0.01) continue;
      const nrx = nx * T.cr - ny * T.sr; const shade = .78 + .22 * (nrx / Math.hypot(nrx, nry));
      ctx.beginPath(); ctx.moveTo(B[i][0], B[i][1]); ctx.lineTo(B[j][0], B[j][1]); ctx.lineTo(TT[j][0], TT[j][1]); ctx.lineTo(TT[i][0], TT[i][1]); ctx.closePath();
      ctx.fillStyle = col.side; ctx.globalAlpha = shade; ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.beginPath(); TT.forEach((p,i) => i ? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1])); ctx.closePath();
    ctx.fillStyle = col.top; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(colors.surface, on ? .9 : .45); ctx.lineWidth = on ? 1.4 : .8; ctx.stroke();
    const xs = B.concat(TT).map(p => p[0]), ys = B.concat(TT).map(p => p[1]);
    b._top = [pc[0], Math.min.apply(null, TT.map(p => p[1]))];
    hits.push({id:b.id, x0:Math.min.apply(null,xs)-6, x1:Math.max.apply(null,xs)+6, y0:Math.min.apply(null,ys)-6, y1:Math.max.apply(null,ys)+6});
  });
  // links from the selected ministry
  if (selected && selOcc && MIN[selOcc]) {
    const from = BID[HOME[selOcc]]; const targets = [];
    (MIN[selOcc].related || []).forEach(r => { if (HOME[r] && HOME[r] !== from.id) targets.push({b:BID[HOME[r]], t:MIN[r].abbr}); });
    targets.push({b:BID.stortinget, t:'Stortinget', storting:true});
    const t0 = reduce ? 0 : -pulse * 40;
    targets.forEach(tg => {
      const a = from._top, z = tg.b._top; if (!a || !z) return;
      const mx = (a[0] + z[0]) / 2, my = Math.min(a[1], z[1]) - Math.max(40, Math.hypot(z[0]-a[0], z[1]-a[1]) * .38);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mx, my, z[0], z[1]);
      ctx.setLineDash(tg.storting ? [2, 6] : [7, 6]); ctx.lineDashOffset = t0;
      ctx.strokeStyle = rgba(colors['b-link'], tg.storting ? .75 : .9); ctx.lineWidth = 1.8; ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = colors['b-link']; ctx.beginPath(); ctx.arc(z[0], z[1], 3, 0, Math.PI*2); ctx.fill();
    });
  }
  // labels with simple collision avoidance
  const boxes = [];
  const pri = BUILD.slice().sort((a,b) => (b.id === selected) - (a.id === selected) || (b.id === hovered) - (a.id === hovered) || (b.kind === 'storting') - (a.kind === 'storting') || b.occ.length - a.occ.length);
  pri.forEach(b => {
    if (!b._top) return;
    const txt = b.kind === 'min' ? b.occ.map(o => MIN[o].abbr).join(' · ') : b.label;
    const on = b.id === selected || b.id === hovered;
    ctx.font = (on ? '600 ' : '500 ') + '11.5px ' + getFont('mono');
    const w = ctx.measureText(txt).width + 12, h = 20, x = b._top[0] - w/2, y = b._top[1] - h - 8;
    if (!on && boxes.some(q => x < q[2] && x + w > q[0] && y < q[3] && y + h > q[1])) return;
    boxes.push([x, y, x + w, y + h]);
    ctx.fillStyle = on ? colors.ink : rgba(colors.surface, .88);
    roundRect(x, y, w, h, 6); ctx.fill();
    if (!on) { ctx.strokeStyle = rgba(colors.ink, .12); ctx.lineWidth = 1; ctx.stroke(); }
    ctx.fillStyle = on ? colors.bg : (b.kind === 'storting' ? colors.accent : colors.ink);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, b._top[0], y + h/2 + .5);
    hits.push({id:b.id, x0:x, x1:x+w, y0:y, y1:y+h, label:true});
  });
  window.__hits = hits;
}
function roundRect(x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r); ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath(); }
const FONTS = {body:"'Public Sans', system-ui, sans-serif", mono:"'IBM Plex Mono', ui-monospace, monospace"};
const getFont = k => FONTS[k];

function hitTest(px, py){
  const hs = window.__hits || []; let best = null;
  for (let i = hs.length - 1; i >= 0; i--) { const h = hs[i]; if (px >= h.x0 && px <= h.x1 && py >= h.y0 && py <= h.y1) { if (h.label) return h.id; if (!best) best = h.id; } }
  return best;
}

// camera animation
const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
function flyTo(target, ms){
  const from = Object.assign({}, cam); const t0 = performance.now(); const dur = reduce ? 0 : (ms || 900);
  animT = {from, target, t0, dur};
  loop();
}
function step(now){
  if (animT) {
    const k = animT.dur ? Math.min(1, (now - animT.t0) / animT.dur) : 1, e = ease(k);
    for (const key in animT.target) cam[key] = animT.from[key] + (animT.target[key] - animT.from[key]) * e;
    if (k >= 1) animT = null; needs = true;
  }
}
let looping = false;
function loop(){
  if (looping) return; looping = true;
  const tick = now => {
    step(now);
    if (selected && !reduce) { pulse = (now / 2200); needs = true; }
    if (needs && !document.getElementById('view-kart').hidden) { draw(); needs = false; }
    if (animT || (selected && !reduce)) requestAnimationFrame(tick); else looping = false;
  };
  requestAnimationFrame(tick);
}
function request(){ needs = true; loop(); }

function isNarrow(){ return W < 760; }
let panelState = 'closed', preferMini = store('innsyn.panel') === 'mini', listOpen = null, secTab = 'oversikt';
const $ = id => document.getElementById(id);
const CONTACTS = (D.contacts && D.contacts.contacts) || {};
const RIGHTS = (D.contacts && D.contacts.rights) || {};

function overview(){
  const xs = BUILD.map(b => b.x), ys = BUILD.map(b => b.y);
  const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  const tilt = mode3d ? .92 : 0, rot = mode3d ? -.28 : 0;
  const leftPad = (!isNarrow() && listOpen) ? 330 : 0;
  const avW = W - leftPad - 60, avH = H - 150;
  const span = Math.max((x1 - x0) * 1.05, 400), spanY = Math.max((y1 - y0) * 1.05, 400);
  const s = Math.max(.18, Math.min(avW / span, avH / (spanY * Math.cos(tilt) + 60)));
  return {cx:(x0 + x1)/2 + 40, cy:(y0 + y1)/2 + (mode3d ? 120 : 0), s, tilt, rot, ox: leftPad/2, oy: 36};
}
function focusOn(b){
  const narrow = isNarrow(), mini = panelState === 'mini';
  let ox = 0, oy = 30;
  if (narrow) oy = mini ? -H * .14 : -H * .3;
  else { ox = mini ? -80 : -210; oy = mini ? 80 : 30; }
  return {cx:b.x, cy:b.y, s:Math.max(cam.s, narrow ? 1.6 : 2.1), tilt: mode3d ? .95 : 0, rot: mode3d ? -.28 : 0, ox, oy};
}

/* panel */
const panel = $('panel');
function setPanel(state){
  panelState = state;
  panel.classList.toggle('closed', state === 'closed');
  panel.classList.toggle('mini', state === 'mini');
  panel.setAttribute('aria-hidden', state === 'closed');
  const mb = $('pMin'); const isMini = state === 'mini';
  mb.textContent = isMini ? '⤢' : '–'; mb.title = isMini ? 'Utvid' : 'Minimer'; mb.setAttribute('aria-label', isMini ? 'Utvid panelet' : 'Minimer panelet');
}
function openBuilding(id, occ, fly){
  const b = BID[id]; if (!b) return;
  selected = id; selOcc = occ && b.occ.includes(occ) ? occ : b.occ[0];
  if (listOpen) setList(null, true);
  setPanel(preferMini ? 'mini' : 'full');
  if (fly !== false) flyTo(focusOn(b));
  renderPanel(); renderList(); request();
}
function closePanel(){
  selected = null; selOcc = null; setPanel('closed');
  flyTo(overview()); renderList(); request();
}
function toggleMini(){
  if (panelState === 'closed') return;
  preferMini = panelState !== 'mini'; store('innsyn.panel', preferMini ? 'mini' : 'full');
  setPanel(preferMini ? 'mini' : 'full'); flyTo(focusOn(BID[selected]), 500);
}
function minCases(id){
  const coms = COMMITTEE_FOR[id] || [];
  const own = CASES.filter(c => c.ministry === id);
  const com = CASES.filter(c => c.ministry !== id && coms.includes(c.committee));
  return {own, com, coms};
}
function occName(o){ return MIN[o] ? MIN[o].name : (INST[o] || {}).name || ''; }
function rightsKey(o){ return MIN[o] ? 'departement' : o; }
function sectionsFor(o){
  if (MIN[o]) { const mc = minCases(o); return [['oversikt','Oversikt'],['saker','Saker', mc.own.length],['nytt','Nytt', MIN[o].news.length],['rettigheter','Dine rettigheter', (RIGHTS.departement || []).length]]; }
  const s = [['oversikt','Oversikt']];
  if (o === 'storting') s.push(['saker','Saker', CASES.filter(c => c.session === S.session).length]);
  s.push(['rettigheter','Dine rettigheter', (RIGHTS[o] || []).length]);
  return s;
}
function renderPanel(){
  const b = BID[selected], o = selOcc;
  const kind = b.kind === 'min' ? 'Departementsbygg' : (b.kind === 'storting' ? 'Nasjonalforsamlingen' : 'Institusjon');
  $('pEyebrow').textContent = kind + (b.occ.length > 1 ? ' · ' + b.occ.length + ' departementer' : '');
  $('pTitle').textContent = b.name;
  $('pSub').textContent = b.sub;
  const tabs = $('pTabs');
  if (b.occ.length > 1) {
    tabs.hidden = false;
    tabs.innerHTML = b.occ.map(x => '<button type="button" role="tab" data-occ="' + x + '" aria-selected="' + (x === o) + '" title="' + esc(occName(x)) + '">' + esc(MIN[x] ? MIN[x].abbr : occName(x)) + '</button>').join('');
  } else tabs.hidden = true;
  $('pQuick').innerHTML = quickHTML(o);
  const secs = sectionsFor(o);
  if (!secs.some(s => s[0] === secTab)) secTab = 'oversikt';
  $('pSecTabs').innerHTML = secs.map(s => '<button type="button" role="tab" data-sec="' + s[0] + '" aria-selected="' + (s[0] === secTab) + '">' + s[1] + (s[2] != null ? '<span class="n">' + s[2] + '</span>' : '') + '</button>').join('');
  $('pBody').innerHTML = sectionHTML(o, secTab);
  $('pBody').scrollTop = 0;
}

/* contact quick buttons */
function quickHTML(o){
  const C = CONTACTS[o] || {}; const b = BID[HOME[o]];
  const tile = (label, val) => '<button type="button" class="qt" data-copy="' + esc(val) + '" data-what="' + esc(label) + '" title="Kopier ' + esc(label.toLowerCase()) + ': ' + esc(val) + '"><span class="eyebrow">' + esc(label) + '<span aria-hidden="true">Kopier</span></span><span class="v">' + esc(val) + '</span></button>';
  let h = '<div class="qhead eyebrow"><span>Kontakt</span><b>' + esc(occName(o)) + '</b></div>';
  const tiles = [];
  if (C.visit) tiles.push(tile('Besøk', C.visit));
  if (C.post) tiles.push(tile('Post', C.post));
  if (C.phone) tiles.push(tile('Telefon', C.phone));
  if (C.email) tiles.push(tile('E-post', C.email));
  h += tiles.join('');
  if (!tiles.length && C.note) h += '<div class="qnote">' + esc(C.note) + '</div>';
  const links = [];
  links.push('<a href="https://www.google.com/maps/dir/?api=1&destination=' + b.lat + ',' + b.lng + '" target="_blank" rel="noopener">Veibeskrivelse ↗</a>');
  if (C.phone) links.push('<a href="tel:+47' + C.phone.replace(/\s/g, '') + '">Ring ' + esc(C.phone) + '</a>');
  if (C.contactUrl) links.push('<a href="' + esc(C.contactUrl) + '" target="_blank" rel="noopener">Kontaktside ↗</a>');
  h += '<div class="qlinks">' + links.join('') + '</div>';
  if (C.hours) h += '<div class="qnote hours">Åpningstid: ' + esc(C.hours) + '</div>';
  return h;
}
function contactDetail(o){
  const C = CONTACTS[o]; if (!C) return '';
  const row = (k, v) => v ? '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>' : '';
  const dl = row('Besøksadresse', C.visit) + row('Postadresse', C.post) + row('Telefon', C.phone) + row('E-post', C.email) + row('Åpningstid', C.hours);
  return '<div class="sec"><span class="eyebrow">Kontakt</span>' + (dl ? '<dl class="kv">' + dl + '</dl>' : '') + (C.note ? '<p class="small muted" style="margin:0">' + esc(C.note) + '</p>' : '') + '</div>';
}
function rightsHTML(o){
  const list = RIGHTS[rightsKey(o)] || [];
  if (!list.length) return '<p class="muted small">Ingen rettigheter registrert for dette stedet.</p>';
  const intro = MIN[o] ? 'Dette gjelder alle departementer, også ' + esc(MIN[o].name) + '.' : 'Dette kan du som borger gjøre hos ' + esc(occName(o)) + '.';
  return '<p class="small muted" style="margin:0">' + intro + '</p><ul class="rights">' + list.map(r => '<li class="right"><span>' + esc(r.text) + '</span><span class="row"><span class="basis">' + esc(r.basis || 'Praksis, ikke lovfestet') + '</span>' + (r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">Bruk retten ↗</a>' : '') + '</span></li>').join('') + '</ul>';
}
function caseRow(c){
  return '<a class="mini-case" href="' + esc(c.url) + '" target="_blank" rel="noopener"><span class="st ' + c.status + '">' + STATUS[c.status] + '</span><span>' + esc(c.title) + '<br><span class="muted small mono">' + esc((c.reference || '').split(';')[0]) + '</span></span></a>';
}
function sectionHTML(o, sec){
  if (sec === 'rettigheter') return rightsHTML(o);
  if (MIN[o]) {
    const m = MIN[o];
    if (sec === 'nytt') return m.news.length ? '<div class="nlist">' + m.news.map(n => '<a href="' + esc(n.url) + '" target="_blank" rel="noopener"><time class="mono">' + fmtDate(n.date) + '</time><span>' + esc(n.title) + '</span></a>').join('') + '</div><a class="small" href="' + esc(m.url) + '" target="_blank" rel="noopener">Flere nyheter på regjeringen.no ↗</a>' : '<p class="muted small">Ingen nyheter hentet.</p>';
    if (sec === 'saker') {
      const mc = minCases(m.id); let h = '';
      if (mc.own.length) h += '<p class="small muted" style="margin:0">' + mc.own.length + ' sak' + (mc.own.length > 1 ? 'er' : '') + ' lagt fram av departementet:</p><div class="mini-cases">' + mc.own.slice(0, 8).map(caseRow).join('') + '</div>';
      else h += '<p class="small muted" style="margin:0">Ingen saker registrert fra departementet i perioden vi har hentet.</p>';
      if (mc.coms.length) h += '<p class="small muted" style="margin:0">Fagkomité: <b style="color:var(--ink)">' + esc(mc.coms.join(', ')) + '</b> · ' + mc.com.length + ' andre saker der, blant annet fra partiene.</p>';
      return h + '<button type="button" class="btn" data-goto-min="' + m.id + '">Se alle saker for ' + esc(m.abbr) + ' →</button>';
    }
    let h = '<div class="dossier-title"><span class="eyebrow">' + esc(m.abbr) + '</span><h3>' + esc(m.name) + '</h3><span class="en">' + esc(m.nameEn) + '</span></div>';
    h += '<div class="sec"><span class="eyebrow">Statsråd' + (m.ministers.length > 1 ? 'er' : '') + '</span><div class="ministers">' + m.ministers.map(x => '<div class="minister"><div><strong>' + esc(x.name) + '</strong><small>' + esc(x.title) + '</small></div>' + partyChip(x.party) + '</div>').join('') + '</div></div>';
    h += '<div class="sec"><span class="eyebrow">Ansvarsområder</span><div class="chips">' + m.areas.map(a => '<span class="chip">' + esc(a) + '</span>').join('') + '</div></div>';
    h += '<div class="sec"><span class="eyebrow">Koblinger</span><p class="small muted" style="margin:0">Departementer med overlappende ansvar. Linjene på kartet viser hvor de sitter.</p><div class="rel">' + (m.related || []).filter(r => MIN[r]).map(r => '<button type="button" data-rel="' + r + '"><span class="abbr" style="pointer-events:none">' + esc(MIN[r].abbr) + '</span>' + esc(MIN[r].name) + '<small>' + esc(BID[HOME[r]].name) + '</small></button>').join('') + '</div></div>';
    h += contactDetail(o);
    return h + '<a class="small" href="' + esc(m.url) + '" target="_blank" rel="noopener">' + esc(m.name) + ' på regjeringen.no ↗</a>';
  }
  const i = INST[o];
  if (sec === 'saker' && o === 'storting') {
    const cnt = k => CASES.filter(c => c.status === k && c.session === S.session).length;
    const recent = CASES.filter(c => c.session === S.session).sort((a,b) => (b.updated || '').localeCompare(a.updated || '')).slice(0, 6);
    return '<div class="chips">' + ['mottatt','til_behandling','behandlet'].map(k => '<span class="chip"><span class="mono">' + cnt(k) + '</span> ' + STATUS[k].toLowerCase() + '</span>').join('') + '</div><div class="mini-cases">' + recent.map(caseRow).join('') + '</div><button type="button" class="btn" data-goto-saker="1">Åpne hele sakslisten →</button>';
  }
  let h = '<div class="dossier-title"><h3>' + esc(i.name) + '</h3></div><p style="margin:0">' + esc(i.role) + '</p>';
  if (o === 'storting') h += '<div class="sec"><span class="eyebrow">Setefordeling</span>' + seatHTML() + '</div>';
  h += contactDetail(o);
  if (i.url) h += '<a class="small" href="' + esc(i.url) + '" target="_blank" rel="noopener">' + esc(i.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) + ' ↗</a>';
  return h;
}
function seatHTML(){
  const total = S.parties.reduce((a,p) => a + p.seats, 0), maj = Math.floor(total / 2) + 1;
  let h = '<div class="seat-wrap"><div class="seats" role="img" aria-label="Setefordeling">' + S.parties.map(p => '<span title="' + esc(p.name + ': ' + p.seats) + '" style="width:' + (p.seats / total * 100) + '%;background:' + (PARTY_COLORS[p.party] || '#777') + '"></span>').join('') + '</div>';
  h += '<div class="majority" style="left:' + (maj / total * 100) + '%"><em>' + maj + ' = flertall</em></div></div>';
  h += '<div class="seat-legend">' + S.parties.map(p => '<span><i style="background:' + (PARTY_COLORS[p.party] || '#777') + '"></i>' + esc(p.party) + ' <span class="mono">' + p.seats + '</span></span>').join('') + '</div>';
  h += '<p class="small muted" style="margin:10px 0 0">Regjeringen (Ap) har ' + S.parties[0].seats + ' av ' + total + ' seter og må få med andre partier for å få flertall.</p>';
  return h;
}

/* copy + toast */
let toastT = null;
function toast(msg, manual){
  let t = $('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.toggle('manual', !!manual); t.hidden = false;
  if (manual) { try { const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch(e) {} }
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, manual ? 6000 : 1800);
}
function copyText(text, what){
  try {
    navigator.clipboard.writeText(text).then(() => toast(what + ' kopiert'), () => toast(text, true));
  } catch(e) { toast(text, true); }
}

/* left dock */
function setList(which, silent){
  listOpen = which;
  $('dockList').hidden = !which;
  document.querySelectorAll('.dock-tabs button').forEach(b => b.setAttribute('aria-expanded', b.dataset.lt === which));
  panel.classList.toggle('tuck', isNarrow() && !!which);
  if (which) { $('listTitle').textContent = which === 'bygg' ? 'Alle bygg' : 'Siste fra regjeringen'; renderList(); }
  if (!silent && !selected) flyTo(overview(), 500);
}
function renderList(){
  if (!listOpen) return;
  const body = $('listBody');
  if (listOpen === 'bygg') {
    const grp = (title, ids) => '<div class="grp eyebrow">' + title + '</div>' + ids.map(id => { const b = BID[id];
      const who = b.kind === 'min' ? b.occ.map(o => MIN[o].abbr).join(' · ') : b.sub;
      return '<button type="button" class="bitem' + (id === selected ? ' on' : '') + '" data-b="' + id + '"><span class="dot ' + b.kind + '"></span><span><strong>' + esc(b.name) + '</strong><small>' + esc(who) + '</small></span></button>'; }).join('');
    body.innerHTML = grp('Regjeringskvartalet', ['hoyblokka','ablokka','dblokka','r5','r6','akersgata40','akersgata64']) + grp('Andre departementer', ['kirkegata18','glacisgata']) + grp('Stortinget og institusjoner', ['stortinget','slottet','hoyesterett','statsministerboligen','riksrevisjonen','sivilombudet','radhus']);
  } else {
    const all = []; G.ministries.forEach(m => m.news.forEach(n => all.push(Object.assign({m}, n))));
    all.sort((a,b) => b.date.localeCompare(a.date));
    body.innerHTML = all.slice(0, 24).map(n => '<div class="news-item"><button type="button" class="abbr" data-min="' + n.m.id + '" title="' + esc(n.m.name) + '">' + esc(n.m.abbr) + '</button><a href="' + esc(n.url) + '" target="_blank" rel="noopener">' + esc(n.title) + '</a><time class="mono">' + fmtDate(n.date, true) + '</time></div>').join('');
  }
}

/* map interaction */
const ptrs = new Map(); let drag = null, moved = false, pinch0 = null;
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x:e.offsetX, y:e.offsetY});
  moved = false; animT = null;
  if (ptrs.size === 1) drag = {x:e.offsetX, y:e.offsetY};
  if (ptrs.size === 2) { const [a,b] = [...ptrs.values()]; pinch0 = {d:Math.hypot(a.x-b.x, a.y-b.y), s:cam.s}; }
});
cv.addEventListener('pointermove', e => {
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, {x:e.offsetX, y:e.offsetY});
  if (ptrs.size === 2 && pinch0) {
    const [a,b] = [...ptrs.values()]; const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
    zoomAt(mx, my, pinch0.s * Math.hypot(a.x-b.x, a.y-b.y) / pinch0.d / cam.s); moved = true; return;
  }
  if (drag) {
    const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) { moved = true; cv.classList.add('dragging'); }
    if (moved) {
      const T = trig(); const rx = -dx / cam.s, ry = dy / (cam.s * T.ct);
      cam.cx += T.cr * rx + T.sr * ry; cam.cy += -T.sr * rx + T.cr * ry;
      drag = {x:e.offsetX, y:e.offsetY}; request();
    }
    return;
  }
  const h = hitTest(e.offsetX, e.offsetY);
  if (h !== hovered) { hovered = h; cv.classList.toggle('hot', !!h); request(); }
});
function endPtr(e){
  ptrs.delete(e.pointerId); cv.classList.remove('dragging');
  if (ptrs.size < 2) pinch0 = null;
  if (drag && !moved && ptrs.size === 0) { const h = hitTest(e.offsetX, e.offsetY); if (h) openBuilding(h); }
  if (ptrs.size === 0) drag = null;
}
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('pointerleave', () => { if (hovered) { hovered = null; cv.classList.remove('hot'); request(); } });
function zoomAt(sx, sy, k){
  const before = unproj(sx, sy); cam.s = Math.max(.15, Math.min(5, cam.s * k)); const after = unproj(sx, sy);
  cam.cx += before[0] - after[0]; cam.cy += before[1] - after[1]; request();
}
cv.addEventListener('wheel', e => { e.preventDefault(); animT = null; zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * .0015)); }, {passive:false});
$('zin').onclick = () => zoomAt(W/2 + cam.ox, H/2 + cam.oy, 1.4);
$('zout').onclick = () => zoomAt(W/2 + cam.ox, H/2 + cam.oy, 1/1.4);
$('zreset').onclick = () => { if (selected) closePanel(); else flyTo(overview()); };
function setMode(is3d){
  mode3d = is3d; $('v3d').setAttribute('aria-pressed', is3d); $('v2d').setAttribute('aria-pressed', !is3d);
  flyTo(selected ? focusOn(BID[selected]) : overview(), 700); store('innsyn.mode', is3d ? '3d' : '2d');
}
$('v2d').onclick = () => setMode(false);
$('v3d').onclick = () => setMode(true);
$('pClose').onclick = e => { e.stopPropagation(); closePanel(); };
$('pMin').onclick = e => { e.stopPropagation(); toggleMini(); };
$('pHead').addEventListener('click', e => { if (panelState === 'mini' && !e.target.closest('button')) toggleMini(); });
$('listClose').onclick = () => setList(null);
document.querySelectorAll('.dock-tabs button').forEach(btn => btn.onclick = () => setList(listOpen === btn.dataset.lt ? null : btn.dataset.lt));
document.addEventListener('click', e => {
  const t = e.target.closest('[data-b],[data-min],[data-occ],[data-rel],[data-goto-min],[data-goto-saker],[data-map-min],[data-copy],[data-sec]'); if (!t) return;
  if (t.dataset.copy) { copyText(t.dataset.copy, t.dataset.what || 'Tekst'); }
  else if (t.dataset.sec) { secTab = t.dataset.sec; renderPanel(); }
  else if (t.dataset.b) { openBuilding(t.dataset.b); }
  else if (t.dataset.min) { openBuilding(HOME[t.dataset.min], t.dataset.min); }
  else if (t.dataset.occ) { selOcc = t.dataset.occ; renderPanel(); request(); }
  else if (t.dataset.rel) { const r = t.dataset.rel; if (HOME[r] === selected) { selOcc = r; renderPanel(); request(); } else openBuilding(HOME[r], r); }
  else if (t.dataset.gotoMin) { F.min = t.dataset.gotoMin; F.ses = 'all'; syncFilters(); go('saker'); window.scrollTo(0, $('filters').offsetTop - 70); }
  else if (t.dataset.gotoSaker) { go('saker'); }
  else if (t.dataset.mapMin) { go('kart'); openBuilding(HOME[t.dataset.mapMin], t.dataset.mapMin); }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || $('view-kart').hidden) return;
  if (listOpen) setList(null); else if (selected) closePanel();
});

/* ===================== CASES ===================== */
const F = {q:'', ses:'all', min:'all', com:'all', type:'all', watch:false};
document.getElementById('sesEyebrow').textContent = 'Stortinget · sesjonen ' + S.session.replace('-', '–');
document.getElementById('seatBox').innerHTML = seatHTML();

function deadlineOf(c){ const m = /innspill\s+(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s*kl\.\s*([\d:]+))?/i.exec(c.nextStep || ''); if (!m) return null; return {iso: m[3] + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0'), kl: m[4] || ''}; }
function renderDeadlines(){
  const list = CASES.map(c => ({c, d:deadlineOf(c)})).filter(x => x.d).sort((a,b) => a.d.iso.localeCompare(b.d.iso));
  const box = document.getElementById('deadlines');
  if (!list.length) { box.innerHTML = '<div class="empty">Ingen åpne frister i dataene.</div>'; return; }
  box.innerHTML = list.map(x => {
    const past = x.d.iso < TODAY, today = x.d.iso === TODAY;
    return '<div class="deadline"' + (past ? ' style="opacity:.55"' : '') + '><span class="when mono' + (today ? ' today' : '') + '">' + (today ? 'I dag' : fmtDate(x.d.iso)) + '<small>' + (past ? 'utløpt' : (x.d.kl ? 'kl. ' + esc(x.d.kl) : '')) + '</small></span><span><a href="' + esc(x.c.url) + '" target="_blank" rel="noopener">' + esc(x.c.title) + '</a><br><span class="small muted">' + esc(x.c.committee) + (x.c.proposer ? ' · forslag fra ' + esc(x.c.proposer.split(' (')[0]) : '') + '</span></span></div>';
  }).join('');
}
function renderBudget(){
  const B = S.budget || {}; document.getElementById('budgetLede').textContent = (B.proposition || '') + ' · lagt fram ' + fmtDate(B.presented, true) + (B.presentedBy ? ' av ' + B.presentedBy.charAt(0).toLowerCase() + B.presentedBy.slice(1) : '') + '.';
  const ev = (B.schedule || []).slice();
  let nowMarked = false;
  document.getElementById('budgetTl').innerHTML = ev.map(e => {
    let cls = ''; if (e.date && e.date < TODAY) cls = 'past'; else if (e.date && !nowMarked) { cls = 'now'; nowMarked = true; }
    return '<div class="tl ' + cls + '"><span class="d">' + (e.date ? (e.date === TODAY ? 'I dag' : fmtDate(e.date)) : 'Ikke fastsatt') + '</span><span>' + esc(e.event) + '</span></div>';
  }).join('') + (B.hearings && B.hearings.length ? '<details class="more" style="margin-top:8px"><summary>Budsjetthøringer i komiteene (' + B.hearings.length + ')</summary>' + B.hearings.map(hh => '<p><b>' + esc(hh.committee) + '</b> · <span class="mono small">' + esc(hh.dates) + '</span></p>').join('') + '</details>' : '');
}
function opt(v, t, cur){ return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(t) + '</option>'; }
function syncFilters(){
  const sessions = [...new Set(CASES.map(c => c.session).filter(Boolean))].sort().reverse();
  document.getElementById('fses').innerHTML = opt('all','Alle sesjoner',F.ses) + sessions.map(s => opt(s, 'Sesjon ' + s.replace('-', '–'), F.ses)).join('');
  document.getElementById('fmin').innerHTML = opt('all','Alle departementer',F.min) + G.ministries.map(m => opt(m.id, m.name, F.min)).join('');
  const coms = [...new Set(CASES.map(c => c.committee).filter(Boolean))].sort();
  document.getElementById('fcom').innerHTML = opt('all','Alle komiteer',F.com) + coms.map(c => opt(c, c, F.com)).join('');
  const types = [...new Set(CASES.map(c => c.docGroup).filter(Boolean))];
  document.getElementById('ftype').innerHTML = opt('all','Alle typer',F.type) + types.map(t => opt(t, DOCGROUP[t] || t, F.type)).join('');
  document.getElementById('fq').value = F.q;
  const w = document.getElementById('fwatch'); w.setAttribute('aria-pressed', F.watch); w.textContent = '★ Følger (' + watch.size + ')';
  renderCases();
}
function matches(c){
  if (F.ses !== 'all' && c.session !== F.ses) return false;
  if (F.min !== 'all' && !(c.ministry === F.min || (COMMITTEE_FOR[F.min] || []).includes(c.committee))) return false;
  if (F.com !== 'all' && c.committee !== F.com) return false;
  if (F.type !== 'all' && c.docGroup !== F.type) return false;
  if (F.watch && !watch.has(c.id)) return false;
  if (F.q) { const hay = [c.title, c.fullTitle, c.proposer, c.committee, c.reference, (c.topics || []).join(' '), MIN[c.ministry] ? MIN[c.ministry].name : ''].join(' ').toLowerCase(); if (!F.q.toLowerCase().split(/\s+/).every(w => hay.includes(w))) return false; }
  return true;
}
function voteHTML(c){
  if (!c.outcome) return '';
  const m = /(\d+)\s*for,\s*(\d+)\s*mot/.exec(c.outcome) || /loven[^.;]*?(\d+)\s*[–-]\s*(\d+)/i.exec(c.outcome);
  let bar = '';
  if (m) { const y = +m[1], n = +m[2]; bar = '<div class="vote"><div class="vote-bar"><span class="y" style="width:' + (y/(y+n)*100) + '%"></span><span class="n" style="width:' + (n/(y+n)*100) + '%"></span></div><small>' + y + ' for · ' + n + ' mot</small></div>'; }
  else if (/enstemmig/i.test(c.outcome)) bar = '<div class="vote"><div class="vote-bar"><span class="y" style="width:100%"></span></div><small>Enstemmig</small></div>';
  return bar + '<div class="outcome">' + esc(c.outcome) + '</div>';
}
const STAGE_NOW = {mottatt:'Nå: Saken er kommet inn og venter på komiteen.', til_behandling:'Nå: Komiteen jobber med saken.', behandlet:'Nå: Stortinget har behandlet saken og stemt.', varslet:'Nå: Saken er varslet, men ikke lagt fram ennå.'};
function actionsFor(c){
  const a = []; const dl = deadlineOf(c);
  if (dl && dl.iso >= TODAY) a.push({t:'Send skriftlig innspill før ' + (dl.iso === TODAY ? 'midnatt i dag' : fmtDate(dl.iso)) + (dl.kl && dl.iso !== TODAY ? ' kl. ' + dl.kl : ''), d:'Komiteen har bedt om innspill. Alle kan sende.', href:c.url, guide:'innspill'});
  const so = /saksordfører ([^;.]+)/i.exec(c.nextStep || '');
  if (c.status === 'til_behandling') a.push({t: so ? 'Skriv til saksordføreren: ' + so[1].trim() : 'Skriv til komiteen som behandler saken', d:'Saksordføreren leder arbeidet med saken i komiteen.', guide:'representant'});
  if (c.status === 'mottatt') a.push({t:'Følg saken', d:'Da finner du den igjen under «Følger» når den flytter seg.', star:true});
  if (c.status !== 'behandlet' && MIN[c.ministry]) a.push({t:'Be om innsyn i dokumentene hos ' + MIN[c.ministry].abbr, d:'Du kan be om dokumenter uten å si hvorfor.', guide:'innsyn'});
  if (c.status === 'behandlet') { a.push({t:'Se hvordan partiene stemte', d:'Voteringene ligger på saken hos Stortinget.', href:c.url}); a.push({t:'Si din mening om vedtaket', d:'Skriv til representantene fra fylket ditt.', guide:'representant'}); }
  if (c.status !== 'behandlet' && !(dl && dl.iso >= TODAY)) a.push({t:'Følg debatten fra tilhørerlosjen', d:'Stortingsmøtene er åpne. Ingen påmelding.', guide:'mote'});
  return a.slice(0, 3);
}
function caseCard(c){
  const m = MIN[c.ministry]; const dl = deadlineOf(c); const on = watch.has(c.id);
  let h = '<article class="case"><div class="ref"><span class="mono">' + esc((c.reference || '').split(';')[0] || c.id) + '</span><button type="button" class="star" data-watch="' + c.id + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Slutt å følge' : 'Følg saken') + '">' + (on ? '★' : '☆') + '</button></div>';
  h += '<h3>' + esc(c.title) + '</h3><div class="meta">';
  h += '<span>' + esc(DOCGROUP[c.docGroup] || c.docGroup) + '</span>';
  if (c.committee) h += '<span>· ' + esc(c.committee) + '</span>';
  if (m) h += '<button type="button" class="abbr" data-map-min="' + m.id + '" title="Vis ' + esc(m.name) + ' på kartet">' + esc(m.abbr) + '</button>';
  if (c.proposer) { const ps = c.proposer.split(' (')[0].split(/[,\s]+/).filter(p => PARTY_COLORS[p]); h += ps.map(partyChip).join(''); }
  h += '</div>';
  if (dl && dl.iso >= TODAY) h += '<span class="flag">Frist for innspill ' + (dl.iso === TODAY ? 'i dag' : fmtDate(dl.iso)) + (dl.kl ? ' kl. ' + esc(dl.kl) : '') + '</span>';
  if (c.status === 'behandlet') h += voteHTML(c);
  h += '<details class="more"><summary>Hva kan jeg gjøre? · Kilder</summary>';
  h += '<p class="now">' + esc(STAGE_NOW[c.status] || '') + '</p>';
  const acts = actionsFor(c);
  if (acts.length) h += '<div class="blk">Hva kan du gjøre</div><div class="acts">' + acts.map(a => '<div class="act"><b>' + esc(a.t) + '</b><span>' + esc(a.d) + '</span><span class="links">' + (a.guide ? '<button type="button" data-guide="' + a.guide + '">Slik gjør du det →</button>' : '') + (a.href ? '<a href="' + esc(a.href) + '" target="_blank" rel="noopener">Åpne saken ↗</a>' : '') + (a.star ? '<button type="button" data-watch="' + c.id + '">' + (watch.has(c.id) ? '★ Du følger saken' : '☆ Følg saken') + '</button>' : '') + '</span></div>').join('') + '</div>';
  h += '<div class="blk">Om saken</div>';
  if (c.fullTitle && c.fullTitle !== c.title) h += '<p>' + esc(c.fullTitle) + '</p>';
  if (c.nextStep) h += '<p><b>Videre:</b> ' + esc(c.nextStep) + '</p>';
  if (c.proposer) h += '<p><b>Forslagsstillere:</b> ' + esc(c.proposer) + '</p>';
  if (c.topics && c.topics.length) h += '<p class="small muted">Tema: ' + esc(c.topics.join(', ')) + '</p>';
  h += '<p class="small muted">Sist oppdatert ' + fmtDate(c.updated, true) + (c.decided ? ' · vedtatt ' + fmtDate(c.decided, true) : '') + '</p>';
  h += '<div class="blk">Kilder</div><ul class="srcs"><li><a href="' + esc(c.url) + '" target="_blank" rel="noopener">Saken på stortinget.no ↗</a></li><li><a href="https://data.stortinget.no/eksport/sak?sakid=' + esc(c.id) + '" target="_blank" rel="noopener">Stortingets åpne data for saken ↗</a></li>' + (MIN[c.ministry] ? '<li><a href="' + esc(MIN[c.ministry].url) + '" target="_blank" rel="noopener">' + esc(MIN[c.ministry].name) + ' på regjeringen.no ↗</a></li>' : '') + '</ul></details></article>';
  return h;
}
function renderCases(){
  const list = CASES.filter(matches).sort((a,b) => (b.decided || b.updated || '').localeCompare(a.decided || a.updated || ''));
  const cols = [['mottatt','Mottatt','Lagt fram, venter på komité'],['til_behandling','I komiteen','Høringer og innstilling'],['behandlet','Behandlet','Debattert og votert i salen']];
  document.getElementById('pipeline').innerHTML = cols.map(([k, t, sub]) => {
    const items = list.filter(c => c.status === k);
    return '<section class="col ' + k + '"><div class="col-head"><div><h2>' + t + '</h2><small>' + sub + '</small></div><span class="count">' + items.length + '</span></div>' + (items.length ? items.map(caseCard).join('') : '<div class="empty">Ingen saker med disse filtrene.</div>') + '</section>';
  }).join('');
  const af = document.getElementById('activeFilter');
  if (F.min !== 'all') { af.hidden = false; af.innerHTML = '<span class="muted">Viser saker lagt fram av <b style="color:var(--ink)">' + esc(MIN[F.min].name) + '</b> og saker i fagkomiteen.</span><button type="button" id="clearMin">Fjern</button>'; document.getElementById('clearMin').onclick = () => { F.min = 'all'; syncFilters(); }; }
  else af.hidden = true;
}
document.getElementById('fq').addEventListener('input', e => { F.q = e.target.value.trim(); renderCases(); });
['fses','fmin','fcom','ftype'].forEach(id => document.getElementById(id).addEventListener('change', e => { F[{fses:'ses',fmin:'min',fcom:'com',ftype:'type'}[id]] = e.target.value; renderCases(); }));
document.getElementById('fwatch').onclick = () => { F.watch = !F.watch; syncFilters(); };
document.addEventListener('click', e => {
  const s = e.target.closest('[data-watch]'); if (!s) return;
  const id = s.dataset.watch; watch.has(id) ? watch.delete(id) : watch.add(id); store('innsyn.watch', [...watch]);
  const on = watch.has(id);
  document.querySelectorAll('[data-watch="' + id + '"]').forEach(b => { if (b.classList.contains('star')) { b.setAttribute('aria-pressed', on); b.textContent = on ? '★' : '☆'; b.setAttribute('aria-label', on ? 'Slutt å følge' : 'Følg saken'); } else b.textContent = on ? '★ Du følger saken' : '☆ Følg saken'; });
  document.getElementById('fwatch').textContent = '★ Følger (' + watch.size + ')';
  if (F.watch) renderCases();
});

/* ===================== NYTT ===================== */
const NYTT_TYPES = [['ny','Nye saker','Ny sak','mottatt'],['status','Ny status','Ny status','til_behandling'],['vedtak','Vedtatt','Behandlet','behandlet'],['nyhet','Nyheter','Nyhet','nyhet']];
let nyttType = 'alle', nyttAll = false;
function nyttEvents(){
  const all = Array.isArray(D.nytt) ? D.nytt : [];
  const end = D.fetched || TODAY; const start = new Date(Date.parse(end) - 6 * 864e5).toISOString().slice(0, 10);
  return all.filter(e => e.d >= start && e.d <= end);
}
function renderNytt(){
  const ev = nyttEvents();
  const ran = D.status && D.status.ranAt ? new Date(D.status.ranAt) : null;
  $('nyttStamp').textContent = 'Oppdateres hver morgen' + (ran ? ' · sist ' + ran.toLocaleString('nb-NO', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Oslo'}) : '');
  const count = t => ev.filter(e => e.t === t).length;
  $('nyttFilter').innerHTML = '<button type="button" data-nytt="alle" aria-pressed="' + (nyttType === 'alle') + '">Alle<span class="mono">' + ev.length + '</span></button>' + NYTT_TYPES.map(([t, label]) => '<button type="button" data-nytt="' + t + '" aria-pressed="' + (nyttType === t) + '"' + (count(t) ? '' : ' disabled') + '>' + label + '<span class="mono">' + count(t) + '</span></button>').join('');
  const list = ev.filter(e => nyttType === 'alle' || e.t === nyttType);
  if (!list.length) {
    $('nyttList').innerHTML = '<li style="display:block;color:var(--muted)">' + (Array.isArray(D.nytt) ? 'Ingen endringer registrert de siste 7 dagene.' : 'Endringer vises her fra neste morgen, når den daglige oppdateringen har kjørt.') + '</li>';
    $('nyttMore').hidden = true; return;
  }
  const shown = nyttAll ? list : list.slice(0, 8);
  $('nyttList').innerHTML = shown.map(e => {
    const T = NYTT_TYPES.find(x => x[0] === e.t) || NYTT_TYPES[0];
    const m = MIN[e.ministry];
    let sub = '';
    if (e.t === 'status') sub = (STATUS[e.from] || e.from) + ' → ' + (STATUS[e.to] || e.to) + (e.committee ? ' · ' + e.committee : '');
    else if (e.t === 'vedtak') sub = e.outcome || (e.committee || '');
    else if (e.t === 'ny') sub = (STATUS[e.status] || '') + (e.committee ? ' · ' + e.committee : '');
    else if (m) sub = m.name;
    const link = e.t === 'nyhet' ? e.url : (e.url || ('https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=' + e.id));
    return '<li><time>' + fmtDate(e.d) + '</time><span><span class="st ' + T[3] + '">' + T[2] + '</span></span><div><a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(e.title) + '</a>' + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '')  + '</div></li>';
  }).join('');
  $('nyttMore').hidden = list.length <= 8;
  $('nyttMore').textContent = nyttAll ? 'Vis færre' : 'Vis alle ' + list.length;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-nytt]'); if (b) { nyttType = b.dataset.nytt; nyttAll = false; renderNytt(); return; }
  if (e.target.closest('#nyttMore')) { nyttAll = !nyttAll; renderNytt(); }
});

/* ===================== TEMA ===================== */
const TEMA = (D.tema && Array.isArray(D.tema.tema)) ? D.tema : null;
const TALL = TEMA && TEMA.tall ? TEMA.tall : null;
const TID = {}; if (TEMA) TEMA.tema.forEach(t => TID[t.id] = t);
const STATUS_ORDER = {til_behandling:0, mottatt:1, varslet:2, behandlet:3};
function temaCases(t){
  const m = t.match || {}; let re = null; try { re = m.words ? new RegExp(m.words, 'i') : null; } catch(e) {}
  return CASES.filter(c => (m.committees || []).includes(c.committee) || (m.ministries || []).includes(c.ministry) || (re && re.test([c.title, c.fullTitle, (c.topics || []).join(' ')].join(' '))))
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || (b.updated || '').localeCompare(a.updated || ''));
}
function actionUrl(a){
  if (!a.check) return a.url;
  const c = TALL && TALL.checks && TALL.checks[a.check];
  return c && c.ok ? c.url : (a.check === 'klage-helse' || a.check === 'bekymring' ? a.url : '');
}
const temaStats = id => TALL ? (TALL.stats || []).filter(s => s.tema === id && s.series && s.series.length && s.series[0].points.length) : [];
const temaVotes = id => TALL ? (TALL.votes || []).filter(v => v.tema === id && v.check !== false) : [];
function helpFor(t){
  if (!TEMA || !t.help) return [];
  return t.help.map(id => { const h = TEMA.help && TEMA.help[id]; const c = TALL && TALL.checks && TALL.checks[id]; return h && c && c.ok ? Object.assign({}, h, {url: h.link || c.url || h.url}) : null; }).filter(Boolean);
}
const nf = (v, unit) => { if (v == null) return ''; const d = Math.abs(v) < 10 && v % 1 ? 1 : 0; return v.toLocaleString('nb-NO', {maximumFractionDigits: d, minimumFractionDigits: 0}); };

const isTotal = n => /^(i alt|alle|totalt?)\b/i.test(String(n).trim());
function hbarSVG(st){
  const hasLevels = st.series.some(s => s.level != null);
  const rows = [];
  st.series.forEach(s => {
    if (!s.points.length || isTotal(s.name) || s.level === 0) return;
    const v = s.points[s.points.length - 1].y;
    if (!v && s.level === 2) return;
    if (hasLevels && s.level === 1) rows.push({head: true, name: s.name, v});
    else rows.push({name: s.name, v});
  });
  const bars = rows.filter(r => !r.head), max = Math.max(...bars.map(r => r.v), 1);
  const W = window.innerWidth < 600 ? 380 : 640, labelW = window.innerWidth < 600 ? 190 : 280, rowH = 28, headH = 30;
  let y = 4, g = '';
  rows.forEach(r => {
    if (r.head) { g += '<text x="0" y="' + (y + 20) + '" font-size="13" font-weight="600" fill="var(--ink)">' + esc(r.name) + ' <tspan fill="var(--muted)" font-weight="400" font-family="IBM Plex Mono, monospace" font-size="12">' + nf(r.v) + '</tspan></text>'; y += headH; return; }
    const w = Math.max(2, (W - labelW - 70) * r.v / max);
    g += '<text x="' + (hasLevels ? 12 : 0) + '" y="' + (y + 17) + '" font-size="12.5" fill="var(--ink)">' + esc(r.name.length > (W < 500 ? 26 : 42) ? r.name.slice(0, W < 500 ? 25 : 41) + '…' : r.name) + '</text>';
    g += '<rect x="' + labelW + '" y="' + (y + 5) + '" width="' + w + '" height="16" rx="2" fill="var(--data)" fill-opacity="' + (r.v === max ? 1 : .55) + '"><title>' + esc(r.name + ': ' + nf(r.v) + ' ' + st.unit) + '</title></rect>';
    g += '<text x="' + (labelW + w + 8) + '" y="' + (y + 17) + '" font-size="12" fill="var(--muted)" font-family="IBM Plex Mono, monospace">' + nf(r.v) + '</text>';
    y += rowH;
  });
  return '<svg viewBox="0 0 ' + W + ' ' + (y + 4) + '" role="img" aria-label="' + esc(st.label) + '">' + g + '</svg>';
}
function chartSVG(st){
  if (st.chart === 'hbar') return hbarSVG(st);
  const W = window.innerWidth < 600 ? 360 : 640, H = window.innerWidth < 600 ? 200 : 230, padL = 8, padR = 8, padT = 22, padB = 28, iw = W - padL - padR, ih = H - padT - padB;
  const xs = st.series[0].points.map(p => p.x);
  const n = xs.length; const band = iw / n;
  const vals = st.chart === 'stack' ? xs.map((x, i) => st.series.reduce((a, s) => a + Math.max(0, (s.points[i] || {}).y || 0), 0)) : st.series.flatMap(s => s.points.map(p => p.y));
  const max = Math.max(...vals, 0) * 1.12 || 1, min = Math.min(0, ...vals);
  const Y = v => padT + ih - (v - min) / (max - min) * ih;
  const xl = x => String(x).replace(/^(\d{4})$/, '$1');
  const every = n > 8 ? (W < 500 ? 3 : 2) : 1;
  let g = '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="var(--line)" stroke-width="1"/>';
  xs.forEach((x, i) => { if ((n - 1 - i) % every === 0) g += '<text x="' + (padL + band * i + band / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11.5" fill="var(--muted)" font-family="IBM Plex Mono, monospace">' + esc(xl(x)) + '</text>'; });
  if (st.chart === 'bar') {
    const s0 = st.series[0];
    s0.points.forEach((p, i) => {
      const last = i === n - 1, x = padL + band * i + band * .18, w = band * .64, y = Y(Math.max(0, p.y)), h = Math.abs(Y(p.y) - Y(0));
      g += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + Math.max(1, h) + '" rx="2" fill="var(--data)" fill-opacity="' + (last ? 1 : .45) + '"><title>' + esc(p.x + ': ' + nf(p.y) + ' ' + st.unit) + '</title></rect>';
      g += '<text x="' + (x + w / 2) + '" y="' + (p.y >= 0 ? y - 5 : Y(p.y) + 13) + '" text-anchor="middle" font-size="11" fill="' + (last ? 'var(--ink)' : 'var(--muted)') + '" font-weight="' + (last ? 600 : 400) + '">' + nf(p.y) + '</text>';
    });
  } else if (st.chart === 'line') {
    const multi = st.series.length > 1;
    st.series.forEach((s, k) => {
      const pts = s.points.map((p, i) => [padL + band * i + band / 2, Y(p.y)]);
      const op = k === 0 ? 1 : .55, dash = k === 0 ? '' : ' stroke-dasharray="5 4"';
      g += '<polyline points="' + pts.map(q => q.join(',')).join(' ') + '" fill="none" stroke="var(--data)" stroke-opacity="' + op + '" stroke-width="2.25" stroke-linejoin="round"' + dash + '/>';
      s.points.forEach((p, i) => {
        const last = i === s.points.length - 1, first = i === 0;
        g += '<circle cx="' + pts[i][0] + '" cy="' + pts[i][1] + '" r="' + (last ? 4.5 : 3) + '" fill="' + (last ? 'var(--data)' : 'var(--surface)') + '" fill-opacity="' + (last ? op : 1) + '" stroke="var(--data)" stroke-opacity="' + op + '" stroke-width="2"><title>' + esc(p.x + (multi ? ', ' + s.name : '') + ': ' + nf(p.y) + ' ' + st.unit) + '</title></circle>';
        if ((first || last) && (!multi || k === 0 || last)) g += '<text x="' + pts[i][0] + '" y="' + (pts[i][1] + (multi && k > 0 ? 18 : -10)) + '" text-anchor="middle" font-size="11.5" font-weight="' + (last ? 600 : 400) + '" fill="' + (last ? 'var(--ink)' : 'var(--muted)') + '">' + nf(p.y) + '</text>';
      });
    });
  } else if (st.chart === 'stack') {
    const op = [1, .6, .3, .15];
    xs.forEach((x, i) => {
      let acc = 0; const bx = padL + band * i + band * .18, w = band * .64;
      st.series.forEach((s, k) => { const v = Math.max(0, (s.points[i] || {}).y || 0); const y1 = Y(acc + v), y0 = Y(acc); g += '<rect x="' + bx + '" y="' + y1 + '" width="' + w + '" height="' + Math.max(0, y0 - y1) + '" fill="var(--data)" fill-opacity="' + op[k % 4] + '"><title>' + esc(x + ', ' + s.name + ': ' + nf(v) + ' ' + st.unit) + '</title></rect>'; acc += v; });
      if (i === n - 1 || i === 0) g += '<text x="' + (bx + w / 2) + '" y="' + (Y(acc) - 5) + '" text-anchor="middle" font-size="11" font-weight="' + (i === n - 1 ? 600 : 400) + '" fill="' + (i === n - 1 ? 'var(--ink)' : 'var(--muted)') + '">' + nf(acc) + '</text>';
    });
  }
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(st.label) + '">' + g + '</svg>';
}
function chartLead(st){
  const s = st.series; const pts = s[0].points; const a = pts[0], b = pts[pts.length - 1];
  if (st.chart === 'hbar') { const tot = s.find(x => x.level === 0 || isTotal(x.name)); const yr = b.x; return (tot ? 'I ' + yr + ' etterforsket politiet ' + nf(tot.points[tot.points.length - 1].y) + ' ' + st.unit + '. ' : 'Tall for ' + yr + '. ') + 'Fordelt etter hva politiet besluttet:'; }
  if (s.length > 1) return s.map(x => x.name + ': ' + nf(x.points[x.points.length - 1].y) + ' ' + st.unit).join(' · ') + ' (' + b.x + ').';
  if (st.chart === 'stack') { const tot = i => s.reduce((acc, x) => acc + ((x.points[i] || {}).y || 0), 0); return 'I ' + b.x + ' var summen ' + nf(tot(pts.length - 1)) + ' ' + st.unit + ', mot ' + nf(tot(0)) + ' i ' + a.x + '.'; }
  return 'Siste tall (' + b.x + '): ' + nf(b.y) + ' ' + st.unit + '. I ' + a.x + ' var tallet ' + nf(a.y) + '.';
}
function chartHTML(st){
  const legend = st.chart === 'stack' ? '<div class="legend">' + st.series.map((s, k) => '<span><i style="background:var(--data);opacity:' + [1, .6, .3, .15][k % 4] + '"></i>' + esc(s.name) + '</span>').join('') + '</div>'
    : st.series.length > 1 && st.chart !== 'hbar' ? '<div class="legend">' + st.series.map((s, k) => '<span><i style="background:' + (k ? 'transparent;border-top:2px dashed var(--data);height:0;opacity:.7' : 'var(--data)') + '"></i>' + esc(s.name) + '</span>').join('') + '</div>' : '';
  return '<figure class="chart" style="margin:0"><h3>' + esc(st.label) + '</h3><p class="lead" style="margin:0">' + esc(chartLead(st)) + '</p>' + legend + chartSVG(st) +
    '<figcaption class="src">Kilde: <a href="' + esc(st.sourceUrl) + '" target="_blank" rel="noopener">' + esc(st.source) + ', tabell ' + esc(st.table) + '</a>' + (st.updated ? ' · oppdatert ' + fmtDate(st.updated, true) : '') + (st.note ? ' · ' + esc(st.note) : '') + (st.stale ? ' · kunne ikke hentes ved siste kjøring' : '') + '</figcaption></figure>';
}
const PARTY_ORDER = ['Ap','FrP','H','SV','Sp','R','MDG','KrF','V'];
function voteHTMLTema(v){
  const head = '<div class="vote-head"><h3>' + esc(v.title) + '</h3><span class="res">' + esc(v.result) + (v.date ? ' · ' + fmtDate(v.date, true) : '') + '</span></div>';
  if (!Object.keys(v.parties || {}).length) return '<div class="vote">' + head + '<p style="margin:0;font-size:14px">Alle partiene stemte for. Ved enstemmige vedtak registreres ikke stemmen til hver representant.</p><div class="vote-key"><a href="' + esc(v.caseUrl) + '" target="_blank" rel="noopener">Saken på stortinget.no ↗</a></div></div>';
  const rows = PARTY_ORDER.filter(p => v.parties[p]).map(p => {
    const x = v.parties[p], tot = x.for + x.mot + x.borte || 1;
    const lbl = x.for + x.mot === 0 ? 'ikke til stede' : (x.for ? x.for + ' for' : '') + (x.for && x.mot ? ' · ' : '') + (x.mot ? x.mot + ' mot' : '');
    return partyChip(p) + '<div class="vote-bar" role="img" aria-label="' + esc(p + ': ' + lbl) + '"><span style="width:' + (x.for / tot * 100) + '%;background:var(--vote-for)"></span><span style="width:' + (x.mot / tot * 100) + '%;background:var(--vote-mot)"></span></div><span class="num">' + esc(lbl) + '</span>';
  }).join('');
  return '<div class="vote">' + head +
    '<p class="small muted" style="margin:0">' + esc(/i sin helhet/i.test(v.voteTema || '') ? 'Votering: loven i sin helhet' : 'Avgjørende votering') + (v.ref ? ' · ' + esc(v.ref) : '') + '</p>' +
    '<div class="vote-rows">' + rows + '</div>' +
    '<div class="vote-key"><span><i style="background:var(--vote-for)"></i>For</span><span><i style="background:var(--vote-mot)"></i>Mot</span><span><i style="background:var(--vote-borte)"></i>Ikke til stede</span><a href="' + esc(v.caseUrl) + '" target="_blank" rel="noopener">Saken på stortinget.no ↗</a></div></div>';
}
function renderTemaOverview(){
  const root = $('temaRoot');
  if (!TEMA) { root.innerHTML = '<div><span class="eyebrow">Tema</span><h1 style="font-size:clamp(34px,5vw,54px);margin-top:4px">Tema</h1><p class="muted">Temasidene lastes inn fra innsyn.life.</p></div>'; return; }
  root.innerHTML = '<div><span class="eyebrow">Tema</span><h1 style="font-size:clamp(34px,5vw,54px);line-height:1;margin-top:4px">Sju tema som berører mange</h1><p class="muted" style="max-width:62ch;margin:10px 0 0">Alle tema har samme oppbygging: hva loven sier, hva tallene viser, hvordan partiene stemte, hvilke saker som er oppe nå, og hva du kan gjøre.</p></div>' +
    '<div class="tema-grid">' + TEMA.tema.map(t => {
      const open = temaCases(t).filter(c => c.status !== 'behandlet');
      const dl = open.map(c => deadlineOf(c)).filter(d => d && d.iso >= TODAY).sort((a, b) => a.iso.localeCompare(b.iso))[0];
      return '<button type="button" class="tema-card" data-tema="' + t.id + '"><span class="nr">' + t.nr + '</span><h2>' + esc(t.title) + '</h2><p>' + esc(t.teaser || (t.kort.match(/^.*?[a-zæøå)]\.(?=\s+[A-ZÆØÅ]|$)/) || [t.kort])[0]) + '</p><span class="chips"><span class="chip"><span class="mono">' + open.length + '</span> saker nå</span>' + (dl ? '<span class="chip" style="background:var(--accent-soft);color:var(--accent)">Frist ' + fmtDate(dl.iso) + '</span>' : '') + '</span></button>';
    }).join('') + '</div>';
}
function renderTemaPage(id){
  const t = TID[id]; const root = $('temaRoot');
  if (!t) return renderTemaOverview();
  const stats = temaStats(id), votes = temaVotes(id), help = helpFor(t);
  const cases = temaCases(t), open = cases.filter(c => c.status !== 'behandlet').slice(0, 6);
  const dls = cases.map(c => ({c, d: deadlineOf(c)})).filter(x => x.d && x.d.iso >= TODAY);
  const sec = (n, sid, title, body) => '<section class="tsec" id="t-' + sid + '"><h2><span class="n">' + n + '</span>' + title + '</h2>' + body + '</section>';
  let h = '<div class="tema-page"><button type="button" class="tema-back" data-tema="">← Alle tema</button>';
  h += '<div class="tema-head"><span class="eyebrow">Tema ' + t.nr + ' av ' + TEMA.tema.length + '</span><h1>' + esc(t.title) + '</h1></div>';
  h += '<nav class="tema-jump" aria-label="Hopp til">' + [['kort','Kort fortalt'],['loven','Loven'],['tall','Tall'],['stemte','Slik stemte partiene'],['saker','Saker nå'],['sifra','Si fra']].map(([k, l]) => '<a href="#tema-' + id + '" data-jump="t-' + k + '">' + l + '</a>').join('') + '</nav>';
  h += sec(1, 'kort', 'Kort fortalt', '<p class="kort">' + esc(t.kort) + '</p>');
  if (help.length) h += '<aside class="helpbox" aria-label="Trenger du hjelp?"><h2>Trenger du hjelp?</h2><ul class="helplist">' + help.map(x => '<li><span class="nm">' + esc(x.name) + '</span><a class="ph" href="tel:' + x.phone.replace(/\s/g, '') + '">' + esc(x.phone) + '</a><span class="wh">' + esc(x.when) + '</span><a class="small" href="' + esc(x.url) + '" target="_blank" rel="noopener">Les mer ↗</a></li>').join('') + '</ul><p class="small muted" style="margin:0">Numrene sjekkes automatisk mot tjenestenes egne nettsider hver uke.</p></aside>';
  h += sec(2, 'loven', 'Hva sier loven', '<ul class="lawlist">' + t.law.map(l => '<li><span>' + esc(l.text) + '</span><a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.ref) + ' ↗</a></li>').join('') + '</ul>');
  h += sec(3, 'tall', 'Omfang i tall', stats.length ? stats.map(chartHTML).join('') : '<p class="empty-note">Tallene for dette temaet hentes inn automatisk. De vises her når kilden er bekreftet.</p>');
  h += sec(4, 'stemte', 'Slik stemte partiene', votes.length ? '<p class="small muted" style="margin:0">Fra Stortingets egne voteringsdata. Viser hvordan representantene stemte, ikke hva partiene mener.</p>' + votes.map(voteHTMLTema).join('') : '<p class="empty-note">Voteringer i saker om dette temaet vises her når de er hentet.</p>');
  h += sec(5, 'saker', 'Saker og frister nå', (dls.length ? '<div class="deadlines">' + dls.map(x => '<div class="deadline"><span class="when mono">' + (x.d.iso === TODAY ? 'I dag' : fmtDate(x.d.iso)) + '<small>' + (x.d.kl ? 'kl. ' + esc(x.d.kl) : '') + '</small></span><span><a href="' + esc(x.c.url) + '" target="_blank" rel="noopener">' + esc(x.c.title) + '</a><br><span class="small muted">Frist for skriftlige innspill</span></span></div>').join('') + '</div>' : '') +
    (open.length ? '<div class="mini-cases">' + open.map(caseRow).join('') + '</div>' : '<p class="empty-note">Ingen åpne saker i Stortinget om dette akkurat nå.</p>') +
    '<button type="button" class="btn ghost" data-tema-saker="' + id + '">Se alle saker om ' + esc(t.title.toLowerCase()) + ' →</button>');
  h += sec(6, 'sifra', 'Si fra', '<div class="acts">' + t.actions.map(a => '<div class="act"><b>' + esc(a.t) + '</b><span>' + esc(a.d) + '</span><span class="links">' + (actionUrl(a) ? '<a href="' + esc(actionUrl(a)) + '" target="_blank" rel="noopener">Gå dit ↗</a>' : '') + (a.guide ? '<button type="button" data-guide="' + a.guide + '">Slik gjør du det →</button>' : '') + '</span></div>').join('') + '</div>' +
    '<p class="small muted" style="margin:0">Du kan alltid skrive til en stortingsrepresentant, en komité eller et departement, også når det ikke er en åpen sak.</p>');
  h += '</div>';
  root.innerHTML = h;
}
function renderTema(id){ if (id) renderTemaPage(id); else renderTemaOverview(); }
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tema]'); if (t) { go(t.dataset.tema ? 'tema-' + t.dataset.tema : 'tema'); return; }
  const j = e.target.closest('[data-jump]'); if (j) { e.preventDefault(); const el = document.getElementById(j.dataset.jump); if (el) el.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'start'}); return; }
  const ts = e.target.closest('[data-tema-saker]'); if (ts) { const tt = TID[ts.dataset.temaSaker]; F.q = ''; F.ses = 'all'; F.min = 'all'; F.type = 'all'; F.com = (tt.committees && tt.committees[0]) || 'all'; syncFilters(); go('saker'); window.scrollTo(0, $('filters').offsetTop - 70); }
});

/* ===================== GUIDES ===================== */
const GUIDES = [
 {id:'innspill', title:'Send innspill til en stortingskomité', when:'Når en sak har «Frist for innspill».', time:'15–30 min', need:'En kort tekst om hva du mener', url:'https://www.stortinget.no/no/Hva-skjer-pa-Stortinget/Horing/', go:'Se høringer på stortinget.no', basis:'',
  steps:['Finn saken under Saker. Saker med åpen frist har en rød merkelapp.','Åpne saken på stortinget.no og velg å sende innspill. Knappen vises bare mens komiteen tar imot innspill.','Skriv kort: hvem du er, hva du mener, hvorfor, og hva du vil at komiteen skal gjøre. Hold deg gjerne under to sider.','Send før fristen. Innspillet blir offentlig på stortinget.no.'],
  note:'Organisasjoner kan også be om å få snakke på åpne høringer.'},
 {id:'representant', title:'Skriv til en stortingsrepresentant', when:'Når du vil si din mening om en sak eller et vedtak.', time:'10 min', need:'Navnet på representanten', url:'https://www.stortinget.no/no/Stottemeny/kontakt/representanter-og-partigrupper/Representantenes-e-postadresser/', go:'Finn e-postadressene', basis:'',
  steps:['Finn representantene fra fylket ditt, eller saksordføreren for saken.','E-postadressen er oftest fornavn.etternavn@stortinget.no. Sjekk listen hos Stortinget.','Bruk malen under. Nevn saken med navn og nummer.','Still ett konkret spørsmål. Da er det lettere å svare.','Ikke fått svar etter to uker? Send en kort påminnelse.'],
  tpl:'Hei [navn],\n\nJeg bor i [fylke] og skriver om saken «[sakens navn]» ([nummer, for eksempel Prop. 1 S (2026–2027)]).\n\nJeg mener at [hva du mener], fordi [hvorfor].\n\nMitt spørsmål til deg: Hva kommer du til å stemme, og hvorfor?\n\nVennlig hilsen\n[navn]'},
 {id:'innsyn', title:'Be om innsyn i dokumenter', when:'Når du vil se hva myndighetene har skrevet om en sak.', time:'5 min', need:'E-postadresse', url:'https://einnsyn.no', go:'Gå til eInnsyn', basis:'offentleglova §§ 3, 28, 29 og 32',
  steps:['Gå til eInnsyn og søk på et tema eller en sak.','Velg dokumentene du vil se, og bestill innsyn med e-postadressen din.','Du trenger ikke si hvem du er eller hvorfor du spør.','Kravet skal behandles uten ugrunnet opphold, vanligvis i løpet av 1–3 arbeidsdager.','Får du ikke svar innen fem arbeidsdager, regnes det som avslag. Da kan du klage innen tre uker.'],
  tpl:'Innsynskrav\n\nJeg ber om innsyn i [dokumentets tittel / saksnummer], jf. offentleglova § 3.\n\nDersom dere avslår helt eller delvis, ber jeg om at dere oppgir hjemmelen for avslaget, og vurderer merinnsyn etter offentleglova § 11.\n\nVennlig hilsen\n[navn]'},
 {id:'horing', title:'Send høringssvar til regjeringen', when:'Når regjeringen foreslår nye lover eller regler.', time:'20–40 min', need:'En kort tekst om hva du mener', url:'https://www.regjeringen.no/no/dokument/hoyringar/id1763/', go:'Se åpne høringer', basis:'',
  steps:['Åpne listen over høringer hos regjeringen og velg en som er åpen.','Les sammendraget først. Du trenger ikke lese alt.','Skriv hva du er enig og uenig i, og hvorfor.','Send inn via skjemaet på høringssiden før fristen. Svarene blir offentlige.'],
  note:'Alle kan svare, ikke bare de som står på høringslisten.'},
 {id:'mote', title:'Følg en debatt i Stortinget', when:'Når en sak du bryr deg om skal opp i salen.', time:'1–3 timer', need:'Ingenting, bare møt opp', url:'https://stortinget.no/no/Stortinget-og-demokratiet/oversikt-over-omvisninger/publikumsgalleriet/', go:'Om tilhørerlosjen', basis:'Grunnloven § 84',
  steps:['Sjekk dagsorden på stortinget.no. Møtene er vanligvis tirsdag til torsdag kl. 10.','Gå inn fra Karl Johans gate litt før møtet starter. Det er ingen påmelding.','Regn med sikkerhetskontroll. Yttertøy og sekker legges i garderobe.','Sitt så lenge du vil, og gå når du vil.']},
 {id:'sivilombudet', title:'Klag til Sivilombudet', when:'Når du mener en offentlig etat har behandlet deg urettferdig.', time:'30 min', need:'Vedtaket og klagesvaret du har fått', url:'https://sivilombudet.digiforms.no/tjeneste/klage', go:'Gå til klageskjemaet', basis:'sivilombudsloven §§ 4, 7, 8 og 9',
  steps:['Klag først til etaten selv, og til klageinstansen hvis det finnes en.','Har du fått endelig svar? Da kan du klage til Sivilombudet innen ett år.','Fyll ut klageskjemaet og legg ved vedtaket og klagesvaret.','Det er gratis. Ombudet sier fra hvis saken ikke kan behandles.'],
  note:'Ombudet behandler ikke Stortingets vedtak, saker avgjort i statsråd eller domstolenes avgjørelser.'},
 {id:'innbyggerforslag', title:'Lag et innbyggerforslag i kommunen', when:'Når du vil at kommunestyret skal ta opp en sak.', time:'Uker, mens du samler underskrifter', need:'En tydelig idé og folk som er enige', url:'https://minsak.no/', go:'Gå til Minsak', basis:'kommuneloven § 12-1',
  steps:['Formuler forslaget kort og konkret: hva skal kommunen gjøre?','Opprett forslaget på Minsak.','Samle underskrifter. 300 er alltid nok, i mindre kommuner kan 2 prosent av innbyggerne holde.','Når forslaget har nok underskrifter, må kommunestyret behandle det innen seks måneder.']},
 {id:'demonstrasjon', title:'Demonstrer fredelig', when:'Når du vil vise synlig at du er uenig.', time:'Planlegging: 1 time', need:'Sted, tidspunkt og en kontaktperson', url:'https://www.politiet.no/kontakt-politiet/', go:'Kontakt politiet', basis:'politiloven § 11',
  steps:['Velg sted og tidspunkt. Eidsvolls plass foran Stortinget er et vanlig sted.','Meld fra til politiet i god tid. Du trenger ikke tillatelse, bare å melde fra.','Ha en kontaktperson som politiet kan snakke med på stedet.','Hold det fredelig og følg pålegg fra politiet.']},
 {id:'tips', title:'Tips Riksrevisjonen', when:'Når du mistenker sløsing eller misbruk av offentlige penger.', time:'15 min', need:'Hva, hvor og når, gjerne dokumentasjon', url:'https://rr.usecompose.com/cng/Riksrevisjonen/Tipskanalen', go:'Gå til tipskanalen', basis:'',
  steps:['Skriv ned hva som har skjedd, hvor og når.','Legg ved dokumentasjon hvis du har det.','Send via tipskanalen. Du kan være anonym.']}
];
let steps = new Set(store('innsyn.steps') || []);
function renderGuides(){
  $('guides').innerHTML = GUIDES.map(g => {
    const done = g.steps.filter((_, i) => steps.has(g.id + ':' + i)).length;
    let h = '<details class="guide" id="guide-' + g.id + '"><summary><h2>' + esc(g.title) + '</h2><p>' + esc(g.when) + '</p><span class="chips"><span class="chip">Tar ' + esc(g.time) + '</span><span class="chip">Du trenger: ' + esc(g.need) + '</span>' + (done ? '<span class="chip">' + done + ' av ' + g.steps.length + ' gjort</span>' : '') + '</span></summary><div class="gbody">';
    h += '<ol class="steps">' + g.steps.map((t, i) => { const k = g.id + ':' + i, on = steps.has(k); return '<li class="' + (on ? 'done' : '') + '"><label><input type="checkbox" data-step="' + k + '"' + (on ? ' checked' : '') + '><span>' + esc(t) + '</span></label></li>'; }).join('') + '</ol>';
    if (g.tpl) h += '<div class="tpl"><pre>' + esc(g.tpl) + '</pre><div class="bar"><span class="small muted">Mal, bytt ut det i [klammer]</span><button type="button" class="btn ghost" data-copy="' + esc(g.tpl) + '" data-what="Malen">Kopier malen</button></div></div>';
    if (g.note) h += '<p class="note">' + esc(g.note) + '</p>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><a class="btn" href="' + esc(g.url) + '" target="_blank" rel="noopener">' + esc(g.go) + ' ↗</a>' + (g.basis ? '<span class="small muted mono">' + esc(g.basis) + '</span>' : '') + '</div>';
    return h + '</div></details>';
  }).join('');
}
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.step; if (!k) return;
  e.target.checked ? steps.add(k) : steps.delete(k); store('innsyn.steps', [...steps]);
  e.target.closest('li').classList.toggle('done', e.target.checked);
});
document.addEventListener('click', e => {
  const g = e.target.closest('[data-guide]'); if (!g) return;
  openGuide(g.dataset.guide);
});
function openGuide(id){
  go('sifra');
  const el = document.getElementById('guide-' + id); if (!el) return;
  el.open = true; el.scrollIntoView({block:'start', behavior: reduce ? 'auto' : 'smooth'});
}

/* ===================== WHY ===================== */
$('why').innerHTML = `
<span class="eyebrow">Hvorfor Innsyn</span>
<h1>Et demokrati er noe vi gjør, ikke bare noe vi har</h1>
<p class="lead">Vi stemmer hvert fjerde år. Resten av tiden tas beslutningene av andre, ofte uten at vi vet om det før det er for sent å si noe.</p>
<p>Valgløfter er lette å gi. Det som teller, er hva som faktisk blir vedtatt. Men sakene ligger spredt over mange nettsider, språket er tungt, og fristene for å si sin mening går ut før de fleste vet at de fantes.</p>
<p>Innsyn samler det på ett sted. Hvem som bestemmer hva, hvor de sitter, hvilke saker som er oppe nå, hvordan det ble stemt, og hva du selv kan gjøre.</p>
<h2>Rettighetene finnes allerede</h2>
<p>Vi har ytringsfrihet. Vi har rett til å se dokumentene. Vi kan sende innspill, svare på høringer, klage, foreslå saker for kommunen og demonstrere. Det som mangler, er at det er enkelt. Det prøver denne siden å fikse.</p>
<h2>Styr selv, sammen</h2>
<p>Å styre oss selv handler ikke om å rive ned noe. Det handler om å bruke demokratiet slik det er ment: følge med, si fra og møte opp. Jo flere som gjør det, jo vanskeligere blir det å overse oss.</p>
<div class="principles">
  <div><b>Åpent</b>Alt kommer fra offentlige kilder, med lenke, så du kan sjekke selv.</div>
  <div><b>Uten parti</b>Siden tar ikke parti. Den viser hva som skjer og hva du kan gjøre.</div>
  <div><b>Gratis</b>For alle som vil følge med og si fra.</div>
</div>
<p class="signed">Laget av Peder Schartum Thorbjørnsen, kunstner og teknolog. Jeg har ikke vært spesielt synlig i politikken, men jeg vil gjerne bli mer aktiv, og dette er et sted å begynne. Ser du feil, eller mangler noe? Si fra.</p>
<p><button type="button" class="btn" data-goto-sifra="1">Se hva du kan gjøre →</button></p>`;
document.addEventListener('click', e => { if (e.target.closest('[data-goto-sifra]')) go('sifra'); });

/* ===================== SETTINGS ===================== */
function applyOpts(){
  const o = store('innsyn.opts') || {};
  document.documentElement.classList.toggle('calm', !!o.calm);
  document.documentElement.classList.toggle('big', !!o.big);
  $('optCalm').checked = !!o.calm; $('optBig').checked = !!o.big;
  reduce = sysReduce || !!o.calm; request && started && request();
}
['optCalm','optBig'].forEach(id => $(id).addEventListener('change', () => { store('innsyn.opts', {calm:$('optCalm').checked, big:$('optBig').checked}); applyOpts(); }));
document.addEventListener('click', e => { const d = document.querySelector('.view-opts'); if (d.open && !d.contains(e.target)) d.open = false; });

/* ===================== SOURCES ===================== */
(function(){
  document.getElementById('aboutProse').innerHTML =
    '<p>Innsyn samler offentlig informasjon om regjeringen og Stortinget på ett sted. Dataene du ser nå ble hentet <b>' + fmtDate(D.fetched, true) + '</b>. På innsyn.life hentes nye saker, stemmer og nyheter automatisk hver morgen, og alt som endrer seg vises under «Nytt siste 7 dager». Sjekk alltid kilden før du bruker noe videre.</p>' +
    '<p>Innsyn er åpen kildekode (AGPL-3.0). Koden og hele historikken over dataene ligger på <a href="https://github.com/Artum-founder/innsyn" target="_blank" rel="noopener">github.com/Artum-founder/innsyn</a>.</p>' +
    '<p>Saker, komiteer og voteringer er hentet fra Stortingets åpne data (data.stortinget.no). Statsråder, adresser og nyheter er hentet fra regjeringen.no. Setefordelingen er fra valget i 2025. Kontaktinfo og rettigheter er hentet fra departementenes og institusjonenes egne kontaktsider, Sivilombudet og Stortinget.</p>' +
    '<p>Kartet er tegnet for hånd og forenklet: strandlinje, gater og parker er omtrentlige. Byggene er plassert etter departementenes besøksadresser, og høydene er bare veiledende. Koblingene mellom departementer viser overlappende ansvarsområder og felles saker, ikke formelle samarbeidsavtaler. Hvilken komité som dekker hvilket departement er en vanlig fordeling, ikke en fast regel.</p>' +
    '<p>' + esc(G.governmentQuarter || '') + '</p>';
  const li = u => '<li><a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\//, '')) + '</a></li>';
  document.getElementById('srcSto').innerHTML = (S.sources || []).map(li).join('');
  document.getElementById('srcGov').innerHTML = ['https://www.regjeringen.no/no/dep/', 'https://www.regjeringen.no/no/aktuelt/'].concat(G.ministries.map(m => m.url), ((D.contacts || {}).sources || [])).map(li).join('');
})();

/* ===================== ROUTING ===================== */
let started = false;
function go(view){
  if (location.hash.slice(1) !== view) history.replaceState(null, '', '#' + view);
  route();
}
function route(){
  const h = location.hash.slice(1) || 'kart';
  const VIEWS = ['kart','saker','tema','sifra','hvorfor','kilder'];
  const isGuide = GUIDES.some(g => g.id === h);
  const temaId = h.startsWith('tema-') ? h.slice(5) : (h === 'tema' ? '' : null);
  const view = isGuide ? 'sifra' : (temaId !== null ? 'tema' : (VIEWS.includes(h) ? h : 'kart'));
  if (view === 'tema') renderTema(temaId);
  VIEWS.forEach(v => document.getElementById('view-' + v).hidden = v !== view);
  if (isGuide) setTimeout(() => { const el = document.getElementById('guide-' + h); if (el) { el.open = true; el.scrollIntoView({block:'start'}); } }, 0);
  document.querySelectorAll('.nav a').forEach(a => a.setAttribute('aria-current', a.dataset.view === view ? 'page' : 'false'));
  if (view === 'kart') {
    resize(); if (!started) startMap();
    if (MIN[h]) openBuilding(HOME[h], h); else if (BID[h]) openBuilding(h);
    request();
  } else if (!isGuide) window.scrollTo(0, 0);
}
function startMap(){
  started = true; readColors(); buildGround();
  const m = store('innsyn.mode'); if (m === '2d') { mode3d = false; document.getElementById('v3d').setAttribute('aria-pressed', false); document.getElementById('v2d').setAttribute('aria-pressed', true); }
  Object.assign(cam, overview()); renderList(); request();
}
window.addEventListener('hashchange', route);
window.addEventListener('resize', () => { if (document.getElementById('view-kart').hidden) return; resize(); if (!animT) Object.assign(cam, selected ? focusOn(BID[selected]) : overview()); request(); });
const reTheme = () => { if (!started) return; readColors(); buildGround(); request(); };
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', reTheme);
new MutationObserver(reTheme).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => request());

renderNytt(); renderGuides(); applyOpts(); renderDeadlines(); renderBudget(); syncFilters(); route();
})();
