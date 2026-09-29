/* Zeolite × MOF — a ten-chapter guided simulator.
 *
 * Every chapter headline is computed from the live model, so the story the page tells
 * changes when the parameters do. Physics lives in physics.js (shared with the Python
 * engine and cross-checked by engine/parity_check.py); this file is presentation only.
 */
import { lineChart } from "./charts.js";
import { createPoreView } from "./pore3d.js";
import { createVesselView } from "./vessel3d.js";
import { playPreroll, shouldPlay } from "./preroll.js";

const MC = window.MODEL_CONSTANTS;
const PH = window.H2Physics.make(MC);
const K = MC.constants, P_ALL = K.PRESSURES;

/* ------------------------------------------------------------------ state */
const DEF = MC.defaults;
const fresh = () => ({
  qst: DEF.q_st, qstMof: DEF.q_st_mof, mof: DEF.mof, model: DEF.isotherm_model,
  basis: DEF.basis, approach: DEF.composite_approach, T: DEF.temperature, pMax: 10,
});
const S = { ch: 0, unit: "mg_per_g", ranOnce: false, ...fresh() };

const RUN_COLOR = { 1: "#1d3557", 2: "#4f7ea8", 3: "#6e5327", 4: "#b08a4e",
                    5: "#8f2d16", 6: "#c4401a", 7: "#1f5f5b", 8: "#5a9a8a" };
const MOF_COLOR = { "HKUST-1": "#2f6f96", "UiO-66": "#8a8579", "MOF-5": "#6a7f94" };
const MOF_BED   = { "HKUST-1": 0x2f6f96, "UiO-66": 0xe9e6de, "MOF-5": 0xf1efe8 };

/* ---------------------------------------------------------------- helpers */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Material names like HKUST-1 must never wrap at the hyphen: use a non-breaking one.
const nb = s => esc(s).replace(/-/g, "\u2011");
const f = (v, d = 3) => Number(v).toFixed(d);
const pct = (v, d = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(d)}%`;
const U = () => S.unit === "mg_per_g" ? { k: "mg_per_g", s: "mg/g", l: "mg H₂ per g adsorbent", d: 3 }
                                     : { k: "wt_pct", s: "wt%", l: "wt% H₂", d: 4 };
const last = a => a[a.length - 1];
const matrix = (s = S) => PH.runMatrix(s);
const leader = m => m.reduce((a, b) => last(b.wt_pct) > last(a.wt_pct) ? b : a);
const byRun = (m, n) => m.find(r => r.run === n);
const mof = () => MC.mofs[S.mof];
const mofQ = () => PH.mofQst(S);
const mofGain = (s = S) => { const m = matrix(s); return last(byRun(m, 6).wt_pct) / last(byRun(m, 2).wt_pct) - 1; };
const short = r => r.label.replace(" (plain)", "").replace("Granular", "gran.").replace("Powder", "powder");

/* ---------------------------------------------------------------- chapters */
const CH = [
  { id: "question",    t: "The question",    s: "What we are predicting" },
  { id: "materials",   t: "The materials",   s: "Inside the cages" },
  { id: "mof",         t: "The MOF",         s: "An unnamed material" },
  { id: "rig",         t: "The rig",         s: "Vessel and bath" },
  { id: "gate",        t: "The 77 K gate",   s: "Benchmark check" },
  { id: "run",         t: "The run",         s: "Forty points" },
  { id: "isotherms",   t: "The isotherms",   s: "Master table" },
  { id: "effect",      t: "The MOF effect",  s: "Does it help?" },
  { id: "uncertainty", t: "The uncertainty", s: "What decides it" },
  { id: "verdict",     t: "The verdict",     s: "Chapter 4" },
];

let mounted = [];                 // disposers for the current chapter
const onLeave = fn => mounted.push(fn);

function kicker(i) { return `<div class="kicker">Chapter ${String(i + 1).padStart(2, "0")} — ${CH[i].t}</div>`; }
function section(title, note, body) {
  return `<section class="section"><h2>${title}${note ? `<span>${note}</span>` : ""}</h2>${body}</section>`;
}
function aside(tag, html, quiet) {
  return `<div class="aside${quiet ? " quiet" : ""}">${tag ? `<span class="dev">${tag}</span>` : ""}${html}</div>`;
}

/* =========================================================== 01 question */
function chQuestion() {
  const m = matrix(), L = leader(m), g = mofGain(), u = U();
  const sb = PH.storageBalance(last(L.wt_pct), 10, S.T);
  return `${kicker(0)}
  <h1 class="head">How much hydrogen can a zeolite–MOF bed hold at the temperature of <em>dry ice</em>?</h1>
  <p class="dek">A 90&nbsp;g bed of zeolite, blended with 15&nbsp;wt% metal-organic framework, chilled to
    195&nbsp;K in dry ice and acetone and pressurised with hydrogen to 10&nbsp;bar. Eight material
    configurations. This simulator predicts what each one holds — and shows exactly where the
    specification's assumptions, rather than the materials, decide the answer.</p>

  <div class="section big g4 grid" style="gap:0">
    <div><div class="n">8</div><div class="l">material configurations — two zeolites, two forms, with and without MOF</div></div>
    <div><div class="n">5</div><div class="l">pressure points, 1 to 10&nbsp;bar, per configuration</div></div>
    <div><div class="n">195<small>K</small></div><div class="l">dry-ice / acetone bath, held fixed by the specification</div></div>
    <div><div class="n">90<small>g</small></div><div class="l">bed per run: 76.5&nbsp;g zeolite, 13.5&nbsp;g MOF</div></div>
  </div>

  <div class="grid g-5-7 section" style="align-items:start">
    <div>${section("The test matrix", "spec §4", `
      ${cube()}
      <p class="body-copy" style="margin-top:12px">Each corner is one run. The three axes are the three
        choices the experiment varies; every run number matches Chapters 3 and 4 of the thesis.</p>`)}</div>
    <div>${section("The short answer", "live", `
      <div class="grid g3" style="gap:22px">
        <div class="stat"><div class="n acc">${f(last(L[u.k]), u.d)}</div>
          <div class="l">${u.s} at 10&nbsp;bar — the best configuration, <b>Run&nbsp;${L.run}</b>, ${esc(L.label)}</div></div>
        <div class="stat"><div class="n">${pct(g)}</div>
          <div class="l">what adding ${esc(S.mof)} does to 13X powder, blended as a physical mixture</div></div>
        <div class="stat"><div class="n">${f(sb.frac * 100, 0)}%</div>
          <div class="l">of the hydrogen in the vessel is held by adsorption; the rest is ordinary compressed gas</div></div>
      </div>
      <div style="margin-top:26px">${aside("How to read this", `This is the specification's
        <b>second-choice route</b> (§1.2): a calibrated analytical model, not Grand Canonical Monte Carlo.
        It is fitted to published 77&nbsp;K data and carried to 195&nbsp;K by thermodynamics. Every place it
        departs from the specification is tagged <b>SPEC-DEV</b> and explained where it matters.`, true)}</div>
      <div style="margin-top:26px;display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn" data-go="1">Begin <span class="arr">→</span></button>
        <button class="btn ghost" data-replay>Replay the intro</button>
      </div>`)}</div>
  </div>`;
}

function cube() {
  // Oblique (cabinet) projection. Isometric is degenerate here: it puts Run 6 exactly
  // behind Run 3. Front face = plain runs, back face = MOF runs, depth = composite.
  const Lx = 150, D = 96, ang = Math.PI / 5, ox = 70, oy = 262;
  const P = (a, b, c) => [ox + a * Lx + c * D * Math.cos(ang), oy - b * Lx - c * D * Math.sin(ang)];
  const C = [];
  for (const zeo of [0, 1]) for (const form of [0, 1]) for (const comp of [0, 1])
    C.push({ run: 1 + form + 2 * zeo + 4 * comp, a: form, b: 1 - zeo, c: comp });
  const at = c => P(c.a, c.b, c.c);
  const hidden = c => c.a === 0 && c.b === 0 && c.c === 1;          // back-bottom-left
  let edges = "";
  for (const u of C) for (const v of C) {
    if (u.run >= v.run) continue;
    const diff = (u.a !== v.a) + (u.b !== v.b) + (u.c !== v.c);
    if (diff !== 1) continue;
    const [x1, y1] = at(u), [x2, y2] = at(v);
    const dash = hidden(u) || hidden(v);
    edges += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${dash ? "var(--rule-2)" : "var(--ink-2)"}"
      stroke-width="1" ${dash ? 'stroke-dasharray="3 4"' : ""}/>`;
  }
  const back = [P(0, 1, 1), P(1, 1, 1), P(1, 0, 1)], front = [P(0, 1, 0), P(1, 1, 0), P(1, 0, 0), P(0, 0, 0)];
  const poly = (pts, fill) => `<polygon points="${pts.map(p => p.join(",")).join(" ")}" fill="${fill}"/>`;
  const t = (x, y, txt, anchor = "middle", col = "var(--ink-3)") =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" style="font:500 10.5px var(--mono);letter-spacing:.05em;fill:${col}">${txt}</text>`;
  const dots = C.sort((a, b) => b.c - a.c).map(c => { const [x, y] = at(c);
    return `<circle cx="${x}" cy="${y}" r="15" fill="var(--paper)" stroke="${RUN_COLOR[c.run]}" stroke-width="1.7"/>
      <text x="${x}" y="${y + 4.5}" text-anchor="middle" style="font:500 13px var(--mono);fill:${RUN_COLOR[c.run]}">${c.run}</text>`; }).join("");
  const [fx0, fy0] = P(0, 0, 0), [fx1] = P(1, 0, 0), [, fyT] = P(0, 1, 0), [bx, by] = P(0.5, 1, 1);
  return `<svg viewBox="0 0 340 300" style="width:100%;max-width:440px;display:block;overflow:visible" role="img"
      aria-label="Test matrix: runs 1 to 4 plain on the front face, runs 5 to 8 with MOF on the back">
    ${poly([...front], "rgba(22,20,15,.035)")}${poly([back[0], back[1], back[2], P(1, 0, 0), P(1, 1, 0), P(0, 1, 0)], "rgba(196,64,26,.045)")}
    ${edges}${dots}
    ${t(fx0, fy0 + 36, "GRANULAR")}${t(fx1, fy0 + 36, "POWDER")}
    ${t(fx0 - 26, fyT + 4, "13X", "end")}${t(fx0 - 26, fy0 + 4, "5A", "end")}
    ${t(bx, by - 26, "+ 15 wt% MOF", "middle", "var(--accent)")}
  </svg>`;
}

