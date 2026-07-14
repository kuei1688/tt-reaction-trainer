# 方向 C 影片標註器——實作計畫與狀態記錄

> 狀態：**Phase 1、Phase 2 已完成；隔離 prototype，未接入正式 Trainer**
> 日期：2026-07-12
> 前情：方向 C 視覺實驗已完成，C3 為目前 prototype 首選（見 `prototypes/video-physics-timeline/direction-c/RESULT.md`）。WebM 合成產生器與座標連續路線已決定不再投入。

## Phase 1 完成記錄（2026-07-12）

Phase 1 已在 `prototypes/video-physics-timeline/tools/direction-c-annotator/` 完成，固定服務 `real_backspin_001`，不會修改任何主線資料或設定檔。

- `annotation-contract.js` 鎖定 `draft` schema、單一來源影片、`prototype_short` 與 `pending_coach`；拒絕 `generation_status` 等不屬於草稿的欄位。
- 標註頁提供逐幀、播放、scrub、鍵盤快捷鍵、觸球／觀察結束時間欄位、JSON 複製與來源專屬 localStorage 草稿。
- 行動版舞台採 Direction C 的 9:16 層次：影片卡片在上方，球桌從下方開始；兩者不以桌面疊住影片。此為產品呈現 prototype，不是校準或物理連續性的證明。
- 已通過 `annotation-contract.test.js`、`projection-helper.test.js`、`direction-c-engine.test.js`、`entry-drag-controller.test.js`、`prototype-physics-bridge.test.js` 與 `mobile-layout.test.js`。

## Phase 2 完成記錄（2026-07-12）

Phase 2 已完成，重點是「真實物理預覽」與「影片來源自由選取」：

- **影片來源自由選取**：新增本機影片檔選擇（借回母體 anchor-picker 的設計），檔案只在瀏覽器內以 object URL 處理、不上傳。`annotation-contract.js` 的 `source_video` 由固定值改為任意非空檔名（≤200 字元），`DEFAULT_SOURCE_VIDEO` 仍指向內建 `real_backspin_001` 樣本作為預設來源。草稿 localStorage key 依來源檔名分開，換檔自動載回同名草稿（計畫第 5 節「續存」）。
- **C3 預覽接真實狀態流與真實物理**：預覽改用 `direction-c-engine.js` 的 `Experiment` 逐幀 tick（OBSERVING → 觸球 → OVERLAP 淡出 → TRAINING → COMPLETE，與 direction-c 頁面同一狀態機）；訓練球在 OVERLAP 起點以 `prototype-physics-bridge.js` 真跑物理，從入射點反投影的世界座標出發，速度／旋轉／重力沿用 profile，起始高度 y 沿用 profile 的 `position_m.y`。
- **幾何一致性**：舞台版面常數抽到 `preview-runtime.js`（UMD 純邏輯模組），`drawTable()`、`worldToScreen`、`screenToWorld` 全部共用同一組 `MOBILE_TABLE_LAYOUT`；`preview-runtime.test.js` 驗證桌面反彈點必落在畫出來的桌面梯形內（「球會落在畫出來的桌面上」的驗收判準）。
- 新增／更新測試：`preview-runtime.test.js`（6 項）、`annotation-contract.test.js`（自由來源）、`mobile-layout.test.js`（改讀 runtime 常數）；連同既有 `projection-helper`、`prototype-physics-bridge`、`direction-c-engine`、`entry-drag-controller` 測試全數通過。

任何 Trainer 整合、題庫寫回或物理參數調整仍須另行討論。

## 1. 為什麼要做這個工具

方向 C 之下，每支真人影片要能進入「觀察 → 觸球 → 影片層退場 → 訓練球入場」的流程，需要的不再是 anchor 座標校準，而是三項標註資料：

1. **觸球時間**（`physics_trigger_time_sec`）——影片層切換／C3 淡出重疊的起點。
2. **收拍觀察結束時間**——影片層完全讓位給桌面的時刻。
3. **球路入口位置**——訓練球在接球者桌面上的固定入口（方向 C 的產品語意，不是影片球位置）。

