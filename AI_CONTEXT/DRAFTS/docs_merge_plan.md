# DRAFT: Docs merge plan
#
# Status: draft only.
# This file is a proposed merge plan and must not be treated as committed documentation.
# Last touched: 2026-07-06
# Docs 合併計畫

> **狀態聲明：** 本文件僅根據使用者提供的輸入整理，不新增事實，不做最終物理判斷。所有建議均標示來源與不確定性。本計畫不直接修改正式 docs，僅提供建議。

---

## 1. 每個正式 docs 檔案應該承載的內容範圍

### `docs/PROJECT_OVERVIEW.md`
- 專案目標與遊戲模式
- 目前物理模擬範圍（已部署部分）
- 目前最高風險模組
- 已完成 / 進行中 / 尚未處理項目
- AI 協作方式（Codex / GLM / 高階模型 / 人類）

**邊界：** 不承載具體參數值、實驗細節或決策理由。

### `docs/PHYSICS_MODEL_SPEC.md`
- 座標系與單位規格
- 球參數（`R`、`M`、`ALPHA`）
- 球桌參數（`EPSILON`、`μ`、動態 `ε` 機制）
- 球拍參數（`PADDLE_FRICTION`、`PADDLE_RESTITUTION_*`、`PADDLE_SPEED_*`）
- 桌面反彈模型（`bounceWithSpinPhysical()`、`dynamicEpsilon()`）
- 球拍接觸模型（`bounceOffPlane()`、`dynamicPaddleEpsilon()`、`makeRacketReturnVelocity()`）
- 切球 push/chop 已部署參數與公式
- 攻球已部署參數
- 瞄準機制（`solveRacketVelXForTargetLandingX()`）
- 連續對打負回饋控制律
- 已知問題（已部署版本適用）
- 不合理參數警訊

**邊界：** 只承載「已部署」的規格。研究中參數（`blend`、`scale`、`outputRescale` 等）不寫入正式規格，除非經 Codex 審查確認已寫回檔案。

### `docs/DEVELOPMENT_MATRIX.md`
- 穩定模組對照表
- 半穩定模組對照表
- 研究中模組對照表
- 只適合高階模型判斷的模組
- 可交給 GLM 整理的模組
- 不確定性摘要

**邊界：** 承載模組層級的狀態與風險，不承載具體實驗數字或參數值。

### `docs/EXPERIMENT_LOG.md`
- 所有實驗的結構化紀錄（EXP-ID、日期、目的、模型版本、固定參數、搜尋參數、測試案例、結果、失敗案例、判斷、下一步）
- 實驗狀態摘要表

**邊界：** 承載實驗事實紀錄，不承載決策判斷（決策歸 `MODEL_DECISIONS.md`）。

### `docs/MODEL_DECISIONS.md`
- 已明確決策
- 已被取代或否定的舊決策
- 只是實驗結果，還不是決策
- 待決策事項
- 需要高階模型審查的決策
- 需要人類使用者最終決定的事項

**邊界：** 承載決策與理由，不承載完整實驗過程（過程歸 `EXPERIMENT_LOG.md`）。

### `docs/AI_HANDOFF_TEMPLATE.md`
- 交接模板格式
- 使用提醒

**邊界：** 承載模板本身，不承載具體任務实例。

### `docs/physics-engine-v2-plan.md`
- 保留為歷史開發紀錄與交接文件
- 已部署的內容應被引用到正式 docs，但原檔保留作為原始紀錄
- 研究中 / 未部署的內容保留在原檔

**邊界：** 本檔案是跨多次對話的原始紀錄，不應刪除，但應標示哪些段落已由正式 docs 承載。

---

## 2. 哪些 GLM 草稿可以合併到哪個正式 docs

| GLM 草稿 | 目標正式 docs | 合併方式 | 備註 |
|---|---|---|---|
| `experiment_log_draft.md` | `docs/EXPERIMENT_LOG.md` | 取代目前骨架，填入 EXP-001~038 完整紀錄 | 需 Codex 審查（見 §3） |
| `development_matrix_draft.md` | `docs/DEVELOPMENT_MATRIX.md` | 取代目前簡表，填入五分類完整對照表 | 需 Codex 審查（見 §3） |
| `ai_handoff_template_draft.md` | `docs/AI_HANDOFF_TEMPLATE.md` | 取代目前空骨架，填入完整模板 | 低風險，可直接合併 |
| `model_decisions_draft.md` | `docs/MODEL_DECISIONS.md` | 取代目前單一決策，填入六分類完整紀錄 | 需 Codex 審查（見 §3） |
| `push_model_summary.md` | `docs/PHYSICS_MODEL_SPEC.md`（部分） | 只合併「已套用」標記的參數與機制 | 研究中內容留 DRAFTS（見 §4） |
| `physics_engine_v2_structured_summary.md` | 不直接合併 | 作為拆分 `physics-engine-v2-plan.md` 的參考依據 | 留 DRAFTS（見 §4） |

