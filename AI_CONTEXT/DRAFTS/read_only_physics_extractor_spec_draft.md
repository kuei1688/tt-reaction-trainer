# DRAFT: Read-only physics extractor spec
#
# Status: draft only.
# This file is a working spec candidate for review and must not be treated as source of truth.
# Last touched: 2026-07-06

# 只讀核心函式 / 常數抽取工具規格草稿

> 本文件為「只讀核心函式 / 常數抽取工具」的規格草稿。工具僅進行檔案讀取與比對，不修改任何檔案，不新增事實，不做最終物理判斷。
> 整理基準：2026-07-06

## 1. 工具目的與非目的

### 目的
- 只讀抽取並比對指定核心檔案中的物理常數與函式定義。
- 產出結構化報告（JSON 與 Markdown），標示各檔案間的常數值差異與函式簽名/實作差異。
- 防止文件引用不存在的函式或常數（驗證層級 L1：檔案與常數存在性）。
- 釐清正式遊戲頁與研究/工具頁的機制差異，避免跨版本混用。

### 非目的
- **不**修改任何核心檔案或產生新的程式碼。
- **不**執行任何物理模擬或軌跡計算。
- **不**判斷哪一個檔案的物理模型版本較為正確。
- **不**將研究/工具頁的行為自動升格為正式遊戲已部署行為。
- **不**對高 blend 值或舊模型殘留常數進行最終物理決策。

## 2. 需比較的檔案

本工具需針對以下檔案進行只讀抽取與比對：

| 檔案 | 角色 | 狀態備註 |
|---|---|---|
| `game4.html` | 正式遊戲頁 | 包含回擊選擇與遊戲 UI，含舊 loop 模型殘留 |
| `return-studio.html` | 回擊研究/調參工具頁 | 含 blend / substepped push 研究機制 |
| `physics-studio.html` | 發球 preset/物理工具頁 | 註解宣稱桌面反彈 v2 逐字對齊 |
| `physics-v2-calibration.html` | 桌面反彈校準頁 | 尚未完整人工核對 |
| `tools/*.js` | Node 驗證腳本 | 包含 `tools/physics-v2-contact-mechanics.js`、`tools/racket-contact-mechanics.js` 等 |

## 3. 應抽取的常數類別與函式類別

所有抽取項目必須標註狀態：`已核對正式行為`、`研究/工具頁行為`、`待驗證/待決策`、`已取代/舊模型殘留`。

### 3.1 應抽取的常數類別
- **桌面反彈 v2 常數**：`EPSILON_VERTICAL`、`EPSILON_OBLIQUE`、`EPSILON_MIN`、`OBLIQUE_ANGLE_DEG`、`SPIN_EPSILON_REFERENCE`、`CONTACT_FRICTION_MU`。
- **球拍接觸常數**：`PADDLE_RESTITUTION_LOW`、`PADDLE_RESTITUTION_HIGH`、`PADDLE_SPEED_LOW`、`PADDLE_SPEED_HIGH`、`PADDLE_FRICTION`。
- **舊模型殘留常數**：`PADDLE_RESTITUTION`（`-0.9`，需標示為 `已取代/舊模型殘留`）。
- **Adaptive push 常數**：`PUSH_LIFT_K`、`PUSH_DRIVE_K`、`PUSH_TILT_Y`、`PUSH_WRIST_BRAKE_RATE`。
- **研究/工具頁常數**：`PADDLE_BLEND`（如 `0.65`）、`PADDLE_SPRING_K`、`PADDLE_DAMPING_RATIO`（需標示為 `研究/工具頁行為`）。

### 3.2 應抽取的函式類別
- **桌面反彈函式**：`dynamicEpsilon()`、`bounceTangentialAxis()`、`bounceWithSpinPhysical()`。
- **球拍接觸函式**：`dynamicPaddleEpsilon()`、`bounceOffPlane()`、`makeRacketReturnVelocity()`、`solveRacketVelXForTargetLandingX()`。
- **Adaptive push 公式族**：
  - `game4.html` 版本：`computeAdaptivePushMagnitude(incomingVel, contactZ, topspin)`、`computeAdaptivePushTiltX(incomingVel)`、`computeAdaptivePushTiltY(topspin)`。
  - `return-studio.html` 版本：`computeAdaptivePushLift(incomingVel)`、`computeAdaptivePushDrive(incomingVel)`、`computeAdaptivePushTiltX()`、`computeAdaptivePushTiltY()`。
- **研究/工具頁函式**：`computeBlendedNormal()`、`bounceOffPlaneSubstepped()`（需標示為 `研究/工具頁行為`）。

## 4. JSON 報告格式

