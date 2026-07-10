# DRAFT: Core file sync inventory
#
# Status: draft only.
# This file is a point-in-time inventory and must not be treated as authoritative state.
# Last touched: 2026-07-06
# 核心檔案同步盤點

> 本文件僅整理各檔案現況，不做最終物理判斷，不宣稱某一版正確。  
> 產生時間：依使用者提供之輸入整理。未重新執行任何驗證。

---

## 1. 總覽表

| 主題 | game4.html | return-studio.html | physics-studio.html | physics-v2-calibration.html | tools/physics-v2-contact-mechanics.js | tools/racket-contact-mechanics.js |
|---|---|---|---|---|---|---|
| 1. 桌面反彈模型 | v2 已部署 | v2 已部署（逐字對齊 game4） | v2 已部署（逐字對齊 game4） | v2 可調 μ / EPSILON_MIN | v2 原始版 + 單元測試 | 桌面退化對拍驗證 |
| 2. 球拍接觸模型 | 6 參數 `bounceOffPlane`（無 blend） | 7 參數 `bounceOffPlane`（有 blend）+ `bounceOffPlaneSubstepped` + `computeBlendedNormal` | 無球拍接觸 | 無球拍接觸 | 無球拍接觸 | 6 參數驗證版（無 blend） |
| 3. 切球 push 力道 | 單一 `magnitude` × 固定 `swingDirection`，負回饋公式 | `lift` + `drive` 拆分（目前 K=0，等於固定值） | 無 | 無 | 無 | 無 |
| 4. 切球拍面角度 | `tiltX` 依來球 x 速度回歸；`tiltY` 依殘留旋轉動態內插 0.4~0.55 | `tiltX` 固定 0；`tiltY` 固定 0.8 | 無 | 無 | 無 | 無 |
| 5. 攻球 attack | 已部署，`bounceOffPlane` 6 參數 | 已部署，`bounceOffPlane` 7 參數（blend=0） | 無 | 無 | 無 | 無 |
| 6. loop / 拉球 | 舊模型 `makeDirectReturnVelocity`（`PADDLE_RESTITUTION=-0.9`） | 已移除 loop 技術 | 無 | 無 | 無 | 無 |
| 7. blend 機制 | 無 | `PADDLE_BLEND=0.65`，slerp Y-Z only | 無 | 無 | 無 | 無 |
| 8. substepped | 無 | 已實作（兩級串聯彈簧-阻尼 + 切向黏性阻尼） | 無 | 無 | 無 | 無 |
| 9. wristBrakeRate | 無 | `PUSH_WRIST_BRAKE_RATE=0`（預設不啟用） | 無 | 無 | 無 | 無 |
| 10. 發球 simulateServe | 已部署 | 同 game4（逐字對齊） | 同 game4（已對齊） | 無 | 無 | 無 |
| 11. 回擊 returnBall | push/attack 走新模型；loop 走舊模型 | 全部走新模型（push 走 substepped） | 無 | 無 | 無 | 無 |
| 12. 瞄準求解 | 9 參數，拋物線快速估計 | 11 參數，push 用完整模擬落點（粗掃+二分） | 無 | 無 | 無 | 無 |
| 13. UI / 工具頁功能 | 正式遊戲 | 研究工具頁（連續對打、球例校正、停用瞄準等） | 發球 preset 編輯器 | μ / ε_MIN 校準 | Node 單元測試 | Node 對拍驗證 |

---

## 2. 逐主題分析

### 2.1 桌面反彈模型

