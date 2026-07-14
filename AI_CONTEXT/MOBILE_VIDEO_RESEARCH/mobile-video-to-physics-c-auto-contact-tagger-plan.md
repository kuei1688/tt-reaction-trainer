# 自動粗標觸球時間——獨立離線腳本計畫書

> 狀態：**計畫草案；未開始實作。2026-07-15：視覺模型已可用（Ollama cloud Kimi-k2.7-code），待實作**
> 日期：2026-07-12
> 依據：`AI_CONTEXT/MOBILE_VIDEO_RESEARCH/mobile-video-to-physics-c-annotator-plan.md` 第 8 節「後續構想——自動粗標觸球時間」

## 1. 為什麼要做這個腳本

Direction C 標註器（Phase 1/2 已完成）讓教練能手動逐格標記觸球時間（`contact_time_sec`）。但手動標記的瓶頸在於：每支影片需要在 60fps 下逐格搜尋觸球瞬間，單支可能花 1–3 分鐘。若未來要對十幾支以上教練篩選影片做標註，人工成本會成為限制因素。

本腳本用 vision API 自動粗標觸球時間，把人工工作從「從零找觸球點」降級為「檢查並微調已標好的點」。腳本輸出 draft JSON，經由標註器的「匯入 draft」入口載入後，教練只需逐格確認或微調 ±1–3 frame。

**先試測再量產**：先在少量已有人工真值的影片上驗證誤差，目標 ±1–3 frame @60fps（±16.7–50ms）。達標才考慮量產；不達標則記錄誤差分布、檢討策略，不強行上線。

## 2. 邊界：腳本 vs 標註器

這是最重要的設計原則。腳本和標註器是兩個獨立工具，各自有清楚的邊界：

| | 自動粗標腳本 | Direction C 標註器 |
|---|---|---|
| 形態 | Node.js 命令列腳本 | 瀏覽器離線 HTML 工具 |
| 網路 | 呼叫 vision API（需 API key） | 完全離線，不接任何 API |
| 輸入 | 影片檔＋fps | draft JSON（含腳本產出的粗標） |
| 輸出 | draft JSON（粗標，待人工微調） | 最終 draft JSON（人工確認後） |
| 位置 | `prototypes/video-physics-timeline/tools/auto-contact-tagger/` | 已存在於 `direction-c-annotator/` |

標註器本身**不接 API、不改程式碼**。腳本產出的 draft JSON 透過標註器既有的「匯入 draft」入口載入，流程上等同於人工貼入 JSON。標註器不知道、也不需要知道 JSON 是人還是腳本產出的。

## 3. 輸入與輸出

### 3.1 輸入

```
node auto-contact-tagger.mjs <video.mp4> [--fps 60] [--out draft.json]
```

- 影片檔路徑（必填）。支援常見格式（mp4、webm、mov）。
- `--fps`：影格率，預設 60。用於時間↔影格換算與粗掃間隔。
- `--out`：輸出檔路徑，預設為 `<video-stem>.draft.json`。

### 3.2 輸出

一份通過 `annotation-contract.js` `validateAnnotation` 的 draft JSON。腳本只自動偵測 `contact_time_sec`；其餘欄位填入佔位預設值，清楚標示「待人工填寫」：

```json
{
  "annotation_status": "draft",
  "source_video": "<輸入檔名>",
  "fps": 60,
  "contact_time_sec": 4.283,
  "observation_end_sec": 4.583,
  "entry_position": { "x": 0.5, "y": 0.5 },
  "spin_note": "待人工填寫",
  "preview_profile_id": "prototype_short",
  "allowed_variants_draft": {
    "length": ["short"],
    "placement": [],
    "speed": [],
    "review_status": "pending_coach"
  }
}
```

- `contact_time_sec`：腳本自動偵測，吸附到 fps 影格邊界（`round(contact_frame) / fps`）。
- `observation_end_sec`：暫定為 `contact_time_sec + 0.3`（約 18 frame @60fps），僅為讓 JSON 通過驗證的佔位值；人工在標註器內調整。
- `entry_position`：中心點 `{ x: 0.5, y: 0.5 }` 佔位；人工拖曳定位。
- `spin_note`：固定字串 `"待人工填寫"`，提示此欄需要教練判斷。
- `allowed_variants_draft`：最小合法值（`length: ["short"]`、其餘空陣列、`review_status: "pending_coach"`）；人工在標註器內勾選。

**不偵測、不猜測的欄位**：旋轉類型、球路入口、長短／落點／速度變體。這些需要內容或教練判斷，腳本不碰。腳本唯一的工作是找到觸球時間。

### 3.3 輸出驗證

