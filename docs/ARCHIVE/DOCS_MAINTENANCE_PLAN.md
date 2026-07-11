# Docs Maintenance Plan

> 本文件定義本專案整理後的文件系統分工與合併順序。它不是物理模型規格，也不承載實驗數字。
>
> 建立日期：2026-07-06

## 目標

把原本混在 `docs/physics-engine-v2-plan.md`、對話紀錄、GLM 草稿與工具頁註解中的資訊，整理成可維護的文件系統。

核心原則：

- 正式 docs 只寫已審查或已明確標示狀態的內容。
- GLM 草稿保留在 `AI_CONTEXT/DRAFTS/`，不直接當成結論。
- 研究中內容必須保留「研究中 / 待驗證 / 不確定」標記。
- 實驗結果不得自動升格成模型決策。
- `return-studio.html` 的研究工具功能不得自動寫成 `game4.html` 正式遊戲行為。
- 任何研究版機制要回寫正式頁前，必須先通過 `TODO-008` 的部署前確認清單，且對應驗證項目要能在 `VALIDATION_PLAN.md` 直接找到。

## AI Optimization Runaway Guard

當使用者對某個模擬質感不滿時，不得自動進入大範圍參數搜尋或通用模型重設計。

在展開任何大動作前，必須先確認：

1. 這是 gameplay feel 問題，還是 physics correctness 問題？
2. 這是否影響 MVP 主線？
3. 是否可以用限制適用範圍、UI 回饋、動畫提示或題庫選擇解決？
4. 是否只需要最小修正？
5. 是否應另開 research task，而不是納入目前主線？

若未完成以上確認，不得新增參數搜尋任務、不得擴大測試集、不得推動核心物理重構。

## 原則：先定義技術特質與適用範圍，再追求通用物理解

### 背景

切球模型開發中，原本目標是模擬防守性切球的特質，但在高階模型協助下逐漸轉向尋找通用接觸力學解，導致開發範圍擴大、測試與參數搜尋陷入無底洞。

### 決策

未來新增或重設計桌球技術模型時，必須先定義：

1. 要表現的技術特質
2. 最小適用情境
3. 明確不處理的情境
4. 可接受的簡化
5. 何時才升級為更完整物理模型

### 影響

高階模型不得直接把 gameplay approximation 問題升級成 universal physics model 問題。若需要升級，必須另開研究任務。

## Mainline Protection Rule

任何新創意，不能在同一天直接改核心主線。

必須先經過：

Idea inbox
→ 小實驗
→ 評估
→ 任務包
→ Codex 實作
→ 測試
→ 再決定是否合併

若尚未走完上述流程，不得把新創意直接寫進核心主線、正式規格或既有遊戲頁。

## 新工作規則

1. 每天只允許一個主問題。
2. 核心物理模型一天最多改一次。
3. 高階模型只做審查與判斷，不做雜務。
4. GLM 只做 read-only 整理與報告。
5. Codex 改程式前必須先說明檔案、目的、風險、驗收方式。
6. 每次工作結束必須產一份小 checkpoint。
7. 累了就只允許整理，不允許做架構決策。

## 正式 docs 分工

| 文件 | 用途 | 不應包含 |
|---|---|---|
| `PROJECT_OVERVIEW.md` | 專案目標、遊戲模式、目前整理狀態、AI 分工 | 具體參數、完整實驗紀錄 |
| `PHYSICS_MODEL_SPEC.md` | 已核對正式行為、研究工具行為、待驗證物理事項 | 未標狀態的研究假設 |
| `CORE_FILE_SYNC_STATUS.md` | 核心檔案之間已核對的差異 | 哪一版比較正確的判斷 |
| `DEVELOPMENT_MATRIX.md` | 模組狀態、風險、適合交給哪種模型 | 完整實驗數字、決策理由 |
| `EXPERIMENT_LOG.md` | 實驗紀錄、測試集、結果、失敗案例 | 最終模型決策 |
| `MODEL_DECISIONS.md` | 已決策、已取代、待決策、非決策事項 | 完整實驗過程 |
| `VALIDATION_PLAN.md` | 驗證入口、候選命令、驗證層級與缺口 | 未執行卻被寫成已通過的結果 |
| `READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md` | 只讀核心函式 / 常數抽取規格 | 會寫入核心檔案的實作細節 |
| `BATCH_VALIDATION_SPEC.md` | 批次驗證規格 | 單次手動 console 操作記錄 |
| `PHYSICS_RESEARCH_TAIL_SPLIT_PLAN.md` | 後段研究拆解計畫 | 直接物理解釋或新實驗結論 |
| `PHYSICS_RESEARCH_TAIL_INDEX.md` | 後段研究條目索引 | 尚未分流成正式條目的一大段研究敘述 |
| `AI_HANDOFF_TEMPLATE.md` | AI 小任務交接模板 | 具體任務實例 |
| `physics-engine-v2-plan.md` | 歷史開發紀錄與原始交接文件 | 不應刪除；逐步由其他正式 docs 承接內容 |

