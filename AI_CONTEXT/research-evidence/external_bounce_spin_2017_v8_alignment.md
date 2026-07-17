# V8 External Benchmark Alignment — 2017 JSME bounce/spin

Date: 2026-07-16
Status: `PASS / EVIDENCE ALIGNMENT ONLY / NOT CALIBRATED`

This report records a read-only alignment run against the user-provided
`C:\Users\Kevin\Downloads\2017_G0500606.pdf`, using the handoff CSV and the
current `mainline-v2` BallState/contact boundary. It does not change physics
parameters, `mainline-v2`, shared core, legacy pages, or formal presets.

## Coordinate and unit contract

- `BallState` is mainline-v2 schema 2 with world-space `velocity` in m/s and
  canonical world-space `omega` in rad/s.
- Table normal is `+Y`: `{x: 0, y: 1, z: 0}`.
- The incoming probe travels `+Z` and downward in `Y`:
  `velocity = {x: 0, y: -speed·sin(angle), z: speed·cos(angle)}`.
- The positive incident/reflected angle reported here is the magnitude of
  `atan2(velocity.y, hypot(velocity.x, velocity.z))`; the incoming signed
  angle is negative and the outgoing signed angle is positive.
- The digitized rotation-rate magnitude is mapped to `omega.x`; `omega.y` and
  `omega.z` are explicitly zero for this 2017 top/back-spin probe.
- `1 rps = 2π rad/s = 6.283185307179586 rad/s`. No simulation-scale/time-
  dilation conversion is applied.
- The paper sign is not present in the digitized CSV. Both signs were tested;
  `omega.x = +2π·rps` is retained as the working mapping only because it
  matches the external qualitative speed/spin directions. This is not a claim
  about the paper's original world-coordinate sign.

## Probe method

For each `lower_disk_level` (0, 2, 4, 6), the input angle, rotation rate,
and speed are the midpoint of that level's digitized **before** range. The
response is the raw `mainline-v2/contact-policy.js` table contact result before
post-table flight integration.

The read-only policy observed by the benchmark is:

```text
tableFriction = 0.13
restitution = 0.76
normalModel = compliant
tangentModel = coulomb
dwell = 0.003 s
dt = 0.00025 s, steps = 12, spring = 6000, damping = 4
contactModel = mainline-v2-r1-compliant-3d-table
```

## Working-sign results

| level / regime | input angle | input spin | input omega.x | model after angle | model after spin | model after speed | external after angle / spin / speed | range hits |
|---|---:|---:|---:|---:|---:|---:|---|---|
| 0 high-spin / low-speed | 22.20° | 111.15 rps | +698.38 rad/s | 17.78° | 101.97 rps | 8.975 m/s | 14.2–14.6° / 81.9–95.7 rps / 10.5–16.0 m/s | angle only: 0/3 |
| 2 transitional | 19.75° | 44.50 rps | +279.60 rad/s | 18.76° | 54.13 rps | 8.939 m/s | 18.2–19.9° / 65.1 rps / 9.0 m/s | angle only: 1/3 |
| 4 transitional bridge | 16.45° | 36.90 rps | +231.85 rad/s | 15.36° | 45.54 rps | 9.742 m/s | 17.8–19.1° / 49.8 rps / 8.2–9.3 m/s | 0/3 |
| 6 low-spin / high-speed | 14.65° | 29.70 rps | +186.61 rad/s | 13.55° | 37.38 rps | 9.788 m/s | 17.7–19.4° / 46.3–52.5 rps / 8.8–9.2 m/s | 0/3 |

All four working-sign contacts were classified `sliding`; no `rolling`
regime was reached by the current mainline-v2 candidate for these probes.

## Alignment decision

- Unit and coordinate alignment: **PASS**. The source values are represented
  in real-scale mainline-v2 fields, with exact rps↔rad/s round-tripping.
- Qualitative spin direction: **PASS for the working sign** across all four
  levels (high-spin decreases; transitional and low-spin increase).
- Qualitative translation-speed direction: **PASS for the working sign**
  across all four levels (high-spin increases; the other three decrease).
- Angle direction: only level 0 matches; level 2 is externally overlapping /
  unconstrained, while levels 4 and 6 remain mismatched.
- Absolute after-range comparison: angle `1/4`, rotation `0/4`, speed `0/4`
  for the working sign. These are screening results, not fit residuals.
- Energy direction: all raw contact responses have non-positive energy delta;
  this is an internal contact invariant, not evidence that the external energy
  loss has been matched.

Conclusion: V8 establishes the data/coordinate/unit handoff and preserves a
reproducible mismatch report. It does **not** justify changing friction,
restitution, dwell time, spring/damping, or spin-transfer parameters, and it
does not promote the 2017 figure digitization to calibrated per-ball data.

## Reproduction

```text
node tools/benchmark-external-bounce-spin-v8.js
```

The machine-readable full probe output is produced on stdout by the isolated
benchmark tool. The source digitization remains in
`AI_CONTEXT/external_bounce_spin_2017_figure_digitization.csv`.
