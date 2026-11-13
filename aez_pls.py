# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "marimo",
#     "numpy",
# ]
# ///

import marimo

__generated_with = "0.13.0"
app = marimo.App(width="full")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    return mo, np


@app.cell
def _():
    # ── Konfiguration ────────────────────────────────────────────────
    # Deploy-URLs. Nach dem Deployment hier die echten Adressen eintragen.
    # MVA-Spoke-App (mva_pls) – Link im Lageplan und im MVA-Tab:
    MVA_URL = "mva/"
    # Grundriss-Planer (eigenständige HTML-Seite, z. B. docs/grundriss/index.html).
    # Relative Adresse funktioniert, wenn sie neben dieser App liegt:
    GRUNDRISS_URL = "grundriss/"
    return GRUNDRISS_URL, MVA_URL


@app.cell
def _(mo):
    # === CSS Styles (identisch zum Kläranlagen-PLS, damit beide Betriebe eine Familie bilden) ===
    mo.Html("""<style>
    :root {
        --bg:#1a1a2e; --panel:#16213e; --border:#0f3460;
        --accent:#e94560; --ok:#00b894; --warn:#fdcb6e;
        --danger:#e17055; --txt:#dfe6e9; --val:#74b9ff;
    }
    .pls { background:var(--bg); color:var(--txt); padding:12px; border-radius:8px; font-family:'Consolas','Courier New',monospace; }
    .pls-hdr { background:linear-gradient(90deg,var(--panel),var(--border)); padding:10px 20px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border:1px solid var(--border); flex-wrap:wrap; gap:8px; }
    .pls-hdr h2 { margin:0; color:#74b9ff; font-size:1.3em; }
    .pls-st { display:flex; gap:15px; align-items:center; font-size:0.85em; flex-wrap:wrap; }
    .pls-dot { width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:4px; animation:pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .pls-c { background:var(--panel); border:1px solid var(--border); border-radius:6px; padding:12px; margin-bottom:10px; }
    .pls-c h3 { margin:0 0 8px 0; color:#74b9ff; font-size:1em; border-bottom:1px solid var(--border); padding-bottom:6px; }
    .pls-overview-tbl { border-collapse:separate; border-spacing:14px 2px; font-size:0.88em; color:#ffffff; background:#16213e; border-radius:4px; }
    .pls-overview-tbl th { text-align:left; padding:8px 16px !important; color:#74b9ff; border-bottom:2px solid #0f3460; background:#0f1a30; white-space:nowrap; }
    .pls-overview-tbl td { padding:6px 16px !important; border-bottom:1px solid #0f3460; white-space:nowrap; }
    .pls-overview-tbl tr:hover { background:#1e2d4d; }
    .c-v { color:var(--val); } .c-ok { color:var(--ok); } .c-w { color:var(--warn); } .c-d { color:var(--danger); }
    .pls-g2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .pls-g3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
    .pls-bar { height:16px; border-radius:3px; background:#2d3436; overflow:hidden; margin:4px 0; }
    .pls-bar-f { height:100%; border-radius:3px; transition:width 0.5s; }
    .pls-sep { border-top:1px solid var(--border); margin:8px 0; padding-top:8px; }
    .pls-soon { color:#b2bec3; font-size:0.9em; line-height:1.6; }
    .pls-soon ul { margin:6px 0 0 0; padding-left:18px; }
    .pls-soon li { margin:3px 0; }
    .pls-badge { display:inline-block; font-size:0.72em; padding:2px 8px; border-radius:10px; background:#0f3460; color:#74b9ff; border:1px solid #285a8c; margin-left:8px; vertical-align:middle; }
    </style>""")
    return


@app.cell
def _(mo):
    # === BETRIEBSVORGABEN (Leitstand) ===
    # Treiber des Gesamt-Stoff- und Energiebilanzmodells der Übersicht.
    muell_t = mo.ui.slider(start=300, stop=800, step=5, value=675,
                           label="Hausmüll-Anlieferung [t/d]", show_value=True)
    sortier_t = mo.ui.slider(start=0, stop=300, step=5, value=120,
                             label="Sperr-/Gewerbeabfall → Sortierung [t/d]", show_value=True)
    bio_t = mo.ui.slider(start=0, stop=200, step=5, value=90,
                         label="Bioabfall → Vergärung [t/d]", show_value=True)
    ks_t = mo.ui.slider(start=0, stop=100, step=2, value=40,
                        label="Klärschlamm (entwässert) [t/d]", show_value=True)
    heizwert = mo.ui.slider(start=8.0, stop=13.0, step=0.1, value=10.0,
                            label="Heizwert Hausmüll Hu [MJ/kg]", show_value=True)
    niederschlag = mo.ui.slider(start=0.0, stop=30.0, step=0.5, value=2.0,
                                label="Niederschlag (Deponie) [mm/d]", show_value=True)
    return bio_t, heizwert, ks_t, muell_t, niederschlag, sortier_t


