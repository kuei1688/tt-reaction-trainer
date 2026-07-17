# Game 5 MVP validation summary

Generated: 2026-07-15T23:59:34.714Z
Source: `game5.html` (build v9k02)

Automated checks: 7 pass, 1 pass-with-warning, 0 fail

| ID | Classification | Status | Blocking | Message |
|---|---|---|---|---|
| DATA-01 | metadata-error | pass | no | 47 approved videos map 1:1 to 47 presets |
| DATA-02 | metadata-error | pass | no | 47 approved videos have finite contact metadata |
| DIR-01 | direction-sign | pass | no | 22 pure sidespin videos preserve the direction contract |
| PHYS-01 | canonical-physics | pass | no | 47/47 serves are finite and legal; 6 representative replays are deterministic |
| PHYS-02 | canonical-physics | pass-with-warning | no | push/chop uses the calibrated compensation path; attack remains explicitly marked as an approximation |
| TIME-01 | timing | pass | no | 100 ms swing delay is encoded with early/in-window/late branches |
| HANDOFF-01 | handoff | pass | no | C3 handoff consumes contact_time_sec with explicit fallback and fades the video before removal |
| SAFETY-01 | finite-safety | pass | no | missing-load and finite-value safeguards are present; all replay outputs are finite |

## Known baseline classifications

- `expected-model-change`: existing VAL-004 Stage4a snapshot mismatch caused by the current `PADDLE_BLEND`/fallback model, not changed in this gate.
- `serve-target-diagnostic`: individual target-precision rows may fail while the shared legal-serve gate and cross-check remain 47/47.
- This report is product-readiness evidence, not a claim of calibrated physical truth or completion of TODO-009.

## Manual evidence

See `manual-check-matrix.md`; pending rows are not treated as a pass until the browser check is completed.