---

## 3. 哪些草稿需要 Codex 審查後才能合併

### `experiment_log_draft.md` → `docs/EXPERIMENT_LOG.md`
**需要 Codex 審查的原因：**
- 所有實驗數字來自 `docs/physics-engine-v2-plan.md` 的文件紀錄，未經重新執行驗證
- 多個實驗的結論被後續實驗取代，狀態標記需確認
- 部分實驗日期標示「不確定」
- `game4.html` 與 `return-studio.html` 的物理邏輯是否完全同步——不確定，影響「已套用」標記的正確性

**Codex 審查重點：**
- 確認每個 EXP 的「已套用 / 已被取代 / 研究中」狀態標記是否與目前 repo 實際狀態一致
- 確認「已套用」實驗的數字是否仍為目前部署版本
- 確認失敗案例紀錄是否完整

### `development_matrix_draft.md` → `docs/DEVELOPMENT_MATRIX.md`
**需要 Codex 審查的原因：**
- 草稿中標示「已部署」的模組需確認 `game4.html` 與 `return-studio.html` 是否同步
- `racketNormalTiltX` 標示「已部署（研究中移除）」，`game4.html` 同步狀態不確定
- `push-optimizer.js` 是否為 repo 追蹤檔案——不確定
- `PADDLE_SPRING_K` / `PADDLE_DAMPING_RATIO` 確切預設值——不確定

**Codex 審查重點：**
- 確認每個模組的「已部署 / 半穩定 / 研究中」狀態
- 確認 `game4.html` 與 `return-studio.html` 的同步狀態
- 確認不確定性摘要中的項目

### `model_decisions_draft.md` → `docs/MODEL_DECISIONS.md`
**需要 Codex 審查的原因：**
- 「已決策」項目需確認目前 repo 仍維持該決策
- 「已被取代」項目需確認舊機制確實已從程式碼移除
- 「待決策」與「需高階模型審查」項目需確認尚未被解決

**Codex 審查重點：**
- 確認「已決策」的 15 項決策目前仍有效
- 確認「已被取代」的 7 項舊決策確實已從程式碼移除
- 確認「待決策」的 7 項尚未被解決

### `push_model_summary.md` → `docs/PHYSICS_MODEL_SPEC.md`（部分合併）
**需要 Codex 審查的原因：**
- 「已套用」標記需確認 `game4.html` 與 `return-studio.html` 實際程式碼一致
- `swingDirection.y = +0.3` 標示「已套用」但使用者資料顯示應為負值——修正會讓其他公式全垮，需聯合校準，目前是否仍為 +0.3 需確認
- `racketNormalTiltX` 公式 `−0.144 − 0.538×incomingVel.x` 標示「已套用」但研究版已移除此 hack，`game4.html` 同步狀態不確定
- `PUSH_WRIST_BRAKE_RATE` 是否為有效正式機制——不確定
- `gravity: -4.2` 是否為正式設計值——不確定

**Codex 審查重點：**
- 逐項確認「已套用」機制是否確實存在於 `game4.html` 與 `return-studio.html`
- 確認 `racketNormalTiltX` 公式在 `game4.html` 中的狀態
- 確認 `swingDirection.y` 目前值

---

## 4. 哪些內容應留在 AI_CONTEXT/DRAFTS

### `physics_engine_v2_structured_summary.md`
- **留 DRAFTS**
- 理由：這是 `docs/physics-engine-v2-plan.md` 的結構化摘要，用途是協助拆分計畫，不是正式規格
- 不確定標記較多，不適合直接升級為正式 docs

### `push_model_summary.md` 中的研究中內容
以下段落應留在 DRAFTS，不合併到正式 docs：

| 段落 | 狀態 | 理由 |
|---|---|---|
| §2.2 研究中 / 瀏覽器原型驗證過但尚未寫回檔案的機制 | 研究中 | 尚未寫回檔案，不應寫入正式規格 |
| §2.3 尚未開始的機制 | 尚未開始 | 未實作，不應寫入正式規格 |
| §3.8 研究中候選參數 | 研究中 | 未部署，不應寫入正式規格 |
| §5 已知問題（部分） | 混合 | 已部署版本的問題可合併；研究中版本的問題留 DRAFTS |
| §6 系統性失敗案例 | 混合 | 已部署版本的失敗案例可合併；研究中版本的失敗案例留 DRAFTS |
| §7 不合理參數警訊 | 適合合併 | 這些警訊適合寫入正式規格的「警訊」段落 |
| §8 待驗證假設 | 留 DRAFTS | 假設不應寫入正式規格 |
| §9 給高階模型審查的問題 | 留 DRAFTS | 審查問題不應寫入正式規格 |

