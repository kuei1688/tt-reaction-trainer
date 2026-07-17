# 2017 外部資料：Semantics-aware representability screen

日期：2026-07-16

這份 screen 的問題是：在不調整 mainline-v2 物理參數的前提下，2017 論文資料的不同座標／量測語義，是否足以解釋 V9 的差異。

## 結論先說

目前最可代表的比較，是三個「標量」：

- 平移速度大小 `speedMps`。
- 旋轉速率大小 `rotationRps`，由 `rps × 2π` 轉成 `rad/s` 後再輸入 `omega`。
- 論文角度採「相對桌面」解讀時的角度標量；這是高可信度推論，但論文沒有明寫公式。

以下項目目前只能做敏感度 screen，不能當成外部實驗的重建：

- lateral velocity：論文沒有提供桌面內側向分量；本次只測試一個明確但非量測所得的 ±15° heading bound。
- 旋轉軸：論文圖表只有旋轉速率大小；本次掃描 ±X、±Y、±Z 主軸，不能代表任意 3D 軸向。
- 接觸 regime：論文沒有報告 sliding／rolling、滑動速度、摩擦係數、接觸力歷程或 dwell time，因此外部 regime 保持 `not_reported`。

五種情境共跑 81,000 個樣本。所有情境的 `jointAllThree` 都是 0：沒有一個輸入同時落入外部的角度、旋轉、速度三個 after ranges。

## 情境定義

| 情境 | 角度語義 | lateral velocity | 旋轉軸 | 用途 |
|---|---|---|---|---|
| `baseline_table_plane_planar_omega_x` | 相對桌面 | `vx=0` | `omega.x`，± sign | V8/V9 的基準代理 |
| `alternative_table_normal_planar_omega_x` | 相對桌面法線 | `vx=0` | `omega.x`，± sign | 檢查角度語義翻轉 |
| `sensitivity_bounded_lateral_heading` | 相對桌面 | heading −15° 到 +15° | `omega.x`，± sign | 檢查未量測 lateral 的影響 |
| `sensitivity_unknown_principal_rotation_axis` | 相對桌面 | `vx=0` | ±X、±Y、±Z | 檢查未知旋轉主軸 |
| `combined_unknown_axis_and_lateral` | 相對桌面 | heading −15° 到 +15° | ±X、±Y、±Z | 組合敏感度上界，不是試次重建 |

角度計算使用：

```text
table-plane angle  = atan2(abs(v_normal), hypot(v_tangent))
table-normal angle = atan2(hypot(v_tangent), abs(v_normal))
```

固定桌面 policy 仍是目前 mainline-v2 policy：friction 0.13、restitution 0.76、compliant normal、Coulomb tangent、dwell 0.003 s、12 steps、spring 6000、damping 4。

## 結果摘要

`Y` 表示 scalar output envelope 與外部 after range 有交集；`N` 表示沒有交集。順序都是 `angle / rotation / speed`。

| 情境 | level 0 | level 2 | level 4 | level 6 | joint all three |
|---|---|---|---|---|---|
| 基準桌面角度、平面、X 軸 | N / Y / N | Y / N / Y | N / Y / N | N / N / N | 0 |
| 桌面法線角度、平面、X 軸 | N / Y / N | N / N / Y | N / Y / N | N / N / N | 0 |
| lateral heading ±15° | N / Y / N | Y / N / Y | N / Y / N | N / N / N | 0 |
| 未知主軸 ±X/±Y/±Z | N / Y / N | Y / N / Y | N / Y / N | N / N / N | 0 |
| 未知主軸 + lateral | N / Y / N | Y / N / Y | N / Y / N | N / N / N | 0 |

## 數值 envelope

格式為 `angle° / rotation rps / speed m/s`；這些是模型 output envelope，括號中的外部 target 是論文 digitized after range。

### 基準代理：桌面角度、平面速度、omega X 軸

| level | model envelope | external after | joint |
|---:|---|---|---:|
| 0 | 17.177–22.226 / 92.408–111.536 / 7.494–8.986 | 14.2–14.6 / 81.9–95.7 / 10.5–16.0 | 0 |
| 2 | 15.408–22.226 / 32.974–56.026 / 8.475–9.417 | 18.2–19.9 / 65.1 / 9.0 | 0 |
| 4 | 15.105–15.611 / 19.408–54.392 / 9.591–9.894 | 17.8–19.1 / 49.8 / 8.2–9.3 | 0 |
| 6 | 13.204–13.900 / 21.316–38.084 / 9.491–10.086 | 17.7–19.4 / 46.3–52.5 / 8.8–9.2 | 0 |

### 桌面法線角度替代語義

模型角度變成約 68–77°，與論文圖表的 14–23° 數值不相容。因此「桌面法線角度」可以作為數學替代測試，但目前沒有來源證據支持把論文的數字如此解讀。

### 未知 lateral／旋轉軸的敏感度

允許 lateral 或未知主軸後，envelope 只出現有限擴張：

- level 0 的 rotation 上界由約 111.536 擴至 120.774 rps。
- level 2 的 speed 上界由約 9.417 擴至 9.533 m/s。
- level 4 的 angle 下界可降至 14.919°，仍低於外部 17.8–19.1°。
- level 6 仍同時缺少角度、旋轉與速度三項，沒有 joint match。

這表示「隱藏 lateral／旋轉軸」值得保留為模型不確定性，但在本次明確的敏感度範圍內，還不足以解釋整體差異。

## Contact regime 判讀

外部資料的 regime 是：

```text
external = not_reported
```

本次 81,000 個 mainline-v2 接觸樣本的診斷是：

```text
model frictionRegime = sliding: 81,000
```

這只能說目前 solver 對這些代理輸入判定為 sliding，不能說 2017 實驗本身是 sliding，也不能據此宣稱模型與外部接觸 regime 已對齊。

## 判定與邊界

這個 screen 支持以下判定：

1. 標量範圍的比較可以繼續作為條件式 benchmark。
2. 桌面角度是目前較合理的論文語義；桌面法線角度不是目前有證據支持的解讀。
3. lateral velocity 與旋轉軸只能作敏感度分析，不能當成已量測的輸入。
4. 由於沒有 per-ball pairing，任何 joint match 都不能被解讀成一顆實驗球的完整重建；本次也沒有 joint match。
5. 外部 contact regime 仍不可比較。
6. 不授權調參、正式 preset 變更或 R1 promotion。

若在這些語義邊界內仍要追查差異，下一步應針對新的實驗證據或明確授權的 R1 proposal，隔離檢查接觸期間的物理機制；不應把未觀測的 lateral、軸向或 contact regime 當作已知真值。

## 產物與驗證

- 工具：[benchmark-external-bounce-spin-semantics-screen.js](/C:/Users/Kevin/Documents/Codex/2026-06-16/files-mentioned-by-the-user-tt/outputs/tt-reaction-trainer-pages/tools/benchmark-external-bounce-spin-semantics-screen.js)
- JSON：[external_bounce_spin_2017_semantics_representability_screen.json](/C:/Users/Kevin/Documents/Codex/2026-06-16/files-mentioned-by-the-user-tt/outputs/tt-reaction-trainer-pages/AI_CONTEXT/external_bounce_spin_2017_semantics_representability_screen.json)

本次沒有修改 mainline-v2、shared core、legacy pages 或正式 presets；screen 只讀取固定 policy 與既有外部 digitization CSV。
