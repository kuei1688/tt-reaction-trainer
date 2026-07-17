# VAL-005 回擊研究頁批次驗證工具化任務包

> 狀態：計畫草稿，尚未執行、尚未經人類核准。與 `docs/BATCH_VALIDATION_TOOLING_TASKPACK.md`（VAL-004，已完成）同結構，但本文件本身還沒跑過「Claude 邊界審查 → 人類確認」這一輪，落地前應先過一次審查。
>
> 建立日期：2026-07-12

## 觸發來源

- `AI_CONTEXT/OPEN_ITEMS.md`「工具化缺口」章節明列：`VAL-005：return-studio.html 回擊批次驗證尚未工具化（VAL-003 發球批次已工具化並通過 16/16）`。
- `docs/VALIDATION_PLAN.md` 的驗證入口表：VAL-005（回擊研究頁檢查，入口 `return-studio.html`, `physics-presets.json`）目前狀態「檔案存在」「本輪是否執行：否」。
- `docs/BATCH_VALIDATION_TOOLING_TASKPACK.md`（VAL-004 任務包）明文排除本範圍：「不涵蓋 `VAL-003`…或 `VAL-005`（`return-studio.html` 研究頁）；本任務包範圍僅限 `VAL-004`」，並註明「VAL-003／VAL-005 需另開任務包」——本文件就是那個「另開的任務包」。
- 使用者同時點名舊草稿 `AI_CONTEXT/ARCHIVE/glm-batch-2026-07-06_07/validation_plan_draft.md` 的 `V-05 切球時機窗口取樣驗證`。該草稿的編號體系是舊的、跟現行 `VAL-00x` 編號不是同一套（草稿 V-04「回擊單拍批次驗證」才對應現行 VAL-005 的範圍；草稿 V-05 對應現行 `docs/VALIDATION_PLAN.md` 候選命令表的 `CMD-005 run-push-window-scan`，尚未建立）。為避免一次任務包混用兩種粒度的驗證，本計畫把它列為 Phase 2，不併入 Phase 1。

## 目的

建立 `return-studio.html` 的唯讀批次回擊驗證工具，讓「16 顆 preset × 技術」的過網／落點／成功判定可以一鍵重跑並輸出結構化結果，比照 VAL-003（`tools/serve-batch-validation.test.js`）的批次模式，同時延續 VAL-004 已確立的邊界：只做具名符號抽取，不整段執行 inline `<script>`。

## 範圍界定（先讀這段，再看下面的允許/禁止清單）

比對 `return-studio.html` 與 `game4.html` 原始碼後確認：兩邊的回擊公式族**真實分歧**，不是同一套的改名版本：

- push 技術：`return-studio.html` 用 `computeAdaptivePushLift()` / `computeAdaptivePushDrive()`（約 `return-studio.html:717-737`）+ `PADDLE_BLEND = 0.605`（`return-studio.html:297`）+ `bounceOffPlaneSubstepped()`（`return-studio.html:488`）；`game4.html` 用 `computeAdaptivePushMagnitude()` / `computeAdaptivePushTiltX()` / `computeAdaptivePushTiltY()`（`game4.html:1385-1411`）+ 五參數版 `bounceOffPlane()`（`game4.html:518`，無 blend 參數）。函式名稱與參數完全不同。
- `return-studio.html:349` 原始碼註解寫「（adaptivePush…）逐字對齊 game4.html」，但函式名稱對不上——**這是未查證的舊註解，本計畫不採信，列為待澄清項，不當作既定事實**。
- loop（拉球）技術已從 `return-studio.html` 的 `DEFAULT_TECHNIQUES` 整個移除（只剩 `forehand_attack`、`backhand_attack`、`push` 三個 key），跟 `game4.html` 仍保留舊 `model:'direct'` 版本不同。

因此本工具的批次結果**只能標記為「`return-studio.html` 研究頁自身結果」**，不可跟 `game4.html` 做逐點 cross-check 並宣稱一致或不一致——那樣會把兩套故意分歧的研究/正式公式族硬拿去比較，製造假訊號。兩者差異比對屬於 VAL-006（核心檔案同步差異檢查）或候選命令 `CMD-008 extract-research-constants` 的範圍，不是本任務包。

## 輸出檔案（計畫階段先定案，不留給實作時猜）

