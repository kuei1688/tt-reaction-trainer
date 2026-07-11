# CHECKPOINT：WebM 軌跡視覺化預覽器

日期：2026-07-11

## 結果

已在 `tools/preview/` 建置 WebM 軌跡視覺化預覽器，讓開發者調整程序化合成 serve 的軌跡參數時不必每次重編 WebM。實作依據 `AI_CONTEXT/PLAN_WEBM_PREVIEW_TOOL.md`（修訂版計畫書；原始計畫審查時發現三個問題已修正：座標數學來源誤植為 `generate-webm.mjs`、CORS 降級會靜默改用過時預設值、缺少畫布拖曳等直覺調整手段）。

實作由 Codex 執行；本檔記錄 Claude 在同一輪對話中對實作結果的驗收。

## 新增／修改檔案

- `tools/webm-frame-math.mjs`（新增）：從 `webm-core.mjs` 抽出的瀏覽器相容純數學模組（`getFramePlan`、`getBallPose`、`formatTimecode` 等），是預覽器與產生器共用的單一數學來源。
- `tools/webm-core.mjs`（修改）：改為 `import` + re-export `webm-frame-math.mjs`，對 `generate-webm.mjs`／`verify-webm.mjs` 完全透明，不改變既有行為。
- `tools/preview/index.html`、`tools/preview/preview.js`（新增）：可拖曳的軌跡預覽 UI，含 serve 切換、frame 對齊驗證與 snap、時間軸 trigger／handoff 標記、JSON 匯入匯出。

## Claude 驗收結果

- `node --test tools/webm-generator.test.mjs`：11/11 通過（拆模組後行為未變的回歸保證）。
- `node tools/generate-webm.mjs --check`：對既有 `serve-short.webm`／`serve-long.webm` 通過，質心誤差 0.2162px／0.1912px，與拆模組前一致。
- 瀏覽器實測（`node -m http.server` 起服務後開 `tools/preview/`）：
  - serve 切換正確（短版 120 frames trigger 75；長版 192 frames trigger 126）。
  - 把 `physics_trigger_time_sec` 改成非 frame 邊界值（如 1.23）時，UI 立即吸附到最近的 60fps frame 邊界並提示，不會產出會被產生器拒收的參數。
  - 在畫布上拖曳 anchor 十字準星，數值欄位與底部 JSON 即時同步。
  - 匯出 JSON 與磁碟上 `timeline-config.json` 深度比對（`JSON.stringify` 後）內容相同。
  - 播放動畫（`requestAnimationFrame` 時間驅動）留待人工在正常瀏覽器分頁確認——自動化分頁因非焦點狀態被 Chromium 暫停 rAF，這是環境限制，不是工具問題。
- 閉環驗證：貼上匯出的 JSON 覆蓋 `timeline-config.json` 後執行 `generate-webm.mjs --all --force` 重新編譯，兩支影片的 decoded-frame SHA-256（`33b83d79...`／`96d58140...`）與拆模組前完全相同——證明抽出共用數學模組沒有改變任何一個像素。

## 停止線

預覽器只操作程序化合成 serve（`prototype_short`／`prototype_long`）的軌跡參數，不涉及真實影片。不改變 WebM 產生器的確定性契約（decoded-content、單執行緒 VP9、bitmap 時間碼）。真實影片的座標選取是另一條路徑，見 `AI_CONTEXT/CHECKPOINT_REAL_VIDEO_HANDOFF_EXPERIMENT.md`。
