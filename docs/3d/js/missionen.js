// Missionen AEZ: Störungen an der Deponiegas-Verdichterstation (Drehkolbengebläse V1/V2).
// Ablauf: Auftrag → Begehung (Ex-Bereich) → Diagnose → vor Ort beheben oder Reserve übernehmen,
// V1 ex-gerecht außer Betrieb nehmen und das passende Ersatzteil bestellen → Meldung → Bericht (bericht.js).
import { sim, startSzenario, logText, logA } from './anlage-sim.js';
import { PG, KARTEN, VOR_ORT_BEHEBBAR, BEDARF, KATALOG, GEB, MOT } from './gas-modell.js';
import { f0, f1 } from './instrumente.js';
import { sammleBericht, renderBericht, berichtAlsPDF } from './bericht.js';

const $ = (id) => document.getElementById(id);
const hat = (re) => sim.log.some((l) => re.test(l.text));
const erstes = (re) => sim.log.find((l) => re.test(l.text));
const pidx = (re, ab = 0) => { const i = sim.log.slice(ab).findIndex((l) => re.test(l.text)); return i < 0 ? -1 : i + ab; };
const U0 = () => sim.G.ursache0;
const WAHL = { hand: 'HAND', '0': '0', auto: 'AUTO' };
const fe = (x) => x.toLocaleString('de-DE', { maximumFractionDigits: 0 });

// Diagrammvorlagen für den Bericht (Daten: sim.G.hist)
const CH = {
  pn: { titel: 'Unterdruck Saugsammler PI 801 und Druck Gasabgabe', einheit: 'mbar', src: 'G', min: 0, max: 120, serien: [{ key: 'pn', label: 'PI 801 Unterdruck (Soll 35)', farbe: '#e1a100' }, { key: 'pd', label: 'Druck Gasabgabe [mbar] ÷ 2', farbe: '#2e86de', f: 0.5, strich: true }] },
  q: { titel: 'Gasmenge FI 801 und Frequenz der Verdichter', einheit: 'Nm³/h bzw. Hz × 4', src: 'G', min: 0, max: 260, serien: [{ key: 'q', label: 'FI 801 [Nm³/h]', farbe: '#00a8b5' }, { key: 'f1', label: 'FU V1 [Hz × 4]', farbe: '#d63031', f: 4, strich: true }, { key: 'f2', label: 'FU V2 [Hz × 4]', farbe: '#6c5ce7', f: 4, strich: true }] },
  td: { titel: 'Druckgastemperatur TI 812 / TI 822', einheit: '°C', src: 'G', min: 20, max: 110, serien: [{ key: 'td1', label: 'TI 812 (V1)', farbe: '#d63031' }, { key: 'td2', label: 'TI 822 (V2)', farbe: '#6c5ce7' }] },
  gas: { titel: 'Gasbeschaffenheit QI 801 / QI 802', einheit: 'Vol-%', src: 'G', min: 0, max: 60, serien: [{ key: 'ch4', label: 'CH4', farbe: '#1e8e5a' }, { key: 'o2', label: 'O2 × 5', farbe: '#d63031', f: 5 }] },
  strom: { titel: 'Motorstrom und BHKW-Leistung', einheit: 'A bzw. kW ÷ 10', src: 'G', min: 0, max: 40, serien: [{ key: 'i1', label: 'Strom V1 [A]', farbe: '#d63031' }, { key: 'i2', label: 'Strom V2 [A]', farbe: '#6c5ce7', strich: true }, { key: 'pel', label: 'BHKW P el [kW ÷ 10]', farbe: '#0097a7', f: 0.1 }] },
};
const CHARTS = { G1: [CH.pn, CH.q, CH.td], G2: [CH.pn, CH.q, CH.gas], G3: [CH.td, CH.q, CH.strom], G4: [CH.strom, CH.q, CH.pn] };

