# 開發對照表

> 本表是專案整理階段的模組狀態地圖。它不做最終架構決策，也不判斷物理模型正確性。
>
> 核對基準：2026-07-15
> 主要參考：`docs/CORE_FILE_SYNC_STATUS.md`、`docs/PHYSICS_MODEL_SPEC.md`、`docs/SPIN_DIRECTION_CONTRACT.md`、`AI_CONTEXT/DRAFTS/development_matrix_draft.md`

## 狀態分類

| 狀態 | 意義 |
|---|---|
| 穩定 | 基本規格或文件用途清楚，短期內不預期大改 |
| 半穩定 | 可用，但仍需補驗證、補文件或確認同步 |
| 研究中 | 有原型或實驗，但不可直接視為正式結論 |
| 待決策 | 需要人類或高階模型做方向判斷 |
| 整理中 | 目前主要任務是文件化、拆分、交接 |

## 模組總表

| 模組 | 目前狀態 | 風險 | 相關檔案 | 測試 / 查證方式 | 適合模型 | 備註 |
|---|---|---|---|---|---|---|
| 座標與單位規格 | 半穩定 | 中 | `docs/physics-engine-v2-plan.md`, `docs/PHYSICS_MODEL_SPEC.md`, `docs/SPIN_DIRECTION_CONTRACT.md` | 文件審查、語意 contract test | Codex / 高階模型 | 座標與單位已定；真正側旋軸向尚未遷移，legacy `sidespin` 仍是 x-kick proxy |
| 桌面反彈 v2 | 半穩定 | 中 | `game4.html`, `physics-studio.html`, `tools/physics-v2-contact-mechanics.js` | Node 腳本、關鍵常數查證、後續函式 diff | Codex / 高階模型 | 常數已核對；函式逐字一致尚未工具化驗證 |
| 發球 preset / solve | 半穩定 | 高 | `physics-presets.json`, `serve-generator.html`, `physics-studio.html`, `game4.html`, `tools/serve-success-gate.js`, `docs/SPIN_DIRECTION_CONTRACT.md` | 47 preset contract + 共用 legal-serve gate + solver cross-check + Game 5 實機檢查 | Codex / 高階模型 / 人類 | 47 個 per-video preset 的共用 legal-serve gate 與 cross-check 均 47/47；尚未逐一確認真實視覺軌跡與手感 |
| 正式遊戲回擊 | 半穩定 | 高 | `game4.html` | 單拍批次驗證、核心函式查證 | Codex / 高階模型 | attack/push 走球拍接觸；loop 仍是舊 direct 模型 |
| return-studio 回擊研究頁 | 研究中 | 高 | `return-studio.html` | 視覺工具、符號盤點、後續 diff | Codex / 高階模型 | blend/substepped push 已同步至 game4.html，PADDLE_BLEND=0.605，fallback 修復同步 |
| push/chop 切球模型 | 半穩定 | 中 | `game4.html`, `return-studio.html`, `docs/physics-engine-v2-plan.md` | 單拍、窗口、連續對打、旋轉方向、人工審查 | 高階模型 / Codex | 2026-07-14 完成 20 實驗 + PADDLE_BLEND 校準 + fallback 修復；14/16 preset 穩定 50 回合連續對打 |
| loop / 拉球 | 待決策 | 高 | `game4.html`, `return-studio.html` | 人類決策與高階模型審查 | 高階模型 / 人類 | game4 保留舊模型；return-studio 已移除 |
| 膠皮 / 海綿參數化 | 待決策 | 高 | `docs/physics-engine-v2-plan.md` | 高階模型審查 | 高階模型 / 人類 | 尚未實作，不應寫入正式規格為已部署 |
| 參數搜尋 / 優化 | 研究中 | 高 | `docs/physics-engine-v2-plan.md`, 可能的臨時腳本 | 需先整理腳本來源與目標函式 | Codex / 高階模型 | 搜尋結果不得自動升格成決策 |
| 測試與驗證系統 | 整理中 | 高 | `AI_CONTEXT/DRAFTS/validation_plan_draft.md`, `tools/` | 建立可重跑命令 | Codex / GLM 整理 | repo 無 `package.json`，沒有 npm test |
| 實驗紀錄 | 整理中 | 高 | `docs/EXPERIMENT_LOG.md`, `AI_CONTEXT/DRAFTS/experiment_log_draft.md` | 對照原文、保留已取代標記 | GLM 整理 / Codex 審查 | 下一步需要正式化，但不能移除不確定標記 |
| 模型決策紀錄 | 整理中 | 高 | `docs/MODEL_DECISIONS.md`, `AI_CONTEXT/DRAFTS/model_decisions_draft.md` | 人工審查 | Codex / 高階模型 / 人類 | GLM 草稿中「風險：無」需全部重審 |
| 大包文件一致性收斂 | 整理中 | 高 | `docs/MODEL_DECISIONS.md`, `docs/EXPERIMENT_LOG.md`, `docs/CORE_FILE_SYNC_STATUS.md`, `AI_CONTEXT/GLM_TASKS/` | 大包文字整併、跨文件交叉引用補強 | GLM / Codex / 人類 | 適合一次接多份互相咬合的正式 docs；Codex 只做核對與落版，人類做最後決策 |
| AI 文件系統 | 半穩定 | 中 | `AI_CONTEXT/`, `docs/AI_HANDOFF_TEMPLATE.md`, `docs/DOCS_MAINTENANCE_PLAN.md` | Markdown 檢查、交接流程檢查 | GLM / Codex | 目前整理工作的主體；GLM 適合接大包文字整理，Codex 負責核對落版 |
| 大包文件一致性 | 整理中 | 中 | `AI_CONTEXT/GLM_TASKS/009_big_batch_docs_alignment.md`, `docs/*` | 多文件交叉引用與語氣收斂 | GLM / Codex | 適合 GLM 一次接整包，不拆碎 |