### `experiment_log_draft.md` 中的不確定標記
- 所有標示「不確定」的日期與數字應保留標記，不合併時不應移除標記

### `model_decisions_draft.md` 中的「只是實驗結果」與「需高階模型審查」段落
- 「只是實驗結果，還不是決策」（§3）可合併到 `MODEL_DECISIONS.md`，但需保留「非決策」標記
- 「需要高階模型審查的決策」（§5）可合併到 `MODEL_DECISIONS.md`，但需保留「不確定」標記
- 「需要人類使用者最終決定的事項」（§6）可合併到 `MODEL_DECISIONS.md`

---

## 5. 哪些內容應從長文件拆出

`docs/physics-engine-v2-plan.md` 是目前最長的文件，同時記錄已部署、研究中、未整合、路徑分歧的內容。建議拆出以下內容到正式 docs：

### 可拆出到 `docs/PHYSICS_MODEL_SPEC.md`
| 來源段落 | 內容 | 狀態 |
|---|---|---|
| Phase 0 座標與單位規格 | 座標系統、單位、換算公式 | 已部署 |
| Phase 0 使用者確認的旋轉設計原則 | 6 條設計原則 | 已決策 |
| Phase 2 摩擦係數 μ 校準 | `μ=0.13`、動態 `ε` 機制 | 已部署 |
| Phase 6 球拍接觸力學 | `bounceOffPlane()`、`dynamicPaddleEpsilon()`、`PADDLE_FRICTION=0.4` | 已部署 |
| Phase 6 回擴技術等級 | `RETURN_SKILL_LEVEL` 參數 | 已部署 |
| Phase 6 範圍解模式 | `RANGE_SOLUTION_MODE`、`executionVariance` | 已部署 |
| Phase 6 拍面角度與揮拍方向解耦 | 力道公式、固定角度/方向 | 已部署 |
| 修正回擊起點 0.12m | `start = {...hitPoint}` | 已部署 |
| 拍面平面角度改為相對揮拍方向 | `racketNormalTiltY`/`racketNormalTiltX` | 已部署 |
| 回擊瞄準機制升級 | `solveRacketVelXForTargetLandingX()` | 已部署 |
| 連續對打負回饋控制律 | `magnitude = 0.7 − 0.3 × (來球水平速度 − 2.0)` | 已部署 |
| 弧線過高問題修正 | `tiltY = 0.006×|topspin|`，clamp 0.4~0.55 | 已部署 |
| 4 顆發球拋球高度修正 | 4 顆 preset 的 `start.y` 修正 | 已部署 |
| `physics-studio.html` 換成真實 v2 引擎 | 取代舊 `BOUNCE_PHYSICS` | 已部署 |

### 可拆出到 `docs/EXPERIMENT_LOG.md`
| 來源段落 | 內容 |
|---|---|
| Phase 1 驗證紀錄 | 13 通過 / 0 失敗 |
| Phase 2 校準紀錄 | `μ` 校準過程、apex 遞減驗證 |
| Phase 3 發球換算紀錄 | 16 顆 preset 換算 |
| Phase 4 整合紀錄 | 批次驗證無 NaN |
| Phase 5 驗證紀錄 | 3 顆過不了網、techniqueVel 校準（已被取代） |
| Phase 6 校準紀錄 | 球拍接觸力學校準、技術等級、時機窗口、力道公式 |
| Phase 6 附加研究 | 固定框架受控實驗、容錯窗口、聯合控制律 |
| Stage 1~2 實驗紀錄 | `scale` 因子、`blend` 機制、聯合搜尋 |

### 可拆出到 `docs/MODEL_DECISIONS.md`
| 來源段落 | 內容 |
|---|---|
| Phase 0 定案 | 座標與單位規格 |
| Phase 2 定案 | `μ=0.13` |
| Phase 3 定案 | 16 顆發球換算 |
| Phase 6 各項定案 | 球拍接觸力學、技術等級、範圍解模式、解耦、起點修正、拍面角度、瞄準升級、負回饋控制律、弧線修正、拋球高度、physics-studio 換引擎 |
| 已被取代的結論 | Phase 5 techniqueVel、固定角度/speedScaledZ、聯合公式、tiltX 回歸、tiltX hack、「切球對下旋不敏感是缺點」、「合力能無中生有創造效率」 |
| blend=0.9 決策 | 不可視為最終物理解 |