/* ========================================================== 02 materials */
const viewer = { kind: "13X", T: 195, P: 10 };
function chMaterials() {
  return `${kicker(1)}
  <h1 class="head">Three porous solids, <em>three kinds of cage</em>.</h1>
  <p class="dek">Hydrogen is stored by clinging to the inside walls of a crystal's pores. How much sticks depends
    on how much wall there is, how tightly it binds, and — above all — how cold it is. Switch the temperature
    below from 77&nbsp;K to the bath's 195&nbsp;K and watch the cage empty.</p>

  <div class="grid g-8-4 section" style="align-items:start">
    <div>
      <div class="ctl">
        <div class="seg" id="vwKind">
          <button data-k="13X">13X · FAU</button><button data-k="5A">5A · LTA</button><button data-k="MOF">MOF</button>
        </div>
        <div class="seg" id="vwT"><button data-t="77">77 K</button><button data-t="195">195 K</button></div>
        <label>Pressure <input type="range" id="vwP" min="1" max="10" step="0.5" value="${viewer.P}"> <span class="num" id="vwPv"></span></label>
      </div>
      <figure class="fig" style="margin:0">
        <div class="viewport" id="poreHost">
          <div class="hud" id="poreHud"></div>
          <div class="hud hud-r" id="poreHud2"></div>
          <div class="hud hud-b" style="color:var(--ink-3)">drag to rotate · scroll to zoom</div>
        </div>
        <figcaption id="poreCap"></figcaption>
      </figure>
    </div>
    <div id="matProps"></div>
  </div>`;
}
function mountMaterials() {
  const host = document.getElementById("poreHost");
  const pv = createPoreView(host);
  onLeave(() => pv.dispose());
  const apply = (rebuild) => {
    if (rebuild) pv.setFramework(viewer.kind, S.mof);
    document.querySelectorAll("#vwKind button").forEach(b => b.classList.toggle("on", b.dataset.k === viewer.kind));
    document.querySelectorAll("#vwT button").forEach(b => b.classList.toggle("on", +b.dataset.t === viewer.T));
    document.getElementById("vwPv").textContent = `${f(viewer.P, 1)} bar`;
    let wt, sat, name, sub;
    if (viewer.kind === "MOF") {
      const m = mof(); wt = PH.mofUptake(S.mof, viewer.T, viewer.P, mofQ()); sat = m.q_max_77;
      name = m.label; sub = `${m.topology} net · q<sub>st</sub> ${f(mofQ(), 1)} kJ/mol`;
    } else {
      wt = PH.uptake(viewer.kind, viewer.T, viewer.P, S.qst, S.model); sat = MC.fits[S.model][viewer.kind].params.n_sat;
      name = MC.materials[viewer.kind].label; sub = `${MC.materials[viewer.kind].framework} · q<sub>st</sub> ${f(S.qst, 1)} kJ/mol`;
    }
    const frac = wt / sat, n = Math.round(frac * pv.siteCount());
    pv.setLoading(frac, viewer.T);
    document.getElementById("poreHud").innerHTML = `<b>${esc(name)}</b><br>${sub}`;
    document.getElementById("poreHud2").innerHTML =
      `<b style="font-size:22px;letter-spacing:-.03em">${f(wt, viewer.T === 77 ? 3 : 4)}</b> wt%<br>${f(frac * 100, frac < 0.1 ? 2 : 1)}% of saturation<br>${n} of ${pv.siteCount()} sites drawn`;
    const other = viewer.kind === "MOF" ? PH.mofUptake(S.mof, viewer.T === 77 ? 195 : 77, viewer.P, mofQ())
                                        : PH.uptake(viewer.kind, viewer.T === 77 ? 195 : 77, viewer.P, S.qst, S.model);
    const ratio = viewer.T === 77 ? other / wt : wt / other;
    document.getElementById("poreCap").innerHTML = `<b>Filling is drawn to scale.</b> Each molecule is one of
      ${pv.siteCount()} pore sites, filled wall-first; the number shown is the model's fractional loading.
      At ${f(viewer.P, 1)} bar this material holds <b>${f(ratio * 100, 1)}%</b> as much hydrogen at 195&nbsp;K as at 77&nbsp;K.
      ${viewer.kind === "MOF" ? `The MOF is drawn as a schematic pcu net — MOF-5's real topology. ${esc(S.mof)}'s own
      (${esc(mof().topology)}) is more complex; this view is illustrative, not crystallographic.` :
      `The framework is built from its real topology: sodalite cages ${viewer.kind === "13X" ? "on a diamond lattice joined by hexagonal prisms" : "on a cubic lattice joined by double four-rings"}.`}`;
    document.getElementById("matProps").innerHTML = props(viewer.kind);
  };
  document.querySelectorAll("#vwKind button").forEach(b => b.onclick = () => { viewer.kind = b.dataset.k; apply(true); });
  document.querySelectorAll("#vwT button").forEach(b => b.onclick = () => { viewer.T = +b.dataset.t; apply(false); });
  document.getElementById("vwP").oninput = e => { viewer.P = +e.target.value; apply(false); };
  apply(true);
}
function props(kind) {
  let rows;
  if (kind === "MOF") {
    const m = mof();
    rows = [["Material", m.label], ["Formula", m.formula], ["Topology", m.topology],
            ["BET surface", `${m.bet_area} m²/g`], ["Micropore volume", `${m.micropore_volume} cm³/g`],
            ["Crystal density", `${m.true_density} g/cm³`], ["Main pore", `${m.pore_width} Å`],
            ["q_st (literature)", `${m.q_st} kJ/mol`], ["Saturation, 77 K", `${m.q_max_77} wt%`]];
  } else {
    const m = MC.materials[kind], fit = MC.fits[S.model][kind];
    rows = [["Material", m.label], ["Framework", m.framework], ["BET surface", `${m.bet_area} m²/g`],
            ["Micropore volume", `${m.micropore_volume} cm³/g`], ["Crystal density", `${m.crystal_density} g/cm³`],
            ["Pore aperture", kind === "13X" ? "7.4 Å" : "4.2 Å"], ["Cage", kind === "13X" ? "11.8 Å supercage" : "11.4 Å alpha cage"],
            ["Fitted saturation", `${f(fit.params.n_sat, 3)} wt%`], ["Fit error vs Langmi", `${f(fit.max_abs_error_pct, 2)}% max`]];
  }
  return section("Properties", kind === "MOF" ? "candidate, see ch. 03" : "spec §2",
    `<div class="tbl"><table>${rows.map(([k, v]) => `<tr><td class="l" style="color:var(--ink-2)">${k}</td><td>${v}</td></tr>`).join("")}</table></div>`);
}