| 項目 | 內容 |
|---|---|
| **涉及檔案** | `game4.html`、`return-studio.html`、`physics-studio.html`、`physics-v2-calibration.html`、`tools/physics-v2-contact-mechanics.js`、`tools/racket-contact-mechanics.js` |
| **函式 / 常數** | `bounceWithSpinPhysical()`、`dynamicEpsilon()`、`bounceTangentialAxis()`、`EPSILON_VERTICAL=0.876`、`EPSILON_OBLIQUE=0.57`、`EPSILON_MIN=0.45`、`CONTACT_FRICTION_MU=0.13`、`OBLIQUE_ANGLE_DEG=83`、`SPIN_EPSILON_REFERENCE=6.0` |
| **狀態** | 已部署到核心檔案；所有檔案常數一致 |
| **差異** | `physics-v2-calibration.html` 的 `EPSILON_MIN` 和 `μ` 是可調 slider（預設值與其他檔案一致），不影響正式遊戲。`physics-studio.html` 的 `simulateWithBaseVelocity()` 曾是獨立簡化版，現已逐字對齊 game4 的 `simulatePath()`。 |
| **風險** | 低。桌面力學在所有檔案間一致。 |
| **需 Codex 確認** | 無 |

---

### 2.2 球拍接觸模型

| 項目 | 內容 |
|---|---|
| **涉及檔案** | `game4.html`、`return-studio.html`、`tools/racket-contact-mechanics.js` |
| **函式 / 常數** | `bounceOffPlane()`、`computeRacketNormal()`、`dynamicPaddleEpsilon()`、`PADDLE_RESTITUTION_LOW=0.9`、`PADDLE_RESTITUTION_HIGH=0.75`、`PADDLE_SPEED_LOW=2.0`、`PADDLE_SPEED_HIGH=12.0`、`PADDLE_FRICTION=0.4` |
| **狀態** | `game4.html`：6 參數 `bounceOffPlane(vel, spin, planeNormal, planeVel, restitution, friction)`，無 blend。`return-studio.html`：7 參數 `bounceOffPlane(vel, spin, planeNormal, planeVel, restitution, friction, blend)`，有 blend，會呼叫 `computeBlendedNormal()`。`tools/racket-contact-mechanics.js`：6 參數驗證版（無 blend）。 |
| **差異** | ① 函式簽名不同（6 vs 7 參數）。② `return-studio.html` 有 `computeBlendedNormal()`（slerp，Y-Z only），`game4.html` 無。③ `return-studio.html` 有 `bounceOffPlaneSubstepped()`（兩級串聯彈簧-阻尼），`game4.html` 無。④ `return-studio.html` 有 `applyPushContact()` 分派函式（push 走 substepped，其他走 7 參數 bounceOffPlane），`game4.html` 無此分派。⑤ `return-studio.html` 有 `PADDLE_SPRING_K`、`PADDLE_DAMPING_RATIO=0.0421`、`BLADE_NODE_MASS`、`BLADE_SPRING_K`、`BLADE_DAMPING_RATIO=0.03`、`TANGENT_KP=1.0`、`SIM_TIME_DILATION`，`game4.html` 全部無。 |
| **風險** | **高**。兩檔案的球拍接觸力學架構完全不同：game4 用瞬時碰撞，return-studio 的 push 用逐步積分。攻球雖然都走 `bounceOffPlane`，但 return-studio 的版本會先做 `computeBlendedNormal`（blend=0 時等同跳過），game4 的版本無此步驟。 |
| **需 Codex 確認** | ① `game4.html` 與 `return-studio.html` 的球拍接觸力學是否應該同步？② `return-studio.html` 的 substepped 模型是否已準備好寫回 `game4.html`？③ `PADDLE_DAMPING_RATIO=0.0421` 在 `bounceOffPlaneSubstepped` 中實際未被使用（被 `speedDependentSpongeDampingRatio` 取代），是否應移除或標記？ |

---

### 2.3 切球 push / adaptivePush 模型

