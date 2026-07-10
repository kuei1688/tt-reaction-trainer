# 批次驗證腳本工具化任務包

## 觸發來源

原始計畫（「批次驗證腳本工具化」）經 Claude 邊界審查後修正。原始草稿的 Phase 1 提案是把 `game4.html` 的整段 inline `<script>` 丟進 Node `vm` 模組執行，經核對發現：

- `game4.html` 只有一個 inline `<script>`（`game4.html:223` 起），物理函式與 DOM/THREE.js 渲染程式碼混在同一個 top-level scope。
- `game4.html:330` 起有 `document.getElementById('scene')`、`new THREE.WebGLRenderer(...)` 等 top-level 副作用，且早於 `bounceOffPlane()`（`game4.html:546`）、`makeRacketReturnVelocity()`（`game4.html:1442`）等物理函式的宣告位置。
- 整段執行必定在 `document is not defined` / `THREE is not defined` 處中止，除非另建 DOM/THREE stub 層——這本身就是對「哪些副作用可以被假裝」下判斷，違反唯讀、不下物理判斷的邊界。

同時發現：`shared-physics-core.js` 已於 2026-07-09 經人類批准建立（見 `docs/SHARED_PHYSICS_CORE_PHASE1_APPROVAL.md`），是乾淨、無 DOM 依賴、可直接 `require()` 的 Node 模組；`docs/BATCH_VALIDATION_SPEC.md` 的「最小可行版本」也已建議把 `tools/physics-v2-contact-mechanics.js` 與 `tools/racket-contact-mechanics.js` 納入固定流程。本任務包改為整合這三個既有來源，取代原本的 vm 沙箱提案。

## 目的

建立自動化 Node.js 測試腳本，把發球與回擊物理行為的驗證從「瀏覽器 console 手動測」轉為「一鍵執行的測試套件」，確保未來改動不會弄壞既有物理邏輯。

## 允許新增的檔案

- `tools/load-game4-physics.js`（新增，唯讀整合層）
- `tools/batch-validation.test.js`（新增，測試套件）
- `AI_CONTEXT/test_output.txt`（覆寫，測試結果輸出）

## 明確禁止

- 不修改 `game4.html`、`shared-physics-core.js`、`tools/physics-v2-contact-mechanics.js`、`tools/racket-contact-mechanics.js`、`return-studio.html`、`physics-studio.html`。
- 不建立任何整段執行 `game4.html` inline `<script>` 的機制（含 `vm` 模組執行整份腳本、`new Function()` 執行整份腳本等等價做法）。
- 不涵蓋 `VAL-003`（發球，入口含 `physics-studio.html`）或 `VAL-005`（`return-studio.html` 研究頁）；本任務包範圍僅限 `VAL-004`（`game4.html` 正式回擊）。
- 不把 `return-studio.html` 的研究機制（`PADDLE_BLEND`、`computeBlendedNormal()`、`bounceOffPlaneSubstepped()`、`computeAdaptivePushLift/Drive()` 等）寫成 `game4.html` 已部署行為。
- 不驗證「物理是否真實正確」，只驗證「現有行為是否保持不變」。

## 實作要求

### 階段一：`tools/load-game4-physics.js`（唯讀符號整合層）

按優先順序取用來源，不重複發明抽取機制：

1. 已在 `shared-physics-core.js` 的符號（`EPSILON_VERTICAL`、`EPSILON_OBLIQUE`、`EPSILON_MIN`、`SPIN_EPSILON_REFERENCE`、`CONTACT_FRICTION_MU`、`dynamicEpsilon()`、`bounceTangentialAxis()`）→ 直接 `require('../shared-physics-core.js')`。
2. 球拍接觸力學（`game4.html` 註解聲明逐字對齊的部分）→ 直接 `require('./physics-v2-contact-mechanics.js')` 與 `require('./racket-contact-mechanics.js')`，把輸出當作 `game4.html` 對應行為的代理。
3. 前兩類未覆蓋、但仍需驗證的符號 → 逐符號抽取，延伸 `tools/cross-file-consistency-check.js` 既有的 `extractFunctionSource()` / `extractConstantValue()`（`tools/cross-file-consistency-check.js:288` 起），只抓該符號原始碼片段做靜態比對，不執行整段腳本。
4. 若第 3 類函式內部呼叫其他未抽取的輔助函式，工具必須偵測依賴並顯式報錯（列出未覆蓋的依賴名稱），不可靜默略過。

