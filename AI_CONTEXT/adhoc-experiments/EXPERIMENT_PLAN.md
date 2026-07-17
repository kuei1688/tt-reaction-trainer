# 切球物理曲線實驗計畫書

> 建立日期：2026-07-14
> 目的：用傳統科學方法（單變數掃描 → 畫曲線 → 找可行區間 → 逼近法收斂）取得桌球切球所需的全部物理參數。
> 前置條件：尺度一致性 bug 已修復（game4.html + return-studio.html，2026-07-14）。
> 執行方式：可在獨立對話視窗中由 AI subagent 並行執行，計算在 Node.js 本地完成，不耗用大量 token。

---

## 背景：為什麼需要這份計畫

### 已修復的 bug

模擬使用縮放重力 gravity = -4.2 m/s²（真實為 -9.8），速度因此只有真實的 65.5%。`SIM_TIME_DILATION = √(9.8/4.2) = 1.528` 用於補償。

**修復前**：桌面接觸（`bounceWithSpinPhysical`）用模擬尺度速度 + 真實尺度旋轉，兩者不一致。球拍接觸（`bounceOffPlaneSubstepped`）有做 D 轉換但旋轉被過度放大。結果：下旋保留率被高估 18%，不轉球上旋製造量被低估 53%。

**修復後**：三個函式（`simulatePath`、`simulateServe`、`serveBounceScore`）在 game4.html 和 return-studio.html 中都已修正。桌面接觸現在在真實尺度運算，跟球拍接觸一致。

**語義變更**：`simulatePath` 輸出的 `spins` 陣列現在是模擬尺度。顯示真實 rad/s 值需乘以 D = 1.528。所有新工具應在輸出時自動轉換。

### 設計原則（摘自 push_solver_design_principles.md）

1. 只做正向模擬（給輸入算結果），不做反推求解（給結果找輸入）
2. 單變數掃描 → 曲線 → 可行區間，不挑單一最優點
3. 區間中點 = 部署值，區間半寬 = 容差
4. 繞開 `solveRacketVelXForTargetLandingX`（已知有靜默 fallback bug）
5. 任何測試必須用貼近真實量級的揮拍速度，不能設成零

---

## 參數清單

### 控制變數（實驗的自變數）

| 參數 | 代碼 | 預設值 | 範圍 |
|---|---|---|---|
| 拍面後仰角度 | `PUSH_TILT_Y` | 1.0 | 0.3 ~ 2.0 |
| 拍面側傾角度 | `tiltX` | 0 | -0.5 ~ +0.5 |
| 揮拍上提力 | `lift` | 0.22 | 0 ~ 1.5 |
| 揮拍前推力 | `drive` | 0.56 | 0.1 ~ 1.3 |
| 揮拍側移力 | `planeVel.x` | 0 | -3 ~ +3 |
| 來球速度量級 | `hitVel` scale | 1.0 | 0.5 ~ 2.0 |
| 來球旋轉 | `hitSpin` | 因 preset 而異 | -250 ~ +250 rad/s |

### 量測變數（實驗的應變數）

| 量測點 | 量什麼 | 代碼中的對應 |
|---|---|---|
| 接觸瞬間 | regime (rolling/sliding)、dwellMs、normalImpulse、slip | `bounceOffPlaneSubstepped` 回傳值 |
| 出球 | 旋轉、速度、過網高度、是否過網、落點 | `outTopspin`/`outSpeed`/`netClearance`/`clearsNet`/`landing` |
| 對方桌面彈跳後 | 旋轉、速度、regime、epsilon | `simulatePath` 的 `spins`/`velocities` + `bounceWithSpinPhysical` |
| 對手接球時 | 旋轉、速度 | `findPushHitIndex` 位置的 `spins`/`velocities` |

**重要**：所有旋轉值在輸出時乘以 D=1.528 轉為真實 rad/s。

### 環境常數

| 常數 | 值 | 狀態 |
|---|---|---|
| 桌面摩擦 μ | 0.13 | 合理（文獻 0.1~0.2） |
| 垂直反彈係數 ε | 0.876 | 正確（ITTF 標準） |
| 斜向反彈係數 | 0.57 | 合理 |
| 最低反彈係數 | 0.45 | 保守下限 |
| 拍面摩擦 | 0.4 | 工程估計，待校準 |
| 拍面反彈係數 | 0.9→0.75 | 工程估計，待校準 |
| PADDLE_BLEND | 0.605 | 已校準（2026-07-14，安全交集 [0.55, 0.66]）|
| TANGENT_KP | 1.0 | 待校準 |
| PADDLE_SPRING_K | M·(π/0.005)² | 待校準 |
| SIM_TIME_DILATION | 1.5275 | √(9.8/4.2) |

### 代表球

