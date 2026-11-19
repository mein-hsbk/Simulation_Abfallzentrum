// Laufende Anlagensimulation des AEZ (Deponiegasabsaugung): Zustand, Zeitraffer, Protokoll.
// Wird von der 3D-Szene (Instrumente), der Leitwarte, der Bestellung und den Missionen gemeinsam genutzt.
import { setupGas, stepGas, fmtZeit, tag } from './gas-modell.js';

export const sim = {
  G: setupGas(null),        // Deponiegas / Gasverdichterstation
  diagnose: null,           // in der Meldung gewählte Störungsursache
  speed: 5,                 // Simulationssekunden je Echtzeitsekunde
  paused: false,
  log: [],
  t0real: performance.now(),
  listeners: new Set(),
};

const stamp = () => {
  const s = Math.floor((performance.now() - sim.t0real) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
function push(text, art) {
  sim.log.push({ real: stamp(), sim: `T${tag(sim.G.t)} ${fmtZeit(sim.G.t)}`, art, text, ts: sim.G.t, tr: performance.now() - sim.t0real });
  for (const f of sim.listeners) f();
}
export const logA = (text, art = 'aktion') => push(text, art);
export const logSys = (text, art = 'sys') => push(text, art);
export function logText() {
  return ['Echtzeit\tSimzeit\tArt\tEreignis', ...sim.log.map((l) => `${l.real}\t${l.sim}\t${l.art}\t${l.text}`)].join('\n');
}

export function startSzenario({ gas = null, gasOpt = {}, speed, titel } = {}) {
  sim.G = setupGas(gas, gasOpt); sim.diagnose = null;
  sim.speed = speed ?? sim.speed; sim.log.length = 0; sim.t0real = performance.now();
  logSys(`Start ${titel || 'Normalbetrieb'} · Zeitraffer ×${sim.speed}`);
  stepGas(sim.G, 1, logSys);
  for (const f of sim.listeners) f();
}
export function simTick(dtReal) { if (!sim.paused) stepGas(sim.G, Math.min(1, dtReal) * sim.speed, logSys); }
startSzenario({ titel: 'Normalbetrieb' });
