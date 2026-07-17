# 3D Physics Scope Reset — 驗收條件彙整與 R1 決策輸入

> 建立日期：2026-07-17
> 對應文件：`AI_CONTEXT/3D_PHYSICS_SCOPE_RESET.md`（scope contract）、`AI_CONTEXT/3D_RESEARCH_ARCHIVE_INDEX.md` G 段（隔離驗證索引）
> 範圍：本檔只整理隔離驗證結果，不修改 `mainline-v2`、`shared-physics-core.js`、legacy pages、正式 presets。

## 目的

把 `3D_PHYSICS_SCOPE_RESET.md`「最低驗收條件」五項的隔離驗證結果整理成一份入口，供使用者決定是否提出 R1 mainline 變更。依 `00_READ_ME_FIRST.md` 的 R0/R1 分類，這份彙整屬於「原型自由、正式升格審查」中的原型證據側，不是 R1 授權本身。

## 五項驗收條件對照表

| # | 驗收條件（摘要） | 隔離工具 | 檢查數 | 狀態 | 報告 |
|---|---|---|---:|---|---|
| 1 | 無旋轉、上旋、下旋、側旋方向合理且可區分 | `tools/benchmark-3d-spin-direction-matrix.js` | 10 | pass | `AI_CONTEXT/isolation-validation/3d_spin_direction_matrix.{json,md}` |
| 2 | `omega=0`、純單軸、混合、旋轉軸反號不依賴 label | `tools/benchmark-3d-spin-axis-sign-flip-invariance.js` | 10 | pass | `AI_CONTEXT/isolation-validation/3d_spin_axis_sign_flip_invariance.{json,md}` |
| 3 | 桌面法線改變或世界座標旋轉後結果跟著旋轉 | `tools/benchmark-3d-world-rotation-invariance.js` | 9 | pass | `AI_CONTEXT/isolation-validation/3d_world_rotation_invariance.{json,md}` |
| 4 | 接觸前後法向反彈、切向反應不製造未授權 lateral velocity 或能量 | `tools/benchmark-3d-contact-authorization.js` | 8 | pass | `AI_CONTEXT/isolation-validation/3d_contact_authorization.{json,md}` |
| 5 | 同一 `BallState` 跨層一致讀取；顯示層不可反向修改 | `tools/benchmark-3d-ballstate-cross-layer-contract.js` | 10 | pass | `AI_CONTEXT/isolation-validation/3d_ballstate_cross_layer_contract.{json,md}` |

合計 47 個檢查，全數通過。

## 各項關鍵觀察

### #1 旋轉方向矩陣

- 純上旋（omega.x+）：第一落點後 z 速度 > 零旋轉（topspin 把球往下帶、摩擦在接觸點往 +z 拉，球加速前進）。
- 純下旋（omega.x-）：第一落點後 z 速度 < 零旋轉（反向）。
- 順序：topspin > zero > backspin，三個情境可區分且有序。
- 左/右側旋（omega.y+/-）：第一落點 x 偏移符號相反（透過飛行 Magnus 力，不是桌面接觸——因為 omega.y 對水平桌面接觸點速度無切向貢獻）。
- 上旋/下旋不產生橫向偏移（對稱性檢查）。
- 飛行段 omega 不衰減；桌面接觸對 omega.y 沒產生扭矩（接觸點在底、法向衝量不繞 y 軸產生扭矩）。

### #2 旋轉軸反號

- 純 y 軸 omega：+/- 產生完全相同響應（omega.y 軸向、平行於桌面法線，不發明切向衝量），omega.y 保留。
- 純 x 軸 omega：符號反轉後切向衝量 z、輸出速度 z、輸出 omega.x 都符號反轉，normal impulse 不變，能量守恆。
- 純 z 軸 omega：符號反轉後切向衝量 x、輸出速度 x、輸出 omega.z 都符號反轉。
- 混合 omega 在 180° proper rotation 下：response 跟著 R 旋轉（繞 x、y、z 三個軸各測一次）。
- 完整 omega 反號（透過 180° 旋轉）：response omega 反號、能量守恆。
- 無 label 依賴：同向量狀態兩次求解得到完全一致 response。
- 零 omega + 垂直入射：零切向衝量、零輸出 omega；零 omega + 切向入射：摩擦產生 omega，符號與切向方向一致。

### #3 世界座標旋轉

- 30°/52°/73°/任意軸/接近 180° 五個非平凡 proper rotation：整個世界（狀態 + 桌面法線 + 表面速度）跟著旋轉，response 跟著 R（速度、omega、切向衝量都 R-equivariant；normal impulse 是純量，不變）。
- 傾斜桌面（法線 0.24, 0.94, -0.25）獨立測試：接觸點速度定義下的恢復係數正確，與「旋轉水平桌面得到的 response」一致——證明 solver 沒有隱藏 +y 假設。
- 飛行積分器在繞 y 軸旋轉下不變（shared core 重力為 y 純量，是刻意建模選擇；只測 y 軸旋轉的等價性）。
- Magnus 加速度：旋轉 (v, omega) 產生旋轉 a_M。
- 合成旋轉 R2∘R1：套用到狀態等同依序套用。

### #4 接觸授權

