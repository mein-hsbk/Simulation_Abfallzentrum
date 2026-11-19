// Missionsbericht: ausführliche Auswertung am Bildschirm und als PDF (jsPDF, lokal in vendor/).
// Enthält Prüfschritte mit Begründung, Kennzahlen, Werte Start/Ende, Leitwarten-Diagramme mit
// markierten Handlungen, Analysehinweise, Zeitstrahl, Meldungen und optional die Musterlösung.
import { sim } from './anlage-sim.js';
import { fmtZeit, tag } from './gas-modell.js';

const zeit = (t) => `T${tag(t)} ${fmtZeit(t)}`;
const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ Daten zusammenstellen
export function sammleBericht(m, ctx) {
  const tEnd = sim.G.t, tStart = ctx.tSim0;
  const ereignisse = sim.log.filter((l) => ['aktion', 'messung', 'meldung'].includes(l.art)).map((l, i) => ({ ...l, nr: i + 1 }));
  const alarme = sim.log.filter((l) => l.art === 'alarm');
  const checks = ((typeof m.checks === 'function' ? m.checks() : m.checks) || []).map(([text, f, warum]) => ({ text, ok: !!f(), warum: warum || '' }));
  const ende = m.werte ? m.werte() : [];
  const werte = (ctx.werteStart || []).map(([n, v, u], i) => [n, v, ende[i] ? ende[i][1] : '–', u]);
  const hist = { G: [...sim.G.hist, { t: tEnd, ...lastG() }] };
  const bestellungen = sim.G.bestellungen.map((b, i) => ({ ...b, nr: i + 1 }));
  return {
    titel: m.titel, bereich: m.bereich, name: ctx.name || '', datum: new Date().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }),
    dauer: mmss(performance.now() - ctx.t0), simVon: zeit(tStart), simBis: zeit(tEnd), speed: sim.speed, exam: ctx.exam,
    auftrag: m.auftragStart || m.auftrag, checks, kennzahl: m.kennzahl ? m.kennzahl() : '', werte,
    charts: (m.charts || []).map((c) => ({ ...c, t0: tStart - (m.vorlauf || 2) * 3600, t1: tEnd, tStart, data: hist[c.src] })),
    hinweise: m.hinweise ? m.hinweise(ereignisse) : [], ereignisse, alarme,
    bestellungen,
    meldungen: ereignisse.filter((e) => e.art === 'meldung' && !/^BESTELLUNG/.test(e.text)).map((e) => e.text.replace(/^MELDUNG an Schichtleitung: /, '')),
    lehrer: m.lehrerBericht ? m.lehrerBericht() : m.lehrer,
  };
}
function lastG() { const G = sim.G, [a, b] = G.g; return { pn: G.pn, pd: G.pd, q: G.q, o2: G.o2, ch4: G.ch4, td1: a.run ? a.td : null, td2: b.run ? b.td : null, f1: a.run ? a.f : 0, f2: b.run ? b.f : 0, i1: a.amp, i2: b.amp, pel: G.pel }; }

