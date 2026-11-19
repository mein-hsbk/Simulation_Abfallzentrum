// Ersatzteilbestellung (Bestellanforderung an den Einkauf): Artikel aus dem Lieferantenkatalog,
// Aggregat, Menge, Angaben vom Typenschild und besondere Anforderungen. Jede Position wird protokolliert
// und in sim.G.bestellungen abgelegt; die Missionen prüfen Artikelwahl, Ex-Anforderungen und Angaben.
import { KATALOG, GEB, MOT } from './gas-modell.js';
import { sim, logA } from './anlage-sim.js';

const $ = (id) => document.getElementById(id);
const fe = (x) => x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function initBestellung(ui) {
  ui.overlays.push('best');
  const gruppen = [...new Set(KATALOG.map((a) => a.gr))];
  $('bestArt').innerHTML = '<option value="">– Artikel auswählen –</option>' + gruppen.map((g) => `<optgroup label="${g}">${KATALOG.filter((a) => a.gr === g).map((a) => `<option value="${a.id}">${a.name} · ${fe(a.preis)} €</option>`).join('')}</optgroup>`).join('');
  const liste = () => {
    const B = sim.G.bestellungen;
    $('bestListe').innerHTML = B.length ? `<table class="rpT"><tr><th>Pos.</th><th>Artikel</th><th>Menge</th><th>für</th><th class="n">€</th></tr>${B.map((b, i) => `<tr><td class="n">${i + 1}</td><td>${b.name}${b.typ ? `<div class="sub">Typenschild: ${b.typ}</div>` : ''}${b.anf ? `<div class="sub">Anforderungen: ${b.anf}</div>` : ''}</td><td class="n">${b.menge}</td><td>${b.fuer}</td><td class="n">${fe(b.preis * b.menge)}</td></tr>`).join('')}</table>` : '<div class="sub">Noch keine Positionen bestellt.</div>';
  };
  $('bestArt').onchange = () => { const a = KATALOG.find((x) => x.id === $('bestArt').value); $('bestInfo').textContent = a ? `${a.gr} · Listenpreis ${fe(a.preis)} € je Einheit` : ''; };
  const open = () => { liste(); $('best').style.display = 'flex'; logA('Bestellformular geöffnet', 'blick'); };
  $('bBest').onclick = open; ui.openBestellung = open;
  $('bestClose').onclick = () => { $('best').style.display = 'none'; };
  $('bestHilfe').onclick = () => ui.toast(`Gebläse: ${GEB.typ}, Serien-Nr. V1 ${GEB.snr[0]} · Motor: ${MOT.typ} – die Angaben stehen auf den Typenschildern vor Ort.`);
  $('bestOk').onclick = () => {
    const a = KATALOG.find((x) => x.id === $('bestArt').value);
    if (!a) return ui.toast('Bitte einen Artikel auswählen.');
    const menge = Math.max(1, Math.round(+$('bestMenge').value || 1)), fuer = $('bestFuer').value, typ = $('bestTyp').value.trim(), anf = $('bestAnf').value.trim(), eil = $('bestEil').checked;
    const b = { id: a.id, name: a.name, preis: a.preis, menge, fuer, typ, anf, eil, ts: sim.G.t };
    sim.G.bestellungen.push(b);
    logA(`BESTELLUNG Pos. ${sim.G.bestellungen.length}: ${menge} × ${a.name} für ${fuer}${typ ? ` · Typenschild: ${typ}` : ''}${anf ? ` · Anforderungen: ${anf}` : ''}${eil ? ' · EILT' : ''}`, 'meldung');
    ui.toast(`Position ${sim.G.bestellungen.length} bestellt.`);
    $('bestArt').value = ''; $('bestInfo').textContent = ''; $('bestMenge').value = '1'; $('bestTyp').value = ''; $('bestAnf').value = ''; $('bestEil').checked = false;
    liste();
  };
  return { open };
}