| 項目 | 內容 |
|---|---|
| **涉及檔案** | `game4.html`、`return-studio.html` |
| **函式 / 常數** | `computeAdaptivePushMagnitude()`（game4）、`computeAdaptivePushLift()` + `computeAdaptivePushDrive()`（return-studio）、`computeAdaptivePushTiltX()`、`computeAdaptivePushTiltY()`、`swingDirection` |
| **狀態** | 兩檔案均已部署 adaptivePush，但力道公式、拍面角度、揮拍方向、接觸模型全部不同。 |
| **差異** | **力道公式**：game4 用單一 `magnitude = clamp(0.7 - 0.3*(speed-2.0), 0.02, 2.0)` 乘上固定 `swingDirection = normalize({x:0, y:0.3, z:-1})`；return-studio 拆成 `lift = clamp(0.35 - 0*(speed-2), 0, 3.0) = 0.35` 和 `drive = clamp(0.7 - 0*(speed-2), 0.1, 3.0) = 0.7`（目前 K=0 等於固定值），`baseTechVel = {x:0, y:lift, z:-drive}`，並動態寫入 `tech.swingDirection = baseTechVel`。**拍面角度**：game4 的 `tiltX = clamp(-0.1436 - 0.5376*incomingVel.x, -1.2, 1.2)`（依來球 x 速度回歸），`tiltY = clamp(0.006*|topspin|, 0.4, 0.55)`（依殘留旋轉動態）；return-studio 的 `tiltX = 0`（固定），`tiltY = 0.8`（固定 `PUSH_TILT_Y`）。**接觸模型**：game4 的 push 走 6 參數 `bounceOffPlane`（瞬時碰撞）；return-studio 的 push 走 `bounceOffPlaneSubstepped`（逐步積分彈簧-阻尼）。**TECHNIQUES 預設值**：game4 的 `push.racketNormalTiltY=0.5`、`swingDirection=normalize({x:0, y:0.3, z:-1})`；return-studio 的 `push.racketNormalTiltY=1.5`、`swingDirection=normalize({x:0, y:0.65, z:-1.2})`（但 adaptivePush=true 時均被覆蓋）。 |
| **風險** | **極高**。切球力道、拍面角度、揮拍方向、接觸模型在兩檔案間全部不同。game4 的負回饋力道公式（K=0.3）在 return-studio 中被設為 K=0（等於固定值）。game4 的動態 tiltX/tiltY 在 return-studio 中被改為固定值。 |
| **需 Codex 確認** | ① return-studio 的 lift+drive 拆分模型是否已定案，應寫回 game4？② return-studio 的固定 tiltX=0 / tiltY=0.8 是否已定案，應寫回 game4？③ return-studio 的 substepped 接觸模型是否已定案，應寫回 game4？④ game4 的負回饋力道公式（K=0.3）是否已被 return-studio 的 K=0 取代？⑤ `PUSH_LIFT_K=0` 和 `PUSH_DRIVE_K=0` 是否為暫定值，之後會重新校準？ |

---

### 2.4 攻球 attack 模型

| 項目 | 內容 |
|---|---|
| **涉及檔案** | `game4.html`、`return-studio.html` |
| **函式 / 常數** | `TECHNIQUES.forehand_attack`、`TECHNIQUES.backhand_attack`、`makeRacketReturnVelocity()` |
| **狀態** | 兩檔案的攻球參數一致：`techniqueVel:{x:0, y:-0.234, z:-1}`、`racketNormalTiltY:0.1`、`racketNormalTiltX:0`、`executionVariance:{vel:0.08, normal:0.024}`。 |
| **差異** | ① game4 的攻球走 6 參數 `bounceOffPlane`；return-studio 的攻球走 `applyPushContact` → 7 參數 `bounceOffPlane`（blend=0）。② blend=0 時 `computeBlendedNormal` 直接回傳原 planeNormal，理論上結果應相同，但函式呼叫路徑不同。③ return-studio 的 `solveRacketVelXForTargetLandingX` 對非 push 技術仍用拋物線快速估計（跟 game4 一致），但多了 blend 參數傳遞。 |
| **風險** | 低至中。blend=0 時兩版本理論上等價，但未驗證是否完全逐位相同。 |
| **需 Codex 確認** | ① game4 的 6 參數 `bounceOffPlane` 與 return-studio 的 7 參數版本（blend=0）是否逐位相同？② return-studio 的 `applyPushContact` 分派邏輯是否會影響攻球路徑？ |

---

### 2.5 loop / 拉球是否仍使用舊模型

