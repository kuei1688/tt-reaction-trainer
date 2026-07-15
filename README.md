# 桌球接發球反應訓練遊戲

**🎮 線上試玩：** https://kuei1688.github.io/tt-reaction-trainer/

針對中階業餘桌球球員設計的接發球判斷訓練工具。

---

## 訓練目標

訓練從**看拍面**的瞬間就完成判斷，讓初判自動化，最終從有意識分析走向無意識感知。

**三層判斷訓練：**
1. **旋轉判斷** — 看引拍高低＋觸球瞬間拍面角度
2. **落點判斷** — 看桌面示意圖選正手位或反手位
3. **技術選擇** — 根據旋轉＋落點決定回球技術

**核心原則：** 果斷優先於正確。猶豫打出去的球品質最差。

---

## 目前情境（第一版）

反手發球 × 4種旋轉：

| 旋轉類型 | 引拍 | 拍面特徵 |
|---------|------|---------|
| 側旋 | 高引拍 | 拍面立起，往左側切 |
| 下旋 | 低引拍 | 拍面幾乎水平，往下切 |
| 側下旋 | 中引拍 | 拍面約45度斜，往左下切 |
| 不轉 | 低引拍 | 動作像下旋，但輕碰無摩擦 |

---

## 貢獻圖片

遊戲使用圖庫系統——同一種旋轉可以有多張圖，每次隨機顯示，讓訓練更多樣化。

**歡迎貢獻任何旋轉類型的發球圖片！**

### 圖片規格

- **風格：** 插圖風格（推薦用 ChatGPT DALL-E 生成，保持一致性）
- **視角：** 接球方正視角（面對發球者）
- **內容：** 每種旋轉需要兩張 — 引拍動作 ＋ 觸球瞬間
- **尺寸：** 建議 400×266px 以上，JPG 格式

### 媒體檔命名規則

所有媒體檔案放在 `images/{分類}/` 下，檔名格式為 `{分類}_{編號}.{副檔名}`，編號固定三位補零（`001`、`002`…），副檔名為 `.jpg`（靜態圖）或 `.mp4`（影片）。完整路徑即 `images/{分類}/{分類}_{編號}.{副檔名}`。

這樣設計是為了讓**檔名本身就全球唯一**：不同分類各自從 `001` 開始編號也不會撞名，未來若要把所有檔案攤平到同一個資料夾或上傳到 CDN，都不會發生覆蓋。

現有分類：

| 分類 | 內容 | 副檔名 |
|------|------|--------|
| `contact_sidebackspin_left` / `contact_sidebackspin_right` / `contact_backspin` / `contact_sidespin_left` / `contact_sidespin_right` / `contact_nospin` | 觸球瞬間（側旋依左/右分開，2026-07-15） | `.jpg` ＋ `.mp4` |
| `backswing_low` / `backswing_mid` / `backswing_high` | 引拍動作 | `.jpg` |
| `techniques` | 技術圖示（`attack.png`、`cut.png`，已具描述性名稱，不加編號） | `.png` |

### 目前需要的圖片

**第一優先（正手發球）：**

| 情境 | 資料夾名稱 | 說明 |
|------|-----------|------|
| 正手側下旋 觸球 | `contact_fh_sidebackspin` | 正手鐘擺，拍面斜45度往右下切 |
| 正手側下旋 引拍 | `backswing_fh_mid` | 正手引拍，中等高度 |
| 正手側上旋 觸球 | `contact_fh_sidetopspin_up` | 正手，拍面斜45度往右上切 |
| 正手側上旋 引拍 | `backswing_fh_high` | 正手引拍，高位置 |

**第二優先（下蹲式發球）：**

| 情境 | 資料夾名稱 | 說明 |
|------|-----------|------|
| 下蹲式 觸球 | `contact_crouch_sidespin` | 小朋友角色，低擊球點 |
| 下蹲式 引拍 | `backswing_crouch` | 小朋友角色，低引拍姿勢 |

### ChatGPT Prompt 模板

用以下 prompt 在 ChatGPT（DALL-E）生成圖片，保持與現有圖片的風格一致：

**基礎設定（所有圖片都加在開頭）：**
```
Table tennis coaching illustration, anime/manga style, front-facing view from receiver's perspective. Player wearing blue athletic shirt, black shorts. Blue table tennis table visible at bottom. White background. No text in image.
```

**正手側下旋 觸球：**
```
[基礎設定] Right-handed player performing forehand pendulum sidespin-backspin serve. Body rotated right, right shoulder back. Racket face tilted at 45 degrees diagonal, about to brush right-side-downward of the ball. Ball visible near racket. Same character style as previous images.
```

**正手側上旋 觸球：**
```
[基礎設定] Right-handed player performing forehand pendulum sidespin-topspin serve. Body rotated right. Racket face tilted at 45 degrees diagonal upward, brushing right-side-upward of the ball. Wrist snapping upward at contact.
```

**下蹲式發球（小朋友角色）：**
```
Table tennis coaching illustration, anime/manga style, front-facing view from receiver's perspective. SHORT YOUNG CHILD (about 10 years old, small stature) performing crouch serve at blue table. Child's natural standing height is at table level. Racket held low, about to brush side of ball. White background. No text.
```

### 如何提交

把生成好的圖片貼在以下地方，我們會審核後加入遊戲：

- **Facebook：** [球館社團連結待補]
- **LINE 群：** [待補]

審核重點：
1. 拍面角度是否正確（最重要）
2. 風格是否與現有圖片接近
3. 視角是否是接球方正視角

---

## 設計文件

遊戲的完整設計邏輯和技術決策記錄在 `design-doc.md`。

---

## 技術說明

純靜態 HTML 單檔，無需伺服器，直接在瀏覽器開啟即可運作。

圖片與影片採用圖庫系統，路徑為 `images/{分類}/{分類}_{編號}.{jpg|mp4}`（命名規則詳見上方「媒體檔命名規則」）。同一分類可有多張媒體，遊戲會隨機選取；檔名前綴分類名確保跨分類不撞名。
