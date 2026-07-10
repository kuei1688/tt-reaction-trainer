# Claude 審查包：一致性守門員

## 審查目標

請審查這次新增的唯讀守門員工具，確認：

1. 腳本沒有任何寫入行為，只會讀檔與輸出結果。
2. 白名單語意清楚，`must_not_appear_in` 的邊界沒有含糊推論。
3. 驗證結論成立，且不需要修改核心 HTML 檔案。

## 請查看的檔案

- `tools/cross-file-consistency-check.js`
- `tools/consistency-whitelist.json`

## 設計摘要

- 腳本用途：解析 HTML 內 inline script，抽取白名單指定的常數或函式，檢查跨檔一致性。
- 比對規則：
  - `expected_match: true`：比對指定檔案中的值或函式原文，不一致則報 `MISMATCH`
  - `must_not_appear_in`：若符號出現在禁止檔案中則報 `UNEXPECTED_PRESENCE`
- 失敗類型：`MISMATCH`、`MISSING`、`UNEXPECTED_PRESENCE`
- 結果行為：有任一失敗即 `exit 1`，否則 `exit 0`
- CLI 參數：
  - `--whitelist <path>`
  - `--root <path>`

## 已執行驗證

### 1. 基線測試

命令：

```powershell
node tools/cross-file-consistency-check.js
```

結果：

```text
Consistency check passed: 5 constant rule(s), 2 function rule(s).
```

備註：

- 初版白名單曾包含 `bounceWithSpinPhysical`
- 基線第一次執行時發現 `game4.html` 與 `physics-studio.html` 的函式內容本來就不同
- 因此已把它從 baseline 白名單移除，這是白名單收斂，不是核心程式修正

### 2. 破壞性測試

做法：

- 複製 `game4.html` 到 `AI_CONTEXT/DRAFTS/game4_test_copy.html`
- 只修改副本中的 `EPSILON_VERTICAL`
- 用暫存白名單改讀副本與 `physics-studio.html`

測試命令：

```powershell
node tools/cross-file-consistency-check.js --whitelist AI_CONTEXT/DRAFTS/consistency-whitelist-destructive-test.json
```

結果：

```text
Consistency check failed with 1 issue(s).
MISMATCH [constant] EPSILON_VERTICAL:
  baseline:  AI_CONTEXT/DRAFTS/game4_test_copy.html (aa63f06d9a, 1 line(s))
  candidate: physics-studio.html (9960ab33d0, 1 line(s))
  first diff: line 1: "0.777" vs "0.876"
```

還原：

- 上述副本與暫存白名單已刪除
- 正式 repo 只留下 `tools/cross-file-consistency-check.js` 與 `tools/consistency-whitelist.json`

## 想請你明確回答

1. 這支腳本是否確實是唯讀工具，有沒有任何隱性寫入風險？
2. `must_not_appear_in` 的 schema 與判定邏輯是否足夠清楚、安全？
3. 目前這份白名單與驗證流程，是否存在容易誤報或漏報的邊界條件？
