# 3D physics diagnostic execution

Generated: 2026-07-15T15:01:41.163Z
Commit: `f1d0ce4a9781e6cb9c56cc3e6a2d935e3fb2f6b8`

> This is isolated engineering/prototype evidence. It is not a claim of calibrated physical truth, video measurement validity, or Trainer readiness.

## Gate summary

| Gate | Result | Evidence |
|---|---|---|
| E-03 | PASS — contact-coupling classified | axial acceleration near zero=true; pre-table x matches=true; post-table Δx=0.097823 m |
| G-04 | CLASSIFIED — expected model change | current validator snapshot remains mismatched; historical replay matches=true; current dwell/epsilon stable=true |

## E-03 decision

Decision: **contact-coupling** in the current prototype contract, not preserve-only.

The axial component produces no meaningful Magnus acceleration before the first table contact because it is resolved parallel to the instantaneous velocity. At table contact, `physics3dResolveOmega()` resolves `axialSpin` into world-space omega; the table adapter then maps the resolved x/z components into the existing tangential-slip equations. That is the explicit source of the horizontal difference, not an unexplained flight-force leak.

- Z0 first-table-contact x: 0 m; AX+ first-table-contact x: 0 m
- Z0 post-first-table net x: 0 m; AX+ post-first-table net x: 0.074111 m
- Second-bounce difference: 0.097823 m
- Resolved omega at AX+ first table contact: {"x":0,"y":-46.349929,"z":116.799485}

This classification preserves the required finite-value and Y+/Y- opposite-direction checks. It is an engineering semantic decision only; it does not authorize formal 3D sidespin integration or preset fitting.

## G-04 mismatch classification

The current 13/14 batch result is reproducible and localized to the Stage4a contact path. `dwellMs` and `effectiveEpsilon` remain effectively unchanged, while the horizontal velocity and spin fields differ.

- Snapshot-era `PADDLE_BLEND`: 0.65; current: 0.605.
- Snapshot-era fallback x: -0.2; current sidespin-compensation x: -0.273533.
- Historical replay matches the stored Expected: true.

Therefore this is classified as an intentional model/parameter change after the snapshot, not a newly located numerical regression. The formal snapshot is left unchanged in this diagnostic.

## Reproduction

```text
node prototypes/3d-physics-test-plan/run-3d-physics-diagnostic.js
node tools/batch-validation.test.js --report-file <temporary-report-path>
```

## Red-line review

No red-line file was modified by this diagnostic. No snapshot, blend, Magnus coefficient, preset, or tolerance was changed. Any future formal 3D integration or snapshot update requires a separate red-line review.

## Output

- `3d_physics_diagnostic_raw.json`: all staged observations and replay data.
- `3d_physics_diagnostic_summary.md`: this classification summary.