## 只適合高階模型或人類判斷的事項

- `blend` / 高 blend 的物理地位。
- 切球是否應降低法向反彈係數。
- `return-studio.html` 的 substepped push 是否應回寫 `game4.html`。
- loop / 拉球是否保留舊模型、移除或重設計。
- 膠皮 / 海綿參數化是否進入下一階段。
- 連續對打是否要拆分 push / chop / block 等不同技術。
- 搜尋目標函式是否採硬門檻、Pareto 或其他方式。
- 大包文件一致性收斂，尤其是 `MODEL_DECISIONS.md` / `EXPERIMENT_LOG.md` / `CORE_FILE_SYNC_STATUS.md` 的跨文件交叉引用。

## 可交給 GLM 的事項

- 長文件摘要。
- 實驗紀錄初稿。
- 參數表整理。
- 失敗案例整理。
- 文件合併計畫草稿。
- AI handoff 任務包草稿。
- 多文件一致性檢查草稿。

GLM 不可做：

- 最終物理判斷。
- 架構推翻。
- 核心程式修改。
- 自行創造測試結果。
- 把研究中內容改寫成已部署。
- 直接替代 Codex 的 repo 核對與落版。

## 目前最高優先風險

1. `game4.html` 與 `return-studio.html` 物理路徑不同，文件不可混寫。
2. `docs/physics-engine-v2-plan.md` 同時包含已部署、研究中、已取代內容，必須逐步拆分。
3. push/chop 模型仍是研究與驗證重點，不應在整理階段做最終定論。
4. 實驗數字跨不同版本，正式化前必須標明階段與狀態。
5. `blend=0.9` 或高 blend 不得視為最終解。

## 近期整理順序

1. 已完成：`AI_HANDOFF_TEMPLATE.md`、`CORE_FILE_SYNC_STATUS.md`、`PHYSICS_MODEL_SPEC.md` 初步正式化。
2. 進行中：`DEVELOPMENT_MATRIX.md` 保守化。
3. 下一步：建立正式驗證計畫或整理 `EXPERIMENT_LOG.md`。
4. 後續：審查 `MODEL_DECISIONS.md`，修正過度肯定與風險標記。
