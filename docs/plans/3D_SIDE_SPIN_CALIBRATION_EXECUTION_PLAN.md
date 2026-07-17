# 3D 側旋／47 發球參數校準執行計畫

> 日期：2026-07-16  
> 狀態：已執行，研究支線結案（Prototype with blockers）  
> 範圍：prototype 校準與證據收集；不直接修改紅線程式或正式資料。  
> 主要原則：先用 47 個固定發球與可重跑的參數 sweep 找出曲線及安全範圍，再用少量影片做語意、視角與觸球時間確認。

## 0. 實際執行結果（2026-07-16）

本計畫已依固定 manifest 執行 G0–G9，並完成 G10 的瀏覽器／影片檢查嘗試。完整證據位於 `AI_CONTEXT/game5_side_spin_calibration_2026-07-16/`；該資料夾內的 `summary.md` 與 `decision.md` 是本輪結論入口。

| 範圍 | 結果 | 解讀 |
|---|---|---|
| G0–G5 | PASS | 座標、47 球 baseline、Magnus sensitivity、bounce transfer、球拍耦合篩選完成；G1 legal gate 47/47。 |
| G6 | EVIDENCE INSUFFICIENT | 沒有得到 `correct > none > wrong`；`SIDESPIN_COMPENSATION_C=2.9` 未被本輪 3D 研究重新驗證。 |
| G7 | controlled approximation | attack 控制條件成立，但不是物理校準結論。 |
| G8–G9 | 報告完成 | holdout 與 All-47 replay 已保存，不代表實機或真人物理通過。 |
| G10 | BLOCKED | 頁面可載入播放，但 metadata ID 與實際影片 `src` 檔名 offset，視角、彎曲方向與手勢一致性不能確認。 |

本輪篩出的 `Magnus coefficient=0.002793690356025591` 只保留為 candidate baseline；沒有修改 `shared-physics-core.js`、`game4.html`、`game5.html`、`videos.json` 或 `physics-presets.json`。因此本計畫的正式決策是 **Prototype with blockers**，而不是 Candidate range found 或正式整合 ready。

這代表「執行與整理」已完成，但依第 12 節完成定義，不能把本輪稱為真人物理校準完成。研究支線在此結案；ID/source contract 的修正、G10 重測與正式 `omega.y` + Magnus 遷移，移交 `docs/3D_PHYSICS_MIGRATION_PLAN.md`，不再於本計畫內繼續 fitting。

## 1. 執行目標

本計畫要回答五個問題：

1. `omega.y` 的正負是否穩定地產生相反方向的側旋曲線。
2. `MAGNUS_COEFFICIENT`／`MAGNUS_LIFT_SLOPE` 的合理範圍是多少。
3. 側旋經過我方桌面第一次反彈後，旋轉與曲線是否仍然穩定。
4. 回擊時，球拍水平補償 `planeVel.x`、拍面角度 `tiltX` 與側旋之間的最佳耦合方式是什麼。
5. push/chop 與 attack 是否需要不同的側旋回應參數。

本計畫不把「跑出一條成功曲線」當成完成。必須同時具備：

```text
語意正確
→ 曲線方向正確
→ 參數變化平順
→ 桌面反彈穩定
→ 47 球 holdout 不重大回歸
→ 回擊方向可辨識
→ 最後才做影片視角與產品驗證
```

## 2. 目前基線與不可混淆的兩種參數

### 2.1 目前已存在的基線

