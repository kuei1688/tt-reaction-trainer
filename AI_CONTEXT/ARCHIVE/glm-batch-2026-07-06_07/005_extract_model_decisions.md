# GLM 任務 005：抽取模型決策紀錄

你是本專案的文件整理助理。請根據 AI_CONTEXT 與 docs 草稿，抽取「已決策事項、非決策、待決策事項」，不要做最終物理判斷。

## 輸入資料

請讀取：

- AI_CONTEXT/00_READ_ME_FIRST.md
- AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md
- AI_CONTEXT/DRAFTS/physics_engine_v2_structured_summary.md
- AI_CONTEXT/DRAFTS/push_model_summary.md
- AI_CONTEXT/DRAFTS/experiment_log_draft.md
- docs/MODEL_DECISIONS.md
- docs/physics-engine-v2-plan.md

## 任務

請產生：

`AI_CONTEXT/DRAFTS/model_decisions_draft.md`

請用以下分類整理：

1. 已明確決策
2. 已被取代或否定的舊決策
3. 只是實驗結果，還不是決策
4. 待決策事項
5. 需要高階模型審查的決策
6. 需要人類使用者最終決定的事項

## 每一條決策請包含

- 標題
- 狀態：已決策 / 已取代 / 非決策 / 待決策 / 不確定
- 來源段落或來源檔案
- 背景
- 理由
- 影響
- 待驗證事項
- 風險

## 特別注意

- `blend=0.9` 不可被列為最終物理解
- 高 blend 值若出現，只能列為研究中或警訊
- 不要把搜尋結果自動升格成決策
- 不要把使用者觀察自動升格成物理定論
- 不要創造不存在的測試結果
- 不確定請明確標示「不確定」
