# 3D-Ansicht Abfall- & Energiezentrum Schwierbach

Läuft ohne Build-Schritt direkt von GitHub Pages; three.js und jsPDF liegen lokal in `vendor/` (offline nutzbar).

## Ansichten

- **Luftbild**: Orbit-Kamera, Rundgang, Beschriftungen, Stoffströme, Innenansicht Gasverdichterstation.
- **Begehung** („🚶 Begehen“ bzw. „Station begehen“ im Infofenster der Gasverdichterstation): Ich-Perspektive
  rund um Verdichterstation, Hauptsammler, Fackel und BHKW. W A S D gehen, ziehen = umsehen, E/Klick = Instrument,
  Tab = Leitwarte. Touch: links ziehen = gehen, rechts ziehen = umsehen.

## Deponiegas-Simulation (`js/gas-modell.js`)

Zwei Drehkolbengebläse V1/V2 (Rotar DKG 300 Ex, Keilriemen 1 : 1,235, Ex-Motor 5,5 kW), Unterdruckregelung PIC 801
(−35 mbar) über den FU des Führungsverdichters, automatische Reserveübernahme. Brunnenfeld-Kennlinie mit Luftansaugung
bei zu hohem Unterdruck, Kondensatabscheider K1 mit Siphon, Flammendurchschlagsicherung, Saug-/Druckklappen,
Rückschlagklappe, Druckschalldämpfer, Sicherheitsventil 350 mbar, Druckgas- und Motortemperatur, Motorschutz/Kaltleiter,
Gasanalyse CH₄/O₂, BHKW/Fackel-Aufteilung, diffuse Emission bei Absaugungsausfall.

Vor Ort (`js/gas-szene.js`): Manovakuummeter/Manometer/Thermometer je Verdichter, Klappen, Entspannungsventil
(Abblaseleitung), Ölschauglas, Riemenschutz (abnehmen, Riemen prüfen, nachspannen), Typenschilder Gebläse und Motor,
Vor-Ort-Steuerstelle (Wahlschalter, Reparaturschalter mit Schloss, Einschaltversuch, Quittieren), Steuerung mit
Störungsspeicher und Motorschutz-Einstellung, K1 (ablassen, spülen, Siphon auffüllen), PDI 803, Gasanalyse,
Gaswarnanlage, Ex-Zonenplan, Zugang mit persönlichem Gaswarngerät, Hauptsammler (bei Wassersack sichtbar abgesackt;
Gefälle prüfen, abhören, provisorisch unterbauen), Fackel- und BHKW-Bedienfeld.

## Orientierung, Gasbrunnen, Querschnitt

- Aufstellungsplan am Eingang innen (Button „🗺 Aufstellungsplan“): Grundriss mit nummerierten Armaturen/Messstellen und eigenem Standort; im Prüfungsmodus ausgeblendet.
- Persönliches Gaswarngerät: Ladestation neben der Tür oder Button „📟 Gaswarngerät“; Anzeige (CH₄ % UEG, O₂, H₂S, CO) oben rechts.
- Begehung „Gasbrunnen GB 1.03“ (erste Berme, Gelände folgt der Böschung) und „Gassammelstation GS 1“: Messung am Brunnenkopf
  und Messstutzen, Regelarmatur der Leitung 1.03 einstellbar (Über-/Untersaugung, `brunnenWerte` in `gas-modell.js`, nur Anzeige).
- Querschnitt (`js/querschnitt.js`, aus Brunnenkopf, GS 1 oder Infokarte „Deponiegaserfassung“): maßstäblicher Schnitt Böschung
  mit Oberflächen- und Basisabdichtung, Brunnenausbau, Anschlussleitung mit Gefälle, GS 1, Kondensatschacht, Ringleitung;
  Detail A Brunnendurchführung; Gas- und Kondensatweg animiert; Umschalter „Setzung der Berme (Wassersack)“; Live-Unterdrücke.

## Missionen (`js/missionen.js`)

Störungskarten G1 Gasmenge zu gering · G2 Druckschwankungen · G3 Verdichter laut/heiß · G4 Motorschutz ausgelöst,
je 3–5 Ursachen (zufällig), plus Zufallskarte und freies Üben. Falle (≈ 35 %, G1–G3): Druckklappe der Reserve V2 nach
Wartung geschlossen. Ablauf: Diagnose → vor Ort beheben oder V2 übernehmen, V1 ex-gerecht freischalten, absperren
(erst Druck-, dann Saugseite), entspannen → **Bestellanforderung** (`js/bestellung.js`) aus einem Katalog mit bewusst
ungeeigneten Artikeln (ohne Ex-Schutz, 3G, T1, nicht leitfähige Riemen, Fremdfilter, falscher Werkstoff) mit Typ,
Serien-Nr. und Anforderungen → Meldung. Missionsbericht mit Prüfschritten, Bestellungen, Diagrammen und PDF (`js/bericht.js`).