| 項目 | 目前狀態 | 本計畫的處理 |
|---|---|---|
| approved serve | 47 個 per-video preset | 固定輸入，不重新生成 |
| 旋轉名稱 | `sideName: left/right` | 只讀 metadata，不從 sign 猜名稱 |
| 球路方向 | `curveDirection: left/right` | 與旋轉名稱分開驗證 |
| canonical 側旋 | `variation.spin3d.omega.y` | 作為主要校準輸入 |
| legacy `sidespin` | 保留 compatibility proxy | 只做相容性對照，不作新 sign 真值 |
| Magnus | `omega × velocity` 候選模型 | 先掃係數，再決定是否需要改模型 |
| Game 5 push 補償 | `SIDESPIN_COMPENSATION_C=2.9` | 作為既有候選基線，不與 Magnus 係數混為一談 |
| Game 5 attack 補償 | 尚無專屬校準 | 獨立實驗，不自動沿用 push 結論 |

重要區分：

- `MAGNUS_COEFFICIENT` 決定球在飛行中如何彎曲。
- `SIDESPIN_COMPENSATION_C` 決定 push 回擊時球拍往左右補多少。
- 前者是「來球物理」，後者是「回球操作補償」，不可只用同一個成功率判斷兩者。

### 2.2 不修改的檔案

第一輪所有實驗只允許改 prototype override 或複製檔：

- `shared-physics-core.js`
- `game5.html`
- `game4.html`
- `videos.json`
- `physics-presets.json`
- `return-studio.html`

均不得被批次工具直接寫回。若最後要採用參數，再另開紅線變更討論，列出目的、風險、驗證與 rollback。

## 3. 固定資料、分組與隨機規則

### 3.1 47 球 manifest

第一次執行先產生不可變的 manifest，至少記錄：

- `presetId`
- `videoId`
- `videoCategory`
- `spinType`
- `sideName`
- `curveDirection`
- `length`
- `placement`
- `start`
- 原始 `variation.spin`
- 原始 `variation.spin3d`
- preset 檔案 SHA-256

之後所有 group 都讀同一份 manifest，不重新產生發球、不重新鏡像路徑、不偷偷調整個別球。

### 3.2 calibration / holdout split

沿用目前 Game 5 校準線的 6 / 41 分層方式，但先將實際 ID 寫入 manifest：

- **Calibration-6：**涵蓋左側旋、右側旋、側下旋／純側旋、長／短、正／反手位置。
- **Holdout-41：**其餘 41 球，依相同類別分布檢查泛化。
- **All-47：**最後的整體報告，不用來挑選參數，只用來報告選定候選的全庫行為。

若現有 6 / 41 manifest 不存在，不可臨時看結果挑球；應依上述 strata 先固定，再開始 sweep。

### 3.3 重複與 seed

- 純 deterministic physics：每個 configuration 跑一次即可，但保存固定 seed 與版本 hash。
- 若開啟 `RANGE_SOLUTION_MODE` 或 execution variance：每個 configuration 跑 5 個固定 seed，報告平均、標準差、p10/p50/p90。
- 第一輪關閉 range variance，先校準物理主線，再另測人手變異。

## 4. 每筆數據必須收集的欄位

所有 raw row 必須包含以下資料；不能只保存成功／失敗。

### 4.1 執行與輸入欄位

| 欄位 | 說明 |
|---|---|
| `runId` / `groupId` | 實驗與組別識別 |
| `sourceSha` | physics core、Game 5、preset 的 hash |
| `presetId` / `videoId` | 固定發球識別 |
| `sideName` / `curveDirection` | 資料語意 |
| `seed` | 可重放的隨機種子 |
| `omega.x/y/z` | 接觸前 canonical 角速度，rad/s |
| `axialSpin` | corkscrew 分量，rad/s |
| `magnusCoefficient` / `magnusLiftSlope` | 當次飛行參數 |
| `gravity` / `dt` / `SIM_TIME_DILATION` | 模擬尺度 |
| `technique` | `push`、`attack` 或 control |
| `swingDelayMs` | 起拍到接觸延遲 |
| `tiltX` / `tiltY` | 球拍法向角度 |
| `planeVel.x/y/z` | 球拍平移速度 |
| `directionInput` | `left`、`right`、`none` |
| `aimedSign` / `compensationX` | solver 判斷與實際補償 |