// ------------------------------------------------------------------ Diagramm (Bildschirm und PDF)
export function zeichneDiagramm(cv, c, ereignisse, theme = 'dark') {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, k = W / 700;
  const dark = theme === 'dark';
  const col = { bg: dark ? '#0b1424' : '#ffffff', grid: dark ? '#1f3352' : '#e3e6ea', txt: dark ? '#9fb0c8' : '#4a5560', ink: dark ? '#dfe6e9' : '#1d2329', mark: dark ? '#ffeaa7' : '#b7791f', start: dark ? '#55efc4' : '#1e8e5a' };
  ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, H);
  const L = 52 * k, R = 14 * k, T = 26 * k, B = 30 * k, pw = W - L - R, ph = H - T - B;
  const X = (t) => L + pw * (t - c.t0) / (c.t1 - c.t0), Y = (v) => T + ph * (1 - (Math.max(c.min, Math.min(c.max, v)) - c.min) / (c.max - c.min));
  ctx.font = `bold ${13 * k}px Arial`; ctx.fillStyle = col.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(c.titel, L, 5 * k);
  ctx.font = `${11 * k}px Arial`; ctx.fillStyle = col.txt; ctx.textAlign = 'right'; ctx.fillText(c.einheit, W - R, 7 * k);
  // Raster
  ctx.lineWidth = 1 * k; ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const v = c.min + (c.max - c.min) * i / 4, y = Y(v);
    ctx.strokeStyle = col.grid; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke();
    ctx.fillStyle = col.txt; ctx.textAlign = 'right'; ctx.fillText(String(Math.round(v * 10) / 10).replace('.', ','), L - 6 * k, y);
  }
  const span = c.t1 - c.t0, step = [900, 1800, 3600, 7200, 10800, 21600].find((s) => span / s <= 8) || 21600;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let t = Math.ceil(c.t0 / step) * step; t <= c.t1; t += step) { ctx.fillStyle = col.txt; ctx.fillText(fmtZeit(t), X(t), H - B + 6 * k); ctx.strokeStyle = col.grid; ctx.beginPath(); ctx.moveTo(X(t), T); ctx.lineTo(X(t), H - B); ctx.stroke(); }
  // Fackelbetrieb o. Ä. als Band
  if (c.band) { ctx.fillStyle = dark ? 'rgba(255,120,40,0.18)' : 'rgba(230,126,34,0.16)'; for (const p of c.data) if (p.t >= c.t0 && p[c.band.key]) ctx.fillRect(X(p.t) - 1.5 * k, T, 3 * k, ph); }
  // Missionsstart
  ctx.strokeStyle = col.start; ctx.setLineDash([5 * k, 4 * k]); ctx.beginPath(); ctx.moveTo(X(c.tStart), T); ctx.lineTo(X(c.tStart), H - B); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = col.start; ctx.font = `${10 * k}px Arial`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('Start', X(c.tStart) - 3 * k, H - B - 3 * k);
  // Kurven
  for (const s of c.serien) {
    ctx.strokeStyle = s.farbe; ctx.lineWidth = (s.dick || 2) * k; ctx.setLineDash(s.strich ? [6 * k, 4 * k] : []);
    ctx.beginPath(); let on = false;
    for (const p of c.data) { if (p.t < c.t0 || p[s.key] == null) continue; const x = X(p.t), y = Y(p[s.key] * (s.f || 1)); on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; }
    ctx.stroke(); ctx.setLineDash([]);
  }
  // Handlungen als nummerierte Marken
  ctx.font = `bold ${10 * k}px Arial`; ctx.textAlign = 'center';
  const reihe = [-1e9, -1e9, -1e9];          // nahe beieinander liegende Marken versetzt anordnen
  for (const e of ereignisse) {
    if (e.ts < c.t0 || e.ts > c.t1) continue;
    const x = X(e.ts); let r = reihe.findIndex((lx) => x - lx >= 16 * k); if (r < 0) r = reihe.indexOf(Math.min(...reihe)); reihe[r] = x;
    const yk = T + 8 * k + r * 16 * k;
    ctx.strokeStyle = col.mark; ctx.lineWidth = 1 * k; ctx.beginPath(); ctx.moveTo(x, yk + 7 * k); ctx.lineTo(x, H - B); ctx.stroke();
    ctx.fillStyle = col.mark; ctx.beginPath(); ctx.arc(x, yk, 7 * k, 0, 7); ctx.fill();
    ctx.fillStyle = col.bg; ctx.textBaseline = 'middle'; ctx.fillText(String(e.nr), x, yk + 0.5 * k);
  }
  // Legende
  ctx.font = `${10.5 * k}px Arial`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let lx = L, ly = H - 8 * k;
  for (const s of c.serien) {
    const w = ctx.measureText(s.label).width + 30 * k;
    if (lx + w > W - R) break;
    ctx.strokeStyle = s.farbe; ctx.lineWidth = 2.5 * k; ctx.setLineDash(s.strich ? [5 * k, 3 * k] : []); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 18 * k, ly); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = col.ink; ctx.fillText(s.label, lx + 22 * k, ly); lx += w;
  }
}

