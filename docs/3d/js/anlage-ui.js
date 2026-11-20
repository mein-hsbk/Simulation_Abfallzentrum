// Oberfläche der Anlagensimulation (AEZ): Leitwarte Deponiegas, Instrument-Detailansicht,
// Protokoll, Meldung an die Schichtleitung mit Diagnose, Hinweise (Toast).
import { PG, KARTEN, fmtZeit, vName } from './gas-modell.js';
import { sim, logA, logText } from './anlage-sim.js';
import { insts, f1, f0 } from './instrumente.js';

const $ = (id) => document.getElementById(id);
const WAHL = { hand: 'HAND', '0': '0', auto: 'AUTO' };

export function initAnlageUI() {
  const ui = { erklaer: true, overlays: ['detail', 'meld'] };

  let toastT;
  ui.toast = (m) => { const t = $('toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => (t.style.display = 'none'), 4200); };

  // ---------------- Detailansicht Instrument
  const dcv = $('dcv'), detail = { id: null, ctx: dcv.getContext('2d') }, lastInspect = {};
  ui.detail = detail;
  ui.openDetail = (id, msg) => {
    if (!id) { if (msg) ui.toast(msg); return; }
    const it = insts[id]; detail.id = id;
    $('dTitle').textContent = it.tag; $('dName').textContent = it.name;
    $('dInfo').textContent = it.info; $('dInfo').style.display = ui.erklaer ? '' : 'none';
    const dw = it.detailW || 512; dcv.width = dw; dcv.height = Math.round(dw * (it.detailAspect || (it.detail ? 0.75 : (it.aspect || 1))));
    (it.detail || it.draw)(detail.ctx, dcv.width, dcv.height);
    renderActions(); $('detail').style.display = 'flex';
    if (!lastInspect[id] || performance.now() - lastInspect[id] > 30000) logA(`angesehen: ${it.tag} (${it.name})`, 'blick');
    lastInspect[id] = performance.now();
  };
  function renderActions() {
    const it = insts[detail.id], box = $('dAct'); box.innerHTML = '';
    const nach = () => { renderActions(); (it.detail || it.draw)(detail.ctx, dcv.width, dcv.height); };
    (it.actions ? it.actions() : []).forEach((a) => {
      if (a.typ === 'titel') { const d = document.createElement('div'); d.className = 'actT'; d.textContent = a.label; box.appendChild(d); return; }
      if (a.typ === 'wahl') {
        const d = document.createElement('div'); d.className = 'actRow';
        d.innerHTML = `<span class="actL">${a.label}</span><span class="seg">${a.optionen.map(([v, t]) => `<button class="btn${v === a.wert ? ' on' : ''}" data-v="${v}">${t}</button>`).join('')}</span>`;
        d.querySelector('.seg').onclick = (e) => { const v = e.target.dataset.v; if (v != null && v !== String(a.wert)) { a.fn(v); nach(); } };
        box.appendChild(d); return;
      }
      if (a.typ === 'zahl') {
        const d = document.createElement('div'); d.className = 'actRow';
        d.innerHTML = `<span class="actL">${a.label}</span><span class="num"><input inputmode="decimal" value="${String(a.wert).replace('.', ',')}"> ${a.einheit || ''} <button class="btn act">${a.knopf || 'Setzen'}</button></span>`;
        const inp = d.querySelector('input');
        const go = () => { const v = parseFloat(inp.value.replace(',', '.')); if (!isFinite(v)) return ui.toast('Bitte eine Zahl eingeben.'); a.fn(Math.max(a.min ?? -1e9, Math.min(a.max ?? 1e9, v))); nach(); };
        d.querySelector('button').onclick = go; inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
        box.appendChild(d); return;
      }
      const b = document.createElement('button'); b.className = 'btn act'; b.textContent = a.label;
      b.onclick = () => { a.fn(); nach(); }; box.appendChild(b);
    });
  }
  const closeDetail = () => { detail.id = null; $('detail').style.display = 'none'; };
  $('dClose').onclick = closeDetail;
  $('detail').addEventListener('click', (e) => { if (e.target.id === 'detail') closeDetail(); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape') { closeDetail(); $('meld').style.display = 'none'; } });

  // ---------------- Leitwarte
  let plsOpen = false;
  const togglePLS = (quiet) => { plsOpen = !plsOpen; $('pls').style.display = plsOpen ? 'block' : 'none'; $('bPLS').classList.toggle('on', plsOpen); if (plsOpen) { if (quiet !== true) logA('Leitwarte geöffnet (Deponiegas)', 'blick'); renderPLS(); } };
  ui.showPLS = () => { if (!plsOpen) togglePLS(true); };
  $('bPLS').onclick = () => togglePLS(); $('plsClose').onclick = () => togglePLS();
  addEventListener('keydown', (e) => { if (e.code === 'Tab' && document.body.classList.contains('walking')) { e.preventDefault(); togglePLS(); } });

  const row = (tg, name, val, unit, cls = '') => `<tr><td class="tg">${tg}</td><td>${name}</td><td class="v ${cls}">${val}</td><td class="u">${unit}</td></tr>`;
  const alarmList = (al) => {
    al = al.sort((a, b) => (b.aktiv - a.aktiv) || (b.kommt - a.kommt)).slice(0, 9);
    return al.length ? al.map((a) => `<div class="al ${a.aktiv ? 'on' : ''} k${a.klasse}"><span>${fmtZeit(a.kommt)}</span>${a.text.replace('Deponiegas: ', '')}${a.aktiv ? '' : ` <i>(geht ${fmtZeit(a.geht)})</i>`}</div>`).join('') : '<div class="al">Keine Meldungen</div>';
  };
  function renderPLS() {
    const G = sim.G, st = (x) => x.stoer ? 'Störung' : !x.rep ? 'Rep.-Sch. 0' : x.run ? 'Betrieb' : 'Bereit';
    const cl = (x) => (x.stoer || !x.rep ? 'a' : '');
    $('gasVals').innerHTML = `<table>
      ${row('PIC 801', 'Unterdruck Saugsammler (Soll ' + G.sp + ')', '−' + f1(Math.max(0, G.pn)), 'mbar', G.pn < G.sp - 6 ? 'w' : '')}
      ${row('FI 801', 'Gasmenge (Norm)', f0(G.q), 'Nm³/h')}
      ${row('QI 801', 'Methan CH₄', f1(G.ch4), 'Vol-%', G.ch4 < 45 ? 'w' : '')}
      ${row('QI 802', 'Sauerstoff O₂', f1(G.o2), 'Vol-%', G.o2 > 4 ? 'a' : G.o2 > 2.5 ? 'w' : '')}
      ${row('PI 803', 'Druck Gasabgabe zu BHKW/Fackel', f0(G.pd), 'mbar')}
    </table><table style="margin-top:4px">
      <tr><td></td><td></td><td class="v hd">V1</td><td class="v hd">V2</td><td></td></tr>
      <tr><td class="tg">YS</td><td>Zustand</td><td class="v ${cl(G.g[0])}">${st(G.g[0])}</td><td class="v ${cl(G.g[1])}">${st(G.g[1])}</td><td></td></tr>
      <tr><td class="tg">HS</td><td>Wahlschalter</td><td class="v ${G.g[0].wahl !== 'auto' ? 'w' : ''}">${WAHL[G.g[0].wahl]}</td><td class="v ${G.g[1].wahl !== 'auto' ? 'w' : ''}">${WAHL[G.g[1].wahl]}</td><td></td></tr>
      <tr><td class="tg">SC</td><td>Frequenz FU</td><td class="v ${G.g[0].run && G.g[0].f > PG.F_MAX - 0.4 ? 'w' : ''}">${G.g[0].run ? f1(G.g[0].f) : '–'}</td><td class="v ${G.g[1].run && G.g[1].f > PG.F_MAX - 0.4 ? 'w' : ''}">${G.g[1].run ? f1(G.g[1].f) : '–'}</td><td class="u">Hz</td></tr>
      <tr><td class="tg">II</td><td>Motorstrom</td><td class="v">${f1(G.g[0].amp)}</td><td class="v">${f1(G.g[1].amp)}</td><td class="u">A</td></tr>
      <tr><td class="tg">TI 8x2</td><td>Druckgastemperatur</td><td class="v ${G.g[0].run && G.g[0].td > PG.T_WARN ? 'w' : ''}">${G.g[0].run ? f0(G.g[0].td) : '–'}</td><td class="v ${G.g[1].run && G.g[1].td > PG.T_WARN ? 'w' : ''}">${G.g[1].run ? f0(G.g[1].td) : '–'}</td><td class="u">°C</td></tr>
      <tr><td class="tg"></td><td>Betriebsstunden</td><td class="v">${f0(G.g[0].bh)}</td><td class="v">${f0(G.g[1].bh)}</td><td class="u">h</td></tr>
    </table><table style="margin-top:4px">
      ${row('G 901', 'BHKW (Deponiegas)', G.bhkw === 'betrieb' ? `Betrieb ${f0(G.pel)} kW` : 'Aus', '', G.bhkw !== 'betrieb' ? 'w' : '')}
      ${row('F 902', 'Hochtemperaturfackel', G.fackel ? `Ein ${f0(G.qFackel)} Nm³/h` : 'Aus', '')}
    </table>
    <div class="cnt">Seit Start: abgesaugt ${f0(G.vGas)} Nm³ · Energie Verdichter ${f1(G.eKwh)} kWh${G.vDiffus > 0 ? ` · <span class="a">diffus entwichen ≈ ${f0(G.vDiffus)} Nm³</span>` : ''}${G.bestellungen.length ? ` · Bestellungen: ${G.bestellungen.length}` : ''}</div>`;
    $('gasAl').innerHTML = alarmList(Object.values(G.alarme));
    drawTrend($('trendG'), G.hist, G.t, 3, [['pn', '#ffd32a', (v) => v / 60 * 100], ['q', '#00d2d3', (v) => v / 3], ['o2', '#ff7675', (v) => v * 10], ['td1', '#fd79a8', (v) => v], ['td2', '#a29bfe', (v) => v], ['f1', '#74b9ff', (v) => (v - 20) / 40 * 100]]);
  }
  function drawTrend(c, hist, t1, hours, ser) {
    const W = c.clientWidth, H = c.clientHeight; if (!W) return;
    c.width = W * devicePixelRatio; c.height = H * devicePixelRatio; const x = c.getContext('2d'); x.scale(devicePixelRatio, devicePixelRatio);
    x.fillStyle = '#0b1424'; x.fillRect(0, 0, W, H);
    const t0 = t1 - hours * 3600, X = (t) => 34 + (W - 44) * (t - t0) / (t1 - t0), Y = (v) => H - 18 - (H - 30) * Math.max(0, Math.min(100, v)) / 100;
    x.strokeStyle = '#1f3352'; x.fillStyle = '#7f8fa6'; x.font = '10px Arial'; x.lineWidth = 1;
    for (let v = 0; v <= 100; v += 25) { x.beginPath(); x.moveTo(34, Y(v)); x.lineTo(W - 10, Y(v)); x.stroke(); x.fillText(v, 8, Y(v) + 3); }
    const stp = hours / 4; for (let k = 0; k <= 4; k++) { const tt = t1 - (hours - k * stp) * 3600; x.fillText(fmtZeit(tt), X(tt) - 14, H - 4); }
    for (const [k, col, sc] of ser) { x.strokeStyle = col; x.lineWidth = 1.6; x.beginPath(); let s0 = false; for (const p of hist) { if (p.t < t0 || p[k] == null) { s0 = false; continue; } const px = X(p.t), py = Y(sc(p[k])); s0 ? x.lineTo(px, py) : x.moveTo(px, py); s0 = true; } x.stroke(); }
  }

  // ---------------- Protokoll, Meldung
  let logOpen = false;
  const renderLog = () => { if (logOpen) $('logBody').textContent = logText(); };
  sim.listeners.add(renderLog);
  $('bLog').onclick = () => { logOpen = !logOpen; $('log').style.display = logOpen ? 'block' : 'none'; $('bLog').classList.toggle('on', logOpen); renderLog(); };
  $('logClose').onclick = () => { logOpen = false; $('log').style.display = 'none'; $('bLog').classList.remove('on'); };
  $('logCopy').onclick = async () => { try { await navigator.clipboard.writeText(logText()); ui.toast('Protokoll kopiert.'); } catch { ui.toast('Kopieren nicht möglich – Text markieren und kopieren.'); } };
  ui.diagnose = null;
  $('bMeld').onclick = () => {
    const k = ui.diagnose && KARTEN[sim.G.karte], sel = $('meldDiag');
    $('meldDiagW').style.display = k ? '' : 'none';
    if (k) sel.innerHTML = '<option value="">– Ursache auswählen –</option>' + Object.entries(k.ursachen).map(([v, t]) => `<option value="${v}">${t}</option>`).join('') + '<option value="unklar">Ursache nicht eindeutig feststellbar</option>';
    $('meld').style.display = 'flex'; $('meldText').focus();
  };
  $('meldCancel').onclick = () => { $('meld').style.display = 'none'; };
  $('meldOk').onclick = () => {
    const t = $('meldText').value.trim(), k = ui.diagnose && KARTEN[sim.G.karte], d = k ? $('meldDiag').value : '';
    if (k && !d) return ui.toast('Bitte die festgestellte Ursache auswählen.');
    if (d) { sim.diagnose = d; logA(`DIAGNOSE: ${d === 'unklar' ? 'Ursache nicht eindeutig feststellbar' : k.ursachen[d]}`, 'meldung'); }
    if (t) logA(`MELDUNG an Schichtleitung: ${t}`, 'meldung');
    if (t || d) ui.toast('Meldung protokolliert.');
    $('meldText').value = ''; $('meld').style.display = 'none';
  };

  let tt = 0;
  ui.update = (dt) => {
    tt -= dt; if (tt > 0) return; tt = 0.5;
    const G = sim.G;
    $('simClock').textContent = `Tag ${Math.floor(G.t / 86400) + 1} · ${fmtZeit(G.t)} · ×${sim.speed}`;
    const nA = Object.values(G.alarme).filter((a) => a.aktiv && a.klasse === 'A').length;
    $('bPLS').textContent = nA ? `Leitwarte (${nA} ⚠)` : 'Leitwarte';
    $('bPLS').classList.toggle('alarm', nA > 0);
    if (plsOpen) renderPLS();
  };
  ui.isBlocked = () => ui.overlays.some((id) => $(id).style.display === 'flex');
  ui.vName = vName;
  return ui;
}
