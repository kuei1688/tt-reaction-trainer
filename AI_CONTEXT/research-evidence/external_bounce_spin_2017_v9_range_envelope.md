# V9 Fixed-Parameter Uncertainty Envelope — 2017 JSME bounce/spin

Date: 2026-07-16
Status: `PASS / INPUT-UNCERTAINTY SCREEN / NOT CALIBRATED`

V9 tests whether the digitized **before** ranges alone can explain the V8
after-contact mismatch. It uses the current mainline-v2 table contact policy
without fitting or changing any parameter, formal page, shared core, or
preset.

## Method

- Source: 24 rows from `external_bounce_spin_2017_figure_digitization.csv`.
- Levels: `lower_disk_level` 0, 2, 4, 6.
- Each non-degenerate before range is sampled at 9 inclusive grid points;
  scalar ranges contribute one point. This gives 81, 81, 729, 729 samples per
  sign, or **3,240 samples total** for both `omega.x` signs.
- Input mapping is unchanged from V8:
  `velocity = {x:0, y:-speed·sin(angle), z:speed·cos(angle)}` and
  `omega = {x: sign·2π·rps, y:0, z:0}` in real-scale schema-2 BallState.
- Output is the raw table-contact response before post-table flight
  integration.
- `envelope intersection` means the sampled min/max output interval overlaps
  the external after range. `sample hit` means an actual grid point is inside
  the range. `joint hit` means one grid point is inside all three after ranges.

The fixed table policy is the current read-only mainline-v2 candidate:

```text
tableFriction = 0.13
restitution = 0.76
normalModel = compliant
tangentModel = coulomb
dwell = 0.003 s
dt = 0.00025 s, steps = 12, spring = 6000, damping = 4
contactModel = mainline-v2-r1-compliant-3d-table
```

## Working sign: `omega.x = +2π·rps`

| level / regime | sampled model angle vs external | sampled model spin vs external | sampled model speed vs external | joint hits |
|---|---|---|---|---:|
| 0 high-spin / low-speed | 17.177–18.387° vs 14.2–14.6° — no intersection / 0 hits | 92.408–111.536 rps vs 81.9–95.7 — intersection / 18 hits | 8.963–8.986 m/s vs 10.5–16.0 — no intersection / 0 hits | 0 |
| 2 transitional | 15.408–22.226° vs 18.2–19.9° — intersection / 18 hits | 52.303–56.026 rps vs 65.1 — no intersection / 0 hits | 8.475–9.417 m/s vs 9.0 — intersection / 0 hits | 0 |
| 4 transitional bridge | 15.105–15.611° vs 17.8–19.1° — no intersection / 0 hits | 36.691–54.392 rps vs 49.8 — intersection / 0 hits | 9.591–9.894 m/s vs 8.2–9.3 — no intersection / 0 hits | 0 |
| 6 low-spin / high-speed | 13.204–13.900° vs 17.7–19.4° — no intersection / 0 hits | 36.686–38.084 rps vs 46.3–52.5 — no intersection / 0 hits | 9.491–10.086 m/s vs 8.8–9.2 — no intersection / 0 hits | 0 |

Working-sign scalar envelope intersections: angle `1/4` levels, rotation
`2/4`, speed `1/4`. There are **zero joint matches**.

All working-sign samples remain `sliding`; none reaches `rolling`. All 3,240
samples have non-positive kinetic-energy delta.

## Negative-sign result

The `omega.x < 0` sweep also has zero joint matches. It lowers the high-spin
speed response to about `7.494–7.557 m/s`, and produces lower spin than the
working sign in levels 2, 4, and 6. It is therefore not a better explanation
of the external regime under the current fixed policy.

## Decision

Input range uncertainty is **not sufficient** to explain the V8 mismatch:

- high-spin / low-speed cannot reach the external speed or angle envelope;
- low-spin / high-speed cannot reach the external angle or spin envelope;
- no level has one input sample matching angle, rotation, and speed together;
- the current contact solver remains entirely in `sliding`, but the 2017 PDF
  does not report a sliding/rolling label; this is a model diagnostic only.

This is a diagnostic gate, not a calibration result. Do not change friction,
restitution, dwell, spring/damping, or spin-transfer parameters based on V9.
The next R1-preparatory task should be a coordinate/measurement-semantics and
contact-regime review, still isolated: verify the paper's trajectory-angle and
translation-speed definitions against the canonical world frame, then decide
whether the candidate contact model can represent the observed regime before
proposing any parameter change.

## Reproduction

```text
node tools/benchmark-external-bounce-spin-v9-range-envelope.js
```

The machine-readable aggregate output is stored in
`AI_CONTEXT/external_bounce_spin_2017_v9_range_envelope.json`.
