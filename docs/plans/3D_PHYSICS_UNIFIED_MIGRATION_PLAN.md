# 3D 統一旋轉物理模型遷移計畫

> 建立日期：2026-07-16  
> 狀態：Phase 0 baseline、Phase 1／2／3 第一輪正式整合已完成；接觸 compliance、校準、preset re-solve 與頁面視覺同步仍待執行  
> 用途：供另開對話執行完整的 3D 旋轉物理模型重整、遷移與校準。  
> 本文件是執行計畫，不代表目前模型已達到物理真值。

> 2026-07-16 交接：`AI_CONTEXT/3d_unified_physics_2026-07-16/` 已保存 immutable baseline 與隔離 Phase 1／2 prototype evidence。這些輸出只證明工程缺口與下一個實驗邊界，不能寫成正式 migration 已完成。

## 0. 執行摘要

本計畫的最高優先目標是：

> 建立一個以單一 world-space 角速度向量 `omega` 為核心，讓飛行、桌面反彈與球拍接觸使用一致物理語意的 3D 物理模型。

側旋、上旋、下旋與 corkscrew 不是不同的物理力。它們只是同一個角速度向量在不同座標軸或不同相對方向上的分量。正式物理核心不應為側旋建立一套獨立的 x-kick 物理；應由同一個 `omega` 向量與接觸幾何自然產生不同效果。

本計畫不以「讓 47 顆發球通過 legal gate」或「讓 Game 5 成功率提高」作為物理正確性的替代品。參數校準必須建立在獨立的真實量測資料、明確的 calibration/holdout 分割與可追溯的不確定性上。

## 1. 目前狀態與問題判斷

### 1.1 已有基礎

- `shared-physics-core.js` 已有 canonical `spin3d`、`omega × velocity` Magnus prototype。
- 47 顆 approved serve 已有 `variation.spin3d`、`sideName`、`curveDirection`。
- Game 4、Game 5、Return Studio、Physics Studio 已部分接上 3D spin data flow。
- 3D sign contract、47 顆 legal-serve gate、部分 bounce transfer 測試已存在。
- Game 5 已有旋轉視覺提示，可作產品可讀性與 debug 輸出。

### 1.2 必須先承認的缺口

目前不是完整 3D 物理，原因包括：

1. `variation.spin.sidespin` 仍是 legacy x-kick compatibility proxy。
2. `bounceWithSpinPhysical3D()` 仍把 `omega.x / omega.z` 轉回 legacy 桌面反彈公式，`omega.y` 主要只是被保留。
3. 桌面反彈與球拍接觸尚未完全由同一個一般化接觸 solver 驅動。
4. `axialSpin` 仍以獨立 scalar 保存，並在每次 force/contact evaluation 時依當前 velocity 重新 resolve；這不是嚴格的剛體角速度狀態。
5. 頁面使用 `gravity=-4.2` 與 `SIM_TIME_DILATION`，速度、旋轉與接觸尺度在多個頁面分散轉換。
6. `blend`、fallback solver、固定 preset geometry 仍混有工程補丁，尚未與物理模型清楚分層。
7. 現有 47 顆 preset 是 solver 產生的候選，不是由影片量測反推的真實 ground truth。
8. 現有影片多數只有分類與觸球時間，沒有足夠的世界座標球軌跡與直接旋轉量測。

### 1.3 目前計畫需要調整的地方

現有側旋校準計畫直接掃 `MAGNUS_COEFFICIENT`、`SIDESPIN_COMPENSATION_C` 與回擊成功率，但接觸核心仍是 hybrid model。這樣會把：

- legacy x-kick 誤差
- 桌面接觸誤差
- 球拍接觸誤差
- solver fallback 誤差
- 真正的 Magnus 效果

混在同一個參數裡。新的執行順序必須先統一物理狀態與接觸模型，再做參數校準。

## 2. 目標物理架構

### 2.1 Canonical physical state

正式模擬中的球只保留一個旋轉狀態：

```js
state = {
  position: {x, y, z},
  velocity: {x, y, z},
  omega: {x, y, z},       // world-space rad/s
  mass,
  inertia
}
```

`topspin`、`backspin`、`sidespin`、`corkscrew`、`left/right` 是輸入描述、資料標籤、UI 語意或校準分組，不是核心中的不同物理引擎。

### 2.2 SpinIntent 與 PhysicalSpin 分離

允許產生器使用方便的人類語意描述，例如：

```js
spinIntent = {
  verticalSpin: -125.66,
  sideName: "left",
  axialSpinRelativeToVelocity: 0
}
```

但在進入 forward simulation 前，必須一次轉換成：

```js
physicalSpin = {
  schema: 2,
  omega: {x, y, z}
}
```