## AI_CONTEXT 分工

| 目錄 / 檔案 | 用途 |
|---|---|
| `AI_CONTEXT/00_READ_ME_FIRST.md` | AI 讀取整理資料前的總規則 |
| `AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md` | Codex 對目前 repo 的上下文摘要 |
| `AI_CONTEXT/GLM_TASKS/` | 可交給 GLM 的任務包 |
| `AI_CONTEXT/DRAFTS/` | GLM / Codex 草稿與審查備註 |
| `AI_CONTEXT/file_tree.txt` | repo 檔案快照 |
| `AI_CONTEXT/git_status.txt` | git 狀態快照 |
| `AI_CONTEXT/current_diff.patch` | tracked diff 快照 |
| `AI_CONTEXT/recent_commits.txt` | 最近 commits 快照 |
| `AI_CONTEXT/test_output.txt` | 測試或無測試入口說明 |

## AI 角色分工

- ChatGPT：幫你整合、規劃、收斂成流程。
- Claude：幫你挑錯、降溫、確認邊界。
- Codex：執行檔案與程式工作。
- GLM：整理、摘要、交叉檢查。
- 人類使用者：決定哪個方向符合產品目標。

## 合併順序

### 已完成

1. 建立 `AI_CONTEXT/` 與 GLM 任務包。
2. 產生 GLM 草稿：長文件結構化、push 摘要、實驗紀錄、開發矩陣、交接模板、模型決策、核心同步盤點、驗證計畫、docs 合併計畫。
3. 正式升級 `AI_HANDOFF_TEMPLATE.md`。
4. 新增 `CORE_FILE_SYNC_STATUS.md`。
5. 重寫 `PHYSICS_MODEL_SPEC.md`，分成已核對正式行為、研究工具行為、待驗證事項。
6. 收斂 `DEVELOPMENT_MATRIX.md`，標示模組成熟度、風險與模型分工。
7. 建立 `EXPERIMENT_LOG.md`，整理 EXP-001 至 EXP-038 狀態索引。
8. 重寫 `MODEL_DECISIONS.md`，移除「風險：無」並保留待驗證事項。
9. 更新 `PROJECT_OVERVIEW.md` 為文件入口。
10. 建立 `VALIDATION_PLAN.md`，區分候選驗證入口與尚未執行結果。
11. 執行兩個既有 Node 驗證腳本，並將輸出寫入 `AI_CONTEXT/test_output.txt`。

### 下一步

1. 建立只讀核心函式 / 常數抽取工具，輔助比較 `game4.html`、`return-studio.html`、`physics-studio.html`。
2. 將兩個既有 Node 驗證腳本納入固定檢查流程，之後每次改物理文件或核心物理前後都重跑。
3. 將發球與回擊批次檢查工具化，避免依賴瀏覽器 console 手動操作。
4. 繼續拆解 `docs/physics-engine-v2-plan.md` 後段研究，補齊實驗來源、版本與失敗案例。
5. 決定 `return-studio.html` 是否只是研究工具，或哪些機制要進入正式遊戲審查。

## 合併檢查清單

每次把草稿升成正式 docs 前，必須檢查：

- [ ] 是否保留「已部署 / 研究中 / 已取代 / 待驗證 / 不確定」狀態。
- [ ] 是否把 GLM 草稿中的「已部署」用目前 repo 檔案核對過。
- [ ] 是否保留原始參數名稱。
- [ ] 是否避免把搜尋結果升格成決策。
- [ ] 是否避免把使用者觀察升格成物理定論。
- [ ] 是否避免把 `blend=0.9` 或高 blend 寫成最終解。
- [ ] 是否避免把 `return-studio.html` 研究功能寫成 `game4.html` 正式遊戲行為。
- [ ] 是否保留失敗案例。

## 不做的事

目前整理階段不做：

- 不修改核心程式。
- 不調參。
- 不搜尋最佳物理參數。
- 不決定下一版切球模型。
- 不讓 GLM 做最終物理判斷。