// ------------------------------------------------------------------ Bildschirmansicht
export function renderBericht(el, r) {
  const ok = r.checks.filter((c) => c.ok).length;
  el.innerHTML = `
    <div class="rpMeta">${r.bereich} · Dauer ${r.dauer} (Echtzeit) · Simulationszeit ${r.simVon} – ${r.simBis} · Zeitraffer ×${r.speed}${r.exam ? ' · Prüfungsmodus' : ''}</div>
    ${r.checks.length ? `<h3>Ergebnis: ${ok} von ${r.checks.length} Schritten erfüllt</h3>
    <ul class="chk">${r.checks.map((c) => `<li class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'} ${esc(c.text)}${c.warum ? `<div class="why">${esc(c.warum)}</div>` : ''}</li>`).join('')}</ul>` : ''}
    ${r.kennzahl ? `<p class="kz">${esc(r.kennzahl)}</p>` : ''}
    ${r.hinweise.length ? `<h3>Beobachtungen zum Vorgehen</h3><ul class="hw">${r.hinweise.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
    ${r.werte.length ? `<h3>Prozesswerte zu Beginn und am Ende</h3><table class="rpT"><tr><th>Größe</th><th>Start</th><th>Ende</th><th></th></tr>${r.werte.map(([n, a, b, u]) => `<tr><td>${esc(n)}</td><td class="n">${esc(a)}</td><td class="n">${esc(b)}</td><td>${esc(u)}</td></tr>`).join('')}</table>` : ''}
    ${r.charts.length ? `<h3>Verlauf in der Leitwarte</h3><div class="sub">Gestrichelte grüne Linie: Missionsstart. Gelbe Nummern: eigene Handlungen (siehe Zeitstrahl).</div>${r.charts.map((_, i) => `<canvas class="rpC" data-i="${i}"></canvas>`).join('')}` : ''}
    ${r.bestellungen.length ? `<h3>Bestellanforderungen</h3><table class="rpT"><tr><th>Pos.</th><th>Artikel</th><th>für</th><th>Typenschild / Anforderungen</th><th>€</th></tr>${r.bestellungen.map((b) => `<tr><td class="n">${b.nr}</td><td>${b.menge} × ${esc(b.name)}${b.eil ? ' (eilt)' : ''}</td><td>${esc(b.fuer)}</td><td>${esc([b.typ, b.anf].filter(Boolean).join(' · ') || '–')}</td><td class="n">${(b.preis * b.menge).toLocaleString('de-DE')}</td></tr>`).join('')}</table>` : ''}
    <h3>Zeitstrahl der Handlungen</h3>
    ${r.ereignisse.length ? `<table class="rpT"><tr><th>Nr.</th><th>Echtzeit</th><th>Anlage</th><th>Handlung</th></tr>${r.ereignisse.map((e) => `<tr><td class="n">${e.nr}</td><td class="n">${e.real}</td><td class="n">${e.sim}</td><td>${esc(e.text)}</td></tr>`).join('')}</table>` : '<p class="sub">Keine Handlungen protokolliert.</p>'}
    ${r.alarme.length ? `<details><summary>Meldungen der Leitwarte (${r.alarme.length})</summary><table class="rpT">${r.alarme.map((e) => `<tr><td class="n">${e.sim}</td><td>${esc(e.text)}</td></tr>`).join('')}</table></details>` : ''}
    <details><summary>Musterlösung und Hintergrund (Lehrkräfte)</summary><p>${esc(r.lehrer)}</p></details>`;
  for (const cv of el.querySelectorAll('.rpC')) {
    const c = r.charts[+cv.dataset.i], w = cv.clientWidth || 640;
    cv.width = Math.round(w * devicePixelRatio); cv.height = Math.round(w * 0.36 * devicePixelRatio);
    zeichneDiagramm(cv, c, r.ereignisse, 'dark');
  }
}

// ------------------------------------------------------------------ PDF
let jsPDFLaden;
function ladeJsPDF() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  jsPDFLaden = jsPDFLaden || new Promise((ok, fail) => {
    const s = document.createElement('script'); s.src = new URL('../vendor/jspdf.umd.min.js', import.meta.url).href;
    s.onload = () => ok(window.jspdf); s.onerror = () => fail(new Error('jsPDF konnte nicht geladen werden')); document.head.appendChild(s);
  });
  return jsPDFLaden;
}
// Standardschriften im PDF kennen nur Latin-1/WinAnsi: Sonderzeichen ersetzen
const pdfText = (t) => String(t).replace(/[−—]/g, '-').replace(/₂/g, '2').replace(/Ω/g, 'Ohm').replace(/[≥]/g, '>=').replace(/×/g, 'x').replace(/³/g, '3').replace(/²/g, '2').replace(/₂/g, '2').replace(/₃/g, '3').replace(/₄/g, '4').replace(/≈/g, 'ca.').replace(/→/g, '->').replace(/–/g, '-').replace(/[“”„]/g, '"').replace(/[✓✗★☆▶⚠🎯]/g, '').replace(/Δ/g, 'Delta ').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF€…‰•]/g, '?');

export async function berichtAlsPDF(r, { musterloesung = false } = {}) {
  const { jsPDF } = await ladeJsPDF();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 16, PW = 210, PH = 297, CW = PW - 2 * M;
  let y = M;
  const neueSeite = (h) => { if (y + h > PH - 16) { doc.addPage(); y = M; } };
  const text = (t, { size = 10, bold = false, color = [30, 35, 41], gap = 1.6, x = M, w = CW } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(pdfText(t), w), lh = size * 0.42;
    for (const l of lines) { neueSeite(lh); doc.text(l, x, y + lh * 0.8); y += lh; }
    y += gap;
  };
  const h2 = (t) => { neueSeite(14); y += 3; doc.setDrawColor(22, 33, 62); doc.setLineWidth(0.4); doc.line(M, y, PW - M, y); y += 2; text(t, { size: 12.5, bold: true, color: [22, 33, 62], gap: 1.5 }); };
  const tabelle = (kopf, zeilen, breiten) => {
    const lh = 4.2, pad = 1.2;
    const zeile = (cells, bold, fill) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(9);
      const split = cells.map((c, i) => doc.splitTextToSize(pdfText(c), breiten[i] - 2 * pad));
      const h = Math.max(...split.map((s) => s.length)) * lh + 2 * pad - 0.8;
      neueSeite(h);
      if (fill) { doc.setFillColor(...fill); doc.rect(M, y, CW, h, 'F'); }
      let x = M; doc.setTextColor(30, 35, 41);
      split.forEach((s, i) => { s.forEach((l, j) => doc.text(l, x + pad, y + pad + lh * (j + 0.75))); x += breiten[i]; });
      doc.setDrawColor(220, 224, 228); doc.setLineWidth(0.2); doc.line(M, y + h, PW - M, y + h);
      y += h;
    };
    zeile(kopf, true, [236, 240, 244]); zeilen.forEach((z, i) => zeile(z, false, i % 2 ? [248, 249, 250] : null)); y += 3;
  };

  // Kopf
  doc.setFillColor(22, 33, 62); doc.rect(0, 0, PW, 30, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text(pdfText(`Missionsbericht: ${r.titel}`), M, 14);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.text(pdfText(`Abfall- & Energiezentrum Schwierbach · 3D-Kontrollgang · ${r.bereich}`), M, 21);
  doc.text(pdfText(r.datum), PW - M, 21, { align: 'right' });
  y = 38;
  tabelle(['Name', 'Dauer (Echtzeit)', 'Simulationszeit', 'Modus'], [[r.name || '—', r.dauer, `${r.simVon} – ${r.simBis} (×${r.speed})`, r.exam ? 'Prüfung' : 'Lernen']], [44, 30, 70, CW - 144]);
  h2('Auftrag'); text(r.auftrag, { size: 10 });

  if (r.checks.length) {
    h2(`Ergebnis: ${r.checks.filter((c) => c.ok).length} von ${r.checks.length} Schritten erfüllt`);
    for (const c of r.checks) {
      neueSeite(10);
      doc.setFillColor(...(c.ok ? [30, 142, 90] : [214, 48, 49])); doc.circle(M + 2, y + 2.4, 1.8, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(c.ok ? 'ok' : '–', M + 2, y + 3.3, { align: 'center' });
      text(c.text, { size: 10, bold: true, x: M + 6, w: CW - 6, gap: 0.3 });
      if (c.warum) text(c.warum, { size: 8.8, color: [90, 98, 108], x: M + 6, w: CW - 6, gap: 1.6 });
    }
  }
  if (r.kennzahl) { h2('Energie / Kennzahl'); text(r.kennzahl, { size: 10 }); }
  if (r.hinweise.length) { h2('Beobachtungen zum Vorgehen'); for (const h of r.hinweise) text(`•  ${h}`, { size: 9.6 }); }
  if (r.werte.length) { h2('Prozesswerte zu Beginn und am Ende'); tabelle(['Größe', 'Start', 'Ende', 'Einheit'], r.werte, [86, 30, 30, CW - 146]); }
  if (r.charts.length) {
    h2('Verlauf in der Leitwarte');
    text('Gestrichelte grüne Linie: Missionsstart. Nummern: eigene Handlungen laut Zeitstrahl.', { size: 8.8, color: [90, 98, 108] });
    for (const c of r.charts) {
      const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 504;
      zeichneDiagramm(cv, c, r.ereignisse, 'light');
      const h = CW * 0.36; neueSeite(h + 3);
      doc.addImage(cv.toDataURL('image/png'), 'PNG', M, y, CW, h); y += h + 3;
    }
  }
  if (r.bestellungen.length) { h2('Bestellanforderungen'); tabelle(['Pos.', 'Artikel', 'für', 'Typenschild / Anforderungen', 'Euro'], r.bestellungen.map((b) => [String(b.nr), `${b.menge} x ${b.name}${b.eil ? ' (eilt)' : ''}`, b.fuer, [b.typ, b.anf].filter(Boolean).join(' · ') || '-', (b.preis * b.menge).toLocaleString('de-DE')]), [10, 70, 24, CW - 122, 18]); }
  h2('Zeitstrahl der Handlungen');
  if (r.ereignisse.length) tabelle(['Nr.', 'Echtzeit', 'Anlage', 'Handlung'], r.ereignisse.map((e) => [String(e.nr), e.real, e.sim, e.text]), [10, 18, 24, CW - 52]);
  else text('Keine Handlungen protokolliert.');
  if (r.meldungen.length) { h2('Meldung an die Schichtleitung'); for (const m of r.meldungen) text(m, { size: 10 }); }
  if (r.alarme.length) { h2('Meldungen der Leitwarte'); tabelle(['Anlage', 'Meldung'], r.alarme.map((e) => [e.sim, e.text]), [24, CW - 24]); }
  if (musterloesung) { h2('Musterlösung und Hintergrund'); text(r.lehrer, { size: 9.6 }); }

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(140, 146, 154);
    doc.text(pdfText(`Abfall- & Energiezentrum Schwierbach · Missionsbericht „${r.titel}“${r.name ? ` · ${r.name}` : ''}`), M, PH - 8);
    doc.text(`Seite ${i} / ${n}`, PW - M, PH - 8, { align: 'right' });
  }
  const datei = `Missionsbericht_${r.titel.replace(/[^A-Za-zÄÖÜäöüß0-9]+/g, '_')}${r.name ? `_${r.name.replace(/[^A-Za-zÄÖÜäöüß0-9]+/g, '_')}` : ''}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(datei);
  return datei;
}
