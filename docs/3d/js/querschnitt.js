// Querschnitt durch die Deponie (Böschung vom Böschungsfuß bis zum Plateau) mit Gasbrunnen GB 1.03,
// Anschlussleitung zur Gassammelstation GS 1, Oberflächen- und Basisabdichtung (DK II) und Detail A (Brunnendurchführung).
// SVG, maßstäblich in Länge und Höhe; der Brunnen ist zur Lesbarkeit breiter gezeichnet.
import { sim } from './anlage-sim.js';
import { brunnenWerte, BRUNNEN } from './gas-modell.js';
import { f1 } from './instrumente.js';

const $ = (id) => document.getElementById(id);
const S = 9.5, X0 = -22, PX = (x) => 60 + (x - X0) * S, PY = (y) => 560 - y * S;
const surf = (x) => x < 0 ? 0 : x < 30 ? x / 3 : x < 36 ? 10 : x < 66 ? 10 + (x - 36) / 3 : x < 72 ? 20 : 20 + (x - 72) / 3;
const XE = 92, BASIS = -1, DECKE = 2.3;

const INFO = {
  rekult: ['Rekultivierungsschicht', 'Mindestens 1 m durchwurzelbarer Boden mit Bewuchs. Sie speichert Niederschlag, schützt die Dichtung vor Austrocknung, Frost und Wurzeln – und nimmt frostfrei die Gasleitungen auf.'],
  entw: ['Entwässerungsschicht', 'Kies oder Dränmatte (≥ 0,3 m). Leitet versickerndes Niederschlagswasser oberhalb der Dichtung seitlich ab, damit sich kein Wasser auf der Dichtung staut.'],
  dicht: ['Oberflächenabdichtung', 'Bei Deponieklasse II zwei Abdichtungskomponenten, z. B. Kunststoffdichtungsbahn (2,5 mm HDPE) auf mineralischer Dichtung. Sie hält Niederschlag vom Abfall fern und verhindert, dass Deponiegas unkontrolliert entweicht.'],
  ausgl: ['Ausgleichs- und Gasdränschicht', 'Profiliert die Oberfläche und verteilt Gas, das unter der Dichtung ankommt, zu den Brunnen. Ohne sie würde sich Gas unter der Dichtung stauen.'],
  abfall: ['Abfallkörper (Siedlungsabfall, Altabschnitt)', 'Organische Bestandteile werden ohne Sauerstoff (anaerob) abgebaut – es entsteht Deponiegas aus etwa 50–60 % Methan und 40–50 % Kohlendioxid. Im Inneren 35–50 °C. Durch Abbau und Verdichtung setzt sich der Körper über Jahre um bis zu 20–30 % seiner Höhe.'],
  basis: ['Basisabdichtung', 'Von oben: Flächendrainage (≥ 0,3 m Kies) mit Sickerwasserrohren, Schutzschicht, Kunststoffdichtungsbahn und mineralische Dichtung. Sie hält Sickerwasser vom Grundwasser fern.'],
  barriere: ['Geologische Barriere', 'Natürlich anstehender, gering durchlässiger Untergrund (k ≤ 10⁻⁹ m/s, ≥ 1 m mächtig) – die „letzte Verteidigungslinie“ unter der technischen Abdichtung.'],
  sw: ['Sickerwasserrohr', 'Gelochtes Rohr in der Flächendrainage. Das Sickerwasser fließt mit Gefälle zum Sickerwasserschacht und wird zur Behandlung gepumpt (hier: Sickerwasserspeicher SWS-1).'],
  bohr: ['Bohrung mit Kiesschüttung', 'Bohrung Ø 800 mm, endet mindestens 2 m über der Basisabdichtung, damit diese nicht beschädigt wird. Im Bereich der Filterstrecke mit Kies 16/32 verfüllt – das Gas strömt aus dem Abfall durch den Kies zum Filterrohr.'],
  filter: ['Filterrohr (gelocht/geschlitzt)', `HDPE-Rohr DN 200, Filterstrecke ${BRUNNEN.filter}. Durch die Schlitze strömt das Gas ins Rohr. Liegt die Filterstrecke zu nah an der Oberfläche, wird über die Abdeckung Luft angesaugt („Kurzschluss“).`],
  voll: ['Vollrohr mit Tonabdichtung', 'Oberhalb der Filterstrecke ungelochtes Rohr. Der Ringraum ist mit Ton/Bentonit abgedichtet, damit keine Luft von oben in den Brunnen gezogen wird.'],
  kopf: ['Brunnenkopf', 'Abschluss mit Teleskop-Ausgleich (der Abfallkörper setzt sich, das Rohr muss nachgeben können), Mess- und Probenahmestutzen und Anschluss der Gasleitung. Die Durchführung durch die Oberflächenabdichtung ist mit einer angeschweißten Manschette dicht angeschlossen (Detail A).'],
  leit: ['Anschlussleitung zur Sammelstation', 'PE-Rohr d 90, frostfrei in der Rekultivierungsschicht verlegt, durchgehend mit Gefälle (≥ 3 %) zur Sammelstation. Im Gas kondensiert Wasserdampf – er muss mit dem Gefälle ablaufen, sonst bildet sich in Senken ein Wassersack.'],
  gs: ['Gassammelstation GS 1', 'Tiefster Punkt der Anschlussleitungen. Für jeden Brunnen eine Regelarmatur und ein Messstutzen: Hier wird jeder Brunnen einzeln eingeregelt und beprobt. Der Kondensatschacht sammelt das Kondensat aller Leitungen.'],
  kond: ['Kondensatschacht', 'Sammelt das in den Leitungen abgeschiedene Kondensat (über einen Siphon gasdicht). Es wird abgepumpt und wie Sickerwasser behandelt.'],
  ring: ['Ringleitung', 'PE-Hauptsammler am Böschungsfuß, verbindet alle Sammelstationen mit der Gasverdichterstation. Auch sie liegt mit Gefälle zu Kondensatabscheidern.'],
  graben: ['Randgraben', 'Fasst das von der Oberfläche abfließende, unbelastete Niederschlagswasser.'],
  setz: ['Setzung mit Wassersack', 'Der Abfallkörper hat sich unter der Berme ungleichmäßig gesetzt. Die Leitung hat jetzt ein Gegengefälle: Kondensat sammelt sich in der Senke, das Gas drückt sich stoßweise hindurch – Druckschwankungen bis zur Verdichterstation, im Extremfall ist die Leitung ganz verschlossen. Abhilfe: Leitung neu mit Gefälle verlegen oder Kondensatabscheider am Tiefpunkt setzen.'],
  detailA: ['Detail A – Brunnendurchführung', 'Vergrößerter Schichtaufbau der Oberflächenabdichtung an der Durchführung des Brunnens: Die Kunststoffdichtungsbahn ist über eine Manschette dicht an das Vollrohr angeschlossen, darunter die Tonabdichtung im Ringraum.'],
};

