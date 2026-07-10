# DRAFT: Batch validation design
#
# Status: draft only.
# This file is a candidate design and must not be treated as a committed contract.
# Last touched: 2026-07-06

# 發球與回擊批次驗證文件草稿

> 本文件僅根據目前 repo 狀態與現有草稿整理，不新增事實，不做最終物理判斷。所有研究中、待驗證、已取代事項已明確標示。

## 1. `run-serve-batch` 草稿

**狀態：待建立工具（CMD-003）**

### 目標
對 16 顆 preset 跑發球軌跡批次檢查。此工具屬於 L3（瀏覽器內函式批次驗證），目的為抽取或驅動 `physics-studio.html`、`game4.html` 中的模擬函式，產生 JSON 結果，避免手動在 console 操作。

### 輸入
- 16 顆 preset（來源：`physics-presets.json`）
- 入口檔案：`physics-studio.html`、`game4.html`（需注意檔案角色差異）

### 輸出欄位
- 每顆 preset 的第一跳位置
- 每顆 preset 的第二跳位置
- 過網高度
- 失敗原因（不可只記成功率，必須列出失敗原因）

### 失敗分類
- 須明確記錄各 preset 失敗的具體物理原因（如未過網、未落桌等），不可僅以「失敗」帶過。

---

## 2. `run-return-batch` 草稿

**狀態：待建立工具（CMD-004）**

### 目標
對 16 顆 preset × 技術跑回擊檢查。此工具同屬 L3 驗證，需區分 attack / push / loop。

### 技術分類注意事項
- **attack (正手攻球 / 反手攻球)**：
  - 已套用球拍接觸力學，走 `makeRacketReturnVelocity()` / `bounceOffPlane()` 路徑。
- **push (切球)**：
  - 使用 adaptive push + 球拍接觸力學。
  - **待驗證/差異警告**：`game4.html` 與 `return-studio.html` 的 adaptive push 公式族不同。`game4.html` 使用 `computeAdaptivePushMagnitude(incomingVel, contactZ, topspin)`；`return-studio.html` 使用 `computeAdaptivePushLift(incomingVel)` 與 `computeAdaptivePushDrive(incomingVel)`，且目前 `PUSH_LIFT_K = 0`、`PUSH_DRIVE_K = 0`。不可混用這兩套公式。
- **loop (拉球)**：
  - **舊模型/已取代警告**：`game4.html` 的 `loop` 技術仍使用舊 `model:'direct'` 路徑，並有舊模型殘留常數 `PADDLE_RESTITUTION = -0.9`。不可寫成已套用球拍接觸力學。
  - **研究中/已移除**：`return-studio.html` 註解寫明「拉球技術先整個移除」。

### 輸出欄位
- 每顆 preset × 技術的回擊落點
- 過網高度
- 成功與否
- 失敗案例與原因

---

## 3. `run-spin-direction-check` 草稿

**狀態：待建立工具（CMD-006）**

### 必要指標
- topspin 正負號
- `correctSpinFrac` 或同等指標

### 驗證原則
- 不可只看某組參數成功率，卻不檢查旋轉方向。
- 視覺檢查可以發現異常，但不能單獨作為物理定論。

---

## 4. 需要瀏覽器/HTML 函式抽取時的風險

- **工具化缺口**：目前缺乏只讀抽取工具，無法自動比對 `game4.html`、`return-studio.html`、`physics-studio.html` 的核心函式與常數。若依賴手動在 console 操作，易產生驗證死角。
- **檔案角色不同**：`game4.html`（正式遊戲頁）、`return-studio.html`（回擊研究/調參工具頁）、`physics-studio.html`（發球 preset/發球物理工具頁）並非同一種角色，不可混用結果。
- **逐字對齊未驗證**：雖然 `physics-studio.html` 註解寫明桌面反彈 v2 逐字對齊 `game4.html` / `return-studio.html`，但目前僅核對關鍵字一致，尚未做逐字 diff。「逐字對齊」仍需工具化 diff 驗證，不能只靠註解。

---

## 5. 不可把 `return-studio` 結果混成 `game4` 的規則

- **不可混用結果**：`game4.html` 與 `return-studio.html` 不可混用結果。
- **不可直接宣稱部署**：不可只看 `return-studio.html` 成功，就宣稱 `game4.html` 已部署。
- **研究機制未部署**：`return-studio.html` 的 blend / substepped push 機制（如 `PADDLE_BLEND = 0.65`、`computeBlendedNormal()`、`bounceOffPlaneSubstepped()`）不能直接寫成 `game4.html` 正式遊戲已部署。
- **公式不可混用**：不能把 `game4.html` 的動態 tilt 公式與 `return-studio.html` 的固定/研究版公式混成同一套。
- **高 blend 值限制**：高 blend 或 `blend=0.9` 結果必須標成研究訊號，不可當成最終物理解。

---

## 6. 最小可行第一版

1. **建立抽取工具**：建立只讀核心函式 / 常數抽取工具，比對 `game4.html`、`return-studio.html`、`physics-studio.html`。
2. **納入固定驗證**：將 `tools/physics-v2-contact-mechanics.js` 與 `tools/racket-contact-mechanics.js` 納入固定驗證流程。
3. **批次檢查工具化**：將發球與回擊批次檢查工具化（即 `run-serve-batch` 與 `run-return-batch`），避免依賴瀏覽器 console 手動操作。
4. **聯合指標建立**：為 push/chop 建立同時檢查「過網、落點、旋轉方向、弧線高度」的聯合指標。
5. **審查門檻建立**：為 `return-studio.html` 研究機制建立「是否回寫正式遊戲」的審查門檻。

---

## 7. 建議正式 docs 章節

- `docs/EXPERIMENT_LOG.md`
- `docs/MODEL_DECISIONS.md`
- `docs/PHYSICS_MODEL_SPEC.md`
- `docs/CORE_FILE_SYNC_STATUS.md`
- `AI_CONTEXT/DRAFTS/validation_plan_draft.md`
# DRAFT: Batch validation design
#
# Status: draft only.
# This file is a candidate design and must not be treated as a committed contract.
# Last touched: 2026-07-06
