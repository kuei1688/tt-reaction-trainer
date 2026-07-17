# 3D Physics Diagnostic Plan

**日期：** 2026-07-15  
**狀態：** 已執行，診斷分類完成（prototype evidence）  
**性質：** 隔離診斷／工程證據，不代表物理真值、影片校準完成或 Trainer readiness

## 0. 實際執行結果

執行輸出位於 `AI_CONTEXT/3d_diagnostic_2026-07-15/`。E-03 已分類為 `contact-coupling`，G-04 已分類為 `expected model change`；raw JSON、summary、重現命令與 red-line boundary 均已保存。這份診斷不再等待同一輪重跑，後續工作移交全 3D unified migration。

## 1. 目的

釐清目前 3D prototype 的兩個阻塞點，為後續是否進入紅線核心整合提供可審查的證據：

1. **E-03 axial/corkscrew 語義未定**：自由飛行中的軸向旋轉加速度接近零，但經桌面碰撞後，軸向旋轉案例的水平位移未與零旋轉案例一致。
2. **G-04 Stage4a snapshot mismatch**：現有 batch validation 為 13/14 通過，`push | makeRacketReturnVelocity-stage4a-snapshot` 的輸出與 snapshot 不一致，需要判斷是預期模型變更或回歸。

本計畫只處理診斷與分類，不直接修改正式物理核心、遊戲頁面、preset 或影片資料。

## 2. 已知基線

來源：[`AI_CONTEXT/3d_baseline_2026-07-15/3d_physics_test_plan_summary.md`](../AI_CONTEXT/3d_baseline_2026-07-15/3d_physics_test_plan_summary.md)

| 項目 | 目前結果 | 解讀 |
|---|---|---|
| E-01 | PASS | `omega.y` 左右鏡像檢查通過 |
| E-02 | PASS | 無旋轉穩定、側旋幅度單調、數值有限 |
| E-03 | REVIEW | 自由飛行軸向加速度接近零；`omega.y` 正負方向相反；但碰撞後水平位移不一致 |
| G-04 | 13/14 | 一筆 Stage4a push snapshot 不一致 |

E-03 的觀察值：零旋轉案例的淨水平位移為 `0`，軸向旋轉案例經桌面互動後的淨水平位移為 `0.07411 m`。這個差異目前只能視為待解釋的工程觀察，不能直接判定為正確物理效果。

G-04 的已知差異：

| 欄位 | Expected | Actual |
|---|---:|---:|
| velocity.x | 0.015471 | -0.013771 |
| velocity.y | 2.349485 | 2.372553 |
| velocity.z | -3.479795 | -3.461518 |
| topspin | -23.775389 | -23.185353 |
| sidespin | -4.112160 | -5.611733 |
| dwell | 5.44 | 5.44 |
| epsilon | -0.960051 | -0.960016 |

## 3. 範圍與邊界

### 包含

- 在 `prototypes/3d-physics-test-plan/` 內建立隔離診斷工具或擴充既有 runner。
- 追蹤旋轉、速度、加速度與接觸狀態在各階段的變化。
- 用同一組輸入重現 G-04 mismatch，辨識差異來源。
- 產出 versioned JSON 與短摘要，供紅線變更討論使用。

### 不包含

- 不修改 `shared-physics-core.js`、`game4.html`、`match-trainer.html`、`videos.json` 或 `physics-presets.json`。
- 不調整 Magnus coefficient、blend、preset 數值或 snapshot 容忍度。
- 不宣稱 prototype 通過即代表真實物理、影片校準或 Game 5 readiness。
- 不在本計畫內處理 TODO-010/011 的人工影片與 Game 5 實機確認；它們是本診斷完成後的下一階段。

## 4. 診斷案例

固定初始位置、速度、重力、時間步長、球桌幾何與接觸參數，只改變旋轉輸入：

| Case | `omega.y` | `axialSpin` | 用途 |
|---|---:|---:|---|
| Z0 | 0 | 0 | 零旋轉基準 |
| AX+ | 0 | +125.66 | 判斷軸向旋轉是否只保留，或會在接觸時產生水平耦合 |
| Y+ | +125.66 | 0 | 正向 `omega.y` Magnus／接觸基準 |
| Y- | -125.66 | 0 | 負向 `omega.y` 符號對照 |

每個案例至少執行兩次：一次只經自由飛行與桌面碰撞，一次加入 Stage4a racket return。若需要辨識接觸順序，再增加單一桌面碰撞與單一球拍接觸的拆分案例。

## 5. 觀測點與輸出

在以下邊界各記錄一次完整狀態：

1. 初始輸入。
2. 首次桌面碰撞前。
3. 桌面碰撞後立即狀態。
4. Stage4a 球拍接觸前。
5. Stage4a 球拍接觸後立即狀態。
6. 最終落點／出界位置。