// ------------------------------------------------------------------ Störungskarten
const SYMPTOM = {
  G1: 'Die Leitwarte meldet „PI 801 Unterdruck Saugsammler zu gering“ und „FU V1 an Maximalfrequenz“. Der Verdichter V1 läuft mit 55 Hz, trotzdem wird der Sollwert von −35 mbar nicht erreicht; das BHKW bekommt weniger Gas als üblich.',
  G2: 'Seit dem Morgen schwanken Unterdruck und Gasmenge an der Verdichterstation. Die Leitwarte meldet „Druckschwankungen“. Das BHKW-Personal beschwert sich über unruhigen Gasdruck.',
  G3: 'Ein Kollege berichtet, dass der Verdichter V1 auffällig laut läuft bzw. sehr heiß wird. In der Leitwarte ist die Druckgastemperatur von V1 erhöht.',
  G4: 'In der Leitwarte steht „V1 Störung“ an. Die Reserve V2 hat automatisch übernommen und hält den Unterdruck. V1 soll wieder verfügbar gemacht werden.',
};
const LOESUNG = {
  riemen_defekt: 'Keilriemen verschlissen: Die Gebläsewelle dreht ≈ 25 % langsamer als erwartet (Handtachometer: Soll ≈ 3.300 1/min bei 55 Hz), Quietschen, Riemen verglast und eingerissen. Nachspannen hilft nicht. Reserve übernehmen, V1 freischalten, satzgleichen, elektrisch leitfähigen Riemensatz 3 × SPZ 1250 (ISO 1813) bestellen.',
  spalt: 'Innerer Verschleiß (Drehkolbenspiel zu groß): Drehzahl der Gebläsewelle stimmt, trotzdem zu wenig Gas; innerer Rückstrom erhöht die Druckgastemperatur um ≈ 25 K. Reserve übernehmen, Austausch-Gebläsestufe DKG 300 Ex (ATEX II 2G innen/außen) mit Serien-Nr. bestellen.',
  saugklappe: 'Saugklappe HV 811 nach Wartung nur 9 % offen: PI 811 zeigt einen deutlich höheren Unterdruck als PI 801 (großer Druckverlust an der Klappe), Druckgastemperatur steigt. Vor Ort: Saugklappe ganz öffnen.',
  kondensat: 'Kondensatabscheider K1 voll, Siphon verstopft: Schauglas über MAX, gurgelndes Geräusch, hoher Druckverlust zwischen PI 801 und PI 811. Vor Ort: Siphon spülen (nicht unter Unterdruck ablassen – Luftansaugung!).',
  fds: 'Flammenfilter der FDS zugesetzt: PDI 803 ≈ 175 mbar statt wenige mbar. Reserve hilft nicht (gemeinsame Saugleitung) – Absaugung mit V1/V2 so weit wie möglich aufrechterhalten, baugleichen Flammenfilter-Einsatz (IIA, laut Typenschild der FDS) bestellen; Fremdfilter sind nicht zulässig.',
  wassersack: 'Hauptsammler abgesackt (Auflager gesunken): In der Senke sammelt sich Kondensat, das Gas „blubbert“ stoßweise hindurch → Druckschwankungen an PI 801 (Periode ≈ 17 s). Außen sichtbar (Durchhang, schiefes Auflager), Gegengefälle mit der Wasserwaage messbar, Gluckern hörbar. Vor Ort provisorisch unterbauen, Auflager und Fremdleistung Rohrleitungsbau (Gefälle ≥ 1 % herstellen) bestellen.',
  siphon: 'Siphon des Kondensatabscheiders leer: Luft wird angesaugt (O₂ ≈ 3 %, BHKW gefährdet), Unterdruck schwankt. Vor Ort: Siphon auffüllen.',
  riemen_locker: 'Keilriemen zu locker: Gleitschlupf im Takt der Lastwechsel, Drehzahl der Gebläsewelle schwankt, Quietschen; Eindrücktiefe 31 mm statt 10–15 mm. Vor Ort behebbar: Reserve übernehmen, V1 freischalten und sichern, Riemenschutz ab, nachspannen, Riemenschutz an, V1 wieder in AUTO.',
  rsk: 'Rückschlagklappe flattert (Feder gebrochen): Klappern im Sekundentakt, Druckschwankungen an der Druckseite (PI 812, Alarm PI 803), saugseitig unauffällig. Reserve übernehmen, Rückschlagklappe DN 100 aus Edelstahl mit FKM-Dichtung (für Deponiegas) bestellen.',
  lager: 'Lagerschaden in der Gebläsestufe: Lagertemperatur ≈ 95 °C, Schwingung ≈ 8 mm/s (Schadensbereich), Öl dunkel mit Metallabrieb, mahlendes Geräusch. Sofort Reserve übernehmen, Original-Lager- und Dichtungssatz DKG 300 Ex mit Serien-Nr. bestellen.',
  oel: 'Ölstand zu niedrig (12 %): hartes Laufgeräusch an der Zahnradseite, Lagertemperatur erhöht. Vor Ort: Öl laut Typenschild (ISO VG 220) nachfüllen – das Öl ist Lagerware, keine Bestellung nötig.',
  schalld: 'Druckschalldämpfer zugesetzt (Dämmstoff durch Kondensat gequollen): hoher Gegendruck (PI 812 deutlich höher als der Druck der Gasabgabe), Druckgastemperatur ≈ 80 °C. Reserve übernehmen, kondensatbeständigen Original-Dämpfungseinsatz mit Serien-Nr. bestellen.',
  druckklappe: 'Druckklappe HV 812 nach Wartung nur 18 % offen: hoher Druck PI 812, Druckgastemperatur ≈ 80 °C, lautes, gepresstes Laufgeräusch. Vor Ort: Druckklappe ganz öffnen.',
  wicklung: 'Isolationsfehler der Motorwicklung: Motorschutz löst beim Einschalten sofort aus (Kurzschlussauslöser), Isolationswiderstand 0,3 MΩ. Nicht wieder einschalten! V1 gesichert lassen, Ex-Motor II 2G (Zone 1), IIB T4, 5,5 kW, B3, mit Kaltleiter bestellen (Motordaten vom Typenschild).',
  luefter: 'Lüfterrad des Motors gebrochen: Kaltleiterauslösung mehrfach im Störungsspeicher, Bruchstücke in der Lüfterhaube. Quittieren erst nach Abkühlen möglich – der Motor überhitzt dann erneut. Originales, ableitfähiges Lüfterrad nach Motor-Serien-Nr. bestellen (Kunststoff-Handelsware ist im Ex-Bereich unzulässig).',
  einstellung: 'Motorschutzschalter auf 3,2 A statt 10,4 A (Bemessungsstrom laut Typenschild) eingestellt: Auslösung „Überlast“, obwohl der Motorstrom normal ist. Vor Ort: Einstellwert auf 10,4 A korrigieren, Störung quittieren, V1 wieder in AUTO.',
};
// Hinweise zur Bestellung: Anforderungen, die genannt sein sollten
const ANF = { riemen_defekt: /leitf|ISO\s*1813|ableit|satz/i, spalt: /ATEX|2G|Zone\s*1|Ex/i, fds: /IIA|Baumuster|baugleich|Typenschild|Original/i, wassersack: /Gef(ä|ae)lle|1\s*%/i,
  rsk: /Edelstahl|1\.4571|FKM|Deponiegas|H2S|H₂S/i, lager: /Original|Serien|ATEX|Ex/i, schalld: /kondensat|Original|Serien/i, wicklung: /2G|Zone\s*1|ATEX|Ex|T[1-4]|IIB/i, luefter: /ableit|leitf|Original|Ex/i };