正式模擬過程中不應再把 `axialSpin` 當成第四個軸或每次接觸時重新附加。若保留 `axialSpin` 欄位，只能作輸入記錄或轉換前的 authoring metadata。

### 2.3 統一空中飛行

空中加速度應是：

```text
a = gravity + aerodynamic drag + Magnus(omega, velocity)
```

第一階段可使用：

```text
aMagnus = C * (omega × velocity)
```

但正式校準應保留速度與 spin ratio 對 Magnus lift 的依賴，不預設一個常數在所有速度與旋轉強度都成立。

同時需要明確決定：

- 是否加入平移空氣阻力。
- 是否加入旋轉阻力與 spin decay。
- 空氣力使用 real-scale 還是 page simulation scale。
- 是否將所有物理計算統一到 real scale，再由動畫層控制播放速度。

推薦：核心統一使用 real scale，頁面只用 `timeScale` 改變播放速度，不再讓頁面自己以 `SIM_TIME_DILATION` 轉換物理量。

### 2.4 統一桌面與球拍接觸

接觸點速度使用同一公式：

```text
contactVelocity = ballVelocity + omega × contactOffset - surfaceVelocity
```

接觸 solver 的共同流程：

1. 取得接觸面法向 `n`、接觸面速度與球心到接觸點的 `r`。
2. 計算接觸點相對速度。
3. 分解法向速度與切向速度。
4. 以 restitution / compliance / finite mass 計算法向 impulse。
5. 以完整切向摩擦向量與 Coulomb friction cone 計算切向 impulse。
6. 同步更新線速度與角速度：

```text
v' = v + J / m
omega' = omega + I^-1 * (r × J)
```

桌面與球拍只透過參數區分：

- 桌面：固定面、固定法向、低 compliance。
- 球拍：可移動面、任意法向、拍面速度、膠皮／海綿 compliance、可能的有限質量。

`blend` 不應成為最終物理答案。它可以保留作過渡基準，但最後應由接觸幾何、拍面速度、compliance 與有限質量自然產生回彈方向。

## 3. 分階段執行計畫

### Phase 0：建立不可變 baseline

目標：保存目前系統，避免新舊結果混淆。

工作：

- 記錄 commit、dirty worktree、所有 source hash。
- 保存現有 47 顆 legacy/3D trajectory、bounce、return、rally 輸出。
- 保存目前 `MAGNUS_COEFFICIENT`、`SIM_TIME_DILATION`、`PADDLE_BLEND`、摩擦與 restitution。
- 建立 `schema:2` 計畫，不覆寫舊 JSON。

完成條件：任何新結果都能與目前 legacy baseline 做逐欄位比較。

### Phase 1：建立 canonical spin 與 real-scale kernel

目標：核心只接受完整 world-space `omega`。

工作：

- 新增 schema v2 spin state。
- 將 legacy `variation.spin` 僅放在邊界 adapter。
- 將 `axialSpin` 在輸入階段轉成 `omega`。
- 統一 real-scale 的位置、速度、角速度、重力與時間步長。
- 將頁面內的 duplicated spin conversion 集中到 shared core。

驗證：

- legacy adapter 在指定基準案例上數值等價。
- schema v2 不再讀取 legacy sign 來判斷 left/right。
- `omega` 在任何步驟都 finite。

### Phase 2：建立通用 3D 接觸 solver

目標：桌面與球拍共用接觸數學。

工作：

- 實作一般平面接觸 solver。
- 支援任意法向與平面速度。
- 支援完整 2D 切向摩擦。
- 同時更新 `v` 與 `omega`。
- 分離瞬時 impulse 模式與 substepped compliance 模式，但兩者共用接觸狀態與摩擦定義。

驗證：

- 坐標旋轉前後結果等價。
- 純 `omega.x`、`omega.y`、`omega.z` 與混合旋轉均有限。
- 摩擦不能產生額外機械能。
- 接觸點無滑動時符合 rolling 條件。
- 接觸面法向改變時，結果只依幾何改變，不依賴硬編碼 x/z 特例。

### Phase 3：遷移桌面反彈

目標：移除 `bounceWithSpinPhysical3D()` 對 legacy x-kick 的依賴。

工作：

- 桌面使用通用 contact solver，法向固定為 `+Y`。
- 讓 `omega.x/y/z` 直接參與接觸點速度。
- 明確確認純繞桌面法向的旋轉是否不造成桌面切向 slip。
- 讓反彈後完整 `omega` 繼續進入下一段 Magnus 飛行。
- 重新定義 spin-dependent restitution 是否只看接觸點切向速度，而不是 legacy spin magnitude。

驗證：

- 純下旋、純側旋、混合旋轉的 bounce transfer。
- 反彈前後角速度方向與保留率。
- 舊 2D 基準案例的 compatibility report。
- 能量耗散範圍合理，不能因旋轉產生非物理加速。