| 項目 | 內容 |
|---|---|
| **涉及檔案** | `game4.html`、`return-studio.html` |
| **函式 / 常數** | `makeDirectReturnVelocity()`、`PADDLE_RESTITUTION=-0.9`、`TECHNIQUES.loop` |
| **狀態** | `game4.html`：loop 仍使用舊模型 `makeDirectReturnVelocity()`（`model:'direct'`），參數為 `techniqueVel:{x:-0.6, y:1.0, z:-1.65}`、`spin:{topspin:0.9, sidespin:0}`、`bounceBoost:0.3`。`return-studio.html`：loop 技術已從 `DEFAULT_TECHNIQUES` 中完全移除，`makeReturnVelocity()` 直接呼叫 `makeRacketReturnVelocity()`，無 `makeDirectReturnVelocity` 函式。 |
| **差異** | ① game4 有 loop 技術和舊模型函式；return-studio 已移除。② game4 有 `PADDLE_RESTITUTION=-0.9` 常數（僅 loop 使用）；return-studio 無此常數。③ game4 的 `makeReturnVelocity()` 會依 `tech.model` 分流（push/attack 走新模型，loop/direct 走舊模型）；return-studio 的 `makeReturnVelocity()` 不分流，全部走新模型。 |
| **風險** | 中。game4 的 loop 仍用舊模型，未套用球拍接觸力學，旋轉是靜態寫死（`spin:{topspin:0.9}`）而非動態計算。 |
| **需 Codex 確認** | ① loop 是否計畫重新設計後再寫回？目前移除是暫時的還是永久的？② game4 的 loop 舊模型是否需要標記為「待淘汰」？ |

---

### 2.6 blend / substepped / wristBrakeRate 等研究機制

| 項目 | 內容 |
|---|---|
| **涉及檔案** | `return-studio.html`（全部僅在此檔案） |
| **函式 / 常數** | `PADDLE_BLEND=0.65`、`computeBlendedNormal()`（slerp Y-Z only）、`bounceOffPlaneSubstepped()`、`PADDLE_SPRING_K`、`PADDLE_DAMPING_RATIO=0.0421`、`BLADE_NODE_MASS`、`BLADE_SPRING_K`、`BLADE_DAMPING_RATIO=0.03`、`TANGENT_KP=1.0`、`PUSH_WRIST_BRAKE_RATE=0`、`SIM_TIME_DILATION=Math.sqrt(9.8/4.2)`、`restitutionToDampingRatio()`、`speedDependentSpongeDampingRatio()` |
| **狀態** | 全部僅在 `return-studio.html` 實作，未出現在 `game4.html`。 |
| **差異** | ① `PADDLE_BLEND=0.65`：文件摘要記載「預設 0」，但 return-studio 程式碼為 0.65。game4 無此常數。② `bounceOffPlaneSubstepped`：兩級串聯彈簧-阻尼逐步積分，切向用 `TANGENT_KP` 黏性阻尼力（引用 Gossard et al. arXiv:2604.11349），法向阻尼比隨撞擊速度動態計算（`speedDependentSpongeDampingRatio`）。③ `PADDLE_DAMPING_RATIO=0.0421` 對應 ε=0.876 的阻尼比，但在 `bounceOffPlaneSubstepped` 中實際未被使用（被 `speedDependentSpongeDampingRatio` 取代），參數保留但不使用。④ `PUSH_WRIST_BRAKE_RATE=0`：預設不啟用手腕煞車。⑤ `SIM_TIME_DILATION`：用於 substepped 內部尺度轉換（模擬重力 -4.2 → 真實 -9.8），game4 無此常數。 |
| **風險** | **高**。這些機制全部未寫入 game4，兩檔案的 push 技術行為完全不同。文件摘要說「PADDLE_BLEND 已實作（兩個檔案）」，但 game4 程式碼中無此常數，文件與程式碼不一致。 |
| **需 Codex 確認** | ① `PADDLE_BLEND=0.65` 是否為已定案值？文件摘要說「預設 0」是否過時？② substepped 模型是否已通過足夠驗證，可寫回 game4？③ `PADDLE_DAMPING_RATIO=0.0421` 未被使用，是否應移除？④ `TANGENT_KP=1.0` 的因次與校準狀態？⑤ `BLADE_NODE_MASS`、`BLADE_SPRING_K`、`BLADE_DAMPING_RATIO` 均為工程估計，是否需要重新校準？⑥ `PUSH_WRIST_BRAKE_RATE=0` 是否為暫定值？ |

