/* Pre-roll: a ten-second cold open before the app.
 *
 * It states the problem physically rather than decoratively: free hydrogen, a real
 * faujasite framework assembling out of the dark, molecules captured into its pores as
 * the temperature falls to the bath's 195 K — then the question the simulator answers.
 * Skippable at any point (button, Esc, Enter, Space), plays once per browser session,
 * and is bypassed entirely under prefers-reduced-motion.
 */
import * as THREE from "three";
import { fau, poreSites } from "./lattice.js";

const BEATS = [                       // [seconds, action]
  [0.4,  "meta"],
  [1.1,  "l1"],
  [3.4,  "lattice"],
  [3.7,  "l2"],
  [6.1,  "capture"],
  [6.4,  "l3"],
  [8.9,  "sub"],
  [10.6, "exit"],
];
const LINES = {
  l1: "Hydrogen is the smallest molecule there is.",
  l2: "To keep it, you need a cage.",
  l3: "At <em>195&nbsp;K</em>, how much of it stays?",
};

export function shouldPlay() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try { return sessionStorage.getItem("zm-preroll") !== "seen"; } catch { return true; }
}

export function playPreroll({ onDone, meta = {} } = {}) {
  const root = document.createElement("div");
  root.className = "preroll";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Introduction");
  root.innerHTML = `
    <div class="pr-meta" data-b="meta" style="opacity:0;transition:opacity .9s">
      <b>${meta.drawing || "PID-ZHS-FAB-002 · Rev C1"}</b><br>
      Zeolite × metal-organic framework composite<br>
      Hydrogen physisorption · dry-ice / acetone bath
    </div>
    <div class="pr-num" data-b="meta" style="opacity:0;transition:opacity .9s">
      bed temperature<b id="prT">298</b>kelvin
    </div>
    <div class="pr-cap"><div class="pr-line" id="prLine"></div><div class="pr-sub" id="prSub">
      Eight configurations &nbsp;·&nbsp; zeolite 13X, 5A &nbsp;·&nbsp; 15 wt% MOF &nbsp;·&nbsp; 1–10 bar</div></div>
    <button class="pr-skip" id="prSkip">Skip intro &nbsp;→</button>
    <div class="pr-bar" id="prBar"></div>`;
  document.body.appendChild(root);
  document.documentElement.style.overflow = "hidden";

  /* ------------------------------------------------------------- scene */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x0b0c0d, 1);
  root.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0c0d, 0.028);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);

  const g = fau();
  const S = 1.35;
  const nodes = g.nodes.map(p => new THREE.Vector3(p[0] * S, p[1] * S, p[2] * S));
  const ctr = nodes.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / nodes.length);
  nodes.forEach(p => p.sub(ctr));

  // framework edges, ordered outward from the centre so it assembles from the inside
  const segs = g.edges.slice().sort((a, b) =>
    nodes[a[0]].clone().add(nodes[a[1]]).length() - nodes[b[0]].clone().add(nodes[b[1]]).length());
  const lp = new Float32Array(segs.length * 6);
  segs.forEach(([i, j], k) => { nodes[i].toArray(lp, k * 6); nodes[j].toArray(lp, k * 6 + 3); });
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(lp, 3));
  lg.setDrawRange(0, 0);
  const latMat = new THREE.LineBasicMaterial({ color: 0xcfc9bb, transparent: true, opacity: 0.8 });
  const lattice = new THREE.LineSegments(lg, latMat);
  const world = new THREE.Group(); world.add(lattice); scene.add(world);

  const tGeo = new THREE.BufferGeometry().setFromPoints(nodes);
  const dotTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64;
    const x = c.getContext("2d"), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.85)");
    gr.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c); })();
  const tMat = new THREE.PointsMaterial({ size: 0.34, map: dotTex, color: 0xe9e3d6, transparent: true,
    opacity: 0, depthWrite: false });
  world.add(new THREE.Points(tGeo, tMat));

  // free hydrogen
  const N = 1500, sites = poreSites(g, 170, 1.3).map(p => new THREE.Vector3(p[0] * S, p[1] * S, p[2] * S).sub(ctr));
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = [];
  const cool = new THREE.Color(0x7fa7c9), hot = new THREE.Color(0xf06a3f);
  for (let i = 0; i < N; i++) {
    const r = 6 + Math.random() * 30, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.8, r * Math.sin(ph) * Math.sin(th)], i * 3);
    cool.toArray(col, i * 3);
    vel.push(new THREE.Vector3().randomDirection().multiplyScalar(0.05 + Math.random() * 0.06));
  }
  const hGeo = new THREE.BufferGeometry();
  hGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  hGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const hMat = new THREE.PointsMaterial({ size: 0.26, map: dotTex, vertexColors: true, transparent: true,
    opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const gas = new THREE.Points(hGeo, hMat);
  scene.add(gas);
  const captured = sites.map((s, k) => ({ i: k * 7 % N, to: s, from: null, t: 0 }));

  /* ------------------------------------------------------------ timeline */
  const $ = id => root.querySelector(id);
  let t0 = performance.now(), raf = 0, done = false, capturing = false, latOn = false, latT = 0;
  const fired = new Set();

  function beat(name) {
    if (name === "meta") root.querySelectorAll('[data-b="meta"]').forEach(e => e.style.opacity = 1);
    if (LINES[name]) {
      const el = $("#prLine");
      el.classList.remove("in");
      setTimeout(() => { el.innerHTML = LINES[name]; el.classList.add("in"); }, el.innerHTML ? 450 : 0);
    }
    if (name === "lattice") latOn = true;
    if (name === "capture") { capturing = true;
      captured.forEach(c => { c.from = new THREE.Vector3().fromArray(pos, c.i * 3); }); }
    if (name === "sub") $("#prSub").classList.add("in");
    if (name === "exit") finish();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000;
    for (const [at, name] of BEATS) if (t >= at && !fired.has(name)) { fired.add(name); beat(name); }
    $("#prBar").style.width = Math.min(t / BEATS.at(-1)[0], 1) * 100 + "%";

    hMat.opacity = Math.min(t / 1.6, 1) * 0.9;
    if (latOn) {
      latT = Math.min(latT + 1 / 150, 1);
      const e = 1 - Math.pow(1 - latT, 3);
      lg.setDrawRange(0, Math.floor(e * segs.length) * 2);
      tMat.opacity = e * 0.9;
    }
    // temperature falls toward the bath once the cage exists
    if (t > 3.4) {
      const k = Math.min((t - 3.4) / 4.2, 1), T = 298 - (298 - 195) * (1 - Math.pow(1 - k, 2));
      $("#prT").textContent = T.toFixed(0);
      const slow = 1 - 0.55 * k;
      vel.forEach(v => v.multiplyScalar(0.999 + 0.0 * slow));
    }

    // brownian motion for free gas
    const capSet = capturing ? new Set(captured.map(c => c.i)) : null;
    for (let i = 0; i < N; i++) {
      if (capSet && capSet.has(i)) continue;
      const v = vel[i];
      v.x += (Math.random() - 0.5) * 0.012; v.y += (Math.random() - 0.5) * 0.012; v.z += (Math.random() - 0.5) * 0.012;
      v.clampLength(0.02, 0.13);
      let x = pos[i * 3] + v.x, y = pos[i * 3 + 1] + v.y, z = pos[i * 3 + 2] + v.z;
      const r = Math.hypot(x, y, z);
      if (r > 38) { v.multiplyScalar(-1); }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    }
    if (capturing) {
      for (const c of captured) {
        c.t = Math.min(c.t + 0.006 + (c.i % 5) * 0.0008, 1);
        const e = 1 - Math.pow(1 - c.t, 3);
        const p = c.from.clone().lerp(c.to.clone().applyMatrix4(world.matrixWorld), e);
        p.toArray(pos, c.i * 3);
        cool.clone().lerp(hot, e).toArray(col, c.i * 3);
      }
      hGeo.attributes.color.needsUpdate = true;
    }
    hGeo.attributes.position.needsUpdate = true;

    world.rotation.y = t * 0.11; world.rotation.x = 0.35 + Math.sin(t * 0.2) * 0.05;
    const d = 46 - Math.min(t / 9, 1) * 16;
    camera.position.set(Math.sin(t * 0.05) * 4, 4 + t * 0.2, d);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize); resize();
  raf = requestAnimationFrame(frame);

  function onKey(e) { if (["Escape", "Enter", " "].includes(e.key)) { e.preventDefault(); finish(); } }
  addEventListener("keydown", onKey);
  $("#prSkip").onclick = finish;

  function finish() {
    if (done) return; done = true;
    try { sessionStorage.setItem("zm-preroll", "seen"); } catch {}
    removeEventListener("keydown", onKey);
    root.classList.add("out-start");
    requestAnimationFrame(() => { root.classList.add("out"); });
    onDone?.();
    setTimeout(() => {
      cancelAnimationFrame(raf); removeEventListener("resize", resize);
      scene.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      dotTex.dispose(); renderer.dispose(); root.remove();
      document.documentElement.style.overflow = "";
    }, 1150);
  }
  return { skip: finish };
}
