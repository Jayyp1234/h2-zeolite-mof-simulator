/* Inside-the-pore viewer.
 *
 * Draws the framework from lattice.js in a crystallographer's register (ink bonds,
 * T-atoms as small beads, on paper) and fills its pore volume with H2 molecules. The
 * number drawn is the model's fractional filling, n(T, P) / n_sat, applied to a fixed
 * set of pore sites — so moving from 77 K to 195 K empties the cage by exactly the
 * factor the physics predicts. Sites fill nearest-to-wall first, as adsorption does.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FRAMEWORKS, poreSites } from "./lattice.js";

const INK = 0x2b2721, H2 = 0xc4401a;
const METAL = { "HKUST-1": 0x2f6f96, "UiO-66": 0x8b8f97, "MOF-5": 0x6f879c };
const SITES = 150;

export function createPoreView(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 500);
  camera.position.set(22, 13, 26);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.autoRotate = true; controls.autoRotateSpeed = 0.55;
  controls.minDistance = 10; controls.maxDistance = 70;
  renderer.domElement.addEventListener("pointerdown", () => { controls.autoRotate = false; });

  scene.add(new THREE.HemisphereLight(0xfffdf6, 0xb8b1a1, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(10, 18, 12); scene.add(key);

  let group = null, mols = null, sites = [], frac = 0, temp = 195, t0 = performance.now();
  const jitter = [];

  function clear() {
    if (!group) return;
    scene.remove(group);
    group.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    group = null; mols = null;
  }

  function build(kind, mofKey) {
    clear();
    group = new THREE.Group(); scene.add(group);
    const geom = FRAMEWORKS[kind]();
    const nodes = geom.nodes.map(p => new THREE.Vector3(...p));
    const c = nodes.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / nodes.length);
    nodes.forEach(p => p.sub(c));

    if (kind === "MOF") {
      const metalMat = new THREE.MeshStandardMaterial({ color: METAL[mofKey] || 0x2f6f96, roughness: 0.45, metalness: 0.35 });
      const oct = new THREE.OctahedronGeometry(0.72);
      const mm = new THREE.InstancedMesh(oct, metalMat, nodes.length);
      const m4 = new THREE.Matrix4();
      nodes.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); mm.setMatrixAt(i, m4); });
      group.add(mm);
      const rodMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.7 });
      const ringMat = new THREE.LineBasicMaterial({ color: INK });
      for (const [i, j] of geom.edges) {
        const a = nodes[i], b = nodes[j], mid = a.clone().add(b).multiplyScalar(0.5);
        const dir = b.clone().sub(a), len = dir.length();
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, len - 1.5, 8), rodMat);
        rod.position.copy(mid);
        rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        group.add(rod);
        // aryl ring, perpendicular-ish to the linker so it reads as a benzene
        const pts = [];
        for (let k = 0; k <= 6; k++) { const a2 = k / 6 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a2) * 0.62, Math.sin(a2) * 0.62, 0)); }
        const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
        ring.position.copy(mid);
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(dir.y, dir.z, dir.x).normalize());
        group.add(ring);
      }
    } else {
      const lp = new Float32Array(geom.edges.length * 6);
      geom.edges.forEach(([i, j], k) => { nodes[i].toArray(lp, k * 6); nodes[j].toArray(lp, k * 6 + 3); });
      const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(lp, 3));
      group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.78 })));
      const bead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8),
        new THREE.MeshStandardMaterial({ color: INK, roughness: 0.55 }), nodes.length);
      const m4 = new THREE.Matrix4();
      nodes.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); bead.setMatrixAt(i, m4); });
      group.add(bead);
    }

    sites = poreSites(geom, SITES, kind === "MOF" ? 1.15 : 1.3)
      .map(p => new THREE.Vector3(...p).sub(c));
    jitter.length = 0;
    for (let i = 0; i < sites.length; i++)
      jitter.push({ ph: Math.random() * 6.28, q: new THREE.Quaternion().random(), f: 0.6 + Math.random() * 0.8 });

    // H2 as a dumbbell: two spheres 0.74 Å apart, scaled into scene units
    const a = new THREE.SphereGeometry(0.2, 12, 10); a.translate(0, 0.19, 0);
    const b = new THREE.SphereGeometry(0.2, 12, 10); b.translate(0, -0.19, 0);
    const dumbbell = mergeGeometries([a, b]);
    mols = new THREE.InstancedMesh(dumbbell,
      new THREE.MeshStandardMaterial({ color: H2, roughness: 0.35, emissive: H2, emissiveIntensity: 0.15 }), sites.length);
    mols.count = 0;
    group.add(mols);

    const r = nodes.reduce((m, p) => Math.max(m, p.length()), 0);
    controls.target.set(0, 0, 0);
    camera.position.setLength(r * 3.35);
    return geom;
  }

  function mergeGeometries(list) {
    const pos = [], nrm = [], idx = [];
    let off = 0;
    for (const g of list) {
      const p = g.attributes.position.array, n = g.attributes.normal.array, ix = g.index.array;
      pos.push(...p); nrm.push(...n); for (const i of ix) idx.push(i + off);
      off += p.length / 3;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    out.setIndex(idx);
    return out;
  }

  const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1), q = new THREE.Quaternion();
  let raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (mols) {
      const n = Math.max(0, Math.min(sites.length, Math.round(frac * sites.length)));
      mols.count = n;
      const t = (now - t0) / 1000, amp = 0.05 + temp / 195 * 0.13;   // thermal motion scales with T
      for (let i = 0; i < n; i++) {
        const j = jitter[i];
        v.copy(sites[i]);
        v.x += Math.sin(t * 3.1 * j.f + j.ph) * amp;
        v.y += Math.sin(t * 2.7 * j.f + j.ph * 1.3) * amp;
        v.z += Math.cos(t * 2.9 * j.f + j.ph * 0.7) * amp;
        q.copy(j.q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t * j.f * 1.6));
        m4.compose(v, q, s1); mols.setMatrixAt(i, m4);
      }
      mols.instanceMatrix.needsUpdate = true;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  function resize() {
    const w = host.clientWidth || 600, h = host.clientHeight || 400;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(host); resize();
  raf = requestAnimationFrame(frame);

  return {
    setFramework(kind, mofKey) { return build(kind, mofKey); },
    setLoading(f, T) { frac = Math.max(0, Math.min(1, f)); temp = T; },
    siteCount: () => sites.length,
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); clear(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
