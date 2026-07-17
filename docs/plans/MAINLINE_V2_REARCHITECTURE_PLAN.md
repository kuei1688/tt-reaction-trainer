# Mainline V2 重建計畫

> 文件狀態：R1 提案，尚未自動授權正式實作
>
> 建立日期：2026-07-16
>
> 目的：在保留現有研究成果、資料與驗證證據的前提下，建立一條以 canonical `spin3d.omega` 為唯一物理狀態的 Game 5 主線，避免繼續在多頁面 legacy 架構上擴散 3D 物理修改。

## 1. 決策摘要

本專案不採取「刪除全部程式、從零重寫」，也不繼續讓 Game 4、Game 5、Return Studio、Physics Studio 共用一套逐頁複製的遷移路徑。

採用第三種方案：

```text
保留現有專案作為 legacy/reference
        +
建立以 Game 5 為核心的 mainline-v2
        +
逐步搬入已驗證的物理、資料與互動經驗
```

現有專案在 mainline-v2 完成切換前保持可回溯，不直接刪除、不覆寫舊 preset、不把研究候選值宣稱為物理真值。

## 2. 目前基準點

目前已完成：

- Phase 0 baseline 與 prototype evidence archive。
- Phase 1／2／3 第一輪 shared-core 與頁面整合。
- schema 2 world-space `omega`。
- real-scale flight bridge。
- shared 3D table/contact impulse solver 第一輪。
- Game 4、Game 5、Return Studio 的 explicit `spin3d` handoff。
- Return Studio mirror 的 axial-vector 規則：`omega.x/y` 反號，`omega.z` 保持。
- `serve → flight → table → racket → return` canonical omega 跨頁資料流測試。
- 核心、loader、inline JS、Game 5 MVP、serve legal gate、cross-check 驗證。

目前尚未完成：

- normal-force evolution 的完整共用化。
- 所有 racket dwell-time／finite-racket-mass／wrist-brake adapter 的統一。
- Magnus、restitution、friction 的 measured calibration。
- 47 個 preset 的正式 forward-model re-solve。
- holdout 與實測驗證。
- Game 5 三軸 HUD debug 顯示。
- 完整的瀏覽器實機視覺與手感確認。

目前的 91 pass／50 diagnostic failures 是 forward-model 變更後的校準差異分類，不得直接視為物理真值失敗，也不得直接以調參掩蓋。

## 3. 計畫目標

### 3.1 主要目標

建立一條可獨立驗證、可回滾、只使用 canonical physical state 的 Game 5 主線。

### 3.2 物理狀態契約

正式物理狀態只有：

```js
{
  position: {x, y, z},
  velocity: {x, y, z},
  omega: {x, y, z}, // world-space angular velocity, rad/s
  mass,
  inertia
}
```

下列欄位不是獨立動力學狀態：

- `sideName`
- `curveDirection`
- `spinType`
- `topspin`／`sidespin` legacy compatibility 欄位
- 影片名稱與 UI label

`axialSpin` 若仍存在，只能作為 authoring/input metadata，進入正式模擬前解析成 `omega`，不得在每次接觸時重新注入。

### 3.3 產品範圍

mainline-v2 第一階段只處理：

- Game 5 的發球流程。
- 飛行與桌面反彈。
- 一次球拍接觸與回球。
- 現有影片配對、玩家輸入與回合狀態機。

下列項目不列入第一個 vertical slice：

- Game 4 全面搬遷。
- Return Studio 正式化。
- Physics Studio 完整重寫。
- 47 個 preset 立即重新校準。
- 三軸 HUD。
- 新的影片物理量測。

## 4. 目標架構

```text
mainline-v2/
  index.html                 # 新主線入口
  runtime.js                 # 回合與時間軸
  physics-adapter.js         # page scale 與 shared core 邊界
  serve-data.js              # canonical preset loader
  contact-policy.js          # table/racket surface policy
  trainer-state.js           # 玩家輸入與回合狀態
  view.js                    # Three.js、球路、UI
  legacy-adapter.js          # 僅供輸入轉接與 migration，不進正式 physics

shared-physics-core.js       # 唯一共用物理核心
physics-presets.json         # 既有資料來源，v2 只讀 spin3d
tools/                       # v2 專用 contract、slice、regression tests
```

實際檔名可以依專案靜態載入方式調整，但責任分層必須維持。

### 4.1 Shared core

繼續重用目前的 `shared-physics-core.js`，不要在 v2 內複製另一份物理核心。

