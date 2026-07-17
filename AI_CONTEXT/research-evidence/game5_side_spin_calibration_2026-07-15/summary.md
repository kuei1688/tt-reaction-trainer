# 3D side-spin calibration execution

Generated: 2026-07-15T23:31:53.104Z
Git commit: `f1d0ce4a9781e6cb9c56cc3e6a2d935e3fb2f6b8`

> Isolated prototype evidence only. It is not a claim of physical truth, visual acceptance, or Trainer readiness.

## Group results

| Group | Rows | Finite | Legal / key check | Result |
|---|---:|---:|---|---|
| G0 | 5 | yes | ±omega.y oppose, zero/axial separation | PASS |
| G1 | 47 | 47/47 | 47/47 legal | PASS |
| G2 | 42 | 42/42 | monotonic=true | PASS |
| G3 | 36 | 36/36 | coefficient rows=6 | REVIEW |
| G4 | 120 | true/120 | omega.y carry=true | PASS |
| G5 | 0 | 0/0 | tiltX × planeVel.x coupling | REVIEW |
| G6 | 0 | 0/0 | correct>none>wrong candidates=0 | EVIDENCE INSUFFICIENT |
| G7 | 0 + 0 controls | 0/0 | attack C-invariant=undefined | REVIEW |
| G8 | 0 | 0/0 | candidates=0 | report |
| G9 | 0 | 0/0 | all47 replay | report |

## Shortlist


## Known gaps

- G10 remains a human video/browser semantic check; see `manual-check-matrix.md`.
- A pass here is a controlled approximation / candidate range result, not physical truth.
- Fallback solver was not exposed by the page API and is recorded as `null`; this is a tooling gap to resolve before red-line integration.
- All source hashes and the pre-run dirty-worktree snapshot are recorded in `manifest.json`, `baseline_config.json`, and `git_status.txt`.
