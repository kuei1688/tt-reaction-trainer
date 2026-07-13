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

## 視覺化軌跡預覽器

預覽器與產生器共用 `webm-frame-math.mjs` 的逐幀座標函式，可在不重編 WebM 的情況下調整球點軌跡。從專案根目錄啟動 HTTP 服務後，開啟 `/tools/preview/`：

```text
npx serve prototypes/video-physics-timeline
# 或 python -m http.server --directory prototypes/video-physics-timeline 8080
```

請勿以 `file://` 直接開啟，因為 JSON fetch 與 ES module import 會被瀏覽器封鎖。若無法自動載入，頁面會明確顯示錯誤，並支援手動選取兩份 JSON 或貼上完整 timeline JSON。

- 預設產生所有 serve，且拒絕覆寫既有 WebM。
- `--force` 使用同目錄暫存檔，成功後才交換輸出。
- `--check` 與 `verify-webm.mjs` 只讀取現有輸出。
- 產生器不會修改 `timeline-config.json` 或自動設定 `generation_status: "ready"`。

## 真實影片 Anchor 選點器

`tools/preview/anchor-picker.html` 跟上面的軌跡預覽器是兩個不同的工具：軌跡預覽器只調整程序化合成 serve 的座標；這個工具是給「把題庫既有真人影片接上 physics handoff」用的，讓你**直接在真實影片畫面上點擊**取得可貼進 `timeline-config.json` 的座標，不用手動換算。

不需要伺服器，雙擊即可用瀏覽器開啟（`file://`）：

1. 選擇影片檔（本機檔案，只在瀏覽器裡處理，不會上傳）。
2. 拖時間軸或用 ±1 frame 找到觸球那一刻。
3. 直接點畫面上球的位置；工具用跟正式舞台相同的 16:9 cover 裁切方式換算成 `video_anchor_uv`，時間會自動吸附到 fps 對齊的 frame 邊界。
4. 複製右側 JSON 片段貼進對應 serve 的 `video` 欄位，並把影片檔複製到 `../../assets/`、填上 `src` 與 `generation_status: "ready"`。

⚠️ 把真實影片加進 `timeline-config.json` 之後，**不要對整個 config 執行 `generate-webm.mjs --all --force`**——它會把每個 serve 的 `src` 當輸出路徑用合成畫面覆蓋，包括剛加入的真實影片檔。要驗證其他合成 serve，請用 `--serve <id>` 指名執行。真實 serve 的 `expected_duration_sec`／`physics_trigger_time_sec` 仍必須精確對齊 render settings 的 fps（工具已自動 snap），否則 `generate-webm.mjs` 的 `loadProject()` 在啟動時會直接對這筆 serve 拋錯，連帶擋住其他合成 serve 的驗證。

## 確定性與驗證

確定性契約是 decoded RGB frame 內容，不是跨 FFmpeg 版本的 WebM container bytes。renderer 使用內建 5×7 bitmap font 顯示 `Tmm:ss.mmm Fnnnn`；verifier 解出 trigger frame，在 anchor ROI 依唯一球色計算質心，誤差上限為 1 px，並確認 handoff 後不再存在影片球點。

Report 分別記錄生成當時的完整 timeline config hash 與實際 render inputs hash；後者只包含 serve ID 與 video 區塊，因此 physics-only 調整不會被誤判為 WebM 像素來源改變。
