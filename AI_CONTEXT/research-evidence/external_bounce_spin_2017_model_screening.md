# 2017 外部落桌資料與 mainline-v2 可比性 screening

> 狀態：`EVIDENCE SCREENING / NOT CALIBRATED`  
> 來源：使用者提供的 `C:\Users\Kevin\Downloads\2017_G0500606.pdf`。  
> 目的：檢查目前 mainline-v2 桌面接觸模型是否與外部資料的 regime 方向相容；不是 fitting，也不改任何物理參數。

## 1. 外部資料可讀出的三個代表 regime

以下數值是從論文 Fig. 5–7 的 marker 讀出的近似範圍，完整資料見 [external_bounce_spin_2017_figure_digitization.csv](external_bounce_spin_2017_figure_digitization.csv)。`lower_disk_level` 是發球機控制量，不是球的物理 spin 量。

| regime | 碰桌前 | 碰桌後 | 讀圖結論 |
|---|---|---|---|
| high-spin / low-speed | 約 120 rps、8.4 m/s、22° | 約 96 rps、10.5–16.0 m/s、14–15° | 旋轉下降、速度上升、反射角變小 |
| transitional | 約 44.5 rps、9.5–10.2 m/s、約 17° | 約 65 rps、約 9.0 m/s、18–20° | 旋轉可由桌面摩擦／接觸轉換增加 |
| low-spin / high-speed | 約 30 rps、10.2–10.8 m/s、14–15° | 約 46–53 rps、8.8–9.2 m/s、18–19° | 旋轉上升、速度下降、反射角變大 |

論文正文的定性結論與圖一致：高旋轉低速度的球碰桌後變成低彈、較快；低旋轉高速的球則反彈較高、速度下降且旋轉增加。

## 2. 目前 mainline-v2 的 read-only probe

使用目前 `mainline-v2/contact-policy.js` 的 R1 table profile：

```text
tableFriction = 0.13
normalModel   = compliant
tangentModel  = coulomb
omega        = (±2π·rps, 0, 0)
velocity     = (0, -speed·sin(angle), speed·cos(angle))
```

這只是把外部的上／下旋代表成 `omega.x`，沒有假裝已經知道論文的世界座標 sign。兩個 sign 都試，輸出為 raw contact response：

| probe | sign | 反彈後 spin | 反彈後速度 | 反彈後角度 | regime |
|---|---:|---:|---:|---:|---|
| 120 rps / 8.4 m/s / 22° | − | 110.9 rps | 7.53 m/s | 21.15° | sliding |
| 120 rps / 8.4 m/s / 22° | ＋ | 110.9 rps | 8.97 m/s | 17.63° | sliding |
| 44.5 rps / 9.8 m/s / 18° | − | 35.74 rps | 8.98 m/s | 16.94° | sliding |
| 44.5 rps / 9.8 m/s / 18° | ＋ | 53.26 rps | 8.98 m/s | 16.94° | sliding |
| 29.7 rps / 10.4 m/s / 15° | − | 21.92 rps | 9.68 m/s | 13.90° | sliding |
| 29.7 rps / 10.4 m/s / 15° | ＋ | 37.48 rps | 9.68 m/s | 13.90° | sliding |

## 3. Screening 結論

目前模型只部分符合外部方向：

- 能在某些 sign 下產生「低旋轉碰桌後增加旋轉」的現象。
- 但 high-spin 案的旋轉衰退較小，且沒有重現外部資料的速度增加量級。
- 反彈角的 regime 方向也不穩定；目前 probe 全部被判為 `sliding`，尚未覆蓋論文描述的 rolling／sliding 分界。
- 因為入射座標 sign、桌面材質、球的實際初始條件與論文圖表配對仍不完全可知，這只能標成 screening mismatch，不能直接歸因於某一個常數。

因此暫不調 `tableFriction`、restitution、dwell time 或 spin transfer 參數。下一個 R1 前置工作是把論文的入射方向／旋轉軸定義補齊，再用同一組世界座標做 axis-by-axis 對照。