### 4.2 發球飛行欄位

至少保存：

- 每幀 `position.x/y/z`、`velocity.x/y/z`。
- 每幀 `omega.x/y/z`、`axialSpin`。
- 過網位置與速度。
- 過網高度及 `netClearance`。
- 我方第一跳：`x/y/z`、速度、旋轉。
- 對方第二跳：`x/y/z`、速度、旋轉。
- `deltaXAtNet`、`deltaXAtFirstBounce`、`deltaXAtSecondBounce`。
- 最大左右偏移、曲線方向、曲線是否單調。
- 是否碰網、穿桌、穿網、非有限值或提前終止。

### 4.3 回擊欄位

- 回擊接觸點與接觸瞬間 velocity/spin。
- 回擊前後 `omega.x/y/z` 與 `axialSpin`。
- `racketNormal`、`planeVel`、`blend`、摩擦 regime。
- 第一跳落點與第二跳落點。
- 回擊 `netClearance`。
- 結果：`success`、`net`、`out`、`no_landing`、`nonfinite`。
- 方向類別：`correct`、`wrong`、`none`、`not_applicable`。
- 是否使用 fallback solver。
- 接觸後的側旋保留率：`outOmegaY / inOmegaY`。

## 5. 實驗組別總表

執行順序由簡單到複雜，避免一開始把 Magnus、桌面反彈、球拍角度與輸入補償混在一起。

| 組別 | 目的 | 輸入 | 範圍／組合 | 樣本 |
|---|---|---|---|---:|
| G0 | 座標與 sign contract | synthetic velocity | `omega.y=-150,-75,0,+75,+150`，其他旋轉為 0 | 5 |
| G1 | 47 球 3D baseline | 現有 preset | current coefficient、無回擊 | 47 |
| G2 | 側旋強度 sensitivity | `omega.y` | `[-1.25,-1,-0.5,0,+0.5,+1,+1.25] × 125.66` | 6×7 |
| G3 | Magnus 係數 sensitivity | coefficient | `0, 0.0014, 0.0021, 0.0028, 0.0035, 0.0042` | 6×6 |
| G4 | 桌面反彈與 spin transfer | G1 代表球 | 量測 bounce 前後 omega 與 retention，不先改參數 | 47 |
| G5 | 側旋與球拍耦合 screening | `omega.y × tiltX × planeVel.x` | `omega.y={-125.66,0,+125.66}`；`tiltX={-0.25,0,+0.25}`；`planeVel.x={-2.9,0,+2.9}` | 6×27 |
| G6 | push 補償精細 sweep | `SIDESPIN_COMPENSATION_C` | `0,1.45,2.9,3.4,3.8,4.5`，方向 left/right/none | 6×6×3 |
| G7 | attack 獨立 sweep | 垂直揮拍、時機、拍面 | `techniqueVel.y={0,0.15,0.3,0.45}`；delay `{40,60,80,100}`；`tiltX={-0.25,0,+0.25}` | 6×48 |
| G8 | 47 球 holdout | 入選 shortlist | Calibration-6 選 2–3 組，再跑 Holdout-41 | 41×候選 |
| G9 | All-47 final replay | 最終候選 | 固定 seed，產生完整報告與曲線 | 47×候選 |
| G10 | 影片／瀏覽器語意檢查 | 代表影片 | 左／右、球路、觸球時間、手勢對應 | 6 clips |

### 5.1 G0：坐標基準組

先不讀影片、不讀 preset，使用固定前進速度與簡單起點。

必須確認：

- `+omega.y` 的 Magnus `a.x > 0`。
- `-omega.y` 的 Magnus `a.x < 0`。
- `omega.y=0` 不產生側旋曲線。
- axial spin 不會被誤算成 `omega.y`。
- 所有輸出 finite。

G0 失敗時停止後續 fitting；先修座標或符號，不能用成功率掩蓋。

