# Game 5 47-Serve Parameter Calibration Summary

Generated: 2026-07-15T15:36:16.668Z
Source SHA-256: `a71e835be0996e48d76dfac74537731d497bc038e39d3ebbc747b11332d328d8`
Preset SHA-256: `d172a5b7315ef2182a676a5e43538e5882725dd67a3483c3cc74718c4b8ebc9c`
Red-line files modified: **no**
Concurrent input mutation detected: **no**

## Scope

This is isolated calibration evidence. It measures the current Game 5 return model against the existing 47 generated serve presets; it is not a claim that the presets or the contact model are fully physically calibrated.

- Serve baseline: 47/47 legal by the local geometric gate.
- Representative set: serve_contact_sidebackspin_004, serve_contact_sidebackspin_002, serve_contact_sidespin_002, serve_contact_sidespin_012, serve_contact_backspin_002, serve_contact_nospin_002.
- Holdout set: 41 presets.
- Rows collected: 342.

## Matrix summary

| Run | Variant | Technique | Rows | Finite | Success | Net | Own table | Out/no landing | Mean net clearance |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| coarse-representative-6 | attack-side-c-2.4 | attack | 18 | 18 | 0 | 18 | 0 | 0 | -0.1168 |
| coarse-representative-6 | attack-side-c-4.4 | attack | 18 | 18 | 0 | 18 | 0 | 0 | -0.1168 |
| coarse-representative-6 | attack-speed-y-0.3 | attack | 18 | 18 | 6 | 9 | 0 | 3 | -0.0477 |
| coarse-representative-6 | attack-speed-y-0.6 | attack | 18 | 18 | 0 | 9 | 0 | 9 | -0.0152 |
| coarse-representative-6 | attack-speed-y-0 | attack | 18 | 18 | 6 | 9 | 0 | 3 | -0.0847 |
| coarse-representative-6 | attack-speed-z--0.8 | attack | 18 | 18 | 0 | 18 | 0 | 0 | -0.1419 |
| coarse-representative-6 | attack-speed-z--1.2 | attack | 18 | 18 | 0 | 18 | 0 | 0 | -0.0915 |
| coarse-representative-6 | attack-tilt-y-0.2 | attack | 18 | 18 | 0 | 9 | 0 | 9 | 0.0565 |
| coarse-representative-6 | attack-tilt-y-0 | attack | 18 | 18 | 0 | 18 | 0 | 0 | -0.3900 |
| coarse-representative-6 | baseline | attack | 18 | 18 | 0 | 18 | 0 | 0 | -0.1168 |
| coarse-representative-6 | baseline | push | 18 | 18 | 6 | 0 | 0 | 12 | 0.4202 |
| coarse-representative-6 | push-blend-0.55 | push | 18 | 18 | 6 | 0 | 0 | 12 | 0.5333 |
| coarse-representative-6 | push-blend-0.66 | push | 18 | 18 | 6 | 0 | 0 | 12 | 0.3059 |
| coarse-representative-6 | push-drive-0.48 | push | 18 | 18 | 6 | 0 | 0 | 12 | 0.3820 |
| coarse-representative-6 | push-drive-0.64 | push | 18 | 18 | 6 | 0 | 0 | 12 | 0.4525 |
| coarse-representative-6 | push-lift-0.24 | push | 18 | 18 | 6 | 0 | 0 | 12 | 0.3887 |
| coarse-representative-6 | push-lift-0.32 | push | 18 | 18 | 6 | 0 | 0 | 12 | 0.4519 |
| coarse-representative-6 | push-side-c-2.9 | push | 18 | 18 | 6 | 0 | 0 | 12 | 0.4146 |
| coarse-representative-6 | push-side-c-3.8 | push | 18 | 18 | 6 | 0 | 0 | 12 | 0.4251 |

## Candidate reading

The leaderboard below is descriptive only. It does not automatically select a production parameter, because direction semantics, visual trajectory, player feel, and attack/push technique validity still require separate review.

### push

| Variant | Rows | Finite | Success | Success rate | Mean |landing x| |
|---|---:|---:|---:|---:|---:|
| push SIDESPIN_COMPENSATION_C=2.9 | 18 | 18 | 6 | 0.3333 | 0.7823 |
| push PADDLE_BLEND=0.66 | 18 | 18 | 6 | 0.3333 | 0.8179 |
| push PUSH_DRIVE_BASE=0.64 | 18 | 18 | 6 | 0.3333 | 0.8474 |
| push PUSH_LIFT_BASE=0.24 | 18 | 18 | 6 | 0.3333 | 0.8507 |
| deployed baseline | 18 | 18 | 6 | 0.3333 | 0.8565 |

### attack

| Variant | Rows | Finite | Success | Success rate | Mean |landing x| |
|---|---:|---:|---:|---:|---:|
| attack techniqueVel.y=0 | 18 | 18 | 6 | 0.3333 | 0.5692 |
| attack techniqueVel.y=0.3 | 18 | 18 | 6 | 0.3333 | 0.5709 |
| attack racketNormalTiltY=0 | 18 | 18 | 0 | 0.0000 | 0.5402 |
| attack techniqueVel.z=-1.2 | 18 | 18 | 0 | 0.0000 | 0.5542 |
| deployed baseline | 18 | 18 | 0 | 0.0000 | 0.5560 |

## Interpretation rules

- Do not promote a candidate from the six representative balls alone; use the holdout rows and manual trajectory review.
- `SIDESPIN_COMPENSATION_C` was already calibrated only for push/chop. Attack rows are sensitivity evidence, not an approved attack calibration.
- A stale snapshot or an expected-model change is not a calibration success.
- If a candidate needs a shared-core or preset-data edit, stop this prototype and hand off the proposed red-line change separately.