const ANF_TEXT = { riemen_defekt: 'elektrisch leitfähig (ISO 1813), satzgleich', spalt: 'ATEX-Kategorie 2G, Zone 1', fds: 'baugleicher Einsatz laut Typenschild der FDS (Baumusterprüfung, IIA)', wassersack: 'Gefälle ≥ 1 % zum Kondensatabscheider',
  rsk: 'Werkstoff und Dichtung für Deponiegas (Edelstahl, FKM)', lager: 'Originalteile nach Serien-Nr. (Ex-Gebläsestufe)', schalld: 'kondensatbeständig, Original', wicklung: 'II 2G für Zone 1, mind. T3, Daten vom Typenschild', luefter: 'ableitfähig, Originalteil für Ex-Motor' };
const FUER = { fds: 'Station', wassersack: 'Hauptsammler' };

const V = (i) => sim.G.g[i];
const bereit = (i) => { const x = V(i); return x.wahl === 'auto' && x.rep && !x.schloss && !x.stoer && x.hs > 95 && x.hd > 95 && !x.ent && !x.schutzAb; };
function behoben() {
  const G = sim.G, x = V(0), u = U0();
  if (u === 'saugklappe') return x.hs >= 95;
  if (u === 'druckklappe') return x.hd >= 95;
  if (u === 'kondensat') return G.k1gespuelt;
  if (u === 'siphon') return G.siphon >= 30;
  if (u === 'riemen_locker') return x.gespannt;
  if (u === 'oel') return x.oel >= 40;
  if (u === 'einstellung') return x.ms >= 10 && x.ms <= 11 && !x.stoer;
  if (u === 'wassersack') return G.ws.prov;
  return false;
}
const bestellt = () => sim.G.bestellungen;
const artikel = (id) => KATALOG.find((a) => a.id === id);
// Prüfschritte
function chkSymptom(k) {
  if (k === 'G1') return [
    ['Unterdruck am Eintritt und vor V1 verglichen (PI 801 / PI 811)', () => hat(/angesehen: PI 801/) && hat(/angesehen: PI 811/), 'Der Unterschied zwischen PI 801 und PI 811 ist der Druckverlust von Kondensatabscheider, Flammendurchschlagsicherung und Saugklappe – er zeigt, ob das Problem vor dem Verdichter liegt.'],
    ['Kondensatabscheider K1 und Differenzdruck der FDS (PDI 803) geprüft', () => hat(/angesehen: K1/) && hat(/angesehen: PDI 803/), 'Gemeinsame Bauteile der Saugseite: Ein voller Abscheider oder ein zugesetzter Flammenfilter drosselt beide Verdichter gleichermaßen.'],
    ['Stellung der Saugklappe HV 811 geprüft', () => hat(/angesehen: HV 811/), 'Nach Wartungsarbeiten nicht ganz geöffnete Klappen sind eine häufige und schnell auszuschließende Ursache.'],
    ['Drehzahl der Gebläsewelle gemessen und mit der Motordrehzahl verglichen', () => hat(/V1 Drehzahl Gebläsewelle/), 'Ein Drehkolbengebläse fördert proportional zur Drehzahl. Dreht die Gebläsewelle langsamer als Motor × Übersetzung, rutschen die Riemen; stimmt die Drehzahl, liegt der Fehler in der Stufe oder auf der Saugseite.'],
  ];
  if (k === 'G2') return [
    ['Druckschwankungen vor Ort an PI 801 und Druckseite beobachtet', () => hat(/angesehen: PI 801/) && hat(/angesehen: PI 812/), 'Schwankt nur die Saugseite, liegt die Ursache im Netz bzw. am Abscheider; schwankt vor allem die Druckseite, eher an Rückschlagklappe oder Antrieb.'],
    ['Gasanalyse (O₂) kontrolliert', () => hat(/angesehen: QI 801/), 'Steigender Sauerstoff zeigt, dass irgendwo Luft angesaugt wird – z. B. über einen leeren Siphon.'],
    ['Kondensatabscheider und Siphon begutachtet', () => hat(/angesehen: K1/), 'Fehlendes Sperrwasser im Siphon oder ein überfüllter Abscheider verursachen ebenfalls unruhigen Unterdruck.'],
    ['Hauptsammler außerhalb der Station begutachtet', () => hat(/angesehen: Hauptsammler/), 'Sackt eine Leitung ab, entsteht ein Wassersack: Das Gas drückt sich stoßweise durch das Kondensat – typisch sind gleichmäßige, langsame Schwankungen.'],
    ['V1 abgehört bzw. Riementrieb oder Rückschlagklappe geprüft', () => hat(/V1 abgehört/) || hat(/V1 Riementrieb begutachtet/) || hat(/V1 Rückschlagklappe abgehört/), 'Quietschen am Riementrieb oder Klappern an der Rückschlagklappe grenzen die Ursache am Verdichter ein.'],
  ];
  if (k === 'G3') return [
    ['V1 abgehört', () => hat(/V1 abgehört/), 'Das Geräuschbild (mahlend, metallisch-hart, gepresst) unterscheidet Lager-, Getriebe- und Gegendruckprobleme.'],
    ['Lagertemperatur und Schwingung von V1 gemessen', () => hat(/V1 Lagertemperatur/) && hat(/V1 Schwingschnelle/), 'Messwerte statt Eindruck: Lagertemperatur über 80 °C und Schwingung im Schadensbereich deuten auf einen Lagerschaden.'],
    ['Druck und Temperatur auf der Druckseite abgelesen (PI 812, TI 812)', () => hat(/angesehen: PI 812/) && hat(/angesehen: TI 812/), 'Die Druckgastemperatur steigt mit der Druckerhöhung. Hoher Druck vor dem Schalldämpfer zeigt einen Widerstand auf der Druckseite.'],
    ['Ölstand der Gebläsestufe kontrolliert', () => hat(/angesehen: Öl V1/), 'Zu wenig Öl schädigt Synchronisationszahnräder und Lager.'],
  ];
  return [
    ['Störungsspeicher der Steuerung angesehen', () => hat(/angesehen: Steuerung/), 'Art und Häufigkeit der Auslösungen (Kurzschluss, Überlast, Kaltleiter) geben die Richtung vor.'],
    ['Motorschutz-Einstellwert mit dem Typenschild des Motors verglichen', () => hat(/angesehen: M V1/), 'Der Motorschutzschalter wird auf den Bemessungsstrom laut Typenschild eingestellt (hier 10,4 A).'],
    ['Motor geprüft (Sichtprüfung oder Isolationsmessung am freigeschalteten Motor)', () => hat(/V1 Sichtprüfung/) || hat(/V1 Isolationswiderstand/), 'Ein Wicklungsschaden zeigt sich bei der Isolationsmessung, ein gebrochenes Lüfterrad bei der Sichtprüfung der Lüfterhaube.'],
  ];
}
const chkDiagnose = () => [['Ursache richtig festgestellt (Auswahl in der Meldung)', () => sim.diagnose === U0(), 'Die Diagnose entscheidet, ob vor Ort behoben werden kann oder ein Ersatzteil bestellt werden muss.']];
const chkGaswarn = () => [['Persönliches Gaswarngerät vor dem Betreten des Ex-Bereichs eingeschaltet', () => {
  const g = pidx(/Gaswarngerät eingeschaltet/), innen = pidx(/^(angesehen: (PI 8|K1|PDI|QI|GWA|Ex-Zonenplan|Steuerung|V[12] |Typenschild|Öl|Riementrieb|M V|TI|HV|V 8|=\+SK)|V[12] (?!.*Wahlschalter)|K1 )/);
  return g >= 0 && (innen < 0 || g < innen);
}, 'Im Verdichterraum kann bei Undichtheiten Methan austreten; die ortsfesten Sensoren hängen unter der Decke. Das persönliche Gerät warnt dort, wo man arbeitet (CH₄, O₂, H₂S).']];
const chkVorOrt = (u) => {
  const c = [['Ursache vor Ort beseitigt', behoben, 'Die Ursache lag nicht an einem defekten Bauteil und konnte ohne Ersatzteil behoben werden.']];
  if (u === 'riemen_locker') c.push(...chkFreischalten('Vor dem Öffnen des Riemenschutzes'));
  if (u === 'wassersack') c.push(...chkBestellung(u));
  c.push(['V1 wieder in AUTO und betriebsbereit', () => bereit(0), 'Nach der Beseitigung muss der Führungsverdichter wieder im Automatikbetrieb laufen (Reparaturschalter EIN, Klappen offen, Riemenschutz montiert).'],
    ['Reserve V2 betriebsbereit (AUTO, Reparaturschalter EIN, beide Klappen offen)', () => bereit(1), 'Zum Kontrollgang gehört die Reserve: Sie muss jederzeit übernehmen können.']);
  return c;
};
const chkFreischalten = (wann = '') => [
  [`${wann ? wann + ': ' : ''}V1 am Wahlschalter abgeschaltet, bevor der Reparaturschalter betätigt wurde`, () => hat(/V1 Reparaturschalter AUS/) && !hat(/V1 Reparaturschalter AUS \(0\) – Verdichter lief noch/), 'Der Reparaturschalter ist ein Lasttrennschalter zum Sichern, kein Betriebsschalter – im Ex-Bereich soll er nicht unter Last geschaltet werden.'],
  ['Reparaturschalter V1 auf 0 und mit Vorhängeschloss gesichert', () => hat(/V1 Reparaturschalter mit Vorhängeschloss/), 'Gegen Wiedereinschalten sichern (2. Sicherheitsregel).'],
  ['Wirksamkeit der Freischaltung geprüft (Einschaltversuch)', () => hat(/V1 Einschaltversuch \(Wahlschalter HAND\): Antrieb läuft nicht an/), 'Erst der Einschaltversuch zeigt, dass wirklich der richtige Antrieb freigeschaltet ist.'],
];
const chkAusser = () => [
  ['Reserve V2 vor der Umschaltung geprüft und betriebsbereit (beide Klappen offen)', () => bereit(1) || (V(1).hs > 95 && V(1).hd > 95 && V(1).run), 'Erst wenn die Reserve sicher fördern kann, darf V1 außer Betrieb gehen – nach Wartungen auch die Klappenstellungen kontrollieren.'],
  ['V2 hat nachweislich Gas gefördert (FI 801 ≥ 180 Nm³/h)', () => V(1).qMax >= 180, 'Kontrolle an FI 801 und PI 801: Hält die Reserve den Unterdruck?'],
  ...chkFreischalten(),
  ['Erst Druck-, dann Saugklappe von V1 geschlossen', () => { const d = pidx(/V1 Druckklappe HV 812 \d+ → 0 %/), s = pidx(/V1 Saugklappe HV 811 \d+ → 0 %/); return d >= 0 && s > d; }, 'Die Druckklappe trennt den Verdichter vom Druck der Gasabgabe; danach wird saugseitig abgesperrt.'],
  ['V1 über die Abblaseleitung entspannt, ohne Gas aus dem Netz abzublasen', () => hat(/V1 Entspannungsventil .*geöffnet/) && !hat(/V1 Entspannungsventil .*geöffnet – ACHTUNG/), 'Erst wenn beide Klappen geschlossen sind, wird der eingeschlossene Gasinhalt gefahrlos über Dach entspannt.'],
];
function chkBestellung(u) {
  const soll = BEDARF[u] || [], snArt = soll.map(artikel).find((a) => a && a.sn);
  const c = [
    [`Richtiges Ersatzteil bestellt (${soll.map((id) => artikel(id).name.split(',')[0]).join(' + ')})`, () => soll.every((id) => bestellt().some((b) => b.id === id)), 'Das bestellte Teil muss die festgestellte Ursache beseitigen.'],
    ['Kein unzulässiger Artikel bestellt (Ex-Schutz, Werkstoff, Abmessung)', () => bestellt().length > 0 && bestellt().every((b) => !artikel(b.id).fehler), 'Im Ex-Bereich (Zone 1) sind nur Geräte der Kategorie 2G mit ausreichender Temperaturklasse zulässig; Riemen müssen ableitfähig sein, sicherheitsrelevante Teile Originalteile.'],
    ['Keine unnötigen Teile bestellt', () => bestellt().every((b) => soll.includes(b.id)), 'Lagerware (z. B. Getriebeöl) und Teile ohne Befund werden nicht bestellt.'],
    ['Aggregat bzw. Einbauort richtig angegeben', () => bestellt().some((b) => soll.includes(b.id) && b.fuer === (FUER[u] || 'V1')), 'Der Einkauf muss wissen, für welches Aggregat das Teil ist.'],
  ];
  if (snArt) c.push(['Typ und Serien-Nr. vom Typenschild in der Bestellung angegeben', () => bestellt().some((b) => soll.includes(b.id) && b.typ.includes(snArt.sn === 'mot' ? MOT.snr[0] : GEB.snr[0])), `Ex-Ersatzteile werden nach Serien-Nr. ausgeliefert (V1: ${snArt.sn === 'mot' ? `Motor ${MOT.snr[0]}` : `Gebläse ${GEB.snr[0]}`}). Achtung: Die Reserve V2 hat eine andere Nummer.`]);
  if (ANF[u]) c.push([`Besondere Anforderungen genannt (${ANF_TEXT[u]})`, () => bestellt().some((b) => soll.includes(b.id) && (ANF[u].test(b.anf) || ANF[u].test(b.typ))), 'Die Anforderungen vor Ort (Ex-Zone, Gasart, Kondensat) gehören ausdrücklich in die Bestellanforderung, damit der Lieferant kein ungeeignetes Teil liefert.']);
  return c;
}
const chkEnde = () => { const G = sim.G; return [
  ...chkGaswarn(),
  ['Riemenschutz nie am laufenden oder ungesicherten Antrieb geöffnet', () => !hat(/Riemenschutz abgenommen – /) && !hat(/läuft ohne Riemenschutz/), 'Offener Riementrieb nur bei gesichertem Stillstand – Einzugsgefahr.'],
  ['Kein Lufteinbruch durch Bedienung (K1 nicht unter Unterdruck abgelassen, nicht bei offenen Klappen entspannt)', () => !hat(/Luft wird angesaugt/) && !hat(/ACHTUNG: Klappen nicht geschlossen/), 'Luft im Deponiegas bildet ein explosionsfähiges Gemisch und kann im Deponiekörper Brände auslösen.'],
  ['Gasabsaugung lief durchgehend (kein Ausfall über 2 min)', () => G.stillT < 120, 'Ohne Absaugung tritt Deponiegas diffus aus (Methan ist rund 28-mal klimaschädlicher als CO₂) und kann in Gebäude und Schächte wandern.'],
  ['Keine Abschaltung durch Übertemperatur', () => !hat(/Abschaltung: Druckgastemperatur/) && !hat(/Kaltleiter hat ausgelöst/), 'Übertemperatur zeigt, dass ein Verdichter gegen einen zu hohen Widerstand gelaufen ist (z. B. geschlossene Druckklappe).'],
  ['Meldung an die Schichtleitung abgegeben', () => hat(/^MELDUNG an Schichtleitung/), 'Befund, festgestellte Ursache, Maßnahmen, Zustand von V1/V2 und bestellte Ersatzteile.']]; };