| preset ID | 特徵 | 用途 |
|---|---|---|
| `backspin_long_backhand` | 重下旋+側旋+22.6°入射 | 主代表球（已有多條曲線） |
| `no_spin_long_forehand` | 幾乎無旋轉，彈跳後帶上旋 | 基準線對照 |
| `backspin_long_forehand` | 近乎直線+真正下旋 | 乾淨下旋對照（候選，未做） |
| `sidebackspin_long_forehand_2` | 近乎直線+重側旋 | 側旋效應隔離（候選，未做） |
| `sidebackspin_short_forehand` | 短球+大角度+最重側旋 | 側旋弱項（候選，未做） |
| `backspin_short_forehand` | 短球+乾淨下旋 | 長短球差異（候選，未做） |

---

## 實驗群組

### 群組 0：修復驗證（已完成）

確認尺度修復後所有 preset 正常。結果：16/16 preset 正常產生發球，軌跡不變，旋轉保留率從 75% 降到 61%（更接近真實）。

---

### 群組 1：桌面彈跳旋轉轉換曲線（回答 Q4）

目的：完整量化「球碰桌面一次，旋轉變多少」。

#### 實驗 1A：初旋轉 × 衝擊速度 → 彈跳後旋轉

- 掃描變數 1：初旋轉 topspin ∈ [-250, +250] rad/s（真實尺度），20 個點
- 掃描變數 2：衝擊垂直速度 |vy| ∈ [1, 6] m/s（真實尺度），10 個點
- 固定：vz = 3 m/s（真實尺度），sidespin = 0
- 量測：彈跳後 topspin、彈跳後 vz、epsilon、regime、normalImpulse
- 輸出：20×10 二維網格
- 工具：新建 `tools/bounce-spin-decay-sweep.js`，直接呼叫 `bounceWithSpinPhysical`（用真實尺度輸入，不需 D 轉換）
- 預期曲線形狀：
  - 弱下旋區（|topspin| < 50）：旋轉被翻轉成上旋
  - 中下旋區（50~150）：保留部分下旋，顯著衰減
  - 重下旋區（> 150）：保留率較高
  - regime 交界線：rolling/sliding 邊界是一條曲線

#### 實驗 1B：側旋衰減曲線

- 掃描變數 1：初側旋 sidespin ∈ [-200, +200] rad/s，16 個點
- 掃描變數 2：水平速度 vx ∈ [-3, +3] m/s，10 個點
- 固定：vy = -3 m/s, vz = 3 m/s, topspin = 0
- 量測：彈跳後 sidespin、彈跳後 vx、regime
- 輸出：16×10 二維網格
- 工具：同 1A，換掃描維度

#### 實驗 1C：兩次彈跳累積效應（用真實 preset 軌跡）

- 掃描變數：初旋轉 topspin ∈ [-250, 0] rad/s，15 個點（只看下旋）
- 固定：每個 preset 的真實發球軌跡（提供不同的衝擊速度和角度）
- 量測：第一次彈跳後旋轉、第二次彈跳後旋轉、接球時旋轉（全部乘 D 轉真實尺度）
- 輸出：每個 preset 一條曲線
- 工具：新建 `tools/bounce-decay-preset-trace.js`，用 `loadGame4Physics` 載入 `simulateServe` + `findPushHitIndex`
- 直接回答 Q4

---

### 群組 2：球拍接觸出球曲線（回答 Q1, Q2）

目的：量化拍面角度和揮拍力道對出球性質的影響。

#### 實驗 2A：拍面後仰角度 tiltY（擴展已有多條曲線）

- 掃描變數：tiltY ∈ [0.3, 2.0]，16 個點（已做）
- 固定：backspin_long_backhand，部署力道，繞開瞄準求解器
- 新增量測：接觸 regime、dwellMs、normalImpulse、slip
- 新增量測深度：出球後飛行 → 對方桌面彈跳後旋轉（接續 simulatePath）
- 輸出：16 行 × 10+ 欄
- 工具：修改 `tools/push-clean-reference-sweep-noaim.js`，在 `runOnce` 裡加 simulatePath 延伸 + 額外欄位
- 對 `no_spin_long_forehand` 和 `backspin_long_forehand` 各重複一次

#### 實驗 2B：揮拍上提力 lift

- 掃描變數：lift ∈ [0, 1.5]，15 個點
- 固定：tiltY = 部署值, drive = 部署值, backspin_long_backhand
- 量測：出球旋轉/速度/過網高度 + regime/dwellMs + 彈跳後旋轉
- 輸出：15 行曲線
- 工具：同 2A 結構，換掃描變數

#### 實驗 2C：揮拍前推力 drive

- 掃描變數：drive ∈ [0.1, 1.3]，13 個點
- 固定：tiltY = 部署值, lift = 部署值, backspin_long_backhand
- 量測：同 2B
- 輸出：13 行曲線

