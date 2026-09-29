/* Framework geometry, built from the actual topologies rather than drawn by eye.
 *
 * Both zeolites are assembled from sodalite cages (truncated octahedra, vertices at the
 * permutations of (0, ±1, ±2), edge length √2):
 *   LTA (5A)  — cages on a simple cubic lattice, joined square-face to square-face by
 *               double 4-rings (cubes). Eight cages enclose the alpha cage.
 *   FAU (13X) — cages on a diamond lattice, joined hexagon-to-hexagon by double 6-rings
 *               (hexagonal prisms). Ten cages enclose the supercage.
 * The MOF is drawn as a schematic pcu net (metal nodes joined by aryl linkers). That is
 * MOF-5's real topology; HKUST-1 (tbo) and UiO-66 (fcu) are more complex, and the viewer
 * says so rather than implying crystallographic accuracy it does not have.
 *
 * Returns plain arrays so both the pre-roll and the pore viewer can build their own
 * meshes. Units are arbitrary; callers scale.
 */
const SQ2 = Math.SQRT2;

function truncatedOctahedron() {
  const v = [];
  const base = [[0, 1, 2]];
  const perms = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  for (const [a, b, c] of perms) {
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      const p = [0, 0, 0];
      p[a] = 0; p[b] = s1 * 1; p[c] = s2 * 2;
      const key = p.join(",");
      if (!v.some(q => q.join(",") === key)) v.push(p);
    }
  }
  const e = [];
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
    const d = (v[i][0]-v[j][0])**2 + (v[i][1]-v[j][1])**2 + (v[i][2]-v[j][2])**2;
    if (Math.abs(d - 2) < 1e-9) e.push([i, j]);
  }
  void base;
  return { v, e };           // 24 vertices, 36 edges
}

function merge(nodes, edges, keyFn = p => p.map(x => x.toFixed(4)).join(",")) {
  const idx = new Map(), out = [], seg = [], seen = new Set();
  const id = p => { const k = keyFn(p); if (!idx.has(k)) { idx.set(k, out.length); out.push(p); } return idx.get(k); };
  for (const [a, b] of edges) {
    const i = id(a), j = id(b);
    const k = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (i !== j && !seen.has(k)) { seen.add(k); seg.push([i, j]); }
  }
  void nodes;
  return { nodes: out, edges: seg };
}

const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const near = (a, b) => Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]) < 1e-6;

/** LTA: 2×2×2 sodalite cages around one alpha cage. */
export function lta() {
  const TO = truncatedOctahedron();
  const a = 4 + SQ2;                               // cage spacing
  const centers = [];
  for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1])
    centers.push([x * a - a / 2, y * a - a / 2, z * a - a / 2]);
  const edges = [];
  for (const c of centers) for (const [i, j] of TO.e) edges.push([add(c, TO.v[i]), add(c, TO.v[j])]);
  // double 4-rings: join square-face vertices of neighbouring cages
  for (let i = 0; i < centers.length; i++) for (let j = i + 1; j < centers.length; j++) {
    const d = centers[j].map((x, k) => x - centers[i][k]);
    const axis = d.findIndex(x => Math.abs(x) > 1e-6);
    if (d.filter(x => Math.abs(x) > 1e-6).length !== 1) continue;
    const sgn = Math.sign(d[axis]);
    for (const p of TO.v) if (Math.abs(p[axis] - 2 * sgn) < 1e-9) {
      const q = p.slice(); q[axis] = -2 * sgn;
      edges.push([add(centers[i], p), add(centers[j], q)]);
    }
  }
  const g = merge(null, edges);
  return { ...g, cages: [[0, 0, 0]], cageRadius: 3.6, name: "LTA", label: "LTA · alpha cage (11.4 Å) framed by eight sodalite cages" };
}

