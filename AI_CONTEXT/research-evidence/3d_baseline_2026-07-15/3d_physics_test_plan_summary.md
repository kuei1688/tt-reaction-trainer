# 3D physics baseline execution

Generated: 2026-07-15T14:36:59.305Z
Commit: `f1d0ce4a9781e6cb9c56cc3e6a2d935e3fb2f6b8`

> This is engineering/prototype evidence from the current code. It is not a claim of physically calibrated truth or Trainer readiness.

## Gate and experiment summary

| ID | Result | Evidence |
|---|---|---|
| E-01 | PASS | mirror checks: ±-150: Δx=0, ±-75: Δx=0 |
| E-02 | PASS | no-spin stable=true; side magnitude monotonic=true; finite=true |
| E-03 | REVIEW | axial acceleration near zero=true; ±omega.y oppose=true; axial post-bounce x matches zero=false |
| E-04 | PASS | 47 presets; two bounces=47; net hits=0; avg net clearance=0.00568 m |
| E-05 | PASS | 3750 bounce cases; omega.y carried=true; finite=true |
| E-06 | 5 representative presets | 1195 contact/flight rows; exceptions=0 |
| E-07 | PASS | 4A=100; 4B=100; 4C=125; exceptions=0 |
| E-08 | REVIEW | 3/5 representative rallies reached 12 rounds; failures={"out_of_bounds":2} |

## Important interpretation

- E-01–E-03 are controlled mathematical/prototype checks with a real-scale isolated integrator.
- E-04–E-07 exercise the current page extraction path and report velocities/spins back in real units using D.
- E-04's 47/47 baseline is a data-flow baseline; it does not validate the preset library against video measurements.
- E-06/E-07 contain sweep rows for inspection, not automatic physical acceptance.
- Visual/manual checks are recorded separately because a numerical pass cannot prove curve readability or Game 5 input semantics.

## Known observations

- E-05 regime counts: {"sliding/sliding":1330,"sliding/rolling":1155,"rolling/rolling":755,"rolling/sliding":510}; epsilon range 0.60889–0.85721.
- E-06 representative presets: serve_contact_backspin_004 (230/239 clear-net rows), serve_contact_nospin_002 (239/239 clear-net rows), serve_contact_backspin_002 (230/239 clear-net rows), serve_contact_sidebackspin_004 (229/239 clear-net rows), serve_contact_sidebackspin_002 (230/239 clear-net rows).
- E-07 canonical side-spin uses omega.y directly; legacy sidespin is not used as the sweep input.
- E-08 is a current-preset representative rally harness; the named legacy validator was also rerun separately and failed before simulation because its hard-coded exclusions no longer match the 47 generated preset IDs.

## Files

- `3d_physics_test_plan_raw.json`: versioned raw experiment output.
- `3d_physics_test_plan_summary.md`: this summary.
- `representative-curves.svg`: compact curve plot for E-01/E-02/E-05.
- `visual-check.md`: manual-check record and the browser-sandbox limitation.
