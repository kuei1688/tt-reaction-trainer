# Checkpoint 2026-07-10

> This is a status checkpoint only.
> It summarizes current progress and pause points.
> It does not make physics decisions and does not introduce new work items.

## 1. 本輪完成的工作

1. 建立 `shared-physics-core.js`，從 `game4.html`、`physics-studio.html`、`return-studio.html` 抽出 5 個常數與 2 個函式，Phase 1 遷移完成（未 commit）。
2. 三個核心 HTML 檔案加入 `<script src="shared-physics-core.js">`，移除 inline 重複常數與函式。
3. 建立 `docs/SHARED_PHYSICS_CORE_PHASE1_APPROVAL.md`（2026-07-09 核准）與 `docs/SHARED_PHYSICS_CORE_PHASE2_TASKPACK.md`（Phase 2 任務包）。
4. 建立跨檔案一致性檢查工具 `tools/cross-file-consistency-check.js` 與 `tools/consistency-whitelist.json`，可自動比對三個 HTML 之間的常數和函式指紋。
5. 建立批次驗證工具 `tools/batch-validation.test.js` 與 `tools/load-game4-physics.js`，把 VAL-004 從瀏覽器 console 升級為可重跑的 Node 工具。
6. 建立 `docs/MVP_MAINLINE_SPEC.md`，定義窄版可玩迴圈（一發球、一玩家回擊、一對手回球、得分結束）。
7. 建立 `docs/PLAN_DRAFTING_CHECKLIST.md`，定義 AI 起草新計畫前的自檢流程與 Claude 邊界審查規則。
8. 建立 `docs/BATCH_VALIDATION_TOOLING_TASKPACK.md`，記錄批次驗證工具化的設計與驗收條件。
9. 交派 GLM 任務包 016（新治理與 MVP 文件審查）、017（只讀物理抽取器 MVP）、018（只讀物理抽取器任務包），對應 GLM 輸出草稿已在 `AI_CONTEXT/DRAFTS/`。
10. 建立 `tools/run_glm_sidecar.ps1`，用於啟動 GLM 5.2 cloud sidecar。
11. 更新所有交接文件（CHECKPOINT、CODEX_CONTEXT_SUMMARY、changed_files_manifest、PROJECT_OVERVIEW、VALIDATION_PLAN、00_READ_ME_FIRST）到 2026-07-10 狀態。

## 2. 驗證結果（2026-07-10 全部通過）

| 工具 | 結果 |
|---|---|
| `node tools/cross-file-consistency-check.js` | 6 constant rules + 2 function rules，全部通過 |
| `node tools/physics-v2-contact-mechanics.js` | 13 通過 / 0 失敗 |
| `node tools/racket-contact-mechanics.js` | 單軸對照全部通過 |
| `node tools/batch-validation.test.js` | 14 通過 / 0 失敗 |

## 3. Git 狀態

- HEAD：`9d0274a`（切球揮拍角度改為往前為主 26.6 度）
- 已修改未 commit：`game4.html`、`physics-studio.html`、`return-studio.html`（shared-physics-core.js 遷移）
- Untracked 新檔：`shared-physics-core.js`、多份 `docs/`、`AI_CONTEXT/`、`tools/` 新工具、`.claude/`

## 4. 核心檔案角色

| 檔案 | 角色 | 注意事項 |
|---|---|---|
| `game4.html` | 正式遊戲頁 | attack / push 已走球拍接觸路徑；loop 仍保留舊 direct model；已改用 shared-physics-core.js |
| `return-studio.html` | 回擊研究 / 調參工具頁 | 有 blend / substepped push 研究機制；已改用 shared-physics-core.js；不可直接寫成正式遊戲已部署 |
| `physics-studio.html` | 發球 preset / 發球物理工具頁 | 已改用 shared-physics-core.js；桌面反彈 v2 常數與 game4 一致 |
| `shared-physics-core.js` | 共用物理核心 | Phase 1：5 常數 + 2 函式；Phase 2 尚未開始 |

## 5. 最高風險區

- push/chop 切球球拍接觸力學與參數搜尋結果。
- `return-studio.html` 研究機制是否要回寫 `game4.html`。
- `blend` 的物理地位，尤其高 blend 或 `blend=0.9`。
- loop / 拉球舊模型是否要重設計。
- shared-physics-core.js 遷移尚未 commit。

## 6. 下一步建議

1. 決定是否 commit shared-physics-core.js 遷移的改動（三個 HTML + shared core）。
2. 執行 SHARED_PHYSICS_CORE_PHASE2_TASKPACK：把更多 inline 物理函式納入 shared core。
3. 決定是否進入 MVP 主線實作。
4. 決定 `return-studio.html` 是否只是研究工具，或哪些機制要進入正式遊戲審查。
5. 繼續拆解 `docs/physics-engine-v2-plan.md` 後段研究。
6. 草稿區若有過時措辭，接 `AI_CONTEXT/GLM_TASKS/012_draft_stale_language_cleanup.md` 清理。
7. 剩餘草稿邊界收尾可接 013、014、015。

## 7. 注意

- 本輪沒有修改物理模型參數，只做共用核心遷移、工具化與文件整理。
- 本輪沒有把任何研究結果升格成正式決策。
- shared-physics-core.js 目前不暴露 CommonJS exports，loader 使用 per-symbol extraction 作為 fallback。
