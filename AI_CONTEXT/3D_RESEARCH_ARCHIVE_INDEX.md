# 3D／Game 5 研究證據歸檔索引

> 更新日期：2026-07-17
>
> 本索引把同一階段的 3D、Game 5 calibration 與 MVP readiness 證據分開整理。資料夾仍保留原始路徑，避免破壞既有文件引用；本索引是目前的統一入口。

## 狀態定義

| 狀態 | 意義 |
|---|---|
| `CLOSED / PROTOTYPE WITH BLOCKERS` | 執行與整理完成，但仍有證據阻塞，不代表物理真值或產品 ready。 |
| `EVIDENCE RETAINED / REVIEW` | raw 與 summary 已保留，仍有 gate 或人工檢查未完成。 |
| `CANDIDATE / NOT PROMOTED` | 找到工程候選，但沒有升格成正式參數。 |
| `PRODUCT READINESS / PENDING` | Game 5 產品流程證據，與物理校準分開判讀。 |
| `ACTIVE NEXT PHASE BASELINE` | 下一階段全 3D 遷移的 baseline，不是已完成遷移。 |
| `HISTORICAL DUPLICATE` | 較早或重複輸出，保留追溯，不作權威結果。 |

## A. 已結案的側旋校準支線

| 實驗 | 狀態 | 入口 |
|---|---|---|
| Game 5 3D side-spin calibration（2026-07-16） | `CLOSED / PROTOTYPE WITH BLOCKERS` | [README](game5_side_spin_calibration_2026-07-16/README.md)、[summary](game5_side_spin_calibration_2026-07-16/summary.md)、[decision](game5_side_spin_calibration_2026-07-16/decision.md) |
| Game 5 3D side-spin calibration（2026-07-15 earlier run） | `HISTORICAL DUPLICATE` | [README](game5_side_spin_calibration_2026-07-15/README.md) |

2026-07-16 的權威結論是 G0–G5 完成、G6 evidence insufficient、G7 controlled approximation、G10 被 metadata ID／影片 `src` offset 阻塞。候選 Magnus coefficient 只保留為 evidence candidate。

## B. 3D baseline 與診斷

| 實驗 | 狀態 | 入口 |
|---|---|---|
| 3D physics baseline（2026-07-15） | `EVIDENCE RETAINED / REVIEW` | [README](3d_baseline_2026-07-15/README.md)、[summary](3d_baseline_2026-07-15/3d_physics_test_plan_summary.md)、[visual check](3d_baseline_2026-07-15/visual-check.md) |
| 3D physics diagnostic（2026-07-15） | `EVIDENCE RETAINED / REVIEW` | [README](3d_diagnostic_2026-07-15/README.md)、[summary](3d_diagnostic_2026-07-15/3d_physics_diagnostic_summary.md) |

Baseline 的 E-03 與 E-08 仍保留 REVIEW；visual check 也明確記錄瀏覽器檢查未完成。Diagnostic 已完成 contact-coupling 與 G-04 expected-model-change 分類，但沒有授權紅線整合。

## C. Game 5 47-serve／回擊 calibration line

| 實驗 | 狀態 | 入口 |
|---|---|---|
| 47-serve calibration consolidated report | `CANDIDATE / NOT PROMOTED` | [README](game5_47_serve_calibration_2026-07-15/README.md)、[summary](game5_47_serve_calibration_2026-07-15/game5_47_serve_calibration_summary.md) |
| baseline sub-run | 同一條 calibration line 的子資料 | [資料夾](game5_47_serve_calibration_2026-07-15_baseline/) |
| coarse sub-run | 同一條 calibration line 的子資料 | [資料夾](game5_47_serve_calibration_2026-07-15_coarse/) |
| timing sub-run | 同一條 calibration line 的子資料 | [資料夾](game5_47_serve_calibration_2026-07-15_timing/) |
| holdout sub-run | 同一條 calibration line 的子資料 | [資料夾](game5_47_serve_calibration_2026-07-15_holdout_top/) |
| smoke sub-run | 同一條 calibration line 的子資料 | [資料夾](game5_47_serve_calibration_2026-07-15_smoke/) |

這條線共 1,358 rows、47/47 legal；push `C=2.9` 是 Game 5 工程候選，後續曾在 readiness 結果中整合到 Game 5 push/chop，但不能解讀成全域 3D 物理參數。

### Attack narrow calibration

狀態：`CANDIDATE / NOT PROMOTED`。入口：[README](game5_attack_narrow_calibration_2026-07-16/README.md)、[summary](game5_attack_narrow_calibration_2026-07-16/game5_47_serve_calibration_summary.md)。

