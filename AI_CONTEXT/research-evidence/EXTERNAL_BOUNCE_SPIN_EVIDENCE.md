# 外部桌球落桌旋轉證據表

> 建立日期：2026-07-16  
> 定位：外部研究的 evidence ledger，不是正式物理參數表。  
> 原則：外部資料用來約束模型的方向、接觸 regime 與驗證問題；在完成單位、座標、表面條件與 holdout 對齊前，不直接寫入 `mainline-v2/`、shared core 或正式 presets。

## 1. 目前決策

目前不採用單一固定的「落桌後旋轉保留率」。外部研究顯示，反彈後的 `omega` 會受至少以下條件影響：

- 入射線速度與入射角。
- 入射角速度向量，以及接觸點的切向相對速度。
- 球面與桌面的摩擦／滑動或 rolling regime。
- 桌面或底材的剛性、柔性與接觸時間。

因此，mainline-v2 的正式比較單位應是「同一輸入條件下，碰桌前後完整 `velocity`、`omega`、反彈角、接觸 regime 與能量變化」，而不是只比較一個百分比。

## 2. 外部來源矩陣

| 來源 | 證據類型 | 已知內容 | 可用於本專案 | 目前限制 |
|---|---|---|---|---|
| [Mencke et al., *Flight and bounce of spinning sports balls*, AJP 2020](https://orbit.dtu.dk/en/publications/flight-and-bounce-of-spinning-sports-balls/)／[DOI](https://doi.org/10.1119/10.0001659) | 實驗 + 數值模型 | 以線性／角動量衝量動量定理與水平、垂直反彈係數建模任意旋轉球的反彈，並與實驗軌跡比較。 | 建立 full-3D bounce 的驗證結構：`omega` 不可被壓成單一 topspin scalar；反彈係數需分方向。 | 目前可取得的研究摘要沒有提供本專案可直接抄用的逐球 `omega_in → omega_out` 表格。 |
| [JSME, 画像解析による卓球の球の軌跡と回転の計測, 2017](https://www.jstage.jst.go.jp/article/jsmemecj/2017/0/2017_G0500606/_article/-char/en)／[DOI](https://doi.org/10.1299/jsmemecj.2017.G0500606) | 桌球機 + 960 fps 影像量測 | 正文說明 Nittaku Robocoach RX、Sony DSC-RX100M5、1920×1080、40 mm 球與單鏡頭影像重建；圖 5–7 提供碰桌前後角度、轉數與速度的近似點。 | 作為「桌面接觸會同時改變 `velocity` 與 `omega`」的直接實驗證據；可用於 high-spin/low-speed 與 low-spin/high-speed 兩個 regime。 | 來源是散點圖而非數值表；已標成 `figure_digitized_approx`，讀圖誤差不等於原始量測 SD。數位化結果見 [2017 figure digitization CSV](external_bounce_spin_2017_figure_digitization.csv)。 |
| [JSME, 卓球ボールのバウンド挙動の研究, 2022](https://www.jstage.jst.go.jp/article/jsmemecj/2022/0/2022_J235-04/_article/-char/ja/) | 專用四滾輪桌球機 + 桌面反彈實驗 | 可發射 top、back、side、gyro rotation；摘要明確指出反彈後 CoR、軌跡與 spin rate 會隨 spin type 與球／桌摩擦係數改變，side 與 gyro 的差異尤其明顯。 | 直接對應本專案所需的純旋轉與混合旋轉 bounce matrix。 | 目前只取得摘要；PDF 入口要求訂閱者認證，尚未把全文數值轉成 repo schema。 |
| [Rémond et al., *Oblique impact of a buckling table-tennis ball on a rigid surface*, PRE 2023](https://journals.aps.org/pre/abstract/10.1103/PhysRevE.107.055007) | 剛性表面斜碰撞實驗 + 力學模型 | 無初始旋轉時，摩擦與入射角也能產生反彈角速度；低於臨界入射角時可能進入 rolling-without-sliding。 | 約束桌面接觸的 regime 分界與「不轉球碰桌後也可能產生旋轉」的測試案例。 | 不是針對正式比賽桌面的完整參數表；不能直接當作本專案的 `mu` 或 retention 常數。 |
| [Rémond et al., *Effect of a compliant substrate on the rebound of a spherical shell*, PRE 2026](https://journals.aps.org/pre/abstract/10.1103/mmdr-2mm3) | 柔性底材反彈實驗 + 彈性模型 | 柔性層在斜碰撞中會提高底材傳遞旋轉的能力，且效果隨層厚度變化；法向反彈的 CoR 與接觸時間也會改變。 | 支持本專案「桌面硬接觸、球拍柔性接觸」之外，桌面本身也應保留可校準的 compliance 風險。 | 矽膠底材不等於正式桌球桌；目前只能作 sensitivity／風險參考，不作桌面參數真值。 |

## 3. 與目前專案資料的關係

專案內的 [push_clean_reference_library.md](push_clean_reference_library.md) 與 [bounce_decay_preset_trace_2026-07-14_raw.json](bounce_decay_preset_trace_2026-07-14_raw.json) 已有桌面彈跳後旋轉的數值，但那是 Stage 4a 內部模擬 sweep，不是上述外部高速攝影實測資料。

該文件開頭仍保留「沒有記錄反彈後旋轉量」的舊版缺口描述，後面的 Group 1 才是後來追加的模擬結果；兩段語意不一致。本表以「內部模擬 evidence」與「外部 measured evidence」分開記錄，不把兩者混成同一種資料。

另外，[STATUS.md](STATUS.md) 已記錄尺度一致性修正：舊版下旋保留率曾被高估，修正後的數值也仍然是模型輸出，不是外部校準結果。

## 4. 下一個校準 gate

下一步應建立獨立的 normalized dataset，至少保存：

```text
source, ball, surface, impact_angle, velocity_in, omega_in,
velocity_out, omega_out, bounce_angle, contact_regime,
measurement_error, units, extraction_status
```

執行順序：

1. 先從 2017／2022 JSME 全文抽取可用的碰桌前後數值與誤差。
2. 將轉數、rps、rad/s 與影像 frame 定義統一；`1 rps = 2π rad/s`。
3. 用同一組初始條件跑 mainline-v2 的 full-3D table contact，輸出完整 `omega` 與 `velocity`。
4. 先比較趨勢、regime 與能量方向，再做參數 fitting；沒有 holdout 前不升格為 calibrated。
5. 只有通過外部 evidence 對照後，才另提 R1 參數變更方案。

目前的 source-level register 見 [external_bounce_spin_dataset.csv](external_bounce_spin_dataset.csv)；2017 圖表數位化結果見 [external_bounce_spin_2017_figure_digitization.csv](external_bounce_spin_2017_figure_digitization.csv)。2017 CSV 保存的是圖表近似範圍，不是把讀圖值冒充成原始逐球資料。

目前與 mainline-v2 的只讀比較見 [external_bounce_spin_2017_model_screening.md](external_bounce_spin_2017_model_screening.md)。結果只作 mismatch／regime screening，不是 calibration。

## 5. 本輪全文取得結果

- [JSME 2017 原始頁面](https://www.jstage.jst.go.jp/article/jsmemecj/2017/0/2017_G0500606/_article/-char/ja) 的 442K PDF 已由使用者提供並完成解析；圖 5–7 已新增 24 筆圖表數位化近似資料，正文條件與結論也已核對。
- [JSME 2022 原始頁面](https://www.jstage.jst.go.jp/article/jsmemecj/2022/0/2022_J235-04/_article/-char/ja) 有 525K PDF 入口，但會導向訂閱者認證；沒有新增數值列。
- 搜尋到的二手學校簡報只作為線索，未納入 evidence ledger，因為它不是原始研究數據來源。

因此目前的 normalized dataset 仍只有 source-level metadata；下一個需要外部資料的動作是取得原始 PDF 或可核對的作者／機構版本。

## 6. 明確不採用的解讀

- 不把內部 sweep 的 61%、68–81% 或 68–74% 當成通用桌球規律。
- 不把論文摘要中的定性結論擴寫成不存在的精確數值。
- 不因 legal gate、成功率或畫面看起來合理，就宣稱 bounce spin 已校準。
- 不把 `secondBounce` 或 legacy proxy 當作外部實測資料。
