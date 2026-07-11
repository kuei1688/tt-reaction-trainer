# 專案計畫書（修訂版）：WebM 產生器視覺化預覽器

> 修訂日期：2026-07-11
> 修訂原因：原計畫的邏輯來源檔案標示錯誤、CORS 降級策略有風險、缺少「好調整」的核心互動設計。本版已對照實際程式碼修正。

## 1. 專案背景與目標

目前的「可重現 WebM 資產編譯器」（`tools/generate-webm.mjs` + `tools/webm-core.mjs`）讀取 `timeline-config.json` 產生精確的 VP9 WebM。問題：每次微調參數都要「改 JSON → 跑 FFmpeg → 刷新瀏覽器」，視覺迭代極慢，導致工具目前無法通過驗收。

**目標**：建立純前端「視覺化預覽器」，在瀏覽器中即時調整發球軌跡、位置與時間；視覺滿意後把參數貼回 `timeline-config.json`，最後才執行一次編譯。

**驗收標準**：預覽器中 Frame N 的球點位置，與 `generate-webm.mjs` 產出影片中 Frame N 的球點位置一致（同一份數學函式計算，非重新實作）。

## 2. 檔案結構

```
prototypes/video-physics-timeline/
├─ timeline-config.json            (現有，資料來源)
├─ tools/
│  ├─ webm-core.mjs                (現有，⚠ 允許重構：拆出純數學，行為不變)
│  ├─ webm-frame-math.mjs          (新增：瀏覽器相容的純數學模組)
│  ├─ webm-render-settings.json    (現有，width/height/fps/顏色來源)
│  ├─ generate-webm.mjs            (現有，不修改)
│  ├─ verify-webm.mjs              (現有，不修改)
│  ├─ webm-generator.test.mjs      (現有，重構後必須全過)
│  └─ preview/                     (新增)
│     ├─ index.html                (預覽器介面，CSS 內聯)
│     └─ preview.js                (UI 邏輯與 Canvas 渲染)
```

## 3. 邏輯對齊策略（取代原計畫第 5.1 節的開放問題）

### 3.1 事實更正

逐幀計算邏輯**不在** `generate-webm.mjs`，而在 `webm-core.mjs`：

| 函式 | 位置 | 職責 |
|---|---|---|
| `getBallPose()` | webm-core.mjs:103-115 | uv 插值、easeOutCubic、`-sin(progress·π)·0.12` 拋物線、淡出 alpha |
| `getFramePlan()` | webm-core.mjs:73-97 | frame 對齊驗證、triggerFrame、`handoffEndFrame`（**Math.ceil**）、anchorPx |
| `formatTimecode()` | webm-core.mjs:214-220 | 時間碼字串 |
| `createStaticFrame()` | webm-core.mjs:166-212 | 球桌背景（用 Node `Buffer`，不直接共用） |

### 3.2 拆模組方案（單一真相來源）

1. 新增 `tools/webm-frame-math.mjs`，從 `webm-core.mjs` **原封不動搬移**：`clamp`、`mix`、`easeOutCubic`、`getBallPose`、`getFramePlan`、`formatTimecode`。這些函式只用 `Math` 與純物件，瀏覽器可直接 import。
2. `webm-core.mjs` 改為 `import` + `export * from "./webm-frame-math.mjs"`，對 `generate-webm.mjs` / `verify-webm.mjs` 完全透明。
3. `preview.js` 以 `<script type="module">` import 同一個 `webm-frame-math.mjs`。**禁止在 preview 端重新實作任何座標數學。**
4. 回歸保證：重構後 `node --test tools/webm-generator.test.mjs` 必須全過，且 `generate-webm.mjs --check` 對現有 assets 驗證結果不變。

### 3.3 畫面繪製

背景與球點在 preview 端用 Canvas 2D API 重畫（`createStaticFrame` 依賴 Node `Buffer`，Phase 1 不共用）。位置、時間、alpha 全部來自共用函式；僅存在抗鋸齒等像素級渲染差異，對軌跡微調無影響。

