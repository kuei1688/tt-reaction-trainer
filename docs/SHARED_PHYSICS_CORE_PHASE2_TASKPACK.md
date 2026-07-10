# Shared Physics Core 階段二任務包

## 觸發來源

階段一批准包已於 `2026-07-09` 獲人類明確批准：

- `docs/SHARED_PHYSICS_CORE_PHASE1_APPROVAL.md`

本任務包是階段二的核心檔案修改授權範圍。只有本文件列出的符號與檔案可進入這一批重構。

## 允許修改的檔案

本階段允許修改：

- `shared-physics-core.js`
- `game4.html`
- `physics-studio.html`
- `return-studio.html`
- `tools/consistency-whitelist.json`，僅限必要時更新守門員規則
- `tools/cross-file-consistency-check.js`，僅限支援 `shared-physics-core.js` 這類 `.js` 檔案作為白名單比對來源
- 驗證或任務文件，僅限記錄本次重構結果

守門員策略選擇：

- 本階段採用「維持強檢查」策略：允許對 `tools/cross-file-consistency-check.js` 做極小改動，讓白名單能真正指向 `shared-physics-core.js`。
- 不採用只對三個 HTML 做 `must_not_appear_in` 的降級策略。

## 批准抽取的符號

### 常數

- `EPSILON_VERTICAL`
- `EPSILON_OBLIQUE`
- `EPSILON_MIN`
- `SPIN_EPSILON_REFERENCE`
- `CONTACT_FRICTION_MU`

### 函式

- `dynamicEpsilon()`
- `bounceTangentialAxis()`

## 明確禁止納入本階段

- `PADDLE_BLEND`
- `computeBlendedNormal()`
- `bounceOffPlaneSubstepped()`
- `PUSH_WRIST_BRAKE_RATE`
- 所有 adaptive push 公式族
- 所有球拍接觸常數與回擊/瞄準邏輯
- 所有 loop / direct model 邏輯
- 任何未被階段一批准包列出的物理符號

## 實作要求

1. 新增 `shared-physics-core.js`，放入已批准的常數與函式。
2. 在 `game4.html`、`physics-studio.html`、`return-studio.html` 的 inline physics script 前載入 `shared-physics-core.js`。
3. 從三個 HTML 檔移除已抽取符號的重複定義。
4. 保持函式內容與現有版本標準化後一致，不做公式調整。
5. 不改變任何 preset、UI、研究參數或回擊邏輯。
6. 更新守門員腳本，使其能從 `.js` 檔讀取符號，並讓白名單比對 `shared-physics-core.js` 中的批准符號。

## 本階段刻意排除的既有副本

下列檔案可能仍保有相似或歷史用途的 `dynamicEpsilon()` / `bounceTangentialAxis()` 副本，但不屬於本次收斂範圍：

- `physics-v2-calibration.html`
- `tools/racket-contact-mechanics.js`
- `tools/physics-v2-contact-mechanics.js`

本階段只鎖定三個線上 HTML 頁面與新增的 `shared-physics-core.js`。因此，Phase 2 完成後不得宣稱「所有 consumer 都已收斂到 shared core」。

## 驗收命令

必跑：

```bash
node tools/cross-file-consistency-check.js
```

必跑 inline JavaScript 語法檢查：

```bash
node -e "const fs=require('fs'); for (const file of ['shared-physics-core.js','game4.html','physics-studio.html','return-studio.html']) { const text=fs.readFileSync(file,'utf8'); if (file.endsWith('.js')) new Function(text); else [...text.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()).forEach(code=>new Function(code)); } console.log('shared core and inline JS syntax OK');"
```

若 repo 中存在可用 Node 測試或批次驗證腳本，也必須一併執行並記錄結果。

## 完成條件

- 三個 HTML 檔不再各自定義本批已抽取符號。
- `shared-physics-core.js` 中的本批符號仍由守門員做值/函式內容比對。
- 守門員腳本通過。
- inline JS 語法檢查通過。
- 未納入任何研究專屬或球拍專屬機制。
- 重構說明清楚記錄本次只處理桌面反彈 v2 核心最小集合。
