# Game 5 Attack Narrow Calibration Summary

Generated: 2026-07-15T22:08:01.811Z
Source SHA-256: `a71e835be0996e48d76dfac74537731d497bc038e39d3ebbc747b11332d328d8`
Preset SHA-256: `d172a5b7315ef2182a676a5e43538e5882725dd67a3483c3cc74718c4b8ebc9c`
Red-line files modified: **no**
Concurrent input mutation detected: **no**

## Scope

This is an isolated attack sensitivity experiment over the existing 47 serve presets. It compares vertical attack technique velocity and contact timing; it is not a production parameter recommendation or a physical-truth claim.

- Serve baseline: 47/47 legal by the local geometric gate.
- Representative set: serve_contact_sidebackspin_004, serve_contact_sidebackspin_002, serve_contact_sidespin_002, serve_contact_sidespin_012, serve_contact_backspin_002, serve_contact_nospin_002.
- Holdout set: 41 presets.
- Rows collected: 951.

## Representative sweep

| Variant | Delay | Rows | Finite | Success | Net | Own table | Out/no landing | Mean net clearance |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| attack-narrow-y--0.1 | 40 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0386 |
| attack-narrow-y--0.234 | 40 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0522 |
| attack-narrow-y-0 | 40 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0287 |
| attack-narrow-y-0.15 | 40 | 18 | 18 | 0 | 9 | 0 | 9 | -0.0153 |
| attack-narrow-y-0.3 | 40 | 18 | 18 | 0 | 9 | 0 | 9 | -0.0037 |
| attack-narrow-y-0.45 | 40 | 18 | 18 | 0 | 9 | 0 | 9 | 0.0063 |
| attack-narrow-y--0.1 | 50 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0442 |
| attack-narrow-y--0.234 | 50 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0583 |
| attack-narrow-y-0 | 50 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0339 |
| attack-narrow-y-0.15 | 50 | 18 | 18 | 0 | 9 | 0 | 9 | -0.0204 |
| attack-narrow-y-0.3 | 50 | 18 | 18 | 0 | 9 | 0 | 9 | -0.0077 |
| attack-narrow-y-0.45 | 50 | 18 | 18 | 0 | 9 | 0 | 9 | 0.0032 |
| attack-narrow-y--0.1 | 60 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0516 |
| attack-narrow-y--0.234 | 60 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0664 |
| attack-narrow-y-0 | 60 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0406 |
| attack-narrow-y-0.15 | 60 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0255 |
| attack-narrow-y-0.3 | 60 | 18 | 18 | 0 | 9 | 0 | 9 | -0.0125 |
| attack-narrow-y-0.45 | 60 | 18 | 18 | 0 | 9 | 0 | 9 | -0.0005 |
| attack-narrow-y--0.1 | 70 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0597 |
| attack-narrow-y--0.234 | 70 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0753 |
| attack-narrow-y-0 | 70 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0481 |
| attack-narrow-y-0.15 | 70 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0320 |
| attack-narrow-y-0.3 | 70 | 18 | 18 | 0 | 9 | 0 | 9 | -0.0175 |
| attack-narrow-y-0.45 | 70 | 18 | 18 | 0 | 9 | 0 | 9 | -0.0051 |
| attack-narrow-y--0.1 | 80 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0768 |
| attack-narrow-y--0.234 | 80 | 18 | 18 | 0 | 18 | 0 | 0 | -0.0937 |
| attack-narrow-y-0 | 80 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0641 |
| attack-narrow-y-0.15 | 80 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0475 |
| attack-narrow-y-0.3 | 80 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0309 |
| attack-narrow-y-0.45 | 80 | 18 | 18 | 0 | 9 | 0 | 9 | -0.0160 |
| attack-narrow-y--0.1 | 100 | 18 | 18 | 0 | 18 | 0 | 0 | -0.0986 |
| attack-narrow-y--0.234 | 100 | 18 | 18 | 0 | 18 | 0 | 0 | -0.1168 |
| attack-narrow-y-0 | 100 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0847 |
| attack-narrow-y-0.15 | 100 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0648 |
| attack-narrow-y-0.3 | 100 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0477 |
| attack-narrow-y-0.45 | 100 | 18 | 18 | 6 | 9 | 0 | 3 | -0.0306 |

## Holdout candidates

The top three representative candidates were replayed against the 41-ball holdout. The ranking is only a screening heuristic: success rate is favored, with small penalties for net and out/no-landing outcomes.

| Candidate | Representative score | Holdout rows | Finite | Success | Net | Own table | Out/no landing | Mean |landing x| |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| attack techniqueVel.y=0.15 @ 60ms | 0.2500 | 101 | 101 | 32 | 39 | 0 | 30 | 0.6700 |
| attack techniqueVel.y=0 @ 40ms | 0.2500 | 101 | 101 | 32 | 39 | 0 | 30 | 0.6578 |
| attack techniqueVel.y=0.45 @ 100ms | 0.2500 | 101 | 101 | 32 | 39 | 0 | 30 | 0.6978 |

## Decision

Do not automatically promote an attack candidate into `game5.html`. Use the holdout result to choose a small set for visual trajectory and player-feel review; direction coupling and racket-normal tuning remain separate calibration questions.