/* ================================================================ 03 MOF */
function chMof() {
  const crit = Object.entries(MC.mof_spec);
  const LABEL = { bet_area: "BET surface area", micropore_volume: "Micropore volume", true_density: "True density",
                  q_st: "Isosteric heat", pore_width: "Effective pore width" };
  const critTxt = ([k, [op, lim, unit]]) => op === "in" ? `${lim[0]}–${lim[1]} ${unit}` : `${op === ">=" ? "≥" : ">"} ${lim} ${unit}`;
  const cards = Object.values(MC.mofs).map(m => {
    const c = m.compliance;
    return `<button class="cand${m.key === S.mof ? " on" : ""}" data-mof="${m.key}">
      <h3>${esc(m.key)}</h3><div class="f">${esc(m.formula)} · ${esc(m.topology)}</div>
      <div class="score">${c._passed}<small>/ ${c._total} criteria</small></div>
      <div class="dots">${crit.map(([k]) => `<i class="${c[k].pass ? "p" : ""}" title="${LABEL[k]}"></i>`).join("")}</div>
    </button>`;
  }).join("");
  const rows = crit.map(e => {
    const [k] = e;
    return `<tr><td class="l">${LABEL[k]}</td><td class="l" style="color:var(--ink-3)">${critTxt(e)}</td>
      ${Object.values(MC.mofs).map(m => { const c = m.compliance[k];
        return `<td>${c.value} <span class="tag ${c.pass ? "ok" : "bad"}">${c.pass ? "pass" : "fail"}</span></td>`; }).join("")}</tr>`;
  }).join("");
  const fails = Object.values(MC.mofs).filter(m => m.compliance._passed < m.compliance._total).length;
  return `${kicker(2)}
  <h1 class="head">The specification never names the MOF. <em>${fails === 3 ? "None of the obvious candidates meets it." : "Most candidates fail it."}</em></h1>
  <p class="dek">Section 2.3 gives five property ranges and stops. But the MOF decides more of this answer than
    any other input — so three well-characterised candidates are carried, each tested against the specification's
    own criteria. Choose one; every chapter after this uses it.</p>
  ${section("Candidates", "click to select", `<div class="cands">${cards}</div>`)}
  <div class="grid g2 section" style="align-items:start">
    <div>${section("Against spec §2.3", "", `<div class="tbl"><table>
      <tr><th class="l">Criterion</th><th class="l">Spec</th>${Object.keys(MC.mofs).map(k => `<th>${k}</th>`).join("")}</tr>${rows}</table></div>
      <div style="margin-top:18px">${aside("SPEC-DEV-6", `<b>Name the MOF.</b> HKUST-1 and MOF-5 are lighter than the density range;
        UiO-66 falls short on surface area; none has a representative q<sub>st</sub> strictly above 7&nbsp;kJ/mol.
        Values are representative literature figures — confirm against the cited sources before submission.`)}</div>`)}</div>
    <div>${section("On their own at 195 K", `q<sub>st</sub> per candidate`, `<div id="mofChart"></div>
      <div style="margin-top:14px">${aside("SPEC-DEV-7", `Section 8 calls the MOF "amorphous, no CIF available", contradicting
        §2.3's "crystalline periodic framework". MOFs are crystalline by definition; structure files are in the CoRE MOF database.`, true)}</div>`)}</div>
  </div>
  ${section("Sources", "", `<div class="tbl"><table>${Object.values(MC.mofs).map(m =>
    `<tr><td class="l" style="width:110px">${m.key}</td><td class="l" style="color:var(--ink-2);white-space:normal">${esc(m.source)}</td></tr>`).join("")}</table></div>`)}`;
}
function mountMof() {
  document.querySelectorAll(".cand").forEach(b => b.onclick = () => { S.mof = b.dataset.mof; S.qstMof = null; render(); });
  const P = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const series = Object.values(MC.mofs).map(m => ({
    label: m.key, color: MOF_COLOR[m.key], width: m.key === S.mof ? 2.6 : 1.4, opacity: m.key === S.mof ? 1 : 0.55,
    x: P, y: P.map(p => PH.mofUptake(m.key, S.T, p, m.q_st)), dots: false,
  }));
  series.push({ label: "13X alone", color: "var(--ink)", dash: "4 3", x: P, y: P.map(p => PH.uptake("13X", S.T, p, S.qst, S.model)), dots: false });
  const c = lineChart(series, { width: 600, xLabel: "pressure, bar", yLabel: "wt% H₂ at 195 K", height: 380, labelWidth: 130, xTicks: [1, 2, 4, 6, 8, 10], xMin: 1 });
  document.getElementById("mofChart").innerHTML = c.html; c.mount();
}

/* ================================================================ 04 rig */
function chRig() {
  const v = MC.vessel;
  return `${kicker(3)}
  <h1 class="head">A <span class="v">${f(v.total_cm3, 0)} cm³</span> steel tube, standing in <em>dry ice</em>.</h1>
  <p class="dek">V-101 is a 50&nbsp;mm bore, 250&nbsp;mm stainless tube. Retainer screens hold the bed; a
    30&nbsp;mm space sits empty at each end. It stands in dry ice and acetone at 195&nbsp;K, and is heated
    with the bath removed to release the hydrogen again.</p>
  <div class="grid g-8-4 section" style="align-items:start">
    <figure class="fig" style="margin:0">
      <div class="viewport" id="rigHost" style="aspect-ratio:4/3.6"></div>
      <div class="ctl" style="margin-top:12px">
        <div class="seg" id="rigCut"><button class="on" data-c="1">Cutaway</button><button data-c="0">Closed</button></div>
        <button class="btn ghost" id="rigReset" style="padding:8px 13px">Reset view</button>
        <button class="btn ghost" id="rigShot" style="padding:8px 13px">Save PNG</button>
      </div>
      <figcaption>Built to the P&amp;ID's dimensions. Bed particles are drawn at the 85:15 ratio —
        ${S.mof === "HKUST-1" ? "HKUST-1 is genuinely blue, from its copper paddlewheels" : `${esc(S.mof)} is pale`} —
        and hydrogen moves through the inlet into the bed. Particle counts are illustrative; the real bed holds ~10²² molecules.</figcaption>
    </figure>
    <div>${section("Geometry", "recomputed", `<div class="tbl"><table>
      <tr><th class="l"></th><th>Model</th><th>Spec §3</th></tr>
      <tr><td class="l">Internal volume</td><td>${f(v.total_cm3, 1)} cm³</td><td style="color:var(--bad)">484</td></tr>
      <tr><td class="l">Dead space, per end</td><td>${f(v.dead_per_end_cm3, 1)} cm³</td><td style="color:var(--bad)">30</td></tr>
      <tr><td class="l">Dead space, total</td><td>${f(v.dead_total_cm3, 1)} cm³</td><td style="color:var(--bad)">60</td></tr>
      <tr><td class="l">Active bed</td><td>${f(v.active_bed_cm3, 1)} cm³</td><td>364</td></tr>
      <tr><td class="l">Bed void fraction</td><td>${v.void_fraction}</td><td>0.38</td></tr></table></div>
      <div style="margin-top:18px">${aside("SPEC-DEV-5", `π × (25&nbsp;mm)² × 250&nbsp;mm is ${f(v.total_cm3, 1)}&nbsp;cm³, not 484.
        The spec labels dead volume "60&nbsp;cm³ (30&nbsp;cm³ × 2)" but subtracts 120 to reach 364. A 30&nbsp;mm end
        space at 50&nbsp;mm bore is ${f(v.dead_per_end_cm3, 1)}&nbsp;cm³ <em>per end</em>.`)}</div>`)}</div>
  </div>`;
}
function mountRig() {
  const host = document.getElementById("rigHost");
  const vv = createVesselView(host, {
    dims: { innerDiaMm: 50, lengthMm: 250, wallMm: 4, deadSpaceMm: 30, showCarbon: true,
            carbonFraction: MC.factors.mof_fraction, secondColor: MOF_BED[S.mof], heatingTape: true },
    background: 0xf3f0e8, bedLabel: `Bed · zeolite + 15 wt% ${S.mof}`, bathLabel: "CB-101 · dry ice + acetone, 195 K",
  });
  vv.setState({ pressure: 10, temperature: 195, saturation: 0.7, flowing: true });
  onLeave(() => vv.dispose());
  document.querySelectorAll("#rigCut button").forEach(b => b.onclick = () => {
    document.querySelectorAll("#rigCut button").forEach(x => x.classList.toggle("on", x === b));
    vv.setCutaway(b.dataset.c === "1");
  });
  document.getElementById("rigReset").onclick = () => vv.resetView();
  document.getElementById("rigShot").onclick = () => { const a = document.createElement("a"); a.href = vv.snapshot(); a.download = "vessel.png"; a.click(); };
}

