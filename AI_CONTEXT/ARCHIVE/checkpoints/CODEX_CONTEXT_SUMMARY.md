# Codex Context Summary

> 本摘要根據目前 repo 可見檔案與本輪文件整理結果更新。它不是物理模型結論，也不取代正式 docs。
>
> 更新日期：2026-07-10
> 本輪範圍：shared-physics-core Phase 1 遷移、批次驗證工具化、MVP 主線規格、計畫審查清單、交接文件更新；未修改物理模型參數。

## 1. 專案目標

本專案是桌球接發球反應訓練工具，逐步擴展成包含簡化物理模擬的訓練遊戲。核心目標是訓練使用者判斷旋轉、落點與回球技術，並用可觀察、可校準的物理模型輔助發球與回擊模擬。

目前管理上的主要目標是建立可交接、可審查、可交給低成本模型整理的文件與實驗流程，而不是繼續調參。

## 2. 本輪已建立 / 更新的內容

### Shared Physics Core Phase 1（2026-07-09 核准，2026-07-10 遷移完成）

- `shared-physics-core.js`：新建共用物理核心，抽出 5 個常數與 2 個函式。
  - 常數：`EPSILON_VERTICAL`、`EPSILON_OBLIQUE`、`EPSILON_MIN`、`SPIN_EPSILON_REFERENCE`、`CONTACT_FRICTION_MU`。
  - 函式：`dynamicEpsilon()`、`bounceTangentialAxis()`。
- `game4.html`、`physics-studio.html`、`return-studio.html`：加入 `<script src="shared-physics-core.js">`，移除 inline 重複常數與函式。**這些修改尚未 commit。**
- `docs/SHARED_PHYSICS_CORE_PHASE1_APPROVAL.md`：Phase 1 審查與核准記錄（2026-07-09）。
- `docs/SHARED_PHYSICS_CORE_PHASE2_TASKPACK.md`：Phase 2 任務包，目標是把更多 inline 物理函式納入 shared core。

### 跨檔案一致性檢查工具

- `tools/cross-file-consistency-check.js`：自動比對三個 HTML 之間的常數和函式指紋。
- `tools/consistency-whitelist.json`：白名單，記錄哪些差異是預期的（例如 `return-studio.html` 的研究機制不應出現在 `game4.html`）。

### 批次驗證工具化

- `tools/batch-validation.test.js`：把 VAL-004（正式遊戲回擊檢查）從瀏覽器 console 升級為可重跑的 Node 工具。涵蓋 attack、push、loop 三條路徑。
- `tools/load-game4-physics.js`：從 `game4.html` 與 `shared-physics-core.js` 載入物理常數與函式供測試使用。
- `docs/BATCH_VALIDATION_TOOLING_TASKPACK.md`：批次驗證工具化的設計與驗收條件。

### MVP 主線規格與計畫審查

- `docs/MVP_MAINLINE_SPEC.md`：定義窄版可玩迴圈。一個發球影片 → 對應物理發球 → 玩家選技術（chop / flat push / attack）＋方向修正 → 模擬回擊 → 對手自動回一球 → 得分結束。明確列出 non-goals 防止 scope creep。
- `docs/PLAN_DRAFTING_CHECKLIST.md`：AI 起草新計畫前的自檢清單，包含邊界確認、gameplay approximation vs physics truth 區分、Claude 邊界審查流程。

### GLM 任務包 016-018

- `AI_CONTEXT/GLM_TASKS/016_new_governance_and_mvp_docs_review.md`：新治理與 MVP 文件審查。
- `AI_CONTEXT/GLM_TASKS/017_read_only_physics_extractor_mvp.md`：只讀物理抽取器 MVP。
- `AI_CONTEXT/GLM_TASKS/018_read_only_physics_extractor_taskpack.md`：只讀物理抽取器任務包。
- 對應 GLM 輸出草稿在 `AI_CONTEXT/DRAFTS/016_*`、`017_*`、`018_*`。

### 其他

- `tools/run_glm_sidecar.ps1`：GLM 5.2 cloud sidecar 啟動腳本。
- 所有交接文件已更新到 2026-07-10 狀態。

## 3. 核心檔案角色

