DRAFT: Codex review notes
#
# Status: draft only.
# This file is review notes only and must not be treated as source of truth.
# Last touched: 2026-07-06

# Codex Review Notes for GLM Drafts

> Working review notes only. These notes are for boundary checking and should not be treated as final decisions or merged documentation.

## Purpose

This file records how Codex should read the GLM draft set. The goal is to keep the drafts useful as review material without letting them be mistaken for approved docs.

## GLM draft groups

### Group 1
- `physics_engine_v2_structured_summary.md`
- `push_model_summary.md`
- `experiment_log_draft.md`

### Group 2
- `development_matrix_draft.md`
- `ai_handoff_template_draft.md`
- `model_decisions_draft.md`

### Group 3
- `core_file_sync_inventory.md`
- `validation_plan_draft.md`
- `docs_merge_plan.md`

## What to trust carefully

### `game4.html` vs `return-studio.html`

- `game4.html` still has the loop / direct-model path and the legacy `PADDLE_RESTITUTION = -0.9` behavior.
- `return-studio.html` is a research / tuning page and includes `PADDLE_BLEND = 0.65`, `computeBlendedNormal()`, `bounceOffPlaneSubstepped()`, and `PUSH_WRIST_BRAKE_RATE`.
- `game4.html` does not have the same blend / substepped push behavior.
- `game4.html` uses `computeAdaptivePushMagnitude()`, `computeAdaptivePushTiltX(incomingVel)`, and `computeAdaptivePushTiltY(topspin)` for adaptive push.
- `return-studio.html` uses `computeAdaptivePushLift()`, `computeAdaptivePushDrive()`, and `PUSH_TILT_Y=0.8` for adaptive push.

## GLM task mapping

| GLM draft | Risk level | Codex review level | Notes |
|---|---:|---:|---|
| `physics_engine_v2_structured_summary.md` | High | Review carefully | Good for structure, but not for final conclusions. |
| `push_model_summary.md` | High | Review carefully | Useful summary, but still summary only. |
| `experiment_log_draft.md` | High | Review carefully | Contains many observed results and historical notes. |
| `development_matrix_draft.md` | Medium to high | Review carefully | Can drift into authoritative-looking status language. |
| `model_decisions_draft.md` | Medium to high | Review carefully | Some entries can look final even when they are not. |
| `core_file_sync_inventory.md` | High | Review carefully | Inventory can look like a canonical sync record. |
| `validation_plan_draft.md` | Medium | Review carefully | Validation ideas should stay proposed until checked. |
| `docs_merge_plan.md` | Medium | Review carefully | Merge plan should stay proposed only. |
| `ai_handoff_template_draft.md` | Medium | Review lightly | Mostly a template, but still worth boundary checking. |

## What GLM should not decide alone

1. It should not turn review notes into repo truth.
2. It should not convert research-page behavior into formal-game behavior.
3. It should not treat `blend=0.9` or similar high-blend notes as final physics.
4. It should not write `return-studio.html` research behavior as `game4.html` deployed behavior.
5. It should not treat Phase 5 / later Phase 6 historical notes as current parameters.
6. It should not remove uncertainty just to make a table look clean.

## Next review direction

1. Use `ai_handoff_template_draft.md` to guide future handoff structure.
2. Use `docs_merge_plan.md` to decide what stays draft and what can become formal docs.
3. Use `core_file_sync_inventory.md` with `docs/CORE_FILE_SYNC_STATUS.md` to check file-level consistency.
4. Use `PHYSICS_MODEL_SPEC.md`, `EXPERIMENT_LOG.md`, and `MODEL_DECISIONS.md` together when checking whether a draft statement is actually supported.