---

### 2.7 發球 simulateServe / preset solve 邏輯

| 項目 | 內容 |
|---|---|
| **涉及檔案** | `game4.html`、`return-studio.html`、`physics-studio.html` |
| **函式 / 常數** | `simulateServe()`、`solveBaseVelocity()`、`solveServeBounceVelocity()`、`serveBounceScore()`、`getServeLengthProfile()`、`findServeBounceTime()`、`makeServeAimCandidate()` |
| **狀態** | 三檔案的發球解算邏輯一致。`game4.html` 和 `return-studio.html` 逐字對齊。`physics-studio.html` 的 `simulateWithBaseVelocity()` 已對齊 game4 的 `simulatePath()`（含網子碰撞、520 步上限）。 |
| **差異** | ① `physics-studio.html` 的 `simulateWithBaseVelocity()` 不記錄 `spins` 陣列（因為不需要回擊），但桌面碰撞物理一致。② `physics-studio.html` 有 `solveSecondBounceVelocity()` 和 `secondBounceScore()`（指定第二落點模式），game4 和 return-studio 無此模式。③ `physics-studio.html` 有 `classifyServeLength()` 函式，game4 和 return-studio 無。④ `physics-studio.html` 的 `serveBounceScore()` 參數名用 `state` 而非 `preset`，但邏輯一致。 |
| **風險** | 低。發球解算邏輯在核心檔案間一致。 |
| **需 Codex 確認** | 無 |

---

### 2.8 回擊 simulateReturn / returnBall 邏輯

| 項目 | 內容 |
|---|---|
| **涉及檔案** | `game4.html`、`return-studio.html` |
| **函式 / 常數** | `returnBall()`（game4）、`simulateReturnForPreset()`（return-studio）、`makeReturnVelocity()`、`makeRacketReturnVelocity()`、`solveRacketVelXForTargetLandingX()`、`sampleReturnCorrectionFraction()`、`RETURN_SKILL`、`RETURN_TARGET_X=0` |
| **狀態** | `RETURN_SKILL` 和 `RETURN_TARGET_X` 兩檔案一致。`makeRacketReturnVelocity()` 的整體流程相似但細節不同。 |
| **差異** | ① **分流邏輯**：game4 的 `makeReturnVelocity()` 依 `tech.model` 分流（push/attack 走 `makeRacketReturnVelocity`，loop/direct 走 `makeDirectReturnVelocity`）；return-studio 的 `makeReturnVelocity()` 不分流，全部走 `makeRacketReturnVelocity`。② **力道計算**：game4 用 `computeAdaptivePushMagnitude()`（單一 magnitude）；return-studio 用 `computeAdaptivePushLift()` + `computeAdaptivePushDrive()`（拆分）。③ **拍面角度**：game4 用 `computeAdaptivePushTiltX(incomingVel)`（回歸）和 `computeAdaptivePushTiltY(topspin)`（動態）；return-studio 用 `computeAdaptivePushTiltX()`（固定 0）和 `computeAdaptivePushTiltY()`（固定 0.8）。④ **接觸模型**：game4 呼叫 6 參數 `bounceOffPlane`；return-studio 呼叫 `applyPushContact`（push 走 substepped，其他走 7 參數 bounceOffPlane）。⑤ **瞄準求解**：game4 的 `solveRacketVelXForTargetLandingX()` 是 9 參數，用拋物線快速估計；return-studio 是 11 參數（多了 blend 和 tech），push 技術用完整模擬落點（粗掃 -8~+8 步進 0.1 + 二分逼近），非 push 用拋物線估計。⑥ **DISABLE_AIM_CORRECTION**：return-studio 有此研究用開關，game4 無。⑦ **swingDirection 動態修改**：return-studio 在 `makeRacketReturnVelocity` 中會 `tech.swingDirection = baseTechVel` 動態修改 tech 物件，game4 不會。 |
| **風險** | **極高**。回擊邏輯在兩檔案間幾乎每個環節都不同。 |
| **需 Codex 確認** | ① return-studio 的回擊邏輯是否已定案，應寫回 game4？② push 的瞄準求解用完整模擬落點是否比拋物線估計更準確？是否應寫回 game4？③ `tech.swingDirection = baseTechVel` 動態修改 tech 物件是否會有副作用？ |