### 5.2 G1：47 球 baseline 組

使用目前 47 個 preset 與現行工程參數，保存每球完整 trajectory。這組不是用來挑參數，而是建立日後所有差異的對照線。

報告至少要有：

- 47/47 legal-serve gate。
- 每球過網、第一跳、第二跳資料。
- left/right 分類的 `deltaX` 分布。
- current coefficient 下的曲線圖與 raw JSON。

### 5.3 G2：側旋強度組

以同一個 preset 的 sideName 與 trajectory 為基準，只改 `omega.y` 的 magnitude，不改位置模板與飛行速度。

目的：確認側旋強度與左右偏移是否單調，並檢查 `+`/`-` 是否近似鏡像。不能直接把 magnitude sweep 的最佳值寫回所有 preset；這一組先回答 sensitivity。

### 5.4 G3：Magnus 係數組

以 G2 的代表值搭配固定 `omega.y`，只改 Magnus coefficient。除 `C=0` 外，其餘值應記錄：

- 到網的左右位移。
- 第一跳左右位移。
- 第二跳左右位移。
- 過網高度與合法率。
- 與 `C=0` 的差分。

如果曲線變化不平順或出現非物理爆開，停止擴大係數範圍，不用較高成功率掩蓋模型問題。

### 5.5 G4：桌面反彈與旋轉傳遞組

這一組不先新增參數，而是測量現有程式實際做了什麼：

- `omega.y` 經過桌面後是否保留。
- `omega.y` 是否被錯當成 legacy x-kick。
- bounce 後下一段 Magnus 曲線是否仍保持方向。
- 旋轉保留率是否因速度、入射角、落點而異。

若保留率不穩定，先將它列為模型／接觸層問題，不要直接調 Magnus coefficient。

### 5.6 G5：側旋 × 球拍耦合組

這是回答「要改拍面角度，還是改球拍平移」的核心實驗。

第一輪使用 6 顆 Calibration-6，掃描：

- `omega.y`：負側旋、無側旋、正側旋。
- `tiltX`：負、零、正。
- `planeVel.x`：負、零、正。

比較：

- `landing.x`。
- `netClearance`。
- 回擊後 `outOmegaY`。
- left/right 是否對稱。
- `tiltX` 是否真的比 `planeVel.x` 更有效。

如果 `tiltX` 的效果小、方向不穩，而 `planeVel.x` 穩定，MVP 可維持水平補償；如果 `tiltX` 產生穩定且可泛化的改善，才另立拍面角度方案。

### 5.7 G6：push 補償組

以現有 `C=2.9` 為中心，測試 `0、1.45、2.9、3.4、3.8、4.5`。

每組都要分開記錄：

- 正確方向。
- 錯誤方向。
- 不按方向。
- left sideName。
- right sideName。

不能只報整體成功率。必須確認：

```text
correct > none > wrong
```

至少在多數分層中成立，且不能只靠某一顆代表球貢獻全部改善。

### 5.8 G7：attack 獨立組

attack 接觸模型與 push 不同，不能直接把 `C=2.9` 當成攻球真值。

第一輪固定側旋輸入，分開掃：

- `techniqueVel.y`：`0、0.15、0.3、0.45`。
- `SWING_DELAY_MS`：`40、60、80、100`。
- `tiltX`：負、零、正。

同時加入 `C` 無效性 control：確認 attack 不會意外吃到 push 的補償邏輯。若 left/none/right 結果仍完全相同，保留 attack 為 controlled approximation，不升格為已校準。

## 6. 指標與判定門檻

### 6.1 硬性停止條件

任一條發生就停止該組，不進下一組：

- 非有限值、穿網、穿桌或 solver 無限迴圈。
- `+omega.y` 與 `-omega.y` 沒有方向反轉。
- axial spin 被誤判為側旋。
- 曲線在係數小幅變動時突然跳躍。
- 左右方向需要偷偷鏡像 metadata 才能通過。
- 只能放寬 threshold 或改 snapshot 才能通過。