### 可拆出到 `docs/DEVELOPMENT_MATRIX.md`
| 來源段落 | 內容 |
|---|---|
| 各 Phase 的狀態 | 模組狀態分類 |
| 已知問題 | 風險標記 |
| 路徑分歧 | 同步風險 |

### 應留在 `docs/physics-engine-v2-plan.md`
- 研究中 / 尚未部署的內容（Stage 1~5 規劃、`blend` 兩階段動態模型、彈簧-阻尼原型、膠皮/海綿參數化、削球/擋球技術）
- 交接注意事項
- 給 Codex 下一輪審查的問題清單
- 歷史開發過程的完整敘述（作為原始紀錄）

---

## 6. 合併優先順序

### 優先級 1：低風險，可直接合併

| 步驟 | 草稿 | 目標 docs | 理由 |
|---|---|---|---|
| 1a | `ai_handoff_template_draft.md` | `docs/AI_HANDOFF_TEMPLATE.md` | 模板不含物理判斷，低風險 |

### 優先級 2：需 Codex 審查，但內容已整理完整

| 步驟 | 草稿 | 目標 docs | 理由 |
|---|---|---|---|
| 2a | `model_decisions_draft.md` | `docs/MODEL_DECISIONS.md` | 決策紀錄已整理完整，Codex 需確認狀態標記 |
| 2b | `development_matrix_draft.md` | `docs/DEVELOPMENT_MATRIX.md` | 對照表已整理完整，Codex 需確認模組狀態 |

### 優先級 3：需 Codex 審查，內容較長

| 步驟 | 草稿 | 目標 docs | 理由 |
|---|---|---|---|
| 3a | `experiment_log_draft.md` | `docs/EXPERIMENT_LOG.md` | 38 個實驗，Codex 需確認狀態標記與數字 |
| 3b | `push_model_summary.md`（已套用部分） | `docs/PHYSICS_MODEL_SPEC.md` | 需逐項確認「已套用」標記 |

### 優先級 4：長文件拆分，需人類確認

| 步驟 | 來源 | 目標 docs | 理由 |
|---|---|---|---|
| 4a | `docs/physics-engine-v2-plan.md` 已部署段落 | `docs/PHYSICS_MODEL_SPEC.md` | 需人類確認拆分範圍 |
| 4b | `docs/physics-engine-v2-plan.md` 實驗段落 | `docs/EXPERIMENT_LOG.md` | 需人類確認拆分範圍 |
| 4c | `docs/physics-engine-v2-plan.md` 決策段落 | `docs/MODEL_DECISIONS.md` | 需人類確認拆分範圍 |

### 優先級 5：不合併，留 DRAFTS

| 步驟 | 草稿 | 理由 |
|---|---|---|
| 5a | `physics_engine_v2_structured_summary.md` | 拆分參考用，不直接合併 |
| 5b | `push_model_summary.md`（研究中部分） | 研究中內容不寫入正式 docs |

---

## 7. 每一步合併的風險

### 步驟 1a：`ai_handoff_template_draft.md` → `docs/AI_HANDOFF_TEMPLATE.md`
- **風險：低**
- 模板為行政工具，不含物理判斷
- 唯一風險：模板格式可能與專案實際需求不完全匹配

### 步驟 2a：`model_decisions_draft.md` → `docs/MODEL_DECISIONS.md`
- **風險：中**
- 「已決策」項目若 repo 已變更，會記錄過時決策
- 「已被取代」項目若舊機制仍存在於程式碼，會造成混淆
- 「需高階模型審查」的問題若已被解決，會記錄過時問題

### 步驟 2b：`development_matrix_draft.md` → `docs/DEVELOPMENT_MATRIX.md`
- **風險：中**
- `game4.html` 與 `return-studio.html` 同步狀態不確定，影響「已部署」標記
- `racketNormalTiltX` 的「已部署（研究中移除）」狀態特殊，可能造成混淆
- `push-optimizer.js` 是否為 repo 追蹤檔案——不確定

### 步驟 3a：`experiment_log_draft.md` → `docs/EXPERIMENT_LOG.md`
- **風險：中高**
- 38 個實驗的數字來自文件紀錄，未經重新執行驗證
- 多個實驗的結論被後續實驗取代，狀態標記需逐一確認
- 部分實驗日期標示「不確定」
- 若 `game4.html` 與 `return-studio.html` 不同步，「已套用」標記可能不準確

