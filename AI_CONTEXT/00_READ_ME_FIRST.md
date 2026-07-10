# READ ME FIRST

> 這個資料夾是給 AI model 讀取與交接用的整理區。
>
> 更新日期：2026-07-10  
> 本輪任務：shared-physics-core Phase 1 遷移、批次驗證工具化、MVP 主線規格、計畫審查清單、交接文件更新；不修改物理模型參數。

## 必讀順序

1. AI_CONTEXT/00_READ_ME_FIRST.md：本文件，先看規則。
2. AI_CONTEXT/CHECKPOINT_2026-07-10.md：最新 checkpoint，快速恢復上下文。
3. AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md：目前整理狀態摘要。
4. docs/PROJECT_OVERVIEW.md：正式文件入口。
5. docs/MVP_MAINLINE_SPEC.md：MVP 主線規格與範圍。
6. docs/PLAN_DRAFTING_CHECKLIST.md：計畫審查清單，起草新計畫前自檢。
7. docs/CORE_FILE_SYNC_STATUS.md：核心檔案差異與已核對限制。
8. docs/SHARED_PHYSICS_CORE_PHASE1_APPROVAL.md：共用核心 Phase 1 核准記錄。
9. docs/SHARED_PHYSICS_CORE_PHASE2_TASKPACK.md：共用核心 Phase 2 任務包。
10. docs/PHYSICS_MODEL_SPEC.md：目前可說的物理模型狀態。
11. docs/EXPERIMENT_LOG.md：EXP 狀態索引。
12. docs/MODEL_DECISIONS.md：哪些結果可視為決策，哪些不行。
13. docs/VALIDATION_PLAN.md：已知驗證入口與缺口。
14. docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md：只讀核心函式 / 常數抽取規格。
15. docs/BATCH_VALIDATION_SPEC.md：批次驗證規格。
16. docs/PHYSICS_RESEARCH_TAIL_SPLIT_PLAN.md：後段研究拆解計畫。
17. docs/PHYSICS_RESEARCH_TAIL_INDEX.md：後段研究條目索引。
18. 需要長文原始脈絡時，再讀 docs/physics-engine-v2-plan.md。

## 專案背景

本專案是桌球接發球反應訓練遊戲，正在加入簡化物理模擬模型。最複雜且最高風險的模組是切球 push/chop 的球拍接觸力學與參數搜尋。

目前整理重點不是繼續調參，而是建立共用物理核心、可重跑驗證工具、MVP 主線規格與可維護文件系統。已建立 shared-physics-core.js（Phase 1），三個核心 HTML 已改用共用核心（未 commit）。

## 核心禁止事項

- 未經使用者明確批准，不修改核心程式或物理架構。
- 不把 `return-studio.html` 研究工具功能寫成 `game4.html` 正式遊戲已部署。
- 不把 `blend=0.9` 或高 blend 結果寫成最終物理解。
- 不把 GLM 草稿中的「已部署」「風險：無」直接當真。
- 不把實驗成功率自動升格成模型決策。
- 不刪除失敗案例、不隱藏不確定、不補不存在的資料。

## AI Optimization Runaway Guard

當使用者對某個模擬質感不滿時，不得自動進入大範圍參數搜尋或通用模型重設計。

必須先確認：

1. 這是 gameplay feel 問題，還是 physics correctness 問題？
2. 這是否影響 MVP 主線？
3. 是否可以用限制適用範圍、UI 回饋、動畫提示或題庫選擇解決？
4. 是否只需要最小修正？
5. 是否應另開 research task，而不是納入目前主線？

若未完成以上確認，不得新增參數搜尋任務、不得擴大測試集、不得推動核心物理重構。

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

## AI 分工

ChatGPT：

- 幫你整合、規劃、收斂成流程。

Claude：

- 邊界審查員：只挑錯、降溫、確認邊界，不幫忙擴充方案或提出大重構。

Claude 邊界審查範本：

- 請不要幫我擴充方案，也不要提出大重構。
- 請只審查這個任務包：
- 1. 這個任務邊界是否清楚？
- 2. 是否把 gameplay approximation 誤寫成 physics truth？
- 3. 是否有未驗證假設被當成事實？
- 4. 是否有任務膨脹風險？
- 5. 本輪最應該停止在哪裡？

Codex：

- 執行檔案與程式工作。

GLM：

- 整理、摘要、交叉檢查。

人類使用者：

- 決定哪個方向符合產品目標。

## GLM 呼叫方式

Ollama Windows 版已安裝並可用。GLM 5.2 cloud 應作為 sidecar 呼叫，不要切換 Codex provider。

OpenAI-compatible endpoint：

- URL：`http://127.0.0.1:11434/v1/chat/completions`
- model：`glm-5.2:cloud`
- `reasoning_effort`：`max`
- 建議 `temperature`：`0.1`

GLM 產物放在 `AI_CONTEXT/DRAFTS/`，正式 docs 必須由 Codex 審查後再升級。

## 已執行驗證

本輪跑了四個 Node 驗證工具，全部通過，沒有跑瀏覽器批次驗證。

- `node tools/cross-file-consistency-check.js`：6 constant rules + 2 function rules，全部通過。
- `node tools/physics-v2-contact-mechanics.js`：13 通過 / 0 失敗。
- `node tools/racket-contact-mechanics.js`：單軸對照全部通過；移動拍面段落為人工合理性檢查輸出。
- `node tools/batch-validation.test.js`：14 通過 / 0 失敗（VAL-004 attack / push / loop 三條路徑）。

完整輸出在 `AI_CONTEXT/test_output.txt`。

## 下一步建議

1. 決定是否 commit shared-physics-core.js 遷移的改動（三個 HTML + shared core）。
2. 執行 SHARED_PHYSICS_CORE_PHASE2_TASKPACK：把更多 inline 物理函式納入 shared core。
3. 決定是否進入 MVP 主線實作。
4. 工具化 VAL-003（發球 preset 批次）與 VAL-005（return-studio 回擊批次）。
5. 繼續拆解 `docs/physics-engine-v2-plan.md` 後段研究，補齊來源、版本與失敗案例。
6. 讓人類決定 `return-studio.html` 是否只是研究工具，或哪些機制要進入正式遊戲審查。
7. 草稿區若出現太像正式結論的語句，先接 `AI_CONTEXT/GLM_TASKS/012_draft_stale_language_cleanup.md` 一次清掉。
8. 剩下偏 summary / review / TODO 的草稿，接 `AI_CONTEXT/GLM_TASKS/013_remaining_draft_boundary_pack.md` 收尾。
9. 最後幾份還沒掛頂帽的草稿，接 `AI_CONTEXT/GLM_TASKS/014_residual_draft_boundary_closeout.md`。
10. 尾段候選與 review 內容本體再降溫，接 `AI_CONTEXT/GLM_TASKS/015_tail_candidate_content_softening.md`。

## 工作記錄檔

- `AI_CONTEXT/file_tree.txt`：檔案快照。
- `AI_CONTEXT/git_status.txt`：git 狀態快照。
- `AI_CONTEXT/current_diff.patch`：tracked diff 快照。注意：新文件尚未 stage 時，git diff 不會包含完整內容。
- `AI_CONTEXT/changed_files_manifest.md`：本輪新增/整理檔案清單。
- `AI_CONTEXT/test_output.txt`：本輪驗證輸出。