已確認 `tools/serve-batch-validation.test.js`（VAL-003）與 `tools/batch-validation.test.js`（VAL-004）的 `REPORT_FILE` / `DEFAULT_REPORT_FILE` 都硬編碼指向同一個路徑 `AI_CONTEXT/test_output.txt`，且都用 `fs.writeFileSync()`**整檔覆寫**——這代表現在依序跑這兩個腳本，後跑的會蓋掉先跑的報告，是已存在的真實問題，不是本任務包假設出來的風險。

為避免 VAL-005 變成第三個爭搶同一個檔案的腳本，本任務包**不共用** `AI_CONTEXT/test_output.txt`，改用獨立檔案 `AI_CONTEXT/val005_return_studio_test_output.txt`（同樣用 `writeFileSync` 整檔覆寫，因為只有 VAL-005 自己寫入，不會有跨腳本互蓋問題）。是否要回頭修正 VAL-003/VAL-004 的共用檔案問題，是另一個獨立任務，不在本計畫範圍內處理。

標準輸出（stdout）格式：批次跑完後用 `console.table()` 印出 `preset`、`technique`、`side`、`ok`、`reason` 欄位，方便人類在終端機一次看完 64 組結果（組合數見下方「階段二」的釐清結果），不用逐行讀 JSON。寫入檔案的仍是完整結構化 JSON／Markdown（比照 VAL-003 的報告格式），`console.table()` 只是終端機的輔助顯示，不取代檔案輸出。

## 允許新增的檔案

- `tools/load-return-studio-physics.js`（新增，唯讀整合層。`require('./load-game4-physics.js')` 重用其已 `module.exports` 的 `extractInlineScript` / `extractFunctionSource` / `extractConstantDefinition` / `fingerprintSource` / `normalizeSource`，不重新發明抽取邏輯）
- `tools/return-studio-batch-validation.test.js`（新增，批次驗證腳本，比照 `tools/serve-batch-validation.test.js` 的 16-preset 批次模式）
- `AI_CONTEXT/val005_return_studio_test_output.txt`（新增，獨立報告檔案，不共用 `AI_CONTEXT/test_output.txt`——理由見下方「輸出檔案」小節）

## 明確禁止

- 不新增或修改 `package.json`。目前 repo 內**沒有 `package.json`**（已確認），`VAL-003`／`VAL-004` 也都是直接用 `node tools/x.js` 執行，沒有走 npm scripts。是否要建立 `package.json` 統一管理驗證指令是獨立的結構性決定，不在本任務包範圍內夾帶，避免範圍蔓延；本計畫書「驗收命令」一律用明確的 `node tools/…` 指令記錄。
- 不修改 `return-studio.html`、`game4.html`、`shared-physics-core.js`、既有的 `tools/load-game4-physics.js`、`tools/serve-batch-validation.test.js`、`tools/batch-validation.test.js`、`AI_CONTEXT/test_output.txt`。
- 不建立整段執行 `return-studio.html` inline `<script>` 的機制（含 `vm` 執行整份腳本、`new Function()` 執行整份腳本等等價做法）。
- 不把本工具輸出的 `return-studio.html` 批次結果拿去跟 `game4.html` 做「是否一致」的 cross-check 判定（理由見上「範圍界定」）。
- 不把 `return-studio.html` 的研究機制（`PADDLE_BLEND`、`bounceOffPlaneSubstepped()`、`computeAdaptivePushLift/Drive()` 等）寫成 `game4.html` 已部署行為，報告中不得用「已證明」「最終解」「正式部署」描述研究頁結果。
- 不驗證「物理是否真實正確」，只驗證「16 顆 preset × 技術目前的過網、落桌、成功判定」這類可重跑的行為快照。
- Phase 1 不含 V-05 / `CMD-005`（切球時機窗口逐點取樣）；那是不同粒度的驗證，需另開任務包（見下方 Phase 2）。

## 實作要求

### Phase 1（本任務包範圍）：16 preset × 技術批次驗證

#### 階段一：`tools/load-return-studio-physics.js`