/* =============================================================== 05 gate */
function chGate() {
  const c = PH.benchmarkCheck(S);
  const worst = Math.max(...c.rows.map(r => Math.abs(r.err)));
  const rows = c.rows.map(r => `<tr><td class="l">${r.zeolite}</td><td>${r.P}</td><td>${f(r.pred, 3)}</td><td>${f(r.target, 2)}</td>
    <td style="color:var(--ink-3)">${f(r.target * .85, 2)}–${f(r.target * 1.15, 2)}</td>
    <td>${r.err >= 0 ? "+" : "−"}${f(Math.abs(r.err), 2)}%</td><td><span class="tag ${r.pass ? "ok" : "bad"}">${r.pass ? "pass" : "fail"}</span></td></tr>`).join("");
  return `${kicker(4)}
  <h1 class="head">The model matches Langmi's 77&nbsp;K benchmark to within <span class="v">${f(worst, 1)}%</span> — <em>because it was fitted to it.</em></h1>
  <p class="dek">Section 6 makes this check non-negotiable: reproduce Langmi et al. (2003) within ±15% before
    trusting anything at 195&nbsp;K. The model passes ${c.passed} of ${c.total}. But agreement with the data it was
    calibrated on proves the fit is good, not that the model is right. Real validation needs independent results.</p>
  <div class="grid g-7-5 section" style="align-items:start">
    <div>${section("Model against benchmark", "±15% band shaded", `<div id="gateChart"></div>`)}</div>
    <div>${section("Point by point", `${c.passed}/${c.total} pass`, `<div class="tbl"><table>
      <tr><th class="l">Zeolite</th><th>bar</th><th>model</th><th>Langmi</th><th>band</th><th>error</th><th></th></tr>${rows}</table></div>`)}</div>
  </div>
  <div class="grid g2 section">
    ${aside("Not independent", `The model is <b>calibrated on these ten points</b>. Import GCMC or ML output below
      for a genuine check against the same targets. Note too that Langmi reports <em>excess</em> adsorption while
      GCMC reports <em>absolute</em> — a ~6% systematic gap at 10&nbsp;bar to correct before comparing.`)}
    <div>${section("Independent check", "csv: zeolite,pressure_bar,wt_pct", `
      <input type="file" id="extCsv" accept=".csv" style="font:13px var(--sans)"><div id="extOut" style="margin-top:12px"></div>`)}</div>
  </div>`;
}
function mountGate() {
  const c = PH.benchmarkCheck(S), ser = [], bands = [];
  for (const [z, col] of [["13X", "#1d3557"], ["5A", "#6e5327"]]) {
    const rs = c.rows.filter(r => r.zeolite === z);
    bands.push({ x: rs.map(r => r.P), lo: rs.map(r => r.target * .85), hi: rs.map(r => r.target * 1.15), color: col, opacity: .1 });
    ser.push({ label: `${z} model`, color: col, x: rs.map(r => r.P), y: rs.map(r => r.pred), width: 2 });
    ser.push({ label: `${z} Langmi`, color: col, x: rs.map(r => r.P), y: rs.map(r => r.target), dash: "2 3", hollow: true, width: 1.2 });
  }
  const ch = lineChart(ser, { width: 720, bands, xLabel: "pressure, bar", yLabel: "wt% H₂ at 77 K", height: 420, labelWidth: 110, xTicks: P_ALL, xMin: 0 });
  document.getElementById("gateChart").innerHTML = ch.html; ch.mount();
  document.getElementById("extCsv").onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    file.text().then(txt => {
      const got = {};
      txt.split(/\r?\n/).slice(1).forEach(l => { const [z, , w] = l.split(",").map(s => (s || "").trim()); if (z && w) (got[z] = got[z] || []).push(+w); });
      const rows = [];
      for (const z of Object.keys(got)) (MC.benchmark.data[z] || []).forEach((t, i) => {
        if (got[z][i] == null) return; const err = (got[z][i] - t) / t * 100; rows.push({ z, P: P_ALL[i], v: got[z][i], t, err, pass: Math.abs(err) <= 15 });
      });
      const out = document.getElementById("extOut");
      if (!rows.length) { out.innerHTML = aside("No usable rows", "Expected a header line, then <code>zeolite,pressure_bar,wt_pct</code>."); return; }
      const fails = z => rows.filter(r => r.z === z && !r.pass).length, passed = rows.filter(r => r.pass).length;
      out.innerHTML = `<p class="body-copy"><b>${passed}/${rows.length} within ±15%.</b> §6 (≤2 failures per zeolite):
        ${Object.keys(got).map(z => `${z} ${fails(z) <= 2 ? "pass" : "fail"}`).join(", ")}. §10 (10/10): ${passed === rows.length ? "pass" : "fail"}.</p>`;
    });
  };
}