### 6.2 曲線接受條件

候選參數至少要滿足：

1. synthetic G0 方向完全正確。
2. 47 球 legal-serve gate 不低於現有 baseline。
3. `+omega.y`／`-omega.y` 的 `deltaX` 方向相反，且 normalized asymmetry 初始門檻不超過 10%（47 球分層可放寬至 15%，但要記錄原因）。
4. magnitude 增加時，曲線偏移不可反向或非單調跳動。
5. `omega.y=0` 的 lateral drift 不得超過 baseline p95 加 0.02 m。
6. 不能出現 bullet trajectory、突然折線、碰網後方向錯誤或 bounce 後 sign 消失。

### 6.3 回擊接受條件

推進 shortlist 前，至少要求：

- correct、none、wrong 三類都能產生有效統計。
- correct 相對 none 有至少 5 個百分點改善，或在 net clearance / landing error 上有一致改善。
- wrong 不得比 correct 更好；若出現，先查 sign、fallback 或 solver。
- holdout 不得出現超過 5 個百分點的主要類別回歸。
- 報告同時提供成功率、p10 net clearance、median landing error，不能只看總成功數。

這些是第一版預註冊門檻；若資料量不足，必須在報告中標成「證據不足」，不可事後改門檻使候選通過。

## 7. 參數選擇方法

不要選一個「看起來最漂亮」的單點。使用以下順序：

1. 先淘汰硬性失敗。
2. 再淘汰沒有左右對稱、沒有單調性或依賴 fallback 的組合。
3. 在安全區內選 p10 net clearance 較高、landing error 較小的範圍。
4. 若多個值差不多，選較簡單、較接近現有基線的值。
5. 將結果分成「安全範圍」與「最佳中心」，不要把中心值宣稱成真值。

預期輸出格式：

```text
Magnus coefficient：安全範圍 [A, B]，候選中心 C
omega.y magnitude：安全範圍 [D, E]，目前 preset 值是否在範圍內
push compensation：安全範圍 [F, G]，Game 5 候選 2.9 是否保留
attack response：已校準／controlled approximation／證據不足
```

## 8. 影片的角色與收集方式

影片不是第一階段數值 sweep 的必要輸入。只有在下列情況才使用影片：

### 8.1 語意與視角檢查

對 6 支代表影片記錄：

- 影片 ID。
- 片中觀察者視角：發球者、接球者或側面。
- 人工判斷的旋轉名稱：left/right/unknown。
- 人工判斷的球路方向：left/right/none。
- 觸球 frame / `contact_time_sec`。
- 球路是否與 preset 的 `curveDirection` 一致。
- Game 5 左右手勢是否與畫面語意一致。
- 判定者與信心等級。

### 8.2 影片不能提供什麼

只有影片分類名稱，不能直接拿來擬合 Magnus coefficient。若要用影片作數值 fitting，還要收集：

- 相機標定或像素到世界座標比例。
- 每幀球心位置。
- 觸球前後速度。
- 桌面第一跳與第二跳位置。
- 可辨識的旋轉量或可信的 spin proxy。
- 遮擋、不確定 frame 與量測誤差。

沒有這些量測時，影片只作語意、時間與視覺驗證，不作物理係數真值。

## 9. 執行順序與工具交付物

### Phase 0：凍結基線

產出：

- `AI_CONTEXT/game5_side_spin_calibration_YYYY-MM-DD/manifest.json`
- `baseline_config.json`
- `git_status.txt`
- source / preset SHA-256

執行既有 contract 與 core tests：

```text
node tools/physics-3d-spin.test.js
node tools/serve-generator-contract.test.js
node tools/serve-batch-validation.test.js
```

### Phase 1：建立 prototype runner

新增隔離工具：