```json
{
  "metadata": {
    "generated_at": "YYYY-MM-DD",
    "tool_version": "read-only-extractor-draft-v1",
    "files_scanned": [
      "game4.html",
      "return-studio.html",
      "physics-studio.html",
      "physics-v2-calibration.html",
      "tools/*.js"
    ]
  },
  "constants": [
    {
      "name": "EPSILON_VERTICAL",
      "status": "已核對正式行為",
      "values": {
        "game4.html": "0.876",
        "physics-studio.html": "0.876",
        "return-studio.html": "not_found"
      },
      "is_consistent": true
    },
    {
      "name": "PADDLE_BLEND",
      "status": "研究/工具頁行為",
      "values": {
        "return-studio.html": "0.65",
        "game4.html": "not_found"
      },
      "is_consistent": false
    }
  ],
  "functions": [
    {
      "name": "computeAdaptivePushMagnitude",
      "status": "已核對正式行為",
      "signatures": {
        "game4.html": "computeAdaptivePushMagnitude(incomingVel, contactZ, topspin)",
        "return-studio.html": "not_found"
      }
    },
    {
      "name": "bounceOffPlaneSubstepped",
      "status": "研究/工具頁行為",
      "signatures": {
        "return-studio.html": "bounceOffPlaneSubstepped()",
        "game4.html": "not_found"
      }
    }
  ]
}
```

## 5. Markdown 報告格式

```markdown
# 核心檔案同步差異報告

> 產生日期：YYYY-MM-DD
> 工具：只讀核心函式 / 常數抽取工具
> 註：本報告僅呈現檔案抽取差異，不做物理正確性判斷。

## 1. 常數差異摘要

| 常數名稱 | 狀態 | game4.html | return-studio.html | physics-studio.html | 備註 |
|---|---|---|---|---|---|
| `EPSILON_VERTICAL` | 已核對正式行為 | 0.876 | - | 0.876 | 關鍵字一致 |
| `PADDLE_BLEND` | 研究/工具頁行為 | - | 0.65 | - | 僅存在於研究頁 |
| `PADDLE_RESTITUTION` | 已取代/舊模型殘留 | -0.9 | - | - | 僅 loop 使用 |

## 2. 函式差異摘要

| 函式名稱 | 狀態 | game4.html | return-studio.html | 備註 |
|---|---|---|---|---|
| `computeAdaptivePushMagnitude` | 已核對正式行為 | 存在 (3 參數) | - | 僅正式頁有此公式 |
| `computeAdaptivePushLift` | 研究/工具頁行為 | - | 存在 | 研究頁自適應力道 |
| `bounceOffPlaneSubstepped` | 研究/工具頁行為 | - | 存在 | 研究頁子步機制 |

## 3. 警告與待驗證事項
- [待驗證/待決策] `physics-studio.html` 註解宣稱逐字對齊，需以工具化 diff 進一步驗證。
- [已取代/舊模型殘留] `game4.html` 的 `loop` 技術仍使用舊 `model:'direct'` 路徑。
```

## 6. 驗收標準

1. **只讀性**：工具執行過程不可產生任何寫入操作，不可修改 `game4.html` 等任何目標檔案。
2. **存在性驗證**：正確識別出目標常數與函式在指定檔案中是否存在。
3. **狀態標示**：所有輸出的常數與函式必須帶有狀態標籤（`已核對正式行為`、`研究/工具頁行為`、`待驗證/待決策`、`已取代/舊模型殘留`）。
4. **無物理判斷**：報告中不可包含「哪個檔案版本較正確」或「某常數值是否合理」的結論。
5. **無混用**：`game4.html` 與 `return-studio.html` 的抽取結果必須獨立列出，不可在報告中合併為同一套行為。
6. **格式正確**：成功產生符合定義的 JSON 與 Markdown 報告。

## 7. 風險與不可下結論事項

### 風險
- **解析失敗**：若檔案內的 JS 寫法非標準或被壓縮，可能導致常數或函式簽名抽取失敗。
- **註解依賴**：若僅靠註解宣稱「逐字對齊」而未做實際字串 diff，可能遺漏實作差異。

### 不可下結論事項
1. 不可判斷 `return-studio.html` 的 `bounceOffPlaneSubstepped()` 比 `game4.html` 的瞬時碰撞模型更正確。
2. 不可判斷 `PADDLE_BLEND = 0.65` 是合理或最終值。
3. 不可把高 blend 或 `blend=0.9` 當成最終物理解。
4. 不可把 `return-studio.html` 的研究工具功能寫成正式遊戲已部署。
5. 不可將 GLM 草稿中的「已部署」或「可重跑」直接當真，必須以工具抽取結果為準。

## 8. 建議正式 docs 章節

基於本工具產出的結果，建議在正式文件中維護以下章節：

- **`docs/CORE_FILE_SYNC_STATUS.md`**
  - 新增「自動化抽取差異報告」章節：放置本工具產生的 Markdown 報告，取代純人工核對紀錄。
  - 更新「已核對差異」與「不可直接下結論」清單。
- **`docs/PHYSICS_MODEL_SPEC.md`**
  - 維持三分法結構：「已核對正式行為」、「研究/工具頁行為」、「待驗證/待決策事項」。
  - 在相關章節嵌入工具產出的 JSON 連結或常數對照表，明確標示 `game4.html` 與 `return-studio.html` 的版本差異。
# DRAFT: Read-only physics extractor spec
#
# Status: draft only.
# This file is a working spec candidate for review and must not be treated as source of truth.
# Last touched: 2026-07-06