951 rows、47/47 legal、951/951 finite；三組候選 holdout 幾何成功率相同，方向耦合仍未證明。資料檔名沿用原 calibration runner 的名稱，README 已標明，不另行改名以免破壞引用。

## D. Game 5 MVP readiness

| 實驗 | 狀態 | 入口 |
|---|---|---|
| MVP validation（2026-07-16） | `PRODUCT READINESS / PENDING` | [README](game5_mvp_validation_2026-07-16/README.md)、[summary](game5_mvp_validation_2026-07-16/summary.md)、[manual matrix](game5_mvp_validation_2026-07-16/manual-check-matrix.md) |
| MVP validation（2026-07-15） | 歷史前一版 | [資料夾](game5_mvp_validation_2026-07-15/) |

自動 readiness gate 為 7 pass、1 pass-with-warning、0 fail；影片 camera view 與左右語意仍不能當作物理校準通過。產品證據與物理證據分開保存。

## E. 下一階段全 3D baseline

| 實驗 | 狀態 | 入口 |
|---|---|---|
| Unified physics Phase 0／isolated Phase 1–2（2026-07-16） | `ACTIVE NEXT PHASE BASELINE` | [README](3d_unified_physics_2026-07-16/README.md)、[summary](3d_unified_physics_2026-07-16/summary.md)、[decision](3d_unified_physics_2026-07-16/decision.md) |

這組資料先記錄 immutable baseline 與隔離 prototype 缺口；2026-07-16 已依使用者授權進入第一輪正式 unified migration，完成 schema／contact／尺度一致性的 shared-core 與頁面整合。校準、preset re-solve、compliant-contact 完整共用化與視覺／手感驗證仍未完成；結果見 `3d_unified_physics_2026-07-16/formal-migration-summary.md`，不直接解讀為物理真值。

## F. 外部桌球落桌旋轉參考

| 證據 | 狀態 | 入口 |
|---|---|---|
| 外部落桌／旋轉研究 evidence ledger（2017–2026） | `EVIDENCE RETAINED / REVIEW` | [EXTERNAL_BOUNCE_SPIN_EVIDENCE.md](EXTERNAL_BOUNCE_SPIN_EVIDENCE.md) |

此表把外部實測、外部模型與本地 Stage 4a 模擬分開。它是後續 mainline-v2 measured calibration 的輸入索引，不是正式參數或 preset approval。

## G. 3D Physics Scope Reset 隔離驗證

> 2026-07-17 新增。對應 `3D_PHYSICS_SCOPE_RESET.md` 的最低驗收條件 #1–#5。純隔離工具，不修改 `mainline-v2`、`shared-physics-core.js`、legacy pages、正式 presets。

| 驗收 | 工具 | 狀態 | 入口 |
|---|---|---|---|
| #1 旋轉方向矩陣 | `tools/benchmark-3d-spin-direction-matrix.js` | `EVIDENCE RETAINED / REVIEW` | [json](3d_spin_direction_matrix.json)、[md](3d_spin_direction_matrix.md) |
| #2 旋轉軸反號 | `tools/benchmark-3d-spin-axis-sign-flip-invariance.js` | `EVIDENCE RETAINED / REVIEW` | [json](3d_spin_axis_sign_flip_invariance.json)、[md](3d_spin_axis_sign_flip_invariance.md) |
| #3 世界座標旋轉 | `tools/benchmark-3d-world-rotation-invariance.js` | `EVIDENCE RETAINED / REVIEW` | [json](3d_world_rotation_invariance.json)、[md](3d_world_rotation_invariance.md) |
| #4 接觸授權 | `tools/benchmark-3d-contact-authorization.js` | `EVIDENCE RETAINED / REVIEW` | [json](3d_contact_authorization.json)、[md](3d_contact_authorization.md) |
| #5 BallState 跨層契約 | `tools/benchmark-3d-ballstate-cross-layer-contract.js` | `EVIDENCE RETAINED / REVIEW` | [json](3d_ballstate_cross_layer_contract.json)、[md](3d_ballstate_cross_layer_contract.md) |

五份隔離驗證全數通過（#1 10/10、#2 10/10、#3 9/9、#4 8/8、#5 10/10），共 47 個檢查。屬於定性代表性（qualitative representability）證據，不是校準或物理真值；僅證明 schema-2 world-space omega + 向量化接觸 solver 在這幾個不變量下成立。正式升格仍需 R1 紅線審查。

## 共同規則

- raw output 保留原樣，不用成功率取代物理真值。
- prototype、產品 readiness、正式物理核心三者分開判讀。
- 沒有獨立影片量測時，候選參數不得標成 calibrated truth。
- 紅線檔案仍需另案提出目的、風險、驗證與 rollback 後才可修改。
