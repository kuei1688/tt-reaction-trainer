# 原型素材說明

這個目錄只放隔離原型的新造素材。

- `opponent-prep.svg` 與 `opponent-counter.svg` 是簡化姿勢示意，不是正式美術。
- `serve-short.webm` 與 `serve-long.webm` 由 `../tools/generate-webm.mjs` 逐幀產生，不是手工或螢幕錄影輸出。
- `webm-generation-report.json` 記錄 FFmpeg 版本、設定 hash、輸出 hash、解碼 frame hash、duration、frame 數與 trigger 質心。
- `timeline-config.json` 目前仍以 `generation_status: "pending_generation"` 保護 runtime；檔案產生成功不等於真實 `<video>` 瀏覽器驗收完成。

目前固定使用 640×360、60 fps、VP9／yuv420p、無音訊與單執行緒 libvpx 設定；重建請使用工具的 `--force`，不要以無來源的 WebM 覆蓋。