/* ================================================================ 06 run */
function chRun() {
  const m = matrix(), u = U();
  const head = `<div class="h">Run · configuration</div>${P_ALL.map(p => `<div class="h">${p} bar</div>`).join("")}`;
  const body = m.map(r => `<div class="r"><span class="sw" style="background:${RUN_COLOR[r.run]}"></span>
    <span class="num" style="width:22px;color:var(--ink-3)">${r.run}</span>${esc(short(r))}</div>` +
    r[u.k].map((v, i) => `<div class="c" data-r="${r.run}" data-i="${i}">${f(v, u.d)}</div>`).join("")).join("");
  return `${kicker(5)}
  <h1 class="head">Forty production points, <em>one closed-form model</em>.</h1>
  <p class="dek">The specification asks for eight configurations at five pressures — forty points — after the ten
    validation points pass. Here they are computed in sequence, exactly as the engine produces them for the thesis
    tables. The pacing is for your benefit; the calculation itself takes under a millisecond.</p>
  <div class="ctl section" style="margin-bottom:18px">
    <button class="btn" id="runGo">Run the 40-point matrix <span class="arr">→</span></button>
    <span class="num" id="runStat" style="color:var(--ink-3);font-size:13px">ready · ${u.s} · 195 K · q<sub>st</sub> ${f(S.qst, 1)} / ${f(mofQ(), 1)} kJ/mol</span>
  </div>
  <div class="grid g-8-4" style="align-items:start">
    <div class="rungrid" id="runGrid">${head}${body}</div>
    <div><div class="log" id="runLog"></div></div>
  </div>
  <div class="grid g4 section" id="runSum" style="opacity:.25;transition:opacity .6s"></div>`;
}
function mountRun() {
  const m = matrix(), u = U(), max = Math.max(...m.flatMap(r => r[u.k]));
  const cells = [...document.querySelectorAll("#runGrid .c")];
  const log = document.getElementById("runLog");
  let timer = null;
  const summary = () => {
    const L = leader(m), lo = m.reduce((a, b) => last(b.wt_pct) < last(a.wt_pct) ? b : a);
    document.getElementById("runSum").innerHTML = `
      <div class="stat"><div class="n">40<small style="font-size:15px;color:var(--ink-3)"> / 40</small></div><div class="l">production points complete</div></div>
      <div class="stat"><div class="n acc">${f(last(L[u.k]), u.d)}</div><div class="l">${u.s} — leader, Run ${L.run}, ${esc(short(L))}</div></div>
      <div class="stat"><div class="n">${f(last(L.wt_pct) / last(lo.wt_pct), 2)}×</div><div class="l">best over worst at 10 bar (Run ${lo.run} is lowest)</div></div>
      <div class="stat"><div class="n">${f(last(byRun(m, 1).wt_pct) / byRun(m, 1).wt_pct[0], 1)}×</div><div class="l">rise from 1 to 10 bar for Run 1 — the specification's Table 11.1 has 2.9×</div></div>`;
    document.getElementById("runSum").style.opacity = 1;
  };
  const shade = (el, v) => { el.style.background = `rgba(196,64,26,${(0.04 + 0.42 * v / max).toFixed(3)})`; el.classList.add("done"); };
  const instant = () => { cells.forEach(el => shade(el, +el.textContent)); summary();
    log.innerHTML = `<div class="ok">matrix already computed this session — press run to replay</div>`; };
  const go = () => {
    clearInterval(timer); cells.forEach(el => { el.classList.remove("done", "live"); el.style.background = ""; });
    log.innerHTML = ""; document.getElementById("runSum").style.opacity = .25;
    const t0 = performance.now(); let k = 0;
    const line = (html, cls = "") => { log.insertAdjacentHTML("afterbegin", `<div class="${cls}">${html}</div>`); };
    line(`init · 195 K · ${S.model} · q_st ${f(S.qst, 1)} | ${S.mof} ${f(mofQ(), 1)} kJ/mol · ${S.approach}`, "acc");
    timer = setInterval(() => {
      if (k > 0) cells[k - 1].classList.remove("live");
      if (k >= cells.length) {
        clearInterval(timer); S.ranOnce = true;
        const tc0 = performance.now(); for (let r = 0; r < 50; r++) matrix();
        const ms = (performance.now() - tc0) / 50;
        line(`done · 40/40 points · model evaluates the full matrix in ${ms < 0.1 ? ms.toFixed(3) : ms.toFixed(2)} ms`, "ok");
        document.getElementById("runStat").textContent = `complete · 40 points`; summary(); return;
      }
      const el = cells[k], r = byRun(m, +el.dataset.r), i = +el.dataset.i;
      el.classList.add("live"); shade(el, r[u.k][i]);
      line(`run ${String(r.run).padStart(2, "0")} · ${short(r).padEnd(18, " ")} · ${String(P_ALL[i]).padStart(2, " ")} bar · ${f(r.wt_pct[i], 5)} wt%`);
      document.getElementById("runStat").textContent = `running · ${k + 1} / 40`;
      k++;
    }, 70);
  };
  document.getElementById("runGo").onclick = go;
  onLeave(() => clearInterval(timer));
  if (S.ranOnce) instant(); else setTimeout(go, 600);
}

