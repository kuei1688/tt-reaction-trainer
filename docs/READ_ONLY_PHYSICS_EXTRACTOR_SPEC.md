# 只讀核心物理抽取規格

> 本文件定義未來可建立的只讀抽取工具規格。它不是工具實作，也不修改核心程式。
>
> 建立日期：2026-07-06  
> 來源草稿：`AI_CONTEXT/DRAFTS/read_only_physics_extractor_spec_draft.md`

## 目的

建立一個只讀流程，用來抽取並比對 `game4.html`、`return-studio.html`、`physics-studio.html`、`physics-v2-calibration.html` 與 `tools/*.js` 中的核心物理常數與函式，防止文件把不存在、已取代或只存在研究頁的機制寫成正式遊戲行為。

抽取工具的輸出只負責提供可比對的事實材料，不負責判斷哪一版正確；後續是否升格為正式結論，仍要回到 `VALIDATION_PLAN.md`、`MODEL_DECISIONS.md` 與 `PHYSICS_MODEL_SPEC.md` 一起審查。

## 非目的

- 不修改任何核心檔案。
- 不執行軌跡模擬。
- 不判斷哪個版本物理上更正確。
- 不把 `return-studio.html` 的研究機制升格為 `game4.html` 已部署。
- 不把高 blend 或 `blend=0.9` 寫成最終物理解。

## 目標檔案

| 檔案 | 角色 | 抽取重點 |
|---|---|---|
| `game4.html` | 正式遊戲頁 | 正式回擊路徑、loop 舊模型殘留、桌面與球拍接觸常數 |
| `return-studio.html` | 回擊研究 / 調參工具頁 | blend、substepped push、研究版 adaptive push |
| `physics-studio.html` | 發球 preset / 發球物理工具頁 | 桌面反彈 v2 常數與發球解算入口 |
| `physics-v2-calibration.html` | 桌面反彈校準頁 | 校準用常數、公式與測試入口 |
| `tools/*.js` | Node 驗證腳本 | 可重跑驗證中的核心公式與測試輸出 |

## 抽取常數類別

| 類別 | 例子 | 狀態規則 |
|---|---|---|
| 桌面反彈 v2 | `EPSILON_VERTICAL`, `EPSILON_OBLIQUE`, `EPSILON_MIN`, `SPIN_EPSILON_REFERENCE`, `CONTACT_FRICTION_MU` | 若多檔一致，仍只能寫「關鍵字/值一致」，不能宣稱逐字相同 |
| 球拍接觸 | `PADDLE_RESTITUTION_LOW`, `PADDLE_RESTITUTION_HIGH`, `PADDLE_FRICTION` | 需標明正式頁或工具頁 |
| 舊模型殘留 | `PADDLE_RESTITUTION` | 必須標成舊模型殘留，尤其 loop |
| adaptive push | `PUSH_LIFT_K`, `PUSH_DRIVE_K`, `PUSH_TILT_Y`, `PUSH_WRIST_BRAKE_RATE` | 不同檔案分開列出 |
| 研究機制 | `PADDLE_BLEND`, `PADDLE_SPRING_K`, `PADDLE_DAMPING_RATIO` | 預設標成研究 / 工具頁行為 |

## 抽取函式類別

| 類別 | 例子 | 注意事項 |
|---|---|---|
| 桌面反彈 | `dynamicEpsilon()`, `bounceTangentialAxis()`, `bounceWithSpinPhysical()` | 比對簽名與函式片段 hash |
| 球拍接觸 | `dynamicPaddleEpsilon()`, `bounceOffPlane()`, `makeRacketReturnVelocity()` | 注意參數數量與 blend 參數差異 |
| 瞄準 / 解算 | `solveRacketVelXForTargetLandingX()`, 發球 solve 相關函式 | 需標明入口檔案 |
| adaptive push | `computeAdaptivePushMagnitude()`, `computeAdaptivePushLift()`, `computeAdaptivePushDrive()`, tilt 公式族 | 不可混成同一套公式 |
| 研究函式 | `computeBlendedNormal()`, `bounceOffPlaneSubstepped()` | 預設研究中 |

## JSON 報告最低格式

```json
{
  "metadata": {
    "generated_at": "YYYY-MM-DD",
    "files_scanned": []
  },
  "constants": [
    {
      "name": "CONTACT_FRICTION_MU",
      "category": "table_bounce_v2",
      "status": "已核對正式行為 / 研究工具頁行為 / 待驗證 / 舊模型殘留",
      "values": {
        "game4.html": "0.13",
        "return-studio.html": "not_found"
      },
      "notes": []
    }
  ],
  "functions": [
    {
      "name": "bounceOffPlane",
      "category": "paddle_contact",
      "signatures": {},
      "body_hashes": {},
      "status": "待驗證",
      "notes": []
    }
  ],
  "warnings": []
}
```

## Markdown 報告最低格式

- 常數差異摘要表。
- 函式簽名差異摘要表。
- 僅存在於研究頁的機制列表。
- 舊模型殘留列表。
- 需要人工審查的警告列表。
- 明確聲明：本報告不判斷物理正確性。

## 驗收標準

1. 執行後不修改任何被掃描檔案。
2. 能列出每個目標檔案中指定常數是否存在與值。
3. 能列出指定函式是否存在、簽名與片段 hash。
4. 報告必須保留 `game4.html` 與 `return-studio.html` 的檔案邊界。
5. 報告不得使用「已證明」「最終解」「正式部署」描述研究頁內容。
6. 失敗時輸出清楚的 missing / parse_failed，而不是靜默略過。

## 第一版建議範圍

第一版只做 L1 抽取，不做 AST 完整語意分析：

- 讀檔。
- 用保守規則尋找 top-level `const` / `let` / `function` / arrow function。
- 輸出存在性、值、簽名與 body hash。
- 產生 JSON 與 Markdown 報告。

## 不可下結論事項

- 不可判斷 `bounceOffPlaneSubstepped()` 比瞬時碰撞模型更正確。
- 不可判斷 `PADDLE_BLEND = 0.65` 是否合理或最終。
- 不可把 `physics-studio.html` 註解中的逐字對齊當成已驗證事實。
- 不可把單次抽取結果當成完整物理驗證。

## 關聯文件

- `docs/CORE_FILE_SYNC_STATUS.md`
- `docs/VALIDATION_PLAN.md`
- `docs/PHYSICS_MODEL_SPEC.md`
- `docs/MODEL_DECISIONS.md`
- `AI_CONTEXT/DRAFTS/read_only_physics_extractor_spec_draft.md`
