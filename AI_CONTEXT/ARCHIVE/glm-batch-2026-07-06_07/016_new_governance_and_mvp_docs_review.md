# GLM Task 016: 今日新增文件一致性與邊界檢查

## 目的

請只做 read-only 整理與交叉檢查，不修改任何檔案，不新增任何文件，不建立新的任務包。

這一輪的目標是確認「今天新增或更新的治理文件、主線草稿、與靈感收集文件」之間是否一致，哪些地方需要再收斂，哪些地方應該維持分開。

## 讀取範圍

請優先閱讀以下檔案：

- `AI_CONTEXT/00_READ_ME_FIRST.md`
- `docs/PROJECT_OVERVIEW.md`
- `docs/DOCS_MAINTENANCE_PLAN.md`
- `docs/MVP_MAINLINE_SPEC.md`
- `AI_CONTEXT/DRAFTS/gameplay_idea_inbox.md`
- `AI_CONTEXT/DRAFTS/creative_evaluation_table.md`

如有必要，再回看：

- `AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md`
- `docs/MODEL_DECISIONS.md`
- `docs/AI_HANDOFF_TEMPLATE.md`

## 你要檢查的事情

1. 這些文件之間的定位是否清楚，會不會互相重複。
2. `00_READ_ME_FIRST.md`、`PROJECT_OVERVIEW.md`、`DOCS_MAINTENANCE_PLAN.md` 的治理規則是否一致。
3. `MVP_MAINLINE_SPEC.md` 是否仍然只是 MVP 草稿，沒有擴張成完整比賽模擬。
4. `gameplay_idea_inbox.md` 與 `creative_evaluation_table.md` 是否適合維持為兩個獨立用途，還是有明顯重疊。
5. 是否有任何語句把 gameplay approximation 寫得像 physics truth。
6. 是否有任何地方把「整理」寫成「已完成實作」。
7. 是否有任何新文件看起來應該先停在草稿，不該立刻升級為正式 docs。

## 明確禁止

- 不要新增任何檔案
- 不要修改任何檔案
- 不要新增 GLM_TASKS
- 不要做物理模型決策
- 不要把研究工具內容寫進正式主線
- 不要擴大 MVP 主線
- 不要提出程式修改建議

## 請輸出的格式

請用簡短條列回覆，分成這 4 段：

1. `整體判斷`
   - 這批文件目前是否可接受
   - 是否需要再整理一次

2. `重複或衝突`
   - 哪些文件功能重疊
   - 哪些規則或敘述有衝突

3. `需要保留分開`
   - 哪些文件應該維持獨立
   - 原因是什麼

4. `本輪應停止處`
   - 最應該先停在哪裡
   - 哪些內容不要再往下展開

## 判斷原則

- 先保邊界，再談整合。
- 如果只是命名或格式重複，優先建議收斂。
- 如果用途不同，即使主題相近，也不要硬合併。
- 如果任何內容看起來像正式決策，但其實只是草稿，請明確指出。
- 不要把這批文件升級成更大範圍的計畫。