- `require('./load-game4-physics.js')` 取得低階抽取工具，用同一批工具讀取 `return-studio.html` 唯一的 inline `<script>`（`return-studio.html:271` 起），而非 `game4.html`。
- 抽取符號清單（依目前原始碼確認存在，實作時若已改版需重新核對行號與名稱）：
  - 函式：`simulateServe`、`simulatePath`、`findHitIndex`、`findPushHitIndex`、`simulateReturnForPreset`、`judgeResult`、`makeReturnVelocity`、`makeRacketReturnVelocity`、`bounceOffPlane`、`bounceOffPlaneSubstepped`、`computeBlendedNormal`、`computeAdaptivePushLift`、`computeAdaptivePushDrive`、`computeAdaptivePushTiltX`、`computeAdaptivePushTiltY`、`mirrorVec`、`mirrorSpin`。
  - 常數：`TECHNIQUES`（宣告方式是 `let TECHNIQUES = deepClone(DEFAULT_TECHNIQUES);`，不是 `game4.html` 那種 `const X = {字面量}`。已確認 `deepClone`（`return-studio.html:361`）就是 `function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }`——純 JSON 深拷貝，不含任何會改變數值的邏輯。因此**直接抽取 `DEFAULT_TECHNIQUES` 字面量即可代表 `TECHNIQUES` 的初始狀態**，不需要模擬執行 `deepClone`，也不需要額外的退回機制；只要在報告中註明「等同於 `TECHNIQUES` 的初始值，不含執行期間的動態修改」即可）、`PADDLE_BLEND`。
  - 依賴 `shared-physics-core.js` 的常數/函式（`TABLE`、`BALL_RADIUS` 等）：直接重用 `load-game4-physics.js` 既有的 `loadSharedCore()` / `evaluateSharedCoreValues()`，不重新讀取一份。
- 若抽取到的函式呼叫了清單外的輔助函式，工具必須顯式報錯並列出未覆蓋依賴。`load-game4-physics.js` 的 `instantiateGame4Symbols()` 已有這套依賴檢查機制，實作時評估能否重構成兩個 loader 共用的函式，而不是複製一份幾乎相同的邏輯。

#### 階段二：`tools/return-studio-batch-validation.test.js`

- **Step 0（先做靜態分析，再寫批次迴圈）**：已對照 `return-studio.html:1235-1240` 的 `syncSideLock()` 確認 `side` 與技術的對應關係：
  - `forehand_attack` → `side` 鎖定為 `'forehand'`（UI 選單停用，使用者無法改）。
  - `backhand_attack` → `side` 鎖定為 `'backhand'`（同上）。
  - `push` → `side` 選單**未鎖定**，`'forehand'`／`'backhand'` 都是合法輸入，UI 上使用者可自由切換。
  - 因此完整組合數是 `forehand_attack`(16) + `backhand_attack`(16) + `push × forehand`(16) + `push × backhand`(16) = **64 組**，不是原先粗估的 48 組（`push` 需要雙側都跑，`forehand_attack`/`backhand_attack` 各只有一側）。
  - 上述行號與行為是本計畫階段讀原始碼確認的結果；實作時 `return-studio.html` 若已變動，需重新核對 `syncSideLock()` 是否還是這個邏輯，不可假設行號永久不變。
- 讀取 `physics-presets.json` 的 16 顆 serve preset（與 VAL-003/VAL-004 同一批，不另建測試集）。
- 依 Step 0 確認的 64 組合，呼叫 `simulateReturnForPreset(preset, side, techniqueKey)` + `judgeResult(result)`。
- 輸出欄位比照 `docs/BATCH_VALIDATION_SPEC.md` 的 `run-return-batch` 定義：preset ID、技術名稱、`side`、回擊落點、過網高度、成功與否、失敗原因。`judgeResult()` 已回傳 `{ok, reason, firstBounce, netClearance}`，直接沿用即可，不必重新設計判定邏輯。
- 報告需在標題聲明「`return-studio.html` 研究頁批次結果，非 `game4.html` 正式驗收」，呼應 `docs/BATCH_VALIDATION_SPEC.md` 的非目的條款。
- **例外處理**：批次迴圈中每一組 `preset × technique × side` 都要包在 `try...catch` 裡。若單一組合模擬過程中丟出例外（例如數值運算錯誤、陣列越界、`undefined` 存取），該筆結果標記為 `{ok: false, reason: 'Exception: <錯誤訊息>'}` 並繼續跑下一組，不可讓單一極端值中斷整個批次；exit code 判斷（見階段三）不因單筆例外而立即視為腳本失敗，只在腳本本身無法啟動或讀不到 preset 檔案時才算腳本層級失敗。

#### 階段三：整合執行與報告輸出