| 檔案 | 角色 | 注意事項 |
|---|---|---|
| `game4.html` | 正式遊戲頁 | attack / push 已走球拍接觸路徑；loop 仍保留舊 direct model；已改用 shared-physics-core.js |
| `return-studio.html` | 回擊研究 / 調參工具頁 | 有 blend / substepped push 等研究機制；已改用 shared-physics-core.js；不可直接寫成正式遊戲已部署 |
| `physics-studio.html` | 發球 preset / 發球物理工具頁 | 已核對桌面反彈 v2 關鍵常數與 `game4.html` 一致；已改用 shared-physics-core.js |
| `shared-physics-core.js` | 共用物理核心 | Phase 1：5 常數 + 2 函式；Phase 2 尚未開始 |
| `physics-presets.json` | 發球 preset 資料 | 本輪未調整 |
| `docs/physics-engine-v2-plan.md` | 歷史長文與原始交接資料 | 混有已採用、研究中、已取代內容，引用前必須分類 |

## 4. 已核對的重要差異

- `game4.html` 仍保留 loop / 拉球舊 direct model；`return-studio.html` 註解寫明 loop 先移除。
- `return-studio.html` 有 `PADDLE_BLEND`、`computeBlendedNormal()`、`bounceOffPlaneSubstepped()`、`PUSH_WRIST_BRAKE_RATE`；`game4.html` 未核對到同等機制。
- `game4.html` 的 adaptive push 使用 `computeAdaptivePushMagnitude(incomingVel, contactZ, topspin)` 等公式族。
- `return-studio.html` 的 adaptive push 使用 lift / drive / fixed tilt 相關公式族，與 `game4.html` 不同。
- `physics-studio.html` 與 `game4.html` 可見桌面反彈 v2 關鍵常數一致（已由 `cross-file-consistency-check.js` 自動驗證）。

## 5. 已執行的驗證（2026-07-10 全部通過）

| 工具 | 結果 |
|---|---|
| `node tools/cross-file-consistency-check.js` | 6 constant rules + 2 function rules，全部通過 |
| `node tools/physics-v2-contact-mechanics.js` | 13 通過 / 0 失敗 |
| `node tools/racket-contact-mechanics.js` | 單軸對照全部通過 |
| `node tools/batch-validation.test.js` | 14 通過 / 0 失敗 |

完整輸出在 `AI_CONTEXT/test_output.txt`。

## 6. 最高風險區

- push/chop 切球球拍接觸力學與參數搜尋結果。
- `return-studio.html` 的研究機制是否要回寫 `game4.html`。
- `blend` 的物理地位，尤其高 blend 或 `blend=0.9`。
- loop / 拉球舊模型是否要重設計。
- shared-physics-core.js 遷移尚未 commit；Phase 2 尚未開始。
- `TODO-006` / `TODO-008` 已有明確驗證入口，但仍需後續工具化與實跑。

## 7. GLM 使用方式

GLM 5.2 cloud 已確認可透過 Ollama OpenAI-compatible endpoint 呼叫：

- endpoint：`http://127.0.0.1:11434/v1/chat/completions`
- model：`glm-5.2:cloud`
- `reasoning_effort`：`max`
- 啟動腳本：`tools/run_glm_sidecar.ps1`

GLM 適合做低成本摘要、表格、初稿與長文結構化。GLM 不應做最終物理判斷，也不可把它的「已部署」或「風險：無」直接寫入正式 docs。

## 8. 下一步建議

1. 決定是否 commit shared-physics-core.js 遷移的改動（三個 HTML + shared core）。
2. 執行 SHARED_PHYSICS_CORE_PHASE2_TASKPACK：把更多 inline 物理函式納入 shared core。
3. 決定是否進入 MVP 主線實作。
4. 決定 `return-studio.html` 是否只是研究工具，或哪些機制要進入正式遊戲審查。
5. 繼續拆解 `docs/physics-engine-v2-plan.md` 後段研究，補齊來源、版本與失敗案例。
6. 草稿區若出現太像正式結論的語句，先接 `AI_CONTEXT/GLM_TASKS/012_draft_stale_language_cleanup.md` 一次清掉。
7. 剩下偏 summary / review / TODO 的草稿，接 `AI_CONTEXT/GLM_TASKS/013_remaining_draft_boundary_pack.md` 收尾。