腳本在寫出 JSON 前，以與標註器同一份 `annotation-contract.js` 驗證。若驗證失敗，腳本不寫檔，而是在 stderr 印出錯誤訊息並以非零狀態碼結束。這確保腳本產出的 JSON 一定能被標註器的匯入入口接受。

## 4. 兩階段掃描策略

### 4.1 粗掃（coarse scan）

目的：在整段影片中快速定位觸球可能發生的時間區間。

1. 用 ffmpeg 從影片以固定間隔抽幀。間隔預設為 0.5 秒（60fps → 每 30 frame 抽 1 幀）。5 秒影片約抽 10 幀。
2. 每幀以 base64 編碼送 vision API，prompt 類似：

   > 這是桌球訓練影片中的一格畫面。請判斷球拍與球的關係狀態，只回答下列其中一個詞：
   > `before_contact`（球拍尚未觸球）、`contact`（球拍正在觸球或極近）、`after_contact`（已擊球，球已離開球拍）、`unclear`（無法判斷）。

3. 收集所有幀的分類結果，找到 `before_contact` → `contact`/`after_contact` 的轉換邊界。
4. 以轉換邊界為中心，向前後各延伸 0.5 秒（±30 frame @60fps），形成細掃區間。

若粗掃結果中沒有明確的轉換邊界（例如全程 `unclear` 或多處轉換），腳本在 stderr 印出警告，仍輸出 JSON 但 `contact_time_sec` 填為粗掃中最佳候選幀的時間，並在 stdout 附註信心分數偏低。

### 4.2 細掃（fine scan）

目的：在粗掃縮小的區間內逐格精確定位觸球瞬間。

1. 用 ffmpeg 從細掃區間內逐幀抽幀（每一格都抽）。1 秒區間 @60fps = 60 幀。
2. 每幀送 vision API，prompt 改為更精確的二元判斷或信心評分：

   > 這是桌球訓練影片中的連續畫面。請判斷這一格是否為「球拍接觸球」的瞬間。
   > 回答 JSON：`{ "is_contact": true/false, "confidence": 0.0–1.0 }`

3. 取信心分數最高的幀作為觸球幀。若最高信心 < 0.5，印出低信心警告。
4. 將觸球幀換算為秒數，吸附到影格邊界：`contact_time_sec = round(best_frame) / fps`。

### 4.3 API 呼叫量估算

| 階段 | 5 秒影片 @60fps | 10 秒影片 @60fps |
|---|---|---|
| 粗掃（每 0.5s 抽 1 幀） | 10 次 | 20 次 |
| 細掃（±0.5s 區間逐幀） | 60 次 | 60 次 |
| 合計 | 70 次 | 80 次 |

粗掃間隔可透過 `--coarse-interval` 調整。對於已知大致觸球時間的批次，可用 `--hint <sec>` 指定先驗區間，跳過粗掃直接進細掃，將呼叫量降至 60 次以內。

### 4.4 替代策略：逐幀比較

若單幀判斷的誤差大於預期，可改用**逐幀比較**策略：一次送兩張連續幀給 vision API，問「哪一格更接近觸球瞬間？」。這種比較式判斷在定位邊界時通常比絕對判斷更準確，但 API 呼叫次數約增為 1.5–2 倍。列為 Phase 2 的改善選項，Phase 1 先用單幀判斷。

## 5. 影格擷取

使用 ffmpeg 抽幀，理由：專案既有工具腳本（`tools/import-serve-presets.mjs` 等）已是 Node 命令列風格；ffmpeg 是跨平台、免費、廣泛安裝的標準工具。

- 抽幀指令範例（粗掃）：`ffmpeg -i input.mp4 -vf "fps=2" -q:v 2 frame_%04d.jpg`
- 抽幀指令範例（細掃）：`ffmpeg -ss <start> -to <end> -i input.mp4 -vf "fps=60" -q:v 2 frame_%04d.jpg`
- 抽幀的 JPEG 暫存於系統 temp 目錄，腳本結束後清理。
- 腳本啟動時檢查 ffmpeg 是否可用；不可用則印出安裝提示並結束。

影格品質設為 `-q:v 2`（高品質 JPEG），確保 vision API 能看清球拍與球的細節。不壓縮成極低解析度，因為桌球觸球瞬間的像素級細節是判斷關鍵。

## 6. Vision API 整合

### 6.1 API 選擇

腳本設計為可替換的 vision API 後端。Phase 1 先支援 OpenAI Vision API（`gpt-4o` 或同類模型），因為 API key 取得容易、文件完整。後端以介面隔離：

```javascript
// vision-backend.js
export async function classifyFrame(imageBase64, prompt) { /* ... */ }
```

未來可替換為其他 vision 模型（Gemini、Claude Vision 等），只需改這一個模組。

### 6.2 API key 管理

