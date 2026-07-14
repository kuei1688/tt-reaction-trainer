# CHECKPOINT：真實影片接上 physics handoff 的探索性實驗

日期：2026-07-11

## 結果

在隔離原型中試驗「把題庫既有真人發球影片接上 physics handoff」是否可行。這是**單支影片的探索性實驗**，不是正式校準，也不是主線整合；`generation_status` 已為此實驗直接設為 `"ready"`，**尚未經過使用者對照 `SPEC.md` §8 清單做正式簽核**，需要使用者知情。

本輪全部改動由 Claude 在本次對話中直接執行（Edit／Write），不是透過 Codex 交接。

## 具體改動

### 1. 修正 Δ 指標顯示 bug

`prototype-app.js` 的 `PhysicsAdapter.startServe()` 原本把 `overlayDeltaPx` 寫死為 `0`，從未依實際 `handoffOffset` 計算，導致介面上的 overlay delta 永遠顯示 `0.0 px`（不論實際銜接誤差多大）。已修正為 `Math.hypot(this.handoffOffset.x, this.handoffOffset.y)`。

**這修正了 `AI_CONTEXT/CHECKPOINT_VIDEO_PHYSICS_BRIDGE.md` 中記錄的「Overlay handoff delta：0.0 px」——那是顯示層 bug 造成的假象，不是真的零誤差。** 該檔案其餘驗證結果（frame 對齊、shared-core 物理積分、事件序列）不受影響。

### 2. 新增真實影片 serve：`real_backspin_001`

- 來源：`images/contact_backspin/contact_backspin_001.mp4`（`videos.json` 題庫既有素材，`reviewStatus: "approved"`），複製為 `prototypes/video-physics-timeline/assets/serve-real-backspin-001.mp4`。
- 影片實測規格：540×682、60fps、275 frames、時長 4.583333s（= 275/60，已對齊 frame 邊界，避免破壞 `generate-webm.mjs` 的 `loadProject()` 對 config 內每一筆 serve 的強制驗證）。
- 觸球時間：逐幀視覺判讀定為 frame 258 = 4.300s。
- `video_anchor_uv`：以相同判讀方式定為 `(0.282, 0.266)`（16:9 cover 裁切後的舞台座標，非原始直式影片像素座標）；後續以 `anchor-picker.html` 重新點擊驗證得 `(0.2817, 0.2647)`，誤差 <0.002，一致。
- `physics` 參數：直接整組沿用 `prototype_short`（`position_m`／`velocity_mps`／`spin_rps` 等），**未針對這支影片重新校準**。
- `generation_status` 直接設為 `"ready"`（非 `pending_generation`）。

### 3. 全鏈路驗證

用自訂 Node 腳本（未納入正式測試套件，僅本輪驗收使用）以 60fps 媒體時鐘驅動 `timeline-engine.js` + `prototype-physics-bridge.js`：

- `VIDEO_TRIGGER_REACHED` 恰好觸發一次，精準於媒體時間 4.300s。
- `video_anchor_uv` 正確傳給 `START_PHYSICS_SERVE` effect。
- 物理球彈桌一次後、於 trigger 後 0.492s 進入 hit window（未過網是因 SPEC §6 定義的 handoff 初始狀態本就位於過網後，屬預期）。

### 4. 發現但尚未修正的落差

trigger 瞬間 anchor 與物理投影的 Δ 約 349–382px（960×540 canvas）。原因：`physics` 參數整組沿用自「過網後」的合成軌跡設定，並非針對這支影片的實際觸球出手點校準；`handoff.duration_sec` 僅 0.15s，落差在這麼短時間內收斂，畫面上會看到球明顯瞬移，而非自然接續。

**尚未修正**，建議下一步方向：把 `initial_ball_state.position_m` 改到觸球點附近（而非過網後），而不是拉長 `handoff.duration_sec` 用視覺模糊蓋掉落差。

### 5. 新增真實影片 Anchor 選點器

`tools/preview/anchor-picker.html`：獨立單檔小工具，不需伺服器（`file://` 雙擊即可開啟），讓使用者直接在真實影片畫面上點擊球的位置取得 `video_anchor_uv`，畫布裁切邏輯（16:9、object-fit: cover）與正式舞台一致，避免手動換算出錯。已用已知正確座標做端到端驗證：工具回算值與已知值誤差 <0.002。同時提供 fps 對齊 snap（避免產出破壞 `generate-webm.mjs` 驗證的非 frame 邊界時間值）。

### 6. 確認真實影片的播放行為

以時間驅動的即時模擬觀察：真實 `<video>` 會自然播到自身結尾，過程中沒有任何程式碼中斷或暫停它；trigger 之後 video 元素仍持續播放，物理球疊加在畫面上方。影片播畢後，物理／對手序列在 engine 自己的時間軸上繼續推進，不受影片已結束影響。

**重要限制**：這支素材本身觸球後只剩 0.283 秒畫面（4.583s 總長 − 4.300s trigger），這是素材長度限制，不是程式行為。Trainer 裡「球飛過去、對手回球」看到的動畫，全部是物理模擬與通用 SVG 姿勢（`opponent-prep.svg`／`opponent-counter.svg`），**不是這支影片的真實延續畫面**。

## 驗證

- `node video-physics-timeline.test.js`：18/18 通過（含新 serve 的 schema 驗證）。
- `node prototype-physics-bridge.test.js`：8/8 通過。
- `node tools/generate-webm.mjs --check --serve prototype_short`：通過，確認即使 config 混入真實影片 serve，只要 frame 對齊，合成 serve 仍可正常驗證（**但 `--all`／`--check` 不指定 `--serve` 時會對 config 內每筆 serve 做 `getFramePlan` 驗證，尚未測試混入未對齊真實 serve 時的失敗訊息是否清楚**）。
- Node 全鏈路模擬：見上方「3. 全鏈路驗證」。
- `anchor-picker.html` 端到端座標驗證：回算誤差 <0.002。
- 瀏覽器即時驗收：headless 分頁的 `requestAnimationFrame` 被 Chromium 暫停（非焦點分頁），已用臨時 RAF-shim 檔案觀察後刪除，未留在版控中。

## 停止線 / 未完成事項

- 依 `SPEC.md` §8，「兩支 WebM 的 trigger ±0.05 秒、瀏覽器解碼與 crossfade 畫面品質」在 `pending_generation` 時明訂為「未驗收」。本輪對 `real_backspin_001` 做的是**程式邏輯層與座標數學驗證**，不是 SPEC 定義的正式人工瀏覽器驗收（沒有做真人目視 crossfade 品質判斷）。`generation_status: "ready"` 是配合本次探索性實驗的操作性設定，需要使用者知情並決定是否照 SPEC §8 補做正式驗收。
- handoff Δ 349–382px 尚未修正，physics 參數尚未針對真實影片校準（見上方第 4 點）。
- 目前只完成一支題庫影片（`contact_backspin/001`）的實驗；`videos.json` 其餘約 50 支尚未處理。
- `assets/serve-real-backspin-001.mp4` 是真實賽事畫面的複製（來源 `images/contact_backspin/contact_backspin_001.mp4`），不是本原型新造的合成素材，與 `assets/README.md` 原先「只放新造素材」的描述不同，已在該檔補充說明。
- 未修改：`shared-physics-core.js`、`game4.html`、`match-trainer.html`、`videos.json`、`physics-presets.json`。