/* ========================================================== 07 isotherms */
function chIsotherms() {
  const m = matrix(), u = U(), r1 = byRun(m, 1);
  const span = last(r1.wt_pct) / r1.wt_pct[0], L = leader(m);
  const rows = m.map(r => `<tr class="${r.run === L.run ? "hl" : ""}"><td class="l"><span class="sw" style="background:${RUN_COLOR[r.run]}"></span>${r.run}</td>
    <td class="l">${esc(r.label)}</td>${r[u.k].map(v => `<td>${f(v, u.d)}</td>`).join("")}<td>${f(last(r.grams), 4)} g</td></tr>`).join("");
  return `${kicker(6)}
  <h1 class="head">${span > 8.5
    ? `At 195&nbsp;K the isotherms are <em>almost straight lines</em>.`
    : `At 195&nbsp;K the isotherms <em>keep climbing</em> — ${f(span, 1)}× from 1 to 10&nbsp;bar, not the specification's 2.9×.`}</h1>
  <p class="dek">At 195&nbsp;K the pores are nowhere near full — Run 1 reaches ${f(last(r1.wt_pct) / MC.fits[S.model]["13X"].params.n_sat * 100, 1)}%
    of saturation at 10&nbsp;bar — so extra pressure keeps buying extra hydrogen. ${S.model === "sips"
    ? `The curves still bend, but not from filling up: the Sips model's heterogeneity exponent
      (m&nbsp;≈&nbsp;${f(MC.fits.sips["13X"].params.m, 2)}) makes low-pressure uptake grow as P<sup>m</sup> rather than linearly.`
    : `Under the Langmuir model the low-pressure limit is linear, so the curves are nearly straight.`}
    The specification's Table 11.1 flattens to 2.9× because it scaled 77&nbsp;K data that <em>was</em> near saturation by a
    single constant.</p>
  <div class="ctl section" style="margin-bottom:6px">
    <div class="seg" id="unitSeg"><button data-u="mg_per_g">mg / g</button><button data-u="wt_pct">wt%</button></div>
    <span class="num" style="font-size:12px;color:var(--ink-3)">hover the chart for exact values</span>
  </div>
  <div id="isoChart"></div>
  <div class="grid g-8-4 section" style="align-items:start">
    <div>${section("Master isotherm table", "spec §7.1, Table 4.4 format", `<div class="tbl"><table>
      <tr><th class="l">Run</th><th class="l">Configuration</th>${P_ALL.map(p => `<th>${p} bar</th>`).join("")}<th>in 90 g</th></tr>${rows}</table></div>
      <p style="font:12px var(--mono);color:var(--ink-3);margin-top:10px">values in ${u.l}. Highlighted: leader.</p>`)}</div>
    <div>${section("Why the shape matters", "SPEC-DEV-2", aside("", `Section 6.1 expects every 195&nbsp;K value to be
      <b>2.28%</b> of its 77&nbsp;K value. That constant is a low-pressure (Henry's-law) limit; 13X is ~95% saturated at
      77&nbsp;K and 10&nbsp;bar, where it cannot apply. The true ratio here climbs from
      <b class="num">${f(PH.uptake("13X", 195, 1, S.qst, S.model) / PH.uptake("13X", 77, 1, S.qst, S.model) * 100, 1)}%</b> at 1&nbsp;bar to
      <b class="num">${f(PH.uptake("13X", 195, 10, S.qst, S.model) / PH.uptake("13X", 77, 10, S.qst, S.model) * 100, 1)}%</b> at 10&nbsp;bar. A correct simulation fails the spec's own gate.`, true))}</div>
  </div>`;
}
function mountIsotherms() {
  const m = matrix(), u = U();
  document.querySelectorAll("#unitSeg button").forEach(b => {
    b.classList.toggle("on", b.dataset.u === S.unit); b.onclick = () => { S.unit = b.dataset.u; render(); };
  });
  const ch = lineChart(m.map(r => ({ label: `${r.run} · ${short(r)}`, tipLabel: `Run ${r.run}`, color: RUN_COLOR[r.run],
    x: r.pressures, y: r[u.k], width: r.run === leader(m).run ? 2.6 : 1.6, dash: r.composite ? null : null })),
    { xLabel: "pressure, bar", yLabel: `${u.l}, 195 K`, height: 470, labelWidth: 210, xTicks: P_ALL, xMin: 0,
      yFmt: v => f(v, u.d), xFmt: p => `${p} bar` });
  document.getElementById("isoChart").innerHTML = ch.html; ch.mount();
}

/* ========================================================== 08 MOF effect */
function chEffect() {
  const g = mofGain(), m = matrix(), u = U();
  const cross = PH.mofCrossover({ ...S, approach: "mix" });
  const plain = last(byRun(m, 2)[u.k]);
  const variants = [
    ["13X powder, plain", plain, "Run 2"],
    ...["mix", "A", "B"].map(a => { const r = byRun(matrix({ ...S, approach: a }), 6);
      return [a === "mix" ? "+ MOF, physical mixture" : `+ MOF, spec Approach ${a}`, last(r[u.k]), a === "mix" ? "this model" : "uses ×1.40 from charcoal"]; }),
  ];
  const vmax = Math.max(...variants.map(v => v[1]));
  const bars = variants.map(([lab, v, note], i) => `<div style="display:grid;grid-template-columns:230px 1fr 90px 80px;gap:14px;align-items:center;padding:10px 0;border-bottom:1px solid var(--rule)">
    <div style="font:14px var(--sans)">${lab}<small style="display:block;font:11px var(--mono);color:var(--ink-3)">${note}</small></div>
    <div style="height:20px;background:var(--paper-2);position:relative"><div style="position:absolute;inset:0 auto 0 0;width:${v / vmax * 100}%;background:${i === 0 ? "var(--ink-2)" : i === 1 ? "var(--mof)" : "var(--accent)"};opacity:${i > 1 ? .55 : 1}"></div>
      <div style="position:absolute;top:-4px;bottom:-4px;left:${plain / vmax * 100}%;width:1px;background:var(--ink)"></div></div>
    <div class="num" style="text-align:right">${f(v, u.d)}</div>
    <div class="num" style="text-align:right;color:${i === 0 ? "var(--ink-3)" : v >= plain ? "var(--ok)" : "var(--bad)"}">${i === 0 ? "—" : pct(v / plain - 1)}</div></div>`).join("");
  const ranked = [...m].sort((a, b) => last(b.wt_pct) - last(a.wt_pct));
  const rank = ranked.map((r, i) => `<tr class="${i === 0 ? "hl" : ""}"><td class="l num">${i + 1}</td>
    <td class="l"><span class="sw" style="background:${RUN_COLOR[r.run]}"></span>Run ${r.run}</td><td class="l">${esc(r.label)}</td>
    <td>${f(last(r[u.k]), u.d)}</td><td style="color:var(--ink-3)">${pct(last(r.wt_pct) / last(byRun(m, 1).wt_pct) - 1)}</td></tr>`).join("");
  const hl = g < 0
    ? `Blended as the specification describes, ${nb(S.mof)} <em>lowers</em> uptake by <span class="v">${f(Math.abs(g) * 100, 1)}%</span>.`
    : `Blended as the specification describes, ${nb(S.mof)} raises uptake by <span class="v">${f(g * 100, 1)}%</span>.`;
  return `${kicker(7)}
  <h1 class="head">${hl}</h1>
  <p class="dek">${g < 0 ? `The specification predicts the MOF composite leads. It only does if you multiply by 1.40 —
    a synergy factor Hauli et al. measured for zeolite and <em>activated charcoal</em>, not for any MOF. Section 2.4
    itself calls the bed a physical mixture with no chemical bonding. Without the borrowed factor, the MOF drags the bed down:
    its stronger binding loses more of its grip between 77 and 195&nbsp;K than the zeolite's does.`
    : `The gain here comes from the MOF's own isotherm, with no synergy term. The specification's 1.40 factor — measured
    for zeolite and activated charcoal, not a MOF — would inflate it further.`}</p>
  <div class="grid g-7-5 section" style="align-items:start">
    <div>${section("13X powder at 10 bar, four ways", "SPEC-DEV-8", bars +
      `<p style="font:12px var(--mono);color:var(--ink-3);margin-top:10px">vertical rule = plain 13X powder · ${u.l}</p>`)}</div>
    <div>${section("When does the MOF start to help?", "physical mixture", `<div id="crossChart"></div>
      <p class="body-copy" style="margin-top:10px">${cross != null
        ? `With ${esc(S.mof)}, the MOF helps only once zeolite q<sub>st</sub> exceeds <b class="num">${f(cross, 2)} kJ/mol</b>. The specification uses ${f(S.qst, 1)}.`
        : `With ${esc(S.mof)}, the sign of the effect does not change between 2 and 12 kJ/mol.`}</p>`)}</div>
  </div>
  ${section("Ranking at 10 bar", "vs Run 1", `<div class="tbl"><table><tr><th class="l">#</th><th class="l">Run</th><th class="l">Configuration</th><th>${u.s}</th><th>vs Run 1</th></tr>${rank}</table></div>`)}`;
}
function mountEffect() {
  const qs = []; for (let q = 3; q <= 7.001; q += 0.1) qs.push(+q.toFixed(2));
  const series = Object.keys(MC.mofs).map(k => ({
    label: k, color: MOF_COLOR[k], width: k === S.mof ? 2.6 : 1.3, opacity: k === S.mof ? 1 : .5, dots: false,
    x: qs, y: qs.map(q => mofGain({ ...S, mof: k, qstMof: null, approach: "mix", qst: q }) * 100),
  }));
  const allY = series.flatMap(s => s.y);
  const ch = lineChart(series, { width: 540, xLabel: "zeolite q_st, kJ/mol", yLabel: "MOF effect on 13X powder, %", height: 360, labelWidth: 84,
    xMin: 3, xMax: 7, xTicks: [3, 4, 5, 6, 7], yMin: Math.min(...allY, -10), yMax: Math.max(...allY, 10) * 1.08,
    yFmt: v => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`, hlines: [{ y: 0, label: "no effect" }],
    vlines: [{ x: S.qst, label: `spec · ${f(S.qst, 1)}`, color: "var(--ink)" }], xFmt: q => `q_st ${q}`, endValues: false });
  document.getElementById("crossChart").innerHTML = ch.html; ch.mount();
}

/* ======================================================= 09 uncertainty */
function chUncertainty() {
  const base = last(byRun(matrix(), 6).wt_pct);
  const at = over => last(byRun(matrix({ ...S, ...over }), 6).wt_pct);
  const unc = MC.uncertainty.rows.find(r => r.run === 6);
  const rows = [
    ["Zeolite q_st", "4 → 8 kJ/mol, spec range", [at({ qst: 4 }), at({ qst: 8 })]],
    ["MOF q_st", "6 → 9 kJ/mol", [at({ qstMof: 6 }), at({ qstMof: 9 })]],
    ["Which MOF", Object.keys(MC.mofs).join(" / "), Object.keys(MC.mofs).map(k => at({ mof: k, qstMof: null }))],
    ["Composite model", "mixture / spec A / spec B", ["mix", "A", "B"].map(a => at({ approach: a }))],
    ["Isotherm model", "Sips / Langmuir", ["sips", "langmuir"].map(md => at({ model: md }))],
    ["Benchmark fit", "±1σ, bootstrap refit", [base * (1 - unc.fit_sd_pct / 100), base * (1 + unc.fit_sd_pct / 100)]],
    ["Binder basis", "literature / §4.1 literal", ["literature", "pure_framework"].map(b => at({ basis: b }))],
  ].map(([k, sub, vals]) => ({ k, sub, lo: Math.min(...vals), hi: Math.max(...vals) }))
   .sort((a, b) => (b.hi - b.lo) - (a.hi - a.lo));
  const lo = Math.min(...rows.map(r => r.lo)), hi = Math.max(...rows.map(r => r.hi));
  const X = v => (Math.log(v) - Math.log(lo * .9)) / (Math.log(hi * 1.1) - Math.log(lo * .9)) * 100;
  const tor = rows.map(r => `<div class="row"><div class="k">${r.k}<small>${r.sub}</small></div>
    <div class="bar"><div class="lo" style="left:${X(Math.min(r.lo, base))}%;width:${Math.max(X(base) - X(r.lo), 0)}%"></div>
      <div class="hi" style="left:${X(base)}%;width:${Math.max(X(r.hi) - X(base), 0)}%"></div>
      <div class="mid" style="left:${X(base)}%"></div></div>
    <div class="rng">${f(r.lo, 4)} – ${f(r.hi, 4)} <span style="color:var(--ink-3)">${f(r.hi / r.lo, 1)}×</span></div></div>`).join("");
  const top = rows[0];
  return `${kicker(8)}
  <h1 class="head">The answer is decided by <em>${top.k.includes("q_st") ? "q<sub>st</sub>" : top.k.toLowerCase()}</em>, not by the material.</h1>
  <p class="dek">Each bar varies one input across its plausible range and holds everything else fixed, for the
    specification's highlighted configuration — Run 6, 13X powder with MOF, at 10&nbsp;bar. The widest bar is the
    input the thesis most needs to pin down. The specification lists the q<sub>st</sub> sweep as <em>optional</em>.</p>
  ${section("What moves Run 6", "log scale · wt% at 10 bar · vertical rule = current setting", `<div class="torn">${tor}</div>`)}
  <div class="grid g2 section">
    ${aside("SPEC-DEV-3", `<b>${top.k}</b> alone moves the answer ${f(top.hi / top.lo, 1)}× — against a
      factor-of-3 sanity gate in §11. And the specification calls 4&nbsp;kJ/mol "conservative"; it is the
      <b>optimistic</b> end, since lower q<sub>st</sub> means more hydrogen retained at 195&nbsp;K.`)}
    ${aside("Fit uncertainty", `Refitting the benchmark within its own ±15% tolerance moves the 195&nbsp;K prediction by
      <b>±${f(unc.fit_sd_pct, 1)}%</b> (1σ). Real, but an order of magnitude smaller than the q<sub>st</sub> choice.
      Both belong in the per-configuration uncertainty the specification requires (§7.2).`, true)}
  </div>`;
}