- 從環境變數 `OPENAI_API_KEY` 讀取，不寫入程式碼、不寫入設定檔。
- 腳本啟動時檢查；缺少則印出提示並結束。
- 不記錄 API key 到任何日誌或輸出檔。

### 6.3 速率控制與成本

- 預設每秒最多 5 次 API 呼叫（可透過 `--rate-limit` 調整），避免觸發 API 限流。
- 每次呼叫的圖片以 JPEG 壓縮後送出，控制 token 消耗。
- 腳本在 stderr 即時印出進度（已處理 N/M 幀），讓操作者知道預估剩餘時間。
- 單支影片的 API 成本預估：< $0.10（以 70 次 vision 呼叫估算）。批次處理前先確認預算。

### 6.4 錯誤處理

- API 呼叫失敗（網路錯誤、限流、逾時）：重試 3 次，指數退避（1s → 2s → 4s）。仍失敗則跳過該幀，記錄為 `unclear`，繼續處理。
- 輸出 JSON 仍會嘗試寫入，但若有超過 20% 的幀失敗，在 stderr 印出強烈警告建議重跑。

## 7. 批次管理

### 7.1 單檔模式

```
node auto-contact-tagger.mjs video.mp4 --out draft.json
```

處理單支影片，輸出單一 draft JSON。

### 7.2 批次模式

```
node auto-contact-tagger.mjs --batch ./videos/ --out ./drafts/
```

- 掃描輸入目錄內所有影片檔（`.mp4`、`.webm`、`.mov`），逐一處理。
- 每支影片輸出獨立的 `<stem>.draft.json` 到輸出目錄。
- 另產出 `batch-summary.json`，記錄每支影片的偵測結果、信心分數、API 呼叫數與耗時：

```json
{
  "batch_date": "2026-07-12T14:30:00+08:00",
  "total_videos": 5,
  "results": [
    {
      "source_video": "serve-backspin-001.mp4",
      "contact_time_sec": 4.283,
      "confidence": 0.82,
      "api_calls": 72,
      "duration_sec": 14.5,
      "warnings": []
    }
  ]
}
```

- 批次模式支援 `--resume`：若輸出目錄已有同名 draft JSON，跳過該影片。中斷後重跑不會從頭來過。
- 批次模式在每支影片處理完即寫出該影片的 JSON，不等到全部跑完。程序中斷時已完成的影片不會遺失。

### 7.3 批次管理的界線

批次殼只負責「巡影片、跑腳本、收集結果」。它不做：

- 不讀寫 `videos.json` 或任何主線設定檔。
- 不判定旋轉、不核准變體、不宣稱標註完成。
- 不自動把 draft JSON 貼回任何設定檔——那是人的決定。
- 不與 Trainer 或題庫系統整合。

## 8. 分階段實作

| 階段 | 內容 | 完成判準 |
|---|---|---|
| Phase 1 | 核心腳本：ffmpeg 抽幀、單檔模式、兩階段掃描（粗掃＋細掃）、OpenAI Vision API 後端、`annotation-contract.js` 驗證輸出 | 單支影片輸出合法 draft JSON；JSON 能被標註器匯入入口接受 |
| Phase 2 | 誤差驗證：在 3–5 支已有人工真值的影片上跑腳本，比較 `contact_time_sec` 與人工標記的差異 | 產出誤差報告（每支影片的 frame 差、平均、最大值）；判斷是否達 ±1–3 frame 目標 |
| Phase 3 | 批次模式＋改善：`--batch`、`--resume`、`batch-summary.json`；若 Phase 2 誤差未達標，加入逐幀比較策略或調整 prompt | 批次跑完 5+ 影片不中斷、`--resume` 正確跳過已完成、summary 統計正確 |

每階段獨立可用。Phase 1 完成即可單檔使用；Phase 2 決定要不要繼續投資；Phase 3 才具備批次量產能力。

## 9. 驗證與誤差評估

### 9.1 驗證集

- 選 3–5 支已有人工逐格標記 `contact_time_sec` 的影片。理想涵蓋不同旋轉類型（下旋、側旋、不轉）與不同攝影角度。
- 人工真值以標註器產出的 draft JSON 為準（已經過教練確認的 `contact_time_sec`）。
- 若目前只有 `real_backspin_001` 一支有真值，先以這一支做初步驗證，同時請教練為另外 2–4 支影片手動標記真值。

### 9.2 誤差度量

對每支影片計算：

- `error_frames = round(|auto_sec - human_sec| * fps)` ——以影格為單位的絕對誤差。
- `error_ms = |auto_sec - human_sec| * 1000` ——以毫秒為單位。
- 方向：`auto_sec - human_sec`（正數=偏晚，負數=偏早）。

