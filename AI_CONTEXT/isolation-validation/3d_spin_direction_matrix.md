# 3D Spin Direction Matrix

- Status: **pass**
- Date: 2026-07-17T06:26:02.188Z
- Checks: 10 passed, 0 failed
- Scope: 3D physics scope reset acceptance condition #1 — zero/topspin/backspin/sidespin produce reasonable, distinguishable contact results.
- Interpretation: qualitative representability evidence only; not calibration or physical-truth evidence.

## Result

All direction-matrix invariants hold. Each pure-axis spin produces a finite, legal first bounce, and the five scenarios are pairwise distinguishable by their first-bounce kinematics.

## Scenarios

| Scenario | First bounce z | First bounce vz-after | First bounce vx-after | First bounce omega-after |
|---|---:|---:|---:|---|
| zero spin | -0.3212 | 0.9000 | 0.0000 | (45.00,0.00,0.00) |
| pure topspin (omega.x +) | -0.3234 | 1.2056 | 0.0000 | (60.28,0.00,0.00) |
| pure backspin (omega.x -) | -0.3197 | 0.7789 | 0.0000 | (15.92,0.00,0.00) |
| left sidespin (omega.y +, curves right) | -0.3221 | 0.8970 | 0.0736 | (44.85,50.00,-3.68) |
| right sidespin (omega.y -, curves left) | -0.3221 | 0.8970 | -0.0736 | (44.85,-50.00,3.68) |

## Checks

| ID | Status | Finding |
|---|---|---|
| DIR-001 | pass | {"scenarios":5} |
| DIR-002 | pass | {"collisions":[]} |
| DIR-003 | pass | {"topspinVz":1.2056388016464639,"zeroVz":0.9,"delta":0.30563880164646384} |
| DIR-004 | pass | {"backspinVz":0.778896424440363,"zeroVz":0.9,"delta":-0.12110357555963702} |
| DIR-005 | pass | {"top":1.2056388016464639,"zero":0.9,"back":0.778896424440363} |
| DIR-006 | pass | {"leftX":0.03594207009638709,"rightX":-0.03594207009638709,"zeroX":0,"leftDelta":0.03594207009638709,"rightDelta":-0.03594207009638709} |
| DIR-007 | pass | {"topDelta":0,"backDelta":0} |
| DIR-008 | pass | {"preserved":[{"key":"zero","before":{"x":0,"y":0,"z":0},"atBounce":{"x":0,"y":0,"z":0}},{"key":"topspin","before":{"x":40,"y":0,"z":0},"atBounce":{"x":40,"y":0,"z":0}},{"key":"backspin","before":{"x":-40,"y":0,"z":0},"atBounce":{"x":-40,"y":0,"z":0}},{"key":"sideLeft","before":{"x":0,"y":50,"z":0},"atBounce":{"x":0,"y":50,"z":0}},{"key":"sideRight","before":{"x":0,"y":-50,"z":0},"atBounce":{"x":0,"y":-50,"z":0}}]} |
| DIR-009 | pass | {"cases":[{"key":"sideLeft","preBounceOmegaY":50,"postBounceOmegaY":50},{"key":"sideRight","preBounceOmegaY":-50,"postBounceOmegaY":-50}]} |
| DIR-010 | pass | {"secondBounces":[{"key":"zero","position":{"x":0,"y":0.781,"z":0.139791820319258},"postVelocity":{"x":0,"y":1.88654543858287,"z":0.9002816150948819}},{"key":"topspin","position":{"x":0,"y":0.781,"z":0.291814793007149},"postVelocity":{"x":0,"y":1.8905408519726317,"z":1.2062296220958415}},{"key":"backspin","position":{"x":0,"y":0.781,"z":0.07681878832602768},"postVelocity":{"x":0,"y":1.8917351250078247,"z":0.5947558822907807}},{"key":"sideLeft","position":{"x":0.08957155648552048,"y":0.781,"z":0.13560743539710735},"postVelocity":{"x":0.11208786665855572,"y":1.8865117879954303,"z":0.892778484395134}},{"key":"sideRight","position":{"x":-0.08957155648552048,"y":0.781,"z":0.13560743539710735},"postVelocity":{"x":-0.11208786665855572,"y":1.8865117879954303,"z":0.892778484395134}}]} |

## Boundary

This report does not change `mainline-v2`, `shared-physics-core.js`, legacy pages, or formal presets. It does not select material parameters and does not use the 2017 external data as an acceptance gate.
