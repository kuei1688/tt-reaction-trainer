# CHECKPOINT：Handoff Calibrator Phase 1

日期：2026-07-11（2026-07-11 補記：審查發現並修復載入錯誤、完成人工瀏覽器驗收）

## 完成範圍

- 新增隔離工具 `prototypes/video-physics-timeline/tools/handoff-calibrator/`，只服務 `real_backspin_001`。
- 工具固定顯示「探索性 ready，未校準／不可發布」，不將既有 config 的 `ready` 視為驗收或發布資格。
- 支援 60 fps trigger、單點 anchor、`prototype_short` / `prototype_long` 玩法近似 profile、第一個物理投影與 raw delta 顯示。
- 草稿只保存至 browser localStorage，可匯出／匯入 JSON；契約固定為 `draft`，拒絕 `reviewed`、`published`、`ready` 與額外發布欄位。
- 新增共用 `projection-helper.js`；既有 prototype 由同一 helper 計算投影，避免在校準器複製投影公式。

## 未修改的範圍

- 未修改 `shared-physics-core.js`、`game4.html`、`match-trainer.html`、`physics-presets.json`、`videos.json`。
- 未修改 `timeline-config.json`、任何 serve 的 `generation_status`、既有 physics profile 參數或正式 Trainer。
- 未加入第二支影片、多影格追蹤、速度擬合、自動求解、發布流程、動畫編排或 crossfade 掩飾。

## 自動驗收

- `node prototypes/video-physics-timeline/projection-helper.test.js`：2 通過。
- `node prototypes/video-physics-timeline/tools/handoff-calibrator/draft-contract.test.js`：7 通過。
- `node prototypes/video-physics-timeline/video-physics-timeline.test.js`：18 通過。
- `node prototypes/video-physics-timeline/prototype-physics-bridge.test.js`：8 通過。
- `node prototypes/video-physics-timeline/tools/webm-generator.test.mjs`：11 通過。
- `git diff --check`：通過。

## 審查發現並修復的問題（2026-07-11 補記）

後續審查以可連線 localhost 的 Browser 實際開啟工具，發現頁面在瀏覽器中完全無法載入：`index.html` 的 `<script src="../../../shared-physics-core.js">` 少算一層目錄，實際請求落在不存在的 `prototypes/shared-physics-core.js`（404）。`shared-physics-core.js` 未載入導致 `prototype-physics-bridge.js` 在載入時依既有防呆檢查直接 `throw`，`window.PrototypePhysicsBridge` 從未被設定，校準器初始化立即停在「校準器停止：校準器相依元件未載入」。

此問題未被既有 46 項 Node 測試攔截，因為所有測試以 `require()` 直接載入模組，不會經過瀏覽器 `<script>` 相對路徑。

修復：僅將該路徑改為 `../../../../shared-physics-core.js`（4 層），對齊實際目錄深度。未變更其他檔案或任何邏輯。修復後重跑全部 5 套既有測試與 `git diff --check`，結果不變、全部通過。

## 人工驗收狀態

實際瀏覽器操作驗收已完成（修復上述載入問題後，於本機靜態伺服器開啟 `tools/handoff-calibrator/index.html` 對 `real_backspin_001` 執行）：

- 開頁清楚看到「探索性 ready，未校準／不可發布」提示，未把既有 `ready` 解讀為完成。
- 不開啟 JSON 編輯器即可完成：trigger 吸附至 60fps（4.300s／frame 258）、單點點擊設定 anchor、下拉選擇 `prototype_short`／`prototype_long` profile、儲存本機草稿。
- 草稿重新整理頁面後可正確重載：trigger、anchor UV、profile、raw delta 四項數值與存檔前一致，並顯示「已重載本機草稿，未發布」。
- 已知 large-delta 情境如實顯示（本次點擊得到約 245px，UI 以「large delta」標示），未以 crossfade 或透明度掩飾。
- 驗收過程未修改 `shared-physics-core.js`、`game4.html`、`match-trainer.html`、`physics-presets.json`、`videos.json`、`timeline-config.json` 任何既有 serve 資料或 `generation_status`（以 `git diff` 逐一核對為空）。

匯出／匯入 JSON 按鈕已確認可互動（enabled 狀態隨草稿有效性切換），未在本輪逐一開啟系統下載對話框驗證檔案內容；如需要可另行確認。

## 停止線

Phase 1 到此停止。工具只產生草稿；`real_backspin_001` 仍是未校準、未發布的探索樣本。任何 Phase 2、Trainer 整合、發布或物理參數調整，都需要新的計畫與核准。