```text
prototypes/game5-side-spin-calibration/run-side-spin-sweep.js
```

工具必須支援：

- 讀取固定 47 球 manifest。
- override `omega.y`、Magnus coefficient、tiltX、planeVel.x、C、delay。
- 不寫回正式 HTML、JS、JSON。
- 輸出 raw row、summary、曲線資料。
- 固定 seed 與 source hash。
- 可單獨跑 G0、G1、G2、G3、G5、G6、G7、G8。

### Phase 2：跑 G0–G4

先完成坐標、baseline、Magnus sensitivity 與 bounce transfer。若任一硬性停止條件發生，不進球拍耦合。

### Phase 3：跑 G5–G7

分別處理 push 與 attack，不把兩種接觸模型合併成一張最佳化表。先在 Calibration-6 找候選範圍，再跑 Holdout-41。

### Phase 4：跑 G8–G9

保存候選 shortlist 的完整 47 球報告，並比較：

- current baseline。
- no-sidespin control。
- candidate center。
- candidate range endpoints。

### Phase 5：少量瀏覽器與影片檢查

只有數值 gate 通過後，才檢查 6 支代表影片。瀏覽器結果要保存 screenshot 或文字紀錄，不能只說「看起來合理」。

## 10. 報告格式與決策結果

每次執行產出：

```text
AI_CONTEXT/game5_side_spin_calibration_YYYY-MM-DD/
  manifest.json
  baseline_config.json
  g0_contract_raw.json
  g1_baseline_raw.json
  g2_magnitude_raw.json
  g3_magnus_raw.json
  g4_bounce_transfer_raw.json
  g5_paddle_coupling_raw.json
  g6_push_compensation_raw.json
  g7_attack_raw.json
  g8_holdout_raw.json
  metrics.csv
  curve-data.json
  summary.md
  manual-check-matrix.md
  decision.md
```

最後只能選以下其中一種決策：

1. **Candidate range found**：找到可重現安全範圍，但尚未宣稱物理真值。
2. **Game 5 controlled approximation ready**：數值與瀏覽器 gate 通過，可提出最小 Game 5 紅線整合。
3. **Prototype with blockers**：曲線或方向有問題，保留資料，先修模型。
4. **Evidence insufficient**：數值可行，但缺少影片量測或視角證據，不能升格成實體校準。

## 11. 紅線整合條件

本計畫完成後仍不自動修改正式程式。若要把新參數寫入 `game5.html` 或 shared core，必須另外確認：

- 修改哪個檔案與哪個常數。
- 它改變的是飛行、桌面反彈還是球拍回擊。
- 對 Game 4、return-studio、physics-studio 的影響。
- 47 球 baseline / holdout 是否重跑。
- Game 5 readiness validator 是否通過。
- 是否保留舊參數與 rollback 方法。

在影片左右視角仍無法人工確認時，不可在 Game 5 裡偷偷反轉 sign；應修正 metadata 或保留為 controlled approximation。

## 12. 完成定義

本計畫只有在以下條件全部滿足時，才可說「側旋已完成一輪參數校準」：

- G0 contract 通過。
- G1 47 球 baseline 可重現。
- G2/G3 找到左右對稱且單調的安全區間。
- G4 知道 bounce 前後 `omega.y` 的行為。
- G5 確認 `tiltX` 與 `planeVel.x` 的相對作用。
- G6 push 的 correct/none/wrong 有可辨識差異。
- G7 attack 已明確標成 calibrated 或 controlled approximation。
- G8 Holdout-41 沒有重大回歸。
- G9 產出固定 seed 的 All-47 報告。
- G10 完成至少 6 支影片的視角、球路與手勢語意檢查。
- 所有 raw data、summary、failure classification 與 screenshot/note 已保存。

若只有 G0–G9 通過而 G10 未完成，結論是「數值與遊戲候選通過，影片語意待確認」，不能稱為真人物理校準完成。
