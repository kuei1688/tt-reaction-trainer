# 3D 物理遷移測試計畫書

日期：2026-07-16

> 2026-07-16 交接註記：`docs/3D_SIDE_SPIN_CALIBRATION_EXECUTION_PLAN.md` 的隔離 prototype 已執行並結案，證據在 `AI_CONTEXT/game5_side_spin_calibration_2026-07-16/`。本文件保留作為下一階段全 3D 遷移的固定測試與停止條件，不把 prototype 結果升格成物理校準。

## 目的與邊界

本計畫驗證 `omega.y` 真實側旋、Magnus 飛行、axial spin 分離，以及四個頁面的資料流是否一致。測試結果分成三類：

1. **數學／程式正確性**：可以由自動測試判定。
2. **prototype 行為穩定性**：可以用曲線、批次與視覺檢查判定，但不等於物理真值。
3. **物理校準證據**：必須有具名影片或量測資料，不能只靠 solver 成功率。

本計畫不把 legal-serve gate、曲線平滑或 loader readiness 宣稱成物理正確。

## 0. 執行前準備

### 0.1 固定版本與輸出隔離

- 記錄 `git status --short`、目前 commit、`MAGNUS_COEFFICIENT`、`MAGNUS_LIFT_SLOPE`、`SIM_TIME_DILATION`。
- 把舊的 `AI_CONTEXT/*_2026-07-14_raw.*` 視為 legacy baseline，不覆寫。
- 研究工具目前多數把輸出檔名寫死在 `AI_CONTEXT/`；正式重跑前要先加 output suffix，或在隔離的 prototype copy 執行。
- 新輸出建議使用：`AI_CONTEXT/3d_baseline_YYYY-MM-DD/` 或具名研究資料夾，每個檔案附 `generatedAt`、git 狀態、參數快照與 tool name。已完成的 2026-07-16 側旋校準 evidence 不覆寫，固定保留在 `AI_CONTEXT/game5_side_spin_calibration_2026-07-16/`。

### 0.2 固定三種尺度

- 世界／接觸輸入：real scale，旋轉單位 rad/s。
- 頁面飛行：目前 gravity `-4.2` 的 simulation scale。
- 報告輸出：若要和影片或真實量測比較，統一轉回 real scale，並明確記錄 `D = sqrt(9.8 / 4.2)`。

## 1. 必跑的自動驗證

這些是每次修改 3D core 或 preset 後都要跑的固定 gate。

| ID | 命令 | 目的 | 通過條件 |
|---|---|---|---|
| G-01 | `node tools/physics-3d-spin.test.js` | omega.y 方向、Magnus、axial、legacy bounce equivalence | exit 0 |
| G-02 | `node tools/serve-generator-contract.test.js` | 47 顆 preset 的 sideName、curveDirection、omega.y、videoId | 47/47 |
| G-03 | `node tools/serve-batch-validation.test.js` | Game 4 / Physics Studio 合法發球與跨頁一致性 | legal gate 47/47；cross-check 47/47 |
| G-04 | `node tools/batch-validation.test.js` | 正式 Game 4 回擊回歸 | 明確區分既有 snapshot mismatch 與新回歸 |
| G-05 | `node tools/load-game4-physics.js` | Game 4 symbols、shared core dependency | readiness ok、無 missing/unresolved |
| G-06 | `node tools/load-return-studio-physics.js` | Return Studio symbols、DOM-free extraction | readiness ok、無 exception |
| G-07 | `node tools/return-studio-batch-validation.test.js` | Return Studio research batch | exceptions = 0；ok count 只作研究指標 |

G-04、G-07 的結果不能直接取代物理校準；若失敗，必須列出 preset、技術、失敗原因與是否為既有基準差異。

## 2. 3D 核心數學實驗

### E-01：左右側旋鏡像性

固定起點與速度，分別使用：

- `omega.y = -150, -75, 0, +75, +150 rad/s`
- `omega.x = 0`
- `omega.z = 0`
- `axialSpin = 0`

量測 `net`、第一跳、第二跳的 `x/y/z`，以及每個時間點的 `omega`。

預期：

- `+omega.y` 的 Magnus `a.x > 0`。
- `-omega.y` 的 Magnus `a.x < 0`。
- 左右成對案例的 `y/z` 接近相同，`x` 近似反號。
- 不應出現只改 sign 卻連起點或落點模板一起鏡像的現象。

### E-02：Magnus 係數敏感度

固定 3 個代表案例：無旋、純下旋、純側旋；掃描：

```text
C = 0, 0.0014, 0.0028, 0.0042
```

量測 `deltaX_at_net`、`deltaX_at_first_bounce`、`net_clearance`、第一／第二跳位置。

預期：

- `C=0` 是無 Magnus 基準。
- 側旋的橫向偏移隨 `|C|` 平滑增加。
- 無旋案例不應因 `C` 改變而產生橫向偏移。
- 不應因係數改變而出現數值爆炸、穿桌、無限反彈或突然換 regime。

注意：這是 sensitivity，不是用 batch 成功率直接選最終係數。

### E-03：axial / corkscrew 分離

固定同一個 forward velocity，分別測：

- `omega = 0, axialSpin = 125.66`
- `omega.y = +125.66, axialSpin = 0`
- `omega.y = -125.66, axialSpin = 0`
- `omega.y = 0, axialSpin = 0`

預期：