- 純垂直入射 + 零 omega：零切向衝量、零輸出切向 COM 速度、法向恢復係數正確。
- 純軸向 omega（平行於法線）+ 垂直入射：零切向衝量、omega.y 保留。
- 移動表面拖動球：COM 切向速度同號於表面、|v_t| ≤ |v_surface_t|（無 overshoot）；接觸點切向速度不反號。
- 低摩擦 sliding：接觸點切向速度不反號、量級遞減。
- 被動接觸不增加剛體動能（5 個多樣案例）。
- 傾斜桌面：法向入射嚴格反向、切向衝量正交於法線、normal delta 等於 normalImpulse/mass。
- 零接觸點切向速度 → 零切向衝量（不發明）。
- 表面速度純法向：不發明切向衝量。

### #5 BallState 跨層契約

- 五個入口（`physics3dAdvanceVelocity`、`physics3dSolvePlaneContact`、`contactApi.solveTableContact`、`contactApi.solveGame5RacketContact`、`scaleAdapter.advanceSimulationState`）對同一 BallState 物件讀取後不修改原物件。
- 接觸 response state 是 schema-2 omega 向量（無 label、無 legacy `spin`/`topspin`/`sidespin` 欄位）。
- `cloneBallState` 產生結構獨立的副本，修改副本不影響原物件。
- `legacy-adapter.js` 是唯一接受 legacy `spin` 的入口；返回 schema-2 with omega；null 與 mixed 輸入會 throw。
- 顯示層讀取（`ball.position`/`velocity`/`omega`）不改變物理狀態。
- 靜態掃描確認 `mainline-v2` runtime/view/product 程式碼沒有 `ball.<field> =` 或 `.ball =` 寫回點。

## 仍未做 / 開放項

以下不是驗收條件，但屬於「要進入 R1 mainline 變更前」仍須補的工作：

1. **Magnus coefficient 與 measured calibration**：目前使用工程候選值 `MAGNUS_LIFT_SLOPE = 0.49`，不是量測校準值。R1 升格前需要一輪量測或外部 reference 比對（仍不把 2017 外部資料當 acceptance gate）。
2. **47 個 preset 重新求解**：`physics-presets.json` 目前是 schema-2 + per-video preset，但並未在 schema-2 3D forward model 下逐一重新求解並驗證軌跡。
3. **視覺／手感驗證**：所有 47 個檢查都是工程不變量，沒有涵蓋人類視覺/手感層。R1 升格前需要在 game5.html 實機看過影片↔發球配對與玩家左右輸入。
4. **Compliant contact 的完整共用化**：shared core 有 `physics3dSolveCompliantPlaneContact`，但各頁仍各自維持兩級拍面 normal dwell-time、finite-racket-mass、wrist-brake adapter；normal-force evolution 完整共用化未完成。
5. **真正 3D 側旋軸向遷移**：`sidespin` 仍是 legacy x-kick proxy。本輪驗收 #1–#5 的 `omega.y` 測試證明 schema-2 world-space omega 語意正確，但 legacy `sidespin` 仍存在於 preset、`shared-physics-core.js` 的相容路徑與部分頁面。完整遷移仍是獨立的 R1 工作（見 `docs/3D_PHYSICS_MIGRATION_PLAN.md`）。

## R1 升格建議（給使用者決定）

依 `00_READ_ME_FIRST.md`，R1 變更需要列出目的、風險、相容性、rollback 與驗證。本輪隔離驗證已提供「schema-2 world-space omega + 向量化接觸 solver 在五個不變量下成立」的工程證據，但**沒有自動授權**任何紅線變更。

下一步選項：

- **A. 不急著升格**：維持目前隔離驗證為 prototype evidence，等使用者補完「仍未做」#1–#5 的部分項目再考慮。
- **B. 提出有限 R1 變更**：針對單一紅線檔案（例如 `shared-physics-core.js`）的契約內修正（R0）或最小契約升級（R1），逐項走 `00_READ_ME_FIRST.md` 流程。
- **C. 全 3D 遷移提案**：依 `docs/3D_PHYSICS_MIGRATION_PLAN.md` 提出完整 R1，包含 omega.y 取代 sidespin、Magnus 飛行力、preset re-solve、頁面同步。這是大工程，需要先做完 measured calibration 與 game5 實機驗證。

本輪不預設答案，由使用者決定下一步方向。

## 執行入口

```bash
node tools/benchmark-3d-spin-direction-matrix.js
node tools/benchmark-3d-spin-axis-sign-flip-invariance.js
node tools/benchmark-3d-world-rotation-invariance.js
node tools/benchmark-3d-contact-authorization.js
node tools/benchmark-3d-ballstate-cross-layer-contract.js
```

每支工具應印出 `status: "pass"`、`failCount: 0`，並在 `AI_CONTEXT/` 寫出對應的 JSON + MD 報告。

## 非目標

- 本檔不授權任何紅線修改。
- 本檔不把 prototype 數值升格為物理真值。
- 本檔不取代 `STATUS.md` 的「現在狀態」角色；`STATUS.md` 仍是紅線狀態入口。
- 本檔不取代 `OPEN_ITEMS.md`；未決項仍逐項在 `OPEN_ITEMS.md` 追蹤。