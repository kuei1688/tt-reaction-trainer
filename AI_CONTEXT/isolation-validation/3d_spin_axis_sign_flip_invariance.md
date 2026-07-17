# 3D Spin-Axis Sign-Flip Invariance

- Status: **pass**
- Date: 2026-07-17T06:26:02.325Z
- Checks: 10 passed, 0 failed
- Scope: 3D physics scope reset acceptance condition #2 — pure-axis, mixed, and sign-reversed omega must all process without depending on a label.
- Interpretation: qualitative representability evidence only; not calibration or physical-truth evidence.

## Result

All sign-flip invariants hold. The contact solver treats omega as a vector state and does not branch on spin labels.

## Checks

| ID | Status | Finding |
|---|---|---|
| SIGN-001 | pass | {"normalImpulse":0.009979200000000002,"omegaA":{"x":15.000000000000002,"y":40,"z":-9.000000000000002},"omegaB":{"x":15.000000000000002,"y":-40,"z":-9.000000000000002},"tangentImpulseA":{"x":-0.000324,"y":0,"z":-0.00054},"tangentImpulseB":{"x":-0.000324,"y":0,"z":-0.00054}} |
| SIGN-002 | pass | {"tangentImpulseA":{"x":0,"y":0,"z":0.000648},"tangentImpulseB":{"x":0,"y":0,"z":-0.000648},"velocityA":{"x":0,"y":1.5200000000000005,"z":0.24},"velocityB":{"x":0,"y":1.5200000000000005,"z":-0.24},"omegaA":{"x":11.999999999999996,"y":0,"z":0},"omegaB":{"x":-11.999999999999996,"y":0,"z":0}} |
| SIGN-003 | pass | {"tangentImpulseA":{"x":-0.000648,"y":0,"z":0},"tangentImpulseB":{"x":0.000648,"y":0,"z":0},"velocityA":{"x":-0.24,"y":1.5200000000000005,"z":0},"velocityB":{"x":0.24,"y":1.5200000000000005,"z":0},"omegaA":{"x":0,"y":0,"z":11.999999999999996},"omegaB":{"x":0,"y":0,"z":-11.999999999999996}} |
| SIGN-004 | pass | {"velocityA":{"x":0.5633520458110965,"y":1.425477818027118,"z":0.272228908586539},"velocityB":{"x":0.5633520458110965,"y":-1.425477818027118,"z":-0.272228908586539},"omegaA":{"x":16.797237952872706,"y":-22.661152534701404,"z":-7.4576487826119475},"omegaB":{"x":16.797237952872706,"y":22.661152534701404,"z":7.4576487826119475}} |
| SIGN-005 | pass | {"velocityA":{"x":0.5633520458110965,"y":1.425477818027118,"z":0.272228908586539},"velocityB":{"x":-0.5633520458110965,"y":1.425477818027118,"z":-0.272228908586539},"omegaA":{"x":16.797237952872706,"y":-22.661152534701404,"z":-7.4576487826119475},"omegaB":{"x":-16.797237952872706,"y":-22.661152534701404,"z":7.4576487826119475}} |
| SIGN-006 | pass | {"velocityA":{"x":0.5633520458110965,"y":1.425477818027118,"z":0.272228908586539},"velocityB":{"x":-0.5633520458110965,"y":-1.425477818027118,"z":0.272228908586539},"omegaA":{"x":16.797237952872706,"y":-22.661152534701404,"z":-7.4576487826119475},"omegaB":{"x":-16.797237952872706,"y":22.661152534701404,"z":-7.4576487826119475}} |
| SIGN-007 | pass | {"omegaA":{"x":9.000000000000002,"y":0,"z":11.999999999999986},"omegaB":{"x":9.000000000000002,"y":0,"z":-11.999999999999986},"energyA":0.0033215400000000017,"energyB":0.0033215400000000017} |
| SIGN-008 | pass | {"note":"two identical BallStates produce identical responses"} |
| SIGN-009 | pass | {"velocity":{"x":0,"y":1.5200000000000005,"z":0},"omega":{"x":0,"y":0,"z":0},"tangentImpulse":{"x":0,"y":0,"z":0}} |
| SIGN-010 | pass | {"omegaForward":{"x":0,"y":0,"z":-15.000000000000002},"omegaMirror":{"x":0,"y":0,"z":15.000000000000002}} |

## Boundary

This report does not change `mainline-v2`, `shared-physics-core.js`, legacy pages, or formal presets. It does not select material parameters and does not use the 2017 external data as an acceptance gate.
