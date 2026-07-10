# Changed Files Manifest

> 更新日期：2026-07-10
> 說明：本輪完成 shared-physics-core Phase 1 遷移、批次驗證工具化、MVP 主線規格、計畫審查清單，並更新所有交接文件。

## 核心程式變更（未 commit）

| 檔案 | 狀態 | 說明 |
|---|---|---|
| `game4.html` | 修改（未 commit） | 加入 `<script src="shared-physics-core.js">`，移除 inline 重複常數與函式（5 常數 + 2 函式） |
| `physics-studio.html` | 修改（未 commit） | 同上 |
| `return-studio.html` | 修改（未 commit） | 同上 |

## 新增檔案

### 共用物理核心

| 檔案 | 說明 |
|---|---|
| `shared-physics-core.js` | 共用物理核心；Phase 1：5 常數 + 2 函式（`dynamicEpsilon`、`bounceTangentialAxis`） |
| `docs/SHARED_PHYSICS_CORE_PHASE1_APPROVAL.md` | Phase 1 審查與核准記錄（2026-07-09） |
| `docs/SHARED_PHYSICS_CORE_PHASE2_TASKPACK.md` | Phase 2 任務包 |

### 批次驗證工具

| 檔案 | 說明 |
|---|---|
| `tools/batch-validation.test.js` | VAL-004 批次驗證；attack / push / loop 三條路徑，14 通過 / 0 失敗 |
| `tools/load-game4-physics.js` | 從 game4.html 與 shared-physics-core.js 載入物理供測試 |
| `tools/cross-file-consistency-check.js` | 跨檔案常數與函式指紋一致性檢查 |
| `tools/consistency-whitelist.json` | 一致性白名單 |
| `docs/BATCH_VALIDATION_TOOLING_TASKPACK.md` | 批次驗證工具化設計與驗收條件 |

### MVP 與計畫文件

| 檔案 | 說明 |
|---|---|
| `docs/MVP_MAINLINE_SPEC.md` | MVP 主線規格；窄版可玩迴圈定義 |
| `docs/PLAN_DRAFTING_CHECKLIST.md` | 計畫審查清單；AI 起草新計畫前自檢與 Claude 邊界審查流程 |

### GLM 工具

| 檔案 | 說明 |
|---|---|
| `tools/run_glm_sidecar.ps1` | GLM 5.2 cloud sidecar 啟動腳本 |

### GLM 任務包

| 檔案 | 說明 |
|---|---|
| `AI_CONTEXT/GLM_TASKS/016_new_governance_and_mvp_docs_review.md` | 新治理與 MVP 文件審查 |
| `AI_CONTEXT/GLM_TASKS/017_read_only_physics_extractor_mvp.md` | 只讀物理抽取器 MVP |
| `AI_CONTEXT/GLM_TASKS/018_read_only_physics_extractor_taskpack.md` | 只讀物理抽取器任務包 |

### GLM 輸出草稿

| 檔案 | 說明 |
|---|---|
| `AI_CONTEXT/DRAFTS/016_new_governance_and_mvp_docs_review_glm_output.json` | GLM 016 輸出 JSON |
| `AI_CONTEXT/DRAFTS/016_new_governance_and_mvp_docs_review_glm_output.md` | GLM 016 輸出 Markdown |
| `AI_CONTEXT/DRAFTS/017_read_only_physics_extractor_mvp_glm_output.json` | GLM 017 輸出 JSON |
| `AI_CONTEXT/DRAFTS/017_read_only_physics_extractor_mvp_glm_output.md` | GLM 017 輸出 Markdown |
| `AI_CONTEXT/DRAFTS/018_read_only_physics_extractor_taskpack_glm_output.json` | GLM 018 輸出 JSON |
| `AI_CONTEXT/DRAFTS/018_read_only_physics_extractor_taskpack_glm_output.md` | GLM 018 輸出 Markdown |

### 既有文件（上一輪 07-06 建立，本輪更新）

| 檔案 | 狀態 | 說明 |
|---|---|---|
| `docs/PROJECT_OVERVIEW.md` | 更新 | 加入 MVP、PLAN_DRAFTING_CHECKLIST、SHARED_PHYSICS_CORE 參照 |
| `docs/VALIDATION_PLAN.md` | 更新 | VAL-004 已有工具且已執行；新增 VAL-011 跨檔案一致性檢查 |
| `AI_CONTEXT/00_READ_ME_FIRST.md` | 更新 | 必讀順序加入新文件；更新日期與下一步 |
| `AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md` | 更新 | 反映 07-10 完整狀態 |
| `AI_CONTEXT/changed_files_manifest.md` | 更新 | 本清單 |
| `AI_CONTEXT/CHECKPOINT_2026-07-10.md` | 新增 | 本輪 checkpoint |

### 上一輪（07-06）已建立的正式 docs（本輪未修改）

| 檔案 | 說明 |
|---|---|
| `docs/CORE_FILE_SYNC_STATUS.md` | 核心檔案差異核對 |
| `docs/DEVELOPMENT_MATRIX.md` | 模組成熟度、風險與模型分工 |
| `docs/EXPERIMENT_LOG.md` | EXP-001 至 EXP-038 狀態索引 |
| `docs/MODEL_DECISIONS.md` | 保守模型決策台帳 |
| `docs/PHYSICS_MODEL_SPEC.md` | 已核對正式行為、研究工具頁行為、待驗證事項 |
| `docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md` | 只讀核心函式 / 常數抽取規格 |
| `docs/BATCH_VALIDATION_SPEC.md` | 批次驗證規格 |
| `docs/PHYSICS_RESEARCH_TAIL_SPLIT_PLAN.md` | 後段研究拆解計畫 |
| `docs/PHYSICS_RESEARCH_TAIL_INDEX.md` | 後段研究條目索引 |
| `docs/DOCS_MAINTENANCE_PLAN.md` | 文件維護規則與下一步 |
| `docs/AI_HANDOFF_TEMPLATE.md` | AI 任務交接模板 |

## 明確未修改

- `physics-presets.json`
- `videos.json`
- `images/`
- 既有 `tools/physics-v2-contact-mechanics.js`
- 既有 `tools/racket-contact-mechanics.js`
- 既有 `tools/import-serve-presets.mjs`

## 驗證紀錄（2026-07-10 全部通過）

| 工具 | 結果 |
|---|---|
| `node tools/cross-file-consistency-check.js` | 6 constant rules + 2 function rules，全部通過 |
| `node tools/physics-v2-contact-mechanics.js` | 13 通過 / 0 失敗 |
| `node tools/racket-contact-mechanics.js` | 單軸對照全部通過 |
| `node tools/batch-validation.test.js` | 14 通過 / 0 失敗 |

## 注意

shared-physics-core.js 遷移的三個 HTML 改動尚未 commit。`git diff` 只會顯示刪除的 inline 常數與函式，以及新增的 `<script src>` 行。

`shared-physics-core.js` 目前不暴露 CommonJS exports，`tools/load-game4-physics.js` 使用 per-symbol extraction 作為 fallback。
