# READ ME FIRST

> 給 AI 或人類接手用的入口。2026-07-11 大幅簡化:舊版的 Gate 0/1/2 審理表格、「每天一問」、「核心物理一天最多改一次」、「每次工作結束必須產 checkpoint」等規則是燒盡期(2026-07-06 前後)用來止血的應急措施,現在對話已能好好切開,不再需要這麼重。舊版全文在 `AI_CONTEXT/ARCHIVE/`。

## 先讀這兩份

1. `AI_CONTEXT/STATUS.md`——現在狀態(哪些檔案是紅線、目前活躍的工作支線)。
2. `AI_CONTEXT/OPEN_ITEMS.md`——還沒決定的舊 TODO,逐項看、逐項丟棄或處理,不用一次清完。

## 兩層規則

**1. 紅線——改之前要先討論**:

- `shared-physics-core.js`、`game4.html`、`match-trainer.html`
- `videos.json`、`physics-presets.json` 本尊

**2. 其餘一切自由**:`prototypes/` 資料夾內的實驗、複製出來的測試素材/影片/參數、可行性測試——想試就試,不需要審理表格、不需要先寫任務包。做完覺得有價值才值得留一兩句記錄,不必是正式 checkpoint。

判斷準則只有一個:會不會真的改壞現在能跑的東西。會,就先講一聲;不會,就直接做。

## 模型選用建議

現在 Claude、OpenAI 高階模型、GLM(透過 Ollama cloud,量大但品質普通)都可視為可用的高階模型,不是固定角色分工,依任務性質選:

- **用貴的(Claude / OpenAI 高階)**:碰紅線檔案前的判斷、抓真的物理或邏輯 bug、跨檔案一致性檢查、架構決策——這些是「一次要對、風險高」的工作。
- **用 GLM**:大量重複性整理、批次資料掃描、草稿初稿、`prototypes/` 內可以隨便試錯的程式碼——這些是「量大、可以錯、之後再審」的工作。
- 不用固定的任務佇列呼叫流程,想到就用,額度有限時優先省在真正需要高階判斷的地方。

## 歷史文件在哪裡

- `AI_CONTEXT/ARCHIVE/checkpoints/`——舊版所有 CHECKPOINT 與已整併的 PLAN/TASKPACK。
- `AI_CONTEXT/ARCHIVE/glm-batch-2026-07-06_07/`——GLM_TASKS 000-018 任務包與對應輸出草稿,已折進正式 `docs/`。
- `docs/ARCHIVE/`——文件維護流程模板、計畫審查清單、交接模板,以及 214KB 的 `physics-engine-v2-plan.md` 歷史長文。

## docs/ 現況參考(內容仍有效,非必讀但要查時用)

`PHYSICS_MODEL_SPEC.md`、`CORE_FILE_SYNC_STATUS.md`、`DEVELOPMENT_MATRIX.md`、`MVP_MAINLINE_SPEC.md`、`MODEL_DECISIONS.md`、`EXPERIMENT_LOG.md`、`SHARED_PHYSICS_CORE_PHASE1_APPROVAL.md`、`SHARED_PHYSICS_CORE_PHASE2_TASKPACK.md`、`READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md`、`BATCH_VALIDATION_SPEC.md`、`BATCH_VALIDATION_TOOLING_TASKPACK.md`、`VALIDATION_PLAN.md`。

## 核心禁止事項(保留,仍然重要)

- 不把 GLM 草稿中的「已部署」「風險:無」直接當真,升格前要自己核對。
- 不把實驗成功率自動升格成模型決策。
- 不刪除失敗案例、不隱藏不確定、不補不存在的資料。
- 不把 `return-studio.html` 研究工具行為寫成 `game4.html` 正式已部署。
