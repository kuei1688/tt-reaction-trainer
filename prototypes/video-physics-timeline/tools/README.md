# WebM 資產編譯器

這個工具把 `timeline-config.json` 的已知球點軌跡直接 rasterize 成 RGB24 frames，再以 FFmpeg／libvpx-vp9 編碼為原型 WebM。它不是通用影片編輯器，也不讀取正式遊戲媒體。

## 需求

- Node.js
- 含 `libvpx-vp9` 的 FFmpeg 與 FFprobe

一般安裝後可直接從 `PATH` 找到工具；也可以設定 `FFMPEG_PATH`、`FFPROBE_PATH` 指向完整可執行檔路徑。

## 指令

```text
node generate-webm.mjs --doctor
node generate-webm.mjs --all
node generate-webm.mjs --serve prototype_short
node generate-webm.mjs --all --force
node generate-webm.mjs --check
node verify-webm.mjs --all
node webm-generator.test.mjs
```

- 預設產生所有 serve，且拒絕覆寫既有 WebM。
- `--force` 使用同目錄暫存檔，成功後才交換輸出。
- `--check` 與 `verify-webm.mjs` 只讀取現有輸出。
- 產生器不會修改 `timeline-config.json` 或自動設定 `generation_status: "ready"`。

## 確定性與驗證

確定性契約是 decoded RGB frame 內容，不是跨 FFmpeg 版本的 WebM container bytes。renderer 使用內建 5×7 bitmap font 顯示 `Tmm:ss.mmm Fnnnn`；verifier 解出 trigger frame，在 anchor ROI 依唯一球色計算質心，誤差上限為 1 px，並確認 handoff 後不再存在影片球點。
