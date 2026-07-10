# 物理模型規格

> 本文件描述目前 repo 中已核對的物理模型狀態。它不是最終物理判決，也不新增新物理設計。
>
> 核對基準：2026-07-06  
> 主要參考：`docs/CORE_FILE_SYNC_STATUS.md`、`AI_CONTEXT/DRAFTS/core_physics_symbol_inventory.md`、`docs/physics-engine-v2-plan.md`

## 文件使用方式

本文件把內容分成三類：

1. **已核對正式行為**：目前可在正式頁或核心工具中以檔案內容確認。
2. **研究 / 工具頁行為**：目前主要出現在 `return-studio.html` 或校準工具中，不可自動視為正式遊戲已部署。
3. **待驗證 / 待決策事項**：需要 Codex 進一步核對、高階模型審查，或人類使用者決定。

低成本模型整理本文時，必須保留這三類狀態，不得把研究中內容寫成已部署。

## 座標系

根據既有文件，世界座標為：

- `x`：左右。
- `y`：上下。
- `z`：前後，正方向朝接發球方。

角速度使用同一組右手座標系。詳細定義仍以 `docs/physics-engine-v2-plan.md` Phase 0 為準。

## 單位與尺度

- 距離：公尺。
- 速度：m/s。
- 角速度：rad/s。
- 發球旋轉由 rps 轉為 rad/s：`ω = 2π × rps`。

## 球參數

已在工具與核心檔案中反覆出現的基準值：

- 球半徑：`R = 0.02m`。
- 球質量：`M = 0.0027kg`。
- 薄殼球轉動慣量係數：`ALPHA = 2 / 3`。
- 轉動慣量：`I = ALPHA * M * R * R`。

## 已核對正式行為

### 1. 桌面反彈 v2 常數

在 `game4.html` 與 `physics-studio.html` 可見一致的桌面反彈常數：

| 常數 | 值 | 狀態 |
|---|---:|---|
| `EPSILON_VERTICAL` | `0.876` | 已核對 |
| `EPSILON_OBLIQUE` | `0.57` | 已核對 |
| `EPSILON_MIN` | `0.45` | 已核對；物理精確性仍屬工程常數 |
| `OBLIQUE_ANGLE_DEG` | `83` | 已核對 |
| `SPIN_EPSILON_REFERENCE` | `6.0` | 已核對；仍需視為工程常數 |
| `CONTACT_FRICTION_MU` | `0.13` | 已核對；Phase 2 校準值 |

相關函式：

- `dynamicEpsilon()`
- `bounceTangentialAxis()`
- `bounceWithSpinPhysical()`

### 2. game4.html 的球拍接觸基準

`game4.html` 已核對到以下球拍接觸相關常數：

| 常數 | 值 / 狀態 | 備註 |
|---|---|---|
| `PADDLE_RESTITUTION_LOW` | `0.9` | 低速反彈係數上限 |
| `PADDLE_RESTITUTION_HIGH` | `0.75` | 高速反彈係數下限 |
| `PADDLE_SPEED_LOW` | `2.0` | 速度插值下限 |
| `PADDLE_SPEED_HIGH` | `12.0` | 速度插值上限 |
| `PADDLE_FRICTION` | `0.4` | 球拍切向摩擦係數，工程估計值 |
| `PADDLE_RESTITUTION` | `-0.9` | 舊模型殘留，目前註解指出只有 loop 使用 |

相關函式：

- `dynamicPaddleEpsilon()`
- `bounceOffPlane()`
- `makeRacketReturnVelocity()`
- `solveRacketVelXForTargetLandingX()`

### 3. game4.html 的回擊技術狀態

| 技術 | 目前狀態 | 備註 |
|---|---|---|
| 正手攻球 / 反手攻球 | 使用球拍接觸力學 | 走 `makeRacketReturnVelocity()` / `bounceOffPlane()` 路徑 |
| 切球 push | 使用 adaptive push + 球拍接觸力學 | 力道、拍面角度依 `game4.html` 公式計算 |
| 拉球 loop | 仍使用舊 `model:'direct'` 路徑 | 不可寫成已套用球拍接觸力學 |

### 4. game4.html 的 adaptive push 公式族

`game4.html` 中已核對到：

- `computeAdaptivePushMagnitude(incomingVel, contactZ, topspin)`
- `computeAdaptivePushTiltX(incomingVel)`
- `computeAdaptivePushTiltY(topspin)`

這些屬於正式遊戲頁目前可見行為，但它們是否是最終物理解仍未決定。

### 5. physics-studio.html 的發球物理狀態

`physics-studio.html` 可見註解寫明桌面反彈 v2 逐字對齊 `game4.html` / `return-studio.html`，並取代舊 `BOUNCE_PHYSICS/applyBounceSpin`。

