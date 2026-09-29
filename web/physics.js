/* Shared physics core. Mirrors engine/model.py exactly.
   Loaded by the browser and by engine/parity_check.py under node, so the two
   implementations are tested against each other rather than assumed to agree. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else root.H2Physics = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const sips = (P, ns, b, m) => { const x = Math.pow(b * P, m); return ns * x / (1 + x); };
  const langmuir = (P, ns, b) => ns * b * P / (1 + b * P);

  function make(MC) {
    const R = MC.constants.R, T_BENCH = MC.constants.T_BENCH;
    const shift = (qst, T) => Math.exp((qst * 1000 / R) * (1 / T - 1 / T_BENCH));

    function uptake(zeolite, T, P, qst, model) {
      const f = MC.fits[model][zeolite].params;
      const bT = f.b * shift(qst, T);
      return model === "sips" ? sips(P, f.n_sat, bT, f.m) : langmuir(P, f.n_sat, bT);
    }
    function mofQst(s) { return s.qstMof == null ? MC.mofs[s.mof].q_st : s.qstMof; }
    function mofUptake(key, T, P, qst) {
      const m = MC.mofs[key];
      return langmuir(P, m.q_max_77, m.b_77 * shift(qst, T));
    }
    function formFactor(cfg, basis) {
      if (cfg.form === "powder") return MC.factors.powder;
      return basis === "literature" ? 1.0 : (1 - MC.materials[cfg.zeolite].binder_fraction);
    }
    function runConfig(cfg, s) {
      const P = MC.constants.PRESSURES.filter(p => p <= (s.pMax != null ? s.pMax : Infinity));
      const qm = mofQst(s);
      const mofPart = [], zeoPart = [];
      const wt = P.map(p => {
        const z = uptake(cfg.zeolite, s.T, p, s.qst, s.model) * formFactor(cfg, s.basis);
        zeoPart.push(z);
        if (!cfg.composite) return z;
        const mo = mofUptake(s.mof, s.T, p, qm); mofPart.push(mo);
        if (s.approach === "B") return z * MC.factors.composite;
        let v = MC.factors.zeolite_fraction * z + MC.factors.mof_fraction * mo;
        if (s.approach === "A") v *= MC.factors.composite;
        return v;
      });
      return Object.assign({}, cfg, {
        pressures: P, wt_pct: wt, zeo_wt_pct: zeoPart,
        mof_wt_pct: cfg.composite ? mofPart : null,
        mg_per_g: wt.map(v => v * 10),
        grams: wt.map(v => v / 100 * MC.factors.bed_loading_g),
      });
    }
    const runMatrix = s => MC.configs.map(c => runConfig(c, s));

    function benchmarkCheck(s) {
      const rows = [];
      for (const z of ["13X", "5A"]) {
        const t = MC.benchmark.data[z];
        MC.constants.PRESSURES.forEach((p, i) => {
          const pred = uptake(z, T_BENCH, p, s.qst, s.model);
          const err = (pred - t[i]) / t[i] * 100;
          rows.push({ zeolite: z, P: p, pred, target: t[i], err,
                      pass: Math.abs(err) <= MC.benchmark.tolerance * 100 });
        });
      }
      return { rows, passed: rows.filter(r => r.pass).length, total: rows.length };
    }
    function storageBalance(wt, P, T) {
      const v = MC.vessel;
      const freeCm3 = v.active_bed_cm3 * v.void_fraction + v.dead_total_cm3;
      const free = (P * 1e5) * (freeCm3 * 1e-6) / (R * T) * MC.constants.M_H2;
      const ads = wt / 100 * MC.factors.bed_loading_g;
      return { ads, free, frac: ads / (ads + free), freeCm3 };
    }
    /** Zeolite q_st at which the plain-mixture MOF composite starts beating plain powder. */
    function mofCrossover(s, zeolite = "13X") {
      const cfgPlain = MC.configs.find(c => c.zeolite === zeolite && c.form === "powder" && !c.composite);
      const cfgComp  = MC.configs.find(c => c.zeolite === zeolite && c.form === "powder" && c.composite);
      const gain = q => { const o = Object.assign({}, s, { qst: q });
        const a = runConfig(cfgPlain, o).wt_pct.slice(-1)[0], b = runConfig(cfgComp, o).wt_pct.slice(-1)[0];
        return b / a - 1; };
      let lo = 2, hi = 12;
      if (Math.sign(gain(lo)) === Math.sign(gain(hi))) return null;
      for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2;
        if (Math.sign(gain(m)) === Math.sign(gain(lo))) lo = m; else hi = m; }
      return (lo + hi) / 2;
    }
    return { uptake, mofUptake, mofQst, formFactor, runConfig, runMatrix,
             benchmarkCheck, storageBalance, mofCrossover, MC };
  }
  return { make, sips, langmuir };
});
