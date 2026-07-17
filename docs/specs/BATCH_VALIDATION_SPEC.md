# 批次驗證規格

> 本文件定義發球與回擊批次驗證的最小正式規格。它只描述驗證入口、輸出欄位、失敗分類與審查邊界，不新增物理解讀。
>
> 建立日期：2026-07-06；2026-07-15 更新發球資料與左右側旋語意契約
> 來源草稿：`AI_CONTEXT/DRAFTS/batch_validation_design_draft.md`

## 目的

把目前分散在 HTML 頁面、Node 腳本與長文中的驗證需求，固定成可追蹤的批次驗證規格。目標是讓驗證結果可重跑、可比較、可保留失敗案例，並且清楚區分正式遊戲頁與研究頁。

## 非目的

- 不修改任何核心程式。
- 不做最終物理解判斷。
- 不把 `return-studio.html` 的研究結果寫成 `game4.html` 正式已部署。
- 不把單一成功率當成完整驗證。

## 驗證入口

| 編號 | 驗證項目 | 入口檔案 | 角色 |
|---|---|---|---|
| VAL-003 | 發球 preset / 軌跡檢查 | `physics-studio.html`, `game4.html`, `physics-presets.json` | L3 瀏覽器內函式批次驗證候選 |
| VAL-004 | 正式遊戲回擊檢查 | `game4.html`, `physics-presets.json` | 正式遊戲回擊批次檢查候選 |
| VAL-005 | 回擊研究頁檢查 | `return-studio.html`, `physics-presets.json` | 研究頁批次檢查候選 |
| VAL-006 | 核心檔案同步差異檢查 | 待建立工具 | 只讀差異抽取 |
| VAL-007 | 參數搜尋 / optimizer 重跑 | `push-optimizer.js`（若存在） | 研究驗證候選 |
| VAL-008 | 視覺軌跡檢查 | `return-studio.html`, `physics-studio.html` | 視覺與數值並行檢查 |
| VAL-009 | `scale` / `outputRescale` 一致性檢查 | `game4.html`, `return-studio.html`, `physics-presets.json` | 對應 `TODO-006` |
| VAL-010 | `PADDLE_BLEND=0` 部署前確認 | `game4.html`, `return-studio.html` | 對應 `TODO-008` |
| VAL-012 | 左右側旋語意與 per-video preset contract | `serve-generator.html`, `videos.json`, `physics-presets.json`, `tools/serve-generator-contract.test.js` | 防止旋轉名稱、球路方向與 legacy sign 再次混用 |

## run-serve-batch

### 目標

對 `physics-presets.json` 中目前 47 顆 generated per-video preset 跑發球軌跡批次檢查，產生第一跳、第二跳與過網高度等結果。現行入口是 `node tools/serve-batch-validation.test.js`。

### 共用成功條件（2026-07-15）

發球「成功」使用 `tools/serve-success-gate.js` 的共同 gate，兩個 solver 都必須通過：

1. 沒有網碰 (`netHit` 不成立)。
2. 第一跳落在發球方 (`z < 0`) 的桌面內。
3. 第二跳落在接球方 (`z > 0`) 的桌面內。

`firstBounce` / `secondBounce` 的目標誤差、過網高度與速度仍輸出作為 solver 診斷，但不再混入「有沒有成功發球」的 gate。2026-07-15 重新產生模板後，`game4.html` 與 `physics-studio.html` 均為 **47/47** 通過；兩個入口的軌跡 cross-check 亦為 **47/47**。

### 輸入

- `physics-presets.json` 中的 47 顆 generated preset。
- `physics-studio.html` 與 `game4.html` 的發球解算入口。

### 輸出欄位

- preset ID。
- `tags.videoId`、`tags.videoCategory`。
- `tags.sideName`、`tags.curveDirection`（若為側旋）。
- `variation.spin.topspin`、`variation.spin.sidespin` 與單位。
- 第一跳位置。
- 第二跳位置。
- 過網高度。
- 失敗原因。

### 失敗分類

- 未過網。
- 未落桌。
- 第一跳或第二跳位置偏離目標。
- 其它明確物理失敗原因。

## run-return-batch

### 目標

對 47 顆 generated preset × 技術跑回擊檢查，輸出落點、過網高度、成功與否與失敗案例。

### 技術分類注意事項

- `attack`：使用球拍接觸力學，走 `makeRacketReturnVelocity()` / `bounceOffPlane()` 路徑。
- `push`：必須清楚區分 `game4.html` 與 `return-studio.html` 的公式族，不可混用。
- `loop`：`game4.html` 仍是舊 `model:'direct'` 路徑；`return-studio.html` 已移除，不可寫成同一套。

### 輸出欄位

- preset ID。
- 技術名稱。
- 回擊落點。
- 過網高度。
- 成功與否。
- 失敗原因。

## run-spin-direction-check

### 必要指標

- topspin 正負號。
- `correctSpinFrac` 或同等指標。

### 原則

- 不可只看成功率。
- 必須檢查旋轉方向。
- 視覺檢查只能輔助，不能獨立下結論。

## serve-generator-contract

### 目標

在跑物理 solver 前，先確認資料語意沒有再次漂移。這是結構與命名驗證，不是物理真實性驗證。

### 必要檢查

- 每個 approved video 恰好有一個 preset。
- 每個 preset 有唯一 `tags.videoId`。
- `_left` / `_right` 的 `sideName`、`curveDirection` 與 legacy sign 符合 `docs/SPIN_DIRECTION_CONTRACT.md`。
- 產生器不再用 sidespin sign 鏡像整條位置模板。
- 不接受未標明左右的 legacy sidebackspin 自動猜測。

### 入口

`node tools/serve-generator-contract.test.js`

## run-scale-sync-check

### 目標

檢查 `scale` 與 `outputRescale` 的語義是否一致，並確認瞄準求解與實際輸出是否仍走同一套縮放物理。

### 輸出欄位

- 入口檔案。
- 常數值與版本。
- 一致性結果。
- 是否需回寫 `MODEL_DECISIONS.md` / `PHYSICS_MODEL_SPEC.md`。

## run-paddle-blend-zero-check

### 目標

確認 `PADDLE_BLEND=0` 時，研究頁與正式頁是否維持既有行為。

### 輸出欄位

- 檔案版本。
- `PADDLE_BLEND` 值。
- 一致性結果。
- 失敗原因。

## 共同風險

- 沒有只讀抽取工具時，容易把研究頁結果誤當正式頁。
- `physics-studio.html` 的註解不能直接當作逐字對齊證據。
- 只看單一指標會漏掉旋轉方向問題。
- 高 blend 或 `blend=0.9` 必須標成研究訊號。

## 最小可行版本

1. 建立只讀核心函式 / 常數抽取工具。
2. 把 `tools/physics-v2-contact-mechanics.js` 與 `tools/racket-contact-mechanics.js` 納入固定流程。
3. 定義 `run-serve-batch`、`run-return-batch`、`run-spin-direction-check`、`run-scale-sync-check`、`run-paddle-blend-zero-check` 的輸出 JSON schema。
4. 把驗證結果寫回 `AI_CONTEXT/test_output.txt` 或專門的驗證紀錄。

## 關聯文件

- `docs/VALIDATION_PLAN.md`
- `docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md`
- `docs/CORE_FILE_SYNC_STATUS.md`
- `docs/PHYSICS_MODEL_SPEC.md`
- `AI_CONTEXT/DRAFTS/batch_validation_design_draft.md`
