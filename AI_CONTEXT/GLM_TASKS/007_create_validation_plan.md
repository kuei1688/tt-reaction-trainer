# GLM 任務 007：建立驗證計畫草稿

你是本專案的文件整理助理。請根據目前 docs、AI_CONTEXT 與工具腳本，整理可重跑的驗證計畫，不要實際執行測試，不要新增測試結果。

## 輸入資料

請讀取：

- AI_CONTEXT/00_READ_ME_FIRST.md
- AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md
- AI_CONTEXT/DRAFTS/physics_engine_v2_structured_summary.md
- AI_CONTEXT/DRAFTS/experiment_log_draft.md
- AI_CONTEXT/DRAFTS/development_matrix_draft.md
- docs/PHYSICS_MODEL_SPEC.md
- docs/EXPERIMENT_LOG.md
- tools/physics-v2-contact-mechanics.js
- tools/racket-contact-mechanics.js
- game4.html
- return-studio.html
- physics-studio.html

## 任務

請產生：

`AI_CONTEXT/DRAFTS/validation_plan_draft.md`

內容請包含：

1. 目前可重跑的驗證種類
2. 每種驗證的目的
3. 對應檔案或函式
4. 前置條件
5. 預期輸出格式
6. 不應該用來判斷的指標
7. 需要新增工具腳本但尚未存在的驗證
8. 第一輪不該跑的高風險驗證
9. 建議後續 Codex 寫成正式命令的清單

## 限制

- 不要新增不存在的測試結果
- 不要宣稱目前測試通過
- 不要要求修改核心程式
- 不確定請標示「不確定」
