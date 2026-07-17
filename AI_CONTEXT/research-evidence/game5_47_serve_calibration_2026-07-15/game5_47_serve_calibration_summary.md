# Game 5 47-Serve Parameter Calibration — Consolidated Report

Generated: 2026-07-15T15:59:13.985Z
Source SHA-256: `a71e835be0996e48d76dfac74537731d497bc038e39d3ebbc747b11332d328d8`
Preset SHA-256: `d172a5b7315ef2182a676a5e43538e5882725dd67a3483c3cc74718c4b8ebc9c`
Red-line files modified: **no**
Concurrent input mutation detected: **no**

## Execution result

The calibration line completed as four separate runs: 47-serve baseline, six-serve coarse sweep, six-serve timing sweep, and 41-serve holdout on five selected candidates. The serve inputs stayed fixed throughout.

- Serve legal gate: **47/47**.
- Representative set: serve_contact_sidebackspin_004, serve_contact_sidebackspin_002, serve_contact_sidespin_002, serve_contact_sidespin_012, serve_contact_backspin_002, serve_contact_nospin_002.
- Holdout set: 41 presets.
- Total calibration rows: 1358.

## Aggregated matrix

| Run | Variant | Technique | Delay | Rows | Finite | Success | Net | Out/no landing | Mean net clearance |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| baseline-47 | baseline | attack | 100 ms | 115 | 115 | 0 | 115 | 0 | -0.0871 |
| baseline-47 | baseline | push | 100 ms | 115 | 115 | 60 | 0 | 55 | 0.3318 |
| coarse-representative-6 | attack-side-c-2.4 | attack | 100 ms | 18 | 18 | 0 | 18 | 0 | -0.1168 |
| coarse-representative-6 | attack-side-c-4.4 | attack | 100 ms | 18 | 18 | 0 | 18 | 0 | -0.1168 |
| coarse-representative-6 | attack-speed-y-0.3 | attack | 100 ms | 18 | 18 | 6 | 9 | 3 | -0.0477 |
| coarse-representative-6 | attack-speed-y-0.6 | attack | 100 ms | 18 | 18 | 0 | 9 | 9 | -0.0152 |
| coarse-representative-6 | attack-speed-y-0 | attack | 100 ms | 18 | 18 | 6 | 9 | 3 | -0.0847 |
| coarse-representative-6 | attack-speed-z--0.8 | attack | 100 ms | 18 | 18 | 0 | 18 | 0 | -0.1419 |
| coarse-representative-6 | attack-speed-z--1.2 | attack | 100 ms | 18 | 18 | 0 | 18 | 0 | -0.0915 |
| coarse-representative-6 | attack-tilt-y-0.2 | attack | 100 ms | 18 | 18 | 0 | 9 | 9 | 0.0565 |
| coarse-representative-6 | attack-tilt-y-0 | attack | 100 ms | 18 | 18 | 0 | 18 | 0 | -0.3900 |
| coarse-representative-6 | baseline | attack | 100 ms | 18 | 18 | 0 | 18 | 0 | -0.1168 |
| coarse-representative-6 | baseline | push | 100 ms | 18 | 18 | 6 | 0 | 12 | 0.4202 |
| coarse-representative-6 | push-blend-0.55 | push | 100 ms | 18 | 18 | 6 | 0 | 12 | 0.5333 |
| coarse-representative-6 | push-blend-0.66 | push | 100 ms | 18 | 18 | 6 | 0 | 12 | 0.3059 |
| coarse-representative-6 | push-drive-0.48 | push | 100 ms | 18 | 18 | 6 | 0 | 12 | 0.3820 |
| coarse-representative-6 | push-drive-0.64 | push | 100 ms | 18 | 18 | 6 | 0 | 12 | 0.4525 |
| coarse-representative-6 | push-lift-0.24 | push | 100 ms | 18 | 18 | 6 | 0 | 12 | 0.3887 |
| coarse-representative-6 | push-lift-0.32 | push | 100 ms | 18 | 18 | 6 | 0 | 12 | 0.4519 |
| coarse-representative-6 | push-side-c-2.9 | push | 100 ms | 18 | 18 | 6 | 0 | 12 | 0.4146 |
| coarse-representative-6 | push-side-c-3.8 | push | 100 ms | 18 | 18 | 6 | 0 | 12 | 0.4251 |
| holdout-41 | attack-speed-y-0.3 | attack | 100 ms | 101 | 101 | 32 | 39 | 30 | -0.0333 |
| holdout-41 | attack-speed-y-0 | attack | 100 ms | 101 | 101 | 4 | 73 | 24 | -0.0597 |
| holdout-41 | baseline | attack | 100 ms | 101 | 101 | 0 | 101 | 0 | -0.0816 |
| holdout-41 | baseline | push | 100 ms | 101 | 101 | 55 | 0 | 46 | 0.3204 |
| holdout-41 | push-blend-0.66 | push | 100 ms | 101 | 101 | 55 | 0 | 46 | 0.2529 |
| holdout-41 | push-side-c-2.9 | push | 100 ms | 101 | 101 | 64 | 0 | 37 | 0.3181 |
| timing-representative-6 | baseline | attack | 100 ms | 18 | 18 | 0 | 18 | 0 | -0.1168 |
| timing-representative-6 | baseline | attack | 120 ms | 18 | 18 | 0 | 18 | 0 | -0.1354 |
| timing-representative-6 | baseline | attack | 140 ms | 18 | 18 | 0 | 18 | 0 | -0.1707 |
| timing-representative-6 | baseline | attack | 60 ms | 18 | 18 | 6 | 9 | 3 | -0.0664 |
| timing-representative-6 | baseline | attack | 80 ms | 18 | 18 | 0 | 18 | 0 | -0.0937 |
| timing-representative-6 | baseline | push | 100 ms | 18 | 18 | 6 | 0 | 12 | 0.4202 |
| timing-representative-6 | baseline | push | 120 ms | 18 | 18 | 6 | 0 | 12 | 0.4202 |
| timing-representative-6 | baseline | push | 140 ms | 18 | 18 | 6 | 0 | 12 | 0.4169 |
| timing-representative-6 | baseline | push | 60 ms | 18 | 18 | 6 | 0 | 12 | 0.4117 |
| timing-representative-6 | baseline | push | 80 ms | 18 | 18 | 6 | 0 | 12 | 0.4182 |

