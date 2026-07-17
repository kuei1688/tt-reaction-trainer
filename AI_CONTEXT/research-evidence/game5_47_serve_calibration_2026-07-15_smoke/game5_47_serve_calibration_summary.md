# Game 5 47-Serve Parameter Calibration Summary

Generated: 2026-07-15T15:32:57.140Z
Source SHA-256: `a71e835be0996e48d76dfac74537731d497bc038e39d3ebbc747b11332d328d8`
Preset SHA-256: `d172a5b7315ef2182a676a5e43538e5882725dd67a3483c3cc74718c4b8ebc9c`
Red-line files modified: **no**
Concurrent input mutation detected: **no**

## Scope

This is isolated calibration evidence. It measures the current Game 5 return model against the existing 47 generated serve presets; it is not a claim that the presets or the contact model are fully physically calibrated.

- Serve baseline: 47/47 legal by the local geometric gate.
- Representative set: serve_contact_sidebackspin_004, serve_contact_sidebackspin_002, serve_contact_sidespin_002, serve_contact_sidespin_012, serve_contact_backspin_002, serve_contact_nospin_002.
- Holdout set: 41 presets.
- Rows collected: 230.

## Matrix summary

| Run | Variant | Technique | Rows | Finite | Success | Net | Own table | Out/no landing | Mean net clearance |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| baseline-47 | baseline | attack | 115 | 0 | 0 | 0 | 0 | 0 | n/a |
| baseline-47 | baseline | push | 115 | 115 | 60 | 0 | 0 | 55 | 0.3318 |

## Candidate reading

The leaderboard below is descriptive only. It does not automatically select a production parameter, because direction semantics, visual trajectory, player feel, and attack/push technique validity still require separate review.

### push

| Variant | Rows | Finite | Success | Success rate | Mean |landing x| |
|---|---:|---:|---:|---:|---:|

### attack

| Variant | Rows | Finite | Success | Success rate | Mean |landing x| |
|---|---:|---:|---:|---:|---:|

## Interpretation rules

- Do not promote a candidate from the six representative balls alone; use the holdout rows and manual trajectory review.
- `SIDESPIN_COMPENSATION_C` was already calibrated only for push/chop. Attack rows are sensitivity evidence, not an approved attack calibration.
- A stale snapshot or an expected-model change is not a calibration success.
- If a candidate needs a shared-core or preset-data edit, stop this prototype and hand off the proposed red-line change separately.
