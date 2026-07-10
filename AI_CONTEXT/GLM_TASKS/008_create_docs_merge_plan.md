# GLM 任務 008：建立 docs 合併計畫

你是本專案的文件整理助理。請根據目前 docs 與 AI_CONTEXT/DRAFTS，建議哪些草稿適合升級成正式 docs，哪些應留在 AI_CONTEXT/DRAFTS，不要直接修改正式 docs。

## 輸入資料

請讀取：

- AI_CONTEXT/00_READ_ME_FIRST.md
- AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md
- AI_CONTEXT/DRAFTS/physics_engine_v2_structured_summary.md
- AI_CONTEXT/DRAFTS/push_model_summary.md
- AI_CONTEXT/DRAFTS/experiment_log_draft.md
- AI_CONTEXT/DRAFTS/development_matrix_draft.md
- AI_CONTEXT/DRAFTS/ai_handoff_template_draft.md
- AI_CONTEXT/DRAFTS/model_decisions_draft.md
- docs/PROJECT_OVERVIEW.md
- docs/PHYSICS_MODEL_SPEC.md
- docs/DEVELOPMENT_MATRIX.md
- docs/EXPERIMENT_LOG.md
- docs/MODEL_DECISIONS.md
- docs/AI_HANDOFF_TEMPLATE.md
- docs/physics-engine-v2-plan.md

## 任務

請產生：

`AI_CONTEXT/DRAFTS/docs_merge_plan.md`

內容請包含：

1. 每個正式 docs 檔案應該承載的內容範圍
2. 哪些 GLM 草稿可以合併到哪個正式 docs
3. 哪些草稿需要 Codex 審查後才能合併
4. 哪些內容應留在 AI_CONTEXT/DRAFTS
5. 哪些內容應從長文件拆出
6. 合併優先順序
7. 每一步合併的風險
8. 合併前需要人類確認的事項

## 限制

- 不要直接改正式 docs
- 不要把 GLM 草稿當成已審查結論
- 不要把研究中內容寫成已部署
- 不確定請標示「不確定」