目前已核對：桌面反彈常數關鍵字與 `game4.html` 一致。  
尚未核對：核心函式是否真正逐字一致。

## 研究 / 工具頁行為

### 1. return-studio.html 的 blend 機制

`return-studio.html` 有以下研究/工具頁機制：

- `PADDLE_BLEND = 0.65`
- `computeBlendedNormal()`
- `bounceOffPlane(..., blend)` 的 7 參數版本

這些目前不可自動視為 `game4.html` 正式遊戲已部署。

### 2. return-studio.html 的 substepped push

`return-studio.html` 有以下研究/工具頁機制：

- `bounceOffPlaneSubstepped()`
- `PADDLE_SPRING_K`
- `PADDLE_DAMPING_RATIO`
- `PUSH_WRIST_BRAKE_RATE = 0`

這些機制是否應取代 `game4.html` 的瞬時 `bounceOffPlane()` 路徑，尚未決定。

### 3. return-studio.html 的 adaptive push 公式族

`return-studio.html` 中已核對到：

- `computeAdaptivePushLift(incomingVel)`
- `computeAdaptivePushDrive(incomingVel)`
- `computeAdaptivePushTiltX()`
- `computeAdaptivePushTiltY()`
- `PUSH_TILT_Y = 0.8`

可見 `PUSH_LIFT_K = 0`、`PUSH_DRIVE_K = 0`，代表目前 lift / drive 對 incoming speed 的負回饋係數為 0。這與 `game4.html` 的 `computeAdaptivePushMagnitude()` 路徑不同。

### 4. return-studio.html 的 loop 狀態

`return-studio.html` 註解寫明 loop / 拉球技術先整個移除。這與 `game4.html` 仍保留 loop 舊模型不同。

## 待驗證 / 待決策事項

### 1. game4.html 與 return-studio.html 的同步策略

目前已核對兩者在 push / loop / blend / substepped 等路徑上不同。下一步需要人類決定：

- `return-studio.html` 是否只是研究工具，不要求與正式遊戲同步。
- 或者某些研究機制是否應在審查後回寫 `game4.html`。

### 2. blend 的物理地位

`blend` 可改善某些結果，但不可視為最終物理解。尤其不可將 `blend=0.9` 或高 blend 值寫成已證明的物理答案。

可能需要高階模型審查的替代方向包括：

- tangential compliance
- contact-point velocity
- finite racket mass / passive giving
- 膠皮/海綿模型

### 3. 切球法向反彈係數

既有文件指出目前切球可能有「子彈感 / 碰撞感」，根源可能是法向反彈係數過高。這仍是待驗證事項，不是已決策事項。

### 4. loop / 拉球重設計

`game4.html` 仍保留舊 loop，`return-studio.html` 已移除 loop。loop 是否重新設計、何時重新接回正式遊戲，需人類與高階模型決策。

### 5. 驗證命令標準化

目前 repo 沒有 `package.json` / `npm test`。現有驗證主要依賴：

- 獨立 Node 腳本。
- 瀏覽器內函式批次模擬。
- 工具頁視覺檢查。

需要後續建立可重跑的正式驗證命令清單，並與 `VALIDATION_PLAN.md` 的 `VAL-009` / `VAL-010` 對應。

### 6. 舊 `tiltX` / `tiltY` 回歸範圍

既有文件與研究草稿中的舊 `tiltX` / `tiltY` 回歸範圍，只保留作歷史參考與脈絡對照，屬於已取代或待重新推導的內容，不可直接當成目前正式常數引用。若後續要重新採用，必須先完成對應的重新推導與驗證，並回連 `TODO-007`。

這一段也要和 `MODEL_DECISIONS.md` 的 `TODO-007`、`VALIDATION_PLAN.md` 的 `VAL-009` / `VAL-010` 一起看，不能單獨引用舊數字。

## 不合理參數警訊

以下情況不可直接寫入正式規格：

- 將 `blend=0.9` 當作最終物理解。
- 將 `return-studio.html` 工具頁研究機制寫成 `game4.html` 已部署行為。
- 把單次參數搜尋結果升格成模型決策。
- 把使用者視覺觀察直接升格成物理定論。
- 單獨調整摩擦、力道、拍面角度或揮拍方向，卻不重做聯合驗證。
- 用 `contactOffset` 之類獨立接觸點自由度繞過球面/平面幾何限制。

## 關聯文件

- `docs/CORE_FILE_SYNC_STATUS.md`
- `docs/physics-engine-v2-plan.md`
- `AI_CONTEXT/DRAFTS/core_physics_symbol_inventory.md`
- `AI_CONTEXT/DRAFTS/push_model_summary.md`
- `AI_CONTEXT/DRAFTS/validation_plan_draft.md`