function gasChecks() {
  const G = sim.G, u = U0(), fix = VOR_ORT_BEHEBBAR.includes(u) || u === 'wassersack';
  const c = [...chkSymptom(G.karte), ...chkDiagnose()];
  if (fix) return [...c, ...chkVorOrt(u), ...chkEnde()];
  if (u === 'fds') return [...c, ...chkBestellung(u), ['Absaugung aufrechterhalten (kein Verdichter ohne Not abgeschaltet)', () => G.g.some((x) => x.run), 'Die FDS liegt in der gemeinsamen Saugleitung – die Reserve hilft nicht. Bis zum Tausch läuft die Absaugung mit verminderter Leistung weiter.'], ...chkEnde()];
  return [...c, ...chkAusser(), ...chkBestellung(u), ...chkEnde()];
}
const zust = (x) => x.stoer ? `Störung (${x.stoer})` : !x.rep ? `Rep.-Sch. 0${x.schloss ? ', gesichert' : ''}` : x.run ? `Betrieb ${f1(x.f)} Hz, ${WAHL[x.wahl]}` : `bereit, ${WAHL[x.wahl]}`;
const REIHENFOLGE = 'Persönliches Gaswarngerät einschalten – Reserve V2 prüfen (AUTO, Reparaturschalter EIN, Saug- und Druckklappe offen) – V1 Wahlschalter 0 – V2 übernimmt, Unterdruck und Gasmenge kontrollieren – Reparaturschalter V1 auf 0, Schloss – Einschaltversuch – Druckklappe zu – Saugklappe zu – Entspannen über die Abblaseleitung – Typenschild ablesen – Ersatzteil mit Typ, Serien-Nr. und Ex-Anforderungen bestellen – Meldung';

