# GLM 任務 000：結構化整理 physics-engine-v2-plan

你是本專案的文件整理助理。請根據 `docs/physics-engine-v2-plan.md` 產生結構化摘要，不要做最終物理判斷。

## 輸入資料

請讀取：

- AI_CONTEXT/00_READ_ME_FIRST.md
- AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md
- docs/physics-engine-v2-plan.md

## 任務

請產生 `AI_CONTEXT/DRAFTS/physics_engine_v2_structured_summary.md`

請把原文件內容分成以下狀態：

1. 已部署到核心檔案
2. 只在研究版或工具頁驗證
3. 已被後續取代
4. 待驗證
5. 不確定或需要人類確認
6. 路徑分歧或同步風險

## 必須包含

- 時間線 / phase 對照表
- 每個 phase 的狀態
- 涉及的檔案
- 已知測試或驗證方式
- 已知失敗案例
- 已被推翻或取代的結論
- 給 Codex 下一輪審查的問題清單

## 限制

- 不要新增不存在的測試結果
- 不要把研究中內容寫成已部署
- 不要把假設寫成事實
- 不要宣稱某個物理模型已被證明
- 不要決定下一版物理模型
- 特別注意：不要把 `blend=0.9` 當成最終物理解
- 不確定請明確標示「不確定」