若核心 API 需要升級，採新增明確 API 或 facade 的方式，不以頁面內 inline function 複製 solver。

### 4.2 Canonical data boundary

v2 loader 只接受：

```js
preset.variation.spin3d.schema === 2
preset.variation.spin3d.omega
```

legacy `variation.spin` 只允許在：

```text
legacy input → explicit adapter → canonical spin3d → v2 runtime
```

出現缺少 canonical `spin3d` 的正式 v2 preset 時，應 fail closed，而不是默默 fallback。

### 4.3 Scale boundary

preset 與 shared core 的物理量以 real-scale 為準。

動畫時間尺度只能在 `physics-adapter.js` 進出一次：

```text
real state → page simulation scale
page simulation scale → real state
```

scale 不得散落在 flight、table bounce、racket contact、HUD 或 preset loader 各自處理。

## 5. 分階段執行計畫

## Phase V0：Checkpoint 與邊界凍結

### 目的

把目前第一輪整合結果固定成可回溯基準，停止在舊頁面上擴散新的 3D 物理修改。

### 工作

- 保留目前 `shared-physics-core.js`、preset、測試與 evidence。
- 確認 `physics-3d-cross-page-e2e.test.js` 成為目前 canonical handoff 的 contract test。
- 將 Game 5 定義為 v2 的唯一產品主線候選。
- Game 4、Return Studio、Physics Studio 暫時維持 reference/research 定位。
- 不加入 HUD。
- 不調整 Magnus coefficient。
- 不重新產生 47 個 preset。

### 完成條件

- 目前既有測試維持通過。
- working tree 的目前結果可被明確識別為 migration checkpoint。
- 沒有因 V0 改變正式物理或資料語意。

## Phase V1：建立 mainline-v2 skeleton

### 目的

建立新主線的程式邊界，但先不搬完整 Game 5。

### 工作

- 建立 `mainline-v2/` 或等價的新入口。
- 載入現有 shared core。
- 建立 `BallState` 與 canonical `SpinState` 邊界。
- 建立 canonical-only preset loader。
- 建立 real/simulation scale adapter。
- 建立最小回合狀態：serve、flight、contact、return、result。
- 不引用舊頁面中的 `spin` mutable state。

### 測試

- v2 loader 缺少 `spin3d` 時必須失敗。
- v2 runtime 的所有 spin samples 都是 schema 2。
- `omega` 三個分量 finite。
- pure、mixed、zero、sign-reversed spin case 通過。

### 完成條件

v2 skeleton 可以載入一個現有 mixed-spin preset，並建立 canonical `BallState`，但尚不要求完整畫面或完整訓練流程。

## Phase V2：建立最小 canonical vertical slice

### 目的

先在新主線驗證最重要的物理路徑：

```text
serve
→ flight
→ table bounce
→ racket contact
→ return flight
```

### 工作

- 選一個同時具有 `omega.x` 與 `omega.y` 的 mixed-spin preset。
- 使用 shared core 進行 flight。
- 使用 shared 3D table contact。
- 使用明確命名的 Game 5 racket adapter。
- 回球時只傳遞 `spin3d`。
- 在每一段輸出 diagnostics：`velocity`、`omega`、scale、contact regime。

### 重要限制

目前 page-specific normal dwell-time 尚未完成共用化，因此第一版可以使用現有 adapter，但必須明確標記為 temporary adapter，不得宣稱 full compliance。

### 測試

- serve 起始 omega 保持。
- 實際頁面 table bounce 後的 spin sample 仍為 schema 2。
- table bounce 不意外改變法線軸預期不變的分量。
- racket contact 後 `velocity` 與 `omega` 都有輸出。
- return flight 讀取 racket response 的 canonical omega。
- real/simulation scale 不重複轉換。

### 完成條件

一個 mixed-spin serve 可以在 v2 中完成完整資料流，且任何階段都不需要讀取 legacy `sidespin` 作為物理來源。

## Phase V3：定義並抽取 v2 contact policy

### 目的

把接觸模型從頁面 adapter 提升成可測試的 v2 contact API。

### 建議介面

```js
solveContact({
  state,
  surface: {
    normal,
    surfaceVelocity,
    friction,
    restitution,
    radius
  },
  mode: {
    normalModel,
    tangentModel,
    dwellTime,
    racketMass,
    wristBrake
  }
})
```

回傳：

```js
{
  state,
  diagnostics: {
    normalImpulse,
    tangentImpulse,
    dwellTime,
    frictionRegime,
    energyDelta
  }
}
```

