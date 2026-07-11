# Phase 1 任務包：單支真人影片的影片—物理交接校準器

> 狀態：**可供實作前核對；尚未開始實作**  
> 日期：2026-07-11  
> 上游計畫：`AI_CONTEXT/PLAN_VIDEO_PHYSICS_PRODUCTIZATION_REVIEW.md`  
> 範圍：僅 `real_backspin_001`、只產生草稿、隔離原型工具

## 1. 任務目的

建立一個引導式校準工具，讓校準者在單一真人影片上完成：

1. 選定或確認 trigger 影格。
2. 在該單一影格標記球的位置。
3. 選擇既有的玩法近似 physics profile。
4. 看見影片 anchor 與該 profile 的第一個物理投影之間的 raw 差距。
5. 將結果存成可重載的**草稿**。

此工具的任務是讓交接假設可見、可保存、可審查；它不證明真實物理，也不讓素材直接進入 Trainer。

## 2. 已批准的前提與現況例外

- 測試樣本只能是 `timeline-config.json` 的 `real_backspin_001`，來源檔為 `./assets/serve-real-backspin-001.mp4`。
- 現有 `generation_status: "ready"` 必須在工具中顯示為「探索性 ready，未校準／不可發布」。這是已有 repo 資料與 checkpoint 之間已知的操作性例外，不得用它放行 Trainer。
- 本任務**不修改**該 status、不修改 `timeline-config.json`、不更新 `SPEC.md` 的驗收狀態，也不宣稱完成 SPEC §8 的真人瀏覽器驗收。
- 現有 `prototype_short`、`prototype_long` 的 physics 初始狀態只可作為玩法近似 profile。選取 profile 不代表它是此真人影片的量測真值。
- 目前已知大 handoff 差距約為 349–382 px（960×540）。工具必須能如實顯示 large delta；不得以延長 crossfade、修改透明度或任何視覺平滑方式將它隱藏。

## 3. 嚴格範圍

### 3.1 必做

- 新增一個只位於 `prototypes/video-physics-timeline/tools/` 下的校準器頁面；不掛進正式導覽與正式遊戲頁。
- 讀取現有 prototype config，並只提供 `real_backspin_001` 作為素材。
- 影片有播放／暫停、逐幀前後移動與時間讀值；時間一律吸附至 60 fps 影格邊界。
- 可在 trigger 影格上以一次點擊設定單一 anchor；畫面採與 prototype 舞台相同的 16:9 cover 裁切規則。
- 可選擇有限的既有 physics profile；初期只允許 config 中現有 `prototype_short` 與 `prototype_long` 的初始狀態，並標示它們是玩法近似。
- 顯示：目前 trigger 時間、anchor UV、選取 profile、第一個物理 frame 的投影位置、raw delta px，以及「草稿／未發布」狀態。
- 顯示影片與物理球的靜態對照或短預覽，讓使用者在儲存前看見兩者相對位置。
- 草稿只可寫入瀏覽器本機儲存空間，並提供明確的 JSON 匯出與匯入；不直接寫入 repo、`timeline-config.json` 或正式資料。
- 所有草稿都必須帶有來源 serve ID、來源影片路徑、profile ID、trigger、anchor、量測畫布尺寸、raw delta、建立時間與 `draft` 狀態。
- 至少有一個 Node 測試覆蓋草稿資料的 schema／範圍／不可發布契約。

### 3.2 明確不做

- 不標記相鄰影格。
- 不從多點推導速度，不做軌跡擬合、數值微分、重力／旋轉分解或自動求解。
- 不修改 physics 初速、spin、重力、shared core 或現有 profile 參數。
- 不加入第二支真人影片、不處理題庫批次校準。
- 不讓工具自動把任何資料設為 `reviewed`、`published` 或 `ready`。
- 不將校準器接入 `game4.html`、`match-trainer.html` 或正式 MVP 主線。
- 不處理對手動畫節奏、Trainer 的輸入方式、WebM 重編或完整回合 UI。

## 4. 檔案邊界與實作前檢查

預期新增檔案：

- `prototypes/video-physics-timeline/tools/handoff-calibrator/index.html`
- `prototypes/video-physics-timeline/tools/handoff-calibrator/calibrator.js`
- `prototypes/video-physics-timeline/tools/handoff-calibrator/draft-contract.js`
- `prototypes/video-physics-timeline/tools/handoff-calibrator/draft-contract.test.js`
- 視需要新增、且僅限隔離原型使用的 projection helper 與其測試。

允許的既有讀取來源：

- `prototypes/video-physics-timeline/timeline-config.json`
- `prototypes/video-physics-timeline/prototype-physics-bridge.js`
- `prototypes/video-physics-timeline/assets/serve-real-backspin-001.mp4`
- `prototypes/video-physics-timeline/prototype-app.js`（僅為確認目前舞台裁切與投影行為）
- `prototypes/video-physics-timeline/tools/preview/anchor-picker.html`（僅為重用已驗證的 16:9 cover 裁切與點擊→UV 計算語意；不得擴張其輸出或改變本任務的單點限制）