目前這些值散落在 `timeline-config.json` 手填欄位與 direction-c 頁面的 localStorage 裡。若未來要對多支教練篩選影片做標註，需要一個統一、可離線、可匯出草稿的標註工具。

## 2. 改造母體：真實影片 Anchor 選點器

母體是 `prototypes/video-physics-timeline/tools/preview/anchor-picker.html`。它的 UI 操作性已被驗證是好用的，改造時**保留**：

- 本機選擇影片檔、純瀏覽器離線運作（`file://` 雙擊可開，不需伺服器）。
- 逐格前後退（−1 / +1 frame）、播放暫停、scrub 拉桿、時間讀數。
- fps 欄位與「時間吸附到影格邊界」邏輯。
- 右側欄位即時同步 → 可複製 JSON 片段的輸出區。

**移除**（皆屬已放棄的座標連續前提）：

- 畫面點選 `video_anchor_uv` 與十字 marker。
- `handoff.mode: "crossfade"`、`handoff.duration_sec` 欄位。
- 輸出說明中「貼回 serve.video、設 `generation_status: "ready"`」的指引（ready 語意曾造成誤解，新工具輸出一律是 draft）。

另一個舊工具 `tools/handoff-calibrator/` 不作為母體（它的核心是 anchor 與物理投影的 delta 量測，前提已取消），但**借用**它兩個好設計：匯入既有 draft JSON 的入口、以及「僅限草稿、不寫 repo」的邊界宣告方式。

## 3. 新工具定位與檔案位置

- 名稱：**方向 C 影片標註器**（Direction C video annotator）。
- 位置：`prototypes/video-physics-timeline/tools/direction-c-annotator/`（新資料夾）。
  - `index.html` — 頁面與樣式（沿用 anchor-picker 的深色版型）。
  - `annotation-contract.js` — 純邏輯模組：欄位驗證、fps 吸附、草稿 schema 組裝（UMD 包裝，仿 `direction-c-engine.js`）。
  - `annotation-contract.test.js` — node 直跑測試（仿 `entry-drag-controller.test.js` 模式）。
  - `annotator-app.js` — DOM 接線。
- 舊檔處理：`anchor-picker.html`、`handoff-calibrator/` 原地保留不動，屬 WebM／連續路線的封存件；不刪除、不再投入。

## 4. 輸出 schema（草稿）

```json
{
  "annotation_status": "draft",
  "source_video": "contact_backspin/contact_backspin_001.mp4",
  "fps": 60,
  "contact_time_sec": 1.283,
  "observation_end_sec": 1.75,
  "entry_position": { "x": 0.313, "y": 0.11 },
  "spin_note": "backspin（繼承自影片，僅備註，不由本工具判定）",
  "preview_profile_id": "prototype_short",
  "allowed_variants_draft": {
    "length": ["short"],
    "placement": [],
    "speed": [],
    "review_status": "pending_coach"
  }
}
```

設計說明：

- `contact_time_sec` / `observation_end_sec` 直接對應 `direction-c-engine.js` 的 `Experiment(triggerTimeSec, observationEndTimeSec)` 建構參數；engine 已強制 `observation_end > contact`，工具端做同樣驗證。
- 現行 direction-c 頁面把 `expected_duration_sec`（影片總長）當作觀察結束時間用；新 schema 改為獨立的 `observation_end_sec`，因為收拍觀察可以在影片檔結束前就讓位。這是本計畫的一項明確 schema 決策。
- `preview_profile_id` 記錄標註時用哪個 `timeline-config.json` profile 做過物理預覽（見第 5 節），僅供追溯，不代表該 profile 已通過內容審查。
- `allowed_variants_draft` 只是給教練審查的草稿欄，`review_status` 固定產出 `pending_coach`；本工具**沒有**核准變體的權限。
- 沒有 `generation_status` 欄位、沒有 anchor 欄位；輸出不宣稱任何校準或物理連續。
- `source_video`（Phase 2 起）為標註者所選本機影片的檔名，任意非空字串（≤200 字元）；工具不驗證檔案內容，教練審核時以檔名對回原始影片。