### 步驟 3b：`push_model_summary.md`（已套用部分） → `docs/PHYSICS_MODEL_SPEC.md`
- **風險：高**
- 「已套用」標記需逐項確認 `game4.html` 與 `return-studio.html` 實際程式碼
- `swingDirection.y = +0.3` 標示「已套用」但使用者資料顯示應為負值，修正尚未部署
- `racketNormalTiltX` 公式在 `game4.html` 中的同步狀態不確定
- 若將研究中內容誤寫入正式規格，會誤導後續開發者

### 步驟 4a~4c：長文件拆分
- **風險：高**
- `docs/physics-engine-v2-plan.md` 是跨多次對話的原始紀錄，拆分可能遺漏上下文
- 拆分後的正式 docs 可能失去原始紀錄的完整脈絡
- 拆分範圍需人類確認，否則可能將研究中內容誤標為已部署

---

## 8. 合併前需要人類確認的事項

### 全局確認事項
1. **`game4.html` 與 `return-studio.html` 的物理邏輯是否完全同步？** ——不確定。`return-studio.html` 含 `PADDLE_BLEND`、substepped push 等研究機制，`game4.html` 的可見段落看起來不完全一致。需要人類確認是否需要專門 diff。
2. **`push-optimizer.js` 是否為 repo 追蹤檔案？** ——不確定。文件中多次引用但主要檔案清單未列出。
3. **`.claude/` 資料夾內容** ——未檢查、未修改，需人類確認是否影響專案狀態。
4. **Codex 平行分支的 `dwell_grip` 接觸模型與 `contactOffset` 偏移** ——不確定是否已同步，需人類確認處理方式。

### 步驟 2a 前確認
5. **15 項「已決策」是否目前仍有效？** ——需 Codex 確認。
6. **7 項「已被取代」的舊機制是否確實已從程式碼移除？** ——需 Codex 確認。

### 步驟 2b 前確認
7. **每個模組的「已部署 / 半穩定 / 研究中」狀態是否準確？** ——需 Codex 確認。
8. **`racketNormalTiltX` 在 `game4.html` 中是否仍為舊公式？** ——不確定。

### 步驟 3a 前確認
9. **38 個實驗的狀態標記（已完成/已套用/已被取代/研究中）是否準確？** ——需 Codex 確認。
10. **「已套用」實驗的數字是否仍為目前部署版本？** ——不確定，各階段驗證數字來自不同時期文件記錄。

### 步驟 3b 前確認
11. **`swingDirection.y` 目前值為何？** ——標示「已套用」為 +0.3，但使用者資料顯示應為負值，修正尚未部署。
12. **`racketNormalTiltX` 公式 `−0.144 − 0.538×incomingVel.x` 在 `game4.html` 中是否仍存在？** ——不確定。
13. **`PUSH_WRIST_BRAKE_RATE` 是否為有效正式機制？** ——不確定。
14. **`gravity: -4.2` 是否為正式設計值？** ——不確定。
15. **`PADDLE_SPRING_K` / `PADDLE_DAMPING_RATIO` 的確切預設值？** ——不確定（研究版常數）。

### 步驟 4a~4c 前確認
16. **`docs/physics-engine-v2-plan.md` 的拆分範圍是否由人類確認？** ——建議人類審查 §5 的拆分建議。
17. **拆分後原檔是否保留為歷史紀錄？** ——建議保留，不刪除。
18. **拆分後正式 docs 與原檔的引用關係如何建立？** ——建議在正式 docs 中標示來源段落。

---

## 附錄：不確定性摘要

| 項目 | 不確定內容 |
|---|---|
| `game4.html` 與 `return-studio.html` 同步 | 兩檔案物理邏輯是否完全同步，不確定 |
| 各階段驗證數字 | 來自不同時期文件記錄，最新部署版本確切數字不確定 |
| `PADDLE_SPRING_K` / `PADDLE_DAMPING_RATIO` | 研究版常數，確切預設值不確定 |
| `PUSH_WRIST_BRAKE_RATE` | 是否為有效正式機制，不確定 |
| `gravity: -4.2` | 是否為正式設計值，不確定 |
| `.claude/` 資料夾 | 未檢查內容、未修改 |
| Codex 平行分支 | `dwell_grip` 接觸模型與本路徑是否已同步，不確定 |
| `push-optimizer.js` | 是否為 repo 追蹤檔案，不確定 |
| `racketNormalTiltX` 在 `game4.html` | 是否仍為舊公式，不確定 |
| `swingDirection.y` 目前值 | 標示 +0.3 但應為負值，修正狀態不確定 |