function poly(pts, k, fill, extra = '') { return `<polygon data-k="${k}" points="${pts.map(([x, y]) => `${PX(x).toFixed(1)},${PY(y).toFixed(1)}`).join(' ')}" fill="${fill}" ${extra}/>`; }
function band(k, fill, d0, d1, x0, x1, step = 1) { // Schicht zwischen Tiefe d0 und d1 unter der Oberfläche
  const top = [], bot = [];
  for (let x = x0; x <= x1 + 1e-6; x += step) { top.push([x, surf(x) - d0]); bot.push([x, surf(x) - d1]); }
  return poly([...top, ...bot.reverse()], k, fill);
}
const pth = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${PX(x).toFixed(1)},${PY(y).toFixed(1)}`).join(' ');
function label(t, x, y, lx, ly, k) { return `<g data-k="${k}"><line x1="${PX(x)}" y1="${PY(y)}" x2="${lx}" y2="${ly}" stroke="#2d3436" stroke-width="0.8"/><circle cx="${PX(x)}" cy="${PY(y)}" r="2" fill="#2d3436"/><text x="${lx + (lx > PX(x) ? 3 : -3)}" y="${ly + 4}" font-size="12.5" text-anchor="${lx > PX(x) ? 'start' : 'end'}" fill="#2d3436" style="paint-order:stroke" stroke="#eef3f6" stroke-width="3">${t}</text></g>`; }

function zeichnen(setz) {
  const BW = 35, xs = [];
  for (let x = 0; x <= XE; x += 1) xs.push(x);
  const sag = (x) => setz && x > 28 && x < 36.5 ? -0.75 * Math.sin(Math.PI * (x - 28) / 8.5) : 0, sf = (x) => surf(x) + sag(x);
  // Leitungsverlauf: Brunnenkopf → Berme (0,8 m tief) → Böschung → Böschungsfuß → GS 1
  const leit = [[BW - 0.2, 10.9], [BW - 1.1, 10.9], [BW - 1.6, 9.25 + sag(BW - 1.6)]];
  for (let x = 33; x >= 30.5; x -= 0.5) leit.push([x, 10 - 0.75 - (33.4 - x) * 0.03 + sag(x)]);
  for (let x = 29; x >= 0; x -= 1) leit.push([x, surf(x) - 0.85]);
  leit.push([-2, -0.9], [-12.6, -1.05]);
  const s = [];
  s.push(`<svg viewBox="0 0 1200 640" xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif">`);
  s.push(`<defs><pattern id="pAb" width="14" height="10" patternUnits="userSpaceOnUse"><rect width="14" height="10" fill="#8d7b68"/><path d="M1 3h5M8 7h4M3 8h2" stroke="#6d5d4d" stroke-width="1.4"/></pattern>
    <pattern id="pKies" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#cfc6b0"/><circle cx="2" cy="2" r="1.1" fill="#9c917a"/><circle cx="5" cy="5" r="0.9" fill="#9c917a"/></pattern>
    <pattern id="pBar" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#b49a77"/><path d="M0 10L10 0" stroke="#9a805e" stroke-width="1"/></pattern>
    <marker id="mA" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#e17055"/></marker></defs>`);
  // Untergrund und geologische Barriere
  s.push(`<rect x="0" y="${PY(0)}" width="1200" height="${640 - PY(0)}" fill="#a68a64" data-k="barriere"/>`);
  s.push(poly([[-1.5, BASIS - 0.95], [XE, BASIS - 0.95], [XE, -6.5], [-1.5, -6.5]], 'barriere', 'url(#pBar)'));
  // Basisabdichtung (unter dem gesamten Deponiekörper, am Rand hochgezogen)
  s.push(poly([[-1.5, 0], [XE, 0], [XE, BASIS - 0.95], [-1.5, BASIS - 0.95]], 'basis', '#5d6d7e'));
  s.push(poly([[-0.8, 0], [XE, 0], [XE, BASIS - 0.35], [-0.8, BASIS - 0.35]], 'basis', 'url(#pKies)'));
  s.push(`<circle data-k="sw" cx="${PX(4)}" cy="${PY(BASIS - 0.15)}" r="4.5" fill="#2d3436" stroke="#dfe6e9" stroke-width="1"/>`);
  // Abfallkörper bis Unterkante Oberflächenabdichtung
  { const top = xs.map((x) => [x, sf(x) - DECKE]).filter(([x]) => x >= 0); s.push(poly([[0, 0], ...top.map(([x, y]) => [x, Math.max(0, y)]), [XE, 0]], 'abfall', 'url(#pAb)')); }
  // Oberflächenabdichtung: Ausgleich/Gasdrän, Dichtung, Entwässerung, Rekultivierung
  const L = [['ausgl', '#c9b27c', 1.8, 2.3], ['dicht', '#2d3436', 1.3, 1.8], ['entw', '#d0d7dd', 1.0, 1.3], ['rekult', '#6a8f4e', 0, 1.0]];
  for (const [k, c, d0, d1] of L) { const top = [], bot = []; for (const x of xs) { top.push([x, Math.max(0, sf(x) - d0)]); bot.push([x, Math.max(0, sf(x) - d1)]); } s.push(poly([...top, ...bot.reverse()], k, c)); }
  s.push(`<path d="${pth(xs.map((x) => [x, sf(x) - 1.3]))}" stroke="#111" stroke-width="1.6" fill="none" data-k="dicht"/>`);
  // Gelände außerhalb, Randgraben
  s.push(poly([[X0, 0], [-10, 0], [-9, -1], [-7, -1], [-6, 0], [-1.5, 0], [-1.5, -0.6], [X0, -0.6]], 'graben', '#6a8f4e'));
  s.push(`<path d="${pth([[-9.6, -0.6], [-9, -0.95], [-7, -0.95], [-6.4, -0.6]])}" fill="#74b9ff" stroke="none" data-k="graben"/>`);
  // Gras-/Oberflächenlinie
  s.push(`<path d="${pth([[X0, 0], [-10, 0], [-9, -1], [-7, -1], [-6, 0], ...xs.map((x) => [x, sf(x)])])}" stroke="#3d6b2a" stroke-width="2" fill="none"/>`);
  // Brunnen (Bohrung breiter gezeichnet)
  const bw = 1.1, fb = 1.6, ft = 7.2, ub = sf(BW) - DECKE;
  s.push(poly([[BW - bw, 1], [BW + bw, 1], [BW + bw, ft + 0.4], [BW - bw, ft + 0.4]], 'bohr', 'url(#pKies)', 'stroke="#7f8c8d" stroke-width="0.6"'));
  s.push(poly([[BW - bw, ft + 0.4], [BW + bw, ft + 0.4], [BW + bw, ub], [BW - bw, ub]], 'voll', '#7f6a4f'));
  s.push(poly([[BW - 0.35, fb], [BW + 0.35, fb], [BW + 0.35, ft], [BW - 0.35, ft]], 'filter', '#2f3a40'));
  for (let y = fb + 0.3; y < ft - 0.1; y += 0.45) s.push(`<line data-k="filter" x1="${PX(BW - 0.35) + 1.5}" x2="${PX(BW + 0.35) - 1.5}" y1="${PY(y)}" y2="${PY(y)}" stroke="#dfe6e9" stroke-width="1.2" stroke-dasharray="2 2"/>`);
  s.push(poly([[BW - 0.35, ft], [BW + 0.35, ft], [BW + 0.35, sf(BW) + 1.1], [BW - 0.35, sf(BW) + 1.1]], 'voll', '#3d4a52'));
  s.push(poly([[BW - 0.85, sf(BW)], [BW + 0.85, sf(BW)], [BW + 0.85, sf(BW) + 0.45], [BW - 0.85, sf(BW) + 0.45]], 'kopf', '#95a5a6'));
  s.push(poly([[BW - 0.5, sf(BW) + 1.1], [BW + 0.5, sf(BW) + 1.1], [BW + 0.5, sf(BW) + 1.3], [BW - 0.5, sf(BW) + 1.3]], 'kopf', '#2d3436'));
  s.push(`<line data-k="kopf" x1="${PX(BW + 0.35)}" y1="${PY(sf(BW) + 0.95)}" x2="${PX(BW + 1.0)}" y2="${PY(sf(BW) + 0.95)}" stroke="#636e72" stroke-width="3"/><rect data-k="kopf" x="${PX(BW + 0.8)}" y="${PY(sf(BW) + 1.12)}" width="6" height="3" fill="#c0392b"/>`);
  // Anschlussleitung
  s.push(`<path data-k="leit" d="${pth(leit)}" stroke="#e1b12c" stroke-width="5" fill="none" stroke-linejoin="round"/>`);
  // Setzung: Wassersack
  if (setz) {
    const tief = leit.filter(([x]) => x > 29 && x < 34.4), yMin = Math.min(...tief.map(([, y]) => y)), wl = yMin + 0.17;
    const w = tief.filter(([, y]) => y < wl); if (w.length > 1) s.push(`<path data-k="setz" d="${pth(w)}" stroke="#0984e3" stroke-width="3.2" fill="none"/>`);
    s.push(`<g data-k="setz"><circle cx="${PX(32.4)}" cy="${PY(yMin) - 1}" r="2" fill="#fff"><animate attributeName="cy" values="${PY(yMin)};${PY(yMin) - 6}" dur="1.7s" repeatCount="indefinite"/></circle></g>`);
    s.push(label('Setzung → Wassersack', 32.4, yMin, PX(25), PY(19), 'setz'));
  }
  // Gassammelstation GS 1 mit Kondensatschacht, Ringleitung
  s.push(poly([[-18.5, 0], [-13.8, 0], [-13.8, 3.0], [-18.5, 3.0]], 'gs', 'rgba(149,165,166,.35)', 'stroke="#636e72" stroke-width="1"'));
  s.push(poly([[-19, 3.0], [-13.3, 3.0], [-13.3, 3.15], [-19, 3.15]], 'gs', '#7f8c8d'));
  s.push(`<line data-k="gs" x1="${PX(-17.6)}" y1="${PY(1)}" x2="${PX(-14.2)}" y2="${PY(1)}" stroke="#7d868c" stroke-width="5"/>`);
  s.push(`<circle data-k="gs" cx="${PX(-14.6)}" cy="${PY(1.25)}" r="5" fill="none" stroke="#2d3436" stroke-width="2"/>`);
  s.push(poly([[-13.3, 0], [-11.9, 0], [-11.9, -1.8], [-13.3, -1.8]], 'kond', '#bdc3c7', 'stroke="#636e72" stroke-width="1"'));
  s.push(`<path data-k="kond" d="${pth([[-13.3, -1.6], [-11.9, -1.6], [-11.9, -1.8], [-13.3, -1.8]])}" fill="#0984e3"/>`);
  s.push(`<path data-k="leit" d="${pth([[-12.6, -1.05], [-12.6, 0.4], [-14.2, 0.4], [-14.2, 1]])}" stroke="#e1b12c" stroke-width="4" fill="none"/>`);
  s.push(`<circle data-k="ring" cx="${PX(-20.2)}" cy="${PY(0.6)}" r="${0.2 * S + 2}" fill="#e1b12c" stroke="#7f6a00" stroke-width="1"/><rect data-k="ring" x="${PX(-20.6)}" y="${PY(0.35)}" width="${0.8 * S}" height="${0.35 * S}" fill="#555"/>`);
  s.push(`<path data-k="gs" d="${pth([[-17.6, 1], [-20.2, 1], [-20.2, 0.8]])}" stroke="#7d868c" stroke-width="4" fill="none"/>`);
  // Strömung
  s.push(`<g id="qsFlowG">`);
  const fl = (pts) => `<path class="qsFlow" d="${pth(pts)}" stroke="#e17055" stroke-width="2.2" fill="none" marker-end="url(#mA)"/>`;
  for (const [x, y] of [[24, 2.5], [26, 5.5], [44, 3], [47, 6.5], [29, 0.8], [41, 1.2]]) s.push(fl([[x, y], [x + (BW - x) * 0.72, y + (4.4 - y) * 0.6]]));
  s.push(fl([[BW, fb + 0.5], [BW, sf(BW) + 0.8]]));
  s.push(`<path class="qsFlow" d="${pth(leit)} L${PX(-12.6)},${PY(0.4)} L${PX(-14.2)},${PY(0.4)} L${PX(-14.2)},${PY(1)} L${PX(-17.6)},${PY(1)} L${PX(-20.2)},${PY(1)}" stroke="#e17055" stroke-width="1.6" fill="none" opacity="0.9"/>`);
  s.push(`</g><g id="qsKondG"><path class="qsK" d="${pth(leit.map(([x, y]) => [x, y - 0.15]))} L${PX(-12.6)},${PY(-1.6)}" stroke="#0984e3" stroke-width="2.4" fill="none"/></g>`);
  // Detail A (vergrößert, im Himmel)
  const dx = 40, dy = 24, dw = 470, dh = 210, dk = 30;
  s.push(`<g data-k="detailA"><rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" fill="#fff" stroke="#2d3436" stroke-width="1.2" rx="6"/>
    <text x="${dx + 10}" y="${dy + 18}" font-size="13" font-weight="bold" fill="#2d3436">Detail A · Brunnendurchführung (vergrößert)</text></g>`);
  const ax = (m) => dx + 235 + m * dk, ay = (m) => dy + 75 + m * dk;          // m: Meter unter Gelände, Achse Brunnen
  const DL = [['rekult', '#6a8f4e', 0, 1.0, 'Rekultivierungsschicht ≥ 1,0 m'], ['entw', '#d0d7dd', 1.0, 1.3, 'Entwässerungsschicht 0,3 m'], ['dicht', '#2d3436', 1.3, 1.8, 'Dichtung: KDB 2,5 mm + mineralisch'], ['ausgl', '#c9b27c', 1.8, 2.3, 'Ausgleichs-/Gasdränschicht 0,5 m'], ['abfall', 'url(#pAb)', 2.3, 3.8, 'Abfall']];
  for (const [k, c, d0, d1, t] of DL) {
    s.push(`<rect data-k="${k}" x="${dx + 12}" y="${ay(d0)}" width="${dw - 24}" height="${(d1 - d0) * dk}" fill="${c}"/>`);
    s.push(`<text data-k="${k}" x="${dx + 18}" y="${ay((d0 + d1) / 2) + 4}" font-size="11.5" fill="${k === 'dicht' || k === 'abfall' ? '#fff' : '#2d3436'}">${t}</text>`);
  }
  s.push(`<line data-k="dicht" x1="${dx + 12}" x2="${dx + dw - 12}" y1="${ay(1.3)}" y2="${ay(1.3)}" stroke="#000" stroke-width="2.5"/>`);
  s.push(`<rect data-k="voll" x="${ax(-0.55)}" y="${ay(1.8)}" width="${1.1 * dk}" height="${2.0 * dk}" fill="#7f6a4f"/>`);
  s.push(`<rect data-k="voll" x="${ax(-0.16)}" y="${ay(-1.3)}" width="${0.32 * dk}" height="${5.1 * dk}" fill="#3d4a52"/>`);
  s.push(`<path data-k="kopf" d="M${ax(-0.16) - 10},${ay(1.3) - 12} L${ax(-0.16)},${ay(1.3) - 12} L${ax(-0.16)},${ay(1.3)} M${ax(0.16)},${ay(1.3)} L${ax(0.16)},${ay(1.3) - 12} L${ax(0.16) + 10},${ay(1.3) - 12}" stroke="#e17055" stroke-width="3" fill="none"/>`);
  s.push(`<rect data-k="kopf" x="${ax(-0.65)}" y="${ay(-0.4)}" width="${1.3 * dk}" height="${0.4 * dk}" fill="#95a5a6"/><rect data-k="kopf" x="${ax(-0.3)}" y="${ay(-1.4)}" width="${0.6 * dk}" height="${0.18 * dk}" fill="#2d3436"/>`);
  s.push(`<path data-k="leit" d="M${ax(0.16)},${ay(-0.9)} L${ax(1.2)},${ay(-0.9)} Q${ax(1.6)},${ay(-0.9)} ${ax(1.7)},${ay(0.5)} L${ax(7.4)},${ay(0.75)}" stroke="#e1b12c" stroke-width="6" fill="none"/>`);
  for (const [t, x, y, lx, ly, k] of [['Teleskop-Ausgleich, Messstutzen', ax(0), ay(-1.3), ax(1.3), ay(-1.75), 'kopf'], ['Manschette an KDB angeschweißt', ax(0.25), ay(1.25) - 12, ax(2.4), ay(1.55), 'kopf'], ['Tonabdichtung im Ringraum', ax(0.5), ay(2.6), ax(2.4), ay(2.95), 'voll'], ['Anschlussleitung, Gefälle ≥ 3 %', ax(5), ay(0.68), ax(3.2), ay(-0.55), 'leit']])
    s.push(`<g data-k="${k}"><line x1="${x}" y1="${y}" x2="${lx}" y2="${ly}" stroke="#2d3436" stroke-width="0.8"/><text x="${lx + (lx >= x ? 3 : -3)}" y="${ly + 4}" font-size="11.5" text-anchor="${lx >= x ? 'start' : 'end'}" fill="#2d3436" style="paint-order:stroke" stroke="#fff" stroke-width="3">${t}</text></g>`);
  s.push(`<line x1="${dx + dw}" y1="${dy + dh * 0.5}" x2="${PX(BW) - 4}" y2="${PY(sf(BW)) - 4}" stroke="#2d3436" stroke-dasharray="4 3"/><circle cx="${PX(BW)}" cy="${PY(sf(BW) - 1)}" r="${2.3 * S}" fill="none" stroke="#2d3436" stroke-dasharray="4 3"/><text x="${PX(BW) + 2.4 * S}" y="${PY(sf(BW) - 1) - 2.2 * S}" font-size="13" font-weight="bold">A</text>`);
  // Beschriftungen
  s.push(label('Gasbrunnen GB 1.03', BW, sf(BW) + 1.3, PX(BW) + 40, PY(16.5), 'kopf'));
  s.push(label('Filterrohr in Kiesschüttung', BW + 0.35, 4.3, PX(52), PY(8.2), 'filter'));
  s.push(label('Bohrung Ø 800, endet ≥ 2 m über Basis', BW + 1.1, 1.2, PX(55), PY(4.0), 'bohr'));
  s.push(label('Abfallkörper – anaerober Abbau, Methanbildung', 60, 8, PX(64), PY(13.5), 'abfall'));
  s.push(label('Oberflächenabdichtung (Detail A)', 52, surf(52) - 1.5, PX(56), PY(25.5), 'dicht'));
  s.push(label('Rekultivierungsschicht', 80, surf(80) - 0.4, PX(78), PY(31), 'rekult'));
  s.push(label('Anschlussleitung mit Gefälle zur GS', 15, surf(15) - 0.85, PX(10), PY(10), 'leit'));
  s.push(label('Basisabdichtung mit Flächendrainage', 70, BASIS - 0.5, PX(74), PY(-3.4), 'basis'));
  s.push(label('Sickerwasserrohr', 4, BASIS - 0.15, PX(9), PY(-3.6), 'sw'));
  s.push(label('Geologische Barriere', 40, -4.5, PX(36), PY(-5.4), 'barriere'));
  s.push(label('Gassammelstation GS 1', -16, 3.1, PX(-12), PY(7.2), 'gs'));
  s.push(label('Kondensatschacht', -12.6, -1.7, PX(-7.5), PY(-2.6), 'kond'));
  s.push(label('Ringleitung → Verdichterstation', -20.2, 0.6, PX(-17), PY(-5.4), 'ring'));
  s.push(label('Randgraben', -8, -0.9, PX(-5), PY(4.6), 'graben'));
  s.push(`<text x="${PX(BW) - 22}" y="${PY(sf(BW) + 3.2)}" font-size="12" text-anchor="end" fill="#2d3436" id="qsPB"></text>`);
  s.push(`<text x="${PX(-16)}" y="${PY(4.6)}" font-size="12" text-anchor="middle" fill="#2d3436" id="qsPG"></text>`);
  // Maßstab
  s.push(`<g transform="translate(${PX(70)},${PY(-6.3) + 6})"><rect width="${10 * S}" height="5" fill="#2d3436"/><rect width="${5 * S}" height="5" fill="#fff" stroke="#2d3436"/><text x="${10 * S + 6}" y="6" font-size="11">10 m (Brunnen breiter dargestellt)</text></g>`);
  s.push('</svg>');
  return s.join('\n');
}

