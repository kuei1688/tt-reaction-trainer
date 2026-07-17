# Qualitative 3D Physics Validation

- Status: **pass**
- Date: 2026-07-17T06:23:36.105Z
- Checks: 11 passed, 0 failed
- Scope: schema-2 world-space BallState/omega and isolated 3D contact semantics
- Interpretation: qualitative representability evidence only; not calibration or physical-truth evidence

## Result

All invariant checks passed. The current isolated 3D kernel is semantically representable for the tested cases.

## Checks

| ID | Status | Finding |
|---|---|---|
| STATE-001 | pass | {"omega":{"x":14,"y":-9,"z":22},"mass":0.0027,"inertia":7.2e-7} |
| CONTACT-001 | pass | {"actual":{"x":1.5879999999999999,"y":-2.1350000000000002,"z":-0.06899999999999995},"expected":{"x":1.5879999999999999,"y":-2.1350000000000002,"z":-0.06899999999999995}} |
| CONTACT-002 | pass | {"beforeNormal":-2.1,"afterNormal":1.596,"epsilon":0.76,"tangentImpulse":{"x":-0.00041040000000000006,"y":0,"z":-0.00004320000000000004}} |
| CONTACT-003 | pass | {"normal":{"x":0.3331634126752339,"y":0.9187233501044328,"z":-0.21201308079333064},"beforeNormal":-2.3999999999999995,"afterNormal":1.727999999999999,"tangentImpulse":{"x":0.0004399329954969428,"y":-0.00018278473009161985,"z":-0.00010074388509229974}} |
| CONTACT-004 | pass | {"beforeOmega":{"x":0,"y":32,"z":0},"afterOmega":{"x":0,"y":32,"z":0},"tangentImpulse":{"x":0,"y":0,"z":0}} |
| CONTACT-005 | pass | {"beforeVelocity":{"x":0,"y":-2,"z":0},"afterVelocity":{"x":0,"y":1.5200000000000005,"z":0.112},"beforeOmega":{"x":14,"y":0,"z":0},"afterOmega":{"x":5.6,"y":0,"z":0},"tangentImpulse":{"x":0,"y":0,"z":0.00030240000000000003}} |
| ENERGY-001 | pass | {"cases":[{"case":0,"before":0.006817140000000001,"after":0.0043141493468752375,"delta":-0.0025029906531247635},{"case":1,"before":0.006963660000000001,"after":0.003766433176637095,"delta":-0.0031972268233629057},{"case":2,"before":0.01224234,"after":0.0066820689006025415,"delta":-0.005560271099397459},{"case":3,"before":0.010842660000000002,"after":0.01073578323984673,"delta":-0.00010687676015327247}]} |
| INVARIANT-001 | pass | {"normalImpulse":0.007977282653020522,"velocityError":4.965068306494546e-16,"omegaError":2.5121479338940402e-14} |
| INVARIANT-002 | pass | {"normalImpulse":0.007977282653020522,"reflectedNormalImpulse":0.007977282653020522} |
| FLIGHT-001 | pass | {"actual":{"x":-0.010199999999999999,"y":0.10890000000000001,"z":0.039},"reverse":{"x":0.010199999999999999,"y":-0.10890000000000001,"z":-0.039},"parallel":{"x":-1.3322676295501879e-18,"y":0,"z":-2.6645352591003758e-18}} |
| V2-CONTACT-001 | pass | {"frictionRegime":"sliding","energyDelta":-0.00299412722882286,"normalImpulse":0.009373990823373604} |

## Boundary

This report does not change `mainline-v2`, `shared-physics-core.js`, legacy pages, or formal presets. It does not select material parameters and does not use the 2017 external data as an acceptance gate.
