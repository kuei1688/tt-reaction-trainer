# Checkpoint 2026-07-06

> This is a status checkpoint only.
> It summarizes current progress and pause points.
> It does not make physics decisions and does not introduce new work items.

## 1. 已完成的整理成果

1. 已建立正式 docs 主骨架，包含 `PROJECT_OVERVIEW`、`PHYSICS_MODEL_SPEC`、`EXPERIMENT_LOG`、`MODEL_DECISIONS`、`VALIDATION_PLAN`、`CORE_FILE_SYNC_STATUS`。
2. 已建立 `AI_CONTEXT` 基本交接鏈，包括 `00_READ_ME_FIRST`、`CODEX_CONTEXT_SUMMARY`、`changed_files_manifest`、`file_tree`、`git_status`、`current_diff.patch`。
3. 已建立多個 `GLM_TASKS`，並把大包整理流程固定下來，避免再切碎成單檔小包。
4. 已把 `VALIDATION_PLAN.md` 補成可追蹤的驗證入口，包含 `VAL-009` 與 `VAL-010`。
5. 已把 `PHYSICS_MODEL_SPEC.md` 與 `MODEL_DECISIONS.md`、`EXPERIMENT_LOG.md`、`CORE_FILE_SYNC_STATUS.md` 的交叉引用收斂到較保守的正式語氣。
6. 已把 `DOCS_MAINTENANCE_PLAN.md` 補上研究頁回寫正式頁前需先過驗證的維護規則。
7. 已把 `AI_CONTEXT/DRAFTS/` 的多份文件補上 draft 邊界，降低被誤讀成正式結論的風險。
8. 已完成三份最容易被誤讀成正式規格的草稿邊界補強，包括 `read_only_physics_extractor_spec_draft.md`、`batch_validation_design_draft.md`、`validation_plan_draft.md`。
9. 已完成對 summary / review / TODO 類草稿的檔頭邊界補強，包括 `codex_review_notes.md`、`experiment_log_draft.md`、`push_model_summary.md`、`physics_engine_v2_structured_summary.md`、`tail_todo_006_008_candidate_draft.md`。
10. 已確認 GLM 5.2 cloud sidecar 可正常呼叫，且不影響主控模型切回較省量的設定。

## 2. 目前正式 docs 最重要的 5 份文件

1. `docs/PROJECT_OVERVIEW.md`
2. `docs/PHYSICS_MODEL_SPEC.md`
3. `docs/MODEL_DECISIONS.md`
4. `docs/EXPERIMENT_LOG.md`
5. `docs/VALIDATION_PLAN.md`

## 3. 目前 AI_CONTEXT 最重要的 5 份文件

1. `AI_CONTEXT/00_READ_ME_FIRST.md`
2. `AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md`
3. `AI_CONTEXT/changed_files_manifest.md`
4. `AI_CONTEXT/GLM_TASKS/009_big_batch_docs_alignment.md`
5. `AI_CONTEXT/CHECKPOINT_2026-07-06.md`

## 4. 目前可先不用跑的 GLM_TASKS

1. `AI_CONTEXT/GLM_TASKS/010_formal_docs_consistency_followup.md`
2. `AI_CONTEXT/GLM_TASKS/011_physics_spec_validation_followup.md`
3. `AI_CONTEXT/GLM_TASKS/012_draft_stale_language_cleanup.md`
4. `AI_CONTEXT/GLM_TASKS/013_remaining_draft_boundary_pack.md`
5. `AI_CONTEXT/GLM_TASKS/014_residual_draft_boundary_closeout.md`
6. `AI_CONTEXT/GLM_TASKS/015_tail_candidate_content_softening.md`

## 5. 目前需要人類或高階模型審查的文件

1. `docs/PHYSICS_MODEL_SPEC.md`
2. `docs/MODEL_DECISIONS.md`
3. `docs/EXPERIMENT_LOG.md`
4. `docs/CORE_FILE_SYNC_STATUS.md`
5. `docs/VALIDATION_PLAN.md`
6. `docs/DOCS_MAINTENANCE_PLAN.md`
7. `AI_CONTEXT/DRAFTS/model_decisions_draft.md`
8. `AI_CONTEXT/DRAFTS/core_file_sync_inventory.md`
9. `AI_CONTEXT/DRAFTS/development_matrix_draft.md`
10. `AI_CONTEXT/DRAFTS/docs_merge_plan.md`
11. `AI_CONTEXT/DRAFTS/physics_tail_candidate_review.md`

## 6. 目前最不應該修改的核心檔案

1. `game4.html`
2. `return-studio.html`
3. `physics-studio.html`
4. `physics-presets.json`
5. `videos.json`
6. `tools/physics-v2-contact-mechanics.js`
7. `tools/racket-contact-mechanics.js`

## 7. 下一步最小安全行動

1. 先暫停新增任何新 docs、GLM_TASKS 或核心程式修改。
2. 只做現有文件的人工審閱與交接確認，優先看 checkpoint 內列出的 5 份正式 docs。
3. 若需要再動作，先從 `AI_CONTEXT/CHECKPOINT_2026-07-06.md` 這份狀態快照回看，確認是否真的需要續推。
