# Zeolite × MOF — Hydrogen at 195 K

A ten-chapter guided simulator for hydrogen physisorption in zeolite 13X / 5A and
zeolite–metal-organic-framework composites, built against
`Zeolite + MOF simulation specifications.docx` (drawing PID-ZHS-FAB-002, Rev C1).

- **`engine/`** — Python. Physics, the eight-configuration matrix, and every deliverable
  the specification's Section 7.3 requires (.xlsx, .docx, 300 dpi PNG).
- **`web/`** — static browser app: a cinematic pre-roll, then ten chapters whose headlines
  are computed from the live model, so the story changes when the parameters do.

## Quick start

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

```bash
.venv/bin/python engine/run.py
```

```bash
python3 engine/serve.py
```

Then open <http://localhost:8793>. The app uses ES modules, so it needs to be served over
http(s) — opening `index.html` from disk will not work. `serve.py` disables caching so
engine re-runs always show up.

## The ten chapters

| # | Chapter | What it shows |
|---|---------|---------------|
| 01 | The question | The experiment, the 2×2×2 test matrix, the short answer |
| 02 | The materials | Real FAU and LTA frameworks in 3D; switch 77 K ⇄ 195 K and watch the pores empty |
| 03 | The MOF | The unnamed MOF: three candidates checked against spec §2.3 |
| 04 | The rig | The vessel and bath in 3D, built to the P&ID dimensions |
| 05 | The 77 K gate | Benchmark check against Langmi (2003), plus independent CSV validation |
| 06 | The run | The 40 production points computed in sequence |
| 07 | The isotherms | All eight isotherms and the §7.1 master table |
| 08 | The MOF effect | Whether the MOF actually helps, and what that depends on |
| 09 | The uncertainty | Tornado chart: which input decides the answer |
| 10 | The verdict | Findings for Chapter 4, spec corrections, deliverables |

## What the model finds

Under the specification's own parameters (zeolite q_st = 4 kJ/mol, HKUST-1 at its
literature 7 kJ/mol), blending the MOF in as a physical mixture **lowers** 13X-powder
uptake by about 7%. The MOF composite only leads once the specification's ×1.40 synergy
factor is applied — a factor measured for zeolite with activated charcoal, not a MOF. The
MOF starts to help only when zeolite q_st exceeds about 4.95 kJ/mol.

Zeolite q_st moves the result more than any material choice (7.6× across the spec range
for Run 6), and only about a third of the hydrogen in the vessel is held by adsorption.

## Method

This is the specification's **second-choice route** (§1.2): a calibrated analytical
surrogate, not GCMC. A Sips isotherm is fitted to the Langmi et al. (2003) 77 K benchmark
for each zeolite; each MOF candidate uses a Langmuir isotherm anchored to representative
literature values. Temperature is carried in the affinity constant:

```
b(T) = b(77 K) × exp[(q_st / R) × (1/T − 1/77)]
```

The default composite is a mass-weighted physical mixture,
`n = 0.85 n_zeolite + 0.15 n_MOF`, per §2.4. Both specification approaches remain
selectable.

## MOF candidates

The specification never names its MOF. Three well-characterised candidates are carried.
**Values are representative literature figures — confirm each against its cited source
before thesis submission.**

| Candidate | BET m²/g | Density g/cm³ | q_st kJ/mol | Meets §2.3 | Sources |
|-----------|---------:|--------------:|------------:|:----------:|---------|
| HKUST-1   | 1700 | 0.88 | 7.0 | 3/5 | Rowsell & Yaghi (2006); Panella et al. (2006) |
| UiO-66    | 1250 | 1.24 | 7.0 | 3/5 | Wiersum et al. (2011); Chavan et al. (2012) |
| MOF-5     | 3000 | 0.59 | 4.8 | 3/5 | Rowsell et al. (2004); Kaye et al. (2007) |

## Deviations from the specification

| Tag | Where | Issue |
|-----|-------|-------|
| 1 | §4.1 | ×0.825 binder correction double-counts binder already in Langmi's samples |
| 2 | §6.1 | Constant 0.0228 is a Henry's-law ratio applied to near-saturated data |
| 3 | §2, §5 | q_st fixed and its sweep "optional", yet it dominates every result |
| 5 | §3 | Vessel is 490.9 cm³, not 484; dead space is 58.9 cm³ per end |
| 6 | §2.3 | The MOF is never named, and no candidate meets all five criteria |
| 7 | §8 | MOF described as amorphous with no CIF; MOFs are crystalline, CIFs exist |
| 8 | §4.1 | The 1.40× synergy was measured for activated charcoal, not a MOF |
| 9 | §11 | Table 11.1 is the nano-AC table unchanged; the header still reads "Nano-AC" |

Each is tagged `SPEC-DEV-n` in the code, shown in the app, and written into
`out/methodology_and_deviations.docx`.

## Commands

```bash
.venv/bin/python engine/run.py                    # spec defaults
.venv/bin/python engine/run.py --mof UiO-66       # another MOF candidate
.venv/bin/python engine/run.py --q-st 6           # zeolite isosteric heat
.venv/bin/python engine/run.py --q-st-mof 8.5     # override the MOF's q_st
.venv/bin/python engine/run.py --approach A       # spec Approach A (with ×1.40)
.venv/bin/python engine/run.py --validate results.csv
.venv/bin/python engine/run.py --emit-web-constants
.venv/bin/python engine/parity_check.py           # Python vs JavaScript, 17,280 values
```

The physics exists in Python and JavaScript so the browser can recompute live.
`parity_check.py` compares both across 432 option combinations and fails on any
disagreement.

## Layout

```
engine/model.py          physics, materials, MOF candidates, 8-run matrix
engine/deliverables.py   xlsx / docx / 300 dpi png export
engine/run.py            CLI
engine/parity_check.py   Python vs JavaScript agreement
engine/serve.py          no-cache local server
web/app.js               the ten chapters
web/preroll.js           cinematic intro
web/lattice.js           FAU / LTA / MOF framework geometry from real topology
web/pore3d.js            inside-the-pore viewer
web/vessel3d.js          vessel and bath
web/charts.js            directly-labelled SVG charts
web/physics.js           shared physics
web/fonts/               IBM Plex (SIL Open Font Licence)
web/vendor/              three.js r185
```
