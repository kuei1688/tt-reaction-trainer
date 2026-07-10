# CHECKPOINT：隔離原型 WebM 資產編譯器

日期：2026-07-10

## 結果

已在 `prototypes/video-physics-timeline/tools/` 完成可重現的 WebM 資產編譯器、純讀 verifier、render settings 與工具測試，並實際產生兩支原型專用 VP9 WebM。

這仍是隔離原型資產，不是正式影片、正式物理或主線整合。

## 三項決策

- 確定性採 decoded-content：固定 RGB frames、單執行緒 VP9 設定與 decoded-frame hash；不承諾跨 FFmpeg 版本的 container bitexact。
- 時間碼由 Node 內建 5×7 bitmap font rasterize，不使用 `drawtext` 或系統字型。
- 質心以 FFmpeg 解出的 trigger RGB frame，在 anchor ROI 依唯一球色 threshold 後計算，允許誤差 ≤1 px。

## 工具與產物

- `tools/generate-webm.mjs`
- `tools/verify-webm.mjs`
- `tools/webm-core.mjs`
- `tools/webm-render-settings.json`
- `tools/webm-generator.test.mjs`
- `tools/README.md`
- `assets/serve-short.webm`
- `assets/serve-long.webm`
- `assets/webm-generation-report.json`

FFmpeg 8.1.2 full build 已透過 WinGet 安裝，並確認包含 `libvpx-vp9` encoder。

## 驗證結果

- 純 Node renderer 測試：10/10 通過。
- `prototype_short`：640×360、60 fps、2.000 秒、120 frames、trigger frame 75、質心誤差 0.1918 px、handoff 後球色像素 0。
- `prototype_long`：640×360、60 fps、3.200 秒、192 frames、trigger frame 126、質心誤差 0.2071 px、handoff 後球色像素 0。
- 完整 `--force` 重建一次後，兩支影片的 decoded-frame SHA-256 均與第一次相同；同一 FFmpeg 版本下 container SHA-256 也相同，但不列入跨版本契約。
- 兩支檔案都是 VP9／yuv420p、無音訊。

完整 hash 與 FFmpeg／FFprobe 版本位於 `assets/webm-generation-report.json`。

## Runtime 邊界

`timeline-config.json` 的 `generation_status` 仍保留 `pending_generation`；頁面目前繼續走程序化 fallback。這是刻意的停止線：檔案層驗證通過，不等於 localhost 真實 `<video>` 的 metadata、`currentTime ±0.05 秒` 與 crossfade 畫面驗收通過。

產生器永遠不自動修改 `generation_status`。若要升級成 `ready`，下一步應另做瀏覽器驗收並由人明確批准。

正式遊戲、正式物理檔案、`videos.json` 與正式素材路徑均未修改；既有 `AI_CONTEXT/test_output.txt` 及 `.claude/` 內容保持不動。
