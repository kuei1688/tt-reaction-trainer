# 專案總覽

> 本文件是文件系統入口。新 AI 或人類接手時，先讀本文件，再依任務讀下方關聯文件。
>
> 整理基準：2026-07-10
> 本輪範圍：shared-physics-core Phase 1 遷移、批次驗證工具化、MVP 主線規格、計畫審查清單、交接文件更新。

## 專案目標

建立桌球接發球反應訓練工具，並逐步加入可觀察、可校準的簡化物理模擬，讓使用者能練習旋轉判斷、落點判斷與回球技術選擇。

目前階段的重點是建立共用物理核心、可重跑驗證工具、可交接文件系統與 MVP 主線規格，不進行調參。

## 主要使用場景

- 反應訓練：依圖像、影片或發球情境判斷旋轉、落點與技術選擇。
- 發球物理模擬：以 preset 控制發球起點、落點、旋轉與彈跳。
- 回擊模擬：攻球、切球等技術透過球拍接觸模型或既有模型產生結果。
- 攝影棚 / 校準工具：觀察軌跡、調整參數、整理待處理 preset 與研究假設。
- MVP 主線：一發球 → 玩家選技術＋方向修正 → 模擬回擊 → 對手回一球 → 得分結束（見 `docs/MVP_MAINLINE_SPEC.md`）。

## 核心檔案角色

| 檔案 | 目前角色 | 使用注意 |
|---|---|---|
| `game4.html` | 正式遊戲頁 | attack / push 已走球拍接觸相關路徑；loop 仍保留舊 direct model；已改用 shared-physics-core.js |
| `return-studio.html` | 回擊研究 / 調參工具頁 | 有 blend / substepped push 等研究機制，不可直接寫成正式遊戲已部署；已改用 shared-physics-core.js |
| `physics-studio.html` | 發球 preset / 發球物理工具頁 | 已核對桌面反彈 v2 常數與 `game4.html` 關鍵常數一致；已改用 shared-physics-core.js |
| `shared-physics-core.js` | 共用物理核心 | Phase 1：5 常數 + 2 函式；Phase 2 尚未開始 |
| `physics-presets.json` | 發球 preset 資料 | 本輪不調整 preset |
| `docs/physics-engine-v2-plan.md` | 歷史長文與原始交接資料 | 內容混有已採用、研究中、已取代資訊，引用前必須再分類 |

## 文件系統

| 文件 | 用途 | 優先讀取情境 |
|---|---|---|
| `AI_CONTEXT/00_READ_ME_FIRST.md` | AI 接手入口與工作規則 | 每次開新 AI 任務前 |
| `AI_CONTEXT/CHECKPOINT_2026-07-10.md` | 最新 checkpoint | 快速恢復上下文 |
| `AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md` | 本輪整理摘要 | 快速恢復上下文 |
| `docs/MVP_MAINLINE_SPEC.md` | MVP 主線規格 | 要談可玩迴圈與範圍時 |
| `docs/PLAN_DRAFTING_CHECKLIST.md` | 計畫審查清單 | 起草新計畫或任務包前 |
| `docs/PHYSICS_MODEL_SPEC.md` | 已核對正式行為、研究工具行為、待驗證事項 | 要談物理模型時 |
| `docs/CORE_FILE_SYNC_STATUS.md` | 核心檔案差異核對 | 要比較 `game4` / `return-studio` / `physics-studio` 時 |
| `docs/SHARED_PHYSICS_CORE_PHASE1_APPROVAL.md` | 共用核心 Phase 1 核准記錄 | 要談 shared-physics-core 遷移時 |
| `docs/SHARED_PHYSICS_CORE_PHASE2_TASKPACK.md` | 共用核心 Phase 2 任務包 | 要繼續遷移 inline 函式時 |
| `docs/EXPERIMENT_LOG.md` | 實驗索引與狀態 | 要查 EXP 編號或歷史結果時 |
| `docs/MODEL_DECISIONS.md` | 決策台帳 | 要判斷某結果是否可升格成決策時 |
| `docs/DEVELOPMENT_MATRIX.md` | 模組成熟度與風險矩陣 | 要排下一輪工作時 |
| `docs/DOCS_MAINTENANCE_PLAN.md` | 文件維護規則與下一步 | 要繼續整理文件時 |
| `docs/VALIDATION_PLAN.md` | 驗證入口、候選命令與缺口 | 要重跑或設計驗證流程時 |
| `docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md` | 只讀核心函式 / 常數抽取規格 | 要建立核心差異工具前 |
| `docs/BATCH_VALIDATION_SPEC.md` | 批次驗證規格 | 要規劃發球 / 回擊批次檢查時 |
| `docs/BATCH_VALIDATION_TOOLING_TASKPACK.md` | 批次驗證工具化設計與驗收 | 要了解批次驗證工具實作時 |
| `docs/PHYSICS_RESEARCH_TAIL_SPLIT_PLAN.md` | 後段研究拆解計畫 | 要拆解 physics-engine-v2-plan 後段時 |
| `docs/PHYSICS_RESEARCH_TAIL_INDEX.md` | 後段研究條目索引 | 要逐條拆進 EXP / DEC / RES / TODO 時 |
| `docs/AI_HANDOFF_TEMPLATE.md` | 交派 AI 任務模板 | 要派 GLM 或其他模型做摘要/盤點時 |

