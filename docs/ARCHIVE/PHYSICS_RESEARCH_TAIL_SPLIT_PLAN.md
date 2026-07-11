# 研究尾段拆解計畫

> 本文件定義如何把 `docs/physics-engine-v2-plan.md` 後段的混雜歷史內容拆分到正式 docs 與 GLM 任務包中。它是整理規則，不是物理解釋。
>
> 建立日期：2026-07-06  
> 來源草稿：`AI_CONTEXT/DRAFTS/physics_plan_research_tail_split_draft.md`

## 目的

把後段研究內容拆成可追蹤條目，並讓每條條目落到適當的文件：Experiment Log、Model Decisions、Physics Spec、Validation Plan。

## 非目的

- 不新增新的物理解。
- 不把研究頁結果升格成正式遊戲已部署。
- 不把單次成功率當成決策。
- 不把未驗證的高 blend 寫成最終解。

## 分流規則

| 目標文件 | 收納內容 | 必要標示 |
|---|---|---|
| `docs/EXPERIMENT_LOG.md` | 測試、搜尋、原型驗證 | EXP 編號、日期、模型版本、測試集、失敗案例 |
| `docs/MODEL_DECISIONS.md` | 架構方向、公式取捨、待決策 | DEC / RES / TODO、適用範圍、風險與待驗證事項 |
| `docs/PHYSICS_MODEL_SPEC.md` | 公式、常數、接觸力學模型 | 已核對正式行為 / 研究工具頁行為 / 待驗證 |
| `docs/VALIDATION_PLAN.md` | 驗證需求、批次檢查、聯合指標 | VAL / CMD 編號、本輪是否執行、可重跑性 |

## 必保留狀態

- `研究中`。
- `待驗證`。
- `已取代`。
- `不確定`。

這些狀態不能被整理成「已完成」或「已部署」而消失。

## 高風險字眼

以下字眼需要特別小心，容易把研究內容誤導為正式結論：

- 已完成
- 已套用
- 可重跑
- 正式遊戲已部署
- 最終物理解
- 風險：無

## 建議 GLM 任務包

- 後段實驗條目抽取。
- 決策與待辦項目盤點。
- Physics Spec 三分類草稿。
- 驗證缺口對應。

## 優先拆分群組

1. `blend` 群組：涵蓋 `blend`、`PADDLE_BLEND`、`bounceTwoPhaseBlend`、`computeBlendedNormal`，優先對應 `MODEL_DECISIONS.md`、`CORE_FILE_SYNC_STATUS.md`、`PHYSICS_MODEL_SPEC.md`。
2. `tiltX` / `tiltY` 群組：涵蓋 `tiltX`、`tiltY`、`solveRacketVelXForTargetLandingX`、`tiltXGain`、`tiltXMax`，優先對應 `MODEL_DECISIONS.md`、`PHYSICS_MODEL_SPEC.md`、`EXPERIMENT_LOG.md`。
3. `scale` / `outputRescale` 群組：涵蓋 `scale`、`outputRescale`、`SIM_TIME_DILATION`，優先對應 `VALIDATION_PLAN.md`、`EXPERIMENT_LOG.md`、`CORE_FILE_SYNC_STATUS.md`。

## Codex 審查清單

- [ ] 是否保留狀態標記。
- [ ] 是否標明檔案範圍。
- [ ] 是否避免把研究頁寫成正式頁。
- [ ] 是否保留風險與待驗證事項。
- [ ] 是否避免把 GLM 草稿語氣直接升格。

## 關聯文件

- `docs/PROJECT_OVERVIEW.md`
- `docs/EXPERIMENT_LOG.md`
- `docs/MODEL_DECISIONS.md`
- `docs/PHYSICS_MODEL_SPEC.md`
- `docs/VALIDATION_PLAN.md`
- `docs/DOCS_MAINTENANCE_PLAN.md`
- `AI_CONTEXT/DRAFTS/physics_plan_research_tail_split_draft.md`
