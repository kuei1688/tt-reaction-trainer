# 3D BallState Cross-Layer Contract

- Status: **pass**
- Date: 2026-07-17T06:26:02.825Z
- Checks: 10 passed, 0 failed
- Scope: 3D physics scope reset acceptance condition #5 — the same BallState is read consistently by flight, table contact, racket contact, and the display layer; display layer must not write back.
- Interpretation: qualitative representability evidence only; not calibration or physical-truth evidence.

## Result

All cross-layer contract invariants hold. Layers consume BallState read-only; the display layer does not write back; the legacy adapter is the single legacy entry point.

## Checks

| ID | Status | Finding |
|---|---|---|
| CROSS-001 | pass | {"snapshot":{"position":{"x":0.1,"y":0.8,"z":-0.4},"velocity":{"x":1.1,"y":-2.2,"z":0.3},"omega":{"x":14,"y":-9,"z":22},"mass":0.0027,"inertia":7.2e-7},"after":{"position":{"x":0.1,"y":0.8,"z":-0.4},"velocity":{"x":1.1,"y":-2.2,"z":0.3},"omega":{"x":14,"y":-9,"z":22},"mass":0.0027,"inertia":7.2e-7}} |
| CROSS-002 | pass | {"snapshot":{"position":{"x":0.1,"y":0.05,"z":-0.2},"velocity":{"x":0.4,"y":-2,"z":0.7},"omega":{"x":25,"y":-18,"z":33},"mass":0.0027,"inertia":7.2e-7},"after":{"position":{"x":0.1,"y":0.05,"z":-0.2},"velocity":{"x":0.4,"y":-2,"z":0.7},"omega":{"x":25,"y":-18,"z":33},"mass":0.0027,"inertia":7.2e-7}} |
| CROSS-003 | pass | {"snapshot":{"position":{"x":0.1,"y":0.05,"z":-0.2},"velocity":{"x":0.4,"y":-2,"z":0.7},"omega":{"x":25,"y":-18,"z":33},"mass":0.0027,"inertia":7.2e-7},"after":{"position":{"x":0.1,"y":0.05,"z":-0.2},"velocity":{"x":0.4,"y":-2,"z":0.7},"omega":{"x":25,"y":-18,"z":33},"mass":0.0027,"inertia":7.2e-7}} |
| CROSS-004 | pass | {"snapshot":{"position":{"x":0,"y":0.5,"z":0.5},"velocity":{"x":0,"y":1.5,"z":1.2},"omega":{"x":20,"y":5,"z":-10},"mass":0.0027,"inertia":7.2e-7},"after":{"position":{"x":0,"y":0.5,"z":0.5},"velocity":{"x":0,"y":1.5,"z":1.2},"omega":{"x":20,"y":5,"z":-10},"mass":0.0027,"inertia":7.2e-7}} |
| CROSS-005 | pass | {"snapshot":{"position":{"x":0,"y":1,"z":-1.1},"velocity":{"x":0.1,"y":3.8,"z":0.95},"omega":{"x":42,"y":70,"z":-15},"mass":0.0027,"inertia":7.2e-7},"after":{"position":{"x":0,"y":1,"z":-1.1},"velocity":{"x":0.1,"y":3.8,"z":0.95},"omega":{"x":42,"y":70,"z":-15},"mass":0.0027,"inertia":7.2e-7}} |
| CROSS-006 | pass | {"omega":{"x":31,"y":-18,"z":1.1999999999999957},"fields":["position","velocity","omega","mass","inertia"]} |
| CROSS-007 | pass | {"originalSnapshot":{"position":{"x":0.1,"y":0.05,"z":-0.2},"velocity":{"x":0.4,"y":-2,"z":0.7},"omega":{"x":25,"y":-18,"z":33},"mass":0.0027,"inertia":7.2e-7},"cloneAfterMutation":{"position":{"x":99,"y":0.05,"z":-0.2},"velocity":{"x":0.4,"y":-99,"z":0.7},"omega":{"x":25,"y":-18,"z":99},"mass":0.999,"inertia":7.2e-7}} |
| CROSS-008 | pass | {"schema":2,"omega":{"x":25,"y":0,"z":10},"rejectedNull":true,"rejectedMixed":true} |
| CROSS-009 | pass | {"renderInfo":{"posX":0.1,"posY":0.8,"posZ":-0.4,"velX":1.1,"velY":-2.2,"velZ":0.3,"omegaX":14,"omegaY":-9,"omegaZ":22,"speed":2.4779023386727737,"omegaNorm":27.586228448267445},"after":{"position":{"x":0.1,"y":0.8,"z":-0.4},"velocity":{"x":1.1,"y":-2.2,"z":0.3},"omega":{"x":14,"y":-9,"z":22},"mass":0.0027,"inertia":7.2e-7}} |
| CROSS-010 | pass | {"filesChecked":9,"violations":[]} |

## Boundary

This report does not change `mainline-v2`, `shared-physics-core.js`, legacy pages, or formal presets. It does not select material parameters and does not use the 2017 external data as an acceptance gate.
