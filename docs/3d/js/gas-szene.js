// Gasverdichterstation begehbar: Vor-Ort-Instrumente und Bedienelemente an V1/V2, Kondensatabscheider,
// Flammendurchschlagsicherung, Gasanalyse, Steuerung, Gaswarnanlage, Ex-Zonenplan, Hauptsammler mit
// (optional) abgesacktem Auflager, Fackel und BHKW. Geometrie der Verdichter: index.html (INT).
import * as THREE from 'three';
import { PG, GEB, MOT, RIEMEN, EXZONEN, vName, setWahl, setRep, setSchloss, einschaltversuch, setKlappe, setEnt, quittieren, setMotorschutz,
  riemenschutz, nachspannen, oelNachfuellen, k1Ablassen, k1Spuelen, siphonAuffuellen, wsUnterbauen, gaswarngeraet, messung } from './gas-modell.js';
import { sim, logA } from './anlage-sim.js';
import { f1, f0, noise, gauge, lcd, lamp, plate, senses, makeInstFactory } from './instrumente.js';

const WAHL = { hand: 'HAND', '0': '0', auto: 'AUTO' };
const G = () => sim.G;

export function buildGasstation(scene, h, INT, hooks = {}) {
  const { box, M, std } = h;
  const toast = hooks.toast || (() => {});
  const makeInst = makeInstFactory(scene, M);
  const cx = 165, cz = -40, X = (v) => cx + v;
  const peM = std(0xe2b53a, { r: 0.55 }), holz = std(0x9c7448, { r: 0.9 });
  const tube = (pts, r) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal', 0.3), 40, r, 10, false), peM);
  const noCol = (o) => { o.traverse((m) => { m.userData.noCol = true; }); return o; };

  // ---------------------------------------------------------------- Beleuchtung, Abblaseleitungen
  for (const x of [X(-4), X(3)]) { const l = new THREE.PointLight(0xfff2d6, 14, 14, 1.6); l.position.set(x, 3.4, cz); scene.add(l); }
  for (const i of [0, 1]) {
    const z0 = cz + (i ? 2.2 : -2.2), s = i ? -1 : 1;
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.2, 8), M.steel); v.position.set(X(-1.3), 2.6, z0 + s * 0.28); noCol(v); scene.add(v);
    box(scene, 0.12, 0.12, 0.12, std(0xc0392b), X(-1.3), 1.2, z0 + s * 0.28, 0, false);
    const o = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 14).rotateX(Math.PI / 2), std(0xf5f6fa, { r: 0.2 })); o.position.set(X(1.4), 0.4, z0 + s * 0.32); scene.add(o);
  }
  // ---------------------------------------------------------------- Hauptsammler zwischen Rohrbrücke und Station (gerade / abgesackt)
  const ws = { gerade: new THREE.Group(), sack: new THREE.Group(), holz: null };
  ws.gerade.add(tube([[190, 1.4, -40], [182, 1.4, -40], [174.3, 1.4, -40]], 0.2));
  for (const x of [177, 181, 185]) box(ws.gerade, 0.25, 1.2, 0.25, M.steelDark, x, 0, -40, 0, false);
  ws.sack.add(tube([[190, 1.4, -40], [185, 1.3, -40], [181.4, 0.78, -40], [177.6, 1.25, -40], [174.3, 1.4, -40]], 0.2));
  box(ws.sack, 0.25, 1.2, 0.25, M.steelDark, 177, 0, -40, 0, false); box(ws.sack, 0.25, 1.2, 0.25, M.steelDark, 185, 0, -40, 0, false);
  const abgesackt = box(ws.sack, 0.25, 0.5, 0.25, M.steelDark, 181, -0.02, -40, 0, false); abgesackt.rotation.z = 0.18;
  box(ws.sack, 0.9, 0.06, 0.6, M.concreteDark, 181.1, 0, -40, 0, false);
  ws.holz = box(scene, 0.35, 1.18, 0.35, holz, 181.6, 0, -40, 0, false); ws.holz.visible = false;
  scene.add(ws.gerade, ws.sack);
  noCol(ws.gerade); noCol(ws.sack);

  // ---------------------------------------------------------------- Eingang, Ex-Zonenplan, Gaswarnanlage, Gasanalyse
  makeInst('gv_eingang', { name: 'Zugang Gasverdichterstation', tag: 'Ex-Bereich', pos: [X(-5) + 1.05, 1.55, cz - 4.07], rotY: Math.PI, size: 0.5, aspect: 0.7, res: 256,
    info: 'Explosionsgefährdeter Bereich. Zutritt nur für unterwiesenes Personal mit eingeschaltetem persönlichem Gaswarngerät (CH₄/O₂/H₂S). Funkenbildende Arbeiten nur mit Erlaubnisschein; Mobiltelefone und nicht ex-geschützte Geräte bleiben draußen.',
    draw: (ctx, W, Hc) => {
      ctx.fillStyle = '#f5c400'; ctx.fillRect(0, 0, W, Hc); ctx.strokeStyle = '#111'; ctx.lineWidth = W * 0.03; ctx.strokeRect(W * 0.04, W * 0.04, W * 0.92, Hc - W * 0.08);
      ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${W * 0.2}px Arial`; ctx.fillText('Ex', W / 2, Hc * 0.28);
      ctx.font = `bold ${W * 0.075}px Arial`; ctx.fillText('Explosionsgefährdeter', W / 2, Hc * 0.55); ctx.fillText('Bereich', W / 2, Hc * 0.66);
      ctx.font = `${W * 0.06}px Arial`; ctx.fillText('Zutritt nur mit Gaswarngerät', W / 2, Hc * 0.82);
    },
    actions: () => [{ label: G().gaswarn ? 'Gaswarngerät ist eingeschaltet' : 'Persönliches Gaswarngerät einschalten und mitnehmen', fn: () => toast(gaswarngeraet(G(), logA)) }] });
  makeInst('gv_ex', { name: 'Ex-Zonenplan Gasverdichterstation (Auszug Explosionsschutzdokument)', tag: 'Ex-Zonenplan', pos: [X(-6.8), 1.6, cz - 3.72], size: 0.55, aspect: 0.75,
    info: 'Auszug aus dem Explosionsschutzdokument: Einteilung in Zonen und Anforderungen an Betriebsmittel. Ersatzteile für elektrische und nicht elektrische Geräte in Zone 1 müssen mindestens der Gerätekategorie 2G entsprechen.',
    draw: (ctx, W, Hc) => {
      ctx.fillStyle = '#fdfdfb'; ctx.fillRect(0, 0, W, Hc); ctx.fillStyle = '#f5c400'; ctx.fillRect(0, 0, W, Hc * 0.16);
      ctx.fillStyle = '#111'; ctx.font = `bold ${W * 0.07}px Arial`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Ex-Zonenplan Verdichterraum', W * 0.05, Hc * 0.08);
      ctx.fillStyle = '#e17055'; ctx.fillRect(W * 0.08, Hc * 0.28, W * 0.38, Hc * 0.4); ctx.fillStyle = '#fdcb6e'; ctx.fillRect(W * 0.04, Hc * 0.22, W * 0.92, Hc * 0.04);
      ctx.fillStyle = '#111'; ctx.font = `${W * 0.05}px Arial`; ctx.fillText('Zone 1', W * 0.14, Hc * 0.48); ctx.fillText('Zone 2 (Raum)', W * 0.52, Hc * 0.48);
      ctx.font = `${W * 0.045}px Arial`; ctx.fillText('IIA · mind. T3 · Kategorie 2G in Zone 1', W * 0.05, Hc * 0.82);
    },
    detail: (ctx, W, Hc) => {
      ctx.fillStyle = '#1e272e'; ctx.fillRect(0, 0, W, Hc); ctx.fillStyle = '#ffeaa7'; ctx.font = `bold ${W * 0.04}px Arial`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('Explosionsschutzdokument – Auszug Verdichterraum', W * 0.04, Hc * 0.05);
      ctx.fillStyle = '#dfe6e9'; ctx.font = `${W * 0.031}px Arial`;
      const z = []; for (const t of EXZONEN) { const w = t.split(' '); let l = ''; for (const x of w) { if ((l + ' ' + x).length > 58) { z.push(l); l = x; } else l = l ? l + ' ' + x : x; } z.push(l); z.push(''); }
      z.forEach((t, k) => ctx.fillText(t, W * 0.05, Hc * (0.16 + k * 0.06)));
    } });
  makeInst('gv_gw', { name: 'Gaswarnanlage Verdichterraum', tag: 'GWA', pos: [X(-3.2), 1.7, cz - 3.72], size: 0.34, aspect: 0.7,
    info: 'Ortsfeste Gaswarnanlage mit zwei CH₄-Sensoren unter der Decke (Methan ist leichter als Luft). Voralarm 10 % UEG: Zwangslüftung ein. Hauptalarm 20 % UEG: Abschaltung der Verdichter, Alarm in der Leitwarte.',
    draw: (ctx, W, Hc) => { const v = G().gw; lcd(ctx, W, Hc, 'Gaswarnanlage', [`Sensor 1  ${f0(v)} % UEG`, `Sensor 2  ${f0(v * 0.8)} % UEG`, v > 10 ? { t: 'VORALARM', c: '#ff7675' } : 'Normalbetrieb'], { lcdH: 0.6, fs: 0.085 }); } });
  makeInst('gv_ga', { name: 'Gasanalyse Deponiegas', tag: 'QI 801/802', pos: [X(-6.5), 1.4, cz - 3.31], size: 0.42, aspect: 0.62,
    info: 'Kontinuierliche Gasanalyse am Drucksammler (Infrarot für CH₄/CO₂, elektrochemisch für O₂). Steigt O₂ über 2,5 Vol-%, wird irgendwo Luft angesaugt – im Netz durch zu hohen Unterdruck oder an einer Undichtheit in der Station.',
    draw: (ctx, W, Hc) => { const g = G(); lcd(ctx, W, Hc, 'Gasanalyse', [`CH4  ${f1(g.ch4 + noise(0.1, 2))} Vol-%`, `CO2  ${f1(Math.max(0, 96 - g.ch4 * 1.08 - g.o2 * 4.7 + noise(0.1, 3)))} Vol-%`, g.o2 > 2.5 ? { t: `O2   ${f1(g.o2)} Vol-%`, c: '#ff7675' } : `O2   ${f1(g.o2)} Vol-%`], { lcdH: 0.6, fs: 0.09 }); } });

  // ---------------------------------------------------------------- Saugseite gemeinsam: PI 801, Kondensatabscheider, FDS
  makeInst('gv_pi801', { name: 'Manovakuummeter Saugsammler (Eintritt Station)', tag: 'PI 801', pos: [X(7.9), 1.78, cz + 0.24], size: 0.2, round: true,
    info: 'Unterdruck am Eintritt des Hauptsammlers in die Station, vor Kondensatabscheider und Flammendurchschlagsicherung. Auf diesen Wert regelt PIC 801 (Sollwert −35 mbar) über die Drehzahl des Verdichters.',
    draw: (ctx, W) => gauge(ctx, W, { min: -100, max: 0, ticks: 5, unit: 'mbar', tag: 'PI 801', val: -G().pn + noise(0.4, 1) }) });
  makeInst('gv_k1', { name: 'Kondensatabscheider K1 mit Siphon (Tauchtasse)', tag: 'K1', pos: [X(6.6), 1.0, cz + 0.52], size: 0.2, aspect: 1.8, res: 128,
    info: 'Abscheider für das im Gas mitgeführte Kondensat. Das Kondensat läuft über einen Siphon (Tauchtasse mit Sperrwasser) ab. Der Abscheider steht unter Unterdruck: Den Ablasshahn nur bei stehender Absaugung öffnen, sonst wird Luft angesaugt. Ein leerer Siphon lässt ebenfalls Luft in den Gasweg.',
    draw: (ctx, W, Hc) => {
      const g = G(); ctx.fillStyle = '#7f8c8d'; ctx.fillRect(0, 0, W, Hc);
      const x0 = W * 0.25, w = W * 0.5, y0 = Hc * 0.08, hh = Hc * 0.84; ctx.fillStyle = '#ecf0f1'; ctx.fillRect(x0, y0, w, hh);
      const lv = hh * g.k1 / 100; ctx.fillStyle = '#9c8f6a'; ctx.fillRect(x0, y0 + hh - lv, w, lv);
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 - 10, y0 + hh * 0.3); ctx.lineTo(x0 + w + 10, y0 + hh * 0.3); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${W * 0.13}px Arial`; ctx.textAlign = 'left'; ctx.fillText('MAX', 2, y0 + hh * 0.3 - 6);
    },
    detail: (ctx, W, Hc) => {
      const g = G(); ctx.fillStyle = '#1e272e'; ctx.fillRect(0, 0, W, Hc);
      const x0 = W * 0.08, w = W * 0.18, y0 = Hc * 0.08, hh = Hc * 0.84; ctx.fillStyle = '#ecf0f1'; ctx.fillRect(x0, y0, w, hh);
      const lv = hh * g.k1 / 100; ctx.fillStyle = '#9c8f6a'; ctx.fillRect(x0, y0 + hh - lv, w, lv);
      ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 - 8, y0 + hh * 0.3); ctx.lineTo(x0 + w + 8, y0 + hh * 0.3); ctx.stroke();
      ctx.fillStyle = '#dfe6e9'; ctx.font = `${W * 0.04}px Arial`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const lauf = g.g.some((x) => x.run), voll = g.k1 > 85, siph = g.siphon < 30;
      ['Schauglas Kondensatabscheider K1', `Kondensatstand: ${voll ? 'über MAX – Kondensat steht im Gasweg' : g.k1 > 60 ? 'erhöht' : 'normal'}`,
        `Siphon/Tauchtasse: ${siph ? 'kein Sperrwasser sichtbar, Luft blubbert ein' : voll && g.ursache === 'kondensat' && !g.k1gespuelt ? 'kein Ablauf, Schlamm in der Tasse' : 'Sperrwasser vorhanden, Ablauf tropft'}`,
        voll ? 'Gurgelndes Geräusch im Abscheider.' : '', '', `Absaugung: ${lauf ? 'läuft (Unterdruck!)' : 'steht'}`].forEach((t, k) => ctx.fillText(t, W * 0.33, Hc * (0.1 + k * 0.1)));
    },
    actions: () => [
      { label: 'Kondensat über den Ablasshahn ablassen', fn: () => toast(k1Ablassen(G(), logA)) },
      { label: 'Siphon über den Spülanschluss spülen', fn: () => toast(k1Spuelen(G(), logA)) },
      { label: 'Siphon mit Wasser auffüllen', fn: () => toast(siphonAuffuellen(G(), logA)) },
    ] });
  makeInst('gv_pdi', { name: 'Differenzdruck Flammendurchschlagsicherung', tag: 'PDI 803', pos: [X(4.45), 2.22, cz + 0.3], size: 0.3, aspect: 0.55,
    info: 'Druckverlust über der Flammendurchschlagsicherung (Deflagrationssicherung mit Flammenfilter). Normal wenige mbar; ein steigender Differenzdruck zeigt einen zugesetzten Flammenfilter. Das Filterelement ist Teil der Baumusterprüfung und darf nur durch ein baugleiches ersetzt werden.',
    draw: (ctx, W, Hc) => lcd(ctx, W, Hc, 'PDI 803  FDS', [`Δp ${f1(G().pdi)} mbar`], { lcdH: 0.55, fs: 0.15 }) });

  // ---------------------------------------------------------------- Verdichter V1 / V2
  [0, 1].forEach((i) => {
    const z0 = cz + (i ? 2.2 : -2.2), s = i ? -1 : 1, ry = i ? Math.PI : 0, nr = vName(i), x = () => G().g[i];
    const pz = z0 - s * 0.95;
    makeInst(`gv_v${i}`, { name: `Gebläsestufe ${nr} (Drehkolbengebläse)`, tag: nr, pos: [X(1.0), 0.75, z0 + s * 0.33], rotY: ry, size: 0.3, aspect: 0.6, res: 128,
      info: 'Drehkolbengebläse (Roots-Prinzip): Zwei gegenläufige Kolben fördern ohne innere Verdichtung. Antrieb über Keilriemen, Synchronisationszahnräder und Lager in Ölbad (Schaugläser). Typische Prüfungen: Abhören, Lagertemperatur, Schwingung, Drehzahl der Gebläsewelle (Riemenschlupf).',
      draw: plate(nr, '#d6e4f0'),
      detail: (ctx, W, Hc) => {
        const v = x(), l = [];
        if (v.run) {
          l.push(`Läuft, Gebläsewelle ca. ${Math.round(v.nb / 100) * 100} 1/min (FU ${f1(v.f)} Hz).`);
          l.push(v.td > 75 ? 'Druckstutzen und Schalldämpfer sehr heiß.' : 'Druckseite warm, Saugseite kühl.');
          if (v.sv) l.push('Sicherheitsventil bläst zischend ab!');
        } else l.push(v.stoer ? `Steht – Störung: ${v.stoer}` : 'Steht. Kein Geräusch.');
        l.push(`Wahlschalter ${WAHL[v.wahl]}, Reparaturschalter ${v.rep ? 'EIN' : '0'}${v.schloss ? ' (gesichert)' : ''}`);
        l.push(`Riemenschutz ${v.schutzAb ? 'ABGENOMMEN' : 'montiert'}`);
        senses(ctx, W, Hc, `Gebläsestufe ${nr}`, l, v.run);
      },
      actions: () => [
        { label: 'Abhören (Stethoskop)', fn: () => toast(messung(G(), i, 'hoeren', logA)) },
        { label: 'Lagertemperatur messen', fn: () => toast(messung(G(), i, 'temp', logA)) },
        { label: 'Schwingung messen', fn: () => toast(messung(G(), i, 'schw', logA)) },
        { label: 'Drehzahl Gebläsewelle messen (Handtachometer)', fn: () => toast(messung(G(), i, 'tacho', logA)) },
        { label: 'Sichtprüfung Gebläsestufe und Motor', fn: () => toast(messung(G(), i, 'sicht', logA)) },
      ] });
    makeInst(`gv_typ${i}`, { name: `Typenschild Gebläsestufe ${nr}`, tag: `Typenschild ${nr}`, pos: [X(1.78), 0.62, z0 + s * 0.32], rotY: ry, size: 0.16, aspect: 0.7, res: 128,
      info: 'Typenschild der Gebläsestufe. Für Ersatzteile beim Hersteller immer Typ und Serien-Nr. angeben.',
      draw: plate('Typ', '#bdc3c7'),
      detail: (ctx, W, Hc) => {
        ctx.fillStyle = '#c8ccd0'; ctx.fillRect(0, 0, W, Hc); ctx.strokeStyle = '#555'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, W - 16, Hc - 16);
        ctx.fillStyle = '#111'; ctx.font = `bold ${W * 0.045}px Arial`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(GEB.hersteller, W * 0.06, Hc * 0.07);
        ctx.font = `${W * 0.037}px monospace`;
        [`Typ        ${GEB.typ}`, `Serien-Nr. ${GEB.snr[i]}   Baujahr ${GEB.bj}`, `Volumen    ${GEB.vol}`, `Druck      ${GEB.dp}`, `ATEX       ${GEB.atex}`, `Schmierung ${GEB.oel}`].forEach((t, k) => ctx.fillText(t, W * 0.06, Hc * (0.22 + k * 0.11)));
        ctx.fillStyle = '#f5c400'; ctx.fillRect(W * 0.8, Hc * 0.06, W * 0.12, W * 0.1); ctx.fillStyle = '#111'; ctx.font = `bold ${W * 0.05}px Arial`; ctx.fillText('Ex', W * 0.815, Hc * 0.08);
      } });
    makeInst(`gv_oel${i}`, { name: `Ölschauglas Gebläsestufe ${nr}`, tag: `Öl ${nr}`, pos: [X(1.4), 0.4, z0 + s * 0.36], rotY: ry, size: 0.1, round: true, res: 128,
      info: 'Ölstand im Getrieberaum (Synchronisationszahnräder und Lager). Sollstand Schauglasmitte. Zu wenig Öl führt zu erhöhter Lagertemperatur und hartem Laufgeräusch, im Extremfall zum Fressen der Zahnräder.',
      draw: (ctx, W) => { const v = x(); ctx.fillStyle = '#2b2f33'; ctx.fillRect(0, 0, W, W); ctx.fillStyle = '#f5f6fa'; ctx.beginPath(); ctx.arc(W / 2, W / 2, W * 0.42, 0, 7); ctx.fill(); ctx.save(); ctx.beginPath(); ctx.arc(W / 2, W / 2, W * 0.42, 0, 7); ctx.clip(); ctx.fillStyle = '#c69c3f'; ctx.fillRect(0, W * (0.92 - v.oel / 100 * 0.84), W, W); ctx.restore(); ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W * 0.15, W / 2); ctx.lineTo(W * 0.85, W / 2); ctx.stroke(); },
      actions: () => [{ label: 'Öl nachfüllen (Sorte laut Typenschild)', fn: () => toast(oelNachfuellen(G(), i, logA)) }] });
    makeInst(`gv_rs${i}`, { name: `Riemenschutz ${nr}`, tag: `Riementrieb ${nr}`, pos: [X(0.7), 0.95, z0 + s * 0.58], rotY: ry, size: 0.42, aspect: 0.32, res: 256,
      info: `Schutzhaube des Keilriementriebs. Nur bei stehendem, gegen Wiedereinschalten gesichertem Antrieb öffnen. Riemen: ${RIEMEN}. Riemen werden immer satzweise getauscht.`,
      draw: (ctx, W, Hc) => { ctx.fillStyle = '#e0a020'; ctx.fillRect(0, 0, W, Hc); ctx.fillStyle = '#111'; ctx.font = `bold ${W * 0.06}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Nur bei Stillstand öffnen!', W / 2, Hc * 0.35); ctx.font = `${W * 0.045}px Arial`; ctx.fillText('3 × SPZ 1250 Lw · leitfähig ISO 1813', W / 2, Hc * 0.72); },
      actions: () => {
        const v = x();
        return [
          { label: v.schutzAb ? 'Riemenschutz wieder anbringen' : 'Riemenschutz abnehmen', fn: () => { riemenschutz(G(), i, !v.schutzAb, logA); if (v.schutzAb && v.run) toast('Achtung: Antrieb läuft – offener Riementrieb!'); } },
          { label: 'Riemen begutachten und Spannung prüfen', fn: () => toast(messung(G(), i, 'riemen', logA)) },
          { label: 'Riemen nachspannen (Motorwippe)', fn: () => toast(nachspannen(G(), i, logA)) },
        ];
      } });
    makeInst(`gv_mot${i}`, { name: `Motor ${nr} (Typenschild, Klemmenkasten)`, tag: `M ${nr}`, pos: [X(0), 0.7, z0 + s * 1.28], rotY: ry, size: 0.2, aspect: 0.7, res: 128,
      info: 'Ex-Drehstrommotor mit Kaltleiter. Typenschild mit Ex-Kennzeichnung, Bemessungsdaten und Serien-Nr. Isolationsmessung nur durch die Elektrofachkraft am freigeschalteten Motor.',
      draw: plate('M', '#c8ccd0'),
      detail: (ctx, W, Hc) => {
        ctx.fillStyle = '#c8ccd0'; ctx.fillRect(0, 0, W, Hc); ctx.strokeStyle = '#555'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, W - 16, Hc - 16);
        ctx.fillStyle = '#111'; ctx.font = `bold ${W * 0.045}px Arial`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(MOT.typ, W * 0.06, Hc * 0.07);
        ctx.font = `${W * 0.036}px monospace`;
        [`${MOT.atex}`, `${MOT.bescheinigung}`, `${MOT.p}  ${MOT.n}  ${MOT.u}`, `${MOT.i}  cos φ ${MOT.cos}  ${MOT.ip}  ${MOT.bauform}`, `${MOT.ptc}`, `Nr. ${MOT.snr[i]}`].forEach((t, k) => ctx.fillText(t, W * 0.06, Hc * (0.22 + k * 0.11)));
        ctx.fillStyle = '#f5c400'; ctx.fillRect(W * 0.8, Hc * 0.06, W * 0.12, W * 0.1); ctx.fillStyle = '#111'; ctx.font = `bold ${W * 0.05}px Arial`; ctx.fillText('Ex', W * 0.815, Hc * 0.08);
      },
      actions: () => [
        { label: 'Motorstrom messen (Zangenamperemeter)', fn: () => toast(messung(G(), i, 'strom', logA)) },
        { label: 'Isolationswiderstand messen (freigeschaltet)', fn: () => toast(messung(G(), i, 'iso', logA)) },
      ] });
    makeInst(`gv_pis${i}`, { name: `Manovakuummeter vor ${nr}`, tag: `PI 8${i + 1}1`, pos: [X(1.78), 1.95, z0 + s * 0.2], rotY: ry, size: 0.18, round: true,
      info: 'Unterdruck direkt vor dem Verdichter (nach Saugklappe). Der Unterschied zu PI 801 ist der Druckverlust von Kondensatabscheider, Flammendurchschlagsicherung und Saugklappe.',
      draw: (ctx, W) => gauge(ctx, W, { min: -250, max: 0, ticks: 5, unit: 'mbar', tag: `PI 8${i + 1}1`, val: -x().pin + (x().run ? noise(1, 3 + i) : 0), red: [-250, -150] }) });
    makeInst(`gv_pid${i}`, { name: `Manometer Druckseite ${nr}`, tag: `PI 8${i + 1}2`, pos: [X(-1.0), 0.95, z0 + s * 0.2], rotY: ry, size: 0.18, round: true,
      info: 'Überdruck nach dem Verdichter (vor Rückschlagklappe und Druckschalldämpfer). Saug- plus Druckseite ergibt die Druckerhöhung; das Sicherheitsventil öffnet bei 350 mbar.',
      draw: (ctx, W) => gauge(ctx, W, { min: 0, max: 400, ticks: 4, unit: 'mbar', tag: `PI 8${i + 1}2`, val: x().pout + (x().run ? noise(2, 7 + i) : 0), red: [330, 400] }) });
    makeInst(`gv_ti${i}`, { name: `Thermometer Druckgas ${nr}`, tag: `TI 8${i + 1}2`, pos: [X(-2.0), 1.75, z0 + s * 0.35], rotY: ry, size: 0.16, round: true,
      info: 'Druckgastemperatur nach dem Verdichter. Steigt mit der Druckerhöhung und mit innerem Rückstrom (Verschleiß). Warnung ab 75 °C, Abschaltung bei 100 °C.',
      draw: (ctx, W) => gauge(ctx, W, { min: 0, max: 120, ticks: 6, unit: '°C', tag: `TI 8${i + 1}2`, val: x().td, red: [100, 120] }) });
    const klappe = (id, seite, tag, name, pos, info) => makeInst(id, { name, tag, pos, rotY: ry, size: 0.18, aspect: 0.7, res: 128, info,
      draw: (ctx, W, Hc) => {
        const v = x()[seite === 's' ? 'hs' : 'hd'];
        ctx.fillStyle = '#ecf0f1'; ctx.fillRect(0, 0, W, Hc); ctx.fillStyle = '#111'; ctx.font = `bold ${W * 0.14}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(tag, W / 2, Hc * 0.06);
        ctx.fillStyle = '#b2bec3'; ctx.fillRect(W * 0.1, Hc * 0.48, W * 0.8, Hc * 0.2); ctx.fillStyle = v > 95 ? '#00b894' : v < 3 ? '#d63031' : '#e1b12c'; ctx.fillRect(W * 0.1, Hc * 0.48, W * 0.8 * v / 100, Hc * 0.2);
        ctx.fillStyle = '#111'; ctx.font = `${W * 0.12}px Arial`; ctx.fillText(v < 3 ? 'ZU' : v > 95 ? 'AUF' : `${Math.round(v)} %`, W / 2, Hc * 0.74);
      },
      actions: () => [
        { typ: 'zahl', label: 'Stellung (Handhebel)', wert: Math.round(x()[seite === 's' ? 'hs' : 'hd']), min: 0, max: 100, einheit: '% offen', fn: (v) => setKlappe(G(), i, seite, v, logA) },
        { label: 'Ganz öffnen', fn: () => setKlappe(G(), i, seite, 100, logA) },
        { label: 'Schließen', fn: () => setKlappe(G(), i, seite, 0, logA) },
      ] });
    klappe(`gv_hs${i}`, 's', `HV 8${i + 1}1`, `Saugklappe ${nr}`, [X(2.3), 1.55, z0 + s * 0.25], 'Absperrklappe in der Saugleitung des Verdichters. Im Betrieb ganz offen. Zum Absperren nach der Druckklappe schließen.');
    klappe(`gv_hd${i}`, 'd', `HV 8${i + 1}2`, `Druckklappe ${nr}`, [X(-2.4), 2.12, z0 + s * 0.25], 'Absperrklappe in der Druckleitung zum Drucksammler. Im Betrieb ganz offen. Zum Absperren zuerst schließen – sie trennt den Verdichter vom Druck der Gasabgabe.');
    makeInst(`gv_ent${i}`, { name: `Entspannungsventil ${nr} (Abblaseleitung über Dach)`, tag: `V 8${i + 1}3`, pos: [X(-1.3), 1.42, z0 + s * 0.4], rotY: ry, size: 0.15, aspect: 0.6, res: 128,
      info: 'Entspannt den abgesperrten Verdichter über die Abblaseleitung ins Freie. Erst öffnen, wenn Saug- und Druckklappe geschlossen sind – sonst strömt Gas aus dem Netz ab.',
      draw: (ctx, W, Hc) => { const a = x().ent; ctx.fillStyle = a ? '#ffeaa7' : '#ecf0f1'; ctx.fillRect(0, 0, W, Hc); ctx.fillStyle = '#111'; ctx.font = `bold ${W * 0.15}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`V 8${i + 1}3`, W / 2, Hc * 0.3); ctx.font = `${W * 0.14}px Arial`; ctx.fillText(a ? 'offen' : 'zu', W / 2, Hc * 0.72); },
      actions: () => [{ typ: 'wahl', label: 'Entspannungsventil', wert: x().ent ? 'auf' : 'zu', optionen: [['zu', 'ZU'], ['auf', 'AUF']], fn: (v) => setEnt(G(), i, v === 'auf', logA) }] });
    makeInst(`gv_sk${i}`, { name: `Vor-Ort-Steuerstelle ${nr}`, tag: `=+SK ${nr}`, pos: [X(2.7), 1.36, pz + s * 0.09], rotY: ry, size: 0.32, aspect: 1.0,
      info: 'Vor-Ort-Bedienung: Wahlschalter HAND/0/AUTO (AUTO = Regelung PIC 801, V2 übernimmt automatisch als Reserve) und abschließbarer Reparaturschalter (Lasttrennschalter, ex-geschützt) zum sicheren Freischalten.',
      draw: (ctx, W, Hc) => {
        const v = x();
        lcd(ctx, W, Hc, `=+SK ${nr}`, [`Wahlschalter ${WAHL[v.wahl]}`, `Reparatursch. ${v.rep ? 'EIN' : '0'}${v.schloss ? ' 🔒' : ''}`, v.run ? `FU ${f1(v.f)} Hz` : 'steht', v.stoer ? { t: v.stoer.slice(0, 22), c: '#ff7675' } : `Bh ${f0(v.bh)} h`], { lcdH: 0.52, fs: 0.075 });
        lamp(ctx, W * 0.25, Hc * 0.82, W * 0.05, '#00b894', v.run, 'Betrieb', W);
        lamp(ctx, W * 0.5, Hc * 0.82, W * 0.05, '#d63031', !!v.stoer, 'Störung', W);
        lamp(ctx, W * 0.75, Hc * 0.82, W * 0.05, '#f1c40f', !v.rep, 'Rep.-Sch.', W);
      },
      actions: () => {
        const v = x();
        return [
          { typ: 'wahl', label: 'Wahlschalter', wert: v.wahl, optionen: [['hand', 'HAND'], ['0', '0'], ['auto', 'AUTO']], fn: (w) => setWahl(G(), i, w, logA) },
          { typ: 'wahl', label: 'Reparaturschalter', wert: v.rep ? 'ein' : 'aus', optionen: [['ein', 'EIN'], ['aus', '0']], fn: (w) => { const m = setRep(G(), i, w === 'ein', logA); if (m) toast(m); } },
          { label: v.schloss ? 'Vorhängeschloss entfernen' : 'Vorhängeschloss anbringen (gegen Wiedereinschalten sichern)', fn: () => { const m = setSchloss(G(), i, !v.schloss, logA); if (m) toast(m); } },
          { label: 'Störung quittieren', fn: () => toast(quittieren(G(), i, logA)) },
          { label: 'Wirksamkeit der Freischaltung prüfen (Einschaltversuch)', fn: () => toast(einschaltversuch(G(), i, logA)) },
        ];
      } });
  });

  // ---------------------------------------------------------------- Steuerung / Schaltanlage
  makeInst('gv_st', { name: 'Steuerung Gasverdichterstation', tag: 'Steuerung', pos: [X(5.6), 1.5, cz - 3.31], size: 0.62, aspect: 0.8,
    info: 'Steuerung der Verdichter: Unterdruckregelung PIC 801 über die FU-Frequenz des Führungsverdichters, automatische Umschaltung auf den Reserveverdichter, Motorschutzschalter (Einstellwert = Bemessungsstrom laut Typenschild) und Störungsspeicher.',
    draw: (ctx, W, Hc) => {
      const g = G(), z = (i) => { const v = g.g[i]; return `${vName(i)} ${WAHL[v.wahl].padEnd(4)} ${v.stoer ? 'STÖRUNG' : !v.rep ? 'Rep.-Sch.0' : v.run ? `${f1(v.f)} Hz ${f1(v.amp)} A` : 'bereit'}`; };
      lcd(ctx, W, Hc, 'Steuerung Verdichterstation', [`PIC 801 Ist −${f1(g.pn)} mbar`, `      Soll −${g.sp} mbar`, `FI 801 ${f0(g.q)} Nm³/h`, z(0), z(1)], { lcdH: 0.62, fs: 0.062 });
      lamp(ctx, W * 0.25, Hc * 0.87, W * 0.035, '#d63031', g.g.some((v) => v.stoer), 'Störung', W);
      lamp(ctx, W * 0.5, Hc * 0.87, W * 0.035, '#f1c40f', g.o2 > 2.5, 'O₂ hoch', W);
      lamp(ctx, W * 0.75, Hc * 0.87, W * 0.035, '#00b894', g.g.some((v) => v.run), 'Absaugung', W);
    },
    detail: (ctx, W, Hc) => {
      const g = G(); ctx.fillStyle = '#1e272e'; ctx.fillRect(0, 0, W, Hc);
      ctx.fillStyle = '#0d2310'; ctx.fillRect(W * 0.03, Hc * 0.03, W * 0.94, Hc * 0.42);
      ctx.fillStyle = '#7CFC9a'; ctx.font = `${W * 0.03}px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const z = (i) => { const v = g.g[i]; return `${vName(i)} ${WAHL[v.wahl].padEnd(4)} ${(v.stoer ? 'STÖRUNG' : !v.rep ? 'Rep.-Sch.0' : v.run ? 'Betrieb' : 'bereit').padEnd(10)} ${v.run ? f1(v.f) + ' Hz' : '     '} ${f1(v.amp).padStart(5)} A  MS ${f1(v.ms)} A`; };
      [`PIC 801 Ist −${f1(g.pn)} mbar  Soll −${g.sp} mbar`, `FI 801 ${f0(g.q)} Nm³/h  CH4 ${f1(g.ch4)} %  O2 ${f1(g.o2)} %`, z(0), z(1), `Spannung L1-L2-L3  400 / 401 / 399 V`].forEach((t, k) => ctx.fillText(t, W * 0.05, Hc * (0.06 + k * 0.075)));
      ctx.fillStyle = '#ffeaa7'; ctx.font = `bold ${W * 0.034}px Arial`; ctx.fillText('Störungsspeicher', W * 0.05, Hc * 0.49);
      ctx.fillStyle = '#dfe6e9'; ctx.font = `${W * 0.028}px Arial`;
      const al = Object.values(g.alarme).filter((a) => a.klasse !== 'M').sort((a, b) => b.kommt - a.kommt).slice(0, 4).map((a) => `${a.aktiv ? '● ' : '○ '}${a.text.replace('Deponiegas: ', '')}`);
      [...al, ...g.historie].slice(0, 6).forEach((t, k) => ctx.fillText(t, W * 0.05, Hc * (0.56 + k * 0.058)));
      ctx.fillStyle = '#81ecec'; ctx.font = `${W * 0.027}px Arial`; ctx.fillText('Betriebsanweisung: Motorschutz = Bemessungsstrom laut Typenschild · Unterdruck −35 mbar', W * 0.05, Hc * 0.93);
    },
    actions: () => [
      { typ: 'titel', label: 'Motorschutzschalter (Einstellwert)' },
      { typ: 'zahl', label: 'Motorschutz V1', wert: +G().g[0].ms.toFixed(1), min: 1, max: 20, einheit: 'A', fn: (v) => setMotorschutz(G(), 0, v, logA) },
      { typ: 'zahl', label: 'Motorschutz V2', wert: +G().g[1].ms.toFixed(1), min: 1, max: 20, einheit: 'A', fn: (v) => setMotorschutz(G(), 1, v, logA) },
    ] });

  // ---------------------------------------------------------------- Hauptsammler außen, Fackel, BHKW
  makeInst('gv_ws', { name: 'Hauptsammler PE d 250 (Zulauf zur Station)', tag: 'Hauptsammler', pos: [181.6, 1.95, -39.7], size: 0.36, aspect: 0.45, res: 256,
    info: 'Oberirdisch auf Auflagern verlegter Hauptsammler aus der Ringleitung. Er muss mit Gefälle (≥ 1 %) zum Kondensatabscheider der Station verlegt sein, damit Kondensat abläuft. Sackt ein Auflager ab, sammelt sich Kondensat in der Senke (Wassersack) und das Gas blubbert stoßweise hindurch.',
    draw: plate('Deponiegas', '#f6e58d'),
    detail: (ctx, W, Hc) => {
      const g = G(), sack = g.ws.aktiv && !g.ws.prov;
      senses(ctx, W, Hc, 'Hauptsammler zwischen Rohrbrücke und Station', sack ? ['Die Leitung hängt zwischen zwei Auflagern sichtbar durch,', 'das mittlere Auflager ist abgesackt und schief.', 'Gluckern und stoßweises Rauschen in der Leitung.'] : g.ws.prov ? ['Leitung provisorisch mit Kantholz unterbaut,', 'Gefälle zur Station wiederhergestellt.', 'Kein Gluckern mehr.'] : ['Leitung liegt auf allen Auflagern auf,', 'gleichmäßiges Gefälle zur Station.', 'Strömungsgeräusch unauffällig.'], true);
    },
    actions: () => [
      { label: 'Gefälle prüfen (Wasserwaage / Schlauchwaage)', fn: () => { const g = G(), sack = g.ws.aktiv && !g.ws.prov; const t = sack ? 'Senke von ca. 60 cm zwischen den Auflagern, Gegengefälle von der Station weg.' : 'Gleichmäßiges Gefälle ca. 1,5 % zur Station.'; logA(`Hauptsammler Gefälle geprüft: ${t}`, 'messung'); toast(t); } },
      { label: 'Leitung abhören', fn: () => { const g = G(), sack = g.ws.aktiv && !g.ws.prov; const t = sack ? 'Gluckern, stoßweises Rauschen im Takt der Druckschwankungen.' : 'Gleichmäßiges Strömungsrauschen.'; logA(`Hauptsammler abgehört: ${t}`, 'messung'); toast(t); } },
      { label: 'Leitung provisorisch unterbauen (anheben)', fn: () => toast(wsUnterbauen(G(), logA)) },
    ] });
  makeInst('gv_fk', { name: 'Bedienfeld Hochtemperaturfackel', tag: 'F 902', pos: [152.2, 1.25, -25.93], size: 0.36, aspect: 0.8,
    info: 'Hochtemperaturfackel mit geschlossener Brennkammer (≥ 1.000 °C). Sie verbrennt das Gas, das das BHKW nicht abnehmen kann.',
    draw: (ctx, W, Hc) => { const g = G(); lcd(ctx, W, Hc, 'Fackel F 902', [g.fackel ? 'Betrieb' : 'Bereit', `Gas ${f0(g.qFackel)} Nm³/h`, `Brennraum ${g.fackel ? f0(1020 + noise(8, 2)) : f0(80)} °C`], { lcdH: 0.6, fs: 0.085 }); } });
  makeInst('gv_bh', { name: 'Bedienfeld Deponiegas-BHKW', tag: 'G 901', pos: [148, 1.6, -51.32], size: 0.42, aspect: 0.7,
    info: 'Gasmotor mit Generator. Startbedingungen: ausreichende Gasmenge, CH₄ > 40 Vol-%, O₂ < 2,5 Vol-%. Bei schlechter Gasqualität schaltet das BHKW ab, das Gas geht zur Fackel.',
    draw: (ctx, W, Hc) => { const g = G(); lcd(ctx, W, Hc, 'BHKW G 901', [g.bhkw === 'betrieb' ? `Betrieb ${f0(g.pel)} kW` : { t: 'AUS', c: '#ff7675' }, `Gas ${f0(g.qBhkw)} Nm³/h`, `CH4 ${f1(g.ch4)} %  O2 ${f1(g.o2)} %`], { lcdH: 0.6, fs: 0.08 }); } });

  function update(dt) {
    const g = G();
    g.g.forEach((v, i) => {
      if (INT.pul && INT.pul[i] && v.run) INT.pul[i].rotation.z += dt * 18 * (1 - v.slip);
      if (INT.guard && INT.guard[i]) INT.guard[i].visible = !v.schutzAb;
      if (INT.lamp && INT.lamp[i]) INT.lamp[i].material = v.run ? INT.lampOn : INT.lampOff;
    });
    if (INT.fan) INT.fan.rotation.x += dt * 10;
    const sack = g.ws.aktiv && !g.ws.prov;
    ws.gerade.visible = !sack; ws.sack.visible = sack; ws.holz.visible = g.ws.aktiv && g.ws.prov;
  }
  return { update };
}
