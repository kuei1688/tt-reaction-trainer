# 3D side-spin calibration execution

Generated: 2026-07-15T23:43:00.112Z
Git commit: `f1d0ce4a9781e6cb9c56cc3e6a2d935e3fb2f6b8`

> Isolated prototype evidence only. It is not a claim of physical truth, visual acceptance, or Trainer readiness.

## Group results

| Group | Rows | Finite | Legal / key check | Result |
|---|---:|---:|---|---|
| G0 | 5 | yes | ±omega.y oppose, zero/axial separation | PASS |
| G1 | 47 | 47/47 | 47/47 legal | PASS |
| G2 | 42 | 42/42 | monotonic=true | PASS |
| G3 | 42 | 42/42 | coefficient rows=7 | PASS |
| G4 | 120 | true/120 | omega.y carry=true | PASS |
| G5 | 162 | true/162 | tiltX × planeVel.x coupling | PASS |
| G6 | 108 | 108/108 | correct>none>wrong candidates=0 | EVIDENCE INSUFFICIENT |
| G7 | 288 + 18 controls | 288/288 | attack C-invariant=true | controlled approximation |
| G8 | 123 | 123/123 | candidates=3 | report |
| G9 | 141 | 141/141 | all47 replay | report |

## Shortlist

- current-baseline: C=2.9, Magnus=0.002793690356025591, omega scale=1
- safe-center-selected-C: C=2.9, Magnus=0.002793690356025591, omega scale=1
- safe-range-high-selected-C: C=2.9, Magnus=0.002793690356025591, omega scale=1

## Known gaps

- G10 remains a human video/browser semantic check; see `manual-check-matrix.md`.
- A pass here is a controlled approximation / candidate range result, not physical truth.
- Fallback solver was not exposed by the page API and is recorded as `null`; this is a tooling gap to resolve before red-line integration.
- All source hashes and the pre-run dirty-worktree snapshot are recorded in `manifest.json`, `baseline_config.json`, and `git_status.txt`.
