# GLM Task 013: 其餘草稿邊界收尾包

## 目標
把 `AI_CONTEXT/DRAFTS/` 裡剩下幾份容易被誤讀成半正式成果的草稿，補上明確 draft 邊界並降溫措辭。

## 來源範圍
- `AI_CONTEXT/DRAFTS/codex_review_notes.md`
- `AI_CONTEXT/DRAFTS/experiment_log_draft.md`
- `AI_CONTEXT/DRAFTS/push_model_summary.md`
- `AI_CONTEXT/DRAFTS/validation_plan_draft.md`
- `AI_CONTEXT/DRAFTS/physics_engine_v2_structured_summary.md`
- `AI_CONTEXT/DRAFTS/tail_todo_006_008_candidate_draft.md`

## 要求
1. 在每個檔案最前面加上清楚的 draft banner，寫明它只是草稿、不是 source of truth。
2. 把容易讓人直接當成正式結論的句子改成較保守的說法，但不要新增事實。
3. `codex_review_notes.md` 保留為 review notes，不要改成決策文件。
4. `experiment_log_draft.md` 保留實驗記錄語氣，不要把觀察寫成最終結論。
5. `push_model_summary.md`、`physics_engine_v2_structured_summary.md` 都要明講是 summary，不是最終規格。
6. `validation_plan_draft.md` 只能是候選驗證方案，不要寫成已承諾的驗證流程。
7. `tail_todo_006_008_candidate_draft.md` 要繼續保留 candidate / TODO 語氣。

## 建議輸出
- 每個檔案回傳一段簡短說明：你加了什麼邊界、哪些句型被降溫。
- 若有些地方只需要在段落前補註記，不需要改句子，請單獨列出。

## 驗收標準
- 檔頭一看就知道是 draft。
- 草稿內容不再像正式 docs 台帳或最終規格。
- 不修改 `docs/` 正式文件內容，除非只是需要補交叉引用提示。
