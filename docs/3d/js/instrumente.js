// Gemeinsame Bausteine für Vor-Ort-Instrumente: Zeichenfunktionen (Canvas) und Registrierung.
import * as THREE from 'three';

export const f1 = (x) => x.toFixed(1).replace('.', ','), f0 = (x) => Math.round(x).toLocaleString('de-DE');
export const noise = (amp, k) => amp * Math.sin(performance.now() / 700 + k) * Math.sin(performance.now() / 1900 + 2 * k);

// Zeigerinstrument (Manometer, Thermometer)
export function gauge(ctx, W, o) {
  const H = W, cx = W / 2, cy = H / 2, R = W * 0.47;
  ctx.fillStyle = '#2b2f33'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fbfbf7'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, ang = (v) => a0 + (a1 - a0) * (v - o.min) / (o.max - o.min);
  if (o.red) { ctx.strokeStyle = '#d63031'; ctx.lineWidth = W * 0.035; ctx.beginPath(); ctx.arc(cx, cy, R * 0.86, ang(o.red[0]), ang(o.red[1])); ctx.stroke(); }
  ctx.strokeStyle = '#111'; ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i <= o.ticks * 5; i++) {
    const v = o.min + (o.max - o.min) * i / (o.ticks * 5), a = ang(v), big = i % 5 === 0;
    ctx.lineWidth = big ? W * 0.012 : W * 0.006;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * (big ? 0.78 : 0.84), cy + Math.sin(a) * R * (big ? 0.78 : 0.84)); ctx.lineTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92); ctx.stroke();
    if (big) { ctx.font = `bold ${W * 0.07}px Arial`; ctx.fillText(String(Math.round(v)), cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62); }
  }
  ctx.font = `bold ${W * 0.075}px Arial`; ctx.fillText(o.unit, cx, cy + R * 0.42);
  ctx.font = `${W * 0.06}px Arial`; ctx.fillStyle = '#333'; ctx.fillText(o.tag, cx, cy - R * 0.32);
  const a = ang(Math.max(o.min - (o.max - o.min) * 0.02, Math.min(o.max * 1.02, o.val)));
  ctx.strokeStyle = '#000'; ctx.lineWidth = W * 0.02; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * R * 0.12, cy - Math.sin(a) * R * 0.12); ctx.lineTo(cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8); ctx.stroke();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx, cy, W * 0.04, 0, 7); ctx.fill();
  const gl = ctx.createLinearGradient(0, 0, W, H); gl.addColorStop(0, 'rgba(255,255,255,0.25)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
}
// Digitalanzeige mit Rahmen
export function lcd(ctx, W, H, title, lines, o = {}) {
  ctx.fillStyle = o.frame || '#d0d3d4'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2d3436'; ctx.font = `bold ${W * 0.055}px Arial`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(title, W * 0.06, H * 0.04);
  const x0 = W * 0.06, y0 = H * 0.16, w = W * 0.88, h = H * (o.lcdH || 0.62), fs = o.fs || 0.058;
  ctx.fillStyle = o.bg || '#0d2310'; ctx.fillRect(x0, y0, w, h);
  ctx.font = `${W * fs}px monospace`;
  lines.forEach((l, i) => { ctx.fillStyle = typeof l === 'object' ? l.c : (o.fg || '#7CFC9a'); ctx.fillText(typeof l === 'object' ? l.t : l, x0 + w * 0.04, y0 + h * 0.06 + i * W * fs * 1.35); });
}
export function lamp(ctx, x, y, r, col, on, label, W) {
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x, y, r * 1.2, 0, 7); ctx.fill();
  ctx.fillStyle = on ? col : '#3a3a3a'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  if (on) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#2d3436'; ctx.font = `${W * 0.045}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(label, x, y + r * 1.5);
}
export function plate(text, bg = '#ecf0f1') {
  return (ctx, W, H) => { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#111'; ctx.font = `bold ${W * 0.2}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, W / 2, H / 2); };
}
// Textuelle Sinneswahrnehmung (Geräusch, Vibration, Wärme)
export function senses(ctx, W, H, title, lines, on) {
  ctx.fillStyle = '#1e272e'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = on ? '#00b894' : '#636e72'; ctx.beginPath(); ctx.arc(W * 0.12, H * 0.16, W * 0.04, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffeaa7'; ctx.font = `bold ${W * 0.06}px Arial`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(title, W * 0.2, H * 0.16);
  ctx.fillStyle = '#dfe6e9'; ctx.font = `${W * 0.052}px Arial`;
  ctx.fillText('Sinneseindruck vor Ort:', W * 0.08, H * 0.34);
  lines.forEach((l, i) => ctx.fillText(l, W * 0.08, H * 0.48 + i * H * 0.11));
}

// Registry: alle Instrumente der Szene (Faulung, Belüftung, …)
export const insts = {};
export const instMeshes = [];

export function makeInstFactory(scene, M) {
  return function makeInst(id, def) {
    const S = def.res || 256, cv = document.createElement('canvas');
    cv.width = S; cv.height = Math.round(S * (def.aspect || 1));
    const ctx = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const geo = def.round ? new THREE.CircleGeometry(def.size / 2, 40) : new THREE.PlaneGeometry(def.size, def.size * (def.aspect || 1));
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    mesh.position.set(...def.pos); mesh.rotation.y = def.rotY || 0; mesh.userData.inst = id; mesh.userData.noCol = true;
    scene.add(mesh); instMeshes.push(mesh);
    if (def.round) {
      const hs = new THREE.Mesh(new THREE.CylinderGeometry(def.size / 2 + 0.02, def.size / 2 + 0.02, 0.06, 32), M.steelDark);
      hs.rotation.order = 'YXZ'; hs.rotation.set(Math.PI / 2, def.rotY || 0, 0); hs.userData.noCol = true;
      hs.position.copy(mesh.position).add(new THREE.Vector3(0, 0, -0.035).applyAxisAngle(new THREE.Vector3(0, 1, 0), def.rotY || 0)); scene.add(hs);
    }
    insts[id] = { ...def, id, cv, ctx, tex, mesh, pos: new THREE.Vector3(...def.pos) };
    return insts[id];
  };
}

// Rohrleitung als Polyline (ohne Kollision)
export function pipeFactory() {
  return (g, pts, r, mat) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 12), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      m.castShadow = true; m.userData.noCol = true; g.add(m);
      const k = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 10, 8), mat); k.position.copy(b); k.userData.noCol = true; g.add(k);
    }
  };
}

// Texturen nahe der Kamera zyklisch neu zeichnen, ebenso die geöffnete Detailansicht
let texT = 0;
export function updateInstruments(dt, camera, detail) {
  texT -= dt; if (texT > 0) return; texT = 0.25;
  for (const id in insts) {
    const it = insts[id];
    if (it.drawn && it.pos.distanceTo(camera.position) > 30) continue;
    it.draw(it.ctx, it.cv.width, it.cv.height); it.tex.needsUpdate = true; it.drawn = true;
  }
  if (detail && detail.id) { const it = insts[detail.id]; (it.detail || it.draw)(detail.ctx, detail.ctx.canvas.width, detail.ctx.canvas.height); }
}
