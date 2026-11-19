// Prozessmodell Deponiegasabsaugung mit Gasverdichterstation:
// Brunnenfeld (Kennlinie Gasmenge über Unterdruck, Lufteinbruch bei zu starker Absaugung),
// Hauptsammler (optional mit Wassersack), Kondensatabscheider K1 mit Siphon, Flammendurchschlagsicherung,
// zwei Drehkolbengebläse V1 (Führung) / V2 (Reserve) mit Keilriemenantrieb, FU, Saug-/Druckklappen,
// Rückschlagklappe, Druckschalldämpfer, Sicherheitsventil, Verwertung im BHKW bzw. Fackel.
// Unterdruckregelung PIC 801 über die Drehzahl des laufenden Verdichters. Zeitbasis: Sekunden Simulationszeit.

export const PG = {
  SOLL: 35, Q_POT: 300, P_CHAR: 25, V_SPEZ: 300 / 3600, N_MOT: 2915, I_RIEMEN: 1.235,
  F_MIN: 25, F_MAX: 55, F_HAND: 45, SV: 350, T_WARN: 75, T_MAX: 100, I_NENN: 10.4, P_NENN: 5.5,
  CH4: 52, BHKW_Q: 165, BHKW_PEL: 330, Q_REF: 230,
};
export const GEB = {
  hersteller: 'Rotar Gebläsetechnik GmbH', typ: 'DKG 300 Ex', snr: ['DKG-14-03117', 'DKG-14-03118'], bj: 2014,
  vol: '300 m³/h bei 3.600 1/min', dp: 'Δp max. 400 mbar', atex: 'II 2G Ex h IIB T3 Gb (innen und außen)', oel: 'Synthetisches Getriebeöl ISO VG 220, 0,8 L je Seite',
};
export const MOT = {
  typ: 'Ex-Drehstrommotor 132S-2', p: '5,5 kW', n: '2.915 1/min', u: '400 V Δ, 50 Hz', i: '10,4 A', cos: '0,87', snr: ['M-1407-5521', 'M-1407-5522'],
  atex: 'II 2G Ex db eb IIB T4 Gb', bescheinigung: 'XEX 13 ATEX 2207 X', ip: 'IP55', bauform: 'B3', ptc: 'Kaltleiter (PTC) 150 °C',
};
export const RIEMEN = '3 × SPZ 1250 Lw, elektrisch leitfähig nach ISO 1813 (satzgleich)';
export const EXZONEN = [
  'Zone 2: gesamter Verdichterraum',
  'Zone 1: 1 m um Verdichter, Kondensatabscheider, Flammendurchschlagsicherung, Flansche und Armaturen',
  'Zone 0: Innenraum gasführender Teile bei Lufteinbruch',
  'Explosionsgruppe IIA (Methan) · Temperaturklasse mind. T3 (wegen H₂S, Zündtemperatur ≈ 270 °C)',
  'Betriebsmittel in Zone 1: Gerätekategorie 2G (Gb)',
];

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const approach = (x, z, tau, dt) => x + (z - x) * (1 - Math.exp(-dt / tau));
export const fmtZeit = (t) => { const m = ((Math.floor(t / 60) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export const tag = (t) => Math.floor(t / 86400) + 1;
export const vName = (i) => `V${i + 1}`;
const n1 = (x) => x.toFixed(1).replace('.', ',');

// ------------------------------------------------------------------ Störungskarten und Ursachen
export const KARTEN = {
  G1: { kurz: 'Gasmenge zu gering', titel: 'Unterdruck wird nicht gehalten, Gasmenge zu gering, Frequenzumrichter V1 am Anschlag', ursachen: {
    riemen_defekt: 'Keilriemen verschlissen (Risse, Schlupf)',
    spalt: 'Innerer Verschleiß der Gebläsestufe (Drehkolbenspiel zu groß)',
    saugklappe: 'Saugseitige Absperrklappe von V1 nach Wartung nicht ganz geöffnet',
    kondensat: 'Kondensatabscheider K1 voll, Siphon verstopft',
    fds: 'Flammenfilter der Flammendurchschlagsicherung zugesetzt' } },
  G2: { kurz: 'Druckschwankungen', titel: 'Druckschwankungen an der Verdichterstation, Gasmenge pulsiert', ursachen: {
    wassersack: 'Hauptsammler abgesackt – Wassersack in der Leitung',
    siphon: 'Siphon des Kondensatabscheiders leer – Luft wird angesaugt',
    riemen_locker: 'Keilriemen zu locker (Gleitschlupf)',
    rsk: 'Rückschlagklappe druckseitig flattert (Feder gebrochen)' } },
  G3: { kurz: 'Verdichter laut / heiß', titel: 'Verdichter V1 läuft auffällig laut bzw. heiß', ursachen: {
    lager: 'Lagerschaden in der Gebläsestufe',
    oel: 'Ölstand in der Gebläsestufe zu niedrig',
    schalld: 'Druckschalldämpfer zugesetzt (Dämmstoff durch Kondensat gequollen)',
    druckklappe: 'Druckseitige Absperrklappe von V1 nach Wartung nicht ganz geöffnet' } },
  G4: { kurz: 'Motorschutz ausgelöst', titel: 'Verdichter V1 in Störung – Motorschutz ausgelöst, V2 hat übernommen', ursachen: {
    wicklung: 'Isolationsfehler in der Motorwicklung',
    luefter: 'Lüfterrad des Motors gebrochen – Motor überhitzt (Kaltleiter)',
    einstellung: 'Motorschutzschalter zu niedrig eingestellt' } },
};
export const VOR_ORT_BEHEBBAR = ['saugklappe', 'kondensat', 'siphon', 'riemen_locker', 'oel', 'druckklappe', 'einstellung'];
// Bauteil, das für die Instandsetzung bestellt werden muss (Artikel-IDs aus KATALOG)
export const BEDARF = { riemen_defekt: ['rm_3lf'], spalt: ['st_ex'], fds: ['fds_ein'], wassersack: ['auflager', 'fremd_rohr'], rsk: ['rsk_es'], lager: ['lg_satz'], schalld: ['sd_ein'], wicklung: ['mot_2g'], luefter: ['lr_ex'] };

// ------------------------------------------------------------------ Ersatzteilkatalog (Lieferant/Hersteller)
export const KATALOG = [
  { gr: 'Motor', id: 'mot_std', name: 'Drehstrom-Normmotor 5,5 kW, 2-polig, IE3, Bauform B3, IP55', preis: 690, fehler: 'kein Explosionsschutz – im Ex-Bereich (Zone 1) unzulässig' },
  { gr: 'Motor', id: 'mot_3g', name: 'Ex-Motor 5,5 kW, 2-polig, II 3G Ex ec IIC T3 Gc, B3', preis: 1450, fehler: 'Kategorie 3G nur für Zone 2 zulässig, der Motor steht in Zone 1' },
  { gr: 'Motor', id: 'mot_2g', name: 'Ex-Motor 5,5 kW, 2-polig, II 2G Ex db eb IIB T4 Gb, B3, mit Kaltleiter', preis: 2380, sn: 'mot' },
  { gr: 'Motor', id: 'mot_t1', name: 'Ex-Motor 5,5 kW, 2-polig, II 2G Ex db IIA T1 Gb, B3', preis: 2190, fehler: 'Temperaturklasse T1 reicht nicht – das Ex-Schutzdokument fordert mind. T3 (H₂S)' },
  { gr: 'Motor', id: 'mot_4', name: 'Ex-Motor 4 kW, 2-polig, II 2G Ex db eb IIB T4 Gb, B3', preis: 2050, fehler: 'Leistung zu gering (Typenschild: 5,5 kW)' },
  { gr: 'Motor', id: 'lr_pp', name: 'Lüfterrad Kunststoff (PP) für Baugröße 132, Handelsware', preis: 18, fehler: 'nicht ableitfähig – elektrostatische Aufladung im Ex-Bereich; nicht vom Motorhersteller freigegeben' },
  { gr: 'Motor', id: 'lr_ex', name: 'Lüfterrad für Ex-Motor 132S-2, ableitfähig, Originalteil (nach Motor-Serien-Nr.)', preis: 64, sn: 'mot' },
  { gr: 'Antrieb', id: 'rm_1', name: 'Keilriemen SPZ 1250 Lw, Standard (Einzelriemen)', preis: 14, fehler: 'Riemen werden nur satzweise getauscht; Standardriemen nicht elektrisch leitfähig' },
  { gr: 'Antrieb', id: 'rm_3std', name: 'Keilriemensatz 3 × SPZ 1250 Lw, Standard', preis: 39, fehler: 'nicht elektrisch leitfähig – im Ex-Bereich sind ableitfähige Riemen (ISO 1813) vorgeschrieben' },
  { gr: 'Antrieb', id: 'rm_3lf', name: 'Keilriemensatz 3 × SPZ 1250 Lw, elektrisch leitfähig nach ISO 1813, satzgleich', preis: 66 },
  { gr: 'Antrieb', id: 'rm_1320', name: 'Keilriemensatz 3 × SPZ 1320 Lw, elektrisch leitfähig nach ISO 1813', preis: 68, fehler: 'falsche Riemenlänge (Riemenschutz: SPZ 1250)' },
  { gr: 'Gebläsestufe', id: 'st_ex', name: 'Austausch-Gebläsestufe DKG 300 Ex, ATEX II 2G innen/außen (nach Serien-Nr.)', preis: 7800, sn: 'geb' },
  { gr: 'Gebläsestufe', id: 'st_luft', name: 'Austausch-Gebläsestufe DKG 300, Luftausführung ohne ATEX-Kennzeichnung', preis: 4900, fehler: 'Luftausführung – für brennbare Gase und Zone 1 nicht zugelassen' },
  { gr: 'Gebläsestufe', id: 'lg_satz', name: 'Lager- und Dichtungssatz DKG 300 Ex, Originalteile (nach Serien-Nr.)', preis: 640, sn: 'geb' },
  { gr: 'Gebläsestufe', id: 'lg_norm', name: 'Rillenkugellager 6309-2RS, Handelsware (4 Stück)', preis: 120, fehler: 'keine Originalteile – Lagerung und Wellendichtungen der Ex-Gebläsestufe sind Teil der Baumusterbewertung' },
  { gr: 'Gebläsestufe', id: 'oel', name: 'Getriebeöl synthetisch ISO VG 220 laut Betriebsanleitung, 5 L', preis: 85, lager: true },
  { gr: 'Druckseite', id: 'rsk_es', name: 'Rückschlagklappe DN 100 PN 10, Edelstahl 1.4571, FKM-Dichtung, für Deponie-/Biogas', preis: 540 },
  { gr: 'Druckseite', id: 'rsk_gg', name: 'Rückschlagklappe DN 100 PN 16, Grauguss, EPDM-Dichtung (Wasser)', preis: 210, fehler: 'Werkstoff/Dichtung nicht für Deponiegas geeignet (H₂S, saures Kondensat, Gasdichtheit)' },
  { gr: 'Druckseite', id: 'rsk_80', name: 'Rückschlagklappe DN 80 PN 10, Edelstahl 1.4571, FKM-Dichtung', preis: 470, fehler: 'falsche Nennweite (Druckleitung DN 100)' },
  { gr: 'Druckseite', id: 'sd_ein', name: 'Dämpfungseinsatz Druckschalldämpfer DKG 300 Ex, kondensatbeständig (nach Serien-Nr.)', preis: 380, sn: 'geb' },
  { gr: 'Druckseite', id: 'sd_mw', name: 'Mineralwollmatte 50 mm, 1 m², Handelsware', preis: 25, fehler: 'kein Originalteil; Mineralwolle saugt Kondensat auf und setzt den Dämpfer erneut zu' },
  { gr: 'Saugseite', id: 'fds_ein', name: 'Flammenfilter-Einsatz für Flammendurchschlagsicherung DN 150, Typ laut Typenschild der FDS (IIA)', preis: 920 },
  { gr: 'Saugseite', id: 'fds_iib3', name: 'Flammenfilter-Einsatz DN 150, Explosionsgruppe IIB3, anderer Hersteller', preis: 1050, fehler: 'Baumusterprüfung gilt nur für die geprüfte Kombination aus Gehäuse und Filter – Fremdfilter unzulässig' },
  { gr: 'Saugseite', id: 'k1_siphon', name: 'Siphon-Einsatz für Kondensatabscheider K1', preis: 140 },
  { gr: 'Leitung', id: 'auflager', name: 'Rohrauflager mit Rohrschelle für PE-Leitung d 250, mit Betonschwelle (2 Stück)', preis: 180 },
  { gr: 'Leitung', id: 'fremd_rohr', name: 'Fremdleistung Rohrleitungsbau: Auflager neu setzen, Gefälle ≥ 1 % zum Kondensatabscheider herstellen', preis: 1200 },
  { gr: 'Station', id: 'gws', name: 'Gaswarnsensor CH₄ (Ersatz)', preis: 450 },
];

// ------------------------------------------------------------------ Zustand
function geblaese(nr) {
  return { nr, wahl: 'auto', rep: true, schloss: false, hs: 100, hd: 100, ent: false, run: false, f: 42, nm: 0, nb: 0, slip: 0.01, q: 0, qa: 0,
    pin: 0, pout: 0, dp: 0, td: 22, pkw: 0, amp: 0, v: 0.2, tl: 30, oel: 55, thermo: 35, stoer: '', bh: nr === 1 ? 31480 : 27950, starts: 0,
    schutzAb: false, gespannt: false, ms: PG.I_NENN, msT: 0, iso: 240, laeuftT: 0, qMax: 0, tdMax: 0 };
}
export function createGas(karte = null, ursache = null, falle = false) {
  const G = { t: 8 * 3600, karte, ursache, ursache0: ursache, falle, g: [geblaese(1), geblaese(2)], sp: PG.SOLL,
    pn: 35, pField: 30, qNetz: 0, q: 0, ch4: PG.CH4, o2: 0.4, airK1: 0, airAblass: 0, pdi: 3, k1: 30, siphon: 100, k1gespuelt: false,
    ws: { aktiv: ursache === 'wassersack', prov: false, rest: ursache === 'wassersack' ? 1 : 0 }, pnMin: 99, pnMax: 0, puls: 0, pulsWin: [],
    qBhkw: 0, qFackel: 0, pel: 0, fackel: false, bhkw: 'betrieb', vGas: 0, vDiffus: 0, eKwh: 0, stillT: 0, gaswarn: false, gw: 0,
    alarme: {}, hist: [], histNext: 0, historie: [], bestellungen: [], warnT: {} };
  const V1 = G.g[0], V2 = G.g[1];
  if (ursache === 'saugklappe') V1.hs = 9;
  if (ursache === 'druckklappe') V1.hd = 18;
  if (ursache === 'kondensat') { G.k1 = 96; }
  if (ursache === 'siphon') { G.siphon = 0; }
  if (ursache === 'oel') V1.oel = 12;
  if (ursache === 'wicklung') { V1.iso = 0.3; V1.stoer = 'Motorschutz ausgelöst (Kurzschlussauslöser)'; G.historie.push('Heute 05:41  V1 Motorschutz ausgelöst (Kurzschlussauslöser), V2 hat übernommen'); }
  if (ursache === 'luefter') { V1.stoer = 'Kaltleiterauslösung (Motorübertemperatur)'; V1.thermo = 132; G.historie.push('Heute 07:12  V1 Kaltleiterauslösung Motor, V2 hat übernommen', 'Heute 04:50  V1 Kaltleiterauslösung, quittiert'); }
  if (ursache === 'einstellung') { V1.ms = 3.2; V1.stoer = 'Motorschutz ausgelöst (Überlast)'; G.historie.push('Heute 06:58  V1 Motorschutz ausgelöst (Überlast), V2 hat übernommen', 'Vorgestern 13:20  V1 Motorschutzschalter nach Prüfung neu eingestellt'); }
  if (falle) V2.hd = 0;                                   // Druckklappe der Reserve nach Wartung geschlossen geblieben
  G.historie.push('Vorgestern 10:30  V2 Wartung (Ölwechsel, Klappen geprüft) abgeschlossen, freigegeben');
  return G;
}
const verfuegbar = (x) => x.rep && !x.stoer && x.wahl !== '0';

// ------------------------------------------------------------------ Zeitschritt
export function stepGas(G, dt, log) {
  let r = dt; while (r > 0) { const d = Math.min(2, r); stepKurz(G, d, log); r -= d; }
}
function stepKurz(G, dt, log) {
  const h = dt / 3600; G.t += dt;
  const u = G.ursache, [V1, V2] = G.g, t = G.t;
  // Anforderung: V1 Führung, V2 übernimmt, wenn V1 nicht verfügbar oder nicht in AUTO
  const autoLead = V1.wahl === 'auto' && verfuegbar(V1) ? 0 : (V2.wahl === 'auto' && verfuegbar(V2) ? 1 : -1);
  G.g.forEach((x, i) => {
    const soll = verfuegbar(x) && (x.wahl === 'hand' || i === autoLead);
    if (soll && !x.run) {
      x.starts++; x.laeuftT = 0;
      if (x.schutzAb) log && log(`${vName(i)} läuft ohne Riemenschutz – Verletzungsgefahr am offenen Riementrieb!`, 'sys');
      if (i === 0 && u === 'wicklung') { x.stoer = 'Motorschutz ausgelöst (Kurzschlussauslöser)'; log && log('V1 Motorschutz löst beim Einschalten sofort wieder aus', 'sys'); return; }
    }
    x.run = soll && !x.stoer;
    if (x.run) x.laeuftT += dt;
  });
  // Saugseite gemeinsam: Hauptsammler, K1, FDS; Verdichter einzeln: Klappen, Riemen, Gebläsestufe
  const qRef = PG.Q_REF, run = G.g.filter((x) => x.run);
  const qPrev = Math.max(1, G.q);
  // Druckverluste gemeinsam (mbar), mit dem bisherigen Volumenstrom
  const qr = qPrev / qRef;
  const dpLine = 4 * qr * qr;
  let dpWs = 0;
  if (G.ws.rest > 0) dpWs = G.ws.rest * (16 + 13 * Math.sin(2 * Math.PI * t / 17) + 6 * Math.sin(2 * Math.PI * t / 5.3)) * Math.max(0.3, qr);
  const kVoll = u === 'kondensat' && !G.k1gespuelt ? 1 : 0;
  const dpK1 = (2 + (G.k1 > 85 ? (G.k1 - 85) * 16 : 0)) * qr * qr + (G.k1 > 85 ? 7 * Math.sin(t / 2.1) : 0) + (G.siphon < 30 ? 9 * Math.sin(2 * Math.PI * t / 13) : 0);
  const dpFds = (u === 'fds' ? 175 : 3) * qr * qr;
  G.pdi = Math.max(0, dpFds);
  // Luft am Siphon bzw. am geöffneten Ablass
  G.airK1 = (G.siphon < 30 ? 30 * (1 - G.siphon / 30) : 0) + G.airAblass;
  G.airAblass = Math.max(0, G.airAblass - dt * 0.2);
  // Verdichter: Volumenstrom und Drücke
  let qSum = 0;
  G.g.forEach((x, i) => {
    const ui = i === 0 ? u : null;
    // Riementrieb: Schlupf
    let slip = 0.01;
    if (ui === 'riemen_defekt') slip = 0.27;
    if (ui === 'riemen_locker' && !x.gespannt) slip = 0.05 + 0.26 * Math.max(0, Math.sin(2 * Math.PI * t / 11)) ** 2;
    x.slip = slip;
    if (!x.run) { x.q = 0; x.qa = 0; x.nm = 0; x.nb = 0; x.pkw = 0; x.amp = 0; x.pin = x.hs > 2 ? G.pn : 0; x.pout = x.hd > 2 ? 60 : 0; if (x.ent) { x.pin = 0; x.pout = 0; } x.dp = 0; return; }
    if (x.wahl === 'hand') x.f = PG.F_HAND;
    x.nm = PG.N_MOT * x.f / 50; x.nb = x.nm * PG.I_RIEMEN * (1 - slip);
    const qShare = run.length ? qPrev / run.length : 0, qs = qShare / qRef;
    const dpHs = x.hs <= 0 ? 999 : 2 * (1 / (x.hs / 100) ** 2 - 1) * qs * qs;
    x.pin = G.pn + dpK1 + dpFds + Math.min(400, dpHs) + 1;
    const dpHd = x.hd <= 0 ? 999 : 5 * (1 / (x.hd / 100) ** 2 - 1) * qs * qs;
    let dpRsk = 4 * qs * qs; if (ui === 'rsk') dpRsk += 22 * Math.abs(Math.sin(2 * Math.PI * t / 2.7));
    const dpSd = (ui === 'schalld' ? 165 : 8) * qs * qs;
    const pVerbr = 20 + 60 * (qPrev / qRef) ** 2;
    let pout = pVerbr + dpRsk + dpSd + Math.min(999, dpHd);
    let sv = false;
    if (pout > PG.SV) { pout = PG.SV; sv = true; }
    x.pout = pout; x.dp = x.pin + x.pout;
    const kL = ui === 'spalt' ? 11 : 3;
    const leak = kL * Math.sqrt(Math.max(0, x.dp));
    let qa = Math.max(0, PG.V_SPEZ * x.nb - leak);              // m³/h im Ansaugzustand
    if (sv) qa *= Math.max(0, 1 - (pVerbr + dpRsk + dpSd + Math.min(999, dpHd) - PG.SV) / 200);   // Teil strömt über das Sicherheitsventil zurück
    if (x.ent) qa *= 0.4;
    x.qa = qa; x.q = qa * (1 - x.pin / 1013) * 0.93;
    x.sv = sv;
    qSum += x.q;
    // Leistung, Strom, Temperaturen, Schwingung
    const extra = (ui === 'lager' ? 0.5 : 0) + (ui === 'oel' ? 0.3 : 0) + (ui === 'riemen_defekt' || ui === 'riemen_locker' ? 0.25 : 0);
    x.pkw = qa / 3600 * x.dp * 100 / 0.6 / 1000 + 0.45 + extra;
    x.amp = x.pkw * 1000 / (Math.sqrt(3) * 400 * 0.87 * 0.88) + 1.6;
    const tdZiel = 20 + 0.24 * x.dp + (ui === 'spalt' ? 25 : 0) + (ui === 'lager' ? 6 : 0) + (ui === 'oel' ? 5 : 0) + (sv ? 45 : 0);
    x.td = approach(x.td, tdZiel, 120, dt); x.tdMax = Math.max(x.tdMax, x.td);
    x.tl = approach(x.tl, ui === 'lager' ? 95 : ui === 'oel' ? 88 : 60, 900, dt);
    let v = 2.2; if (ui === 'lager') v = 8.1; if (ui === 'oel') v = 4.2; if (ui === 'rsk') v = 3.6; if (ui === 'riemen_locker' && !x.gespannt) v = 3.9; if (ui === 'riemen_defekt') v = 3.4; if (ui === 'spalt') v = 2.7; if (sv) v = Math.max(v, 4.5);
    x.v = v; x.bh += h; x.qMax = Math.max(x.qMax, x.q);
    if (x.td > PG.T_MAX) { x.stoer = 'Druckgastemperatur max (TSHH)'; x.run = false; log && log(`${vName(i)} Abschaltung: Druckgastemperatur über ${PG.T_MAX} °C`, 'sys'); }
  });
  // Motortemperatur und Motorschutz
  G.g.forEach((x, i) => {
    const ui = i === 0 ? u : null, last = x.amp / PG.I_NENN;
    const ziel = x.run ? 40 + 70 * last * last + (ui === 'luefter' ? 120 : 0) : 22;
    x.thermo = approach(x.thermo, ziel, x.run ? (ui === 'luefter' ? 420 : 900) : 1200, dt);
    if (x.run && ui === 'luefter' && x.thermo > 150) { x.stoer = 'Kaltleiterauslösung (Motorübertemperatur)'; x.run = false; log && log(`${vName(i)} Kaltleiter hat ausgelöst – Motor überhitzt`, 'sys'); }
    if (x.run && x.amp > x.ms * 1.05) { x.msT += dt * (x.amp / x.ms - 1) * 10; } else x.msT = Math.max(0, x.msT - dt);
    if (x.run && x.msT > 120) { x.stoer = 'Motorschutz ausgelöst (Überlast)'; x.run = false; x.msT = 0; log && log(`${vName(i)} Motorschutz hat ausgelöst (Strom ${n1(x.amp)} A, Einstellwert ${n1(x.ms)} A)`, 'sys'); }
  });
  // Netz: Brunnenfeld liefert, was der Verdichter abnimmt
  const qGasBedarf = Math.max(0, qSum - G.airK1);
  const liefer = (p) => PG.Q_POT * (1 - Math.exp(-p / PG.P_CHAR)) + Math.max(0, p - 42) * 1.5;
  let pf = 0;
  if (qGasBedarf > 0.5) { let lo = 0, hi = 300; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (liefer(m) < qGasBedarf) lo = m; else hi = m; } pf = (lo + hi) / 2; }
  G.pField = approach(G.pField, pf, 20, dt);
  G.qGlatt = approach(G.qGlatt ?? qSum, qSum, 60, dt);
  const pnZiel = G.pField + dpLine + dpWs + 0.4 * (qSum - G.qGlatt) + (G.siphon < 30 ? 9 * Math.sin(2 * Math.PI * t / 13) : 0);
  G.pn = run.length ? approach(G.pn, pnZiel, 6, dt) : approach(G.pn, 0, 60, dt);
  G.q = qSum; G.qNetz = qGasBedarf;
  // Gasbeschaffenheit
  const airF = Math.max(0, G.pField - 42) * 1.5, qg = Math.max(0.1, qGasBedarf - airF), qt = Math.max(0.1, qGasBedarf + G.airK1);
  const airT = airF + G.airK1;
  G.ch4 = run.length ? approach(G.ch4, PG.CH4 * qg / qt, 90, dt) : approach(G.ch4, PG.CH4, 600, dt);
  G.o2 = run.length ? approach(G.o2, (0.4 * qg + 21 * airT) / qt, 90, dt) : approach(G.o2, 0.4, 600, dt);
  // Regelung PIC 801 über die Frequenz des AUTO-Verdichters
  if (autoLead >= 0 && G.g[autoLead].run) { const x = G.g[autoLead]; x.f = clamp(x.f + 0.025 * (G.sp - G.pn) * dt, PG.F_MIN, PG.F_MAX); }
  // Pulsationserkennung (Fenster 60 s)
  G.pulsWin.push([t, G.pn]); while (G.pulsWin.length && G.pulsWin[0][0] < t - 60) G.pulsWin.shift();
  G.puls = Math.max(...G.pulsWin.map((p) => p[1])) - Math.min(...G.pulsWin.map((p) => p[1]));
  const xr = G.g.find((x) => x.run); G.pd = xr ? xr.pout : 0;
  G.pdWin = G.pdWin || []; G.pdWin.push([t, G.pd]); while (G.pdWin.length && G.pdWin[0][0] < t - 60) G.pdWin.shift();
  G.pulsD = Math.max(...G.pdWin.map((p) => p[1])) - Math.min(...G.pdWin.map((p) => p[1]));
  // Wassersack: provisorisch angehoben → Kondensat läuft zum K1 ab
  if (G.ws.prov && G.ws.rest > 0) { const d = Math.min(G.ws.rest, dt / 300); G.ws.rest -= d; G.k1 = Math.min(100, G.k1 + d * 30); }
  // Kondensatabscheider: Zulauf, Abfluss über den Siphon
  const zul = run.length ? 3 : 0.5, abfl = (kVoll || G.siphon < 30) ? 0 : 4;
  G.k1 = clamp(G.k1 + (zul - abfl * (G.k1 > 25 ? 1 : 0)) * h * 8, 18, 100);
  // Verwertung: BHKW bis zur Nennmenge, Rest Fackel; BHKW nur bei ausreichender Gasqualität
  const bhkwOk = G.ch4 > 40 && G.o2 < 3.5 && G.q > 60;
  if (!bhkwOk && G.bhkw === 'betrieb') { G.bhkw = 'aus'; log && log(`BHKW schaltet ab: ${G.o2 >= 3.5 ? 'Sauerstoffgehalt zu hoch' : G.ch4 <= 40 ? 'Methangehalt zu gering' : 'Gasmenge zu gering'}`, 'sys'); }
  if (bhkwOk && G.bhkw === 'aus' && G.q > 90 && G.o2 < 2.5) { G.bhkw = 'betrieb'; log && log('BHKW startet wieder', 'sys'); }
  G.qBhkw = G.bhkw === 'betrieb' ? Math.min(G.q, PG.BHKW_Q) : 0;
  G.qFackel = Math.max(0, G.q - G.qBhkw); G.fackel = G.qFackel > 5 && G.o2 < 6;
  G.pel = G.qBhkw * G.ch4 / 100 * 9.97 * 0.38;
  G.vGas += G.q * h; G.eKwh += (G.g[0].pkw + G.g[1].pkw) * h;
  // ohne Absaugung entweicht Deponiegas diffus über die Oberfläche
  if (!run.length) { G.stillT += dt; G.vDiffus += PG.Q_POT * 0.6 * h; }
  // Gaswarnanlage im Raum (Entspannung ins Freie, aber Ablass/Undichtheit)
  G.gw = approach(G.gw, G.g.some((x) => x.ent && (x.hs > 2 || x.hd > 2)) ? 8 : 0, 60, dt);

  const al = (key, aktiv, text, klasse) => {
    const a = G.alarme[key];
    if (aktiv && !(a && a.aktiv)) { G.alarme[key] = { aktiv: true, text, klasse, kommt: G.t }; log && log(`Leitwarte kommt: ${text}`, 'alarm'); }
    else if (!aktiv && a && a.aktiv) { a.aktiv = false; a.geht = G.t; log && log(`Leitwarte geht: ${text}`, 'alarm'); }
  };
  const dauer = (key, cond, s) => { G.warnT[key] = cond ? (G.warnT[key] || 0) + dt : 0; return G.warnT[key] > s; };
  al('pu', dauer('pu', run.length && G.pn < G.sp - 6, 240), 'Deponiegas: PI 801 Unterdruck Saugsammler zu gering', 'W');
  al('puls', dauer('puls', G.puls > 9, 90), 'Deponiegas: Druckschwankungen Saugsammler PI 801', 'W');
  al('pulsd', dauer('pulsd', G.pulsD > 16, 90), 'Deponiegas: Druckschwankungen Gasabgabe PI 803', 'W');
  al('o2', G.o2 > 2.5, 'Deponiegas: QI 802 Sauerstoff hoch', G.o2 > 4 ? 'A' : 'W');
  al('aus', !run.length, 'Deponiegas: Gasabsaugung ausgefallen – kein Verdichter in Betrieb', 'A');
  al('bhkw', G.bhkw !== 'betrieb', 'Deponiegas: BHKW außer Betrieb', 'W');
  al('gw', G.gw > 4, 'Deponiegas: Gaswarnanlage Verdichterraum Voralarm', 'A');
  G.g.forEach((x, i) => {
    al(`fu${i}`, dauer(`fu${i}`, x.run && x.f >= PG.F_MAX - 0.3, 180), `Deponiegas: FU ${vName(i)} an Maximalfrequenz`, 'W');
    al(`td${i}`, x.run && x.td > PG.T_WARN, `Deponiegas: TI 8${i + 1}2 Druckgastemperatur ${vName(i)} hoch`, 'W');
    al(`st${i}`, !!x.stoer || !x.rep, `Deponiegas: ${vName(i)} Störung${x.stoer ? ` (${x.stoer})` : ' (Reparaturschalter AUS)'}`, 'A');
    al(`ni${i}`, x.wahl !== 'auto', `Deponiegas: ${vName(i)} nicht in AUTO`, 'M');
  });
  if (G.t >= G.histNext) {
    G.hist.push({ t: G.t, pn: G.pn, pd: G.pd, q: G.q, o2: G.o2, ch4: G.ch4, td1: V1.run ? V1.td : null, td2: V2.run ? V2.td : null, f1: V1.run ? V1.f : 0, f2: V2.run ? V2.f : 0, i1: V1.amp, i2: V2.amp, pel: G.pel });
    if (G.hist.length > 2500) G.hist.shift();
    G.histNext = G.t + 30;
  }
}

export function setupGas(karte, opt = {}) {
  let ursache = null, falle = false;
  if (karte && KARTEN[karte]) {
    const k = Object.keys(KARTEN[karte].ursachen);
    ursache = opt.ursache && KARTEN[karte].ursachen[opt.ursache] ? opt.ursache : k[Math.floor(Math.random() * k.length)];
    falle = karte !== 'G4' && (opt.falle ?? Math.random() < 0.35);
  }
  const G = createGas(karte, ursache, falle);
  G.t = 6 * 3600; G.histNext = G.t;
  for (let i = 0; i < 2 * 3600 / 10; i++) stepGas(G, 10);
  G.alarme = {}; G.eKwh = 0; G.vGas = 0; G.vDiffus = 0; G.stillT = 0; G.warnT = {};
  G.g.forEach((x) => { x.qMax = 0; x.tdMax = x.td; });
  return G;
}

// ------------------------------------------------------------------ Bedienhandlungen vor Ort
const WAHL = { hand: 'HAND', '0': '0', auto: 'AUTO' };
export function setWahl(G, i, w, log) { const x = G.g[i]; if (x.wahl === w) return; log(`${vName(i)} Wahlschalter ${WAHL[x.wahl]} → ${WAHL[w]}`); x.wahl = w; }
export function setRep(G, i, ein, log) {
  const x = G.g[i]; if (x.rep === ein) return;
  if (ein && x.schloss) return 'Reparaturschalter ist mit Vorhängeschloss gesichert – erst Schloss entfernen.';
  x.rep = ein; log(`${vName(i)} Reparaturschalter ${ein ? 'EIN' : 'AUS (0)'}${!ein && x.run ? ' – Verdichter lief noch' : ''}`);
}
export function setSchloss(G, i, an, log) {
  const x = G.g[i]; if (an && x.rep) return 'Erst Reparaturschalter auf 0 stellen, dann sichern.';
  x.schloss = an; log(`${vName(i)} Reparaturschalter ${an ? 'mit Vorhängeschloss gegen Wiedereinschalten gesichert' : 'Schloss entfernt'}`);
}
export function einschaltversuch(G, i, log) {
  const x = G.g[i];
  if (x.rep) { log(`${vName(i)} Einschaltversuch bei Reparaturschalter EIN – nicht freigeschaltet`); return 'Der Reparaturschalter steht auf EIN – der Antrieb ist nicht freigeschaltet!'; }
  log(`${vName(i)} Einschaltversuch (Wahlschalter HAND): Antrieb läuft nicht an – Freischaltung wirksam`, 'messung');
  return 'Der Motor läuft nicht an – die Freischaltung ist wirksam. Wahlschalter zurück auf 0.';
}
export function setKlappe(G, i, seite, pos, log) {
  const x = G.g[i], k = seite === 's' ? 'hs' : 'hd', alt = x[k]; x[k] = clamp(pos, 0, 100);
  log(`${vName(i)} ${seite === 's' ? 'Saugklappe HV 8' + (i + 1) + '1' : 'Druckklappe HV 8' + (i + 1) + '2'} ${Math.round(alt)} → ${Math.round(x[k])} % offen${x.run ? ' (Verdichter läuft)' : ''}`);
}
export function setEnt(G, i, auf, log) {
  const x = G.g[i]; x.ent = auf;
  const warn = auf && (x.hs > 2 || x.hd > 2) ? ' – ACHTUNG: Klappen nicht geschlossen, Gas strömt über die Abblaseleitung ab!' : '';
  log(`${vName(i)} Entspannungsventil (Abblaseleitung über Dach) ${auf ? 'geöffnet' : 'geschlossen'}${warn}${auf && x.run ? ' – Verdichter läuft!' : ''}`);
}
export function quittieren(G, i, log) {
  const x = G.g[i]; if (!x.stoer) return 'Keine Störung anstehend.';
  if (/Kaltleiter/.test(x.stoer) && x.thermo > 90) { log(`${vName(i)} Quittieren versucht – Kaltleiter noch über Rückschalttemperatur`); return 'Quittieren nicht möglich: Der Motor ist noch zu warm (Kaltleiter).'; }
  log(`${vName(i)} Störung „${x.stoer}“ quittiert`); x.stoer = ''; x.msT = 0; return 'Störung quittiert.';
}
export function setMotorschutz(G, i, v, log) { const x = G.g[i], alt = x.ms; x.ms = clamp(v, 1, 20); log(`${vName(i)} Motorschutzschalter Einstellwert ${n1(alt)} → ${n1(x.ms)} A`); }
export function riemenschutz(G, i, ab, log) {
  const x = G.g[i]; if (x.schutzAb === ab) return;
  x.schutzAb = ab;
  if (ab) log(`${vName(i)} Riemenschutz abgenommen${x.run ? ' – Antrieb läuft! Verletzungsgefahr' : !(!x.rep && x.schloss) ? ' – Antrieb nicht gegen Wiedereinschalten gesichert' : ''}`);
  else log(`${vName(i)} Riemenschutz wieder angebracht`);
}
export function nachspannen(G, i, log) {
  const x = G.g[i];
  if (!x.schutzAb) return 'Erst den Riemenschutz abnehmen.';
  if (x.run) { log(`${vName(i)} Nachspannen versucht – Antrieb läuft`); return 'Am laufenden Antrieb wird nicht gearbeitet!'; }
  log(`${vName(i)} Keilriemen nachgespannt (Motorwippe), Spannung geprüft`);
  if (i === 0 && G.ursache === 'riemen_locker') { x.gespannt = true; return 'Riemen waren zu locker – nachgespannt, Eindrücktiefe jetzt 12 mm (Soll 10–15 mm).'; }
  if (i === 0 && G.ursache === 'riemen_defekt') return 'Nachgespannt – die Riemen sind aber an den Flanken verglast und haben Querrisse. Nachspannen beseitigt den Schaden nicht.';
  return 'Die Spannung war in Ordnung.';
}
export function oelNachfuellen(G, i, log) { const x = G.g[i]; log(`${vName(i)} Öl in der Gebläsestufe nachgefüllt (vorher ${Math.round(x.oel)} %, Sorte laut Typenschild)`); x.oel = 55; if (i === 0 && G.ursache === 'oel') G.ursache = null; return 'Öl bis zur Schauglasmitte nachgefüllt.'; }
export function k1Ablassen(G, log) {
  const lauf = G.g.some((x) => x.run);
  log(`K1 Kondensat über den Ablasshahn abgelassen${lauf ? ' – Absaugung läuft: Luft wird angesaugt' : ''}`);
  G.k1 = 22; if (lauf) G.airAblass = 40;
  return lauf ? 'Kondensat abgelassen – dabei wurde Luft in den Gasweg gesaugt (Unterdruck!).' : 'Kondensat abgelassen.';
}
export function k1Spuelen(G, log) { log('K1 Siphon über den Spülanschluss gespült'); if (G.ursache === 'kondensat') { G.k1gespuelt = true; return 'Siphon war verstopft (Schlamm) – gespült, Kondensat läuft wieder ab.'; } return 'Siphon frei.'; }
export function siphonAuffuellen(G, log) { log(`K1 Siphon mit Wasser aufgefüllt (vorher ${G.siphon < 30 ? 'leer' : 'gefüllt'})`); const war = G.siphon < 30; G.siphon = 100; return war ? 'Siphon war leer – aufgefüllt, die Luftansaugung ist beendet.' : 'Siphon war gefüllt.'; }
export function wsUnterbauen(G, log) { if (!G.ws.aktiv) return 'Die Leitung liegt auf allen Auflagern auf.'; if (G.ws.prov) return 'Bereits unterbaut.'; G.ws.prov = true; log('Hauptsammler an der abgesackten Stelle provisorisch unterbaut (angehoben)'); return 'Leitung angehoben und unterbaut – das Kondensat läuft jetzt zum Abscheider ab. Dauerhafte Instandsetzung erforderlich.'; }
export function gaswarngeraet(G, log) { if (G.gaswarn) return 'Das Gaswarngerät ist bereits eingeschaltet.'; G.gaswarn = true; log('Persönliches Gaswarngerät eingeschaltet und mitgeführt (Selbsttest i. O.)'); return 'Gaswarngerät eingeschaltet: CH₄ 0 % UEG, O₂ 20,9 %, H₂S 0 ppm.'; }

// Messungen und Sinneswahrnehmungen (Ergebnis ins Protokoll)
export function messung(G, i, art, log) {
  const x = G.g[i], u = i === 0 ? G.ursache : null, n = vName(i);
  if (art === 'temp') { const v = x.tl + (Math.random() - 0.5); log(`${n} Lagertemperatur Gebläsestufe (Handthermometer): ${n1(v)} °C`, 'messung'); return `Lagerdeckel: ${n1(v)} °C`; }
  if (art === 'schw') { if (!x.run) return 'Schwingungsmessung nur im Betrieb sinnvoll.'; const v = x.v * (0.95 + 0.1 * Math.random()); log(`${n} Schwingschnelle Gebläsestufe: ${n1(v)} mm/s (Effektivwert)`, 'messung'); return `${n1(v)} mm/s – ${v < 2.8 ? 'gut' : v < 4.5 ? 'noch zulässig' : v < 7.1 ? 'unzulässig hoch, Ursache klären' : 'Schadensbereich'} (Richtwerte DIN ISO 10816-3)`; }
  if (art === 'tacho') {
    if (!x.run) return 'Drehzahlmessung nur im Betrieb möglich.';
    const nb = x.nb * (0.995 + 0.01 * Math.random()), soll = x.nm * PG.I_RIEMEN;
    log(`${n} Drehzahl Gebläsewelle (Handtachometer): ${Math.round(nb)} 1/min bei FU ${n1(x.f)} Hz`, 'messung');
    return `Gebläsewelle ${Math.round(nb)} 1/min. Motor bei ${n1(x.f)} Hz ≈ ${Math.round(x.nm)} 1/min, Übersetzung laut Riemenschild 1 : 1,235 → erwartet ≈ ${Math.round(soll)} 1/min.`;
  }
  if (art === 'strom') { const v = x.amp * (0.98 + 0.04 * Math.random()); log(`${n} Motorstrom (Zangenamperemeter): ${n1(v)} A`, 'messung'); return x.run ? `${n1(v)} A je Phase (Typenschild 10,4 A).` : 'Motor steht – 0 A.'; }
  if (art === 'iso') {
    if (x.rep || !x.schloss) return 'Isolationsmessung nur am freigeschalteten und gesicherten Motor (Elektrofachkraft).';
    log(`${n} Isolationswiderstand Motorwicklung gegen PE (500 V): ${x.iso < 1 ? n1(x.iso) : Math.round(x.iso)} MΩ`, 'messung');
    return `Isolationswiderstand ${x.iso < 1 ? n1(x.iso) : Math.round(x.iso)} MΩ – ${x.iso < 1 ? 'unzulässig niedrig (Wicklungsschaden)' : 'in Ordnung'}.`;
  }
  if (art === 'hoeren') {
    let t;
    if (!x.run) t = 'Verdichter steht – nichts zu hören.';
    else if (u === 'lager') t = 'Mahlendes, rumpelndes Geräusch an der Gebläsestufe, Lagerdeckel heiß.';
    else if (u === 'oel') t = 'Hartes, metallisches Laufgeräusch an der Zahnradseite (Getriebe).';
    else if (u === 'riemen_defekt' || (u === 'riemen_locker' && !x.gespannt)) t = 'Quietschen am Riementrieb, besonders bei Lastwechseln; Drehzahl der Gebläsewelle schwankt hörbar.';
    else if (u === 'rsk') t = 'Klappern an der Rückschlagklappe im Takt von etwa einer Sekunde.';
    else if (x.sv) t = 'Lautes Zischen am Sicherheitsventil – es bläst ab.';
    else if (x.dp > 250) t = 'Sehr lautes, gepresstes Laufgeräusch – hoher Gegendruck.';
    else if (u === 'spalt') t = 'Gleichmäßiges Laufgeräusch, Gehäuse auffällig warm.';
    else t = 'Gleichmäßiges Laufgeräusch, unauffällig.';
    log(`${n} abgehört: ${t}`, 'messung'); return t;
  }
  if (art === 'sicht') {
    const t = [];
    if (x.oel < 30) t.push('Ölstand im Schauglas unter MIN');
    if (u === 'luefter') t.push('Lüfterhaube: Bruchstücke des Lüfterrads, Schleifspuren');
    if (u === 'lager') t.push('Ölschauglas: Öl dunkel mit feinem Metallabrieb');
    if (!t.length) t.push('keine Auffälligkeiten an Gebläsestufe und Motor');
    const s = t.join('; '); log(`${n} Sichtprüfung: ${s}`, 'messung'); return s.charAt(0).toUpperCase() + s.slice(1) + '.';
  }
  if (art === 'riemen') {
    if (!x.schutzAb) return 'Riemenschutz geschlossen – Riemen nicht einsehbar.';
    let s, e;
    if (u === 'riemen_defekt') { s = 'Flanken verglast, Querrisse an zwei Riemen, ein Riemen am Unterbau eingerissen, schwarzer Abrieb'; e = 24; }
    else if (u === 'riemen_locker' && !x.gespannt) { s = 'Riemen äußerlich in Ordnung, leicht verglast, deutlich durchhängend'; e = 31; }
    else { s = 'Riemen in Ordnung, Spannung normal'; e = 12; }
    log(`${n} Riementrieb begutachtet: ${s}; Eindrücktiefe ${e} mm (Soll 10–15 mm)`, 'messung');
    return `${s}. Eindrücktiefe ${e} mm (Soll 10–15 mm).`;
  }
}