---

### 2.9 常數是否一致

| 常數 | game4.html | return-studio.html | physics-studio.html | calibration | tools/ |
|---|---|---|---|---|---|
| `BALL_MASS` | 0.0027 | 0.0027 | 0.0027 | 0.0027 (M) | 0.0027 (M) |
| `BALL_RADIUS` | 0.02 | 0.02 | 0.02 | 0.02 (R) | 0.02 (R) |
| `BALL_INERTIA_ALPHA` | 2/3 | 2/3 | 2/3 | 2/3 (ALPHA) | 2/3 (ALPHA) |
| `EPSILON_VERTICAL` | 0.876 | 0.876 | 0.876 | 0.876 (EPSILON) | 0.876 (EPSILON) |
| `EPSILON_OBLIQUE` | 0.57 | 0.57 | 0.57 | 0.57 | 0.57 |
| `EPSILON_MIN` | 0.45 | 0.45 | 0.45 | 可調（預設 0.45） | 0.45 |
| `CONTACT_FRICTION_MU` | 0.13 | 0.13 | 0.13 | 可調（預設 0.13） | 0.13（測試用 0.25） |
| `PADDLE_FRICTION` | 0.4 | 0.4 | 無 | 無 | 無 |
| `PADDLE_RESTITUTION_LOW` | 0.9 | 0.9 | 無 | 無 | 無 |
| `PADDLE_RESTITUTION_HIGH` | 0.75 | 0.75 | 無 | 無 | 無 |
| `PADDLE_SPEED_LOW` | 2.0 | 2.0 | 無 | 無 | 無 |
| `PADDLE_SPEED_HIGH` | 12.0 | 12.0 | 無 | 無 | 無 |
| `PADDLE_RESTITUTION` | -0.9（loop 用） | 無 | 無 | 無 | 無 |
| `PADDLE_BLEND` | 無 | 0.65 | 無 | 無 | 無 |
| `PADDLE_SPRING_K` | 無 | `BALL_MASS*(π/0.005)²` | 無 | 無 | 無 |
| `PADDLE_DAMPING_RATIO` | 無 | 0.0421（未使用） | 無 | 無 | 無 |
| `BLADE_NODE_MASS` | 無 | `BALL_MASS*0.15` | 無 | 無 | 無 |
| `BLADE_SPRING_K` | 無 | `BLADE_NODE_MASS*(π/0.0008)²` | 無 | 無 | 無 |
| `BLADE_DAMPING_RATIO` | 無 | 0.03 | 無 | 無 | 無 |
| `TANGENT_KP` | 無 | 1.0 | 無 | 無 | 無 |
| `PUSH_WRIST_BRAKE_RATE` | 無 | 0 | 無 | 無 | 無 |
| `SIM_TIME_DILATION` | 無 | `√(9.8/4.2)` ≈1.528 | 無 | 無 | 無 |
| `gravity`（預設） | -4.2 | -4.2 | -4.2 | -4.2 (GRAVITY) | -4.2 |
| `RETURN_TARGET_X` | 0 | 0 | 無 | 無 | 無 |
| `DT` | 1/120 | 1/120 | 1/120 | 1/120 | 無 |
| `MAX_STEPS` | 520 | 520 | 520 | 500 | 無 |