function gasMission(karte, art = 'karte') {
  const zufall = art === 'zufall';
  const ziel = 'Stelle die Ursache vor Ort fest. Kann sie ohne Ersatzteil beseitigt werden, tu das. Sonst nimm die baugleiche Reserve V2 sicher in Betrieb, nimm V1 ex-gerecht außer Betrieb und bestelle das passende Ersatzteil – unter Beachtung der Anforderungen im Ex-Bereich (Explosionsschutzdokument, Typenschilder). Gib eine Meldung mit der festgestellten Ursache an die Schichtleitung ab.';
  const symptom = `Gasverdichterstation der Deponie, Schichtbeginn. ${SYMPTOM[karte]}`;
  return {
    id: zufall ? 'gas_zufall' : `gas_${karte}`, titel: zufall ? 'Störung Gasverdichter (Zufallskarte)' : `Gasverdichter: ${KARTEN[karte].kurz}`, karte, gas: karte,
    bereich: 'Deponiegasabsaugung · Instandhaltung', dauer: '30–45 min', stufe: 3, start: 'verdichter', vorlauf: 2, speed: 5,
    auftrag: zufall ? `An der Deponiegas-Verdichterstation ist eine Störung am Drehkolbengebläse V1 aufgetreten (eine zufällige Störungskarte wird beim Start gezogen). ${ziel}` : `${symptom} ${ziel}`,
    auftragStart: `${symptom} ${ziel}`,
    lehrer: `Die Ursache wird bei jedem Start zufällig gezogen (der Bericht nennt sie). ${zufall ? 'Karten: ' + Object.entries(KARTEN).map(([k, v]) => `${k} ${v.titel}`).join(' · ') + '. ' : `Mögliche Ursachen: ${Object.values(KARTEN[karte].ursachen).join(' · ')}. `}Vor Ort behebbar: Klappen öffnen, Siphon spülen bzw. auffüllen, Riemen nachspannen (nach Freischalten), Öl nachfüllen, Motorschutz auf 10,4 A einstellen; beim Wassersack provisorisch unterbauen und Auflager plus Rohrleitungsbau bestellen. Alle anderen Ursachen: ${REIHENFOLGE}. Im Katalog stehen bewusst ungeeignete Artikel (ohne Ex-Schutz, Kategorie 3G, T1, nicht leitfähige Riemen, Luftausführung, Grauguss/EPDM, Fremdfilter). Falle: In etwa einem Drittel der Starts ist die Druckklappe der Reserve V2 nach der Wartung von vorgestern geschlossen geblieben (Karten G1–G3); V2 läuft dann gegen das Sicherheitsventil, die Druckgastemperatur steigt bis zur Abschaltung. Fehlbedienungen mit Folgen: Kondensat bei laufender Absaugung ablassen (Luft), Entspannen bei offenen Klappen (Gas über Dach, Gaswarnanlage), Riemenschutz am ungesicherten Antrieb öffnen.`,
    lehrerBericht() { const G = sim.G, u = U0(); return `Gezogen: ${KARTEN[G.karte].titel} – Ursache: ${KARTEN[G.karte].ursachen[u]}. ${LOESUNG[u]} ${G.falle ? 'Falle aktiv: Die Druckklappe HV 822 der Reserve V2 war geschlossen.' : ''} ${this.lehrer}`; },
    checks: gasChecks,
    werte: () => { const G = sim.G; return [['Unterdruck PI 801', `−${f1(G.pn)}`, 'mbar'], ['Gasmenge FI 801', f0(G.q), 'Nm³/h'], ['O₂ QI 802', f1(G.o2), 'Vol-%'], ['CH₄ QI 801', f1(G.ch4), 'Vol-%'], ['V1', zust(G.g[0]), ''], ['V2', zust(G.g[1]), ''], ['BHKW P el', f0(G.pel), 'kW'], ['Bestellwert', fe(G.bestellungen.reduce((s, b) => s + b.preis * b.menge, 0)), '€']]; },
    charts: CHARTS[karte],
    kennzahl: () => { const G = sim.G, w = G.bestellungen.reduce((s, b) => s + b.preis * b.menge, 0); return `Seit Missionsstart abgesaugt ${f0(G.vGas)} Nm³ Deponiegas, Energiebedarf der Verdichter ${f1(G.eKwh)} kWh.${G.vDiffus > 0.5 ? ` Während des Absaugungsausfalls diffus entwichen ≈ ${f0(G.vDiffus)} Nm³ (≈ ${f0(G.vDiffus * PG.CH4 / 100 * 0.717 * 28)} kg CO₂-Äquivalent).` : ''}${w ? ` Bestellwert: ${fe(w)} €.` : ''}`; },
    hinweise: () => {
      const G = sim.G, h = [], u = U0(), fix = VOR_ORT_BEHEBBAR.includes(u);
      h.push(`Gezogene Karte: ${KARTEN[G.karte].titel}. Tatsächliche Ursache: ${KARTEN[G.karte].ursachen[u]}.`);
      if (sim.diagnose && sim.diagnose !== u) h.push(`Gewählt wurde: ${sim.diagnose === 'unklar' ? 'Ursache nicht eindeutig' : KARTEN[G.karte].ursachen[sim.diagnose]}.`);
      if (!sim.diagnose) h.push('Es wurde keine Ursache in einer Meldung angegeben.');
      if (!G.gaswarn) h.push('Das persönliche Gaswarngerät wurde nicht eingeschaltet.');
      if (fix && hat(/V1 Reparaturschalter AUS/) && u !== 'riemen_locker') h.push('Die Ursache war vor Ort behebbar – eine Außerbetriebnahme von V1 war nicht nötig.');
      if (G.falle) h.push(hat(/V2 Druckklappe HV 822 0 → /) ? 'Die nach der Wartung geschlossene Druckklappe der Reserve V2 wurde erkannt und geöffnet.' : 'Die Druckklappe HV 822 der Reserve V2 war nach der Wartung geschlossen geblieben und wurde nicht geöffnet.');
      if (hat(/V2 Abschaltung: Druckgastemperatur/)) h.push('V2 lief gegen die geschlossene Druckklappe (Sicherheitsventil bläst ab) und wurde wegen Übertemperatur abgeschaltet.');
      if (hat(/Verdichter lief noch/)) h.push('Ein Reparaturschalter wurde unter Last ausgeschaltet.');
      if (hat(/Riemenschutz abgenommen – /)) h.push(`Der Riemenschutz wurde abgenommen, obwohl der Antrieb nicht gesichert war (${erstes(/Riemenschutz abgenommen – /).text.split(' – ')[1]}).`);
      if (hat(/Luft wird angesaugt/)) h.push('Der Kondensatabscheider wurde bei laufender Absaugung abgelassen – dabei wurde Luft in den Gasweg gesaugt.');
      if (hat(/ACHTUNG: Klappen nicht geschlossen/)) h.push('Ein Verdichter wurde bei offenen Klappen entspannt – Deponiegas strömte über die Abblaseleitung ab.');
      if (G.stillT > 0) h.push(`Die Gasabsaugung stand insgesamt ${f0(G.stillT / 60)} min (Simulationszeit).`);
      if (hat(/Störung .* quittiert/) && (u === 'wicklung' || u === 'luefter')) h.push('Die Störung wurde quittiert, ohne die Ursache zu beseitigen – bei einem Motorschaden schaltet der Schutz erneut ab.');
      if (u === 'riemen_defekt' && hat(/V1 Keilriemen nachgespannt/)) h.push('Nachspannen beseitigt verschlissene Riemen nicht.');
      if (hat(/K1 Kondensat über den Ablasshahn/) && u === 'kondensat' && !G.k1gespuelt) h.push('Ablassen senkt den Stand nur kurzzeitig – der verstopfte Siphon bleibt die Ursache.');
      for (const b of G.bestellungen) { const a = artikel(b.id); if (a.fehler) h.push(`Bestellung „${a.name}“: ${a.fehler}.`); else if (!(BEDARF[u] || []).includes(b.id)) h.push(`Bestellung „${a.name}“ war nicht nötig${a.lager ? ' (Lagerware)' : ''}.`); }
      if (G.bestellungen.length) h.push(`Bestellwert gesamt: ${fe(G.bestellungen.reduce((s, b) => s + b.preis * b.menge, 0))} €.`);
      else if ((BEDARF[u] || []).length) h.push('Es wurde kein Ersatzteil bestellt.');
      return h;
    },
  };
}