@app.cell
def _():
    # =========================================================================
    #  LS 6.1 – Wertstoffsortieranlage (RecyTech GmbH)
    #  Transparentes Massenbilanz- und Wirtschaftlichkeitsmodell einer
    #  mechanischen Aufbereitung. Die Reihenfolge der Aggregate ist FREI
    #  wählbar – die Stufen werden in der gewählten Folge auf den Stoffstrom
    #  angewandt. Reihenfolge und Auswahl wirken direkt auf Ausbeute, Reinheit
    #  und Wirtschaftlichkeit (keine starr vorgegebene Musterlösung).
    #  Jedes Aggregat hat eine Nennkapazität: Überbelegung senkt Ausbeute und
    #  Reinheit. Personal wird je Schicht gerechnet.
    # =========================================================================
    S_MATS = ["PET", "PE", "PP", "Folie", "FKN", "Fe", "Al", "PPK", "Rest"]
    S_PRESETS = {
        "Gemischte Wertstofftonne": dict(PET=10, PE=10, PP=8, Folie=10, FKN=5, Fe=8, Al=3, PPK=20, Rest=26),
        "Kunststoffreich (LVP)":    dict(PET=15, PE=14, PP=12, Folie=14, FKN=6, Fe=5, Al=4, PPK=10, Rest=20),
        "Papier-/Kartonreich":      dict(PET=7, PE=7, PP=5, Folie=6, FKN=4, Fe=6, Al=2, PPK=40, Rest=23),
    }
    # Preise Sekundärrohstoffe (€/t) und Ziel-Material je Produkt.
    # Folie ist KEIN Produkt (Störstoff) → kein Preis, kein Ziel-Eintrag.
    S_MARKT = {
        "gut":     dict(PET=260, PE=190, PP=190, FKN=120, Fe=140, Al=950, PPK=85),
        "mittel":  dict(PET=180, PE=110, PP=110, FKN=40,  Fe=100, Al=700, PPK=40),
        "schwach": dict(PET=100, PE=30,  PP=30,  FKN=0,   Fe=60,  Al=500, PPK=0),
    }
    S_PREIS = S_MARKT["gut"]
    S_ZIEL = {"Fe-Metalle": "Fe", "Al / NE-Metalle": "Al", "PPK (Papier/Karton)": "PPK",
              "Getränkekartons (FKN)": "FKN", "PET": "PET", "PE": "PE", "PP": "PP"}
    # Aggregate-Metadaten. base=Standardlinie, opt=Optimierungsstufe.
    # fb = Fließbild-Label (| = Zeilenumbruch)
    # cap = Nennkapazität des Aggregats bezogen auf seinen Zulaufstrom [t/h]; ausgelegt auf den
    #       Planungspunkt 5 t/h (Standardlinie ≈ 75 % Last) → Mehrdurchsatz führt in die Überlast
    #       (Bandbelegung = Zulauf / cap; Handsortierung: Kapazität ergibt sich aus der Besetzung)
    S_STAGES = {
        "hand":   dict(label="Handsortierung",        fb="Hand-|sortierung",        sub="Störstoffe",      col="#fab1a0", invest=250000, kw=15, foot=(8, 3), cap=None, rolle="opt"),
        "sieb":   dict(label="Siebanlage",            fb="Siebanlage",              sub="Klassierung",     col="#fdcb6e", invest=700000, kw=45, foot=(8, 3), cap=6.7, rolle="base"),
        "ballistik": dict(label="Ballistikseparator", fb="Ballistik-|separator",    sub="2D / 3D",         col="#00cec9", invest=500000, kw=40, foot=(6, 3), cap=4.0, rolle="opt"),
        "wind":   dict(label="Windsichter",           fb="Windsichter",             sub="Papier/Leicht",   col="#00b894", invest=450000, kw=90, foot=(4, 3), cap=5.6, rolle="base"),
        "magnet": dict(label="Magnetabscheider",      fb="Magnetab-|scheider",      sub="Fe",              col="#e17055", invest=150000, kw=15,  foot=(2, 2), cap=4.1, rolle="base"),
        "eddy":   dict(label="Wirbelstromabscheider", fb="Wirbelstrom-|abscheider", sub="Al / NE",         col="#e84393", invest=450000, kw=30, foot=(3, 2), cap=3.6, rolle="base"),
        "nirfkn": dict(label="NIR-FKN (Kartons)",     fb="NIR-FKN",                 sub="Getränkekartons", col="#e0a458", invest=800000, kw=70, foot=(5, 3), cap=3.6, rolle="opt"),
        "nir":    dict(label="NIR-Sortierung",        fb="NIR-|Sortierung",         sub="PET · PE · PP",   col="#a29bfe", invest=1500000, kw=110, foot=(6, 3), cap=3.4, rolle="base"),
        "nirppk": dict(label="NIR-PPK (Papier)",      fb="NIR-PPK",                 sub="PPK-Nachreinigung", col="#55efc4", invest=500000, kw=45, foot=(5, 3), cap=3.0, rolle="opt"),
        "nir2":   dict(label="NIR-Nachsortierung",    fb="NIR-Nach-|sortierung",    sub="PET · PE · PP rein", col="#6c8cff", invest=900000, kw=60, foot=(6, 3), cap=1.5, rolle="opt"),
    }
    # Grundausstattung: Sackaufreißer, Aufgabebunker/Dosierung, Fördertechnik, Ballenpresse, Steuerung/E-Technik,
    # Montage und Inbetriebnahme
    S_GRUND_INVEST = 1800000
    S_GRUND_KW = 120
    S_ORDER = ["hand", "sieb", "ballistik", "wind", "nirppk", "magnet", "eddy", "nirfkn", "nir", "nir2"]

    # Bandbelegung: bis 85 % Nennlast volle Trennleistung, darüber sinkt die Ausbeute
    # und Fehlausträge (Mitreißen von Fremdmaterial) nehmen zu.
    S_LAST_OK = 0.85


    def s_lastfaktor(belegung):
        ueber = max(0.0, belegung - S_LAST_OK)
        f_rec = max(0.25, 1.0 - 0.9 * ueber)
        f_fehl = min(1.6, 1.0 + 1.2 * ueber)
        return f_rec, f_fehl


    def sortiermodell(durchsatz, comp, sequence, betriebsstd,
                      sortierentgelt=0.0, hand_n=4,
                      strompreis=0.20, lohn_fte=60000, lohn_hand=48000,
                      grundbesatz=2, ausfallfaktor=1.2, verwaltung_a=200000,
                      wartung_quote=0.06, versicherung_quote=0.015, markt="gut",
                      pick_t_h=0.15):
        # Entsorgungskosten Reststoffe (€/t, negativ = Kosten)
        # (inkl. CO₂-Zuschlag nach BEHG bei der thermischen Verwertung)
        ENTSORG = dict(sortierrest=-100.0, siebrest=-110.0, folien=-30.0)
        PREIS = S_MARKT.get(markt, S_MARKT["gut"])
        MATS = S_MATS
        schichten = max(1, round(betriebsstd / 2000))

        seq, seen = [], set()
        for k in sequence:
            if k in S_STAGES and k not in seen:
                seq.append(k)
                seen.add(k)

        s = sum(comp.values()) or 1.0
        main = {m: durchsatz * comp[m] / s for m in MATS}
        produkte, reste = {}, {}
        stage_out = []   # je Stufe: (key, [(name, masse, reinheit|None, kind), ...], belegung|None)
        # Zustand der Linie: klassiert = Siebung erfolgt (enges Korngrößenband für die
        # nachfolgenden Trenner); nur3d = Ballistik hat die Flachteile (2D) abgezogen
        zustand = dict(klassiert=False, nur3d=False)
        S_KLASSIERT_NOETIG = ("wind", "ballistik", "eddy", "nirfkn", "nir", "nir2", "nirppk")

        def pull(eta):
            prod = {}
            for m in MATS:
                moved = main[m] * min(1.0, eta.get(m, 0.0))
                prod[m] = moved
                main[m] -= moved
            return prod

        def merge(store, name, prod):
            if name in store:
                for m in MATS:
                    store[name][m] += prod[m]
            else:
                store[name] = dict(prod)

        def emit(name, prod, kind):
            merge(produkte if kind == "prod" else reste, name, prod)
            masse = sum(prod.values())
            reinheit = None if kind == "rest" else ((prod[S_ZIEL[name]] / masse) if masse > 1e-9 else 0.0)
            return (name, masse, reinheit, kind)

        def scaled(eta, target, f_rec, f_fehl):
            # Ziel-Ausbeute × Lastfaktor, Fehlausträge × Überlastfaktor
            return {m: (v * f_rec if m in target else v * f_fehl) for m, v in eta.items()}

        def nir_stufe(rec_max, cc, f_rec, f_fehl):
            # NIR-Erkennung leidet unter Fremdstoffen (Überdeckung, Fehlschüsse) –
            # gilt für Haupt- UND Nachsortierung. Die Nachsortierung ist kleiner
            # ausgelegt und nur sinnvoll, wenn sie einen vorsortierten Teilstrom erhält.
            gesamt = sum(main.values()) + 1e-9
            dirt = sum(main[m] for m in MATS if m not in ("PET", "PE", "PP")) / gesamt
            # Nach Ballistik liegen nur noch 3D-Teile auf dem Band: weniger Überdeckung
            # durch Flachteile, weniger Fehlschüsse
            k_dirt = 0.3 if zustand["nur3d"] else 0.6
            if zustand["nur3d"]:
                cc = {m: (v * 0.5 if m in ("Folie", "PPK", "Rest") else v) for m, v in cc.items()}
            rec = rec_max * (1 - k_dirt * dirt) * f_rec
            o = []
            for poly in ["PET", "PE", "PP"]:
                o.append(emit(poly, pull({m: (rec if m == poly else cc[m] * f_fehl) for m in MATS}), "prod"))
            return o

        def produkt_chips(namen):
            # Anzeige-Datensätze (ohne Massenbuchung) für bereits erzeugte Produktfraktionen
            recs = []
            for name in namen:
                prod = produkte[name]
                masse = sum(prod.values())
                reinheit = (prod[S_ZIEL[name]] / masse) if masse > 1e-9 else 0.0
                recs.append((name, masse, reinheit, "prod"))
            return recs

        def nachreinigung(namen, eta_fremd, f_rec, f_fehl, rueck_in_linie=True):
            # Zweiter Sortierdurchgang über bereits erzeugte Produktströme (Negativsortierung):
            # Fremdstoffe raus, wenige Fehlausträge des Zielmaterials; beides zurück in den Hauptstrom
            vorhanden = [n for n in namen if n in produkte]
            if not vorhanden:
                return []
            rueck = 0.0
            rueck_m = {m: 0.0 for m in MATS}
            for name in vorhanden:
                prod = produkte[name]
                ziel = S_ZIEL[name]
                for m in MATS:
                    d = prod[m] * (min(0.95, eta_fremd * f_rec) if m != ziel else 0.03 * f_fehl)
                    prod[m] -= d
                    rueck_m[m] += d
                    rueck += d
            if rueck_in_linie:
                for m in MATS:
                    main[m] += rueck_m[m]
                return produkt_chips(vorhanden) + [("Fehlwürfe (→ Rücklauf)", rueck, None, "rest")]
            merge(reste, "Sortierrest (→ EBS/MVA)", rueck_m)
            return produkt_chips(vorhanden) + [("Fehlwürfe (→ Sortierrest)", rueck, None, "rest")]

        def apply_stage(key):
            o = []
            zulauf = sum(main.values())
            if key == "nir2":
                zulauf = sum(sum(produkte[n].values()) for n in ("PET", "PE", "PP") if n in produkte)
            elif key == "nirppk":
                zulauf = sum(produkte["PPK (Papier/Karton)"].values()) if "PPK (Papier/Karton)" in produkte else 0.0
            cap = S_STAGES[key]["cap"]
            bel = (zulauf / cap) if cap else None
            f_rec, f_fehl = s_lastfaktor(bel) if bel is not None else (1.0, 1.0)
            if key in S_KLASSIERT_NOETIG and not zustand["klassiert"]:
                # ohne vorgeschaltete Siebung: breites Korngrößenspektrum, Großteile
                # verdecken Kleinteile → schlechtere Trennschärfe
                f_rec *= 0.85
                f_fehl *= 1.3

            if key == "hand":
                # Handsortierkabine. Vor der ersten Produktausschleusung = Vorsortierung
                # (Großteile/Störstoffe aus dem Hauptstrom), danach = Qualitätskontrolle
                # (Negativsortierung der bereits erzeugten Produktfraktionen).
                kap = hand_n * pick_t_h                       # entnehmbare Störstoffe [t/h]
                if not produkte:
                    rest_im_strom = main["Rest"]
                    eta_r = min(0.6, kap / max(1e-9, rest_im_strom))
                    bel = rest_im_strom / max(1e-9, kap) if kap > 0 else None
                    o.append(emit("Sortierrest (→ EBS/MVA)", pull({"Rest": eta_r}), "rest"))
                else:
                    stoer = {}
                    for name, prod in produkte.items():
                        ziel = S_ZIEL[name]
                        stoer[name] = sum(v for m, v in prod.items() if m != ziel)
                    stoer_ges = sum(stoer.values())
                    eta = min(0.8, kap / max(1e-9, stoer_ges))   # max. 80 % Klaubeleistung
                    bel = stoer_ges / max(1e-9, kap) if kap > 0 else None
                    raus = {m: 0.0 for m in MATS}
                    for name, prod in produkte.items():
                        ziel = S_ZIEL[name]
                        for m in MATS:
                            if m == ziel:
                                d = prod[m] * 0.01 * (1 if kap > 0 else 0)   # Fehlgriffe
                            else:
                                d = prod[m] * eta
                            prod[m] -= d
                            raus[m] += d
                    merge(reste, "Sortierrest (→ EBS/MVA)", raus)
                    o += produkt_chips(list(produkte))
                    o.append(("Störstoffe (→ Sortierrest)", sum(raus.values()), None, "rest"))
            elif key == "sieb":
                eta = {m: (0.55 if m == "Rest" else 0.03) for m in MATS}
                o.append(emit("Siebrest (Feinfraktion)", pull(scaled(eta, ("Rest",), f_rec, f_fehl)), "rest"))
                zustand["klassiert"] = True
            elif key == "ballistik":
                # Ballistikseparator: Flachteile (2D: Folien, flache Papiere) wandern nach oben,
                # körperförmige Teile (3D: Flaschen, Dosen, Kartons) rollen ab. Die 2D-Fraktion geht
                # in die Folienverwertung, der 3D-Strom läuft weiter zur NIR.
                eta = {m: {"Folie": 0.80, "PPK": 0.05, "Rest": 0.03}.get(m, 0.01) for m in MATS}
                o.append(emit("Folien (→ Verwertung)", pull(scaled(eta, ("Folie",), f_rec, f_fehl)), "rest"))
                zustand["nur3d"] = True
            elif key == "wind":
                # Windsichtung: Leichtgut = Papier + Folie (+ leichter Rest). Air-Klassierung kann
                # Folie nicht sauber vom Papier trennen → Rest-Folie verschmutzt die PPK-Fraktion.
                eta = {m: {"PPK": 0.80, "Folie": 0.50, "Rest": 0.12}.get(m, 0.01) for m in MATS}
                o.append(emit("PPK (Papier/Karton)", pull(scaled(eta, ("PPK",), f_rec, f_fehl)), "prod"))
            elif key == "magnet":
                eta = {m: (0.95 if m == "Fe" else 0.004) for m in MATS}
                o.append(emit("Fe-Metalle", pull(scaled(eta, ("Fe",), f_rec, f_fehl)), "prod"))
            elif key == "eddy":
                gesamt = sum(main.values()) + 1e-9
                penalty = min(0.45, (main["Fe"] / gesamt) * 2.5)   # Rest-Fe stört Wirbelstrom
                eta = {m: (0.85 * (1 - penalty) if m == "Al" else (0.20 if m == "Fe" else 0.01)) for m in MATS}
                o.append(emit("Al / NE-Metalle", pull(scaled(eta, ("Al",), f_rec, f_fehl)), "prod"))
            elif key == "nirfkn":
                eta = {m: (0.85 if m == "FKN" else 0.02) for m in MATS}
                o.append(emit("Getränkekartons (FKN)", pull(scaled(eta, ("FKN",), f_rec, f_fehl)), "prod"))
            elif key == "nir":
                cc = dict(PET=0.02, PE=0.02, PP=0.02, Folie=0.05, FKN=0.03, Fe=0.05, Al=0.05, PPK=0.04, Rest=0.04)
                o += nir_stufe(0.92, cc, f_rec, f_fehl)
            elif key == "nir2":
                # Nachreinigung: die von der Haupt-NIR ausgeschleusten Kunststoffströme laufen ein
                # zweites Mal über eine NIR; Fehlwürfe gehen in den Hauptstrom zurück
                o += nachreinigung(["PET", "PE", "PP"], 0.75, f_rec, f_fehl)
            elif key == "nirppk":
                # Papier-NIR auf der Leichtgutlinie: reinigt das Windsichter-Leichtgut nach
                # (Folien, Kunststoffe, Verbunde → Sortierrest)
                o += nachreinigung(["PPK (Papier/Karton)"], 0.70, f_rec, f_fehl, rueck_in_linie=False)
            return o, bel

        for k in seq:
            _o, _bel = apply_stage(k)
            stage_out.append((k, _o, _bel))
        merge(reste, "Sortierrest (→ EBS/MVA)", dict(main))

        # Erlöskurve: ab 95 % Reinheit voller Preis, 65–95 % linear, darunter Zuzahlung
        # (Fraktion verfehlt die Spezifikation und muss wie Sortierrest entsorgt werden).
        def eff_preis(basis, reinheit):
            if reinheit >= 0.65:
                return basis * min(1.0, (reinheit - 0.65) / 0.30)
            return ENTSORG["sortierrest"] * min(1.0, (0.65 - reinheit) / 0.15)

        ergebnis, erloes_a = [], 0.0
        for name, prod in produkte.items():
            masse = sum(prod.values())
            reinheit = (prod[S_ZIEL[name]] / masse) if masse > 1e-9 else 0.0
            basis = PREIS[S_ZIEL[name]]
            eff = eff_preis(basis, reinheit)
            m_a = masse * betriebsstd
            erl = m_a * eff
            erloes_a += erl
            ergebnis.append(dict(name=name, masse=masse, m_a=m_a, reinheit=reinheit,
                                 basis=basis, eff_preis=eff, erloes=erl, kind="produkt"))
        entsorg_a = 0.0
        for name, prod in reste.items():
            masse = sum(prod.values())
            m_a = masse * betriebsstd
            key = ("siebrest" if "Sieb" in name else ("folien" if "Folien" in name else "sortierrest"))
            kost = m_a * ENTSORG[key]
            entsorg_a += kost
            ergebnis.append(dict(name=name, masse=masse, m_a=m_a, reinheit=None,
                                 basis=ENTSORG[key], eff_preis=ENTSORG[key], erloes=kost, kind="rest"))

        t_a = durchsatz * betriebsstd
        entgelt_a = t_a * sortierentgelt
        inv = S_GRUND_INVEST + sum(S_STAGES[k]["invest"] for k in seq)
        kw = S_GRUND_KW + sum(S_STAGES[k]["kw"] for k in seq)
        energie_a = kw * betriebsstd * strompreis
        # Personal je Schicht: Grundbesatz (Anlagenfahrer, Radlader/Presse) + Handsortierer,
        # hochgerechnet auf alle Schichten inkl. Ausfall (Urlaub, Krankheit)
        n_hand = hand_n if "hand" in seq else 0
        fte_grund = grundbesatz * schichten * ausfallfaktor
        fte_hand = n_hand * schichten * ausfallfaktor
        personal_a = fte_grund * lohn_fte + fte_hand * lohn_hand
        wartung_a = inv * wartung_quote
        versicherung_a = inv * versicherung_quote
        betrieb_a = energie_a + personal_a + wartung_a + versicherung_a + verwaltung_a
        deckung_a = entgelt_a + erloes_a + entsorg_a - betrieb_a
        amort = inv / deckung_a if deckung_a > 0 else None

        foot = [("Aufgabe / Dosierung", (6, 4))]
        for k in seq:
            foot.append((S_STAGES[k]["label"], S_STAGES[k]["foot"]))
        foot.append(("Ballenpresse / Output", (5, 4)))
        foot_sum = sum(L * B for _, (L, B) in foot)

        return dict(seq=seq, ergebnis=ergebnis, stage_out=stage_out, erloes_a=erloes_a,
                    entsorg_a=entsorg_a, entgelt_a=entgelt_a, energie_a=energie_a,
                    personal_a=personal_a, fte=fte_grund + fte_hand, schichten=schichten,
                    wartung_a=wartung_a, versicherung_a=versicherung_a, verwaltung_a=verwaltung_a,
                    betrieb_a=betrieb_a, sortierkosten_t=(betrieb_a - entsorg_a) / max(1e-9, t_a),
                    deckung_a=deckung_a, amort=amort, inv=inv, kw=kw,
                    t_a=t_a, foot=foot, foot_sum=foot_sum)
    return S_ORDER, S_PRESETS, S_STAGES, sortiermodell


@app.cell
def _(S_ORDER, S_PRESETS, S_STAGES, mo):
    # === LS 6.1 – Bedienelemente Sortieranlage ===
    # Aggregate über 10 Positionen FREI anordnen (Reihenfolge = Verfahrenskonzept).
    s_preset = mo.ui.dropdown(options=list(S_PRESETS.keys()),
                              value="Gemischte Wertstofftonne", label="Input-Zusammensetzung")
    s_durchsatz = mo.ui.slider(start=1.0, stop=10.0, step=0.5, value=5.0,
                               label="Durchsatz [t/h]", show_value=True)
    s_stunden = mo.ui.dropdown(options={"Einschicht (2000 h/a)": 2000,
                                        "Zweischicht (4000 h/a)": 4000,
                                        "Dreischicht (6000 h/a)": 6000},
                               value="Zweischicht (4000 h/a)", label="Betriebszeit")
    s_entgelt = mo.ui.slider(start=0, stop=150, step=5, value=70,
                             label="Sortierentgelt [€/t Input]", show_value=True)
    s_markt = mo.ui.dropdown(options={"Marktlage gut": "gut", "Marktlage mittel": "mittel",
                                      "Marktlage schwach": "schwach"},
                             value="Marktlage gut", label="Sekundärrohstoffmarkt")
    s_hand = mo.ui.slider(start=0, stop=8, step=1, value=2,
                          label="Handsortierer je Schicht", show_value=True)
    _leer = "— (leer)"
    _opts = [_leer] + [S_STAGES[k]["label"] for k in S_ORDER]
    # Standard-Belegung = funktionierende 5er-Grundlinie (Optimierung über freie Positionen)
    s_pos1 = mo.ui.dropdown(options=_opts, value="Siebanlage", label="Position 1")
    s_pos2 = mo.ui.dropdown(options=_opts, value="Windsichter", label="Position 2")
    s_pos3 = mo.ui.dropdown(options=_opts, value="Magnetabscheider", label="Position 3")
    s_pos4 = mo.ui.dropdown(options=_opts, value="Wirbelstromabscheider", label="Position 4")
    s_pos5 = mo.ui.dropdown(options=_opts, value="NIR-Sortierung", label="Position 5")
    s_pos6 = mo.ui.dropdown(options=_opts, value=_leer, label="Position 6")
    s_pos7 = mo.ui.dropdown(options=_opts, value=_leer, label="Position 7")
    s_pos8 = mo.ui.dropdown(options=_opts, value=_leer, label="Position 8")
    s_pos9 = mo.ui.dropdown(options=_opts, value=_leer, label="Position 9")
    s_pos10 = mo.ui.dropdown(options=_opts, value=_leer, label="Position 10")
    return (s_durchsatz, s_entgelt, s_hand, s_markt, s_pos1, s_pos2, s_pos3, s_pos4,
            s_pos5, s_pos6, s_pos7, s_pos8, s_pos9, s_pos10, s_preset, s_stunden)


