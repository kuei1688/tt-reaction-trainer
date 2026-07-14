# auto-contact-tagger

自動粗標觸球時間的獨立離線腳本（Direction C 支線）。用 vision API 兩階段掃描
（粗掃定位區間 → 細掃逐幀）找到「球拍觸球」瞬間，輸出可被 Direction C 標註器
「匯入 draft」入口接受的 draft JSON。腳本只偵測 `contact_time_sec`；其餘欄位為
佔位值，待教練在標註器內逐格微調。

計畫書：`AI_CONTEXT/MOBILE_VIDEO_RESEARCH/mobile-video-to-physics-c-auto-contact-tagger-plan.md`

## 狀態

Phase 1 已實作（單檔模式、兩階段掃描、draft 驗證、單元測試通過）。
**尚未做實機驗證**——需要一個支援影像輸入的 vision 模型才能跑 live 掃描
（見「視覺模型」）。批次模式與驗證報告為 Phase 2，未做。

## 相依

- Node.js ≥ 18（用內建 `fetch`）
- ffmpeg / ffprobe（系統安裝；腳本自動偵測 PATH 與常見安裝位置，或用 `--ffmpeg` 指定）
- 一個支援影像輸入的 vision 模型（Ollama 或任何 OpenAI 相容端點）

零 npm 依賴。

## 用法

```text
node auto-contact-tagger.js <video.mp4> [--fps 60] [--out draft.json] \
  [--model <id>] [--endpoint <url>] [--api-key <key>] \
  [--hint <sec>] [--coarse-interval 0.5] [--half-window 0.5] \
  [--rate-limit 5] [--ffmpeg <path>] [--dry-run] [--keep-frames]
```

先乾跑確認 ffmpeg 抽幀與掃描選幀（不呼叫 API）：

```text
node auto-contact-tagger.js video.mp4 --dry-run --hint 4.3
```

`--hint <sec>`：已知大致觸球時間時，跳過粗掃直接細掃該點 ±0.5s，API 呼叫量降至 ~60 次以內。

輸出 JSON 透過標註器的「匯入 draft」入口載入後，人工逐格微調 ±1–3 frame。

## 視覺模型

vision-backend 走 OpenAI 相容 `/v1/chat/completions`，endpoint 預設本地 Ollama
`http://127.0.0.1:11434/v1/chat/completions`。模型用 `--model` 或環境變數
`OLLAMA_VISION_MODEL` 指定。**模型必須支援影像輸入**（`image_url` content）。

實測：本地 Ollama 的 `glm-5.2:cloud` 不支援影像輸入（HTTP 400
「this model does not support image input」）。需換用支援 vision 的模型
（例如拉一個 multimodal 模型到 Ollama，或改打 OpenAI `gpt-4o` 等端點）。
Kimi-k2.7-code 若要用，須先確認其在 Ollama 上的標籤與是否支援影像。

## 輸出 schema

腳本寫檔前以 Direction C 標註器同一份 `annotation-contract.js` 驗證，
確保產出一定能被標註器匯入入口接受。佔位欄位：

- `contact_time_sec`：自動偵測，吸附到影格邊界
- `observation_end_sec`：`contact + 0.3s` 佔位
- `entry_position`：`{x:0.5, y:0.5}` 佔位
- `spin_note`：`"待人工填寫"`
- `allowed_variants_draft`：最小合法值，`review_status: "pending_coach"`

## 測試

```text
node test/draft-builder.test.js
node test/scan.test.js
```

純邏輯測試，零依賴、不呼叫 API（vision 以 mock 驗證掃描邏輯）。

## 檔案

- `auto-contact-tagger.js` — CLI 入口（單檔模式）
- `scan.js` — 兩階段掃描純邏輯
- `vision-backend.js` — 可替換的 vision API 後端
- `frame-extractor.js` — ffmpeg/ffprobe 抽幀封裝
- `draft-builder.js` — 組裝並驗證 draft JSON
- `contract-bridge.js` — 載入標註器的 annotation-contract.js
- `test/` — 單元測試

## 非目標

不寫入主線設定檔、不接入 Trainer、不偵測旋轉/入口/變體、不替代人工逐格確認。
輸出一律 `annotation_status: "draft"`、`review_status: "pending_coach"`。