export function initQuerschnitt(ui) {
  ui.overlays.push('qs');
  let sel = null, timer = null;
  const zeige = (k) => { const [t, x] = INFO[k]; $('qsInfo').innerHTML = `<b>${t}</b><br>${x}`; for (const e of document.querySelectorAll('#qsSvg .sel')) e.classList.remove('sel'); for (const e of document.querySelectorAll(`#qsSvg [data-k="${k}"]`)) e.classList.add('sel'); sel = k; };
  const render = () => {
    $('qsSvg').innerHTML = zeichnen($('qsSetz').checked);
    $('qsFlowG').style.display = $('qsGas').checked ? '' : 'none'; $('qsKondG').style.display = $('qsKond').checked ? '' : 'none';
    if (sel) zeige(sel); live();
  };
  const live = () => {
    const G = sim.G; if (!G || !G.br) return; const b = brunnenWerte(G);
    $('qsLive').textContent = `Live: PI 801 −${f1(G.pn)} mbar · GS 1 −${f1(b.pGs)} mbar · GB 1.03 −${f1(b.pB)} mbar · CH₄ ${f1(b.ch4)} % · O₂ ${f1(b.o2)} %`;
    const pb = $('qsPB'), pg = $('qsPG'); if (pb) pb.textContent = `≈ −${f1(b.pB)} mbar`; if (pg) pg.textContent = `≈ −${f1(b.pGs)} mbar`;
  };
  $('qsSvg').onclick = (e) => { const t = e.target.closest('[data-k]'); if (t) zeige(t.dataset.k); };
  for (const id of ['qsGas', 'qsKond']) $(id).onchange = () => { $('qsFlowG').style.display = $('qsGas').checked ? '' : 'none'; $('qsKondG').style.display = $('qsKond').checked ? '' : 'none'; };
  $('qsSetz').onchange = () => { render(); if ($('qsSetz').checked) zeige('setz'); };
  $('qsClose').onclick = () => { $('qs').style.display = 'none'; clearInterval(timer); };
  return {
    open() { render(); if (!sel) $('qsInfo').innerHTML = '<b>Teil antippen</b> – Schichten, Brunnen, Leitung und Sammelstation werden hier erläutert. Die rote Strichlinie zeigt den Gasweg, die blaue das Kondensat.'; $('qs').style.display = 'flex'; clearInterval(timer); timer = setInterval(live, 1000); },
  };
}