| 項目 | 內容 |
|---|---|
| **狀態** | 桌面常數全部一致。球拍常數中，`PADDLE_FRICTION`、`PADDLE_RESTITUTION_LOW/HIGH`、`PADDLE_SPEED_LOW/HIGH` 一致。其餘球拍相關常數僅存在於 return-studio。 |
| **差異** | ① `PADDLE_RESTITUTION=-0.9` 僅在 game4（loop 舊模型用）。② `PADDLE_BLEND` 僅在 return-studio（0.65）。③ 所有 substepped 相關常數僅在 return-studio。④ `SIM_TIME_DILATION` 僅在 return-studio。⑤ `tools/physics-v2-contact-mechanics.js` 的單元測試用 `MU_TEST=0.25`，與正式部署的 0.13 不同（測試用值）。 |
| **風險** | 中。桌面常數無風險。球拍常數的差異反映兩檔案處於不同開發階段。 |
| **需 Codex 確認** | ① `gravity=-4.2` 是否為正式設計值？（文件標記「不確定」）② `PADDLE_BLEND=0.65` 與文件摘要記載的「預設 0」不一致，哪個是當前定案？ |

---

### 2.10 UI / 工具頁專用功能與正式遊戲功能的差異

| 功能 | game4.html | return-studio.html | physics-studio.html | physics-v2-calibration.html |
|---|---|---|---|---|
| 正式遊戲流程（發球→選擇→回擊→判定） | ✅ | ❌ | ❌ | ❌ |
| 多發球 preset 選擇 | ✅ | ✅（讀同一份 JSON） | ✅（讀同一份 JSON） | ❌ |
| 回擊技術選擇（push/attack/loop） | ✅（含 loop） | ✅（無 loop） | ❌ | ❌ |
| 回擊技術等級（初階/中階/熟練） | ✅ | ✅（變數存在，UI 無選擇器） | ❌ | ❌ |
| 範圍解模式（RANGE_SOLUTION_MODE） | ✅ | ✅ | ❌ | ❌ |
| 自動最佳時機回擊（AUTO_BEST_TIMING） | ✅ | ❌ | ❌ | ❌ |
| 連續對打展示模式 | ❌ | ✅（最多 60 拍） | ❌ | ❌ |
| 球例校正資料庫（review queue） | ❌ | ✅（localStorage + 匯出） | ❌ | ❌ |
| 停用側向自動瞄準修正（DISABLE_AIM_CORRECTION） | ❌ | ✅ | ❌ | ❌ |
| 揮拍方向箭頭拖曳設定 | ❌ | ✅（3D ArrowHelper） | ❌ | ❌ |
| 發球 preset 編輯器 | ❌ | ❌ | ✅（localStorage + 匯出） | ❌ |
| 發球起點/落點拖曳 | ❌ | ❌ | ✅（3D 拖曳） | ❌ |
| 散布測試（scatter） | ❌ | ❌ | ✅（12 條隨機抖動軌跡） | ❌ |
| 旋轉單位切換（rps / rad/s） | ❌ | ❌ | ✅ | ❌ |
| μ / EPSILON_MIN 可調 slider | ❌ | ❌ | ❌ | ✅ |
| 桌面接觸力學視覺校準 | ❌ | ❌ | ❌ | ✅（不轉 vs 下旋弧線比較） |
| File System Access API（存到本機 pending 檔案） | ❌ | ✅（pending-return-technique-changes.json） | ✅（pending-serve-changes.json） | ❌ |
| 拋球動畫（TOSS_CONFIG） | ✅ | ❌ | ❌ | ❌ |
| 攝影機跟隨 | ✅ | ❌（固定視角） | ❌（固定視角） | ❌（2D Canvas） |

