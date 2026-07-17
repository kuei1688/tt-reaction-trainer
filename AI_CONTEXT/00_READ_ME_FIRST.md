# READ ME FIRST

> 給 AI 或人類接手用的入口。2026-07-11 大幅簡化:舊版的 Gate 0/1/2 審理表格、「每天一問」、「核心物理一天最多改一次」、「每次工作結束必須產 checkpoint」等規則是燒盡期(2026-07-06 前後)用來止血的應急措施,現在對話已能好好切開,不再需要這麼重。舊版全文在 `AI_CONTEXT/ARCHIVE/`。

## 先讀這兩份

1. `AI_CONTEXT/STATUS.md`——現在狀態(哪些檔案是紅線、目前活躍的工作支線)。
2. `AI_CONTEXT/OPEN_ITEMS.md`——還沒決定的舊 TODO,逐項看、逐項丟棄或處理,不用一次清完。

## 兩層規則：原型自由，正式升格要審查

紅線的目的不是禁止碰某些檔案，而是防止「局部修補、代理模型或測試通過」被誤認成正式物理模型、資料契約或產品行為。判斷時同時看工作所在層，以及變更是否跨越模型邊界。

### 1. 原型層：自由試驗

`prototypes/` 內的實驗、複製測試素材／影片／參數、可行性測試可以直接做，不需要審理表格、taskpack 或 checkpoint。原型仍要清楚寫出它測量什麼、沒有證明什麼；不得自動寫回正式資料、核心物理或正式頁面。

### 2. 正式層：紅線授權

下列檔案屬正式核心、主線或正式資料；修改前至少要說明檔案、目的、風險與驗證：

- `shared-physics-core.js`
- `game4.html`、`game5.html`、`match-trainer.html`
- `videos.json`、`physics-presets.json`

`return-studio.html`、`physics-studio.html`、`serve-generator.html` 預設是研究／產生工具；它們的輸出若要寫入上述正式檔案，才進入紅線審查。

正式層再分兩種審查重量：

- **R0：契約內修正**。既有物理狀態、座標、符號、單位、資料 schema 與跨頁語意都不變，例如 UI、文案、視覺、除錯資訊或局部明確 bug。使用者已提出明確範圍時，可用簡短目的與 targeted validation 直接執行。
- **R1：模型／契約升級**。只要改變狀態表示、座標或 sign convention、單位／時間尺度、旋轉組合、飛行／彈跳／球拍接觸的耦合、序列化資料語意或跨頁行為，就必須先提出完整方案，列出相容性、rollback 與驗證，等待明確授權後再改正式檔案。原型可以先自由做 R1 探索，但不能把原型結果直接升格。

### 3. R1 的模型不變量審查

進入 R1 前，至少回答以下問題：

- 物理狀態是什麼？哪些欄位是狀態，哪些只是 label 或 authoring metadata？
- 座標系、正負號、單位與時間／尺度轉換是否明確且只有一個入口？
- 純旋轉、混合旋轉、符號反轉、零值與座標旋轉案例是否都測過？
- 飛行、桌面反彈、球拍接觸、顯示與資料產生器是否使用同一個物理狀態？
- 舊資料與舊頁面如何透過 adapter 相容？失敗時如何 rollback？

目前旋轉模型的明確原則是：球的物理旋轉以角速度向量 `omega` 表示；下旋／上旋與側旋是依座標系解讀的分量或 label，不是互相獨立的動力學狀態；若需要軸向旋轉，另立清楚的欄位與契約。

### 4. 例外不改變原則

使用者可以對特定檔案、特定任務授權一次性的最小變更（例如 Game 5 MVP 範圍）。這種授權只適用於列明的範圍，不會取消 R1 模型審查，也不會把 prototype evidence 變成物理真值。做完要記錄實際改了什麼、哪些驗證仍未完成。

## 模型選用建議

> 2026-07-12 更新:根據第三方基準(Artificial Analysis Harvey LAB-AA 法律基準、Arena.ai Code Arena 前端榜)重新檢視,GLM-5.2 實際能力已接近前沿,不再是單純「量大但品質普通」的定位,見下方修正。舊有「GLM=量大可以錯」的分工假設已不完全成立,升級任務前請先確認實際呼叫的是哪個 GLM 版本。

現在 Claude、OpenAI 高階模型、GLM(透過 Ollama cloud)都可視為可用的高階模型,不是固定角色分工,依任務性質選:

- **用貴的(Claude / OpenAI 高階)**:碰紅線檔案前的判斷、跨檔案一致性檢查、架構決策、深度多步驟推理(對應 DeepSWE/NL2Repo 這類「深度倉庫級推理」任務,GLM-5.2 在第三方基準上仍明顯落後)——這些是「一次要對、風險高、且需要長鏈推理整合」的工作。
- **可以放心用 GLM-5.2**:前端/UI 相關程式碼生成(Arena.ai Code Arena 前端榜排名第2,優於所有 Claude Opus 版本)、需要邏輯判斷但屬單次任務的工作(Harvey 法律基準上與 Claude Opus 4.8 打平,7.5% 並列第二,且明顯優於 GPT-5.4 的 0%)——不必再降級成「草稿、之後重審」的心態,可視為與 GPT-5.4 同量級甚至更好的高階模型使用。
- **仍建議用 GLM 處理**:大量重複性整理、批次資料掃描、`prototypes/` 內可以隨便試錯的程式碼——這類「量大、可以錯、之後再審」的工作,GLM 的成本優勢仍是首選理由,與能力高低無關。
- 不用固定的任務佇列呼叫流程,想到就用,額度有限時優先省在真正需要深度跨檔案推理的地方(碰紅線檔案、抓物理/邏輯 bug 仍優先用 Claude/OpenAI 高階)。

## 歷史文件在哪裡

- `AI_CONTEXT/ARCHIVE/checkpoints/`——舊版所有 CHECKPOINT 與已整併的 PLAN/TASKPACK。
- `AI_CONTEXT/ARCHIVE/glm-batch-2026-07-06_07/`——GLM_TASKS 000-018 任務包與對應輸出草稿,已折進正式 `docs/`。
- `docs/ARCHIVE/`——文件維護流程模板、計畫審查清單、交接模板,以及 214KB 的 `physics-engine-v2-plan.md` 歷史長文。

## docs/ 現況參考(內容仍有效,非必讀但要查時用)

`PHYSICS_MODEL_SPEC.md`、`SPIN_DIRECTION_CONTRACT.md`、`CORE_FILE_SYNC_STATUS.md`、`DEVELOPMENT_MATRIX.md`、`MVP_MAINLINE_SPEC.md`、`MODEL_DECISIONS.md`、`EXPERIMENT_LOG.md`、`SHARED_PHYSICS_CORE_PHASE1_APPROVAL.md`、`SHARED_PHYSICS_CORE_PHASE2_TASKPACK.md`、`READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md`、`BATCH_VALIDATION_SPEC.md`、`BATCH_VALIDATION_TOOLING_TASKPACK.md`、`VALIDATION_PLAN.md`。

2026-07-16 同階段 3D／Game 5 研究證據的統一入口：`AI_CONTEXT/3D_RESEARCH_ARCHIVE_INDEX.md`。

## 核心禁止事項(保留,仍然重要)

- 不把 GLM 草稿中的「已部署」「風險:無」直接當真,升格前要自己核對。
- 不把實驗成功率自動升格成模型決策。
- 不刪除失敗案例、不隱藏不確定、不補不存在的資料。
- 不把 `return-studio.html` 研究工具行為寫成 `game4.html` 正式已部署。
