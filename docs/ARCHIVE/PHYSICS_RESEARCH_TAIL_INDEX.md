# Physics Engine V2 Research Tail Index

> 本文件是 `docs/physics-engine-v2-plan.md` 後段研究內容的索引與分流起點。它只負責把長段落分派到 `EXPERIMENT_LOG.md`、`MODEL_DECISIONS.md`、`PHYSICS_MODEL_SPEC.md`、`VALIDATION_PLAN.md`，不重新做物理解釋。
>
> 建立日期：2026-07-06
> 來源主檔：`docs/physics-engine-v2-plan.md`
> 對照規則：`docs/PHYSICS_RESEARCH_TAIL_SPLIT_PLAN.md`

## 使用方式

1. 先看本文件，確認尾段研究的主軸與分流目的。
2. 再把每個條目拆進對應正式文件。
3. 任何條目若仍缺少日期、測試集或檔案版本，先標成 `研究中` 或 `待驗證`。
4. 不可把尾段敘述直接抄成 `已部署`、`已完成` 或 `風險：無`。

## 尾段主軸

| 主軸 | 典型關鍵字 | 目前應歸類 |
|---|---|---|
| `blend` 機制 | `blendRelease`、`blendCompress`、`PADDLE_BLEND`、`bounceTwoPhaseBlend` | 研究中 / 待驗證 |
| `tiltX` 與瞄準 | `solveRacketVelXForTargetLandingX`、`tiltXGain`、`tiltXMax` | 已取代 / 研究中 / 待決策 |
| `scale` / `outputRescale` | `scale`、`outputRescale`、`SIM_TIME_DILATION` | 研究中 / 待驗證 |
| `Stage 1` 能量預算 | `okCount`、`correctCount`、球拍速度尺度 | 研究中 / 待決策 |
| 研究版與正式頁同步 | `return-studio.html`、`game4.html` | 待決策 |

## 建議拆分條目

### RES-003: `blend` 作為新物理地基

- **來源區段**：`docs/physics-engine-v2-plan.md` 約 882-930, 998-1037
- **應落位置**：`MODEL_DECISIONS.md`、`PHYSICS_MODEL_SPEC.md`
- **目前判斷**：`blend` 已被證實會顯著影響旋轉方向與過網高度，但高 `blend` 會引入新的張力，因此不能直接升格為最終解。
- **保留狀態**：`研究中`

## 已落版條目

以下條目已經在正式文件中落版或具備明確對應，後續拆解時優先保留為交叉引用，而不是重新定義：

| 條目 | 現況 | 對應文件 |
|---|---|---|
| `DEC-003` Aiming/Physics Consistency | 已落版 | `MODEL_DECISIONS.md`、`VALIDATION_PLAN.md` |
| `DEC-004` Internal `scale` and `outputRescale` | 已落版 | `MODEL_DECISIONS.md`、`PHYSICS_MODEL_SPEC.md` |
| `DEC-005` Remove `tiltX` Hack, Restrict `blend` to y-z Plane | 已落版 | `MODEL_DECISIONS.md`、`CORE_FILE_SYNC_STATUS.md` |

### TODO-006: `scale` / `outputRescale` 的一致性檢查

- **來源區段**：`docs/physics-engine-v2-plan.md` 約 1090-1224
- **應落位置**：`VALIDATION_PLAN.md`、`EXPERIMENT_LOG.md`
- **目前判斷**：只要有任何會影響最終出球速度的機制，就要同步檢查瞄準求解是否跟最終碰撞走同一套物理。
- **保留狀態**：`待決策` / `待驗證`

### RES-004: `tiltX` hack 的移除與 y-z 平面限制

- **來源區段**：`docs/physics-engine-v2-plan.md` 約 1184-1210
- **應落位置**：`MODEL_DECISIONS.md`、`CORE_FILE_SYNC_STATUS.md`
- **目前判斷**：拍面誇張旋轉的 `tiltX` hack 已被判定不合理，後續應以 y-z 限制的 `blend` 與獨立瞄準機制取代。
- **保留狀態**：`已取代` / `研究中`

### TODO-007: `tiltX` / `tiltY` 的新一輪推導

- **來源區段**：`docs/physics-engine-v2-plan.md` 約 1256-1260
- **應落位置**：`MODEL_DECISIONS.md`、`PHYSICS_MODEL_SPEC.md`
- **目前判斷**：舊物理下回歸出的 `tiltX` 與 `tiltY` 範圍不應直接沿用；是否重新推導，仍需要在新物理下決策。
- **保留狀態**：`待決策`

### TODO-008: 部署前確認清單

- **來源區段**：`docs/physics-engine-v2-plan.md` 約 1265-1268
- **應落位置**：`VALIDATION_PLAN.md`、`DOCS_MAINTENANCE_PLAN.md`
- **目前判斷**：`PADDLE_BLEND` 預設為 0 時需保證與既有行為一致；研究版機制是否寫回正式遊戲，必須先過完整確認。
- **保留狀態**：`待驗證`

## 先分到哪裡

- **`EXPERIMENT_LOG.md`**：只收可描述為測試、搜尋、原型驗證的條目。
- **`MODEL_DECISIONS.md`**：只收已採用、已取代、研究中、待決策的敘述。
- **`PHYSICS_MODEL_SPEC.md`**：只收可以指到具體檔案與函式的物理常數與公式。
- **`VALIDATION_PLAN.md`**：只收能重跑、能驗證、能列出輸出欄位的項目。

## 下一步

1. 依本索引把 `RES-003` 到 `TODO-008` 逐條落到正式文件。
2. 將尚未補齊日期與版本的尾段內容，先放進 `EXPERIMENT_LOG.md` 的待補條目區。
3. 把任何研究頁機制回寫正式頁的條目，先留在 `TODO`，不要提早升格。

## 讀取順序建議

若要處理 `TODO-006`，先看 `VALIDATION_PLAN.md` 的 `VAL-009` 與 `EXPERIMENT_LOG.md` 的 `EXP-038`，再回到 `MODEL_DECISIONS.md` 的 `TODO-006`。

若要處理 `TODO-007`，先看 `MODEL_DECISIONS.md` 的 `TODO-007`、`PHYSICS_MODEL_SPEC.md` 的舊 `tiltX` / `tiltY` 註記，再對照 `EXP-019`、`EXP-035`、`EXP-037`。

若要處理 `TODO-008`，先看 `VALIDATION_PLAN.md` 的 `VAL-010`、`DOCS_MAINTENANCE_PLAN.md` 的部署前規則，再對照 `EXP-037` 與 `EXP-038` 的交叉引用。