#### 實驗 2D：lift × drive 二維可行區間

- 掃描變數：lift ∈ [0, 1.5] × drive ∈ [0.1, 1.3] = 15×13 = 195 格
- 固定：tiltY = 部署值, backspin_long_backhand
- 量測：過網高度、落點是否在桌內、出球旋轉方向
- 輸出：195 格，每格標記「可行/不可行」及原因
- 這就是 Q1 的答案——能穩定推回去的力道範圍

#### 實驗 2E：換代表球重複 2D

- 用 `no_spin_long_forehand` 和 `sidebackspin_long_forehand_2` 各跑一次 2D
- 三顆球的可行區間交集 = 不管對方發什麼球都能推回去的安全範圍

---

### 群組 3：彈跳後量測（擴充群組 1 和 2 的測量深度）

目的：把所有曲線從「出球」延伸到「對方桌面彈跳後」和「對手接球時」。

不是獨立實驗，而是對群組 2 每條曲線的擴充。在每個 `applyPushContact` 之後接一段 `simulatePath`：

| 量測點 | 量什麼 | 狀態 |
|---|---|---|
| 出球瞬間 | vel/spin | 已量 |
| 過網瞬間 | netClearance | 已量 |
| 對方桌面彈跳前 | 觸桌前 vel/spin | 新增 |
| 對方桌面彈跳後 | 觸桌後 vel/spin/regime/epsilon | 新增 |
| 對手接球位置 | 接球時 vel/spin | 新增（findPushHitIndex） |

---

### 群組 4：側旋抵銷（回答 Q5）

目的：面對不同側旋，需要多少拍面側傾或側向揮拍來抵銷。

#### 實驗 4A：側旋 × 拍面側傾 tiltX

- 掃描變數 1：來球 sidespin ∈ [-150, +150] rad/s（真實尺度），10 個點
- 掃描變數 2：tiltX ∈ [-0.5, +0.5]，10 個點
- 固定：topspin = -80 rad/s（中等下旋）, tiltY = 1.0, lift/drive = 部署值, 來球速度 = 長球代表值
- 量測：出球 sidespin、出球水平偏移 landing.x、出球 topspin
- 輸出：10×10 = 100 格二維網格
- 工具：新建 `tools/sidespin-tiltx-sweep.js`，需覆寫 tiltX（現有工具都 tiltX=0）
- 經驗法則萃取：找出「出球 sidespin ≈ 0 且 landing.x ≈ 0」的格子，連成 `tiltX = f(sidespin)` 曲線

#### 實驗 4B：側旋 × 側向揮拍 planeVel.x

- 掃描變數 1：來球 sidespin ∈ [-150, +150] rad/s，10 個點
- 掃描變數 2：planeVel.x ∈ [-3, +3] m/s，10 個點
- 固定：同 4A，tiltX = 0
- 量測：同 4A
- 輸出：10×10 = 100 格二維網格
- 工具：新建 `tools/sidespin-planvelx-sweep.js`

#### 實驗 4C：兩種機制混合

- 掃描變數：sidespin ∈ [-150, +150]（5 點）× tiltX ∈ [-0.3, +0.3]（5 點）× planeVel.x ∈ [-2, +2]（5 點）
- 量測：出球 sidespin、landing.x
- 輸出：5×5×5 = 125 格三維網格
- 找出「抵銷成功」的格子，畫可行曲面

---

### 群組 5：下旋穩定連續閉環（回答 Q3）

目的：找出能讓雙方下旋切球穩定循環的操作區間。

#### 實驗 5A：單一代表球閉環

- 掃描變數：(tiltY, lift, drive) 三維網格
  - tiltY ∈ {0.7, 0.85, 1.0, 1.15, 1.3}（5 值）
  - lift ∈ {0.15, 0.22, 0.30, 0.40}（4 值）
  - drive ∈ {0.3, 0.45, 0.56, 0.70}（4 值）
  - 合計 5×4×4 = 80 格
- 固定：初始來球 = backspin_long_backhand 接球狀態
- 模擬流程：你推 → 飛行 → 對方桌面彈跳 → 對手用同樣參數推回 → 飛行 → 你方桌面彈跳 → 你接球時的旋轉/速度
- 繞開 `solveRacketVelXForTargetLandingX`，planeVel = {0, lift, -drive}
- 量測：每拍接球旋轉方向（是否仍為下旋）、速度是否發散/收斂、持續幾拍
- 輸出：80 格，每格標記「穩定循環 / 旋轉翻轉 / 速度發散 / 掛網 / 飛出界」
- 工具：新建 `tools/push-rally-closed-loop-sweep.js`，以 `game4-push-sustainable-rally-validation.js` 為基礎改

#### 實驗 5B：不同代表球閉環