### 階段二：`tools/batch-validation.test.js`（測試框架與案例）

- 引入 `load-game4-physics.js`。
- 測試案例對應 EXP-001~038 中已確認的物理行為，依 `docs/BATCH_VALIDATION_SPEC.md` 點名的三個技術分支分組，不可籠統合併：
  - `attack`：`bounceOffPlane()` / `makeRacketReturnVelocity()` 路徑。
  - `push`：只驗證 `game4.html` 公式族（`computeAdaptivePushMagnitude`/`computeAdaptivePushTiltX`/`Y`），明確標註不涵蓋 `return-studio.html` 對應公式。
  - `loop`：明確標註仍是舊 `model:'direct'` 路徑，非球拍接觸力學，不可與 `attack`/`push` 共用斷言邏輯。

### 階段三：整合執行與報告輸出

- `node tools/batch-validation.test.js` 一鍵執行。
- 標準輸出含「測試名稱、預期結果、實際結果、Pass/Fail」。
- 結果另寫入 `AI_CONTEXT/test_output.txt`。
- exit code：0 為全通過，1 為有失敗。

## 驗收命令與標準

必跑：

```bash
node tools/load-game4-physics.js
node tools/batch-validation.test.js
```

**驗證 1：整合層讀取測試**
- 來源 1、2 類符號的值與 `docs/CORE_FILE_SYNC_STATUS.md` / `docs/SHARED_PHYSICS_CORE_PHASE1_APPROVAL.md` 記載一致。
- 來源 3 類符號的抽取結果標明「來自逐符號抽取」，並列出所有偵測到但未覆蓋的依賴。
- 輸出 JSON 格式，且不含任何整段執行 `game4.html` 的痕跡（不應出現 THREE/canvas 相關物件）。

**驗證 2：基線測試對齊**
- 所有測試案例須 Pass。
- 結果需與舊有手動 console 測試紀錄、`tools/physics-v2-contact-mechanics.js`、`tools/racket-contact-mechanics.js` 的既有輸出相符。
- Fail 代表整合層抽取有誤，修正腳本，不可改 HTML。

**驗證 3：破壞性隔離測試**
1. 將 `game4.html` 複製到 scratch 目錄（例如 `AI_CONTEXT/DRAFTS/game4_mock.html`），確認該路徑已被 `.gitignore` 排除，或事後 `git status` 確認乾淨無殘留。
2. 在副本中修改一個關鍵反彈常數。
3. 用顯式參數（例如 `--source-file`）指向副本，不修改預設路徑常數，避免不小心指向真正的 `game4.html`。
4. 預期：批次測試偵測到行為改變，對應案例標記 Fail，exit code 為 1。
5. 還原：刪除副本，不碰真正的 `game4.html`。

**驗證 4：Claude 邊界審查**
交付時附上：
- 對照 `docs/BATCH_VALIDATION_SPEC.md` 的「非目的」逐條確認。
- 對照 `docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md` 驗收標準第 5 點，確認報告未使用「已證明」「最終解」「正式部署」等字眼描述 `return-studio.html`。
- 確認未新建任何整段執行 `game4.html` inline script 的機制。

## 完成條件

- `tools/load-game4-physics.js` 與 `tools/batch-validation.test.js` 皆可執行且 exit code 正確。
- 驗證 1~4 全部通過並留有紀錄。
- `AI_CONTEXT/test_output.txt` 已更新為本次執行結果。
- 未修改任何「明確禁止」清單中的檔案。
- 範圍明確記錄為只涵蓋 `VAL-004`，`VAL-003`／`VAL-005` 需另開任務包。

## 關聯文件

- `docs/BATCH_VALIDATION_SPEC.md`
- `docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md`
- `docs/CORE_FILE_SYNC_STATUS.md`
- `docs/SHARED_PHYSICS_CORE_PHASE1_APPROVAL.md`
- `docs/SHARED_PHYSICS_CORE_PHASE2_TASKPACK.md`
- `docs/PLAN_DRAFTING_CHECKLIST.md`
