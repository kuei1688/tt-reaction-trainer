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
| 側旋 | 高引拍 | 拍面立起，橫向刷球 |
| 下旋 | 低引拍 | 拍面幾乎水平，往下切 |
| 側下旋 | 中引拍 | 拍面約45度斜，向下＋橫向刷球 |
| 不轉 | 低引拍 | 動作像下旋，但輕碰無摩擦 |

## 左右側旋的命名規則

專案中的「左側旋／右側旋」指球的旋轉名稱，不是球路往左／往右彎的名稱。依接發球者觀察的約定：左側旋通常往右彎，右側旋通常往左彎；換觀察視角時，畫面左右不能直接當成旋轉名稱。

影片分類的 `_left` / `_right` 目前依旋轉名稱使用，發球 preset 另用 `tags.curveDirection` 記錄球路方向。完整契約與 legacy 引擎正負號請看 [`docs/SPIN_DIRECTION_CONTRACT.md`](docs/SPIN_DIRECTION_CONTRACT.md)。

目前引擎的 `sidespin` 正負是相容既有 x-kick 行為的工程符號，不是完整 3D 側旋物理；真正垂直軸側旋與 Magnus 飛行力仍是後續核心工作。

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

---

## Root 檔案地圖

Root 目錄 25 個檔的角色分類。紅線檔案（修改前依 `AI_CONTEXT/00_READ_ME_FIRST.md` 的 R0/R1 流程）以 ⚠ 標記。

### 產品頁

| 檔案 | 角色 |
|---|---|
| `index.html` | 入口頁 |
| `game4.html` ⚠ | 舊版正式遊戲頁（attack/push 用球拍接觸力學、loop 仍是 direct model） |
| `game5.html` ⚠ | 目前 MVP 主線遊戲頁（`docs/specs/MVP_MAINLINE_SPEC.md` 實作） |
| `game5-demo.html` | Demo 版（從 HEAD 4f5b877 複製，排除左側旋/左側下旋） |
| `match-trainer.html` ⚠ | 正式訓練頁 |
| `match-about.html` | 關於頁 |

### 工具頁（研究 / 產生器，非正式遊戲行為）

| 檔案 | 角色 |
|---|---|
| `admin.html` | 影片庫管理 |
| `review.html` | 影片審核 |
| `physics-studio.html` | 發球 preset / 發球物理工具頁 |
| `physics-v2-calibration.html` | 桌面反彈校準頁 |
| `return-studio.html` | 回擊研究 / 調參頁 |
| `serve-generator.html` | Per-video preset 產生器 |
| `serve-settings.html` | 發球設定頁 |

### Shared lib 與正式資料（紅線）

| 檔案 | 角色 |
|---|---|
| `shared-physics-core.js` ⚠ | 共用物理核心（Phase 1+2、schema-2 3D） |
| `camera-config.json` ⚠ | 攝影機設定（game4/game5 讀取） |
| `videos.json` ⚠ | 題庫影片/圖片資料（47 approved video） |
| `physics-presets.json` ⚠ | 發球 preset 資料（47 per-video generated） |

### 子應用

| 目錄 | 角色 |
|---|---|
| `mainline-v2/` | R1 重建邊界（canonical-only、schema-2、獨立狀態路徑；見 `docs/plans/MAINLINE_V2_REARCHITECTURE_PLAN.md`） |

### Config 與 README

| 檔案 | 角色 |
|---|---|
| `README.md` | 本檔 |
| `CLAUDE.md` | Claude Code 工作規則（未 tracked） |
| `.gitignore` | 忽略 `.codex/`、`.claude/`、`prototypes/.claude/` |
| `.nojekyll` | GitHub Pages 關閉 Jekyll 處理 |

### 其他目錄

| 目錄 | 角色 |
|---|---|
| `AI_CONTEXT/` | 狀態、待決項、研究證據、隔離驗證報告（見 `AI_CONTEXT/00_READ_ME_FIRST.md`） |
| `docs/` | 規格、計畫、狀態、日誌（分子目錄 specs/plans/status/logs/ARCHIVE） |
| `tools/` | 測試、benchmark、校準 sweep、build、migrate、共用 loader（分子目錄 tests/benchmarks/sweeps/build/migrate） |
| `images/` | 媒體檔（`{分類}/{分類}_{編號}.{jpg|mp4}`） |
| `prototypes/` | 原型實驗（可自由試，不可自動寫回正式檔案） |
| `vendor/` | 第三方資源 |