## 5. UI 設計（操作性要求，參考方向 C 頁面）

### 版面

三區塊，桌機雙欄、窄螢幕縱向堆疊（沿用 anchor-picker 的 grid + direction-c 的 mobile 版型思路）：

1. **影片舞台**（左上）：選檔、播放、逐格、scrub。scrub 軌道上疊一條**分段色帶**：觸球前（觀察期）、觸球—收拍結束（follow-through / C3 重疊期）、之後（已讓位）。兩個標記點直接畫在軌道上，一眼看出目前標到哪。
2. **桌面預覽**（左下）：重用 direction-c 的 `drawTable()` 畫法與**可拖曳球路入口**。入口拖曳直接引用既有 `direction-c/entry-drag-controller.js`（已有測試），但事件接線改用 Pointer Events 以同時支援滑鼠與觸控——未來標註者可能在手機或平板上核對。
3. **標註與輸出欄**（右）：時間欄位、變體草稿勾選、JSON 輸出與複製、draft 匯入／匯出。

### 關鍵互動

- **兩顆標記鍵**：「⏺ 設為觸球時間」「⏹ 設為收拍結束」，都取目前播放時間並做 fps 吸附；數字欄可手動微調（沿用 anchor-picker 的雙向同步）。
- **鍵盤操作**：`Space` 播放／暫停、`←`/`→` 逐格、`Shift+←`/`Shift+→` 跳 10 格、`T` 標觸球、`E` 標收拍結束。逐格找觸球瞬間是本工具最高頻操作，必須不用滑鼠也能完成。
- **一鍵預覽（接真實發球參數）**：「▶ 用目前標註預覽 C3」——切鏡節奏用 `direction-c-engine.js` 的 `Experiment` 狀態機，訓練球**不用假動畫**，改用 `prototype-physics-bridge.js` 以選定 profile 的 `initial_ball_state` + `gravity_mps2` 真跑物理，並以 `projection-helper.js` 的 `worldToScreen` 投到桌面預覽。標註者當場用真實球速節奏驗證觸球／收拍時間標得對不對。C1／C2 不需提供（RESULT.md 已選定 C3；若日後翻案再加）。
- **Profile 選擇**：下拉選單列出 `timeline-config.json` 現有 profile（初期只有 `prototype_short` 等），**只能選、不能編輯任何物理數值**。不接 `physics-presets.json`——格式不同且會誤示正式 preset 已通過方向 C 檢驗；日後要接另案討論。
- **入口決定物理起點**：球路入口的螢幕 UV 反投影回世界座標 x/z（起始高度 y 沿用 profile），速度、旋轉、重力沿用 profile——入口是方向 C 的固定產品語意，profile 的 `position_m` 在預覽時被入口覆蓋。需在 `projection-helper.js` 補一個 `screenToWorld` 反投影（純數學，含測試）。拖動入口即可看出哪些入口位置與該 profile 相容。
- **防呆**：未選影片→全部停用；未標觸球→預覽與輸出停用；`observation_end ≤ contact` →欄位標紅並拒絕輸出（與 engine 的建構檢查一致）；fps 改動後自動重新吸附兩個時間。
- **續存**：標註草稿存 localStorage（key 仿 direction-c 的 `video-physics-direction-c:entry-position:v1` 命名慣例，例如 `direction-c-annotator:draft:<檔名>:v1`），換影片檔自動載回同名草稿；另提供匯出／匯入 JSON 檔（借 handoff-calibrator 的設計）。

## 6. 分階段實作

| 階段 | 內容 | 完成判準 |
|---|---|---|
| Phase 1 | **已完成（2026-07-12）**：建立新資料夾與 `annotation-contract.js`；移除 anchor／crossfade；加入雙時間標記、逐幀／scrub、鍵盤操作、新 schema 輸出與 localStorage 續存 | 契約與既有 prototype 測試通過；輸出固定為完整 draft JSON，無 `generation_status` 或 anchor 欄位 |
| Phase 2 | **已完成（2026-07-12）**：`preview-runtime.js` 抽出幾何與物理預覽核心；C3 預覽改用 Experiment 逐幀 tick＋bridge 真實物理；影片來源開放本機自由選檔，`source_video` 改為任意檔名、草稿依來源分開續存 | 拖曳入口後訓練球以 profile 真實物理從新入口出發；桌面繪製幾何與投影幾何一致（球會落在畫出來的桌面上）；預覽狀態流與 direction-c 頁面一致 |
| Phase 3 | 變體草稿欄（長短／落點／速度勾選）＋ draft 匯入匯出 | 匯出再匯入後所有欄位還原；`review_status` 恆為 `pending_coach` |

