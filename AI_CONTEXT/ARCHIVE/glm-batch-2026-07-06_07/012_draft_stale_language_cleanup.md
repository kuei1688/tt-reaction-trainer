# GLM Task 012: 草稿區過時措辭清理包

## 目標
只整理 `AI_CONTEXT/DRAFTS/` 裡仍然會誤導讀者把草稿當成正式結論的措辭，不碰核心程式碼，也不改正式 `docs/` 的既有結論。

## 來源範圍
- `AI_CONTEXT/DRAFTS/codex_review_notes.md`
- `AI_CONTEXT/DRAFTS/docs_merge_plan.md`
- `AI_CONTEXT/DRAFTS/batch_validation_design_draft.md`
- `AI_CONTEXT/DRAFTS/core_file_sync_inventory.md`
- `AI_CONTEXT/DRAFTS/development_matrix_draft.md`
- `AI_CONTEXT/DRAFTS/experiment_log_draft.md`
- `AI_CONTEXT/DRAFTS/model_decisions_draft.md`
- `AI_CONTEXT/DRAFTS/physics_engine_v2_structured_summary.md`
- `AI_CONTEXT/DRAFTS/push_model_summary.md`
- `AI_CONTEXT/DRAFTS/read_only_physics_extractor_spec_draft.md`
- `AI_CONTEXT/DRAFTS/tail_todo_006_008_candidate_draft.md`
- `AI_CONTEXT/DRAFTS/validation_plan_draft.md`

## 要求
1. 把草稿裡像「已部署」「已完成」「風險：無」「可重跑」「已落地」這類容易直接升格成正式結論的句子，改成明確的草稿語氣。
2. 所有涉及 `game4.html`、`return-studio.html`、`physics-studio.html` 的內容，都要保留「草稿 / 待 Codex 核對 / 不可直接當正式版」的邊界。
3. 所有提到 `blend`、`scale`、`outputRescale`、`tiltX`、`PADDLE_BLEND`、`PADDLE_RESTITUTION`、`PUSH_WRIST_BRAKE_RATE`、`gravity: -4.2` 的段落，若是在草稿中陳述，都要避免語氣像已定案。
4. 若某段其實只是整理提案或拆分計畫，請保留為「建議」「候選」「待拆分」語氣，不要寫成已執行。
5. 不要把草稿內容改寫成新的事實；只能降溫語氣、補邊界、補待核對標籤。

## 建議輸出
- 每個檔案各自列出需要降溫的句子或段落。
- 若內容太長，優先處理「最可能被誤引用」的段落，再處理附錄與摘要表。
- 如果某段有一半像正式結論、一半像草稿說明，請拆成兩段，讓正式性和草稿性分開。

## 驗收標準
- 草稿區不再出現可直接被讀成「已部署正式版」的語句。
- `docs/` 的正式文件不必跟著改，除非只是補更清楚的交叉引用。
- 回報中要明確列出「哪些句子只是措辭降溫，哪些句子需要 Codex 再核對」。