- `node tools/return-studio-batch-validation.test.js` 一鍵執行；標準輸出用 `console.table()` 印出 `preset`、`technique`、`side`、`ok`、`reason` 欄位（見上方「輸出檔案」小節），方便一次檢視 64 組結果。
- 結果寫入 `AI_CONTEXT/val005_return_studio_test_output.txt`（獨立檔案，見上方「輸出檔案」小節，不寫入共用的 `AI_CONTEXT/test_output.txt`）。
- exit code 判準留給實作時跟人類確認：可以是「腳本本身執行無例外」為 0（不代表全部 preset×技術×side 都判定成功，因為部分組合設計上本來就可能不會成功，參照 VAL-003 個別 solver 門檻寬鬆的先例），不要在計畫階段預設一個「全部要 Pass」的硬性門檻。單筆組合的 `Exception` 標記（見上方例外處理）不等於腳本層級失敗。

### Phase 2（候選，不在本任務包範圍）：切球時機窗口取樣

- 對應 `docs/VALIDATION_PLAN.md` 候選命令 `CMD-005 run-push-window-scan`，以及使用者引用的舊草稿 `V-05 切球時機窗口取樣驗證`。
- 目標：沿彈跳後下降窗口逐點取樣切球，而不是只驗證 `findPushHitIndex()` 找到的單一擊球點，輸出每個取樣點的成功/失敗與旋轉方向。
- 舊草稿記錄過「196/516 樣本」等歷史數字，**未經本輪重新驗證，不可直接引用為現況**，需重跑才能確認。
- 依賴 Phase 1 的 loader（`simulatePath`、`TECHNIQUES.push` 等符號已抽取）。建議 Phase 1 完成並經人類確認後，再另開任務包做 Phase 2，不要在同一輪一次做完两种粒度不同的驗證。

## 驗收命令與標準

必跑：

```bash
node tools/load-return-studio-physics.js
node tools/return-studio-batch-validation.test.js
```

**驗證 1：整合層讀取測試**
- 抽取到的符號清單與上方「階段一」列出的一致，未覆蓋依賴為空。
- 輸出不含 THREE.js / canvas / DOM 物件痕跡。
- `TECHNIQUES` 抽取值的 `push.model` / `forehand_attack.model` 等欄位與原始碼一致。

**驗證 2：批次執行完整性**
- 64 組合（16 preset ×〔`forehand_attack` + `backhand_attack` + `push`×雙側〕，見「階段二」Step 0）全部產生結果，單筆例外不可讓整個批次中斷（比照上方「例外處理」的 `try...catch` 要求）。
- 失敗案例（`ok:false`，含 `Exception:` 開頭的例外案例）保留原始 `reason`，不可篩掉只顯示成功案例。

**驗證 3：邊界審查**
交付時附上：
- 對照本文件「範圍界定」逐條確認：未做 `game4` vs `return-studio` 的 cross-check 判定、未把研究機制寫成正式部署、未採信未查證的「逐字對齊」註解。
- 對照 `docs/BATCH_VALIDATION_SPEC.md` 非目的逐條確認。
- 確認未新建整段執行 `return-studio.html` inline script 的機制。

## 完成條件

- `tools/load-return-studio-physics.js` 與 `tools/return-studio-batch-validation.test.js` 皆可執行且行為符合上方規格。
- 驗證 1～3 全部通過並留有紀錄。
- `AI_CONTEXT/val005_return_studio_test_output.txt` 已更新為本次執行結果（64 組合）。
- 未修改「明確禁止」清單中的任何檔案（含未新增 `package.json`、未寫入共用的 `AI_CONTEXT/test_output.txt`）。
- `docs/VALIDATION_PLAN.md` 的 VAL-005 列狀態可回填為「已工具化」，`AI_CONTEXT/OPEN_ITEMS.md` 對應條目可視情況刪除或更新——由執行任務包的人/AI 之後回填，本計畫書不先行宣稱已完成。
- Phase 2（V-05 / `CMD-005` 窗口取樣）明確標記未完成，需另開任務包。

## 關聯文件

- `docs/BATCH_VALIDATION_SPEC.md`
- `docs/BATCH_VALIDATION_TOOLING_TASKPACK.md`（VAL-004 先例，本計畫沿用其結構與邊界原則）
- `docs/VALIDATION_PLAN.md`
- `AI_CONTEXT/OPEN_ITEMS.md`（工具化缺口章節）
- `AI_CONTEXT/ARCHIVE/glm-batch-2026-07-06_07/validation_plan_draft.md`（V-04/V-05 舊編號對照，僅供追溯，不代表現行編號）