（可選 Phase 3：把 `webm-core.mjs` 繪製函式的 `Buffer.alloc` 改為 `new Uint8Array` 使其瀏覽器相容，preview 用 `putImageData` 顯示同一份 RGB buffer，達到像素完美。非本次範圍。）

## 4. 核心功能需求

### 4.1 資料載入

- 頁面載入時 `fetch` 兩個檔案：`../../timeline-config.json` 與 `../webm-render-settings.json`。**畫布尺寸、fps、球色、背景色一律取自 settings，不得寫死 640×360。**
- **serve 選擇器**：config 內有多個 serve（目前為 `prototype_short`、`prototype_long`），提供下拉選單切換，切換時重載該 serve 的全部參數。
- **執行方式：要求以 HTTP 服務開啟**（`file://` 下 fetch 與 ES module import 都會被瀏覽器擋）。README 註明一行指令，例如：
  ```
  npx serve prototypes/video-physics-timeline
  # 或 python -m http.server --directory prototypes/video-physics-timeline 8080
  ```
- **降級路徑（取代原計畫的「內建預設值」）**：fetch 失敗時**不得**靜默改用寫死的預設值。改為顯示明確的錯誤橫幅＋提供 `<input type="file">` 手動載入兩個 JSON。畫面須常駐顯示目前參數來源（「已載入 timeline-config.json」／「手動載入」／「未載入」）。

### 4.2 畫布渲染區

- `<canvas>` 尺寸 = `settings.width × settings.height`。
- 以 Canvas 2D 重畫球桌背景（梯形桌面、中線、球網——比例常數照抄 `createStaticFrame`：farY=0.34h、nearY=0.94h、farHalf=0.26w、nearHalf=0.47w、netHeight=0.075h）。
- 球點位置與 alpha 一律呼叫共用的 `getBallPose(serve, settings, frameIndex)`。
- 時間碼顯示呼叫共用的 `formatTimecode()`（可用一般 canvas 文字，不需 bitmap font）。
- **常駐軌跡殘影線**：不論是否播放，永遠以半透明折線畫出 frame 0 → frameCount-1 的完整軌跡（每 frame 取樣 `getBallPose`），讓開發者一眼看到整條弧線。
- **控制點標記**：
  - `start_uv`：起點標記（例如空心圓）。
  - `video_anchor_uv`：anchor 十字準星。
  - 兩者皆須**可在畫布上直接拖曳**（見 4.4）。

### 4.3 時間軸與播放控制

- Range 滑桿：frame 0 到 `frameCount - 1`（來自共用 `getFramePlan`）。拖動即時重繪。
- **滑桿上的標記**（原計畫遺漏，必做）：
  - `triggerFrame` 位置畫豎線標記；
  - `triggerFrame → handoffEndFrame` 區間畫底色，代表 crossfade 淡出區（注意 `handoffEndFrame` 是 `Math.ceil((trigger + handoff.duration) × fps)`，直接用共用函式的回傳值，不要自己算）。
- **±1 frame 步進按鈕**與左右方向鍵支援（滑桿太粗，對齊 trigger 必需）。
- 播放／暫停按鈕：**以時間驅動**，`requestAnimationFrame` 回呼內用累計 elapsed time 換算 `frameIndex = floor(elapsed × fps)`，不得每次 rAF 遞增 1（120/144Hz 螢幕會加速）。
- 顯示目前 frame 數與秒數。

### 4.4 即時參數控制面板

可調參數（任何改動即時重繪 Canvas 與 JSON 輸出）：

| 參數 | 控件 | 約束 |
|---|---|---|
| `procedural_fallback.start_uv` x/y | 數字輸入 + **畫布拖曳** | 0..1 |
| `handoff.video_anchor_uv` x/y | 數字輸入 + **畫布拖曳** | 0..1（timeline-engine 驗證要求） |
| `physics_trigger_time_sec` | 數字輸入，step=1/fps | 見 4.5 |
| `expected_duration_sec` | 數字輸入，step=1/fps | 見 4.5 |
| `handoff.duration_sec` | 數字輸入 | > 0 |

