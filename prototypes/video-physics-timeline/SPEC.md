# 隔離式影片—物理時間軸編排原型規格

## 1. 定位與停止線

本原型驗證影片時鐘、狀態機、事件、隔離物理 bridge 及對手動畫之間的編排。Bridge 以唯讀方式載入 `shared-physics-core.js` 的球桌／球網常數與含旋轉桌面反彈函式，但不修改核心、不接入 `game4.html` 或 `match-trainer.html`，也不讀取 `physics-presets.json`、`videos.json` 或正式媒體。

原型逐幀積分沿用正式工具的 1/120 秒重力、過網與碰桌判定，桌面反彈直接呼叫 shared core；這只證明共用核心與逐支初始狀態可以在隔離 adapter 中運作，不代表發球參數已校準或主線整合完成。達成本文件的驗收後即停止；接回主線需另外評估。

## 2. 目前媒體限制

`assets/serve-short.webm` 與 `assets/serve-long.webm` 已由 `tools/generate-webm.mjs` 依設定逐幀產生並通過檔案層驗證；產製方式、編碼參數與驗證結果記錄於工具設定及 `assets/webm-generation-report.json`。

目前 `generation_status` 仍刻意保留為 `pending_generation`，所以頁面繼續使用程序化媒體時鐘；工具驗證可以證明 VP9、duration、fps、frame 數、trigger 質心與解碼內容確定性，但不能代替 `<video>` 的 `currentTime` 誤差、瀏覽器解碼相容性及實際交接畫面驗收。

只有完成 localhost 真實 `<video>` 驗收並由人明確把 `generation_status` 改成 `ready` 後，runtime 才能停止使用 fallback；產生器不得自動修改這個狀態。

2026-07-11 補充：`tools/preview/anchor-picker.html` 新增了一個離線小工具，可直接在真實影片畫面上點擊取得 `video_anchor_uv`，畫面裁切邏輯與正式舞台一致。`timeline-config.json` 也新增一筆實驗性 serve（`real_backspin_001`），直接引用複製自既有題庫的真實 mp4（非本原型新造素材）並把 `generation_status` 設為 `ready`，用來測試「影片 trigger 時間點能否正確驅動 physics handoff」。這是探索性實驗，只做了程式邏輯層與座標數學驗證，**不構成**本節與第 8 節定義的正式真實 `<video>` 瀏覽器驗收；trigger `±0.05 秒`與 crossfade 畫面品質仍須由人明確驗收後才能視為通過。詳見 `AI_CONTEXT/CHECKPOINT_REAL_VIDEO_HANDOFF_EXPERIMENT.md`。

## 3. 檔案邊界

WebM 產製的確定性策略採「解碼內容確定」：固定 RGB frame 與單執行緒 VP9 參數並比較解碼後 frame hash，但不承諾不同 FFmpeg 版本產生位元完全相同的 WebM 容器。

影片時間碼由 Node renderer 內建的 5×7 bitmap font 直接畫入 RGB frame，不使用 FFmpeg `drawtext` 或系統字型。

Trigger 質心驗證會由 FFmpeg 解出指定 frame，在 anchor 周圍 ROI 以唯一球色做 RGB threshold 後計算像素質心，與設定投影的誤差必須不超過 1 px。

- `index.html`：獨立原型 UI。
- `timeline-engine.js`：無 DOM、無計時器的狀態機核心，瀏覽器與 Node 共用。
- `prototype-physics-bridge.js`：組合 shared core 與固定步進、過網、碰桌及 hit-window 事件的隔離 bridge。
- `prototype-app.js`：媒體、Canvas、對手圖、世界座標投影與 bridge adapter。
- `timeline-config.json`：原型專用設定。
- `video-physics-timeline.test.js`：Node 自動測試。
- `prototype-physics-bridge.test.js`：shared core、發球初始狀態、球網／桌面碰撞與 hit-window 測試。
- `assets/`：原型專用合成或示意素材；不得引用正式媒體。
- `tools/`：可重現的 RGB frame renderer、WebM 編碼器、驗證器與工具測試。

## 4. 狀態、事件與合法轉移

| 狀態 | 接受事件／條件 | 下一狀態 | 副作用 |
|---|---|---|---|
| `IDLE` | `START` | `SERVE_VIDEO` | 啟動所選媒體 adapter |
| `SERVE_VIDEO` | media time 首次跨過 trigger | `PHYSICS_SERVE` | 記錄 `VIDEO_TRIGGER_REACHED`、以設定初始狀態啟動 shared-core bridge |
| `PHYSICS_SERVE` | `BALL_ENTERED_HIT_WINDOW` | `AWAIT_PLAYER_HIT` | 開放 Hit |
| `AWAIT_PLAYER_HIT` | 首次 `PLAYER_HIT` | `OPPONENT_SEQUENCE/PREP` | 啟動玩家回球與對手預備動作 |
| `OPPONENT_SEQUENCE/PREP` | monotonic elapsed ≥ `prep_duration_sec` | `COUNTER_DELAY` | 記錄 `PREP_FINISHED` |
| `OPPONENT_SEQUENCE/COUNTER_DELAY` | monotonic elapsed ≥ `counter_delay_sec` | `COUNTER_RETURN` | 依序記錄 `COUNTER_DELAY_FINISHED`、`COUNTER_CONTACT`，啟動對手回球 |
| `OPPONENT_SEQUENCE/COUNTER_RETURN` | `RALLY_COMPLETE` | `COMPLETE` | 結束本輪 |
| 任一活動狀態 | `RESET` | `IDLE` | 增加 session，舊 callback 全部失效 |
| 載入／設定驗證 | `CONFIG_ERROR` | `ERROR` | 顯示錯誤，不套用預設值 |