/* ========================================================== 10 verdict */
function chVerdict() {
  const m = matrix(), L = leader(m), u = U(), g = mofGain();
  const r6 = last(byRun(m, 6).wt_pct), spread = last(byRun(matrix({ ...S, qst: 4 }), 2).wt_pct) / last(byRun(matrix({ ...S, qst: 8 }), 2).wt_pct);
  const sb = PH.storageBalance(last(L.wt_pct), 10, S.T);
  const doe = last(L.wt_pct) / 5.5 * 100;
  const devs = [
    ["1", "§4.1", "×0.825 binder correction double-counts binder already in Langmi's samples"],
    ["2", "§6.1", "Constant 0.0228 is a Henry's-law ratio applied to near-saturated data"],
    ["3", "§2, §5", "q_st fixed and sweep 'optional', yet it dominates every result"],
    ["5", "§3", "Vessel is 490.9 cm³, dead space 58.9 cm³ per end"],
    ["6", "§2.3", "The MOF is never named; no candidate meets all five criteria"],
    ["7", "§8", "MOF called amorphous with no CIF; MOFs are crystalline, CIFs exist"],
    ["8", "§4.1", "1.40× synergy measured for activated charcoal, not a MOF"],
    ["9", "§11", "Table 11.1 is the nano-AC table unchanged; header still reads 'Nano-AC'"],
  ];
  return `${kicker(9)}
  <h1 class="head">What to write in <em>Chapter 4</em>.</h1>
  <p class="dek">Six findings the thesis can defend, in the order an examiner will ask about them — followed by
    every place the specification had to be corrected, and the files the engine produces for the chapter itself.</p>
  ${section("Findings", "all computed live from the current settings", `<ol class="findings">
    <li><div><h3>Run ${L.run} leads: ${f(last(L[u.k]), u.d)} ${u.s} at 10&nbsp;bar.</h3>
      <p>${esc(L.label)}. ${L.run === 6 ? "This matches the specification's prediction." : `The specification predicted Run 6; under a physical-mixture model with the specification's own q<sub>st</sub> values, Run 6 reaches ${f(r6 * (u.k === "mg_per_g" ? 10 : 1), u.d)} ${u.s}.`}</p></div></li>
    <li><div><h3>The MOF effect is ${pct(g)} — and hinges on a borrowed factor.</h3>
      <p>Blended physically, ${esc(S.mof)} changes 13X-powder uptake by ${pct(g)}. The 1.40× synergy the specification
        applies was measured for activated charcoal. State which model the thesis uses and why.</p></div></li>
    <li><div><h3>Isosteric heat decides the result more than any material choice.</h3>
      <p>Across the specification's 4–8&nbsp;kJ/mol range, plain 13X powder moves ${f(spread, 1)}×. Measure or source
        q<sub>st</sub> for the actual materials, and report the sweep as a required result, not an optional one.</p></div></li>
    <li><div><h3>Only ${f(sb.frac * 100, 0)}% of the stored hydrogen is adsorbed.</h3>
      <p>At 10&nbsp;bar the bed holds ${f(sb.ads, 3)}&nbsp;g by adsorption; the ${f(sb.freeCm3, 0)}&nbsp;cm³ of void and dead
        space holds ${f(sb.free, 3)}&nbsp;g as ordinary compressed gas. Say so before an examiner does.</p></div></li>
    <li><div><h3>The best configuration reaches ${f(doe, 2)}% of the DOE target.</h3>
      <p>${f(last(L.wt_pct), 4)} wt% against 5.5&nbsp;wt%. That is the expected outcome for physisorption well above
        77&nbsp;K (Bénard &amp; Chahine, 2007) and is better stated plainly than explained away.</p></div></li>
    <li><div><h3>Name the MOF, and validate independently.</h3>
      <p>The 77&nbsp;K check is fit quality, not validation. Pick a MOF, cite its isotherm, and run GCMC or an independent
        dataset through the chapter-05 import before submission.</p></div></li>
  </ol>`)}
  <div class="grid g2 section" style="align-items:start">
    <div>${section("Specification corrections", "tagged SPEC-DEV in code and methodology note", `<div class="tbl"><table>
      <tr><th class="l">Tag</th><th class="l">Where</th><th class="l">Issue</th></tr>
      ${devs.map(([t, w, i]) => `<tr><td class="l num">${t}</td><td class="l num" style="color:var(--ink-3)">${w}</td><td class="l" style="white-space:normal">${i}</td></tr>`).join("")}</table></div>`)}</div>
    <div>${section("Deliverables", "spec §7.3", `<div class="dl">
      ${[["Master isotherm table", ".xlsx + .docx"], ["Validation table", ".xlsx, 77 K vs Langmi"], ["Isotherm figure", "PNG, 300 dpi, all 8 runs"],
         ["Methodology & deviations", ".docx"], ["Convergence / fit stability", ".xlsx sheet"], ["Per-run uncertainty", ".xlsx sheet"],
         ["MOF candidate check", ".xlsx sheet"], ["Raw output", ".json"]].map(([a, b]) => `<div><b>${a}</b><span>${b}</span></div>`).join("")}</div>
      <p class="body-copy" style="margin-top:16px">Generated by the engine with the settings you have chosen here:</p>
      <pre class="num" style="background:var(--ink);color:var(--paper);padding:14px 16px;font-size:12.5px;overflow-x:auto;margin:0">${esc(cli())}</pre>
      <div style="margin-top:14px"><button class="btn ghost" id="csvDl">Download this table as CSV</button></div>`)}</div>
  </div>`;
}
function cli() {
  const a = ["python engine/run.py", `--q-st ${S.qst}`, `--mof ${S.mof}`];
  if (S.qstMof != null) a.push(`--q-st-mof ${S.qstMof}`);
  if (S.approach !== "mix") a.push(`--approach ${S.approach}`);
  if (S.model !== "sips") a.push(`--model ${S.model}`);
  if (S.basis !== "literature") a.push(`--basis ${S.basis}`);
  if (S.unit !== "mg_per_g") a.push("--unit wt_pct");
  return a.join(" ");
}
function mountVerdict() {
  document.getElementById("csvDl").onclick = () => {
    const m = matrix(), u = U();
    const L = [`# Zeolite x MOF master isotherm table, 195 K, ${u.s}`, `# ${cli()}`, ["run", "configuration", ...P_ALL.map(p => `${p}_bar`)].join(",")];
    m.forEach(r => L.push([r.run, `"${r.label}"`, ...r[u.k].map(v => v.toFixed(6))].join(",")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([L.join("\n")], { type: "text/csv" })); a.download = "master_isotherm_table.csv"; a.click();
  };
}

const RENDER = [chQuestion, chMaterials, chMof, chRig, chGate, chRun, chIsotherms, chEffect, chUncertainty, chVerdict];
const MOUNT = [null, mountMaterials, mountMof, mountRig, mountGate, mountRun, mountIsotherms, mountEffect, null, mountVerdict];

/* ================================================================== shell */
function readouts() {
  const m = matrix(), L = leader(m), u = U();
  document.getElementById("ro").innerHTML = `
    <div class="ro"><small>Bath</small><b>${S.T} K</b></div>
    <div class="ro"><small>q<sub>st</sub> zeolite · MOF</small><b>${f(S.qst, 1)} · ${f(mofQ(), 1)}</b></div>
    <div class="ro"><small>MOF</small><b>${esc(S.mof)}</b></div>
    <div class="ro"><small>Composite</small><b>${S.approach === "mix" ? "physical mix" : `spec ${S.approach}`}</b></div>
    <div class="ro"><small>Leader · 10 bar</small><b class="hot">Run ${L.run} · ${f(last(L[u.k]), u.d)} ${u.s}</b></div>`;
}
function rail() {
  document.getElementById("railList").innerHTML = CH.map((c, i) => `<li class="${i === S.ch ? "on" : i < S.ch ? "done" : ""}">
    <button data-go="${i}"><span class="dot"></span><span class="t">${c.t}<small>${String(i + 1).padStart(2, "0")} · ${c.s}</small></span></button></li>`).join("")
    + `<div class="prog" style="height:calc(${S.ch / (CH.length - 1) * 100}% - ${S.ch / (CH.length - 1) * 20}px)"></div>`;
}
function render() {
  mounted.forEach(fn => { try { fn(); } catch {} }); mounted = [];
  const i = S.ch;
  const prev = i > 0 ? CH[i - 1] : null, next = i < CH.length - 1 ? CH[i + 1] : null;
  document.getElementById("stage").innerHTML = `<article class="chapter" id="chap">${RENDER[i]()}</article>
    <nav class="next">
      <button data-go="${i - 1}" ${prev ? "" : "disabled"}><small>← Previous</small><b>${prev ? prev.t : ""}</b></button>
      <button data-go="${i + 1}" ${next ? "" : "disabled"}><small>Next — ${String(i + 2).padStart(2, "0")}</small><b>${next ? next.t : ""}</b></button>
    </nav><div class="kbd-hint">← → to move between chapters · P for parameters</div>`;
  MOUNT[i]?.();
  rail(); readouts();
  document.title = `${String(i + 1).padStart(2, "0")} ${CH[i].t} — Zeolite × MOF`;
  if (location.hash !== `#${CH[i].id}`) history.replaceState(null, "", `#${CH[i].id}`);
}
function go(i) {
  if (i < 0 || i >= CH.length || i === S.ch) return;
  S.ch = i; render(); scrollTo({ top: 0, behavior: "instant" });
}

/* ------------------------------------------------------------- parameters */
function drawer() {
  const segs = (id, opts, cur) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(cur) ? "on" : ""}">${l}</button>`).join("")}</div>`;
  document.getElementById("drawerBody").innerHTML = `
    <div class="fld"><label>Zeolite q<sub>st</sub> <b class="num" id="dq">${f(S.qst, 1)} kJ/mol</b></label>
      <input type="range" id="pQst" min="4" max="8" step="0.1" value="${S.qst}">
      <div class="hint">Spec range 4–8 (13X) and 4–7 (5A); spec default 4. The single most influential input.</div></div>
    <div class="fld"><label>MOF q<sub>st</sub> <b class="num" id="dqm">${f(mofQ(), 1)} kJ/mol</b></label>
      <input type="range" id="pQm" min="4" max="10" step="0.1" value="${mofQ()}">
      <div class="hint">Defaults to the candidate's literature value (${f(mof().q_st, 1)}). Spec asks for &gt; 7.
        <a href="#" id="pQmReset" style="color:var(--ink-2)">reset</a></div></div>
    <div class="fld"><label>MOF candidate</label>${segs("pMof", Object.keys(MC.mofs).map(k => [k, k]), S.mof)}</div>
    <div class="fld"><label>Composite model</label>${segs("pAp", [["mix", "Mixture"], ["A", "Spec A"], ["B", "Spec B"]], S.approach)}
      <div class="hint">${esc(MC.composite_approaches[S.approach])}.</div></div>
    <div class="fld"><label>Isotherm model</label>${segs("pMd", [["sips", "Sips"], ["langmuir", "Langmuir"]], S.model)}</div>
    <div class="fld"><label>Binder basis</label>${segs("pBs", [["literature", "Literature"], ["pure_framework", "§4.1 literal"]], S.basis)}
      <div class="hint">Only affects granular runs. "§4.1 literal" applies ×0.825 on top of binder-containing data.</div></div>
    <div class="fld"><label>Units</label>${segs("pU", [["mg_per_g", "mg / g"], ["wt_pct", "wt%"]], S.unit)}</div>
    <div class="fld"><button class="btn ghost" id="pReset" style="width:100%;justify-content:center">Reset to specification defaults</button></div>`;
  const live = () => { render(); drawer(); };
  const q = document.getElementById("pQst");
  q.oninput = e => { S.qst = +e.target.value; document.getElementById("dq").textContent = `${f(S.qst, 1)} kJ/mol`; };
  q.onchange = live;
  const qm = document.getElementById("pQm");
  qm.oninput = e => { S.qstMof = +e.target.value; document.getElementById("dqm").textContent = `${f(S.qstMof, 1)} kJ/mol`; };
  qm.onchange = live;
  document.getElementById("pQmReset").onclick = e => { e.preventDefault(); S.qstMof = null; live(); };
  const bind = (id, key, cast = v => v) => document.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => { S[key] = cast(b.dataset.v); if (key === "mof") S.qstMof = null; live(); });
  bind("pMof", "mof"); bind("pAp", "approach"); bind("pMd", "model"); bind("pBs", "basis"); bind("pU", "unit");
  document.getElementById("pReset").onclick = () => { Object.assign(S, fresh(), { unit: "mg_per_g" }); live(); };
}
function openDrawer(on) {
  document.getElementById("drawer").classList.toggle("on", on);
  document.getElementById("scrim").classList.toggle("on", on);
  if (on) drawer();
}

