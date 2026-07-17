# Simple 3D Behavior Matrix

- Status: **pass**
- Date: 2026-07-16T12:35:06.428Z
- Scenarios: 7
- Checks: 6 passed, 0 failed
- Interpretation: visible-effect and qualitative-semantic evidence only

## What was tested

Explicit world-space omega cases were sent through the same simple flight and plane-contact equations: zero spin, omega.x positive/negative (topspin-like/backspin-like in the current table frame), omega.y positive/negative (axial sidespin), mixed spin, and a tilted table normal.

## Scenario observations

| Scenario | omega | flight lateral X | bounce normal before -> after | bounce energy delta |
|---|---:|---:|---:|---:|
| zero spin | (0, 0, 0) | 0.00000 m | -2.0000 -> 1.5200 m/s | -4.304e-3 J |
| omega.x + (topspin-like) | (70, 0, 0) | 0.00000 m | -2.0000 -> 1.5200 m/s | -2.648e-3 J |
| omega.x - (backspin-like) | (-70, 0, 0) | 0.00000 m | -2.0000 -> 1.5200 m/s | -6.029e-3 J |
| omega.y + (axial sidespin) | (0, 70, 0) | 0.01686 m | -2.0000 -> 1.5200 m/s | -4.304e-3 J |
| omega.y - (axial sidespin) | (0, -70, 0) | -0.01686 m | -2.0000 -> 1.5200 m/s | -4.304e-3 J |
| mixed omega | (70, 70, -35) | 0.02826 m | -2.0000 -> 1.5200 m/s | -2.762e-3 J |
| mixed omega on tilted table | (70, 70, -35) | 0.02826 m | -2.2489 -> 1.7092 m/s | -3.309e-3 J |

## Checks

| ID | Status | Finding |
|---|---|---|
| BEHAVIOR-001 | pass | {"scenarioCount":7} |
| BEHAVIOR-002 | pass | {"lateralDisplacementX":0} |
| BEHAVIOR-003 | pass | {"positive":0.016860982691418447,"negative":-0.016860982691418447,"mirrorResidual":0} |
| BEHAVIOR-004 | pass | {"positiveDelta":0.13572073127962136,"negativeDelta":-0.0011747263471753033} |
| BEHAVIOR-005 | pass | {"positiveOmegaY":70,"negativeOmegaY":-70,"tangentImpulseMatchesZeroSpin":true} |
| BEHAVIOR-006 | pass | {"normal":{"x":0.2503256351262562,"y":0.9512374134797735,"z":-0.18023445729090448},"beforeNormal":-2.248925505974286,"afterNormal":1.7091833845404572,"omegaAfter":{"x":93.5479106550983,"y":62.00227478889419,"z":-44.50478492653302}} |

## Interpretation

The matrix confirms that the simple model produces distinct, sign-consistent spin effects while keeping table contact passive. It does not establish that the chosen magnitudes or coefficients match a particular ball, table, racket, or external report.

## Boundary

This is an isolated benchmark/validation artifact. It does not modify mainline-v2, shared-physics-core.js, legacy pages, or formal presets, and it is not a calibration gate.
