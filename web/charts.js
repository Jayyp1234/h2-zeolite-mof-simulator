/* Editorial SVG charts.
 * Lines are labelled directly at their right-hand ends (collision-avoided) instead of
 * through a legend box, and every chart gets a snapping crosshair with a value readout.
 */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let uid = 0;

function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= n) || 10 * mag;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(+v.toFixed(10));
  return out;
}

export function lineChart(series, o = {}) {
  const id = `ch${++uid}`;
  const W = o.width || 880, H = o.height || 420;
  const labelW = o.directLabels === false ? 16 : (o.labelWidth || 200);
  const m = { t: 18, r: labelW, b: 48, l: 64 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const xs = series.flatMap(s => s.x), ys = series.flatMap(s => s.y).filter(v => isFinite(v) && (!o.logY || v > 0));
  (o.bands || []).forEach(b => ys.push(...b.hi));
  const xMin = o.xMin ?? Math.min(0, ...xs), xMax = o.xMax ?? Math.max(...xs);
  let yMin = o.logY ? Math.pow(10, Math.floor(Math.log10(Math.min(...ys)))) : (o.yMin ?? 0);
  let yMax = o.logY ? Math.pow(10, Math.ceil(Math.log10(Math.max(...ys)))) : (o.yMax ?? Math.max(...ys) * 1.08);
  const yT = o.logY ? (() => { const t = []; for (let e = Math.log10(yMin); e <= Math.log10(yMax) + 1e-9; e++) t.push(Math.pow(10, e)); return t; })()
                    : niceTicks(yMin, yMax, o.yTickCount || 5);
  if (!o.logY) yMax = Math.max(yMax, yT.at(-1));
  const px = v => m.l + (v - xMin) / (xMax - xMin || 1) * iw;
  const py = v => o.logY
    ? m.t + ih - (Math.log10(Math.max(v, yMin)) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin) || 1) * ih
    : m.t + ih - (v - yMin) / (yMax - yMin || 1) * ih;
  const fy = o.yFmt || (v => (Math.abs(yMax) < 0.1 ? v.toFixed(3) : Math.abs(yMax) < 2 ? v.toFixed(2) : v.toFixed(1)));
  const fyT = o.logY ? (v => v >= 1 ? v.toFixed(0) : v.toExponential(0).replace("e-", "e−")) : fy;

  let g = "";
  yT.forEach(t => {
    g += `<line class="grid" x1="${m.l}" x2="${m.l + iw}" y1="${py(t).toFixed(1)}" y2="${py(t).toFixed(1)}"/>`;
    g += `<text x="${m.l - 10}" y="${(py(t) + 3.5).toFixed(1)}" text-anchor="end">${fyT(t)}</text>`;
  });
  const xT = o.xTicks || niceTicks(xMin, xMax, 6);
  xT.forEach(t => g += `<text x="${px(t).toFixed(1)}" y="${m.t + ih + 20}" text-anchor="middle">${t}</text>`);
  g += `<line class="axis" x1="${m.l}" x2="${m.l + iw}" y1="${m.t + ih}" y2="${m.t + ih}"/>`;
  if (o.xLabel) g += `<text class="t-axis" x="${m.l + iw}" y="${H - 6}" text-anchor="end">${esc(o.xLabel)}</text>`;
  if (o.yLabel) g += `<text class="t-axis" x="${m.l - 52}" y="${m.t - 4}" text-anchor="start">${esc(o.yLabel)}</text>`;

  (o.bands || []).forEach(b => {
    const up = b.x.map((x, i) => `${px(x).toFixed(1)},${py(b.hi[i]).toFixed(1)}`).join(" ");
    const dn = b.x.map((x, i) => `${px(x).toFixed(1)},${py(b.lo[i]).toFixed(1)}`).reverse().join(" ");
    g += `<polygon points="${up} ${dn}" fill="${b.color}" opacity="${b.opacity ?? 0.12}"/>`;
  });
  (o.vlines || []).forEach(v => {
    g += `<line x1="${px(v.x)}" x2="${px(v.x)}" y1="${m.t}" y2="${m.t + ih}" stroke="${v.color || "var(--accent)"}" stroke-width="1" stroke-dasharray="3 3"/>`;
    if (v.label) g += `<text x="${px(v.x) + 6}" y="${m.t + 11}" style="fill:${v.color || "var(--accent)"}">${esc(v.label)}</text>`;
  });
  (o.hlines || []).forEach(v => {
    g += `<line x1="${m.l}" x2="${m.l + iw}" y1="${py(v.y)}" y2="${py(v.y)}" stroke="${v.color || "var(--ink)"}" stroke-width="1" ${v.dash ? 'stroke-dasharray="4 3"' : ""}/>`;
    if (v.label) g += `<text x="${m.l + 6}" y="${py(v.y) - 6}" style="fill:${v.color || "var(--ink-2)"}">${esc(v.label)}</text>`;
  });

  let lines = "";
  series.forEach(s => {
    const d = s.x.map((x, i) => `${i ? "L" : "M"}${px(x).toFixed(1)},${py(s.y[i]).toFixed(1)}`).join("");
    lines += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 1.8}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""} stroke-linejoin="round" stroke-linecap="round" opacity="${s.opacity ?? 1}"/>`;
    if (s.dots !== false) s.x.forEach((x, i) => lines += `<circle cx="${px(x).toFixed(1)}" cy="${py(s.y[i]).toFixed(1)}" r="${s.r || 2.6}" fill="${s.hollow ? "var(--paper)" : s.color}" stroke="${s.color}" stroke-width="1.3" opacity="${s.opacity ?? 1}"/>`);
  });

  // direct labels, pushed apart so they never collide
  let labels = "";
  if (o.directLabels !== false) {
    const L = series.filter(s => s.label).map(s => ({ s, y: py(s.y.at(-1)), x: px(s.x.at(-1)) }))
      .sort((a, b) => a.y - b.y);
    const gap = o.labelGap || 15;
    for (let i = 1; i < L.length; i++) if (L[i].y - L[i - 1].y < gap) L[i].y = L[i - 1].y + gap;
    const over = L.length ? L.at(-1).y - (m.t + ih) : 0;
    if (over > 0) L.forEach(l => l.y -= over);
    for (let i = L.length - 2; i >= 0; i--) if (L[i + 1].y - L[i].y < gap) L[i].y = L[i + 1].y - gap;
    L.forEach(({ s, y, x }) => {
      const ey = py(s.y.at(-1));
      labels += `<path d="M${x + 5},${ey.toFixed(1)} C${x + 14},${ey.toFixed(1)} ${x + 14},${y.toFixed(1)} ${x + 22},${y.toFixed(1)}" fill="none" stroke="${s.color}" stroke-width=".8" opacity=".55"/>`;
      labels += `<text class="lbl" x="${x + 26}" y="${(y + 4).toFixed(1)}" style="fill:${s.color}">${esc(s.label)}</text>`;
      if (o.endValues !== false) labels += `<text class="lbl-v" x="${W - 2}" y="${(y + 4).toFixed(1)}" text-anchor="end" style="fill:${s.color}">${fy(s.y.at(-1))}</text>`;
    });
  }

  const html = `<div class="fig" id="${id}" style="position:relative">
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || o.yLabel || "chart")}">
      ${g}${lines}${labels}
      <g class="hov" style="display:none"><line class="hover-line" y1="${m.t}" y2="${m.t + ih}"/></g>
      <rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/>
    </svg><div class="chart-tip"></div></div>`;

  function mount(root = document) {
    const el = root.querySelector ? root.querySelector(`#${id}`) : document.getElementById(id);
    if (!el || o.hover === false) return;
    const svg = el.querySelector("svg"), hit = el.querySelector(".hit"), hov = el.querySelector(".hov"),
          ln = hov.querySelector("line"), tip = el.querySelector(".chart-tip");
    const allX = [...new Set(xs)].sort((a, b) => a - b);
    hit.addEventListener("mousemove", e => {
      const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * W;
      const xv = xMin + (sx - m.l) / iw * (xMax - xMin);
      const near = allX.reduce((a, b) => Math.abs(b - xv) < Math.abs(a - xv) ? b : a);
      ln.setAttribute("x1", px(near)); ln.setAttribute("x2", px(near)); hov.style.display = "";
      const rows = series.filter(s => s.label).map(s => { const i = s.x.indexOf(near); return i < 0 ? null : { s, v: s.y[i] }; })
        .filter(Boolean).sort((a, b) => b.v - a.v);
      tip.innerHTML = `<b>${o.xFmt ? o.xFmt(near) : near}</b>` + rows.map(r =>
        `<div><span style="color:${r.s.color}">■</span> ${esc(r.s.tipLabel || r.s.label)} &nbsp; <b>${fy(r.v)}</b></div>`).join("");
      tip.style.left = (px(near) / W * r.width) + "px"; tip.style.top = (r.height * 0.42) + "px"; tip.style.opacity = 1;
      if (px(near) / W > 0.62) tip.style.transform = "translate(calc(-100% - 12px),-50%)"; else tip.style.transform = "";
    });
    hit.addEventListener("mouseleave", () => { hov.style.display = "none"; tip.style.opacity = 0; });
  }
  return { html, mount, id };
}