### 執行順序

1. 先讓 v2 使用現有已驗證的 shared instantaneous/tangential path。
2. 再把 normal-force evolution、finite racket mass、wrist brake 收入 v2 contact policy。
3. 最後才考慮是否讓 Game 4 或 Return Studio 共用該 policy。

### 完成條件

v2 的 table 與 racket contact 都有同一套 state transition contract；頁面只提供 surface/mode policy，不再複製接觸數學。

## Phase V4：搬入 Game 5 產品行為

### 目的

將已經驗證的 Game 5 產品經驗搬入 v2，但不搬入舊版物理耦合。

### 搬入範圍

- videoId 1:1 配對。
- 影片播放與接球交接。
- 起拍延遲。
- 技術鍵與滑動方向輸入。
- 球拍 mesh 與擊球演出。
- 成敗狀態與第一落點標記。
- camera behavior。

### 不直接搬入

- 舊頁面的 mutable `spin` state。
- 直接寫入 legacy `sidespin` 的補償邏輯。
- 頁面內 duplicated flight/contact solver。
- 尚未專屬校準的 compensation constant。

### 完成條件

v2 可以完成一個可遊玩的 Game 5 回合，且物理路徑仍只使用 canonical state。

## Phase V5：補齊 v2 contract 與回歸測試

### 測試範圍

- schema 2 canonical-only loader。
- `serve → flight → table → racket → return`。
- 實際 table bounce 後 omega sample。
- mixed spin 與左右鏡射。
- axial vector mirror：`x/y` 反號、`z` 保持。
- zero spin、pure topspin/backspin、pure sidespin。
- rotated-frame contact invariance。
- energy non-increase。
- real/simulation scale。
- legacy adapter 只在入口使用。

### 與舊版的比較

舊版只作 behavior reference，不作物理真值。

比較結果分成：

1. canonical contract bug。
2. contact adapter difference。
3. forward-model calibration difference。
4. legacy behavior intentionally changed。

不得用「新舊結果不同」直接判定 v2 錯誤，也不得用調參讓差異消失而不分類。

## Phase V6：加入 Game 5 三軸 HUD

### 目的

在 canonical state 與 v2 data flow 固定後，加入獨立 UI 工作。

### 顯示內容

```text
上／下旋分量：omega.x
側旋分量：omega.y
軸向分量：omega.z
總旋轉量：sqrt(x² + y² + z²)
```

玩家模式可顯示「左側旋＋下旋」等語意 label；debug 模式必須同時顯示 raw omega。

HUD 不得使用 legacy `spin.sidespin` 作為真正側旋數值。

### 完成條件

HUD 顯示值與 v2 runtime 最後一個 resolved canonical omega 一致。

## Phase V7：preset re-solve 與 calibration

### 前置條件

- v2 contact policy 已固定。
- normal-force evolution 的決策已固定。
- scale boundary 已固定。
- v2 vertical slice 與回歸測試通過。
- 不再頻繁改變 `omega` 語意或符號。

### 順序

```text
freeze model/contact policy
→ 47 preset forward-model re-solve
→ legal gate
→ target precision classification
→ holdout
→ measured calibration
→ Game 5 實機視覺／手感驗證
```

任何 candidate Magnus coefficient、restitution、friction 或 compensation constant，先保留在 evidence／candidate config，不直接寫入正式核心。

## Phase V8：主線切換

### 切換條件

- v2 Game 5 vertical slice 通過。
- canonical contract tests 通過。
- v2 regression 通過。
- 47 preset 的差異已分類。
- 至少完成一輪實機視覺與手感檢查。
- rollback 方式已確認。

### 切換策略

- v2 先以獨立入口運行。
- 舊 Game 5 保留作為 reference。
- 使用者確認 v2 可接受後，再決定是否將入口名稱切換為正式 Game 5。
- Game 4、Return Studio、Physics Studio 不因 v2 自動同步改寫。

## 6. 驗證 Gate

### Gate V2-A：Canonical state

- v2 runtime 不直接讀 legacy `spin`。
- 所有正式 spin state 都是 schema 2。
- `omega.x/y/z` finite。
- label、metadata 與 physical state 分離。

### Gate V2-B：Coordinate and mirror

- pure/mixed/zero spin 通過。
- 左右鏡射規則固定。
- `omega.x/y` 反號、`omega.z` 保持的 mirror contract 通過。
- rotated-frame contact invariance 通過。

### Gate V2-C：Contact