export const MISSIONEN = [
  {
    id: 'frei', titel: 'Freies Üben', bereich: 'Gasverdichterstation', dauer: 'offen', stufe: 1, start: 'verdichter', vorlauf: 2,
    auftrag: 'Normalbetrieb ohne Störung. Begehe die Gasverdichterstation, lies die Vor-Ort-Instrumente ab und vergleiche sie mit der Leitwarte. Wie groß sind die Druckverluste zwischen PI 801 und PI 811? Welche Ex-Kennzeichnung tragen Gebläse und Motor?',
    lehrer: 'Keine Störung. Geeignet zur Einweisung: Funktion des Drehkolbengebläses (Förderstrom ∝ Drehzahl, Regelung über FU), Druckverluste der Saugseite, Ex-Zonenplan und Typenschilder (II 2G, IIB, T3/T4), Freischalten nach den Sicherheitsregeln.',
    checks: [],
    werte: () => { const G = sim.G; return [['Unterdruck PI 801', `−${f1(G.pn)}`, 'mbar'], ['Gasmenge FI 801', f0(G.q), 'Nm³/h'], ['CH₄', f1(G.ch4), 'Vol-%'], ['BHKW P el', f0(G.pel), 'kW'], ['V1', zust(G.g[0]), '']]; },
    charts: [CH.pn, CH.q],
    hinweise: () => [`Angesehene Vor-Ort-Instrumente: ${new Set(sim.log.filter((l) => /^angesehen: /.test(l.text)).map((l) => l.text.slice(11).split(' (')[0])).size}.`],
  },
  ...Object.keys(KARTEN).map((k) => gasMission(k)),
  { ...gasMission('G1', 'zufall'), wuerfel: () => { const k = Object.keys(KARTEN)[Math.floor(Math.random() * 4)]; return { ...gasMission(k, 'zufall'), karte: k, gas: k }; } },
];

