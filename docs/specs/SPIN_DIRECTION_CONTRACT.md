# 側旋方向語意契約

> 更新日期：2026-07-15
>
> 這份文件是專案目前「左右側旋」的單一語意入口。它先定義名稱、視角、資料欄位與 legacy 引擎符號，再區分尚未完成的真正 3D 物理遷移。不要用單一發球案例反推全專案的左右定義。

## 1. 外部定義

本專案採用「擊球後看著球離開」的觀察約定：

- 左側旋（left sidespin）是旋轉名稱，不代表球一定往左彎。
- 右側旋（right sidespin）是旋轉名稱，也不代表球一定往右彎。
- 在相同觀察者與球路方向下，左側旋通常使球往右側彎，右側旋通常使球往左側彎。
- 視角若從發球者切換到接發球者，畫面上的 left/right 可能反轉；因此資料夾名稱、旋轉名稱與球路彎曲方向不可共用一個欄位。

參考：[All About Table Tennis 的 sidespin 說明](https://www.allabouttabletennis.com/table-tennis-techniques-spin.html)、[TableTennisCoaching 的 spin 定義](https://www.tabletenniscoaching.com/node/17)、[Greg's Table Tennis Pages](https://gregsttpages.com/guide-to-table-tennis/faqs-glossary/glossary-of-table-tennis-terms/sidespin/)。

## 2. 本專案座標與單位

- `x`：左右方向。
- `y`：上下方向。
- `z`：前後方向，正方向朝接發球方。
- 角速度使用右手座標系，單位為 `rad/s`。
- 這份契約不允許把 `x` 數值正負直接當成「左側旋／右側旋」名稱；數值正負是引擎表示法，名稱是資料語意。

## 3. 目前 legacy 引擎的表示法

目前正式頁面的 `variation.spin` 仍使用：

```js
spin: { topspin: <rad/s>, sidespin: <rad/s> }
```

在現有桌面反彈模型中，`sidespin` 會被轉成一個 `x` 方向的切向反彈效果：

| 語意 | 目前 legacy `sidespin` | legacy x 方向效果 |
|---|---:|---|
| 左側旋 | 負值 | 向右的 x-kick / 彎曲代理 |
| 右側旋 | 正值 | 向左的 x-kick / 彎曲代理 |

這個正負對應是**本專案目前引擎的 compatibility contract**，不是所有物理引擎通用的數學規則。任何新程式應讀取 `sideName` 與 `curveDirection`，不可用 `Math.sign(sidespin)` 猜資料名稱。

## 4. 目前資料契約

### `videos.json`

`spinType` 的 `_left` / `_right` 代表影片分類所採用的側旋名稱：

| `spinType` | `sideName` | `curveDirection` | `spinType` 基底 |
|---|---|---|---|
| `contact_sidebackspin_left` | `left` | `right` | `sidebackspin` |
| `contact_sidebackspin_right` | `right` | `left` | `sidebackspin` |
| `contact_sidespin_left` | `left` | `right` | `sidespin` |
| `contact_sidespin_right` | `right` | `left` | `sidespin` |

這項命名假設必須以影片人工複核維持；若日後確認資料夾其實是依「畫面往哪邊彎」命名，應修改 metadata／分類，不可在 Game 5 裡偷偷再加一層 sign 反轉。

### `physics-presets.json`

每個由 `serve-generator.html` 產生的 per-video preset 必須包含：

```js
tags: {
  videoId,
  videoCategory,
  spinType,
  sideName,        // "left" | "right" | null
  curveDirection,  // "left" | "right" | "none"
  length,
  placement
}
```

在 replace mode 下，規則是「每一支 approved video 一個 preset」。目前資料為 47 支 approved video、47 個產生 preset。

### `serve-generator.html`

發球產生器必須遵守：

1. 先依 `sideName` 決定旋轉名稱與 legacy sign。
2. 再依 `curveDirection` 顯示球路方向。
3. 位置模板由 `placement` / `length` 決定。
4. 不得因為 sidespin sign 對整條路徑做鏡像；若資料需要另一側路徑，必須由位置模板明確指定。
5. 無法從 legacy preset 判斷 left/right 時，保留原資料，不得默認為 right。

## 5. 尚未完成的物理層遷移

TableTennisCoaching 也區分了真正側旋與沿球路軸旋轉的 corkscrew spin。現有核心在 `shared-physics-core.js` 將 `sidespin` 參與 `omega.z` / x-kick 計算；因為本專案 `z` 是球的前進方向，這是為了維持既有遊戲效果的工程代理，不是完整的真實側旋模型。

真正物理遷移需要另案處理：

1. 將真實側旋放到垂直軸（`omega.y`）。
2. 加入飛行中的 Magnus 側向力。
3. 另立 corkscrew / axial spin 欄位，避免再次把兩者叫成同一個 `sidespin`。
4. 同步 `shared-physics-core.js`、`game4.html`、`game5.html`、`physics-studio.html`、`return-studio.html` 與所有測試。
5. 重新校準所有 serve preset，不能只改一個 sign。

這是紅線核心變更；在完成前，文件只能稱目前行為為「legacy x-kick proxy」。

## 6. 防回歸檢查

- `node tools/serve-generator-contract.test.js`
- 檢查 `serve-generator.html` 不再出現依 sign 鏡像路徑的邏輯。
- 檢查每個 approved video 都有唯一 `tags.videoId`。
- 檢查 left/right 的 `sideName`、`curveDirection`、sign 三者一致。
- 跑 `tools/serve-batch-validation.test.js` 時，先看兩個引擎的 cross-check，再分開解讀個別 solver 落點門檻。
- Game 5 實機檢查必須記錄「影片視角、球路方向、玩家左右修正鍵」三者，不能只看程式內部 sign。