- 用 `no_spin_long_forehand` 和 `sidebackspin_long_forehand_2` 各跑一次 5A
- 穩定區間在不同來球下的移動量

---

### 群組 6：接觸模型參數校準

目的：確認五個未測參數在部署值附近平滑，沒有隱藏 regime 斷裂。

每個實驗：固定 backspin_long_backhand + 部署 tiltY/lift/drive，掃描該參數 ±50%，量出球旋轉/速度/過網高度，用 `sensitivityReport` 檢查跳動。

| 實驗 | 掃描參數 | 範圍 | 格數 |
|---|---|---|---|
| 6A | TANGENT_KP | [0.5, 1.5] | 10 |
| 6B | PADDLE_BLEND | [0.3, 0.95] | 10 |
| 6C | PADDLE_SPRING_K（半週期） | [3ms, 7ms] | 10 |
| 6D | PADDLE_RESTITUTION_LOW | [0.7, 1.0] | 8 |
| 6E | PADDLE_RESTITUTION_HIGH | [0.6, 0.9] | 8 |
| 6F | PADDLE_FRICTION | [0.2, 0.6] | 10 |

工具：新建 `tools/push-contact-param-sweep.js`，泛型化的單參數掃描器，可重複使用。

---

## 總覽

| 群組 | 實驗數 | 總格數 | 回答的問題 | 新工具 | 依賴 |
|---|---|---|---|---|---|
| 0 | 1 | 16 preset | 尺度修復驗證 | 無 | 無（已完成） |
| 1 | 3 | 515 | Q4 彈跳衰減 | 2 個 | 群組 0 |
| 2 | 5 | 434 | Q1, Q2 拍面和力道 | 1 個（擴展現有） | 群組 0 |
| 3 | 擴充 | 附加在 1, 2 上 | Q3, Q4 測量深度 | 無（修改現有） | 群組 0 |
| 4 | 3 | 325 | Q5 側旋抵銷 | 2 個 | 群組 0 |
| 5 | 2 | 160 | Q3 穩定連續 | 1 個 | 群組 1, 2, 3 |
| 6 | 6 | 66 | 基礎可靠性 | 1 個 | 群組 0 |
| **合計** | **20** | **約 1500 格** | | **6 個新工具** | |

## 執行順序

1. **群組 0**（已完成）→ 尺度修復驗證
2. **群組 1**（桌面彈跳曲線）→ 基礎數據，所有下游引用
3. **群組 6**（接觸參數校準）→ 確認球拍接觸模型平滑
4. **群組 2 + 3**（球拍接觸曲線 + 彈跳後量測）→ 完整鏈路
5. **群組 4**（側旋抵銷）→ 可與第 4 步並行
6. **群組 5**（閉環穩定測試）→ 最複雜，需前面數據

## 並行策略

以下群組互不依賴，可由多個 subagent 同時執行：
- 群組 1（彈跳衰減）+ 群組 4（側旋）+ 群組 6（參數校準）→ 三路並行
- 群組 2（球拍接觸）等群組 1 完成後啟動
- 群組 5（閉環）等群組 2 完成後啟動

## Subagent 執行方式

每個 subagent 的工作流程固定：
1. 讀現有工具結構（`push-clean-reference-sweep-noaim.js`）
2. 改掃描變數和量測點
3. 用 `node` 跑腳本
4. 做平滑度檢查（`sensitivityReport`）
5. 把結果寫進 `AI_CONTEXT/` 的新條目
6. 所有旋轉值乘以 D=1.528 轉真實尺度再輸出

每個實驗約耗 4500 token（寫腳本 2000 + 跑+讀 1000 + 寫結果 1500）。
20 個實驗合計約 90,000 token，計算在 Node.js 本地完成。

## 輸出格式

每個實驗完成後在 `AI_CONTEXT/push_clean_reference_library.md` 新增一條目，包含：
- 接觸模型版本
- 固定變數（含揮拍速度量級及依據）
- 掃描變數（單一變數，範圍）
- 結果曲線/表格（不是單一數字）
- 平滑度檢查（有沒有劇烈跳動）
- 這個案例告訴我們什麼（給後續校準的具體指引）

## 已知剩餘問題

1. `physics-studio.html`（line 990）有同樣的 `bounceWithSpinPhysical` 尺度問題，但無 `SIM_TIME_DILATION` 定義，是純研究工具，優先級低
2. `solveRacketVelXForTargetLandingX` 的靜默 fallback bug 仍未修復，所有實驗必須繼續繞開它
3. `solveServeBounceVelocity` 的 fallback 不受驗證約束（見 `push_solver_design_principles.md`），批次跑 preset 時需留意
4. 修復後 `spins` 陣列是模擬尺度，所有工具需乘以 D=1.528 顯示真實值