/** FAU: sodalite cages on a diamond lattice, joined by hexagonal prisms. */
export function fau() {
  const TO = truncatedOctahedron();
  const delta = Math.sqrt(2 / 3);
  const step = 2 + delta;                          // per-axis offset between joined cages
  const dirsA = [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
  const cages = [{ c: [0,0,0], type: 0 }];
  // Four cages around a central one, then one more shell outward on two branches:
  // enough to close a supercage without drowning it.
  const frontier = [cages[0]];
  for (let depth = 0; depth < 2; depth++) {
    const next = [];
    for (const n of frontier) {
      const dirs = n.type === 0 ? dirsA : dirsA.map(d => d.map(x => -x));
      for (const d of dirs) {
        const c = add(n.c, d.map(x => x * step));
        if (cages.some(q => near(q.c, c))) continue;
        const nn = { c, type: 1 - n.type };
        cages.push(nn); next.push(nn);
      }
    }
    frontier.length = 0;
    frontier.push(...next.filter(n => n.c[0] + n.c[1] + n.c[2] > -0.1));
  }
  const edges = [];
  for (const { c } of cages) for (const [i, j] of TO.e) edges.push([add(c, TO.v[i]), add(c, TO.v[j])]);
  // double 6-rings between joined cages
  for (let i = 0; i < cages.length; i++) for (let j = i + 1; j < cages.length; j++) {
    const d = cages[j].c.map((x, k) => x - cages[i].c[k]);
    if (!d.every(x => Math.abs(Math.abs(x) - step) < 1e-6)) continue;
    const s = d.map(Math.sign);
    for (const p of TO.v) {
      if (p[0] * s[0] + p[1] * s[1] + p[2] * s[2] !== 3) continue;   // hexagonal face toward j
      edges.push([add(cages[i].c, p), add(cages[i].c, p.map((x, k) => x + s[k] * delta))]);
    }
  }
  const g = merge(null, edges);
  // Supercage centres sit in the voids of the cage network; locate them as points far
  // from every framework node.
  return { ...g, cages: null, cageRadius: 4.2, name: "FAU",
           label: "FAU · supercage (11.8 Å) enclosed by sodalite cages and hexagonal prisms" };
}

/** Schematic MOF: pcu net of metal nodes and aryl linkers. */
export function mof(n = 3) {
  const a = 6;
  const nodes = [], edges = [], rings = [];
  const off = (n - 1) * a / 2;
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++)
    nodes.push([x * a - off, y * a - off, z * a - off]);
  const idx = (x, y, z) => (x * n + y) * n + z;
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) {
    const here = nodes[idx(x, y, z)];
    for (const [dx, dy, dz] of [[1,0,0],[0,1,0],[0,0,1]]) {
      if (x + dx >= n || y + dy >= n || z + dz >= n) continue;
      const there = nodes[idx(x + dx, y + dy, z + dz)];
      edges.push([here, there]);
      rings.push({ at: here.map((v, k) => (v + there[k]) / 2), axis: [dx, dy, dz] });
    }
  }
  const g = merge(null, edges);
  return { ...g, metals: nodes, rings, cageRadius: 2.2, name: "MOF",
           label: "Schematic pcu net — metal nodes joined by aryl linkers" };
}

/** Candidate H2 sites: points inside the pore volume, clear of every framework node. */
export function poreSites(geom, count, clearance, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pts = geom.nodes;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  const pad = 0.6, out = [];
  const c2 = clearance * clearance;
  let tries = 0;
  while (out.length < count && tries < count * 400) {
    tries++;
    const q = [0, 1, 2].map(k => lo[k] + pad + rnd() * (hi[k] - lo[k] - 2 * pad));
    let ok = true;
    for (const p of pts) {
      const d = (p[0]-q[0])**2 + (p[1]-q[1])**2 + (p[2]-q[2])**2;
      if (d < c2) { ok = false; break; }
    }
    if (ok && !out.some(o => (o[0]-q[0])**2 + (o[1]-q[1])**2 + (o[2]-q[2])**2 < 0.55)) out.push(q);
  }
  // fill order: nearest the framework first, as adsorption does
  const dmin = q => Math.min(...pts.map(p => (p[0]-q[0])**2 + (p[1]-q[1])**2 + (p[2]-q[2])**2));
  out.sort((a, b) => dmin(a) - dmin(b));
  return out;
}

export const FRAMEWORKS = { "13X": fau, "5A": lta, MOF: mof };