## Key findings

1. **Serve inputs are stable for this experiment:** all 47 current presets passed the local legal-serve geometric gate.
2. **Push baseline generalizes better than attack baseline:** baseline push reached 55/101 on holdout; baseline attack reached 0/101 and all 101 cases were classified as net.
3. **Push side compensation candidate:** `SIDESPIN_COMPENSATION_C=2.9` reached 64/101 on holdout versus 55/101 baseline. This is evidence for a candidate range, not permission to overwrite the deployed 3.4 yet.
4. **Attack vertical swing candidate:** `techniqueVel.y=0.3` reached 32/101 on holdout versus 0/101 baseline; `techniqueVel.y=0` reached 4/101. The improvement is real in this model but still leaves many net/out cases.
5. **Timing is a major attack sensitivity:** on the six representative clips, attack reached 6/18 at 60 ms but 0/18 at 80–140 ms; push stayed 6/18 across the tested delays.
6. **Direction input needs a separate semantic review:** many attack rows were unchanged across left/none/right, so the current attack path does not yet demonstrate a useful direction response for every side-spin case.

## What this means

The current Game 5 attack path is not MVP-ready as a calibrated return technique. The next useful work is a narrower attack contact/timing calibration around `techniqueVel.y`, contact timing, and direction coupling; it is not a reason to regenerate the 47 serves or to migrate the entire repo to true 3D sidespin now.

The push result supports further validation of `C=2.9`, but does not by itself justify changing `game5.html`: the candidate must first receive trajectory/feel review and then be rerun through the readiness validator.

## Boundaries

- This report is isolated prototype evidence, not physical truth or Trainer readiness.
- No red-line file was modified by the calibration tool.
- No parameter was automatically promoted to production.
- Attack `SIDESPIN_COMPENSATION_C` results are sensitivity evidence only; current production compensation was calibrated for push/chop.
