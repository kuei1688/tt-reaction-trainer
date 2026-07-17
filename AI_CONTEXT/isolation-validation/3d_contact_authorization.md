# 3D Contact Authorization

- Status: **pass**
- Date: 2026-07-17T06:26:02.681Z
- Checks: 8 passed, 0 failed
- Scope: 3D physics scope reset acceptance condition #4 — tangent response must not invent unauthorized lateral velocity or energy.
- Interpretation: qualitative representability evidence only; not calibration or physical-truth evidence.

## Result

All contact-authorization invariants hold. The solver does not invent tangent COM velocity from axial spin, does not accelerate the COM past a moving surface, and confines tangent response to the tangent plane.

## Checks

| ID | Status | Finding |
|---|---|---|
| AUTH-001 | pass | {"velocity":{"x":0,"y":1.5200000000000005,"z":0},"tangentImpulse":{"x":0,"y":0,"z":0}} |
| AUTH-002 | pass | {"velocity":{"x":0,"y":1.5200000000000005,"z":0},"omega":{"x":0,"y":60,"z":0},"tangentImpulse":{"x":0,"y":0,"z":0}} |
| AUTH-003 | pass | {"surfaceVelocity":{"x":2,"y":0,"z":0},"comVelocityAfter":{"x":0.528,"y":0.3800000000000001,"z":0},"contactPointTangentBefore":{"x":-2,"y":0,"z":0},"contactPointTangentAfter":{"x":-0.6799999999999997,"y":0,"z":0}} |
| AUTH-004 | pass | {"tangentBefore":{"x":1.5,"y":0,"z":0},"tangentAfter":{"x":1.39,"y":0,"z":0}} |
| AUTH-005 | pass | {"cases":[{"case":0,"before":0.006817140000000001,"after":0.004223541600000001,"delta":-0.0025935984},{"case":1,"before":0.006963660000000001,"after":0.0032654149081613754,"delta":-0.0036982450918386254},{"case":2,"before":0.01224234,"after":0.006522098400000003,"delta":-0.005720241599999998},{"case":3,"before":0.010842660000000002,"after":0.0076077000282166315,"delta":-0.0032349599717833707},{"case":4,"before":0.0043965,"after":0.003635774999999999,"delta":-0.0007607250000000012}]} |
| AUTH-006 | pass | {"normal":{"x":0.23955722831328338,"y":0.9382658108936933,"z":-0.24953877949300354},"beforeNormal":-1.9286353189455256,"afterNormal":1.388617429640779,"tangentImpulseDotNormal":6.776263578034403e-20,"deltaVelocityNormal":3.3172527485863044,"expectedDelta":3.3172527485863044} |
| AUTH-007 | pass | {"tangentImpulse":{"x":0,"y":0,"z":0},"velocity":{"x":0,"y":1.9000000000000004,"z":0},"omega":{"x":0,"y":35,"z":0}} |
| AUTH-008 | pass | {"surfaceVel":{"x":0,"y":0.5,"z":0},"beforeNormal":-2,"afterNormal":1.5200000000000005,"tangentImpulse":{"x":0,"y":0,"z":0}} |

## Boundary

This report does not change `mainline-v2`, `shared-physics-core.js`, legacy pages, or formal presets. It does not select material parameters and does not use the 2017 external data as an acceptance gate.