每階段獨立可用；Phase 1 完成即已取代手算時間的現況，Phase 2/3 視需要再排。

## 7. 測試方式

- `annotation-contract.js` 為純函式模組：fps 吸附、時間順序驗證、schema 組裝、localStorage key 生成，全部進 `annotation-contract.test.js`（node 直跑，零依賴，同 repo 既有測試慣例）。
- 拖曳邏輯不重寫、不另測——直接依賴 `entry-drag-controller.js` 與其既有測試。
- `screenToWorld` 反投影加進 `projection-helper.test.js`：對數個世界座標驗證 `screenToWorld(worldToScreen(p)) ≈ p` 的往返一致性。
- 物理模擬本身不另測——`prototype-physics-bridge.test.js` 已覆蓋；標註器只是呼叫端。
- DOM 接線層以手動檢查清單驗收（載檔、逐格、標記、預覽、複製、續存各走一遍）。

## 8. 後續構想（不在本計畫範圍，Phase 1/2 完成後再議）

- **桌面反彈音效**：影片音軌是重製混音（常帶背景音樂），不可用；發球擊球聲本來就幾乎聽不見。可聽的節奏線索是**球落桌反彈聲**。Phase 2 預覽（與日後產品）可在 `prototype-physics-bridge` 的 `TABLE_BOUNCE` 事件掛一個獨立音效檔；若用於比較實驗，音效在各條件間必須完全相同，避免成為混淆變因。已查過的現成資源（2026-07-12，皆未實際下載試聽，選用前需人耳確認質感）：
  - **BigSoundBank「Ping pong ball bounce」#1–#4 四個變體**（bigsoundbank.com，音效編號 s2236–s2239）：**CC0 授權**、不用註冊、可商用，授權最乾淨，列為首選。
  - **Pixabay 音效庫**（pixabay.com/sound-effects/search/ping-pong/）：免授權、免標示出處，選擇多。
  - **ZapSplat**（zapsplat.com，搜「table tennis ping pong ball single bounce」）：有單次落桌反彈的專門音效，但需要免費帳號。
  - **自錄**：拿手機錄一顆球實際落桌的聲音，零授權風險，也最貼近訓練場景的質感。
- **自動粗標觸球時間**：做成獨立離線腳本（vision API 逐格粗掃＋細掃），輸出 draft JSON，經由本工具的「匯入 draft」入口載入後**人工逐格微調**——標註器本身維持離線、不接 API。先在少量已有人工真值的影片上試測誤差（目標 ±1–3 frame @60fps），再決定要不要量產。批次管理殼屬同一波討論。

## 9. 非目標與停止線

- 不寫入 `videos.json`、`timeline-config.json`、`physics-presets.json` 或任何紅線檔案；本工具只產出可複製／可下載的 draft JSON，貼回設定檔是人的決定。
- 不判定旋轉、不核准變體、不宣稱校準或物理連續；輸出一律帶 `annotation_status: "draft"` 與 `review_status: "pending_coach"`。
- 不提供任何物理參數編輯 UI；profile 只能從 `timeline-config.json` 現有項目選用。若預覽軌跡不理想，該回饋給 profile 的維護流程，不在標註器裡調參——本工具不是第二個 physics-studio。
- 不直接讀取或轉換 `physics-presets.json`；正式 preset 要進標註器預覽屬另案。
- 不接入正式 Trainer、不處理批次題庫匯入；那是紅線討論之後的事。
- 不復活 WebM 產生器或 anchor 量測；若有人需要舊功能，去封存的原檔，不加回新工具。