| 項目 | 內容 |
|---|---|
| **狀態** | game4 是正式遊戲頁面，含完整遊戲流程、攝影機跟隨、拋球動畫。return-studio 是回擊研究工具頁，含連續對打、球例校正、揮拍方向拖曳等功能。physics-studio 是發球 preset 編輯器。calibration 是桌面力學校準工具。 |
| **差異** | ① return-studio 的 `DISABLE_AIM_CORRECTION` 是研究用開關，正式遊戲無此功能。② return-studio 的連續對打使用鏡射座標系技巧（`mirrorVec` / `mirrorSpin`），game4 無此功能。③ return-studio 的 `RETURN_SKILL_LEVEL` 變數存在但 UI 無選擇器（game4 有）。④ physics-studio 的 `solveSecondBounceVelocity()` 和 `classifyServeLength()` 是工具頁專用，game4 無。⑤ calibration 的 `EPSILON_MIN` 和 `μ` 是可調 slider，不影響正式遊戲。 |
| **風險** | 低。工具頁功能不會影響正式遊戲，但需確保工具頁的物理引擎跟 game4 同步。 |
| **需 Codex 確認** | ① return-studio 的 `RETURN_SKILL_LEVEL` 變數存在但 UI 無選擇器，是否應加回？② physics-studio 的 `simulateWithBaseVelocity()` 是否確實跟 game4 的 `simulatePath()` 逐字一致？ |

---

## 3. 不可直接下結論的事項

以下事項涉及物理判斷或需要人類決策，本文件不做最終判斷：

1. **return-studio 的 substepped 模型是否比 game4 的瞬時碰撞模型更正確**：substepped 引入了彈簧-阻尼動態、切向黏性阻尼、兩級串聯等機制，但是否更符合真實物理需要高階模型審查。

2. **`PADDLE_BLEND=0.65` 是否為合理的最終值**：文件摘要明確標記「不可視為最終物理解」，且文件記載的「預設 0」與程式碼的 0.65 不一致。

3. **lift+drive 拆分（K=0）是否比 game4 的單一 magnitude 負回饋（K=0.3）更正確**：return-studio 目前 K=0 等於固定值，是否為暫定或已定案需要確認。

4. **固定 `tiltY=0.8` 是否比 game4 的動態 `tiltY=0.4~0.55` 更正確**：兩者基於不同的物理假設（固定拍面 vs 依旋轉調整），需要人類確認。

5. **`tiltX=0`（return-studio）是否比 `tiltX` 回歸公式（game4）更正確**：文件摘要記載 tiltX 回歸公式「被 blend Y-Z only 機制取代」，但 blend 機制尚未寫回 game4。

6. **loop 技術移除是暫時的還是永久的**：return-studio 已移除 loop，game4 仍保留舊模型。文件記載「使用者決定之後會重新設計」。

7. **`gravity=-4.2` 是否為正式設計值**：文件標記「不確定」。所有檔案均使用此值，但是否為刻意設計或歷史遺留需要確認。

8. **`PADDLE_DAMPING_RATIO=0.0421` 未被使用是否為 bug 或刻意保留**：程式碼註解說「保留參數位置但不使用」，但呼叫端仍傳入此值。

9. **`TANGENT_KP=1.0` 的因次與校準狀態**：註解說明這是「套進我們自己單位系統後需要重新校準的工程估計值」。

10. **`BLADE_NODE_MASS`、`BLADE_SPRING_K`、`BLADE_DAMPING_RATIO` 的精確性**：註解標記為「工程估計，之後應該重新校準」。

11. **game4 與 return-studio 的攻球是否在 blend=0 時完全逐位相同**：理論上應相同，但未執行驗證。

12. **文件摘要與程式碼的多處不一致**：文件說「PADDLE_BLEND 已實作（兩個檔案）」但 game4 無此常數；文件說「預設 0」但 return-studio 為 0.65。文件可能反映較早版本狀態。

13. **Codex 平行分支的 `dwell_grip` 接觸模型與 `contactOffset` 偏移**：文件記載 Codex 在另一個本機路徑工作，未在本輪輸入資料中，無法確認同步狀態。

14. **`PUSH_LIFT_K=0` 和 `PUSH_DRIVE_K=0` 是否為最終值**：目前等於固定值，是否計畫重新校準為非零值需要確認。