整體統計：平均誤差、最大誤差、±1 frame 內的比例、±3 frame 內的比例。

### 9.3 達標判準

- **可量產**：所有驗證影片誤差 ≤ 3 frame @60fps（±50ms），且至少 80% 的影片 ≤ 1 frame。
- **需改善**：部分影片誤差 > 3 frame。記錄失敗模式（是哪種旋轉、哪種角度、粗掃還是細掃出問題），嘗試 Phase 3 的改善策略後重測。
- **不適用**：若誤差系統性偏大（多數 > 5 frame）或方向一致（全偏晚或全偏早），記錄發現、停止投資，不強行量產。偏早或偏晚的系統性偏差可透過 `--offset <frames>` 補償，但必須在驗證集上確認補償後誤差收斂。

### 9.4 驗證報告

Phase 2 產出一份 `validation-report.md`，放在 `auto-contact-tagger/` 目錄下，內容包括：

- 驗證集影片清單與人工真值。
- 每支影片的腳本輸出、誤差、信心分數。
- 失敗模式分析（若有）。
- 達標判準結論：可量產 / 需改善 / 不適用。

## 10. 檔案結構

```
prototypes/video-physics-timeline/tools/auto-contact-tagger/
├── auto-contact-tagger.mjs      # 主腳本（CLI 入口）
├── vision-backend.js            # vision API 後端（可替換）
├── frame-extractor.js           # ffmpeg 抽幀封裝
├── draft-builder.js             # 組裝並驗證 draft JSON（呼叫 annotation-contract.js）
├── batch-runner.js              # 批次模式邏輯
├── contract-bridge.js           # 載入 direction-c-annotator 的 annotation-contract.js
├── README.md                    # 使用說明
├── validation-report.md         # Phase 2 產出（驗證報告）
└── test/
    ├── draft-builder.test.js    # 純邏輯測試（不呼叫 API）
    └── frame-extractor.test.js  # ffmpeg 可用性測試
```

- `contract-bridge.js` 以相對路徑 `require('../direction-c-annotator/annotation-contract.js')` 載入同一份契約模組，確保腳本與標註器用完全相同的驗證邏輯。不複製、不重新實作 schema。
- 測試遵循 repo 既有慣例：`node test/file.test.js` 直跑，零依賴，不呼叫真實 API（vision 測試以 mock 驗證呼叫邏輯）。

## 11. 相依性與環境需求

| 相依 | 用途 | 安裝方式 |
|---|---|---|
| Node.js ≥ 18 | ESM 語法、`fetch` 內建 | 已是專案既有環境 |
| ffmpeg | 影格擷取 | 系統安裝；腳本啟動時檢查 |
| `OPENAI_API_KEY` 環境變數 | Vision API 認證 | 操作者自行設定 |

不引入任何 npm 套件。ffmpeg 透過 `child_process.execFile` 呼叫，vision API 透過內建 `fetch` 呼叫。整個腳本零 npm 依賴，與 repo 既有工具腳本一致。

## 12. 非目標與停止線

- **不修改標註器程式碼**：腳本產出的 draft JSON 透過標註器既有的匯入入口進入，標註器不需為本腳本做任何改動。
- **不寫入主線設定檔**：不碰 `videos.json`、`timeline-config.json`、`physics-presets.json` 或任何紅線檔案。腳本只產出獨立的 draft JSON 檔。
- **不偵測旋轉、入口位置或變體**：這些需要內容或教練判斷。腳本唯一自動偵測的值是 `contact_time_sec`。
- **不宣稱標註完成**：輸出的 JSON 一律帶 `annotation_status: "draft"` 與 `review_status: "pending_coach"`。腳本產出的是粗標，不是最終標註。
- **不接入 Trainer 或題庫系統**：腳本產出檔案，人決定怎麼用。
- **不替代人工逐格確認**：腳本的價值是縮小搜尋範圍，不是取代教練判斷。匯入標註器後仍須人工逐格微調。
- **不保證 Phase 2 達標**：若驗證誤差超出 ±1–3 frame 目標，記錄發現、停止投資，不強行量產。

## 13. 與母計畫的關係

本計畫是 `mobile-video-to-physics-c-annotator-plan.md` 第 8 節「後續構想」中「自動粗標觸球時間」的獨立展開。它不改動母計畫的任何已完成項目（Phase 1/2），也不改動母計畫的非目標與停止線。母計畫第 9 節的所有紅線保護承諾（不寫入主線檔案、不接入 Trainer、不復活 WebM 產生器）在本腳本中同樣適用。

若本腳本 Phase 2 驗證達標且教練決定量產，再另行討論是否調整母計畫的範圍或紅線。在那之前，腳本與標註器各自獨立運作。