- axial spin 與 velocity 同軸時，Magnus 橫向加速度接近 0。
- 只有 `omega.y` 才產生左右曲線。
- axial 欄位不能被輸出成 legacy `sidespin` 或被遺失在 bounce 後。

## 3. 飛行與桌面反彈曲線

### E-04：3D 發球軌跡 baseline

重跑 47 顆 preset，輸出每顆：

- `points` / `velocities` / `spins`
- `netY`、net clearance
- 第一跳、第二跳
- `omega.x/y/z` 與 `axialSpin`
- `spin` legacy compatibility 欄位

這是新的 3D baseline。舊資料不得覆寫，應與 legacy baseline 並列比較。

### E-05：桌面接觸與旋轉轉換

使用 `tools/bounce-spin-decay-sweep.js` 的 1A/1B 思路，但 3D 版本必須直接呼叫 `bounceWithSpinPhysical3D`，掃描：

- `omega.x`：`[-250, 250]`
- `omega.y`：`[-200, 200]`
- `omega.z`：`[-100, 100]` 作為 compatibility / corkscrew 對照
- 入射 `vy`：`[1, 6]`
- 入射 `vx`：`[-3, 3]`

量測：`omega` bounce 前後、velocity、epsilon、rolling/sliding regime、spin retention。

預期：

- `omega.y` 在桌面法向接觸中不應被錯當成 x-kick sidespin。
- `omega.x` 的桌面摩擦行為維持既有 topspin/backspin 接觸語意。
- `omega.y` 經過 bounce 後仍存在，並可繼續影響下一段 Magnus 飛行。

### E-06：post-bounce / receive curve

重跑 `tools/push-tilty-lift-drive-sweep.js`，至少使用：

- `backspin_long_backhand`
- `no_spin_long_forehand`
- `backspin_long_forehand`
- 一顆 left sidespin
- 一顆 right sidespin

掃描 `tiltY`、`lift`、`drive`，並記錄：

- 出球 `omega.x/y/z`
- net clearance
- 第一跳落點
- 反彈後 `omega`
- 接球點 velocity / spin
- 可行區域 bounds

這組是目前最重要的曲線重跑，因為它把球拍接觸、Magnus 飛行與桌面反彈串在一起。

## 4. 側旋與回擊實驗

### E-07：側旋 × 拍面／拍速補償

重跑 `tools/sidespin-sweep.js` 的 4A/4B/4C，但輸入改成 canonical `omega.y`，不要只改 legacy `sidespin`：

- `omega.y × tiltX`
- `omega.y × planeVel.x`
- `omega.y × tiltX × planeVel.x`

量測：`out omega.y`、`landing.x`、`net clearance`、`out omega.x`、regime。

預期：

- left/right 兩側的補償曲線應方向相反且形狀近似對稱。
- 不能用 `Math.sign(legacy sidespin)` 取代 canonical sign。
- 若曲線只在 fallback 區間跳動，應標記為 solver 問題，不要改 Magnus。

### E-08：反彈後旋轉衰減與連續回合

重跑：

```text
node tools/game4-push-sustainable-rally-validation.js
node tools/return-studio-batch-validation.test.js
```

量測每拍：

- hit index / hit position
- incoming/outgoing `omega.x/y/z`
- spin retention / sign flip
- net clearance、落點與回合數

此結果只作 prototype stability evidence。不能用 50 回合成功就宣稱「旋轉衰減已物理校準」。

## 5. 視覺曲線檢查

數值通過後才做視覺檢查，至少在 360×800 左右的手機比例與桌面比例各看一次：

1. `+omega.y` 與 `-omega.y` 的球路曲線是否左右反向。
2. 曲線是否出現 bullet trajectory、突然折線、穿桌、穿網或 bounce 後方向錯亂。
3. 反彈點與 `points` / `bounces` 數值是否一致。
4. `spin3d` 顯示與 legacy compatibility 顯示是否沒有把 axial 誤標成 sidespin。
5. Game 5 實機按鍵方向與影片中的 left/right metadata 是否一致。

視覺檢查要記錄截圖或影片時間點；不能只寫「看起來合理」。

## 6. 校準順序與停止條件

### 執行順序

1. G-01、G-02、E-01、E-03：先確認資料契約與方向。
2. E-02、E-04：鎖定係數 sensitivity 與 47 顆 3D baseline。
3. E-05：確認桌面反彈與 spin transfer。
4. E-06、E-07：重跑 post-bounce 與側旋補償曲線。
5. E-08、G-04、G-07：最後才看回擊與連續對打。
6. 完成影片／量測比對後，才考慮修改 `MAGNUS_COEFFICIENT` 或 preset。

### 停止條件

- E-01 鏡像性失敗：停止，不做 preset fitting，先修座標或 sign。
- E-03 axial 分離失敗：停止，不把 axial 結果寫入 sidespin。
- E-02 出現非平滑或爆炸：停止，不用成功率挑係數。
- 只有個別 preset 落點誤差失敗：保留 core，進入 preset／solver calibration 分支。
- 所有 prototype gate 通過但沒有影片量測：只能標記 baseline，不升格成 physical truth。

## 7. 交付物

每次重跑至少留下：

- versioned raw JSON
- summary table / curve data
- 參數快照
- git status / commit
- 失敗案例清單
- 代表案例圖或截圖
- legacy vs 3D 差異摘要

推薦輸出目錄：`AI_CONTEXT/3d_baseline_YYYY-MM-DD/`。不要覆寫 `AI_CONTEXT/*_2026-07-14_raw.*`。
