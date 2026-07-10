# Shared Physics Core 階段一批准包

## 目的

這份文件是構想一的階段一批准包，只整理一小批已驗證「跨檔案一致」且「非研究專屬」的物理符號，供人類決定是否進入下一階段重構。

階段一邊界：

- 不修改 `game4.html`
- 不修改 `physics-studio.html`
- 不修改 `return-studio.html`
- 不修改 `shared-physics-core.js`

## 已收集證據

驗證日期：`2026-07-09`

批准狀態：`已批准`

批准來源：使用者於 `2026-07-09` 明確回覆「批准」。

守門員命令：

```bash
node tools/cross-file-consistency-check.js
```

執行結果：

```text
Consistency check passed: 6 constant rule(s), 2 function rule(s).
```

補充修正：

- `tools/consistency-whitelist.json` 已補上 `return-studio.html` 的 `dynamicEpsilon()` 與 `bounceTangentialAxis()` 函式比對，避免批准證據列出三檔、守門員實際只驗兩檔。

白名單來源：

- `tools/consistency-whitelist.json`

相關符號位置：

- `game4.html:239-244`, `game4.html:506`, `game4.html:517`
- `physics-studio.html:363-368`, `physics-studio.html:685`, `physics-studio.html:695`
- `return-studio.html:283-288`, `return-studio.html:405`, `return-studio.html:415`

## 建議批准的第一批抽取範圍

目前只建議把「桌面反彈 v2 核心」中的下列符號列入未來可抽取範圍。

### 常數

下列值已確認在 `game4.html`、`physics-studio.html`、`return-studio.html` 三檔一致：

| 符號 | 值 |
|---|---:|
| `EPSILON_VERTICAL` | `0.876` |
| `EPSILON_OBLIQUE` | `0.57` |
| `EPSILON_MIN` | `0.45` |
| `SPIN_EPSILON_REFERENCE` | `6.0` |
| `CONTACT_FRICTION_MU` | `0.13` |

### 函式

下列函式已用標準化後的內容比對確認一致：

| 符號 | 指紋 | 行數 |
|---|---|---:|
| `dynamicEpsilon` | `sha1:2ea0c04710` | `10` |
| `bounceTangentialAxis` | `sha1:c2d211d423` | `13` |

## 明確排除於階段一之外

下列符號或機制不在這一批批准範圍內：

- `PADDLE_BLEND`
- `computeBlendedNormal()`
- `bounceOffPlaneSubstepped()`
- `PUSH_WRIST_BRAKE_RATE`
- 所有 adaptive push 公式族
- 所有球拍接觸常數，例如 `PADDLE_RESTITUTION_*`、`PADDLE_FRICTION`，以及相關瞄準/回擊邏輯
- 所有 loop / direct model 邏輯
- 所有尚未被目前守門員白名單覆蓋的符號

排除理由：

- 它們屬於研究專屬、檔案專屬，或尚未完成「一致且非特化」驗證。

## 人類批准請求

請明確批准或否決下列階段一抽取範圍：

1. 只批准上方五個桌面反彈常數。
2. 只批准 `dynamicEpsilon()` 與 `bounceTangentialAxis()`。
3. 保持所有研究專屬或球拍專屬符號不進入第一批重構。

## 階段二觸發條件

這份清單已獲人類明確批准。下一步應另開可修改核心檔案的任務包來：

- 將批准符號移入 `shared-physics-core.js`
- 修改 `game4.html`、`physics-studio.html` 與其他獲准 consumer
- 重跑 `node tools/cross-file-consistency-check.js`
- 重跑既有 Node 驗證/測試，確認行為不變