export function initMissionen({ ui, walk, setExam }) {
  let aktiv = null, ctx = null, bericht = null;
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
  $('misList').innerHTML = MISSIONEN.map((m) => `<div class="mis">
    <div class="misT"><b>${m.titel}</b><span class="st" title="Schwierigkeit">${stars(m.stufe)}</span></div>
    <div class="misM">${m.bereich} · ${m.dauer}${m.speed ? ` · Zeitraffer ×${m.speed}` : ''}</div>
    <p>${m.auftrag}</p>
    <details><summary>Lösungshinweise (Lehrkräfte)</summary><p>${m.lehrer}</p></details>
    <button class="btn on" data-m="${m.id}">▶ Mission starten</button></div>`).join('');
  ui.overlays.push('mis', 'brief', 'ausw');

  const open = () => { $('spSel').value = String(sim.speed); $('mis').style.display = 'flex'; };
  $('bMis').onclick = open; $('bMis2').onclick = open;
  $('misClose').onclick = () => { $('mis').style.display = 'none'; };
  $('spSel').onchange = () => { sim.speed = +$('spSel').value; };
  $('misList').onclick = (e) => {
    const id = e.target.dataset.m; if (!id) return;
    let m = MISSIONEN.find((x) => x.id === id);
    if (m.wuerfel) m = m.wuerfel();
    const exam = $('misExam').checked; ui.erklaer = !exam; setExam(exam);
    startSzenario({ gas: m.gas || null, speed: m.speed || +$('spSel').value, titel: `Mission „${m.titel}“${exam ? ' (Prüfungsmodus)' : ''}` });
    ui.diagnose = !!m.gas;
    aktiv = m; ctx = { t0: performance.now(), tSim0: sim.G.t, exam, werteStart: m.werte ? m.werte() : [] };
    $('mis').style.display = 'none';
    $('briefT').textContent = m.titel; $('briefM').textContent = `${m.bereich} · ${m.dauer}`; $('briefA').textContent = m.auftragStart || m.auftrag;
    $('brief').style.display = 'flex'; $('misBar').style.display = 'flex'; document.body.classList.add('mission'); $('misName').textContent = m.titel;
  };
  $('briefGo').onclick = () => { $('brief').style.display = 'none'; walk.enter(aktiv ? aktiv.start : 'verdichter'); if (aktiv) ui.showPLS(); };
  $('bAuftrag').onclick = () => { $('brief').style.display = 'flex'; };

  $('bEnde').onclick = () => {
    if (!aktiv) return;
    if (!ctx.beendet) { logA(`Mission „${aktiv.titel}“ beendet`, 'sys'); ctx.beendet = true; }
    bericht = sammleBericht(aktiv, ctx);
    $('auswT').textContent = aktiv.titel;
    $('ausw').style.display = 'flex';
    renderBericht($('auswBody'), bericht);
  };
  $('auswPDF').onclick = async () => {
    if (!bericht) return;
    bericht.name = $('auswName').value.trim();
    const b = $('auswPDF'); b.disabled = true; b.textContent = 'PDF wird erstellt …';
    try { const f = await berichtAlsPDF(bericht, { musterloesung: $('auswML').checked }); ui.toast(`Gespeichert: ${f}`); }
    catch (err) { ui.toast(`PDF konnte nicht erstellt werden: ${err.message}`); }
    finally { b.disabled = false; b.textContent = '⬇ Bericht als PDF'; }
  };
  $('auswCopy').onclick = async () => {
    const txt = `${$('auswT').textContent}\n${$('auswBody').innerText}\n\n${logText()}`;
    try { await navigator.clipboard.writeText(txt); ui.toast('Bericht und Protokoll kopiert.'); } catch { ui.toast('Kopieren nicht möglich.'); }
  };
  $('auswClose').onclick = () => { $('ausw').style.display = 'none'; };
  $('auswNeu').onclick = () => { $('ausw').style.display = 'none'; aktiv = null; ui.diagnose = null; ctx = null; $('misBar').style.display = 'none'; document.body.classList.remove('mission'); setExam(false); ui.erklaer = true; open(); };
  setInterval(() => { if (aktiv) { const s = Math.floor((performance.now() - ctx.t0) / 1000); $('misTime').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; } }, 1000);
}