實作前必做檢查：現有的 `worldToScreen`／舞台投影目前位於 `prototype-app.js`。若無法在**不複製投影公式、不改變既有 prototype 視覺行為**的前提下抽成小型純 helper，停止實作並回報。不得把一份近似或自行推測的投影公式複製進校準器，只為了做出 delta。

禁止修改：

- `shared-physics-core.js`
- `game4.html`
- `match-trainer.html`
- `physics-presets.json`
- `videos.json`
- 現有 `timeline-config.json` 的任何 serve 資料或 `generation_status`

## 5. 使用流程與介面限制

校準器應把主要操作限制在以下六步，且一次只讓使用者處理一件事：

1. 顯示固定素材與「探索性、不可發布」提醒。
2. 播放或逐幀移到 trigger；預設載入現有 4.300 秒值，但使用者可在 60 fps 邊界上調整草稿值。
3. 在影片舞台上點一次設定 anchor。
4. 選一個既有 profile。
5. 觀看 overlay 與 raw delta；若 delta 偏大，只顯示事實與草稿狀態，不提供偽裝用的平滑控制。
6. 儲存至本機草稿，並可匯出／匯入 JSON。

不應出現在主操作區的項目：完整 config JSON、世界座標編輯、spin 數字、event log、session ID、WebM encoder 參數、發布按鈕。若有 Inspector，必須折疊且只讀。

## 6. 草稿契約（最小）

草稿是資料交換格式，不是正式 schema 或永久資料模型。它至少要符合以下結構：

```json
{
  "schema_version": 1,
  "status": "draft",
  "source": {
    "serve_id": "real_backspin_001",
    "video_src": "./assets/serve-real-backspin-001.mp4"
  },
  "trigger": {
    "time_sec": 4.3,
    "fps": 60
  },
  "anchor_uv": { "x": 0.282, "y": 0.266 },
  "physics_profile_id": "prototype_short",
  "measurement": {
    "canvas_width_px": 960,
    "canvas_height_px": 540,
    "raw_delta_px": 0
  },
  "created_at": "ISO-8601 timestamp"
}
```

契約限制：

- `status` 在本任務只能是 `draft`。
- `serve_id` 與 `video_src` 必須固定為本任務的單一樣本。
- `time_sec * fps` 必須在容許浮點誤差內為整數。
- `anchor_uv` 兩軸均介於 0 與 1。
- `raw_delta_px` 必須為有限且不小於零的數字；數字高低不是自動發布條件。
- 匯入時任何額外發布欄位（如 `ready`、`reviewed`、`published`）都必須被拒絕或忽略，並保留 `draft`。

## 7. 驗收

### 自動驗收

- 現有三套原型測試仍通過：
  - `node prototypes/video-physics-timeline/video-physics-timeline.test.js`
  - `node prototypes/video-physics-timeline/prototype-physics-bridge.test.js`
  - `node prototypes/video-physics-timeline/tools/webm-generator.test.mjs`
- 新草稿契約測試通過：有效單一樣本草稿可接受；錯誤 serve、非 60 fps 對齊、UV 越界、負 delta 與發布狀態都被拒絕。
- 若抽取 projection helper，針對既有已知物理狀態的輸出與原 prototype 投影一致，並以單元測試鎖定。

### 人工驗收

- 開頁後清楚看見「探索性／未校準／不可發布」，不把 config 的 `ready` 解讀成完成。
- 使用者可在不開啟 JSON 編輯器的情況下完成 trigger、單點 anchor、profile 選擇與草稿保存。
- 草稿重載後，trigger、anchor、profile 與 raw delta 都一致。
- 已知 large-delta 樣本仍顯示為 large delta；畫面沒有誤導為已自然接上。
- 沒有修改正式頁面、核心、題庫或現有 config。

## 8. 失敗處理與停止線

以下任一情況發生，停止，不以替代實作繞過：

1. 不能安全重用或抽取既有投影邏輯。
2. 真實影片 metadata 與預期 duration／60 fps 前提不一致，且無現有明確資料可支持新的時間語意。
3. 需要為了匯出草稿而寫入 repo 或變更現有 config。
4. 發現校準器需求必須從多影格推導速度，才能宣稱它有用。
5. 需求擴大到第二支影片、發布流程、Trainer、動畫編排或物理參數調整。

停止時只回報：阻塞原因、受影響的範圍、可供使用者選擇的最小下一步；不自行展開新方案。

## 9. 實作完成後的交接格式

完成時應提供：

- 修改檔案清單與各檔責任。
- 現有測試與新測試的結果。
- 人工驗收逐項結果，尤其是 `ready` 例外提示與 known large-delta 顯示。
- 一份 checkpoint，明確說明：工具只產生草稿、未校準影片未發布、未改核心／正式主線。
- 任何想進入 Phase 2 或 Trainer 的提議必須另開計畫與審查，不能因本任務完成而自動開始。