每筆資料至少包含：

- `position`、`velocity`、`acceleration`
- `omega.x/y/z`、`axialSpin`、legacy spin 欄位（若仍存在）
- 接觸類型、sliding/rolling regime、epsilon、dwell
- `deltaX`、net clearance、outcome
- 使用的函式／solver 名稱與輸入版本

輸出位置建議為：

```text
AI_CONTEXT/3d_diagnostic_YYYY-MM-DD/
  3d_physics_diagnostic_raw.json
  3d_physics_diagnostic_summary.md
```

## 6. 診斷流程

### A. 先重現，不先修正

1. 在目前工作樹上重跑 E-03 與 G-04。
2. 確認診斷工具與正式 validator 使用相同的輸入、時間尺度與單位轉換。
3. 記錄首次出現 `deltaX` 差異的階段，不以最終落點反推原因。

### B. 分離旋轉效應

比較 `Z0` 與 `AX+`：

- 若自由飛行期間 `AX+` 已產生水平加速度，檢查 Magnus 輸入是否誤把軸向旋轉送入水平力。
- 若差異只在桌面或球拍接觸後出現，追蹤接觸點速度、法向／切向 impulse、spin decay 與 legacy fallback。
- 若 `AX+` 的水平結果應為 preserve-only，確認碰撞前後 `omega.y` 被保留且不轉換成未定義的 x-kick。
- 若模型設計上允許接觸耦合，必須找出明確的耦合項，並說明其座標系、符號與適用接觸面。

### C. 分類 G-04 mismatch

使用同一輸入逐步比較 Expected 與 Actual：

- 先確認差異是在 incoming state、Stage4a solver、spin transfer，還是輸出 rescale。
- 確認 `dwell` 與 `epsilon` 幾乎一致是否代表接觸時序相同，而速度／旋轉差異來自切向接觸計算。
- 將 mismatch 分類為「預期模型變更」或「回歸／未預期差異」。
- 不以放寬 tolerance 或直接更新 snapshot 作為診斷結論。

## 7. 驗收標準

### E-03

至少符合以下其中一條，並在摘要中明確選定模型語義：

1. **Preserve-only 決策**：`AX+` 經桌面碰撞後的水平結果與 `Z0` 只差數值誤差；使用 runner 已有的數值誤差判定，不新增未說明的視覺容忍度。
2. **Contact-coupling 決策**：`AX+` 的水平差異可由明確、可重現的接觸項解釋，且該項不會破壞 `Y+`／`Y-` 的鏡像方向與有限值條件。

若兩者皆無法成立，E-03 維持 REVIEW，不進入 preset fitting 或正式 3D sidespin 整合。

### G-04

- 找到造成 Expected／Actual 差異的具體階段與欄位。
- 判定差異是預期行為或回歸，並保留重現指令與輸出。
- 若判定為預期變更，只有在另行完成紅線審查後，才可更新正式 snapshot 或核心行為。

## 8. 停止條件與升級規則

出現以下任一情況即停止診斷後的程式修改，先提出紅線變更方案：

- 必須修改 `shared-physics-core.js`、`game4.html`、`match-trainer.html`、`videos.json` 或 `physics-presets.json`。
- 軸向旋轉造成的 `0.07411 m` 差異仍無法定位到明確接觸或飛行項。
- `omega.y` 正負方向不再保持對向，或出現非有限數值。
- G-04 只能透過改 tolerance、刪除案例或直接覆寫 snapshot 才能通過。
- 需要調整正式 preset 或 Magnus coefficient 才能讓單一案例符合預期。

紅線方案必須先列出：修改檔案、物理目的、可能副作用、回歸測試、人工視覺確認與 rollback 方式，等待明確授權後才執行。

## 9. 後續決策順序

1. 完成隔離診斷並產出 raw JSON／summary。
2. 決定 E-03 的軸向旋轉語義，並分類 G-04 mismatch。
3. 若不需紅線修改，進行 Game 5 的 TODO-010 左右視角／輸入人工確認與 TODO-011 實機校準。
4. 若需要紅線修改，先提交獨立變更方案，再重跑 G-01～G-07 與相關人工檢查。
5. 只有在模型語義、snapshot 差異與人工輸入方向都可追溯後，才評估 TODO-009 的正式 3D sidespin 遷移。

## 10. 計畫完成時的交付物

- 本計畫的實際執行結果摘要。
- versioned raw JSON 與可重現指令。
- E-03 語義決策與 G-04 mismatch 分類。
- 通過／保留／阻塞的 gate 表格。
- 明確列出是否需要紅線變更，以及下一個獲授權的工作範圍。