### 4.5 驗證與 frame 對齊（原計畫遺漏，必做）

`getFramePlan()` 會在以下情況**直接 throw**，preview 必須在 UI 即時呈現同樣的驗證，否則調出來的參數產生器拒收：

- `expected_duration_sec × fps` 非整數 → 輸入框 step 設為 `1/fps` 並自動 snap 到最近的 frame 邊界，snap 時顯示提示。
- `physics_trigger_time_sec × fps` 非整數 → 同上。
- `triggerFrame` 必須在 `[0, frameCount)` 內。
- 驗證實作方式：每次參數變動直接 try/catch 呼叫共用的 `getFramePlan()`，把錯誤訊息顯示在面板上（紅色橫幅），成功則清除。**不要重新實作驗證規則。**

### 4.6 JSON 產出與同步

- 頁面底部唯讀 `<textarea>` + 「複製到剪貼簿」按鈕。
- **輸出必須是完整的 `timeline-config.json`**：以載入的整份 config 為基底，只覆寫被編輯的欄位，保留 `physics`、`opponent_responses`、`generation_status` 等所有未動欄位，讓開發者可整檔覆蓋貼回。禁止只輸出片段。
- 多 serve 情境：編輯不同 serve 後切換，各 serve 的修改都要保留在同一份輸出 JSON 中。
- textarea 旁註明：貼回後需執行 `node tools/generate-webm.mjs --force`（config hash 已變，且檔案已存在）。
- **雙向**：允許貼上 JSON 後按「載入」按鈕匯入（同時作為 file:// 情境的第三種降級路徑）。

## 5. 技術規格與限制

- 純前端：HTML + CSS + Vanilla JS（ES modules），禁止框架與打包工具。
- 座標數學唯一來源：`tools/webm-frame-math.mjs`（見 §3）。
- 效能：參數調整到重繪 < 16ms（單 frame 重算只是幾次 `getBallPose` 呼叫，軌跡殘影線最多 frameCount 次取樣，60fps × 3.2s = 192 點，無效能疑慮；不需要節流）。
- 對現有工具的唯一改動：`webm-core.mjs` 拆出純數學模組（§3.2），以現有測試與 `--check` 守住行為不變。

## 6. 範圍界線（明確排除項）

- **物理球疊加（Phase 2，本次不做）**：本預覽器只涵蓋「影片段」的程序化球。trigger 之後物理球由 `initial_ball_state` 經 physics bridge 投影產生，其與 anchor 的視覺連續性是下一階段的預覽目標，需要引入 `prototype-physics-bridge.js` 的投影邏輯，範圍另議。
- **像素完美渲染（Phase 3，本次不做）**：見 §3.3。
- 不做：直接寫檔回 `timeline-config.json`（純前端無檔案系統權限，維持複製貼上流程）、不做 WebM 解碼比對、不動 `verify-webm.mjs`。

## 7. 交付與驗收清單

1. `node --test tools/webm-generator.test.mjs` 全過（重構回歸）。
2. `node tools/generate-webm.mjs --check` 對現有 assets 結果與重構前相同。
3. 以 HTTP 服務開啟 preview，兩個 serve 都能載入、切換、播放。
4. 拖曳 anchor 十字準星 → Canvas 軌跡即時更新 → JSON 輸出同步變更。
5. 把 `physics_trigger_time_sec` 改成非 frame 邊界值 → UI 顯示與 `getFramePlan` 相同的錯誤或自動 snap。
6. 時間軸滑桿可見 trigger 豎線與 handoff 淡出區間；±1 frame 步進可用。
7. 複製輸出 JSON 覆蓋 `timeline-config.json` → `generate-webm.mjs --force` 成功產出，`verify-webm` 全過——證明「所見即所得」閉環成立。