@app.cell
def _(GRUNDRISS_URL, dep_armaturen, MVA_URL, S_PRESETS, S_STAGES, bio_t, heizwert, ks_t, mo,
      muell_t, niederschlag, s_durchsatz, s_entgelt, s_hand, s_markt, s_pos1, s_pos2,
      s_pos3, s_pos4, s_pos5, s_pos6, s_pos7, s_pos8, s_pos9, s_pos10, s_preset,
      s_stunden, sortier_t, sortiermodell):
    # =========================================================================
    #  AEZ-LEITSTAND – Aufbau
    #  -----------------------------------------------------------------------
    #  Diese App ist der zentrale Hub ("Leitstand") des virtuellen
    #  Abfallentsorgungszentrums. Die ÜBERSICHT ist voll funktionsfähig:
    #  ein transparentes Gesamt-Stoff-/Energiebilanzmodell, getrieben von den
    #  Betriebsvorgaben oben. Die Einzelanlagen sind als Gerüst angelegt und
    #  werden Schritt für Schritt vertieft (geplant als eigene, verlinkte
    #  Marimo-Apps nach dem Hub-and-Spoke-Muster).
    # =========================================================================

    # ---------- kleine Helfer (Stil identisch zum Kläranlagen-PLS) ----------
    def vc(val, wl=None, dl=None, wh=None, dh=None):
        try:
            x = float(str(val).replace(",", "."))
        except (ValueError, TypeError):
            return "c-v"
        if dl is not None and x < dl: return "c-d"
        if wl is not None and x < wl: return "c-w"
        if dh is not None and x > dh: return "c-d"
        if wh is not None and x > wh: return "c-w"
        return "c-v"

    def vr(label, val, unit, cls=None, **kw):
        # cls: entweder direkt als CSS-Klasse (4. Positionsargument) oder via
        # Schwellen-Keywords (wl/dl/wh/dh) automatisch über vc() bestimmt.
        if cls is None:
            cls = vc(val, **kw) if kw else "c-v"
        return (f'<tr><td style="padding:3px 8px 3px 0;color:#b2bec3;white-space:nowrap">{label}</td>'
                f'<td style="padding:3px 0 3px 8px;white-space:nowrap;font-weight:bold" class="{cls}">{val}&ensp;{unit}</td></tr>')

    def vtbl(rows):
        return f'<table style="border-collapse:collapse">{rows}</table>'

    def bar(pct, color="#0984e3"):
        pct = max(0, min(100, pct))
        return f'<div class="pls-bar"><div class="pls-bar-f" style="width:{pct}%;background:{color}"></div></div>'

    # ---------- Gesamt-Stoff- und Energiebilanz (leicht, transparent) -------
    m_muell = muell_t.value
    m_sortier = sortier_t.value
    m_bio = bio_t.value
    m_ks = ks_t.value
    Hu = heizwert.value
    regen = niederschlag.value

    # Sortieranlage: grobe Trennung in Wertstoffe / Reststoff zur MVA
    wertstoff_quote = 0.35
    m_wertstoff = m_sortier * wertstoff_quote
    m_reststoff = m_sortier * (1 - wertstoff_quote)        # → Müllbunker / MVA

    # Klärschlammtrocknung: entwässert (~25 % TS) → getrocknet (~65 % TS)
    m_ks_tr = m_ks * 0.40                                   # Masse nach Trocknung → Mitverbrennung
    Hu_ks = 8.0
    Hu_rest = 12.0

    # MVA-Aufgabe (Kapazität: 2 Linien × 16,6 t/h = 33,2 t/h ≈ 797 t/d)
    m_mva = m_muell + m_reststoff + m_ks_tr
    kap_mva = 2 * 16.6 * 24
    ausl_mva = m_mva / kap_mva * 100

    # massengewichteter Misch-Heizwert
    Hu_mix = ((m_muell * Hu) + (m_reststoff * Hu_rest) + (m_ks_tr * Hu_ks)) / max(1e-6, m_mva)

    # thermische Leistung [MW]: t/d → kg/s × MJ/kg
    Q_th = (m_mva * 1000 * Hu_mix) / 86400.0
    eta_el, eta_th = 0.13, 0.30                            # KWK (MVA-typisch: viel Wärmeauskopplung)
    P_el = Q_th * eta_el                                   # MW (brutto)
    P_fw = Q_th * eta_th                                   # MW Fernwärme
    E_el_d = P_el * 24                                      # MWh/d brutto
    eigenbedarf = 0.16
    E_el_netto = E_el_d * (1 - eigenbedarf)
    E_el_a = P_el * 8000 / 1000                            # GWh/a (≈8000 Vollbenutzungsstunden)

    # Verbrennungsreststoffe
    m_schlacke = m_mva * 0.27                               # → Schlackeaufbereitung → Deponie
    m_filterstaub = m_mva * 0.03                            # RGR-Reststoffe → Sonderdeponie

    # Vergärung / Kompost
    biogas_spez = 100                                       # m³ Biogas / t Bioabfall
    V_biogas = m_bio * biogas_spez                          # m³/d
    ch4_anteil = 0.58
    bhkw_kwh_pro_m3 = 6.0 * ch4_anteil / 0.55              # ~ Energiegehalt
    E_bio_d = V_biogas * 6.0 * 0.40 / 1000                  # MWh/d el (η_el BHKW ~40 %)
    m_kompost = m_bio * 0.40

    # Deponie-Sickerwasser: Basisdränage → Sickerwasserschacht SWS-1 → Druckleitung DN 300
    # → Sammelbecken SB-1 (Pumpwerk SWP-01) → Sickerwasserbehandlung → KA Schwierbach.
    # Fließgeschwindigkeit in der Druckleitung zwischen Trockenwetter (0,60 m/s) und
    # Starkregen (1,80 m/s), getrieben vom Niederschlag im Kontrollzentrum.
    import math as _m_sw
    sw_dn = 0.300                                           # m, Innendurchmesser
    sw_A = _m_sw.pi * (sw_dn / 2) ** 2                      # m²
    sw_v_tw, sw_v_sr = 0.60, 1.80                           # m/s
    sw_frac = max(0.0, min(1.0, (regen - 2.0) / 23.0))      # 2 mm/d = TW, ≥ 25 mm/d = Starkregen
    sw_v = sw_v_tw + (sw_v_sr - sw_v_tw) * sw_frac
    sw_Q_Ls = sw_A * sw_v * 1000                            # L/s
    V_sicker = sw_Q_Ls * 86.4                               # m³/d
    # Sammelbecken SB-1 (Bestand 1987): 8,00 × 5,00 × 5,00 m
    sw_L, sw_B, sw_T = 8.0, 5.0, 5.0
    sw_V = sw_L * sw_B * sw_T
    sw_fuell = min(98.0, 25.0 + sw_frac * 70.0)             # %
    sw_h = sw_fuell / 100 * sw_T
    sw_Vist = sw_fuell / 100 * sw_V

    # Inputsumme / Verwertungs- bzw. Beseitigungsquote (grob)
    m_input = m_muell + m_sortier + m_bio + m_ks
    m_stofflich = m_wertstoff + m_kompost
    m_thermisch = m_mva
    quote_stofflich = m_stofflich / max(1e-6, m_input) * 100

    # ---------- Header ----------
    hdr = f'''<div class="pls"><div class="pls-hdr">
        <h2>♻️ Abfall- &amp; Energiezentrum Schwierbach – Leitstand</h2>
        <div class="pls-st">
            <span><span class="pls-dot" style="background:#00b894"></span> ONLINE</span>
            <span>Input: {m_input:.0f} t/d</span>
            <span>MVA: {ausl_mva:.0f}&nbsp;%</span>
            <span>Netz: {P_el:.1f} MW</span>
        </div>
    </div></div>'''

    # ---------- Verbundschema (Lageplan / Stoff- & Energieströme) ----------
    # Inline-SVG mit festen Koordinaten. Farbige Konturen unterscheiden die
    # Anlagentypen (PLS-Konvention) – keine didaktischen Hinweise im Schema.
    def box(x, y, w, h, stroke, title, *lines, tcol=None, href=None):
        tcol = tcol or "#dfe6e9"
        out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="#2d3436" stroke="{stroke}" stroke-width="{3 if href else 2}"/>']
        cx = x + w / 2
        out.append(f'<text x="{cx}" y="{y+19}" fill="{stroke}" text-anchor="middle" font-size="12" font-family="monospace" font-weight="bold">{title}</text>')
        for i, ln in enumerate(lines):
            out.append(f'<text x="{cx}" y="{y+37+i*15}" fill="{tcol}" text-anchor="middle" font-size="10" font-family="monospace">{ln}</text>')
        if href:
            out.append(f'<text x="{cx}" y="{y+h-9}" fill="#74b9ff" text-anchor="middle" font-size="9.5" font-family="monospace" font-weight="bold">🔗 Simulation öffnen ▸</text>')
            return f'<a href="{href}" target="_blank" rel="noopener" style="cursor:pointer">{"".join(out)}</a>'
        return "".join(out)

    # Farbcodierte Pfeilspitzen (eine Marker-Definition je Strom-Farbe).
    FLOWCOL = {
        "in": "#5b9bd5", "dampf": "#e17055", "bio": "#00b894",
        "schlacke": "#b2bec3", "wasser": "#74b9ff", "ks": "#a29bfe",
    }
    _mk = "".join(
        f'<marker id="mk_{k}" markerWidth="11" markerHeight="9" refX="8.5" refY="4.5" '
        f'orient="auto" markerUnits="userSpaceOnUse">'
        f'<path d="M0,0 L9,4.5 L0,9 L2.4,4.5 Z" fill="{v}"/></marker>'
        for k, v in FLOWCOL.items()
    )

    def _round_path(pts, r=12):
        # Orthogonaler Pfad mit abgerundeten Ecken (quadratische Bögen).
        if len(pts) < 2:
            return ""
        d = [f'M {pts[0][0]},{pts[0][1]}']
        for i in range(1, len(pts) - 1):
            (x0, y0), (x1, y1), (x2, y2) = pts[i - 1], pts[i], pts[i + 1]
            import math as _m
            d1 = _m.hypot(x1 - x0, y1 - y0)
            d2 = _m.hypot(x2 - x1, y2 - y1)
            rr = min(r, d1 / 2, d2 / 2)
            ax = x1 - (x1 - x0) / max(d1, 1e-6) * rr
            ay = y1 - (y1 - y0) / max(d1, 1e-6) * rr
            bx = x1 + (x2 - x1) / max(d2, 1e-6) * rr
            by = y1 + (y2 - y1) / max(d2, 1e-6) * rr
            d.append(f'L {ax:.1f},{ay:.1f} Q {x1},{y1} {bx:.1f},{by:.1f}')
        d.append(f'L {pts[-1][0]},{pts[-1][1]}')
        return " ".join(d)

    def flow(pts, key="in", label="", lx=None, ly=None, dash=False):
        # pts: Liste orthogonaler Stützpunkte (x,y). Farbe über key (FLOWCOL).
        col = FLOWCOL.get(key, "#5b9bd5")
        d = ' stroke-dasharray="6,4"' if dash else ""
        seg = (f'<path d="{_round_path(pts)}" fill="none" stroke="{col}" stroke-width="2.4" '
               f'stroke-linejoin="round" stroke-linecap="round" marker-end="url(#mk_{key})"{d}/>')
        if label and lx is not None:
            seg += (f'<text x="{lx}" y="{ly}" fill="#9fb3c8" text-anchor="middle" '
                    f'font-size="9" font-family="monospace">{label}</text>')
        return seg

    schema = f'''<svg viewBox="0 0 1240 720" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#0a1428;border-radius:6px">
      <defs>{_mk}</defs>

      <!-- Anlieferung -->
      {box(20, 300, 130, 110, "#74b9ff", "Anlieferung", "Waage", f"{m_input:.0f} t/d", "Eingangskontrolle")}

      <!-- Vorbehandlung / Annahme -->
      {box(210, 40, 150, 70, "#6c5ce7", "Müllbunker", f"{m_muell:.0f} t/d", "Kran / Mischung")}
      {box(210, 230, 150, 70, "#fdcb6e", "Sortieranlage", f"{m_sortier:.0f} t/d", "Vorschaltanlage")}
      {box(210, 420, 150, 70, "#00b894", "Bioabfall-Annahme", f"{m_bio:.0f} t/d")}
      {box(210, 560, 150, 70, "#a29bfe", "Klärschlammtrocknung", f"{m_ks:.0f} t/d ein", f"{m_ks_tr:.0f} t/d getr.")}

      <!-- Prozessstufe -->
      {box(440, 40, 170, 100, "#e17055", "MVA – 2 Linien", f"Aufgabe {m_mva:.0f} t/d", f"Auslastung {ausl_mva:.0f} %", f"Q̇th {Q_th:.0f} MW", href=MVA_URL)}
      {box(440, 410, 170, 90, "#00b894", "Vergärung", f"Biogas {V_biogas:.0f} m³/d", f"CH₄ ~{ch4_anteil*100:.0f} %")}

      <!-- Nachbehandlung / Energie -->
      {box(690, 40, 160, 70, "#dfe6e9", "Rauchgasreinigung", "mehrstufig", "17. BImSchV", tcol="#9fb3c8")}
      {box(690, 200, 160, 90, "#fdcb6e", "Energiezentrale", f"P_el {P_el:.1f} MW", f"P_fw {P_fw:.0f} MW", "Turbine + BHKW")}
      {box(690, 410, 160, 70, "#00b894", "Kompostierung", f"{m_kompost:.0f} t/d", "Gärrest → Kompost")}
      {box(690, 560, 160, 70, "#b2bec3", "Schlackeaufbereitung", f"{m_schlacke:.0f} t/d", "Metallrückgewinnung")}

      <!-- Senken -->
      {box(930, 40, 130, 70, "#b2bec3", "Kamin", "Reingas", "Emissionsmessung", tcol="#9fb3c8")}
      {box(930, 210, 150, 70, "#74b9ff", "Strom / Fernwärme", f"{E_el_netto:.0f} MWh/d", "ins Netz")}
      {box(930, 520, 150, 110, "#e94560", "Deponie (DK II)", "41 ha", f"Schlacke {m_schlacke:.0f} t/d", f"Sickerw. {V_sicker:.0f} m³/d")}

      <!-- Ströme: Anlieferung → Annahme (Verteiler-Manifold) -->
      {flow([(150, 322), (178, 322), (178, 75), (210, 75)], "in", "Hausmüll", lx=179, ly=69)}
      {flow([(150, 345), (186, 345), (186, 265), (210, 265)], "in", "Sperrmüll", lx=179, ly=259)}
      {flow([(150, 388), (170, 388), (170, 455), (210, 455)], "in", "Bioabfall", lx=184, ly=449)}
      {flow([(150, 402), (162, 402), (162, 595), (210, 595)], "ks", "Klärschl.", lx=184, ly=589)}

      <!-- Annahme → Prozess -->
      {flow([(360, 75), (440, 75)], "in")}
      {flow([(360, 265), (398, 265), (398, 110), (440, 110)], "in", "Reststoff", lx=380, ly=256)}
      {flow([(360, 595), (420, 595), (420, 132), (440, 132)], "ks", "Mitverbr.", lx=393, ly=586, dash=True)}
      {flow([(360, 455), (440, 455)], "bio")}

      <!-- MVA → RGR → Kamin -->
      {flow([(610, 70), (690, 70)], "in", "Rohgas", lx=650, ly=62)}
      {flow([(850, 75), (930, 75)], "in")}

      <!-- MVA → Energiezentrale (Dampf) -->
      {flow([(560, 140), (560, 245), (690, 245)], "dampf", "Dampf", lx=584, ly=200)}
      {flow([(850, 245), (930, 245)], "dampf")}

      <!-- Vergärung → Energiezentrale (Biogas) + Kompost -->
      {flow([(610, 425), (638, 425), (638, 290), (690, 290)], "bio", "Biogas", lx=624, ly=340, dash=True)}
      {flow([(610, 455), (690, 455)], "bio", "Gärrest", lx=650, ly=447)}

      <!-- MVA → Schlacke → Aufbereitung → Deponie -->
      {flow([(610, 120), (655, 120), (655, 595), (690, 595)], "schlacke", "Schlacke", lx=672, ly=550)}
      {flow([(850, 595), (890, 595), (890, 560), (930, 560)], "schlacke")}

      <!-- Deponie → Sickerwasser -->
      {flow([(1005, 630), (1005, 690)], "wasser", "Sickerwasser → Behandlung", lx=1005, ly=705, dash=True)}

      <!-- Labor (zentrale Überwachung) -->
      <rect x="930" y="330" width="150" height="90" rx="6" fill="#16213e" stroke="#74b9ff" stroke-width="1.5" stroke-dasharray="3,3"/>
      <text x="1005" y="362" fill="#74b9ff" text-anchor="middle" font-size="12" font-family="monospace" font-weight="bold">Labor</text>
      <text x="1005" y="382" fill="#9fb3c8" text-anchor="middle" font-size="10" font-family="monospace">Eigenüberwachung</text>
      <text x="1005" y="398" fill="#9fb3c8" text-anchor="middle" font-size="10" font-family="monospace">Emission · Sickerw.</text>
    </svg>'''

    # ---------- Übersicht ----------
    overview = mo.Html(f'''<div class="pls">
      <div class="pls-c" style="padding:0;overflow:hidden;border-color:#0984e3">
        <a href="./3d/" target="_blank" rel="noopener" style="display:block;position:relative;text-decoration:none;color:#ffffff">
          <img src="./3d/aez_iso.jpg" alt="Isometrische Ansicht des Abfall- und Energiezentrums Schwierbach"
               style="display:block;width:100%;height:auto;max-height:360px;object-fit:cover">
          <div style="position:absolute;left:0;right:0;bottom:0;padding:14px 16px;background:linear-gradient(rgba(22,33,62,0),rgba(22,33,62,0.94))">
            <div style="font-size:1.05em;font-weight:bold">🧭 Betriebsgelände in 3D</div>
            <div style="font-size:0.85em;color:#dfe6e9;margin:2px 0 8px">MVA, Sortierung, Vergärung, Deponie und Sickerwasserfassung – frei dreh- und zoombar, mit Rundgang</div>
            <span style="display:inline-block;padding:7px 18px;background:#0984e3;color:#ffffff;border-radius:4px;font-weight:bold;font-size:0.9em">▶ 3D-Ansicht öffnen</span>
          </div>
        </a>
      </div>
      <div class="pls-c" style="overflow-x:auto">
        <h3>Verbundschema – Stoff- und Energieströme (Betriebspunkt aus Leitstand-Vorgaben)</h3>
        {schema}
      </div>
      <div class="pls-g3">
        <div class="pls-c"><h3>⚖️ Stoffstrombilanz</h3>
          {vtbl(
              vr("Input gesamt", f"{m_input:.0f}", "t/d")
              + vr("→ thermisch (MVA)", f"{m_thermisch:.0f}", "t/d")
              + vr("→ Wertstoffe (Sortierung)", f"{m_wertstoff:.0f}", "t/d")
              + vr("→ Kompost", f"{m_kompost:.0f}", "t/d")
              + vr("Schlacke → Deponie", f"{m_schlacke:.0f}", "t/d")
              + vr("RGR-Reststoffe", f"{m_filterstaub:.0f}", "t/d")
          )}
          <div class="pls-sep"></div>
          {vtbl(vr("stoffl. Verwertungsquote", f"{quote_stofflich:.0f}", "%"))}
          {bar(quote_stofflich, '#00b894' if quote_stofflich > 30 else '#fdcb6e')}
        </div>
        <div class="pls-c"><h3>⚡ Energiebilanz (MVA + BHKW)</h3>
          {vtbl(
              vr("therm. Leistung Q̇th", f"{Q_th:.0f}", "MW")
              + vr("Misch-Heizwert", f"{Hu_mix:.1f}", "MJ/kg")
              + vr("Strom brutto", f"{P_el:.1f}", "MW")
              + vr("Strom netto", f"{E_el_netto:.0f}", "MWh/d")
              + vr("davon BHKW (Biogas)", f"{E_bio_d:.1f}", "MWh/d")
              + vr("Fernwärme", f"{P_fw:.0f}", "MW")
              + vr("Stromertrag", f"{E_el_a:.0f}", "GWh/a")
          )}
        </div>
        <div class="pls-c"><h3>🏭 Anlagen-Status</h3>
          <table class="pls-overview-tbl">
            <tr><th>Anlage</th><th>Kennwert</th><th>Status</th></tr>
            <tr><td>MVA (2 Linien)</td><td>{ausl_mva:.0f} % / {kap_mva:.0f} t/d</td><td><span class="c-{'ok' if ausl_mva<=100 else 'd'}">●</span> {'Betrieb' if ausl_mva<=100 else 'Überlast'}</td></tr>
            <tr><td>Rauchgasreinigung</td><td>17. BImSchV</td><td><span class="c-ok">●</span> Betrieb</td></tr>
            <tr><td>Sortieranlage</td><td>{m_sortier:.0f} t/d</td><td><span class="c-{'ok' if m_sortier>0 else 'w'}">●</span> {'Betrieb' if m_sortier>0 else 'Stillstand'}</td></tr>
            <tr><td>Vergärung</td><td>{V_biogas:.0f} m³/d</td><td><span class="c-{'ok' if m_bio>0 else 'w'}">●</span> {'Betrieb' if m_bio>0 else 'Stillstand'}</td></tr>
            <tr><td>Klärschlammtrocknung</td><td>{m_ks:.0f} t/d</td><td><span class="c-{'ok' if m_ks>0 else 'w'}">●</span> {'Betrieb' if m_ks>0 else 'Stillstand'}</td></tr>
            <tr><td>Deponie (DK II)</td><td>41 ha</td><td><span class="c-ok">●</span> Einbau</td></tr>
          </table>
        </div>
      </div>
    </div>''')

    # ---------- Gerüst-Helfer für noch zu vertiefende Anlagen ----------
    def geruest(titel, beschreibung, subtabs):
        items = "".join(f"<li>{s}</li>" for s in subtabs)
        return mo.Html(f'''<div class="pls">
          <div class="pls-c">
            <h3>{titel} <span class="pls-badge">in Vorbereitung</span></h3>
            <div class="pls-soon">
              {beschreibung}
              <div class="pls-sep"></div>
              <b>Geplante Unter-Tabs:</b>
              <ul>{items}</ul>
            </div>
          </div>
        </div>''')

    mva = mo.Html(f'''<div class="pls">
      <div class="pls-c" style="border-color:#e94560">
        <h3>🔥 Müllverbrennungsanlage (MVA) – eigene Simulation</h3>
        <div class="pls-soon">
          Die MVA ist das Simulationsherzstück und als eigenständige App umgesetzt (Hub-and-Spoke).
          Sie bildet die vollständige Kette ab: Müllbunker → Feuerung (850-°C-Kriterium, O₂/CO) →
          mehrstufige Rauchgasreinigung → Reingasvergleich mit der 17. BImSchV → Turbine, dazu einen
          Verfahrensvergleich (Trocken-/Nassverfahren, SNCR/SCR, Betriebskosten).
          <div class="pls-sep"></div>
          <div style="margin:10px 0">
            <a href="{MVA_URL}" target="_blank" rel="noopener"
               style="display:inline-block;background:#e94560;color:#ffffff;font-weight:bold;
               text-decoration:none;padding:12px 24px;border-radius:6px;font-family:monospace;font-size:1.05em">
               🔥 MVA-Simulation öffnen ▸</a>
          </div>
          <span style="color:#8497ab;font-size:0.85em">Öffnet die MVA-App in einem neuen Tab.
          Führt der Link ins Leere, ist oben in der Datei die Konstante <b>MVA_URL</b> auf die echte
          Deploy-Adresse zu setzen.</span>
        </div>
      </div>
    </div>''')

    # ---------- Sortieranlage (LS 6.1, RecyTech GmbH) – frei anordenbar ------
    _scomp = S_PRESETS[s_preset.value]
    _lab2key = {S_STAGES[_k]["label"]: _k for _k in S_STAGES}
    _sequence = []
    for _d in [s_pos1, s_pos2, s_pos3, s_pos4, s_pos5, s_pos6, s_pos7, s_pos8, s_pos9, s_pos10]:
        _kk = _lab2key.get(_d.value)
        if _kk:
            _sequence.append(_kk)
    _sr = sortiermodell(s_durchsatz.value, _scomp, _sequence, s_stunden.value,
                        sortierentgelt=s_entgelt.value, hand_n=s_hand.value,
                        markt=s_markt.value)
    _seq = _sr["seq"]

    def _fliessbild():
        # Spalten: Aufgabe + je angewandter Stufe (mit ihren Ausschleusungen) + Sortierrest
        _stufen = [(None, "Wertstofftonne", f"{s_durchsatz.value:.1f} t/h", "#74b9ff", [], None)]
        for _k, _outs, _bel in _sr["stage_out"]:
            _st = S_STAGES[_k]
            _fb, _sub = _st["fb"], _st["sub"]
            if _k == "hand":
                if any(_r[3] == "prod" for _r in _outs):
                    _fb, _sub = "Sortier-|kabinen", "Qualitätskontrolle"
                else:
                    _sub = "Vorsortierung"
            _stufen.append((_k, _fb, _sub, _st["col"], _outs, _bel))
        _stufen.append((None, "Sortierrest", "→ EBS/MVA", "#b2bec3", [], None))
        _W, _GAP = 128, 34
        _n = len(_stufen)
        _wid = 20 + _n * (_W + _GAP)
        _maxo = max([len(_st[4]) for _st in _stufen] + [1])
        _hoe = max(320, 114 + _maxo * 46 + 14)
        p = [f'<svg viewBox="0 0 {_wid} {_hoe}" xmlns="http://www.w3.org/2000/svg" '
             f'style="width:100%;min-width:{min(_wid, 1180)}px;height:auto;background:#0a1428;border-radius:6px">']
        p.append('<defs>'
                 '<marker id="fb_a" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8 L2,4 Z" fill="#5b9bd5"/></marker>'
                 '<marker id="fb_p" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8 L2,4 Z" fill="#7f8fa6"/></marker>'
                 '</defs>')
        _yt = 34
        _cols = []
        for _i, (_k, _lab, _sub, _col, _outs, _bel) in enumerate(_stufen):
            _x = 20 + _i * (_W + _GAP)
            _cx = _x + _W / 2
            _cols.append((_cx, _outs))
            p.append(f'<rect x="{_x}" y="{_yt}" width="{_W}" height="58" rx="6" fill="#2d3436" stroke="{_col}" stroke-width="2"/>')
            _ls = _lab.split("|")
            for _j, _ln in enumerate(_ls):
                p.append(f'<text x="{_cx}" y="{_yt+19+_j*13}" fill="{_col}" text-anchor="middle" font-size="11" font-family="monospace" font-weight="bold">{_ln}</text>')
            p.append(f'<text x="{_cx}" y="{_yt+52}" fill="#9fb3c8" text-anchor="middle" font-size="8.5" font-family="monospace">{_sub}</text>')
            if _bel is not None:
                _bc = "#e17055" if _bel > 1.0 else ("#fdcb6e" if _bel > 0.85 else "#9fb3c8")
                p.append(f'<text x="{_cx}" y="{_yt-10}" fill="{_bc}" text-anchor="middle" font-size="9" font-family="monospace" font-weight="bold">Last {_bel*100:.0f}&#8201;%</text>')
            if _i < _n - 1:
                _xn = 20 + (_i + 1) * (_W + _GAP)
                p.append(f'<line x1="{_x+_W}" y1="{_yt+29}" x2="{_xn}" y2="{_yt+29}" stroke="#5b9bd5" stroke-width="2.4" stroke-linecap="round" marker-end="url(#fb_a)"/>')

        def _chip(cx, y, rec, w=140):
            _name, _masse, _reinheit, _kind = rec
            x0 = cx - w / 2
            col = "#7f8fa6" if _kind == "rest" else "#00b894"
            p.append(f'<rect x="{x0:.0f}" y="{y}" width="{w}" height="36" rx="5" fill="#16213e" stroke="{col}" stroke-width="1.4"/>')
            p.append(f'<text x="{cx}" y="{y+14}" fill="#dfe6e9" text-anchor="middle" font-size="9" font-family="monospace" font-weight="bold">{_name.split(" (")[0]}</text>')
            rh = "" if _reinheit is None else f" · {_reinheit*100:.0f}%"
            p.append(f'<text x="{cx}" y="{y+28}" fill="#9fb3c8" text-anchor="middle" font-size="8.5" font-family="monospace">{_masse:.2f} t/h{rh}</text>')

        for _cx, _outs in _cols:
            if not _outs:
                continue
            if len(_outs) == 1:
                p.append(f'<line x1="{_cx}" y1="{_yt+58}" x2="{_cx}" y2="150" stroke="#7f8fa6" stroke-width="2" stroke-linecap="round" marker-end="url(#fb_p)"/>')
                _chip(_cx, 154, _outs[0])
            else:
                p.append(f'<line x1="{_cx}" y1="{_yt+58}" x2="{_cx}" y2="112" stroke="#7f8fa6" stroke-width="2" stroke-linecap="round"/>')
                for _j, _rec in enumerate(_outs):
                    _yy = 114 + _j * 46
                    _chip(_cx, _yy, _rec)
                    if _j < len(_outs) - 1:
                        p.append(f'<line x1="{_cx}" y1="{_yy+36}" x2="{_cx}" y2="{_yy+46}" stroke="#7f8fa6" stroke-width="1.4"/>')
        p.append('</svg>')
        return "".join(p)

    # Kontext-Karte (Lernsituation)
    _ctx = mo.Html('''<div class="pls"><div class="pls-c">
        <h3>🔀 Wertstoffsortieranlage</h3>
        <div class="pls-soon">
          <b>Rahmenbedingungen:</b> Fraktionen Kunststoffe (PET, PE, PP), Metalle (Fe, Al), Papier/Karton ·
          Durchsatz ca. 5 t/h · Halle 40 m × 20 m = 800 m², 8 m Höhe · 400 V, Druckluft, Kran 5 t.
          <div class="pls-sep"></div>
          <span style="color:#8497ab;font-size:0.9em">Die zehn Positionen sind <b>frei belegbar</b>
          (leere Positionen = Stufe entfällt).</span>
        </div>
    </div></div>''')

    # Massenbilanz-Tabelle (dunkler Zellhintergrund, damit Marimo die Tabelle
    # nicht hell einfärbt → hellgraue Schrift bliebe sonst auf Weiß unlesbar)
    _tdst = "padding:6px 12px;border-bottom:1px solid #0f3460;font-family:monospace;white-space:nowrap;background:#16213e"
    _thst = "padding:6px 12px;border-bottom:2px solid #0f3460;font-family:monospace;white-space:nowrap;background:#0f1a30;color:#74b9ff"
    _rows = ""
    for _e in _sr["ergebnis"]:
        _isp = _e["reinheit"] is not None
        _rh = f"{_e['reinheit']*100:.0f} %" if _isp else "—"
        _rhc = "#00b894" if (_isp and _e["reinheit"] >= 0.85) else ("#fdcb6e" if (_isp and _e["reinheit"] >= 0.65) else ("#e17055" if _isp else "#8497ab"))
        _erl = _e["erloes"]
        _erlc = "#00b894" if _erl > 0 else "#e17055"
        _namecol = "#dfe6e9" if _isp else "#9fb3c8"
        _rows += (f'<tr>'
                  f'<td style="{_tdst};color:{_namecol};font-weight:bold">{_e["name"]}</td>'
                  f'<td style="{_tdst};color:#dfe6e9;text-align:right">{_e["masse"]:.2f}</td>'
                  f'<td style="{_tdst};color:#9fb3c8;text-align:right">{_e["m_a"]:,.0f}</td>'
                  f'<td style="{_tdst};color:{_rhc};text-align:right">{_rh}</td>'
                  f'<td style="{_tdst};color:#9fb3c8;text-align:right">{_e["eff_preis"]:.0f}</td>'
                  f'<td style="{_tdst};color:{_erlc};text-align:right;font-weight:bold">{_erl/1000:,.0f}</td>'
                  f'</tr>')
    _bilanz = (f'<table style="border-collapse:collapse;font-size:0.85em;width:100%">'
               f'<tr>'
               f'<th style="{_thst};text-align:left">Fraktion</th>'
               f'<th style="{_thst};text-align:right">t/h</th>'
               f'<th style="{_thst};text-align:right">t/a</th>'
               f'<th style="{_thst};text-align:right">Reinheit</th>'
               f'<th style="{_thst};text-align:right">€/t</th>'
               f'<th style="{_thst};text-align:right">k€/a</th>'
               f'</tr>{_rows}</table>')

    # Wirtschaftlichkeit
    _amort = f"{_sr['amort']:.1f} a" if _sr["amort"] else "kein Gewinn"
    _amc = "c-ok" if (_sr["amort"] and _sr["amort"] < 5) else ("c-w" if _sr["amort"] else "c-d")
    _deckc = "c-ok" if _sr["deckung_a"] > 0 else "c-d"
    _fte_txt = f"{_sr['fte']:.1f}".replace(".", ",")

    _body = mo.Html(f'''<div class="pls">
      <div class="pls-c" style="overflow-x:auto"><h3>Verfahrensfließbild (aktive Konfiguration)</h3>
        {_fliessbild()}
        <p style="color:#8497ab;font-size:0.8em;margin-top:6px">Grüne Ausschleusungen = verkaufsfähige Wertstofffraktionen · graue = Reststoffe · Last = Bandbelegung bezogen auf die Nennkapazität des Aggregats. Reinheit &lt; 65 % ⇒ Fraktion außer Spezifikation, Zuzahlung bei der Entsorgung.</p>
      </div>
      <div class="pls-g2">
        <div class="pls-c"><h3>⚖️ Massen- &amp; Erlösbilanz</h3>{_bilanz}
          <p style="color:#8497ab;font-size:0.78em;margin-top:6px">€/t = effektiver Erlös nach Reinheitsabschlag (negativ = Zuzahlung bzw. Entsorgungskosten). k€/a bei {s_stunden.value:,} h/a.</p>
        </div>
        <div class="pls-c"><h3>💶 Wirtschaftlichkeit (Richtwerte)</h3>
          {vtbl(
              vr("Durchsatz", f"{_sr['t_a']:,.0f}", "t/a")
              + vr("Investition", f"{_sr['inv']/1000:,.0f}", "k€")
              + vr("Sortierentgelt", f"{_sr['entgelt_a']/1000:,.0f}", "k€/a", "c-ok")
              + vr("Erlöse Wertstoffe", f"{_sr['erloes_a']/1000:,.0f}", "k€/a", "c-ok" if _sr['erloes_a'] >= 0 else "c-d")
              + vr("Entsorgung Reste", f"{_sr['entsorg_a']/1000:,.0f}", "k€/a", "c-d")
              + vr("Personal", f"{_sr['personal_a']/1000:,.0f}", f"k€/a ({_fte_txt} VZ)", "c-w")
              + vr("Energie", f"{_sr['energie_a']/1000:,.0f}", f"k€/a ({_sr['kw']:.0f} kW)", "c-w")
              + vr("Wartung + Versicherung", f"{(_sr['wartung_a'] + _sr['versicherung_a'])/1000:,.0f}", "k€/a", "c-w")
              + vr("Verwaltung + Sonstiges", f"{_sr['verwaltung_a']/1000:,.0f}", "k€/a", "c-w")
              + vr("Betriebskosten gesamt", f"{_sr['betrieb_a']/1000:,.0f}", "k€/a", "c-w")
          )}
          <div class="pls-sep"></div>
          {vtbl(
              vr("Sortierkosten je t Input", f"{_sr['sortierkosten_t']:,.0f}", "€/t")
              + vr("Deckungsbeitrag", f"{_sr['deckung_a']/1000:,.0f}", "k€/a", _deckc)
              + vr("Amortisation", _amort, "", _amc)
          )}
          <p style="color:#8497ab;font-size:0.78em;margin-top:6px">Personal: {_sr['schichten']} Schicht(en), Grundbesatz + Handsortierung inkl. 20 % Ausfallreserve · Wartung 6 % und Versicherung 1,5 % der Investition · Sortierkosten = (Betrieb + Entsorgung) ÷ Input · Amortisation statisch (Investition ÷ Deckungsbeitrag), ohne Finanzierung und Transport.</p>
        </div>
      </div>
    </div>''')

    # Grundriss-Planer – eigenständige Seite (Drag & Drop), per Link geöffnet
    _grundriss_head = mo.Html(f'''<div class="pls"><div class="pls-c" style="border-color:#00cec9">
        <h3>📐 Grundriss-Planer – Halle 40 m × 20 m (interaktiv)</h3>
        <div class="pls-soon">
          Aggregate aus der Palette anklicken (fügt eine maßstäbliche Box ein) oder eigene Box mit L × B erstellen,
          dann per Ziehen platzieren. Doppelklick dreht um 90°, ✕ löscht. Wartungsabstände und Verkehrswege planen
          die Teilgruppen selbst.
          <div style="margin:10px 0">
            <a href="{GRUNDRISS_URL}" target="_blank" rel="noopener"
               style="display:inline-block;background:#00cec9;color:#0a1428;font-weight:bold;text-decoration:none;
               padding:12px 24px;border-radius:6px;font-family:monospace;font-size:1.05em">
               📐 Grundriss-Planer öffnen ▸</a>
          </div>
          <span style="color:#8497ab;font-size:0.85em">Öffnet den Planer in einem neuen Tab (volle Fläche zum Planen).
          Führt der Link ins Leere, ist oben in der Datei die Konstante <b>GRUNDRISS_URL</b> auf die Deploy-Adresse
          der Planer-Seite zu setzen.</span>
        </div>
    </div></div>''')

    _seqhead = mo.Html('<div class="pls"><div class="pls-c" style="margin-bottom:6px;padding:8px 12px">'
                       '<b style="color:#74b9ff">🔧 Verfahrenskonzept – Aggregate frei anordnen</b>'
                       '<span style="color:#8497ab;font-size:0.85em">&ensp;(Positionen von links nach rechts = Durchlaufreihenfolge · Doppelbelegung wird ignoriert)</span>'
                       '</div></div>')
    sortierung = mo.vstack([
        _ctx,
        mo.hstack([s_preset, s_durchsatz, s_stunden], justify="start", gap=1, wrap=True),
        mo.hstack([s_entgelt, s_markt, s_hand], justify="start", gap=1, wrap=True),
        _seqhead,
        mo.hstack([s_pos1, s_pos2, s_pos3, s_pos4, s_pos5], justify="start", gap=1, wrap=True),
        mo.hstack([s_pos6, s_pos7, s_pos8, s_pos9, s_pos10], justify="start", gap=1, wrap=True),
        _body,
        _grundriss_head,
    ])

    vergaerung = geruest(
        "🌱 Vergärung & Kompostierung",
        "Anaerobe Biologie – verwandt mit dem Faulturm der Kläranlage: Raumbelastung, Verweilzeit und "
        "Temperatur bestimmen Biogasausbeute (→ BHKW) und Gärrest (→ Kompostierung).",
        ["Annahme / Voraufbereitung",
         "Fermenter (Temperatur, Verweilzeit, Raumbelastung)",
         "Biogas & BHKW (CH₄-Gehalt, Stromertrag)",
         "Kompostierung (Rotte, Reifegrad)"])

    # ---------- Deponie: Sickerwasserfassung und Sammelbecken SB-1 ----------
    def _sw_farbe(pct):
        if pct > 85: return "#e17055"
        if pct > 65: return "#fdcb6e"
        return "#00b894"

    if sw_frac < 0.08:
        sw_status, sw_status_farbe = "Grundlast (1 Pumpe intermittierend)", "#00b894"
    elif sw_frac < 0.75:
        sw_status, sw_status_farbe = "Regenbetrieb (P1 Dauerlauf)", "#fdcb6e"
    else:
        sw_status, sw_status_farbe = "STARKREGEN – P1+P2 Volllast", "#e17055"

    if sw_fuell > 90:
        sw_alarm = '<div style="background:rgba(225,112,85,0.2);border:1px solid #e17055;border-radius:4px;padding:6px 10px;margin:4px 0;font-size:0.85em"><strong>🚨 KRITISCH:</strong> Beckenfüllstand &gt; 90 % – Überlaufgefahr!</div>'
    elif sw_fuell > 70:
        sw_alarm = '<div style="background:rgba(253,203,110,0.15);border:1px solid #fdcb6e;border-radius:4px;padding:6px 10px;margin:4px 0;font-size:0.85em"><strong>⚠️ WARNUNG:</strong> Erhöhter Füllstand – Kapazitätsreserve prüfen</div>'
    else:
        sw_alarm = ""

    # Füllstand Sickerwasserschacht SWS-1 (Pumpensumpf am Tiefpunkt der Basisdränage)
    sw_sws_fuell = min(95.0, 30.0 + sw_frac * 45.0)

    sw_schema = f"""<svg viewBox="0 0 900 360" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#0a1428;border-radius:6px">
      <defs>
        <marker id="ah-sw" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0,9 3.5,0 7" fill="#74b9ff"/>
        </marker>
        <pattern id="grid-sw" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#16213e" stroke-width="0.5"/>
        </pattern>
      </defs>
      <rect width="900" height="360" fill="url(#grid-sw)"/>
      <text x="20" y="28" fill="#74b9ff" font-size="14" font-weight="bold" font-family="monospace">Deponie Schwierbach – Sickerwasserfassung (Live)</text>
      <text x="20" y="46" fill="#b2bec3" font-size="10" font-family="monospace">Niederschlag aktuell: {regen:.1f} mm/d</text>

      <!-- Deponiekörper mit Einbauabschnitten -->
      <path d="M 30,250 L 90,120 L 300,110 L 360,250 Z" fill="#2d3436" stroke="#b2bec3" stroke-width="1.5"/>
      <line x1="160" y1="116" x2="150" y2="250" stroke="#636e72" stroke-width="1" stroke-dasharray="4,3"/>
      <line x1="235" y1="113" x2="245" y2="250" stroke="#636e72" stroke-width="1" stroke-dasharray="4,3"/>
      <text x="100" y="190" fill="#dfe6e9" text-anchor="middle" font-size="9" font-family="monospace">BA I</text>
      <text x="197" y="190" fill="#dfe6e9" text-anchor="middle" font-size="9" font-family="monospace">BA II</text>
      <text x="292" y="190" fill="#dfe6e9" text-anchor="middle" font-size="9" font-family="monospace">BA III</text>
      <text x="195" y="100" fill="#b2bec3" text-anchor="middle" font-size="9" font-family="monospace">Deponiekörper · 41 ha</text>
      <!-- Basisabdichtung + Basisdränage -->
      <line x1="30" y1="254" x2="360" y2="254" stroke="#636e72" stroke-width="3"/>
      <line x1="40" y1="262" x2="370" y2="270" stroke="#74b9ff" stroke-width="1.5" stroke-dasharray="6,3"/>
      <text x="200" y="285" fill="#74b9ff" text-anchor="middle" font-size="8" font-family="monospace">Basisdränage (Freispiegel)</text>

      <!-- Sickerwasserschacht SWS-1 -->
      <rect x="370" y="225" width="110" height="80" rx="6" fill="#16213e" stroke="#0984e3" stroke-width="1.5"/>
      <text x="425" y="244" fill="#74b9ff" text-anchor="middle" font-size="10" font-weight="bold" font-family="monospace">SWS-1</text>
      <text x="425" y="257" fill="#b2bec3" text-anchor="middle" font-size="8" font-family="monospace">Sickerw.-Schacht</text>
      <rect x="380" y="266" width="90" height="10" fill="#2d3436" stroke="#0f3460" stroke-width="1"/>
      <rect x="380" y="266" width="{0.9 * sw_sws_fuell:.1f}" height="10" fill="{_sw_farbe(sw_sws_fuell)}"/>
      <text x="425" y="294" fill="#dfe6e9" text-anchor="middle" font-size="9" font-family="monospace">{sw_sws_fuell:.0f} %</text>

      <!-- Druckleitung DN 300 → Sammelbecken -->
      <path d="M 480,250 L 520,250 L 520,150 L 560,150" stroke="#74b9ff" stroke-width="2" fill="none" stroke-dasharray="4,3" marker-end="url(#ah-sw)"/>
      <text x="528" y="205" fill="#74b9ff" font-size="9" font-family="monospace">DN 300</text>
      <text x="528" y="217" fill="#74b9ff" font-size="9" font-family="monospace">Druckltg.</text>

      <!-- Sammelbecken SB-1 / Pumpwerk SWP-01 -->
      <rect x="560" y="95" width="180" height="105" rx="6" fill="#16213e" stroke="#0984e3" stroke-width="1.5"/>
      <text x="650" y="116" fill="#74b9ff" text-anchor="middle" font-size="11" font-weight="bold" font-family="monospace">SAMMELBECKEN SB-1</text>
      <text x="650" y="131" fill="#b2bec3" text-anchor="middle" font-size="9" font-family="monospace">KKS: SWP-01</text>
      <rect x="575" y="140" width="150" height="14" fill="#2d3436" stroke="#0f3460" stroke-width="1"/>
      <rect x="575" y="140" width="{1.5 * sw_fuell:.1f}" height="14" fill="{_sw_farbe(sw_fuell)}"/>
      <text x="650" y="151" fill="#ffffff" text-anchor="middle" font-size="9" font-weight="bold" font-family="monospace">FÜLLSTAND {sw_fuell:.0f} %</text>
      <text x="650" y="172" fill="#dfe6e9" text-anchor="middle" font-size="9" font-family="monospace">Q_zu = {sw_Q_Ls:.0f} L/s</text>
      <text x="650" y="188" fill="{sw_status_farbe}" text-anchor="middle" font-size="9" font-family="monospace">{sw_status.split(" (")[0]}</text>

      <!-- SB-1 → Sickerwasserbehandlung → KA -->
      <line x1="740" y1="148" x2="785" y2="148" stroke="#3a6090" stroke-width="1.5" marker-end="url(#ah-sw)"/>
      <rect x="785" y="115" width="100" height="66" rx="6" fill="#16213e" stroke="#00b894" stroke-width="1.5"/>
      <text x="835" y="138" fill="#00b894" text-anchor="middle" font-size="10" font-weight="bold" font-family="monospace">SWBA</text>
      <text x="835" y="153" fill="#b2bec3" text-anchor="middle" font-size="8" font-family="monospace">Sickerwasser-</text>
      <text x="835" y="165" fill="#b2bec3" text-anchor="middle" font-size="8" font-family="monospace">behandlung</text>
      <line x1="835" y1="181" x2="835" y2="255" stroke="#3a6090" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-sw)"/>
      <rect x="770" y="255" width="120" height="50" rx="6" fill="#16213e" stroke="#74b9ff" stroke-width="1.5"/>
      <text x="830" y="276" fill="#74b9ff" text-anchor="middle" font-size="10" font-weight="bold" font-family="monospace">KA SCHWIERBACH</text>
      <text x="830" y="292" fill="#b2bec3" text-anchor="middle" font-size="8" font-family="monospace">Indirekteinleitung</text>

      <!-- Legende -->
      <rect x="20" y="318" width="250" height="30" rx="3" fill="#16213e" stroke="#0f3460" stroke-width="1"/>
      <text x="30" y="337" fill="#b2bec3" font-size="8" font-family="monospace">Füllstand: grün &lt; 65 %, gelb &lt; 85 %, rot &gt; 85 %</text>
    </svg>"""

    _tdl = 'style="padding:4px 14px 4px 0;color:#b2bec3;white-space:nowrap"'
    _tdv = 'style="padding:4px 0 4px 14px;color:#74b9ff;font-weight:bold;text-align:right;white-space:nowrap"'
    sw_live_html = f"""<div style="background:#16213e;border:1px solid #0f3460;border-radius:6px;padding:12px;margin-bottom:10px;color:#dfe6e9">
      <h3 style="margin:0 0 8px 0;color:#74b9ff;font-size:1em;border-bottom:1px solid #0f3460;padding-bottom:6px">📡 Live-Werte Sammelbecken SB-1 (Pumpwerk SWP-01)</h3>
      {sw_alarm}
      <table style="border-collapse:collapse;font-size:0.9em">
        <tr><td {_tdl}>Füllstand Sammelbecken</td><td {_tdv}>{sw_fuell:.0f} % ({sw_h:.2f} m / {sw_T:.1f} m)</td></tr>
        <tr><td {_tdl}>Füllvolumen aktuell</td><td {_tdv}>{sw_Vist:.0f} m³ / {sw_V:.0f} m³</td></tr>
        <tr><td {_tdl}>Zulauf (Druckrohr DN 300)</td><td {_tdv}>{sw_Q_Ls:.1f} L/s</td></tr>
        <tr><td {_tdl}>Fließgeschw. aktuell</td><td {_tdv}>{sw_v:.2f} m/s</td></tr>
        <tr><td {_tdl}>Pumpenstatus</td><td style="padding:4px 0 4px 14px;color:{sw_status_farbe};font-weight:bold;text-align:right;white-space:nowrap">{sw_status}</td></tr>
        <tr><td {_tdl}>Betriebsstunden P1</td><td {_tdv}>31.940 h</td></tr>
        <tr><td {_tdl}>Betriebsstunden P2</td><td {_tdv}>4.215 h</td></tr>
      </table>
      <div style="height:16px;border-radius:3px;background:#2d3436;overflow:hidden;margin:8px 0 4px"><div style="height:100%;width:{sw_fuell:.0f}%;background:{_sw_farbe(sw_fuell)}"></div></div>
      <p style="font-size:0.78em;color:#b2bec3;margin:6px 0 0 0">
        Fernwirk-Status: OK · letzter Telegrammempfang vor 2 s · Verbindung LWL
      </p>
    </div>"""

    def _dbz(i, k, v):
        bg = ' style="background:#f5f0d8"' if i % 2 else ""
        return (f'<tr{bg}><td style="padding:4px 12px;color:#5a4820;width:45%">{k}</td>'
                f'<td style="padding:4px 12px;font-weight:bold;color:#1a1a2e">{v}</td></tr>')
    _db_rows = [
        ("Anlagenkennzeichen (KKS)", "SWP-01"),
        ("Baujahr", "1987"),
        ("Bauart", "Stahlbeton, rechteckig, unterirdisch"),
        ("Becken – Länge (innen)", "L = 8,00 m"),
        ("Becken – Breite (innen)", "B = 5,00 m"),
        ("Becken – nutzbare Tiefe", "T = 5,00 m"),
        ("Zulauf", "Druckrohrleitung DN 300 (von SWS-1)"),
        ("Fließgeschw. Trockenwetter", "v_TW = 0,60 m/s"),
        ("Fließgeschw. Starkregen", "v_SR = 1,80 m/s"),
        ("Förderpumpen", "2 × Tauchmotor-KP (1 Betrieb, 1 Reserve)"),
        ("Weiterleitung nach", "Sickerwasserbehandlungsanlage (SWBA)"),
        ("Notstauvolumen (Betreibervorgabe nach Risikobetrachtung gem. DIN EN 16932-1)", "Starkregenzufluss mind. 30 min ohne Förderung aufnehmen"),
    ]
    sw_datenblatt_html = f"""<div style="background:#16213e;border:1px solid #0f3460;border-radius:6px;padding:12px;margin-bottom:10px;color:#dfe6e9;background:#fffef5;color:#1a1a2e;border:2px solid #5a4820">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a1a2e;padding-bottom:6px;margin-bottom:8px">
        <div>
          <div style="font-size:0.75em;color:#5a4820;letter-spacing:2px">ABFALL- &amp; ENERGIEZENTRUM SCHWIERBACH – DEPONIEBETRIEB</div>
          <div style="font-size:1.1em;font-weight:bold;color:#1a1a2e">BAUWERKSDATENBLATT</div>
        </div>
        <div style="text-align:right;font-size:0.75em;color:#5a4820">
          Blatt Nr.: SWP-01/DB-02<br>Stand: 03/2021<br>Archiv: Ordner 12/D
        </div>
      </div>
      <h3 style="color:#1a1a2e;border-color:#5a4820;margin:8px 0">Sickerwasser – Sammelbecken SB-1</h3>
      <table style="width:100%;border-collapse:collapse;font-size:0.88em;color:#1a1a2e">
        {"".join(_dbz(i, k, v) for i, (k, v) in enumerate(_db_rows))}
      </table>
      <p style="font-size:0.78em;color:#5a4820;margin:10px 0 0 0;font-style:italic;border-top:1px dashed #5a4820;padding-top:6px">
        Anmerkung: Unterlagen aus dem Bauarchiv. Geometrieangaben aus Bestandsplan 1987
        (vor Erneuerung Abdeckung 2004). Spätere Umbauten am Sammelbecken selbst nicht dokumentiert.
      </p>
    </div>"""

    sw_skizze_svg = """<div style="background:#16213e;border:1px solid #0f3460;border-radius:6px;padding:12px;margin-bottom:10px;color:#dfe6e9;background:#f7f3e8;color:#2c1810;border:2px solid #5a4820">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:0.85em;color:#5a4820;font-weight:bold">📐 Grobe Skizze aus Bauarchiv (Bestand)</div>
        <div style="font-size:0.7em;color:#5a4820;border:1.5px dashed #8a5020;padding:2px 8px;transform:rotate(-3deg);display:inline-block">ARCHIV · 1987</div>
      </div>
      <svg viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#f7f3e8;border:1px solid #c8b080;border-radius:4px">
        <defs>
          <pattern id="karo-sw" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#d4c090" stroke-width="0.4"/>
          </pattern>
          <marker id="sk-arrow-sw" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0,8 3,0 6" fill="#a03040"/>
          </marker>
        </defs>
        <rect width="600" height="340" fill="url(#karo-sw)"/>
        <text x="20" y="30" fill="#2c1810" font-size="15" font-family="Georgia, serif" font-style="italic" font-weight="bold">Sickerwasserbecken SB-1 - Seitenansicht</text>
        <path d="M 60,80 L 360,82 L 361,79 L 359,81" stroke="#2c1810" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M 58,230 L 362,231 L 361,228" stroke="#2c1810" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M 60,80 L 59,230 L 61,229" stroke="#2c1810" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M 360,82 L 361,231 L 359,230" stroke="#2c1810" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M 65,155 Q 85,150 105,155 T 145,155 T 185,155 T 225,155 T 265,155 T 305,155 T 345,155 T 358,155" stroke="#6a5a30" stroke-width="1.3" fill="none" opacity="0.6"/>
        <g stroke="#6a5a30" stroke-width="0.5" opacity="0.35">
          <line x1="70" y1="170" x2="80" y2="160"/><line x1="110" y1="180" x2="120" y2="170"/>
          <line x1="150" y1="172" x2="160" y2="162"/><line x1="190" y1="185" x2="200" y2="175"/>
          <line x1="230" y1="170" x2="240" y2="160"/><line x1="270" y1="185" x2="280" y2="175"/>
          <line x1="310" y1="172" x2="320" y2="162"/><line x1="95" y1="200" x2="105" y2="190"/>
          <line x1="175" y1="205" x2="185" y2="195"/><line x1="255" y1="208" x2="265" y2="198"/>
        </g>
        <path d="M 10,100 L 60,100" stroke="#2c1810" stroke-width="2.5" fill="none"/>
        <path d="M 10,120 L 60,120" stroke="#2c1810" stroke-width="2.5" fill="none"/>
        <text x="15" y="95" fill="#2c1810" font-size="11" font-family="Georgia, serif" font-style="italic">DN 300</text>
        <path d="M 25,110 L 45,110" stroke="#a03040" stroke-width="1.5" fill="none" marker-end="url(#sk-arrow-sw)"/>
        <text x="8" y="138" fill="#a03040" font-size="10" font-family="Georgia, serif" font-style="italic">von SWS-1</text>
        <path d="M 300,230 L 300,260 L 360,260 L 360,230" stroke="#2c1810" stroke-width="1.5" fill="none"/>
        <circle cx="330" cy="280" r="12" fill="none" stroke="#2c1810" stroke-width="2"/>
        <text x="330" y="285" fill="#2c1810" font-size="13" font-family="Georgia, serif" text-anchor="middle" font-weight="bold">P</text>
        <text x="370" y="283" fill="#2c1810" font-size="10" font-family="Georgia, serif" font-style="italic">Pumpe</text>
        <path d="M 330,268 L 330,240 L 410,240 L 410,60 L 450,60" stroke="#2c1810" stroke-width="1.8" fill="none"/>
        <text x="420" y="52" fill="#2c1810" font-size="10" font-family="Georgia, serif" font-style="italic">zur Behandlung</text>
        <line x1="60" y1="255" x2="360" y2="255" stroke="#5a4820" stroke-width="0.8"/>
        <line x1="60" y1="250" x2="60" y2="260" stroke="#5a4820" stroke-width="0.8"/>
        <line x1="360" y1="250" x2="360" y2="260" stroke="#5a4820" stroke-width="0.8"/>
        <text x="210" y="275" fill="#5a4820" font-size="13" font-family="Georgia, serif" font-style="italic" text-anchor="middle">L ≈ 8,00 m</text>
        <line x1="385" y1="80" x2="385" y2="230" stroke="#5a4820" stroke-width="0.8"/>
        <line x1="380" y1="80" x2="390" y2="80" stroke="#5a4820" stroke-width="0.8"/>
        <line x1="380" y1="230" x2="390" y2="230" stroke="#5a4820" stroke-width="0.8"/>
        <text x="400" y="160" fill="#5a4820" font-size="13" font-family="Georgia, serif" font-style="italic">T ≈ 5,00 m</text>
        <text x="470" y="95" fill="#2c1810" font-size="11" font-family="Georgia, serif" font-style="italic">Draufsicht:</text>
        <path d="M 475,105 L 575,106 L 576,166 L 474,165 L 475,105" stroke="#2c1810" stroke-width="1.5" fill="none"/>
        <line x1="480" y1="170" x2="570" y2="170" stroke="#5a4820" stroke-width="0.6"/>
        <text x="525" y="183" fill="#5a4820" font-size="10" font-family="Georgia, serif" font-style="italic" text-anchor="middle">L ≈ 8,00 m</text>
        <line x1="585" y1="110" x2="585" y2="160" stroke="#5a4820" stroke-width="0.6"/>
        <text x="594" y="135" fill="#5a4820" font-size="10" font-family="Georgia, serif" font-style="italic" text-anchor="middle" transform="rotate(-90 594 135)">B ≈ 5 m</text>
        <text x="20" y="315" fill="#8a5020" font-size="10" font-family="Georgia, serif" font-style="italic">Handskizze K. Wessendorf, Deponiebetrieb, 22.06.1987 – n. maßstäblich!</text>
        <circle cx="520" cy="262" r="20" fill="#8a5020" opacity="0.12"/>
        <circle cx="520" cy="262" r="14" fill="#8a5020" opacity="0.15"/>
      </svg>
    </div>"""

    deponie_sickerwasser = mo.Html(f"""<div style="background:#1a1a2e;color:#dfe6e9;padding:12px;border-radius:8px;font-family:Consolas,'Courier New',monospace">
      <div style="background:#16213e;border:1px solid #0f3460;border-radius:6px;padding:12px;margin-bottom:10px;color:#dfe6e9;overflow-x:auto">
        <h3 style="margin:0 0 8px 0;color:#74b9ff;font-size:1em;border-bottom:1px solid #0f3460;padding-bottom:6px">💧 Sickerwasserfassung – Übersicht</h3>
        <p style="font-size:0.85em;color:#b2bec3;margin:0 0 8px 0">
          Das Sickerwasser der Einbauabschnitte wird über die Basisdränage im Freispiegel zum Sickerwasserschacht
          SWS-1 geführt und von dort über eine Druckrohrleitung in das Sammelbecken SB-1 gefördert. Das Becken puffert
          den Zulauf zur Sickerwasserbehandlungsanlage. Zuflüsse und Füllstände folgen dem Niederschlag.
        </p>
        {sw_schema}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>{sw_live_html}</div>
        <div>{sw_datenblatt_html}</div>
      </div>
      {sw_skizze_svg}
    </div>""")

    deponie_weitere = geruest(
        "⛰️ Deponie – weitere Bereiche",
        "Ausbau der übrigen Deponiebereiche.",
        ["Einbau (Schlacke, Bauschutt, mineralische Abfälle)",
         "Sickerwasserbeschaffenheit & Behandlung",
         "Deponiegas",
         "Setzung / Nachsorge"])

    deponie = mo.ui.tabs({
        "💧 Sickerwasser": deponie_sickerwasser,
        "🛠️ Armaturen": dep_armaturen,
        "📋 Weitere Bereiche": deponie_weitere,
    }, lazy=True)

    energie = geruest(
        "🔌 Energie & Klärschlamm",
        "Energetische Verknüpfung des Betriebs: Dampf aus der MVA → Turbine → Strom und Fernwärme; "
        "Biogas → BHKW. Die Klärschlammtrocknung verbindet das AEZ wörtlich mit der Kläranlage "
        "(Schlamm wird angeliefert, getrocknet und mitverbrannt).",
        ["Dampf / Turbine (Wirkungsgrade, KWK)",
         "Fernwärmenetz (Abnahme, Vorlauf/Rücklauf)",
         "Klärschlammtrocknung (TS-Anhebung, Wärmebedarf)"])

    labor = geruest(
        "🔬 Labor",
        "Zentrale Eigenüberwachung des Verbunds – die analytische Klammer über alle Anlagen.",
        ["Eigenüberwachung (Probenahme, Protokolle)",
         "Emissionsanalytik (kontinuierlich & periodisch)",
         "Sickerwasser- & Eluatanalytik"])

    fliessschema = mo.Html('''<div class="pls"><div class="pls-c">
        <h3>📐 R&I-Fließschema <span class="pls-badge">in Vorbereitung</span></h3>
        <div class="pls-soon">Hier wird – analog zur Kläranlage – ein DIN EN ISO 10628-konformes
        R&I-Fließschema des AEZ eingebettet, mit Referenz- und Aufgabenversion (bewusste Fehler).</div>
    </div></div>''')

    # ---------- Tab-Assemblierung (Hub-Struktur) ----------
    tabs = mo.ui.tabs({
        "🏭 Gesamtbetrieb": mo.ui.tabs({
            "Übersicht": overview,
            "Fließschema": fliessschema,
        }, lazy=True),
        "🔥 MVA": mva,
        "🔀 Sortierung": sortierung,
        "🌱 Vergärung & Kompost": vergaerung,
        "⛰️ Deponie": deponie,
        "🔌 Energie & Klärschlamm": energie,
        "🔬 Labor": labor,
    }, lazy=True)

    # Leitstand-Kontrollzentrum über den Tabs
    kontroll_kopf = mo.Html('''<div class="pls"><div class="pls-hdr" style="margin-bottom:8px">
        <h2 style="font-size:1.15em">🎛️ Kontrollzentrum – Betriebsvorgaben</h2>
        <div class="pls-st"><span style="color:#8497ab;font-size:0.82em">Anlieferungsmengen, Heizwert und Niederschlag steuern die Live-Bilanz der Übersicht</span></div>
    </div></div>''')
    panel = mo.vstack([
        kontroll_kopf,
        mo.hstack([muell_t, sortier_t, bio_t], justify="start", gap=2, wrap=True),
        mo.hstack([ks_t, heizwert, niederschlag], justify="start", gap=2, wrap=True),
    ])

    mo.output.replace(mo.vstack([mo.Html(hdr), panel, tabs]))
    return


