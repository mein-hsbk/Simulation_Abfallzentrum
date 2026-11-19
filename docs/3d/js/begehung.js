// Begehung in Ich-Perspektive: Gehen (WASD / Touch-Joystick), Umsehen (Ziehen),
// einfache Kollision gegen Bauwerke, Hinweis auf nahe Instrumente.
import * as THREE from 'three';

export const STATIONEN = {
  verdichter: { n: "Verdichterstation", p: [161.2, -47.6, 160.2, -44] },
  verdichterInnen: { n: "Verdichter V1/V2", p: [162.5, -39.6, 166, -40.6] },
  kondensat: { n: "Kondensatabscheider", p: [170.2, -38.7, 171.6, -40] },
  schaltanlage: { n: "Schaltanlage", p: [169.3, -40.4, 169.6, -43.6] },
  hauptsammler: { n: "Hauptsammler", p: [182.6, -37.6, 181.4, -40] },
  fackel: { n: "Fackel / BHKW", p: [150, -21.5, 150, -28] },
};

export function createWalk({ scene, camera, canvas, controls, fence, areas = [], walls = [], getInstMeshes, insts, onInspect, onPickComp, isBlocked }) {
  const $ = (id) => document.getElementById(id);
  const P = { x: 0, z: 0, yaw: 0, pitch: 0 };
  const keys = {};
  let colliders = [], look = null, joy = null, moved = 0, hint = null;
  const camSave = {};
  const W = { active: false };

  function buildColliders() {
    colliders = [];
    const b = new THREE.Box3();
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.noCol) return;
      for (let p = o; p; p = p.parent) if (!p.visible) return;
      b.setFromObject(o);
      const sx = b.max.x - b.min.x, sz = b.max.z - b.min.z;
      if (b.min.y > 1.6 || b.max.y < 0.3 || sx > 70 || sz > 70) return;
      colliders.push([b.min.x, b.min.z, b.max.x, b.max.z]);
    });
  }
  function collide() {
    const r = 0.35;
    // begehbare Bereiche: Betriebsgelände und zusätzliche Flächen (z. B. Zufahrt zum Außenpumpwerk)
    let best = null, bd = Infinity;
    for (const a of [fence, ...areas]) {
      const cx = Math.max(a.x0 + 1, Math.min(a.x1 - 1, P.x)), cz = Math.max(a.z0 + 1, Math.min(a.z1 - 1, P.z)), d = Math.hypot(cx - P.x, cz - P.z);
      if (d < bd) { bd = d; best = [cx, cz]; }
    }
    P.x = best[0]; P.z = best[1];
    for (const [x0, z0, x1, z1] of [...colliders, ...walls]) {
      if (P.x < x0 - r || P.x > x1 + r || P.z < z0 - r || P.z > z1 + r) continue;
      const nx = Math.max(x0, Math.min(x1, P.x)), nz = Math.max(z0, Math.min(z1, P.z));
      const dx = P.x - nx, dz = P.z - nz, d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d > 1e-4) { P.x = nx + dx / d * r; P.z = nz + dz / d * r; }
      else {
        const o = [[x0 - r - P.x, 0], [x1 + r - P.x, 0], [0, z0 - r - P.z], [0, z1 + r - P.z]];
        o.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1])); P.x += o[0][0]; P.z += o[0][1];
      }
    }
  }

  function goTo(key) {
    const [x, z, tx, tz] = STATIONEN[key].p;
    Object.assign(P, { x, z, yaw: Math.atan2(tx - x, -(tz - z)), pitch: -0.22 });
    for (const b of document.querySelectorAll('#walkSt .btn')) b.classList.toggle('on', b.dataset.k === key);
  }

  W.enter = (key = "verdichter") => {
    if (W.active) { goTo(key); return; }
    W.active = true; controls.enabled = false;
    Object.assign(camSave, { fov: camera.fov, near: camera.near, pos: camera.position.clone(), tgt: controls.target.clone() });
    camera.fov = 62; camera.near = 0.1; camera.updateProjectionMatrix(); camera.rotation.order = 'YXZ';
    buildColliders(); goTo(key); collide();
    document.body.classList.add('walking');
  };
  W.exit = () => {
    if (!W.active) return;
    W.active = false; controls.enabled = true;
    camera.fov = camSave.fov; camera.near = camSave.near; camera.updateProjectionMatrix(); camera.rotation.order = 'XYZ';
    camera.position.copy(camSave.pos); controls.target.copy(camSave.tgt); camera.lookAt(camSave.tgt);
    document.body.classList.remove('walking'); setHint(null); $('joy').style.display = 'none';
  };
  W.goTo = goTo;

  // Stationsleiste
  $('walkSt').innerHTML = Object.entries(STATIONEN).map(([k, s]) => `<button class="btn" data-k="${k}">${s.n}</button>`).join('');
  $('walkSt').onclick = (e) => { const k = e.target.dataset.k; if (k) goTo(k); };

  // Tastatur
  addEventListener('keydown', (e) => {
    if (!W.active || /TEXTAREA|INPUT|SELECT/.test(e.target.tagName)) return;
    keys[e.code] = true;
    if (e.code === 'KeyE' && hint) onInspect(hint);
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // Zeiger: links unten Joystick (Touch), sonst Umsehen; kurzer Klick = Auswahl
  canvas.addEventListener('pointerdown', (e) => {
    if (!W.active) return;
    canvas.setPointerCapture(e.pointerId); moved = 0;
    if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.4) { joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }; showJoy(); }
    else look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!W.active) return;
    if (joy && e.pointerId === joy.id) { joy.dx = Math.max(-60, Math.min(60, e.clientX - joy.x0)); joy.dy = Math.max(-60, Math.min(60, e.clientY - joy.y0)); showJoy(); }
    else if (look && e.pointerId === look.id) {
      const k = e.pointerType === 'touch' ? 0.006 : 0.004;
      P.yaw += (e.clientX - look.x) * k; P.pitch = Math.max(-1.3, Math.min(1.3, P.pitch - (e.clientY - look.y) * k));
      moved += Math.abs(e.clientX - look.x) + Math.abs(e.clientY - look.y); look.x = e.clientX; look.y = e.clientY;
    }
  });
  const end = (e) => {
    if (!W.active) return;
    if (joy && e.pointerId === joy.id) { joy = null; $('joy').style.display = 'none'; }
    if (look && e.pointerId === look.id) { if (moved < 6) pick(e.clientX, e.clientY); look = null; }
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  function showJoy() { const j = $('joy'); j.style.display = 'block'; j.style.left = (joy.x0 - 60) + 'px'; j.style.top = (joy.y0 - 60) + 'px'; $('knob').style.transform = `translate(${joy.dx}px,${joy.dy}px)`; }

  const ray = new THREE.Raycaster();
  function pick(x, y) {
    ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
    const hi = ray.intersectObjects(getInstMeshes(), false)[0];
    if (hi && hi.distance < 4.5) return onInspect(hi.object.userData.inst);
    const hc = onPickComp(ray);
    if (hi && (!hc || hi.distance < hc)) onInspect(null, 'Zu weit entfernt – näher herangehen.');
  }

  function setHint(id) {
    if (id === hint) return;
    hint = id; const h = $('hint');
    if (id) { h.style.display = 'block'; h.innerHTML = `<b>${insts[id].tag}</b> ansehen <span class="k">E</span>`; } else h.style.display = 'none';
  }
  $('hint').onclick = () => hint && onInspect(hint);

  const fwd = new THREE.Vector3();
  W.update = (dt) => {
    if (!isBlocked()) {
      let fx = 0, fz = 0;
      if (keys.KeyW || keys.ArrowUp) fz += 1; if (keys.KeyS || keys.ArrowDown) fz -= 1;
      if (keys.KeyA) fx -= 1; if (keys.KeyD) fx += 1;
      if (keys.ArrowLeft) P.yaw -= 1.6 * dt; if (keys.ArrowRight) P.yaw += 1.6 * dt;
      if (joy) { fx += joy.dx / 60; fz -= joy.dy / 60; }
      const len = Math.hypot(fx, fz);
      if (len > 0.05) {
        const v = (keys.ShiftLeft || keys.ShiftRight ? 5 : 2.4) * Math.min(1, len) * dt / len, sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
        P.x += (fz * sy + fx * cy) * v; P.z += (-fz * cy + fx * sy) * v; collide();
      }
    }
    camera.position.set(P.x, 1.7, P.z); camera.rotation.set(P.pitch, -P.yaw, 0);
    camera.getWorldDirection(fwd);
    let best = null, bestA = 0.6;
    for (const id in insts) {
      const v = insts[id].pos.clone().sub(camera.position), d = v.length();
      if (d > 3.2) continue;
      const a = v.normalize().angleTo(fwd); if (a < bestA) { bestA = a; best = id; }
    }
    setHint(best);
  };
  W.player = P;
  return W;
}