## 目前已建立的整理成果

- 建立 `AI_CONTEXT/` 交接資料夾與 GLM 任務包（000-018）。
- 用 GLM 5.2 cloud 產生長文摘要、實驗索引、發展矩陣、決策草稿、驗證計畫草稿與 docs merge plan。
- 由 Codex 審查並升級正式 docs，避免把 GLM 草稿中的「已部署」或「風險：無」直接當真。
- 建立 `CORE_FILE_SYNC_STATUS.md`，明確記錄 `game4.html` 與 `return-studio.html` 在 loop、blend、substepped push、adaptive push 公式上的差異。
- 重寫 `PHYSICS_MODEL_SPEC.md`，分成已核對正式行為、研究 / 工具頁行為、待驗證 / 待決策事項。
- 重寫 `EXPERIMENT_LOG.md` 為 EXP-001 至 EXP-038 的狀態索引。
- 重寫 `MODEL_DECISIONS.md` 為保守決策台帳。
- 建立 `VALIDATION_PLAN.md`，區分候選驗證入口、尚未執行結果與最高優先缺口。
- 建立 `PHYSICS_RESEARCH_TAIL_INDEX.md`，把後段研究主軸先索引成可分流條目。
- 建立 `shared-physics-core.js`，Phase 1 遷移完成（5 常數 + 2 函式），三個 HTML 已改用共用核心（未 commit）。
- 建立跨檔案一致性檢查工具 `tools/cross-file-consistency-check.js`，自動比對常數與函式指紋。
- 建立批次驗證工具 `tools/batch-validation.test.js`，VAL-004 已工具化且通過。
- 建立 `MVP_MAINLINE_SPEC.md`，定義窄版可玩迴圈與 non-goals。
- 建立 `PLAN_DRAFTING_CHECKLIST.md`，定義計畫審查流程。

## 最高風險區

- 切球 push/chop 的球拍接觸力學與參數搜尋結果。
- `return-studio.html` 的研究機制是否要回寫 `game4.html`。
- `blend` 的物理地位，尤其高 blend 或 `blend=0.9`。
- loop / 拉球舊模型是否要重設計。
- shared-physics-core.js 遷移尚未 commit；Phase 2 尚未開始。
- 沒有標準可重跑瀏覽器批次驗證（VAL-003、VAL-005 仍缺工具化）。

## 待處理項目

- 決定是否 commit shared-physics-core.js 遷移的改動。
- 執行 SHARED_PHYSICS_CORE_PHASE2_TASKPACK：把更多 inline 物理函式納入 shared core。
- 決定是否進入 MVP 主線實作。
- 工具化 VAL-003（發球 preset 批次）與 VAL-005（return-studio 回擊批次）。
- 將 `docs/physics-engine-v2-plan.md` 中的後段研究繼續拆成更細的實驗條目。
- 決定 `return-studio.html` 是否只是研究工具，或哪些機制要進入正式遊戲審查。

## AI 協作方式

ChatGPT：幫你整合、規劃、收斂成流程。
Claude：邊界審查員，只挑錯、降溫、確認邊界，不幫忙擴充方案或提出大重構。
Codex：執行檔案與程式工作。
GLM：整理、摘要、交叉檢查。
人類使用者：決定哪個方向符合產品目標。

## 工作節奏

1. 每天只允許一個主問題。
2. 核心物理模型一天最多改一次。
3. 高階模型只做審查與判斷，不做雜務。
4. GLM 只做 read-only 整理與報告。
5. Codex 改程式前必須先說明檔案、目的、風險、驗收方式。
6. 每次工作結束必須產一份小 checkpoint。
7. 累了就只允許整理，不允許做架構決策。