- table contact 與 racket contact 都更新 `velocity` 與 `omega`。
- 接觸後不重新由 legacy sign 推導側旋。
- friction regime、impulse、energy diagnostics 可讀。
- normal-force adapter 的暫時性或正式性明確標記。

### Gate V2-D：Scale

- real-scale 與 simulation-scale 只在 adapter 轉換。
- flight、bounce、racket、return 不能重複 scale。
- preset 的 rad/s 語意不被頁面時間尺度污染。

### Gate V2-E：Product path

- Game 5 一個完整回合可運作。
- 影片、起拍、擊球、回球、結果狀態不回退。
- visual handoff 與 interaction 需人工確認。

### Gate V2-F：Calibration

- legal gate 通過。
- target precision 差異已分類。
- holdout 與 measured calibration evidence 獨立保存。
- 不把 candidate parameter 寫成物理真值。

## 7. Rollback 與風險控制

### Rollback

- v2 使用獨立入口，不覆寫舊 Game 5。
- 舊 `physics-presets.json` 保留。
- 舊頁面與 evidence 不刪除、不搬移。
- v2 的任何新資料先使用新檔案或新欄位，不直接破壞 legacy contract。
- 若 v2 vertical slice 失敗，回到目前 migration checkpoint，不回滾或重寫已驗證的 shared core。

### 主要風險

| 風險 | 控制方式 |
|---|---|
| v2 重做舊 bug | 舊版作 behavior reference，並保留既有測試 |
| 新舊結果不同造成誤判 | 先分類 model／adapter／calibration 差異 |
| legacy 欄位重新滲入 | canonical-only loader 與 fail-closed test |
| scale 重複轉換 | 統一由 physics adapter 處理 |
| 過早校準 | 接觸模型與資料契約 freeze 前禁止 re-solve |
| v2 與舊版長期分叉 | 只把 Game 5 設為主線，其餘頁面明確標為 reference/research |

## 8. 文件同步要求

上一輪工作已經完成必要的狀態更新，包括：

- `STATUS.md` 的 migration checkpoint。
- `OPEN_ITEMS.md` 的 CROSS-PAGE-OMEGA-001。
- unified migration plan 的資料流證據與未完成項目。
- evidence summary 的結果與物理真值邊界。

因此不需要再請上一輪對話重新修改物理核心或重新整理所有文件。

只需要補一個最小文件連結：

- 在 `AI_CONTEXT/STATUS.md` 或 `AI_CONTEXT/OPEN_ITEMS.md` 加入本計畫的位置。
- 明確標記本計畫是「mainline-v2 重建提案」，不是 full 3D migration 已完成。
- 保留 `CROSS-PAGE-OMEGA-001` 為已完成的資料契約 checkpoint。

這個文件同步屬於文件層更新，不應與下一輪 v2 實作混在一起。

## 9. 下一個對話的執行規則

下一個對話開始時，先讀取：

1. `AI_CONTEXT/00_READ_ME_FIRST.md`
2. `AI_CONTEXT/STATUS.md`
3. `AI_CONTEXT/OPEN_ITEMS.md`
4. 本文件
5. `tools/physics-3d-cross-page-e2e.test.js`
6. `shared-physics-core.js`

第一輪只執行 Phase V0 與 Phase V1，不要一次實作整份計畫。

執行前必須回報：

- 準備新增或修改的檔案。
- 哪些檔案屬於正式 red-line。
- v2 與 legacy 的 rollback 邊界。
- 這一輪的驗證命令與完成條件。

若要直接授權第一輪，可使用：

```text
請依 docs/MAINLINE_V2_REARCHITECTURE_PLAN.md 執行 Phase V0 與 Phase V1。
先建立 mainline-v2 skeleton 與 canonical-only loader，不要加入 HUD、不要重解 preset、不要做 measured calibration，也不要修改 Game 4、Return Studio 或 Physics Studio 的正式物理行為。
開始前先列出檔案、風險、rollback 與驗證方式；完成後執行 V1 tests 並回報結果。
```

## 10. 計畫完成定義

本計畫不是以「所有舊頁面都被改完」作為完成，而是以以下結果作為完成：

```text
Game 5 mainline-v2
  使用唯一 canonical omega
  有獨立接觸與 scale 邊界
  有完整 serve → return vertical slice
  有可回滾的測試與 evidence
  不依賴 legacy physics 欄位
```

在此之前，不能宣稱全 3D migration 已完成；只能宣稱 mainline-v2 已完成相應階段的工程驗證。