@app.cell
def _(mo):
    # === DEPONIE: ARMATUREN-UI (LS Schieber beschädigt, Abfall-UT) ===
    dep_armatur_auswahl = mo.ui.dropdown(
        options=[
            "—",
            "HS-SW-01  Plattenschieber  Druckleitung SWS-1",
            "HS-SW-02  Plattenschieber  Zulauf Sammelbecken SB-1",
            "HS-SW-03  Plattenschieber  Ablauf SB-1 → SWBA",
            "RK-SW-01  Rückschlagklappe  Druckstutzen P1",
            "RK-SW-02  Rückschlagklappe  Druckstutzen P2",
            "V-SW-01   Absperrschieber  Druckstutzen P1",
            "V-SW-02   Absperrschieber  Druckstutzen P2",
            "V-SW-05   Kugelhahn  Probenahme SB-1",
        ],
        value="—",
        label="Armatur auswählen",
    )
    dep_wartung_btn = mo.ui.run_button(label="🔧 Wartung beim Leitstand anmelden", kind="warn")
    return dep_armatur_auswahl, dep_wartung_btn


@app.cell
def _(dep_armatur_auswahl, dep_wartung_btn, mo):
    # === DEPONIE: ARMATURENVERZEICHNIS SICKERWASSER + WARTUNGSAUFTRAG ===
    import datetime as _dt

    DEP_ARMATUREN = {
        "HS-SW-01": dict(
            kks="HS-SW-01", kurz="Plattenschieber", einbau="Druckleitung, Ausgang SWS-1",
            anlagenteil="Sickerwasserschacht SWS-1", hersteller="KSB", modell="HERA-BD",
            dn=300, pn=6, werkstoff="5.3106 / EPDM", baujahr=2019, serien="238815",
            medium="Deponiesickerwasser", t_max=40, p_max=4, antrieb="Handrad",
            stellung="AUF", bh=58120, wartung="03/2023", zustand="ok", meldung=""),
        "HS-SW-02": dict(
            kks="HS-SW-02", kurz="Plattenschieber", einbau="Zulauf Sammelbecken SB-1",
            anlagenteil="Sammelbecken SB-1", hersteller="KSB", modell="HERA-BD",
            dn=300, pn=6, werkstoff="5.3106 / EPDM", baujahr=2019, serien="238817",
            medium="Deponiesickerwasser", t_max=40, p_max=4, antrieb="Handrad",
            stellung="AUF", bh=58120, wartung="03/2023", zustand="defekt",
            meldung="Mechanischer Schaden – Bügel verformt (Anfahrschaden Radlader), Handrad schwergängig. Seit 07:48 Uhr nicht mehr bedienbar."),
        "HS-SW-03": dict(
            kks="HS-SW-03", kurz="Plattenschieber", einbau="Ablauf SB-1 → Sickerwasserbehandlung",
            anlagenteil="Sammelbecken SB-1", hersteller="KSB", modell="HERA-BD",
            dn=200, pn=10, werkstoff="5.3106 / EPDM", baujahr=2019, serien="238820",
            medium="Deponiesickerwasser", t_max=40, p_max=4, antrieb="Handrad",
            stellung="AUF", bh=58120, wartung="03/2023", zustand="ok", meldung=""),
        "RK-SW-01": dict(
            kks="RK-SW-01", kurz="Rückschlagklappe", einbau="Druckstutzen Pumpe P1 (SWS-1)",
            anlagenteil="Sickerwasserschacht SWS-1", hersteller="ERHARD", modell="ROCO wave",
            dn=150, pn=10, werkstoff="EN-GJS-500 / EPDM", baujahr=2012, serien="E-418002",
            medium="Deponiesickerwasser", t_max=40, p_max=10, antrieb="selbsttätig",
            stellung="betriebsbedingt", bh=31940, wartung="05/2024", zustand="ok", meldung=""),
        "RK-SW-02": dict(
            kks="RK-SW-02", kurz="Rückschlagklappe", einbau="Druckstutzen Pumpe P2 (SWS-1)",
            anlagenteil="Sickerwasserschacht SWS-1", hersteller="ERHARD", modell="ROCO wave",
            dn=150, pn=10, werkstoff="EN-GJS-500 / EPDM", baujahr=2012, serien="E-418003",
            medium="Deponiesickerwasser", t_max=40, p_max=10, antrieb="selbsttätig",
            stellung="betriebsbedingt", bh=4215, wartung="05/2024", zustand="ok", meldung=""),
        "V-SW-01": dict(
            kks="V-SW-01", kurz="Absperrschieber", einbau="Druckstutzen Pumpe P1 (SWS-1)",
            anlagenteil="Sickerwasserschacht SWS-1", hersteller="AVK", modell="Serie 06",
            dn=150, pn=10, werkstoff="EN-GJS-500 / EPDM", baujahr=2012, serien="AVK-118734",
            medium="Deponiesickerwasser", t_max=40, p_max=10, antrieb="Handrad",
            stellung="AUF", bh=58120, wartung="05/2024", zustand="ok", meldung=""),
        "V-SW-02": dict(
            kks="V-SW-02", kurz="Absperrschieber", einbau="Druckstutzen Pumpe P2 (SWS-1)",
            anlagenteil="Sickerwasserschacht SWS-1", hersteller="AVK", modell="Serie 06",
            dn=150, pn=10, werkstoff="EN-GJS-500 / EPDM", baujahr=2012, serien="AVK-118735",
            medium="Deponiesickerwasser", t_max=40, p_max=10, antrieb="Handrad",
            stellung="AUF", bh=58120, wartung="05/2024", zustand="ok", meldung=""),
        "V-SW-05": dict(
            kks="V-SW-05", kurz="Kugelhahn", einbau="Probenahme Sammelbecken SB-1",
            anlagenteil="Sammelbecken SB-1", hersteller="ARI Armaturen", modell="ZETRIX",
            dn=25, pn=16, werkstoff="1.4408 / PTFE", baujahr=2016, serien="ARI-55120",
            medium="Deponiesickerwasser", t_max=40, p_max=4, antrieb="Handhebel",
            stellung="ZU", bh=0, wartung="11/2025", zustand="ok", meldung=""),
    }

    def _z_farbe(z):
        return {"ok": "#00b894", "wartung": "#fdcb6e",
                "sanierung": "#e17055", "defekt": "#e94560"}.get(z, "#74b9ff")

    def _z_icon(z):
        return {"ok": "🟢", "wartung": "🟡", "sanierung": "🟠", "defekt": "🔴"}.get(z, "⚪")

    def _z_text(z):
        return {"ok": "in Betrieb", "wartung": "Wartung fällig",
                "sanierung": "Sanierung empfohlen", "defekt": "STÖRUNG"}.get(z, z)

    def _typenschild_svg(a):
        """Erzeugt ein KSB-ähnliches Typenschild als SVG, Daten variabel."""
        marke = a["hersteller"]
        # Farbschema dezent nach Hersteller
        mfarbe = {
            "KSB": "#1a4a90", "VAG": "#2a6030", "ERHARD": "#603020",
            "AVK": "#8a4818", "ARI Armaturen": "#50208a",
            "Adams Armaturen": "#1a5a80",
        }.get(marke, "#1a4080")
        return f'''
<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:480px;height:auto">
  <!-- Blechplatte -->
  <defs>
<linearGradient id="mtl-{a["kks"]}" x1="0%" y1="0%" x2="0%" y2="100%">
  <stop offset="0%" style="stop-color:#e8e8ec"/>
  <stop offset="50%" style="stop-color:#c8c8cc"/>
  <stop offset="100%" style="stop-color:#a8a8ac"/>
</linearGradient>
  </defs>
  <rect x="4" y="4" width="472" height="272" rx="6" fill="url(#mtl-{a["kks"]})" stroke="#707080" stroke-width="1"/>
  <!-- Blaue Kopfzeile -->
  <rect x="4" y="4" width="472" height="46" rx="6" fill="{mfarbe}"/>
  <text x="240" y="34" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="22" font-weight="bold" letter-spacing="2">{a["kurz"].upper()}</text>

  <!-- Typ + Hersteller-Logo-Bereich -->
  <text x="30" y="80" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="14" font-weight="bold">Typ:</text>
  <text x="75" y="80" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="15" font-weight="bold">{a["modell"]}</text>
  <line x1="75" y1="84" x2="280" y2="84" stroke="#303040" stroke-width="0.6"/>
  <!-- Hersteller-„Logo" -->
  <rect x="340" y="60" width="115" height="32" rx="3" fill="#ffffff" stroke="{mfarbe}" stroke-width="1.5"/>
  <text x="397" y="82" text-anchor="middle" fill="{mfarbe}" font-family="Arial,sans-serif" font-size="15" font-weight="bold">{marke}</text>
  <line x1="20" y1="100" x2="460" y2="100" stroke="{mfarbe}" stroke-width="1.2"/>

  <!-- Linke Spalte -->
  <text x="30" y="125" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="11" font-weight="bold">Einbauort:</text>
  <text x="100" y="125" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="11">{a["einbau"][:38]}</text>
  <line x1="100" y1="128" x2="240" y2="128" stroke="#303040" stroke-width="0.4"/>

  <text x="30" y="152" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="11" font-weight="bold">Nennweite:</text>
  <text x="105" y="152" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="11" font-weight="bold">DN {a["dn"]}</text>
  <line x1="105" y1="155" x2="240" y2="155" stroke="#303040" stroke-width="0.4"/>

  <text x="30" y="175" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="11" font-weight="bold">Druckstufe:</text>
  <text x="105" y="175" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="11" font-weight="bold">PN {a["pn"]}</text>
  <line x1="105" y1="178" x2="240" y2="178" stroke="#303040" stroke-width="0.4"/>

  <!-- Rechte Spalte -->
  <text x="260" y="125" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="11" font-weight="bold">Werkstoff:</text>
  <text x="327" y="125" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="11" font-weight="bold">{a["werkstoff"]}</text>
  <line x1="327" y1="128" x2="460" y2="128" stroke="#303040" stroke-width="0.4"/>

  <text x="260" y="152" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="11" font-weight="bold">Baujahr:</text>
  <text x="318" y="152" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="11" font-weight="bold">{a["baujahr"]}</text>
  <line x1="318" y1="155" x2="460" y2="155" stroke="#303040" stroke-width="0.4"/>

  <text x="260" y="175" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="11" font-weight="bold">Serien-Nr.:</text>
  <text x="327" y="175" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="11" font-weight="bold">{a["serien"]}</text>
  <line x1="327" y1="178" x2="460" y2="178" stroke="#303040" stroke-width="0.4"/>

  <!-- Untere Zeile -->
  <line x1="20" y1="200" x2="460" y2="200" stroke="{mfarbe}" stroke-width="1.2"/>
  <text x="30" y="223" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="11" font-weight="bold">Medium: {a["medium"]}</text>
  <line x1="163" y1="210" x2="163" y2="235" stroke="#606060" stroke-width="0.4"/>
  <text x="175" y="223" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="11" font-weight="bold">max. Temp.: {a["t_max"]} °C</text>
  <line x1="310" y1="210" x2="310" y2="235" stroke="#606060" stroke-width="0.4"/>
  <text x="322" y="223" fill="#1a1a1a" font-family="Arial,sans-serif" font-size="11" font-weight="bold">max. Druck: {a["p_max"]} bar</text>

  <!-- Fußzeile -->
  <rect x="4" y="245" width="472" height="31" fill="{mfarbe}" rx="0"/>
  <text x="240" y="266" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="12" font-weight="bold" letter-spacing="1">Made in Germany</text>

  <!-- Bohrungen (Ecken) -->
  <circle cx="24" cy="24" r="4.5" fill="#707080" stroke="#303040" stroke-width="0.6"/>
  <circle cx="456" cy="24" r="4.5" fill="#707080" stroke="#303040" stroke-width="0.6"/>
  <circle cx="24" cy="256" r="4.5" fill="#707080" stroke="#303040" stroke-width="0.6"/>
  <circle cx="456" cy="256" r="4.5" fill="#707080" stroke="#303040" stroke-width="0.6"/>
</svg>'''

    # --- Armaturenliste ---
    _zeilen = ""
    for _kks, _a in DEP_ARMATUREN.items():
        _zeilen += (f'<tr><td style="color:#74b9ff;font-weight:bold">{_kks}</td><td>{_a["kurz"]}</td>'
                    f'<td style="color:#b2bec3;font-size:0.9em">{_a["einbau"]}</td><td style="text-align:center">DN {_a["dn"]}</td>'
                    f'<td style="text-align:center">{_a["stellung"]}</td><td style="text-align:right">{_a["bh"]:,} h</td>'
                    f'<td style="color:{_z_farbe(_a["zustand"])};font-weight:bold">{_z_icon(_a["zustand"])} {_z_text(_a["zustand"])}</td></tr>')
    _n_def = sum(1 for _a in DEP_ARMATUREN.values() if _a["zustand"] == "defekt")
    _liste = f'''<div class="pls"><div class="pls-c">
      <h3>🛠️ Armaturenverzeichnis Sickerwasser</h3>
      <p style="font-size:0.85em;color:#b2bec3;margin:0 0 8px">Armaturen der Sickerwasserfassung (SWS-1 → Druckleitung DN 300 → Sammelbecken SB-1 → SWBA).
      Zustand, Stellung und Betriebsstunden aus dem Leitstand. Aktuelle Störungen: <strong style="color:{"#e94560" if _n_def else "#00b894"}">{_n_def}</strong></p>
      <div style="overflow-x:auto"><table class="pls-overview-tbl" style="width:100%">
        <tr><th>KKS</th><th>Typ</th><th>Einbauort</th><th>Nennweite</th><th>Stellung</th><th>Betriebsstd.</th><th>Status</th></tr>
        {_zeilen}
      </table></div>
    </div></div>'''

    # --- Details auffälliger Armaturen ---
    _details = ""
    for _kks, _a in DEP_ARMATUREN.items():
        if _a["zustand"] == "ok":
            continue
        _zf = _z_farbe(_a["zustand"])
        _details += f'''
<details style="margin:6px 0;background:#16213e;border:1px solid {_zf};border-radius:6px;padding:8px 14px">
  <summary style="cursor:pointer;font-weight:bold;color:{_zf};font-family:monospace;font-size:0.95em">
    {_z_icon(_a["zustand"])} {_kks} – {_a["kurz"]} · {_a["einbau"]} <span style="color:#b2bec3;font-weight:normal">&nbsp;▸&nbsp;Details anzeigen</span>
  </summary>
  <div style="margin-top:10px">
    <div style="background:rgba(233,69,96,0.12);border-left:3px solid {_zf};padding:6px 10px;margin:6px 0 10px;font-size:0.85em">
      <strong style="color:{_zf}">⚡ Störmeldung:</strong> <span style="color:#dfe6e9">{_a["meldung"]}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">
      <div>
        <h4 style="color:#74b9ff;margin:0 0 6px;font-size:0.85em;border-bottom:1px solid #0f3460;padding-bottom:3px">📋 Typenschild (Original)</h4>
        {_typenschild_svg(_a)}
      </div>
      <div>
        <h4 style="color:#74b9ff;margin:0 0 6px;font-size:0.85em;border-bottom:1px solid #0f3460;padding-bottom:3px">📊 Betriebsdaten</h4>
        <table style="font-size:0.85em;width:100%">
          <tr><td>Anlagenteil</td><td class="c-v" style="text-align:right">{_a["anlagenteil"]}</td></tr>
          <tr><td>Antriebsart</td><td class="c-v" style="text-align:right">{_a["antrieb"]}</td></tr>
          <tr><td>Aktuelle Stellung</td><td class="c-v" style="text-align:right">{_a["stellung"]}</td></tr>
          <tr><td>Betriebsstunden</td><td class="c-v" style="text-align:right">{_a["bh"]:,} h</td></tr>
          <tr><td>Letzte Wartung</td><td class="c-v" style="text-align:right">{_a["wartung"]}</td></tr>
          <tr><td>Zustand</td><td style="color:{_zf};font-weight:bold;text-align:right">{_z_text(_a["zustand"])}</td></tr>
        </table>
        <div style="margin-top:10px;padding:8px 10px;background:#0f1a30;border-radius:4px;font-size:0.8em;color:#b2bec3">
          💡 Für eine Wartung oder Instandsetzung dieser Armatur bitte den Auswahldialog unten verwenden.
        </div>
      </div>
    </div>
  </div>
</details>'''

    # --- Wartungsauftrag (bei Button-Klick) ---
    _auftrag = ""
    if dep_wartung_btn.value and dep_armatur_auswahl.value and dep_armatur_auswahl.value != "—":
        _sel_kks = dep_armatur_auswahl.value.split()[0]
        _sel = DEP_ARMATUREN.get(_sel_kks)
        if _sel:
            _auftrag_nr = f"WA-D{2026000 + (sum(map(ord, _sel_kks)) % 1000):06d}"
            _datum = _dt.datetime.now().strftime("%d.%m.%Y %H:%M")
            _auftrag = f'''
<div style="background:#fffdf5;color:#1a1a2e;border:2px solid #5a4820;border-radius:6px;padding:16px 20px;margin-top:10px;font-family:'Consolas','Courier New',monospace">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a1a2e;padding-bottom:8px;margin-bottom:10px">
    <div>
      <div style="font-size:0.75em;color:#5a4820;letter-spacing:1.5px">ABFALL- &amp; ENERGIEZENTRUM SCHWIERBACH – DEPONIEBETRIEB</div>
      <div style="font-size:1.1em;font-weight:bold">WARTUNGSAUFTRAG / INSTANDSETZUNG</div>
    </div>
    <div style="text-align:right;font-size:0.8em;color:#5a4820">
      <div><strong style="color:#1a1a2e">Auftrag-Nr.: {_auftrag_nr}</strong></div>
      <div>Ausgestellt: {_datum}</div>
      <div>Priorität: {"HOCH (Störung)" if _sel["zustand"]=="defekt" else "MITTEL"}</div>
    </div>
  </div>
  <table style="width:100%;font-size:0.88em;border-collapse:collapse">
    <tr><td style="padding:3px 8px;color:#5a4820;width:35%">Armatur (KKS)</td><td style="padding:3px 8px;font-weight:bold">{_sel["kks"]}</td></tr>
    <tr><td style="padding:3px 8px;color:#5a4820">Typ / Modell</td><td style="padding:3px 8px;font-weight:bold">{_sel["kurz"]} · {_sel["hersteller"]} {_sel["modell"]}</td></tr>
    <tr><td style="padding:3px 8px;color:#5a4820">Einbauort</td><td style="padding:3px 8px;font-weight:bold">{_sel["einbau"]}</td></tr>
    <tr><td style="padding:3px 8px;color:#5a4820">Nennweite / Druckstufe</td><td style="padding:3px 8px;font-weight:bold">DN {_sel["dn"]} / PN {_sel["pn"]}</td></tr>
    <tr><td style="padding:3px 8px;color:#5a4820">Werkstoff</td><td style="padding:3px 8px;font-weight:bold">{_sel["werkstoff"]}</td></tr>
    <tr><td style="padding:3px 8px;color:#5a4820">Serien-Nr. / Baujahr</td><td style="padding:3px 8px;font-weight:bold">{_sel["serien"]} · {_sel["baujahr"]}</td></tr>
    <tr><td style="padding:3px 8px;color:#5a4820">Aktueller Zustand</td><td style="padding:3px 8px;font-weight:bold;color:{_z_farbe(_sel["zustand"])}">{_z_text(_sel["zustand"])}</td></tr>
    <tr><td style="padding:3px 8px;color:#5a4820;vertical-align:top">Anlass / Befund</td><td style="padding:3px 8px">{_sel.get("meldung") or "Routine-Wartung, planmäßig"}</td></tr>
  </table>
  <div style="margin-top:12px;padding-top:8px;border-top:1px dashed #5a4820">
    <table style="width:100%;font-size:0.85em">
      <tr><td style="padding:3px 8px;color:#5a4820;width:35%">Meldende Stelle</td><td style="padding:3px 8px">Deponiebetrieb (Auszubildende/-r)</td></tr>
      <tr><td style="padding:3px 8px;color:#5a4820">Empfänger</td><td style="padding:3px 8px">Leitstand / Instandhaltung</td></tr>
      <tr><td style="padding:3px 8px;color:#5a4820">Erforderliche Unterlagen</td><td style="padding:3px 8px">Betriebsanleitung, Explosionszeichnung, Stückliste</td></tr>
    </table>
  </div>
  <div style="margin-top:10px;padding:8px 10px;background:#f4f0e0;border-left:3px solid #5a4820;font-size:0.82em">
    <strong>📩 Auftrag an den Leitstand übermittelt.</strong> Der Leitstand bestätigt den Eingang und
    terminiert die Maßnahme mit der Instandhaltung. Bei Störungsmeldungen (Priorität HOCH) erfolgt
    die Kontaktaufnahme binnen 30 Minuten.
  </div>
</div>'''
            if _sel_kks == "HS-SW-02":
                _rm_zeit = (_dt.datetime.now() + _dt.timedelta(minutes=17)).strftime("%H:%M")
                _auftrag += f'''
<div style="background:#f5f8fc;color:#1a1a2e;border:2px solid #2D6A2E;border-radius:6px;padding:16px 20px;margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:0.9em;line-height:1.45">
  <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #2D6A2E;padding-bottom:6px;margin-bottom:10px">
    <div style="font-weight:bold;color:#2D6A2E;font-size:1.05em">📞 Rückmeldung Instandhaltung / Werkstatt</div>
    <div style="font-size:0.85em;color:#555">zu Auftrag {_auftrag_nr} · heute, {_rm_zeit} Uhr</div>
  </div>
  <p style="margin:0 0 8px"><strong>Von:</strong> Werkstattmeister Instandhaltung AEZ<br>
  <strong>An:</strong> Deponiebetrieb (Auszubildende/-r)</p>
  <p style="margin:0 0 8px">Moin, euer Auftrag ist angekommen. Ich war gerade am Sammelbecken und habe mir HS-SW-02 angesehen:
  Der <strong>Bügel (Pos. 166)</strong> ist durch den Anfahrschaden bleibend verbogen. Alles andere sieht auf den ersten Blick
  in Ordnung aus. KSB kann den Bügel nicht liefern – wir fertigen ihn selbst in unserer Werkstatt.
  Den alten Bügel habe ich ausgebaut und eine Zeichnung davon angefertigt (liegt euch vor).
  Solange der Schieber nicht bedienbar ist, kann der Zulauf zum SB-1 im Störfall nicht abgesperrt werden.</p>
  <p style="margin:0 0 4px">Bitte bereitet bis zur nächsten Besprechung Folgendes vor:</p>
  <ol style="margin:0 0 10px;padding-left:22px;list-style:decimal outside">
    <li><strong>Werkstoff für den neuen Bügel festlegen</strong> – mit nachvollziehbarer Begründung.
        Der Originalwerkstoff S275JR ist nicht am Lager. Eine Bestellung dauert ca. 3 Wochen – so lange
        wollen wir nicht warten. Nehmt also bitte etwas aus dem Lagerbestand (siehe unten).
        Denkt daran: Am Sammelbecken ist die Luft feucht und durch das Sickerwasser chlorid- und ammoniumhaltig.</li>
    <li><strong>Arbeitsplan für die Fertigung des Bügels</strong> (Zuschnitt, Bearbeitung, Biegen, Korrosionsschutz, Prüfung).</li>
    <li><strong>Arbeitsplan für Ausbau, Wartung und Wiedereinbau</strong> des Schiebers. Wenn die Armatur schon draußen ist,
        machen wir die fällige Wartung gleich mit (letzte Wartung 03/2023).</li>
  </ol>
  <div style="font-weight:bold;color:#2D6A2E;margin:6px 0 4px">Lagerbestand Blech (Werkstatt, Regal B)</div>
  <table style="border-collapse:collapse;width:100%;max-width:560px;font-size:0.95em">
    <tr style="background:#2D6A2E;color:#fff">
      <th style="text-align:left;padding:4px 8px">Werkstoff</th>
      <th style="text-align:left;padding:4px 8px">Abmessung (Tafel)</th>
      <th style="text-align:right;padding:4px 8px">Preis</th></tr>
    <tr style="background:#e3efe3"><td style="padding:4px 8px">S235JR</td><td style="padding:4px 8px">1200 × 800 × 7 mm</td><td style="padding:4px 8px;text-align:right">1000 €/t</td></tr>
    <tr><td style="padding:4px 8px">EN AW-6082-T6</td><td style="padding:4px 8px">800 × 600 × 8 mm</td><td style="padding:4px 8px;text-align:right">3600 €/t</td></tr>
    <tr style="background:#e3efe3"><td style="padding:4px 8px">X5CrNi18-10</td><td style="padding:4px 8px">1000 × 600 × 5 mm</td><td style="padding:4px 8px;text-align:right">4400 €/t</td></tr>
  </table>
  <div style="font-weight:bold;color:#2D6A2E;margin:12px 0 4px">Was ihr über unsere Werkstatt wissen müsst</div>
  <ul style="margin:0;padding-left:22px;list-style:disc outside">
    <li>Zuschnitt aus der Tafel: Tafelschere bis 6 mm, darüber Plasmaschneiden. Bandsäge und Ständerbohrmaschine sind vorhanden.</li>
    <li>Biegen: Abkantbank mit wechselbaren Oberwerkzeugen (Biegeradien innen 5, 10, 20, 30 und 50 mm).</li>
    <li>Schweißen: MAG und WIG möglich.</li>
    <li>Beschichten: 2K-Epoxid können wir selbst auftragen (2 Schichten, je Schicht 24 h Trockenzeit).
        Pulverbeschichten nur über eine Fremdfirma (ca. 1 Woche Lieferzeit).</li>
    <li>Verrechnungssatz Werkstatt: 58 €/h.</li>
    <li>Schrauben und Muttern aus A2 oder A4 sowie Ersatzteile für die Stopfbuchspackung bestellt das Lager bei Bedarf über KSB (Lieferung 2 Tage).</li>
  </ul>
  <p style="margin:10px 0 0">Bei Fragen meldet euch einfach. Gruß aus der Werkstatt</p>
</div>'''

    dep_armaturen = mo.vstack([
        mo.Html(_liste),
        mo.Html(f'''<div class="pls"><div class="pls-c">
            <h3>🔍 Auffällige Armaturen (Details)</h3>
            <p style="font-size:0.82em;color:#b2bec3;margin:0 0 10px">Klick auf eine Zeile öffnet die Detailansicht mit Original-Typenschild und Betriebsdaten.</p>
            {_details or '<p style="color:#00b894">Keine auffälligen Armaturen.</p>'}
        </div></div>'''),
        mo.Html('''<div class="pls"><div class="pls-c" style="border-color:#fdcb6e">
            <h3 style="color:#fdcb6e">📨 Wartung beim Leitstand anmelden</h3>
            <p style="font-size:0.85em;color:#b2bec3;margin:0 0 10px">Armatur aus der Liste wählen und den Wartungsauftrag an den Leitstand übermitteln.
            Das System erzeugt automatisch ein Auftragsformular mit allen Stammdaten.</p>
        </div></div>'''),
        mo.hstack([dep_armatur_auswahl, dep_wartung_btn], justify="start", gap=1),
        mo.Html(f'<div class="pls">{_auftrag}</div>') if _auftrag else mo.Html(""),
    ])
    return (dep_armaturen,)


if __name__ == "__main__":
    app.run()