### Phase 4：重新建立飛行模型

目標：在接觸模型穩定後，才校準 Magnus 與 spin decay。

工作：

- 分離 gravity、drag、Magnus、spin decay。
- 先用 synthetic test 驗證方向與鏡像。
- 再用具世界座標的實測球軌跡校準。
- 將 `MAGNUS_COEFFICIENT` 改稱為明確的 model parameter，而不是 magic constant。

驗證：

- `omega.y` 正負造成對稱的左右曲線。
- `omega.x` 的垂直 Magnus 方向符合右手座標。
- 無旋案例不受 Magnus coefficient 影響。
- 係數變化是平滑的，不出現突然跳躍或 bullet trajectory。
- calibration 與 holdout 的軌跡殘差都在量測不確定性內。

### Phase 5：遷移球拍接觸

目標：讓 push、attack、loop 使用同一接觸物理基礎。

工作：

- 球拍接觸使用接觸點速度與完整 omega。
- 明確加入拍面平移速度，必要時加入拍面角速度。
- 以 finite mass / compliance / dwell time 取代任意 `blend`。
- push 與 attack 可以使用不同輸入策略與拍面參數，但不能使用不同的旋轉物理定律。
- fallback solver 不得靜默改變物理結果，必須記錄 `fallbackUsed`。

驗證：

- 同一 incoming state 在不同拍面法向下的結果連續。
- `omega.x/y/z` 對接觸後出球的影響可由接觸幾何解釋。
- correct / none / wrong 只作產品行為評估，不作核心物理真值證明。

### Phase 6：用新 forward model 重新解發球

目標：讓 preset 是新物理模型的輸出，而不是舊幾何模板的延續。

工作：

- 用新 forward model 解初始速度與 omega。
- 每顆 preset 記錄 solver residual、目標落點誤差、過網裕度與 fallback。
- 保留 `sideName` / `curveDirection` 作資料語意，不由數值 sign 反推。
- 將 legal gate、target precision、physical residual 分成三種報告。

驗證：

- 47 顆 legal gate。
- 47 顆 target precision 分布。
- left/right、長短球、正反手位置沒有系統性 bias。
- solver 失敗不得只靠改 tolerance 或偷偷鏡像路徑解決。

### Phase 7：建立實測校準資料

目標：讓模型參數與真實球路建立可追溯關係。

現有影片可作語意與部分軌跡資料，但若要校準真正 `omega` 與 Magnus，需補充：

- 相機內外參與桌面世界座標標定。
- 每幀球心位置與量測誤差。
- 觸球前後速度。
- 第一跳、第二跳位置。
- 高速或多視角資料。
- 標記球面、可辨識旋轉的 spin proxy，或其他旋轉量測方式。
- 桌面、球拍、膠皮的接觸條件。

資料分組至少涵蓋：

- 純側旋、純上／下旋、混合旋轉。
- 不同旋轉量。
- 不同球速與入射角。
- 長球、短球與不同落點。
- 桌面反彈與球拍接觸。

### Phase 8：同步頁面與視覺

目標：所有產品頁只消費統一物理核心的輸出。

工作：

- `game4.html`、`game5.html`、`return-studio.html`、`physics-studio.html` 移除重複物理實作。
- `serve-generator.html` 使用共享 forward/inverse solver。
- 旋轉 HUD 的總旋轉量使用 resolved world-space `omega` 的 norm。
- UI 標籤可以顯示 sideName，但 debug 模式要同時顯示實際 omega。
- 影片與物理球交接維持 Direction C 的視覺邊界，不把視覺動畫當成物理量測。

## 4. 驗證 Gate

### Gate A：表示與座標

- schema v2 唯一物理狀態是 world-space `omega`。
- legacy sign 不再決定資料名稱。
- axial input 不被當作第四軸。
- 單位與尺度一致。

### Gate B：數學

- cross product 方向、左右鏡像、純軸案例正確。
- rotation/frame transformation invariant。
- 所有輸出 finite。

### Gate C：接觸

- 桌面、球拍使用同一 contact kernel。
- 接觸點速度與角動量更新可追溯。
- 摩擦不產生非物理能量。
- 混合旋轉不依賴 x/z 特例。

### Gate D：飛行

- Magnus、drag、spin decay 可分離測量。
- calibration/holdout 殘差在預先設定的誤差內。
- 沒有系統性 left/right、速度或落點偏差。

### Gate E：solver / preset

- legal gate 與 target precision 分開通過。
- fallback 使用率明確記錄。
- 47 顆 preset 由新 forward model 可重現。

### Gate F：產品同步