未列出的事件一律忽略並回傳 `false`。特別是：沒有 `PLAYER_HIT` 時必須永久停在 `AWAIT_PLAYER_HIT`；重複 Hit、trigger、contact 與完成事件不得產生第二次轉移。

## 5. 時間語意

- Phase 1 只讀 media adapter 提供的 `currentTime`。trigger 的判斷是 `currentTime >= physics_trigger_time_sec`，所以即使 seek 或掉幀直接跨越，也只觸發一次。
- Phase 4 只讀呼叫端提供的 monotonic `nowMs`；核心不使用 `Date.now()` 或 `setTimeout()`。
- `prep_duration_sec` 從接受 `PLAYER_HIT` 的同一 monotonic 時刻起算。
- `counter_delay_sec` 從 `PREP_FINISHED` 時刻起算。
- `counter_contact_time = player_hit_time + prep_duration_sec + counter_delay_sec`。
- `RALLY_COMPLETE` 由 adapter 的回球事件發出，不寫死在核心時間軸。

每次 Start／Reset 都會建立新的 session ID。adapter callback 必須攜帶建立時捕捉的 session ID；與目前 session 不符的 callback 無效。

## 6. 設定契約

- `schema_version` 目前只支援 `1`。
- serve ID 必須唯一。
- 所有時間為有限且不小於零的數字；trigger 必須小於 `expected_duration_sec`。
- handoff anchor 的 `x`、`y` 介於 0 與 1。
- position、velocity、spin 必須各有有限的 `x`、`y`、`z`。
- `gravity_mps2` 必須是有限負數；`hit_window_z_m` 必須是有限數字。
- 世界座標採 `x` 左右、`y` 高度、`z` 由發球方指向接球方；`spin_rps.z` 映射為 topspin、`spin_rps.y` 映射為 sidespin、`spin_rps.x` 保留為 axial spin。
- 目前兩組 handoff 初始狀態都位於過網後、接球方第一次落桌前；正常流程應各觸發一次 shared-core 桌面反彈後再進 hit window。
- `left`、`center`、`right` 都必須有完整 response。
- 媒體與姿勢素材路徑只能是 `./assets/` 下的相對路徑，不得包含 `..`，不得引用 `videos.json`、`images/` 或正式 HTML。
- `generation_status` 只能是 `pending_generation` 或 `ready`。`pending_generation` 必須提供 `procedural_fallback`；`ready` 必須由瀏覽器 metadata 再驗證 trigger 小於實際 duration。
- 任何驗證失敗都必須進入 `ERROR`，不得補預設值。

## 7. Adapter 契約

媒體 adapter 提供 `load(serve)`、`start(sessionId)`、`reset()`、`tick(nowMs)` 與唯讀 `currentTimeSec`。當 WebM 尚未啟用時，程序化 adapter 依 `expected_duration_sec` 推進時鐘；它必須在 UI 明示程序化媒體模式。

物理 adapter 接受 handoff anchor、position、velocity、spin、gravity 與 hit-window；第一個物理 frame 以畫面 offset 對齊影片 anchor，handoff 結束時回到真正世界投影。固定步進會產生 `NET_CROSSED`、`NET_HIT`、`TABLE_BOUNCE` 等內部事件，並向狀態機發出 `BALL_ENTERED_HIT_WINDOW` 及 `RALLY_COMPLETE`。

Canvas 採接球方視角：遠端桌邊位於畫面上方且較窄，近端桌邊位於下方且較寬，球網位於 `z=0` 的桌面中央並顯示網高與網格。

## 8. 驗收

執行：

```text
node prototypes/video-physics-timeline/video-physics-timeline.test.js
node prototypes/video-physics-timeline/prototype-physics-bridge.test.js
```

自動測試必須涵蓋兩支影片的不同 trigger、跳時跨越、單次 trigger、無 Hit 停留、三方向設定、prep／delay 順序、單次 contact、Reset session 隔離、缺欄位、負數、未知方向、重複 ID、正式路徑阻擋，以及兩組發球參數各自落桌一次後抵達 hit window、低球撞網與含旋轉桌面反彈。

程序化瀏覽器驗收必須確認 Start、Hit、Reset、事件紀錄、兩個 serve 與三方向可操作，handoff 投影差距不超過 8 px，連續 Reset／重播沒有 console error。

以下項目在 `generation_status` 仍為 `pending_generation` 時必須維持「未驗收」，不得以檔案層或替代模式冒充通過：真實 `<video>` metadata、兩支 WebM 的 trigger `±0.05 秒`、瀏覽器解碼與 crossfade 畫面品質。

## 9. WebM 產製工具

```text
node prototypes/video-physics-timeline/tools/generate-webm.mjs --doctor
node prototypes/video-physics-timeline/tools/generate-webm.mjs --all
node prototypes/video-physics-timeline/tools/generate-webm.mjs --all --force
node prototypes/video-physics-timeline/tools/generate-webm.mjs --check
node prototypes/video-physics-timeline/tools/verify-webm.mjs --all
node prototypes/video-physics-timeline/tools/webm-generator.test.mjs
```

`--doctor` 只檢查 FFmpeg／FFprobe；產生器預設不覆寫既有輸出，`--force` 才會以暫存檔及備份交換方式重建；`--check` 與獨立 verifier 都是純讀驗證，不改寫影片或 report。

產生器直接使用 `timeline-config.json` 的 duration、trigger、start UV、anchor UV 與 handoff duration，`webm-render-settings.json` 只定義 raster、顏色與 codec，避免時間語意有第二份來源；產生完成也不會自動把 `generation_status` 升級為 `ready`。