/* ------------------------------------------------------------------- boot */
function boot() {
  const hash = location.hash.slice(1), idx = CH.findIndex(c => c.id === hash);
  if (idx >= 0) S.ch = idx;
  document.addEventListener("click", e => {
    const g = e.target.closest("[data-go]"); if (g && !g.disabled) { go(+g.dataset.go); return; }
    if (e.target.closest("[data-replay]")) { playPreroll({ meta: {} }); return; }
    if (e.target.closest("#paramsBtn")) openDrawer(true);
    if (e.target.closest("#scrim") || e.target.closest("#drawerX")) openDrawer(false);
  });
  addEventListener("keydown", e => {
    if (e.target.closest?.("input,textarea") || document.querySelector(".preroll")) return;
    if (e.key === "ArrowRight") go(S.ch + 1);
    if (e.key === "ArrowLeft") go(S.ch - 1);
    if (e.key.toLowerCase() === "p") openDrawer(!document.getElementById("drawer").classList.contains("on"));
    if (e.key === "Escape") openDrawer(false);
  });
  addEventListener("hashchange", () => { const k = CH.findIndex(c => c.id === location.hash.slice(1)); if (k >= 0) go(k); });
  render();
  if (shouldPlay() && idx < 0) playPreroll({ meta: {} });
}
boot();