- 所有頁面使用同一 shared core。
- Game 5 的方向輸入只改變玩家輸入，不偷偷修改物理 sign。
- 視覺 HUD 與 resolved omega 一致。
- 手機與桌面視覺檢查通過。

## 5. 物理真值的判定標準

只有以下條件同時成立，才可以把結論升級為「在明確適用範圍內有實測支持的物理模型」：

1. 參數由真實量測資料 fitting，而不是由 solver 自己產生。
2. 有獨立 holdout data。
3. 預測誤差小於量測不確定性加上事先定義的容忍度。
4. 沒有 left/right、速度、旋轉強度、長短球等系統性偏差。
5. 飛行、桌面反彈、球拍接觸都通過各自的驗證。
6. 結果可由固定版本、固定輸入與固定 seed 重現。
7. 產品成功率、legal gate、視覺效果只作產品證據，不代替實測物理證據。

## 6. 停止條件

遇到以下任一情況，停止調參，先修模型或資料：

- 必須用 legacy sign 鏡像才能通過左右測試。
- `omega` 只在某一頁或某一 solver 中保留。
- `axialSpin` 因 velocity 改變而被重新注入，卻沒有明確剛體語意。
- 桌面與球拍使用不同接觸物理，卻直接共用同一校準係數。
- 只能改 tolerance、刪案例、改 target 或使用 fallback 才能通過。
- legal gate 通過但 target residual 出現系統性偏差。
- 沒有旋轉量測資料卻宣稱 `omega.y` 或 Magnus coefficient 是真值。
- 物理結果需要由 UI 視覺提示「修正」或隱藏不一致。

## 7. 預期交付物

每個 phase 至少留下：

```text
AI_CONTEXT/3d_unified_physics_YYYY-MM-DD/
  manifest.json
  baseline_config.json
  source_hashes.json
  raw_experiments.json
  metrics.csv
  summary.md
  failure-classification.md
  decision.md
```

核心程式預期集中於：

```text
shared-physics-core.js
tools/physics-3d-spin.test.js
tools/physics-contact-3d.test.js
tools/physics-flight-3d.test.js
tools/physics-3d-cross-page-e2e.test.js
tools/physics-calibration-validator.js
prototypes/3d-unified-physics/
```

正式頁面最後才同步：

```text
game4.html
game5.html
return-studio.html
physics-studio.html
serve-generator.html
physics-presets.json
videos.json
```

## 8. 下一個對話的啟動指令

可直接把以下內容貼到新對話：

```text
請依照 docs/3D_PHYSICS_UNIFIED_MIGRATION_PLAN.md 執行 3D 統一旋轉物理模型遷移。

最高優先目標是物理模型正確性，不是先提高 Game 5 成功率或 legal gate。

請先完成 Phase 0 與現況盤點，不要直接調 MAGNUS_COEFFICIENT 或 SIDESPIN_COMPENSATION_C。
第一個實作目標是建立 schema v2 的 world-space omega 與通用 3D contact solver，並把桌面與球拍接觸統一到同一套接觸點速度／摩擦 impulse 數學。

請特別檢查：
1. axialSpin 是否應在輸入階段轉成 omega，而不是每次接觸重新 resolve。
2. shared-physics-core.js 是否仍透過 legacy x-kick 處理 true sidespin。
3. gravity=-4.2 與 SIM_TIME_DILATION 是否造成尺度混用。
4. blend、fallback、preset geometry 是否把模型誤差吸收到參數裡。
5. 所有測試要區分數學正確性、prototype 穩定性與真實量測校準。

每一階段完成後，報告：改動檔案、物理目的、驗證結果、失敗案例、已知假設與下一個 gate。不要把 legal gate、成功率或視覺通過寫成物理真值。
```

本計畫的 Phase 0 baseline 與隔離 prototype evidence 已完成記錄；目前已在授權範圍內完成 schema v2、real-scale flight bridge、通用 3D impulse contact、spin3d table-bounce path，以及四個頁面與 preset contract 的第一輪同步。2026-07-16 的 R1 後續也已將 Game 4、Game 5、Return Studio 的 substepped tangential contact impulse 接到 shared compliant-contact helper，並保留頁面特有的 normal two-stage dwell-time、finite-racket-mass 與 wrist-brake adapter。另已新增 `tools/physics-3d-cross-page-e2e.test.js`，驗證 Game 4、Game 5、Return Studio 的 `serve → flight → table → racket → return` canonical `omega` 串接與 Return Studio 鏡射規則；這是資料流證據，不是校準或物理真值。正式 migration 尚未宣稱完成：normal-force evolution 的完整共用化、Magnus／restitution／friction 的實測校準、preset re-solve、holdout、頁面視覺／手感同步與 Game 5 三軸 HUD debug 顯示仍未完成。後續執行必須沿用本計畫的 rollback 與物理真值邊界。
